/**
 * fix-stub-links.mjs
 *
 * После склейки вариантов часть карточек стала страницами-перенаправлениями.
 * Листинги, собранные до склейки, продолжают ссылаться на них: посетитель видит
 * мигание редиректа, а поисковик тратит обход и теряет вес ссылки.
 *
 * Скрипт проходит все страницы, КРОМЕ самих карточек (models/) и служебных
 * каталогов, и переводит ссылку с заглушки на живую карточку по карте
 * data/merged-variants.json. Если цепочка никуда не приводит - ссылку не трогаем
 * и показываем в отчёте.
 *
 * Запуск:  node scripts/fix-stub-links.mjs --dry
 *          node scripts/fix-stub-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const copy = s => Buffer.from(String(s), 'utf8').toString('utf8');

const live = new Set(), stub = new Set();
const head = Buffer.alloc(400);
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  let fd;
  try { fd = fs.openSync(path.join(ROOT, 'models', d, 'index.html'), 'r'); } catch (e) { continue; }
  try {
    const n = fs.readSync(fd, head, 0, 400, 0);
    (/http-equiv="refresh"/i.test(head.slice(0, n).toString('utf8')) ? stub : live).add(copy(d));
  } finally { fs.closeSync(fd); }
}
const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));

// цепочка вариант -> главный может быть длиннее одного шага
const cache = new Map();
function liveOf(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const seen = [];
  let cur = slug;
  while (cur && !live.has(cur) && !seen.includes(cur)) { seen.push(cur); cur = merged[cur]; }
  const dest = cur && live.has(cur) ? cur : null;
  for (const s of seen) cache.set(s, dest);
  cache.set(slug, dest);
  return dest;
}

const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name === 'models' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(next);
    else if (e.name === 'index.html') pages.push(next);
  }
})('');

let touched = 0, moved = 0, stuck = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  const hits = [...new Set([...html.matchAll(/href="\/models\/([^\/"]+)\//g)].map(m => copy(m[1])))]
    .filter(s => stub.has(s));
  if (!hits.length) continue;
  let out = html, n = 0;
  for (const s of hits) {
    const dest = liveOf(s);
    if (!dest) { stuck++; console.log('  ! ' + rel + ': ' + s + ' - живой замены нет'); continue; }
    out = out.split('href="/models/' + s + '/').join('href="/models/' + dest + '/');
    n++;
  }
  if (out !== html) {
    touched++; moved += n;
    console.log('  ' + rel + ': переведено ссылок ' + n);
    if (!DRY) fs.writeFileSync(file, out);
  }
}
console.log('\nстраниц изменено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('ссылок переведено на живые карточки: ' + moved + ', без замены: ' + stuck);
