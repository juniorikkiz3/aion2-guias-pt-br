// Browser notifications for the trackers (Odyle energy full, a world boss may be up).
// They are timers inside the open tab — no server, no push — so they only fire while the page is open.
// A `.notify-toggle` button on the page turns them on (asks for permission) and off.
(function () {
  'use strict';
  var KEY = 'notify-on';
  var supported = 'Notification' in window;
  var timers = {};

  function store(v) {
    try { if (v === undefined) return localStorage.getItem(KEY); localStorage.setItem(KEY, v); } catch (e) { return null; }
  }
  function enabled() { return supported && store() === '1' && Notification.permission === 'granted'; }

  // Fire `title` at time `at` (ms); calling again with the same key replaces the old timer.
  function schedule(key, at, title, body) {
    cancel(key);
    if (!enabled()) return;
    var ms = at - Date.now();
    if (ms <= 0 || ms > 2147483000) return;
    timers[key] = setTimeout(function () {
      delete timers[key];
      if (!enabled()) return;
      try { new Notification(title, { body: body || '', tag: key, icon: document.querySelector('link[rel="icon"]').href }); } catch (e) {}
    }, ms);
  }
  function cancel(key) { if (timers[key]) { clearTimeout(timers[key]); delete timers[key]; } }
  function cancelAll() { Object.keys(timers).forEach(cancel); }

  var listeners = [];
  function onChange(fn) { listeners.push(fn); }

  function paint(btn) {
    var state = !supported ? 'unsupported' : Notification.permission === 'denied' ? 'denied' : enabled() ? 'on' : 'off';
    btn.dataset.state = state;
    btn.setAttribute('aria-pressed', String(state === 'on'));
    btn.querySelector('.notify-label').textContent = btn.dataset['t' + state.charAt(0).toUpperCase() + state.slice(1)];
    btn.disabled = state === 'unsupported' || state === 'denied';
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.notify-toggle').forEach(function (btn) {
      paint(btn);
      btn.addEventListener('click', function () {
        if (enabled()) { store('0'); cancelAll(); paint(btn); listeners.forEach(function (f) { f(false); }); return; }
        Notification.requestPermission().then(function (p) {
          store(p === 'granted' ? '1' : '0');
          paint(btn);
          listeners.forEach(function (f) { f(enabled()); });
        });
      });
    });
  });

  window.A2Notify = { enabled: enabled, schedule: schedule, cancel: cancel, onChange: onChange };
})();
