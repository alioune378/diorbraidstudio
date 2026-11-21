/* Dior Braid Studio — site behaviour */
(function () {
  'use strict';
  var d = document, body = d.body;

  // remember language choice (Netlify reads nf_lang for the / redirect)
  function setLang(l) { try { d.cookie = 'nf_lang=' + l + ';path=/;max-age=31536000;SameSite=Lax'; } catch (e) {} }
  setLang(body.getAttribute('data-lang'));
  d.querySelectorAll('[data-lang]').forEach(function (a) {
    if (a.tagName === 'A') a.addEventListener('click', function () { setLang(a.getAttribute('data-lang')); });
  });

  // header: solid on scroll, hide on scroll down
  var hdr = d.getElementById('hdr'), lastY = 0;
  function onScroll() {
    var y = window.scrollY || 0;
    if (hdr) {
      hdr.classList.toggle('solid', y > 10);
      hdr.classList.toggle('hide', y > 400 && y > lastY + 4 && !drawerOpen);
      if (y < lastY - 4) hdr.classList.remove('hide');
    }
    lastY = y;
  }

  // drawer
  var drawerOpen = false, drawer = d.getElementById('drawer'), burger = d.querySelector('.burger');
  function toggleDrawer(open) {
    if (!drawer) return;
    drawerOpen = open;
    if (open) { drawer.hidden = false; requestAnimationFrame(function () { drawer.classList.add('open'); }); }
    else { drawer.classList.remove('open'); setTimeout(function () { if (!drawerOpen) drawer.hidden = true; }, 360); }
    burger && burger.setAttribute('aria-expanded', String(open));
    body.style.overflow = open ? 'hidden' : '';
    if (open) { var x = drawer.querySelector('.x'); x && x.focus(); } else { burger && burger.focus(); }
  }
  burger && burger.addEventListener('click', function () { toggleDrawer(true); });
  drawer && drawer.querySelector('.x').addEventListener('click', function () { toggleDrawer(false); });
  d.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && drawerOpen) toggleDrawer(false); });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // reveal on scroll
  var rv = d.querySelectorAll('.rv, .arch.draw');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // gallery filters
  var gal = d.getElementById('gallery');
  if (gal) {
    var btns = d.querySelectorAll('.filters button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        gal.querySelectorAll('.g-item').forEach(function (it) {
          it.hidden = !(f === 'all' || it.getAttribute('data-c') === f);
        });
      });
    });
  }

  // ------------------------------------------------------------ booking
  var form = d.getElementById('bk');
  if (!form) return;
  var cfg = JSON.parse(d.getElementById('bk-cfg').textContent), T = cfg.t, L = cfg.lang;
  var steps = [].slice.call(form.querySelectorAll('.bk-step'));
  var sumEl = d.getElementById('sum'), moneyEl = d.getElementById('money');
  var MAX = 8 * 1024 * 1024;

  function $(n) { return form.elements[n]; }
  function val(n) {
    var el = form.elements[n]; if (!el) return '';
    if (!el.tagName || el.type === 'radio') { var r = form.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; }
    return (el.value || '').trim();
  }
  function checked(n) { return [].slice.call(form.querySelectorAll('input[name="' + n + '"]:checked')).map(function (x) { return x.value; }); }
  function esc(s) { var x = d.createElement('div'); x.textContent = s == null ? '' : String(s); return x.innerHTML; }
  function money(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v), s = n % 1 ? n.toFixed(2) : String(Math.round(n));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, L === 'fr' ? ' ' : ',');
    return L === 'fr' ? s.replace('.', ',') + ' $' : '$' + s;
  }
  function dur(m) {
    if (!m) return null; var h = Math.floor(m / 60), mi = m % 60;
    return L === 'fr' ? ((h ? h + ' h' : '') + (mi ? (h ? ' ' + (mi < 10 ? '0' : '') + mi : mi + ' min') : '')) : ((h ? h + 'h' : '') + (mi ? ' ' + mi + 'min' : ''));
  }
  function svc() {
    var r = form.querySelector('input[name="service"]:checked');
    return r ? cfg.services.filter(function (s) { return s.id === r.getAttribute('data-id'); })[0] : null;
  }
  function variation(s) {
    var v = val('variation'); if (!s || !v) return null;
    return s.variations.filter(function (x) { return x.name === v; })[0] || null;
  }

  function renderServiceOptions() {
    var s = svc(), vw = d.getElementById('var-wrap'), vc = d.getElementById('var-choices');
    var ac = d.getElementById('addon-choices'), an = d.getElementById('addon-none');
    vc.innerHTML = ''; ac.innerHTML = '';
    if (s && s.variations.length) {
      vw.hidden = false;
      s.variations.forEach(function (v) {
        var p = money(v.price) || T.price_pending, du = dur(v.dur);
        vc.insertAdjacentHTML('beforeend', '<label class="choice"><input type="radio" name="variation" value="' + esc(v.name) + '"><span><b>' + esc(v.name) + '</b><small>' + esc(p + (du ? ' · ' + du : '')) + '</small></span></label>');
      });
    } else vw.hidden = true;
    if (s && s.addons.length) {
      an.hidden = true;
      s.addons.forEach(function (a) {
        ac.insertAdjacentHTML('beforeend', '<label class="choice"><input type="checkbox" name="addons" value="' + esc(a.name) + '"><span>' + esc(a.name + (money(a.price) ? ' · +' + money(a.price) : '')) + '</span></label>');
      });
    } else an.hidden = false;
    d.getElementById('len-wrap').hidden = !!(s && !s.lengths);
    d.getElementById('size-wrap').hidden = !!(s && !s.sizes);
    if (s && !s.lengths) form.querySelectorAll('input[name="length"]').forEach(function (x) { x.checked = false; });
    if (s && !s.sizes) form.querySelectorAll('input[name="size"]').forEach(function (x) { x.checked = false; });
  }

  function rows() {
    var s = svc(), v = variation(s), file = $('inspiration').files[0];
    var date = val('date'), time = val('time');
    var dateTxt = '';
    if (date) {
      try { dateTxt = new Date(date + 'T12:00:00').toLocaleDateString(L === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { dateTxt = date; }
    }
    if (time) dateTxt = (dateTxt ? dateTxt + ' — ' : '') + time;
    return [
      [T.summary_service, s ? s.name : ''],
      [T.summary_variation, s && s.variations.length ? (v ? v.name : '') : ''],
      [T.summary_style, val('style')],
      [T.summary_length, val('length')],
      [T.summary_size, val('size')],
      [T.summary_addons, checked('addons').join(', ')],
      [T.summary_date, dateTxt],
      [T.summary_photo, file ? T.photo_yes + ' (' + file.name + ')' : '']
    ];
  }

  function estimate() {
    var s = svc(); if (!s) return null;
    var v = variation(s), base = v && v.price != null ? v.price : s.price, du = v && v.dur ? v.dur : s.dur;
    var addSum = 0, addUnknown = false;
    checked('addons').forEach(function (n) {
      var a = s.addons.filter(function (x) { return x.name === n; })[0];
      if (a && a.price != null && a.price !== '') addSum += Number(a.price); else addUnknown = true;
    });
    return { price: base != null && base !== '' ? Number(base) + addSum : null, dur: du, partial: addUnknown };
  }

  function render() {
    sumEl.innerHTML = rows().map(function (r) {
      return r[1] ? '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>' : '';
    }).join('') || '<div><dt>' + esc(T.summary_service) + '</dt><dd>' + esc(T.summary_empty) + '</dd></div>';
    var est = estimate();
    moneyEl.innerHTML = est ? (
      '<span><small>' + esc(L === 'fr' ? 'Tarif' : 'Price') + '</small>' + esc(est.price != null ? T.from + ' ' + money(est.price) : T.price_pending) + '</span>' +
      '<span><small>' + esc(L === 'fr' ? 'Durée' : 'Duration') + '</small>' + esc(dur(est.dur) || T.duration_pending) + '</span>') : '';
    // step header values
    var s = svc(), v = variation(s);
    setV(1, s ? s.name + (v ? ' — ' + v.name : '') : '');
    setV(2, val('style') || ($('inspiration').files[0] ? T.photo_yes : ''));
    setV(3, [val('length'), val('size')].concat(checked('addons')).filter(Boolean).join(' · '));
    setV(4, val('date') + (val('time') ? ' · ' + val('time') : ''));
    setV(5, val('name'));
  }
  function setV(n, t) { var el = form.querySelector('[data-v="' + n + '"]'); if (el) el.textContent = t || ''; }

  function err(id, msg) {
    var el = d.getElementById('e-' + id); if (el) el.textContent = msg || '';
  }
  function validStep(n, focus) {
    var ok = true;
    if (n === 1) {
      if (!svc()) { err('service', T.err_service); ok = false; } else err('service', '');
    }
    if (n === 2) {
      var f = $('inspiration').files[0];
      if (f && f.size > MAX) { err('photo', T.err_photo); ok = false; $('inspiration').setAttribute('aria-invalid', 'true'); }
      else { err('photo', ''); $('inspiration').removeAttribute('aria-invalid'); }
    }
    if (n === 5) {
      var name = val('name'), ph = val('phone'), em = val('email');
      var phOk = ph.replace(/\D/g, '').length >= 10, emOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
      if (name.length < 2) { err('name', T.err_name); $('name').setAttribute('aria-invalid', 'true'); ok = false; } else { err('name', ''); $('name').removeAttribute('aria-invalid'); }
      if ((ph && !phOk) || (em && !emOk) || (!ph && !em)) { err('contact', T.err_contact); ok = false; } else err('contact', '');
      if (!$('consent').checked) { err('consent', T.err_consent); ok = false; } else err('consent', '');
    }
    if (!ok && focus) { var e1 = steps[n - 1].querySelector('.err:not(:empty)'); e1 && e1.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return ok;
  }

  function open(n, scroll) {
    steps.forEach(function (st, i) {
      var on = i === n - 1;
      st.classList.toggle('open', on);
      st.querySelector('.head').setAttribute('aria-expanded', String(on));
    });
    if (scroll) {
      var st = steps[n - 1];
      setTimeout(function () {
        var top = st.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: top, behavior: 'smooth' });
        var f = st.querySelector('.body input:not([type=hidden]), .body textarea'); f && f.focus({ preventScroll: true });
      }, 30);
    }
  }
  function current() { for (var i = 0; i < steps.length; i++) if (steps[i].classList.contains('open')) return i + 1; return 1; }

  steps.forEach(function (st, i) {
    var n = i + 1;
    st.querySelector('.head').addEventListener('click', function () {
      // allow going back freely; going forward requires earlier steps valid
      for (var k = 1; k < n; k++) if (!validStep(k, false)) { open(k, true); validStep(k, true); return; }
      open(n, false);
    });
    var nx = st.querySelector('[data-next]'), bk = st.querySelector('[data-back]');
    nx && nx.addEventListener('click', function () {
      if (!validStep(n, true)) return;
      st.classList.add('done'); open(n + 1, true);
    });
    bk && bk.addEventListener('click', function () { open(n - 1, true); });
  });

  form.addEventListener('change', function (ev) {
    if (ev.target.name === 'service') renderServiceOptions();
    if (ev.target.name === 'inspiration') validStep(2, false);
    render();
  });
  function recheck() {
    steps.forEach(function (st, i) { if (st.querySelector('.err:not(:empty)')) validStep(i + 1, false); });
  }
  form.addEventListener('input', function () { render(); recheck(); });
  form.addEventListener('change', recheck);

  // pre-select from ?service=
  var q = new URLSearchParams(location.search).get('service');
  if (q) { var r = form.querySelector('input[name="service"][data-id="' + q.replace(/[^a-z-]/g, '') + '"]'); if (r) { r.checked = true; renderServiceOptions(); } }
  render();

  function summaryText() {
    var lines = [T.status_request, ''];
    rows().forEach(function (r) { if (r[1]) lines.push(r[0] + ': ' + r[1]); });
    var est = estimate();
    if (est) lines.push((L === 'fr' ? 'Tarif' : 'Price') + ': ' + (est.price != null ? T.from + ' ' + money(est.price) : T.price_pending));
    lines.push('', T.name_label + ': ' + val('name'), T.phone_label + ': ' + val('phone'), T.email_label + ': ' + val('email'));
    if (val('contact_pref')) lines.push(val('contact_pref'));
    if (val('notes')) lines.push('', T.notes_label + ': ' + val('notes'));
    return lines.join('\n');
  }

  var sending = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return;
    for (var k = 1; k <= steps.length; k++) if (!validStep(k, false)) { open(k, true); validStep(k, true); return; }
    form.elements.summary.value = summaryText();
    var btn = d.getElementById('send'), label = btn.innerHTML;
    sending = true; btn.disabled = true; btn.textContent = T.sending;
    var fd = new FormData(form);
    if (!$('inspiration').files[0]) fd.delete('inspiration');
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { ctl && ctl.abort(); }, 45000);
    fetch(location.pathname, { method: 'POST', body: fd, signal: ctl ? ctl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); show('done'); })
      .catch(function () { show('fail'); })
      .then(function () { clearTimeout(timer); sending = false; btn.disabled = false; btn.innerHTML = label; });
  });

  function show(id) {
    var el = d.getElementById(id);
    if (id === 'done') { form.hidden = true; d.getElementById('fail').hidden = true; }
    if (id === 'fail') {
      var m = d.getElementById('mailto');
      m.href = 'mailto:' + cfg.email + '?subject=' + encodeURIComponent(cfg.subject + ' — ' + val('name')) + '&body=' + encodeURIComponent(summaryText());
    }
    el.hidden = false; el.focus();
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
})();
