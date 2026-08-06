// reclassify-other.mjs - переносит карточки из мусорной категории `other`
// в реальные, используя весовой добор anchors25.mjs.
//
// Зачем: 26.7% моделей (23 183) лежали в `other`. Такие страницы не ранжируются
// по категорийным запросам, их крошки и перелинковка обесценены.
//
// ВАЖНО про аккуратность: ссылка /categories/other/ встречается на странице 8 раз,
// и ДВА из них - это пункты НАВИГАЦИОННОГО МЕНЮ (оно одинаково на всех 87k страниц).
// Слепая замена по href сломала бы меню на всём сайте. Поэтому каждый элемент
// заменяется по своему классу, а меню не трогается.
//
// Категория страницы определяется по JSON-LD хлебных крошек (position:2) -
// это единственный надёжный признак собственной категории карточки.
//
//   node scripts/reclassify-other.mjs --dry   (только посчитать)
//   node scripts/reclassify-other.mjs         (переписать)
import fs from 'node:fs';
import path from 'node:path';
import { anchorClassify } from './anchors25.mjs';
import { portedClassify } from './anchors-ported.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

const clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
const disp = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
disp['other'] = 'Other';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dirs = fs.readdirSync(MODELS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(MODELS, d.name, 'index.html')))
  .map(d => d.name);

let scanned = 0, inOther = 0, changed = 0, skipped = 0;
const moves = {};
const samples = [];

for (const d of dirs) {
  scanned++;
  const file = path.join(MODELS, d, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  // СОБСТВЕННАЯ категория страницы - только из крошек JSON-LD
  const crumb = html.match(/"@type":"ListItem","position":2,"name":"([^"]*)","item":"https:\/\/3dmolierstudio\.com\/categories\/([a-z0-9-]+)\/"/);
  if (!crumb || crumb[2] !== 'other') continue;
  inOther++;

  const t = html.match(/<title>([^<]+?)\s+3D Model/i);
  const name = t ? t[1] : d.replace(/-\d+$/, '').replace(/-/g, ' ');
  // Сначала свой словарь сайта, затем перенесённый из кликера CGTrader.
  // Порядок важен: anchors25 вылизан под наш каталог и точнее, перенесённый
  // добирает то, о чём он молчит.
  const cat = anchorClassify(name) || portedClassify(name);
  if (!cat || cat === 'other') { skipped++; continue; }
  const label = disp[cat] || cat;
  const before = html;

  // 1. JSON-LD крошек
  html = html.replace(/("@type":"ListItem","position":2,"name":")[^"]*(","item":"https:\/\/3dmolierstudio\.com\/categories\/)other(\/")/,
    `$1${esc(label)}$2${cat}$3`);
  // 2. видимая крошка
  html = html.replace(/<a href="\/categories\/other\/" class="mp-bc-link">[^<]*<\/a>/,
    `<a href="/categories/${cat}/" class="mp-bc-link">${esc(label)}</a>`);
  // 3. чип категории
  html = html.replace(/<a href="\/categories\/other\/" class="chip chip-teal chip--sm">[^<]*<\/a>/,
    `<a href="/categories/${cat}/" class="chip chip-teal chip--sm">${esc(label)}</a>`);
  // 4. кнопка "Browse ... Models"
  html = html.replace(/<a href="\/categories\/other\/" class="btn-ghost mp-btn-browse">\s*Browse Other Models/,
    `<a href="/categories/${cat}/" class="btn-ghost mp-btn-browse">\n            Browse ${esc(label)} Models`);
  // 5. строка "Category" в характеристиках
  html = html.replace(/<a href="\/categories\/other\/" class="mp-cat-link">[^<]*<\/a>/,
    `<a href="/categories/${cat}/" class="mp-cat-link">${esc(label)}</a>`);
  // 6. ссылка возврата внизу
  html = html.replace(/<a href="\/categories\/other\/" class="nav-link mp-back-link">&#8592; All Other Models/,
    `<a href="/categories/${cat}/" class="nav-link mp-back-link">&#8592; All ${esc(label)} Models`);
  // 7. подпись на заглушке превью
  html = html.replace(/<span class="mp-placeholder-cat">Other<\/span>/, `<span class="mp-placeholder-cat">${esc(label)}</span>`);

  // страховка: меню обязано остаться нетронутым
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) {
    console.log('  ОСТАНОВКА: пострадало меню на ' + d);
    process.exit(1);
  }

  if (html === before) continue;
  if (!DRY) fs.writeFileSync(file, html, 'utf8');
  changed++;
  moves[cat] = (moves[cat] || 0) + 1;
  if (samples.length < 12 && Math.random() < 0.002) samples.push(name + '  ->  ' + label);
}

console.log('=== ПЕРЕКЛАССИФИКАЦИЯ ' + (DRY ? '(DRY-RUN)' : '') + ' ===');
console.log('  просмотрено карточек: ' + scanned);
console.log('  было в other:         ' + inOther + '  (' + (inOther / scanned * 100).toFixed(1) + '%)');
console.log('  перенесено:           ' + changed);
console.log('  осталось в other:     ' + (inOther - changed) + '  (' + ((inOther - changed) / scanned * 100).toFixed(1) + '%)');
console.log('\n--- куда перенесено ---');
Object.entries(moves).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));
if (samples.length) { console.log('\n--- примеры ---'); samples.forEach(s => console.log('  ' + s)); }
