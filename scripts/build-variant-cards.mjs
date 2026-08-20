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

// Подвал главной страницы: карточки должны носить его же, а не свой обрезанный.
const HOME_FOOTER = (() => {
  try {
    const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const i = h.lastIndexOf('<footer');
    return i < 0 ? null : h.slice(i, h.indexOf('</footer>', i) + '</footer>'.length);
  } catch { return null; }
})();

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
/* Одна строка кадров со стрелками по бокам, как на TurboSquid. Сетка в несколько
   рядов давала простыню и заезжала под правый блок. */
.mp-gal-row{display:flex;align-items:center;gap:8px}
.mp-gal-strip{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;
  scroll-behavior:smooth;scrollbar-width:none;flex:1 1 auto;min-width:0;padding-bottom:2px}
.mp-gal-strip::-webkit-scrollbar{display:none}
.mp-gal-strip .mp-gal-thumb{flex:0 0 104px;width:104px;height:auto;aspect-ratio:16/10}
.mp-gal-strip .mp-gal-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.mp-gal-arrow{flex:0 0 auto;width:30px;height:56px;display:flex;align-items:center;justify-content:center;
  background:#fff;border:1px solid #d4d4d4;border-radius:4px;font-size:19px;line-height:1;color:#111;cursor:pointer}
.mp-gal-arrow:hover{border-color:#111}
.mp-gal-arrow[disabled]{opacity:.3;cursor:default}
.mp-gal-hint{font-size:12px;color:#6b7280;margin-top:8px}
/* Липкий крупный снимок пробовали - он конфликтует с шапкой сайта и оставляет
   провал над собой. Вместо этого лента фиксированной высоты: снимок и лента
   помещаются на один экран, и подтягивать ничего не нужно. */
/* Лента остаётся в левой колонке под снимком и НЕ лезет под правый блок:
   во всю ширину она наезжала на карточку с ценой. Левую колонку делаем шире,
   правую уже. Селектор не слабее «.mp-hero-grid > .mp-gallery» в model-pages.css,
   иначе правило сайта перебивает это по точности. */
@media(min-width:900px){
  .mp-hero-grid{grid-template-columns:1.55fr 1fr}
  .mp-hero-grid > .mp-gallery{grid-column:1;grid-row:2}
}
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
/* Характеристики в ОДНУ колонку - так решил основатель. Двухстолбцовую раскладку
   пробовали ради выравнивания высот, от неё отказались. Левый блок шире правого. */
@media(min-width:900px){ .mp-details-grid{grid-template-columns:1.55fr 1fr} }
/* Полоса-разделитель между «All Versions» и «Related 3D Models». */
.mp-section-split{height:1px;background:#e5e5e5;margin:34px 0 0}
.mp-footer-back{padding-top:14px}
@media(prefers-color-scheme:dark){
 .mp-section-split{background:#2b2f37}
 .mp-gal-arrow{background:#171a1f;border-color:#3a3f4a;color:#e5e7eb}
 .mp-gal-arrow:hover{border-color:#e5e7eb}
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
  var strip=document.querySelector('.mp-gal-strip');
  var prev=document.querySelector('.mp-gal-prev'), next=document.querySelector('.mp-gal-next');
  if(!strip||!prev||!next) return;

  // Стрелки листают ленту на видимую ширину, как на TurboSquid.
  function page(dir){ strip.scrollLeft += dir * Math.max(120, strip.clientWidth - 40); }
  prev.addEventListener('click',function(){ page(-1); });
  next.addEventListener('click',function(){ page(1); });

  // Гасим стрелку, когда листать в её сторону больше нечего.
  function sync(){
    var max=strip.scrollWidth-strip.clientWidth-1;
    prev.disabled = strip.scrollLeft<=0;
    next.disabled = strip.scrollLeft>=max;
  }
  strip.addEventListener('scroll',sync);
  window.addEventListener('resize',sync);
  sync();

  // Колесо мыши над лентой листает её вбок, а не крутит страницу.
  strip.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    if(strip.scrollWidth<=strip.clientWidth) return;
    e.preventDefault(); strip.scrollLeft += e.deltaY;
  },{passive:false});
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
  // Только кадры САМОЙ модели. Кадры сшитых версий из презентации убраны: их
  // было под полторы сотни, и они сбивали - версия показывается одним главным
  // ракурсом в секции ниже, оттуда же переход на TurboSquid.
  // Раскладка как на TurboSquid: одна строка, остальное листается стрелками.
  const mkThumb = (srcUrl, ver) =>
    `<button type="button" class="mp-gal-thumb" data-full="${esc(srcUrl)}"`
    + ` data-cap="${esc(ver.name)}" data-owner="${esc(ver.id)}" data-price="${esc(ver.price)}" data-link="${esc(ver.link)}"`
    + ` title="${esc(ver.name)}" aria-label="${esc(ver.name)}">`
    + `<img src="${esc(srcUrl)}" alt="${esc(ver.name)}" width="200" height="113" loading="lazy" decoding="async">`
    + `</button>`;

  const mainFrames = framesFor(group, main.id);
  if (!mainFrames.length) { console.log('  нет кадров в инвентаре: ' + slug); return null; }

  const strip = mainFrames.map(u => mkThumb(u, main)).join('');
  const total = mainFrames.length;

  html = html.replace(/<div class="mp-gal-strip">[\s\S]*?<\/div>(?=<\/div>)/, () =>
    `<div class="mp-gal-row">`
    + `<button type="button" class="mp-gal-arrow mp-gal-prev" aria-label="Previous frames">&#8249;</button>`
    + `<div class="mp-gal-strip">${strip}</div>`
    + `<button type="button" class="mp-gal-arrow mp-gal-next" aria-label="Next frames">&#8250;</button>`
    + `</div>`
    + `<div class="mp-gal-hint">${total} frames</div>`);

  // Подпись под крупным снимком. Версий в презентации больше нет, поэтому здесь
  // всегда основная модель - оставляем цену и переход на TurboSquid.
  html = html.replace(/<div class="mp-gal-cap" data-gal-cap>([\s\S]*?)<\/div>/, () =>
    `<div class="mp-gal-cap-row" data-cap-row>`
    + `<span class="mp-gal-cap-price" data-cap-price>${esc(main.price)}</span>`
    + `<a class="mp-gal-cap-link" data-cap-link href="${esc(main.link)}" target="_blank" rel="noopener">View on TurboSquid &#8599;</a>`
    + `</div>`);

  // ── 2. секция версий вниз, сеткой как related ─────────────────────────────
  html = html.replace(/<section class="mp-variants">[\s\S]*?<\/section>/, '');

  // Каждая версия - один главный ракурс, название, цена и переход на TurboSquid.
  // Больше ничего: галерей у сшитых карточек нет.
  const verCards = versions.map(v =>
    `<a href="${esc(v.link)}" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link">`
    + `<div class="img-wrap mp-rc-img-wrap">`
    + `<img src="${esc(v.thumb)}" alt="${esc(v.name)}" width="800" height="450" decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
    + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
    + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(v.name)}${v.isMain ? ' <span class="mp-var-badge">main</span>' : ''}</div></div>`
    + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">${v.tag ? esc(v.tag) : 'View on TurboSquid'}</span>`
    + `<span class="mp-rc-price">${esc(v.price)}</span></div></div></a>`).join('');

  const verSection = `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">Same model, other versions</div>`
    + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
    + `<div class="mp-related-grid">${verCards}</div>`
    + `<div class="mp-section-split" role="separator"></div>`
    + `</div></section>`;

  // Тоже функцией: в карточках версий есть цены со знаком «$».
  html = html.replace('<section class="mp-related-section">', () => verSection + '<section class="mp-related-section">');

  // ── 3. характеристики - в правую колонку, Quick Info внутрь них ───────────
  // Quick Info дублировал характеристики: цена, категория и сертификация были в
  // обоих блоках. Оставляем один блок, а уникальную строку Quick Info («Rig»)
  // переносим в него.
  const quick = {};
  const qiM = html.match(/<div class="mp-info-card">[\s\S]*?<div class="mp-info-rows">([\s\S]*?)<\/div><\/div>/);
  if (qiM) {
    for (const m of qiM[1].matchAll(/<span class="mp-info-row-label">([^<]*)<\/span>\s*(<span[^>]*>|<a[^>]*>)([^<]*)/g)) {
      quick[m[1].trim()] = { html: m[2] + m[3] + (m[2].startsWith('<a') ? '</a>' : '</span>'), text: m[3].trim() };
    }
    html = html.replace(/<div class="mp-info-card">[\s\S]*?<div class="mp-info-rows">[\s\S]*?<\/div><\/div>/, '');
  }

  const specM = html.match(/<div class="mp-spec-block">[\s\S]*?(?=<div class="mp-faq-block">)/);
  if (specM) {
    let spec = specM[0];
    html = html.replace(spec, '');
    // Строки Quick Info, которых нет в характеристиках, дописываем в таблицу.
    const have = [...spec.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    const extra = Object.entries(quick)
      .filter(([k]) => !have.includes(k.toLowerCase()))
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v.html}</td></tr>`).join('');
    if (extra) spec = spec.replace('</tbody>', extra + '</tbody>');
    // Границу колонки ищем счётом тегов, а не первым попавшимся «</div></div>»:
    // при наивном поиске блок характеристик уехал ВНУТРЬ карточки Quick Info.
    const at = endOfDiv(html, html.indexOf('<div class="mp-sidebar-col">'));
    if (at > 0) html = html.slice(0, at) + '<div class="mp-spec-card">' + spec + '</div>' + html.slice(at);
    else console.log('  не нашёл конец правой колонки: ' + slug);
  }

  // ── 3б. подвал как на главной ─────────────────────────────────────────────
  // У карточек стоял свой обрезанный подвал в одну строку, у главной - полный,
  // с четырьмя колонками ссылок. Ставим общий, а ссылку «назад в категорию»
  // сохраняем: она полезна и была только здесь.
  if (HOME_FOOTER) {
    const cur = html.match(/<footer class="mp-footer">[\s\S]*?<\/footer>/);
    if (cur) {
      const back = (cur[0].match(/<a[^>]*class="nav-link mp-back-link"[\s\S]*?<\/a>/) || [''])[0];
      html = html.replace(cur[0], () => HOME_FOOTER.replace('</footer>',
        (back ? `<div class="max-w-7xl mx-auto mp-footer-back">${back}</div>` : '') + '</footer>'));
    }
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
