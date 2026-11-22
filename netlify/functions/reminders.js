'use strict';
/* Scheduled daily: email a reminder for tomorrow's confirmed appointments (only when email is configured). */
const core = require('./_lib/core');
const S = require('./_lib/store');
const mail = require('./_lib/mail');
exports.handler = async (event) => {
  if (!mail.configured()) return { statusCode: 200, body: 'email not configured' };
  const st = S.store(event);
  const tomorrow = core.addDays(core.nowLocal().date, 1);
  const list = (await S.listJSON(st, 'appt/')).filter(a => a.status === 'confirmed' && a.date === tomorrow && !a.reminded);
  for (const a of list) { if (await mail.notifyClient('reminder', a)) { a.reminded = new Date().toISOString(); await st.setJSON('appt/' + a.id, a); } }
  return { statusCode: 200, body: `sent ${list.length}` };
};
