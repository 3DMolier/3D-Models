/*
 * build-jigsaw.mjs - картинки для игры /play/jigsaw-puzzle/.
 *
 * Картинки отобраны в scripts/games/jigsaw-sources.json: сцены с цветом и мелкими
 * деталями, без больших однотонных пятен (на них пазл не собрать). Элемент:
 *   {id, img}            - номер модели и адрес кадра TurboSquid;
 *   {id, img, ts:{n,p,url}} - модели ещё нет на сайте, ссылка ведёт на TurboSquid;
 *   n                    - своё название, если в каталоге оно обрезано.
 * Кадр 4:3 без верхних 7% и нижних 10% (надпись «The scene is not included», знак студии),
 * 1600x1200 для игры и 240x180 для выбора картинки.
 * Адрес карточки - только из папки models/ по номеру, цена - из fc-chunk.
 * Запуск:  node scripts/build-jigsaw.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ROOT } from './lib/paths.mjs';

const OUT_DIR = path.join(ROOT, 'play', 'jigsaw-puzzle');
const IMG_DIR = path.join(OUT_DIR, 'img'), TH_DIR = path.join(OUT_DIR, 'thumb');
const CACHE = path.join(os.tmpdir(), '3dmolier-jigsaw-cache');
const REF = '?referral=3d_molier-international';
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const src = read('scripts/games/jigsaw-sources.json');
const delisted = new Set(Object.keys(read('data/delisted.json')));

const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^[0-9]+$/.test(id) && !DIR_BY_ID.has(id)) DIR_BY_ID.set(id, d);
}
const fc = new Map();
const idx = read('data/fc-index.json');
for (let k = 0; k < idx.chunks; k++) {
  const c = read('data/fc-chunk-' + k + '.json');
  for (let j = 0; j < c.i.length; j++) fc.set(String(c.i[j]), { n: c.n[j], p: Math.round(c.p[j]) });
}
const rec = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data/records')).filter(f => /^records-\d+\.json$/.test(f))) {
  const r = read('data/records/' + f);
  for (const a of (Array.isArray(r) ? r : Object.values(r))) rec.set(a.id, a);
}

async function fetchTo(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  for (let t = 0; t < 3; t++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; }
    await new Promise(z => setTimeout(z, 2000 * (t + 1)));
  }
  throw new Error('не скачать ' + url);
}
async function frame(file) {
  const m = await sharp(file).metadata();
  const y0 = Math.round(m.height * 0.07), H = Math.round(m.height * 0.83);
  let w = Math.min(m.width, Math.round(H * 4 / 3)), h = Math.round(w * 3 / 4);
  if (h > H) { h = H; w = Math.round(h * 4 / 3); }
  return sharp(file).extract({ left: Math.round((m.width - w) / 2), top: y0 + Math.round((H - h) / 2), width: w, height: h });
}

for (const d of [IMG_DIR, TH_DIR, CACHE]) fs.mkdirSync(d, { recursive: true });
const items = [], keep = new Set();
for (const r of src.items) {
  const id = String(r.id), dir = DIR_BY_ID.get(id), f = fc.get(id), a = rec.get(id);
  if (delisted.has(id) || (!(dir && f) && !r.ts)) { console.error('пропущена', id); continue; }
  const h = crypto.createHash('sha1').update(r.img).digest('hex');
  const file = await fetchTo(r.img, path.join(CACHE, h.slice(0, 16) + '.jpg'));
  const fn = h.slice(0, 12) + '.webp';
  await (await frame(file)).resize(1600, 1200).webp({ quality: 82 }).toFile(path.join(IMG_DIR, fn));
  await (await frame(file)).resize(240, 180).webp({ quality: 70 }).toFile(path.join(TH_DIR, fn));
  keep.add(fn);
  if (dir && f) items.push({ f: fn, s: dir, n: r.n || ((a && a.display_name) || f.n).replace(/\s+3D Model$/i, '').replace(/\s*\(\d+\)$/, ''), p: f.p });
  else items.push({ f: fn, id, u: r.ts.url + REF, n: r.ts.n, p: r.ts.p });
}
for (const d of [IMG_DIR, TH_DIR]) for (const f of fs.readdirSync(d)) if (!keep.has(f)) fs.unlinkSync(path.join(d, f));
fs.writeFileSync(path.join(OUT_DIR, 'puzzles.json'), JSON.stringify({ items }) + '\n');
const bytes = [...keep].reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size + fs.statSync(path.join(TH_DIR, f)).size, 0);
console.log(`картинок ${items.length}, ${(bytes / 1048576).toFixed(1)} МБ`);
