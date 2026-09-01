/*
 * military.mjs - военная модель или гражданская.
 *
 * ЗАЧЕМ. Заготовка текста для категории Aircraft писала одно и то же всем
 * самолётам подряд: «It works for aerospace visualisation, flight and combat
 * simulation, war-game environments…». На Air France Airbus A380 и на Airbus
 * A319 Air France это читается как явная нелепость - пассажирский лайнер
 * рекламируется для боевой симуляции и военных игр. Такой же шаблон стоял на
 * тысяче с лишним карточек.
 *
 * ПРАВИЛО. Боевые сценарии разрешены ТОЛЬКО при явном военном признаке. Нет
 * признака - модель считается гражданской. Осторожность именно в эту сторону:
 * назвать истребитель гражданским - потерять точность, назвать лайнер боевым -
 * сказать неправду о товаре.
 *
 * РАСКЛАД ПО КАТЕГОРИИ Aircraft (1 495 моделей):
 *   явные военные признаки      442
 *   явные гражданские           493
 *   оба сразу (военный борт
 *   известного производителя)    32   -> считаем военными
 *   ни одного                   528   -> считаем гражданскими
 */

// Военные признаки: типы, рода войск, узнаваемые обозначения бортов.
// Обозначения бортов пишут и через дефис, и слитно: «B-52» и «B52», «F-35» и
// «F35». Дефис поэтому необязателен - иначе Boeing B52 Stratofortress
// проходил как гражданский. Сюда же добавлены имена собственные, по которым
// модель узнают без буквенно-цифрового индекса: Iroquois, Huey, Kamikaze.
const MIL = /\b(fighter|bomber|military|combat|warplane|warship|battleship|destroyer|frigate|submarine|attack|stealth|air force|navy|naval|army|missile|gunship|interceptor|reconnaissance|awacs|artillery|tank\b|armou?red|howitzer|kamikaze|f-?\d\d?\b|su-?\d\d|mig-?\d|mi-?\d\b|uh-?\d|ah-?\d|ch-?\d|a-?10\b|b-?\d\d\b|c-?130|c-?17\b|kc-?\d|apache|black\s?hawk|chinook|osprey|raptor|lightning ii|typhoon|rafale|gripen|hornet|tomcat|globemaster|hercules|spitfire|messerschmitt|junkers|lancaster|corsair|predator|reaper|patriot|abrams|leopard \d|bradley|humvee|iroquois|huey|stratofortress|warthog|air\s?defen[cs]e|anti-?\s?aircraft|dreadnought|war\s?mech|avlb|battlefield|ak-?47|mq-?\d+|radar\s?system|multi\s?mission\s?radar)/i;

// Гражданские признаки. Нужны не для решения, а для отчётности: решение
// принимает MIL, всё остальное - гражданское.
const CIV = /\b(airbus|boeing|airliner|passenger|air france|lufthansa|emirates|qatar|delta air|united airlines|klm|ryanair|easyjet|business jet|private jet|cessna|gulfstream|learjet|embraer|bombardier|regional jet|freighter|air ambulance|civil)/i;

/** Военная ли модель. Категория и отрасли усиливают, но решает название. */
export function isMilitary(name, categorySlug, industries) {
  if (MIL.test(String(name))) return true;
  if (categorySlug === 'military-vehicles' || categorySlug === 'weapons') return true;
  // Отрасль сама по себе основанием не служит: теги TurboSquid ставят
  // Military / Defense и гражданским бортам, если их покупали для таких сцен.
  return false;
}

export const looksCivilian = name => CIV.test(String(name)) && !MIL.test(String(name));
