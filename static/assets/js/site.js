/* Dior Braid Studio — site behaviour */
(function () {
  'use strict';
  var d = document, body = d.body, L = body.getAttribute('data-lang') || 'fr';

  // language: remember choice (Netlify reads nf_lang for "/")
  function setLang(l) { try { d.cookie = 'nf_lang=' + l + ';path=/;max-age=31536000;SameSite=Lax'; } catch (e) {} }
  setLang(L);
  d.querySelectorAll('a[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () {
      setLang(a.getAttribute('data-lang'));
      if (location.search && a.href.indexOf('?') < 0) a.href += location.search; // keep booking context
    });
  });

  // drawer
  var drawer = d.getElementById('drawer'), burger = d.querySelector('.burger'), open = false;
  function toggle(o) {
    if (!drawer) return; open = o;
    if (o) { drawer.hidden = false; requestAnimationFrame(function () { drawer.classList.add('open'); }); }
    else { drawer.classList.remove('open'); setTimeout(function () { if (!open) drawer.hidden = true; }, 360); }
    burger && burger.setAttribute('aria-expanded', String(o));
    body.style.overflow = o ? 'hidden' : '';
    var f = o ? drawer.querySelector('.x') : burger; f && f.focus();
  }
  burger && burger.addEventListener('click', function () { toggle(true); });
  drawer && drawer.querySelector('.x').addEventListener('click', function () { toggle(false); });

  // reveal
  var rv = d.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // ---------------------------------------------------------------- lightbox
  var lb = d.getElementById('lb'), G = [], gi = 0;
  var gd = d.getElementById('gal-data'); if (gd) { try { G = JSON.parse(gd.textContent); } catch (e) {} }
  function lbShow(i) {
    if (!lb || !G.length) return;
    gi = (i + G.length) % G.length;
    var it = G[gi], img = lb.querySelector('img'), cap = lb.querySelector('figcaption');
    img.classList.add('swap');
    setTimeout(function () {
      img.onload = function () { img.classList.remove('swap'); };
      img.src = it.src; img.alt = it.alt || '';
      if (img.complete) img.classList.remove('swap');
      cap.textContent = it.cap || '';
      if (it.cat || it.insp) { var s = d.createElement('small'); s.textContent = [it.cat, it.insp ? (L === 'fr' ? 'Image d’inspiration' : 'Inspiration image') : ''].filter(Boolean).join(' · '); cap.appendChild(s); }
      lb.querySelector('.count').textContent = (gi + 1) + ' / ' + G.length;
    }, 120);
  }
  var lastFocus = null;
  function lbOpen(i) { lastFocus = d.activeElement; lb.hidden = false; requestAnimationFrame(function () { lb.classList.add('open'); }); body.style.overflow = 'hidden'; lbShow(i); lb.querySelector('.lb-x').focus(); }
  function lbClose() { lb.classList.remove('open'); setTimeout(function () { lb.hidden = true; }, 360); body.style.overflow = ''; lastFocus && lastFocus.focus(); }
  if (lb) {
    d.querySelectorAll('[data-lb]').forEach(function (b) { b.addEventListener('click', function () { lbOpen(+b.getAttribute('data-lb')); }); });
    lb.querySelector('.lb-x').addEventListener('click', lbClose);
    lb.querySelector('.lb-p').addEventListener('click', function () { lbShow(gi - 1); });
    lb.querySelector('.lb-n').addEventListener('click', function () { lbShow(gi + 1); });
    lb.addEventListener('click', function (ev) { if (ev.target === lb) lbClose(); });
    var sx = null;
    lb.addEventListener('touchstart', function (ev) { sx = ev.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (ev) { if (sx === null) return; var dx = ev.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) lbShow(gi + (dx < 0 ? 1 : -1)); sx = null; });
  }
  d.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { if (lb && !lb.hidden) lbClose(); else if (open) toggle(false); }
    if (lb && !lb.hidden) { if (ev.key === 'ArrowRight') lbShow(gi + 1); if (ev.key === 'ArrowLeft') lbShow(gi - 1); }
  });

  // gallery filters + mobile counter
  var gal = d.getElementById('gallery');
  if (gal) {
    var items = [].slice.call(gal.querySelectorAll('.g-item')), cnt = d.getElementById('g-count');
    var count = function () {
      var vis = items.filter(function (x) { return !x.hidden; });
      if (!cnt) return;
      var w = gal.getBoundingClientRect().left, idx = 0, best = 1e9;
      vis.forEach(function (x, i) { var dx = Math.abs(x.getBoundingClientRect().left - w - 16); if (dx < best) { best = dx; idx = i; } });
      cnt.textContent = vis.length ? (idx + 1) + ' / ' + vis.length : '';
    };
    d.querySelectorAll('.filters button').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        d.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        items.forEach(function (it) { it.hidden = !(f === 'all' || it.getAttribute('data-c') === f); });
        gal.scrollLeft = 0; count();
      });
    });
    gal.addEventListener('scroll', function () { window.requestAnimationFrame(count); }, { passive: true });
    count();
  }

  // ---------------------------------------------------------------- helpers
  function esc(s) { var x = d.createElement('div'); x.textContent = s == null ? '' : String(s); return x.innerHTML; }
  function money(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v), s = n % 1 ? n.toFixed(2) : String(Math.round(n));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, L === 'fr' ? ' ' : ',');
    return L === 'fr' ? s.replace('.', ',') + ' $' : '$' + s;
  }
  function dur(m) {
    if (!m) return null; m = +m; var h = Math.floor(m / 60), mi = m % 60;
    return L === 'fr' ? ((h ? h + ' h' : '') + (mi ? (h ? ' ' + (mi < 10 ? '0' : '') + mi : mi + ' min') : '')) : ((h ? h + 'h' : '') + (mi ? ' ' + mi + 'min' : ''));
  }

  // ---------------------------------------------------------------- estimator (services page)
  var est = d.getElementById('est'), sd = d.getElementById('svc-data');
  if (est && sd) {
    var SV = JSON.parse(sd.textContent);
    var selS = est.elements.service, selV = est.elements.variation, opts = est.querySelector('.opts');
    var PH = L === 'fr' ? 'Sélectionner un style' : 'Select a style', PP = L === 'fr' ? 'Sur devis' : 'Price upon consultation', DP = L === 'fr' ? 'Durée à confirmer' : 'Duration to be confirmed';
    var estUpd = function () {
      var s = SV.filter(function (x) { return x.id === selS.value; })[0]; if (!s) return;
      var v = s.variations.filter(function (x) { return x.name === selV.value; })[0];
      var p = v && v.price != null ? v.price : s.price, du = v && v.dur ? v.dur : s.dur;
      d.getElementById('est-price').textContent = p != null && p !== '' ? (L === 'fr' ? 'À partir de ' : 'From ') + money(p) : PP;
      d.getElementById('est-dur').textContent = dur(du) || DP;
    };
    var fillEst = function () {
      var s = SV.filter(function (x) { return x.id === selS.value; })[0]; if (!s) return;
      selV.innerHTML = '<option value="">' + esc(PH) + '</option>' + s.variations.map(function (v) { return '<option>' + esc(v.name) + '</option>'; }).join('');
      opts.innerHTML = s.addons.length ? s.addons.map(function (a) { return '<label><input type="checkbox" name="addons" value="' + esc(a.name) + '"> ' + esc(a.name) + '</label>'; }).join('') : '<span class="hint">—</span>';
      est.querySelector('select[name=length]').disabled = !s.lengths;
      estUpd();
    };
    selS.addEventListener('change', fillEst); selV.addEventListener('change', estUpd);
    fillEst();
  }

  // ---------------------------------------------------------------- booking
  var form = d.getElementById('bk');
  if (!form) return;
  var cfg = JSON.parse(d.getElementById('bk-cfg').textContent), T = cfg.t;
  var MAX = 8 * 1024 * 1024, mode = 'preference', av = null, calMonth = null, slotDate = '', slotTime = '';
  var q = new URLSearchParams(location.search);

  function $(n) { return form.elements[n]; }
  function val(n) {
    var r = form.querySelector('input[name="' + n + '"]:checked'); if (r) return r.value;
    var el = form.elements[n]; if (!el || !el.tagName || el.type === 'radio' || el.type === 'checkbox') return '';
    return (el.value || '').trim();
  }
  function checked(n) { return [].slice.call(form.querySelectorAll('input[name="' + n + '"]:checked')).map(function (x) { return x.value; }); }
  function svc() { var r = form.querySelector('input[name="service"]:checked'); return r ? cfg.services.filter(function (s) { return s.id === r.getAttribute('data-id'); })[0] : null; }
  function variation(s) { var v = val('variation'); return s && v ? s.variations.filter(function (x) { return x.name === v; })[0] || null : null; }

  function renderOptions(pre) {
    var s = svc(), vc = d.getElementById('var-choices'), ac = d.getElementById('addon-choices'), an = d.getElementById('addon-none');
    if (!s) return;
    vc.innerHTML = s.variations.length ? s.variations.map(function (v) {
      var extra = [money(v.price), dur(v.dur)].filter(Boolean).join(' · ');
      return '<label><input type="radio" name="variation" value="' + esc(v.name) + '"><span>' + esc(v.name) + (extra ? ' · ' + esc(extra) : '') + '</span></label>';
    }).join('') : '<span class="hint">' + esc(T.variation_none) + '</span>';
    ac.innerHTML = s.addons.map(function (a) { return '<label><input type="checkbox" name="addons" value="' + esc(a.name) + '"><span>' + esc(a.name + (money(a.price) ? ' · +' + money(a.price) : '')) + '</span></label>'; }).join('');
    an.hidden = !!s.addons.length;
    d.getElementById('len-wrap').hidden = !s.lengths; d.getElementById('size-wrap').hidden = !s.sizes;
    if (!s.lengths) form.querySelectorAll('input[name=length]').forEach(function (x) { x.checked = false; });
    if (!s.sizes) form.querySelectorAll('input[name=size]').forEach(function (x) { x.checked = false; });
    if (pre) {
      if (pre.variation) form.querySelectorAll('input[name=variation]').forEach(function (x) { if (x.value === pre.variation) x.checked = true; });
      (pre.addons || []).forEach(function (a) { form.querySelectorAll('input[name=addons]').forEach(function (x) { if (x.value === a) x.checked = true; }); });
    }
  }

  // ---- availability (genuine slots only when Dior has set her hours; otherwise a preference)
  function loadAvailability() {
    var s = svc(), sub = d.getElementById('date-sub');
    slotDate = ''; slotTime = ''; $('date').value = ''; $('time').value = '';
    if (!s) return;
    sub.textContent = T.loading;
    fetch('/api/availability?service=' + encodeURIComponent(s.id) + '&variation=' + encodeURIComponent(val('variation')) + '&days=92', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) { av = data; mode = data.mode === 'slots' ? 'slots' : 'preference'; showMode(); })
      .catch(function () { av = null; mode = 'preference'; showMode(); });
  }
  function showMode() {
    var sub = d.getElementById('date-sub');
    d.getElementById('slots').hidden = mode !== 'slots';
    d.getElementById('pref').hidden = mode === 'slots';
    if (mode === 'slots') {
      sub.textContent = av.duration_known ? (L === 'fr' ? 'Disponibilités en temps réel' : 'Live availability') : T.consult_only;
      var first = Object.keys(av.days)[0];
      calMonth = first ? first.slice(0, 7) : new Date().toISOString().slice(0, 7);
      drawCal(); drawTimes();
    } else sub.textContent = L === 'fr' ? 'Votre date et moment préférés' : 'Your preferred date and time of day';
    render();
  }
  function drawCal() {
    var grid = d.getElementById('cal-grid'), y = +calMonth.slice(0, 4), m = +calMonth.slice(5, 7) - 1;
    d.getElementById('cal-title').textContent = cfg.months[m] + ' ' + y;
    var first = new Date(Date.UTC(y, m, 1)), startDow = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var html = cfg.dows.map(function (x) { return '<span class="dow">' + esc(x) + '</span>'; }).join('');
    for (var i = 0; i < startDow; i++) html += '<span></span>';
    for (var dd = 1; dd <= days; dd++) {
      var ds = calMonth + '-' + (dd < 10 ? '0' : '') + dd, has = av.days[ds];
      html += '<button type="button" data-d="' + ds + '" class="' + (has ? 'av' : '') + (ds === slotDate ? ' sel' : '') + '"' + (has ? '' : ' disabled') + ' aria-label="' + ds + '">' + dd + '</button>';
    }
    grid.innerHTML = html;
    var keys = Object.keys(av.days);
    d.querySelector('.cal-nav[data-m="-1"]').disabled = !keys.some(function (k) { return k < calMonth + '-01'; });
    d.querySelector('.cal-nav[data-m="1"]').disabled = !keys.some(function (k) { return k > calMonth + '-31'; });
  }
  function drawTimes() {
    var box = d.getElementById('times'), list = av.days[slotDate] || [];
    d.getElementById('times-title').textContent = slotDate ? T.pick_time : T.pick_day;
    if (!Object.keys(av.days).some(function (k) { return k.slice(0, 7) === calMonth; })) { box.innerHTML = '<p class="cal-empty">' + esc(T.no_slots) + '</p>'; return; }
    box.innerHTML = list.map(function (tm) { return '<button type="button" data-t="' + tm + '" aria-pressed="' + (tm === slotTime) + '">' + (L === 'fr' ? tm.replace(':', ' h ') : tm) + '</button>'; }).join('');
  }
  d.querySelectorAll('.cal-nav').forEach(function (b) {
    b.addEventListener('click', function () {
      var y = +calMonth.slice(0, 4), m = +calMonth.slice(5, 7) - 1 + (+b.getAttribute('data-m'));
      calMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); drawCal(); drawTimes();
    });
  });
  d.getElementById('cal-grid').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-d]'); if (!b || b.disabled) return;
    slotDate = b.getAttribute('data-d'); slotTime = ''; drawCal(); drawTimes(); syncSlot();
  });
  d.getElementById('times').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-t]'); if (!b) return;
    slotTime = b.getAttribute('data-t'); drawTimes(); syncSlot(); err('slot', '');
  });
  function syncSlot() { $('date').value = slotDate; $('time').value = slotTime; render(); }

  // ---- summary
  function dateText() {
    var ds = mode === 'slots' ? slotDate : d.getElementById('f-date').value, tm = mode === 'slots' ? slotTime : val('time_pref'), out = '';
    if (ds) { try { out = new Date(ds + 'T12:00:00').toLocaleDateString(L === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { out = ds; } }
    if (tm) out = (out ? out + ' — ' : '') + (mode === 'slots' && L === 'fr' ? tm.replace(':', ' h ') : tm);
    return out;
  }
  function estimate() {
    var s = svc(); if (!s) return null;
    var v = variation(s), base = v && v.price != null ? v.price : s.price, du = v && v.dur ? v.dur : s.dur, add = 0;
    checked('addons').forEach(function (n) { var a = s.addons.filter(function (x) { return x.name === n; })[0]; if (a && a.price != null && a.price !== '') add += +a.price; });
    return { price: base != null && base !== '' ? +base + add : null, dur: du };
  }
  function setRow(k, v) { var r = d.querySelector('[data-row="' + k + '"] dd'); if (r) r.textContent = v || '—'; }
  function summaryText() {
    var lines = [T.status_request, ''], s = svc(), v = variation(s), e1 = estimate();
    [[T.summary_service, s && s.name], [T.summary_variation, v && v.name], [T.summary_style, val('style')], [T.summary_length, val('length')], [T.summary_size, val('size')],
     [T.summary_addons, checked('addons').join(', ')], [T.summary_date, dateText()]].forEach(function (r) { if (r[1]) lines.push(r[0] + ': ' + r[1]); });
    if (e1) lines.push((L === 'fr' ? 'Tarif' : 'Price') + ': ' + (e1.price != null ? T.from + ' ' + money(e1.price) : T.price_pending));
    lines.push('', T.name_label + ': ' + val('name'), T.phone_label + ': ' + val('phone'), T.email_label + ': ' + val('email'));
    if (val('notes')) lines.push('', T.notes_label + ': ' + val('notes'));
    return lines.join('\n');
  }
  var mb = d.getElementById('mbar');
  function nextStep() { if (!svc()) return 's1'; if (mode === 'slots' && (!slotDate || !slotTime)) return 's3'; if (!val('name') || (!val('phone') && !val('email')) || !$('consent').checked) return 's4'; return null; }
  function render() {
    var s = svc(), v = variation(s), e1 = estimate();
    setRow('service', s ? s.name : ''); setRow('style', v ? v.name : (val('style') ? val('style').slice(0, 40) : ''));
    setRow('length', [val('length'), val('size')].filter(Boolean).join(' · ')); setRow('options', checked('addons').join(', ')); setRow('date', dateText());
    d.getElementById('sum-price').textContent = e1 && e1.price != null ? T.from + ' ' + money(e1.price) : T.price_pending;
    d.getElementById('sum-dur').textContent = (e1 && dur(e1.dur)) || T.duration_pending;
    d.getElementById('by-mail').href = 'mailto:' + cfg.email + '?subject=' + encodeURIComponent(cfg.subject + (val('name') ? ' — ' + val('name') : '')) + '&body=' + encodeURIComponent(summaryText());
    if (mb) {
      d.getElementById('mbar-t').textContent = s ? s.name + ' · ' + (e1.price != null ? T.from + ' ' + money(e1.price) : T.price_pending) : T.mobile_choose;
      d.getElementById('mbar-b').textContent = nextStep() ? T.continue : T.send;
    }
  }

  // ---- validation
  function err(id, msg) { var el = d.getElementById('e-' + id); if (el) el.textContent = msg || ''; }
  function validate() {
    var bad = null;
    function fail(step, id, msg) { err(id, msg); if (!bad) bad = step; }
    if (!svc()) fail('s1', 'service', T.err_service); else err('service', '');
    var f = $('inspiration').files[0];
    if (f && f.size > MAX) fail('s2', 'photo', T.err_photo); else err('photo', '');
    if (mode === 'slots' && (!slotDate || !slotTime)) fail('s3', 'slot', T.err_slot); else if (mode === 'slots') err('slot', '');
    var name = val('name'), ph = val('phone'), em = val('email');
    var phOk = ph.replace(/\D/g, '').length >= 10, emOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
    if (name.length < 2) { fail('s4', 'name', T.err_name); $('name').setAttribute('aria-invalid', 'true'); } else { err('name', ''); $('name').removeAttribute('aria-invalid'); }
    if ((!ph && !em) || (ph && !phOk) || (em && !emOk)) fail('s4', 'contact', T.err_contact); else err('contact', '');
    if (!$('consent').checked) fail('s4', 'consent', T.err_consent); else err('consent', '');
    return bad;
  }
  var tried = false;

  if (mb) {
    var sumEl = d.querySelector('.summary');
    var vis = function () { var r = form.getBoundingClientRect(), sr = sumEl.getBoundingClientRect(); mb.classList.toggle('show', !form.hidden && r.top < window.innerHeight * .6 && sr.top > window.innerHeight * .85); };
    window.addEventListener('scroll', vis, { passive: true }); vis();
    d.getElementById('mbar-b').addEventListener('click', function () {
      var n = nextStep();
      if (!n) { if (form.requestSubmit) form.requestSubmit(); else d.getElementById('send').click(); return; }
      d.getElementById(n).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  form.addEventListener('change', function (ev) {
    if (ev.target.name === 'service') { renderOptions(); loadAvailability(); }
    else if (ev.target.name === 'variation' && mode === 'slots') loadAvailability();
    render(); if (tried) validate();
  });
  form.addEventListener('input', function () { render(); if (tried) validate(); });

  // prefill from estimator / "book this service" links
  var qs = q.get('service');
  if (qs) {
    var r0 = form.querySelector('input[name="service"][data-id="' + qs.replace(/[^a-z-]/g, '') + '"]');
    if (r0) {
      r0.checked = true;
      renderOptions({ variation: q.get('variation'), addons: q.getAll('addons') });
      if (q.get('length')) form.querySelectorAll('input[name=length]').forEach(function (x) { if (x.value === q.get('length')) x.checked = true; });
      loadAvailability();
    }
  } else loadAvailability.call(null);
  render();

  // ---- submit: booking API first (server-side availability + double-booking protection), then Netlify Form (notification + photo)
  var sending = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); tried = true;
    if (sending) return;
    var bad = validate();
    if (bad) { d.getElementById(bad).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (mode !== 'slots') { $('date').value = d.getElementById('f-date').value; $('time').value = ''; }
    form.elements.summary.value = summaryText();
    var btn = d.getElementById('send'), label = btn.innerHTML;
    sending = true; btn.disabled = true; btn.textContent = T.sending;
    var s = svc(), payload = {
      service: s.id, variation: val('variation'), style: val('style'), length: val('length'), size: val('size'), addons: checked('addons'),
      date: mode === 'slots' ? slotDate : d.getElementById('f-date').value, time: mode === 'slots' ? slotTime : '', time_pref: mode === 'slots' ? '' : val('time_pref'),
      name: val('name'), phone: val('phone'), email: val('email'), contact_pref: val('contact_pref'), notes: val('notes'),
      consent: $('consent').checked, lang: L, photo: !!$('inspiration').files[0], company: val('company')
    };
    function done() { sending = false; btn.disabled = false; btn.innerHTML = label; }
    fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .catch(function () { return { status: 0, j: {} }; })
      .then(function (res) {
        if (res.status === 409) { err('slot', T.slot_taken); done(); loadAvailability(); d.getElementById('s3').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (res.status === 422) { done(); validate(); return; }
        var stored = res.status === 200, confirmed = stored && res.j.status === 'confirmed';
        form.elements.booking_status.value = stored ? res.j.status : 'not-stored';
        form.elements.booking_id.value = res.j.id || '';
        var fd = new FormData(form);
        if (!$('inspiration').files[0]) fd.delete('inspiration');
        var ctl = 'AbortController' in window ? new AbortController() : null, timer = setTimeout(function () { ctl && ctl.abort(); }, 45000);
        return fetch(location.pathname, { method: 'POST', body: fd, signal: ctl ? ctl.signal : undefined })
          .then(function (r) { clearTimeout(timer); if (!r.ok && !stored) throw 0; show('done', confirmed); })
          .catch(function () { clearTimeout(timer); if (stored) show('done', confirmed); else show('fail'); })
          .then(done);
      });
  });
  function show(id, confirmed) {
    var el = d.getElementById(id);
    if (id === 'done') {
      form.hidden = true; d.getElementById('fail').hidden = true; mb && mb.classList.remove('show');
      if (confirmed) { d.getElementById('done-k').textContent = T.status_confirmed; d.getElementById('done-h').textContent = T.done_title_confirmed; d.getElementById('done-p').textContent = T.done_text_confirmed; d.getElementById('sum-status').textContent = T.status_confirmed; }
    }
    if (id === 'fail') d.getElementById('mailto').href = 'mailto:' + cfg.email + '?subject=' + encodeURIComponent(cfg.subject + ' — ' + val('name')) + '&body=' + encodeURIComponent(summaryText());
    el.hidden = false; el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
})();

/* carousel indicators — subtle dots under horizontally scrolling rows */
(function () {
  var d = document;
  d.querySelectorAll('[data-carousel]').forEach(function (row) {
    var kids = Array.prototype.filter.call(row.children, function (c) { return c.offsetParent !== null || true; });
    if (kids.length < 2) return;
    var dots = d.createElement('div'); dots.className = 'dots'; dots.setAttribute('role', 'tablist');
    kids.forEach(function (k, i) {
      var b = d.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', (i + 1) + ' / ' + kids.length);
      b.addEventListener('click', function () { row.scrollTo({ left: k.offsetLeft - row.offsetLeft - (parseFloat(getComputedStyle(row).paddingLeft) || 0), behavior: 'smooth' }); });
      dots.appendChild(b);
    });
    row.insertAdjacentElement('afterend', dots);
    function upd() {
      var scrollable = row.scrollWidth > row.clientWidth + 4;
      dots.hidden = !scrollable;
      if (!scrollable) return;
      var x = row.scrollLeft, best = 0, bd = 1e9;
      kids.forEach(function (k, i) { var dd = Math.abs(k.offsetLeft - row.offsetLeft - x - (parseFloat(getComputedStyle(row).paddingLeft) || 0)); if (dd < bd) { bd = dd; best = i; } });
      if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 4) best = kids.length - 1;
      Array.prototype.forEach.call(dots.children, function (b, i) { b.setAttribute('aria-current', i === best ? 'true' : 'false'); });
    }
    row.addEventListener('scroll', function () { window.requestAnimationFrame(upd); }, { passive: true });
    window.addEventListener('resize', upd); upd();
  });
})();
