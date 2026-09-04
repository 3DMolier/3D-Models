/*
 * check-faq-category-link.mjs - сверить адрес категории в ответе FAQ.
 *
 * В абзаце «…category shows the closest alternatives…» ссылка ведёт на старую
 * категорию, хотя подпись рядом и строка «Category» в таблице уже новые.
 * Считаем, сколько карточек расходятся. Ничего не пишем.
 *
 * Запуск:  node scripts/check-faq-category-link.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const dirs = fs.readdirSync(path.join(ROOT, 'models'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);

let checked = 0, bad = 0, noRow = 0, noFaq = 0;
const sample = [];
for (const d of dirs) {
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', d, 'index.html'), 'utf8'); } catch (e) { continue; }
  checked++;
  // истина - строка «Category» в таблице характеристик
  const row = h.match(/Category<\/th><td><a href="(\/categories\/[^"]+)">/);
  if (!row) { noRow++; continue; }
  // ссылка в ответе FAQ
  const faq = h.match(/href="(\/categories\/[^"]+)">[^<]*<\/a> category shows the closest/);
  if (!faq) { noFaq++; continue; }
  if (faq[1] !== row[1]) {
    bad++;
    if (sample.length < 8) sample.push(d + ': таблица ' + row[1] + '  ответ ' + faq[1]);
  }
}
console.log('карточек: ' + checked);
console.log('без строки Category: ' + noRow + ', без такого ответа: ' + noFaq);
console.log('расходятся: ' + bad);
sample.forEach(s => console.log('   ' + s));
