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

// Чего в списке выше не хватало. Найдено, когда разбирались, почему F-22
// Raptor, AH-64D Apache, Airbus A400M и AW101 Norwegian Air Force лежали в
// отрасли Aerospace без Military & Defense. Дописано сюда, а не заведено
// вторым списком в другом файле: вопрос «военная ли модель» один, и ответ на
// него должен быть один. Ничего из перечисленного военным не перестаёт быть,
// поэтому дополнение только расширяет, ничего не отменяя.
const MIL_MORE = /\b(aircraft carrier|cvn-?\d\d|a400m|aw101|m-346|l-39|bushmaster|stryker|main battle tank|nighthawk|fighter jet|attack jet|combat trainer|nato|c-5m?\b|oh-6|mh-6|il-76|tu-(?:16|22|95|141|143|160)\b|ka-(?:27|50|52)\b|t-(?:55|62|64|72|80|90)(?![0-9])|b(?:mp|tr|rdm)-\d)/i;

// Гражданские признаки. Нужны не для решения, а для отчётности: решение
// принимает MIL, всё остальное - гражданское.
const CIV = /\b(airbus|boeing|airliner|passenger|air france|lufthansa|emirates|qatar|delta air|united airlines|klm|ryanair|easyjet|business jet|private jet|cessna|gulfstream|learjet|embraer|bombardier|regional jet|freighter|air ambulance|civil)/i;

/*
 * Спорные слова - и в этом всё дело - спорны ПО-РАЗНОМУ в разных разделах.
 * «Raptor» среди самолётов это F-22 и ничто другое; среди наземной техники это
 * отделка пикапа Ford F-150. «Tank» среди самолётов не значит ничего, среди
 * машин это цистерна прицепа. «Eagle», «Falcon», «Typhoon», «Hornet» - имена
 * истребителей и одновременно птицы и погода.
 *
 * Для боевых формулировок в тексте намёка достаточно: там ошибка стоит одного
 * неточного предложения. Для отрасли - нет: отрасль это раздел сайта, и пикап
 * в разделе «Оборона» - прямая неправда о товаре. Отсюда два ответа разной
 * строгости из ОДНОГО набора признаков, а не два разных списка признаков.
 */
const AMBIGUOUS_BY_CAT = {
  aircraft: /\b(tank|attack|patriot|merlin)\b/i,
  // Буквенно-цифровое обозначение вида F-16 спорно везде, кроме авиации:
  // «Outboard Boat Engine Yamaha F80» и «Rocket Engine F-1» - не истребители.
  // «Interceptor» на земле - это полицейский Ford, а не перехватчик.
  ships: /\b(tank|raptor|eagle|falcon|tornado|typhoon|hornet|harrier|attack|patriot|merlin|interceptor|f-?\d\d?)\b/i,
  vehicles: /\b(tank|raptor|eagle|falcon|tornado|typhoon|hornet|harrier|attack|predator|patriot|reaper|corsair|merlin|interceptor|f-?\d\d?)\b/i,
  'space-scifi': /\b(tank|raptor|eagle|falcon|tornado|typhoon|hornet|harrier|attack|predator|reaper|corsair|merlin|interceptor|f-?\d\d?)\b/i,
};

/** Военная ли модель. Категория и отрасли усиливают, но решает название. */
export function isMilitary(name, categorySlug, industries) {
  const s = String(name);
  if (MIL.test(s) || MIL_MORE.test(s)) return true;
  if (categorySlug === 'military-vehicles' || categorySlug === 'weapons') return true;
  // Отрасль сама по себе основанием не служит: теги TurboSquid ставят
  // Military / Defense и гражданским бортам, если их покупали для таких сцен.
  return false;
}

/*
 * Строгий ответ - для отрасли. Здесь мало намёка: нужен либо однозначный
 * признак, либо военная категория. Спорное слово в гражданском окружении
 * («Tank Trailer», «F-150 Raptor») военным не считается.
 *
 * Категории, где имя вообще может означать военную технику, перечислены явно:
 * в одежде «army backpack» - это покрой, в мебели «navy blue» - цвет.
 */
const MIL_CATEGORIES = new Set([
  'aircraft', 'ships', 'vehicles', 'military-vehicles', 'weapons', 'space-scifi',
]);

export function isMilitaryForIndustry(name, categorySlug) {
  if (!MIL_CATEGORIES.has(categorySlug)) return false;
  if (categorySlug === 'military-vehicles' || categorySlug === 'weapons') return true;
  const s = String(name);
  if (!MIL.test(s) && !MIL_MORE.test(s)) return false;
  // Вычёркиваем спорные для этого раздела слова и смотрим, остался ли признак.
  // Не остался - значит вся военность держалась на спорном слове, и в отрасль
  // модель не идёт.
  const amb = AMBIGUOUS_BY_CAT[categorySlug];
  if (!amb) return true;
  const strict = s.replace(new RegExp(amb.source, 'gi'), ' ');
  return MIL.test(strict) || MIL_MORE.test(strict);
}

export const looksCivilian = name => CIV.test(String(name)) && !MIL.test(String(name));
