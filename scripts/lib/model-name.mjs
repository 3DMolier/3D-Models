/*
 * model-name.mjs - разбор названий моделей.
 *
 * ЗАЧЕМ. Одни и те же регулярки - программа, цвет, оснастка - уже лежали в двух
 * местах: в merge-variants.mjs и в lib/variant-label.mjs. Третье место я чуть
 * не завёл, когда понадобилось имя семьи. Держим их здесь, в одном экземпляре.
 *
 * ЧТО ЗДЕСЬ
 *   SOFT, COLOR_ANY   маркеры исполнения в названии
 *   identTitle        имя без маркеров исполнения и описательного хвоста
 *   familyName        имя СЕМЬИ: только то, что общее у всех её членов
 *
 * ЗАЧЕМ ИМЯ СЕМЬИ. У склеенной карточки заголовок описывает не конкретную
 * модель, а всю группу. Иначе главной оказывается «Jet Airliner Airbus A330-200
 * Qatar», а внутри ещё Emirates, Lufthansa и Cathay Pacific: название обещает
 * не то, что на странице. Это решение основателя, оно уже применено на 7 625
 * карточках, и пересборка обязана его сохранить.
 *
 * ОСТАЛОСЬ (этап 4 плана): перевести merge-variants.mjs на этот модуль. Пока он
 * держит свою копию - сказано здесь вслух, чтобы не забылось.
 */

export const SOFT = /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/i;
export const COLOR_ANY = /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|olive|beige|pink|purple|maroon)\b/ig;

/** Маркеры исполнения: то, чем один вариант отличается от другого. */
const IDENT_MARKS = [
  SOFT,
  /\s*\b(?:low\s+poly|lowpoly)\b\s*/ig,
  /\s*\b(?:rigged|rigid|animated|simplified)\b\s*/ig,
  /\s*\b(?:simple|basic|full|detailed)\s+interior\b\s*/ig,
  /\s*\b(?:dirty|clean)\b\s*/ig,
  COLOR_ANY,
  /\s*\bcolor\b\s*/ig,
];

/*
 * Описательный «хвост» в заголовке объединённой карточки не нужен: главной может
 * оказаться «Mercedes-Benz 300SL Classic Sports Car Red», и серия из одиннадцати
 * исполнений получала заголовок с чужим описанием. Убираем только общие слова -
 * Gullwing, Atlas и прочие имена остаются.
 */
const IDENT_TITLE_FILLER = /\b(classic|vintage|retro|sports?|car|cars|vehicle|automobile|coupe|sedan|suv|crossover|luxury|modern|airlines?|airways)\b/ig;

/** Имя без маркеров исполнения и описательного хвоста. */
export function identTitle(n) {
  let s = String(n);
  for (const re of IDENT_MARKS) s = s.replace(re, ' ');
  s = s.replace(IDENT_TITLE_FILLER, ' ').replace(/\s{2,}/g, ' ').trim();
  // Если после чистки осталось меньше двух слов, чистка съела слишком много -
  // возвращаем исходное имя без маркеров исполнения.
  if (s.split(/\s+/).filter(Boolean).length < 2) {
    s = String(n);
    for (const re of IDENT_MARKS) s = s.replace(re, ' ');
    s = s.replace(/\s{2,}/g, ' ').trim();
  }
  return s.replace(/\s+([,.])/g, '$1').trim();
}

/** Слово без дефисов и регистра: «Mercedes-Benz» и «Mercedes Benz» - одно. */
const normTok = w => String(w).toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Имя семьи: только то, что встречается в названии КАЖДОГО её члена.
 * @param {string} mainName  имя главной карточки
 * @param {string[]} others  имена свёрнутых вариантов
 */
export function familyName(mainName, others) {
  if (!others || !others.length) return identTitle(mainName);
  const sets = others.map(n => new Set(String(n).split(/\s+/).map(normTok).filter(Boolean)));
  const kept = String(mainName).split(/\s+/)
    .filter(w => { const t = normTok(w); return t && sets.every(s => s.has(t)); });
  const title = identTitle(kept.join(' '));
  // Чистка могла срезать слишком много: у группы Porsche Cayenne общими остались
  // только «AWD 4dr» - как название карточки это бессмыслица. Требуем хотя бы
  // одно полноценное слово и разумную длину, иначе берём имя главной.
  const ws = title.split(/\s+/).filter(Boolean);
  const meaningful = ws.length >= 2 && title.length >= 10 && ws.some(w => w.length >= 4 && !/\d/.test(w));
  return meaningful ? title : identTitle(mainName);
}
