// enrich-legacy-cards.mjs — добор 423 карточек на СТАРОМ шаблоне.
//
// Эти страницы отличаются от основных: в хлебной крошке на 2-й позиции стоит
// «Full Catalog» вместо категории, нет блоков Use Cases / Search Keywords / Related.
// Именно они были единственными, где уже стоял Product JSON-LD.
// У 259 из них og:image пустой — превью так и не подтянулось (URL в CSV ведут на
// static.turbosquid.com, который отдаёт 403; рабочие ссылки идут через p.turbosquid.com
// и для этих моделей у нас их нет). Для них подставляется брендовая заглушка.
//
// Тексты — общий модуль scripts/card-content.mjs.
//
// Запуск:  node scripts/enrich-legacy-cards.mjs --dry
//          node scripts/enrich-legacy-cards.mjs

import fs from 'node:fs';
import path from 'node:path';
import { anchorClassify } from './anchors25.mjs';
import { esc, plain, description, specTable, faqBlock, productSchema, dateLine, pageSchema } from './card-content.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
const UPDATED_ISO = '2026-08-02';
const UPDATED_HUMAN = '2 August 2026';
const DRY = process.argv.includes('--dry');

// отображаемые имена 25 категорий — как в меню
const DISP = {
  'vehicles': 'Vehicles', 'aircraft': 'Aircraft', 'military-vehicles': 'Military Vehicles',
  'weapons-tools': 'Weapons & Tools', 'ships': 'Ships', 'animals-creatures': 'Animals & Creatures',
  'characters-people': 'Characters & People', 'nature-plants': 'Nature & Plants',
  'medical-3d-models': 'Medical', 'architecture-landmarks': 'Architecture',
  'furniture-interior': 'Furniture & Interior', 'lighting': 'Lighting',
  'kitchen-tableware': 'Kitchen & Tableware', 'food-beverages': 'Food & Beverages',
  'electronics-gadgets': 'Electronics', 'industrial-equipment': 'Industrial Equipment',
  'containers-storage': 'Containers & Storage', 'clothing-accessories': 'Clothing & Accessories',
  'sports-recreation': 'Sports & Recreation', 'toys-games': 'Toys & Games',
  'musical-instruments': 'Musical Instruments', 'signage-decor': 'Signage & Decor',
  'space-scifi': 'Space & Sci-Fi', 'collections-sets': 'Collections & Sets', 'other': 'Other',
};

// ── факты из CSV ──────────────────────────────────────────────────────────────
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const facts = new Map();
{
  const lines = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
  const H = lines[0].split(',');
  const c = n => H.indexOf(n);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const r = parseCsvLine(lines[i]);
    facts.set(r[c('product_id')], {
      cert: r[c('certification')], sub: r[c('subcategory')],
      industries: (r[c('industries')] || '').split('|').filter(Boolean),
      uses: (r[c('use_cases')] || '').split('|').filter(Boolean),
      keywords: (r[c('seo_keywords')] || '').split('|').filter(Boolean),
      days: +r[c('days_in_sales')] || 0,
    });
  }
}

// ── обработка ─────────────────────────────────────────────────────────────────
// Список слагов берём из кэша enrich-cards.mjs: 86 869 вызовов fs.existsSync
// на этом диске стоят минуты.
const CATMAP = path.join(ROOT, 'scripts', '.catmap.json');
const allDirs = fs.existsSync(CATMAP)
  ? Object.keys(JSON.parse(fs.readFileSync(CATMAP, 'utf8')))
  : fs.readdirSync(MODELS).filter(d => fs.existsSync(path.join(MODELS, d, 'index.html')));

// Страниц на старом шаблоне всего 423, но чтобы их найти, надо прочитать все 87 тысяч
// файлов — это десятки минут. Список кэшируем; --rescan пересобирает его заново.
const LEGACY_LIST = path.join(ROOT, 'scripts', '.legacy-slugs.json');
let dirs;
if (fs.existsSync(LEGACY_LIST) && !process.argv.includes('--rescan')) {
  dirs = JSON.parse(fs.readFileSync(LEGACY_LIST, 'utf8'));
  console.error('Список старого шаблона из кэша: ' + dirs.length + ' (--rescan чтобы пересобрать).');
} else {
  console.error('Ищу страницы старого шаблона среди ' + allDirs.length + ' карточек...');
  dirs = allDirs.filter(d => {
    try { return !fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8').includes('section-label mp-mb12">Use Cases'); }
    catch { return false; }
  });
  fs.writeFileSync(LEGACY_LIST, JSON.stringify(dirs));
  console.error('Найдено и закэшировано: ' + dirs.length);
}
let ok = 0, skipped = 0, noImg = 0; const reasons = {}; const cats = {};

for (const slug of dirs) {
  const file = path.join(MODELS, slug, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  // Старый шаблон опознаём ПО СТРУКТУРЕ: в нём нет блока Use Cases. Опираться на
  // крошку «Full Catalog» нельзя — прошлый прогон её уже заменил на реальную категорию.
  if (html.includes('section-label mp-mb12">Use Cases')) continue;  // основной шаблон

  // идемпотентность: снимаем прошлый прогон
  if (html.includes('mp-spec-block')) {
    html = html.replace(/\s*<div class="mp-spec-block">[\s\S]*?<\/tbody><\/table>\s*<\/div>/, '');
    html = html.replace(/\s*<div class="mp-faq-block">[\s\S]*?<\/p>\s*<\/div>/, '');
    if (html.includes('mp-spec-block') || html.includes('mp-faq-block')) {
      skipped++; reasons['старые блоки не снялись'] = (reasons['старые блоки не снялись'] || 0) + 1; continue;
    }
  }
  html = html.replace(/\s*<div class="mp-meta-line">[\s\S]*?<\/div>/, '');
  html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"@type":"ItemPage"[^]*?<\/script>\s*/, '');

  const id = (slug.match(/-(\d+)$/) || [])[1];
  const f = facts.get(id);
  const name = (html.match(/<h1 class="mp-h1">\s*([\s\S]*?)\s*<\/h1>/) || [])[1];
  const price = (html.match(/<span class="mp-price">\$([\d.]+)<\/span>/) || [])[1];
  const ogImg = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
  const hero = ogImg || SITE + '/assets/og/3d-molier-og.jpg';
  if (!ogImg) noImg++;
  const tsUrl = (html.match(/href="(https:\/\/www\.turbosquid\.com\/3d-models\/[^"]+?)"/) || [])[1];
  if (!f || !name || !price || !tsUrl) {
    skipped++; reasons['не извлеклись поля'] = (reasons['не извлеклись поля'] || 0) + 1; continue;
  }

  const catSlug = anchorClassify(name) || 'other';
  const cat = DISP[catSlug] || 'Other';
  cats[cat] = (cats[cat] || 0) + 1;
  const seed = +id;
  const clean = name.replace(/\s+/g, ' ').trim();
  const desc = description(f, clean, cat, price, seed);

  // ВАЖНО: заменяем ФУНКЦИЕЙ, а не строкой. В тексте есть цены вида «$19», и в строке
  // замены «$1» трактуется как ссылка на первую группу регулярки.
  const put = s => () => s;

  // 1. крошка — видимая и в JSON-LD: «Full Catalog» это не категория
  html = html.replace(/<a href="\/full-catalog\/" class="mp-bc-link">Full Catalog<\/a>/,
    put(`<a href="/categories/${catSlug}/" class="mp-bc-link">${esc(cat)}</a>`));
  html = html.replace(/"position":2,"name":"Full Catalog","item":"https:\/\/3dmolierstudio\.com\/full-catalog\/"/,
    put(`"position":2,"name":"${plain(cat)}","item":"${SITE}/categories/${catSlug}/"`));

  // 2. описание
  if (!/<p class="mp-desc-text">[\s\S]*?<\/p>/.test(html)) {
    skipped++; reasons['нет mp-desc-text'] = (reasons['нет mp-desc-text'] || 0) + 1; continue;
  }
  html = html.replace(/<p class="mp-desc-text">[\s\S]*?<\/p>/, put('<p class="mp-desc-text">' + desc + '</p>'));

  // 3. строка авторства и дат + новые блоки, сразу после абзаца About
  const meta = dateLine(f, UPDATED_ISO, UPDATED_HUMAN);
  html = html.replace(/(<p class="mp-desc-text">[\s\S]*?<\/p>)/, m => m + '\n' + meta);
  const spec = specTable(f, clean, cat, catSlug, price);
  const faq = faqBlock(f, clean, cat, catSlug, price, tsUrl, seed);
  html = html.replace(/(<div class="mp-meta-line">[\s\S]*?<\/div>\s*<\/div>)/, m => m + '\n' + spec + '\n' + faq);

  // 4. Product JSON-LD + ItemPage с датами и автором
  const ps = productSchema({ name: clean, slug, id, hero, tsUrl, cat, price, desc, f, site: SITE });
  html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"@type":\s*"Product"[^]*?<\/script>/, put(ps));
  const pgs = pageSchema({ name: clean, slug, cat, catSlug, desc, hero, f, site: SITE, updatedIso: UPDATED_ISO });
  html = html.replace(/(<script type="application\/ld\+json">\s*\{[\s\S]{0,80}"@type":\s*"BreadcrumbList")/, m => pgs + '\n' + m);

  // 5. голова: preconnect, title, версия
  if (!html.includes('p.turbosquid.com" crossorigin')) {
    html = html.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
      '<link rel="preconnect" href="https://p.turbosquid.com" crossorigin>\n<link rel="dns-prefetch" href="https://p.turbosquid.com">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  }
  html = html.replace(/(<title>[^<]*?) on TurboSquid<\/title>/, (m, a) => a + '</title>');
  if (!html.includes('mp-footer-legal')) {
    html = html.replace(/(<p class="mp-footer-copy">[\s\S]*?<\/p>)/, m => m +
      '\n      <div class="mp-footer-legal">' +
      '<a href="/about/">About</a> <a href="/contact/">Contact</a> ' +
      '<a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a></div>');
  }
  html = html.replace(/\.css\?v=33/g, '.css?v=34').replace(/\.js\?v=33/g, '.js?v=34');

  // 6. футер back-link
  html = html.replace(/<a href="\/full-catalog\/" class="nav-link mp-back-link">&#8592;[^<]*<\/a>/,
    put(`<a href="/categories/${catSlug}/" class="nav-link mp-back-link">&#8592; All ${esc(cat)} Models</a>`));

  // 7. метка, чтобы повторный прогон нашёл эти страницы после смены крошки
  if (!html.includes('mp-legacy-enriched')) {
    html = html.replace('<div class="mp-details-left">', put('<div class="mp-details-left mp-legacy-enriched">'));
  }

  // 8. контроль
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) { console.error('СТОП: меню на ' + slug); process.exit(1); }
  if (!html.includes('mp-spec-block') || !html.includes('mp-faq-block') || !/"@type":"Product"/.test(html)
    || !html.includes('mp-meta-line') || !/"@type":"ItemPage"/.test(html)) {
    skipped++; reasons['блоки не вставились'] = (reasons['блоки не вставились'] || 0) + 1; continue;
  }

  if (!DRY) fs.writeFileSync(file, html);
  ok++;
}

console.error('Обработано: ' + ok + (DRY ? ' (--dry, не записано)' : '') + '   Пропущено: ' + skipped);
console.error('Без своего превью (подставлена заглушка): ' + noImg);
console.error('Причины пропуска: ' + JSON.stringify(reasons));
console.error('Категории: ' + JSON.stringify(cats, null, 1));
