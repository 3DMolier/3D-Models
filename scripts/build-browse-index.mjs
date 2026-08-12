// build-browse-index.mjs - плоские страницы-указатели /browse/ для индексации.
//
// ЗАЧЕМ: на сайте 86 869 карточек, но в поиск попали ~2.4%. Причина структурная:
// карточки доступны только через пагинацию хабов по 100 штук, и до модели №5000
// в категории краулеру нужно пройти 50 страниц. Google так глубоко не ходит.
//
// РЕШЕНИЕ: плоские страницы по 500 ссылок каждая + оглавление.
// Глубина падает с ~50 кликов до 2: /browse/ -> /browse/N/ -> карточка.
//
// Страницы намеренно лёгкие: только ссылки, без картинок и JS - краулер
// обрабатывает их быстро и тратит бюджет на переходы, а не на рендер.
//
// Запуск: node scripts/build-browse-index.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const OUT = path.join(ROOT, 'browse');
const BASE = 'https://3dmolierstudio.com';
const PER = 500;
const TODAY = new Date().toISOString().slice(0, 10);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// имя модели из слага: "boeing-737-max-8-2328745" -> "Boeing 737 Max 8"
function pretty(slug) {
  return slug.replace(/-\d+$/, '').split('-')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim() || slug;
}

// header/footer берём из готовой страницы, чтобы шапка и меню совпадали с сайтом
const ref = fs.readFileSync(path.join(ROOT, 'categories', 'vehicles', 'index.html'), 'utf8');
const HEADER = (ref.match(/<header id="site-header">[\s\S]*?<\/header>/) || [''])[0];
const FOOTER = (ref.match(/<footer class="cat-footer">[\s\S]*?<\/footer>/) || [''])[0];

const slugs = fs.readdirSync(MODELS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(MODELS, d.name, 'index.html')))
  .map(d => d.name).sort();
console.log('моделей: ' + slugs.length);

const pages = Math.ceil(slugs.length / PER);
fs.mkdirSync(OUT, { recursive: true });

function shell(title, desc, canonical, body, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
${extraHead}
</head>
<body>
<a href="#main-content" class="skip-link">Skip to main content</a>
${HEADER}
<main id="main-content">
${body}
</main>
${FOOTER}
</body>
</html>`;
}

// ── страницы-чанки ──
for (let i = 0; i < pages; i++) {
  const part = slugs.slice(i * PER, (i + 1) * PER);
  const n = i + 1;
  const links = part.map(s => `<li><a href="/models/${s}/">${esc(pretty(s))}</a></li>`).join('\n');
  const prev = n > 1 ? `<a href="/browse/${n - 1}/" rel="prev">&#8592; Previous</a>` : '';
  const next = n < pages ? `<a href="/browse/${n + 1}/" rel="next">Next &#8594;</a>` : '';

  // Плоская нумерация. Раньше со страницы вели только «назад» и «вперёд», и до
  // последней из 174 приходилось идти 174 клика - обход туда практически не
  // доходил, а 6612 карточек держались только на этих страницах. Теперь на
  // каждой странице есть соседи, десятки и края: до любой страницы два-три клика.
  const jumps = new Set([1, pages]);
  for (let d = -3; d <= 3; d++) jumps.add(n + d);          // соседи
  for (let p = 10; p <= pages; p += 10) jumps.add(p);      // каждая десятая
  const ladder = [...jumps]
    .filter(p => p >= 1 && p <= pages && p !== n)
    .sort((a, b) => a - b)
    .map(p => `<a href="/browse/${p}/">${p}</a>`)
    .join(' ');
  const body = `<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> &#8250; <a href="/browse/">All Models</a> &#8250; Page ${n}</nav>
    <h1>All 3D Models &#8212; Page ${n} of ${pages}</h1>
    <p>Models ${i * PER + 1}&#8211;${i * PER + part.length} of ${slugs.length} in the 3D Molier catalog.</p>
    <ul class="browse-list">
${links}
    </ul>
    <nav class="browse-pagination" aria-label="Pagination">${prev} ${next} &#183; <a href="/browse/">All pages</a>
      <span class="browse-jumps">${ladder}</span>
    </nav>
  </div>
</section>`;
  const rel = (n > 1 ? `<link rel="prev" href="${BASE}/browse/${n - 1}/">` : '') +
              (n < pages ? `<link rel="next" href="${BASE}/browse/${n + 1}/">` : '');
  const dir = path.join(OUT, String(n));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'),
    shell(`All 3D Models — Page ${n} of ${pages} | 3D Molier`,
      `Complete index of 3D models by 3D Molier, page ${n} of ${pages}. Direct links to ${part.length} model pages.`,
      `${BASE}/browse/${n}/`, body, rel), 'utf8');
}

// ── оглавление ──
const toc = Array.from({ length: pages }, (_, i) => {
  const from = i * PER + 1, to = Math.min((i + 1) * PER, slugs.length);
  return `<li><a href="/browse/${i + 1}/">Page ${i + 1} &#183; models ${from}&#8211;${to}</a></li>`;
}).join('\n');
const idxBody = `<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> &#8250; All Models</nav>
    <h1>Complete 3D Model Index</h1>
    <p>Direct links to all ${slugs.length} models in the 3D Molier catalog, split into ${pages} pages of ${PER}.
       Looking for a category instead? See <a href="/">all categories</a> or the <a href="/catalog/">top 1000</a>.</p>
    <ul class="browse-list browse-toc">
${toc}
    </ul>
  </div>
</section>`;
fs.writeFileSync(path.join(OUT, 'index.html'),
  shell(`Complete 3D Model Index — ${slugs.length} Models | 3D Molier`,
    `Full index of all ${slugs.length} 3D models by 3D Molier. Direct links to every model page.`,
    `${BASE}/browse/`, idxBody), 'utf8');

// ── сайтмап для этих страниц ──
const entries = [`  <url>\n    <loc>${BASE}/browse/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`];
for (let n = 1; n <= pages; n++) {
  entries.push(`  <url>\n    <loc>${BASE}/browse/${n}/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
}
fs.writeFileSync(path.join(ROOT, 'sitemaps', 'sitemap-browse.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`, 'utf8');

console.log(`страниц-чанков: ${pages} по ${PER} ссылок`);
console.log(`оглавление: /browse/`);
console.log(`сайтмап: sitemaps/sitemap-browse.xml (${pages + 1} URL)`);
console.log('глубина до карточки: 2 клика от главной (было ~50 через пагинацию)');
