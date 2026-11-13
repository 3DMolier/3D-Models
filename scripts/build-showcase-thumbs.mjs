/*
 * build-showcase-thumbs.mjs - свои миниатюры для витрин (13.11.2026, задание основателя по скорости).
 *
 * Витрины: главная, каталог, хаб категорий, первые страницы категорий и подкатегорий. На них кадры TurboSquid
 * (оригиналы 1920x1080, 86-325 КБ) заменяются своим WebP шириной 600 px (6-15 КБ) из assets/img/t/.
 * Имя файла - sha1 исходного адреса (lib/thumbs.mjs, localName), так генераторы находят файл без списков.
 *
 * Запускается ПОСЛЕ генераторов: ищет на витринах адреса TurboSquid (data-orig у картинок через прокси и
 * простые src), которых ещё нет в assets/img/t/, качает оригинал и ужимает sharp-ом. Новая модель на витрине
 * первый день идёт через прокси wsrv.nl, со следующей сборки - своим файлом.
 *
 *   node scripts/build-showcase-thumbs.mjs [--dry] [--limit N]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib/paths.mjs';
import { THUMB_DIR, THUMB_W, localName, TS_RE } from './lib/thumbs.mjs';

const DRY = process.argv.includes('--dry');
const li = process.argv.indexOf('--limit');
const LIMIT = li > 0 ? +process.argv[li + 1] : Infinity;
const CONC = 6;

const showcasePages = () => {
  const out = ['index.html', 'catalog/index.html', 'categories/index.html'];
  const cats = path.join(ROOT, 'categories');
  for (const c of fs.readdirSync(cats, { withFileTypes: true })) {
    if (!c.isDirectory()) continue;
    out.push(path.posix.join('categories', c.name, 'index.html'));
    for (const s of fs.readdirSync(path.join(cats, c.name), { withFileTypes: true }))
      if (s.isDirectory() && s.name !== 'page') out.push(path.posix.join('categories', c.name, s.name, 'index.html'));
  }
  return out.filter(p => fs.existsSync(path.join(ROOT, p)));
};

// Адреса TurboSquid на витрине: из data-orig (картинка уже через прокси) и из src/href обычных картинок.
const URL_RE = /(?:data-orig|src)="(https:\/\/p\.turbosquid\.com\/[^"]+)"/g;
const want = new Map();
for (const p of showcasePages()) {
  const t = fs.readFileSync(path.join(ROOT, p), 'utf8');
  if (/http-equiv="refresh"/i.test(t.slice(0, 1500))) continue;
  for (const m of t.matchAll(URL_RE)) {
    const u = m[1].replace(/&amp;/g, '&');
    if (TS_RE.test(u) && !want.has(u)) want.set(u, p);
  }
}
fs.mkdirSync(THUMB_DIR, { recursive: true });
const have = new Set(fs.readdirSync(THUMB_DIR));
const todo = [...want.keys()].filter(u => !have.has(localName(u))).slice(0, LIMIT);
console.log(`витрин: ${showcasePages().length}, кадров TurboSquid: ${want.size}, своих уже есть: ${want.size - [...want.keys()].filter(u => !have.has(localName(u))).length}, к закачке: ${todo.length}`);
if (DRY || !todo.length) process.exit(0);

let ok = 0, fail = 0, bytes = 0, i = 0;
const fails = [];
async function one(u) {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0 (3dmolierstudio.com thumbnails)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const out = await sharp(buf).resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    const f = path.join(THUMB_DIR, localName(u));
    fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f);
    ok++; bytes += out.length;
  } catch (e) { fail++; if (fails.length < 10) fails.push(u.slice(0, 90) + ' - ' + (e.message || e)); }
}
async function worker() { while (i < todo.length) { const u = todo[i++]; await one(u); if ((ok + fail) % 500 === 0) console.log(`  ${ok + fail}/${todo.length}`); } }
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`свои миниатюры: сделано ${ok}, сбоев ${fail}, средний размер ${ok ? Math.round(bytes / ok / 1024) : 0} КБ, всего ${(bytes / 1048576).toFixed(1)} МБ`);
for (const f of fails) console.log('  сбой: ' + f);
