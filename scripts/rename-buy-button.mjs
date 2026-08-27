/*
 * rename-buy-button.mjs - главная кнопка карточки: «Buy on TurboSquid».
 *
 * Была «View on TurboSquid». Кнопка ведёт на страницу товара, где его и
 * покупают, - «view» описывает не то действие, ради которого её нажимают.
 *
 * ЧТО ТРОГАЕМ. Только КНОПКИ:
 *   .btn-primary.mp-btn-center  - главная кнопка на карточке модели;
 *   .btn-ts                     - кнопка в карточках, которые дорисовывает
 *                                 скрипт на страницах категорий.
 *
 * ЧЕГО НЕ ТРОГАЕМ. Чипы версий (.mp-ver-chip). Там подпись объясняет, ЧЕМ эта
 * версия отличается: «Rigged», «Maya · Rigged». У главной версии отличия нет,
 * и подпись подменяется действием. Это ярлык, а не кнопка, и «Buy» в ряду с
 * «Rigged» читался бы как ещё одно свойство модели.
 *
 * Запуск:  node scripts/rename-buy-button.mjs --dry
 *          node scripts/rename-buy-button.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

const OLD = 'View on TurboSquid';
const NEW = 'Buy on TurboSquid';

// Кнопка: текст стоит после закрывающего </svg> внутри ссылки с классом
// btn-primary. Ловим именно её, чтобы не задеть чипы с тем же текстом.
const BTN_RE = /(class="btn-primary mp-btn-center"[^>]*>[\s\S]{0,400}?)View on TurboSquid/g;

let live = 0, touched = 0, buttons = 0, noBtn = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  if (!h.includes('btn-primary mp-btn-center')) { noBtn++; continue; }
  const before = h;
  let n = 0;
  h = h.replace(BTN_RE, (m, head) => { n++; return head + NEW; });
  if (h === before) continue;
  buttons += n; touched++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + ', без главной кнопки: ' + noBtn);
console.log('карточек изменено: ' + touched + ', кнопок переименовано: ' + buttons);
if (DRY) console.log('(--dry, ничего не записано)');
