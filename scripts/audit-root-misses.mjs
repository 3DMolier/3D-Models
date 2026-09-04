// audit-root-misses.mjs — РАСЧЁТ. Сколько карточек одного корня остались врозь.
//
// Проход по Root ID требовал совпадения ДВУХ условий: общий корень И одинаковый
// набор слов в названии. Второе условие лишнее: корень уже доказывает общее
// происхождение, а детали отсекаются признаком is_split из отчёта.
//
// Из-за этого четыре карточки Eurofighter Typhoon (корень TDzUMGVGKT) остались
// четырьмя: наборы слов у них разные - «jet», «jet weaponry», «fighter»,
// «fighter multirole».
//
// Скрипт считает, что изменится, если убрать требование по названию, и
// показывает самые крупные группы для глазной проверки.
//
// Запуск:  node scripts/audit-root-misses.mjs [--show 15]

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const shi = process.argv.indexOf('--show');
const SHOW = shi !== -1 ? +process.argv[shi + 1] || 15 : 15;

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

const live = new Map();               // pid -> слаг живой карточки
for (const d of fs.readdirSync(MODELS)) {
  const m = d.match(/(\d+)$/);
  if (!m || isStub(d)) continue;
  live.set(m[1], d);
}
console.log('живых карточек: ' + live.size);

const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));
const COLL = /\bcollections?\b/i;

// Группируем ТОЛЬКО по корню. Детали и наборы исключаем - у них свои правила.
const byRoot = new Map();
for (const r of rep) {
  if (!r.root || r.split) continue;
  if (COLL.test(r.name)) continue;
  const slug = live.get(String(r.pid));
  if (!slug) continue;
  if (!byRoot.has(r.root)) byRoot.set(r.root, []);
  byRoot.get(r.root).push({ ...r, slug });
}

const miss = [...byRoot.entries()].filter(([, v]) => v.length > 1);
const extra = miss.reduce((s, [, v]) => s + v.length - 1, 0);

console.log('\nкорней, где живут 2+ карточки: ' + miss.length);
console.log('карточек в них:                ' + miss.reduce((s, [, v]) => s + v.length, 0));
console.log('свернулось бы дополнительно:   ' + extra);
console.log('каталог стал бы:               ' + (live.size - extra));

const hist = {};
for (const [, v] of miss) { const b = v.length <= 3 ? '2-3' : v.length <= 6 ? '4-6' : v.length <= 12 ? '7-12' : '13+'; hist[b] = (hist[b] || 0) + 1; }
console.log('размеры: ' + Object.entries(hist).sort().map(([k, x]) => k + ': ' + x).join(', '));

console.log('\n' + '='.repeat(70));
console.log('КРУПНЕЙШИЕ ГРУППЫ - проверить глазами');
console.log('='.repeat(70));
for (const [rid, v] of miss.sort((a, b) => b[1].length - a[1].length).slice(0, SHOW)) {
  console.log('\n[' + v.length + '] корень ' + rid + '   («' + (v[0].rootName || '-') + '»)');
  for (const x of v.slice(0, 10)) {
    console.log('    $' + String(x.price).padStart(5) + '  ' + x.name.slice(0, 62) + '  [' + x.year + ']');
  }
  if (v.length > 10) console.log('    ... и ещё ' + (v.length - 10));
}

// Контрольный пример из жалобы
const ef = miss.find(([r]) => r === 'TDzUMGVGKT');
if (ef) {
  console.log('\n=== Eurofighter Typhoon ===');
  ef[1].forEach(x => console.log('    $' + x.price + '  ' + x.name));
}
