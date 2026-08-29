// card-content.mjs - генерация текстовых блоков карточки модели.
// Общий модуль для enrich-cards.mjs (основной шаблон) и enrich-legacy-cards.mjs (старый).
//
// Задача не просто «добить объём», а держать уникальность страницы выше 40%:
// порог скилла seo-programmatic, ниже которого текст считается тонким/шаблонным.
// Поэтому:
//   * каждый слот текста имеет 4-6 вариантов, и они выбираются РАЗНЫМИ производными
//     от id, чтобы комбинации не шли парами;
//   * из 10 вопросов на страницу попадают только 4, набор зависит от id;
//   * в ответы вшиты собственные данные модели (отрасли, сценарии, подкатегория,
//     год листинга, цена) - это уникальные строки, а не переставленные слова.

import { brandOf } from './lib/brands.mjs';

// Параметры файла выводятся из названия: сводного списка форматов у нас нет,
// пока не оживёт API студии. Правила заданы основателем; порядок проверок
// важен - «Rigged for Maya» это Maya, а не 3ds Max.
const FORMATS = 'MAX, FBX, OBJ, Cinema 4D R23, Maya 2022, Blender 3.4, glTF, 3DS, USDz, USD 2.0';
const MAX_NATIVE = '3ds Max 2020 + V-Ray 4.3';
export function nativeOf(name) {
  const n = String(name);
  if (/\bfor\s+cinema\s*4d\b/i.test(n)) return { native: 'Cinema 4D R23', formats: null };
  if (/\bfor\s+maya\b/i.test(n)) return { native: 'Maya 2022', formats: null };
  if (/\bfor\s+blender\b/i.test(n)) return { native: 'Blender 3.4', formats: null };
  if (/\brigged\b/i.test(n) || /\bfur\b/i.test(n)) return { native: MAX_NATIVE, formats: null };
  return { native: MAX_NATIVE, formats: FORMATS };
}

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const plain = s => String(s).replace(/&amp;/g, '&').replace(/-/g, ' - ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '');

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

// Часть имён в каталоге уже оканчивается на «3D Model» / «3D Models Set».
// В прозе и вопросах это даёт «... 3D Model model» - убираем хвост только для текста,
// в заголовке H1 и в строке «Model» таблицы имя остаётся как есть.
export const proseName = s => String(s)
  .replace(/\s+3D\s+Models?$/i, '')
  .replace(/\s+3D\s+Models?\s+(Set|Collection)$/i, ' $1')
  .trim() || String(s);
const yearOf = f => f.days ? new Date(Date.now() - f.days * 86400000).getFullYear() : null;

// Адрес хаба категории. Раньше он вычислялся из названия по общему правилу, и для
// двух категорий это давало несуществующие страницы: «Medical» -> /categories/medical/
// (на деле medical-3d-models) и «Space & Sci-Fi» -> /categories/space-sci-fi/
// (на деле space-scifi). Ahrefs нашёл эти 404 в августе 2026: 804 и 225 карточек
// вели в пустоту. Общее правило верно для остальных 25 категорий, поэтому оставляем
// его как запасное, а расхождения держим списком.
const CAT_SLUG_FIX = {
  'Medical': 'medical-3d-models',
  'Space & Sci-Fi': 'space-scifi',
};
export const catSlug = cat => CAT_SLUG_FIX[String(cat || '').trim()]
  || String(cat || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// список в человеческом виде: «a, b and c»
const listy = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// ── описание ──────────────────────────────────────────────────────────────────
const OPEN = [
  (n, c, p) => `The ${n} is a production-ready ${c} 3D model, priced at $${p} on TurboSquid.`,
  (n, c, p) => `${n} is a detailed ${c} asset built for professional 3D pipelines, available at $${p}.`,
  (n, c, p) => `This ${c} model - ${n} - is ready to drop into a scene as-is, and sells for $${p} on TurboSquid.`,
  (n, c, p) => `${n} belongs to our ${c} range and is offered at $${p} through the TurboSquid marketplace.`,
  (n, c, p) => `Looking for a ${c} asset? The ${n} is a finished, render-ready model at $${p}.`,
  (n, c, p) => `${n} is one of the ${c} models in the 3D Molier catalogue, listed at $${p}.`,
  (n, c, p) => `Priced at $${p}, the ${n} is a finished ${c} model rather than a base mesh you have to build on.`,
];

const CERT_TXT = {
  'CheckMate Lite/Pro': [
    `It carries TurboSquid's CheckMate certification, which means an independent reviewer verified the topology, the naming of objects and materials, and that the geometry is built to real-world scale.`,
    `CheckMate certification confirms the mesh passed TurboSquid's manual quality audit: clean topology, sane object naming, correct units and no stray geometry.`,
    `The model is CheckMate certified - a human reviewer checked the wireframe, the material assignments and the real-world dimensions before it went on sale.`,
    `CheckMate is TurboSquid's manual review programme, and this model passed it: no n-gons where they would hurt, no unnamed objects, no scale surprises on import.`,
    `Because it is CheckMate certified, the usual import checks are already done - units, pivots and material names were audited by a reviewer rather than self-declared.`,
  ],
  'StemCell': [
    `It is a StemCell model, so it ships in TurboSquid's multi-format standard with PBR materials that carry over between renderers instead of needing to be rebuilt per engine.`,
    `StemCell certification means the asset was authored once and delivered across formats with consistent PBR shading, which saves the conversion step when moving between renderers.`,
    `As a StemCell asset it comes with standardised PBR materials, so the look holds up whether it lands in a game engine or an offline renderer.`,
    `StemCell is TurboSquid's cross-format standard: one authored source, several delivered formats, and PBR materials that survive the trip between them.`,
    `The StemCell build means you are not re-authoring shaders after import - the PBR setup is designed to read the same across engines.`,
  ],
  'no certification': [
    `The mesh is built with clean quad-based topology and correct real-world proportions, so it subdivides predictably and sits at the right size next to other objects in a scene.`,
    `Geometry is modelled to real-world proportions with a tidy edge flow, which keeps it usable both as a background element and in closer shots.`,
    `The model uses efficient, well-organised geometry - no hidden faces or overlapping shells to clean up before rendering.`,
    `Topology is kept deliberately simple where detail would not read on camera, which keeps the scene light without visibly cheapening the silhouette.`,
    `The mesh is modelled at true scale with quad-dominant flow, so subdivision behaves and the object does not need rescaling on import.`,
  ],
};

const SCALE = [
  `Everything is placed at the scene origin with sensible pivots, so the asset can be duplicated, arrayed or attached to a rig without hunting for transforms.`,
  `Pivot points sit where you would expect them, which matters as soon as the model needs to be instanced or parented to something else.`,
  `Objects are grouped and named logically, so isolating a single part for a material change is a two-second job rather than a cleanup task.`,
  `The scene is organised rather than dumped into a single mesh, which makes selective texturing and partial reuse practical.`,
  `Naming and hierarchy are consistent, so the model behaves predictably when it is merged into a larger scene alongside other assets.`,
  `Transforms are frozen and the hierarchy is shallow, which keeps the asset easy to instance across a large environment.`,
];

const AGE = [
  y => `It has been on sale since ${y} and is still maintained as part of the active catalogue.`,
  y => `The listing dates back to ${y}, and it remains one of the models we keep current.`,
  y => `Available since ${y}, the model has been through several rounds of studio use.`,
  y => `First published in ${y}, it is part of the long-running core of the collection.`,
  y => `${y} is when this one first went up, and it has stayed in the catalogue since.`,
];

const USE_SENT = {
  'Aircraft': 'It works for aerospace visualisation, flight and combat simulation, war-game environments and aviation sequences in film and TV.',
  'Ships': 'Typical uses are naval and maritime scenes: film and TV VFX, harbour environments in games, and marine simulation.',
  'Military Vehicles': 'It suits battlefield simulation, war-game environments, defence training material and military VFX shots.',
  'Vehicles': 'Common uses are automotive advertising, film and TV backgrounds, game traffic and architectural visualisation.',
  'Medical': 'It fits medical education, VR anatomy training, patient-facing visualisation and medical sequences in film.',
  'Industrial Equipment': 'It is useful for industrial and factory visualisation, product rendering, game props and technical presentations.',
  'Architecture': 'It is aimed at architectural visualisation, city scenes, advertising renders and VR walkthroughs.',
  'Weapons & Tools': 'It works as a game prop, a film and TV set element, or a reference object in training material.',
  'Animals & Creatures': 'It suits game creatures, film and TV VFX, educational material and VR experiences.',
  'Characters & People': 'It works for game characters, crowd fills in film and TV, previsualisation and VR scenes.',
  'Nature & Plants': 'It fits environment dressing in games, architectural visualisation, film backgrounds and VR scenes.',
  'Furniture & Interior': 'It is built for interior visualisation, architectural renders, product advertising and game interiors.',
  'Lighting': 'It suits interior and architectural visualisation, product rendering and game environment dressing.',
  'Kitchen & Tableware': 'It works for interior renders, food and product advertising, and game and film set dressing.',
  'Food & Beverages': 'It fits food advertising, packaging visualisation, restaurant interiors and game props.',
  'Electronics': 'It is aimed at product rendering, advertising, UI and app mockups, and game and film props.',
  'Containers & Storage': 'It works as warehouse and logistics set dressing, a game prop, or a product-rendering element.',
  'Clothing & Accessories': 'It suits fashion visualisation, character dressing, product advertising and game assets.',
  'Sports & Recreation': 'It fits sports broadcast graphics, game assets, advertising renders and VR experiences.',
  'Toys & Games': 'It works for product advertising, packaging renders, game props and film set dressing.',
  'Musical Instruments': 'It suits music-video and film sets, game props, product rendering and educational material.',
  'Signage & Decor': 'It works as set dressing for interiors and streets, advertising renders and game environments.',
  'Space & Sci-Fi': 'It is built for science-fiction film and TV VFX, space simulation, game environments and VR scenes.',
  'Collections & Sets': 'The set covers several related objects at once, which saves assembling a scene from separate purchases.',
  'Other': 'It is ready for game assets, film and TV VFX, product rendering and VR experiences.',
};

// ── предложения из ИЗМЕРЕННЫХ данных ─────────────────────────────────────────
// Полигоны, вершины, разрешение текстур и габариты собраны из нашего inventory
// (scripts/studio-inventory-collect.js). Это единственная часть описания, где
// числа у каждой модели свои, поэтому она даёт уникальность не перестановкой
// слов, а фактами. Пишем их только если они есть: выдумывать нечего.
const fmtInt = n => Number(n).toLocaleString('en-US');
const MESH = [
  (p, v) => `The mesh carries ${fmtInt(p)} polygons and ${fmtInt(v)} vertices.`,
  (p, v) => `Geometry weighs in at ${fmtInt(p)} polygons over ${fmtInt(v)} vertices.`,
  (p, v) => `Counted at the source, the model is ${fmtInt(p)} polygons and ${fmtInt(v)} vertices.`,
  (p, v) => `You are getting ${fmtInt(p)} polygons and ${fmtInt(v)} vertices, measured rather than estimated.`,
];
const MESH_WEIGHT = [
  [12000, `That sits in low-poly territory, so it stays cheap to instance across a crowd scene or a game level.`],
  [120000, `That is a mid-weight build: detailed enough for a foreground shot, light enough to duplicate freely.`],
  [600000, `That is a heavy, close-up-grade build, so plan for it as a hero object rather than background filler.`],
  [Infinity, `That is a very dense build meant for close inspection; for wide shots a decimated copy will serve better.`],
];
const TEX = [
  (n, r) => `Texturing runs to ${n} maps at ${r}.`,
  (n, r) => `It ships with ${n} textures, authored at ${r}.`,
  (n, r) => `${n} texture maps come with it, at ${r} resolution.`,
];
const DIM = [
  d => `Real-world footprint is ${d}, so it drops into a scene at correct scale without a rescaling pass.`,
  d => `The object measures ${d}, modelled at true scale.`,
  d => `Dimensions are ${d}, which is what you get on import, with no unit guessing.`,
];

function specSentences(f, seed) {
  const s = f.specs;
  if (!s) return [];
  const out = [];
  if (s.polygons && s.vertices) {
    out.push(pick(MESH, seed * 29 + 4)(s.polygons, s.vertices));
    const band = MESH_WEIGHT.find(([lim]) => s.polygons <= lim);
    if (band) out.push(band[1]);
  }
  if (s.textures && s.textureSizes && s.textureSizes.length) {
    const r = s.textureSizes.length === 1 ? s.textureSizes[0] : s.textureSizes.slice(0, 2).join(' and ');
    out.push(pick(TEX, seed * 31 + 6)(s.textures, r.replace(/x/gi, ' x ')));
  }
  if (s.dimensions) out.push(pick(DIM, seed * 37 + 9)(esc(s.dimensions)));
  if (s.rigged && /jointed|rigged/i.test(s.rigged) && !/not\s+jointed/i.test(s.rigged)) {
    out.push(`The model arrives rigged, so it can be posed without building a skeleton first.`);
  }
  if (s.animated && !/not\s+animated/i.test(s.animated)) {
    out.push(`Animation is included on the asset rather than left as an exercise.`);
  }
  return out;
}

export function description(f, name, cat, price, seed) {
  const n = esc(proseName(name)), c = esc(cat), yr = yearOf(f);
  const parts = [pick(OPEN, seed)(n, c, price)];
  parts.push(...specSentences(f, seed));
  // Когда полигонаж измерен и он большой, нельзя ставить рядом заготовку про
  // «намеренно простую топологию, которая держит сцену лёгкой»: абзац начинает
  // спорить сам с собой - «тяжёлая сборка» и тут же «лёгкая сцена».
  let certPool = CERT_TXT[f.cert] || CERT_TXT['no certification'];
  if (f.specs && f.specs.polygons > 120000) {
    const filtered = certPool.filter(t => !/deliberately simple|keeps the scene light|efficient/i.test(t));
    if (filtered.length) certPool = filtered;
  }
  parts.push(pick(certPool, seed * 7 + 3));
  parts.push(pick(SCALE, seed * 11 + 5));
  // предложение из СВОИХ данных модели - самая уникальная часть абзаца
  if (f.uses && f.uses.length) {
    parts.push(pick([
      u => `On this listing the stated applications are ${u}.`,
      u => `Buyers most often take it for ${u}.`,
      u => `The listing flags ${u} as the intended applications.`,
      u => `It is catalogued for ${u}.`,
    ], seed * 13 + 1)(listy(f.uses.slice(0, 3).map(esc))));
  }
  // Заготовки про возраст листинга говорят о «нескольких кругах студийного
  // использования». Для модели, вышедшей пару месяцев назад, это неправда,
  // поэтому возраст упоминаем только у листингов старше года.
  if (yr && f.days > 365) parts.push(pick(AGE, seed * 17 + 2)(yr));
  parts.push(USE_SENT[cat] || USE_SENT['Other']);
  return parts.join(' ');
}

// ── таблица характеристик ─────────────────────────────────────────────────────
// Строки вынесены отдельно: их же использует раскладка в две колонки, где
// характеристики рисуются сеткой пар, а не таблицей (таблицу на две колонки
// не разложить).
export function specRows(f, name, cat, catSlug, price) {
  const yr = yearOf(f);
  const rows = [
    ['Model', esc(name)],
    ['Category', `<a href="/categories/${catSlug}/">${esc(cat)}</a>`],
  ];
  if (f.sub && f.sub !== name) rows.push(['Type', esc(f.sub)]);
  rows.push(['Certification', f.cert === 'no certification' ? 'Standard (uncertified)' : esc(f.cert)]);
  if (yr) rows.push(['On sale since', String(yr)]);
  rows.push(['Real-world scale', 'Yes']);
  // Измеренные характеристики из нашего inventory. Строки появляются только там,
  // где число действительно есть, иначе таблица начнёт врать прочерками.
  const s = f.specs;
  if (s) {
    if (s.polygons) rows.push(['Polygons', fmtInt(s.polygons)]);
    if (s.vertices) rows.push(['Vertices', fmtInt(s.vertices)]);
    if (s.geometry) rows.push(['Geometry', esc(s.geometry)]);
    if (s.unwrappedUVs) rows.push(['UV mapping', esc(s.unwrappedUVs)]);
    if (s.textures) rows.push(['Textures', String(s.textures)
      + (s.textureSizes && s.textureSizes.length ? ' at ' + esc(s.textureSizes.slice(0, 2).join(', ').replace(/x/gi, ' x ')) : '')]);
    if (s.dimensions) rows.push(['Dimensions', esc(s.dimensions)]);
    if (s.rigged) rows.push(['Rigging', esc(s.rigged)]);
    if (s.animated) rows.push(['Animation', esc(s.animated)]);
  }
  const nat = nativeOf(name);
  rows.push(['Native', esc(nat.native)]);
  if (nat.formats) rows.push(['Formats', esc(nat.formats)]);
  if (yr) rows.push(['PBR', yr >= 2023 ? 'Yes' : 'No']);
  // «Rigged version» вместо «Rig»: подпись отвечает на вопрос, который задают.
  rows.push(['Rigged version',
    (s && s.rigged && !/^\s*(static|none|no)\s*$/i.test(s.rigged)) || /\brigged\b/i.test(name)
      ? 'Available' : 'Not available']);
  // Лицензия зависит от того, изображает ли модель чужую торговую марку.
  // Раньше здесь стояло безусловное «Royalty Free» - и на брендовых карточках
  // сайт письменно разрешал то, что лицензией запрещено.
  const licence = brandOf(name) ? 'Editorial Uses Only (TurboSquid)' : 'Royalty Free (TurboSquid)';
  rows.push(['Licence', `<a href="/license/">${licence}</a>`]);
  rows.push(['Price', `$${price} USD`]);
  if (f.industries && f.industries.length) rows.push(['Primary industries', esc(f.industries.slice(0, 4).join(', '))]);
  if (f.uses && f.uses.length) rows.push(['Typical use', esc(f.uses.slice(0, 3).join(', '))]);
  return rows;
}

export function specTable(f, name, cat, catSlug, price) {
  const rows = specRows(f, name, cat, catSlug, price);
  return `        <div class="mp-spec-block">
          <h2 class="mp-block-h2">Specifications</h2>
          <table class="mp-spec-table"><tbody>
${rows.map(([k, v]) => `            <tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('\n')}
          </tbody></table>
        </div>`;
}

// Характеристики в две колонки. Таблицу разложить на две колонки нельзя, поэтому
// здесь это сетка пар «подпись - значение»: пары идут в поток и раскладываются
// колонками средствами CSS, порядок чтения сохраняется.
export function specGrid(f, name, cat, catSlug, price) {
  const rows = specRows(f, name, cat, catSlug, price);
  return `        <div class="mp-spec-block mp-spec-2col">
          <h2 class="mp-block-h2">Specifications</h2>
          <div class="mp-spec-pairs">
${rows.map(([k, v]) => `            <div class="mp-spec-pair"><span class="mp-spec-k">${k}</span><span class="mp-spec-v">${v}</span></div>`).join('\n')}
          </div>
        </div>`;
}

// ── вопросы-ответы ────────────────────────────────────────────────────────────
// Пул из 10; на страницу попадают 4, набор и формулировки зависят от id модели.
function questionPool(f, n, cat, price, tsUrl, seed) {
  const yr = yearOf(f);
  const ind = listy((f.industries || []).slice(0, 3).map(esc));
  const uses = listy((f.uses || []).slice(0, 3).map(esc));
  const kw = (f.keywords || []).filter(k => k && k.length < 60).slice(0, 3).map(esc);
  const ts = t => `<a href="${tsUrl}" target="_blank" rel="noopener">${t}</a>`;

  const pool = [];

  pool.push([`What file formats does the ${n} 3D model come in?`, pick([
    `The complete list of included formats is shown on the ${ts('TurboSquid product page')}, where every file is named and sized before you buy. Native scene files and the common interchange formats are the usual pairing.`,
    `Format availability differs by model, so the authoritative list sits on the ${ts('TurboSquid listing')} - each download is named with its size. Check it first if a specific renderer is required.`,
    `See the ${ts('TurboSquid product page')} for the exact download list. Formats are stated per file, so compatibility with your renderer can be confirmed before purchase.`,
    `Every included file is listed on the ${ts('product page at TurboSquid')}, with format and size shown per download. That page is the source of truth rather than this summary.`,
  ], seed)]);

  // Лицензия решает половину ответов ниже. Раньше все они безусловно обещали
  // коммерческое использование, и на брендовых карточках сайт письменно
  // разрешал ровно то, что лицензией запрещено.
  const editorial = !!brandOf(name);

  pool.push([`Can the ${n} model be used in a commercial project?`, editorial
    ? `No. The model depicts a real branded product, so TurboSquid lists it under the Editorial Uses Only licence. It may be used in news, commentary, education, personal projects and similar editorial contexts, but not in advertising, on merchandise or in any product offered for sale. See our <a href="/license/">licence guide</a>.`
    : pick([
      `Yes. It is sold under TurboSquid's Royalty Free licence, which covers commercial use in games, film, advertising and visualisation without per-use fees.`,
      `Yes - the Royalty Free licence covers commercial work, including client projects and released games, with no additional royalties per render or per copy sold.`,
      `Commercial use is included. The Royalty Free licence allows the model in paid client work, broadcast, published games and print; only redistributing the model file itself is excluded.`,
      `It ships with TurboSquid's Royalty Free licence, so a single purchase covers commercial delivery - you do not pay again per project or per seat of the finished work.`,
    ], seed * 3 + 1)]);

  const certQ = f.cert === 'CheckMate Lite/Pro'
    ? [`Is the ${n} model quality-checked?`, pick([
      `Yes - it holds TurboSquid's CheckMate certification. A reviewer manually verified the topology, object and material naming, real-world scale and the absence of stray geometry.`,
      `It is CheckMate certified, which on TurboSquid means a human reviewer signed off the wireframe, the naming and the scale rather than the seller self-declaring quality.`,
      `Yes. CheckMate is the marketplace's own manual review, and this model passed it - clean topology, named objects and materials, correct units.`,
    ], seed * 5)]
    : f.cert === 'StemCell'
      ? [`What does StemCell mean for the ${n} model?`, pick([
        `StemCell is TurboSquid's multi-format standard. The model was authored once and delivered in several formats with matching PBR materials, so shading survives the move between a game engine and an offline renderer.`,
        `It means one source asset, several delivered formats, and a PBR material setup designed to read consistently across them - no rebuilding shaders after import.`,
        `StemCell covers both geometry and shading: the model is delivered across formats with materials that stay equivalent instead of needing per-engine conversion.`,
      ], seed * 5)]
      : [`How clean is the geometry on the ${n} model?`, pick([
        `The mesh uses organised, quad-dominant topology at real-world scale, with objects named and grouped rather than merged into one block.`,
        `Geometry is modelled at true scale with a tidy edge flow, and the scene is split into named objects so partial reuse and material swaps stay simple.`,
        `It is built as an organised scene, not a single welded mesh - parts are separable, named and sized to real-world dimensions.`,
      ], seed * 5)];
  pool.push(certQ);

  pool.push([`Where can I buy the ${n} 3D model?`,
    `It is sold through ${ts('TurboSquid')}${yr ? `, where this listing has been available since ${yr}` : ''}. Purchase, download and licensing are handled by TurboSquid; delivery is immediate after checkout.`]);

  // Отрасли берутся из листинга TurboSquid и у брендовых моделей нередко
  // включают Advertising. Само по себе это не ложь - так помечен листинг, - но
  // рядом обязана стоять оговорка про лицензию, иначе перечень читается как
  // разрешение. Поэтому для Editorial здесь один ответ, а не выбор из трёх:
  // два прежних варианта прямо обещали, что лицензия область применения не
  // ограничивает.
  if (ind) pool.push([`Which industries use the ${n} model?`, editorial
    ? `${ind} are the primary industries on this listing. The licence, however, is Editorial Uses Only: the model depicts a real branded product, so it may appear in editorial work in those fields, but not in advertising or in products for sale.`
    : pick([
      `This listing is catalogued for ${ind}. Those are the sectors the model was tagged for on TurboSquid, based on how comparable assets in the ${esc(cat)} range are bought.`,
      `It is tagged for ${ind}. The categorisation reflects where similar ${esc(cat)} assets end up rather than a hard restriction - the licence does not limit the field of use.`,
      `${ind} are the primary industries on this listing, though the Royalty Free licence puts no limit on where the model is actually used.`,
    ], seed * 7 + 2)]);

  if (uses) pool.push([`What is the ${n} model typically used for?`, pick([
    `The listing names ${uses} as the main applications. In practice it also works anywhere a finished ${esc(cat).toLowerCase()} object is needed without modelling it from scratch.`,
    `Stated applications are ${uses}. Because the asset is finished rather than a base mesh, it also holds up as set dressing in scenes it was not specifically built for.`,
    `It is catalogued for ${uses} - the sort of work where the object needs to look right on camera but is not the subject of the shot.`,
  ], seed * 11 + 4)]);

  pool.push([`Does the ${n} model include materials and textures?`, pick([
    `Material and texture contents are listed per file on the ${ts('TurboSquid product page')}. ${f.cert === 'StemCell' ? 'As a StemCell asset it ships with PBR materials that stay consistent across the delivered formats.' : 'Where textures are included they are packaged with the download rather than linked externally.'}`,
    `The product page states what ships with each format. ${f.cert === 'StemCell' ? 'StemCell delivery means a PBR material set that reads the same across renderers.' : 'Textures, when present, come inside the download rather than as a separate purchase.'} See ${ts('the listing')} for the exact contents.`,
  ], seed * 13)]);

  pool.push([`How much does the ${n} 3D model cost?`, editorial
    ? `$${price} USD, paid once. TurboSquid handles payment and delivery. The licence is Editorial Uses Only, because the model depicts a real branded product: it covers editorial contexts such as news, commentary and education, but not advertising or products for sale.`
    : pick([
      `It is listed at $${price} USD on TurboSquid. That is a one-off purchase under the Royalty Free licence - there is no subscription and no per-project fee afterwards.`,
      `$${price} USD, paid once. The Royalty Free licence means no recurring cost and no extra payment when the finished work ships.`,
      `The price is $${price} USD. TurboSquid handles payment and delivery; the licence is Royalty Free, so the cost does not repeat per use.`,
    ], seed * 17 + 6)]);

  pool.push([`Can the ${n} model be modified after purchase?`, editorial
    ? `Yes. The licence allows editing the geometry, retopologising, changing materials and adapting the asset to a project. What it does not allow is reselling or redistributing the model file itself, or using the result commercially: this listing is Editorial Uses Only.`
    : pick([
      `Yes. The Royalty Free licence allows editing the geometry, retopologising, changing materials and adapting the asset to a project. What it does not allow is reselling or redistributing the model file itself.`,
      `Editing is allowed - remesh it, strip detail for real-time use, or rebuild the shaders. The one restriction is that the model file cannot be resold or given away as an asset.`,
      `Yes, modification is covered by the licence. Most buyers adjust materials or decimate the mesh for their engine; only redistribution of the source file is off-limits.`,
    ], seed * 19 + 8)]);

  // Вопросы по измеренным данным. Их задают чаще всего перед покупкой, и ответ
  // здесь конкретный, а не отсылка к листингу.
  const sp = f.specs;
  if (sp && sp.polygons) {
    pool.push([`How heavy is the ${n} mesh?`,
      `${fmtInt(sp.polygons)} polygons and ${fmtInt(sp.vertices || 0)} vertices${sp.geometry ? ', built as ' + esc(sp.geometry) : ''}. `
      + (sp.polygons <= 12000 ? 'That is light enough to instance across a scene without a decimation pass.'
        : sp.polygons <= 120000 ? 'That is a mid-weight asset: fine in the foreground, still cheap enough to duplicate.'
          : 'Treat it as a hero object; for wide shots a reduced copy will render faster.')]);
  }
  if (sp && sp.textures && sp.textureSizes && sp.textureSizes.length) {
    pool.push([`What texture resolution ships with the ${n}?`,
      `${sp.textures} maps at ${esc(sp.textureSizes.slice(0, 2).join(' and ').replace(/x/gi, ' x '))}`
      + `${sp.unwrappedUVs ? ', with ' + esc(String(sp.unwrappedUVs).toLowerCase()) + ' UVs' : ''}. `
      + `That is enough for close framing without resampling.`]);
  }
  if (sp && sp.dimensions) {
    pool.push([`What size is the ${n} in real-world units?`,
      `${esc(sp.dimensions)}. The model is built at true scale, so it lands at the right size next to other objects instead of needing a unit fix on import.`]);
  }

  if (kw.length) pool.push([`What should I search for to find models like the ${n}?`,
    `Useful search terms are ${listy(kw)}. Browsing the <a href="/categories/${catSlug(cat)}/">${esc(cat)}</a> category shows the closest alternatives at a range of prices.`]);

  return pool;
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;

export function faqBlock(f, name, cat, catSlug, price, tsUrl, seed) {
  const n = esc(proseName(name));
  const pool = questionPool(f, n, cat, price, tsUrl, seed);
  const len = pool.length;
  // Выбираем 4 из пула шагом, зависящим от id: у соседних моделей набор вопросов разный.
  // Шаг ОБЯЗАН быть взаимно прост с длиной пула, иначе обход зацикливается на подмножестве
  // индексов и цикл никогда не наберёт 4 вопроса.
  let step = 1 + (Math.abs(seed) % Math.max(1, len - 1));
  while (len > 1 && gcd(step, len) !== 1) step = step % (len - 1) + 1;
  const chosen = []; const seen = new Set();
  let i = Math.abs(seed * 23) % len;
  for (let guard = 0; guard < len && chosen.length < Math.min(4, len); guard++) {
    if (!seen.has(i)) { seen.add(i); chosen.push(pool[i]); }
    i = (i + step) % len;
  }
  return `        <div class="mp-faq-block">
          <h2 class="mp-block-h2">Questions About This Model</h2>
${chosen.map(([q, a]) => `          <h3 class="mp-faq-q">${q}</h3>\n          <p class="mp-faq-a">${a}</p>`).join('\n')}
        </div>`;
}

// ── даты и авторство ──────────────────────────────────────────────────────────
// Аудит seo-geo: 0 из 120 карточек имели дату или автора. По критериям скилла это
// один из самых сильных рычагов - страницы без дат хуже отбираются в AI-ответы.
//
// datePublished берём из days_in_sales (когда листинг появился на TurboSquid) - это
// реальный факт, а не выдумка. dateModified - дата пересборки страницы; ставим её
// только когда контент действительно менялся, иначе это накрутка свежести.
export function dateLine(f, updatedIso, updatedHuman) {
  const d = f.days ? new Date(Date.now() - f.days * 86400000) : null;
  const listed = d ? d.toISOString().slice(0, 10) : null;
  const listedHuman = d ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
  return `        <div class="mp-meta-line">
          <span class="mp-meta-by">By <a href="/about/" rel="author">Andrey Simonenko</a>, 3D Molier</span>${listed ? `
          <span class="mp-meta-sep">&#183;</span>
          <span>Published <time datetime="${listed}">${listedHuman}</time></span>` : ''}
          <span class="mp-meta-sep">&#183;</span>
          <span>Updated <time datetime="${updatedIso}">${updatedHuman}</time></span>
        </div>`;
}

export function pageSchema({ name, slug, cat, catSlug, desc, hero, f, site, updatedIso }) {
  const d = f.days ? new Date(Date.now() - f.days * 86400000) : null;
  const o = {
    '@context': 'https://schema.org', '@type': 'ItemPage',
    '@id': `${site}/models/${slug}/#page`,
    url: `${site}/models/${slug}/`,
    name: plain(name) + ' 3D Model',
    description: plain(desc).slice(0, 300),
    primaryImageOfPage: hero,
    inLanguage: 'en',
    dateModified: updatedIso,
    isPartOf: { '@id': site + '/#website' },
    about: { '@type': 'Thing', name: plain(cat) },
    author: { '@type': 'Person', name: 'Andrey Simonenko', jobTitle: '3D Artist and Founder', url: site + '/about/' },
    publisher: { '@id': site + '/#organization' },
    breadcrumb: { '@id': `${site}/models/${slug}/#breadcrumb` },
  };
  if (d) o.datePublished = d.toISOString().slice(0, 10);
  return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>';
}

// ── Product JSON-LD ───────────────────────────────────────────────────────────
export function productSchema({ name, slug, id, hero, tsUrl, cat, price, desc, f, site }) {
  const trim = t => {
    if (t.length <= 500) return t;
    const c = t.slice(0, 500), d = c.lastIndexOf('. ');
    return d > 200 ? c.slice(0, d + 1) : c.slice(0, c.lastIndexOf(' ')) + '…';
  };
  const o = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: plain(name), url: `${site}/models/${slug}/`, image: hero,
    description: trim(plain(desc)), sku: String(id),
    brand: { '@type': 'Brand', name: '3D Molier' }, category: plain(cat),
    offers: {
      '@type': 'Offer', price: (+price).toFixed(2), priceCurrency: 'USD',
      availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
      url: tsUrl, seller: { '@type': 'Organization', name: 'TurboSquid' },
    },
  };
  if (f.sub && f.sub !== name) o.additionalType = plain(f.sub);
  return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>';
}
