/* game-finale.js - общий финальный экран игр /play/ (Price Duel, Photo or Render).
   Как в жанре: конфетти, карточка поверх страницы со звёздами, счётом, рекордом
   и кнопками «ещё раз» / «другая игра». Вызов: GameFinale.show({...}). */
(function () {
  'use strict';
  var CSS = '.gf-back{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(17,17,17,.45)}' +
    '.gf-card{position:relative;width:min(100%,400px);max-height:100%;overflow:auto;background:#fff;border-radius:16px;padding:24px 24px 20px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.3);animation:gf-pop .45s cubic-bezier(.2,1.4,.4,1) both}' +
    '.gf-x{position:absolute;right:8px;top:8px;width:36px;height:36px;border:0;background:none;font-size:24px;line-height:1;color:#6b7280;cursor:pointer;border-radius:8px}' +
    '.gf-x:hover{background:#f3f4f6;color:#111}' +
    '.gf-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6b7280}' +
    '.gf-card h2{margin:4px 0 6px;font-family:"Playfair Display",serif;font-size:30px;font-weight:700;color:#111}' +
    '.gf-stars{display:flex;justify-content:center;gap:6px;font-size:40px;line-height:1;margin-bottom:6px}' +
    '.gf-stars span{color:#e5e7eb;transform:scale(0);animation:gf-star .4s cubic-bezier(.2,1.6,.4,1) forwards}' +
    '.gf-stars span.on{color:#f5b301;text-shadow:0 2px 0 #c98a00}' +
    '.gf-stars span:nth-child(2){animation-delay:.18s}.gf-stars span:nth-child(3){animation-delay:.36s}' +
    '.gf-big{font-family:"Playfair Display",serif;font-size:46px;font-weight:700;line-height:1.05;color:#111;font-variant-numeric:tabular-nums}' +
    '.gf-sub{font-size:14px;color:#374151;margin-top:2px}' +
    '.gf-best{min-height:20px;margin:6px 0 10px;font-size:14px;color:#6b7280}' +
    '.gf-best.rec{color:#15803d;font-weight:700}' +
    '.gf-chips{display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-bottom:16px}' +
    '.gf-chips span{font-size:13px;padding:4px 10px;border-radius:999px;background:#f3f4f6;color:#374151}' +
    '.gf-btns{display:grid;gap:8px}' +
    '.gf-btns .btn-primary,.gf-btns .btn-ghost{justify-content:center;width:100%;font-size:15px;padding:11px 18px;box-sizing:border-box}' +
    '.gf-link{font:inherit;font-size:14px;color:#1659c9;background:none;border:0;cursor:pointer;margin-top:6px;text-decoration:underline}' +
    '.gf-confetti{position:fixed;inset:0;width:100%;height:100%;z-index:1001;pointer-events:none}' +
    '@keyframes gf-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}' +
    '@keyframes gf-star{to{transform:scale(1)}}' +
    '@media (max-width:600px),(max-height:640px){.gf-card{padding:16px}.gf-card h2{font-size:24px}.gf-stars{font-size:32px}.gf-big{font-size:38px}}' +
    '@media (prefers-reduced-motion:reduce){.gf-card,.gf-stars span{animation:none;transform:none}}';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var back = null, lastFocus = null, raf = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function style() {
    if (document.getElementById('gf-style')) return;
    var st = document.createElement('style');
    st.id = 'gf-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Конфетти на весь экран ~2,5 секунды
  function confetti() {
    if (reduce) return;
    var cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = window.innerWidth, H = window.innerHeight;
    cv.className = 'gf-confetti'; cv.width = W * dpr; cv.height = H * dpr;
    document.body.appendChild(cv);
    var c = cv.getContext('2d'), colors = ['#f5b301', '#16a34a', '#1659c9', '#dc2626', '#9333ea', '#f97316'], parts = [], t0 = performance.now();
    c.scale(dpr, dpr);
    for (var i = 0; i < 170; i++) parts.push({
      x: W / 2 + rnd(-W * 0.15, W * 0.15), y: H * 0.6, vx: rnd(-10, 10), vy: rnd(-24, -10),
      r: rnd(0, 6.28), vr: rnd(-0.3, 0.3), w: rnd(8, 15), h: rnd(5, 9), col: colors[i % colors.length]
    });
    cancelAnimationFrame(raf);
    (function frame(now) {
      var t = now - t0;
      c.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.6; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.globalAlpha = Math.max(0, 1 - t / 2600);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
      });
      if (t < 2600) raf = requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  function close() {
    if (!back) return;
    back.remove(); back = null;
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  /* o: { label, title, stars (0-3), big, sub, best: {text, record}, chips: [], confetti,
          primary: {text, onClick}, secondary: {text, href, newTab, onClick}, link: {text, onClick} } */
  function show(o) {
    style(); close();
    lastFocus = document.activeElement;
    back = document.createElement('div');
    back.className = 'gf-back';
    back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-labelledby', 'gf-title');
    var stars = '';
    if (o.stars != null) {
      stars = '<div class="gf-stars" role="img" aria-label="' + o.stars + ' of 3 stars">' + [1, 2, 3].map(function (n) {
        return '<span' + (n <= o.stars ? ' class="on"' : '') + '>&#9733;</span>';
      }).join('') + '</div>';
    }
    var sec = o.secondary ? (o.secondary.href
      ? '<a class="btn-ghost" href="' + esc(o.secondary.href) + '" data-gf="sec"' + (o.secondary.newTab ? ' target="_blank" rel="noopener"' : '') + '>' + esc(o.secondary.text) + (o.secondary.newTab ? ' &#8599;' : '') + '</a>'
      : '<button type="button" class="btn-ghost" data-gf="sec">' + esc(o.secondary.text) + '</button>') : '';
    back.innerHTML = '<div class="gf-card">' +
      '<button type="button" class="gf-x" data-gf="x" aria-label="Close">&times;</button>' +
      (o.label ? '<div class="gf-label">' + esc(o.label) + '</div>' : '') +
      '<h2 id="gf-title">' + esc(o.title) + '</h2>' + stars +
      '<div class="gf-big">' + esc(o.big) + '</div>' +
      (o.sub ? '<div class="gf-sub">' + esc(o.sub) + '</div>' : '') +
      '<div class="gf-best' + (o.best && o.best.record ? ' rec' : '') + '">' + esc(o.best ? o.best.text : '') + '</div>' +
      (o.chips && o.chips.length ? '<div class="gf-chips">' + o.chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="gf-btns"><button type="button" class="btn-primary" data-gf="pri">' + esc(o.primary.text) + '</button>' + sec + '</div>' +
      (o.link ? '<button type="button" class="gf-link" data-gf="link">' + esc(o.link.text) + '</button>' : '') +
      '</div>';
    back.addEventListener('click', function (e) {
      if (e.target === back) return close();
      var b = e.target.closest('[data-gf]');
      if (!b) return;
      var k = b.getAttribute('data-gf');
      if (k === 'x') close();
      else if (k === 'pri') { close(); o.primary.onClick(); }
      else if (k === 'sec' && o.secondary.onClick) { o.secondary.onClick(); if (!o.secondary.href) close(); }
      else if (k === 'link') { close(); o.link.onClick(); }
    });
    document.body.appendChild(back);
    document.addEventListener('keydown', onKey);
    back.querySelector('[data-gf="pri"]').focus({ preventScroll: true });
    if (o.confetti) confetti();
  }

  window.GameFinale = { show: show, close: close };
})();
