/*
 * sync-counters.mjs - счётчики моделей из одного источника.
 *
 * ЧТО БЫЛО. У категории Vehicles на сайте было ТРИ разных числа сразу:
 *   4 123  плитка на главной
 *   3 847  «Total Models» на самой странице категории
 *   3 746  сколько моделей в ней на самом деле
 * Ни одно из них не считалось из живых данных: цифры были вписаны когда-то и
 * с тех пор жили своей жизнью, а состав категорий с тех пор менялся не раз.
 *
 * ЧТО ТЕПЕРЬ. Все счётчики берутся из data/category-counts.json, который
 * собирает build-taxonomy.mjs из единого источника категорий. Порядок такой:
 *     node scripts/build-taxonomy.mjs      (пересчитает category-counts.json)
 *     node scripts/sync-counters.mjs
 *
 * СЛОВАРЬ ЧИСЕЛ. На сайте живут разные величины, и путать их нельзя:
 *   90,000+ listings on TurboSquid  - позиции в магазине, включая версии;
 *   54 077 model pages              - наши страницы, по одной на товар;
 *   3 746 models in Vehicles        - модели внутри категории.
 * Подписи у счётчиков сделаны явными, чтобы одно не читалось как другое.
 *
 * Запуск:  node scripts/sync-counters.mjs --dry
 *          node scripts/sync-counters.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, nameOf, escName } from './lib/taxonomy.mjs';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const fmt = n => Number(n).toLocaleString('en-US');

const counts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8'));
const TOTAL = counts.total;
console.log('всего страниц моделей: ' + fmt(TOTAL) + ', категорий: ' + Object.keys(counts.counts).length);

// ── 1. страницы категорий: «Total Models» ──
let catPages = 0;
for (const c of CATEGORIES) {
  const n = counts.counts[c.slug];
  if (n === undefined) continue;
  const dirs = [path.join(ROOT, 'categories', c.slug)];
  const pd = path.join(ROOT, 'categories', c.slug, 'page');
  if (fs.existsSync(pd)) for (const p of fs.readdirSync(pd)) dirs.push(path.join(pd, p));
  for (const d of dirs) {
    const file = path.join(d, 'index.html');
    if (!fs.existsSync(file)) continue;
    let h = fs.readFileSync(file, 'utf8');
    const before = h;
    // «Total Models» - подпись неточная: речь о страницах моделей этой
    // категории, а не о позициях в магазине.
    h = h.replace(/(<div class="cat-stat-num">)[\d,]+(<\/div>\s*<div class="cat-stat-label">)Total Models(<\/div>)/,
      (x, a, b, c2) => a + fmt(n) + b + 'Model pages' + c2);
    if (h === before) continue;
    catPages++;
    if (!DRY) fs.writeFileSync(file, h);
  }
}
console.log('страниц категорий со счётчиком поправлено: ' + catPages);

// ── 2. плитки на главной ──
let tiles = 0;
for (const rel of ['index.html', 'preview/home/index.html']) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  h = h.replace(/(<span class="tile-name">)([^<]*)(<\/span>\s*<span class="tile-n">)([^<]*)(<\/span>)/g,
    (x, a, label, b, cur, c2) => {
      // Плитка подписана человеческим именем категории - находим её по имени.
      const plain = label.replace(/&amp;/g, '&').trim();
      const cat = CATEGORIES.find(k => nameOf(k.slug) === plain
        || (k.menu_short && k.menu_short === plain));
      if (!cat) return x;
      const n = counts.counts[cat.slug];
      if (n === undefined) return x;
      const want = fmt(n);
      if (cur === want) return x;
      tiles++;
      return a + label + b + want + c2;
    });
  if (h === before) continue;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('плиток на главной поправлено: ' + tiles);

// ── 3. общее число страниц моделей ──
// Единая формулировка: «54,077 model pages», а не «models» - последнее путается
// с позициями магазина, которых 90 000+.
let totals = 0;
const pages = [];
(function walk(rel, d) {
  if (d > 3) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'models' || it.name === 'node_modules' || it.name === 'partials' || it.name.startsWith('.')) continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) walk(nx, d + 1);
    else if (it.name === 'index.html') pages.push(nx);
  }
})('', 0);

const OLD_TOTALS = [/\b54,079\b/g, /\b54,082\b/g, /\b54,077\b/g];
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  const before = h;
  for (const re of OLD_TOTALS) h = h.replace(re, fmt(TOTAL));
  if (h === before) continue;
  totals++;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('страниц с общим числом поправлено: ' + totals);

/*
 * ── 4. числа в чипах фильтра на /catalog/ ───────────────────────────────────
 *
 * Чипы категорий лежат в разметке каталога СТАТИЧЕСКИ, вместе с числом:
 * `<button data-cat="aircraft">Aircraft <span class="ftag-n">1,499</span>`.
 * Поставились они один раз, при сборке страницы, и с тех пор не двигались.
 *
 * 14.09.2026 основатель прислал снимок: чип обещает «Aircraft 1 499», а выдача
 * по нему - «841 of 37 683». Разошлись ВСЕ 26 категорий: после склейки каталог
 * ужался с 54 519 до 37 683, а числа на кнопках остались от прежнего.
 *
 * Сама выдача при этом верна - единый источник и индекс каталога сходятся до
 * единицы. Врало только обещание на кнопке.
 */
let chips = 0;
{
  const file = path.join(ROOT, 'catalog', 'index.html');
  if (fs.existsSync(file)) {
    const before = fs.readFileSync(file, 'utf8');
    let h = before;
    for (const [slug, n] of Object.entries(counts.counts)) {
      // Правим ТОЛЬКО число внутри своего чипа: искать его по значению нельзя,
      // одно и то же число встречается на странице в разных ролях.
      const re = new RegExp('(data-cat="' + slug + '"[^>]*>[^<]*<span class="ftag-n">)[\\d,]+', 'g');
      h = h.replace(re, (m, head) => head + fmt(n));
    }
    const nums = s => [...s.matchAll(/<span class="ftag-n">([\d,]+)/g)].map(m => m[1]);
    const a = nums(before), b = nums(h);
    chips = a.filter((v, i) => v !== b[i]).length;
    if (chips && !DRY) fs.writeFileSync(file, h);
  }
}
console.log('чипов категорий в каталоге поправлено: ' + chips);
if (DRY) console.log('(--dry, ничего не записано)');
