/* Dior Braid Studio — owner dashboard (bookings) */
(function () {
  'use strict';
  var d = document, ID = window.netlifyIdentity, user = null, DATA = { appointments: [], blocks: [], settings: null, services: [] };
  var TEST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]test=1/.test(location.search);
  var view = 'week', cursor = today();
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var STATUS = { pending: 'En attente', confirmed: 'Confirmé', declined: 'Refusé', cancelled: 'Annulé' };

  function today() { var n = new Date(); return n.getFullYear() + '-' + p2(n.getMonth() + 1) + '-' + p2(n.getDate()); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(ds, n) { var x = new Date(ds + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function dow(ds) { return new Date(ds + 'T12:00:00Z').getUTCDay(); }
  function fmtDate(ds, long) { if (!ds) return '—'; var x = new Date(ds + 'T12:00:00Z'); return (long ? DAYS[x.getUTCDay()] + ' ' : '') + x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; }
  function fmtT(t) { return t ? t.replace(':', ' h ') : ''; }
  function dur(m) { if (!m) return 'durée à définir'; var h = Math.floor(m / 60), mi = m % 60; return (h ? h + ' h' : '') + (mi ? ' ' + p2(mi) : ''); }
  function esc(s) { var x = d.createElement('div'); x.textContent = s == null ? '' : String(s); return x.innerHTML; }
  function toast(msg) { var t = d.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }

  // ---------------------------------------------------------------- auth
  function token() {
    if (TEST) return Promise.resolve('test');
    var u = ID && ID.currentUser(); if (!u) return Promise.reject(new Error('auth'));
    return u.jwt();
  }
  function api(method, action, body, qs) {
    return token().then(function (tk) {
      var h = { 'Content-Type': 'application/json' };
      if (TEST) h['x-test-owner'] = '1'; else h.Authorization = 'Bearer ' + tk;
      return fetch('/api/owner?action=' + action + (qs || ''), { method: method, headers: h, body: body ? JSON.stringify(Object.assign({ action: action }, body)) : undefined });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function showApp(u) {
    user = u; d.getElementById('login').hidden = true; d.getElementById('app').hidden = false; d.getElementById('logout').hidden = TEST;
    d.getElementById('who').textContent = TEST ? 'mode test' : (u.email || '');
    load();
  }
  function showLogin() { d.getElementById('login').hidden = false; d.getElementById('app').hidden = true; d.getElementById('logout').hidden = true; }
  if (TEST) showApp({ email: 'test' });
  else if (ID) {
    ID.on('init', function (u) { u ? showApp(u) : showLogin(); });
    ID.on('login', function (u) { ID.close(); showApp(u); });
    ID.on('logout', showLogin);
    ID.on('error', function (e) { d.getElementById('login-err').textContent = 'Connexion impossible : ' + (e && e.message || e); });
    ID.init();
  } else { showLogin(); d.getElementById('login-err').textContent = 'Le service de connexion n’a pas pu être chargé.'; }
  d.getElementById('login-btn').addEventListener('click', function () { ID ? ID.open('login') : null; });
  d.getElementById('logout').addEventListener('click', function () { ID && ID.logout(); });

  // ---------------------------------------------------------------- data
  function load() {
    return api('GET', 'list').then(function (j) {
      if (j._status === 401) { toast('Session expirée — reconnectez-vous.'); showLogin(); return; }
      if (j._status !== 200) { toast('Le service de réservation ne répond pas (' + j._status + ').'); return; }
      DATA = j; d.getElementById('mail-banner').hidden = !!j.email; renderAll();
    });
  }
  function svcName(id) { var s = (DATA.services || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function svcDur(id, variation) { var s = (DATA.services || []).filter(function (x) { return x.id === id; })[0]; if (!s) return null; var v = (s.variations || []).filter(function (x) { return x.name === variation; })[0]; return (v && v.duration_min) || s.duration_min || null; }
  function renderAll() { renderReq(); renderCal(); renderBlocks(); renderHours(); renderClients(); }

  // ---------------------------------------------------------------- messages to clients
  function msgText(a, kind) {
    var en = a.lang === 'en', when = a.date ? fmtDate(a.date, true) + (a.time ? (en ? ' at ' + a.time : ' à ' + fmtT(a.time)) : '') : '';
    var M = en ? {
      confirm: 'Hello ' + a.name + ', your ' + a.service_name + ' appointment at Dior Braid Studio is confirmed for ' + when + '. See you soon!',
      decline: 'Hello ' + a.name + ', thank you for your request. Unfortunately I am not available' + (when ? ' on ' + when : '') + '. Could you suggest another date?',
      info: 'Hello ' + a.name + ', this is Dior from Dior Braid Studio about your ' + a.service_name + ' request.'
    } : {
      confirm: 'Bonjour ' + a.name + ', votre rendez-vous « ' + a.service_name + ' » chez Dior Braid Studio est confirmé le ' + when + '. À bientôt !',
      decline: 'Bonjour ' + a.name + ', merci pour votre demande. Malheureusement, je ne suis pas disponible' + (when ? ' le ' + when : '') + '. Pourriez-vous proposer une autre date ?',
      info: 'Bonjour ' + a.name + ', c’est Dior de Dior Braid Studio au sujet de votre demande « ' + a.service_name + ' ».'
    };
    return M[kind] || M.info;
  }
  function msgButtons(a, kind) {
    var txt = msgText(a, kind || (a.status === 'confirmed' ? 'confirm' : 'info')), ph = (a.phone || '').replace(/[^\d+]/g, ''), out = '';
    if (ph) { var intl = ph.replace(/^\+/, ''); if (intl.length === 10) intl = '1' + intl;
      out += '<a class="ghost sm" href="sms:' + esc(ph) + '?&body=' + encodeURIComponent(txt) + '">Texto</a>';
      out += '<a class="ghost sm" href="https://wa.me/' + intl + '?text=' + encodeURIComponent(txt) + '" target="_blank" rel="noopener">WhatsApp</a>';
      out += '<a class="ghost sm" href="tel:' + esc(ph) + '">Appeler</a>'; }
    if (a.email) out += '<a class="ghost sm" href="mailto:' + esc(a.email) + '?subject=' + encodeURIComponent('Dior Braid Studio') + '&body=' + encodeURIComponent(txt) + '">Courriel</a>';
    return out;
  }

  // ---------------------------------------------------------------- requests
  function apptCard(a, full) {
    var when = a.date ? fmtDate(a.date, true) + (a.time ? ' · ' + fmtT(a.time) : (a.time_pref ? ' · ' + esc(a.time_pref) + ' (souhait)' : ' (date souhaitée)')) : 'Date non précisée';
    var rows = [['Cliente', a.name], ['Téléphone', a.phone], ['Courriel', a.email], ['Préférence', a.contact_pref], ['Style', [a.variation, a.style].filter(Boolean).join(' — ')],
      ['Longueur / taille', [a.length, a.size].filter(Boolean).join(' / ')], ['Options', (a.addons || []).join(', ')], ['Photo', a.photo ? 'Oui — voir le courriel Netlify Forms' : ''],
      ['Message', a.notes], ['Durée', a.status === 'confirmed' ? dur(a.duration) : ''], ['Langue', a.lang === 'en' ? 'English' : 'Français'], ['Note privée', a.owner_note]];
    var acts = '';
    if (a.status === 'pending') acts = '<button class="gold sm" data-act="confirm" data-id="' + a.id + '">Confirmer</button><button class="ghost sm danger" data-act="decline" data-id="' + a.id + '">Refuser</button>';
    if (a.status === 'confirmed') acts = '<button class="ghost sm" data-act="reschedule" data-id="' + a.id + '">Déplacer</button><button class="ghost sm danger" data-act="cancel" data-id="' + a.id + '">Annuler</button>';
    acts += '<button class="ghost sm" data-act="note" data-id="' + a.id + '">Note</button>';
    return '<article class="cardx ' + a.status + '"><div class="row-between" style="margin:0"><h3>' + esc(a.service_name || svcName(a.service)) + '</h3><span class="badge ' + a.status + '">' + STATUS[a.status] + '</span></div>' +
      '<div class="meta">' + when + '</div><dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="acts">' + acts + msgButtons(a) + '</div></article>';
  }
  function renderReq() {
    var list = DATA.appointments.filter(function (a) { return a.status === 'pending'; });
    d.getElementById('c-req').textContent = list.length;
    d.getElementById('req-list').innerHTML = list.length ? list.map(function (a) { return apptCard(a); }).join('') : '<p class="empty">Aucune demande en attente.</p>';
  }

  // ---------------------------------------------------------------- calendar
  function range() {
    if (view === 'day') return [cursor, cursor];
    if (view === 'week') { var s = addDays(cursor, -((dow(cursor) + 6) % 7)); return [s, addDays(s, 6)]; }
    var m = cursor.slice(0, 7); return [m + '-01', m + '-' + p2(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate())];
  }
  function evsOn(ds) {
    var a = DATA.appointments.filter(function (x) { return x.date === ds && (x.status === 'confirmed' || x.status === 'pending'); })
      .sort(function (x, y) { return (x.time || '99').localeCompare(y.time || '99'); });
    var b = DATA.blocks.filter(function (x) { return ds >= x.date && ds <= (x.end_date || x.date); });
    return { a: a, b: b };
  }
  function evHtml(a) { return '<button class="ev ' + a.status + '" data-open="' + a.id + '"><b>' + (a.time ? fmtT(a.time) : 'souhait') + (a.duration ? ' · ' + dur(a.duration) : '') + '</b>' + esc(a.name) + ' — ' + esc(a.service_name) + '</button>'; }
  function blHtml(b) { return '<span class="ev block"><b>' + (b.all_day ? 'Journée' : fmtT(b.start) + ' – ' + fmtT(b.end)) + '</b>' + esc(b.label || 'Bloqué') + '</span>'; }
  function renderCal() {
    var r = range(), el = d.getElementById('cal-view'), lab = d.getElementById('cal-label'), td = today();
    d.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view)); });
    if (view === 'month') {
      lab.textContent = MONTHS[+cursor.slice(5, 7) - 1] + ' ' + cursor.slice(0, 4);
      var html = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(function (x) { return '<span class="dow">' + x + '</span>'; }).join('');
      for (var i = 0; i < (dow(r[0]) + 6) % 7; i++) html += '<span></span>';
      for (var ds = r[0]; ds <= r[1]; ds = addDays(ds, 1)) {
        var e = evsOn(ds);
        html += '<button data-day="' + ds + '" class="' + (ds === td ? 'today' : '') + '">' + (+ds.slice(8)) + '<span class="dots">' + e.a.map(function (a) { return '<i class="' + (a.status === 'pending' ? 'p' : '') + '"></i>'; }).join('') + (e.b.length ? '<i class="b"></i>' : '') + '</span></button>';
      }
      el.innerHTML = '<div class="month">' + html + '</div>';
      return;
    }
    if (view === 'week') {
      lab.textContent = fmtDate(r[0]) + ' – ' + fmtDate(r[1]);
      var w = '';
      for (var ds2 = r[0]; ds2 <= r[1]; ds2 = addDays(ds2, 1)) {
        var e2 = evsOn(ds2);
        w += '<div class="day' + (ds2 === td ? ' today' : '') + '"><h4>' + DAYS[dow(ds2)].slice(0, 3) + ' ' + (+ds2.slice(8)) + '</h4>' + e2.b.map(blHtml).join('') + e2.a.map(evHtml).join('') + '</div>';
      }
      el.innerHTML = '<div class="week">' + w + '</div>';
      return;
    }
    lab.textContent = fmtDate(cursor, true);
    var e3 = evsOn(cursor);
    el.innerHTML = '<div class="dayview">' + (e3.b.map(function (b) { return '<div class="slot"><span class="t">' + (b.all_day ? '—' : fmtT(b.start)) + '</span>' + blHtml(b) + '</div>'; }).join('') +
      e3.a.map(function (a) { return '<div class="slot"><span class="t">' + (a.time ? fmtT(a.time) : '?') + '</span><div>' + apptCard(a) + '</div></div>'; }).join('') || '<p class="empty">Aucun rendez-vous ce jour-là.</p>') + '</div>';
  }
  d.querySelectorAll('.seg button').forEach(function (b) { b.addEventListener('click', function () { view = b.getAttribute('data-view'); renderCal(); }); });
  d.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = +b.getAttribute('data-step');
      if (view === 'day') cursor = addDays(cursor, s);
      else if (view === 'week') cursor = addDays(cursor, 7 * s);
      else { var y = +cursor.slice(0, 4), m = +cursor.slice(5, 7) - 1 + s; var nd = new Date(Date.UTC(y, m, 1)); cursor = nd.toISOString().slice(0, 10); }
      renderCal();
    });
  });
  d.querySelector('[data-today]').addEventListener('click', function () { cursor = today(); renderCal(); });
  d.getElementById('cal-view').addEventListener('click', function (ev) {
    var day = ev.target.closest('[data-day]'); if (day) { cursor = day.getAttribute('data-day'); view = 'day'; renderCal(); return; }
    var o = ev.target.closest('[data-open]'); if (o) { var a = find(o.getAttribute('data-open')); dialog('<h2>' + esc(a.name) + '</h2>' + apptCard(a), null); }
  });

  // ---------------------------------------------------------------- blocks
  function renderBlocks() {
    var td = today(), list = DATA.blocks.filter(function (b) { return (b.end_date || b.date) >= td; }).sort(function (x, y) { return x.date.localeCompare(y.date); });
    d.getElementById('blocks').innerHTML = list.length ? list.map(function (b) {
      return '<div class="cardx"><div class="row-between" style="margin:0"><span><b>' + fmtDate(b.date, true) + (b.end_date && b.end_date !== b.date ? ' → ' + fmtDate(b.end_date, true) : '') + '</b> · ' + (b.all_day ? 'journée entière' : fmtT(b.start) + ' – ' + fmtT(b.end)) + (b.label ? ' · ' + esc(b.label) : '') + '</span><button class="ghost sm danger" data-unblock="' + b.id + '">Retirer</button></div></div>';
    }).join('') : '<p class="empty">Aucun temps bloqué à venir.</p>';
  }
  d.getElementById('blocks').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-unblock]'); if (!b) return;
    api('POST', 'unblock', { id: b.getAttribute('data-unblock') }).then(function (j) { if (j.ok) { toast('Temps débloqué.'); load(); } });
  });
  d.querySelector('[data-block]').addEventListener('click', function () {
    dialog('<h2>Bloquer du temps</h2><label>Du<input type="date" name="date" required value="' + cursor + '"></label><label>Au (facultatif)<input type="date" name="end_date"></label>' +
      '<label class="check"><input type="checkbox" name="all_day" checked> Journée entière</label><div class="grid2" style="margin:0"><label>De<input type="time" name="start" value="09:00"></label><label>À<input type="time" name="end" value="17:00"></label></div><label>Motif (privé)<input name="label" placeholder="Congé, formation…"></label>',
      function (f) {
        return api('POST', 'block', { date: f.date.value, end_date: f.end_date.value || f.date.value, all_day: f.all_day.checked, start: f.start.value, end: f.end.value, label: f.label.value })
          .then(function (j) { if (j.ok) { toast('Temps bloqué : il n’est plus proposé aux clientes.'); load(); return true; } toast('Vérifiez les dates et heures.'); return false; });
      });
  });

  // ---------------------------------------------------------------- hours / settings
  function renderHours() {
    var s = DATA.settings; if (!s) return;
    var order = [1, 2, 3, 4, 5, 6, 0];
    d.getElementById('week-hours').innerHTML = order.map(function (i) {
      var rs = s.weekly[String(i)] || [];
      return '<div class="hours-row" data-dow="' + i + '"><b>' + DAYS[i] + '</b><div class="ranges">' + (rs.length ? rs.map(function (r) { return rangeHtml(r[0], r[1]); }).join('') : '<span class="small">Fermé</span>') + '<button class="ghost sm" data-add-range>+ plage</button></div></div>';
    }).join('');
    d.getElementById('s-step').value = s.step; d.getElementById('s-buffer').value = s.buffer; d.getElementById('s-lead').value = s.lead_hours; d.getElementById('s-horizon').value = s.horizon_days; d.getElementById('s-instant').checked = !!s.instant;
  }
  function rangeHtml(a, b) { return '<span class="range"><input type="time" value="' + a + '" aria-label="Début"> – <input type="time" value="' + b + '" aria-label="Fin"><button type="button" data-del-range aria-label="Supprimer">×</button></span>'; }
  d.getElementById('week-hours').addEventListener('click', function (ev) {
    if (ev.target.closest('[data-add-range]')) { var box = ev.target.closest('.ranges'); var c = box.querySelector('.small'); if (c) c.remove(); ev.target.insertAdjacentHTML('beforebegin', rangeHtml('09:00', '17:00')); }
    if (ev.target.closest('[data-del-range]')) { var r = ev.target.closest('.range'), bx = r.parentNode; r.remove(); if (!bx.querySelector('.range')) bx.insertAdjacentHTML('afterbegin', '<span class="small">Fermé</span>'); }
  });
  d.getElementById('save-hours').addEventListener('click', function () {
    var weekly = {};
    d.querySelectorAll('.hours-row').forEach(function (row) {
      weekly[row.getAttribute('data-dow')] = [].slice.call(row.querySelectorAll('.range')).map(function (r) { var i = r.querySelectorAll('input'); return [i[0].value, i[1].value]; }).filter(function (x) { return x[0] && x[1] && x[1] > x[0]; });
    });
    var settings = { weekly: weekly, step: +d.getElementById('s-step').value, buffer: +d.getElementById('s-buffer').value, lead_hours: +d.getElementById('s-lead').value, horizon_days: +d.getElementById('s-horizon').value, instant: d.getElementById('s-instant').checked };
    api('POST', 'settings', { settings: settings }).then(function (j) {
      d.getElementById('hours-msg').textContent = j.ok ? 'Enregistré. Le site propose maintenant ces créneaux.' : 'Erreur, réessayez.';
      if (j.ok) { DATA.settings = j.settings; renderHours(); }
    });
  });

  // ---------------------------------------------------------------- clients
  function renderClients() {
    var map = {};
    DATA.appointments.forEach(function (a) { var k = (a.phone || '').replace(/\D/g, '') || (a.email || '').toLowerCase() || a.name; (map[k] = map[k] || []).push(a); });
    var qv = (d.getElementById('client-q').value || '').toLowerCase();
    var list = Object.keys(map).map(function (k) { var arr = map[k].sort(function (x, y) { return (y.date || y.created).localeCompare(x.date || x.created); }); return { a: arr[0], all: arr }; })
      .filter(function (c) { return !qv || (c.a.name + ' ' + c.a.phone + ' ' + c.a.email).toLowerCase().indexOf(qv) >= 0; })
      .sort(function (x, y) { return x.a.name.localeCompare(y.a.name); });
    d.getElementById('client-list').innerHTML = list.length ? list.map(function (c) {
      return '<article class="cardx"><h3>' + esc(c.a.name) + '</h3><div class="meta">' + esc([c.a.phone, c.a.email].filter(Boolean).join(' · ')) + ' · ' + c.all.length + ' visite(s)/demande(s)</div><ul class="small" style="margin:8px 0;padding-left:18px">' +
        c.all.map(function (a) { return '<li>' + fmtDate(a.date) + (a.time ? ' ' + fmtT(a.time) : '') + ' — ' + esc(a.service_name) + ' (' + STATUS[a.status].toLowerCase() + ')</li>'; }).join('') + '</ul><div class="acts">' + msgButtons(c.a, 'info') + '</div></article>';
    }).join('') : '<p class="empty">Aucune cliente pour le moment.</p>';
  }
  d.getElementById('client-q').addEventListener('input', renderClients);

  // ---------------------------------------------------------------- actions
  function find(id) { return DATA.appointments.filter(function (a) { return a.id === id; })[0]; }
  d.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var a = find(b.getAttribute('data-id')), act = b.getAttribute('data-act'); if (!a) return;
    if (d.getElementById('dlg').open) d.getElementById('dlg').close();
    if (act === 'confirm' || act === 'reschedule') {
      var dv = a.duration || svcDur(a.service, a.variation) || '';
      dialog('<h2>' + (act === 'confirm' ? 'Confirmer' : 'Déplacer') + ' — ' + esc(a.name) + '</h2><p class="small">' + esc(a.service_name) + (a.time_pref ? ' · souhait : ' + esc(a.time_pref) : '') + '</p>' +
        '<label>Date<input type="date" name="date" required value="' + (a.date || '') + '"></label><label>Heure<input type="time" name="time" required value="' + (a.time || '') + '"></label>' +
        '<label>Durée réelle (minutes)<input type="number" name="duration" min="15" max="720" step="15" required value="' + dv + '" placeholder="ex. 240"></label>' +
        '<p class="small">Le créneau est vérifié : impossible de réserver deux clientes en même temps.</p>',
        function (f) {
          return api('POST', act, { id: a.id, date: f.date.value, time: f.time.value, duration: +f.duration.value }).then(function (j) {
            if (j.ok) { toast(act === 'confirm' ? 'Rendez-vous confirmé' + (j.emailed ? ' — courriel envoyé.' : '. Prévenez la cliente avec Texto / WhatsApp.') : 'Rendez-vous déplacé.'); load().then(function () { if (!j.emailed) dialog('<h2>Prévenir ' + esc(a.name) + '</h2><div class="acts">' + msgButtons(j.appointment, 'confirm') + '</div>', null); }); return true; }
            toast(j.error === 'conflict' ? 'Ce créneau chevauche un autre rendez-vous ou un temps bloqué.' : j.error === 'need_duration' ? 'Indiquez la durée.' : 'Date ou heure invalide.'); return false;
          });
        });
    }
    if (act === 'decline' || act === 'cancel') {
      dialog('<h2>' + (act === 'decline' ? 'Refuser la demande' : 'Annuler le rendez-vous') + '</h2><p>' + esc(a.name) + ' — ' + esc(a.service_name) + '</p><label>Motif (privé, facultatif)<input name="reason"></label>', function (f) {
        return api('POST', act, { id: a.id, reason: f.reason.value }).then(function (j) {
          if (j.ok) { toast(act === 'decline' ? 'Demande refusée.' : 'Rendez-vous annulé, le créneau est libéré.'); load().then(function () { if (!j.emailed) dialog('<h2>Prévenir ' + esc(a.name) + '</h2><div class="acts">' + msgButtons(j.appointment, 'decline') + '</div>', null); }); return true; }
          toast('Erreur, réessayez.'); return false;
        });
      });
    }
    if (act === 'note') {
      dialog('<h2>Note privée</h2><label>Visible seulement par vous<textarea name="note" rows="4">' + esc(a.owner_note || '') + '</textarea></label>', function (f) {
        return api('POST', 'note', { id: a.id, note: f.note.value }).then(function (j) { if (j.ok) { toast('Note enregistrée.'); load(); } return !!j.ok; });
      });
    }
  });
  d.querySelector('[data-new]').addEventListener('click', function () {
    var opts = (DATA.services || []).map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
    dialog('<h2>Nouveau rendez-vous</h2><label>Prestation<select name="service">' + opts + '</select></label><label>Nom<input name="name" required></label><label>Téléphone<input name="phone" type="tel"></label><label>Courriel<input name="email" type="email"></label>' +
      '<div class="grid2" style="margin:0"><label>Date<input type="date" name="date" required value="' + cursor + '"></label><label>Heure<input type="time" name="time" required></label></div><label>Durée (minutes)<input type="number" name="duration" min="15" step="15" required></label>' +
      '<label>Langue<select name="lang"><option value="fr">Français</option><option value="en">English</option></select></label>',
      function (f) {
        return api('POST', 'create', { service: f.service.value, name: f.name.value, phone: f.phone.value, email: f.email.value, date: f.date.value, time: f.time.value, duration: +f.duration.value, lang: f.lang.value })
          .then(function (j) { if (j.ok) { toast('Rendez-vous ajouté.'); load(); return true; } toast(j.error === 'conflict' ? 'Ce créneau est déjà pris.' : 'Vérifiez le nom, un téléphone ou courriel, la date, l’heure et la durée.'); return false; });
      });
  });

  // ---------------------------------------------------------------- dialog
  function dialog(html, onOk) {
    var dl = d.getElementById('dlg'), f = d.getElementById('dlg-form');
    d.getElementById('dlg-body').innerHTML = html;
    d.getElementById('dlg-ok').hidden = !onOk;
    f.onsubmit = function (ev) {
      if (!onOk) return;
      if (ev.submitter && ev.submitter.value === 'cancel') return;
      ev.preventDefault();
      if (!f.reportValidity()) return;
      Promise.resolve(onOk(f)).then(function (ok) { if (ok) dl.close(); });
    };
    dl.showModal();
  }

  // tabs
  d.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      d.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      d.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== b.getAttribute('data-tab'); });
    });
  });
})();
