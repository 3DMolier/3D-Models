/*
 * build-industries-hub.mjs - корневая страница раздела /industries/.
 *
 * Зачем. Двенадцать отраслевых страниц существовали с самого начала, а входа в
 * раздел не было: /industries/ отдавал 404. При этом карта сайта звала обход
 * именно туда (исправлено в refresh-sitemaps.mjs), а в шапке сайта пункт
 * «Industries» открывает список, но сам никуда не ведёт. Ahrefs нашёл эту 404
 * при обходе 19.08.2026.
 *
 * Как. Шапку и подвал берём из готовой страницы /collections/ - это такой же
 * корень раздела, и копирование гарантирует, что навигация, подвал и версии
 * стилей совпадают с остальным сайтом. Сочиняем только середину.
 *
 * Названия и краткие описания отраслей берём из меню в шапке: они уже написаны
 * и уже показываются пользователю, незачем заводить второй список, который
 * разъедется с первым.
 *
 * Запуск:  node build-industries-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const SRC = path.join(ROOT, 'collections', 'index.html');
const OUT_DIR = path.join(ROOT, 'industries');
const OUT = path.join(OUT_DIR, 'index.html');
const BASE = 'https://3dmolierstudio.com';

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const donor = fs.readFileSync(SRC, 'utf8');

// Шапка: от <body ...> до </header> включительно. Подвал: от </main> до конца.
const headerMatch = donor.match(/<body[^>]*>([\s\S]*?<\/header>)/);
if (!headerMatch) { console.error('не нашёл шапку в ' + SRC); process.exit(1); }
const header = headerMatch[1];
const footer = donor.slice(donor.indexOf('</main>') + '</main>'.length);
const bodyClass = (donor.match(/<body([^>]*)>/) || [, ''])[1];

// Отрасли читаем из меню шапки: имя, адрес и подпись уже есть там.
const items = [];
const menu = (header.match(/id="nav-industries-menu"[\s\S]*?<\/div>/) || [''])[0];
for (const m of menu.matchAll(/<a href="\/industries\/([^/]+)\/"[^>]*>[\s\S]*?<span class="mega-name">([^<]+)<\/span>[\s\S]*?<span class="mega-desc">([^<]*)<\/span>/g)) {
  items.push({ slug: m[1], name: m[2], desc: m[3] });
}
if (items.length < 5) { console.error('в меню нашлось всего ' + items.length + ' отраслей, останавливаюсь'); process.exit(1); }

// Страница отрасли должна существовать: иначе хаб сам станет источником 404.
const live = items.filter(i => {
  const ok = fs.existsSync(path.join(OUT_DIR, i.slug, 'index.html'));
  if (!ok) console.log('  пропускаю ' + i.slug + ': страницы нет на диске');
  return ok;
});

// Заголовок каждой карточки берём из самой страницы отрасли - там он уже
// выверен, и хаб не будет расходиться с тем, куда ведёт.
for (const it of live) {
  const html = fs.readFileSync(path.join(OUT_DIR, it.slug, 'index.html'), 'utf8');
  const h1 = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1];
  const d = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  it.h1 = h1 ? h1.trim() : it.name + ' 3D Models';
  // Для карточки нужна короткая строка, а не всё описание: берём первое предложение.
  it.long = d ? d.split(/(?<=\.)\s/)[0].trim() : '';
}

/*
 * Обложка отрасли - номер модели, которая её показывает.
 *
 * Список рукописный. По продажам почти во всех отраслях наверху одно и то же -
 * бейсболка, Tesla и орхидея: они продаются везде и ни одну отрасль не
 * характеризуют. Человеку, выбирающему «оборону» или «медицину», нужен
 * предмет из его работы, а не общий бестселлер.
 */
const COVER = {
  'aerospace': 1230754,              // Airbus A320 Generic
  'military-defense': 1031832,       // M1 Abrams
  'medical': 1467539,                // Male Full Body Anatomy and Skin
  'game-development': 1089639,       // Diver Rigged - персонаж под движок
  'film-video-production': 1000193,  // Splashed Out Liquid - кадр для рекламы
  'architecture': 1625177,           // Eiffel Tower
  'virtual-reality': 982317,         // Centipede Warm Season Grass - окружение
  'advertising': 1485059,            // Ice Cream Cone - предметная съёмка
  'software-development': 991157,    // Generic Laptop 10
  'event-management': 1398430,       // Santa Sleigh
  'hardware': 1500054,               // Black Smartphone
  'simulation': 1211595,             // F-35 Lightning II
  '3d-printing': 1092671,            // Apple AirPods Set
};

const coverImg = (() => {
  const want = new Set(Object.values(COVER).map(String));
  const out = {};
  try {
    const RD = path.join(ROOT, 'data', 'records');
    const idx = JSON.parse(fs.readFileSync(path.join(RD, 'index.json'), 'utf8'));
    for (let k = 0; k < idx.chunks; k++) {
      for (const r of JSON.parse(fs.readFileSync(path.join(RD, `records-${k}.json`), 'utf8'))) {
        if (want.has(String(r.id)) && r.image) out[String(r.id)] = { img: r.image, name: r.name };
      }
    }
  } catch (e) { console.log('записи недоступны, обложек не будет: ' + e.message); }
  return out;
})();

const cards = live.map((i, n) => {
  const c = coverImg[String(COVER[i.slug])];
  const load = n < 4 ? 'decoding="async"' : 'loading="lazy" decoding="async"';
  const cover = c
    ? `<div class="ind-hub-cover"><img src="${esc(c.img)}" alt="${esc(c.name)} - a 3D model used in ${esc(i.h1.replace(/ 3D Models?$/i, ''))}" width="800" height="450" ${load} data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)"></div>`
    : '';
  return `<a class="ind-hub-card" href="/industries/${i.slug}/">`
    + cover
    + '<div class="ind-hub-text">'
    + `<div class="ind-hub-name">${esc(i.h1)}</div>`
    + `<div class="ind-hub-desc">${esc(i.long || i.desc)}</div>`
    + `<div class="ind-hub-tag">${esc(i.desc)}</div>`
    + '</div></a>';
}).join('');

const itemList = {
  '@context': 'https://schema.org', '@type': 'ItemList',
  name: '3D Models by Industry', url: BASE + '/industries/',
  numberOfItems: live.length,
  itemListElement: live.map((i, n) => ({
    '@type': 'ListItem', position: n + 1, name: i.h1, url: BASE + '/industries/' + i.slug + '/',
  })),
};
const breadcrumb = {
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Industries', item: BASE + '/industries/' },
  ],
};

const title = '3D Models by Industry - Aerospace, Medical, Games &amp; More | 3D Molier';
const desc = 'Find 3D models by the work you do: aerospace, medical, game development, film production, architecture, VR and more. '
  + live.length + ' industry guides pointing to the right part of the catalog.';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${BASE}/industries/">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${BASE}/industries/">
<meta property="og:image" content="${BASE}/assets/og/3d-molier-og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=38">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>
.ind-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;margin:28px 0}
.ind-hub-card{display:block;border:1px solid rgba(0,0,0,.12);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit}
.ind-hub-card:hover{border-color:rgba(0,0,0,.4)}
/* Квадрат и вписывание - как на обложках категорий и подборок. */
.ind-hub-cover{aspect-ratio:1/1;background:#f3f4f6;overflow:hidden}
.ind-hub-cover img{width:100%;height:100%;object-fit:contain;display:block}
.ind-hub-text{padding:18px 20px}
.ind-hub-name{font-weight:700;font-size:16px;margin-bottom:6px}
.ind-hub-desc{font-size:14px;line-height:1.55;opacity:.8}
.ind-hub-tag{font-size:12px;opacity:.55;margin-top:10px;text-transform:lowercase}
.ind-hub-note{font-size:14px;opacity:.8;max-width:70ch;line-height:1.6}
@media(prefers-color-scheme:dark){.ind-hub-card{border-color:rgba(255,255,255,.18)}.ind-hub-card:hover{border-color:rgba(255,255,255,.45)}.ind-hub-cover{background:#1f2229}}
</style>
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
</head>
<body${bodyClass}>
${header}
<main class="cat-main" id="main-content">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">Industries</span></div></div>
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">Browse by Field of Work</div>
    <h1 class="cat-page-h1">3D Models by Industry</h1>
    <p class="ind-hub-note">The catalog is sorted by what a model <em>is</em> - a vehicle, a building, an organ. These pages sort it by what you <em>do</em> with it. Each one gathers the categories, formats and certification levels that matter for a particular kind of work, so you start from your own job rather than from our filing system.</p>
    <div class="ind-hub-grid">${cards}</div>
    <p class="ind-hub-note">Not sure which fits? The <a href="/catalog/">catalog</a> holds every model in one searchable list, and <a href="/categories/">categories</a> sort them by subject. For a model that does not exist yet, we build it: see <a href="/custom-order/">custom orders</a>.</p>
  </div>
</section>
</main>
${footer}`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('готово: /industries/ собрана из ' + live.length + ' отраслей, ' + Math.round(html.length / 1024) + ' КБ');
