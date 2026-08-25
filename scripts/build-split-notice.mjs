// build-split-notice.mjs - страница-развилка на месте разделённой категории.
//
// Категория «Weapons & Tools» разделена на «Weapons» и «Tools»: оружие и
// промышленный инструмент - разные предметы и разные покупатели, держать их
// в одном списке было бессмысленно.
//
// Старый адрес /categories/weapons-tools/ уже в индексе Google и во внешних
// ссылках. Редирект сюда не подходит: цели две, и выбрать одну «правильную»
// нельзя - половина посетителей попала бы не туда. Поэтому на старом адресе
// остаётся короткая страница с двумя ссылками, без noindex и без canonical
// на чужую страницу.
//
// Запуск:  node scripts/build-split-notice.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const CATEGORIES = path.join(ROOT, 'categories');
const BASE = 'https://3dmolierstudio.com';
const OLD = 'weapons-tools';

const refSrc = fs.readFileSync(path.join(CATEGORIES, 'vehicles', 'index.html'), 'utf8');
const HEADER = (refSrc.match(/<header id="site-header">[\s\S]*?<\/header>/) || [''])[0];
const FOOTER = (refSrc.match(/<footer class="cat-footer">[\s\S]*?<\/footer>/) || [''])[0];

function countOf(slug) {
  const f = path.join(CATEGORIES, slug, 'index.html');
  const m = fs.readFileSync(f, 'utf8').match(/of ([\d,]+)<\/span>/);
  return m ? m[1] : '';
}

const wCount = countOf('weapons');
const tCount = countOf('tools');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weapons &amp; Tools 3D Models - Now Two Categories | 3D Molier</title>
<meta name="description" content="The Weapons &amp; Tools category has been split into two: Weapons 3D models and Tools 3D models. Pick the one you need.">
<link rel="canonical" href="${BASE}/categories/${OLD}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>.split-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:32px 0}.split-card{display:block;padding:28px;border:1px solid rgba(0,0,0,.12);border-radius:12px;text-decoration:none;color:inherit}.split-card:hover{border-color:rgba(0,0,0,.35)}.split-icon{font-size:34px;display:block;margin-bottom:12px}.split-name{font-size:20px;font-weight:700;margin-bottom:6px}.split-count{font-size:14px;opacity:.65}@media(prefers-color-scheme:dark){.split-card{border-color:rgba(255,255,255,.18)}.split-card:hover{border-color:rgba(255,255,255,.45)}}</style>
</head>
<body class="relative min-h-screen">
${HEADER}
<main class="cat-main" id="main-content">
<div class="cat-bc"><div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner"><a href="/" class="bc-link">Home</a> <span class="bc-sep">&#8250;</span> <a href="/catalog/" class="bc-link">Categories</a> <span class="bc-sep">&#8250;</span> <span class="bc-current">Weapons &amp; Tools</span></div></div>
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">3D Model Category</div>
    <h1 class="cat-page-h1">Weapons &amp; Tools is now two categories</h1>
    <p class="cat-desc">Weapons and industrial tools are different things for different projects, so they now live in separate categories. Pick the one you need:</p>
    <div class="split-grid">
      <a href="/categories/weapons/" class="split-card">
        <span class="split-icon">&#9876;&#65039;</span>
        <div class="split-name">Weapons 3D Models</div>
        <div class="split-count">${wCount} models &#183; firearms, blades, munitions, armour</div>
      </a>
      <a href="/categories/tools/" class="split-card">
        <span class="split-icon">&#128295;</span>
        <div class="split-name">Tools 3D Models</div>
        <div class="split-count">${tCount} models &#183; hand tools, power tools, workshop equipment</div>
      </a>
    </div>
    <p class="cat-desc"><a href="/">See all categories</a> or use <a href="/search/">Search</a> to find a specific model.</p>
  </div>
</section>
</main>
${FOOTER}
<script src="/assets/js/site.min.js?v=33" defer></script>
</body>
</html>`;

const dir = path.join(CATEGORIES, OLD);
// старые страницы пагинации разделённой категории больше не нужны
const pageDir = path.join(dir, 'page');
if (fs.existsSync(pageDir)) {
  fs.rmSync(pageDir, { recursive: true });
  console.log('удалена пагинация ' + OLD + '/page/');
}
fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
console.log('страница-развилка: /categories/' + OLD + '/  ->  weapons (' + wCount + '), tools (' + tCount + ')');
