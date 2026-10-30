/* Jigsaw Puzzle: рендер модели каталога режется на фигурные детали (ушки и выемки),
   детали рассыпаны вокруг поля, игрок перетаскивает их, деталь защёлкивается на своём месте.
   Всё рисуется на одном холсте «стола»; у каждой детали своя заранее нарисованная картинка.
   Данные - /play/jigsaw-puzzle/puzzles.json (собирает scripts/build-jigsaw.mjs).
   Финал - общий модуль game-finale.js. События GA4: game_start, game_over, game_hint, game_open_model. */
(function () {
  'use strict';
  var BASE = '/play/jigsaw-puzzle/';
  var LEVELS = {
    easy: { name: 'Easy', cols: 4, rows: 3 },
    medium: { name: 'Medium', cols: 6, rows: 4 },
    hard: { name: 'Hard', cols: 8, rows: 6 },
    expert: { name: 'Expert', cols: 12, rows: 9 }
  };
  var ORDER = ['easy', 'medium', 'hard', 'expert'];
  var BW = 960, BH = 720;               // поле в логических единицах (картинка 4:3)
  var TW, TH, BX, BY;                   // стол и левый верхний угол поля
  var Q = 1.6;                          // запас резкости у картинок деталей

  var $ = function (id) { return document.getElementById(id); };
  var cv = $('jg-canvas'), ctx = cv.getContext('2d');
  var hit = document.createElement('canvas').getContext('2d');
  var timeEl = $('jg-time'), countEl = $('jg-count'), loading = $('jg-loading');
  var data = [], cur = null, img = null, level = 'medium', pieces = [], placed = 0;
  var t0 = 0, timer = null, done = false, peeks = 0, ghost = false, peekOn = false, gen = 0, dpr = 1;
  var drag = null, raf = 0;

  try { if (LEVELS[localStorage.getItem('jg-level')]) level = localStorage.getItem('jg-level'); } catch (e) {}

  function ga(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function elapsed() { return Math.floor((Date.now() - t0) / 1000); }
  function tick() { timeEl.textContent = fmt(elapsed()); }
  function modelHref(x) { return x.s ? '/models/' + x.s + '/' : x.u; }

  // Стол: на компьютере поле в середине, детали по бокам; на телефоне поле сверху, детали снизу
  function sizeTable() {
    var phone = cv.parentElement.clientWidth < 700;
    if (phone) { TW = 1000; TH = 1560; BX = 20; BY = 20; }
    else { TW = 1680; TH = 1000; BX = (TW - BW) / 2; BY = (TH - BH) / 2; }
    dpr = Math.min(2, window.devicePixelRatio || 1);
    // на компьютере стол не выше окна (за вычетом шапки), на телефоне - по ширине экрана
    var cssW = cv.parentElement.clientWidth;
    if (!phone) cssW = Math.min(cssW, Math.max(640, (window.innerHeight - 90) * TW / TH));
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssW * TH / TW * dpr);
    cv.style.width = Math.round(cssW) + 'px';
    cv.style.height = Math.round(cssW * TH / TW) + 'px';
    return phone;
  }

  // Край детали от P0 до P1; s = +1 ушко наружу, -1 выемка, 0 прямой край. T - размер ушка.
  function edge(p, x0, y0, x1, y1, s, T) {
    var len = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / len, dy = (y1 - y0) / len, nx = dy, ny = -dx;
    function P(u, v) { return [x0 + dx * u * len + nx * v * T * s, y0 + dy * u * len + ny * v * T * s]; }
    if (!s) { p.lineTo(x1, y1); return; }
    var a;
    a = P(0.34, 0); p.lineTo(a[0], a[1]);
    var c = [[0.42, 0.02, 0.40, 0.10, 0.36, 0.14], [0.30, 0.24, 0.40, 0.30, 0.50, 0.30], [0.60, 0.30, 0.70, 0.24, 0.64, 0.14], [0.60, 0.10, 0.58, 0.02, 0.66, 0]];
    c.forEach(function (k) { var q1 = P(k[0], k[1]), q2 = P(k[2], k[3]), q3 = P(k[4], k[5]); p.bezierCurveTo(q1[0], q1[1], q2[0], q2[1], q3[0], q3[1]); });
    p.lineTo(x1, y1);
  }
  function piecePath(pc, w, h, T) {
    var p = new Path2D();
    p.moveTo(0, 0);
    edge(p, 0, 0, w, 0, pc.e[0], T);   // верх
    edge(p, w, 0, w, h, pc.e[1], T);   // право
    edge(p, w, h, 0, h, pc.e[2], T);   // низ
    edge(p, 0, h, 0, 0, pc.e[3], T);   // лево
    p.closePath();
    return p;
  }

  function cut() {
    var L = LEVELS[level], cols = L.cols, rows = L.rows, w = BW / cols, h = BH / rows;
    var T = Math.min(w, h), pad = Math.ceil(T * 0.34);
    // знак ушка на каждом внутреннем шве: соседние детали получают противоположные
    var hz = [], vt = [];
    for (var r = 0; r < rows; r++) { hz.push([]); vt.push([]); for (var c = 0; c < cols; c++) { hz[r].push(Math.random() < 0.5 ? 1 : -1); vt[r].push(Math.random() < 0.5 ? 1 : -1); } }
    var list = [];
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var pc = {
        r: r, c: c, w: w, h: h, pad: pad, done: false,
        e: [r === 0 ? 0 : -hz[r - 1][c], c === cols - 1 ? 0 : vt[r][c], r === rows - 1 ? 0 : hz[r][c], c === 0 ? 0 : -vt[r][c - 1]],
        tx: BX + c * w, ty: BY + r * h
      };
      pc.path = piecePath(pc, w, h, T);
      // картинка детали: фрагмент рендера внутри контура + тонкая обводка
      var cw = Math.ceil((w + 2 * pad) * Q), ch = Math.ceil((h + 2 * pad) * Q);
      var can = document.createElement('canvas'); can.width = cw; can.height = ch;
      var x = can.getContext('2d');
      x.scale(Q, Q); x.translate(pad, pad);
      x.save(); x.clip(pc.path);
      x.drawImage(img, -c * w, -r * h, BW, BH);
      x.restore();
      x.lineWidth = 1.4; x.strokeStyle = 'rgba(0,0,0,.45)'; x.stroke(pc.path);
      x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,.35)'; x.translate(0.8, 0.8); x.stroke(pc.path);
      pc.img = can;
      list.push(pc);
    }
    return list;
  }

  // Россыпь: вокруг поля, не на нём
  function scatter(phone) {
    pieces.forEach(function (pc) {
      var w = pc.w, h = pc.h, x, y, t = 0;
      do {
        if (phone) { x = rnd(10, TW - w - 10); y = rnd(BY + BH + 30, TH - h - 10); }
        else {
          var left = Math.random() < 0.5;
          x = left ? rnd(10, BX - w - 10) : rnd(BX + BW + 10, TW - w - 10);
          y = rnd(10, TH - h - 10);
          if (BX - w - 20 < 10) { x = rnd(10, TW - w - 10); y = Math.random() < 0.5 ? rnd(5, Math.max(6, BY - h)) : rnd(BY + BH, TH - h - 5); }
        }
      } while (++t < 5 && x < BX + BW && x + w > BX && y < BY + BH && y + h > BY);
      pc.x = x; pc.y = y;
    });
    // порядок слоёв случайный
    pieces.sort(function () { return Math.random() - 0.5; });
  }

  function draw() {
    raf = 0;
    var k = cv.width / TW;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#e9e3d8'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // поле
    ctx.fillStyle = '#f7f4ee'; ctx.fillRect(BX, BY, BW, BH);
    if (img && (ghost || peekOn)) { ctx.globalAlpha = peekOn ? 1 : 0.18; ctx.drawImage(img, BX, BY, BW, BH); ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.strokeRect(BX - 1, BY - 1, BW + 2, BH + 2);
    if (peekOn) return;
    // сначала уложенные, потом свободные; перетаскиваемая - последней, с тенью
    pieces.forEach(function (pc) { if (pc.done) ctx.drawImage(pc.img, pc.x - pc.pad, pc.y - pc.pad, pc.img.width / Q, pc.img.height / Q); });
    pieces.forEach(function (pc) {
      if (pc.done || (drag && drag.pc === pc)) return;
      ctx.drawImage(pc.img, pc.x - pc.pad, pc.y - pc.pad, pc.img.width / Q, pc.img.height / Q);
    });
    if (drag) {
      var pc = drag.pc;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.drawImage(pc.img, pc.x - pc.pad, pc.y - pc.pad, pc.img.width / Q, pc.img.height / Q);
      ctx.restore();
    }
  }
  function redraw() { if (!raf) raf = requestAnimationFrame(draw); }

  function tableXY(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * TW, y: (ev.clientY - r.top) / r.height * TH, k: r.width / TW };
  }
  // верхняя свободная деталь под точкой: по её контуру, а не по рамке
  function pieceAt(x, y) {
    for (var i = pieces.length - 1; i >= 0; i--) {
      var pc = pieces[i];
      if (pc.done) continue;
      if (hit.isPointInPath(pc.path, x - pc.x, y - pc.y)) return pc;
    }
    return null;
  }

  cv.addEventListener('pointerdown', function (e) {
    if (done || !pieces.length || peekOn) return;
    var p = tableXY(e), pc = pieceAt(p.x, p.y);
    if (!pc) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    pieces.splice(pieces.indexOf(pc), 1); pieces.push(pc);   // наверх
    drag = { pc: pc, dx: p.x - pc.x, dy: p.y - pc.y, id: e.pointerId };
    cv.classList.add('jg-grabbing');
    redraw();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = tableXY(e);
    if (!drag) { cv.style.cursor = !done && pieceAt(p.x, p.y) ? 'grab' : ''; return; }
    if (e.pointerId !== drag.id) return;
    drag.pc.x = Math.max(-drag.pc.w / 2, Math.min(TW - drag.pc.w / 2, p.x - drag.dx));
    drag.pc.y = Math.max(-drag.pc.h / 2, Math.min(TH - drag.pc.h / 2, p.y - drag.dy));
    redraw();
  });
  function drop(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var pc = drag.pc, p = tableXY(e);
    // защёлкивание: рядом со своим местом (на экране не меньше 22 px)
    var tol = Math.max(Math.min(pc.w, pc.h) * 0.22, 22 / p.k);
    if (Math.hypot(pc.x - pc.tx, pc.y - pc.ty) < tol) {
      pc.x = pc.tx; pc.y = pc.ty; pc.done = true; placed++;
      countEl.textContent = placed + ' / ' + pieces.length;
      if (placed === pieces.length) finish();
    }
    drag = null;
    cv.classList.remove('jg-grabbing');
    redraw();
  }
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', drop);

  function load(src) {
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
  }

  function setLevelButtons() {
    [].forEach.call(document.querySelectorAll('#jg-levels button'), function (b) { b.setAttribute('aria-pressed', b.dataset.level === level ? 'true' : 'false'); });
  }
  function setPickButtons() {
    [].forEach.call(document.querySelectorAll('#jg-pics button'), function (b) { b.setAttribute('aria-pressed', cur && b.dataset.f === cur.f ? 'true' : 'false'); });
  }

  function start(item) {
    cur = item || cur;
    var my = ++gen;
    done = false; placed = 0; peeks = 0; peekOn = false; drag = null; pieces = [];
    clearInterval(timer); setLevelButtons(); setPickButtons();
    loading.hidden = false;
    $('jg-model').innerHTML = 'This picture is a real 3D model: <a href="' + esc(modelHref(cur)) + '" target="_blank" rel="noopener" data-slug="' + esc(cur.s || cur.id) + '">' + esc(cur.n) + '</a>, $' + cur.p + ' &#8599;';
    load(BASE + 'img/' + cur.f).then(function (im) {
      if (my !== gen) return;
      if (!im) { loading.textContent = 'Could not load the picture. Try another one.'; return; }
      img = im;
      var phone = sizeTable();
      pieces = cut();
      scatter(phone);
      countEl.textContent = '0 / ' + pieces.length;
      loading.hidden = true;
      t0 = Date.now(); timer = setInterval(tick, 500); tick();
      redraw();
      ga('game_start', { game: 'jigsaw', level: level, picture: cur.s || cur.id });
    });
  }

  function finish() {
    done = true; clearInterval(timer); tick();
    var s = elapsed(), n = pieces.length, per = s / n;
    var stars = per <= 6 ? 3 : per <= 12 ? 2 : 1;
    if (peeks > 2 && stars > 1) stars--;
    var keyName = 'jg-best-' + cur.f + '-' + level, best = 0, rec = false;
    try { best = +localStorage.getItem(keyName) || 0; } catch (e) {}
    if (!best || s < best) { rec = !!best; try { localStorage.setItem(keyName, s); } catch (e) {} }
    ga('game_over', { game: 'jigsaw', level: level, seconds: s, pieces: n, peeks: peeks, stars: stars });
    redraw();
    if (!window.GameFinale) return;
    var next = ORDER[ORDER.indexOf(level) + 1];
    GameFinale.show({
      label: 'Jigsaw Puzzle · ' + LEVELS[level].name,
      title: ['', 'Puzzle solved!', 'Nice and quick!', 'Puzzle master!'][stars],
      stars: stars,
      big: fmt(s),
      sub: n + ' pieces',
      best: rec ? { text: 'New best time! Previous: ' + fmt(best), record: true } : { text: best && s > best ? 'Your best: ' + fmt(best) : 'Your first time on this puzzle' },
      chips: [cur.n + ' · $' + cur.p, peeks ? peeks + ' peek' + (peeks > 1 ? 's' : '') : 'No peeks'],
      confetti: true,
      primary: { text: 'Next puzzle', onClick: function () { start(randomOther()); } },
      secondary: { text: 'Open this 3D model', href: modelHref(cur), newTab: true, onClick: function () { ga('game_open_model', { game: 'jigsaw', model: cur.s || cur.id }); } },
      link: next ? { text: 'Try ' + LEVELS[next].name + ' (' + LEVELS[next].cols * LEVELS[next].rows + ' pieces)', onClick: function () { setLevel(next); } }
        : { text: 'Play this puzzle again', onClick: function () { start(); } }
    });
  }

  function randomOther() {
    var list = data.filter(function (x) { return x !== cur; });
    return list[Math.floor(Math.random() * list.length)];
  }
  function setLevel(l) {
    level = l;
    try { localStorage.setItem('jg-level', level); } catch (e) {}
    start();
  }

  $('jg-levels').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-level]');
    if (b && LEVELS[b.dataset.level] && cur) setLevel(b.dataset.level);
  });
  $('jg-pics').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]');
    if (!b) return;
    var it = data.filter(function (x) { return x.f === b.dataset.f; })[0];
    if (it) start(it);
  });
  $('jg-random').addEventListener('click', function () { if (data.length) start(randomOther()); });
  $('jg-restart').addEventListener('click', function () { if (cur) start(); });
  $('jg-ghost').addEventListener('change', function () { ghost = this.checked; redraw(); });
  // «Подсмотреть»: картинка целиком, пока кнопка нажата (или 2 секунды по нажатию)
  var peekBtn = $('jg-peek'), peekT = null;
  function peek(on) {
    if (done || !pieces.length) return;
    if (on && !peekOn) { peeks++; ga('game_hint', { game: 'jigsaw' }); }
    peekOn = on; clearTimeout(peekT);
    if (on) peekT = setTimeout(function () { peekOn = false; redraw(); }, 2000);
    redraw();
  }
  peekBtn.addEventListener('pointerdown', function () { peek(true); });
  peekBtn.addEventListener('pointerup', function () { peek(false); });
  peekBtn.addEventListener('pointerleave', function () { if (peekOn) peek(false); });
  peekBtn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); peek(true); } });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#jg-model a[data-slug]');
    if (a) ga('game_open_model', { game: 'jigsaw', model: a.dataset.slug });
  });
  // смена ширины окна: стол перерисовывается, детали остаются на местах в логических координатах
  var rT = null;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      if (!pieces.length) return;
      var wasPhone = TW === 1000, phone = sizeTable();
      if (phone !== wasPhone) start(); else redraw();
    }, 200);
  });

  fetch(BASE + 'puzzles.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d.items;
    $('jg-pics').innerHTML = data.map(function (x) {
      return '<button type="button" class="jg-pic" data-f="' + esc(x.f) + '" aria-pressed="false" title="' + esc(x.n) + '"><img src="' + BASE + 'thumb/' + esc(x.f) + '" alt="' + esc(x.n) + '" width="120" height="90" loading="lazy"></button>';
    }).join('');
    // на телефоне по умолчанию Easy, если игрок сам не выбирал
    try { if (!localStorage.getItem('jg-level') && cv.parentElement.clientWidth < 700) level = 'easy'; } catch (e) {}
    start(data[Math.floor(Math.random() * data.length)]);
  }).catch(function () { loading.textContent = 'Could not load the game. Please reload the page.'; });
})();
