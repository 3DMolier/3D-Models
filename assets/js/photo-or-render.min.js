/* Photo or Render: 10 кадров, игрок решает, фото это или наш рендер.
   После ответа у рендера - ссылка на модель, у фото - автор и лицензия.
   Если рендер приняли за фото - отдельный блок «проверь сам» со ссылкой на модель.
   Ссылки на модели открываются в новой вкладке, чтобы партия не прерывалась. */
(function () {
  'use strict';
  var BASE = '/play/photo-or-render/';
  var ROUNDS = 10;
  var $ = function (id) { return document.getElementById(id); };
  var img = $('pr-img'), shot = $('pr-shot'), btnP = $('pr-photo'), btnR = $('pr-render');
  var reveal = $('pr-reveal'), nextBtn = $('pr-next'), roundEl = $('pr-round'), scoreEl = $('pr-score');
  var overEl = $('pr-over'), loading = $('pr-loading');
  var pool = [], deck = [], cur = null, round = 0, score = 0, answered = false, seen = [], best = 0;
  try { best = +localStorage.getItem('photoRenderBest') || 0; } catch (e) {}

  function ga(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Карточка на нашем сайте (s) или, для самых свежих моделей, страница TurboSquid (u)
  function modelLink(x, cls, inner) {
    var href = x.s ? '/models/' + x.s + '/' : x.u;
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '" target="_blank" rel="noopener" data-slug="' + esc(x.s || x.id) + '">' + inner + '</a>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // В партии фото и рендеров поровну плюс-минус один: иначе выгодно жать одну кнопку
  function newDeck() {
    var ph = shuffle(pool.filter(function (x) { return x.t === 'p'; }));
    var re = shuffle(pool.filter(function (x) { return x.t === 'r'; }));
    var nP = ROUNDS / 2 + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 2);
    return shuffle(ph.slice(0, nP).concat(re.slice(0, ROUNDS - nP)));
  }

  function show() {
    cur = deck[round];
    answered = false;
    shot.className = 'pr-shot';
    reveal.hidden = true; nextBtn.hidden = true;
    btnP.disabled = btnR.disabled = true;
    roundEl.textContent = (round + 1) + ' / ' + ROUNDS;
    loading.hidden = false;
    img.onload = function () { loading.hidden = true; btnP.disabled = btnR.disabled = false; };
    img.src = BASE + 'img/' + cur.f;
    // следующий кадр грузим заранее
    if (deck[round + 1]) { var pre = new Image(); pre.src = BASE + 'img/' + deck[round + 1].f; }
  }

  function answer(guess) {
    if (answered || !cur) return;
    answered = true;
    btnP.disabled = btnR.disabled = true;
    var ok = guess === cur.t;
    if (ok) score++;
    scoreEl.textContent = score;
    seen.push({ x: cur, ok: ok });
    shot.className = 'pr-shot ' + (ok ? 'pr-ok' : 'pr-bad');
    var head = '<strong class="' + (ok ? 'pr-yes' : 'pr-no') + '">' + (ok ? 'Correct!' : 'Not quite.') + '</strong> ';
    if (cur.t === 'r') {
      reveal.innerHTML = ok
        ? head + 'This is a 3D render: ' + modelLink(cur, '', esc(cur.n)) + ', $' + cur.p + ' in our catalog.'
        : head + 'It looks like a photo, but this is a 3D render of a real 3D model: <strong>' + esc(cur.n) + '</strong>, $' + cur.p + '.' +
          '<span class="pr-proof">' + modelLink(cur, 'pr-proof-btn', 'Check the 3D model &#8599;') +
          '<span class="pr-proof-note">Opens in a new tab: see all renders, formats and polygon count.</span></span>';
    } else {
      reveal.innerHTML = head + 'This is a real photo by ' + esc(cur.a || 'unknown author') + ', <a href="' + esc(cur.src) + '" target="_blank" rel="noopener">Wikimedia Commons</a>, <a href="' + esc(cur.lu || cur.src) + '" target="_blank" rel="noopener">' + esc(cur.l) + '</a>.';
    }
    reveal.hidden = false;
    nextBtn.textContent = round + 1 < ROUNDS ? 'Next image' : 'See result';
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    ga('game_guess', { game: 'photo_render', correct: ok, kind: cur.t === 'r' ? 'render' : 'photo' });
  }

  function finish() {
    var renders = seen.map(function (v) { return v.x; }).filter(function (x) { return x.t === 'r'; });
    $('pr-over-title').textContent = score + ' out of ' + ROUNDS;
    $('pr-over-text').textContent = score >= 9 ? 'A sharp eye. Few people tell our renders from photos this well.'
      : score >= 7 ? 'Good eye, but some of our renders fooled you.'
      : 'Our renders fooled you more often than not. That is the point of a photoreal model.';
    $('pr-over-grid').innerHTML = renders.map(function (x) {
      return modelLink(x, 'pr-model', '<img src="' + BASE + 'img/' + x.f + '" alt="" loading="lazy"><span class="pr-model-name">' + esc(x.n) + '</span><span class="pr-model-price">$' + x.p + '</span>');
    }).join('');
    overEl.hidden = false;
    $('pr-play').hidden = true;
    ga('game_over', { game: 'photo_render', score: score });
    finale();
  }

  // Финал как в жанре: звёзды за счёт, рекорд, конфетти за хороший результат
  function finale() {
    if (!window.GameFinale) return;
    var stars = score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
    var before = best, rec = score > before;
    if (rec) { best = score; try { localStorage.setItem('photoRenderBest', best); } catch (e) {} }
    function count(t) {
      var all = seen.filter(function (v) { return v.x.t === t; });
      return all.filter(function (v) { return v.ok; }).length + ' of ' + all.length;
    }
    GameFinale.show({
      label: 'Photo or Render?',
      title: ['Our renders fooled you!', 'Not bad!', 'Good eye!', 'Sharp eye!'][stars],
      stars: stars,
      big: score + ' / ' + ROUNDS,
      sub: 'correct answers',
      best: rec ? { text: before ? 'New best score! Previous: ' + before + ' / ' + ROUNDS : 'New best score!', record: true } : { text: 'Your best: ' + best + ' / ' + ROUNDS },
      chips: ['Photos spotted: ' + count('p'), 'Renders spotted: ' + count('r')],
      confetti: rec || score >= 7,
      primary: { text: 'Play again', onClick: start },
      secondary: { text: 'Try Seek & Find', href: '/play/seek-and-find/', onClick: function () { ga('game_next', { game: 'photo_render', to: 'seek_find' }); } },
      link: { text: 'See the 3D models from this round', onClick: function () { overEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    });
  }

  function start() {
    deck = newDeck(); round = 0; score = 0; seen = [];
    scoreEl.textContent = '0';
    overEl.hidden = true; $('pr-play').hidden = false;
    show();
    ga('game_start', { game: 'photo_render' });
  }

  btnP.addEventListener('click', function () { answer('p'); });
  btnR.addEventListener('click', function () { answer('r'); });
  nextBtn.addEventListener('click', function () {
    round++;
    if (round < ROUNDS) show(); else finish();
  });
  $('pr-again').addEventListener('click', start);
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    var k = e.key.toLowerCase();
    if (!answered && (k === 'p' || k === 'arrowleft')) { e.preventDefault(); answer('p'); }
    else if (!answered && (k === 'r' || k === 'arrowright')) { e.preventDefault(); answer('r'); }
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-slug]');
    if (a) ga('game_open_model', { game: 'photo_render', model: a.dataset.slug });
  });
  $('pr-share').addEventListener('click', function () {
    var text = 'I scored ' + score + '/' + ROUNDS + ' telling real photos from 3D renders. Can you beat it?';
    var url = location.origin + location.pathname, btn = this;
    ga('game_share', { game: 'photo_render', score: score });
    if (navigator.share) { navigator.share({ title: 'Photo or Render?', text: text, url: url }).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(text + ' ' + url) : Promise.reject()).then(function () {
      btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Share result'; }, 1600);
    }).catch(function () {});
  });

  fetch(BASE + 'rounds.json').then(function (r) { return r.json(); }).then(function (d) {
    pool = d.items; start();
  }).catch(function () { loading.textContent = 'Could not load the game. Please reload the page.'; });
})();
