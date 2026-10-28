/*
 * price-duel.js - игра «дороже или дешевле» на странице /play/price-duel/.
 * Данные - /play/price-duel/models.json (собирает scripts/build-price-duel.mjs).
 * Игра начинается сразу при открытии страницы. Лучшая серия - в localStorage.
 * События GA4: game_start, game_guess, game_over, game_open_model.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = $('pd-game');
  if (!root) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var M = [], a, b, streak = 0, best = 0, busy = false, used = {}, usedN = 0, rounds = 0;

  function track(name, params) {
    try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {}
  }
  try { best = +localStorage.getItem('priceDuelBest') || 0; } catch (e) {}

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // Следующая модель: не повторяется, пока не пройден почти весь набор, и по
  // возможности с другой ценой, чтобы у раунда был настоящий ответ
  function pick(avoid) {
    var m;
    for (var t = 0; t < 30; t++) {
      m = M[Math.floor(Math.random() * M.length)];
      if (used[m.s]) continue;
      if (avoid && m.p === avoid.p && t < 20) continue;
      break;
    }
    if (!used[m.s]) { used[m.s] = 1; usedN++; }
    if (usedN > M.length - 5) { used = {}; used[m.s] = 1; usedN = 1; }
    return m;
  }

  function render(el, m, hidden) {
    el.className = 'pd-card pd-in';
    el.innerHTML =
      '<a class="pd-shot" href="/models/' + m.s + '/" data-slug="' + m.s + '">' +
        '<img src="/previews/' + m.s + '.webp" alt="' + esc(m.n) + ' 3D model" width="400" height="225" decoding="async">' +
        '<span class="pd-cat">' + esc(m.c) + '</span></a>' +
      '<div class="pd-meta"><h2 class="pd-name"><a href="/models/' + m.s + '/" data-slug="' + m.s + '">' + esc(m.n) + '</a></h2>' +
        '<div class="pd-price' + (hidden ? ' pd-hidden' : '') + '">' + (hidden ? '$ ???' : '$' + m.p) + '</div></div>';
  }

  function countUp(el, to, done) {
    el.classList.remove('pd-hidden');
    if (reduce) { el.textContent = '$' + to; return done(); }
    var t0 = performance.now(), dur = 600;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = '$' + Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else done();
    })(t0);
  }

  function score() {
    $('pd-streak').textContent = streak;
    $('pd-best').textContent = best;
  }

  function setButtons(on) {
    $('pd-hi').disabled = $('pd-lo').disabled = !on;
  }

  function guess(up) {
    if (busy || !a || !$('pd-over').hidden) return;
    busy = true;
    setButtons(false);
    var ok = b.p === a.p || (up ? b.p > a.p : b.p < a.p);
    rounds++;
    track('game_guess', { game_name: 'price_duel', correct: ok, streak: streak });
    countUp($('pd-b').querySelector('.pd-price'), b.p, function () {
      $('pd-b').classList.add(ok ? 'pd-win' : 'pd-lose');
      if (ok) {
        streak++;
        if (streak > best) { best = streak; try { localStorage.setItem('priceDuelBest', best); } catch (e) {} }
        score();
        setTimeout(function () {
          a = b; b = pick(a);
          render($('pd-a'), a, false); render($('pd-b'), b, true);
          busy = false; setButtons(true);
        }, reduce ? 300 : 900);
      } else {
        var diff = Math.abs(b.p - a.p);
        $('pd-over-title').textContent = streak ? 'Run over at ' + streak : 'Missed the first one';
        $('pd-over-text').innerHTML = '<a href="/models/' + b.s + '/" data-slug="' + b.s + '">' + esc(b.n) + '</a> costs $' + b.p +
          ', which is $' + diff + (b.p > a.p ? ' more' : ' less') + ' than <a href="/models/' + a.s + '/" data-slug="' + a.s + '">' + esc(a.n) +
          '</a>. Your best streak: ' + best + '.';
        $('pd-over').hidden = false;
        $('pd-controls').hidden = true;
        track('game_over', { game_name: 'price_duel', score: streak, rounds: rounds });
        $('pd-again').focus();
        busy = false;
      }
    });
  }

  function start() {
    used = {}; usedN = 0; streak = 0; rounds = 0;
    a = pick(); b = pick(a);
    render($('pd-a'), a, false); render($('pd-b'), b, true);
    $('pd-loading').hidden = true;
    $('pd-over').hidden = true; $('pd-controls').hidden = false;
    busy = false; setButtons(true);
    score();
    track('game_start', { game_name: 'price_duel' });
  }

  $('pd-hi').addEventListener('click', function () { guess(true); });
  $('pd-lo').addEventListener('click', function () { guess(false); });
  $('pd-again').addEventListener('click', start);
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowUp') { e.preventDefault(); guess(true); }
    if (e.key === 'ArrowDown') { e.preventDefault(); guess(false); }
  });
  root.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('a[data-slug]');
    if (l) track('game_open_model', { game_name: 'price_duel', model: l.getAttribute('data-slug') });
  });

  score();
  fetch('/play/price-duel/models.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { M = data; start(); })
    .catch(function () {
      $('pd-loading').textContent = 'The game could not load its models. Reload the page to try again.';
    });
})();
