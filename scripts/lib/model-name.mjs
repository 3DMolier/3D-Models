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

/**
 * Имя без маркеров исполнения и описательного хвоста.
 * @param {string} n
 * @param {boolean} keepColor  не трогать цвет - он оказался частью имени,
 *                             а не признаком исполнения (см. familyName).
 */
export function identTitle(n, keepColor = false) {
  let s = String(n);
  for (const re of IDENT_MARKS) {
    if (keepColor && re === COLOR_ANY) continue;
    s = s.replace(re, ' ');
  }
  s = s.replace(IDENT_TITLE_FILLER, ' ').replace(/\s{2,}/g, ' ').trim();
  // Если после чистки осталось меньше двух слов, чистка съела слишком много -
  // возвращаем исходное имя без маркеров исполнения.
  if (s.split(/\s+/).filter(Boolean).length < 2) {
    s = String(n);
    for (const re of IDENT_MARKS) {
      if (keepColor && re === COLOR_ANY) continue;
      s = s.replace(re, ' ');
    }
    s = s.replace(/\s{2,}/g, ' ').trim();
  }
  // tidy - тут же: чистка убирает слово, за которое держался предлог, и
  // название кончается на «with». Функция объявлена ниже, к моменту вызова
  // модуль уже загружен.
  return tidy(s.replace(/\s+([,.])/g, '$1').trim());
}

/** Слово без дефисов и регистра: «Mercedes-Benz» и «Mercedes Benz» - одно. */
const normTok = w => String(w).toLowerCase().replace(/[^a-z0-9]+/g, '');

/*
 * Служебные слова. Сами по себе они ничего не называют и держатся только за
 * соседа справа, а именно соседа чистка и убирает. Отсюда заголовки-обрубки:
 * «9T234 with», «Airline Pilot with» -> «Pilot with», «Utility Knife With».
 * Таких на 16.09.2026 было 127.
 */
const FUNC = /^(?:with|without|and|or|in|on|of|for|to|by|from|at|the|a|an|plus|&|\+|-)$/i;

/** Срезаем служебные слова по краям: заголовок не может кончаться на «with». */
const tidy = s => {
  const ws = String(s).split(/\s+/).filter(Boolean);
  while (ws.length && FUNC.test(ws[ws.length - 1])) ws.pop();
  while (ws.length && FUNC.test(ws[0])) ws.shift();
  return ws.join(' ');
};

/*
 * Повтор значимого слова - признак того, что из фразы вынули середину.
 * «Blue Snake Catcher with Captured Brown Snake» -> «Snake with Captured
 * Snake»: слово уцелело дважды, а связка между ними исчезла. Таких было 65.
 */
const repeats = s => {
  const ws = String(s).toLowerCase().split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]+/g, '')).filter(w => w && !FUNC.test(w));
  return new Set(ws).size < ws.length;
};

/*
 * Заголовок, снятый со страницы, - это данные, и правило «данные важнее
 * вывода» держится. Но обрубок данными не является: «9T234 with», «Pilot with»,
 * «Utility Knife With» - это вчерашняя ошибка вычисления, застывшая в разметке
 * и попавшая оттуда в data/model-display-name.json. Таких 280.
 *
 * Отличаем именно поломку, а не странность: заголовок начинается или кончается
 * служебным словом. Повтор слова сюда НЕ входит - «Beer Mug with Beer» это
 * настоящее название товара.
 */
export const brokenTitle = s => {
  const t = String(s || '').trim();
  return !t || tidy(t) !== t;
};

/**
 * Съеден ли цвет: `was` - это `now` без цветных слов и ничего больше.
 * «Bird Commercial Bus» против «Blue Bird Commercial Bus» - да, съеден.
 * Нужно там, где старый заголовок сняли со страницы, а на странице он уже был
 * посчитан по прежнему правилу, рвавшему составные имена.
 */
export function colorEaten(was, now) {
  const a = String(was).split(/\s+/).map(normTok).filter(Boolean);
  const b = String(now).split(/\s+/).map(normTok).filter(Boolean);
  if (!a.length || b.length <= a.length) return false;
  const isColor = new RegExp('^(?:' + COLOR_ANY.source.replace(/\\b/g, '') + ')$', 'i');
  let i = 0, extraColor = 0;
  for (const w of b) {
    if (i < a.length && a[i] === w) { i++; continue; }
    if (!isColor.test(w)) return false;
    extraColor++;
  }
  return i === a.length && extraColor > 0;
}

/**
 * Имя семьи: только то, что встречается в названии КАЖДОГО её члена.
 * @param {string} mainName  имя главной карточки
 * @param {string[]} others  имена свёрнутых вариантов
 */
export function familyName(mainName, others) {
  if (!others || !others.length) return identTitle(mainName);
  /*
   * В набор слов члена семьи кладём и СЦЕПКИ соседей: «F 35» у него написано
   * двумя словами, а у главной - «F-35», одним. Без сцепки слово считалось
   * необщим, и «Stealth Multirole Fighter F-35 Lightning II» превращалось в
   * «Stealth Multirole Fighter Lightning II» - без обозначения самолёта.
   */
  const sets = others.map(n => {
    const t = String(n).split(/\s+/).map(normTok).filter(Boolean);
    const s = new Set(t);
    for (let i = 0; i < t.length - 1; i++) s.add(t[i] + t[i + 1]);
    return s;
  });
  const words = String(mainName).split(/\s+/);
  const toks = words.map(normTok);
  const keep = toks.map(t => !!t && sets.every(s => s.has(t)));

  /*
   * Слово, приклеенное к соседу. «Общее всем» - хорошее правило, но оно рубит
   * составные имена: у вертолётов Sikorsky один из членов семьи назван
   * «Twin Turbine Military Helicopter», слова «Black» у него нет, и от
   * «Black Hawk» оставался «Hawk». То же с «Razer Black Widow» и автобусами
   * «Blue Bird» - это марка, а не цвет.
   *
   * Признак сращения проверяем по данным, а не списком: если КАЖДЫЙ член
   * семьи, у которого вообще есть слово B, называет его только в паре «A B»,
   * то A и B - одно имя, и рвать его нельзя. Для цветовых вариаций правило не
   * срабатывает по определению: там у членов рядом с B стоят разные цвета.
   */
  const seqs = others.map(n => String(n).split(/\s+/).map(normTok).filter(Boolean));
  const glued = words.map(() => false);
  for (let i = 0; i < words.length - 1; i++) {
    if (!toks[i] || !toks[i + 1]) continue;
    const a = toks[i], b = toks[i + 1];
    let seen = 0, pair = 0;
    for (const seq of seqs) {
      const j = seq.indexOf(b);
      if (j < 0) continue;
      seen++;
      if (j > 0 && seq[j - 1] === a) pair++;
    }
    if (seen && pair === seen) glued[i] = true;
  }
  for (let i = 0; i < words.length - 1; i++) if (glued[i] && keep[i + 1]) keep[i] = true;
  const kept = words.filter((w, i) => keep[i]);
  /*
   * Цвет, общий ВСЕМ членам семьи, - это не признак исполнения, а часть имени.
   * Различать варианты он не может по определению: он у всех одинаковый.
   * Безусловная чистка превращала «Sikorsky UH-60 Black Hawk» в «UH-60 Hawk»,
   * «Razer Black Widow» в «Razer Widow», «Blue Bird School Bus» (марка
   * автобуса) в «Bird School Bus». Таких было 49.
   */
  const title = tidy(identTitle(kept.join(' '), true));
  // Чистка могла срезать слишком много: у группы Porsche Cayenne общими остались
  // только «AWD 4dr» - как название карточки это бессмыслица. Требуем хотя бы
  // одно полноценное слово и разумную длину, иначе берём имя главной.
  //
  // И отдельно - связность: если из фразы вынули середину и значимое слово
  // осталось дважды, заголовок читается как ошибка. Лучше имя главной модели:
  // оно хотя бы про одну из моделей семьи правду говорит.
  const ws = title.split(/\s+/).filter(Boolean);
  const meaningful = ws.length >= 2 && title.length >= 10
    && ws.some(w => w.length >= 4 && !/\d/.test(w)) && !repeats(title);
  if (meaningful) return title;

  /*
   * Запасная ветка - имя главной модели. Здесь цвет чистим, он и правда чаще
   * всего признак исполнения («Disco Ball Rainbow»), но сросшуюся пару не
   * трогаем: «Sikorsky UH-60 Black Hawk» - это имя вертолёта целиком.
   * Убираем цветные слова заранее, а identTitle зовём с keepColor: иначе он
   * снесёт и сросшиеся.
   */
  const isColor = new RegExp('^(?:' + COLOR_ANY.source.replace(/\\b/g, '') + ')$', 'i');
  const plain = words.filter((w, i) => !(isColor.test(toks[i]) && !glued[i])).join(' ');
  return tidy(identTitle(plain || mainName, true));
}
