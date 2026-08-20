/*
 * build-variant-cards.mjs — карточка модели с разделением презентации и версий.
 *
 * Чем отличается от прошлой попытки (build-variant-demo.mjs, забракована 20.08).
 * Та строила отдельную страницу с нуля и растеряла всё, ради чего карточка нужна:
 * зум, характеристики, описание, вопросы, related, подвал. Здесь берётся НАСТОЯЩАЯ
 * карточка и правится точечно - остальное остаётся ровно таким, как было.
 *
 * Что делаем:
 *   1. Галерея. Сейчас в ней по одному кадру на версию. Подставляем все кадры из
 *      инвентаря: сначала кадры самой модели, затем, за отбивкой, кадры версий.
 *      Отбивка сдержанная - подпись и тонкая линия, без цветных плашек: те
 *      выбивались из оформления сайта.
 *   2. Лента кадров. Была горизонтальная прокрутка, которую легко не заметить.
 *      Теперь сетка в два ряда и кнопка «показать все N кадров».
 *   3. Секция версий. Была узким списком у характеристик - переносим вниз, к
 *      related, и оформляем такой же сеткой карточек: превью того же размера,
 *      название, цена, переход на TurboSquid.
 *   4. Подпись под крупным кадром показывает, чей это кадр, и для версии
 *      добавляет цену и ссылку на TurboSquid.
 *
 * Данные берём из самой карточки (цены, ссылки, превью версий - они там уже
 * выверены) и из инвентаря (кадры). Ничего не выдумываем.
 *
 * Запуск:  node build-variant-cards.mjs [--outdir preview/cards] [--noindex]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const OUTDIR = argv.includes('--outdir') ? argv[argv.indexOf('--outdir') + 1] : 'preview/cards';
const NOINDEX = argv.includes('--noindex');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'variant-demo.json'), 'utf8'));

const esc = s => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Разбираем существующий список версий: там уже лежат превью, названия, цены и
// ссылки с нужной реферальной меткой. Своё ничего не сочиняем.
function parseVersions(html) {
  const sec = (html.match(/<section class="mp-variants">([\s\S]*?)<\/section>/) || [])[1];
  if (!sec) return [];
  const out = [];
  for (const m of sec.matchAll(/<li class="mp-var([^"]*)">([\s\S]*?)<\/li>/g)) {
    const isMain = /is-main/.test(m[1]);
    const li = m[2];
    const thumb = (li.match(/class="mp-var-thumb"[^>]*src="([^"]+)"/) || [])[1] || '';
    let name = (li.match(/<span class="mp-var-name">([\s\S]*?)<\/span>/) || [])[1] || '';
    name = name.replace(/<span class="mp-var-badge">[\s\S]*$/, '').replace(/<[^>]+>/g, '').trim();
    const price = (li.match(/<span class="mp-var-price">([^<]*)<\/span>/) || [])[1] || '';
    const link = (li.match(/class="mp-var-link" href="([^"]+)"/) || [])[1] || '';
    const id = (link.match(/-(\d+)(?:\?|$)/) || [])[1] || '';
    // Старые подписи бывают бессодержательными - «Standard (2)», «Standard (3)».
    // Настоящее имя модели лежит в адресе TurboSquid и говорит куда больше,
    // поэтому в заголовок берём его, а старую подпись оставляем меткой отличия.
    const fromLink = (link.match(/3d-models\/([a-z0-9-]+)-\d+/i) || [])[1] || '';
    const pretty = fromLink
      ? fromLink.replace(/-3d-model$/, '').split('-')
        .map(w => /^(3d|us|uv|la|mk|ii|iii|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      : name;
    // Хвост «(2)» в подписи различал одинаковые ярлыки в старом списке. В сетке
    // версии и так подписаны настоящими именами, и этот хвост только мешает.
    const bare = name.trim().replace(/\s*\(\d+\)$/, '');
    const weak = /^standard$/i.test(bare);
    out.push({ isMain, thumb, name: pretty || name, tag: weak ? '' : bare, price, link, id });
  }
  return out;
}

// Позиция ПЕРЕД закрывающим </div> блока, начинающегося на start. Считаем
// вложенность: иначе вставка попадает внутрь первой вложенной карточки.
function endOfDiv(html, start) {
  if (start < 0) return -1;
  let depth = 0, i = start;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return m.index; }
    else depth++;
  }
  return -1;
}

// Кадры версии из инвентаря. Ключ - идентификатор TurboSquid, он же в ссылке.
function framesFor(group, id) {
  if (group.main.id === id) return (group.main.data.images || []);
  const v = group.vars.find(x => x.id === id);
  return v ? (v.data.images || []) : [];
}

const STYLE = `<style>
/* Лента кадров. Горизонтальная прокрутка была незаметна, а раскрытие всех кадров
   в высоту растягивало страницу на экраны вниз: крупный снимок уезжал наверх, и
   после клика по миниатюре приходилось скроллить обратно, чтобы его увидеть.
   Плюс справа от растянутой ленты зияла пустая колонка.
   Поэтому лента - панель ФИКСИРОВАННОЙ высоты со своей прокруткой. Длина
   страницы от числа кадров больше не зависит вообще. */
.mp-gal-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;
  max-height:236px;overflow-y:auto;overflow-x:hidden;padding-right:4px;scrollbar-width:thin;
  overscroll-behavior:contain}
.mp-gal-strip .mp-gal-thumb{width:auto}
.mp-gal-strip--tall{max-height:62vh}
.mp-gal-more{display:inline-block;margin-top:10px;background:none;border:1px solid #d4d4d4;border-radius:4px;padding:7px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#111}
.mp-gal-more:hover{border-color:#111}
.mp-gal-hint{font-size:12px;color:#6b7280;margin-top:8px}
/* Липкий крупный снимок пробовали - он конфликтует с шапкой сайта и оставляет
   провал над собой. Вместо этого лента фиксированной высоты: снимок и лента
   помещаются на один экран, и подтягивать ничего не нужно. */
/* Лента - во всю ширину под героем. Раньше она стояла в левой колонке под
   снимком, и справа от неё зияла пустота: блок с ценой заметно короче. Теперь
   верхний ряд это снимок и блок покупки (327 и 338 пикселей - вровень), а лента
   идёт отдельной строкой. Заодно в ряд помещается вдвое больше кадров. */
/* Селектор должен быть не слабее «.mp-hero-grid > .mp-gallery» в model-pages.css,
   иначе правило сайта перебивает это по точности. */
@media(min-width:900px){ .mp-hero-grid > .mp-gallery{grid-column:1/-1;grid-row:2} }
/* Отбивка между кадрами модели и кадрами версий. Намеренно сдержанная: линия и
   подпись в том же стиле, что section-label, без цветных плашек. */
.mp-gal-split{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:16px 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.mp-gal-split::after{content:"";flex:1;height:1px;background:#e5e5e5}
.mp-gal-thumb--var{position:relative}
.mp-gal-thumb--var::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#111;opacity:.5;border-radius:2px 0 0 2px;z-index:1}
.mp-gal-cap-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:13px}
.mp-gal-cap-price{color:#6b7280;font-variant-numeric:tabular-nums}
.mp-gal-cap-link{color:#1659c9;text-decoration:none;font-weight:600}
.mp-gal-cap-tag{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;border:1px solid #d4d4d4;border-radius:20px;padding:2px 8px}
/* Секция версий - той же сеткой, что related, чтобы читалась как часть страницы. */
.mp-versions-section{margin:34px 0 0}
.mp-ver-chip{font-size:11px}
/* Характеристики переезжают в правую колонку - так договаривались, и заодно это
   лечит пустоту: раньше слева стояли описание, характеристики и вопросы, а
   справа болталась одна карточка Quick Info. Колонка узкая, поэтому таблица
   раскладывается строками «подпись - значение», как в Quick Info. */
.mp-sidebar-col .mp-spec-block{max-width:none;margin:0}
.mp-sidebar-col .mp-spec-block .mp-block-h2{font-size:15px;margin:0 0 12px}
.mp-sidebar-col .mp-spec-table{width:100%;border-collapse:collapse;font-size:13px}
.mp-sidebar-col .mp-spec-table th,.mp-sidebar-col .mp-spec-table td{display:block;width:auto}
.mp-sidebar-col .mp-spec-table tr{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
  padding:8px 0;border-bottom:1px solid #ececec}
.mp-sidebar-col .mp-spec-table tr:last-child{border-bottom:0}
.mp-sidebar-col .mp-spec-table th{color:#6b7280;font-weight:500;text-align:left;flex:0 0 auto}
.mp-sidebar-col .mp-spec-table td{text-align:right;flex:1 1 auto;overflow-wrap:anywhere}
.mp-spec-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:20px}
/* Колонки уравниваем, а характеристики внутри правой раскладываем в два столбца.
   При сетке 2fr 1fr правая колонка выходила на 447 пикселей выше левой, и под
   текстом оставалась дыра; так разница падает до ~180. Только на широком экране:
   на узком карточка и так в одну колонку. */
@media(min-width:900px){
  .mp-details-grid{grid-template-columns:1fr 1fr}
  .mp-sidebar-col .mp-spec-table tbody{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
}
@media(prefers-color-scheme:dark){
 .mp-spec-card{background:#171a1f;border-color:#2b2f37}
 .mp-sidebar-col .mp-spec-table tr{border-color:#2b2f37}
 .mp-sidebar-col .mp-spec-table th{color:#9ca3af}
 .mp-gal-hint{color:#9ca3af}
 .mp-gal-more{border-color:#3a3f4a;color:#e5e7eb}
 .mp-gal-more:hover{border-color:#e5e7eb}
 .mp-gal-split{color:#9ca3af}
 .mp-gal-split::after{background:#3a3f4a}
 .mp-gal-thumb--var::before{background:#e5e7eb}
 .mp-gal-cap-tag{border-color:#3a3f4a;color:#9ca3af}
}
</style>`;

const SCRIPT = `<script>
(function(){
  // Подпись под крупным кадром: имя версии меняет штатный скрипт сайта, а цену
  // и ссылку на TurboSquid дописываем здесь, чтобы из презентации можно было
  // сразу уйти к покупке той версии, которую человек сейчас смотрит.
  var row=document.querySelector('[data-cap-row]'); if(!row) return;
  var priceEl=row.querySelector('[data-cap-price]'), linkEl=row.querySelector('[data-cap-link]'), tagEl=row.querySelector('[data-cap-tag]');
  function apply(btn){
    var p=btn.getAttribute('data-price')||'', l=btn.getAttribute('data-link')||'', v=btn.getAttribute('data-variant');
    priceEl.textContent=p;
    if(l){ linkEl.href=l; linkEl.style.display=''; } else { linkEl.style.display='none'; }
    tagEl.textContent = v ? 'Variation' : 'Base model';
  }
  document.addEventListener('click',function(e){
    var btn=e.target.closest?e.target.closest('.mp-gal-thumb'):null;
    if(btn){ apply(btn); return; }
    var card=e.target.closest?e.target.closest('[data-show-version]'):null;
    if(card){
      var id=card.getAttribute('data-show-version');
      var t=document.querySelector('.mp-gal-thumb[data-owner="'+id+'"]');
      if(t){ e.preventDefault(); t.click();
        // Прокручиваем ВНУТРИ ленты, а не страницу: страница остаётся на месте,
        // и крупный снимок никуда не уезжает.
        var strip=document.querySelector('.mp-gal-strip');
        if(strip) strip.scrollTop = Math.max(0, t.offsetTop - strip.offsetTop - 8);
        var frame=document.querySelector('.mp-hero-frame');
        if(frame) frame.scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    }
  });
  var more=document.querySelector('.mp-gal-more');
  if(more) more.addEventListener('click',function(){
    var strip=document.querySelector('.mp-gal-strip');
    var tall=strip.classList.toggle('mp-gal-strip--tall');
    more.textContent = tall ? more.getAttribute('data-less') : more.getAttribute('data-more');
  });
  // Если крупный снимок ушёл выше экрана, подтягиваем его к глазам: щёлкать по
  // миниатюре и не видеть результата - ровно та беда, из-за которой ленту и
  // переделывали.
  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.mp-gal-thumb')) return;
    var frame=document.querySelector('.mp-hero-frame')||document.querySelector('.mp-hero-img');
    if(!frame) return;
    var r=frame.getBoundingClientRect();
    if(r.top < 0 || r.bottom > window.innerHeight) frame.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
})();
</script>`;

function build(group) {
  const slug = group.main.slug;
  const src = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(src)) { console.log('  нет карточки: ' + slug); return null; }
  let html = fs.readFileSync(src, 'utf8');

  const versions = parseVersions(html);
  if (!versions.length) { console.log('  нет блока версий: ' + slug); return null; }
  const main = versions.find(v => v.isMain) || versions[0];

  // ── 1. лента кадров ────────────────────────────────────────────────────────
  const mkThumb = (srcUrl, ver, isVar) =>
    `<button type="button" class="mp-gal-thumb${isVar ? ' mp-gal-thumb--var' : ''}" data-full="${esc(srcUrl)}"`
    + ` data-cap="${esc(ver.name)}" data-owner="${esc(ver.id)}" data-price="${esc(ver.price)}" data-link="${esc(ver.link)}"`
    + (isVar ? ' data-variant="1"' : '')
    + ` title="${esc(ver.name)}" aria-label="${esc(ver.name)}">`
    + `<img src="${esc(srcUrl)}" alt="${esc(ver.name)}" width="200" height="113" loading="lazy" decoding="async">`
    + `<span class="mp-gal-lbl">${esc(ver.name)}</span></button>`;

  const mainFrames = framesFor(group, main.id);
  if (!mainFrames.length) { console.log('  нет кадров в инвентаре: ' + slug); return null; }

  let strip = mainFrames.map((u, i) => mkThumb(u, main, false)).join('');
  let varCount = 0;
  const varParts = [];
  for (const v of versions) {
    if (v.isMain) continue;
    const fr = framesFor(group, v.id);
    if (!fr.length) continue;
    varCount += fr.length;
    varParts.push(fr.map(u => mkThumb(u, v, true)).join(''));
  }
  if (varParts.length) {
    strip += `<div class="mp-gal-split">Frames of other versions</div>` + varParts.join('');
  }
  const total = mainFrames.length + varCount;
  const clipped = total > 12;

  html = html.replace(/<div class="mp-gal-strip">[\s\S]*?<\/div>(?=<\/div>)/, () =>
    `<div class="mp-gal-strip">${strip}</div>`
    + `<div class="mp-gal-hint">${total} frames &#183; scroll inside the strip to see them all</div>`
    + (clipped ? `<button type="button" class="mp-gal-more" data-more="Taller strip" data-less="Shorter strip">Taller strip</button>` : ''));

  // Подпись: имя ведёт штатный скрипт, цену и ссылку дописываем строкой ниже.
  // Замену задаём функцией, а не строкой: цены содержат «$», а в строке замены
  // «$1» означает первую группу. Из-за этого «$179» превращалось в «Standard79».
  html = html.replace(/<div class="mp-gal-cap" data-gal-cap>([\s\S]*?)<\/div>/, (m, inner) =>
    `<div class="mp-gal-cap" data-gal-cap>${inner}</div>`
    + `<div class="mp-gal-cap-row" data-cap-row>`
    + `<span class="mp-gal-cap-tag" data-cap-tag>Base model</span>`
    + `<span class="mp-gal-cap-price" data-cap-price>${esc(main.price)}</span>`
    + `<a class="mp-gal-cap-link" data-cap-link href="${esc(main.link)}" target="_blank" rel="noopener">View on TurboSquid &#8599;</a>`
    + `</div>`);

  // ── 2. секция версий вниз, сеткой как related ─────────────────────────────
  html = html.replace(/<section class="mp-variants">[\s\S]*?<\/section>/, '');

  const verCards = versions.map(v => {
    const frames = framesFor(group, v.id).length;
    return `<a href="${esc(v.link)}" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link" data-show-version="${esc(v.id)}">`
      + `<div class="img-wrap mp-rc-img-wrap">`
      + `<img src="${esc(v.thumb)}" alt="${esc(v.name)}" width="800" height="450" decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
      + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
      + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(v.name)}${v.isMain ? ' <span class="mp-var-badge">main</span>' : ''}</div></div>`
      + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">${v.tag ? esc(v.tag) : (frames ? frames + ' frames' : 'View')}</span>`
      + `<span class="mp-rc-price">${esc(v.price)}</span></div></div></a>`;
  }).join('');

  const verSection = `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">Same model, other versions</div>`
    + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
    + `<div class="mp-related-grid">${verCards}</div></div></section>`;

  // Тоже функцией: в карточках версий есть цены со знаком «$».
  html = html.replace('<section class="mp-related-section">', () => verSection + '<section class="mp-related-section">');

  // ── 3. характеристики - в правую колонку ──────────────────────────────────
  // Слева оставались описание, характеристики и вопросы, а справа висела одна
  // карточка Quick Info, из-за чего колонка обрывалась и ниже зияла пустота.
  const specM = html.match(/<div class="mp-spec-block">[\s\S]*?(?=<div class="mp-faq-block">)/);
  if (specM) {
    const spec = specM[0];
    html = html.replace(spec, '');
    // Границу колонки ищем счётом тегов, а не первым попавшимся «</div></div>»:
    // при наивном поиске блок характеристик уехал ВНУТРЬ карточки Quick Info.
    const at = endOfDiv(html, html.indexOf('<div class="mp-sidebar-col">'));
    if (at > 0) html = html.slice(0, at) + '<div class="mp-spec-card">' + spec + '</div>' + html.slice(at);
    else console.log('  не нашёл конец правой колонки: ' + slug);
  }

  // ── 4. стили, скрипт, служебное ───────────────────────────────────────────
  html = html.replace('</head>', STYLE + '</head>');
  html = html.replace('</body>', SCRIPT + '</body>');
  if (NOINDEX && !/name="robots"/.test(html)) {
    html = html.replace('</title>', '</title>\n<meta name="robots" content="noindex, nofollow">');
  }
  // Длинного тире в текстах быть не должно - правило проекта. В генераторе
  // card-content.mjs оно уже убрано, но выпущенные карточки его ещё несут
  // (59 672 страницы на 20.08.2026), поэтому чистим и здесь.
  const dashes = (html.match(/—|–|&#8212;|&mdash;|&#8211;|&ndash;/g) || []).length;
  html = html.replace(/\s*(?:—|–|&#8212;|&mdash;|&#8211;|&ndash;)\s*/g, ' - ');
  return { slug, html, total, versions: versions.length, dashes };
}

const outBase = path.join(ROOT, OUTDIR);
fs.mkdirSync(outBase, { recursive: true });
const made = [];
for (const g of GROUPS) {
  const r = build(g);
  if (!r) continue;
  const dir = path.join(outBase, r.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), r.html);
  made.push(r);
  console.log('  собрано: ' + r.slug + '  версий ' + r.versions + ', кадров ' + r.total + ', тире убрано ' + r.dashes);
}
console.log('\nготово, страниц: ' + made.length);
made.forEach(r => console.log('   https://3dmolierstudio.com/' + OUTDIR + '/' + r.slug + '/'));
