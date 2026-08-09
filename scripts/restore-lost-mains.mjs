// restore-lost-mains.mjs — восстановление карточек, потерянных при объединении.
//
// Что случилось. Правила менялись между прогонами, и главной в группе оказывалась
// то одна запись, то другая. В карте «вариант -> главная» из-за этого возникли
// циклы: A -> B и B -> A, при этом обе страницы уже удалены. Товар исчезал с сайта
// целиком, а ссылки на него вели в никуда.
//
// Что делает скрипт: находит компоненты карты, где НЕТ ни одной живой страницы,
// выбирает в каждой лучшего представителя (по продажам, при равных — дешевле
// и «голее» по названию) и восстанавливает его страницу из git. Дальше обычный
// прогон merge-variants снова соберёт вокруг неё группу.
//
// Запуск:  node scripts/restore-lost-mains.mjs --dry
//          node scripts/restore-lost-mains.mjs [git-ref]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const REF = process.argv.find(a => /^[0-9a-f]{7,40}$/i.test(a)) || 'cc3eca0782';

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const alive = new Set(fs.readdirSync(MODELS));

function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const info = new Map();
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  info.set(r[ix('slug')], {
    name: r[ix('product_name')] || '', price: +r[ix('price')] || 0,
    sales: +r[ix('sales_qty')] || 0,
  });
}

// ── компоненты: вариант и его главная — один узел ──
const parent = new Map();
const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const add = x => { if (!parent.has(x)) parent.set(x, x); };
const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
for (const [k, v] of Object.entries(map)) union(k, v);

const comps = new Map();
for (const s of parent.keys()) {
  const r = find(s);
  if (!comps.has(r)) comps.set(r, []);
  comps.get(r).push(s);
}

// «Голость» названия: чем меньше маркеров исполнения, тем лучше как главная.
const bare = n => (/\bfor\s+(maya|cinema|c4d|blender|max|unity|unreal)\b/i.test(n) ? 8 : 0)
  + (/\bsimplified\b/i.test(n) ? 4 : 0)
  + (/\b(rigged|rigid)\b/i.test(n) ? 2 : 0)
  + (/\blow\s*poly\b/i.test(n) ? 1 : 0);

const lost = [];
for (const [, members] of comps) {
  if (members.some(s => alive.has(s))) continue;         // хоть одна жива — всё в порядке
  const cands = members.filter(s => info.has(s));
  if (!cands.length) continue;
  cands.sort((a, b) => {
    const A = info.get(a), B = info.get(b);
    return (bare(A.name) - bare(B.name)) || (B.sales - A.sales) || (A.price - B.price);
  });
  lost.push({ pick: cands[0], size: members.length });
}

console.log('компонентов карты: ' + comps.size);
console.log('потерянных целиком: ' + lost.length + '  (карточек в них: '
  + lost.reduce((s, x) => s + x.size, 0) + ')');
for (const x of lost.slice(0, 8)) console.log('   ' + x.size + ' шт  ->  ' + (info.get(x.pick) || {}).name);
if (!lost.length || DRY) process.exit(0);

// ── восстановление из git ──
let ok = 0, miss = 0;
const CHUNK = 200;
for (let i = 0; i < lost.length; i += CHUNK) {
  const part = lost.slice(i, i + CHUNK);
  const input = part.map(x => REF + ':models/' + x.pick + '/index.html\n').join('');
  let buf;
  try {
    buf = execFileSync('git', ['cat-file', '--batch'], { cwd: ROOT, input, maxBuffer: 512 * 1024 * 1024 });
  } catch (e) { console.log('  порция ' + i + ' не прочиталась'); continue; }

  let off = 0, k = 0;
  while (off < buf.length && k < part.length) {
    const nl = buf.indexOf(10, off);
    if (nl === -1) break;
    const head = buf.slice(off, nl).toString('utf8');
    if (head.endsWith(' missing')) { miss++; k++; off = nl + 1; continue; }
    const size = +head.split(' ')[2];
    if (!Number.isFinite(size)) { off = nl + 1; continue; }
    const body = buf.slice(nl + 1, nl + 1 + size).toString('utf8');
    off = nl + 1 + size + 1;
    const slug = part[k].pick;
    k++;
    if (!body.includes('<a href="/categories/other/" role="menuitem"')) { miss++; continue; }
    fs.mkdirSync(path.join(MODELS, slug), { recursive: true });
    fs.writeFileSync(path.join(MODELS, slug, 'index.html'), body);
    // Восстановленная страница больше не вариант: убираем её из карты, иначе
    // ссылки снова уедут на удалённую «главную» и цикл вернётся.
    delete map[slug];
    ok++;
  }
  console.log('  ' + Math.min(i + CHUNK, lost.length) + '/' + lost.length + '  восстановлено ' + ok);
}

fs.writeFileSync(path.join(ROOT, 'data', 'merged-variants.json'), JSON.stringify(map));
console.log('\nвосстановлено страниц: ' + ok + ', не нашлось в git: ' + miss);
console.log('ДАЛЬШЕ: node scripts/merge-variants.mjs, затем fix-merged-links.mjs');
