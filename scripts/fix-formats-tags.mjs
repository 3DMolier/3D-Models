/*
 * fix-formats-tags.mjs - строка форматов небольшими тегами (пункт 8).
 *
 * ЧТО БЫЛО. В характеристиках стояла одна плотная строка на десять значений:
 *   MAX, FBX, OBJ, Cinema 4D R23, Maya 2022, Blender 3.4, glTF, 3DS, USDz, USD 2.0
 * Данные хорошие, читается плохо: в узкой правой колонке это сплошная лента
 * текста, в которой глаз не находит нужный формат.
 *
 * ЧТО СТАЛО. Каждый формат - отдельный тег. Набор и порядок не меняются, это
 * правка подачи, а не данных. Длинные подписи сокращены до того вида, в каком
 * их пишут в списках форматов: «Cinema 4D R23» -> «C4D R23».
 *
 * ПОЧЕМУ НЕ РАЗБИВКА НА NATIVE / EXCHANGE / DCC. Ты предлагал и такой вариант.
 * Строка Native на карточке уже есть отдельно, а деление оставшихся на
 * «обменные» и «пакетные» добавило бы две строки в таблицу ради группировки,
 * которую покупатель и так видит по названиям. Теги решают ту же задачу
 * дешевле; если захочешь разбивку - скажи, это ещё один проход.
 *
 * Запуск:  node scripts/fix-formats-tags.mjs --dry
 *          node scripts/fix-formats-tags.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

// Сокращения только там, где полное имя длиннее пользы от него.
const SHORT = { 'Cinema 4D R23': 'C4D R23' };

let live = 0, changed = 0, tagged = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const before = h;

  h = h.replace(/(<th[^>]*>Formats<\/th><td[^>]*>)([^<]+)(<\/td>)/,
    (x, a, val, b) => {
      // Уже разложено на теги - второй раз не трогаем.
      if (val.includes('fmt-tag')) return x;
      const items = val.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length < 2) return x;
      tagged++;
      return a + '<span class="fmt-list">'
        + items.map(t => '<span class="fmt-tag">' + (SHORT[t] || t) + '</span>').join('')
        + '</span>' + b;
    });

  if (h === before) continue;
  changed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('строка форматов разложена на теги: ' + tagged + ', файлов изменено: ' + changed);
if (DRY) console.log('(--dry, ничего не записано)');
