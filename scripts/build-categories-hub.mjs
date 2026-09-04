/*
 * build-categories-hub.mjs - корневая страница раздела /categories/.
 *
 * Зачем. Двадцать шесть страниц категорий есть, а входа в раздел не было:
 * /categories/ отдавал 404. Причём ссылку на этот адрес ставит сама страница
 * /industries/ («categories sort them by subject»), то есть сайт вёл посетителя
 * в тупик. Найдено при аудите 26.08.2026.
 *
 * Как. Тем же способом, что и /industries/: шапку и подвал копируем с готовой
 * страницы /collections/, чтобы навигация, подвал и версии стилей совпадали с
 * остальным сайтом. Сочиняем только середину.
 *
 * Список категорий берём из меню в шапке - он уже написан и уже показывается
 * пользователю. Счётчики моделей берём из data/category-counts.json, тот же
 * источник, что и на самих страницах категорий, иначе цифры разойдутся.
 *
 * Запуск:  node build-categories-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const SRC = path.join(ROOT, 'collections', 'index.html');
const OUT_DIR = path.join(ROOT, 'categories');
const OUT = path.join(OUT_DIR, 'index.html');
const BASE = 'https://3dmolierstudio.com';

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const donor = fs.readFileSync(SRC, 'utf8');
const headerMatch = donor.match(/<body[^>]*>([\s\S]*?<\/header>)/);
if (!headerMatch) { console.error('не нашёл шапку в ' + SRC); process.exit(1); }
const header = headerMatch[1];
const footer = donor.slice(donor.indexOf('</main>') + '</main>'.length);
const bodyClass = (donor.match(/<body([^>]*)>/) || [, ''])[1];

// Категории читаем из меню шапки. У этого меню, в отличие от отраслевого, нет
// ни id, ни подписей mega-desc - только имя в mega-name. Поэтому берём все
// ссылки на /categories/ внутри шапки, а описание потом возьмём со страницы
// самой категории.
const items = [];
const seen = new Set();
for (const m of header.matchAll(/<a href="\/categories\/([^/]+)\/"[^>]*>([\s\S]*?)<\/a>/g)) {
  const slug = m[1];
  if (seen.has(slug)) continue;
  const inner = m[2];
  const name = (inner.match(/<span class="mega-name">([^<]+)<\/span>/) || [])[1]
    || inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) continue;
  seen.add(slug);
  items.push({ slug, name, desc: '' });
}
if (items.length < 10) { console.error('в меню нашлось всего ' + items.length + ' категорий, останавливаюсь'); process.exit(1); }

// Страница категории должна существовать: иначе хаб сам станет источником 404.
const live = items.filter(i => {
  const ok = fs.existsSync(path.join(OUT_DIR, i.slug, 'index.html'));
  if (!ok) console.log('  пропускаю ' + i.slug + ': страницы нет на диске');
  return ok;
});

const counts = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8')).counts || {}; }
  catch (e) { return {}; }
})();

// Заголовок и описание берём из самой страницы категории: там они уже выверены.
for (const it of live) {
  const html = fs.readFileSync(path.join(OUT_DIR, it.slug, 'index.html'), 'utf8');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  const d = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  it.h1 = h1 ? h1.replace(/<[^>]+>/g, '').trim() : it.name + ' 3D Models';
  it.long = d ? d.split(/(?<=\.)\s/)[0].trim() : it.desc;
  it.n = counts[it.slug] || 0;
}
// Крупные разделы вперёд: посетителю полезнее сразу увидеть, где моделей больше.
live.sort((a, b) => b.n - a.n || a.h1.localeCompare(b.h1));

const cards = live.map(i => `<a class="cat-hub-card" href="/categories/${i.slug}/">`
  + `<div class="cat-hub-name">${esc(i.h1)}</div>`
  + `<div class="cat-hub-desc">${esc(i.long)}</div>`
  + (i.n ? `<div class="cat-hub-tag">${nf(i.n)} models</div>` : '') + '</a>').join('');

// Итог берём из каталога, а не суммой чипов. Сумма по 26 категориям даёт 53 703,
// а /catalog/, /search/ и /data-licensing/ показывают 54 079 - это полный размер
// каталога, включая модели, не попавшие ни в одну просматриваемую категорию.
// Две разные цифры на соседних страницах читаются как ошибка, поэтому здесь
// стоит та же, что и везде; счётчики у самих категорий остаются своими.
const catalogTotal = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8')).total || 0; }
  catch (e) { return 0; }
})();
const total = catalogTotal || live.reduce((s, i) => s + i.n, 0);

const itemList = {
  '@context': 'https://schema.org', '@type': 'ItemList',
  name: '3D Model Categories', url: BASE + '/categories/',
  numberOfItems: live.length,
  itemListElement: live.map((i, n) => ({
    '@type': 'ListItem', position: n + 1, name: i.h1, url: BASE + '/categories/' + i.slug + '/',
  })),
};
const breadcrumb = {
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Categories', item: BASE + '/categories/' },
  ],
};

// Длины держим в тех же рамках, что и на остальных страницах: title до 65
// символов, description 120-158. Иначе поиск обрежет строку на середине слова.
const title = '3D Model Categories - Vehicles, Characters, More | 3D Molier';
const desc = 'Browse ' + nf(total) + ' 3D models across ' + live.length
  + ' categories: vehicles, characters, architecture, weapons, animals, furniture and more,'
  + ' in all popular file formats.';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${BASE}/categories/">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${BASE}/categories/">
<meta property="og:image" content="${BASE}/assets/og/3d-molier-og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=38">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>
.cat-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;margin:28px 0}
.cat-hub-card{display:block;border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:18px 20px;text-decoration:none;color:inherit}
.cat-hub-card:hover{border-color:rgba(0,0,0,.4)}
.cat-hub-name{font-weight:700;font-size:16px;margin-bottom:6px}
.cat-hub-desc{font-size:14px;line-height:1.55;opacity:.8}
.cat-hub-tag{font-size:12px;opacity:.55;margin-top:10px}
.cat-hub-note{font-size:14px;opacity:.8;max-width:70ch;line-height:1.6}
@media(prefers-color-scheme:dark){.cat-hub-card{border-color:rgba(255,255,255,.18)}.cat-hub-card:hover{border-color:rgba(255,255,255,.45)}}
</style>
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
</head>
<body${bodyClass}>
${header}
<main class="cat-main" id="main-content">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">Categories</span></div></div>
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">Browse by Subject</div>
    <h1 class="cat-page-h1">3D Model Categories</h1>
    <p class="cat-hub-note">These pages sort the catalog by what a model <em>is</em>: a vehicle, a building, an animal, a weapon. If you would rather start from the work you do, the <a href="/industries/">industry pages</a> gather the same models by field, and the <a href="/catalog/">catalog</a> holds every one of them in a single searchable list.</p>
    <div class="cat-hub-grid">${cards}</div>
    <p class="cat-hub-note">Looking for something specific? Search the <a href="/catalog/">catalog</a>, or browse the <a href="/collections/">collections</a> for sets that ship together. For a model that does not exist yet, we build it: see <a href="/custom-order/">custom orders</a>.</p>
  </div>
</section>
</main>
${footer}`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('готово: /categories/ собрана из ' + live.length + ' категорий, ' + Math.round(html.length / 1024) + ' КБ');
console.log('  моделей в сумме по счётчикам: ' + nf(total));
console.log('  длина title: ' + title.replace(/&amp;/g, '&').length + ', description: ' + desc.length);
