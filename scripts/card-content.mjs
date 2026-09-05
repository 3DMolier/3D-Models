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
import { INDUSTRY_NAME, useLabel, industriesOf } from './lib/industries.mjs';
import { isMilitary } from './lib/military.mjs';

/*
 * Отрасли берём ТОЛЬКО отсюда. Раньше на одной карточке их описывали три
 * независимых источника: чипы «Used In» выводились из категории, абзац - из
 * поля use_cases, ответ в FAQ - из поля industries, где встречалась и отрасль
 * «Graphics Multimedia and Web Design», страницы которой на сайте нет.
 * Правила сборки набора - в lib/industries.mjs.
 */
const indsOf = (f, catSlug) => industriesOf(f.industries, catSlug);

// Параметры файла выводятся из названия: сводного списка форматов у нас нет,
// пока не оживёт API студии. Правила заданы основателем; порядок проверок
// важен - «Rigged for Maya» это Maya, а не 3ds Max.
const FORMATS = 'MAX, FBX, OBJ, Cinema 4D R23, Maya 2022, Blender 3.4, glTF, 3DS, USDz, USD 2.0';
// Сокращения только там, где полное имя длиннее пользы от него.
const FMT_SHORT = { 'Cinema 4D R23': 'C4D R23' };
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
/*
 * Текст без разметки - для полей schema.org и подписей.
 *
 * Дефис разносим пробелами ТОЛЬКО когда он стоит между словами как тире.
 * Прежняя версия разносила любой, и «Space & Sci-Fi» превращалось в
 * «Space & Sci - Fi» прямо в разметке для поисковика.
 */
export const plain = s => String(s)
  .replace(/&amp;/g, '&')
  .replace(/-/g, (m, i, str) =>
    (/[\w]/.test(str[i - 1] || '') && /[\w]/.test(str[i + 1] || '')) ? '-' : ' - ')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/<[^>]+>/g, '')
  // Уже разделённое тире не должно обрасти двойными пробелами.
  .replace(/\s{2,}/g, ' ');

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

/*
 * Обрезка описания ПО ГРАНИЦЕ ПРЕДЛОЖЕНИЯ.
 *
 * В разметке ItemPage стояло простое slice(0, 300), и 98,8% описаний
 * обрывались посреди слова: «...The mesh is built with c». Поисковик показывает
 * этот текст как есть, и обрубок выглядит как брак.
 *
 * Правило: режем по последней точке, если она не слишком рано; иначе - по
 * последнему пробелу и ставим многоточие, чтобы обрыв был осознанным.
 * Тот же приём уже работал внутри разметки Product - теперь он общий, а не
 * спрятан в одной функции.
 */
export function trimAtSentence(text, limit) {
  const t = String(text || '');
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const dot = cut.lastIndexOf('. ');
  if (dot > limit * 0.4) return cut.slice(0, dot + 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut) + '…';
}

// Часть имён в каталоге уже оканчивается на «3D Model» / «3D Models Set».
// В прозе и вопросах это даёт «... 3D Model model» - убираем хвост только для текста,
// в заголовке H1 и в строке «Model» таблицы имя остаётся как есть.
export const proseName = s => String(s)
  .replace(/\s+3D\s+Models?$/i, '')
  .replace(/\s+3D\s+Models?\s+(Set|Collection)$/i, ' $1')
  .trim() || String(s);
/*
 * Год выхода листинга. Настоящая дата публикации приходит в f.published из
 * отчёта TurboSquid; вычисление «сегодня минус дни в продаже» осталось
 * запасным - для карточек, которых в отчёте нет. Оно неточное: снимок дней
 * не двигается, а «сегодня» двигается, поэтому год со временем убегает.
 */
const yearOf = f => (f.published ? Number(String(f.published).slice(0, 4))
  : (f.days ? new Date(Date.now() - f.days * 86400000).getFullYear() : null));

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
  (n, c, p) => `${n} is one of the ${c} models in the 3D Molier catalog, listed at $${p}.`,
  (n, c, p) => `Priced at $${p}, the ${n} is a finished ${c} model rather than a base mesh you have to build on.`,
];

const CERT_TXT = {
  'CheckMate Lite/Pro': [
    `It carries TurboSquid's CheckMate certification, which means an independent reviewer verified the topology, the naming of objects and materials, and that the geometry is built to real-world scale.`,
    `CheckMate certification confirms the mesh passed TurboSquid's manual quality audit: clean topology, sane object naming, correct units and no stray geometry.`,
    `The model is CheckMate certified - a human reviewer checked the wireframe, the material assignments and the real-world dimensions before it went on sale.`,
    `CheckMate is TurboSquid's manual review program, and this model passed it: no n-gons where they would hurt, no unnamed objects, no scale surprises on import.`,
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
    `The model uses efficient, well-organized geometry - no hidden faces or overlapping shells to clean up before rendering.`,
    `Topology is kept deliberately simple where detail would not read on camera, which keeps the scene light without visibly cheapening the silhouette.`,
    `The mesh is modelled at true scale with quad-dominant flow, so subdivision behaves and the object does not need rescaling on import.`,
  ],
};

const SCALE = [
  `Everything is placed at the scene origin with sensible pivots, so the asset can be duplicated, arrayed or attached to a rig without hunting for transforms.`,
  `Pivot points sit where you would expect them, which matters as soon as the model needs to be instanced or parented to something else.`,
  `Objects are grouped and named logically, so isolating a single part for a material change is a two-second job rather than a cleanup task.`,
  `The scene is organized rather than dumped into a single mesh, which makes selective texturing and partial reuse practical.`,
  `Naming and hierarchy are consistent, so the model behaves predictably when it is merged into a larger scene alongside other assets.`,
  `Transforms are frozen and the hierarchy is shallow, which keeps the asset easy to instance across a large environment.`,
];

const AGE = [
  y => `It has been on sale since ${y} and is still maintained as part of the active catalog.`,
  y => `The listing dates back to ${y}, and it remains one of the models we keep current.`,
  y => `Available since ${y}, the model has been through several rounds of studio use.`,
  y => `First published in ${y}, it is part of the long-running core of the collection.`,
  y => `${y} is when this one first went up, and it has stayed in the catalog since.`,
];

/*
 * Заготовка «для чего годится» по категории. У Aircraft их теперь ДВЕ.
 * Прежняя одна писала «flight and combat simulation, war-game environments»
 * всем самолётам подряд - включая Air France Airbus A380 и A319. Пассажирский
 * лайнер, рекламируемый для боевой симуляции, подрывает доверие ко всей
 * карточке сильнее, чем нехватка ключевых слов.
 * Боевые сценарии разрешены только при явном военном признаке в названии, см.
 * lib/military.mjs; по умолчанию модель считается гражданской.
 */
export const USE_SENT_AIRCRAFT_MIL = 'It works for aerospace visualization, flight and combat simulation, war-game environments and aviation sequences in film and TV.';
export const USE_SENT_AIRCRAFT_CIV = 'It works for airline and airport visualization, flight simulation, aviation sequences in film and TV, advertising renders and VR training.';

/*
 * Ключи здесь - СЛАГИ, а не названия. По названиям было шесть промахов:
 * «Ships & Boats», «Weapons», «Tools», «Architecture & Landmarks»,
 * «Electronics & Gadgets» и «Model Bundles & Sets» не совпадали с ключами
 * 'Ships', 'Weapons & Tools', 'Architecture', 'Electronics' и
 * 'Collections & Sets' - и эти категории молча получали текст для «Other».
 * Слаг - единственное, что у категории не меняется при переименовании.
 */
export const USE_SENT = {
  'aircraft': USE_SENT_AIRCRAFT_CIV,
  'ships': 'Typical uses are naval and maritime scenes: film and TV VFX, harbor environments in games, and marine simulation.',
  'military-vehicles': 'It suits battlefield simulation, war-game environments, defense training material and military VFX shots.',
  'vehicles': 'Common uses are automotive advertising, film and TV backgrounds, game traffic and architectural visualization.',
  'medical-3d-models': 'It fits medical education, VR anatomy training, patient-facing visualization and medical sequences in film.',
  'industrial-equipment': 'It is useful for industrial and factory visualization, product rendering, game props and technical presentations.',
  'architecture-landmarks': 'It is aimed at architectural visualization, city scenes, advertising renders and VR walkthroughs.',
  'weapons': 'It works as a game prop, a film and TV set element, or a reference object in training material.',
  'tools': 'It works as a game prop, a film and TV set element, or a reference object in training material.',
  'animals-creatures': 'It suits game creatures, film and TV VFX, educational material and VR experiences.',
  'characters-people': 'It works for game characters, crowd fills in film and TV, previsualization and VR scenes.',
  'nature-plants': 'It fits environment dressing in games, architectural visualization, film backgrounds and VR scenes.',
  'furniture-interior': 'It is built for interior visualization, architectural renders, product advertising and game interiors.',
  'lighting': 'It suits interior and architectural visualization, product rendering and game environment dressing.',
  'kitchen-tableware': 'It works for interior renders, food and product advertising, and game and film set dressing.',
  'food-beverages': 'It fits food advertising, packaging visualization, restaurant interiors and game props.',
  'electronics-gadgets': 'It is aimed at product rendering, advertising, UI and app mockups, and game and film props.',
  'containers-storage': 'It works as warehouse and logistics set dressing, a game prop, or a product-rendering element.',
  'clothing-accessories': 'It suits fashion visualization, character dressing, product advertising and game assets.',
  'sports-recreation': 'It fits sports broadcast graphics, game assets, advertising renders and VR experiences.',
  'toys-games': 'It works for product advertising, packaging renders, game props and film set dressing.',
  'musical-instruments': 'It suits music-video and film sets, game props, product rendering and educational material.',
  'signage-decor': 'It works as set dressing for interiors and streets, advertising renders and game environments.',
  'space-scifi': 'It is built for science-fiction film and TV VFX, space simulation, game environments and VR scenes.',
  'collections-sets': 'The set covers several related objects at once, which saves assembling a scene from separate purchases.',
  'other': 'It is ready for game assets, film and TV VFX, product rendering and VR experiences.',
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
/*
 * Раньше здесь стоял приговор по числу полигонов: «light», «mid-weight»,
 * «heavy». Он вводил в заблуждение. 116 тысяч полигонов - немного для
 * offline-рендера и много для мобильной игры, WebXR или сцены с сотней
 * экземпляров того же объекта; при этом на карточках встречались и «a light
 * load for a scene» при 173 356 полигонах, и «mid-weight» при 618 314.
 * Покупатель, поверивший слову, упирался в проблему уже после оплаты.
 *
 * Теперь число остаётся - оно измерено и полезно, - а вместо приговора
 * называется то, от чего он на самом деле зависит. Порог по полигонам больше
 * не нужен: формулировка верна для любого размера, поэтому все четыре ветки
 * ведут к одному набору из трёх вариантов (варианты нужны, чтобы 54 тысячи
 * страниц не получили одну и ту же строку).
 */
const MESH_WEIGHT = [
  [Infinity, `Whether that counts as light or heavy depends on the target platform, the complexity of the scene and how many instances it carries.`],
  [Infinity, `Its suitability for real-time use depends on the target platform, scene complexity and the number of instances.`],
  [Infinity, `That figure reads differently on desktop, on mobile and in WebXR, so weigh it against the target platform and the number of instances in the scene.`],
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
    // Выбор по номеру модели, а не по числу полигонов: формулировка больше не
    // зависит от размера меша, зато нужна разной на разных страницах.
    out.push(pick(MESH_WEIGHT, seed * 31 + 7)[1]);
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

export function description(f, name, cat, price, seed, catSlugIn) {
  /*
   * «Other» - служебное имя категории, годное для крошек и таблицы, но не для
   * предложения: «belongs to our Other range» читается как ошибка. На живых
   * страницах в этом месте стоит «general», и так у 1 711 карточек. Правило
   * жило в старом генераторе и при пересборке потерялось бы молча.
   * Подменяем ТОЛЬКО в тексте: ссылка и таблица по-прежнему говорят «Other».
   */
  const proseCat = /^other$/i.test(String(cat || '').trim()) ? 'general' : cat;
  /*
   * ОПИСАНИЕ СОБИРАЕТСЯ ОБЫЧНЫМ ТЕКСТОМ, БЕЗ ЭКРАНИРОВАНИЯ.
   *
   * Здесь стояло esc(): имя и категория экранировались при СБОРКЕ фразы. А
   * потом голова страницы экранировала всё описание ещё раз - и «Containers &
   * Storage» превращалось в «Containers &amp;amp; Storage» в трёх мета-тегах
   * сразу. Разбор поисковика, сделав один разбор сущностей, видел буквальное
   * «&amp;» вместо «&». Задето 5 339 карточек из 7 733 проверенных.
   *
   * Правило простое: экранировать РОВНО ОДИН РАЗ и ровно там, где текст
   * ложится в разметку. Здесь текст ещё не разметка - значит не экранируем.
   * Экранируют потребители: голова страницы (esc в мета-тегах) и разбивка на
   * абзацы (esc в descParagraphs).
   */
  const n = proseName(name), c = proseCat, yr = yearOf(f);
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
  // Предложение о применении. Сценарии берём из того же набора отраслей, что и
  // чипы «Used In» с «Use Cases»: раньше здесь стояло поле use_cases из CSV, и
  // абзац называл одно, чипы другое, а ответ в FAQ третье.
  {
    /*
     * Слаг категории берём переданный, вычисление оставляем запасным.
     * Вычисление из названия промахивается на четырёх категориях:
     * «Model Bundles & Sets» -> model-bundles-sets, а на деле collections-sets
     * (4 930 карточек); «Medical» -> medical вместо medical-3d-models (2 530);
     * «Ships & Boats» -> ships-boats вместо ships (670); «Space & Sci-Fi» ->
     * space-sci-fi вместо space-scifi (463). Слаг есть в записи - надо брать
     * его, а не выводить заново из имени.
     */
    const cs = catSlugIn || catSlug(cat);
    const u = listy([...new Set(indsOf(f, cs).map(s => useLabel(s, cs)))].slice(0, 3));
    if (u) {
      parts.push(pick([
        x => `On this listing the stated applications are ${x}.`,
        x => `Buyers most often take it for ${x}.`,
        x => `The listing flags ${x} as the intended applications.`,
        x => `It is cataloged for ${x}.`,
      ], seed * 13 + 1)(u));
    }
  }
  // Заготовки про возраст листинга говорят о «нескольких кругах студийного
  // использования». Для модели, вышедшей пару месяцев назад, это неправда,
  // поэтому возраст упоминаем только у листингов старше года.
  if (yr && f.days > 365) parts.push(pick(AGE, seed * 17 + 2)(yr));
  // Военная заготовка - только явным военным моделям.
  const csSent = catSlugIn || catSlug(cat);
  parts.push(cat === 'Aircraft'
    ? (isMilitary(name, csSent) ? USE_SENT_AIRCRAFT_MIL : USE_SENT_AIRCRAFT_CIV)
    : (USE_SENT[csSent] || USE_SENT['other']));
  return parts.join(' ');
}

// ── таблица характеристик ─────────────────────────────────────────────────────
// Строки вынесены отдельно: их же использует раскладка в две колонки, где
// характеристики рисуются сеткой пар, а не таблицей (таблицу на две колонки
// не разложить).
/*
 * opts.brand - марка, определённая по НАСТОЯЩЕМУ имени модели.
 * У склеенной карточки заголовок это имя семьи, и марка в нём может пропасть:
 * «Airbus Zephyr S Solar Powered Drone» после чистки становится просто
 * «Zephyr S Solar Powered Drone». Определять марку по показанному имени нельзя -
 * у 151 модели так терялась лицензия Editorial, то есть юридическое утверждение
 * на странице. Поэтому марку передают снаружи, из записи.
 */
export function specRows(f, name, cat, catSlug, price, opts = {}) {
  const yr = yearOf(f);
  const rows = [
    ['Model', esc(name)],
    ['Category', `<a href="/categories/${catSlug}/">${esc(cat)}</a>`],
  ];
  if (f.sub && f.sub !== name) rows.push(['Type', esc(f.sub)]);
  // «CheckMate Lite/Pro» читается как «какой-то из двух, неизвестно какой».
  // Точный уровень известен: в Excel-отчёте CheckMate Pro стоит у 37 677
  // моделей, CheckMate Lite у 4 065. Показываем его; общее «CheckMate
  // Certified» остаётся только там, где в отчёте пусто или #Н/Д.
  /*
   * Без сертификата подпись другая: «Quality standard: Built to CheckMate
   * specification». Слово «uncertified» читается как «качество не
   * проверено», хотя речь о том, что знак не выдан: TurboSquid закрыл
   * программу, и сертифицировать новые работы больше некому. Модели строятся
   * по той же спецификации.
   * «CheckMate Certified» здесь ставить нельзя: покупатель откроет страницу
   * на TurboSquid, знака не найдёт и перестанет верить остальному.
   * Решение применено на 18 727 карточках скриптом fix-uncertified-row.mjs;
   * здесь оно живёт в генераторе, иначе пересборка его откатит.
   */
  /*
   * Значение строки - ссылка на /model-standards/. Слова «CheckMate» и
   * «StemCell» ничего не говорят человеку, который видит их впервые, а до сих
   * пор объяснения на сайте не было вовсе: покупатель уходил гуглить. Ссылка
   * стоит ровно там, где возникает вопрос.
   */
  const STD = '/model-standards/';
  const certLink = t => `<a href="${STD}">${t}</a>`;
  if (f.cert === 'no certification') rows.push(['Quality standard', certLink('Built to CheckMate specification')]);
  else rows.push(['Certification', certLink(f.cert === 'CheckMate Lite/Pro' ? 'CheckMate Certified' : esc(f.cert))]);
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
  /*
   * Форматы - отдельными плашками, а не одной строкой через запятую. Правило
   * жило в заплатке fix-formats-tags.mjs и при пересборке потерялось бы на
   * ~50 тысячах страниц: набор и порядок те же, но в узкой правой колонке
   * сплошная лента текста не читается, глаз не находит нужный формат.
   * «Cinema 4D R23» сокращаем до «C4D R23» - так его пишут в списках форматов.
   */
  if (nat.formats) {
    const items = String(nat.formats).split(',').map(s => s.trim()).filter(Boolean);
    rows.push(['Formats', items.length > 1
      ? '<span class="fmt-list">'
        + items.map(t => '<span class="fmt-tag">' + esc(FMT_SHORT[t] || t) + '</span>').join('')
        + '</span>'
      : esc(nat.formats)]);
  }
  if (yr) rows.push(['PBR', yr >= 2023 ? 'Yes' : 'No']);
  /*
   * Две строки, а не одна. Прежняя «Rigged version» описывала ТЕКУЩИЙ вариант,
   * а читалась как ответ про товар: у Air France Airbus A380 сверху стояли
   * Standard, Rigged, Maya Rigged и Cinema 4D Rigged, а ниже - «Rigged version:
   * Not available». Так было на 4 440 карточках.
   *   Current version  - что открыто сейчас;
   *   Rigged versions  - есть ли риггинг у этой модели вообще.
   * Границу слова после «rigged» не ставим: в каталоге есть «Generic Sport Car
   * Rigged1», и \brigged\b его не ловит.
   */
  /*
   * Риггинг проверяем по СОБСТВЕННОМУ имени модели, а не по показываемому.
   * У склеенной карточки показывается имя семьи, и слово «Rigged» из него
   * выпадает: «2015 Porsche Cayenne S Rigged» показывается как «2015 Porsche
   * Cayenne S». Из-за этого живая страница спорит сама с собой - строка «Rig»
   * говорит «Rigged», а строка «Current version» тут же «Static», и так на
   * 52 карточках. Строку «Rig» мы убираем как повтор, значит оставшаяся должна
   * быть верной.
   */
  const ownName = opts.selfName || name;
  const selfRigged = /\brigged/i.test(ownName) || /\brigged/i.test(name)
    || !!(s && s.rigged && !/^\s*(static|none|no)\s*$/i.test(s.rigged));
  const anyRigged = selfRigged || (f.variants || []).some(v => /\brigged/i.test(String(v)));
  rows.push(['Current version', selfRigged ? 'Rigged' : 'Static']);
  rows.push(['Rigged versions', anyRigged ? 'Available' : 'Not available']);
  /*
   * Строку про анимацию ставим ТОЛЬКО когда анимация есть. На живых страницах
   * у 1 090 карточек стояло «model is not animated» - отрицание, которое ничего
   * не сообщает и занимает строку. А вот положительных 173, и без этой строки
   * факт анимации терялся бы совсем: рядом с «Current version: Static» модель
   * «Animated Basketball Ball» читалась бы как противоречие.
   */
  if (f.animated) rows.push(['Animation', 'Animated']);
  // Лицензия зависит от того, изображает ли модель чужую торговую марку.
  // Раньше здесь стояло безусловное «Royalty Free» - и на брендовых карточках
  // сайт письменно разрешал то, что лицензией запрещено.
  const brand = opts.brand !== undefined ? opts.brand : brandOf(name);
  const license = brand ? 'Editorial Uses Only (TurboSquid)' : 'Royalty Free (TurboSquid)';
  rows.push(['License', `<a href="/license/">${license}</a>`]);
  rows.push(['Price', `$${price} USD`]);
  // Отрасли - из единого набора, а не из сырых тегов CSV: там встречается
  // «Graphics Multimedia and Web Design», страницы которой на сайте нет.
  /*
   * Отрасли и назначения в таблице нужны только там, где рядом НЕТ чипов.
   * На карточке они показаны дважды - блоком «Used In» в первом экране и
   * блоком «Use Cases» под таблицей, - и третий повтор строкой таблицы это
   * дублирование ради дублирования. Правило основателя: страница для
   * человека, одно и то же не повторяем.
   */
  if (!opts.hideIndustryRows) {
    const inds = indsOf(f, catSlug);
    if (inds.length) rows.push(['Primary industries', inds.map(x => INDUSTRY_NAME[x]).join(', ')]);
    if (f.uses && f.uses.length) rows.push(['Typical use', esc(f.uses.slice(0, 3).join(', '))]);
  }
  return rows;
}

export function specTable(f, name, cat, catSlug, price, opts = {}) {
  const rows = specRows(f, name, cat, catSlug, price, opts);
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
export function specGrid(f, name, cat, catSlug, price, opts = {}) {
  const rows = specRows(f, name, cat, catSlug, price, opts);
  return `        <div class="mp-spec-block mp-spec-2col">
          <h2 class="mp-block-h2">Specifications</h2>
          <div class="mp-spec-pairs">
${rows.map(([k, v]) => `            <div class="mp-spec-pair"><span class="mp-spec-k">${k}</span><span class="mp-spec-v">${v}</span></div>`).join('\n')}
          </div>
        </div>`;
}

// ── вопросы-ответы ────────────────────────────────────────────────────────────
// Пул из 10; на страницу попадают 4, набор и формулировки зависят от id модели.
/*
 * rawName - НАСТОЯЩЕЕ имя модели. Оно нужно только для brandOf: бренд решает
 * лицензию, а n к этому моменту уже причёсан для прозы (срезаны хвосты вида
 * «3D Model»), и по нему марка может не найтись.
 * Раньше здесь стояло brandOf(name) - переменной name в этой области нет
 * вообще, и вызов ронял сборку карточки с ReferenceError. Не всплывало только
 * потому, что генератор не запускали: страницы правили заплатками поверх.
 */
function questionPool(f, n, cat, price, tsUrl, seed, rawName, opts = {}) {
  const yr = yearOf(f);
  // Отрасли и сценарии - две проекции одного набора, а не два разных поля.
  // Слаг - из опций: вычисление из названия промахивается на четырёх категориях.
  const cs = opts.catSlug || catSlug(cat);
  const inds = indsOf(f, cs);
  const ind = listy(inds.map(s => INDUSTRY_NAME[s]));
  const uses = listy([...new Set(inds.map(s => useLabel(s, cs)))].slice(0, 3));
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
  const editorial = opts.brand !== undefined ? !!opts.brand : !!brandOf(rawName || n);

  pool.push([`Can the ${n} model be used in a commercial project?`, editorial
    ? `No. The model depicts a real branded product, so TurboSquid lists it under the Editorial Uses Only license. It may be used in news, commentary, education, personal projects and similar editorial contexts, but not in advertising, on merchandise or in any product offered for sale. See our <a href="/license/">license guide</a>.`
    : pick([
      `Yes. It is sold under TurboSquid's Royalty Free license, which covers commercial use in games, film, advertising and visualization without per-use fees.`,
      `Yes - the Royalty Free license covers commercial work, including client projects and released games, with no additional royalties per render or per copy sold.`,
      `Commercial use is included. The Royalty Free license allows the model in paid client work, broadcast, published games and print; only redistributing the model file itself is excluded.`,
      `It ships with TurboSquid's Royalty Free license, so a single purchase covers commercial delivery - you do not pay again per project or per seat of the finished work.`,
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
        `The mesh uses organized, quad-dominant topology at real-world scale, with objects named and grouped rather than merged into one block.`,
        `Geometry is modelled at true scale with a tidy edge flow, and the scene is split into named objects so partial reuse and material swaps stay simple.`,
        `It is built as an organized scene, not a single welded mesh - parts are separable, named and sized to real-world dimensions.`,
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
    ? `${ind} are the primary industries on this listing. The license, however, is Editorial Uses Only: the model depicts a real branded product, so it may appear in editorial work in those fields, but not in advertising or in products for sale.`
    : pick([
      `This listing is cataloged for ${ind}. Those are the sectors the model was tagged for on TurboSquid, based on how comparable assets in the ${esc(cat)} range are bought.`,
      `It is tagged for ${ind}. The categorisation reflects where similar ${esc(cat)} assets end up rather than a hard restriction - the license does not limit the field of use.`,
      `${ind} are the primary industries on this listing, though the Royalty Free license puts no limit on where the model is actually used.`,
    ], seed * 7 + 2)]);

  if (uses) pool.push([`What is the ${n} model typically used for?`, pick([
    `The listing names ${uses} as the main applications. In practice it also works anywhere a finished ${esc(cat).toLowerCase()} object is needed without modeling it from scratch.`,
    `Stated applications are ${uses}. Because the asset is finished rather than a base mesh, it also holds up as set dressing in scenes it was not specifically built for.`,
    `It is cataloged for ${uses} - the sort of work where the object needs to look right on camera but is not the subject of the shot.`,
  ], seed * 11 + 4)]);

  pool.push([`Does the ${n} model include materials and textures?`, pick([
    `Material and texture contents are listed per file on the ${ts('TurboSquid product page')}. ${f.cert === 'StemCell' ? 'As a StemCell asset it ships with PBR materials that stay consistent across the delivered formats.' : 'Where textures are included they are packaged with the download rather than linked externally.'}`,
    `The product page states what ships with each format. ${f.cert === 'StemCell' ? 'StemCell delivery means a PBR material set that reads the same across renderers.' : 'Textures, when present, come inside the download rather than as a separate purchase.'} See ${ts('the listing')} for the exact contents.`,
  ], seed * 13)]);

  pool.push([`How much does the ${n} 3D model cost?`, editorial
    ? `$${price} USD, paid once. TurboSquid handles payment and delivery. The license is Editorial Uses Only, because the model depicts a real branded product: it covers editorial contexts such as news, commentary and education, but not advertising or products for sale.`
    : pick([
      `It is listed at $${price} USD on TurboSquid. That is a one-off purchase under the Royalty Free license - there is no subscription and no per-project fee afterwards.`,
      `$${price} USD, paid once. The Royalty Free license means no recurring cost and no extra payment when the finished work ships.`,
      `The price is $${price} USD. TurboSquid handles payment and delivery; the license is Royalty Free, so the cost does not repeat per use.`,
    ], seed * 17 + 6)]);

  pool.push([`Can the ${n} model be modified after purchase?`, editorial
    ? `Yes. The license allows editing the geometry, retopologising, changing materials and adapting the asset to a project. What it does not allow is reselling or redistributing the model file itself, or using the result commercially: this listing is Editorial Uses Only.`
    : pick([
      `Yes. The Royalty Free license allows editing the geometry, retopologising, changing materials and adapting the asset to a project. What it does not allow is reselling or redistributing the model file itself.`,
      `Editing is allowed - remesh it, strip detail for real-time use, or rebuild the shaders. The one restriction is that the model file cannot be resold or given away as an asset.`,
      `Yes, modification is covered by the license. Most buyers adjust materials or decimate the mesh for their engine; only redistribution of the source file is off-limits.`,
    ], seed * 19 + 8)]);

  // Вопросы по измеренным данным. Их задают чаще всего перед покупкой, и ответ
  // здесь конкретный, а не отсылка к листингу.
  const sp = f.specs;
  if (sp && sp.polygons) {
    pool.push([`How heavy is the ${n} mesh?`,
      `${fmtInt(sp.polygons)} polygons and ${fmtInt(sp.vertices || 0)} vertices${sp.geometry ? ', built as ' + esc(sp.geometry) : ''}. `
      // Здесь тоже без приговора по числу: он зависит от платформы и сцены,
      // а не от одного полигонажа.
      + pick(MESH_WEIGHT, seed * 31 + 7)[1]]);
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
    /*
     * Слаг из опций, а не вычисленный: вычисление промахивается на четырёх
     * категориях, и ответ уводил бы на несуществующую страницу.
     */
    `Useful search terms are ${listy(kw)}. Browsing the <a href="/categories/${opts.catSlug || catSlug(cat)}/">${esc(cat)}</a> category shows the closest alternatives at a range of prices.`]);

  return pool;
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;

export function faqBlock(f, name, cat, catSlug, price, tsUrl, seed, opts = {}) {
  const n = esc(proseName(name));
  const pool = questionPool(f, n, cat, price, tsUrl, seed, name, opts);
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
// dateModified - дата пересборки страницы; ставим её только когда контент
// действительно менялся, иначе это накрутка свежести.
//
// datePublished раньше ВЫЧИСЛЯЛСЯ: «сегодня минус дни в продаже». Снимок дней
// снят 02.04.2026 и с тех пор не двигался, а «сегодня» двигается каждый день -
// поэтому дата публикации уезжала вперёд на всех 52 826 карточках, ровно на 153
// дня, и разрыв рос сам собой. Настоящая дата есть в отчёте TurboSquid
// (колонка Date of publication), и теперь она приходит сюда пятым доводом.
// Вычисление осталось запасным - для карточек, которых в отчёте нет.
export function dateLine(f, updatedIso, updatedHuman, publishedIso) {
  const d = publishedIso ? new Date(publishedIso)
    : (f.days ? new Date(Date.now() - f.days * 86400000) : null);
  const listed = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
  const listedHuman = listed ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
  return `        <div class="mp-meta-line">
          <span class="mp-meta-by">By <a href="/about/" rel="author">Andrey Simonenko</a>, 3D Molier</span>${listed ? `
          <span class="mp-meta-sep">&#183;</span>
          <span>Published <time datetime="${listed}">${listedHuman}</time></span>` : ''}
          <span class="mp-meta-sep">&#183;</span>
          <span>Updated <time datetime="${updatedIso}">${updatedHuman}</time></span>
        </div>`;
}

export function pageSchema({ name, slug, cat, catSlug, desc, hero, f, site, updatedIso }) {
  // Дата публикации - настоящая, из отчёта; вычисление лишь запасное.
  const d = f.published ? new Date(f.published)
    : (f.days ? new Date(Date.now() - f.days * 86400000) : null);
  const o = {
    '@context': 'https://schema.org', '@type': 'ItemPage',
    '@id': `${site}/models/${slug}/#page`,
    url: `${site}/models/${slug}/`,
    name: plain(name) + ' 3D Model',
    description: trimAtSentence(plain(desc), 300),
    primaryImageOfPage: hero,
    inLanguage: 'en',
    dateModified: updatedIso,
    isPartOf: { '@id': site + '/#website' },
    about: { '@type': 'Thing', name: plain(cat) },
    author: { '@type': 'Person', name: 'Andrey Simonenko', jobTitle: '3D Artist and Founder', url: site + '/about/' },
    publisher: { '@id': site + '/#organization' },
    breadcrumb: { '@id': `${site}/models/${slug}/#breadcrumb` },
  };
  if (d && !isNaN(d)) o.datePublished = d.toISOString().slice(0, 10);
  return '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>';
}

// ── Product JSON-LD ───────────────────────────────────────────────────────────
export function productSchema({ name, slug, id, hero, tsUrl, cat, price, desc, f, site }) {
  const trim = t => trimAtSentence(t, 500);
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
