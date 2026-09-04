/*
 * check-new-variants.mjs - что из новых моделей склеится, а что встанет само.
 *
 * ЗАЧЕМ. Основатель сказал: список полный, ДО схлопывания, и то, что добавим,
 * надо склеить с базой. Прежде чем заводить 627 страниц, надо знать, сколько из
 * них - варианты уже живущих моделей.
 *
 * ПО КАКОМУ ПРАВИЛУ. Ровно по тому, что уже работает в merge-variants.mjs:
 *
 *   ключ = корень публикации + ОТПЕЧАТОК НАЗВАНИЯ (значимые слова, без
 *   маркеров софта, цвета, оснастки), и отдельно отбрасываются детали,
 *   отделённые от модели (признак `split` в отчёте).
 *
 * Одного корня НЕ хватает: у «2016 Chevrolet Express Emergency Car» и «Truck
 * Tire with Steel Wheel Rim» он общий, потому что колесо ВЫДЕЛЕНО из машины.
 * Проверено на живых карточках: в группах с общим корнем 85% пар названий не
 * имеют ни одного общего слова. Отпечаток названия и отсев деталей это чинят.
 *
 * Ничего не пишет и ничего не склеивает - только показывает, что получится.
 *
 * Запуск:  node scripts/check-new-variants.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const RECS = path.join(ROOT, 'data', 'records');

// Те же маркеры, что в merge-variants: они отличают вариант, а не предмет.
const MARKS = [
  /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/ig,
  /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|olive|beige|pink|purple|maroon)\b/ig,
  /\b(rigged|animated|simplified|simple|fur|pose[d]?|game\s*ready|low\s*poly|high\s*poly)\b/ig,
];
const STOP = new Set(['3d', 'model', 'models', 'with', 'and', 'for', 'the', 'set', 'new', 'old']);
const print = name => {
  let s = String(name || '').toLowerCase();
  for (const re of MARKS) s = s.replace(re, ' ');
  const toks = s.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !STOP.has(t));
  return [...new Set(toks)].sort().join(' ');
};

const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));
const split = new Set(report.filter(r => r.split).map(r => String(r.pid)));

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const live = [], fresh = [];
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    (r.status === 'new' ? fresh : live).push(r);
  }
}

// Ключи живых карточек: и своей записи, и каждого варианта внутри семьи.
const liveKey = new Map();
for (const r of live) {
  if (r.root) {
    const p = print(r.name);
    if (p.length >= 3) liveKey.set(r.root + '|' + p, r.slug);
    for (const v of r.family || []) {
      const pv = print(v.name);
      if (pv.length >= 3) liveKey.set(r.root + '|' + pv, r.slug);
    }
  }
}

const ready = fresh.filter(r => r.image);
let joins = 0, alone = 0, isSplit = 0, noKey = 0;
const groups = new Map();
const exJoin = [], exGroup = [];

for (const r of ready) {
  if (split.has(String(r.id))) { isSplit++; continue; }
  const p = print(r.name);
  if (!r.root || p.length < 3) { noKey++; alone++; continue; }
  const key = r.root + '|' + p;
  const target = liveKey.get(key);
  if (target) {
    joins++;
    if (exJoin.length < 5) exJoin.push(String(r.name).slice(0, 40) + '  ->  ' + String(target).slice(0, 44));
    continue;
  }
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

let newFamilies = 0, inFamilies = 0;
for (const [, list] of groups) {
  if (list.length > 1) {
    newFamilies++; inFamilies += list.length;
    if (exGroup.length < 4) exGroup.push(list.map(x => String(x.name).slice(0, 30)).join('  +  '));
  } else alone++;
}

console.log('новых записей с превью: ' + ready.length.toLocaleString('ru-RU'));
console.log('\n--- что с ними будет ---');
console.log('  ' + String(joins).padStart(5) + '  вариант уже живущей карточки - страницу НЕ заводим, идёт в её семью');
console.log('  ' + String(inFamilies).padStart(5) + '  склеиваются между собой в ' + newFamilies + ' новых семей');
console.log('  ' + String(alone).padStart(5) + '  одиночки - каждая своя карточка');
console.log('  ' + String(isSplit).padStart(5) + '  отделённые детали (признак split) - своя карточка, склейке не подлежат');
console.log('\nпримеры прирастающих к живым:');
exJoin.forEach(x => console.log('   ' + x));
console.log('\nпримеры новых семей:');
exGroup.forEach(x => console.log('   ' + x));
