/*
 * industries.mjs - единый источник отраслей модели.
 *
 * ЧТО БЫЛО. Одна карточка описывала отрасли ТРЕМЯ разными способами, из трёх
 * разных источников. На drilling-machine-generic-1335730:
 *   «Used In» вверху   - Hardware / Game Development / Film Production /
 *                        Advertising / Virtual Reality   (выведено из КАТЕГОРИИ)
 *   абзац описания     - visualization, advertising and 3D printing
 *                        (поле use_cases из models_master.csv)
 *   ответ в FAQ        - Film & Video Production, Advertising and Graphics
 *                        Multimedia and Web Design       (поле industries)
 * Причём «Graphics Multimedia and Web Design» - вообще не отрасль нашего сайта,
 * такой страницы нет. Покупатель читает три разных ответа на один вопрос и
 * перестаёт верить любому из них.
 *
 * ЧТО ТЕПЕРЬ. Один набор slug-ов на модель, из него строится всё: чипы «Used
 * In», чипы «Use Cases», абзац, ответ в FAQ и разметка. Набор собирается так:
 *
 *   1. отрасли из тегов TurboSquid (поле industries в models_master.csv),
 *      переведённые в наши slug-и; чего у нас нет - отбрасывается;
 *   2. плюс отрасли, характерные для категории модели - они идут ПЕРВЫМИ.
 *
 * ЗАЧЕМ ОБЪЕДИНЕНИЕ, А НЕ ОДНО ИЗ ДВУХ. Теги TurboSquid честные, но общие: у
 * буровой установки это «Film & Video Production | Advertising | Graphics
 * Multimedia and Web Design», и Hardware среди них нет. Категория, наоборот,
 * даёт точное «Hardware», но ничего не знает про конкретный листинг. Порознь
 * каждый источник врёт по-своему, вместе - дают полный набор.
 *
 * ПОБОЧНАЯ ПОЛЬЗА. Отрасль Simulation стоит в тегах у 15 391 модели, но в чипах
 * не появлялась НИ РАЗУ: карта категорий её не выдаёт. Посадочная страница
 * /industries/simulation/ не получала ни одной ссылки с карточек.
 */

/** Наши 13 отраслей: slug -> подпись на чипе. */
export const INDUSTRY_LABEL = {
  'advertising': 'Advertising',
  'aerospace': 'Aerospace',
  'architecture': 'Architecture',
  'event-management': 'Event Management',
  'film-video-production': 'Film Production',
  'game-development': 'Game Development',
  'hardware': 'Hardware',
  'medical': 'Medical',
  'military-defense': 'Military &amp; Defense',
  'simulation': 'Simulation',
  'software-development': 'Software Dev',
  'virtual-reality': 'Virtual Reality',
  '3d-printing': '3D Printing',
};

/** Полное имя для прозы и ответов - там сокращения читаются плохо. */
export const INDUSTRY_NAME = {
  'advertising': 'Advertising',
  'aerospace': 'Aerospace',
  'architecture': 'Architecture',
  'event-management': 'Event Management',
  'film-video-production': 'Film &amp; Video Production',
  'game-development': 'Game Development',
  'hardware': 'Hardware',
  'medical': 'Medical',
  'military-defense': 'Military &amp; Defense',
  'simulation': 'Simulation',
  'software-development': 'Software Development',
  'virtual-reality': 'Virtual Reality',
  '3d-printing': '3D Printing',
};

/*
 * Теги TurboSquid -> наши отрасли. null означает «своей страницы нет».
 * «Graphics Multimedia and Web Design» стоит у 50 778 моделей, но отдельной
 * посадочной страницы под него у нас нет и заводить её не за чем: запрос
 * размытый. Просто не показываем.
 */
export const RAW_TO_SLUG = {
  'Film & Video Production': 'film-video-production',
  'Advertising': 'advertising',
  'Graphics Multimedia and Web Design': null,
  'Games': 'game-development',
  'Virtual Reality': 'virtual-reality',
  'Simulation': 'simulation',
  'Architecture': 'architecture',
  'Software Development': 'software-development',
  'Aerospace': 'aerospace',
  'Hardware': 'hardware',
  'Military / Defense': 'military-defense',
  'Event Management': 'event-management',
  'Medical': 'medical',
  '3D Printing': '3d-printing',
};

/*
 * Отрасли, характерные для категории. Идут первыми: для буровой установки
 * Hardware важнее, чем Advertising, хотя в тегах листинга стоит только второе.
 * Список рукописный - вывести отрасль из категории алгоритмом нельзя.
 */
export const CATEGORY_INDUSTRIES = {
  'medical-3d-models': ['medical', 'simulation'],
  'aircraft': ['aerospace', 'simulation'],
  'ships': ['military-defense', 'simulation'],
  'weapons': ['military-defense', 'game-development'],
  'tools': ['hardware'],
  'military-vehicles': ['military-defense', 'simulation'],
  'animals-creatures': ['film-video-production', 'game-development'],
  'nature-plants': ['architecture', 'film-video-production'],
  'food-beverages': ['advertising'],
  'furniture-interior': ['architecture', 'advertising'],
  'clothing-accessories': ['advertising', 'game-development'],
  'electronics-gadgets': ['hardware', 'software-development'],
  'industrial-equipment': ['hardware', 'simulation'],
  'architecture-landmarks': ['architecture'],
  'characters-people': ['game-development', 'film-video-production'],
  'vehicles': ['simulation', 'advertising'],
  'containers-storage': ['hardware', 'architecture'],
  'sports-recreation': ['advertising', 'game-development'],
  'kitchen-tableware': ['architecture', 'advertising'],
  'space-scifi': ['aerospace', 'game-development'],
  'lighting': ['architecture', 'event-management'],
  'toys-games': ['advertising', 'game-development'],
  'signage-decor': ['event-management', 'advertising'],
  'musical-instruments': ['event-management', 'film-video-production'],
  'collections-sets': ['game-development', 'film-video-production'],
  'other': [],
};

/*
 * Формулировка сценария для чипов «Use Cases». Общая по отрасли; там, где
 * категория даёт более точное слово, оно перекрывает общее.
 */
const USE_GENERIC = {
  'advertising': 'product rendering',
  'aerospace': 'aerospace visualization',
  'architecture': 'architectural visualization',
  'event-management': 'event visualization',
  'film-video-production': 'film & TV VFX',
  'game-development': 'game assets',
  'hardware': 'technical visualization',
  'medical': 'medical visualization',
  'military-defense': 'defense simulation',
  'simulation': 'simulation & training',
  'software-development': 'software demos',
  'virtual-reality': 'VR experiences',
  '3d-printing': '3D printing',
};
const USE_BY_CATEGORY = {
  'aircraft': { 'simulation': 'flight simulation', 'game-development': 'game environments' },
  'ships': { 'simulation': 'naval simulation', 'game-development': 'game environments' },
  'military-vehicles': { 'simulation': 'battlefield simulation', 'game-development': 'war-game environments' },
  'vehicles': { 'simulation': 'driving simulation', 'advertising': 'automotive advertising', 'game-development': 'game traffic' },
  'medical-3d-models': { 'simulation': 'medical simulation', 'virtual-reality': 'VR anatomy training' },
  'industrial-equipment': { 'simulation': 'operator training', 'hardware': 'industrial visualization' },
  'architecture-landmarks': { 'virtual-reality': 'VR walkthroughs' },
  'characters-people': { 'game-development': 'game characters' },
  'furniture-interior': { 'architecture': 'interior visualization' },
  'food-beverages': { 'advertising': 'food photography' },
};

export const useLabel = (industry, categorySlug) =>
  (USE_BY_CATEGORY[categorySlug] && USE_BY_CATEGORY[categorySlug][industry])
  || USE_GENERIC[industry] || INDUSTRY_NAME[industry];

/** Сколько чипов показываем. Больше пяти строка переносится и теряет смысл. */
export const MAX_INDUSTRIES = 5;

/**
 * Единственная функция, определяющая отрасли модели.
 * @param {string[]} raw  значения поля industries из models_master.csv
 * @param {string} categorySlug  категория модели
 */
export function industriesOf(raw, categorySlug) {
  const out = [];
  const add = s => { if (s && INDUSTRY_LABEL[s] && !out.includes(s)) out.push(s); };
  for (const s of (CATEGORY_INDUSTRIES[categorySlug] || [])) add(s);
  // Принимаем и сырые значения из Excel, и уже готовые слаги. Слаги приходят
  // из data/model-industries.json - единственного источника отраслей; выводить
  // их заново из сырых значений значило бы держать два ответа на один вопрос.
  for (const r of (raw || [])) {
    const v = String(r).trim();
    add(RAW_TO_SLUG[v] || (INDUSTRY_LABEL[v] ? v : null));
  }
  // Пустого набора быть не должно: блок «Used In» без единого чипа выглядит
  // как поломка. Film и Advertising стоят у подавляющего большинства листингов.
  if (!out.length) { add('film-video-production'); add('advertising'); }
  return out.slice(0, MAX_INDUSTRIES);
}

/** «A, B and C» - для прозы и ответов. */
export const listOf = names => names.length <= 1 ? (names[0] || '')
  : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
