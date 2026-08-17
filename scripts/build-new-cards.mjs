// build-new-cards.mjs — карточки для новых моделей, которых ещё нет на сайте.
//
// Источники:
//   data/new-products.json   — что вышло на TurboSquid (id, имя, цена, сертификация, дата)
//   data/model-specs.json    — измеренные характеристики из нашего inventory
//   data/new-previews.json   — главный кадр
//   выгрузка studio-inventory.json — галерея и ключевые слова
//
// Обвязка страницы (голова, шапка, подвал, скрипты) берётся из существующей
// карточки-образца: так новая страница не отличается от 58 тысяч прежних ни
// вёрсткой, ни меню. Всё содержимое <main> строится заново.
//
// Уникальность текста держится на измеренных числах: полигоны, вершины,
// разрешение текстур, габариты. Это единственная часть, которая у каждой модели
// своя по факту, а не по перестановке слов (см. card-content.mjs).
//
// Запуск:  node scripts/build-new-cards.mjs <studio-inventory.json> --limit 3 --dry
//          node scripts/build-new-cards.mjs <studio-inventory.json>

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc, description, specTable, faqBlock, productSchema, dateLine, pageSchema, proseName } from './card-content.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DATA = path.join(ROOT, 'data');
const SITE = 'https://3dmolierstudio.com';
const TEMPLATE = path.join(MODELS, 'baseball-hat-3-968930', 'index.html');
const UPDATED_ISO = new Date().toISOString().slice(0, 10);
const UPDATED_HUMAN = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const args = process.argv.slice(2);
const DUMP = args.find(a => /\.json$/i.test(a));
const DRY = args.includes('--dry');
const LIMIT = args.includes('--limit') ? +args[args.indexOf('--limit') + 1] : 0;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

// ── классификатор: тот же, что у хабов ───────────────────────────────────────
const { anchorClassify } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'anchors25.mjs')).href);
const { classifyByReport } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'category-map.mjs')).href);
const clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
const dispOf = Object.fromEntries(CATS.map(c => [c[0], c[1]])); dispOf.other = 'Other';
const keywordClassify = name => {
  const t = new Set(String(name).toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [s, d, k] of CATS) if (k.find(x => t.has(x))) return s;
  return anchorClassify(name) || 'other';
};
const classify = (name, id) => classifyByReport(id, name) || keywordClassify(name);

// ── данные ───────────────────────────────────────────────────────────────────
const products = JSON.parse(fs.readFileSync(path.join(DATA, 'new-products.json'), 'utf8'));
const specs = JSON.parse(fs.readFileSync(path.join(DATA, 'model-specs.json'), 'utf8'));
const previews = JSON.parse(fs.readFileSync(path.join(DATA, 'new-previews.json'), 'utf8'));
const dump = DUMP && fs.existsSync(DUMP) ? JSON.parse(fs.readFileSync(DUMP, 'utf8')).result || {} : {};

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const REFERRAL = 'referral=3d_molier-international';
const tsLink = (name, id) => 'https://www.turbosquid.com/3d-models/' + slugify(name) + '-' + id + '?' + REFERRAL;

// Отрасли и сценарии по категории — те же наборы, что стоят на существующих
// карточках, чтобы новые не выбивались из общего вида.
const IND = {
  vehicles: ['Game Development', 'Film Production', 'Advertising', 'Virtual Reality', 'Architecture'],
  aircraft: ['Aerospace', 'Film Production', 'Game Development', 'Military & Defense', 'Virtual Reality'],
  'military-vehicles': ['Military & Defense', 'Film Production', 'Game Development', 'Virtual Reality'],
  weapons: ['Military & Defense', 'Game Development', 'Film Production'],
  tools: ['Hardware', 'Architecture', 'Advertising', 'Film Production'],
  ships: ['Film Production', 'Game Development', 'Virtual Reality'],
  'animals-creatures': ['Film Production', 'Game Development', 'Advertising', 'Virtual Reality'],
  'characters-people': ['Game Development', 'Film Production', 'Virtual Reality'],
  'nature-plants': ['Architecture', 'Film Production', 'Game Development'],
  'medical-3d-models': ['Medical', 'Film Production', 'Virtual Reality', 'Software Dev'],
  'architecture-landmarks': ['Architecture', 'Film Production', 'Virtual Reality', 'Advertising'],
  'furniture-interior': ['Architecture', 'Advertising', 'Virtual Reality'],
  lighting: ['Architecture', 'Advertising', 'Film Production'],
  'kitchen-tableware': ['Advertising', 'Architecture', 'Film Production'],
  'food-beverages': ['Advertising', '3D Printing', 'Film Production'],
  'electronics-gadgets': ['Advertising', 'Software Dev', 'Hardware', 'Film Production'],
  'industrial-equipment': ['Hardware', 'Architecture', 'Film Production', 'Software Dev'],
  'containers-storage': ['Hardware', 'Architecture', 'Advertising'],
  'clothing-accessories': ['Advertising', 'Game Development', 'Film Production'],
  'sports-recreation': ['Advertising', 'Game Development', 'Film Production'],
  'toys-games': ['Advertising', 'Game Development', '3D Printing'],
  'musical-instruments': ['Film Production', 'Advertising', 'Game Development'],
  'signage-decor': ['Advertising', 'Architecture', 'Event Management'],
  'space-scifi': ['Film Production', 'Game Development', 'Aerospace'],
  'collections-sets': ['Film Production', 'Game Development', 'Architecture'],
  other: ['Game Development', 'Film Production', 'Advertising', 'Virtual Reality'],
};
const IND_SLUG = {
  'Game Development': 'game-development', 'Film Production': 'film-video-production',
  Advertising: 'advertising', 'Virtual Reality': 'virtual-reality', Architecture: 'architecture',
  Aerospace: 'aerospace', 'Military & Defense': 'military-defense', Medical: 'medical',
  'Software Dev': 'software-development', Hardware: 'hardware', '3D Printing': '3d-printing',
  'Event Management': 'event-management',
};
const USES = {
  vehicles: ['visualization', 'advertising', 'game environments'],
  'medical-3d-models': ['medical education', 'visualization', 'simulation'],
  'architecture-landmarks': ['architectural visualization', 'advertising', 'virtual reality'],
  'food-beverages': ['advertising', 'visualization', '3D printing'],
  other: ['visualization', 'advertising', 'game assets'],
};

// ── обвязка из образца ───────────────────────────────────────────────────────
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
const HEADER = (tpl.match(/<header id="site-header">[\s\S]*?<\/header>/) || [''])[0];
const FOOTER = (tpl.match(/<footer class="mp-footer">[\s\S]*?<\/footer>/) || [''])[0];
const TAIL = tpl.slice(tpl.indexOf('</footer>') + 9);          // скрипты и </body></html>
const HEAD_CSS = (tpl.match(/<link rel="stylesheet"[\s\S]*?(?=<script|<\/head>)/) || [''])[0];
const GTAG = (tpl.match(/<!-- Google tag[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/) || [''])[0];
if (!HEADER || !FOOTER) { console.log('СТОП: не разобран образец ' + TEMPLATE); process.exit(1); }

function buildPage(p) {
  const id = String(p.pid);
  const name = p.name;
  const slug = slugify(name) + '-' + id;
  const cat = classify(name, id);
  const catDisp = dispOf[cat] || 'Other';
  const price = +p.price || 0;
  const hero = previews[id];
  const sp = specs[id];
  const d = dump[id] || {};
  const gallery = (d.images || []).slice(0, 12);
  const seed = parseInt(id.slice(-6), 10) || 1;
  const url = SITE + '/models/' + slug + '/';
  const ts = tsLink(name, id);
  const days = p.date ? Math.max(0, Math.round((Date.now() - Date.parse(p.date)) / 86400000)) : 0;
  const kw = String(d.keywords || '').split(/[\s,]+/).filter(Boolean).slice(0, 12);

  const f = {
    cert: p.cert === '#N/A' ? 'no certification' : (p.cert || 'no certification'),
    days,
    industries: IND[cat] || IND.other,
    uses: USES[cat] || USES.other,
    // cat2 приходит строчными («tree»), а в чипе и строке Type он читается как
    // подпись — приводим к виду с заглавной.
    sub: p.cat2 && p.cat2 !== '-' ? String(p.cat2).replace(/\b\w/g, c => c.toUpperCase()) : null,
    keywords: kw,
    specs: sp || null,
  };

  const desc = description(f, name, catDisp, price, seed);
  const metaDesc = ('Buy ' + proseName(name) + ' 3D model by 3D Molier on TurboSquid. '
    + (f.cert === 'no certification' ? '' : f.cert + ' certified. ')
    + catDisp + ' asset, $' + price + '.'
    + (sp && sp.polygons ? ' ' + sp.polygons.toLocaleString('en-US') + ' polygons.' : '')).slice(0, 158);
  const title = proseName(name) + ' 3D Model - $' + price + ' | 3D Molier';

  const industriesHtml = (f.industries || []).map(i =>
    '<a href="/industries/' + (IND_SLUG[i] || slugify(i)) + '/" class="chip chip--sm">' + esc(i) + '</a>').join('');

  const galleryHtml = gallery.length > 1
    ? '<div class="mp-gallery" data-gallery><div class="mp-gal-cap" data-gal-cap>View 1</div><div class="mp-gal-strip">'
    + gallery.map((g, i) => '<button type="button" class="mp-gal-thumb' + (i ? '' : ' is-on')
      + '" data-full="' + esc(g) + '" data-cap="View ' + (i + 1) + '" title="View ' + (i + 1) + '" aria-label="View ' + (i + 1) + '">'
      + '<img src="' + esc(g) + '" alt="' + esc(proseName(name)) + ' - view ' + (i + 1) + '" width="200" height="113" loading="lazy" decoding="async">'
      + '<span class="mp-gal-lbl">' + (i + 1) + '</span></button>').join('')
    + '</div></div>' : '';

  const head = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + esc(title) + '</title>'
    + '<meta name="description" content="' + esc(metaDesc) + '">'
    + '<meta property="og:type" content="product">'
    + '<meta property="og:title" content="' + esc(proseName(name)) + ' 3D Model | 3D Molier">'
    + '<meta property="og:description" content="' + esc(metaDesc) + '">'
    + '<meta property="og:url" content="' + url + '">'
    + '<meta property="og:site_name" content="3D Molier Models">'
    + (hero ? '<meta property="og:image" content="' + esc(hero) + '">' : '')
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<meta name="twitter:title" content="' + esc(proseName(name)) + ' 3D Model | 3D Molier">'
    + '<meta name="twitter:description" content="' + esc(metaDesc) + '">'
    + (hero ? '<meta name="twitter:image" content="' + esc(hero) + '">' : '')
    + '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
    + '<link rel="canonical" href="' + url + '">'
    + '<link rel="alternate" hreflang="en" href="' + url + '">'
    + '<link rel="alternate" hreflang="x-default" href="' + url + '">'
    + (hero ? '<link rel="preload" as="image" href="' + esc(hero) + '" fetchpriority="high">' : '')
    + HEAD_CSS
    // productSchema и pageSchema возвращают уже готовый тег <script>, оборачивать
    // их второй раз нельзя — получаются вложенные теги и неразбираемый JSON-LD.
    + productSchema({ name, slug, id, hero, tsUrl: ts, cat: catDisp, price, desc, f, site: SITE })
    + pageSchema({ name, slug, cat: catDisp, catSlug: cat, desc, hero, f, site: SITE, updatedIso: UPDATED_ISO })
    + '<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: catDisp, item: SITE + '/categories/' + cat + '/' },
        { '@type': 'ListItem', position: 3, name: proseName(name), item: url },
      ],
    }) + '</script>'
    + GTAG + '</head>';

  const main = '<main id="main-content" class="mp-main">'
    + '<div class="mp-bc-bar"><div class="max-w-7xl mx-auto px-6 py-3 mp-bc-inner">'
    + '<a href="/" class="mp-bc-link">Home</a><span class="mp-bc-sep">&#8250;</span>'
    + '<a href="/categories/' + cat + '/" class="mp-bc-link">' + esc(catDisp) + '</a>'
    + '<span class="mp-bc-sep">&#8250;</span><span class="mp-bc-current">' + esc(proseName(name)) + '</span></div></div>'
    + '<section class="mp-hero-section"><div class="max-w-7xl mx-auto"><div class="mp-hero-grid">'
    + '<div class="hero-img-frame mp-hero-frame">'
    + (hero ? '<img src="' + esc(hero) + '" alt="' + esc(proseName(name)) + ' 3D model preview" width="1200" height="675" decoding="async" loading="eager" fetchpriority="high" class="mp-hero-img" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">' : '')
    + '<div class="img-placeholder mp-placeholder"' + (hero ? '' : ' style="display:flex;"') + '><span class="mp-placeholder-icon">&#128247;</span><span class="mp-placeholder-cat">' + esc(catDisp) + '</span></div></div>'
    + galleryHtml
    + '<div class="mp-info-col"><div class="mp-badge-row">'
    + '<a href="/categories/' + cat + '/" class="chip chip-teal chip--sm">' + esc(catDisp) + '</a>'
    + (f.sub ? '<span class="chip chip--sm">' + esc(f.sub) + '</span>' : '')
    + (f.cert !== 'no certification' ? '<span class="cert-badge">&#10003;&nbsp;' + esc(f.cert) + ' Certified</span>' : '')
    + '</div><h1 class="mp-h1">' + esc(proseName(name)) + '</h1>'
    + '<div class="mp-price-row"><span class="mp-price">$' + price + '</span><span class="mp-price-label">USD on TurboSquid</span></div>'
    + '<div class="mp-ctas"><a href="' + ts + '" target="_blank" rel="noopener" class="btn-primary mp-btn-center">View on TurboSquid</a>'
    + '<a href="/categories/' + cat + '/" class="btn-ghost mp-btn-browse">Browse ' + esc(catDisp) + ' Models</a></div>'
    + '<div class="mp-industries"><div class="mp-field-label">Used In</div><div class="mp-chip-row">' + industriesHtml + '</div></div>'
    + '</div></div></div></section>'
    + '<section class="mp-details-section"><div class="max-w-7xl mx-auto"><div class="mp-details-grid"><div class="mp-details-left">'
    + '<div><div class="section-label mp-mb12">About This Model</div><p class="mp-desc-text">' + desc + '</p>'
    + dateLine(f, UPDATED_ISO, UPDATED_HUMAN) + '</div>'
    + specTable(f, name, catDisp, cat, price)
    + faqBlock(f, name, catDisp, cat, price, ts, seed)
    + '</div></div></div></section></main>';

  return { slug, cat, html: head + '<body class="relative min-h-screen">' + HEADER + main + FOOTER + TAIL };
}

// ── обход ────────────────────────────────────────────────────────────────────
let made = 0, skipExists = 0, skipNoImg = 0, skipNoSpec = 0;
const samples = [];
let list = products.filter(p => specs[String(p.pid)] && previews[String(p.pid)]);
if (ONLY) list = products.filter(p => ONLY.includes(String(p.pid)));
if (LIMIT) list = list.slice(0, LIMIT);

for (const p of list) {
  const id = String(p.pid);
  if (!specs[id]) { skipNoSpec++; continue; }
  if (!previews[id]) { skipNoImg++; continue; }
  const built = buildPage(p);
  const dir = path.join(MODELS, built.slug);
  if (fs.existsSync(path.join(dir, 'index.html'))) { skipExists++; continue; }

  // преграды: меню на месте, разметка разбирается, заголовок не пуст
  if (!built.html.includes('<a href="/categories/other/" role="menuitem"')) { console.log('СТОП: меню, ' + built.slug); process.exit(1); }
  for (const blk of built.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(blk.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { console.log('СТОП: битый JSON-LD, ' + built.slug); process.exit(1); }
  }
  if (!/<h1 class="mp-h1">[^<]+<\/h1>/.test(built.html)) { console.log('СТОП: пустой H1, ' + built.slug); process.exit(1); }

  if (!DRY) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), built.html); }
  made++;
  if (samples.length < 5) samples.push({ slug: built.slug, cat: built.cat, name: p.name });
}

console.log('создано карточек: ' + made + (DRY ? '  (--dry)' : ''));
console.log('  уже существовали: ' + skipExists + ', без характеристик: ' + skipNoSpec + ', без картинки: ' + skipNoImg);
console.log('\nпримеры:');
for (const s of samples) console.log('   ' + SITE + '/models/' + s.slug + '/   [' + s.cat + ']  ' + s.name);
