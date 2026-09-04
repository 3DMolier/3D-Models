// build-redirect-stubs.mjs — страницы-перенаправления на месте свёрнутых карточек.
//
// После объединения 21 607 адресов перестали существовать и отдавали 404 —
// и внешним ссылкам, и поисковикам, у которых эти адреса ещё в индексе.
// GitHub Pages статический, серверный 301 поставить негде, поэтому на каждом
// старом адресе оставляем крошечную страницу: meta refresh + canonical на главную
// карточку группы. Google трактует refresh с нулевой задержкой как постоянный
// переход и склеивает адреса.
//
// noindex здесь СОЗНАТЕЛЬНО не ставим: вместе с canonical он рискует перенести
// запрет индексации на целевую страницу.
//
// Заглушки не попадают ни в сайтмапы, ни в блоки ссылок — на них ведут только
// внешние ссылки и старый индекс.
//
// Запуск:  node scripts/build-redirect-stubs.mjs --dry
//          node scripts/build-redirect-stubs.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
const DRY = process.argv.includes('--dry');

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));

// «Живая» — это НАСТОЯЩАЯ карточка, а не заглушка прошлого прогона. Иначе второй
// запуск считал бы заглушки готовыми страницами и не обновлял их, а перенаправление
// могло бы указывать на другую заглушку.
const HEAD_BYTES = 400;
function isStub(slug) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, slug, 'index.html'), 'r'); } catch (e) { return false; }
  try {
    const b = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, b, 0, HEAD_BYTES, 0);
    return /http-equiv="refresh"/.test(b.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}
const alive = new Set();
for (const s of fs.readdirSync(MODELS)) if (!isStub(s)) alive.add(s);
console.log('настоящих карточек: ' + alive.size);

function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const nameOf = new Map();
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  nameOf.set(r[ix('slug')], r[ix('product_name')] || '');
}

// Цепочки и кольца: одна карточка успевала побыть и главной, и вариантом.
const cache = new Map();
function resolve(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const seen = [];
  let cur = slug;
  while (cur && !alive.has(cur) && !seen.includes(cur)) { seen.push(cur); cur = map[cur]; }
  const dest = (cur && alive.has(cur)) ? cur : (seen.find(x => alive.has(x)) || null);
  for (const s of seen) cache.set(s, dest);
  cache.set(slug, dest);
  return dest;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Имя товара часто само кончается на «3D Model» — второй раз не приписываем.
const short = n => String(n).replace(/\s*\b3d\s+models?\s*$/i, '').trim();

function stub(target, oldName, newName) {
  const url = '/models/' + target + '/';
  const title = short(newName || oldName);
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<meta http-equiv="refresh" content="0; url=' + url + '">'
    + '<link rel="canonical" href="' + SITE + url + '">'
    + '<title>' + esc(title) + ' 3D Model | 3D Molier</title>'
    + '<meta name="description" content="This model page has moved to '
    + esc(title) + ' on 3D Molier.">'
    + '<script>location.replace(' + JSON.stringify(url) + ');</script>'
    + '</head><body>'
    + '<p>This page has moved to <a href="' + url + '">' + esc(title) + '</a>.</p>'
    + '</body></html>';
}

// Товары, у которых страницы нет и в карте их нет тоже — остатки первого
// сорванного прогона объединения. Ищем им живую карточку по «отпечатку» имени:
// названию без маркеров исполнения (софт, цвет, оснастка, мех, поза, упрощение).
const MARKS = [
  /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/ig,
  /\s*\b(?:rigged|rigid|animated|fur|simplified|simple|low\s*poly)\b\s*/ig,
  /\s*\b(?:t[\s-]?pose|standing|sitting|walking|running|swimming|flying|jumping|lying|neutral|eating|pose)\b\s*/ig,
  /\s+(?:sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|beige|pink|purple)\b/ig,
  /\s*\b3d\s+models?\b\s*/ig,
];
const fingerprint = n => {
  let s = String(n || '');
  for (const re of MARKS) s = s.replace(re, ' ');
  return s.replace(/\s{2,}/g, ' ').trim().toLowerCase();
};
const byPrint = new Map();
for (const s of alive) {
  const fp = fingerprint(nameOf.get(s));
  if (!fp) continue;
  if (!byPrint.has(fp)) byPrint.set(fp, s);
}
let recovered = 0;
for (const [slug, nm] of nameOf) {
  if (alive.has(slug) || map[slug]) continue;
  const t = byPrint.get(fingerprint(nm));
  if (!t || t === slug) continue;
  map[slug] = t;
  recovered++;
}
if (recovered) console.log('дописано в карту по отпечатку имени: ' + recovered);

let made = 0, skipped = 0, noTarget = 0;
for (const slug of Object.keys(map)) {
  if (alive.has(slug)) { skipped++; continue; }
  const target = resolve(slug);
  if (!target) { noTarget++; continue; }
  const dir = path.join(MODELS, slug);
  const file = path.join(dir, 'index.html');
  // Заглушку прошлого прогона перезаписываем, настоящую карточку — никогда.
  if (fs.existsSync(file)) {
    const cur = fs.readFileSync(file, 'utf8');
    if (!/http-equiv="refresh"/.test(cur)) { skipped++; continue; }
  }
  if (!DRY) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, stub(target, nameOf.get(slug) || slug, nameOf.get(target)));
  }
  made++;
  if (made % 5000 === 0) console.log('  ' + made + ' заглушек');
}

console.log('\nзаглушек создано: ' + made + (DRY ? '  (--dry)' : ''));
if (skipped) console.log('пропущено (страница уже есть): ' + skipped);
if (noTarget) console.log('без живой цели: ' + noTarget);
if (recovered && !DRY) {
  fs.writeFileSync(path.join(ROOT, 'data', 'merged-variants.json'), JSON.stringify(map));
  console.log('карта дополнена: data/merged-variants.json');
}
console.log('\nПРОВЕРЬ: заглушки не должны попасть в сайтмапы.');
