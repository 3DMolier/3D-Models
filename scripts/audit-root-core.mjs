// audit-root-core.mjs — РАСЧЁТ. Объединение по «ядру имени» внутри корня.
//
// Критерий основателя: если предмет тот же, а отличие - добавка или иное
// название, это одна карточка. Если предмет другой - разные.
//   «Eurofighter Typhoon Jet» и «… Jet with Weaponry» - тот же самолёт.
//   «Devil Emoji» и «Angry Emoji» - разные предметы.
//
// Как отличить измеримо. Смотрим слова, общие для ВСЕХ товаров корня.
// Если среди них есть РЕДКОЕ слово - это имя конкретного объекта:
//   eurofighter встречается у 14 товаров каталога, kamaz у немногих.
// Если общее слово частое - это категория, а не предмет:
//   emoji, anatomy, hat объединяют разные вещи одного вида.
//
// Порог редкости подобран по контрольным случаям и показан в выводе.
//
// Запуск:  node scripts/audit-root-core.mjs [--df 30] [--show 12]

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const dfi = process.argv.indexOf('--df');
const MAX_DF = dfi !== -1 ? +process.argv[dfi + 1] : 30;
const shi = process.argv.indexOf('--show');
const SHOW = shi !== -1 ? +process.argv[shi + 1] || 12 : 12;

const HEAD = 400;
const buf = Buffer.alloc(HEAD);
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}
const live = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const m = d.match(/(\d+)$/);
  if (m && !isStub(d)) live.set(m[1], d);
}

const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));

// Слова-исполнения в ядро не считаем: они и так означают вариант, а не предмет.
const MARKS = new Set(['rigged', 'rigid', 'animated', 'simplified', 'simple', 'lowpoly', 'low', 'poly',
  'for', 'maya', 'cinema', 'c4d', 'blender', 'max', 'unity', 'unreal', 'modo', 'lightwave', 'sketchup',
  'model', 'models', 'the', 'and', 'with', 'of', 'set', 'new', 'old', 'pose', 'fur',
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'grey', 'gray', 'silver', 'gold', 'brown']);
const toks = n => [...new Set(String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  .split(' ').filter(t => t.length > 2 && !MARKS.has(t)))];

// частота слова по всему каталогу
const df = new Map();
for (const r of rep) for (const t of toks(r.name)) df.set(t, (df.get(t) || 0) + 1);

const COLL = /\bcollections?\b/i;
const byRoot = new Map();
for (const r of rep) {
  if (!r.root || r.split || COLL.test(r.name)) continue;
  const slug = live.get(String(r.pid));
  if (!slug) continue;
  if (!byRoot.has(r.root)) byRoot.set(r.root, []);
  byRoot.get(r.root).push({ ...r, slug, t: toks(r.name) });
}

const merge = [], skip = [];
for (const [rid, v] of byRoot) {
  if (v.length < 2) continue;
  // слова, общие для ВСЕХ товаров корня
  let core = new Set(v[0].t);
  for (const x of v.slice(1)) core = new Set([...core].filter(t => x.t.includes(t)));
  const rare = [...core].filter(t => (df.get(t) || 0) <= MAX_DF)
    .sort((a, b) => (df.get(a) || 0) - (df.get(b) || 0));
  (rare.length ? merge : skip).push({ rid, v, rare, core: [...core] });
}

const extra = merge.reduce((s, g) => s + g.v.length - 1, 0);
console.log('порог редкости: слово встречается не чаще чем у ' + MAX_DF + ' товаров');
console.log('живых карточек: ' + live.size);
console.log('\nкорней с 2+ живыми карточками: ' + (merge.length + skip.length));
console.log('  СЛИВАЕМ (есть редкое общее слово): ' + merge.length + '  -> свернётся ' + extra);
console.log('  оставляем врозь:                   ' + skip.length);
console.log('каталог станет: ' + (live.size - extra));

console.log('\n' + '='.repeat(72));
console.log('СЛИВАЕМ - проверить, что это правда один предмет');
console.log('='.repeat(72));
for (const g of merge.sort((a, b) => b.v.length - a.v.length).slice(0, SHOW)) {
  console.log('\n[' + g.v.length + '] ядро: ' + g.rare.map(t => t + '(' + df.get(t) + ')').join(', '));
  for (const x of g.v.slice(0, 6)) console.log('    $' + String(x.price).padStart(4) + '  ' + x.name.slice(0, 60));
  if (g.v.length > 6) console.log('    ... и ещё ' + (g.v.length - 6));
}

console.log('\n' + '='.repeat(72));
console.log('ОСТАВЛЯЕМ ВРОЗЬ - проверить, что это правда разные предметы');
console.log('='.repeat(72));
for (const g of skip.sort((a, b) => b.v.length - a.v.length).slice(0, 6)) {
  console.log('\n[' + g.v.length + '] общие слова: ' + (g.core.map(t => t + '(' + df.get(t) + ')').join(', ') || 'нет'));
  for (const x of g.v.slice(0, 5)) console.log('    $' + String(x.price).padStart(4) + '  ' + x.name.slice(0, 60));
}

for (const key of ['TDzUMGVGKT', 'M3rvnnzPSk']) {
  const g = merge.find(x => x.rid === key) || skip.find(x => x.rid === key);
  if (g) {
    console.log('\n=== контроль ' + key + ' -> ' + (merge.includes(g) ? 'СЛИВАЕМ' : 'врозь') + ' ===');
    g.v.forEach(x => console.log('    $' + x.price + '  ' + x.name));
  }
}
