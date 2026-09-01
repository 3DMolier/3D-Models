/*
 * check-internal-links.mjs - внутренние ссылки, ведущие в никуда.
 *
 * ПУНКТ 1 СПИСКА. С главной страницы плитка бабочки вела на
 * /models/flying-monarch-butterfly-rigged-3d-model-1566626/, а папка на диске
 * называется иначе: адрес был ВЫЧИСЛЕН из подписи вместо того, чтобы быть
 * взятым из существующей папки. На статическом сайте такая ссылка - это 404
 * для человека и для робота, и заметить её можно только пройдя по ней.
 *
 * Здесь проходим по всем страницам сайта и проверяем каждую ссылку, которая
 * начинается со слэша. Внешние адреса, якоря, mailto и tel не наши.
 *
 * Запуск:  node scripts/check-internal-links.mjs
 *          node scripts/check-internal-links.mjs --limit 40
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > 0 ? Number(process.argv[i + 1]) : 20; })();

// ── что вообще существует ──
const pages = [];
const exists = new Set();
(function walk(rel, d) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === '.git' || it.name === '.tmp') continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    // Обходим ВСЮ глубину. С ограничением по уровню вложенности каталог
    // categories/<кат>/<подкат>/page/2/ не попадал в список известных
    // адресов, и 68 живых страниц пагинации выглядели битыми ссылками.
    if (it.isDirectory()) { exists.add('/' + nx + '/'); walk(nx, d + 1); }
    else {
      exists.add('/' + nx);
      if (it.name.endsWith('.html')) pages.push(nx);
    }
  }
})('', 0);
console.log('страниц: ' + pages.length.toLocaleString('ru-RU') + ', известных адресов: ' + exists.size.toLocaleString('ru-RU'));

/** Есть ли такой адрес на сайте. */
function ok(href) {
  let v = href.split('#')[0].split('?')[0];
  if (!v || v === '/') return true;
  if (exists.has(v)) return true;
  if (!v.endsWith('/') && exists.has(v + '/')) return true;      // ссылка без слэша
  if (v.endsWith('/') && exists.has(v + 'index.html')) return true;
  return false;
}

const broken = new Map();                                        // адрес -> сколько страниц ссылаются
const firstPage = new Map();
let checked = 0;
for (const rel of pages) {
  let h;
  try { h = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { continue; }
  for (const m of h.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
    const v = m[1];
    checked++;
    if (ok(v)) continue;
    broken.set(v, (broken.get(v) || 0) + 1);
    if (!firstPage.has(v)) firstPage.set(v, rel);
  }
}

console.log('проверено ссылок: ' + checked.toLocaleString('ru-RU'));
console.log('адресов, ведущих в никуда: ' + broken.size);
[...broken].sort((a, b) => b[1] - a[1]).slice(0, LIMIT)
  .forEach(([v, n]) => console.log('   ' + String(n).padStart(7) + '  ' + v + '   (напр. ' + firstPage.get(v) + ')'));
