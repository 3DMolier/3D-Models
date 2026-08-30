/*
 * fix-rigged-rows.mjs - «Rigged version» отвечал не на тот вопрос (пункт 2).
 *
 * ЧТО БЫЛО. На Air France Airbus A380 сверху перечислены четыре версии -
 * Standard, Rigged, Maya Rigged, Cinema 4D Rigged, - а в характеристиках стоит
 * «Rigged version: Not available». Ты назвал причину верно: строка описывала
 * ТЕКУЩИЙ вариант, а не наличие риггинга у товара. Покупатель, дошедший до
 * характеристик, читает прямое отрицание того, что видит выше.
 *
 * СКОЛЬКО. 4 440 карточек из 54 077.
 *
 * ЧТО СТАЛО - схема из твоего файла:
 *     Current version:  Static | Rigged
 *     Rigged versions:  Available | Not available
 * Первая строка честно говорит, что открыто сейчас; вторая - что вообще есть у
 * этой модели. Наличие определяется по блоку версий на самой странице и по
 * собственному названию: это ровно те сведения, которые видит человек.
 *
 * Запуск:  node scripts/fix-rigged-rows.mjs --dry
 *          node scripts/fix-rigged-rows.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

let live = 0, changed = 0, fixed = 0, noRow = 0;
const dist = new Map();

for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const hasOld = /<th[^>]*>Rigged version<\/th>/.test(h);
  const hasNew = /<th[^>]*>Rigged versions<\/th>/.test(h);
  if (!hasOld && !hasNew) { noRow++; continue; }

  const own = (h.match(/<h1[^>]*>([^<]*)/) || [, ''])[1];
  const sec = h.match(/<section class="mp-related-section mp-versions-section">[\s\S]*?<\/section>/);
  const titles = sec ? [...sec[0].matchAll(/<div class="mp-rc-title">([^<]*)</g)].map(x => x[1]) : [];

  // Без закрывающей границы слова: в каталоге есть «Generic Sport Car Rigged1»,
  // и \brigged\b его не ловит - карточка осталась бы с «Not available» при
  // риггинге прямо в названии.
  const RIG = /\brigged/i;
  // Открытая сейчас версия: по названию самой страницы.
  const current = RIG.test(own) ? 'Rigged' : 'Static';
  // Есть ли риггинг вообще: у этой версии или у любой соседней.
  const anyRigged = RIG.test(own) || titles.some(t => RIG.test(t));
  const avail = anyRigged ? 'Available' : 'Not available';

  const before = h;
  const was = (before.match(/Rigged version<\/th><td[^>]*>([^<]*)</) || [, ''])[1];
  // Берём строку таблицы ЦЕЛИКОМ и выдаём на её месте две. Разметка у разных
  // поколений карточек разная - где-то th с классом, где-то со scope, - поэтому
  // теги переиспользуем из найденного куска, а не пишем свои.
  if (hasOld) {
    h = h.replace(/<tr>(<th[^>]*>)Rigged version(<\/th>)(<td[^>]*>)[^<]*(<\/td>)<\/tr>/,
      (x, th, thEnd, td, tdEnd) =>
        '<tr>' + th + 'Current version' + thEnd + td + current + tdEnd + '</tr>'
        + '<tr>' + th + 'Rigged versions' + thEnd + td + avail + tdEnd + '</tr>');
  } else {
    // Скрипт перезапускаемый: у уже переделанных карточек просто пересчитываем
    // значения. Нужно, когда правило меняется - например, когда выяснилось, что
    // «Rigged1» не ловится границей слова.
    h = h.replace(/(<th[^>]*>Current version<\/th><td[^>]*>)[^<]*(<\/td>)/, (x, a, b) => a + current + b);
    h = h.replace(/(<th[^>]*>Rigged versions<\/th><td[^>]*>)[^<]*(<\/td>)/, (x, a, b) => a + avail + b);
  }
  if (h === before) continue;
  changed++;
  if (anyRigged && /not available/i.test(was)) fixed++;
  dist.set(current + ' / ' + avail, (dist.get(current + ' / ' + avail) || 0) + 1);
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + (noRow ? ', без строки: ' + noRow : ''));
console.log('изменено: ' + changed);
console.log('из них исправлено прямых противоречий: ' + fixed);
console.log('--- сочетания:');
[...dist].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('   ' + k.padEnd(28) + v));
if (DRY) console.log('(--dry, ничего не записано)');
