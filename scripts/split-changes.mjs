/*
 * split-changes.mjs - разложить список изменённых файлов на части для коммитов.
 *
 * На 54 тысячах файлов один git add / git commit не укладывается в таймаут
 * инструмента и оставляет после себя .git/index.lock. Поэтому коммитим по
 * алфавитным долям каталога models/ плюс отдельная доля на всё остальное.
 *
 * Вход:  .tmp/all.z  (git ls-files -m -o --exclude-standard -z)
 * Выход: .tmp/part-*.txt  в том же формате с нулевым разделителем.
 *
 * Запуск:  node scripts/split-changes.mjs
 */
import { ROOT } from './lib/paths.mjs';
import fs from 'node:fs';

const DIR = ROOT + '/.tmp';
const NUL = String.fromCharCode(0);
const list = fs.readFileSync(DIR + '/all.z', 'utf8').split(NUL).filter(Boolean);

const parts = {
  '1-other': [], '2-models-a-c': [], '3-models-d-h': [],
  '4-models-i-m': [], '5-models-n-r': [], '6-models-s-z': [],
};
for (const p of list) {
  if (!p.startsWith('models/')) { parts['1-other'].push(p); continue; }
  const ch = p.slice(7, 8).toLowerCase();
  if (ch <= 'c') parts['2-models-a-c'].push(p);
  else if (ch <= 'h') parts['3-models-d-h'].push(p);
  else if (ch <= 'm') parts['4-models-i-m'].push(p);
  else if (ch <= 'r') parts['5-models-n-r'].push(p);
  else parts['6-models-s-z'].push(p);
}
for (const [k, v] of Object.entries(parts)) {
  fs.writeFileSync(DIR + '/part-' + k + '.txt', v.join(NUL));
  console.log(k + ': ' + v.length);
}
console.log('всего: ' + list.length);
