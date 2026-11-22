'use strict';
const core = require('./_lib/core');
const S = require('./_lib/store');
const mail = require('./_lib/mail');
const { json, parse } = require('./_lib/http');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const b = parse(event); if (!b) return json(400, { error: 'json' });
  if (b.company) return json(200, { ok: true, status: 'pending' }); // honeypot
  const { errs, data } = core.validateRequest(b);
  if (errs.length) return json(422, { error: 'invalid', fields: errs });
  try {
    const st = S.store(event);
    const settings = core.mergeSettings(await S.getSettings(st));
    const slotsMode = core.hasHours(settings);
    const a = Object.assign({ id: S.newId(), created: new Date().toISOString(), status: 'pending', history: [] }, data);
    a.duration = core.serviceDuration(a.service, a.variation);
    if (slotsMode) {
      if (!a.date || !a.time) return json(422, { error: 'invalid', fields: ['slot'] });
      const [appts, blocks] = await Promise.all([S.listJSON(st, 'appt/'), S.listJSON(st, 'block/')]);
      const ok = core.slotIsAvailable({ settings, appts, blocks, serviceId: a.service, variation: a.variation }, a.date, a.time);
      if (!ok) return json(409, { error: 'slot_taken' });
      const len = (a.duration || settings.step) + (a.duration ? settings.buffer : 0);
      a.locks = core.lockKeys(a.date, a.time, len, settings.step);
      if (!(await S.acquire(st, a.locks, a.id))) return json(409, { error: 'slot_taken' });
      if (settings.instant && a.duration) a.status = 'confirmed';
    } else {
      a.time = ''; // preference only — never presented as a reserved slot
      a.locks = [];
    }
    a.history.push({ at: a.created, what: a.status === 'confirmed' ? 'booked' : 'requested' });
    await st.setJSON('appt/' + a.id, a);
    const emailed = await mail.notifyClient(a.status === 'confirmed' ? 'confirmed' : 'received', a);
    await mail.notifyOwner(a);
    return json(200, { ok: true, id: a.id, status: a.status, mode: slotsMode ? 'slots' : 'preference', emailed });
  } catch (e) {
    console.error(e);
    return json(503, { error: 'unavailable' });
  }
};
