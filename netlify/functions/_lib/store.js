'use strict';
/* Netlify Blobs wrapper (strong consistency). Tests inject global.__DIOR_STORE. */
const crypto = require('crypto');
function store(event) {
  if (global.__DIOR_STORE) return global.__DIOR_STORE;
  const { getStore, connectLambda } = require('@netlify/blobs');
  if (event && connectLambda) { try { connectLambda(event); } catch (e) { /* v2 runtime */ } }
  return getStore({ name: 'dior-booking', consistency: 'strong' });
}
const newId = () => new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(4).toString('hex');

async function listJSON(st, prefix) {
  const { blobs } = await st.list({ prefix });
  const out = await Promise.all(blobs.map(b => st.get(b.key, { type: 'json' })));
  return out.filter(Boolean);
}
async function getSettings(st) { return (await st.get('settings', { type: 'json' })) || null; }

/* Acquire every lock for `id`; on any conflict release what we took. Uses onlyIfNew when supported + read-back. */
async function acquire(st, keys, id) {
  const taken = [];
  for (const k of keys) {
    const cur = await st.get(k);
    if (cur && cur !== id) { await release(st, taken, id); return false; }
    if (!cur) {
      let r; try { r = await st.set(k, id, { onlyIfNew: true }); } catch (e) { r = await st.set(k, id); }
      if (r && r.modified === false) { const again = await st.get(k); if (again !== id) { await release(st, taken, id); return false; } }
      const check = await st.get(k);
      if (check !== id) { await release(st, taken, id); return false; }
      taken.push(k);
    }
  }
  return true;
}
async function release(st, keys, id) {
  for (const k of keys) { const cur = await st.get(k); if (cur === id) await st.delete(k); }
}
module.exports = { store, newId, listJSON, getSettings, acquire, release };
