/*
 * check-military-claims.mjs - боевые формулировки только у военных моделей.
 *
 * Пункт 4 списка: гражданский Airbus не должен предлагаться для «combat
 * simulation» и «war-game environments». Правку уже применяли, здесь только
 * сверка: берём все страницы с запретными оборотами и спрашиваем isMilitary()
 * из единственного источника - scripts/lib/military.mjs.
 *
 * Запуск:  node scripts/check-military-claims.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { isMilitary } from './lib/military.mjs';
import { proseOf } from './lib/page-text.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
// Ловим ОБОРОТЫ, а не отдельные слова: «battlefield» само по себе стоит в
// списке ключевых слов из исходных данных и обещанием не является.
const BAD = /combat simulation|war-?game environment|battlefield (?:simulation|visuali[sz]ation)|defen[cs]e training/i;

const dirs = fs.readdirSync(path.join(ROOT, 'models'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);

let withPhrase = 0, wrong = 0;
const sample = [];
for (const d of dirs) {
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', d, 'index.html'), 'utf8'); } catch (e) { continue; }
  const prose = proseOf(h);
  if (!BAD.test(prose)) continue;
  withPhrase++;
  const name = (h.match(/<h1[^>]*>([^<]*)</) || [])[1] || '';
  const cat = (h.match(/Category<\/th><td><a href="\/categories\/([a-z0-9-]+)\//) || [])[1] || '';
  if (!isMilitary(name, cat)) {
    wrong++;
    if (sample.length < 12) sample.push(d + '  «' + name + '»  ' + cat);
  }
}
console.log('страниц с боевыми оборотами: ' + withPhrase);
console.log('из них не военных: ' + wrong);
sample.forEach(s => console.log('   ' + s));
