// resync-card-categories.mjs — привести категорию НА КАРТОЧКЕ к той же
// классификации, по которой построены хабы категорий.
//
// Зачем. 12.08 категории пересобрали по реальным данным TurboSquid (cat1/cat2 из
// отчёта продаж) вместо угадывания слов в названии. Пересобрали хабы, browse и
// сайтмапы — но не сами карточки. В итоге два источника разошлись:
//
//   карточки говорят «Other» про 12 268 моделей, хабы — про 1 747
//   карточки: медицина 1 998, хабы: 2 728;  транспорт 3 177 против 3 857
//
// Хуже того, 1 388 карточек ведут строку «Category» на /categories/weapons-tools/ —
// а это страница-уведомление о разделении, на ней ноль ссылок на модели. Посетитель
// с карточки попадает в тупик.
//
// Внутри одной карточки категория тоже расходилась сама с собой: у 150mm Earth Drill
// Bits характеристики говорили «Other», крошки — «Weapons & Tools», разметка товара —
// снова «Other».
//
// Что меняем на карточке (пять мест, все по одной вычисленной категории):
//   1. строка «Category» в таблице характеристик
//   2. видимые хлебные крошки (mp-bc-link)
//   3. кнопка «Browse <категория> Models»
//   4. поле category в Product / ProductGroup
//   5. позиция 2 в BreadcrumbList
//
// Меню категорий в шапке НЕ трогаем: там ссылки на все категории сразу.
//
// Запуск:  node scripts/resync-card-categories.mjs --dry
//          node scripts/resync-card-categories.mjs --dry --sample <slug>
//          node scripts/resync-card-categories.mjs

import fs from 'node:fs';
import path from 'node:path';
import { anchorClassify } from './anchors25.mjs';
import { classifyByReport } from './category-map.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');
const CATEGORIES = path.join(ROOT, 'categories');
const DRY = process.argv.includes('--dry');
const si = process.argv.indexOf('--sample');
const SAMPLE = si !== -1 ? process.argv[si + 1] : null;

// ── классификатор: ровно тот же код, что в build-category-hubs.mjs ──
const clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
const dispOf = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
dispOf['other'] = 'Other';
const keywordClassify = name => {
  const t = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [s, d, k] of CATS) if (k.find(x => t.has(x))) return s;
  return anchorClassify(name) || 'other';
};
const classify = (name, id) => classifyByReport(id, name) || keywordClassify(name);

// Категория обязана существовать как страница, иначе мы заменим тупик на другой тупик.
const liveCat = new Set(Object.keys(dispOf).filter(s =>
  fs.existsSync(path.join(CATEGORIES, s, 'index.html'))));
for (const s of Object.keys(dispOf)) if (!liveCat.has(s)) console.log('ВНИМАНИЕ: нет страницы /categories/' + s + '/');

// ── имена моделей из каталога, тот же источник, что у хабов ──
const nameOf = new Map();
for (const f of fs.readdirSync(DATA).filter(f => /^fc-chunk-\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  for (let j = 0; j < d.i.length; j++) nameOf.set(String(d.i[j]), d.n[j]);
}
console.log('имён в каталоге: ' + nameOf.size);

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escJson = s => JSON.stringify(String(s)).slice(1, -1);

const HEAD = 400;
const headBuf = Buffer.alloc(HEAD);
const isStub = file => {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (e) { return true; }
  try { const n = fs.readSync(fd, headBuf, 0, HEAD, 0); return /http-equiv="refresh"/.test(headBuf.slice(0, n).toString('utf8')); }
  finally { fs.closeSync(fd); }
};

let seen = 0, live = 0, touched = 0, noId = 0, noName = 0, skippedNoCatPage = 0;
const before = {}, after = {}, moves = {};
const parts = { spec: 0, crumbHtml: 0, browse: 0, schema: 0, crumbJson: 0 };
const samples = [];

for (const slug of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, slug, 'index.html');
  if (++seen % 20000 === 0) console.log('  ' + seen + '  изменено ' + touched);
  if (isStub(file)) continue;
  live++;

  const idm = slug.match(/(\d+)$/);
  if (!idm) { noId++; continue; }
  const id = idm[1];

  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }

  // Имя берём из каталога; если модели там нет — из H1 самой страницы.
  let name = nameOf.get(id);
  if (!name) {
    const m = h.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/);
    name = m ? m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim() : null;
    if (!name) { noName++; continue; }
  }

  const cat = classify(name, id);
  if (!liveCat.has(cat)) { skippedNoCatPage++; continue; }
  const disp = dispOf[cat];
  const dispHtml = escHtml(disp);

  // что стояло раньше — по строке характеристик, это основной видимый источник
  const cur = (h.match(/<th[^>]*>\s*Category\s*<\/th>\s*<td[^>]*>\s*<a href="\/categories\/([^"\/]+)\//i) || [])[1] || '(нет)';
  before[cur] = (before[cur] || 0) + 1;
  after[cat] = (after[cat] || 0) + 1;

  let out = h;
  const bump = k => { parts[k]++; };

  // 1. строка характеристик
  out = out.replace(/(<th[^>]*>\s*Category\s*<\/th>\s*<td[^>]*>\s*)<a href="\/categories\/[^"]*"[^>]*>[^<]*<\/a>/i,
    (m, head) => { bump('spec'); return head + '<a href="/categories/' + cat + '/">' + dispHtml + '</a>'; });

  // 2. видимые хлебные крошки
  out = out.replace(/<a href="\/categories\/[^"]*" class="mp-bc-link">[^<]*<\/a>/,
    () => { bump('crumbHtml'); return '<a href="/categories/' + cat + '/" class="mp-bc-link">' + dispHtml + '</a>'; });

  // 3. кнопка «Browse ... Models»
  out = out.replace(/<a href="\/categories\/[^"]*" class="btn-ghost mp-btn-browse">\s*Browse[^<]*<\/a>/,
    () => { bump('browse'); return '<a href="/categories/' + cat + '/" class="btn-ghost mp-btn-browse">\nBrowse ' + dispHtml + ' Models\n</a>'; });

  // 4. поле category в разметке товара. В JSON пишем обычный «&», а не мнемонику:
  //    в JSON-LD «&amp;» так и читается — «Animals &amp; Creatures».
  out = out.replace(/"category"\s*:\s*"[^"]*"/g,
    () => { bump('schema'); return '"category":"' + escJson(disp) + '"'; });

  // 5. вторая позиция в BreadcrumbList
  out = out.replace(/(\{"@type":"ListItem","position":2,"name":")[^"]*(","item":")[^"]*(")/,
    (m, a, b, c) => { bump('crumbJson'); return a + escJson(disp) + b + 'https://3dmolierstudio.com/categories/' + cat + '/' + c; });

  if (out === h) continue;

  // ── преграды ──
  if (!out.includes('<a href="/categories/other/" role="menuitem"')) { console.log('СТОП: меню на ' + slug); process.exit(1); }
  for (const blk of out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(blk.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { console.log('СТОП: битый JSON-LD на ' + slug); process.exit(1); }
  }
  if ((out.match(/<h1 class="mp-h1">/g) || []).length !== 1) { console.log('СТОП: H1 на ' + slug); process.exit(1); }

  if (cur !== cat) moves[cur + ' -> ' + cat] = (moves[cur + ' -> ' + cat] || 0) + 1;
  if (samples.length < 6 && cur !== cat && (!SAMPLE || slug === SAMPLE)) samples.push({ slug, name, cur, cat });

  if (!DRY) fs.writeFileSync(file, out);
  touched++;
}

console.log('\nпапок просмотрено: ' + seen);
console.log('живых карточек:    ' + live);
console.log('изменено:          ' + touched + (DRY ? '  (--dry)' : ''));
console.log('  строк характеристик: ' + parts.spec);
console.log('  крошек в разметке:   ' + parts.crumbHtml);
console.log('  кнопок Browse:       ' + parts.browse);
console.log('  category в схеме:    ' + parts.schema);
console.log('  BreadcrumbList:      ' + parts.crumbJson);
if (noId) console.log('  без id в слаге: ' + noId);
if (noName) console.log('  без имени: ' + noName);
if (skippedNoCatPage) console.log('  пропущено (нет страницы категории): ' + skippedNoCatPage);

console.log('\nсамые частые переносы:');
for (const [k, v] of Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ' + String(v).padStart(6) + '  ' + k);

console.log('\nстало по категориям:');
for (const [k, v] of Object.entries(after).sort((a, b) => b[1] - a[1])) console.log('  ' + String(v).padStart(6) + '  ' + k);

console.log('\nпримеры:');
for (const s of samples) console.log('  ' + s.cur + ' -> ' + s.cat + '   ' + s.name.slice(0, 60));
