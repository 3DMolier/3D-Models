/*
 * check-unknown-tiles.mjs - на что ведут плитки, которых нет среди записей.
 *
 * Проверка хабов нашла 20 таких ссылок. Каждая может быть тремя разными
 * вещами, и разница существенная:
 *   папки нет вовсе          - это 404 в списке, надо чинить;
 *   папка есть, но заглушка  - посетитель уедет перенаправлением, терпимо;
 *   папка живая              - значит запись потерялась, разбираться.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-unknown-tiles.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const known = new Set();
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    known.add(r.slug);
  }
}

const walk = dir => {
  const out = [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...walk(full));
    else if (it.name === 'index.html') out.push(full);
  }
  return out;
};

const found = new Map();
for (const f of walk(path.join(ROOT, 'categories'))) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/href="\/models\/([a-z0-9-]+)\/"/g)) {
    const slug = m[1];
    if (known.has(slug)) continue;
    if (!found.has(slug)) found.set(slug, new Set());
    found.get(slug).add(path.relative(ROOT, f).replace(/\\/g, '/'));
  }
}

console.log('плиток на неизвестные записи: ' + found.size + '\n');
let missing = 0, stub = 0, live = 0;
for (const [slug, pages] of found) {
  const file = path.join(ROOT, 'models', slug, 'index.html');
  let kind;
  if (!fs.existsSync(file)) { kind = 'ПАПКИ НЕТ - это 404'; missing++; }
  else {
    const head = fs.readFileSync(file, 'utf8').slice(0, 400);
    if (/http-equiv="refresh"/i.test(head)) { kind = 'заглушка, ведёт дальше'; stub++; }
    else { kind = 'ЖИВАЯ КАРТОЧКА без записи'; live++; }
  }
  console.log('  ' + slug.slice(0, 52).padEnd(54) + kind);
  console.log('      на страницах: ' + [...pages].slice(0, 2).join(', ')
    + (pages.size > 2 ? ' и ещё ' + (pages.size - 2) : ''));
}

console.log('\nитого: нет папки ' + missing + ', заглушек ' + stub + ', живых без записи ' + live);
process.exit(missing || live ? 1 : 0);
