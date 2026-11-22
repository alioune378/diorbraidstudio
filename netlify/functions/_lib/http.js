'use strict';
const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
function parse(event) { try { return JSON.parse(event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : '{}'); } catch (e) { return null; } }
module.exports = { json, parse };
