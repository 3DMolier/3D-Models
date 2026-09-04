/*
 * analyze-page-weight.mjs - из чего складывается вес карточки.
 *
 * ЗАЧЕМ. Вопрос основателя: сколько весит страница и что можно ужать. Общий
 * размер файла ничего не подсказывает - надо видеть, какая ЧАСТЬ разметки
 * сколько занимает. Тогда видно, где резать, а где трогать нечего.
 *
 * Меряем по разделам: голова с разметкой для поисковика, шапка, подвал,
 * галерея, таблица характеристик, описание, вопросы, блок версий, соседи.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/analyze-page-weight.mjs
 *          node scripts/analyze-page-weight.mjs --sample 400
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const SAMPLE = arg('--sample') || 300;

/** Кусок между двумя метками; если не нашли - ноль. */
const between = (h, a, b) => {
  const i = h.indexOf(a);
  if (i < 0) return 0;
  const j = b ? h.indexOf(b, i + a.length) : -1;
  return (j < 0 ? h.length : j) - i;
};

const PARTS = [
  ['голова (head)', h => between(h, '<head', '</head>')],
  ['  из неё - разметка schema.org', h => [...h.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)]
    .reduce((s, m) => s + m[0].length, 0)],
  ['шапка сайта', h => between(h, '<header', '</header>')],
  ['подвал сайта', h => between(h, '<footer', '</footer>')],
  ['галерея', h => between(h, '<div class="mp-gallery"', '</div></div>')],
  ['описание', h => [...h.matchAll(/<p class="mp-desc-text">[\s\S]*?<\/p>/g)].reduce((s, m) => s + m[0].length, 0)],
  ['вопросы (FAQ)', h => between(h, 'class="mp-faq-block"', '</section>')],
  ['таблица характеристик', h => between(h, 'class="mp-spec-block"', '</table>')],
  ['блок версий', h => between(h, 'class="mp-versions-section"', '</section>')],
  ['похожие модели', h => between(h, 'class="mp-related-section"', '</section>')],
];

const dirs = fs.readdirSync(MODELS);
const step = Math.max(1, Math.floor(dirs.length / SAMPLE));
const sizes = [];
const totals = new Map(PARTS.map(([n]) => [n, 0]));
let n = 0, gzipLike = 0;

for (let i = 0; i < dirs.length; i += step) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, dirs[i], 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  n++;
  sizes.push(h.length);
  for (const [name, fn] of PARTS) totals.set(name, totals.get(name) + fn(h));
  // Грубая оценка сжатия: доля неповторяющихся символов. Точную даёт сервер,
  // но порядок величины видно и так.
  gzipLike += new Set(h).size;
}

sizes.sort((a, b) => a - b);
const q = p => sizes[Math.floor(sizes.length * p)] || 0;
const avg = sizes.reduce((s, x) => s + x, 0) / (sizes.length || 1);

console.log('карточек измерено: ' + n.toLocaleString('ru-RU'));
console.log('\n--- размер страницы, КБ ---');
console.log('  минимум ' + (sizes[0] / 1024).toFixed(1)
  + ' | 25% ' + (q(0.25) / 1024).toFixed(1)
  + ' | медиана ' + (q(0.5) / 1024).toFixed(1)
  + ' | 75% ' + (q(0.75) / 1024).toFixed(1)
  + ' | максимум ' + (sizes[sizes.length - 1] / 1024).toFixed(1));
console.log('  среднее ' + (avg / 1024).toFixed(1) + ' КБ');

console.log('\n--- из чего складывается (среднее на карточку) ---');
const rows = [...totals].map(([name, sum]) => [name, sum / n]);
for (const [name, bytes] of rows) {
  const pct = avg ? (bytes / avg * 100) : 0;
  console.log('  ' + name.padEnd(34) + (bytes / 1024).toFixed(1).padStart(6) + ' КБ'
    + '  ' + pct.toFixed(1).padStart(5) + '%');
}
const known = rows.filter(r => !r[0].startsWith('  ')).reduce((s, r) => s + r[1], 0);
console.log('  ' + 'прочее (обвязка, шапки блоков)'.padEnd(34)
  + ((avg - known) / 1024).toFixed(1).padStart(6) + ' КБ');

console.log('\nвсего карточек на сайте: ' + dirs.length.toLocaleString('ru-RU') + ' папок');
