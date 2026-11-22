'use strict';
/* Owner API — requires a logged-in Netlify Identity user (registration is invite-only). */
const core = require('./_lib/core');
const S = require('./_lib/store');
const mail = require('./_lib/mail');
const { json, parse } = require('./_lib/http');

function authorised(context) {
  const u = context && context.clientContext && context.clientContext.user;
  if (!u) return null;
  const allow = (process.env.OWNER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(String(u.email || '').toLowerCase())) return null;
  return u;
}

exports.handler = async (event, context) => {
  const user = authorised(context);
  if (!user) return json(401, { error: 'auth' });
  const q = event.queryStringParameters || {};
  const body = event.httpMethod === 'POST' ? parse(event) : {};
  if (body === null) return json(400, { error: 'json' });
  const action = q.action || body.action;
  try {
    const st = S.store(event);
    const settings = core.mergeSettings(await S.getSettings(st));
    const load = id => st.get('appt/' + id, { type: 'json' });
    const save = a => st.setJSON('appt/' + a.id, a);
    const all = () => S.listJSON(st, 'appt/');
    const log = (a, what, extra) => { a.history = a.history || []; a.history.push(Object.assign({ at: new Date().toISOString(), what, by: user.email }, extra || {})); };

    async function place(a, date, time, duration) {
      // check against confirmed/pending appointments + blocks, ignoring this appointment, then lock
      const [appts, blocks] = await Promise.all([all(), S.listJSON(st, 'block/')]);
      const busy = core.busyIntervals(appts, blocks, settings, a.id);
      const s = core.abs(date, core.toMin(time)), e = s + duration + settings.buffer;
      if (core.overlaps(s, e, busy)) return false;
      const keys = core.lockKeys(date, time, duration + settings.buffer, settings.step);
      if (!(await S.acquire(st, keys, a.id))) return false;
      const old = (a.locks || []).filter(k => !keys.includes(k));
      await S.release(st, old, a.id);
      Object.assign(a, { date, time, duration, locks: keys });
      return true;
    }

    switch (action) {
      case 'list': {
        let list = await all();
        if (q.from) list = list.filter(a => !a.date || a.date >= q.from);
        if (q.to) list = list.filter(a => !a.date || a.date <= q.to);
        list.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time) || x.created.localeCompare(y.created));
        const blocks = await S.listJSON(st, 'block/');
        const services = core.services().map(x => ({ id: x.id, name: x.name.fr, duration_min: x.duration_min || null,
          variations: (x.variations || []).map(v => ({ name: v.name.fr, duration_min: v.duration_min || null })) }));
        return json(200, { appointments: list, blocks, settings, services, email: mail.configured() });
      }
      case 'confirm':
      case 'reschedule': {
        const a = await load(body.id); if (!a) return json(404, { error: 'not_found' });
        const date = body.date || a.date, time = body.time || a.time;
        const duration = Number(body.duration || a.duration || 0);
        if (!core.isDate(date) || !core.isTime(time)) return json(422, { error: 'need_slot' });
        if (!(duration >= 15 && duration <= 720)) return json(422, { error: 'need_duration' });
        if (!(await place(a, date, time, duration))) return json(409, { error: 'conflict' });
        const was = a.status; a.status = 'confirmed';
        log(a, action === 'confirm' ? 'confirmed' : 'rescheduled', { date, time, duration });
        await save(a);
        const emailed = await mail.notifyClient(action === 'confirm' || was !== 'confirmed' ? 'confirmed' : 'rescheduled', a);
        return json(200, { ok: true, appointment: a, emailed });
      }
      case 'decline':
      case 'cancel': {
        const a = await load(body.id); if (!a) return json(404, { error: 'not_found' });
        a.status = action === 'decline' ? 'declined' : 'cancelled';
        if (body.reason) a.reason = core.clean(body.reason, 500);
        await S.release(st, a.locks || [], a.id); a.locks = [];
        log(a, a.status); await save(a);
        const emailed = await mail.notifyClient(action === 'decline' ? 'declined' : 'cancelled', a);
        return json(200, { ok: true, appointment: a, emailed });
      }
      case 'note': {
        const a = await load(body.id); if (!a) return json(404, { error: 'not_found' });
        a.owner_note = core.clean(body.note, 2000); await save(a);
        return json(200, { ok: true, appointment: a });
      }
      case 'create': {
        const { errs, data } = core.validateRequest(Object.assign({ consent: true }, body));
        if (errs.length) return json(422, { error: 'invalid', fields: errs });
        const a = Object.assign({ id: S.newId(), created: new Date().toISOString(), status: 'pending', history: [], source: 'owner' }, data);
        const duration = Number(body.duration || core.serviceDuration(a.service, a.variation) || 0);
        if (!(duration >= 15) || !a.date || !a.time) return json(422, { error: 'need_slot' });
        if (!(await place(a, a.date, a.time, duration))) return json(409, { error: 'conflict' });
        a.status = 'confirmed'; log(a, 'created'); await save(a);
        return json(200, { ok: true, appointment: a });
      }
      case 'block': {
        const b = { id: S.newId(), date: body.date, end_date: body.end_date || body.date, all_day: !!body.all_day, start: body.start || '00:00', end: body.end || '23:59', label: core.clean(body.label, 120) };
        if (!core.isDate(b.date) || !core.isDate(b.end_date) || b.end_date < b.date || (!b.all_day && (!core.isTime(b.start) || !core.isTime(b.end) || (b.date === b.end_date && b.end <= b.start)))) return json(422, { error: 'invalid' });
        await st.setJSON('block/' + b.id, b);
        return json(200, { ok: true, block: b });
      }
      case 'unblock': { await st.delete('block/' + String(body.id).replace(/[^\w-]/g, '')); return json(200, { ok: true }); }
      case 'settings': {
        if (event.httpMethod === 'GET') return json(200, { settings });
        const n = core.mergeSettings(body.settings);
        for (const d of Object.keys(n.weekly)) {
          const iv = (n.weekly[d] || []).filter(x => Array.isArray(x) && core.isTime(x[0]) && core.isTime(x[1]) && x[1] > x[0]);
          n.weekly[d] = iv.slice(0, 4);
        }
        n.step = [15, 30, 60].includes(Number(n.step)) ? Number(n.step) : 30;
        n.buffer = Math.max(0, Math.min(120, Number(n.buffer) || 0));
        n.lead_hours = Math.max(0, Math.min(336, Number(n.lead_hours) || 0));
        n.horizon_days = Math.max(7, Math.min(180, Number(n.horizon_days) || 60));
        n.instant = !!n.instant;
        await st.setJSON('settings', n);
        return json(200, { ok: true, settings: n });
      }
      default: return json(400, { error: 'action' });
    }
  } catch (e) {
    console.error(e);
    return json(503, { error: 'unavailable' });
  }
};
