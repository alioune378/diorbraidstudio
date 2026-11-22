'use strict';
/* Pure booking logic (no I/O) — studio local time strings "YYYY-MM-DDTHH:MM" (America/Toronto). */
const SITE = require('../../../content/site.json');
const TZ = 'America/Toronto';

const DEFAULT_SETTINGS = {
  weekly: { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] }, // 0 = Sunday; [["09:00","17:00"]]
  step: 30,          // minutes between proposed start times
  buffer: 15,        // minutes kept free after each appointment
  lead_hours: 24,    // minimum notice
  horizon_days: 60,  // how far ahead clients can book
  instant: false     // true = auto-confirm when the service duration is known
};

const pad = n => String(n).padStart(2, '0');
const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const fromMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

function nowLocal(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
function dayDiff(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5); }
// absolute minutes from an epoch day (local) — used for cross-day comparisons
function abs(date, min) { return dayDiff('2000-01-01', date) * 1440 + min; }

function mergeSettings(s) {
  const o = Object.assign({}, DEFAULT_SETTINGS, s || {});
  o.weekly = Object.assign({}, DEFAULT_SETTINGS.weekly, (s && s.weekly) || {});
  return o;
}
function hasHours(settings) { return Object.values(settings.weekly).some(a => Array.isArray(a) && a.length); }

function services() { return (SITE.services || []).filter(s => (s.status || 'READY') === 'READY'); }
function service(id) { return services().find(s => s.id === id) || null; }
function serviceDuration(id, variationName) {
  const s = service(id); if (!s) return null;
  const v = (s.variations || []).find(x => x.name && (x.name.fr === variationName || x.name.en === variationName));
  const d = (v && v.duration_min) || s.duration_min;
  return d ? Number(d) : null;
}

/* Busy intervals [startAbs, endAbs) from appointments + blocks */
function busyIntervals(appts, blocks, settings, ignoreId) {
  const out = [];
  for (const a of appts) {
    if (a.id === ignoreId || !a.date || !a.time) continue;
    if (a.status === 'confirmed') out.push([abs(a.date, toMin(a.time)), abs(a.date, toMin(a.time)) + Number(a.duration || settings.step) + Number(settings.buffer || 0)]);
    else if (a.status === 'pending') out.push([abs(a.date, toMin(a.time)), abs(a.date, toMin(a.time)) + Number(a.duration || settings.step)]);
  }
  for (const b of blocks) {
    const s = abs(b.date, b.all_day ? 0 : toMin(b.start)), e = abs(b.end_date || b.date, b.all_day ? 1440 : toMin(b.end));
    out.push([s, e]);
  }
  return out;
}
const overlaps = (s, e, busy) => busy.some(([bs, be]) => s < be && bs < e);

function availability({ settings, appts, blocks, serviceId, variation, from, days, now }) {
  settings = mergeSettings(settings);
  if (!hasHours(settings)) return { mode: 'preference' };
  const dur = serviceDuration(serviceId, variation);
  const len = dur || settings.step;
  const busy = busyIntervals(appts, blocks, settings);
  const n = nowLocal(now);
  const minAbs = abs(n.date, n.min) + settings.lead_hours * 60;
  const lastDate = addDays(n.date, settings.horizon_days);
  const res = {};
  const start = from && isDate(from) && from > n.date ? from : n.date;
  for (let i = 0; i < (days || 42); i++) {
    const date = addDays(start, i);
    if (date > lastDate) break;
    const slots = [];
    for (const [a, b] of settings.weekly[String(weekday(date))] || []) {
      for (let m = toMin(a); m + len <= toMin(b); m += settings.step) {
        const s = abs(date, m);
        if (s < minAbs) continue;
        if (overlaps(s, s + len + (dur ? settings.buffer : 0), busy)) continue;
        slots.push(fromMin(m));
      }
    }
    if (slots.length) res[date] = slots;
  }
  return { mode: 'slots', duration_known: !!dur, duration: dur, step: settings.step, days: res };
}

function slotIsAvailable(args, date, time) {
  const av = availability(Object.assign({}, args, { from: date, days: 1 }));
  return av.mode === 'slots' && (av.days[date] || []).includes(time);
}

/* Lock keys: one per step-sized cell covered by [time, time+len) */
function lockKeys(date, time, len, step) {
  const keys = []; const s = toMin(time);
  for (let m = s - (s % step); m < s + len; m += step) {
    const d = addDays(date, Math.floor(m / 1440)); const mm = ((m % 1440) + 1440) % 1440;
    keys.push(`lock/${d}T${fromMin(mm)}`);
  }
  return keys;
}

function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

function validateRequest(b) {
  const errs = [];
  const s = service(b.service);
  if (!s) errs.push('service');
  const name = clean(b.name, 120); if (name.length < 2) errs.push('name');
  const phone = clean(b.phone, 40), email = clean(b.email, 160);
  const phoneOk = phone.replace(/\D/g, '').length >= 10, emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if ((!phone && !email) || (phone && !phoneOk) || (email && !emailOk)) errs.push('contact');
  if (b.consent !== true && b.consent !== 'yes') errs.push('consent');
  if (b.date && !isDate(b.date)) errs.push('date');
  if (b.time && !isTime(b.time)) errs.push('time');
  const lang = b.lang === 'en' ? 'en' : 'fr';
  return {
    errs, data: {
      service: s ? s.id : '', service_name: s ? (s.name[lang] || s.name.fr) : '',
      variation: clean(b.variation, 120), style: clean(b.style, 800), length: clean(b.length, 40), size: clean(b.size, 40),
      addons: Array.isArray(b.addons) ? b.addons.map(x => clean(x, 80)).slice(0, 10) : [],
      date: isDate(b.date) ? b.date : '', time: isTime(b.time) ? b.time : '', time_pref: clean(b.time_pref, 40),
      name, phone, email, contact_pref: clean(b.contact_pref, 40), notes: clean(b.notes, 1500), lang,
      photo: !!b.photo
    }
  };
}

module.exports = { TZ, DEFAULT_SETTINGS, mergeSettings, hasHours, availability, slotIsAvailable, lockKeys, validateRequest, serviceDuration, service, services, toMin, fromMin, isDate, isTime, addDays, nowLocal, clean, busyIntervals, overlaps, abs };
