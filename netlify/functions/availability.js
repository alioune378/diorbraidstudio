'use strict';
const core = require('./_lib/core');
const { store, listJSON, getSettings } = require('./_lib/store');
const { json } = require('./_lib/http');
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method' });
  const q = event.queryStringParameters || {};
  try {
    const st = store(event);
    const settings = await getSettings(st);
    if (!settings || !core.hasHours(core.mergeSettings(settings))) return json(200, { mode: 'preference' });
    const [appts, blocks] = await Promise.all([listJSON(st, 'appt/'), listJSON(st, 'block/')]);
    const av = core.availability({ settings, appts, blocks, serviceId: q.service, variation: q.variation, from: q.from, days: Math.min(Number(q.days) || 42, 92) });
    return json(200, av);
  } catch (e) {
    console.error(e);
    return json(503, { error: 'unavailable' });
  }
};
