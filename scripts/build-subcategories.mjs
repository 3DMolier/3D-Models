/*
 * build-subcategories.mjs - страницы подкатегорий.
 *
 * ЗАЧЕМ. Сейчас между «Категории» и карточкой модели нет ни одной ступени:
 * категория «Aircraft» содержит 1 421 модель, и человек, который ищет именно
 * вертолёт, листает её вручную. Поиску тоже нечего показать по запросу
 * «helicopter 3d models» - страницы с таким смыслом на сайте нет, есть только
 * общий «Aircraft». Подкатегория закрывает и то и другое: и запрос, и путь.
 *
 * ОТБОР МОДЕЛЕЙ. По целым словам из названия, список слов - в
 * scripts/subcategories.mjs, собран руками. Совпадение по подстроке не
 * годится: «bus» поймал бы «business», «sub» - «substation». Модель может
 * попасть в две подкатегории (грузовик-эвакуатор это и truck, и trailer) -
 * это нормально, страницы всё равно разные и списки не совпадают.
 *
 * ТОНКИЕ СТРАНИЦЫ НЕ ДЕЛАЕМ. Меньше MIN_MODELS моделей - подкатегории нет.
 * Полупустая страница хуже, чем её отсутствие: она разбавляет категорию и
 * ничего не отвечает.
 *
 * Разметка, пагинация и разметка данных - те же, что у категорий; шапка и
 * подвал берутся из partials/, а версии стилей - с живой страницы категории,
 * чтобы не откатить их назад.
 *
 * Запуск:  node scripts/build-subcategories.mjs --dry
 *          node scripts/build-subcategories.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { SUBCATS, MIN_MODELS } from './subcategories.mjs';
import { nameOf } from './lib/taxonomy.mjs';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const CATEGORIES = path.join(ROOT, 'categories');
const MODELS = path.join(ROOT, 'models');
const BASE = 'https://3dmolierstudio.com';
const PERPAGE = 100;
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

// ── чужое, что нельзя расходиться: шапка, подвал, версии файлов ──
const header = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8');
const footerTpl = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8');
const footer = footerTpl.replace('<!--MP_FOOTER_BACK-->', '');
const donor = fs.readFileSync(path.join(CATEGORIES, 'vehicles', 'index.html'), 'utf8');
const verOf = name => {
  const m = donor.match(new RegExp(name.replace(/[.]/g, '\\.') + '\\?v=(\\d+)'));
  return m ? m[1] : '1';
};
const V_STYLES = verOf('styles.min.css');
const V_FONTS = verOf('fonts.css');
const V_CRIT = verOf('critical-fonts.css');
const V_SITE = verOf('site.min.js');

// ── данные каталога ──
const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const cats = idx.cats || [];
const imgChunkCache = new Map();
function imgFor(model) {
  if (model.ic < 0) return '';
  if (!imgChunkCache.has(model.ic)) {
    const f = path.join(DATA, 'fc-img-chunk-' + model.ic + '.json');
    imgChunkCache.set(model.ic, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
  }
  return imgChunkCache.get(model.ic)[String(model.id)] || '';
}

const byCat = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const g = c.g[j];
    if (g < 0) continue;
    const slug = cats[g];
    if (!byCat.has(slug)) byCat.set(slug, []);
    byCat.get(slug).push({ id: c.i[j], name: c.n[j], price: c.p[j], sales: c.s[j], ic: c.ic ? c.ic[j] : -1 });
  }
}

// Имя категории берём из единого источника, а не с её страницы. Читать H1
// значит заводить ещё одно мнение: у категории ships заголовок когда-то
// говорил «Ship & Boat», а чип в сетке - «Ships».
function catTitle(slug) { return nameOf(slug); }

// Совпадение по целому слову: «bus» не должен ловить «business».
function makeMatcher(terms, not) {
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^a-z0-9])(' + terms.map(esc).join('|') + ')([^a-z0-9]|$)', 'i');
  const noRe = (not && not.length)
    ? new RegExp('(^|[^a-z0-9])(' + not.map(esc).join('|') + ')([^a-z0-9]|$)', 'i') : null;
  return name => re.test(name) && !(noRe && noRe.test(name));
}

// ── разметка ──
// Чип на карточке показывает КАТЕГОРИЮ модели, а не подкатегорию. Подкатегория
// - это название самой страницы, и повторять его на каждой из ста карточек
// незачем; категория добавляет то, чего на странице ещё нет. Плюс так чип
// приходит из единого источника, как и везде.
function card(m, chip, i) {
  const loadAttrs = i < 4 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const url = '/models/' + slugify(m.name) + '-' + m.id + '/';
  const img = m.img || PLACEHOLDER;
  return `      <a href="${url}" class="model-card card-glow">
        <div class="img-wrap mc-img"><img src="${img}" alt="${esc(m.name)} 3D model preview" width="800" height="450" decoding="async" ${loadAttrs} data-fallback="${img}" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)"><div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">${esc(chip)}</span></div></div>
        <div class="mc-body">
          <div class="mc-meta"><h3 class="mc-title">${esc(m.name)}</h3></div>
          <div class="mc-foot"><span class="chip mc-chip">${esc(chip)}</span><span class="mc-price">$${m.price}</span></div>
        </div>
      </a>`;
}

function urlFor(cat, sub, n) {
  return n === 1 ? `/categories/${cat}/${sub}/` : `/categories/${cat}/${sub}/page/${n}/`;
}

function pagination(cat, sub, page, total) {
  const u = n => urlFor(cat, sub, n);
  const parts = [];
  parts.push(page > 1 ? `<a href="${u(page - 1)}" class="cat-pg-link" rel="prev">&#8592; Prev</a>` : `<span class="cat-pg-link cat-pg-disabled">&#8592; Prev</span>`);
  const set = new Set([1, 2, total, total - 1, page, page - 1, page + 1].filter(n => n >= 1 && n <= total));
  let prev = 0;
  for (const n of [...set].sort((a, b) => a - b)) {
    if (n - prev > 1) parts.push('<span class="cat-pg-ellipsis">…</span>');
    parts.push(n === page ? `<span class="cat-pg-num cat-pg-current">${n}</span>` : `<a href="${u(n)}" class="cat-pg-num">${n}</a>`);
    prev = n;
  }
  parts.push(page < total ? `<a href="${u(page + 1)}" class="cat-pg-link" rel="next">Next &#8594;</a>` : `<span class="cat-pg-link cat-pg-disabled">Next &#8594;</span>`);
  return `<nav class="cat-pagination" aria-label="Subcategory pages"><div class="max-w-7xl mx-auto">${parts.join('\n')}</div></nav>`;
}

const PG_CSS = '<style>.cat-pagination{margin:40px 0 8px}.cat-pagination>div{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}.cat-pg-link,.cat-pg-num{display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:40px;padding:0 12px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:14px;font-weight:600;color:inherit;text-decoration:none}.cat-pg-num:hover,.cat-pg-link:hover{border-color:rgba(0,0,0,.35)}.cat-pg-current{background:#111;color:#fff;border-color:#111}.cat-pg-disabled{opacity:.4}.cat-pg-ellipsis{padding:0 4px;opacity:.5}.cat-pg-total{font-size:13px;opacity:.6}.sub-links{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0}.sub-link{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid rgba(0,0,0,.12);border-radius:999px;font-size:14px;text-decoration:none;color:inherit}.sub-link:hover{border-color:rgba(0,0,0,.4)}.sub-link .sub-n{opacity:.55;font-size:12px}@media(prefers-color-scheme:dark){.cat-pg-link,.cat-pg-num,.sub-link{border-color:rgba(255,255,255,.18)}.cat-pg-current{background:#fff;color:#111;border-color:#fff}}</style>';

function renderPage(o) {
  const { cat, catDisp, sub, subDisp, page, totalPages, models, totalCount, siblings } = o;
  const canonical = BASE + urlFor(cat, sub, page);
  const name = subDisp + ' 3D Models';
  const title = (page === 1 ? name : `${name} - Page ${page}`) + ' | 3D Molier';
  // Описание собираем по частям и добираем до разумной длины. Поисковая выдача
  // показывает примерно 155 знаков; короче 120 - место потрачено зря, длиннее
  // 158 - хвост обрежут на полуслове. Названия подкатегорий разной длины, так
  // что одной строкой-шаблоном в этот коридор не попасть.
  const desc = (() => {
    const lead = page === 1
      ? `Browse ${totalCount.toLocaleString('en-US')} ${subDisp.toLowerCase()} 3D models by 3D Molier.`
      : `${subDisp} 3D models by 3D Molier - page ${page} of ${totalPages}.`;
    const extras = [
      ' Real-world scale, clean topology and PBR materials.',
      ' Every popular format included.',
      ` Part of the ${catDisp} category.`,
    ];
    let s = lead;
    for (const e of extras) {
      if ((s + e).length > 158) break;
      s += e;
    }
    return s;
  })();
  const rel = [
    page > 1 ? `<link rel="prev" href="${BASE + urlFor(cat, sub, page - 1)}">` : '',
    page < totalPages ? `<link rel="next" href="${BASE + urlFor(cat, sub, page + 1)}">` : '',
  ].filter(Boolean).join('\n');
  const ogImg = models.length && /^https?:/.test(models[0].img) ? models[0].img : BASE + PLACEHOLDER;
  const social = [
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    '<meta property="og:site_name" content="3D Molier Models">',
    `<meta property="og:image" content="${esc(ogImg)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:site" content="@3dmolier">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(ogImg)}">`,
  ].join('\n');
  const items = models.map((m, i) => ({
    '@type': 'ListItem', position: (page - 1) * PERPAGE + i + 1, name: m.name,
    url: BASE + '/models/' + slugify(m.name) + '-' + m.id + '/',
  }));
  const listSchema = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ItemList', name, url: canonical,
    numberOfItems: items.length, itemListElement: items,
  }) + '</script>';
  const bcItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Categories', item: BASE + '/categories/' },
    { '@type': 'ListItem', position: 3, name: catDisp + ' 3D Models', item: BASE + '/categories/' + cat + '/' },
    { '@type': 'ListItem', position: 4, name, item: BASE + urlFor(cat, sub, 1) },
  ];
  if (page > 1) bcItems.push({ '@type': 'ListItem', position: 5, name: 'Page ' + page, item: canonical });
  const bcSchema = '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: bcItems,
  }) + '</script>';

  // Соседние подкатегории - живая перелинковка вбок, а не только вверх.
  const sibHtml = siblings.length
    ? `<div class="sub-links">${siblings.map(s => s.slug === sub
      ? `<span class="sub-link" aria-current="page"><b>${esc(s.title)}</b> <span class="sub-n">${s.n}</span></span>`
      : `<a href="/categories/${cat}/${s.slug}/" class="sub-link">${esc(s.title)} <span class="sub-n">${s.n}</span></a>`).join('')}</div>`
    : '';

  const rangeFrom = (page - 1) * PERPAGE + 1, rangeTo = (page - 1) * PERPAGE + models.length;
  const bcCurrent = page === 1
    ? esc(name)
    : `<a href="${urlFor(cat, sub, 1)}" class="bc-link">${esc(name)}</a> <span class="bc-sep">&#8250;</span> Page ${page}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${social}
${models.length ? `<link rel="preload" as="image" href="${esc(models[0].img || PLACEHOLDER)}" fetchpriority="high">` : ''}
${rel}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=${V_CRIT}">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=${V_STYLES}">
<link rel="stylesheet" href="/assets/css/fonts.css?v=${V_FONTS}">
${PG_CSS}
${listSchema}
${bcSchema}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GDY5KTLBP1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GDY5KTLBP1');</script>
</head>
<body class="relative min-h-screen">
${header}
<main class="cat-main">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/categories/" class="bc-link">Categories</a> <span class="bc-sep">&#8250;</span> <a href="/categories/${cat}/" class="bc-link">${esc(catDisp)}</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">${bcCurrent}</span></div></div>
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">${esc(catDisp)}</div><h1 class="section-h2">${esc(page === 1 ? name : name + ' - Page ' + page)}</h1></div><span class="cat-pg-total">${rangeFrom}-${rangeTo} of ${totalCount.toLocaleString('en-US')}</span></div>
    ${page === 1 ? `<p class="cat-desc">${esc(desc)}</p>` : ''}
    ${sibHtml}
    <div id="model-grid" class="model-grid">
${models.map((m, i) => card(m, catDisp, i)).join('\n')}
    </div>
    ${pagination(cat, sub, page, totalPages)}
  </div>
</section>
</main>
${footer}
<script src="/assets/js/site.min.js?v=${V_SITE}" defer></script>
</body>
</html>`;
}

// ── сборка ──
const built = [];
let skipped = 0;
for (const [cat, subs] of Object.entries(SUBCATS)) {
  if (ONLY && ONLY !== cat) continue;
  const pool = byCat.get(cat) || [];
  if (!pool.length) { console.log('нет моделей в категории ' + cat); continue; }
  const catDisp = catTitle(cat);

  // Сначала считаем всё, потом решаем, что строить: соседние ссылки должны
  // знать про все подкатегории с их числами.
  const picked = [];
  for (const s of subs) {
    const match = makeMatcher(s.terms, s.not);
    const list = pool.filter(m => match(m.name))
      .map(m => ({ ...m, img: imgFor(m) }))
      // Без карточки на диске ссылка вела бы в никуда.
      .filter(m => fs.existsSync(path.join(MODELS, slugify(m.name) + '-' + m.id, 'index.html')));
    list.sort((a, b) => (b.sales - a.sales) || (b.price - a.price));
    if (list.length < MIN_MODELS) { skipped++; console.log('  пропуск ' + cat + '/' + s.slug + ': всего ' + list.length + ', нужно ' + MIN_MODELS); continue; }
    picked.push({ ...s, list });
  }
  const siblings = picked.map(s => ({ slug: s.slug, title: s.title, n: s.list.length }));

  for (const s of picked) {
    const totalPages = Math.max(1, Math.ceil(s.list.length / PERPAGE));
    for (let page = 1; page <= totalPages; page++) {
      const models = s.list.slice((page - 1) * PERPAGE, page * PERPAGE);
      const html = renderPage({
        cat, catDisp, sub: s.slug, subDisp: s.title, page, totalPages, models,
        totalCount: s.list.length, siblings,
      });
      const dir = page === 1
        ? path.join(CATEGORIES, cat, s.slug)
        : path.join(CATEGORIES, cat, s.slug, 'page', String(page));
      if (!DRY) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), html); }
    }
    built.push({ cat, sub: s.slug, title: s.title, n: s.list.length, pages: totalPages });
    console.log('  ' + cat + '/' + s.slug + ': ' + s.list.length + ' моделей, ' + totalPages + ' стр.');
  }
}

if (!DRY) {
  fs.writeFileSync(path.join(DATA, 'subcategories.json'), JSON.stringify(built, null, 1));
}
console.log('\nподкатегорий построено: ' + built.length + ', пропущено как тонкие: ' + skipped);
console.log('страниц всего: ' + built.reduce((s, b) => s + b.pages, 0)
  + ', моделей охвачено: ' + built.reduce((s, b) => s + b.n, 0));
if (DRY) console.log('(--dry, ничего не записано)');
