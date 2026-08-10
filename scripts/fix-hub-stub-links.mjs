// fix-hub-stub-links.mjs — убирает ссылки на страницы-перенаправления вне карточек.
//
// Хабы категорий, точки входа каталога и коллекции ссылаются на карточки списком.
// После объединения часть адресов стала перенаправлениями: посетитель и поисковик
// делают лишний прыжок, а обход тратится на страницы с семью словами текста.
// Замер до правки: 50 615 таких ссылок из 180 940 на хабах, у /categories/vehicles/
// 70 из 100.
//
// Ссылку не удаляем, а переводим на живую карточку по карте объединений — так
// список не редеет и связность не теряется.
//
// Запуск:  node scripts/fix-hub-stub-links.mjs --dry
//          node scripts/fix-hub-stub-links.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

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
const real = new Set();
const stubs = new Set();
for (const d of fs.readdirSync(MODELS)) (isStub(d) ? stubs : real).add(d);
console.log('карточек ' + real.size + ', перенаправлений ' + stubs.size);

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const cache = new Map();
function live(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const seen = [];
  let cur = slug;
  while (cur && !real.has(cur) && !seen.includes(cur)) { seen.push(cur); cur = map[cur]; }
  const dest = (cur && real.has(cur)) ? cur : null;
  for (const s of seen) cache.set(s, dest);
  cache.set(slug, dest);
  return dest;
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'models') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(ROOT, []);
let touched = 0, moved = 0, unresolved = 0, scanned = 0;
for (const f of files) {
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  scanned++;
  let changed = 0;
  const out = h.replace(/href="\/models\/([^"\/]+)\//g, (m, slug) => {
    if (!stubs.has(slug)) return m;
    const t = live(slug);
    if (!t) { unresolved++; return m; }
    changed++;
    return 'href="/models/' + t + '/';
  });
  if (!changed) continue;
  if (!out.includes('<a href="/categories/other/" role="menuitem"')) continue;   // меню цело
  if (!DRY) fs.writeFileSync(f, out);
  touched++; moved += changed;
}

console.log('\nстраниц вне карточек просмотрено: ' + scanned);
console.log('страниц исправлено:               ' + touched + (DRY ? '  (--dry)' : ''));
console.log('ссылок переведено на живые:       ' + moved);
if (unresolved) console.log('не нашлось живой цели:            ' + unresolved);
