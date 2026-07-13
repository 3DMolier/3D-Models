// build-category-hubs.mjs — генератор пагинированных хаб-страниц категории.
// Пилот: aircraft. Берёт header/hero/footer из существующей categories/<cat>/index.html как шаблон,
// заменяет грид на N статических карточек/страницу + пагинация (стр.1 = /categories/<cat>/,
// стр.N = /categories/<cat>/page/N/). Убирает JS load-more (чистая пагинация для краула).
//
// Запуск: node scripts/build-category-hubs.mjs <cat-slug> [perPage=100]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const CATEGORIES = path.join(ROOT, 'categories');
const MODELS = path.join(ROOT, 'models');
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- классификатор (импорт из classify15.mjs через регэксп извлечение CATS) ----
const clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
const dispOf = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
const classify = name => {
  const t = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [s, d, k] of CATS) if (k.find(x => t.has(x))) return s;
  return 'other';
};

function loadCatalog() {
  const files = fs.readdirSync(DATA).filter(f => /^fc-chunk-\d+\.json$/.test(f));
  const all = [];
  for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(DATA, f))); for (let j = 0; j < d.i.length; j++) all.push({ id: d.i[j], name: d.n[j], price: d.p[j] }); }
  const img = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^fc-img-chunk-\d+\.json$/.test(f))) { try { Object.assign(img, JSON.parse(fs.readFileSync(path.join(DATA, f)))); } catch {} }
  return { all, img };
}

// ---- извлечь константные блоки из существующей страницы категории ----
function templateBlocks(catSlug) {
  const src = fs.readFileSync(path.join(CATEGORIES, catSlug, 'index.html'), 'utf8');
  const grab = (re) => (src.match(re) || [])[0] || '';
  return {
    header: grab(/<header id="site-header">[\s\S]*?<\/header>/),
    hero: grab(/<section class="page-section page-section--border-bottom">[\s\S]*?<\/section>/),
    footer: grab(/<footer class="cat-footer">[\s\S]*?<\/footer>/),
    heroTitle: (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '',
  };
}

function card(m, catDisp) {
  const slug = slugify(m.name) + '-' + m.id;
  const img = m.img;
  return `      <a href="/models/${slug}/" class="model-card card-glow">
        <div class="img-wrap mc-img"><img src="${img}" alt="${esc(m.name)} 3D model preview" width="800" height="450" decoding="async" loading="lazy" data-fallback="${img}" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)"><div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">${catDisp}</span></div></div>
        <div class="mc-body">
          <div class="mc-meta"><h3 class="mc-title">${esc(m.name)}</h3></div>
          <div class="mc-foot"><span class="chip mc-chip">${catDisp}</span><span class="mc-price">$${m.price}</span></div>
        </div>
      </a>`;
}

function pagination(cat, page, total) {
  const url = n => n === 1 ? `/categories/${cat}/` : `/categories/${cat}/page/${n}/`;
  const parts = [];
  parts.push(page > 1 ? `<a href="${url(page - 1)}" class="cat-pg-link" rel="prev">&#8592; Prev</a>` : `<span class="cat-pg-link cat-pg-disabled">&#8592; Prev</span>`);
  // окно страниц: 1 … p-2 p-1 p p+1 p+2 … total
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
  const items = models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name, url: `${base}/models/${slugify(m.name)}-${m.id}/` }));
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: `${catDisp} 3D Models`, url, numberOfItems: items.length, itemListElement: items })}</script>`;
}

function renderPage(cat, catDisp, page, total, models, tpl) {
  const base = 'https://3dmolierstudio.com';
  const canonical = page === 1 ? `${base}/categories/${cat}/` : `${base}/categories/${cat}/page/${page}/`;
  const titleBase = tpl.heroTitle.replace(/ \| 3D Molier.*$/, '') || `${catDisp} 3D Models`;
  const title = (page === 1 ? titleBase : `${catDisp} 3D Models - Page ${page}`) + ' | 3D Molier';
  const relLinks = [
    page > 1 ? `<link rel="prev" href="${page - 1 === 1 ? base + '/categories/' + cat + '/' : base + '/categories/' + cat + '/page/' + (page - 1) + '/'}">` : '',
    page < total ? `<link rel="next" href="${base}/categories/${cat}/page/${page + 1}/">` : '',
  ].filter(Boolean).join('\n');
  const bcCurrent = page === 1 ? catDisp : `<a href="/categories/${cat}/" class="bc-link">${catDisp}</a> <span class="bc-sep">&#8250;</span> Page ${page}`;
  const cards = models.map(m => card(m, catDisp)).join('\n');
  const heroForPage = page === 1 ? tpl.hero : ''; // hero только на стр.1 (на остальных лёгкая шапка)
  const h2 = page === 1 ? `Best ${catDisp} 3D Models` : `${catDisp} 3D Models - Page ${page} of ${total}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="Browse ${catDisp} 3D models by 3D Molier. Real-world scale, clean topology, PBR materials, all popular formats. Page ${page} of ${total}.">
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
${tpl.header}
<main class="cat-main">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/catalog/" class="bc-link">Categories</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">${bcCurrent}</span></div></div>
${heroForPage}
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header"><div><div class="section-label">${catDisp}</div><h2 class="section-h2">${h2}</h2></div><span class="cat-pg-total">${(page - 1) * PERPAGE + 1}-${(page - 1) * PERPAGE + models.length} of ${TOTALCOUNT}</span></div>
    <div id="model-grid" class="model-grid">
${cards}
    </div>
    ${pagination(cat, page, total)}
  </div>
</section>
</main>
${tpl.footer}
<script src="/assets/js/site.min.js?v=33" defer></script>
</body>
</html>`;
}

let TOTALCOUNT = 0;
let PERPAGE = 100;
function main() {
  const cat = process.argv[2];
  const perPage = +(process.argv[3] || 100);
  PERPAGE = perPage;
  if (!cat) { console.error('usage: node build-category-hubs.mjs <cat-slug> [perPage]'); process.exit(1); }
  const catDisp = dispOf[cat] || cat;
  const { all, img } = loadCatalog();
  // модели категории: классифицируем, фильтруем, только с картинкой и существующей страницей, сорт по цене
  let list = [];
  for (const m of all) {
    if (classify(m.name) !== cat) continue;
    if (!img[m.id]) continue;
    const slug = slugify(m.name) + '-' + m.id;
    if (!fs.existsSync(path.join(MODELS, slug, 'index.html'))) continue;
    list.push({ ...m, img: img[m.id] });
  }
  list.sort((a, b) => b.price - a.price);
  TOTALCOUNT = list.length;
  const total = Math.max(1, Math.ceil(list.length / perPage));
  const tpl = templateBlocks(cat);
  console.error(`Категория ${cat} (${catDisp}): ${list.length} моделей → ${total} страниц по ${perPage}.`);

  for (let page = 1; page <= total; page++) {
    const models = list.slice((page - 1) * perPage, page * perPage);
    const html = renderPage(cat, catDisp, page, total, models, tpl);
    const dir = page === 1 ? path.join(CATEGORIES, cat) : path.join(CATEGORIES, cat, 'page', String(page));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  console.error(`Готово: ${total} страниц в categories/${cat}/`);
}
main();
