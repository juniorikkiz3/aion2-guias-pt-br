/* Weekly tracker + first-week checklist.
   Everything lives in localStorage under one key, per character:
     { id, name, cls, week, done: {itemId: count}, w1: {goalId: true},
       energy: { v, t, cap }, charged }
   - week: index of the weekly period the `done` counters belong to. When the current
     period differs, the counters are cleared — no manual reset needed.
   - energy: v was the value at time t; every `interval` after t adds `regen`, up to cap. */
(function () {
  'use strict';
  var cfgEl = document.getElementById('tracker-config');
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var T = CFG.t;
  var KEY = 'aion2-tracker-v1';
  var WEEK = 7 * 864e5;
  var ANCHOR = Date.parse(CFG.reset.anchor);
  var EN = CFG.energy;
  var INTERVAL = EN.interval_min * 6e4;

  // ---- storage ---------------------------------------------------------------
  var state;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
    if (!state || !Array.isArray(state.chars)) state = { chars: [], active: null };
    if (!state.chars.length) state.chars.push(newChar(T.char_default, ''));
    if (!charById(state.active)) state.active = state.chars[0].id;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function newChar(name, cls) {
    return {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name, cls: cls || '', week: weekIndex(Date.now()), done: {}, w1: {},
      energy: { v: 0, t: Date.now(), cap: EN.cap }, charged: 0
    };
  }
  function charById(id) {
    for (var i = 0; i < state.chars.length; i++) if (state.chars[i].id === id) return state.chars[i];
    return null;
  }
  function active() { return charById(state.active); }

  // ---- time --------------------------------------------------------------------
  // Resets keep the local hour of the anchor in CFG.reset.tz (e.g. 10:00 Kyiv time), also after a daylight saving change.
  var TZ = CFG.reset.tz, tzFmt = null;
  try { if (TZ) tzFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (e) {}
  function tzOffset(t) {
    if (!tzFmt) return 0;
    var p = {};
    tzFmt.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  }
  var ANCHOR_OFF = tzOffset(ANCHOR);
  function resetAt(k) { var t = ANCHOR + k * WEEK; return t + ANCHOR_OFF - tzOffset(t); }
  function weekIndex(now) {
    var k = Math.floor((now - ANCHOR) / WEEK);
    if (now >= resetAt(k + 1)) k++;
    else if (now < resetAt(k)) k--;
    return k;
  }
  function nextReset(now) { return now < ANCHOR ? ANCHOR : resetAt(weekIndex(now) + 1); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function split(ms) {
    ms = Math.max(0, ms);
    return [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
  }
  function short(ms) {
    var p = split(ms), u = T.units;
    if (p[0]) return p[0] + u[0] + ' ' + p[1] + u[1];
    if (p[1]) return p[1] + u[1] + ' ' + pad(p[2]) + u[2];
    return p[2] + u[2] + ' ' + pad(p[3]) + u[3];
  }
  var dateFmt;
  try {
    dateFmt = new Intl.DateTimeFormat(({ 'pt-BR': 'pt-BR', ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR' })[CFG.lang] || 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch (e) { dateFmt = null; }
  function fmtDate(ms) { return dateFmt ? dateFmt.format(ms) : new Date(ms).toUTCString(); }

  // Clear weekly counters of every character whose data belongs to an older week.
  function rollWeeks(now) {
    var idx = weekIndex(now), changed = false;
    state.chars.forEach(function (c) {
      if (c.week !== idx) { c.week = idx; c.done = {}; changed = true; }
    });
    return changed;
  }

  // Bring stored energy up to `now`: whole intervals since t add regen, up to the cap.
  function settleEnergy(c, now) {
    var e = c.energy;
    if (e.v >= e.cap) { e.t = now; return; }
    var ticks = Math.floor((now - e.t) / INTERVAL);
    if (ticks <= 0) return;
    e.v = Math.min(e.cap, e.v + ticks * EN.regen);
    e.t = e.v >= e.cap ? now : e.t + ticks * INTERVAL;
  }
  function setEnergy(c, v, now) {
    var e = c.energy, wasFull = e.v >= e.cap;
    e.v = Math.max(0, Math.round(v));
    if (wasFull || e.v >= e.cap) e.t = now; // regeneration restarts once you drop below the cap
  }

  // ---- rendering ---------------------------------------------------------------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  function renderTabs() {
    var box = $('.char-tabs');
    if (!box) return;
    box.innerHTML = '';
    state.chars.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'char-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', c.id === state.active ? 'true' : 'false');
      if (c.cls) {
        var img = document.createElement('img');
        img.src = CFG.root + 'assets/classes/' + c.cls + '.webp';
        img.width = img.height = 22; img.alt = '';
        b.appendChild(img);
      }
      b.appendChild(document.createTextNode(c.name));
      b.addEventListener('click', function () { state.active = c.id; save(); renderAll(); });
      box.appendChild(b);
    });
    var c = active(), f = $('.char-form-edit');
    if (f && c) { f.cname.value = c.name; f.cls.value = c.cls; }
    var del = $('.char-del');
    if (del) del.hidden = state.chars.length < 2;
  }

  function renderWeekly() {
    var c = active();
    var done = 0, total = 0;
    $$('.wk-item').forEach(function (li) {
      var id = li.dataset.id, max = +li.dataset.max, n = Math.min(max, c.done[id] || 0);
      done += n; total += max;
      li.classList.toggle('is-done', n >= max);
      var b = $('.wk-count b', li);
      if (b) b.textContent = n;
      var chk = $('.wk-check', li);
      if (chk) chk.setAttribute('aria-pressed', n >= max ? 'true' : 'false');
    });
    var dn = $('.wk-done-n'), tn = $('.wk-total-n');
    if (dn) dn.textContent = done;
    if (tn) tn.textContent = total;
  }

  function renderWeek1() {
    var c = active();
    $$('.w1-group').forEach(function (g) {
      var n = 0;
      $$('input[data-goal]', g).forEach(function (inp) {
        inp.checked = !!c.w1[inp.dataset.goal];
        if (inp.checked) n++;
      });
      var el = $('.w1-n', g);
      if (el) el.textContent = n;
    });
  }

  function renderEnergy(now) {
    var card = $('.energy-card');
    if (!card) return;
    var c = active(), e = c.energy;
    settleEnergy(c, now);
    $('.energy-value', card).textContent = e.v;
    $('.energy-cap-v', card).textContent = e.cap;
    $('.energy-bar span', card).style.width = Math.min(100, e.v / e.cap * 100) + '%';
    var st = $('.energy-status', card);
    if (e.v >= e.cap) {
      st.textContent = T.energy_at_cap;
      card.classList.add('is-capped');
    } else {
      card.classList.remove('is-capped');
      var next = e.t + INTERVAL - now;
      var toFull = Math.ceil((e.cap - e.v) / EN.regen);
      var fullAt = e.t + toFull * INTERVAL;
      st.textContent = T.energy_next.replace('{n}', EN.regen) + ' ' + short(next) + ' · ' + T.energy_full + ': ' + fmtDate(fullAt);
    }
    var f = $('.energy-form', card);
    if (f && document.activeElement !== f.v && document.activeElement !== f.cap) { f.v.value = e.v; f.cap.value = e.cap; }
    $('.energy-chest', card).disabled = e.v < EN.chest;
    var ch = $('.energy-charged-in', card);
    if (ch && document.activeElement !== ch) ch.value = c.charged || 0;
  }

  function renderReset(now) {
    var box = $('.reset-box');
    if (!box) return;
    var at = nextReset(now), parts = split(at - now);
    $$('.reset-timer b', box).forEach(function (b, i) { b.textContent = i ? pad(parts[i]) : parts[i]; });
    var w = $('.reset-when', box);
    if (w.getAttribute('datetime') !== String(at)) { w.setAttribute('datetime', new Date(at).toISOString()); w.textContent = fmtDate(at); }
  }

  function renderAll() {
    var now = Date.now();
    rollWeeks(now);
    renderTabs(); renderWeekly(); renderWeek1(); renderEnergy(now); renderReset(now);
    scheduleEnergy(now);
  }

  // Notification when a character's energy reaches the cap (notify.js; only on the weekly page).
  function scheduleEnergy(now) {
    var N = window.A2Notify;
    if (!N || !$('.energy-card')) return;
    state.chars.forEach(function (c) {
      var e = c.energy;
      settleEnergy(c, now);
      if (e.v >= e.cap) { N.cancel('energy-' + c.id); return; }
      var fullAt = e.t + Math.ceil((e.cap - e.v) / EN.regen) * INTERVAL;
      N.schedule('energy-' + c.id, fullAt, T.notify_energy, c.name + ' · ' + e.cap);
    });
  }
  // notify.js may load after this script: hook in once every deferred script has run
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.A2Notify) return;
    window.A2Notify.onChange(function () { scheduleEnergy(Date.now()); });
    scheduleEnergy(Date.now());
  });

  // ---- events ------------------------------------------------------------------
  function bind() {
    var add = $('.char-form-add');
    if (add) add.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = add.cname.value.trim();
      if (!name) return;
      var c = newChar(name, add.cls.value);
      state.chars.push(c); state.active = c.id;
      add.reset(); save(); renderAll();
    });
    var edit = $('.char-form-edit');
    if (edit) edit.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = active(), name = edit.cname.value.trim();
      if (!name) return;
      c.name = name; c.cls = edit.cls.value; save(); renderAll();
    });
    var del = $('.char-del');
    if (del) del.addEventListener('click', function () {
      if (state.chars.length < 2 || !confirm(T.char_delete_confirm)) return;
      state.chars = state.chars.filter(function (c) { return c.id !== state.active; });
      state.active = state.chars[0].id; save(); renderAll();
    });

    $$('.wk-item').forEach(function (li) {
      var id = li.dataset.id, max = +li.dataset.max;
      $$('.wk-btn', li).forEach(function (b) {
        b.addEventListener('click', function () {
          var c = active();
          c.done[id] = Math.max(0, Math.min(max, (c.done[id] || 0) + (+b.dataset.d)));
          save(); renderWeekly();
        });
      });
      var chk = $('.wk-check', li);
      if (chk) chk.addEventListener('click', function () {
        var c = active();
        c.done[id] = (c.done[id] || 0) >= max ? 0 : max;
        save(); renderWeekly();
      });
    });

    $$('input[data-goal]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var c = active();
        if (inp.checked) c.w1[inp.dataset.goal] = true; else delete c.w1[inp.dataset.goal];
        save(); renderWeek1();
      });
    });

    var card = $('.energy-card');
    if (card) {
      $('.energy-chest', card).addEventListener('click', function () {
        var c = active(), now = Date.now();
        settleEnergy(c, now);
        if (c.energy.v < EN.chest) { renderEnergy(now); return; } // not enough for a chest
        setEnergy(c, c.energy.v - EN.chest, now);
        save(); renderEnergy(now);
      });
      $('.energy-form', card).addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = active(), now = Date.now(), f = ev.target;
        var cap = parseInt(f.cap.value, 10), v = parseInt(f.v.value, 10);
        settleEnergy(c, now);
        if (cap > 0) c.energy.cap = cap;
        if (!isNaN(v)) setEnergy(c, v, now);
        f.v.blur(); f.cap.blur();
        save(); renderEnergy(now);
      });
      $('.energy-charged-in', card).addEventListener('change', function (ev) {
        var v = parseInt(ev.target.value, 10);
        active().charged = isNaN(v) ? 0 : Math.max(0, v);
        save();
      });
    }

    // Another tab changed the data: pick it up.
    window.addEventListener('storage', function (ev) { if (ev.key === KEY) { load(); renderAll(); } });
  }

  load();
  bind();
  renderAll();
  save();
  (function tick() {
    var now = Date.now();
    if (rollWeeks(now)) { save(); renderWeekly(); }
    renderEnergy(now); renderReset(now);
    setTimeout(tick, 1000 - (now % 1000));
  })();
})();
