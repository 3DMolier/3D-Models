// analyze-root-merge.mjs — РАСЧЁТ, НИЧЕГО НЕ МЕНЯЕТ.
//
// Объединение по Root ID из отчёта «Product Report».
//
// Что даёт Root ID: доказательство, что модели сделаны из одного исходника.
// Это снимает прежнее ограничение — раньше «Mercedes-Benz Van 2019» и
// «2019 Mercedes-Benz Van» нельзя было свести, потому что имена разные.
//
// Чего Root ID НЕ даёт: внутри одного корня законно лежат и сам предмет, и его
// детали, и отдельные производные товары. В корне «Gas Pump» вместе с колонками
// 2015 года лежат сопла 2023-го; в корне «Mini cross motorcyclist child character»
// — 48 позиций: шлемы, очки, ботинки и сами модели райдера. Свалить их в одну
// карточку нельзя.
//
// Поэтому решение принимается в два шага:
//   1. Детали (is_split) выносятся из объединения. Они остаются своими карточками
//      и связываются с главной логически — блоком «детали этой модели».
//   2. Остальное сводится по «отпечатку» имени: набор слов без маркеров исполнения
//      (цвет, оснастка, софт, упрощение, поза, год). Набор, а не строка — поэтому
//      перестановка слов больше не мешает.
//
// Признаки берём из отчёта, а не угадываем по названию: is_color_texture_variation,
// is_simplified, is_pose, is_animation, is_split, is_multimodel.
//
// Запуск:  node scripts/analyze-root-merge.mjs [--show 5]

import fs from 'node:fs';
import path from 'node:path';

const SP = 'C:/Users/MSI-PC/AppData/Local/Temp/claude/D--Clode-Work-Folder/0f828965-b789-4834-abc7-1381fac7594a/scratchpad';
const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const shi = process.argv.indexOf('--show');
const SHOW = shi !== -1 ? +process.argv[shi + 1] || 5 : 5;

const rows = fs.readFileSync(path.join(SP, 'products.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);

// ── что уже есть на сайте (настоящие карточки, не перенаправления) ──
const HEAD = 400, buf = Buffer.alloc(HEAD);
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, dir, 'index.html'), 'r'); } catch (e) { return false; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}
const pidOnSite = new Map();          // product id -> слаг живой карточки
for (const d of fs.readdirSync(MODELS)) {
  const m = d.match(/(\d+)$/);
  if (!m || isStub(d)) continue;
  pidOnSite.set(m[1], d);
}

// ── маркеры исполнения: их снимаем, чтобы получить «отпечаток» предмета ──
const MARKS = [
  /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/ig,
  /\b(rigged|rigid|animated|simplified|simple|lowpoly|low\s*poly|generic)\b/ig,
  /\b(t[\s-]?pose|standing|sitting|walking|running|swimming|flying|jumping|lying|neutral|pose)\b/ig,
  /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|beige|pink|purple|maroon|bronze|copper)\b/ig,
  /\b3d\s*(model|models)\b/ig,
  /\b(19|20)\d{2}\b/g,
];
const STOPW = new Set(['the', 'a', 'an', 'and', 'of', 'with', 'for', 'in', 'on', 'to', 'by']);
function print(name) {
  let s = String(name || '').toLowerCase();
  for (const re of MARKS) s = s.replace(re, ' ');
  const toks = s.replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(t => t && !STOPW.has(t));
  return [...new Set(toks)].sort().join(' ');
}

// ── группировка ──
const byRoot = new Map();
for (const r of rows) {
  if (!byRoot.has(r.root_id)) byRoot.set(r.root_id, []);
  byRoot.get(r.root_id).push(r);
}

const groups = [];       // объединяемые наборы
const partsOf = new Map(); // root -> детали (связываем логически, не сливаем)

for (const [rid, items] of byRoot) {
  const parts = items.filter(x => x.split);
  const whole = items.filter(x => !x.split);
  if (parts.length) partsOf.set(rid, parts);
  if (whole.length < 2) continue;

  const byPrint = new Map();
  for (const x of whole) {
    const p = print(x.name);
    if (!p) continue;
    if (!byPrint.has(p)) byPrint.set(p, []);
    byPrint.get(p).push(x);
  }
  for (const [p, g] of byPrint) {
    if (g.length < 2) continue;
    // Чем «голее» запись, тем лучше как главная; при равенстве — дешевле и старше.
    const rank = x => (x.simplified ? 8 : 0) + (/\bfor\s+(maya|cinema|c4d|blender|max)\b/i.test(x.name) ? 4 : 0)
      + (x.pose ? 2 : 0) + (x.animation ? 1 : 0);
    const order = g.slice().sort((a, b) => rank(a) - rank(b) || (+a.price - +b.price));
    groups.push({ rid, print: p, items: order, rootName: items[0].root_name, parts: parts.length });
  }
}

const onSite = g => g.items.filter(x => pidOnSite.has(String(x.pid))).length;
const live = groups.filter(g => onSite(g) >= 2);
const fresh = groups.filter(g => onSite(g) === 0);

console.log('строк в отчёте: ' + rows.length + ', корней: ' + byRoot.size);
console.log('деталей (is_split), выносим из объединения: ' + rows.filter(r => r.split).length
  + ' в ' + partsOf.size + ' корнях');
console.log('\nнаборов к объединению: ' + groups.length
  + '  (позиций в них: ' + groups.reduce((s, g) => s + g.items.length, 0) + ')');
console.log('  из них уже на сайте (>=2 живых карточки): ' + live.length
  + '  -> свернётся ' + live.reduce((s, g) => s + onSite(g) - 1, 0) + ' карточек');
console.log('  целиком новых (ни одной карточки на сайте): ' + fresh.length
  + '  (позиций ' + fresh.reduce((s, g) => s + g.items.length, 0) + ')');

const newRows = rows.filter(r => !pidOnSite.has(String(r.pid)));
console.log('\nтоваров из отчёта, которых нет на сайте: ' + newRows.length);

console.log('\n' + '='.repeat(70));
console.log('ПРИМЕРЫ ОБЪЕДИНЕНИЯ (уже существующие карточки)');
console.log('='.repeat(70));
const pick = live.slice().sort((a, b) => onSite(b) - onSite(a));
for (const g of pick.slice(0, SHOW)) {
  console.log('\n■ корень ' + g.rid + '  («' + (g.rootName || '-') + '»)');
  console.log('  отпечаток: ' + g.print);
  for (const x of g.items) {
    const marks = ['simplified', 'color_var', 'pose', 'animation', 'new_material', 'multimodel']
      .filter(f => x[f]).join(',');
    const slug = pidOnSite.get(String(x.pid));
    console.log('   ' + (slug ? 'НА САЙТЕ' : 'нет     ') + ' $' + String(x.price).padStart(5)
      + '  ' + (marks || '-').padEnd(22) + ' ' + x.name.slice(0, 54) + '  [' + x.pub_year + ']');
  }
  if (g.parts) console.log('   + деталей в корне (не сливаем, свяжем ссылками): ' + g.parts);
}
