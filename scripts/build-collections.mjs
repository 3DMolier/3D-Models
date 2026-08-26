// build-collections.mjs — раздел /collections/ из НАСТОЯЩИХ товаров-коллекций.
//
// Что было не так. Раньше /collections/ показывал 19 подборок вида «Best Vehicle
// 3D Models» — то есть те же модели каталога, отсортированные ещё раз по той же
// категории. Для посетителя это дубль раздела «Categories», а слово «коллекция»
// в каталоге уже занято: есть отдельные ТОВАРЫ-коллекции, где в одном лоте идёт
// набор моделей («Cocktail Glasses Collection», «Fire Trucks Collection»).
// Раздел показывал не их.
//
// Что теперь. /collections/ — это витрина реальных товаров-коллекций (около 5800
// штук), разложенных по темам. Тема берётся из отчёта продаж, а не угадывается
// по названию: сначала уточнение cat2, потом cat1. Порядок важен - у TurboSquid
// нет морской категории, всё плавающее лежит в «Vehicles», и без cat2
// «Military Submarines Collection» попадала в подборку про машины.
//
// Разнообразие. На витрине карточки выбираются по кругу из разных тем, а не
// подряд из одной — иначе первый экран забивался почти одинаковыми превью
// (шесть машин, шесть цветов). Одинаковые картинки отсеиваются по URL.
//
// Запуск:  node scripts/build-collections.mjs

import fs from 'node:fs';
import path from 'node:path';
import { topicByReport } from './category-map.mjs';

// Темы, которых в словаре cat1 нет вовсе: у TurboSquid всё плавающее,
// летающее и космическое лежит в «Vehicles». Уточнение приходит из cat2.
const TOPIC_THEME = {
  aircraft: 'aircraft',
  ships: 'ships',
  'space-scifi': 'space-scifi',
  'military-vehicles': 'military',
};

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'collections');
const MODELS = path.join(ROOT, 'models');
const CATEGORIES = path.join(ROOT, 'categories');
const BASE = 'https://3dmolierstudio.com';
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const PER = 60;          // карточек на странице темы
const FEATURED = 24;     // карточек на витрине
const TODAY = new Date().toISOString().slice(0, 10);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Отбираем по словам, которые означают ИМЕННО набор.
// «pack» и «bundle» сюда не входят: в каталоге это почти всегда единичный
// предмет — пачка сигарет, пачка банкнот, батарейный блок Tesla.
const COLL_RE = /\b(collection|collections|set|sets|kit|kits)\b/i;

// ---- темы: настоящая категория TurboSquid -> тема витрины ----
const THEMES = [
  ['vehicles', 'Vehicle Collections', '🚗', ['Vehicles'],
    'Multi-model vehicle sets — car line-ups, truck fleets, parts and wheel packs delivered as one product.'],
  ['aircraft', 'Aircraft Collections', '✈️', [],
    'Airliner fleets, fighter line-ups, helicopter and drone sets supplied as one product.'],
  ['ships', 'Ship & Boat Collections', '🚢', [],
    'Naval fleets, submarine sets, yachts and working vessels delivered together.'],
  ['military', 'Military Collections', '🪖', [],
    'Armour, artillery and military vehicle sets for defense simulation and film.'],
  ['space-scifi', 'Space & Sci-Fi Collections', '🚀', [],
    'Satellite, spacecraft and sci-fi prop sets supplied as complete kits.'],
  ['home-interior', 'Home & Interior Collections', '🛋️', ['Interior Design', 'Furnishings'],
    'Tableware, appliances, furniture and household sets for dressing a full interior scene at once.'],
  ['nature', 'Nature Collections', '🌿', ['Nature'],
    'Plant, flower, tree, stone and animal sets for landscape and environment work.'],
  ['industrial', 'Industrial Collections', '⚙️', ['Industrial'],
    'Tool sets, pipe and conveyor assemblies, construction and agriculture equipment packs.'],
  ['food-drink', 'Food & Drink Collections', '🍽️', ['Food and Drink'],
    'Fruit, produce, drinks and packaging sets for food advertising and restaurant scenes.'],
  ['science-medical', 'Science & Medical Collections', '🔬', ['Science'],
    'Anatomy sets, lab equipment, syringes and pharmaceutical packaging as complete kits.'],
  ['technology', 'Technology Collections', '💻', ['Technology'],
    'Device line-ups, server racks, audio gear and accessory sets for tech visuals.'],
  ['fashion', 'Fashion Collections', '👗', ['Fashion and Beauty'],
    'Eyewear, footwear, apparel and accessory sets for lookbooks and character wardrobes.'],
  ['architecture', 'Architecture Collections', '🏛️', ['Architecture'],
    'Street furniture, signage, building components and urban prop sets.'],
  ['characters', 'Character Collections', '👥', ['Characters'],
    'Rigged people sets — crews, teams and uniformed groups supplied together.'],
  ['sports', 'Sports Collections', '🏀', ['Sports'],
    'Equipment sets for team sports, camping, fitness and outdoor recreation.'],
  ['weapons', 'Weapon Collections', '⚔️', ['Weaponry'],
    'Firearm, blade, munition and armour sets for games, film and defense visualization.'],
  ['toys-games', 'Toys & Games Collections', '🧸', ['Toys and Games'],
    'Dice, chips, figures and board-game piece sets.'],
  ['art-media', 'Art, Office & Music Collections', '🎨', ['art', 'Office', 'Music'],
    'Art supplies, stationery, print media and musical instrument sets.'],
  ['currency-symbols', 'Currency & Symbol Collections', '💵', ['Currency', 'Symbols'],
    'Coin and banknote sets, emoji packs, icons and symbolic shape collections.'],
  ['holidays', 'Holiday Collections', '🎄', ['Holidays'],
    'Christmas, Halloween and party decoration sets.'],
];
const themeOf = new Map();
for (const [slug, , , cats] of THEMES) for (const c of cats) themeOf.set(c, slug);

// ---- данные ----
const report = JSON.parse(fs.readFileSync(path.join(DATA, 'product-report.json'), 'utf8'));
const byPid = new Map(report.map(r => [String(r.pid), r]));

const img = {};
for (const f of fs.readdirSync(DATA).filter(f => /^fc-img-chunk-\d+\.json$/.test(f))) {
  try { Object.assign(img, JSON.parse(fs.readFileSync(path.join(DATA, f)))); } catch { }
}

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const all = [];
for (let n = 0; n < idx.chunks; n++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + n + '.json')));
  for (let i = 0; i < c.i.length; i++) {
    all.push({ id: c.i[i], name: c.n[i], price: c.p[i], sales: c.s[i] });
  }
}

// Берём только те коллекции, у которых есть живая карточка и превью: карточка
// без картинки на витрине выглядит поломкой.
const items = [];
for (const m of all) {
  if (!COLL_RE.test(m.name)) continue;
  const cover = img[m.id];
  if (!cover) continue;
  const slug = slugify(m.name) + '-' + m.id;
  if (!fs.existsSync(path.join(MODELS, slug, 'index.html'))) continue;
  const r = byPid.get(String(m.id));
  // Тема сначала по уточнению cat2, потом по cat1. Без первого шага всё, что
  // плавает, летает и летит в космос, сваливалось в «Vehicle Collections»:
  // морской темы в словаре TurboSquid нет, и «Military Submarines Collection»
  // оказывалась среди машин. Таких наборов 473.
  const topic = topicByReport(m.id, m.name);
  const theme = TOPIC_THEME[topic] || themeOf.get(r && r.cat1) || null;
  items.push({ ...m, slug, cover, theme });
}
console.log('товаров-коллекций с живой карточкой и превью: ' + items.length);

const byTheme = new Map(THEMES.map(t => [t[0], []]));
for (const it of items) if (it.theme && byTheme.has(it.theme)) byTheme.get(it.theme).push(it);
for (const list of byTheme.values()) list.sort((a, b) => (b.sales - a.sales) || (b.price - a.price));

// ---- разметка ----
const refSrc = fs.readFileSync(path.join(CATEGORIES, 'vehicles', 'index.html'), 'utf8');
// Шапку и подвал берём из образцов, а не выкусываем из соседней страницы.
// Подвал искали по классу cat-footer, а канонический давно site-footer - при
// пересборке подвал просто исчезал, и страницы уходили в прод без него.
const HEADER = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8');
const FOOTER = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8')
  .replace('<!--MP_FOOTER_BACK-->', '');

const STYLE = `<style>
.coll-theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px;margin:28px 0}
.coll-theme-card{display:block;border:1px solid rgba(0,0,0,.12);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;background:transparent}
.coll-theme-card:hover{border-color:rgba(0,0,0,.4)}
.coll-theme-cover{aspect-ratio:16/9;background:#f3f4f6;overflow:hidden}
.coll-theme-cover img{width:100%;height:100%;object-fit:cover;display:block}
.coll-theme-body{padding:14px 16px 16px}
.coll-theme-name{font-weight:700;font-size:15px;margin-bottom:4px}
.coll-theme-count{font-size:13px;opacity:.6}
.coll-note{font-size:14px;opacity:.8;max-width:70ch;line-height:1.6}
@media(prefers-color-scheme:dark){.coll-theme-card{border-color:rgba(255,255,255,.18)}.coll-theme-card:hover{border-color:rgba(255,255,255,.45)}.coll-theme-cover{background:#1f2229}}
</style>`;

function shell(title, desc, canonical, body, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}/assets/og/3d-molier-og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
${STYLE}
${extraHead}
</head>
<body class="relative min-h-screen">
${HEADER}
<main class="cat-main" id="main-content">
${body}
</main>
${FOOTER}
<script src="/assets/js/site.min.js?v=33" defer></script>
</body>
</html>`;
}

function card(m, themeName) {
  return `      <a href="/models/${m.slug}/" class="model-card card-glow">
        <div class="img-wrap mc-img"><img src="${m.cover}" alt="${esc(m.name)} 3D model collection preview" width="800" height="450" decoding="async" loading="lazy" data-placeholder="${PLACEHOLDER}" onerror="handleImageError(this)"><div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">${esc(themeName)}</span></div></div>
        <div class="mc-body">
          <div class="mc-meta"><h3 class="mc-title">${esc(m.name)}</h3></div>
          <div class="mc-foot"><span class="chip mc-chip chip-theme">${esc(themeName)}</span><span class="mc-price">$${m.price}</span></div>
        </div>
      </a>`;
}

function itemListSchema(name, url, list) {
  const items = list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name, url: `${BASE}/models/${m.slug}/` }));
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ItemList', name, url,
    numberOfItems: items.length, itemListElement: items,
  })}</script>`;
}

const dispOfTheme = Object.fromEntries(THEMES.map(t => [t[0], t[1]]));

// Обложка темы — самый ходовой товар темы. Резервируем эти картинки заранее,
// чтобы витрина ниже не показала те же самые снимки второй раз: иначе на одном
// экране каждая обложка дублировалась карточкой под ней.
const coverOf = new Map();
for (const [slug] of THEMES) {
  const list = byTheme.get(slug) || [];
  if (list.length) coverOf.set(slug, list[0]);
}
const reserved = new Set([...coverOf.values()].map(m => m.cover));

// ---- витрина: по кругу из разных тем ----
// Подряд идущие карточки из одной темы давали ленту почти одинаковых превью.
// Идём по темам по очереди и пропускаем повторяющиеся картинки.
function featuredPicks(n) {
  const queues = THEMES.map(([s]) => (byTheme.get(s) || []).slice());
  const seenImg = new Set(reserved);
  const out = [];
  let round = 0;
  while (out.length < n && round < 40) {
    let added = false;
    for (const q of queues) {
      if (out.length >= n) break;
      while (q.length) {
        const m = q.shift();
        if (seenImg.has(m.cover)) continue;
        seenImg.add(m.cover);
        out.push(m);
        added = true;
        break;
      }
    }
    if (!added) break;
    round++;
  }
  return out;
}

// ---- страницы тем ----
let themePages = 0;
for (const [slug, name, icon, , desc] of THEMES) {
  const list = byTheme.get(slug) || [];
  if (!list.length) continue;
  const total = Math.max(1, Math.ceil(list.length / PER));
  for (let page = 1; page <= total; page++) {
    const part = list.slice((page - 1) * PER, page * PER);
    const canonical = page === 1 ? `${BASE}/collections/${slug}/` : `${BASE}/collections/${slug}/page/${page}/`;
    const title = (page === 1 ? name : `${name} - Page ${page}`) + ' | 3D Molier';
    const pg = [];
    pg.push(page > 1
      ? `<a href="${page - 1 === 1 ? `/collections/${slug}/` : `/collections/${slug}/page/${page - 1}/`}" class="cat-pg-link" rel="prev">&#8592; Prev</a>`
      : '');
    const jumps = [...new Set([1, 2, total, total - 1, page, page - 1, page + 1].filter(x => x >= 1 && x <= total))].sort((a, b) => a - b);
    let prev = 0;
    for (const x of jumps) {
      if (x - prev > 1) pg.push('<span class="cat-pg-ellipsis">…</span>');
      pg.push(x === page ? `<span class="cat-pg-num cat-pg-current">${x}</span>`
        : `<a href="${x === 1 ? `/collections/${slug}/` : `/collections/${slug}/page/${x}/`}" class="cat-pg-num">${x}</a>`);
      prev = x;
    }
    pg.push(page < total ? `<a href="/collections/${slug}/page/${page + 1}/" class="cat-pg-link" rel="next">Next &#8594;</a>` : '');
    const body = `<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/collections/" class="bc-link">Collections</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">${esc(name)}${page > 1 ? ' &#8250; Page ' + page : ''}</span></div></div>
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="cat-hero-top"><div class="cat-hero-icon">${icon}</div><div><div class="section-label">Collections</div><h1 class="cat-page-h1">${esc(name)}</h1></div></div>
    <p class="cat-desc">${esc(desc)}</p>
    <p class="coll-note">Every item here is a single product that contains multiple models. ${list.length} available.</p>
  </div>
</section>
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">${esc(name)}</div><h2 class="section-h2">${page === 1 ? 'Most popular' : 'Page ' + page + ' of ' + total}</h2></div><span class="cat-pg-total">${(page - 1) * PER + 1}-${(page - 1) * PER + part.length} of ${list.length}</span></div>
    <div class="model-grid">
${part.map(m => card(m, name)).join('\n')}
    </div>
    <nav class="cat-pagination" aria-label="Pages"><div class="max-w-7xl mx-auto">${pg.filter(Boolean).join('\n')}</div></nav>
  </div>
</section>`;
    const dir = page === 1 ? path.join(OUT, slug) : path.join(OUT, slug, 'page', String(page));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'),
      shell(title, `${desc} ${list.length} collection products by 3D Molier.`, canonical, body,
        itemListSchema(name, canonical, part)), 'utf8');
    themePages++;
  }
}

// ---- витрина ----
const picks = featuredPicks(FEATURED);
const themeCards = THEMES.map(([slug, name, icon]) => {
  const list = byTheme.get(slug) || [];
  if (!list.length) return '';
  return `      <a href="/collections/${slug}/" class="coll-theme-card">
        <div class="coll-theme-cover"><img src="${coverOf.get(slug).cover}" alt="${esc(name)}" width="800" height="450" loading="lazy" decoding="async"></div>
        <div class="coll-theme-body"><div class="coll-theme-name">${icon} ${esc(name)}</div><div class="coll-theme-count">${list.length} collections</div></div>
      </a>`;
}).filter(Boolean).join('\n');

const totalColl = [...byTheme.values()].reduce((s, l) => s + l.length, 0);
const idxBody = `<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">Collections</span></div></div>
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">Multi-Model Products</div>
    <h1 class="cat-page-h1">3D Model Collections</h1>
    <p class="coll-note">A collection is a single product containing several models at once — a set of cocktail glasses, a fleet of fire trucks, a rigged crew of workers. Buy one item, get the whole group with consistent scale, topology and materials. ${totalColl} collections across ${THEMES.filter(t => (byTheme.get(t[0]) || []).length).length} themes.</p>
  </div>
</section>
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">Browse by theme</div>
    <div class="coll-theme-grid">
${themeCards}
    </div>
  </div>
</section>
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">Hand-picked</div><h2 class="section-h2">Collections across every theme</h2></div></div>
    <div class="model-grid">
${picks.map(m => card(m, dispOfTheme[m.theme] || 'Collection')).join('\n')}
    </div>
  </div>
</section>`;

fs.writeFileSync(path.join(OUT, 'index.html'),
  shell('3D Model Collections — Multi-Model Sets & Packs | 3D Molier',
    `Browse ${totalColl} 3D model collections by 3D Molier: vehicle fleets, tableware sets, plant packs, tool kits and more. Each is one product containing multiple models.`,
    `${BASE}/collections/`, idxBody, itemListSchema('3D Model Collections', `${BASE}/collections/`, picks)), 'utf8');

// ---- старые подборки -> перенаправление ----
// 19 адресов вида /collections/best-vehicle-3d-models/ были той самой повторной
// сортировкой каталога. Просто удалить их нельзя — они уже в индексе, поэтому
// на их месте остаётся перенаправление на новый раздел.
const OLD = ['best-vehicle-3d-models', 'best-military-vehicle-3d-models', 'best-aircraft-3d-models',
  'best-ship-3d-models', 'best-industrial-equipment-3d-models', 'best-medical-3d-models',
  'best-architecture-landmark-3d-models', '3d-models-for-aerospace-visualization',
  '3d-models-for-medical-visualization', '3d-models-for-defense-simulation',
  '3d-models-for-film-production', '3d-models-for-vr-projects', '3d-models-for-game-development',
  '3d-models-for-advertising', '3d-models-for-architecture-visualization',
  '3d-models-for-event-management', '3d-models-for-hardware-presentation',
  'checkmate-certified-3d-models', 'stemcell-certified-3d-models'];
// Куда вести: ближайшая по смыслу тема, иначе витрина.
const OLD_TARGET = {
  'best-vehicle-3d-models': 'vehicles', 'best-military-vehicle-3d-models': 'weapons',
  'best-industrial-equipment-3d-models': 'industrial', 'best-medical-3d-models': 'science-medical',
  'best-architecture-landmark-3d-models': 'architecture', '3d-models-for-medical-visualization': 'science-medical',
  '3d-models-for-defense-simulation': 'weapons', '3d-models-for-architecture-visualization': 'architecture',
  '3d-models-for-hardware-presentation': 'technology',
};
let stubs = 0;
for (const slug of OLD) {
  const target = OLD_TARGET[slug] ? `/collections/${OLD_TARGET[slug]}/` : '/collections/';
  const dir = path.join(OUT, slug);
  if (fs.existsSync(path.join(dir, 'page'))) fs.rmSync(path.join(dir, 'page'), { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${BASE}${target}">
<title>Moved to Collections | 3D Molier</title>
<meta name="description" content="This page has moved. Browse 3D model collections by 3D Molier.">
</head>
<body>
<p>This page has moved. <a href="${target}">Continue to collections</a>.</p>
</body>
</html>`, 'utf8');
  stubs++;
}

// ---- сайтмап ----
const urls = [`  <url>\n    <loc>${BASE}/collections/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`];
for (const [slug] of THEMES) {
  const list = byTheme.get(slug) || [];
  if (!list.length) continue;
  const total = Math.ceil(list.length / PER);
  for (let p = 1; p <= total; p++) {
    const loc = p === 1 ? `${BASE}/collections/${slug}/` : `${BASE}/collections/${slug}/page/${p}/`;
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p === 1 ? '0.7' : '0.5'}</priority>\n  </url>`);
  }
}
fs.writeFileSync(path.join(ROOT, 'sitemaps', 'sitemap-collections.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 'utf8');

console.log('тем: ' + THEMES.filter(t => (byTheme.get(t[0]) || []).length).length + ', страниц тем: ' + themePages);
console.log('на витрине: ' + picks.length + ' карточек из ' + new Set(picks.map(p => p.theme)).size + ' тем');
console.log('перенаправлений со старых подборок: ' + stubs);
console.log('sitemap-collections.xml: ' + urls.length + ' URL');
for (const [slug, name] of THEMES) {
  const l = (byTheme.get(slug) || []).length;
  if (l) console.log('  ' + slug.padEnd(18) + String(l).padStart(5) + '  ' + name);
}
