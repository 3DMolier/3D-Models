/* Seek & Find: сцена из вырезанных предметов каталога, игрок ищет предметы по списку.
   Сцена раскладывается здесь же, каждый раз новая. Попадание проверяется по самому
   предмету: точка клика переводится в его координаты (с учётом поворота) и смотрится
   непрозрачность его собственной картинки, сверху вниз по слоям. */
(function () {
  'use strict';
  var BASE = '/play/seek-and-find/';
  // Логический размер сцены: на компьютере 16:10, на телефоне вертикальная и реже
  var LW = 1600, LH = 1000, COUNT = 110, TARGETS = 10;
  var SCALE = 1.5;                     // запас резкости при увеличении
  var HINTS = 3, PENALTY = 5, SOLID = 140;
  // Уровни: число предметов на сцене относительно среднего (110 на компьютере, 72 на телефоне)
  var LEVELS = { easy: 0.7, medium: 1, hard: 1.3 }, level = 'medium';
  try { if (LEVELS[localStorage.getItem('sf-level')]) level = localStorage.getItem('sf-level'); } catch (e) {}
  var BG = {
    kitchen: ['#efe9e1', '#e2d8ca'], workshop: ['#e3d2b4', '#cfb994'], gadgets: ['#e6e8ec', '#d5d9df'],
    toybox: ['#e2ebf3', '#cfdbe8'], clinic: ['#e6efed', '#d3e2de']
  };

  var $ = function (id) { return document.getElementById(id); };
  var view = $('sf-view'), stage = $('sf-stage'), cv = $('sf-canvas'), ov = $('sf-overlay');
  var listEl = $('sf-list'), timeEl = $('sf-time'), foundEl = $('sf-found'), hintBtn = $('sf-hint');
  var overEl = $('sf-over'), themesEl = $('sf-themes'), levelsEl = $('sf-levels'), loading = $('sf-loading');
  var ctx = cv.getContext('2d'), octx = ov.getContext('2d');
  var data, theme, placed = [], targets = [], found = 0, hintsLeft = HINTS, misses = 0;
  var t0 = 0, penalty = 0, timer = null, done = false, imgCache = {}, gen = 0, toastT = null, confT = null, stars = 0;
  var winEl = $('sf-win');

  function ga(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function money(p) { return '$' + p; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function sizeScene() {
    // ширину берём у родителя: сама сцена ниже сужается под высоту экрана
    var phone = view.parentElement.clientWidth < 600;
    LW = phone ? 1000 : 1600; LH = phone ? 1200 : 1000;
    COUNT = Math.round((phone ? 72 : 110) * LEVELS[level]); TARGETS = phone ? 8 : 10;
    view.style.aspectRatio = LW + '/' + LH;
    // сцена не выше экрана за вычетом шапки и двух строк списка - список виден сразу под ней
    view.style.width = phone ? '' : 'min(100%, calc((100vh - 250px) * ' + (LW / LH).toFixed(3) + '))';
    view.style.marginInline = 'auto';
    [cv, ov].forEach(function (c) { c.width = LW * SCALE; c.height = LH * SCALE; });
  }

  // Альфа-канал картинки в её натуральном размере - по нему проверяется попадание
  function alphaOf(img) {
    if (img._alpha) return img._alpha;
    var c = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight;
    c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    var d = x.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (var i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    img._alpha = { a: a, w: w, h: h };
    return img._alpha;
  }
  // Непрозрачен ли предмет p в точке сцены (x, y)
  function solidAt(p, x, y) {
    var dx = x - p.x, dy = y - p.y, c = Math.cos(p.rot), s = Math.sin(p.rot);
    var lx = dx * c + dy * s, ly = -dx * s + dy * c;
    if (Math.abs(lx) > p.w / 2 || Math.abs(ly) > p.h / 2) return false;
    var m = p.mask, u = Math.min(m.w - 1, Math.floor((lx / p.w + 0.5) * m.w)), v = Math.min(m.h - 1, Math.floor((ly / p.h + 0.5) * m.h));
    return m.a[v * m.w + u] > SOLID;
  }
  // Верхний предмет в точке: от последнего нарисованного к первому
  function topAt(x, y) {
    for (var n = placed.length - 1; n >= 0; n--) if (solidAt(placed[n], x, y)) return placed[n];
    return null;
  }

  function load(src) {
    if (imgCache[src]) return imgCache[src];
    imgCache[src] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
    return imgCache[src];
  }

  function drawBackground(c, colors) {
    var g = c.createLinearGradient(0, 0, LW, LH);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    // зерно поверхности
    for (var i = 0; i < 2600; i++) {
      c.fillStyle = 'rgba(0,0,0,' + rnd(0.01, 0.04).toFixed(3) + ')';
      c.fillRect(rnd(0, LW), rnd(0, LH), rnd(1, 3), rnd(1, 3));
    }
    var v = c.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LW * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.16)');
    c.fillStyle = v; c.fillRect(0, 0, LW, LH);
  }

  // Раскладка: из нескольких случайных мест берём то, где меньше перекрытий
  function layout(items) {
    var boxes = [];
    return items.map(function (it) {
      var side = rnd(100, 190), k = side / Math.max(it.w, it.h);
      var w = it.w * k, h = it.h * k, best = null, bestCost = 1e9;
      for (var t = 0; t < 24; t++) {
        var x = rnd(w / 2 + 10, LW - w / 2 - 10), y = rnd(h / 2 + 10, LH - h / 2 - 10), cost = 0;
        for (var b = 0; b < boxes.length; b++) {
          var o = boxes[b];
          var ox = Math.max(0, Math.min(x + w / 2, o.x + o.w / 2) - Math.max(x - w / 2, o.x - o.w / 2));
          var oy = Math.max(0, Math.min(y + h / 2, o.y + o.h / 2) - Math.max(y - h / 2, o.y - o.h / 2));
          cost += ox * oy;
        }
        if (cost < bestCost) { bestCost = cost; best = { x: x, y: y }; }
      }
      var p = { it: it, x: best.x, y: best.y, w: w, h: h, rot: rnd(-0.6, 0.6) };
      boxes.push(p);
      return p;
    });
  }

  function drawItem(c, p, img) {
    c.save();
    c.translate(p.x, p.y); c.rotate(p.rot);
    c.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
    c.restore();
  }

  function render() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawBackground(ctx, BG[theme] || BG.kitchen);
    placed.forEach(function (p) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      drawItem(ctx, p, p.img);
      ctx.restore();
    });
    // Видимая доля каждого предмета: сетка точек по его рамке - где он сам непрозрачен
    // и при этом лежит сверху. Цели берём только среди хорошо видных.
    placed.forEach(function (p) {
      var own = 0, top = 0, c = Math.cos(p.rot), s = Math.sin(p.rot), G = 16;
      for (var i = 0; i < G; i++) for (var j = 0; j < G; j++) {
        var lx = ((i + 0.5) / G - 0.5) * p.w, ly = ((j + 0.5) / G - 0.5) * p.h;
        var x = p.x + lx * c - ly * s, y = p.y + lx * s + ly * c;
        if (!solidAt(p, x, y)) continue;
        own++;
        if (topAt(x, y) === p) top++;
      }
      p.visible = own ? top / own : 0;
    });
  }

  function drawOverlay(hint) {
    octx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    octx.clearRect(0, 0, LW, LH);
    targets.forEach(function (p) {
      if (!p.found) return;
      octx.lineWidth = 5; octx.strokeStyle = '#16a34a';
      octx.beginPath(); octx.arc(p.x, p.y, Math.max(p.w, p.h) * 0.58, 0, Math.PI * 2); octx.stroke();
    });
    if (hint) {
      octx.lineWidth = 6; octx.strokeStyle = 'rgba(22,89,201,.85)'; octx.setLineDash([14, 10]);
      octx.beginPath(); octx.arc(hint.cx, hint.cy, 210, 0, Math.PI * 2); octx.stroke();
      octx.setLineDash([]);
    }
  }

  function renderList() {
    listEl.innerHTML = targets.map(function (p, k) {
      return '<li class="sf-target' + (p.found ? ' sf-done' : '') + '" data-k="' + k + '"><img src="' + BASE + 'img/' + p.it.i + '.webp" alt="" width="44" height="44" loading="lazy"><span>' + esc(p.it.n) + '</span><b aria-hidden="true">' + (p.found ? '&#10003;' : '') + '</b></li>';
    }).join('');
    foundEl.textContent = found + ' / ' + targets.length;
  }

  function elapsed() { return Math.floor((Date.now() - t0) / 1000) + penalty; }
  function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function tick() { timeEl.textContent = fmt(elapsed()); }

  function newGame(th) {
    theme = th || theme;
    [].forEach.call(themesEl.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.theme === theme ? 'true' : 'false'); });
    var base = view.parentElement.clientWidth < 600 ? 72 : 110;
    [].forEach.call(levelsEl.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.level === level ? 'true' : 'false');
      b.querySelector('small').textContent = Math.round(base * LEVELS[b.dataset.level]) + ' objects';
    });
    done = false; found = 0; hintsLeft = HINTS; misses = 0; penalty = 0;
    overEl.hidden = true; winEl.hidden = true; cancelAnimationFrame(confT); hintBtn.disabled = false; hintBtn.textContent = 'Hint (' + hintsLeft + ')';
    loading.hidden = false; targets = []; listEl.innerHTML = '';
    sizeScene();
    var my = ++gen;   // быстрая смена темы: старая загрузка не должна перезаписать новую сцену
    var pool = shuffle(data.themes[theme].items.slice()).slice(0, COUNT);
    Promise.all(pool.map(function (it) { return load(BASE + 'img/' + it.i + '.webp'); })).then(function (imgs) {
      if (my !== gen) return;
      placed = layout(pool.filter(function (it, k) { return imgs[k]; }));
      var ok = pool.map(function (it, k) { return imgs[k]; }).filter(Boolean);
      placed.forEach(function (p, k) { p.img = ok[k]; p.mask = alphaOf(ok[k]); });
      render();
      var seen = placed.filter(function (p) { return p.visible > 0.6; });
      if (seen.length < TARGETS) seen = placed.slice().sort(function (a, b) { return b.visible - a.visible; }).slice(0, TARGETS);
      targets = shuffle(seen).slice(0, TARGETS);
      targets.forEach(function (p) { p.found = false; });
      renderList(); drawOverlay(); resetZoom();
      loading.hidden = true;
      t0 = Date.now(); clearInterval(timer); timer = setInterval(tick, 500); tick();
      ga('game_start', { game: 'seek_find', theme: theme, level: level, objects: placed.length });
    });
  }

  function finish() {
    done = true; clearInterval(timer); tick(); hintBtn.disabled = true;
    var s = elapsed();
    $('sf-over-time').textContent = fmt(s);
    $('sf-over-text').textContent = 'You found all ' + targets.length + ' models' + (misses ? ' with ' + misses + ' miss' + (misses > 1 ? 'es' : '') : ' without a single miss') + (hintsLeft < HINTS ? ' and ' + (HINTS - hintsLeft) + ' hint' + (HINTS - hintsLeft > 1 ? 's' : '') : '') + '. Every object in the scene is a real 3D model from our catalog:';
    $('sf-over-grid').innerHTML = targets.map(function (p) {
      return '<a class="sf-model" href="/models/' + p.it.s + '/" data-slug="' + p.it.s + '"><img src="' + BASE + 'img/' + p.it.i + '.webp" alt="" loading="lazy"><span class="sf-model-name">' + esc(p.it.n) + '</span><span class="sf-model-price">' + money(p.it.p) + '</span></a>';
    }).join('');
    overEl.hidden = false;
    showWin(s);
    ga('game_over', { game: 'seek_find', theme: theme, level: level, seconds: s, misses: misses, hints: HINTS - hintsLeft, stars: stars });
  }

  // Звёзды как в жанре: 3 - без подсказок и почти без промахов, 1 - много промахов или все подсказки
  function starsFor() {
    var used = HINTS - hintsLeft;
    if (misses <= 2 && used === 0) return 3;
    if (misses <= 6 && used <= 1) return 2;
    return 1;
  }
  function showWin(s) {
    stars = starsFor();
    var keyName = 'sf-best-' + theme + '-' + level + '-' + targets.length, best = null, rec = false;
    try { best = parseInt(localStorage.getItem(keyName), 10); } catch (e) {}
    if (!(best > 0) || s < best) { rec = best > 0; try { localStorage.setItem(keyName, s); } catch (e) {} }
    var titles = ['', 'Got them all!', 'Great eye!', 'Perfect!'];
    $('sf-win-label').textContent = data.themes[theme].name + ' \u00b7 ' + level.charAt(0).toUpperCase() + level.slice(1);
    $('sf-win-title').textContent = titles[stars];
    $('sf-stars').innerHTML = [1, 2, 3].map(function (n) { return '<span' + (n <= stars ? ' class="on"' : '') + '>&#9733;</span>'; }).join('');
    $('sf-stars').setAttribute('aria-label', stars + ' of 3 stars');
    $('sf-win-time').textContent = fmt(s);
    var bestEl = $('sf-win-best');
    bestEl.className = 'sf-win-best' + (rec ? ' rec' : '');
    bestEl.textContent = rec ? 'New best time! Previous: ' + fmt(best) : (best > 0 && s > best ? 'Your best: ' + fmt(best) : 'Your first time on this level');
    var used = HINTS - hintsLeft;
    $('sf-win-stats').innerHTML = '<span>' + targets.length + ' found</span><span>' + (misses ? misses + ' miss' + (misses > 1 ? 'es' : '') : 'No misses') + '</span><span>' + (used ? used + ' hint' + (used > 1 ? 's' : '') : 'No hints') + '</span>';
    // вторая кнопка: уровень сложнее, а на Hard - другая тема
    var alt = $('sf-win-alt');
    if (level !== 'hard') { alt.textContent = 'Try ' + (level === 'easy' ? 'Medium' : 'Hard') + ' level'; alt.dataset.go = 'level'; }
    else { alt.textContent = 'Try another theme'; alt.dataset.go = 'theme'; }
    alt.hidden = false;
    resetZoom();
    winEl.hidden = false;
    confetti();
  }
  // Конфетти поверх сцены, ~2,5 секунды; при «уменьшить движение» не показываем
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#f5b301', '#16a34a', '#1659c9', '#dc2626', '#9333ea', '#f97316'], parts = [], start = performance.now();
    for (var i = 0; i < 160; i++) parts.push({
      x: LW / 2 + rnd(-120, 120), y: LH * 0.55, vx: rnd(-9, 9), vy: rnd(-22, -9),
      r: rnd(0, 6.28), vr: rnd(-0.3, 0.3), w: rnd(8, 16), h: rnd(5, 9), c: colors[i % colors.length]
    });
    cancelAnimationFrame(confT);
    (function frame(now) {
      var t = now - start;
      drawOverlay();
      parts.forEach(function (p) {
        p.vy += 0.55; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        octx.save(); octx.translate(p.x, p.y); octx.rotate(p.r);
        octx.globalAlpha = Math.max(0, 1 - t / 2600);
        octx.fillStyle = p.c; octx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        octx.restore();
      });
      if (t < 2600) confT = requestAnimationFrame(frame); else drawOverlay();
    })(start);
  }

  // --- попадание ---
  function sceneXY(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * LW, y: (ev.clientY - r.top) / r.height * LH, k: r.width / LW };
  }
  // Верхний предмет под пальцем. Если под точкой пусто (щель между предметами),
  // смотрим кольцо точек радиусом ~8 экранных пикселей. Клик по другому
  // предмету никогда не засчитывается соседу.
  function pick(x, y, k) {
    var p = topAt(x, y);
    if (p) return p;
    var rad = 8 / k;
    for (var r = rad / 2; r <= rad; r += rad / 2) for (var t = 0; t < 12; t++) {
      var q = topAt(x + r * Math.cos(t * Math.PI / 6), y + r * Math.sin(t * Math.PI / 6));
      if (q && targets.indexOf(q) >= 0 && !q.found) return q;
    }
    return null;
  }
  function toast(text) {
    var el = $('sf-toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 1800);
  }
  function flashMiss(x, y) {
    drawOverlay();
    octx.strokeStyle = '#dc2626'; octx.lineWidth = 5;
    octx.beginPath(); octx.moveTo(x - 14, y - 14); octx.lineTo(x + 14, y + 14); octx.moveTo(x + 14, y - 14); octx.lineTo(x - 14, y + 14); octx.stroke();
    setTimeout(function () { if (!done) drawOverlay(); }, 450);
  }
  function onTap(ev) {
    if (done || !targets.length) return;
    // r.width уже учитывает увеличение (CSS transform), на zoom отдельно не умножаем
    var s = sceneXY(ev), p = pick(s.x, s.y, s.k);
    if (p && targets.indexOf(p) >= 0) {
      if (p.found) return;
      p.found = true; found++;
      renderList(); drawOverlay();
      ga('game_find', { game: 'seek_find', theme: theme, found: found });
      if (found === targets.length) finish();
    } else {
      misses++; penalty += PENALTY; tick(); flashMiss(s.x, s.y);
      toast(p ? p.it.n + ' is not on your list  +' + PENALTY + ' s' : 'Nothing here  +' + PENALTY + ' s');
    }
  }

  // --- подсказка ---
  hintBtn.addEventListener('click', function () {
    if (done || hintsLeft <= 0) return;
    var left = targets.filter(function (p) { return !p.found; });
    if (!left.length) return;
    var p = left[Math.floor(Math.random() * left.length)];
    hintsLeft--; hintBtn.textContent = 'Hint (' + hintsLeft + ')'; hintBtn.disabled = hintsLeft === 0;
    // круг вокруг района, а не точно вокруг предмета
    var h = { cx: Math.min(LW - 120, Math.max(120, p.x + rnd(-90, 90))), cy: Math.min(LH - 120, Math.max(120, p.y + rnd(-90, 90))) };
    drawOverlay(h);
    setTimeout(function () { if (!done) drawOverlay(); }, 2200);
    ga('game_hint', { game: 'seek_find', theme: theme });
  });

  // --- увеличение и перетаскивание ---
  var zoom = 1, panX = 0, panY = 0;
  function applyZoom() {
    var vw = view.clientWidth, vh = view.clientHeight;
    panX = Math.min(0, Math.max(vw - vw * zoom, panX));
    panY = Math.min(0, Math.max(vh - vh * zoom, panY));
    stage.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
    view.classList.toggle('sf-zoomed', zoom > 1);
  }
  function zoomAt(z, cx, cy) {
    var nz = Math.min(4, Math.max(1, z));
    panX = cx - (cx - panX) * nz / zoom; panY = cy - (cy - panY) * nz / zoom;
    zoom = nz; applyZoom();
  }
  function resetZoom() { zoom = 1; panX = 0; panY = 0; applyZoom(); }
  $('sf-zin').addEventListener('click', function () { zoomAt(zoom * 1.6, view.clientWidth / 2, view.clientHeight / 2); });
  $('sf-zout').addEventListener('click', function () { zoomAt(zoom / 1.6, view.clientWidth / 2, view.clientHeight / 2); });
  view.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && zoom === 1 && e.deltaY > 0) return;   // страница листается как обычно
    e.preventDefault();
    var r = view.getBoundingClientRect();
    zoomAt(zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  var ptrs = {}, drag = null, pinch = null;
  view.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.sf-zoom, .sf-win')) return;   // кнопки лупы и карточка финала - не клик по сцене
    view.setPointerCapture(e.pointerId);
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, px: panX, py: panY, moved: false };
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]], r = view.getBoundingClientRect();
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
      drag = null;
    }
  });
  view.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (pinch && ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      zoomAt(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, pinch.cx, pinch.cy);
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved && zoom > 1) { panX = drag.px + dx; panY = drag.py + dy; applyZoom(); }
    }
  });
  function up(e) {
    if (!ptrs[e.pointerId]) return;
    var wasDrag = drag, wasPinch = pinch;
    delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) pinch = null;
    if (!Object.keys(ptrs).length) {
      drag = null;
      if (wasDrag && !wasDrag.moved && !wasPinch && e.type === 'pointerup') onTap(e);
    }
  }
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  window.addEventListener('resize', applyZoom);

  // --- прочее ---
  $('sf-again').addEventListener('click', function () { newGame(); });
  $('sf-win-next').addEventListener('click', function () { newGame(); });
  $('sf-win-x').addEventListener('click', function () { winEl.hidden = true; });
  $('sf-win-models').addEventListener('click', function () { winEl.hidden = true; overEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('sf-win-alt').addEventListener('click', function () {
    if (this.dataset.go === 'level') {
      level = level === 'easy' ? 'medium' : 'hard';
      try { localStorage.setItem('sf-level', level); } catch (err) {}
      newGame();
    } else {
      var keys = Object.keys(data.themes).filter(function (k) { return k !== theme && data.themes[k].items.length >= 60; });
      newGame(keys[Math.floor(Math.random() * keys.length)]);
    }
  });
  $('sf-new').addEventListener('click', function () { newGame(); });
  themesEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-theme]');
    if (b) newGame(b.dataset.theme);
  });
  levelsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-level]');
    if (!b || !LEVELS[b.dataset.level] || !data) return;
    level = b.dataset.level;
    try { localStorage.setItem('sf-level', level); } catch (err) {}
    newGame();
  });
  $('sf-over-grid').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-slug]');
    if (a) ga('game_open_model', { game: 'seek_find', model: a.dataset.slug });
  });
  $('sf-share').addEventListener('click', function () {
    var text = 'I found all ' + targets.length + ' hidden 3D models in ' + timeEl.textContent + ' (' + data.themes[theme].name + ', ' + level + ') ' + new Array(stars + 1).join('\u2605') + '. Can you beat it?';
    var url = location.origin + location.pathname;
    ga('game_share', { game: 'seek_find', theme: theme });
    if (navigator.share) { navigator.share({ title: 'Seek & Find', text: text, url: url }).catch(function () {}); return; }
    var btn = this;
    (navigator.clipboard ? navigator.clipboard.writeText(text + ' ' + url) : Promise.reject()).then(function () {
      btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Share result'; }, 1600);
    }).catch(function () {});
  });

  fetch(BASE + 'objects.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    var keys = Object.keys(d.themes).filter(function (k) { return d.themes[k].items.length >= 60; });
    themesEl.innerHTML = keys.map(function (k) { return '<button type="button" class="sf-theme" data-theme="' + k + '" aria-pressed="false">' + esc(d.themes[k].name) + '</button>'; }).join('');
    newGame(keys[Math.floor(Math.random() * keys.length)]);
  }).catch(function () { loading.textContent = 'Could not load the game. Please reload the page.'; });
})();
