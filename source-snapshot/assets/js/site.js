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

  // ---- confirm dialog for the whole site: A2Confirm({title, text, ok, danger}, onOk); the browser's confirm() as a fallback ----
  var cfd = document.querySelector('.confirm-dlg'), cfOk = null;
  window.A2Confirm = function (o, onOk) {
    if (!cfd || typeof cfd.showModal !== 'function') { if (confirm(o.text || o.title)) onOk(); return; }
    // {name} in the title (the thing being deleted) is shown bold and in gold
    var ti = cfd.querySelector('.cf-title'), parts = String(o.title).split('{name}');
    ti.textContent = parts[0];
    if (parts.length > 1) {
      var nm = document.createElement('b');
      nm.className = 'cf-name';
      nm.textContent = o.name || '';
      ti.appendChild(nm);
      ti.appendChild(document.createTextNode(parts.slice(1).join('')));
    }
    var tx = cfd.querySelector('.cf-text');
    tx.textContent = o.text || '';
    tx.hidden = !o.text;
    var ok = cfd.querySelector('.cf-ok');
    ok.textContent = o.ok;
    ok.className = 'btn cf-ok ' + (o.danger ? 'btn-danger' : 'btn-primary');
    cfOk = onOk;
    cfd.returnValue = '';
    cfd.showModal();
    cfd.querySelector('.cf-cancel').focus();   // the safe choice is the default
  };
  if (cfd) {
    cfd.addEventListener('close', function () { var f = cfOk; cfOk = null; if (cfd.returnValue === 'ok' && f) f(); });
    cfd.addEventListener('click', function (ev) { if (ev.target === cfd) cfd.close('cancel'); });   // a click on the backdrop
  }

  // ---- what's new: the latest entry pops up once; the "?" button leads to the changelog page ----
  var wn = document.querySelector('.whatsnew:not(.feedback):not(.confirm-dlg)');
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

  // ---- game news: NC's patch notes in short. The page carries the entries known at build time (#up-cfg); the backend
  // build then loads the live list from /api/updates (the server writes it from NC's board). One renderer fills the
  // drawer (the tab on the right edge), the /updates/ page and the "Patch changes" block of a class guide.
  var upCfgEl = document.getElementById('up-cfg');
  var UP = null;
  try { UP = upCfgEl && JSON.parse(upCfgEl.textContent); } catch (e) { UP = null; }
  if (UP) {
    var upEsc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    // item text may carry <b> and skill references {s:class/slug} (icon + client name + tooltip, like in the guides)
    var upTips = null;
    var upRich = function (s) {
      return upEsc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>').replace(/\{s:([a-z0-9-]+\/[a-z0-9-]+)\}/g, function (m, key) {
        var d = upTips && upTips[key];
        return d ? '<span class="sk" data-sk="' + key + '"><img src="' + UP.root + d.i + '" width="18" height="18" alt="" loading="lazy">' + upEsc(d.n) + '</span>' : '';
      });
    };
    var upTx = function (x) { return x && typeof x === 'object' ? (x[UP.lang] || x.en || '') : (x || ''); };
    var upDay = function (iso) {
      var p = String(iso).split('-').map(Number), mon = UP.months[p[1] - 1];
      return UP.lang === 'en' ? mon + ' ' + p[2] + ', ' + p[0] : UP.lang === 'ja' ? p[0] + '年' + p[1] + '月' + p[2] + '日' : p[2] + ' ' + mon + ' ' + p[0];
    };
    var upHref = function (path) { return UP.root + UP.lang + '/' + path; };
    var upCls = function (slug) {
      var c = UP.classes[slug];
      return c ? '<a class="up-cls-tag" href="' + upHref(slug + '/') + '"><img src="' + c.icon + '" width="22" height="22" alt="" loading="lazy">' + upEsc(c.name) + '</a>' : '';
    };
    var upItem = function (i, withCls) {
      return '<li' + (withCls && i.cls ? ' class="up-cls"' : '') + '>' + (withCls && i.cls ? upCls(i.cls) : '') + '<span>' + upRich(upTx(i.text)) +
        (i.href ? ' <a href="' + upHref(i.href) + '">→</a>' : '') + '</span></li>';
    };
    // class lines grouped: one block per class (its icon and name once), its changes listed inside
    var upClassBlocks = function (items) {
      var order = [], by = {};
      items.forEach(function (i) { var k = i.cls || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(i); });
      return order.map(function (k) {
        return '<li class="up-cls">' + (k ? upCls(k) : '') + '<div class="up-cls-lines">' + by[k].map(function (i) {
          return '<p>' + upRich(upTx(i.text)) + (i.href ? ' <a href="' + upHref(i.href) + '">→</a>' : '') + '</p>';
        }).join('') + '</div></li>';
      }).join('');
    };
    var upTop = function (u) {
      return '<time class="up-date" datetime="' + upEsc(u.date) + '">' + upDay(u.date) + '</time><a class="up-official" href="' + upEsc(u.url) +
        '" target="_blank" rel="noopener">' + upEsc(UP.t.official) + ' ↗</a>';
    };
    var upClassItems = function (u) {
      var out = [];
      (u.groups || []).forEach(function (g) { if (g.kind === 'classes') out = out.concat(g.items); });
      return out;
    };
    var renderNews = function () {
      var list = UP.entries || [];
      // the drawer: the five newest, each with its class lines
      var dl = document.querySelector('.up-drawer-list');
      if (dl) dl.innerHTML = list.slice(0, 5).map(function (u) {
        var cl = upClassItems(u);
        return '<article class="up-card"><p class="up-card-top">' + upTop(u) + '</p><h3 class="up-card-title">' + upEsc(upTx(u.title)) + '</h3>' +
          '<p class="up-summary">' + upEsc(upTx(u.summary)) + '</p>' +
          (cl.length ? '<ul class="up-items">' + upClassBlocks(cl) + '</ul>' : '') +
          '<a class="up-card-more" href="' + upHref('updates/#up-' + u.id) + '">' + upEsc(UP.t.details) + ' →</a></article>';
      }).join('');
      // the /updates/ page: everything, by group
      var pg = document.querySelector('[data-up-page]');
      if (pg) pg.innerHTML = list.map(function (u) {
        return '<article class="up-entry" id="up-' + upEsc(u.id) + '"><div class="up-entry-side">' + upTop(u) + '</div><div class="up-entry-body">' +
          '<h2 class="up-entry-title">' + upEsc(upTx(u.title)) + '</h2><p class="up-summary">' + upEsc(upTx(u.summary)) + '</p>' +
          (u.groups || []).map(function (g) {
            return '<section class="up-group"><h3 class="up-group-title">' + upEsc(UP.t['g_' + g.kind] || g.kind) + '</h3><ul class="up-items">' +
              (g.kind === 'classes' ? upClassBlocks(g.items) : g.items.map(function (i) { return upItem(i, true); }).join('')) + '</ul></section>';
          }).join('') + '</div></article>';
      }).join('');
      if (pg && location.hash) { var at = document.getElementById(location.hash.slice(1)); if (at) at.scrollIntoView(); }
      // a class guide: the class's lines from the five newest patches that touch it, and whether the guide was checked
      var sec = document.querySelector('.up-sec[data-cls]');
      if (sec) {
        var slug = sec.dataset.cls, mine = list.map(function (u) {
          return { u: u, items: upClassItems(u).filter(function (i) { return i.cls === slug; }) };
        }).filter(function (x) { return x.items.length; }).slice(0, 5);
        sec.querySelector('.up-sec-list').innerHTML = mine.map(function (x) {
          var ok = x.u.checked && x.u.checked[slug];
          return '<article class="up-sec-entry"><div class="up-sec-top"><time class="up-date" datetime="' + upEsc(x.u.date) + '">' + upDay(x.u.date) + '</time>' +
            '<a class="up-sec-title" href="' + upHref('updates/#up-' + x.u.id) + '">' + upEsc(upTx(x.u.title)) + '</a>' +
            '<span class="up-check' + (ok ? ' is-ok' : '') + '">' + upEsc(ok ? UP.t.checked : UP.t.unchecked) + '</span></div>' +
            '<ul class="up-items">' + x.items.map(function (i) { return upItem(i, false); }).join('') + '</ul></article>';
        }).join('');
        var was = sec.hidden;
        sec.hidden = !mine.length;
        if (was !== sec.hidden) document.dispatchEvent(new Event('a2-sections'));   // the table of contents follows
      }
      var tab = document.querySelector('.up-tab');
      if (tab) {
        tab.hidden = !list.length;
        if (list.length) tab.dataset.id = list[0].id;
      }
    };
    var upNeedsTips = function () { return /\{s:/.test(JSON.stringify(UP.entries || [])); };
    var upRender = function () {
      if (upTips || !upNeedsTips()) return renderNews();
      fetch(UP.root + UP.lang + '/skill-tips.json').then(function (r) { return r.json(); })
        .then(function (d) { upTips = d; if (window.A2Tips) window.A2Tips.add(d); }).catch(function () { upTips = {}; })
        .then(renderNews);
    };
    upRender();
    var upApi = document.documentElement.dataset.api;
    if (upApi) fetch(upApi + '/updates', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.entries) || !d.entries.length) return;
        UP.entries = d.entries.map(function (u) {
          return { id: u.id, date: u.date, url: u.url, title: u.title, summary: u.summary, checked: u.checked || {},
            groups: (u.groups || []).map(function (g) { return { kind: g.kind, items: g.items.map(function (i) { return { cls: i.cls, href: i.href, text: i }; }) }; }) };
        });
        upRender();
        if (typeof upDot === 'function') upDot();
      }).catch(function () {});
  }

  // the drawer: the tab on the right edge opens it; a dot on the tab until the newest patch has been seen
  var upd = document.querySelector('.up-drawer'), upBtn = document.querySelector('.up-tab'), upDot = null;
  // centred on a whole pixel: top:50% with translate(-50%) lands on half a pixel and thins the borders
  var upPlace = function () {
    if (!upBtn || upBtn.hidden) return;
    if (window.matchMedia('(max-width: 600px)').matches) { upBtn.classList.remove('is-placed'); upBtn.style.top = upBtn.style.height = ''; return; }   // phones: pinned near the bottom (site.css)
    upBtn.style.height = '';
    var h = Math.ceil(upBtn.getBoundingClientRect().height);   // the text makes it fractional: the bottom border would blur
    upBtn.style.height = h + 'px';
    upBtn.style.top = Math.round((window.innerHeight - h) / 2) + 'px';
    upBtn.classList.add('is-placed');
  };
  upPlace();
  window.addEventListener('resize', upPlace);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(upPlace);   // the web font changes its height
  if (upd && upBtn && typeof upd.showModal === 'function') {
    var upSeenNow = function () { store('updates-seen', upBtn.dataset.id); };
    if (document.querySelector('.page-updates')) upSeenNow();
    var upDotFirst = true;
    upDot = function () {
      // the first time with no colour fade, so a fresh page never "blinks" gold
      if (upDotFirst) { upBtn.style.transition = 'none'; }
      upBtn.classList.toggle('has-new', store('updates-seen') !== upBtn.dataset.id);
      if (upDotFirst) { void upBtn.offsetWidth; upBtn.style.transition = ''; upDotFirst = false; }
    };
    var upClose = function () {
      if (!upd.open || upd.classList.contains('is-closing')) return;
      upd.classList.add('is-closing');
      setTimeout(function () { upd.classList.remove('is-closing'); upd.close(); }, 200);   // the slide-out time (site.css)
    };
    upBtn.addEventListener('click', function () { upd.showModal(); upSeenNow(); upDot(); });
    upd.querySelector('.up-x').addEventListener('click', upClose);
    upd.addEventListener('cancel', function (ev) { ev.preventDefault(); upClose(); });   // Esc slides it out too
    upd.addEventListener('click', function (ev) { if (ev.target === upd) upClose(); });  // a click on the backdrop
    if (document.querySelector('.page-updates')) upSeenNow();
    upDot();
  }

  // ---- search (Ctrl+K or "/"): index built per language at docs/<lang>/search.json ----
  var sdlg = document.querySelector('.search-dlg');
  if (sdlg && typeof sdlg.showModal === 'function') {
    var sq = sdlg.querySelector('.search-q'), sres = sdlg.querySelector('.search-res');
    var KINDS = {};
    try { KINDS = JSON.parse(sdlg.dataset.kinds); } catch (e) {}
    var INDEX = null, hits = [], sel = 0;
    var norm = function (s) { s = String(s); return (s.normalize ? s.normalize('NFKC') : s).toLowerCase().replace(/ё/g, 'е'); };
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
    // backend build only (data-api on <html>): log each finished query - a result opened, the dialog closed, or a
    // new query after a pause - with how many results it showed; typing "g", "gl", "gla" counts once
    var sApi = root.dataset.api, pend = '', pendN = 0, pendAt = 0;
    var flush = function (clicked) {
      if (!sApi || pend.length < 2) { pend = ''; return; }
      var body = JSON.stringify({ q: pend, results: pendN, lang: root.lang, clicked: !!clicked });
      pend = '';
      if (navigator.sendBeacon) navigator.sendBeacon(sApi + '/search', new Blob([body], { type: 'application/json' }));
      else fetch(sApi + '/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    };
    var track = function () {
      var q = sq.value.trim();
      if (pend && q !== pend && Date.now() - pendAt > 2500 && q.indexOf(pend) !== 0) flush(false);
      pend = q; pendN = hits.length; pendAt = Date.now();
    };
    var run = function () { loadIndex().then(function () { hits = search(sq.value); sel = 0; render(); track(); }); };
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
      if (ev.target.closest && ev.target.closest('a')) { flush(true); setTimeout(function () { sdlg.close(); }, 0); }
    });
    sdlg.addEventListener('close', function () { flush(false); });
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

  // ---- backend build only (data-api on <html>): count the view, the heart likes of the guide and its sections (no counts shown) ----
  if (root.dataset.api) {
    var api = root.dataset.api, page = root.dataset.page || '';
    var hp = document.querySelector('[data-helpful]');
    var showStats = function (d) {
      if (!hp || !d || d.views === undefined) return;
      hp.hidden = false;
      hp.querySelector('[data-v]').setAttribute('aria-pressed', String(d.mine === 1));
    };
    var showSections = function (d) {
      document.querySelectorAll('.sec-vote').forEach(function (box) {
        var mine = d && d.sections ? d.sections[box.dataset.sec] || 0 : 0;
        box.querySelector('[data-v]').setAttribute('aria-pressed', String(mine === 1));
      });
    };
    var post = function (url, body) {
      return fetch(api + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    };
    post('/view', { page: page }).then(function (d) { showStats(d); showSections(d); });
    // a heart: the first click likes, the second takes it back; it fills at once and pops (the server answer only confirms)
    var like = function (b) {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.classList.remove('is-pop');
      if (on) { void b.offsetWidth; b.classList.add('is-pop'); }
      return on ? 1 : 0;
    };
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('.sec-vote [data-v]');
      if (!b) return;
      post('/vote/section', { page: page, section: b.closest('.sec-vote').dataset.sec, v: like(b) });
    });
    if (hp) hp.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-v]');
      if (b) post('/vote', { page: page, v: like(b) });
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
  // The choice is saved only when the visitor makes it (language menu, the hint below), here and in a cookie: the server
  // reads the cookie to send a link without a language (/cleric/) to /<lang>/cleric/.
  var LANGS = ['en', 'ru', 'uk', 'tr', 'ja'];
  var setLang = function (l) {
    store('lang', l);
    try { document.cookie = 'lang=' + l + '; path=/; max-age=31536000; SameSite=Lax'; } catch (err) {}
  };
  var chosen = store('lang');
  if (LANGS.indexOf(chosen) < 0) chosen = null;
  else if (document.cookie.indexOf('lang=' + chosen) < 0) setLang(chosen);   // saved before the cookie existed
  document.querySelectorAll('[data-keep-query]').forEach(function (a) {
    a.addEventListener('click', function () {
      setLang(a.getAttribute('hreflang'));
      a.href = a.href.split(/[?#]/)[0] + location.search + location.hash;
    });
  });

  // ---- hint: this page is also in the visitor's language (chosen, else the browser's); never switches by itself ----
  (function () {   // own scope: bar / top / x are names used elsewhere in this file
    var hintData = document.getElementById('lang-hint-data');
    var want = chosen;
    if (!want) {
      var nav = (navigator.languages || [navigator.language || 'en']).join(',').toLowerCase();
      var first = (nav.match(/(^|,)(uk|tr|ja|ru|be)/) || [])[2];
      want = first === 'be' ? 'ru' : first || 'en';   // the same rule as the root page
    }
    var wantLink = document.querySelector('.lang-panel a[hreflang="' + want + '"]');
    if (hintData && want !== root.lang && wantLink) {
      var H = JSON.parse(hintData.textContent)[want];
      var bar = document.createElement('div');
      bar.className = 'lang-hint';
      bar.lang = want;
      bar.innerHTML = '<div class="wrap lh-in"><span class="lh-text"></span><a class="lh-go"></a><button type="button" class="lh-x">×</button></div>';
      bar.querySelector('.lh-text').textContent = H.text;
      var go = bar.querySelector('.lh-go');
      go.textContent = H.go;
      go.href = wantLink.href.split(/[?#]/)[0] + location.search + location.hash;
      go.addEventListener('click', function () { setLang(want); });
      var x = bar.querySelector('.lh-x');
      x.setAttribute('aria-label', H.close);
      x.title = H.close;
      x.addEventListener('click', function () { setLang(root.lang); bar.remove(); });   // closing = stay with this language
      var top = document.querySelector('.topbar');
      if (top) top.after(bar);
    }
  })();

  // ---- countdown to the next launch event in the top bar (every page) ------
  // hover card of a top bar chip (CSS shows data-tip under the chip); the native tooltip would double it
  var chipTip = function (el, text) {
    if (el.dataset.tip === text) return;
    el.dataset.tip = text;
    el.setAttribute('aria-label', text);
  };
  var chipClock = function (t, withDay) {
    try { return new Intl.DateTimeFormat(document.documentElement.lang, withDay ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }).format(t); } catch (err) { return ''; }
  };
  var topTimer = document.querySelector('.top-timer');
  if (topTimer) {
    topTimer.removeAttribute('title');
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
        chipTip(topTimer, live.o);
        topTimer.classList.remove('tt-wait');
        setTimeout(ttTick, 30000);
        return;
      }
      if (!next) { topTimer.hidden = true; topTimer.classList.remove('tt-wait'); return; }
      var ms = next.at - now, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1e3) % 60;
      var U = topTimer.dataset.units.split(',');
      ttName.textContent = next.n;
      // full form for wide screens, a short one (two units) for phones
      ttTime.innerHTML = '<span class="tt-full">' + (d ? d + U[0] + ' ' : '') + p2(h) + ':' + p2(m) + ':' + p2(sec) + '</span>' +
        '<span class="tt-short">' + (d ? d + U[0] + ' ' + h + U[1] : h ? p2(h) + ':' + p2(m) : p2(m) + ':' + p2(sec)) + '</span>';
      chipTip(topTimer, next.n + ' · ' + chipClock(next.at, true));
      topTimer.classList.remove('tt-wait');
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

  // ---- server region for the timers: Global (EU / NA, the same schedule) or Asia (the Rift an hour earlier).
  //      Chosen in the language menu or above the home timers; until then guessed from the time zone. ----
  var REGION = (function () {
    var r = store('region');
    if (r === 'global' || r === 'asia') return r;
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (err) {}
    return /^(Asia\/(Tokyo|Seoul|Shanghai|Chongqing|Hong_Kong|Macau|Taipei|Singapore|Manila|Bangkok|Jakarta|Makassar|Jayapura|Kuala_Lumpur|Kuching|Ho_Chi_Minh|Saigon|Phnom_Penh|Vientiane|Yangon|Brunei|Ulaanbaatar|Pontianak)|Australia\/|Pacific\/(Auckland|Guam|Port_Moresby))/.test(tz) ? 'asia' : 'global';
  })();
  var regionShift = function (el) { return REGION === 'asia' ? (+el.dataset.asiaMin || 0) * 6e4 : 0; };
  var showRegion = function () {
    [].forEach.call(document.querySelectorAll('.rg [data-region]'), function (b) { b.setAttribute('aria-checked', String(b.dataset.region === REGION)); });
    [].forEach.call(document.querySelectorAll('[data-rg-tag]'), function (t) { t.hidden = REGION !== 'asia'; });
  };
  showRegion();
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('.rg [data-region]');
    if (!b || b.dataset.region === REGION) return;
    REGION = b.dataset.region;
    store('region', REGION);
    showRegion();
    document.dispatchEvent(new CustomEvent('a2-region'));   // the timers re-read their anchors
  });

  // ---- Rift countdown in the top bar (every page): openings every N hours from the anchor, at the same
  //      wall-clock hours in the server time zone across daylight saving (like the weekly reset) ----
  // every chip of this kind: the Rift and the Shugo Festival (data-name; the Rift has none)
  [].forEach.call(document.querySelectorAll('.rift-timer'), function (rift) {
    var rtAnchor = Date.parse(rift.dataset.anchor) + regionShift(rift), rtEvery = (+rift.dataset.every || 3) * 36e5;
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
    document.addEventListener('a2-region', function () { rtAnchor = Date.parse(rift.dataset.anchor) + regionShift(rift); rtOff0 = rtOff(rtAnchor); });
    var r2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var rtTick = function () {
      var now = Date.now(), k = Math.max(0, Math.floor((now - rtAnchor) / rtEvery) - 1), next;
      while ((next = rtAt(k)) <= now) k++;
      // the entrance stays open a few minutes after each opening: count down to its closing instead
      var shut = k > 0 ? rtAt(k - 1) + rtOpen : 0, open = now < shut;
      rift.classList.toggle('is-open', open);
      rtName.textContent = open ? rift.dataset.open : (rift.dataset.name || 'Rift');
      if (open) next = shut;
      var ms = next - now, h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      // full form, and a short one (no seconds once there are hours) for phones
      rtTime.innerHTML = '<span class="rt-full">' + (h ? h + ':' + r2(m) : m) + ':' + r2(s) + '</span><span class="rt-short">' + (h ? h + ':' + r2(m) : m + ':' + r2(s)) + '</span>';
      rift.classList.toggle('is-soon', !open && ms < 6e5);   // last 10 minutes
      chipTip(rift, open ? rift.dataset.open + ' · ' + chipClock(rtAt(k - 1)) + '–' + chipClock(shut) : (rift.dataset.name || 'Rift') + ' · ' + chipClock(rtAt(k)));
      rift.classList.remove('tt-wait');
      setTimeout(rtTick, 1000 - (Date.now() % 1000));
    };
    rift.removeAttribute('title');
    rtTick();
  });

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
      chipTip(rst, rst.dataset.name + ' · ' + chipClock(next, true));
      rst.classList.remove('tt-wait');
      setTimeout(rsTick, 1000 - (Date.now() % 1000));
    };
    rst.removeAttribute('title');
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
      var fmt = new Intl.DateTimeFormat(({ ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR', ja: 'ja-JP' })[evBox.dataset.lang] || 'en-GB',
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
      var anchor = Date.parse(li.dataset.anchor) + regionShift(li), every = (+li.dataset.every || 168) * 36e5, openMs = (+li.dataset.openMin || 0) * 6e4;
      var cells = li.querySelectorAll('.ev-timer b'), when = li.querySelector('.ev-when time'), zf = null, lf = null;
      try { zf = new Intl.DateTimeFormat('en-US', { timeZone: li.dataset.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (err) {}
      try { lf = new Intl.DateTimeFormat(({ ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR', ja: 'ja-JP' })[evBox.dataset.lang] || 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); } catch (err) {}
      var off = function (t) {
        if (!zf) return 0;
        var p = {};
        zf.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
        return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
      };
      var off0 = off(anchor);
      var at = function (k) { var t = anchor + k * every; return t + off0 - off(t); };
      document.addEventListener('a2-region', function () { anchor = Date.parse(li.dataset.anchor) + regionShift(li); off0 = off(anchor); });
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
    var key = 'tab:' + location.pathname.replace(/^.*?\/(?:en|ru|uk|tr|ja)\//, '');
    var saved = null;
    try { saved = localStorage.getItem(key); } catch (err) {}
    if (saved && tabs.some(function (x) { return x.dataset.tab === saved; })) show(saved);
    tabs.forEach(function (x) { x.addEventListener('click', function () { try { localStorage.setItem(key, x.dataset.tab); } catch (err) {} }); });
    fromHash();
    place();
    requestAnimationFrame(function () { bar.classList.add('is-ready'); });   // no slide on first paint
  });

  // ---- tooltips: hover (or tap) any skill name or icon, or an item on the progression page ---------------------
  // Class pages carry their own data (#sk-data); the game news adds skills of any class (window.A2Tips.add).
  var skEl = document.getElementById('sk-data');
  var SK = {}, tipL = skEl ? skEl.dataset : ((UP && UP.tip) || {});
  window.A2Tips = { add: function (o) { for (var k in o) SK[k] = o[k]; } };
  if (skEl) { try { SK = JSON.parse(skEl.textContent); } catch (e) {} }
  if (skEl || UP) {
    var tip = document.createElement('div');
    tip.className = 'sk-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    // a popover lives in the top layer: above modal dialogs too (the Game news drawer); older browsers use z-index
    var tipPop = typeof tip.showPopover === 'function';
    if (tipPop) tip.popover = 'manual';
    document.body.appendChild(tip);
    var shownFor = null;
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var showTip = function (el) {
      var d = SK[el.dataset.sk];
      if (!d) return;
      shownFor = el;
      // Items (progression page) bring their own meta line and grade; skills get category + cooldown.
      var meta = d.m !== undefined ? [d.m] : [tipL[d.c] || ''];
      if (d.cd) meta.push(tipL.cd + ' ' + d.cd + ' ' + tipL.s);
      tip.innerHTML = '<p class="sk-tip-name' + (d.g ? ' is-item g' + d.g : '') + '">' + esc(d.n) + '</p>' +
        '<p class="sk-tip-meta">' + esc(meta.filter(Boolean).join(' · ')) + '</p>' +
        (d.d ? '<p class="sk-tip-desc">' + esc(d.d).replace(/\n+/g, '<br>') + '</p>' : '') +
        (d.sp.length ? '<ul>' + d.sp.map(function (s) { return '<li><b>' + s[0] + '</b>' + esc(s[1]) + '</li>'; }).join('') + '</ul>' : '');
      tip.hidden = false;
      if (tipPop) { try { if (tip.matches(':popover-open')) tip.hidePopover(); tip.showPopover(); } catch (e) {} }   // re-shown = on top
      var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
      var y = r.bottom + 8;
      if (y + h > window.innerHeight - 8 && r.top - h - 8 > 8) y = r.top - h - 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    };
    var hideTip = function () { tip.hidden = true; shownFor = null; if (tipPop) { try { tip.hidePopover(); } catch (e) {} } };
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
    document.addEventListener('scroll', hideTip, { passive: true, capture: true });   // the page or any scrolling box (the drawer)
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
    // one budget for all boards (option A): each board gets a share in proportion to the guide's route on it; past the
    // whole route the rest is shared by what each board still has. Shares snap to whole nodes, and what is left over
    // goes to the board furthest behind its share whose next node still fits.
    var tR = box.querySelector('[data-dvb-total]'), tN = box.querySelector('[data-dvb-total-n]'), tReset = box.querySelector('[data-dvb-total-reset]');
    var bs = panels.filter(function (panel) { return !panel.hasAttribute('data-dvb-nobudget'); }).map(function (panel) {
      var range = panel.querySelector('[data-dvb-range]'), reset = panel.querySelector('[data-dvb-reset]');
      var cums = {};
      [].forEach.call(panel.querySelectorAll('.dvb-n:not(.start)'), function (n) { var c = +n.getAttribute('data-c'); if (c > 0) cums[c] = 1; });
      return { panel: panel, range: range, route: reset ? +reset.getAttribute('data-dvb-reset') : +range.value, max: +range.max,
        steps: Object.keys(cums).map(Number).sort(function (x, y) { return x - y; }) };
    });
    var at = function (b, v) { var s = 0; for (var i = 0; i < b.steps.length && b.steps[i] <= v + 1e-9; i++) s = b.steps[i]; return s; };
    var next = function (b, s) { for (var i = 0; i < b.steps.length; i++) if (b.steps[i] > s) return b.steps[i]; return null; };
    function share(budget) {
      var R = 0, M = 0;
      bs.forEach(function (b) { R += b.route; M += b.max; });
      var want = bs.map(function (b) { return budget <= R ? (R ? budget * b.route / R : 0) : b.route + (budget - R) * (b.max - b.route) / ((M - R) || 1); });
      var got = bs.map(function (b, i) { return at(b, want[i]); });
      var left = budget - got.reduce(function (x, y) { return x + y; }, 0);
      for (;;) {
        var best = -1, bestRatio = Infinity;
        bs.forEach(function (b, i) {
          var n = next(b, got[i]);
          if (n === null || n - got[i] > left) return;
          var ratio = want[i] ? got[i] / want[i] : Infinity;
          if (ratio < bestRatio) { bestRatio = ratio; best = i; }
        });
        if (best < 0) break;
        var n = next(bs[best], got[best]); left -= n - got[best]; got[best] = n;
      }
      return got;
    }
    function showTotal(v) {
      if (!tR) return;
      tR.value = v; tR.style.setProperty('--p', (+tR.value / +tR.max * 100) + '%');
      if (document.activeElement !== tN) tN.value = v;
      tReset.disabled = +v === +tReset.getAttribute('data-dvb-total-reset');
    }
    function setTotal(v) {
      v = Math.max(0, Math.min(+tR.max, Math.round(+v) || 0));
      share(v).forEach(function (s, i) { setBoard(bs[i].panel, s); });
      showTotal(v);
    }
    if (tR) {
      tR.addEventListener('input', function () { setTotal(tR.value); });
      tN.addEventListener('input', function () { if (tN.value !== '') setTotal(tN.value); });
      tN.addEventListener('change', function () { setTotal(tN.value); tN.value = tR.value; });
      tReset.addEventListener('click', function () { setTotal(tReset.getAttribute('data-dvb-total-reset')); tR.focus(); });
      // a board moved by hand: the budget becomes the sum of the boards
      bs.forEach(function (b) {
        var sync = function () { showTotal(bs.reduce(function (x, y) { return x + +y.range.value; }, 0)); };
        b.range.addEventListener('input', sync);
        var r = b.panel.querySelector('[data-dvb-reset]');
        if (r) r.addEventListener('click', function () { setTimeout(sync, 0); });
      });
      showTotal(+tR.value);
    }
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
  document.addEventListener('a2-sections', function () { buildToc(); });
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
    if (stOnMode) stOnMode();
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

  // ---- backend build only: anonymous guide statistics - which mode is opened and how far each section is read
  // (a section counts once its heading reaches the upper part of the screen). The server keeps a salted visitor hash
  // per day and key, like page views; sent in small batches, the last one when the tab is hidden.
  var stOnMode = null;
  if (root.dataset.api && root.dataset.page) {
    var stUrl = root.dataset.api + '/stat', stPage = root.dataset.page.replace(/\/$/, '').replace(/\//g, '-');
    var stSend = function (kind, keys) {
      if (!keys.length) return;
      var body = JSON.stringify({ kind: kind, keys: keys });
      try { if (navigator.sendBeacon && navigator.sendBeacon(stUrl, new Blob([body], { type: 'application/json' }))) return; } catch (e) {}
      fetch(stUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    };
    var stModes = {}, stSeen = {}, stQueue = [];
    var stFlush = function () { if (stQueue.length) { stSend('reach', stQueue); stQueue = []; } };
    var stObs = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var sec = e.target.closest('.g-section'), k = sec && sec.dataset.stKey;
        if (e.isIntersecting && k && !stSeen[k]) { stSeen[k] = 1; stQueue.push(k); }
      });
    }, { rootMargin: '0px 0px -40% 0px' }) : null;
    stOnMode = function () {
      var m = root.dataset.mode;
      if (document.querySelector('.mode-switch') && !stModes[m]) { stModes[m] = 1; stSend('mode', [stPage + ':' + m]); }
      if (!stObs) return;
      stFlush();
      stObs.disconnect();
      visibleSections().forEach(function (s, i) {
        s.dataset.stKey = stPage + ':' + m + ':' + (i + 1) + '-' + s.id;
        stObs.observe(s.querySelector('h2') || s);
      });
    };
    stOnMode();
    setInterval(stFlush, 15000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') stFlush(); });
    window.addEventListener('pagehide', stFlush);
  }
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
    var renderTracker = function () {
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
        renderTracker();
      });
    });
    tracker.querySelector('.tracker-reset').addEventListener('click', function (e) {
      var b = e.currentTarget;
      window.A2Confirm({ title: b.textContent.trim(), text: b.dataset.confirm, ok: b.textContent.trim(), danger: true }, function () {
        done = {};
        store(key, '{}');
        renderTracker();
      });
    });
    renderTracker();
  }
})();
