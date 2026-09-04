// build-category-hubs.mjs — генератор пагинированных хаб-страниц категорий (все 25).
// Стр.1 = /categories/<cat>/, стр.N = /categories/<cat>/page/N/. Статические карточки (100/стр),
// ItemList-schema, canonical + rel prev/next, пагинация. Убирает JS load-more (краулимые хабы).
// header/footer — константа (из vehicles). hero: у существующих категорий берётся из их страницы,
// у 9 новых — генерируется по HERO-конфигу.
//
// Запуск:  node scripts/build-category-hubs.mjs           (ВСЕ 25 категорий)
//          node scripts/build-category-hubs.mjs <cat>     (одна категория)
import fs from 'node:fs';
import path from 'node:path';
import { anchorClassify } from './anchors25.mjs';
import { classifyByReport } from './category-map.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const CATEGORIES = path.join(ROOT, 'categories');
const MODELS = path.join(ROOT, 'models');
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const PERPAGE = 100;

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- 25-кат классификатор (из classify15.mjs) ----
const clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
const dispOf = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
dispOf['other'] = 'Other';
const ALL_SLUGS = CATS.map(c => c[0]).concat('other');
// Источник истины — реальная категория TurboSquid (cat1/cat2 из отчёта продаж).
// Ключевые слова в названии — только запасной вариант для моделей вне отчёта
// (0.1% каталога), иначе слово может случайно совпасть не с той категорией
// (авианосец -> "Characters & People" из-за общих токенов в имени и т.п.).
const keywordClassify = name => {
  const t = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [s, d, k] of CATS) if (k.find(x => t.has(x))) return s;
  return anchorClassify(name) || 'other';
};
// Ручные переносы имеют приоритет над всем остальным. В data/category-overrides.json
// лежат решения по моделям, которые отчёт TurboSquid относит не туда: авиационный
// двигатель и салон Boeing в «Vehicles», телебашня там же, девять гидроцилиндров.
// Пишет файл scripts/reclassify-models.mjs; без этой проверки пересборка страниц
// вернула бы всё как было.
const OVERRIDES = (() => {
  const f = path.join(DATA, 'category-overrides.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; }
})();
/*
 * Единый источник категорий - data/model-categories.json. Он же питает карточки,
 * каталог, меню, хлебные крошки и счётчики. Здесь стоял СВОЙ классификатор, и
 * хаб раскладывал модели иначе, чем весь остальной сайт: 430 живых карточек не
 * попадали ни на одну страницу категории, а числа расходились с источником на
 * те же 430. Теперь спрашиваем источник, а прежняя цепочка осталась запасной -
 * для моделей, которых в нём ещё нет.
 */
// Папки карточек по номеру модели: единственный надёжный способ получить адрес.
// Вычислять его из названия нельзя - правило слагов в данных и на диске местами
// расходится, и модель молча выпадает из своей категории.
const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^[0-9]+$/.test(id) && !DIR_BY_ID.has(id)) DIR_BY_ID.set(id, d);
}
// Метка версии - из главной страницы. Зашитая v=33 возвращалась при каждой
// пересборке и отправляла посетителю стили и скрипты годичной давности.
const ASSET_V = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/site\.min\.js\?v=(\d+)/) || [, '1'])[1];
const MODEL_CAT = JSON.parse(fs.readFileSync(path.join(DATA, 'model-categories.json'), 'utf8'));
const classify = (name, id) => MODEL_CAT[String(id)] || OVERRIDES[String(id)] || classifyByReport(id, name) || keywordClassify(name);

// ---- hero-конфиг для 9 новых категорий (иконка + описание) ----
const HERO = {
  'containers-storage': ['📦', 'Boxes, crates, barrels, cases, canisters and storage 3D models. Real-world scale and clean topology for logistics, warehouse, retail and product scenes.'],
  'sports-recreation': ['🏀', 'Sports and recreation 3D models - balls, equipment and gear for games, advertising, broadcast graphics and fitness visualization.'],
  'kitchen-tableware': ['🍽️', 'Kitchen and tableware 3D models - cookware, dishes, cups and utensils for archviz, product rendering, advertising and food scenes.'],
  'space-scifi': ['🚀', 'Space and sci-fi 3D models - satellites, spacecraft, planets and celestial assets for film, games, simulation and science visualization.'],
  'lighting': ['💡', 'Lighting 3D models - lamps, bulbs, lanterns and fixtures for interior, architectural and product visualization.'],
  'toys-games': ['🧸', 'Toys and games 3D models - figures, dice, board pieces and playful props for advertising, games and animation.'],
  'signage-decor': ['🪧', 'Signage and decor 3D models - signs, banners, frames and decorative objects for archviz, advertising and set dressing.'],
  'musical-instruments': ['🎸', 'Musical instrument 3D models - guitars, pianos, drums and more for film, music videos, games and product renders.'],
  'collections-sets': ['📚', 'Multi-model collections, sets, packs and bundles - grouped 3D assets that save time when dressing full scenes.'],
  'weapons': ['⚔️', 'Weapon 3D models - firearms, blades, munitions, armour and military-grade equipment for games, film, defense simulation and historical visualization.'],
  'tools': ['🔧', 'Tool 3D models - hand tools, power tools, gardening, cleaning, cutting and workshop equipment for industrial visualization, archviz and product rendering.'],
};

// ---- константы (header/footer) из vehicles ----
const refSrc = fs.readFileSync(path.join(CATEGORIES, 'vehicles', 'index.html'), 'utf8');
const HEADER = (refSrc.match(/<header id="site-header">[\s\S]*?<\/header>/) || [''])[0];
const FOOTER = (refSrc.match(/<footer class="cat-footer">[\s\S]*?<\/footer>/) || [''])[0];

function heroFor(cat, catDisp, count) {
  const file = path.join(CATEGORIES, cat, 'index.html');
  // существующая категория с курированным hero - переиспользуем
  if (fs.existsSync(file)) {
    const s = fs.readFileSync(file, 'utf8');
    const h = (s.match(/<section class="page-section page-section--border-bottom">[\s\S]*?<\/section>/) || [''])[0];
    // Hero переиспользуется целиком, вместе со счётчиком «Total Models» — а он
    // в нём захардкожен разметкой прошлой сборки. Число под сеткой пересчитывалось
    // каждый раз, а в шапке нет: у Weapons висело 2005 при реальных 1901, у
    // Architecture 1165 при 4450. Обновляем при переиспользовании.
    if (h) return h.replace(/(<div class="cat-stat-num">)[^<]*(<\/div>)/,
      (m, a, b) => a + count.toLocaleString('en-US') + b);
  }
  // новая категория - генерируем
  const [icon, desc] = HERO[cat] || ['🧩', `${catDisp} 3D models by 3D Molier. Real-world scale, clean topology, PBR materials, all popular formats.`];
  return `<section class="page-section page-section--border-bottom"><div class="max-w-7xl mx-auto"><div class="cat-hero"><div class="cat-hero-left"><div class="cat-hero-top"><div class="cat-hero-icon">${icon}</div><div><div class="section-label">3D Model Category</div><h1 class="cat-page-h1">${esc(catDisp)} 3D Models</h1></div></div><p class="cat-desc">${esc(desc)}</p><div class="cat-actions"><a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international" target="_blank" rel="noopener" class="btn-primary">Browse on TurboSquid</a> <a href="/" class="btn-ghost">&#8592; All Categories</a></div></div><div class="cat-stats"><div class="cat-stat-cell"><div class="cat-stat-num">${count.toLocaleString('en-US')}</div><div class="cat-stat-label">Total Models</div></div></div></div></div></section>`;
}

/*
 * Список моделей - ИЗ ЗАПИСЕЙ, а не из выгрузки каталога.
 *
 * ПОЧЕМУ ПЕРЕДЕЛАНО. Раньше хабы читали fc-chunk - выгрузку каталога
 * TurboSquid. Она обрывается на номере 2587532, и всё, что вышло позже, туда не
 * попадает: 581 новая карточка оказалась в каталоге сайта, но НИ В ОДНОМ хабе
 * категорий - внутренних ссылок на них не было вовсе.
 *
 * Это та же беда, ради которой затевалась единая запись, только этажом выше:
 * хаб держал свою копию правды о модели - имя, цену, снимок, категорию - и она
 * отставала от карточки.
 *
 * Категорию тоже отдаём из записи: у поля должен быть один хозяин.
 *
 * Запасной путь оставлен: нет записей - читаем выгрузку, как прежде, чтобы
 * скрипт не падал у того, кто записи ещё не собрал.
 */
function loadCatalog() {
  const RECS = path.join(DATA, 'records');
  const idxFile = path.join(RECS, 'index.json');
  if (fs.existsSync(idxFile)) {
    const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
    const all = [];
    const img = {};
    const catOf = {};
    for (let k = 0; k < idx.chunks; k++) {
      for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
        // Нет папки - нет страницы, в хабе показывать нечего.
        if (!DIR_BY_ID.has(String(r.id))) continue;
        all.push({
          id: r.id,
          name: r.display_name || r.name,
          price: r.price || 0,
          sales: r.sales || 0,
        });
        /*
         * Для плитки берём thumb, а не image.
         *
         * Плитка занимает 200-300 пикселей, а в image лежит кадр TurboSquid
         * 1920x1080 весом 171 КБ - и таких на страницах категорий около 63
         * тысяч. Меньших размеров TurboSquid не отдаёт (600x600 и ниже - 404),
         * зато у 89% карточек есть студийный снимок с готовыми копиями h200 и
         * h400. Поле thumb как раз про это: в записи оно уже выбрано.
         */
        if (r.thumb || r.image) img[r.id] = r.thumb || r.image;
        if (r.category) catOf[String(r.id)] = r.category;
      }
    }
    return { all, img, catOf };
  }

  const files = fs.readdirSync(DATA).filter(f => /^fc-chunk-\d+\.json$/.test(f));
  const all = [];
  for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(DATA, f))); for (let j = 0; j < d.i.length; j++) all.push({ id: d.i[j], name: d.n[j], price: d.p[j], sales: (d.s && d.s[j]) || 0 }); }
  const img = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^fc-img-chunk-\d+\.json$/.test(f))) { try { Object.assign(img, JSON.parse(fs.readFileSync(path.join(DATA, f)))); } catch {} }
  return { all, img, catOf: null };
}

// Первые карточки сетки - это и есть главный элемент первого экрана (LCP).
// Они грузились с loading="lazy", и браузер начинал качать их только после
// раскладки: Lighthouse ругался «LCP image was lazily loaded» на 181 странице
// из 200, медиана LCP была 4.8 с, у худших страниц 7.2 с. Верхнему ряду ставим
// eager + высокий приоритет, остальным оставляем lazy.
const EAGER_CARDS = 4;

/*
 * Уменьшенная копия студийного снимка для плитки.
 *
 * Плитка на экране 200-300 пикселей. Студия отдаёт готовые копии по высоте:
 * h200 (5 КБ) и h400 (12 КБ) - вместо 303 КБ оригинала. Чужие адреса
 * (TurboSquid) оставляем как есть: меньших размеров у них нет, 600x600 и ниже
 * отдают 404.
 */
const STUDIO = 'https://www.3dmolier-studio.com/assets/';
const small = (u, tag) => (String(u || '').startsWith(STUDIO)
  ? 'https://www.3dmolier-studio.com/images/' + tag + '/assets/' + String(u).slice(STUDIO.length)
  : u);

function card(m, catDisp, i = 99) {
  const slug = DIR_BY_ID.get(String(m.id)) || (slugify(m.name) + '-' + m.id);
  /*
   * Высокий приоритет - ТОЛЬКО первой карточке.
   *
   * Раньше его получали четыре: они соревновались друг с другом за канал, и
   * настоящий главный элемент первого экрана приезжал не быстрее, а медленнее.
   * Первая карточка грузится жадно и с высоким приоритетом, следующие три -
   * жадно, но обычным приоритетом, остальные лениво.
   */
  const eager = i < EAGER_CARDS;
  const loadAttrs = i === 0 ? 'loading="eager" fetchpriority="high"'
    : (eager ? 'loading="eager"' : 'loading="lazy"');
  return `      <a href="/models/${slug}/" class="model-card card-glow">
        <div class="img-wrap mc-img"><img src="${small(m.img, 'h400')}" alt="${esc(m.name)} 3D model preview" width="800" height="450" decoding="async" ${loadAttrs} data-fallback="${m.img}" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)"><div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">${esc(catDisp)}</span></div></div>
        <div class="mc-body">
          <div class="mc-meta"><h3 class="mc-title">${esc(m.name)}</h3></div>
          <div class="mc-foot"><span class="chip mc-chip">${esc(catDisp)}</span><span class="mc-price">$${m.price}</span></div>
        </div>
      </a>`;
}

function pagination(cat, page, total) {
  const url = n => n === 1 ? `/categories/${cat}/` : `/categories/${cat}/page/${n}/`;
  const parts = [];
  parts.push(page > 1 ? `<a href="${url(page - 1)}" class="cat-pg-link" rel="prev">&#8592; Prev</a>` : `<span class="cat-pg-link cat-pg-disabled">&#8592; Prev</span>`);
  const set = new Set([1, 2, total, total - 1, page, page - 1, page + 1, page - 2, page + 2].filter(n => n >= 1 && n <= total));
  const nums = [...set].sort((a, b) => a - b);
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) parts.push(`<span class="cat-pg-ellipsis">…</span>`);
    parts.push(n === page ? `<span class="cat-pg-num cat-pg-current">${n}</span>` : `<a href="${url(n)}" class="cat-pg-num">${n}</a>`);
    prev = n;
  }
  parts.push(page < total ? `<a href="${url(page + 1)}" class="cat-pg-link" rel="next">Next &#8594;</a>` : `<span class="cat-pg-link cat-pg-disabled">Next &#8594;</span>`);
  return `<nav class="cat-pagination" aria-label="Category pages"><div class="max-w-7xl mx-auto">${parts.join('\n')}</div></nav>`;
}

function itemListSchema(cat, catDisp, page, models) {
  const base = 'https://3dmolierstudio.com';
  const url = page === 1 ? `${base}/categories/${cat}/` : `${base}/categories/${cat}/page/${page}/`;
  const items = models.map((m, i) => ({ '@type': 'ListItem', position: (page - 1) * PERPAGE + i + 1, name: m.name, url: `${base}/models/${slugify(m.name)}-${m.id}/` }));
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: `${catDisp} 3D Models`, url, numberOfItems: items.length, itemListElement: items })}</script>`;
}

function renderPage(cat, catDisp, page, total, models, heroHtml, totalCount) {
  const base = 'https://3dmolierstudio.com';
  const canonical = page === 1 ? `${base}/categories/${cat}/` : `${base}/categories/${cat}/page/${page}/`;
  const title = (page === 1 ? `${catDisp} 3D Models` : `${catDisp} 3D Models - Page ${page}`) + ' | 3D Molier';
  const relLinks = [
    page > 1 ? `<link rel="prev" href="${page - 1 === 1 ? base + '/categories/' + cat + '/' : base + '/categories/' + cat + '/page/' + (page - 1) + '/'}">` : '',
    page < total ? `<link rel="next" href="${base}/categories/${cat}/page/${page + 1}/">` : '',
  ].filter(Boolean).join('\n');
  const bcCurrent = page === 1 ? esc(catDisp) : `<a href="/categories/${cat}/" class="bc-link">${esc(catDisp)}</a> <span class="bc-sep">&#8250;</span> Page ${page}`;
  const cards = models.map((m, i) => card(m, catDisp, i)).join('\n');
  // Предзагрузка самой верхней картинки сетки: браузер начинает качать её из
  // <head>, не дожидаясь разбора разметки и раскладки. Вместе с eager это и
  // лечит LCP - он упирался именно в первую карточку.
  const preload = models.length
    ? `<link rel="preload" as="image" href="${small(models[0].img, 'h400')}" fetchpriority="high">`
    : '';
  // Хабы категорий уходили в соцсети и мессенджеры голыми: ни заголовка, ни
  // картинки в развороте ссылки. Тысяча с лишним страниц - и ни одной с
  // Open Graph. Картинку берём первую из сетки: она про эту категорию, а не
  // общая заставка сайта.
  const ogImg = models.length && /^https?:/.test(models[0].img)
    ? models[0].img
    : (models.length ? base + models[0].img : base + '/assets/og/3d-molier-og.jpg');
  const ogDesc = `Browse ${catDisp} 3D models by 3D Molier. Real-world scale, clean topology, PBR materials, all popular formats.`;
  const social = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(ogDesc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:site_name" content="3D Molier Models">`,
    `<meta property="og:image" content="${esc(ogImg)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@3dmolier">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(ogDesc)}">`,
    `<meta name="twitter:image" content="${esc(ogImg)}">`,
  ].join('\n');
  // Дорожка «Home > Categories > ...» на странице была, а разметки под неё не
  // было - в выдаче путь не показывался.
  const bcItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
    { '@type': 'ListItem', position: 2, name: 'Categories', item: base + '/catalog/' },
    { '@type': 'ListItem', position: 3, name: catDisp + ' 3D Models', item: base + '/categories/' + cat + '/' },
  ];
  if (page > 1) bcItems.push({ '@type': 'ListItem', position: 4, name: 'Page ' + page, item: canonical });
  const bcSchema = '<script type="application/ld+json">'
    + JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: bcItems })
    + '</script>';
  const h2 = page === 1 ? `Best ${esc(catDisp)} 3D Models` : `${esc(catDisp)} 3D Models - Page ${page} of ${total}`;
  const rangeFrom = (page - 1) * PERPAGE + 1, rangeTo = (page - 1) * PERPAGE + models.length;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="Browse ${esc(catDisp)} 3D models by 3D Molier. Real-world scale, clean topology, PBR materials, all popular formats. Page ${page} of ${total}.">
<link rel="canonical" href="${canonical}">
${social}
${preload}
${relLinks}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>.cat-pagination{margin:40px 0 8px}.cat-pagination>div{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}.cat-pg-link,.cat-pg-num{display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:40px;padding:0 12px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:14px;font-weight:600;color:inherit;text-decoration:none}.cat-pg-num:hover,.cat-pg-link:hover{border-color:rgba(0,0,0,.35)}.cat-pg-current{background:#111;color:#fff;border-color:#111}.cat-pg-disabled{opacity:.4}.cat-pg-ellipsis{padding:0 4px;opacity:.5}.cat-pg-total{font-size:13px;opacity:.6}@media(prefers-color-scheme:dark){.cat-pg-link,.cat-pg-num{border-color:rgba(255,255,255,.18)}.cat-pg-current{background:#fff;color:#111;border-color:#fff}}</style>
${itemListSchema(cat, catDisp, page, models)}
${bcSchema}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GDY5KTLBP1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GDY5KTLBP1');</script>
</head>
<body class="relative min-h-screen">
<a href="#main-content" class="skip-link">Skip to content</a>
${HEADER}
<main id="main-content" class="cat-main">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/catalog/" class="bc-link">Categories</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">${bcCurrent}</span></div></div>
${page === 1 ? heroHtml : ''}
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">${esc(catDisp)}</div>${
  /*
   * На первой странице заголовок H1 стоит в шапке категории, поэтому здесь
   * достаточно H2. На страницах со второй и дальше шапки нет - и H1 не было
   * вовсе: 542 индексируемые страницы уходили в поиск без главного заголовка.
   * Ставим H1 именно там, где он отсутствует, а не добавляем второй.
   * Класс оставляем прежний: вид страницы не меняется, меняется смысл разметки.
   */
  page === 1 ? `<h2 class="section-h2">${h2}</h2>` : `<h1 class="section-h2">${h2}</h1>`
}</div><span class="cat-pg-total">${rangeFrom}-${rangeTo} of ${totalCount.toLocaleString('en-US')}</span></div>
    <div id="model-grid" class="model-grid">
${cards}
    </div>
    ${pagination(cat, page, total)}
  </div>
</section>
</main>
${FOOTER}
<script src="/assets/js/site.min.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

function buildCategory(cat, all, img, catOf) {
  const catDisp = dispOf[cat] || cat;
  let list = [];
  for (const m of all) {
    // Категория из записи, если она есть: там у поля один хозяин.
    // Вычисление остаётся запасным - для прогона без записей.
    const mcat = (catOf && catOf[String(m.id)]) || classify(m.name, m.id);
    if (mcat !== cat) continue;
    // Модель без превью раньше просто выбрасывалась из категории: 60 живых
    // карточек не показывались нигде, а счётчик расходился с источником.
    // У сайта есть своя заглушка для картинки - ставим её.
    // Адрес карточки берём из СУЩЕСТВУЮЩЕЙ папки, а не вычисляем из названия.
    // Вычисленный не совпадал у 372 моделей, и они молча выпадали из своей
    // категории: страница их не показывала, а счётчик не считал.
    const slug = DIR_BY_ID.get(String(m.id));
    if (!slug) continue;
    list.push({ ...m, img: img[m.id] || PLACEHOLDER });
  }
  // Сортировка по продажам, а не по цене. По цене наверх вылезали самые дорогие
  // товары - а это сложные СЦЕНЫ из многих объектов с нулём продаж: в «Nature &
  // Plants» первыми шли «Pirate Treasure Cave» и «Marine Shipwreck», в «Furniture
  // & Interior» - «Operating Room with People». Сцена приписана к категории по
  // одному из объектов внутри, и для посетителя первый экран выглядел мусорным.
  // По продажам наверх выходит типовой предмет категории: у Nature & Plants это
  // Orchid Flower и Cherry Leaf, у Kitchen - Silverware Set и Solo Cup.
  list.sort((a, b) => (b.sales - a.sales) || (b.price - a.price));
  const total = Math.max(1, Math.ceil(list.length / PERPAGE));
  const heroHtml = heroFor(cat, catDisp, list.length);
  for (let page = 1; page <= total; page++) {
    const models = list.slice((page - 1) * PERPAGE, page * PERPAGE);
    const html = renderPage(cat, catDisp, page, total, models, heroHtml, list.length);
    const dir = page === 1 ? path.join(CATEGORIES, cat) : path.join(CATEGORIES, cat, 'page', String(page));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  return { cat, models: list.length, pages: total };
}

function main() {
  const one = process.argv[2];
  const { all, img, catOf } = loadCatalog();
  const cats = one ? [one] : ALL_SLUGS;
  let totalPages = 0;
  const counts = {};
  for (const cat of cats) {
    const r = buildCategory(cat, all, img, catOf);
    totalPages += r.pages;
    counts[r.cat] = r.models;
    console.error(`  ${r.cat.padEnd(24)} ${String(r.models).padStart(6)} моделей → ${r.pages} стр.`);
  }
  console.error(`\nИтого категорий: ${cats.length}, страниц: ${totalPages}.`);
  /*
   * Счётчики категорий ЗДЕСЬ НЕ ПИШЕМ.
   *
   * Раньше писали - и файл data/category-counts.json оказался с двумя авторами:
   * build-taxonomy.mjs считал живые карточки на диске (54 025), а этот хаб -
   * только те, что попали в его выборку (53 595). Кто запускался последним, тот
   * и оставлял свои числа, поэтому главная, каталог и страницы категорий
   * показывали разное. Валидатор ловил это то первой проверкой, то второй.
   *
   * Сверенная с диском правда - у build-taxonomy.mjs: сумма его чисел совпадает
   * с числом живых карточек ровно. Здесь мы файл только ЧИТАЕМ, а расхождение
   * своей выборки с ним печатаем, чтобы оно не осталось незамеченным.
   */
  if (!one) {
    const f = path.join(ROOT, 'data', 'category-counts.json');
    if (fs.existsSync(f)) {
      const src = JSON.parse(fs.readFileSync(f, 'utf8')).counts || {};
      const diff = Object.keys(counts).filter(k => src[k] !== undefined && src[k] !== counts[k]);
      if (diff.length) {
        console.error('\nВНИМАНИЕ: выборка хаба расходится с data/category-counts.json у ' + diff.length + ' категорий:');
        diff.slice(0, 6).forEach(k => console.error('   ' + k + ': хаб ' + counts[k] + ', источник ' + src[k]));
        console.error('источник считает живые карточки на диске - при расхождении прав он.');
      }
    }
  }
}
main();
