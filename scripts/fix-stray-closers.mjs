/*
 * fix-stray-closers.mjs - убирает закрывающие теги, которым нет пары.
 *
 * Зачем. 06.10.2026 в catalog/index.html накопилось шесть лишних закрывающих
 * тегов: их оставлял add-catalog-static-cards.mjs, который резал блок сетки по
 * первой паре </div></div>. Браузер на таком закрывает контейнер досрочно, и
 * полсотни карточек вываливаются прямо в body во всю ширину экрана.
 *
 * Скрипт считает вложенность div, a, section, p и удаляет только те закрывающие
 * теги, для которых нет открытого. Больше ничего не трогает.
 *
 * Запуск:  node scripts/fix-stray-closers.mjs <файл> [--dry]
 */
import fs from 'node:fs';

const FILE = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!FILE) { console.log('укажи файл: node scripts/fix-stray-closers.mjs catalog/index.html'); process.exit(1); }

const html = fs.readFileSync(FILE, 'utf8');
const stack = [];
const stray = [];
const re = /<(\/?)(div|a|section|p)\b[^>]*>/gi;
let m;
while ((m = re.exec(html))) {
  const closing = m[1] === '/';
  const tag = m[2].toLowerCase();
  if (!closing) { stack.push(tag); continue; }
  let i = stack.length - 1;
  while (i >= 0 && stack[i] !== tag) i--;
  if (i < 0) { stray.push({ at: m.index, len: m[0].length, tag }); continue; }
  stack.splice(i, 1);
}

if (!stray.length) { console.log(`${FILE}: лишних закрывающих тегов нет`); process.exit(0); }

console.log(`${FILE}: лишних закрывающих тегов ${stray.length}`);
for (const s of stray) {
  console.log(`  </${s.tag}> на позиции ${s.at}: ...${html.slice(Math.max(0, s.at - 70), s.at + s.len).replace(/\s+/g, ' ').slice(-90)}`);
}
if (DRY) { console.log('(--dry, ничего не записано)'); process.exit(0); }

let out = html;
for (const s of [...stray].sort((a, b) => b.at - a.at)) out = out.slice(0, s.at) + out.slice(s.at + s.len);
fs.writeFileSync(FILE, out, 'utf8');
console.log(`убрано ${stray.length}, файл переписан`);
