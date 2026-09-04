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

// Только живые карточки. Раньше сюда попадали и страницы-перенаправления
// (объединённые варианты) - список раздувался почти вдвое ссылками, которые
// сразу уводят на другую страницу, и было незнятно, что реально на сайте.
const HEAD = 400;
const stubBuf = Buffer.alloc(HEAD);
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, stubBuf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(stubBuf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}
const slugs = fs.readdirSync(MODELS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(MODELS, d.name, 'index.html')) && !isStub(d.name))
  .map(d => d.name).sort();
console.log('моделей: ' + slugs.length);

// Лёгкий фильтр без сборки и зависимостей - на странице уже есть все 500 <li>,
// JS просто скрывает те, что не совпали. Работает мгновенно, не требует сети.
const FILTER_JS = `<script>(function(){var i=document.getElementById('browse-filter');if(!i)return;var items=[].slice.call(document.querySelectorAll('.browse-list li'));var cnt=document.getElementById('browse-filter-count');i.addEventListener('input',function(){var q=i.value.trim().toLowerCase();var shown=0;items.forEach(function(li){var m=!q||li.textContent.toLowerCase().indexOf(q)>-1;li.style.display=m?'':'none';if(m)shown++;});if(cnt)cnt.textContent=q?(shown+' of '+items.length+' match'):'';});})();</script>`;
const FILTER_BOX = `<div class="browse-filter-box"><input id="browse-filter" type="search" placeholder="Filter models on this page…" aria-label="Filter models on this page"><span id="browse-filter-count" class="browse-filter-count"></span></div>
    <p class="browse-search-hint">Looking for something specific across the whole catalog? Use the <a href="/catalog/">catalog</a> instead - it searches and filters every model, while this index is a flat link list meant for browsing page by page.</p>`;

const pages = Math.ceil(slugs.length / PER);
fs.mkdirSync(OUT, { recursive: true });

// Страницы browse уходили в соцсети и мессенджеры без заголовка и картинки:
// ни одного тега Open Graph на 175 страницах. Картинка общая, заставка сайта -
// это плоский список ссылок, своего снимка у него нет.
const OG_IMAGE = 'https://3dmolierstudio.com/assets/og/3d-molier-og.jpg';
function social(title, desc, canonical) {
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:site_name" content="3D Molier Models">`,
    `<meta property="og:image" content="${OG_IMAGE}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@3dmolier">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
  ].join('\n');
}

// Дорожка «Home > All Models» на страницах была нарисована, но разметки под неё
// не было - ни одного блока JSON-LD на 175 страницах. В выдаче путь не
// показывался, и страницы выглядели оторванными от сайта.
function crumbs(page) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
    { '@type': 'ListItem', position: 2, name: 'All Models', item: BASE + '/browse/' },
  ];
  if (page) items.push({ '@type': 'ListItem', position: 3, name: 'Page ' + page, item: BASE + '/browse/' + page + '/' });
  return '<script type="application/ld+json">'
    + JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })
    + '</script>';
}

/*
 * Метка версии стилей и запрет индексации задаются ЗДЕСЬ, а не правкой
 * готовых страниц. Оба раза правка страниц уже стиралась пересборкой:
 * noindex, follow пропадал со 109 страниц обхода, а метка версии
 * возвращалась к v=33, и посетитель получал стили годичной давности.
 * Версию берём из главной страницы - она единственная точка отсчёта.
 */
const ASSET_V = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/styles\.min\.css\?v=(\d+)/) || [, '1'])[1];

function shell(title, desc, canonical, body, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="noindex, follow">
${social(title, desc, canonical)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=${ASSET_V}">
<style>.browse-filter-box{display:flex;align-items:center;gap:10px;margin:16px 0}#browse-filter{flex:1;max-width:420px;padding:10px 14px;border:1px solid rgba(0,0,0,.15);border-radius:8px;font-size:14px}.browse-filter-count{font-size:13px;opacity:.65;white-space:nowrap}.browse-search-hint{font-size:13px;opacity:.75;margin:0 0 20px}@media(prefers-color-scheme:dark){#browse-filter{border-color:rgba(255,255,255,.2);background:transparent;color:inherit}}</style>
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
    <h1>All 3D Models - Page ${n} of ${pages}</h1>
    <p>Models ${i * PER + 1}-${i * PER + part.length} of ${slugs.length} in the 3D Molier catalog.</p>
    ${FILTER_BOX}
    <ul class="browse-list">
${links}
    </ul>
    <nav class="browse-pagination" aria-label="Pagination">${prev} ${next} &#183; <a href="/browse/">All pages</a>
      <span class="browse-jumps">${ladder}</span>
    </nav>
  </div>
</section>
${FILTER_JS}`;
  const rel = (n > 1 ? `<link rel="prev" href="${BASE}/browse/${n - 1}/">` : '') +
              (n < pages ? `<link rel="next" href="${BASE}/browse/${n + 1}/">` : '');
  const dir = path.join(OUT, String(n));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'),
    shell(`All 3D Models - Page ${n} of ${pages} | 3D Molier`,
      `Complete index of 3D models by 3D Molier, page ${n} of ${pages}. Direct links to ${part.length} model pages.`,
      `${BASE}/browse/${n}/`, body, rel + crumbs(n)), 'utf8');
}

// ── оглавление ──
const toc = Array.from({ length: pages }, (_, i) => {
  const from = i * PER + 1, to = Math.min((i + 1) * PER, slugs.length);
  return `<li><a href="/browse/${i + 1}/">Page ${i + 1} &#183; models ${from}-${to}</a></li>`;
}).join('\n');
const idxBody = `<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <nav aria-label="Breadcrumb"><a href="/">Home</a> &#8250; All Models</nav>
    <h1>Complete 3D Model Index</h1>
    <p>Direct links to all ${slugs.length} models in the 3D Molier catalog, split into ${pages} pages of ${PER}.
       Looking for a category instead? See <a href="/">all categories</a> or the <a href="/catalog/">top 1000</a>.</p>
    ${FILTER_BOX}
    <ul class="browse-list browse-toc">
${toc}
    </ul>
  </div>
</section>
${FILTER_JS}`;
fs.writeFileSync(path.join(OUT, 'index.html'),
  shell(`Complete 3D Model Index - ${slugs.length} Models | 3D Molier`,
    `Full index of all ${slugs.length} 3D models by 3D Molier. Direct links to every model page.`,
    `${BASE}/browse/`, idxBody, crumbs(0)), 'utf8');

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
