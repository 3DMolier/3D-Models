/*
 * tune-catalog-page.mjs - страница /catalog/ по замечаниям к ней.
 *
 * Скрипт идемпотентный: каждый шаг проверяет, не сделан ли он уже.
 *
 * ПЕРВЫЙ ЗАХОД (правки 12-12.7 прошлого списка)
 *   Убрана строка «Showing the 48 best-selling models», убран ряд «Popular»,
 *   убран фильтр по сертификату, категории и цена разведены по строкам,
 *   к категориям дописаны числа из data/category-counts.json.
 *
 * ВТОРОЙ ЗАХОД (пункты 6-12 нового списка)
 *   6.  После сетки в разметке лежали 23 «скелета» загрузки - div.sk. Скрипт их
 *       никогда не убирал, потому что они находятся СНАРУЖИ #model-grid, а
 *       перерисовывается только его содержимое. Человек видел под выдачей
 *       полосу пустых серых прямоугольников. Удаляем из разметки: сетка и так
 *       приходит заполненной 48 карточками, а на время загрузки есть #fc-loading.
 *   7.  Ссылка «Browse all 54,077 models page by page» убрана со страницы.
 *       Страницы /browse/ остаются в карте сайта - робот дойдёт до них оттуда.
 *   8.  В нижнем блоке стояло «Browse all 54,077 3D models or full catalog» -
 *       две ссылки, обе на /catalog/, то есть на эту же страницу. Убрано.
 *   9.  Поле поиска сделано заметным: крупнее, с рамкой и подписью.
 *   10. Число 54 077 повторялось на странице пять раз. Оставляем два: в
 *       заголовке и в живом счётчике выдачи.
 *   11. Двадцать шесть категорий стеной заменены на восемь популярных в одну
 *       строку и кнопку «View all», которая раскрывает остальные.
 *   12. Ряд цен прижат влево.
 *
 * Запуск:  node scripts/tune-catalog-page.mjs --dry
 *          node scripts/tune-catalog-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const FILE = path.join(ROOT, 'catalog', 'index.html');

const countsFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8'));
const counts = countsFile.counts;
const nf = n => Number(n).toLocaleString('en-US');

// Восемь самых крупных категорий - их и показываем в первой строке.
const POPULAR = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);

let h = fs.readFileSync(FILE, 'utf8');
const before = h;
const done = [];
const step = (name, fn) => { const b = h; h = fn(h); if (h !== b) done.push(name); };

// ── первый заход: ряд Popular, фильтр Cert, строка про 48 карточек ──
step('убран старый ряд Popular', s =>
  s.replace(/<div class="popular-searches" id="popular-searches">[\s\S]*?<\/div>\s*(?=<div class="search-row">)/, ''));
step('убран фильтр Cert', s =>
  s.replace(/<div class="ftag-sep"><\/div><span class="fb-label">Cert:<\/span>(?:<button class="ftag" data-cert="\d">[^<]*<\/button>)+/, ''));
step('убрана строка про 48 карточек', s =>
  s.replace(/<p class="cat-desc"[^>]*>Showing the 48 best-selling models\.\s*<a href="\/browse\/1\/">[^<]*<\/a>\s*<\/p>/, ''));

// ── числа рядом с категориями ──
step('к категориям добавлены числа', s =>
  s.replace(/(<button class="ftag" data-cat="([a-z0-9-]+)">)([^<]*)(<\/button>)/g,
    (x, a, slug, label, b) => counts[slug]
      ? a + label + ' <span class="ftag-n">' + nf(counts[slug]) + '</span>' + b
      : x));

// Числа у уже проставленных чипов тоже обновляем: после склейки карточек
// категории худеют, а вписанное однажды число остаётся прежним. Валидатор
// ловит это как расхождение с data/category-counts.json.
step('числа у категорий обновлены', s =>
  s.replace(/(data-cat="([a-z0-9-]+)"[^>]*>[^<]*<span class="ftag-n">)([\d,]+)(<\/span>)/g,
    (x, a, slug, cur, b) => counts[slug] && cur !== nf(counts[slug]) ? a + nf(counts[slug]) + b : x));

// ── строки фильтров ──
step('строка категорий', s =>
  // Обернуть можно только один раз: без этой проверки повторный запуск ставил
  // второй <div class="fb-row"> вокруг уже обёрнутой строки.
  /<div class="fb-row"><span class="fb-label">Category:/.test(s) ? s
    : s.replace(/<span class="fb-label">Category:<\/span>/, '<div class="fb-row"><span class="fb-label">Category:</span>'));
step('строка цены', s =>
  s.replace(/<div class="ftag-sep"><\/div><span class="fb-label">Price:<\/span>/,
    '</div><div class="fb-row fb-row--price"><span class="fb-label">Price:</span>'));
step('ряду цен свой класс', s =>
  s.replace(/<div class="fb-row"><span class="fb-label">Price:/, '<div class="fb-row fb-row--price"><span class="fb-label">Price:'));
step('закрыта строка цены', s =>
  s.replace(/(<button class="ftag" data-price="u999">[^<]*<\/button>)(<div class="ftag-sep"><\/div>)?(?!<\/div>)/, (x, btn) => btn + '</div>'));

// ── 6. скелеты загрузки ──
step('убраны скелеты загрузки', s => {
  const n = (s.match(/<div class="sk">/g) || []).length;
  if (!n) return s;
  console.log('  скелетов найдено: ' + n);
  return s.replace(/<div class="sk">[\s\S]*?<div class="sk-line short"><\/div><\/div><\/div>/g, '');
});

// ── 7. ссылка на постраничный обход ──
step('убрана ссылка на постраничный обход', s =>
  s.replace(/<p class="fc-browse-all">[\s\S]*?<\/p>/, ''));

// ── 8. две ссылки на саму себя внизу ──
step('убраны две ссылки на эту же страницу', s =>
  s.replace(/<p style="margin-top:1rem;font-size:0\.9rem;">Browse all <a href="\/catalog\/">[^<]*<\/a> or <a href="\/catalog\/">[^<]*<\/a>\.<\/p>/, ''));

// ── 10. число 54 077 лишний раз ──
step('подзаголовок без повтора числа', s =>
  s.replace(/<p class="hero-sub">[^<]*<\/p>/,
    '<p class="hero-sub">Every model we publish on TurboSquid, in one searchable list. Filter by category and price, or search by name.</p>'));
step('плитка с числом моделей убрана', s =>
  s.replace(/<div class="hs"><div class="v">[\d,]+<\/div><div class="l">Models<\/div><\/div>/, ''));
step('подсказка в поле поиска без числа', s =>
  s.replace(/placeholder="Search [\d,]+ models…"/, 'placeholder="Search by name, brand or keyword…"'));

// ── 9. заметное поле поиска ──
step('поле поиска с подписью', s => {
  if (/fc-search-label/.test(s)) return s;
  return s.replace(/<div class="search-row">/,
    '<div class="search-row search-row--big"><label class="fc-search-label" for="q">Search the catalog</label>');
});

// ── 11. популярные категории в одну строку ──
step('категории свёрнуты до популярных', s => {
  if (/ftag--more/.test(s)) return s;
  let out = s.replace(/(<button class="ftag" data-cat="([a-z0-9-]+)")/g,
    (x, a, slug) => POPULAR.includes(slug) ? a : a.replace('class="ftag"', 'class="ftag ftag--rest" hidden'));
  // кнопка раскрытия - в конце ряда категорий
  // Кнопку ставим перед закрытием ряда категорий. Ряд цен в разметке может
  // называться и просто fb-row - так его назвал первый заход скрипта.
  out = out.replace(/(<\/div>)(<div class="fb-row[^"]*"><span class="fb-label">Price:)/,
    (x, close, tail) => '<button id="cat-more" class="ftag ftag--more" aria-expanded="false">View all 26 &#8595;</button>' + close + tail);
  return out;
});

if (h === before) console.log('изменений нет');
else {
  if (!DRY) fs.writeFileSync(FILE, h);
  done.forEach(d => console.log('  ' + d));
  console.log(DRY ? '(--dry, ничего не записано)' : 'записано: catalog/index.html');
}
