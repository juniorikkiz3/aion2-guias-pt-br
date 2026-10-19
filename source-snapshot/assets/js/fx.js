// Ambient effects: drifting particles in the home and class heroes (canvas, one loop per hero,
// paused while the tab is hidden or the hero is off screen) and blocks that fade in on scroll.
// Everything is skipped when the visitor prefers reduced motion.
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- particle presets: one or more layers per hero (data-fx on the hero) ----------------------
  var PRESETS = {
    aether:    [{ n: 55, color: ['#f3d48a', '#ffe9b3', '#d9b36c'], shape: 'spark', vy: [-0.25, -0.7], vx: [-0.15, 0.15], r: [0.8, 2.2], from: 'bottom' }],
    gladiator: [{ n: 60, color: ['#ff7a45', '#ffb36b', '#e8433a'], shape: 'spark', vy: [-0.5, -1.3], vx: [-0.3, 0.3], r: [0.8, 2.2], from: 'bottom', flicker: true }],
    ranger:    [{ n: 22, color: ['#6fd49a', '#a7e07a', '#3fa06a'], shape: 'leaf', vy: [0.3, 0.8], vx: [0.4, 1.1], r: [3, 5.5], from: 'top', spin: true }],
    templar:   [{ n: 45, color: ['#cfe0ff', '#ffffff', '#9dbcff'], shape: 'spark', vy: [-0.15, -0.45], vx: [-0.1, 0.1], r: [1, 2.6], from: 'bottom', glow: true }],
    assassin:  [{ n: 14, color: ['rgba(150,90,230,', 'rgba(110,60,190,'], shape: 'smoke', vy: [-0.1, -0.3], vx: [-0.2, 0.2], r: [40, 90], from: 'bottom' }],
    chanter:   [{ n: 26, color: ['#f2c46b', '#ffd98f', '#e0a33c'], shape: 'rune', vy: [-0.2, -0.5], vx: [-0.1, 0.1], r: [3, 5], from: 'bottom', spin: true }],
    sorcerer:  [{ n: 30, color: ['#ff8a3d', '#ffc36b'], shape: 'spark', vy: [-0.5, -1.1], vx: [-0.2, 0.2], r: [0.8, 2], from: 'bottom', flicker: true },
                { n: 30, color: ['#bfefff', '#ffffff', '#7fd8f0'], shape: 'flake', vy: [0.3, 0.8], vx: [-0.25, 0.25], r: [1.5, 3], from: 'top', spin: true }],
    cleric:    [{ n: 40, color: ['#fff6d6', '#ffe9a8', '#ffffff'], shape: 'spark', vy: [-0.15, -0.4], vx: [-0.08, 0.08], r: [1, 2.6], from: 'bottom', glow: true },
                { n: 7, color: ['#ffffff', '#f4ecd8'], shape: 'feather', vy: [0.25, 0.5], vx: [-0.3, 0.3], r: [6, 9], from: 'top', spin: true }],
    elementalist: [{ n: 8, color: ['#ff8a3d'], shape: 'orb', vy: [-0.15, -0.35], vx: [-0.25, 0.25], r: [3, 5], from: 'bottom' },
                   { n: 8, color: ['#6fc6ff'], shape: 'orb', vy: [-0.15, -0.35], vx: [-0.25, 0.25], r: [3, 5], from: 'bottom' },
                   { n: 8, color: ['#8ff0a4'], shape: 'orb', vy: [-0.15, -0.35], vx: [-0.25, 0.25], r: [3, 5], from: 'bottom' },
                   { n: 8, color: ['#d9a86a'], shape: 'orb', vy: [-0.15, -0.35], vx: [-0.25, 0.25], r: [3, 5], from: 'bottom' }]
  };
  function rnd(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function Field(host, layers) {
    var canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    var art = host.querySelector('.home-hero-art, .class-hero-art');
    host.insertBefore(canvas, art ? art.nextSibling : host.firstChild);
    var ctx = canvas.getContext('2d'), parts = [], w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var running = false, raf = 0, last = 0;

    function size() {
      w = host.clientWidth; h = host.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, anywhere) {
      return { p: p, x: Math.random() * w, y: anywhere ? Math.random() * h : (p.from === 'top' ? -10 : h + 10),
        vx: rnd(p.vx), vy: rnd(p.vy), r: rnd(p.r), c: pick(p.color), a: Math.random() * 6.28,
        va: (Math.random() - 0.5) * 0.04, t: Math.random() * 6.28, o: 0 };
    }
    function draw(q, alpha) {
      var p = q.p;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.globalAlpha = alpha;
      if (p.shape === 'spark') {
        ctx.fillStyle = q.c; ctx.shadowColor = q.c; ctx.shadowBlur = p.glow ? 12 : 6;
        ctx.beginPath(); ctx.arc(0, 0, q.r, 0, 6.28); ctx.fill();
      } else if (p.shape === 'leaf') {
        ctx.fillStyle = q.c; ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.8, q.r * 0.8, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-q.r * 1.6, 0); ctx.lineTo(q.r * 1.6, 0); ctx.stroke();
      } else if (p.shape === 'flake') {
        ctx.strokeStyle = q.c; ctx.lineWidth = 1; ctx.shadowColor = q.c; ctx.shadowBlur = 6;
        for (var k = 0; k < 3; k++) { ctx.rotate(1.047); ctx.beginPath(); ctx.moveTo(-q.r, 0); ctx.lineTo(q.r, 0); ctx.stroke(); }
      } else if (p.shape === 'rune') {
        ctx.strokeStyle = q.c; ctx.lineWidth = 1.2; ctx.shadowColor = q.c; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, -q.r); ctx.lineTo(q.r * 0.8, 0); ctx.lineTo(0, q.r); ctx.lineTo(-q.r * 0.8, 0); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -q.r * 0.5); ctx.lineTo(0, q.r * 0.5); ctx.stroke();
      } else if (p.shape === 'feather') {
        ctx.fillStyle = q.c; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(0, 0, q.r * 0.45, q.r * 1.6, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(160,140,100,.6)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(0, -q.r * 1.6); ctx.lineTo(0, q.r * 2.1); ctx.stroke();
      } else if (p.shape === 'orb') {
        var og = ctx.createRadialGradient(0, 0, 0, 0, 0, q.r * 4);
        og.addColorStop(0, '#fff'); og.addColorStop(0.18, q.c); og.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, q.r * 4, 0, 6.28); ctx.fill();
      } else if (p.shape === 'smoke') {
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, q.r);
        g.addColorStop(0, q.c + '.16)'); g.addColorStop(1, q.c + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, q.r, 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }
    function frame(ts) {
      raf = 0;
      if (!running) return;
      var dt = Math.min(3, (ts - last) / 16.7 || 1); last = ts;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var q = parts[i];
        q.x += (q.vx + Math.sin(q.t) * 0.15) * dt; q.y += q.vy * dt; q.t += 0.02 * dt;
        if (q.p.spin) q.a += q.va * dt;
        q.o = Math.min(1, q.o + 0.01 * dt);
        // fade out towards the edge the particle is heading for
        var edge = q.vy < 0 ? q.y / (h * 0.35) : (h - q.y) / (h * 0.35);
        var alpha = Math.min(q.o, Math.max(0, edge)) * (q.p.flicker ? 0.6 + 0.4 * Math.sin(q.t * 3) : 1);
        draw(q, alpha);
        if (q.y < -40 || q.y > h + 40 || q.x < -60 || q.x > w + 60) parts[i] = spawn(q.p, false);
      }
      raf = requestAnimationFrame(frame);
    }
    // Only one loop may run: a frame still queued from before a stop would otherwise start a second one (double speed).
    this.start = function () { if (running) return; running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); };
    this.stop = function () { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    size();
    layers.forEach(function (p) { for (var i = 0; i < p.n; i++) parts.push(spawn(p, true)); });
    var resizeTimer = 0;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(size, 150); });
  }

  var fields = [];
  document.querySelectorAll('[data-fx]').forEach(function (host) {
    var layers = PRESETS[host.dataset.fx];
    if (!layers) return;
    var f = new Field(host, layers);
    f.visible = true;
    fields.push(f);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { f.visible = es[0].isIntersecting; sync(); }).observe(host);
    }
  });
  function sync() {
    var shown = document.visibilityState === 'visible';
    fields.forEach(function (f) { if (shown && f.visible) f.start(); else f.stop(); });
  }
  document.addEventListener('visibilitychange', sync);
  sync();

  // ---- guide blocks fade in when they scroll into view ---------------------------------------
  if (!('IntersectionObserver' in window)) return;
  var blocks = document.querySelectorAll('.guide .skill, .guide .hotline, .guide .callout, .guide .table-wrap, .guide .step, .guide .glance-card, .guide .presslist li');
  if (!blocks.length) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add('rv-in');
      io.unobserve(el);
      // back to the normal hover transitions once the reveal is done
      setTimeout(function () { el.classList.remove('rv', 'rv-in'); el.style.transitionDelay = ''; }, 900);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  var vh = window.innerHeight;
  blocks.forEach(function (el) {
    // Blocks already on screen at load stay as they are; the ones further down (or in another mode) fade in.
    if (el.offsetParent && el.getBoundingClientRect().top < vh) return;
    var i = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = (i % 3) * 70 + 'ms';
    el.classList.add('rv');
    io.observe(el);
  });
})();
