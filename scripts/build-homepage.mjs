/*
 * build-homepage.mjs - главная как витрина, а не как справочник.
 *
 * Что было не так. Разделов много, но все одного размера: ряды одинаковых
 * плиточек с мелкими превью, между ними пустоты, и одни и те же восемь
 * снимков повторяются в категориях, индустриях и подборках. Каталог из
 * 59 639 моделей выглядел беднее, чем он есть.
 *
 * Откуда взят приём. Смотрел cgtrader.com живьём и снял геометрию: сетка в
 * 12 колонок, зазор 10px, плитки трёх размеров - 3x1 (269x215), 6x1 (548x219)
 * и 3x2 (269x440). Картинка занимает плитку целиком, подпись и счётчик лежат
 * поверх неё внизу. Первый экран - полноэкранная фотография с поиском поверх,
 * а не белое поле. Ровно это здесь и сделано, на своих моделях.
 *
 * Картинки выбраны по числу полигонов внутри категории: тяжёлые модели - это
 * крупные детальные сцены, они держат большую плитку, тогда как дешёвая мелочь
 * на всю ширину выглядит пусто. Все снимки разные, повторов нет.
 *
 * Числа на плитках - по карточкам этого сайта, а не по всему магазину
 * TurboSquid. Раньше плитка Vehicles писала 7,133, хотя страниц этой категории
 * на сайте 4,123.
 *
 * Запуск:
 *   node build-homepage.mjs --preview   -> preview/home/
 *   node build-homepage.mjs --apply     -> index.html + assets/css/styles.css
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PREVIEW = argv.includes('--preview');
if (!APPLY && !PREVIEW) { console.error('нужен --preview или --apply'); process.exit(1); }

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');
const n = x => x.toLocaleString('en-US');

// ── Плитки мозаики ───────────────────────────────────────────────────────────
// span: сколько колонок из 12 и сколько рядов. Порядок задаёт ритм: широкая,
// потом две обычных, потом высокая рядом с обычными - как на cgtrader.
//
// Пропорции кадров проверены в браузере (scratchpad/probe.mjs): путь картинки
// всегда содержит 1920x1080, но отдаётся то 16:9, то квадрат - зависит от
// того, как отрендерил художник. Широким плиткам даны настоящие 16:9, а
// высокой - квадратный кадр: он переносит вертикальную обрезку лучше, чем
// широкий, у которого при таком кропе остаётся одна середина.
//
// Ряды складываются ровно, без дырок: 6+3+3, потом 3(высокая)+3+3+3,
// её продолжение +3+3+3, и 3+3+6.
const TILES = [
  { slug: 'boeing-737-900-aircraft-with-luxury-interior-and-cockpit-2367696', cat: 'Aircraft', href: '/categories/aircraft/', count: 1514, cols: 6, rows: 1 },
  { slug: 'sport-lisboa-e-benfica-stadium-2208619', cat: 'Architecture', href: '/categories/architecture-landmarks/', count: 4574, cols: 3, rows: 1 },
  { slug: 'locomotive-with-car-transporter-loaded-2384760', cat: 'Vehicles', href: '/categories/vehicles/', count: 4123, cols: 3, rows: 1 },

  { slug: 'medieval-merchant-with-market-stall-2282241', cat: 'Characters & People', href: '/categories/characters-people/', count: 2888, cols: 3, rows: 2 },
  { slug: 'black-marlin-heavy-load-carrier-with-drilling-rig-1878441', cat: 'Ships', href: '/categories/ships/', count: 701, cols: 3, rows: 1 },
  { slug: 'mining-multi-bucket-wheel-excavator-with-mining-truck-1896313', cat: 'Industrial', href: '/categories/industrial-equipment/', count: 2488, cols: 3, rows: 1 },
  { slug: 'international-space-station-habitable-artificial-satellite-1852990', cat: 'Space & Sci-Fi', href: '/categories/space-scifi/', count: 482, cols: 3, rows: 1 },

  { slug: 'aircraft-carrier-with-airplanes-1863177', cat: 'Military', href: '/categories/military-vehicles/', count: 224, cols: 3, rows: 1 },
  { slug: 'people-near-counter-with-fresh-fruits-2384571', cat: 'Furniture & Interior', href: '/categories/furniture-interior/', count: 3702, cols: 3, rows: 1 },
  { slug: 'young-man-full-body-anatomy-set-1841426', cat: 'Medical', href: '/categories/medical-3d-models/', count: 2796, cols: 3, rows: 1 },

  { slug: 'four-horses-with-stagecoach-2382383', cat: 'Animals & Creatures', href: '/categories/animals-creatures/', count: 3514, cols: 3, rows: 1 },
  { slug: 'transporter-erector-loader-with-raised-elevated-trailer-2184605', cat: 'Weapons', href: '/categories/weapons/', count: 1982, cols: 3, rows: 1 },
  { slug: 'nasa-mission-control-room-space-center-1503696', cat: 'Electronics', href: '/categories/electronics-gadgets/', count: 3706, cols: 6, rows: 1 },
];

const HERO_SLUG = 'international-airport-1475439';
const STUDIO_SLUG = 'equipped-military-drone-airbase-with-uav-desert-2530374';

// ── Топ-продажи ──────────────────────────────────────────────────────────────
// Те же восемь моделей, что и были, но карточка теперь - сама картинка, а имя
// и цена лежат поверх неё. Первая идёт крупной плиткой 6x2: у витрины должна
// быть одна вещь, на которую смотришь первой.
const TOP = [
  { slug: 'railroad-amtrak-passenger-car-2-930528', name: 'Railroad Amtrak Passenger Car 2', price: '$79', cat: 'Vehicles', cols: 6, rows: 2 },
  { slug: 'airbus-a400m-atlas-military-transport-aircraft-rigged-1550640', name: 'Airbus A400M Atlas Rigged', price: '$219', cat: 'Aircraft', cols: 3, rows: 1 },
  { slug: 'sigma-class-indonesian-frigate-1394359', name: 'Sigma Class Indonesian Frigate', price: '$199', cat: 'Military Vehicles', cols: 3, rows: 1 },
  { slug: 'viking-ship-dragon-head-1786441', name: 'Viking Ship Dragon Head', price: '$39', cat: 'Ships', cols: 3, rows: 1 },
  { slug: 'boiler-suit-coverall-with-safety-helmet-1138628', name: 'Boiler Suit with Safety Helmet', price: '$99', cat: 'Industrial', cols: 3, rows: 1 },
  { slug: 'shanghai-tower-china-904226', name: 'Shanghai Tower China', price: '$99', cat: 'Architecture', cols: 6, rows: 1 },
  { slug: 'golden-chinese-dragon-3d-model-1379923', name: 'Golden Chinese Dragon', price: '$99', cat: 'Animals', cols: 3, rows: 1 },
  { slug: 'male-pelvis-skeleton-1023424', name: 'Male Pelvis Skeleton', price: '$49', cat: 'Medical', cols: 3, rows: 1 },
];

// ── Отрасли ──────────────────────────────────────────────────────────────────
// Ритм нарочно другой: полоса низких плиток по четыре в ряд. Три одинаковые
// мозаики подряд читались бы как одна длинная, а это разные вопросы -
// «что искать» и «для чего это берут».
// Счётчики убраны: они считали весь магазин TurboSquid (Film & Video - 83 145),
// а числа на плитках категорий считают страницы этого сайта. Рядом две системы
// счёта на одной странице сбивают с толку.
const INDUSTRIES = [
  { key: 'aerospace', name: 'Aerospace', slug: 'x-madis-anti-drone-system-1896205' },
  { key: 'military-defense', name: 'Military & Defense', slug: 'stealth-bomber-b-2-spirit-1127231' },
  { key: 'medical', name: 'Medical', slug: 'complete-female-body-anatomy-1611038' },
  { key: 'game-development', name: 'Game Development', slug: 'boeing-737-interior-1191819' },
  { key: 'film-video-production', name: 'Film & Video', slug: 'train-es40dc-csx-blue-and-covered-hopper-car-949756' },
  { key: 'architecture', name: 'Architecture', slug: 'cape-town-stadium-green-point-3d-model-1031144' },
  { key: 'virtual-reality', name: 'Virtual Reality', slug: 'boeing-c17-globemaster-iii-cargo-door-open-1892082' },
  { key: 'advertising', name: 'Advertising', slug: 'airbus-a220-300-detailed-interior-1608806' },
];

// ── Подборки ─────────────────────────────────────────────────────────────────
// Прежние пять «Curated Collections» вели на /categories/vehicles/,
// /categories/aircraft/ и так далее - то есть ровно туда же, куда плитки
// категорий выше. Секция дублировала предыдущую. Здесь настоящие страницы
// подборок из /collections/, и темы взяты те, которых нет среди плиток.
const COLLECTIONS = [
  { key: 'holidays', name: 'Holidays', desc: 'Gifts, decorations and seasonal props', slug: 'wedding-presents-3d-models-set-2-997567' },
  { key: 'food-drink', name: 'Food & Drink', desc: 'Packaging, produce and tableware', slug: 'beer-kegs-set-1622300' },
  { key: 'fashion', name: 'Fashion', desc: 'Garments, footwear and accessories', slug: 'ballet-shoes-set-1066973' },
  { key: 'sports', name: 'Sports', desc: 'Kit, equipment and arenas', slug: 'hockey-goalie-protection-kit-red-2-1046985' },
  { key: 'art-media', name: 'Art & Media', desc: 'Instruments, studio and stage gear', slug: 'yamaha-concert-timpani-set-1362555' },
  { key: 'toys-games', name: 'Toys & Games', desc: 'Playsets, models and board pieces', slug: 'classical-train-toy-set-locomotive-with-wagons-1342305' },
];

// ── Картинка модели берётся из её же карточки ────────────────────────────────
// Часть страниц - варианты, слитые в основную карточку: у них вместо
// содержимого стоит перенаправление и картинки нет. Для таких берём основную,
// но ссылку на TurboSquid оставляем ту, что была: это отдельный товар с
// отдельным идентификатором.
const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
function heroImage(slug) {
  const read = s => {
    const f = path.join(ROOT, 'models', s, 'index.html');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  let h = read(slug);
  let img = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  if (!img && merged[slug]) { h = read(merged[slug]); img = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1]; }
  if (!img) throw new Error('нет картинки у ' + slug);
  const name = ((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || slug).replace(/<[^>]+>/g, '').trim();
  return { img, name };
}

const seen = new Set();
for (const t of TILES) {
  const { img, name } = heroImage(t.slug);
  if (seen.has(img)) throw new Error('повтор картинки: ' + t.slug);
  seen.add(img);
  t.img = img; t.name = name;
}
const hero = heroImage(HERO_SLUG);
const studioImg = heroImage(STUDIO_SLUG);

// Одна и та же картинка в двух местах - главная причина, по которой каталог
// выглядел беднее, чем он есть. Проверяем это, а не надеемся.
for (const list of [TOP, INDUSTRIES, COLLECTIONS]) {
  for (const x of list) {
    const { img, name } = heroImage(x.slug);
    if (seen.has(img)) throw new Error('повтор картинки: ' + x.slug);
    seen.add(img);
    x.img = img; x.modelName = name;
  }
}
for (const one of [hero, studioImg]) {
  if (seen.has(one.img)) throw new Error('повтор картинки в первом экране или полосе студии');
  seen.add(one.img);
}

// ── Разметка мозаики ─────────────────────────────────────────────────────────
const mosaic = TILES.map(t => `<a href="${t.href}" class="tile tile--${t.cols}x${t.rows}">
<img src="${t.img}" alt="${esc(t.cat)} 3D models - ${esc(t.name)}" loading="lazy" decoding="async" width="800" height="450" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">
<span class="tile-cap"><span class="tile-name">${esc(t.cat)}</span><span class="tile-n">${n(t.count)}</span></span>
</a>`).join('\n');

const SECTION_MOSAIC = `<!-- ═══════════════════════════════════════ EXPLORE ══════════════════════════ -->
<section class="page-section" id="explore">
<div class="max-w-7xl mx-auto">
<div class="sec-head">
<h2 class="section-h2">Explore the catalogue</h2>
<a href="/catalog/" class="sec-more">All categories &rarr;</a>
</div>
<div class="mosaic">
${mosaic}
</div>
</div>
</section>
`;

// ── Топ-продажи ──────────────────────────────────────────────────────────────
const TS = 'https://www.turbosquid.com/3d-models/';
const REF = '?referral=3d_molier-international';
const topTiles = TOP.map(t => `<a href="${TS}${t.slug}${REF}" target="_blank" rel="noopener" class="tile tile--${t.cols}x${t.rows} tile--buy">
<img src="${t.img}" alt="${esc(t.modelName)}" loading="lazy" decoding="async" width="800" height="450" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">
<span class="tile-tag">${esc(t.cat)}</span>
<span class="tile-cap"><span class="tile-name">${esc(t.name)}</span><span class="tile-price">${t.price}</span></span>
</a>`).join('\n');

const SECTION_TOP = `<!-- ═══════════════════════════════════════ TOP MODELS ═══════════════════════ -->
<section class="page-section page-section--gray" id="best-sellers">
<div class="max-w-7xl mx-auto">
<div class="sec-head">
<h2 class="section-h2">Best sellers on TurboSquid</h2>
<a href="/catalog/" class="sec-more">Top 1000 &rarr;</a>
</div>
<div class="mosaic">
${topTiles}
</div>
</div>
</section>
`;

// ── Отрасли: полоса низких плиток ────────────────────────────────────────────
const indTiles = INDUSTRIES.map(i => `<a href="/industries/${i.key}/" class="tile tile--3x1 tile--flat">
<img src="${i.img}" alt="3D models for ${esc(i.name)} - ${esc(i.modelName)}" loading="lazy" decoding="async" width="600" height="340" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">
<span class="tile-cap"><span class="tile-name">${esc(i.name)}</span></span>
</a>`).join('\n');

const SECTION_INDUSTRIES = `<!-- ═══════════════════════════════════════ INDUSTRIES ═══════════════════════ -->
<section class="page-section" id="industries">
<div class="max-w-7xl mx-auto">
<div class="sec-head">
<h2 class="section-h2">Where these models get used</h2>
<a href="/industries/" class="sec-more">All industries &rarr;</a>
</div>
<div class="mosaic mosaic--flat">
${indTiles}
</div>
</div>
</section>
`;

// ── Подборки: карточка с подписью под картинкой ──────────────────────────────
const colCards = COLLECTIONS.map(c => `<a href="/collections/${c.key}/" class="col-tile">
<span class="col-shot"><img src="${c.img}" alt="${esc(c.name)} 3D models - ${esc(c.modelName)}" loading="lazy" decoding="async" width="600" height="400" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)"></span>
<span class="col-name">${esc(c.name)}</span>
<span class="col-line">${esc(c.desc)}</span>
</a>`).join('\n');

const SECTION_COLLECTIONS = `<!-- ═══════════════════════════════════════ COLLECTIONS ══════════════════════ -->
<section class="page-section page-section--gray" id="collections">
<div class="max-w-7xl mx-auto">
<div class="sec-head">
<h2 class="section-h2">Curated collections</h2>
<a href="/collections/" class="sec-more">All collections &rarr;</a>
</div>
<div class="col-grid">
${colCards}
</div>
</div>
</section>
`;

// ── Полоса студии: тёмная, во всю ширину, с картинкой ────────────────────────
const SECTION_STUDIO = `<!-- ═══════════════════════════════════════ STUDIO ═══════════════════════════ -->
<section class="studio-band" id="studio">
<div class="studio-media"><img src="${studioImg.img}" alt="${esc(studioImg.name)}" loading="lazy" decoding="async" width="1200" height="675" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)"></div>
<div class="studio-copy">
<div class="studio-eyebrow">The studio</div>
<h2 class="studio-h2">Every model here came off one desk</h2>
<p class="studio-text">3D Molier is Andrey Simonenko. Since 2003 more than 100,000 models have left this studio, built to one standard rather than assembled from many hands - real-world scale, clean topology, materials attached, objects named.</p>
<p class="studio-rating"><span class="studio-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 4.8 out of 5 from 126 buyers on CGTrader</p>
<a href="/about/" class="studio-link">About the studio &rarr;</a>
</div>
</section>
`;

// ── Стили ────────────────────────────────────────────────────────────────────
const CSS = `
/* ── Homepage: hero image, mosaic, studio band ───────────────────────── */
.hero-shot { position: absolute; inset: 0; overflow: hidden; z-index: 0; }
.hero-shot img { width: 100%; height: 100%; object-fit: cover; object-position: center 42%; }
/* Затемнение снизу вверх: подпись читается, а верх кадра остаётся видно. */
.hero-shot::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(9,11,14,.34) 0%, rgba(9,11,14,.62) 55%, rgba(9,11,14,.86) 100%); }
.hero-section { position: relative; }
.hero-section > *:not(.hero-shot) { position: relative; z-index: 1; }
.hero-section .hero-h1,
.hero-section .hero-sub { color: #ffffff; }
.hero-section .hero-sub { opacity: .9; }
.hero-section .stats-num { color: #ffffff; }
.hero-section .stats-label { color: rgba(255,255,255,.72); }

.sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.sec-more { font-size: 14px; font-weight: 600; color: var(--accent, #1659c9); text-decoration: none; white-space: nowrap; }
.sec-more:hover { text-decoration: underline; }

.mosaic { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 215px; gap: 10px; }
.tile { position: relative; display: block; overflow: hidden; border-radius: 6px; background: #e9e9e9; text-decoration: none; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .45s cubic-bezier(.2,.7,.3,1); }
.tile:hover img { transform: scale(1.045); }
.tile::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(9,11,14,0) 45%, rgba(9,11,14,.68) 100%); }
.tile-cap { position: absolute; left: 14px; right: 14px; bottom: 12px; z-index: 1;
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.tile-name { color: #fff; font-size: 15px; font-weight: 600; letter-spacing: -.01em;
  text-shadow: 0 1px 3px rgba(0,0,0,.4); }
.tile-n { color: rgba(255,255,255,.78); font-size: 12px; font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0,0,0,.4); }
.tile--6x1 { grid-column: span 6; grid-row: span 1; }
.tile--6x2 { grid-column: span 6; grid-row: span 2; }
.tile--3x1 { grid-column: span 3; grid-row: span 1; }
.tile--3x2 { grid-column: span 3; grid-row: span 2; }

/* Товарная плитка: категория сверху, имя и цена внизу. Затемнение с двух
   сторон - иначе подпись тонет в светлом рендере. */
.tile--buy::after { background:
  linear-gradient(180deg, rgba(9,11,14,.42) 0%, rgba(9,11,14,0) 26%, rgba(9,11,14,0) 48%, rgba(9,11,14,.76) 100%); }
.tile-tag { position: absolute; top: 11px; left: 13px; z-index: 1; font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.86);
  text-shadow: 0 1px 3px rgba(0,0,0,.5); }
.tile-price { color: #fff; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0,0,0,.45); }
.tile--buy .tile-name { font-size: 14px; font-weight: 600; }

/* Отрасли - низкая полоса: другой вопрос, другой ритм. */
.mosaic--flat { grid-auto-rows: 132px; }
.tile--flat .tile-cap { justify-content: flex-start; }
.tile--flat .tile-name { font-size: 14px; }
.tile--flat::after { background: linear-gradient(180deg, rgba(9,11,14,.12) 0%, rgba(9,11,14,.74) 100%); }

/* Подборки - подпись под картинкой, а не поверх: третья фактура на странице. */
/* Ровно три колонки, а не auto-fit: шесть карточек должны лечь 3+3. При
   автоподборе на широком экране выходит 4+2, и во втором ряду зияет дыра. */
.col-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px 20px; }
.col-tile { display: block; text-decoration: none; color: inherit; }
.col-shot { display: block; overflow: hidden; border-radius: 6px; background: #e9e9e9; aspect-ratio: 3 / 2; }
.col-shot img { width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .45s cubic-bezier(.2,.7,.3,1); }
.col-tile:hover .col-shot img { transform: scale(1.045); }
.col-name { display: block; margin-top: 11px; font-size: 15.5px; font-weight: 600; color: #111111; }
.col-tile:hover .col-name { color: var(--accent, #1659c9); }
.col-line { display: block; margin-top: 3px; font-size: 13.5px; color: #6b7280; line-height: 1.5; }

.studio-band { display: grid; grid-template-columns: 1fr 1fr; background: #0e1116; color: #f2efe9; }
.studio-media { min-height: 380px; }
.studio-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.studio-copy { display: flex; flex-direction: column; justify-content: center;
  padding: 56px clamp(24px, 5vw, 72px); max-width: 640px; }
.studio-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(242,239,233,.55); margin-bottom: 10px; }
.studio-h2 { font-family: 'Playfair Display', serif; font-size: clamp(24px, 3vw, 34px);
  font-weight: 700; letter-spacing: -.03em; line-height: 1.15; margin: 0 0 16px; color: #fff; }
.studio-text { font-size: 15.5px; line-height: 1.75; color: rgba(242,239,233,.78); margin: 0; }
.studio-rating { display: flex; align-items: center; gap: 9px; font-size: 13.5px;
  color: rgba(242,239,233,.6); margin: 20px 0 0; }
.studio-stars { color: #e0a92b; font-size: 12px; letter-spacing: 1px; }
.studio-link { margin-top: 22px; font-size: 14px; font-weight: 600; color: #8fb4ff; text-decoration: none; }
.studio-link:hover { text-decoration: underline; }

@media (max-width: 900px) {
  /* Ряды ниже, но высокая плитка остаётся высокой - на ней держится ритм. */
  .mosaic { grid-auto-rows: 158px; }
  .mosaic--flat { grid-auto-rows: 110px; }
  .col-grid { grid-template-columns: repeat(2, 1fr); }
  .studio-band { grid-template-columns: 1fr; }
  .studio-media { min-height: 220px; }
  .studio-copy { padding: 36px 24px 44px; }
}
/* На телефоне сетка вдвое уже, но ритм сохраняем: обычная плитка - половина
   ширины, широкая - во всю, высокая остаётся высокой. Тринадцать одинаковых
   полос подряд читались бы как список, а не как витрина. */
@media (max-width: 560px) {
  .mosaic { grid-template-columns: repeat(6, 1fr); grid-auto-rows: 116px; gap: 8px; }
  .mosaic--flat { grid-auto-rows: 96px; }
  .tile--3x1 { grid-column: span 3; grid-row: span 1; }
  .tile--3x2 { grid-column: span 3; grid-row: span 2; }
  .tile--6x1 { grid-column: span 6; grid-row: span 1; }
  .tile--6x2 { grid-column: span 6; grid-row: span 2; }
  .col-grid { grid-template-columns: 1fr 1fr; gap: 18px 14px; }
  .col-name { font-size: 14px; }
  .col-line { font-size: 12.5px; }
  .tile-name { font-size: 13px; }
  .tile-n { font-size: 11px; }
  .tile-cap { left: 10px; right: 10px; bottom: 9px; }
}
`;

// ── Сборка ───────────────────────────────────────────────────────────────────
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const step = [];
const cut = (re, what) => {
  if (!re.test(html)) { step.push('  не найдено: ' + what); return false; }
  html = html.replace(re, '');
  step.push('  убрано: ' + what);
  return true;
};

// 1. Приглашение роботам обойти полный индекс - это не текст для человека.
cut(/<section[^>]*>\s*<div class="max-w-7xl mx-auto" style="text-align:center[^"]*">\s*<p[^>]*>Browsing the whole library\?[\s\S]*?<\/section>/,
  'баннер «complete index of all 86,869 models»');

// 2. Прежние опыты, если остались.
for (const id of ['catalogue-facts', 'questions', 'studio', 'explore']) {
  cut(new RegExp('<!--[^>]*-->\\s*<section[^>]*id="' + id + '"[\\s\\S]*?</section>\\s*'), 'секция #' + id);
  cut(new RegExp('<!--[^>]*-->\\s*<section class="studio-band"[\\s\\S]*?</section>\\s*'), 'полоса студии');
}

// 3. Фотография в первый экран.
if (!html.includes('hero-shot')) {
  const m = html.match(/<section class="([^"]*hero[^"]*)"[^>]*>/);
  if (!m) { console.error('не нашёл первый экран'); process.exit(1); }
  const shot = `<div class="hero-shot" aria-hidden="true"><img src="${hero.img}" alt="" fetchpriority="high" decoding="async" width="1920" height="1080"></div>`;
  html = html.replace(m[0], m[0].replace(m[1], m[1] + ' hero-section') + shot);
  step.push('  добавлено: фотография в первый экран (' + hero.name + ')');
}

// 4. Плитки категорий заменяем мозаикой.
const catSec = /<!--[^>]*CATEGORIES[^>]*-->\s*<section[\s\S]*?<\/section>\s*/;
if (catSec.test(html)) { html = html.replace(catSec, SECTION_MOSAIC); step.push('  заменено: 8 карточек категорий -> мозаика из ' + TILES.length + ' плиток'); }
else step.push('  не найдена секция категорий');

// 5. Топ-продажи, отрасли и подборки - в том же языке плиток, но с разным
//    ритмом, чтобы страница не превратилась в три одинаковые мозаики.
const swap = [
  [/<!--[^>]*TOP MODELS[^>]*-->\s*<section[\s\S]*?<\/section>\s*/, SECTION_TOP, 'топ-продажи'],
  [/<!--[^>]*INDUSTRIES[^>]*-->\s*<section[\s\S]*?<\/section>\s*/, SECTION_INDUSTRIES, 'отрасли'],
  [/<!--[^>]*COLLECTIONS[^>]*-->\s*<section[\s\S]*?<\/section>\s*/, SECTION_COLLECTIONS, 'подборки'],
];
for (const [re, block, what] of swap) {
  if (!re.test(html)) { step.push('  не найдена секция: ' + what); continue; }
  html = html.replace(re, block);
  step.push('  переделано: ' + what);
}

// 6. Полоса студии перед лицензированием данных.
const dl = html.match(/<!--[═\s]*DATA LICENSING[═\s]*-->/);
if (!dl) { console.error('не нашёл раздел лицензирования'); process.exit(1); }
html = html.replace(dl[0], SECTION_STUDIO + dl[0]);
step.push('  добавлено: полоса студии во всю ширину');

console.log(step.join('\n'));

// ── Запись ───────────────────────────────────────────────────────────────────
if (PREVIEW) {
  const out = path.join(ROOT, 'preview', 'home');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'),
    html.replace('</head>', '<style>' + CSS + '</style>\n<meta name="robots" content="noindex, nofollow">\n</head>'));
  console.log('\nпредпросмотр: https://3dmolierstudio.com/preview/home/');
} else {
  const cssFile = path.join(ROOT, 'assets', 'css', 'styles.css');
  const css = fs.readFileSync(cssFile, 'utf8');
  if (!css.includes('.mosaic')) fs.writeFileSync(cssFile, css.replace(/\s*$/, '\n') + CSS);
  html = html.replace(/(assets\/css\/[a-z-]+\.(?:min\.)?css\?v=)(\d+)/g, (m, a, v) => a + (+v + 1));
  fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  console.log('\nзаписано: index.html + assets/css/styles.css');
}

const body = html.slice(html.indexOf('<body'));
console.log('слов: ' + body.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ').trim().split(' ').length + '   таблиц: ' + (html.match(/<table/g) || []).length
  + '   плиток: ' + TILES.length + '   картинок: ' + (body.match(/<img/g) || []).length);
