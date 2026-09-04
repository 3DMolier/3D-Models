/*
 * fix-browse-pages.mjs - общий индекс /browse/.
 *
 * Что это за раздел. 109 страниц по 500 ссылок на карточки - это несущая
 * конструкция для обхода: именно через них робот доходит до всех 54 тысяч
 * страниц моделей. Страницы 110-174 - остатки прошлого поколения индекса,
 * они уже переведены в перенаправления, здесь их не трогаем.
 *
 * Что чиним:
 *
 * 1. Число «54082» без разделителя разрядов. Это количество ПАПОК, а разных
 *    моделей 54 079: три адреса дублировали чужой номер и стали
 *    перенаправлениями. Везде на сайте стоит 54 079 - здесь должно быть так же.
 *
 * 2. Описание в 89 знаков. Поисковая выдача показывает около 155; треть места
 *    просто не использована, и во всех 109 страницах описание отличается
 *    только номером страницы.
 *
 * Запуск:  node scripts/fix-browse-pages.mjs --dry
 *          node scripts/fix-browse-pages.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const BROWSE = path.join(ROOT, 'browse');
const DRY = process.argv.includes('--dry');
const TOTAL = '54,079';

let pages = 0, numFixed = 0, descFixed = 0, stubs = 0;
const dirs = ['index.html', ...fs.readdirSync(BROWSE).filter(d => /^\d+$/.test(d)).sort((a, b) => a - b).map(d => d + '/index.html')];

for (const rel of dirs) {
  const file = path.join(BROWSE, rel);
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) { stubs++; continue; }
  const before = h;

  // 1. число моделей
  const n = (h.match(/54082/g) || []).length;
  if (n) { h = h.split('54082').join(TOTAL); numFixed += n; }

  // 2. описание
  const m = h.match(/<meta name="description" content="([^"]*)"/);
  if (m && m[1].length < 120) {
    const cur = m[1].replace(/\s+$/, '').replace(/\.$/, '');
    const add = ' Real-world scale, clean topology and all popular formats.';
    const next = (cur + '.' + add).length <= 158 ? cur + '.' + add : cur + '.';
    if (next !== m[1]) {
      h = h.replace(/(<meta name="description" content=")[^"]*(")/, (x, a, b) => a + next + b);
      descFixed++;
    }
  }

  if (h !== before) { pages++; if (!DRY) fs.writeFileSync(file, h); }
}

console.log('живых страниц изменено: ' + pages + ', заглушек пропущено: ' + stubs);
console.log('чисел «54082» исправлено: ' + numFixed + ', описаний дополнено: ' + descFixed);
if (DRY) console.log('(--dry, ничего не записано)');
