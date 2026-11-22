'use strict';
/* Optional email via Resend. Configured only when RESEND_API_KEY and MAIL_FROM are set in Netlify env vars. */
const SITE = require('../../../content/site.json');
const B = SITE.business;
const T = {
  fr: {
    received: ['Votre demande a bien été reçue', 'Merci {name}. Nous avons bien reçu votre demande pour « {service} »{when}. Elle n’est pas encore confirmée : Dior vous contactera pour confirmer le tarif, la durée et le créneau.'],
    confirmed: ['Votre rendez-vous est confirmé', 'Bonjour {name}, votre rendez-vous « {service} » est confirmé le {when}. L’adresse exacte du studio à Laval vous sera communiquée par Dior.'],
    declined: ['Votre demande de rendez-vous', 'Bonjour {name}, Dior n’est malheureusement pas disponible pour « {service} »{when}. N’hésitez pas à proposer une autre date.'],
    rescheduled: ['Votre rendez-vous a été déplacé', 'Bonjour {name}, votre rendez-vous « {service} » a été déplacé au {when}.'],
    cancelled: ['Votre rendez-vous est annulé', 'Bonjour {name}, votre rendez-vous « {service} »{when} est annulé. Contactez Dior pour en fixer un autre.'],
    reminder: ['Rappel : votre rendez-vous de demain', 'Bonjour {name}, petit rappel : votre rendez-vous « {service} » a lieu le {when}. À demain !'],
    sign: 'Dior Braid Studio — Laval, Québec'
  },
  en: {
    received: ['We received your request', 'Thank you {name}. We received your request for “{service}”{when}. It is not confirmed yet: Dior will contact you to confirm the price, duration and time.'],
    confirmed: ['Your appointment is confirmed', 'Hello {name}, your “{service}” appointment is confirmed for {when}. Dior will share the exact studio address in Laval.'],
    declined: ['About your appointment request', 'Hello {name}, unfortunately Dior is not available for “{service}”{when}. Feel free to suggest another date.'],
    rescheduled: ['Your appointment has been moved', 'Hello {name}, your “{service}” appointment has been moved to {when}.'],
    cancelled: ['Your appointment is cancelled', 'Hello {name}, your “{service}” appointment{when} has been cancelled. Contact Dior to book another time.'],
    reminder: ['Reminder: your appointment tomorrow', 'Hello {name}, a quick reminder: your “{service}” appointment is on {when}. See you tomorrow!'],
    sign: 'Dior Braid Studio — Laval, Québec'
  }
};
function when(a, lang, bare) {
  if (!a.date) return bare ? '' : '';
  const d = new Date(a.date + 'T12:00:00Z').toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const t = a.time ? (lang === 'en' ? ` at ${a.time}` : ` à ${a.time.replace(':', ' h ')}`) : '';
  return d + t;
}
function compose(kind, a) {
  const L = T[a.lang === 'en' ? 'en' : 'fr'];
  const w = when(a, a.lang);
  const inline = ['received', 'declined', 'cancelled'].includes(kind) ? (w ? (a.lang === 'en' ? ` on ${w}` : ` le ${w}`) : '') : w;
  const body = L[kind][1].replace('{name}', a.name).replace('{service}', a.service_name).replace('{when}', inline);
  return { subject: L[kind][0] + ' — Dior Braid Studio', text: `${body}\n\n${B.phone} · ${B.email}\n${L.sign}` };
}
function configured() { return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM); }
async function send(to, subject, text) {
  if (!configured() || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, reply_to: B.email })
    });
    return r.ok;
  } catch (e) { return false; }
}
async function notifyClient(kind, a) { if (!a.email) return false; const m = compose(kind, a); return send(a.email, m.subject, m.text); }
async function notifyOwner(a) {
  const to = process.env.OWNER_EMAIL || B.email;
  const lines = [`Nouvelle demande — ${a.service_name}${a.variation ? ' / ' + a.variation : ''}`, `Cliente : ${a.name}`, `Tél : ${a.phone || '—'} · Courriel : ${a.email || '—'}`,
    `Date : ${a.date || '—'} ${a.time || a.time_pref || ''}`, `Style : ${a.style || '—'}`, `Longueur / taille : ${a.length || '—'} / ${a.size || '—'}`,
    `Options : ${(a.addons || []).join(', ') || '—'}`, `Statut : ${a.status}`, '', `Gérer : ${B.site_url}/gestion/`];
  return send(to, `Nouvelle demande de rendez-vous — ${a.name}`, lines.join('\n'));
}
module.exports = { compose, configured, notifyClient, notifyOwner, when };
