/*
 * refresh-site-counts.mjs - обновить числа о размере каталога на страницах,
 * где они вписаны в текст.
 *
 * Что не так. Правило репо гласит: динамику не хардкодить. Но размер каталога
 * попал прямо в разметку шести страниц - в title, в описание, в разметку
 * schema.org, в подвал и в таблицу датасета. После объединения вариантов
 * каталог уменьшился с 59 637 до 54 079 страниц, и все эти числа разошлись с
 * правдой: /catalog/ обещал 59 637 моделей, /about/ - 58 500, таблица на
 * /data-licensing/ - 58 521 с устаревшей разбивкой по всем 26 категориям.
 *
 * Для покупателя лицензии на датасет это не мелочь: страница описывает состав
 * набора, и неверные цифры читаются как недостоверность продавца.
 *
 * Источники правды:
 *   data/fc-index.json         - сколько всего страниц в каталоге;
 *   data/category-counts.json  - разбивка по категориям (пишет
 *                                build-category-hubs.mjs).
 *
 * Запускать ПОСЛЕ prune-catalog-collapsed.mjs и build-category-hubs.mjs.
 *
 * Сеть не нужна.
 *
 * Запуск:
 *   node refresh-site-counts.mjs --dry
 *   node refresh-site-counts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

const total = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8')).total;
const cc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8'));
const group = n => n.toLocaleString('en-US');
const T = group(total);
// Округление для фраз вида «around 58,500 model pages»: там точность не нужна и
// вредна - число протухнет на следующем объединении.
const ROUND = group(Math.round(total / 500) * 500);
const CATS = Object.keys(cc.counts).length;

console.log('каталог сейчас:      ' + T + ' страниц, категорий ' + CATS);
console.log('округлённо для прозы: ' + ROUND);

const edits = [];
const add = (file, list) => edits.push({ file, list });

// Старые числа перечислены явно. Регулярка «любое число рядом со словом models»
// сюда не годится: на тех же страницах стоят 90,000 листингов TurboSquid,
// 100,000 моделей с 2003 года и 25,000 на CGTrader - это другие метрики, и
// трогать их нельзя.
add('catalog/index.html', [
  [/59,637/g, T],
  [/"numberOfItems":58527/g, '"numberOfItems":' + total],
]);
add('search/index.html', [[/59,637/g, T]]);
add('about/index.html', [[/58,500/g, ROUND]]);
add('custom-order/index.html', [
  [/58,500/g, ROUND],
  [/across 25 categories/g, 'across ' + CATS + ' categories'],
]);
add('collections/index.html', [[/\b5630\b/g, group(cc.counts['collections-sets'])]]);
// На главной стоял диапазон «$29–$499», хотя в каталоге цены идут от $1 до
// $2,999 - тот же диапазон уже написан на /catalog/. Занижённый потолок прячет
// дорогие лицензии, завышенный пол отпугивает бюджетного покупателя.
add('index.html', [[/\$29[–-]\$499/g, '$1&#8211;$2,999']]);

let changed = 0;
for (const { file, list } of edits) {
  const f = path.join(ROOT, file);
  if (!fs.existsSync(f)) { console.log('  нет файла: ' + file); continue; }
  let h = fs.readFileSync(f, 'utf8');
  const before = h;
  let hits = 0;
  for (const [re, to] of list) {
    const n = (h.match(re) || []).length;
    hits += n;
    h = h.replace(re, to);
  }
  if (h === before) { console.log('  ' + file.padEnd(28) + 'уже верно'); continue; }
  if (!DRY) fs.writeFileSync(f, h);
  changed++;
  console.log('  ' + file.padEnd(28) + 'замен: ' + hits);
}

// ── таблица датасета на /data-licensing/ ──
// Строки таблицы ссылаются на /categories/<слаг>/ - по слагу и подставляем.
{
  const f = path.join(ROOT, 'data-licensing', 'index.html');
  let h = fs.readFileSync(f, 'utf8');
  const before = h;
  let rows = 0, unknown = [];
  h = h.replace(
    /(<a href="\/categories\/([a-z0-9-]+)\/">[^<]*<\/a><\/td><td[^>]*>)([\d,]+)(<\/td>)/g,
    (m, head, slug, old, tail) => {
      const v = cc.counts[slug];
      if (v === undefined) { unknown.push(slug); return m; }
      rows++;
      return head + group(v) + tail;
    });
  // Итоговая строка - размер всего каталога. Сумма по категориям меньше на
  // разницу неклассифицированных, поэтому берём её из fc-index, а не сложением.
  h = h.replace(/(<strong>Total product pages<\/strong><\/td><td[^>]*><strong>)[\d,]+(<\/strong>)/,
    (m, a, b) => a + T + b);
  if (h !== before) {
    if (!DRY) fs.writeFileSync(f, h);
    changed++;
    console.log('  data-licensing/index.html   строк таблицы: ' + rows + ', итог: ' + T);
  } else console.log('  data-licensing/index.html   уже верно');
  if (unknown.length) console.log('    нет счётчика для: ' + [...new Set(unknown)].join(', '));
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'изменено файлов: ' + changed));
