/*
 * fix-mesh-verdicts.mjs - убираем абсолютную оценку тяжести меша (пункт 12).
 *
 * ЧТО БЫЛО. Карточка утверждала: «116,420 polygons … a light build for its
 * class» - то есть выносила приговор в отрыве от задачи. Для offline-рендера
 * 116 тысяч полигонов действительно немного. Для мобильной игры, для WebXR или
 * для сцены с сотней экземпляров того же объекта - совсем нет. Покупатель,
 * который поверил слову «light» и взял модель под мобильный проект, получит
 * проблему уже после оплаты.
 *
 * ЧТО СТАВИМ. Число остаётся - оно измерено и полезно. Вердикт заменяется на
 * то, от чего он на самом деле зависит: платформа, сложность сцены, число
 * экземпляров. Формулировок три, выбираются по номеру модели: одинаковый
 * текст на 54 тысячах страниц уронил бы уникальность, о которой заботится
 * card-content.mjs.
 *
 * ГДЕ ВСТРЕЧАЛОСЬ (на выборке 9 000 карточек):
 *   «- a light build for its class»                     1 552
 *   «which puts it in the light/heavy bracket…»         1 575
 *   «That is a mid-weight build», «Treat it as a hero object» и ещё пять
 *   формулировок из более нового генератора - десятки штук.
 *
 * Генератор card-content.mjs правится отдельно, в том же заходе: без этого
 * первая же перегенерация вернула бы прежний текст.
 *
 * Запуск:  node scripts/fix-mesh-verdicts.mjs --dry
 *          node scripts/fix-mesh-verdicts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

// Три равнозначные формулировки. Выбор по номеру модели, а не случайный:
// прогон должен давать один и тот же результат при повторе.
const VARIANTS = [
  'Whether that counts as light or heavy depends on the target platform, the complexity of the scene and how many instances it carries.',
  'Its suitability for real-time use depends on the target platform, scene complexity and the number of instances.',
  'That figure reads differently on desktop, on mobile and in WebXR, so weigh it against the target platform and the number of instances in the scene.',
];
const pick = id => VARIANTS[Math.abs(Number(id) || 0) % VARIANTS.length];

// Что заменяем. Первая группа - хвост предложения вместе с разделителем:
// после неё остаётся точка и новая фраза. Вторая - самостоятельные приговоры.
// Класс слова берём как [a-z-]+, а не \w+: «mid-weight» через дефис, и
// первый заход его пропустил.
const TAILS = [
  /\s*[-–—]\s*a [a-z-]+ build for its class\./,
  /,?\s*which puts it in the [a-z-]+ bracket for this category\./,
  // «Counted at the source, the model is 173,356 polygons and 87,930 vertices,
  // a light load for a scene.» - именно этот шаблон ты и привёл в примере.
  /,\s*a [a-z-]+ load for a scene\./,
  // «At 618,314 polygons and 310,437 vertices this is a mid-weight asset…» -
  // шестьсот тысяч полигонов названы средними.
  /\s*this is a [a-z-]+ asset: dense enough for close framing,? and honest about what it costs a scene\./,
];
const SENTENCES = [
  'That sits in low-poly territory, so it stays cheap to instance across a crowd scene or a game level.',
  'That is a mid-weight build: detailed enough for a foreground shot, light enough to duplicate freely.',
  'That is a heavy, close-up-grade build, so plan for it as a hero object rather than background filler.',
  'That is a very dense build meant for close inspection; for wide shots a decimated copy will serve better.',
  'That is light enough to instance across a scene without a decimation pass.',
  'That is a mid-weight asset: fine in the foreground, still cheap enough to duplicate.',
  'Treat it as a hero object; for wide shots a reduced copy will render faster.',
];

let live = 0, changed = 0, tails = 0, sents = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const id = d.slice(d.lastIndexOf('-') + 1);
  const txt = pick(id);
  const before = h;

  for (const re of TAILS) {
    const g = new RegExp(re.source, 'g');
    h = h.replace(g, () => { tails++; return '. ' + txt; });
  }
  for (const s of SENTENCES) {
    if (h.includes(s)) { h = h.split(s).join(txt); sents++; continue; }
    // В разметке те же предложения обрезаны по длине описания: «That is a
    // heavy, close-up-grade build, so plan for it as a hero object rather than
    // background» - и точного совпадения нет. Ищем по началу до конца строки
    // или до закрывающей кавычки JSON.
    const head = s.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(head + '[^"<]{0,120}', 'g');
    if (!re.test(h)) continue;
    re.lastIndex = 0;
    h = h.replace(re, () => txt);
    sents++;
  }

  if (h === before) continue;
  changed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('изменено: ' + changed);
console.log('  хвостов «light build for its class» / «light bracket»: ' + tails);
console.log('  отдельных приговоров: ' + sents);
if (DRY) console.log('(--dry, ничего не записано)');
