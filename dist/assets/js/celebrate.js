// Founder's Early Access celebration (site.json events[].celebrate).
// At the event time — for visitors already on the site and for anyone who arrives within the next 24 h —
// the site celebrates once per visitor: a banner, confetti, fireworks, falling feathers and, on the home page,
// a gold ribbon across the screen. Afterwards only the "opened" card in the launch panel stays.
// With reduced motion only the banner is shown. Add ?celebrate=1 to any URL to preview it.
(function () {
  'use strict';
  var banner = document.querySelector('.cel-banner');
  if (!banner) return;
  var AT = Date.parse(banner.dataset.at);
  // the start time is part of the key: if the event is moved, those who saw the party at the old time see it again at the real one
  var KEY = 'celebrated-' + banner.dataset.id + '-' + banner.dataset.at;
  var WINDOW = 24 * 36e5;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var force = /[?&]celebrate=1\b/.test(location.search);
  function store(v) { try { if (v === undefined) return localStorage.getItem(KEY); localStorage.setItem(KEY, v); } catch (e) { return null; } }

  // ---- the launch panel card turns into "opened" once the time has come (home page) ----
  function openCards() {
    document.querySelectorAll('.ev[data-celebrate]').forEach(function (li) { li.classList.add('is-open'); });
  }

  // ---- particles --------------------------------------------------------------------
  var cv, ctx, W, H, parts = [], rockets = [], raf = 0, until = 0, feathersUntil = 0;
  var GOLD = ['#f3d48a', '#ffe9b3', '#d9b36c', '#fff6d8', '#c99a45'];
  var MIX = ['#f3d48a', '#ef6a6f', '#4fd09a', '#72a8ff', '#b98cff', '#5fd0e8', '#ff86d2', '#ffe9b3'];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'cel-canvas';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var size = function () { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener('resize', size);
  }
  function loop() {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    var now = performance.now();
    if (now < feathersUntil && Math.random() < 0.25) {
      parts.push({ k: 'feather', x: rnd(0, W), y: -20, vx: rnd(-0.4, 0.4), vy: rnd(0.6, 1.3), g: 0, rot: rnd(0, 6), vr: rnd(-0.03, 0.03),
        c: pick(['#ffffff', '#fff6d8', '#f3d48a']), life: 900, max: 900 });
    }
    rockets = rockets.filter(function (r) {
      r.x += r.vx; r.y += r.vy; r.vy += 0.05;
      ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 6.28); ctx.fill();
      parts.push({ k: 'spark', x: r.x, y: r.y, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.6), g: 0, life: 22, max: 22, c: '#ffe9b3', r: 1.3 });
      if (r.vy >= -0.5) { burst(r.x, r.y, r.c); return false; }
      return true;
    });
    parts = parts.filter(function (p) {
      p.life--;
      if (p.life <= 0) return false;
      p.vy += p.g; if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.x += p.vx; p.y += p.vy;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.3));
      ctx.translate(p.x, p.y);
      if (p.k === 'conf') {
        p.rot += p.vr; ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.k === 'feather') {
        p.rot += p.vr; p.x += Math.sin(p.life / 20) * 0.6; ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.shadowColor = '#fff3c4'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 11, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(150,120,60,.6)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 15); ctx.stroke();
      } else {
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.28); ctx.fill();
      }
      ctx.restore();
      return p.y < H + 40;
    });
    if (parts.length || rockets.length || now < until || now < feathersUntil) raf = requestAnimationFrame(loop);
    else { cv.remove(); cv = null; }
  }
  function kick() { canvas(); if (!raf) raf = requestAnimationFrame(loop); }
  function confetti(n) {
    for (var i = 0; i < n; i++) {
      var left = i % 2 === 0;
      parts.push({ k: 'conf', x: left ? -10 : W + 10, y: H * rnd(0.55, 0.8), vx: (left ? 1 : -1) * rnd(6, 13), vy: rnd(-14, -7), g: 0.28, drag: 0.985,
        w: rnd(6, 10), h: rnd(8, 14), rot: rnd(0, 6), vr: rnd(-0.25, 0.25), c: pick(MIX), life: rnd(160, 240), max: 240 });
    }
  }
  function burst(x, y, c) {
    var n = 70, col = [c, pick(GOLD), '#ffffff'];
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.28, s = rnd(1.5, 4.2);
      parts.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.045, drag: 0.985, r: rnd(1.2, 2.2), c: pick(col), life: rnd(60, 95), max: 95 });
    }
  }
  function fireworks(count, delay) {
    for (var i = 0; i < count; i++) (function (i) {
      setTimeout(function () {
        rockets.push({ x: rnd(W * 0.15, W * 0.85), y: H + 10, vx: rnd(-1, 1), vy: rnd(-11, -8.5), c: pick(MIX) });
        kick();
      }, delay + i * 450);
    })(i);
    until = Math.max(until, performance.now() + delay + count * 450 + 3000);
  }

  // ---- the celebration itself ------------------------------------------------------------
  function celebrate() {
    openCards();
    store('1');
    banner.hidden = false;
    setTimeout(function () { banner.classList.add('is-on'); }, 30);
    setTimeout(hideBanner, 10000);
    if (calm) return;
    var ribbon = document.querySelector('.cel-ribbon'), h1 = document.querySelector('.home-hero h1');
    if (ribbon) ribbon.classList.add('is-on');
    if (h1) h1.classList.add('cel-glow');
    setTimeout(function () {
      if (ribbon) ribbon.classList.remove('is-on');
      if (h1) h1.classList.remove('cel-glow');
    }, 16000);
    canvas();
    confetti(160);
    fireworks(9, 700);
    feathersUntil = performance.now() + 9000;
    kick();
  }
  function hideBanner() {
    banner.classList.remove('is-on');
    setTimeout(function () { if (!banner.classList.contains('is-on')) banner.hidden = true; }, 800);
  }
  banner.querySelector('.cel-x').addEventListener('click', hideBanner);

  var now = Date.now();
  if (force) { celebrate(); return; }
  if (now >= AT) {
    openCards();
    if (now < AT + WINDOW && !store()) setTimeout(celebrate, 300);
  } else if (AT - now < 2147483000) {
    // Someone is on the site when the servers open.
    setTimeout(function () { if (!store()) celebrate(); else openCards(); }, AT - now);
  }
})();
