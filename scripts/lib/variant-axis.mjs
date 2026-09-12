/*
 * variant-axis.mjs - чем различаются члены склеенной семьи и как это назвать.
 *
 * ЗАЧЕМ. Правило основателя 12.09.2026: «если в объединении участвуют не только
 * цветовые вариации, но и разнообразные модели - банкноты разных номиналов,
 * номера машин разных штатов, - укажи это в названии карточки».
 *
 * Карточка `/models/utan-truck-license-plate-salt-lake-city-2467715/` держит
 * двенадцать номерных знаков разных штатов, а называлась по одному из них.
 * Покупатель, пришедший за знаком Мичигана, видел заголовок про Солт-Лейк-Сити.
 *
 * ЧТО ЗДЕСЬ. Одна функция: посмотреть на имена семьи и, ЕСЛИ ось различия
 * удаётся назвать словом, вернуть готовый заголовок. Не удаётся - вернуть null,
 * и тогда имя семьи остаётся прежним.
 *
 * ПОЧЕМУ ТАК УЗКО. Пробовал общее правило «всё, что различается не цветом -
 * разные вещи»: под него попали 12 527 склеенных карточек из 17 054, и в
 * большинстве это не разные вещи, а разные формулировки одного и того же
 * («Bulk Bag» против «Bulk Bag Supply Container»). Приписка к 73% заголовков
 * была бы шумом. Поэтому названы только те оси, которые видно наверняка:
 *   • штаты на номерных знаках;
 *   • страны на монетах и банкнотах;
 *   • номиналы денег.
 * Остальное молчит.
 *
 * ТРИ ГРАБЛИ, на которых это уже спотыкалось:
 *   1. Ливреи авиакомпаний. «Airbus A318 British / Air France / Lufthansa» -
 *      различие по названиям стран, но ось там авиакомпания, а не страна, и
 *      «Airbus A318 - 4 Countries» было бы враньём. Поэтому география работает
 *      ТОЛЬКО в денежном и «номерном» контексте.
 *   2. «British» и «UK» - одна страна, а считались двумя. Названия стран
 *      сводятся к коду, и только потом считаются.
 *   3. Северная Корея уходила в «2 Countries» из-за слов north/south рядом с
 *      «korea», хотя различаются там номиналы. После сведения к коду остаётся
 *      одна страна, и правило честно переходит к номиналам.
 */

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'with', 'for', 'in', 'on', 'to', 'by',
  '3d', 'model', 'models']);

const STATES = new Set(['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana',
  'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'ohio', 'oklahoma',
  'oregon', 'pennsylvania', 'tennessee', 'texas', 'utah', 'utan', 'vermont', 'virginia',
  'wisconsin', 'wyoming']);

/* Название страны -> код. Синонимы сводятся, иначе «British» и «UK» считаются
 * за две страны, а Северная и Южная Корея - за две в группе, где обе не при чём. */
const COUNTRY = new Map(Object.entries({
  french: 'FR', france: 'FR',
  german: 'DE', germany: 'DE', deutschland: 'DE',
  italian: 'IT', italy: 'IT', italia: 'IT',
  spanish: 'ES', spain: 'ES', espana: 'ES',
  british: 'GB', britain: 'GB', england: 'GB', english: 'GB', uk: 'GB',
  // «US» и «EU» как отдельные слова встречаются в названиях денег постоянно
  // («US Currency 100 Dollar Bills Pack»), а вне денежного контекста эта
  // функция не работает вовсе - ложных срабатываний взяться неоткуда.
  american: 'US', usa: 'US', us: 'US', eu: 'EU', european: 'EU',
  chinese: 'CN', china: 'CN',
  japanese: 'JP', japan: 'JP',
  korean: 'KR', korea: 'KR',
  russian: 'RU', russia: 'RU',
  canadian: 'CA', canada: 'CA',
  australian: 'AU', australia: 'AU',
  indian: 'IN', india: 'IN',
  brazilian: 'BR', brazil: 'BR',
  mexican: 'MX', mexico: 'MX',
  turkish: 'TR', turkey: 'TR',
  greek: 'GR', greece: 'GR',
  portuguese: 'PT', portugal: 'PT',
  dutch: 'NL', netherlands: 'NL',
  belgian: 'BE', belgium: 'BE',
  swiss: 'CH', switzerland: 'CH',
  austrian: 'AT', austria: 'AT',
  swedish: 'SE', sweden: 'SE',
  norwegian: 'NO', norway: 'NO',
  danish: 'DK', denmark: 'DK',
  finnish: 'FI', finland: 'FI',
  polish: 'PL', poland: 'PL',
  czech: 'CZ',
  hungarian: 'HU', hungary: 'HU',
  romanian: 'RO', romania: 'RO',
  ukrainian: 'UA', ukraine: 'UA',
  egyptian: 'EG', egypt: 'EG',
  israeli: 'IL', israel: 'IL',
  thai: 'TH', thailand: 'TH',
  vietnamese: 'VN', vietnam: 'VN',
  indonesian: 'ID', indonesia: 'ID',
  irish: 'IE', ireland: 'IE',
  scottish: 'GB', scotland: 'GB',
  croatian: 'HR', serbian: 'RS', bulgarian: 'BG', estonian: 'EE', latvian: 'LV',
  lithuanian: 'LT', kazakh: 'KZ', georgian: 'GE', armenian: 'AM', moroccan: 'MA',
  argentine: 'AR', argentina: 'AR', chilean: 'CL', chile: 'CL',
  colombian: 'CO', colombia: 'CO', peruvian: 'PE', peru: 'PE', cuban: 'CU', cuba: 'CU',
  slovenia: 'SI', slovakia: 'SK', cyprus: 'CY', malta: 'MT', luxembourg: 'LU',
  monaco: 'MC', andorra: 'AD', latvia: 'LV', lithuania: 'LT', estonia: 'EE',
}));

/* Деньги и номерные знаки: только в этом контексте география и номинал что-то
 * значат. Вне его те же слова означают ливрею, марку или год. */
const MONEY_CTX = /\b(banknote|banknotes|bill|bills|coin|coins|currency|yuan|won|dollar|dollars|euro|euros|pound|pounds|rupee|rupees|peso|pesos|yen|franc|francs|lira|dinar|krona|ruble|rouble|baht|dong|riyal|dirham|shekel|zloty|forint|koruna|kurus|chon|cent|cents)\b/i;
const PLATE_CTX = /\bplate\b/i;
/* У криптомонет номинала нет: числа в их названиях - это количество монет. */
const CRYPTO = /\b(crypto|cryptocurrency|bitcoin|ethereum|litecoin|dogecoin|token)\b/i;

const tk = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(t => t && !STOP.has(t));

/*
 * Ядро заголовка: слова главной, которые есть хотя бы у 60% семьи.
 *
 * Требование «у всех» здесь не работает: у двенадцати номерных знаков общим
 * остаётся одно слово «Plate», и заголовок «Plate - 8 US States» бессмыслен.
 * При 60% остаётся «License Plate».
 *
 * Мелкие слова (of, with, and) сами по себе порог не проходят, но выбрасывать
 * их нельзя - «Fan of North Korea Banknotes» превращалось в «Fan North Korea».
 * Поэтому служебное слово остаётся, если соседи по обе стороны остались.
 */
function coreTitle(mainName, names) {
  const sets = names.map(n => new Set(tk(n)));
  const need = Math.ceil(names.length * 0.6);
  const words = String(mainName).split(/\s+/).filter(Boolean);
  const keep = words.map(w => {
    const t = tk(w)[0];
    if (!t) return STOP.has(String(w).toLowerCase()) ? 'maybe' : false;
    return sets.filter(s => s.has(t)).length >= need;
  });
  // служебные слова: оставляем только между двумя оставленными
  for (let i = 0; i < words.length; i++) {
    if (keep[i] !== true && STOP.has(words[i].toLowerCase())) {
      keep[i] = keep[i - 1] === true && keep[i + 1] === true;
    }
    if (keep[i] === 'maybe') keep[i] = false;
  }
  return words.filter((w, i) => keep[i] === true).join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Заголовок семьи с названной осью различия - или null, если ось не опознана.
 * @param {string} mainName имя главной карточки
 * @param {string[]} others имена свёрнутых вариантов
 * @returns {string|null}
 */
export function variantAxis(mainName, others) {
  if (!others || others.length < 1) return null;
  const names = [mainName, ...others];
  const joined = names.join(' ');
  if (CRYPTO.test(joined)) return null;
  const money = MONEY_CTX.test(joined);
  const plate = PLATE_CTX.test(joined);
  if (!money && !plate) return null;

  const sets = names.map(n => new Set(tk(n)));
  const common = new Set([...sets[0]].filter(t => sets.every(s => s.has(t))));
  const diff = new Set();
  for (const s of sets) for (const t of s) if (!common.has(t)) diff.add(t);

  const states = new Set([...diff].filter(t => STATES.has(t)));
  const countries = new Set([...diff].filter(t => COUNTRY.has(t)).map(t => COUNTRY.get(t)));
  // Номинал - это число, но не год выпуска.
  const nums = new Set([...diff].filter(t => /^\d{1,6}$/.test(t) && !/^(19|20)\d\d$/.test(t)));

  let tail = null;
  if (plate && states.size >= 2) tail = states.size + ' US States';
  else if (countries.size >= 2) tail = countries.size + ' Countries';
  else if (money && nums.size >= 2) tail = nums.size + ' Denominations';
  if (!tail) return null;

  const core = coreTitle(mainName, names);
  // Ядро из одного слова заголовком быть не может.
  if (core.split(/\s+/).filter(Boolean).length < 2) return null;
  return core + ' - ' + tail;
}
