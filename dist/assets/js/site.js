(function () {
  'use strict';
  var root = document.documentElement;
  var OFF = (root.getAttribute('data-off') || '').split(' ');
  var MODES = ['pve', 'pvp', 'lvl'].filter(function (m) { return OFF.indexOf(m) < 0; });

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  // ---- theme -------------------------------------------------------------
  var themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store('theme', root.dataset.theme);
  });

  // ---- class picker, pages menu and language menu: close on outside click and Escape, one open at a time ----
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  [].forEach.call(document.querySelectorAll('details.class-menu, details.lang-menu'), function (cmenu, i, all) {
    // <details> closes instantly, so play the closing animation first.
    var closeMenu = function () {
      if (!cmenu.open || cmenu.classList.contains('is-closing')) return;
      if (calm) { cmenu.open = false; return; }
      cmenu.classList.add('is-closing');
      setTimeout(function () { cmenu.open = false; cmenu.classList.remove('is-closing'); }, 160);
    };
    cmenu.querySelector('summary').addEventListener('click', function (ev) {
      if (cmenu.open) { ev.preventDefault(); closeMenu(); }
    });
    cmenu.addEventListener('toggle', function () {
      if (cmenu.open) [].forEach.call(all, function (other) { if (other !== cmenu) other.open = false; });
    });
    document.addEventListener('click', function (ev) { if (cmenu.open && !cmenu.contains(ev.target)) closeMenu(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && cmenu.open) { closeMenu(); cmenu.querySelector('summary').focus(); }
    });
  });

  // ---- what's new: the latest entry pops up once; the "?" button leads to the changelog page ----
  var wn = document.querySelector('.whatsnew:not(.feedback)');
  var top = document.querySelector('.wn-top');
  var latest = wn ? wn.dataset.id : null;
  // Opening the changelog page counts as having seen the latest entry.
  var clPage = document.querySelector('[data-changelog-seen]');
  if (clPage) store('whatsnew-seen', clPage.dataset.changelogSeen);
  var markDot = function () { if (top) top.classList.toggle('has-new', !!latest && store('whatsnew-seen') !== latest); };
  if (wn && typeof wn.showModal === 'function') {
    var seen = function () { store('whatsnew-seen', latest); markDot(); };
    wn.addEventListener('close', seen);
    // A link inside the dialog navigates away — count that as seen too.
    wn.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', seen); });
    // Click on the backdrop closes it.
    wn.addEventListener('click', function (ev) { if (ev.target === wn) wn.close(); });
    // The launch celebration (celebrate.js) takes the stage first; What's new waits for the next visit.
    if (!clPage && store('whatsnew-seen') !== latest) setTimeout(function () {
      var party = document.querySelector('.cel-banner:not([hidden])');
      if (!wn.open && !party) wn.showModal();
    }, 600);
  }
  markDot();

  // ---- search (Ctrl+K or "/"): index built per language at docs/<lang>/search.json ----
  var sdlg = document.querySelector('.search-dlg');
  if (sdlg && typeof sdlg.showModal === 'function') {
    var sq = sdlg.querySelector('.search-q'), sres = sdlg.querySelector('.search-res');
    var KINDS = {};
    try { KINDS = JSON.parse(sdlg.dataset.kinds); } catch (e) {}
    var INDEX = null, hits = [], sel = 0;
    var norm = function (s) { return String(s).toLowerCase().replace(/ё/g, 'е'); };
    var escH = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var loadIndex = function () {
      if (INDEX) return Promise.resolve(INDEX);
      return fetch(sdlg.dataset.index).then(function (r) { return r.json(); }).then(function (d) {
        INDEX = d.map(function (x) { x.n = norm(x.t); x.ns = norm(x.s); return x; });
        return INDEX;
      }).catch(function () { INDEX = []; return INDEX; });
    };
    var ORDER = { class: 0, page: 1, section: 2, skill: 3, boss: 4 };
    var search = function (q) {
      q = norm(q.trim());
      if (!q) return [];
      var words = q.split(/\s+/);
      return INDEX.map(function (x) {
        var score = 0;
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          if (x.n.indexOf(w) === 0) score += 4;
          else if (x.n.indexOf(' ' + w) >= 0) score += 3;
          else if (x.n.indexOf(w) >= 0) score += 2;
          else if (x.ns.indexOf(w) >= 0) score += 1;
          else return null;
        }
        return { x: x, score: score };
      }).filter(Boolean).sort(function (a, b) {
        return b.score - a.score || ORDER[a.x.k] - ORDER[b.x.k] || a.x.t.localeCompare(b.x.t);
      }).slice(0, 30).map(function (r) { return r.x; });
    };
    var mark = function () {
      [].forEach.call(sres.children, function (li, i) { li.setAttribute('aria-selected', String(i === sel)); });
      var cur = sres.children[sel];
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    };
    var render = function () {
      sres.textContent = '';
      if (!hits.length) {
        if (sq.value.trim()) sres.innerHTML = '<li class="search-empty">' + escH(sdlg.dataset.empty) + '</li>';
        return;
      }
      hits.forEach(function (x, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === sel));
        li.innerHTML = '<a href="' + sdlg.dataset.base + x.u + '">' +
          (x.i ? '<img src="' + sdlg.dataset.root + x.i + '" width="28" height="28" alt="">' : '<span class="search-ico" aria-hidden="true"></span>') +
          '<span class="search-t">' + escH(x.t) + (x.s ? '<small>' + escH(x.s) + '</small>' : '') + '</span>' +
          '<span class="search-k">' + escH(KINDS[x.k] || '') + '</span></a>';
        li.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
        sres.appendChild(li);
      });
    };
    var run = function () { loadIndex().then(function () { hits = search(sq.value); sel = 0; render(); }); };
    var openSearch = function () {
      if (sdlg.open) return;
      sdlg.showModal();
      sq.select();
      run();
    };
    sq.addEventListener('input', run);
    sq.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (sel < hits.length - 1) { sel++; mark(); } }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (sel > 0) { sel--; mark(); } }
      else if (ev.key === 'Enter') { var a = sres.children[sel] && sres.children[sel].querySelector('a'); if (a) { ev.preventDefault(); a.click(); } }
    });
    sdlg.addEventListener('click', function (ev) {
      if (ev.target === sdlg) sdlg.close();
      // links to this same page (another section of the guide) must close the dialog too
      if (ev.target.closest && ev.target.closest('a')) setTimeout(function () { sdlg.close(); }, 0);
    });
    document.querySelectorAll('.search-open').forEach(function (b) { b.addEventListener('click', openSearch); });
    document.addEventListener('keydown', function (ev) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      if ((ev.key === 'k' || ev.key === 'K') && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); openSearch(); }
      else if (ev.key === '/' && !typing && !sdlg.open) { ev.preventDefault(); openSearch(); }
    });
  }

  // ---- easter egg (Cleric guide): the star under the guide opens the author's main ----
  var egg = document.querySelector('.egg-dlg'), eggStar = document.querySelector('.egg-star');
  if (egg && eggStar && typeof egg.showModal === 'function') {
    eggStar.addEventListener('click', function () { egg.showModal(); });
    egg.addEventListener('click', function (ev) { if (ev.target === egg) egg.close(); });
    egg.querySelector('.egg-x').addEventListener('click', function () { egg.close(); });
  }

  // ---- "Report a mistake": a form sent to the site owner (Telegram, through the Worker in site.json) ----
  var fb = document.querySelector('.feedback');
  if (fb && typeof fb.showModal === 'function') {
    var fbForm = fb.querySelector('.fb-form'), fbText = fb.querySelector('.fb-text'), fbStatus = fb.querySelector('.fb-status'), fbSend = fb.querySelector('.fb-send');
    var fbMode = function () { return document.querySelector('.guide') ? root.dataset.mode : ''; };
    var fbSay = function (key, kind) { fbStatus.textContent = key ? fbStatus.dataset[key] : ''; fbStatus.className = 'fb-status' + (kind ? ' is-' + kind : ''); };
    document.querySelectorAll('.report-open').forEach(function (b) {
      b.addEventListener('click', function () {
        fb.querySelector('.fb-where').textContent = fb.dataset.page + (fbMode() ? ' · ' + fbMode().toUpperCase() : '');
        fbSay(''); fbSend.disabled = false;
        fb.showModal(); fbText.focus();
      });
    });
    fb.addEventListener('click', function (ev) { if (ev.target === fb) fb.close(); });
    fb.querySelectorAll('.fb-x, .fb-cancel').forEach(function (b) { b.addEventListener('click', function () { fb.close(); }); });
    fbForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (fbText.value.trim().length < 5) { fbSay('short', 'err'); fbText.focus(); return; }
      fbSend.disabled = true; fbSay('sending');
      fetch(fb.dataset.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fbText.value, contact: fb.querySelector('.fb-contact').value, hp: fb.querySelector('.fb-hp').value,
          page: fb.dataset.page + location.hash, lang: fb.dataset.lang, mode: fbMode() })
      }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); }).then(function (r) {
        if (r.j && r.j.ok) {
          fbSay('ok', 'ok'); fbText.value = '';
          setTimeout(function () { if (fb.open) fb.close(); }, 1800);
        } else { fbSay(r.s === 429 ? 'rate' : 'err', 'err'); fbSend.disabled = false; }
      }).catch(function () { fbSay('err', 'err'); fbSend.disabled = false; });
    });
  }

  // ---- fallback without the form: prefill a GitHub issue with this page and mode ----
  document.querySelectorAll('.report-link').forEach(function (a) {
    a.addEventListener('click', function () {
      var mode = document.querySelector('.guide') ? root.dataset.mode : '-';
      var title = '[' + a.dataset.page.replace(/\/$/, '') + (mode !== '-' ? ' · ' + mode : '') + '] ';
      var body = a.dataset.body.replace(/\\n/g, '\n').replace('{url}', location.href).replace('{mode}', mode);
      a.href = a.href.split('?')[0] + '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    });
  });

  // ---- language: remember the choice, keep ?mode and #section ------------
  store('lang', root.lang);
  document.querySelectorAll('[data-keep-query]').forEach(function (a) {
    a.addEventListener('click', function () {
      store('lang', a.getAttribute('hreflang'));
      a.href = a.href.split(/[?#]/)[0] + location.search + location.hash;
    });
  });

  // ---- countdown to the next launch event in the top bar (every page) ------
  var topTimer = document.querySelector('.top-timer');
  if (topTimer) {
    var ttList = [];
    try { ttList = JSON.parse(topTimer.dataset.events).map(function (e) { return { at: Date.parse(e.at), n: e.n, o: e.o }; }); } catch (err) {}
    var ttName = topTimer.querySelector('.tt-name'), ttTime = topTimer.querySelector('.tt-time');
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var ttTick = function () {
      var now = Date.now(), next = null, live = null;
      ttList.forEach(function (e) {
        if (!next && e.at > now) next = e;
        if (e.o && e.at <= now && now < e.at + 2 * 864e5) live = e;   // 'open' for two days, then the chip goes away
      });
      topTimer.classList.toggle('is-live', !!live);
      if (live) {
        ttName.textContent = live.o;
        ttTime.innerHTML = '<span class="tt-short">' + topTimer.dataset.open + '</span>';
        setTimeout(ttTick, 30000);
        return;
      }
      if (!next) { topTimer.hidden = true; return; }
      var ms = next.at - now, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1e3) % 60;
      var U = topTimer.dataset.units.split(',');
      ttName.textContent = next.n;
      // full form for wide screens, a short one (two units) for phones
      ttTime.innerHTML = '<span class="tt-full">' + (d ? d + U[0] + ' ' : '') + p2(h) + ':' + p2(m) + ':' + p2(sec) + '</span>' +
        '<span class="tt-short">' + (d ? d + U[0] + ' ' + h + U[1] : h ? p2(h) + ':' + p2(m) : p2(m) + ':' + p2(sec)) + '</span>';
      setTimeout(ttTick, 1000 - (Date.now() % 1000));
    };
    ttTick();
  }
  // Home: the timers panel already shows the launch, Rift and reset timers, so the top bar chips appear only when
  // the panel scrolls away.
  var ttChips = [].slice.call(document.querySelectorAll('.top-timer, .rift-timer, .wr-chip'));
  var ttPanel = document.querySelector('.events');
  if (ttPanel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var on = entries[0].isIntersecting;
      ttChips.forEach(function (c) { c.classList.toggle('is-away', on); });
      root.classList.toggle('tt-panel', on);
    }, { rootMargin: '-56px 0px 0px 0px' }).observe(ttPanel);
  } else {
    ttChips.forEach(function (c) { c.classList.remove('is-away'); });
  }

  // ---- Rift countdown in the top bar (every page): openings every N hours from the anchor, at the same
  //      wall-clock hours in the server time zone across daylight saving (like the weekly reset) ----
  var rift = document.querySelector('.rift-timer');
  if (rift) {
    var rtAnchor = Date.parse(rift.dataset.anchor), rtEvery = (+rift.dataset.every || 3) * 36e5;
    var rtTime = rift.querySelector('.rt-time'), rtName = rift.querySelector('.rt-name'), rtFmt = null;
    var rtOpen = (+rift.dataset.openMin || 0) * 6e4;
    try { rtFmt = new Intl.DateTimeFormat('en-US', { timeZone: rift.dataset.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (err) {}
    var rtOff = function (t) {   // the zone's UTC offset at moment t, in ms
      if (!rtFmt) return 0;
      var p = {};
      rtFmt.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
      return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
    };
    var rtOff0 = rtOff(rtAnchor);
    var rtAt = function (k) { var t = rtAnchor + k * rtEvery; return t + rtOff0 - rtOff(t); };
    var r2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var rtTick = function () {
      var now = Date.now(), k = Math.max(0, Math.floor((now - rtAnchor) / rtEvery) - 1), next;
      while ((next = rtAt(k)) <= now) k++;
      // the entrance stays open a few minutes after each opening: count down to its closing instead
      var shut = k > 0 ? rtAt(k - 1) + rtOpen : 0, open = now < shut;
      rift.classList.toggle('is-open', open);
      rtName.textContent = open ? rift.dataset.open : 'Rift';
      if (open) next = shut;
      var ms = next - now, h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      // full form, and a short one (no seconds once there are hours) for phones
      rtTime.innerHTML = '<span class="rt-full">' + (h ? h + ':' + r2(m) : m) + ':' + r2(s) + '</span><span class="rt-short">' + (h ? h + ':' + r2(m) : m + ':' + r2(s)) + '</span>';
      rift.classList.toggle('is-soon', !open && ms < 6e5);   // last 10 minutes
      try {
        rift.title = rift.dataset.title + ' · ' + new Intl.DateTimeFormat(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' }).format(rtAt(k));
      } catch (err) {}
      setTimeout(rtTick, 1000 - (Date.now() % 1000));
    };
    rift.dataset.title = rift.title;
    rtTick();
  }

  // ---- weekly reset countdown in the top bar: every 7 days from the anchor at the same wall-clock hour in tz ----
  var rst = document.querySelector('.wr-chip');
  if (rst) {
    var rsAnchor = Date.parse(rst.dataset.anchor), WK = 7 * 864e5, rsFmt = null, rsU = rst.dataset.units.split(',');
    var rsTime = rst.querySelector('.wr-time');
    try { rsFmt = new Intl.DateTimeFormat('en-US', { timeZone: rst.dataset.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (err) {}
    var rsOff = function (t) {
      if (!rsFmt) return 0;
      var p = {};
      rsFmt.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
      return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
    };
    var rsOff0 = rsOff(rsAnchor);
    var rsAt = function (k) { var t = rsAnchor + k * WK; return t + rsOff0 - rsOff(t); };
    var s2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var rsTick = function () {
      var now = Date.now(), k = Math.max(0, Math.floor((now - rsAnchor) / WK) - 1), next;
      while ((next = rsAt(k)) <= now) k++;
      var ms = next - now, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      rsTime.innerHTML = '<span class="rt-full">' + (d ? d + rsU[0] + ' ' + h + rsU[1] : s2(h) + ':' + s2(m) + ':' + s2(s)) + '</span><span class="rt-short">' + (d ? d + rsU[0] : h ? h + rsU[1] : m + rsU[2]) + '</span>';
      try {
        rst.title = rst.dataset.title + ' · ' + new Intl.DateTimeFormat(document.documentElement.lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(next);
      } catch (err) {}
      setTimeout(rsTick, 1000 - (Date.now() % 1000));
    };
    rst.dataset.title = rst.title;
    rsTick();
  }

  // ---- launch schedule timers (home) ---------------------------------------
  var evBox = document.querySelector('.events');
  if (evBox) {
    var evs = [].slice.call(evBox.querySelectorAll('.ev[data-at]')).map(function (li) {
      return { li: li, at: Date.parse(li.dataset.at), cells: li.querySelectorAll('.ev-timer b') };
    });
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    // Main date = the visitor's own local time; the UTC text from the build moves to the note.
    try {
      var fmt = new Intl.DateTimeFormat(({ 'pt-BR': 'pt-BR', ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR' })[evBox.dataset.lang] || 'en-GB',
        { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      evs.forEach(function (e) {
        var t = e.li.querySelector('.ev-when time'), el = e.li.querySelector('.ev-local');
        if (!t || !el) return;
        el.textContent = t.textContent;
        t.textContent = fmt.format(e.at);
      });
    } catch (err) {}
    var tick = function () {
      var now = Date.now(), next = null;
      evs.forEach(function (e) {
        var ms = e.at - now;
        e.li.classList.toggle('is-done', ms <= 0);
        if (ms < -2 * 864e5) { e.li.hidden = true; return; }   // two days after it started the card leaves the panel
        e.li.classList.remove('is-next');
        if (ms <= 0) return;
        if (!next) next = e;
        var v = [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
        for (var i = 0; i < 4; i++) e.cells[i].textContent = i ? pad(v[i]) : v[i];
      });
      if (next) {
        next.li.classList.add('is-next');
        setTimeout(tick, 1000 - (Date.now() % 1000));
      }
    };
    tick();

    // Repeating timers (Rift, weekly reset): the next occurrence every N hours from the anchor, at the same
    // wall-clock hour in tz across daylight saving — the same rule as the top bar chips.
    [].slice.call(evBox.querySelectorAll('.ev-cycle')).forEach(function (li) {
      var anchor = Date.parse(li.dataset.anchor), every = (+li.dataset.every || 168) * 36e5, openMs = (+li.dataset.openMin || 0) * 6e4;
      var cells = li.querySelectorAll('.ev-timer b'), when = li.querySelector('.ev-when time'), zf = null, lf = null;
      try { zf = new Intl.DateTimeFormat('en-US', { timeZone: li.dataset.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (err) {}
      try { lf = new Intl.DateTimeFormat(({ 'pt-BR': 'pt-BR', ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR' })[evBox.dataset.lang] || 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); } catch (err) {}
      var off = function (t) {
        if (!zf) return 0;
        var p = {};
        zf.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
        return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
      };
      var off0 = off(anchor);
      var at = function (k) { var t = anchor + k * every; return t + off0 - off(t); };
      var ctick = function () {
        var now = Date.now(), k = Math.max(0, Math.floor((now - anchor) / every) - 1), next;
        while ((next = at(k)) <= now) k++;
        var shut = openMs && k > 0 ? at(k - 1) + openMs : 0, open = now < shut;   // the Rift entrance stays open a few minutes
        li.classList.toggle('is-open', open);
        var ms = (open ? shut : next) - now;
        var v = [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
        for (var i = 0; i < 4; i++) cells[i].textContent = i ? pad(v[i]) : v[i];
        if (when && lf) when.textContent = lf.format(next);
        setTimeout(ctick, 1000 - (Date.now() % 1000));
      };
      ctick();
    });
  }

  // ---- page tabs (templates/tabs.html): show one data-tab-panel, slide the gold indicator, open the tab of a #link ----
  [].forEach.call(document.querySelectorAll('.page-tabs'), function (bar) {
    var tabs = [].slice.call(bar.querySelectorAll('.pt-tab')), ind = bar.querySelector('.pt-ind');
    var panels = [].slice.call(document.querySelectorAll('[data-tab-panel]'));
    var place = function () {
      var on = tabs.filter(function (x) { return x.getAttribute('aria-selected') === 'true'; })[0];
      if (!on || !ind) return;
      ind.style.width = on.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + on.offsetLeft + 'px)';
      if (bar.scrollWidth > bar.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    var show = function (id) {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x.dataset.tab === id ? 'true' : 'false'); });
      panels.forEach(function (p) { p.hidden = p.dataset.tabPanel !== id; });
      place();
    };
    tabs.forEach(function (x) {
      x.addEventListener('click', function () {
        show(x.dataset.tab);
        // a shorter panel must not drop the reader to the footer: keep the tabs at the top of the screen
        var top = bar.getBoundingClientRect().top;
        if (top < 0) window.scrollTo({ top: top + window.pageYOffset - 80, behavior: 'smooth' });
      });
      x.addEventListener('keydown', function (e) {   // arrow keys move between tabs
        var i = tabs.indexOf(x) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        if (i !== tabs.indexOf(x) && tabs[i]) { e.preventDefault(); tabs[i].focus(); show(tabs[i].dataset.tab); }
      });
    });
    var fromHash = function () {
      var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      var p = el && el.closest('[data-tab-panel]');
      if (p) { show(p.dataset.tabPanel); el.scrollIntoView(); }
    };
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('resize', place);
    // remember the last tab of this page in this browser (a #link still wins)
    var key = 'tab:' + location.pathname.replace(/^.*?\/(?:en|ru|uk|tr)\//, '');
    var saved = null;
    try { saved = localStorage.getItem(key); } catch (err) {}
    if (saved && tabs.some(function (x) { return x.dataset.tab === saved; })) show(saved);
    tabs.forEach(function (x) { x.addEventListener('click', function () { try { localStorage.setItem(key, x.dataset.tab); } catch (err) {} }); });
    fromHash();
    place();
    requestAnimationFrame(function () { bar.classList.add('is-ready'); });   // no slide on first paint
  });

  // ---- tooltips: hover (or tap) any skill name or icon, or an item on the progression page ---------------------
  var skEl = document.getElementById('sk-data');
  if (skEl) {
    var SK = {};
    try { SK = JSON.parse(skEl.textContent); } catch (e) {}
    var tip = document.createElement('div');
    tip.className = 'sk-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);
    var shownFor = null;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var showTip = function (el) {
      var d = SK[el.dataset.sk];
      if (!d) return;
      shownFor = el;
      // Items (progression page) bring their own meta line and grade; skills get category + cooldown.
      var meta = d.m !== undefined ? [d.m] : [skEl.dataset[d.c] || ''];
      if (d.cd) meta.push(skEl.dataset.cd + ' ' + d.cd + ' ' + skEl.dataset.s);
      tip.innerHTML = '<p class="sk-tip-name' + (d.g ? ' is-item g' + d.g : '') + '">' + esc(d.n) + '</p>' +
        '<p class="sk-tip-meta">' + esc(meta.filter(Boolean).join(' · ')) + '</p>' +
        (d.d ? '<p class="sk-tip-desc">' + esc(d.d).replace(/\n+/g, '<br>') + '</p>' : '') +
        (d.sp.length ? '<ul>' + d.sp.map(function (s) { return '<li><b>' + s[0] + '</b>' + esc(s[1]) + '</li>'; }).join('') + '</ul>' : '');
      tip.hidden = false;
      var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
      var y = r.bottom + 8;
      if (y + h > window.innerHeight - 8 && r.top - h - 8 > 8) y = r.top - h - 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    };
    var hideTip = function () { tip.hidden = true; shownFor = null; };
    var hoverable = matchMedia('(hover: hover)').matches;
    if (hoverable) {
      document.addEventListener('mouseover', function (ev) {
        var el = ev.target.closest && ev.target.closest('[data-sk]');
        if (el && el !== shownFor) showTip(el); else if (!el && shownFor) hideTip();
      });
    } else {
      // Touch: tap a skill to open its tooltip, tap anywhere else to close it.
      document.addEventListener('click', function (ev) {
        var el = ev.target.closest && ev.target.closest('[data-sk]');
        if (el && el !== shownFor) { showTip(el); ev.preventDefault(); } else hideTip();
      });
    }
    window.addEventListener('scroll', hideTip, { passive: true });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hideTip(); });
  }

  // ---- Daevanion board tabs (dv_board macro) ----
  [].forEach.call(document.querySelectorAll('[data-dvb]'), function (box) {
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    function pick(tab) {
      tabs.forEach(function (x) {
        var on = x === tab;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
    }
    // slider: light up the nodes (and links) whose running crystal total fits
    var panels = [].slice.call(box.querySelectorAll('.dvb-panel'));
    function setBoard(panel, v) {
      var range = panel.querySelector('[data-dvb-range]');
      range.value = v;
      v = +range.value;
      panel.querySelector('[data-dvb-v]').textContent = v;
      range.style.setProperty('--p', (v / +range.max * 100) + '%');
      [].forEach.call(panel.querySelectorAll('.dvb-n:not(.start), .dvb-svg line'), function (el) {
        el.classList.toggle('on', +el.getAttribute('data-c') <= v);
      });
      var reset = panel.querySelector('[data-dvb-reset]');
      if (reset) reset.disabled = v === +reset.getAttribute('data-dvb-reset');
      var tab = document.getElementById(panel.getAttribute('aria-labelledby'));
      var t = tab && tab.querySelector('[data-dvb-t]');
      if (t) t.textContent = v;
    }
    panels.forEach(function (panel) {
      var range = panel.querySelector('[data-dvb-range]');
      if (!range) return;
      range.addEventListener('input', function () { setBoard(panel, range.value); });
      var reset = panel.querySelector('[data-dvb-reset]');
      // back to the guide's route (the value the page opened with)
      if (reset) reset.addEventListener('click', function (ev) {
        ev.preventDefault();
        setBoard(panel, reset.getAttribute('data-dvb-reset'));
        range.focus();
      });
      range.style.setProperty('--p', (+range.value / +range.max * 100) + '%');
    });
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { pick(tab); });
      tab.addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (d) { var next = tabs[(i + d + tabs.length) % tabs.length]; pick(next); next.focus(); ev.preventDefault(); }
      });
    });
  });

  // ---- guide pages: highlight the current section in the left menu ----------
  var pgLinks = document.querySelectorAll('.pg-side .toc-list a');
  if (pgLinks.length && 'IntersectionObserver' in window) {
    var pgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        pgLinks.forEach(function (a) {
          if (a.hash === '#' + e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-25% 0px -70% 0px' });
    document.querySelectorAll('.pg-sec').forEach(function (s) { pgObserver.observe(s); });
  }

  // Everything below is for class pages.
  if (!document.querySelector('.guide')) return;

  // ---- table of contents (rebuilt per mode) --------------------------------
  var sideToc = document.querySelector('.toc-list');
  var mobileToc = document.querySelector('.toc-mobile');
  var observer = null;

  function visibleSections() {
    return Array.prototype.filter.call(document.querySelectorAll('.guide .g-section'), function (s) {
      return s.offsetParent !== null;
    });
  }
  function buildToc() {
    var secs = visibleSections();
    [sideToc, mobileToc].forEach(function (nav) {
      if (!nav) return;
      nav.textContent = '';
      secs.forEach(function (s) {
        var a = document.createElement('a');
        a.href = '#' + s.id;
        a.textContent = s.querySelector('h2').textContent;
        nav.appendChild(a);
      });
    });
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        document.querySelectorAll('.toc-list a, .toc-mobile a').forEach(function (a) {
          var on = a.hash === '#' + e.target.id;
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
          if (on && a.parentNode === mobileToc) {
            // keep the active chip visible without scrolling the page
            if (a.offsetLeft < mobileToc.scrollLeft || a.offsetLeft + a.offsetWidth > mobileToc.scrollLeft + mobileToc.clientWidth) {
              mobileToc.scrollLeft = a.offsetLeft - 16;
            }
          }
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    secs.forEach(function (s) { observer.observe(s); });
  }

  // ---- mode switch -----------------------------------------------------------
  var modeButtons = document.querySelectorAll('.mode-switch [data-set-mode]');
  function syncButtons(mode) {
    mode = mode || root.dataset.mode;
    modeButtons.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.setMode === mode)); });
  }
  var guide = document.querySelector('.guide');
  var switchTimer = null, target = null;
  function setMode(mode) {
    if (MODES.indexOf(mode) < 0 || mode === (target || root.dataset.mode)) return;
    if (calm) return applyMode(mode);
    target = mode;
    // Fade the guide out, swap the mode (the hero animates in CSS), fade back in.
    syncButtons(mode);
    guide.classList.add('is-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(function () {
      target = null;
      applyMode(mode);
      guide.classList.remove('is-switching');
    }, 160);
  }
  function applyMode(mode) {
    var y = window.scrollY;              // keep the page exactly where it is
    root.dataset.mode = mode;
    window.scrollTo({ top: y, behavior: 'instant' });
    syncButtons();
    buildToc();
    store('mode', mode);
    var url = new URL(location.href);
    if (mode === 'pve') url.searchParams.delete('mode'); else url.searchParams.set('mode', mode);
    var anchor = url.hash && document.getElementById(url.hash.slice(1));
    if (anchor && !anchor.offsetParent) url.hash = '';
    history.replaceState(null, '', url);
  }
  modeButtons.forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.setMode); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var i = MODES.indexOf(target || root.dataset.mode) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = MODES[(i + MODES.length) % MODES.length];
      setMode(next);
      document.querySelector('.mode-switch [data-set-mode="' + next + '"]').focus();
    });
  });
  // In-text links to another mode open that guide from the top.
  document.querySelectorAll('.guide [data-set-mode]').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.setMode); window.scrollTo({ top: 0, behavior: 'instant' }); });
  });

  // A link to a section of another mode switches to that mode.
  var hashTarget = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  var scope = hashTarget && hashTarget.closest('[data-only]');
  if (scope && scope.dataset.only.split(' ').indexOf(root.dataset.mode) < 0) {
    var alt = scope.dataset.only.split(' ').filter(function (m) { return MODES.indexOf(m) >= 0; })[0];
    if (alt) root.dataset.mode = alt;
  }
  syncButtons();
  buildToc();
  // Turn on the mode transitions only after the first paint, so the page doesn't animate on load.
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('anim'); }); });
  if (hashTarget) window.addEventListener('load', function () { hashTarget.scrollIntoView({ behavior: 'instant' }); });

  // ---- ?sk=<slug> (search result): jump to that skill's card, in whichever mode has it ----
  var wantSk = new URLSearchParams(location.search).get('sk');
  if (wantSk) {
    var cards = [].slice.call(document.querySelectorAll('.skill[data-sk-card="' + wantSk.replace(/"/g, '') + '"]'));
    var card = cards.filter(function (c) { return c.offsetParent; })[0];
    if (!card && cards.length) {
      var sc = cards[0].closest('[data-only]');
      var m = sc && sc.dataset.only.split(' ').filter(function (x) { return MODES.indexOf(x) >= 0; })[0];
      if (m) { applyMode(m); card = cards[0]; }
    }
    if (!card) card = document.querySelector('.guide [data-sk="' + wantSk.replace(/"/g, '') + '"]');
    if (card) {
      window.addEventListener('load', function () {
        card.scrollIntoView({ block: 'center', behavior: 'instant' });
        // lazy images above may still shift the layout: settle once more
        setTimeout(function () { card.scrollIntoView({ block: 'center', behavior: 'instant' }); }, 350);
        card.classList.add('is-found');
        setTimeout(function () { card.classList.remove('is-found'); }, 2500);
      });
    }
  }

  // ---- leveling tracker --------------------------------------------------
  var tracker = document.querySelector('.tracker');
  if (tracker) {
    var key = 'lvl-progress:' + tracker.dataset.class;
    var done = {};
    try { done = JSON.parse(store(key) || '{}') || {}; } catch (e) { done = {}; }
    var boxes = tracker.querySelectorAll('input[data-step]');
    var bar = tracker.querySelector('.progress');
    var render = function () {
      var n = 0;
      boxes.forEach(function (b) {
        b.checked = !!done[b.dataset.step];
        b.closest('.step').classList.toggle('done', b.checked);
        if (b.checked) n++;
      });
      bar.querySelector('span').style.width = (boxes.length ? (100 * n / boxes.length) : 0) + '%';
      bar.setAttribute('aria-valuenow', n);
      tracker.querySelector('.progress-count').textContent = n;
    };
    boxes.forEach(function (b) {
      b.addEventListener('change', function () {
        if (b.checked) done[b.dataset.step] = 1; else delete done[b.dataset.step];
        store(key, JSON.stringify(done));
        render();
      });
    });
    tracker.querySelector('.tracker-reset').addEventListener('click', function (e) {
      if (!confirm(e.currentTarget.dataset.confirm)) return;
      done = {};
      store(key, '{}');
      render();
    });
    render();
  }
})();
