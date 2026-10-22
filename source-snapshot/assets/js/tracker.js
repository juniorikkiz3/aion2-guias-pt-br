/* Weekly tracker + first-week checklist.
   Everything lives in localStorage under one key: { chars: [...], active, server: { week, done } }, per character
     { id, name, cls, il, week, done: {itemId: count}, w1: {goalId: true}, energy: { v, t, cap }, charged }
   - week: index of the weekly period the `done` counters belong to. When the current
     period differs, the counters are cleared — no manual reset needed.
   - server.done: the counters every character on the server shares (items with data-scope="server").
   - energy: v was the value at time t; every tick of the server-wide grid (anchor + k × interval) after t adds
     `regen`, up to cap. */
(function () {
  'use strict';
  var cfgEl = document.getElementById('tracker-config');
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var T = CFG.t;
  var KEY = 'aion2-tracker-v1';
  var WEEK = 7 * 864e5;
  // the week runs from the reset of the visitor's server region (site.js: store 'region'): global Wednesday 16:00 Seoul
  // time, Korea and Taiwan Wednesday 05:00 local (site.json weekly_reset, timers)
  var RS = CFG.reset;
  try { var rg = localStorage.getItem('region'); if (RS[rg] && RS[rg].anchor) RS = RS[rg]; } catch (e) {}
  var ANCHOR = Date.parse(RS.anchor);
  var EN = CFG.energy;
  var INTERVAL = EN.interval_min * 6e4;
  var EA = Date.parse(EN.anchor || RS.anchor);   // a real energy tick; all others are interval apart
  var ROSTER = !!document.querySelector('.roster-grid');   // weekly page: the roster may be empty
  var CLS = {};
  (CFG.cls_slugs || []).forEach(function (s, i) { CLS[s] = CFG.cls_names[i]; });

  // ---- storage ---------------------------------------------------------------
  var state;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
    if (!state || !Array.isArray(state.chars)) state = { chars: [], active: null };
    if (ROSTER) {
      // the weekly page starts from an empty roster and a "+" tile: drop the untouched default character
      state.chars = state.chars.filter(function (c) {
        // (its energy is ignored: the old page kept adding regeneration to it on its own)
        return !(state.chars.length === 1 && (CFG.char_defaults || [T.char_default]).indexOf(c.name) >= 0 && !c.cls && !c.il &&
          !Object.keys(c.done || {}).length && !Object.keys(c.w1 || {}).length && !c.charged);
      });
    } else if (!state.chars.length) state.chars.push(newChar(T.char_default, ''));
    if (!charById(state.active)) state.active = state.chars.length ? state.chars[0].id : null;
    if (state.member === undefined) {   // was a cap per character: the account has the membership if any character had 840
      state.member = state.chars.some(function (c) { return c.energy.cap >= (EN.cap_member || EN.cap); });
      applyCap(Date.now());
    }
    if (!state.server && serverIds().length) {   // only on the weekly page, where the shared items are
      // counters that are shared by the server used to be kept per character: take the highest one
      state.server = { week: weekIndex(Date.now()), done: {} };
      serverIds().forEach(function (id) {
        state.chars.forEach(function (c) {
          if (c.week === state.server.week && (c.done[id] || 0) > (state.server.done[id] || 0)) state.server.done[id] = c.done[id];
          delete c.done[id];
        });
      });
    }
  }
  function serverIds() {
    return [].map.call(document.querySelectorAll('.wk-item[data-scope="server"]'), function (li) { return li.dataset.id; });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function newChar(name, cls) {
    return {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name, cls: cls || '', il: 0, week: weekIndex(Date.now()), done: {}, w1: {},
      energy: { v: 0, t: Date.now(), cap: capNow(), unset: true }, charged: 0
    };
  }
  // the membership is one flag for the whole account: 840 instead of 560 for every character
  function capNow() { return state && state.member ? (EN.cap_member || EN.cap) : EN.cap; }
  function applyCap(now) {
    state.chars.forEach(function (c) {
      settleEnergy(c, now);
      c.energy.cap = capNow();
      if (c.energy.v > c.energy.cap) c.energy.v = c.energy.cap;
      c.energy.t = now;
    });
  }
  // class radios: set one (or none)
  // a number field out of range: a red frame and a short line under it, in the site's look (not the browser's bubble)
  function fieldError(inp, text) {
    var box = inp.closest('form, label') || inp.parentNode, msg = box.nextElementSibling;
    if (!msg || !msg.classList.contains('field-err')) {
      msg = document.createElement('p');
      msg.className = 'field-err';
      msg.setAttribute('role', 'alert');
      box.parentNode.insertBefore(msg, box.nextSibling);
    }
    msg.textContent = text;
    msg.hidden = false;
    inp.classList.remove('is-invalid');
    void inp.offsetWidth;   // restart the shake
    inp.classList.add('is-invalid');
    inp.setAttribute('aria-invalid', 'true');
    inp.addEventListener('input', function clear() {
      inp.classList.remove('is-invalid'); inp.removeAttribute('aria-invalid'); msg.hidden = true;
      inp.removeEventListener('input', clear);
    });
  }
  function numIn(inp) {   // the value of a 0..max field, or null (and the error shown) when it is not one
    var raw = inp.value.trim(), max = +inp.max || 9999, v = Number(raw);
    if (raw === '' || !/^\d+$/.test(raw) || v > max) { fieldError(inp, T.wk_num_range.replace('{max}', max)); return null; }
    return v;
  }
  // an empty name: our own hint (red line, a shake, the placeholder says why) instead of the browser's bubble
  function needName(f) {
    var inp = f.cname;
    if (!inp.dataset.ph) inp.dataset.ph = inp.placeholder;
    inp.placeholder = T.wk_name_needed;
    inp.classList.remove('is-invalid');
    void inp.offsetWidth;   // restart the shake
    inp.classList.add('is-invalid');
    inp.focus();
    inp.addEventListener('input', function clear() {
      inp.classList.remove('is-invalid'); inp.placeholder = inp.dataset.ph; inp.removeEventListener('input', clear);
    });
  }
  // (the first-week page still has a <select name="cls">)
  function setCls(f, v) {
    if (f.cls && f.cls.tagName === 'SELECT') { f.cls.value = v; return; }
    [].forEach.call(f.querySelectorAll('input[name="cls"]'), function (r) { r.checked = r.value === v; });
  }
  function clsOf(f) {
    if (f.cls && f.cls.tagName === 'SELECT') return f.cls.value;
    var r = f.querySelector('input[name="cls"]:checked'); return r ? r.value : '';
  }
  function charById(id) {
    for (var i = 0; i < state.chars.length; i++) if (state.chars[i].id === id) return state.chars[i];
    return null;
  }
  function active() { return charById(state.active); }

  // ---- time --------------------------------------------------------------------
  // Resets keep the local hour of the anchor in the reset's tz (16:00 Seoul time), also after a daylight saving change.
  var TZ = RS.tz, tzFmt = null;
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
    dateFmt = new Intl.DateTimeFormat(({ ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR', ja: 'ja-JP' })[CFG.lang] || 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch (e) { dateFmt = null; }
  function fmtDate(ms) { return dateFmt ? dateFmt.format(ms) : new Date(ms).toUTCString(); }

  // Clear weekly counters of every character whose data belongs to an older week.
  function rollWeeks(now) {
    var idx = weekIndex(now), changed = false;
    state.chars.forEach(function (c) {
      if (c.week !== idx) { c.week = idx; c.done = {}; changed = true; }
    });
    if (state.server && state.server.week !== idx) { state.server.week = idx; state.server.done = {}; changed = true; }
    return changed;
  }

  // Bring stored energy up to `now`: every grid tick between t and now adds regen, up to the cap.
  function tickNo(t) { return Math.floor((t - EA) / INTERVAL); }
  function nextTick(now) { return EA + (tickNo(now) + 1) * INTERVAL; }
  function settleEnergy(c, now) {
    var e = c.energy;
    if (e.v >= e.cap) { e.t = now; return; }
    var ticks = tickNo(now) - tickNo(e.t);
    if (ticks <= 0) return;
    e.v = Math.min(e.cap, e.v + ticks * EN.regen);
    e.t = now;
  }
  function fullAt(c, now) {
    var e = c.energy, need = Math.ceil((e.cap - e.v) / EN.regen);
    return need <= 0 ? now : EA + (tickNo(now) + need) * INTERVAL;
  }
  var clockFmt;
  try { clockFmt = new Intl.DateTimeFormat(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' }); } catch (e) { clockFmt = null; }
  function clock(ms) { return clockFmt ? clockFmt.format(ms) : new Date(ms).toTimeString().slice(0, 5); }
  function setEnergy(c, v, now) {
    var e = c.energy, wasFull = e.v >= e.cap;
    e.v = Math.max(0, Math.round(v));
    if (wasFull || e.v >= e.cap) e.t = now; // regeneration restarts once you drop below the cap
  }

  // ---- rendering ---------------------------------------------------------------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  function renderTabs() {
    var c0 = active(), f0 = $('.char-form-edit');
    if (f0 && c0) { f0.cname.value = c0.name; setCls(f0, c0.cls); }
    var del0 = $('.char-del');
    if (del0) del0.hidden = state.chars.length < (ROSTER ? 1 : 2);
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
  }

  // a bar on the weekly page fills by clip-path (no layout work on every tick)
  function fillBar(el, share) {
    var p = Math.max(0, Math.min(1, share)) * 100;
    el.style.clipPath = 'inset(0 ' + (100 - p) + '% 0 0 round 999px)';
  }
  // counters of an item: the server's for shared items, else the character's
  function bag(li, c) { return li.dataset.scope === 'server' ? state.server.done : c.done; }
  // an item that does not count for this character: not open (yet), or PvP while the character's PvP switch is off
  function itemOff(li, c) {
    return !!(li.dataset.inactive || (li.dataset.il && c.il && +li.dataset.il > c.il) || (li.dataset.pvp && c.noPvp));
  }
  // the week's %: the mean of the open items, each weighs the same (30 arena wins count as much as one Nightmare run)
  function share(lis, c) {
    var sum = 0, n = 0;
    lis.forEach(function (li) {
      if (itemOff(li, c)) return;
      var max = +li.dataset.max;
      sum += Math.min(max, bag(li, c)[li.dataset.id] || 0) / max; n++;
    });
    return n ? Math.round(sum / n * 100) : 0;
  }
  function weekPct(c) { return share($$('.wk-item[data-scope="char"]'), c); }

  function renderWeekly() {
    var c = active();
    $$('.wk-group[data-pvp]').forEach(function (g) {
      var sw = $('.wk-pvp-switch', g);
      if (sw) sw.setAttribute('aria-checked', c.noPvp ? 'false' : 'true');
      g.classList.toggle('is-off', !!c.noPvp);
      var note = $('.wk-pvp-off-note', g);
      if (note) note.hidden = !c.noPvp;
    });
    $$('.wk-item').forEach(function (li) {
      var id = li.dataset.id, max = +li.dataset.max, n = Math.min(max, bag(li, c)[id] || 0);
      var locked = itemOff(li, c);
      li.classList.toggle('is-locked', locked);
      li.classList.toggle('is-done', n >= max);
      $$('button', li).forEach(function (x) { x.disabled = locked; });
      var b = $('.wk-count b', li);
      if (b) b.textContent = n;
      $$('.wk-pips i', li).forEach(function (p, i) { p.classList.toggle('on', i < n); });
      $$('.wk-check', li).forEach(function (chk) { chk.setAttribute('aria-pressed', n >= max ? 'true' : 'false'); });
    });
    var dn = $('.wk-done-n');
    if (dn) dn.textContent = share($$('.wk-item'), c);
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
    if (!card || !active()) return;
    var c = active(), e = c.energy;
    settleEnergy(c, now);
    $('.energy-value', card).textContent = e.unset ? '—' : e.v;
    $('.energy-cap-v', card).textContent = e.cap;
    fillBar($('.energy-bar span', card), e.unset ? 0 : e.v / e.cap);
    var st = $('.energy-status', card);
    card.classList.toggle('is-unset', !!e.unset);
    if (e.unset) {
      st.textContent = T.wk_energy_unset_long;
      card.classList.remove('is-capped');
    } else if (e.v >= e.cap) {
      st.textContent = T.energy_at_cap;
      card.classList.add('is-capped');
    } else {
      card.classList.remove('is-capped');
      var nt = nextTick(now);
      st.textContent = T.energy_next_at.replace('{n}', EN.regen).replace('{time}', clock(nt)) + ' (' + short(nt - now) + ') · ' +
        T.energy_full + ': ' + fmtDate(fullAt(c, now));
    }

    var f = $('.energy-form', card);
    if (f && document.activeElement !== f.v) f.v.value = e.unset ? '' : e.v;
    $$('.energy-chest', card).forEach(function (b) { b.disabled = e.v < EN.chest * (+b.dataset.n || 1); });
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

  // ---- roster: a card per character (weekly page) ----------------------------------
  function guideUrl(cls) { return cls && (CFG.guides || []).indexOf(cls) >= 0 ? CFG.root + CFG.lang + '/' + cls + '/' : ''; }
  var addForm = document.querySelector('.rc-form');   // kept: it moves in and out of the grid
  function buildRoster() {
    var box = $('.roster-grid');
    if (!box) return;
    if (addForm) { addForm.hidden = true; box.parentNode.insertBefore(addForm, box.nextSibling); }   // out before the grid is cleared
    box.innerHTML = '';
    state.chars.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rc';
      b.dataset.id = c.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', c.id === state.active ? 'true' : 'false');
      b.innerHTML = '<span class="rc-top">' + (c.cls ? '<img src="' + CFG.root + 'assets/classes/' + c.cls + '.webp" width="34" height="34" alt="">' : '<span class="rc-noimg" aria-hidden="true">?</span>') +
        '<span class="rc-who"><b></b><small></small></span><span class="rc-pct"></span></span>' +
        '<span class="rc-e"><span class="rc-ev"></span><span class="rc-eta"></span></span>' +
        '<span class="progress rc-bar" aria-hidden="true"><span></span></span>';
      $('.rc-who b', b).textContent = c.name;
      // always a second line, so every card's name sits at the same height
      $('.rc-who small', b).textContent = (CLS[c.cls] || T.char_class_none) + (c.il ? ' · ' + c.il + ' ' + T.wk_il_short : '');
      b.addEventListener('click', function () { state.active = c.id; save(); renderAll(); });
      box.appendChild(b);
    });
    // adding: an empty roster gets a big "+" tile; otherwise the button in the roster header, so a full row of
    // cards does not leave a row holding only a "+"; either way the form opens as a card at the end of the grid
    var head = $('.roster-add');
    var openForm = function () {
      if (!addForm) return;
      box.appendChild(addForm);
      addForm.hidden = false;
      if (head) head.hidden = true;
      addForm.cname.focus();
    };
    if (head) head.hidden = !state.chars.length;
    if (!state.chars.length) {
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'rc rc-add';
      plus.innerHTML = '<span class="rc-plus" aria-hidden="true">+</span><span></span>';
      plus.lastChild.textContent = T.wk_add_first;
      plus.addEventListener('click', function () { box.removeChild(plus); openForm(); });
      box.appendChild(plus);
    }
    if (head && !head.dataset.bound) { head.dataset.bound = '1'; head.addEventListener('click', openForm); }
  }
  function renderRoster(now) {
    var box = $('.roster-grid');
    if (!box) return;
    var sum = 0, cap = 0, known = 0;
    state.chars.forEach(function (c) {
      var card = box.querySelector('.rc[data-id="' + c.id + '"]');
      if (!card) return;
      settleEnergy(c, now);
      var e = c.energy, full = e.v >= e.cap && !e.unset;
      if (!e.unset) { sum += e.v; known++; }
      cap += e.cap;
      card.classList.toggle('is-full', full);
      card.classList.toggle('is-unset', !!e.unset);
      $('.rc-ev', card).innerHTML = e.unset ? '<b>—</b>/' + e.cap : '<b>' + e.v + '</b>/' + e.cap;
      $('.rc-eta', card).textContent = e.unset ? T.wk_energy_unset : full ? T.wk_full : T.wk_full_in.replace('{t}', short(fullAt(c, now) - now));
      fillBar($('.rc-bar span', card), e.unset ? 0 : e.v / e.cap);
      $('.rc-pct', card).textContent = T.wk_week_pct.replace('{p}', weekPct(c));
    });
    var se = $('.roster-e'), sc = $('.roster-cap'), tk = $('.roster-tick');
    if (se) se.textContent = known ? sum : '—';
    if (sc) sc.textContent = cap || '—';
    if (tk) tk.textContent = T.wk_next_tick.replace('{n}', EN.regen).replace('{time}', clock(nextTick(now)));
  }
  // the selected character: name, class, guide link, item level and what it opens
  function renderPanel() {
    var c = active(), img = $('.wk-who-img');
    if (!img) return;
    img.hidden = !c.cls;
    $('.wk-who-noimg').hidden = !!c.cls;
    $('.wk-who-nocls').hidden = !!c.cls;
    if (c.cls) img.src = CFG.root + 'assets/classes/' + c.cls + '.webp';
    $('.wk-who-name').textContent = c.name;
    var g = $('.wk-who-guide'), url = guideUrl(c.cls);
    g.hidden = !url;
    if (url) { g.href = url; g.textContent = T.wk_guide.replace('{cls}', CLS[c.cls] || c.cls) + ' →'; }
    var inp = $('.il-in');
    if (inp && document.activeElement !== inp) inp.value = c.il || '';
    var il = c.il || 0, next = null;
    $$('.il-list li').forEach(function (li) {
      var need = +li.dataset.il;
      li.classList.toggle('is-open', !!il && need <= il);
      li.classList.remove('is-next');
      if (il && need > il && next === null) { next = need; li.classList.add('is-next'); }
    });
    var nx = $('.il-next');
    if (nx) nx.textContent = !il ? T.wk_unlocks_none : next ? T.wk_unlocks_next.replace('{d}', next - il) : '';
  }

  function renderAll() {
    var now = Date.now();
    rollWeeks(now);
    var empty = !state.chars.length, lay = $('.wk-layout');
    if (lay) lay.hidden = empty;   // nothing to track until the first character is added
    document.documentElement.classList.toggle('roster-empty', empty);
    if (empty) { buildRoster(); renderRoster(now); renderReset(now); return; }
    renderTabs(); buildRoster(); renderRoster(now); renderPanel(); renderWeekly(); renderWeek1(); renderEnergy(now); renderReset(now);
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
      N.schedule('energy-' + c.id, fullAt(c, now), T.notify_energy, c.name + ' · ' + e.cap);
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
      if (!name) { needName(add); return; }
      var c = newChar(name, clsOf(add));
      state.chars.push(c); state.active = c.id;
      add.reset(); save(); renderAll();
    });
    var cancel = $('.rc-cancel');
    if (cancel) cancel.addEventListener('click', function () { add.reset(); buildRoster(); renderRoster(Date.now()); });
    var editBtn = $('.wk-edit-btn');
    if (editBtn) editBtn.addEventListener('click', function () {
      var f = $('.wk-edit'), open = f.hidden;
      f.hidden = !open;
      editBtn.setAttribute('aria-expanded', String(open));
      if (open) f.cname.focus();
    });
    var edit = $('.char-form-edit');
    if (edit) edit.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = active(), name = edit.cname.value.trim();
      if (!name) { needName(edit); return; }
      c.name = name; c.cls = clsOf(edit); save(); renderAll();
      if (edit.classList.contains('wk-edit')) { edit.hidden = true; $('.wk-edit-btn').setAttribute('aria-expanded', 'false'); }
    });
    var del = $('.char-del');
    var removeActive = function () {
      if (window.A2Notify) window.A2Notify.cancel('energy-' + state.active);
      state.chars = state.chars.filter(function (c) { return c.id !== state.active; });
      state.active = state.chars.length ? state.chars[0].id : null; save(); renderAll();
    };
    if (del) del.addEventListener('click', function () {
      if (state.chars.length < (ROSTER ? 1 : 2)) return;
      var o = { title: T.wk_del_title, name: active().name, text: T.wk_del_text, ok: T.char_delete, danger: true };
      if (window.A2Confirm) window.A2Confirm(o, removeActive);
      else if (confirm(T.wk_del_title.replace('{name}', active().name))) removeActive();
    });

    $$('.wk-item').forEach(function (li) {
      var id = li.dataset.id, max = +li.dataset.max;
      $$('.wk-btn', li).forEach(function (b) {
        b.addEventListener('click', function () {
          var d = bag(li, active());
          d[id] = Math.max(0, Math.min(max, (d[id] || 0) + (+b.dataset.d)));
          save(); renderWeekly(); renderRoster(Date.now());
        });
      });
      var pips = $('.wk-pips', li);
      if (pips) pips.addEventListener('click', function (ev) {
        var k = +(ev.target.dataset && ev.target.dataset.n);
        if (!k || li.classList.contains('is-locked')) return;
        var d = bag(li, active());
        d[id] = (d[id] || 0) === k ? k - 1 : k;
        save(); renderWeekly(); renderRoster(Date.now());
      });
      var chk = $('.wk-check', li);
      if (chk) chk.addEventListener('click', function () {
        var d = bag(li, active());
        d[id] = (d[id] || 0) >= max ? 0 : max;
        save(); renderWeekly(); renderRoster(Date.now());
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
      // a chest costs EN.chest; the ×2 button opens two at once
      $$('.energy-chest', card).forEach(function (b) {
        b.addEventListener('click', function () {
          var c = active(), now = Date.now(), cost = EN.chest * (+b.dataset.n || 1);
          settleEnergy(c, now);
          if (c.energy.v < cost) { renderEnergy(now); return; } // not enough for them
          setEnergy(c, c.energy.v - cost, now);
          save(); renderEnergy(now);
        });
      });
      $('.energy-form', card).addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = active(), now = Date.now(), f = ev.target;
        var v = numIn(f.v);
        if (v === null) return;
        settleEnergy(c, now);
        setEnergy(c, v, now); delete c.energy.unset;
        f.v.blur();
        save(); renderEnergy(now);
      });
    }

    // PvP switch (per character): off = the arena is greyed out and not counted in the week's %
    $$('.wk-pvp-switch').forEach(function (sw) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { sw.classList.add('is-ready'); }); });
      sw.addEventListener('click', function () {
        var c = active();
        if (!c) return;
        c.noPvp = !c.noPvp;
        save(); renderAll();
      });
    });
    // membership switch: one flag for the account; transitions are switched on only after the first paint, so the
    // saved state shows without the thumb sliding in
    var mem = $('.mem-switch');
    if (mem) {
      mem.setAttribute('aria-checked', state.member ? 'true' : 'false');
      requestAnimationFrame(function () { requestAnimationFrame(function () { mem.classList.add('is-ready'); }); });
      mem.addEventListener('click', function () {
        var now = Date.now();
        state.member = !state.member;
        mem.setAttribute('aria-checked', state.member ? 'true' : 'false');
        applyCap(now);
        save(); renderEnergy(now); renderRoster(now); scheduleEnergy(now);
      });
    }
    // a second click on the chosen class clears it
    $$('.cls-opt input').forEach(function (r) {
      var was = false;
      r.addEventListener('pointerdown', function () { was = r.checked; });
      r.addEventListener('click', function () { if (was) { r.checked = false; was = false; } });
    });

    var ilIn = $('.il-in');
    if (ilIn) ilIn.addEventListener('input', function () {
      var raw = ilIn.value.trim();
      if (raw !== '' && (!/^\d+$/.test(raw) || +raw > 9999)) { fieldError(ilIn, T.wk_num_range.replace('{max}', 9999)); return; }
      active().il = raw === '' ? 0 : +raw;
      save(); buildRoster(); renderRoster(Date.now()); renderPanel(); renderWeekly();
    });

    // Another tab changed the data: pick it up.
    window.addEventListener('storage', function (ev) { if (ev.key === KEY) { load(); renderAll(); } });
  }

  load();
  bind();
  renderAll();
  save();
  // backend build, Weekly page only: once a day, which classes the roster holds, how many characters and whether the
  // account has the membership - anonymous counts for the admin page ("what people play"), nothing else is sent
  (function rosterStat() {
    var api = document.documentElement.dataset.api;
    if (!api || !ROSTER || !state || !state.chars.length) return;
    var day = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('stat-roster-day') === day) return; localStorage.setItem('stat-roster-day', day); } catch (e) { return; }
    var keys = ['chars:' + Math.min(state.chars.length, 99), 'member:' + (state.member ? 1 : 0)];
    state.chars.forEach(function (c) { if (c.cls && keys.indexOf('cls:' + c.cls) < 0) keys.push('cls:' + c.cls); });
    fetch(api + '/stat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'roster', keys: keys }), keepalive: true }).catch(function () {});
  })();
  (function tick() {
    var now = Date.now();
    if (rollWeeks(now) && active()) { save(); renderWeekly(); }
    renderEnergy(now); renderRoster(now); renderReset(now);
    setTimeout(tick, 1000 - (now % 1000));
  })();
})();
