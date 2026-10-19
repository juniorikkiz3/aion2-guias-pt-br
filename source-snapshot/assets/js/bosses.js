// World bosses: mark a kill, remember it in this browser, show when the boss can be up again
// (only for bosses whose respawn is known — data/bosses.json respawn_min).
(function () {
  'use strict';
  var page = document.querySelector('.bs-page');
  if (!page) return;
  var KEY = 'aion2-bosses-v1';
  var kills = {};
  try { kills = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { kills = {}; }
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(kills)); } catch (e) {} };
  // Per-boss notification switch: every boss is on by default, `muted` keeps the ones switched off.
  var MUTE = 'aion2-bosses-muted-v1';
  var muted = {};
  try { muted = JSON.parse(localStorage.getItem(MUTE) || '{}') || {}; } catch (e) { muted = {}; }
  var saveMuted = function () { try { localStorage.setItem(MUTE, JSON.stringify(muted)); } catch (e) {} };

  var locale = ({ ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR', ja: 'ja-JP' })[page.dataset.lang] || 'en-GB';
  var time = new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var left = function (ms) {
    var m = Math.ceil(ms / 6e4);
    return Math.floor(m / 60) + ':' + pad(m % 60);
  };

  var items = [].slice.call(page.querySelectorAll('.bs-item'));
  function render() {
    var now = Date.now();
    var global = !!(window.A2Notify && window.A2Notify.enabled());
    items.forEach(function (li) {
      var bell = li.querySelector('.bs-bell');
      bell.setAttribute('aria-pressed', String(!muted[li.dataset.id]));
      bell.classList.toggle('is-idle', !global);
      var at = kills[li.dataset.id];
      var status = li.querySelector('.bs-status');
      li.querySelector('.bs-undo').hidden = !at;
      li.classList.remove('is-dead', 'is-up');
      if (!at) { status.textContent = ''; if (window.A2Notify) window.A2Notify.cancel('boss-' + li.dataset.id); return; }
      var text = page.dataset.tKilled + ' ' + time.format(at);
      var respawn = +li.dataset.respawn || 0;
      if (respawn) {
        var next = at + respawn * 6e4;
        if (window.A2Notify && muted[li.dataset.id]) window.A2Notify.cancel('boss-' + li.dataset.id);
        else if (window.A2Notify) {
          window.A2Notify.schedule('boss-' + li.dataset.id, next,
            page.dataset.tNotify.replace('{name}', li.querySelector('.bs-name').textContent),
            li.querySelector('.bs-zone').textContent);
        }
        if (next > now) { li.classList.add('is-dead'); text += ' · ' + page.dataset.tNext + ' ' + time.format(next) + ' (' + left(next - now) + ')'; }
        else { li.classList.add('is-up'); text += ' · ' + page.dataset.tUp; }
      }
      status.textContent = text;
    });
  }
  items.forEach(function (li) {
    li.querySelector('.bs-kill').addEventListener('click', function () { kills[li.dataset.id] = Date.now(); save(); render(); });
    li.querySelector('.bs-undo').addEventListener('click', function () { delete kills[li.dataset.id]; save(); render(); });
    li.querySelector('.bs-bell').addEventListener('click', function () {
      var id = li.dataset.id;
      // With notifications off for the whole page, the bell turns this boss on and asks for them.
      if (window.A2Notify && !window.A2Notify.enabled()) {
        delete muted[id]; saveMuted(); render();
        var all = page.querySelector('.notify-toggle');
        if (all && !all.disabled) all.click();
        return;
      }
      if (muted[id]) delete muted[id]; else muted[id] = 1;
      saveMuted(); render();
    });
  });
  render();
  setInterval(render, 30000);
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.A2Notify) return;
    window.A2Notify.onChange(render);
    render();
  });
})();
