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
// Поле img - картинка, выбранная основателем вручную; там, где его нет,
// картинка берётся из карточки указанной модели.
const P = 'https://p.turbosquid.com/ts-thumb/';
const TILES = [
  { slug: 'boeing-737-900-aircraft-with-luxury-interior-and-cockpit-2367696', cat: 'Aircraft', href: '/categories/aircraft/', count: 1514, cols: 6, rows: 1,
    img: P + 'Bt/vhMXo7/p8/long_range_wide_body_passenger_aircraft_003/jpg/1782980072/1920x1080/fit_q87/f1477a95a095f8bb5cf8024e399df51faa9ba1c4/long_range_wide_body_passenger_aircraft_003.jpg' },
  { slug: 'sport-lisboa-e-benfica-stadium-2208619', cat: 'Architecture', href: '/categories/architecture-landmarks/', count: 4574, cols: 3, rows: 1 },
  { slug: 'locomotive-with-car-transporter-loaded-2384760', cat: 'Vehicles', href: '/categories/vehicles/', count: 4123, cols: 3, rows: 1 },

  { slug: 'medieval-merchant-with-market-stall-2282241', cat: 'Characters & People', href: '/categories/characters-people/', count: 2888, cols: 3, rows: 2 },
  { slug: 'black-marlin-heavy-load-carrier-with-drilling-rig-1878441', cat: 'Ships', href: '/categories/ships/', count: 701, cols: 3, rows: 1,
    img: P + 'xO/QSifMr/65N6uDfv/oasisclasscruiseshipoasisoftheseas3dmodel003/jpg/1538744061/1920x1080/fit_q87/f03cae4a25a0e633acd59be73de39435fea8be3d/oasisclasscruiseshipoasisoftheseas3dmodel003.jpg' },
  { slug: 'mining-multi-bucket-wheel-excavator-with-mining-truck-1896313', cat: 'Industrial', href: '/categories/industrial-equipment/', count: 2488, cols: 3, rows: 1 },
  { slug: 'international-space-station-habitable-artificial-satellite-1852990', cat: 'Space & Sci-Fi', href: '/categories/space-scifi/', count: 482, cols: 3, rows: 1 },

  { slug: 'aircraft-carrier-with-airplanes-1863177', cat: 'Military', href: '/categories/military-vehicles/', count: 224, cols: 3, rows: 1 },
  { slug: 'people-near-counter-with-fresh-fruits-2384571', cat: 'Furniture & Interior', href: '/categories/furniture-interior/', count: 3702, cols: 3, rows: 1,
    img: P + 'IJ/SoAENs/NM/coffeeshopinterior3dmodel001/jpg/1709351673/1920x1080/fit_q87/8310eaf481ad21b29a44bb4643b708f1481b841f/coffeeshopinterior3dmodel001.jpg' },
  { slug: 'young-man-full-body-anatomy-set-1841426', cat: 'Medical', href: '/categories/medical-3d-models/', count: 2796, cols: 3, rows: 1,
    img: P + 'hf/53Acbo/nS/secamvsa535medicalvitalsignsanalyzervray3dmodel002/jpg/1612426244/1920x1080/fit_q87/dc2b34cf599fc8f0da2cc372265e55c0f09acbb8/secamvsa535medicalvitalsignsanalyzervray3dmodel002.jpg' },

  { slug: 'four-horses-with-stagecoach-2382383', cat: 'Animals & Creatures', href: '/categories/animals-creatures/', count: 3514, cols: 3, rows: 1,
    img: P + 'dr/5VWgh8/fu/marine_hermit_crab_fur_rigged_for_blender_002/jpg/1786108166/1920x1080/fit_q87/720e78b229b361515230495648eb54cd72f434cb/marine_hermit_crab_fur_rigged_for_blender_002.jpg' },
  { slug: 'transporter-erector-loader-with-raised-elevated-trailer-2184605', cat: 'Weapons', href: '/categories/weapons/', count: 1982, cols: 3, rows: 1,
    img: P + 'OV/98LtXh/Qy/browning_m2_heavy_machine_gun_with_ammo_belt_002/jpg/1782714788/1920x1080/fit_q87/96c45ccb5685f9337fd5afbd254b9edfcb7989ef/browning_m2_heavy_machine_gun_with_ammo_belt_002.jpg' },
  { slug: 'nasa-mission-control-room-space-center-1503696', cat: 'Electronics', href: '/categories/electronics-gadgets/', count: 3706, cols: 6, rows: 1 },
];

const HERO_SLUG = 'international-airport-1475439';
const HERO_IMG = P + 'Lz/sgfcI2/KX/mh6m_little_bird_troop_carrier_helicopter_rigged_004/jpg/1780368430/1920x1080/fit_q87/89557b427e9d9d3718f0a7cee9c2a29073bf6fdc/mh6m_little_bird_troop_carrier_helicopter_rigged_004.jpg';
const STUDIO_SLUG = 'equipped-military-drone-airbase-with-uav-desert-2530374';

// ── Топ-продажи ──────────────────────────────────────────────────────────────
// Те же восемь моделей, что и были, но карточка теперь - сама картинка, а имя
// и цена лежат поверх неё. Первая идёт крупной плиткой 6x2: у витрины должна
// быть одна вещь, на которую смотришь первой.
// Четыре модели заменены основателем. Цены и категории взяты из их карточек,
// а не с его слов: $599 он назвал верно, остальные три пришлось смотреть.
const TOP = [
  { slug: 'railroad-amtrak-passenger-car-2-930528', name: 'Railroad Amtrak Passenger Car 2', price: '$79', cat: 'Vehicles', cols: 6, rows: 2 },
  { slug: 'airbus-a400m-atlas-military-transport-aircraft-rigged-1550640', name: 'Airbus A400M Atlas Rigged', price: '$219', cat: 'Aircraft', cols: 3, rows: 1 },
  { slug: 'sigma-class-indonesian-frigate-1394359', name: 'Sigma Class Indonesian Frigate', price: '$199', cat: 'Military Vehicles', cols: 3, rows: 1 },
  { slug: 'flying-monarch-butterfly-rigged-3d-model-1566626', name: 'Flying Monarch Butterfly Rigged', price: '$149', cat: 'Animals & Creatures', cols: 3, rows: 1,
    img: P + 'me/0uwGK2/Jm2BO2Mu/animatedflyingmonarchbutterflyrigged3dsmodel005/jpg/1573183712/1920x1080/fit_q87/235977d394dffe2fd3ffcd620f0d9a060d2718be/animatedflyingmonarchbutterflyrigged3dsmodel005.jpg' },
  { slug: 'baseball-hat-3-968930', name: 'Baseball Hat 3', price: '$49', cat: 'Clothing & Accessories', cols: 3, rows: 1,
    img: P + '4q/1vAjNW/J9/baseball_hat_3_001/jpg/1626786034/1920x1080/fit_q87/47e19e3348fa441aadd838d6f77ff0eb5c74d2b6/baseball_hat_3_001.jpg' },
  { slug: 'atlantic-salmon-fish-1118994', name: 'Atlantic Salmon Fish', price: '$59', cat: 'Animals & Creatures', cols: 6, rows: 1,
    img: P + 'Pd/ZWp3WM/mK4KbMfT/atlanticsalmonfish3dsmodel001/jpg/1485931439/1920x1080/fit_q87/a7fc5e64d855873b0f5de9bc5f0e019014c955a6/atlanticsalmonfish3dsmodel001.jpg' },
  { slug: 'golden-chinese-dragon-3d-model-1379923', name: 'Golden Chinese Dragon', price: '$99', cat: 'Animals', cols: 3, rows: 1 },
  { slug: 'realistic-skin-young-man-with-full-body-anatomy-2287274', name: 'Realistic Skin Young Man with Full Body Anatomy', price: '$599', cat: 'Characters & People', cols: 3, rows: 1,
    img: P + '7s/5UwLvM/rc/realisticskinyoungmanwithfullbodyanatomymb3dmodel000/jpg/1727755011/1920x1080/fit_q87/62255c3ddb008cb6f48f6e85d2917d93b637d9c0/realisticskinyoungmanwithfullbodyanatomymb3dmodel000.jpg' },
];

// ── Отрасли ──────────────────────────────────────────────────────────────────
// Ритм нарочно другой: полоса низких плиток по четыре в ряд. Три одинаковые
// мозаики подряд читались бы как одна длинная, а это разные вопросы -
// «что искать» и «для чего это берут».
// Счётчики убраны: они считали весь магазин TurboSquid (Film & Video - 83 145),
// а числа на плитках категорий считают страницы этого сайта. Рядом две системы
// счёта на одной странице сбивают с толку.
const INDUSTRIES = [
  { key: 'aerospace', name: 'Aerospace', slug: 'x-madis-anti-drone-system-1896205',
    img: P + '4K/5fDRTe/QP/modular_iss_cargo_system_with_solar_panels_006/jpg/1761144505/1920x1080/fit_q87/8f29f4e9514a492ccf975a0a1ccf8775393d0215/modular_iss_cargo_system_with_solar_panels_006.jpg' },
  { key: 'military-defense', name: 'Military & Defense', slug: 'stealth-bomber-b-2-spirit-1127231',
    img: P + 'Ld/iK0tCo/5c/boeing_mq25_stingray_drone_003/jpg/1785137478/1920x1080/fit_q87/56a4f8b72b541f2bb9872294da2c0aa54ab9dc4d/boeing_mq25_stingray_drone_003.jpg' },
  { key: 'medical', name: 'Medical', slug: 'complete-female-body-anatomy-1611038' },
  { key: 'game-development', name: 'Game Development', slug: 'boeing-737-interior-1191819' },
  { key: 'film-video-production', name: 'Film & Video', slug: 'train-es40dc-csx-blue-and-covered-hopper-car-949756' },
  { key: 'architecture', name: 'Architecture', slug: 'cape-town-stadium-green-point-3d-model-1031144' },
  { key: 'virtual-reality', name: 'Virtual Reality', slug: 'boeing-c17-globemaster-iii-cargo-door-open-1892082',
    img: P + 'NP/XxwEyV/CI/controlroom3dsmodel002/jpg/1710241649/1920x1080/fit_q87/02050978750f1bfc96c71e54bc3bdb21b6db13b1/controlroom3dsmodel002.jpg' },
  { key: 'advertising', name: 'Advertising', slug: 'airbus-a220-300-detailed-interior-1608806',
    img: P + 'Dd/iu4yW6/Je/tostitos_tortilla_chips_bag_set_003/jpg/1787169829/1920x1080/fit_q87/d9f113962c1ce152b827a0aa74609aaba5457739/tostitos_tortilla_chips_bag_set_003.jpg' },
];

// ── Подборки ─────────────────────────────────────────────────────────────────
// Прежние пять «Curated Collections» вели на /categories/vehicles/,
// /categories/aircraft/ и так далее - то есть ровно туда же, куда плитки
// категорий выше. Секция дублировала предыдущую. Здесь настоящие страницы
// подборок из /collections/, и темы взяты те, которых нет среди плиток.
// Подпись art-media была «Art & Media», а страница называется «Art, Office &
// Music Collections» - плитка вела не туда, куда обещала. Совпадает теперь.
const COLLECTIONS = [
  { key: 'holidays', name: 'Holidays', desc: 'Gifts, decorations and seasonal props', slug: 'wedding-presents-3d-models-set-2-997567',
    img: P + 'fq/LBdHNm/qJ/gift_boxes_collection_001/jpg/1781092425/1920x1080/fit_q87/042610b2f12ba3a10fcaa84100684c93b113de90/gift_boxes_collection_001.jpg' },
  { key: 'food-drink', name: 'Food & Drink', desc: 'Packaging, produce and tableware', slug: 'beer-kegs-set-1622300',
    img: P + 'ea/SVpTQs/mz/efctwbxwnyudxqy7_harvest_in_storage_boxes_collection_3_001/jpg/1786001018/1920x1080/fit_q87/6aa66028255a1dd67f601c27b47a2f8fe63facab/efctwbxwnyudxqy7_harvest_in_storage_boxes_collection_3_001.jpg' },
  { key: 'fashion', name: 'Fashion', desc: 'Garments, footwear and accessories', slug: 'ballet-shoes-set-1066973',
    img: P + 'J2/M8wLXI/P4/matching_family_pajama_set_with_dog_clothing_white_red_002/jpg/1776825008/1920x1080/fit_q87/b30aa70d545ec765bedf85b9641d1fa0992d0d12/matching_family_pajama_set_with_dog_clothing_white_red_002.jpg' },
  { key: 'sports', name: 'Sports', desc: 'Kit, equipment and arenas', slug: 'hockey-goalie-protection-kit-red-2-1046985',
    img: P + 'qS/3B4AEG/ZT/sfmgbbgnvarjxtjy_skateboarding_equipment_collection_2_001/jpg/1783948336/1920x1080/fit_q87/e9b237e471d68c8fdb810c29345da839d92d4efb/sfmgbbgnvarjxtjy_skateboarding_equipment_collection_2_001.jpg' },
  { key: 'art-media', name: 'Art, Office & Music', desc: 'Instruments, studio and stage gear', slug: 'yamaha-concert-timpani-set-1362555',
    img: P + 'KN/lvoem5/x2/symphony_orchestra_collection_001/jpg/1775717274/1920x1080/fit_q87/a48a7ddb9f96076a297cc937264f9b6b474476f3/symphony_orchestra_collection_001.jpg' },
  { key: 'toys-games', name: 'Toys & Games', desc: 'Playsets, models and board pieces', slug: 'classical-train-toy-set-locomotive-with-wagons-1342305',
    img: P + 'AN/1DXOJS/yK/monopoly_giant_edition_board_004/jpg/1780262914/1920x1080/fit_q87/c07375e6011b04a1c162327b066058e0a06c2ecb/monopoly_giant_edition_board_004.jpg' },
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

// Картинка, выбранная основателем (поле img), важнее выведенной из карточки.
// Имя модели для alt всё равно берём из карточки, если она есть.
const seen = new Set();
function resolve(x) {
  let name = x.name || x.slug;
  try { const r = heroImage(x.slug); name = r.name; if (!x.img) x.img = r.img; }
  catch (e) { if (!x.img) throw e; }
  x.modelName = name;
  if (seen.has(x.img)) throw new Error('повтор картинки: ' + x.slug);
  seen.add(x.img);
}
for (const list of [TILES, TOP, INDUSTRIES, COLLECTIONS]) for (const x of list) resolve(x);

const hero = { img: HERO_IMG, name: 'MH-6M Little Bird Troop Carrier Helicopter Rigged' };
const studioImg = heroImage(STUDIO_SLUG);
for (const one of [hero, studioImg]) {
  if (seen.has(one.img)) throw new Error('повтор картинки в первом экране или полосе студии');
  seen.add(one.img);
}

// ── Разметка мозаики ─────────────────────────────────────────────────────────
const mosaic = TILES.map(t => `<a href="${t.href}" class="tile tile--${t.cols}x${t.rows}">
<img src="${t.img}" alt="${esc(t.cat)} 3D models - ${esc(t.modelName)}" loading="lazy" decoding="async" width="800" height="450" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">
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
/* Кнопка «View TurboSquid Store» - .btn-ghost с тёмным текстом #111 и светлой
   серой рамкой: она рассчитана на белый фон. Над фотографией это тёмное по
   тёмному, читать нечем. Здесь ей нужен белый текст и своя рамка. */
.hero-section .btn-ghost { color: #ffffff; border-color: rgba(255,255,255,.55);
  background: rgba(255,255,255,.10); backdrop-filter: blur(2px); }
.hero-section .btn-ghost:hover { color: #ffffff; border-color: #ffffff; background: rgba(255,255,255,.20); }
.hero-section .btn-ghost:focus-visible { box-shadow: 0 0 0 3px rgba(255,255,255,.45); }
/* Чёрная кнопка на затемнённом кадре теряет края - обводим тонкой светлой линией. */
.hero-section .btn-primary { box-shadow: 0 0 0 1px rgba(255,255,255,.22); }
/* Плашка с цифрами поднята на -20px: её задумывали «наезжающей» на светлый
   градиент старого первого экрана, где стык был незаметен. Под фотографией
   этот наезд выглядит браком - белый прямоугольник срезает низ кадра.
   Ставим её вплотную под фото. */
.hero-section + .stats-section { margin-top: 0; padding-top: 28px; }

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
for (const id of ['catalogue-facts', 'questions', 'studio']) {
  cut(new RegExp('<!--[^>]*-->\\s*<section[^>]*id="' + id + '"[\\s\\S]*?</section>\\s*'), 'секция #' + id);
  cut(new RegExp('<!--[^>]*-->\\s*<section class="studio-band"[\\s\\S]*?</section>\\s*'), 'полоса студии');
}

// 3. Фотография в первый экран.
if (!html.includes('hero-shot')) {
  const m = html.match(/<section class="([^"]*hero[^"]*)"[^>]*>/);
  if (!m) { console.error('не нашёл первый экран'); process.exit(1); }
  // Картинка первого экрана - самая крупная на сайте и первое, что встречает
  // краулер. Пустой alt при aria-hidden делал её невидимой и для робота, и для
  // читающей программы. Даём осмысленный alt и снимаем aria-hidden: иначе alt
  // бессмыслен, скрытый элемент не читается.
  const shot = `<div class="hero-shot"><img src="${hero.img}" alt="Professional 3D model catalog by 3D Molier" fetchpriority="high" decoding="async" width="1920" height="1080"></div>`;
  html = html.replace(m[0], m[0].replace(m[1], m[1] + ' hero-section') + shot);
  step.push('  добавлено: фотография в первый экран (' + hero.name + ')');
}

// 4. Плитки категорий заменяем мозаикой.
const catSec = /<!--[^>]*CATEGORIES[^>]*-->\s*<section[\s\S]*?<\/section>\s*/;
const mosaicSec = /<!--[^>]*EXPLORE[^>]*-->\s*<section[^>]*id="explore"[\s\S]*?<\/section>\s*/;
if (catSec.test(html)) { html = html.replace(catSec, SECTION_MOSAIC); step.push('  заменено: 8 карточек категорий -> мозаика из ' + TILES.length + ' плиток'); }
else if (mosaicSec.test(html)) { html = html.replace(mosaicSec, SECTION_MOSAIC); step.push('  мозаика пересобрана: ' + TILES.length + ' плиток'); }
else { console.error('ОСТАНОВКА: не нашёл ни секцию категорий, ни мозаику - вставить её некуда.'); process.exit(1); }

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

// 6. Разметка ItemList описывает список лучших продаж. Модели в нём заменили,
//    а разметка осталась со старыми - она обещала поисковику Viking Ship,
//    Boiler Suit, Male Pelvis Skeleton и Shanghai Tower, которых на странице
//    уже нет. Пересобираем из того же списка, что рисует плитки.
{
  const items = TOP.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: t.name,
      image: t.img,
      url: TS + t.slug + REF,
      category: t.cat,
      offers: { '@type': 'Offer', price: t.price.replace('$', ''), priceCurrency: 'USD',
        availability: 'https://schema.org/InStock', url: TS + t.slug + REF },
    },
  }));
  // Разметку правим разбором, а не регулярным выражением: внутри ItemList
  // вложены объекты ListItem, и нежадный шаблон обрывался на первом из них -
  // получался обрезанный список и битый JSON.
  const tag = html.match(/(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/);
  if (!tag) step.push('  ВНИМАНИЕ: не нашёл блок разметки');
  else {
    const doc = JSON.parse(tag[2]);
    const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : [doc];
    const k = graph.findIndex(n => n['@type'] === 'ItemList');
    const node = {
      '@type': 'ItemList',
      name: 'Best Selling 3D Models by 3D Molier',
      url: 'https://3dmolierstudio.com/',
      numberOfItems: items.length,
      itemListElement: items,
    };
    if (k < 0) graph.push(node); else graph[k] = node;
    const next = JSON.stringify(Array.isArray(doc['@graph']) ? { ...doc, '@graph': graph } : graph[0])
      .replace(/</g, '\u003c');
    html = html.replace(tag[0], () => tag[1] + next + tag[3]);
    step.push('  пересобрана разметка ItemList: ' + items.length + ' моделей');
  }
}

// 7. Заголовок страницы был 65 символов - Google обрезает примерно на 60, и
//    хвост «Medical & More» до человека не доходил. Заодно длинное тире меняем
//    на обычное: по всему сайту принято обычное.
{
  const TITLE = '3D Model Catalog by 3D Molier - Vehicles, Aircraft, Medical';
  const before = html;
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + TITLE + '</title>');
  for (const attr of ['property="og:title"', 'name="twitter:title"']) {
    html = html.replace(new RegExp('(<meta ' + attr + ' content=")[^"]*(")'), (m, a, b) => a + TITLE + b);
  }
  if (html !== before) step.push('  заголовок укорочен до ' + TITLE.length + ' символов');
  // Длинное тире в подписи поиска - последнее на странице. По всему сайту
  // принято обычное.
  const em = html.split('—').length - 1;
  if (em) { html = html.split('—').join('-'); step.push('  длинных тире заменено: ' + em); }
}

// 8. Разметка списка категорий. Тринадцать плиток - это перечень разделов
//    каталога, и поисковику полезно видеть его списком, а не набором ссылок.
//    Расширенного вида в выдаче это само по себе не даёт: карусели Google
//    строит по товарам и статьям, а не по разделам. Польза здесь в понимании
//    устройства сайта, и на этом честно останавливаемся.
{
  const tag = html.match(/(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/);
  if (tag) {
    const doc = JSON.parse(tag[2]);
    const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : [doc];
    const node = {
      '@type': 'ItemList',
      '@id': 'https://3dmolierstudio.com/#categories',
      name: '3D Model Categories',
      numberOfItems: TILES.length,
      itemListElement: TILES.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.cat,
        url: 'https://3dmolierstudio.com' + t.href,
      })),
    };
    const k = graph.findIndex(n => n['@type'] === 'ItemList' && n['@id'] === node['@id']);
    if (k < 0) graph.push(node); else graph[k] = node;
    const next = JSON.stringify(Array.isArray(doc['@graph']) ? { ...doc, '@graph': graph } : graph[0])
      .replace(/</g, '\u003c');
    html = html.replace(tag[0], () => tag[1] + next + tag[3]);
    step.push('  добавлена разметка списка категорий: ' + TILES.length);
  }
}

// 9. Полоса студии перед лицензированием данных.
const dl = html.match(/<!--[═\s]*DATA LICENSING[═\s]*-->/);
if (!dl) { console.error('не нашёл раздел лицензирования'); process.exit(1); }
html = html.replace(dl[0], SECTION_STUDIO + dl[0]);
step.push('  добавлено: полоса студии во всю ширину');

// Подстановка своих картинок идёт ПОСЛЕ вставки всех секций: полоса студии
// добавляется последней, и на прошлом прогоне её картинка осталась чужой.
// 9. Свои картинки вместо чужих. Скачаны и пережаты localize-home-images.mjs:
//    8,85 МБ JPEG с p.turbosquid.com превратились в 1,33 МБ WebP у нас, минус
//    85%. Выигрыш не только от формата: источник всегда 1920x1080, а плитки
//    показываются шириной 295-635 точек. Заодно уходит зависимость от чужого
//    узла в самом заметном месте сайта.
{
  const mapFile = path.join(ROOT, 'assets', 'img', 'home', 'map.json');
  if (!fs.existsSync(mapFile)) step.push('  своих картинок нет - сначала localize-home-images.mjs');
  else {
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    let n = 0;
    for (const [from, to] of Object.entries(map)) {
      if (!html.includes(from)) continue;
      html = html.split(from).join(to);
      n++;
    }
    step.push('  подставлено своих картинок: ' + n + ' из ' + Object.keys(map).length);
    // Ранняя связь с чужим узлом нужна, только пока с него что-то грузится.
    if (!/p\.turbosquid\.com\/ts-thumb/.test(html)) {
      html = html.replace(/<link rel="preconnect" href="https:\/\/p\.turbosquid\.com"[^>]*>/, '')
                 .replace(/<link rel="dns-prefetch" href="https:\/\/p\.turbosquid\.com"[^>]*>/, '');
      step.push('  ранняя связь с p.turbosquid.com убрана - картинок оттуда больше нет');
    }
  }
}

// 10. Браузер узнаёт про p.turbosquid.com только когда дойдёт до первой картинки,
//    а их на странице 37. Ранняя связь с этим узлом ускоряет показ первого
//    экрана - фотография героя тоже оттуда.
// Ранняя связь нужна, только если с этого узла что-то грузится. После
// подстановки своих картинок она стала лишней: браузер открывал бы соединение
// к серверу, к которому не обращается.
if (/p\.turbosquid\.com\/ts-thumb/.test(html)
    && !html.includes('rel="preconnect" href="https://p.turbosquid.com"')) {
  html = html.replace('</title>', () => '</title>'
    + '<link rel="preconnect" href="https://p.turbosquid.com" crossorigin>'
    + '<link rel="dns-prefetch" href="https://p.turbosquid.com">');
  step.push('  добавлена ранняя связь с p.turbosquid.com');
}


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
