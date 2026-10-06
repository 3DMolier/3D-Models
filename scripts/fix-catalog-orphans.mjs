/*
 * fix-catalog-orphans.mjs - убирает карточки, выпавшие из сетки каталога.
 *
 * Зачем. add-catalog-static-cards.mjs искал конец блока #model-grid по первой
 * паре закрывающих div и при повторных запусках резал блок посередине первой же
 * карточки. Остаток прежних карточек оставался в файле за пределами сетки: к
 * 06.10.2026 там лежали 47 штук и обрывок первой. Без сетки они рисуются во всю
 * ширину экрана, по одной в ряд - это и увидел основатель под постраничной
 * навигацией.
 *
 * Скрипт удаляет всё, что лежит между закрывающим тегом #model-grid и первым
 * комментарием-разделителем, оставляя сам закрывающий тег на месте. Внутрь
 * сетки не лезет: её содержимое пересобирает add-catalog-static-cards.mjs.
 *
 * Запуск:  node scripts/fix-catalog-orphans.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const FILE = path.join(ROOT, 'catalog', 'index.html');
const DRY = process.argv.includes('--dry');
const html = fs.readFileSync(FILE, 'utf8');

const openIdx = html.indexOf('<div id="model-grid"');
if (openIdx < 0) { console.log('сетка #model-grid не найдена'); process.exit(1); }
const openEnd = html.indexOf('>', openIdx) + 1;

// конец сетки - по счётчику вложенности
let close = -1;
{
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = openEnd;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) { close = m.index; break; }
  }
}
if (close < 0) { console.log('у сетки нет закрывающего тега'); process.exit(1); }

const afterGrid = close + '</div>'.length;
// Хвост заканчивается там, где начинается осмысленная разметка страницы.
const stopAt = (() => {
  const marks = ['<!-- Блок пустой выдачи', '<!-- Навигация по страницам', '<section class="seo-fallback"'];
  const positions = marks.map(s => html.indexOf(s, afterGrid)).filter(i => i > 0);
  return positions.length ? Math.min(...positions) : -1;
})();
if (stopAt < 0) { console.log('не нашёл, где кончается хвост - ничего не трогаю'); process.exit(1); }

const tail = html.slice(afterGrid, stopAt);
const orphanCards = (tail.match(/class="model-card/g) || []).length;
if (!orphanCards && !/<div class="mc-body"/.test(tail)) {
  console.log('осиротевших карточек нет');
  process.exit(0);
}

console.log(`между концом сетки и разметкой страницы лежит ${tail.length} символов, карточек в них: ${orphanCards}`);
if (DRY) { console.log('(--dry, ничего не записано)'); process.exit(0); }

const out = html.slice(0, afterGrid) + '\n' + html.slice(stopAt);
fs.writeFileSync(FILE, out, 'utf8');
console.log(`убрано ${orphanCards} карточек и обрывок перед ними, файл стал короче на ${html.length - out.length} символов`);
