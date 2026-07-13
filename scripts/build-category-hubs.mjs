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
const classify = name => {
  const t = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [s, d, k] of CATS) if (k.find(x => t.has(x))) return s;
  return 'other';
};

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
    if (h) return h;
  }
  // новая категория - генерируем
  const [icon, desc] = HERO[cat] || ['🧩', `${catDisp} 3D models by 3D Molier. Real-world scale, clean topology, PBR materials, all popular formats.`];
  return `<section class="page-section page-section--border-bottom"><div class="max-w-7xl mx-auto"><div class="cat-hero"><div class="cat-hero-left"><div class="cat-hero-top"><div class="cat-hero-icon">${icon}</div><div><div class="section-label">3D Model Category</div><h1 class="cat-page-h1">${esc(catDisp)} 3D Models</h1></div></div><p class="cat-desc">${esc(desc)}</p><div class="cat-actions"><a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-primary">Browse on TurboSquid</a> <a href="/" class="btn-ghost">&#8592; All Categories</a></div></div><div class="cat-stats"><div class="cat-stat-cell"><div class="cat-stat-num">${count.toLocaleString('en-US')}</div><div class="cat-stat-label">Total Models</div></div></div></div></div></section>`;
}

function loadCatalog() {
  const files = fs.readdirSync(DATA).filter(f => /^fc-chunk-\d+\.json$/.test(f));
  const all = [];
  for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(DATA, f))); for (let j = 0; j < d.i.length; j++) all.push({ id: d.i[j], name: d.n[j], price: d.p[j] }); }
  const img = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^fc-img-chunk-\d+\.json$/.test(f))) { try { Object.assign(img, JSON.parse(fs.readFileSync(path.join(DATA, f)))); } catch {} }
  return { all, img };
}

function card(m, catDisp) {
  const slug = slugify(m.name) + '-' + m.id;
  return `      <a href="/models/${slug}/" class="model-card card-glow">
        <div class="img-wrap mc-img"><img src="${m.img}" alt="${esc(m.name)} 3D model preview" width="800" height="450" decoding="async" loading="lazy" data-fallback="${m.img}" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)"><div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">${esc(catDisp)}</span></div></div>
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
  const cards = models.map(m => card(m, catDisp)).join('\n');
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
${relLinks}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>.cat-pagination{margin:40px 0 8px}.cat-pagination>div{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}.cat-pg-link,.cat-pg-num{display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:40px;padding:0 12px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:14px;font-weight:600;color:inherit;text-decoration:none}.cat-pg-num:hover,.cat-pg-link:hover{border-color:rgba(0,0,0,.35)}.cat-pg-current{background:#111;color:#fff;border-color:#111}.cat-pg-disabled{opacity:.4}.cat-pg-ellipsis{padding:0 4px;opacity:.5}.cat-pg-total{font-size:13px;opacity:.6}@media(prefers-color-scheme:dark){.cat-pg-link,.cat-pg-num{border-color:rgba(255,255,255,.18)}.cat-pg-current{background:#fff;color:#111;border-color:#fff}}</style>
${itemListSchema(cat, catDisp, page, models)}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GDY5KTLBP1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GDY5KTLBP1');</script>
</head>
<body class="relative min-h-screen">
${HEADER}
<main class="cat-main">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/catalog/" class="bc-link">Categories</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">${bcCurrent}</span></div></div>
${page === 1 ? heroHtml : ''}
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">${esc(catDisp)}</div><h2 class="section-h2">${h2}</h2></div><span class="cat-pg-total">${rangeFrom}-${rangeTo} of ${totalCount.toLocaleString('en-US')}</span></div>
    <div id="model-grid" class="model-grid">
${cards}
    </div>
    ${pagination(cat, page, total)}
  </div>
</section>
</main>
${FOOTER}
<script src="/assets/js/site.min.js?v=33" defer></script>
</body>
</html>`;
}

function buildCategory(cat, all, img) {
  const catDisp = dispOf[cat] || cat;
  let list = [];
  for (const m of all) {
    if (classify(m.name) !== cat) continue;
    if (!img[m.id]) continue;
    const slug = slugify(m.name) + '-' + m.id;
    if (!fs.existsSync(path.join(MODELS, slug, 'index.html'))) continue;
    list.push({ ...m, img: img[m.id] });
  }
  list.sort((a, b) => b.price - a.price);
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
  const { all, img } = loadCatalog();
  const cats = one ? [one] : ALL_SLUGS;
  let totalPages = 0;
  for (const cat of cats) {
    const r = buildCategory(cat, all, img);
    totalPages += r.pages;
    console.error(`  ${r.cat.padEnd(24)} ${String(r.models).padStart(6)} моделей → ${r.pages} стр.`);
  }
  console.error(`\nИтого категорий: ${cats.length}, страниц: ${totalPages}.`);
}
main();
