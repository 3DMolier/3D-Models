/*
 * build-photo-or-render.mjs - кадры для игры /play/photo-or-render/.
 *
 * ЗАЧЕМ. Игра показывает кадр и спрашивает: фото это или рендер. Кадры
 * отобраны вручную (компьютерный отбор + просмотр глазами) и записаны в
 * scripts/games/photo-or-render-sources.json:
 *   renders: [номер модели]           - главный кадр карточки;
 *   photos:  [{title, thumb, page, author, license, licenseUrl}]
 *            - фото Wikimedia Commons со свободной лицензией и EXIF камеры.
 *
 * ЧТОБЫ КАДР НЕ ВЫДАВАЛ ОТВЕТ.
 *   - Все кадры режутся одинаково в 4:3 и сжимаются одним кодеком (webp 1000x750).
 *   - У рендера отрезаются нижняя и верхняя полосы: там бывает знак студии и
 *     надпись «The scene is not included» (внизу слева или вверху справа).
 *   - Метаданные (EXIF) не сохраняются, имя файла - хэш, а не «render_01».
 *
 * Адрес карточки - только из папки models/ по номеру, цена - из fc-chunk.
 * Запуск:  node scripts/build-photo-or-render.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ROOT } from './lib/paths.mjs';

const OUT_DIR = path.join(ROOT, 'play', 'photo-or-render');
const IMG_DIR = path.join(OUT_DIR, 'img');
const CACHE = path.join(os.tmpdir(), '3dmolier-hero-cache');
const UA = '3DMolierGameBuilder/1.0 (https://3dmolierstudio.com; 3dmolier@3dmolier.com)';
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const src = read('scripts/games/photo-or-render-sources.json');
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

async function fetchTo(url, file, headers = {}) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  for (let t = 0; t < 3; t++) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return file; }
    await new Promise(z => setTimeout(z, 2000 * (t + 1)));
  }
  throw new Error('не скачать ' + url);
}
const name = key => crypto.createHash('sha1').update('pr:' + key).digest('hex').slice(0, 12) + '.webp';

// Кадр 4:3 из середины; у рендера без верхних 7% и нижних 10% кадра:
// надпись «The scene is not included» бывает и в правом верхнем углу
async function frame(file, isRender) {
  const m = await sharp(file).metadata();
  const y0 = isRender ? Math.round(m.height * 0.07) : 0;
  const H = isRender ? Math.round(m.height * 0.83) : m.height, W = m.width;
  let w = Math.min(W, Math.round(H * 4 / 3)), h = Math.round(w * 3 / 4);
  if (h > H) { h = H; w = Math.round(h * 4 / 3); }
  const left = Math.round((W - w) / 2), top = y0 + Math.round((H - h) / 2);
  return sharp(file).rotate().extract({ left, top, width: w, height: h }).resize(1000, 750).webp({ quality: 80 }).toBuffer();
}

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });
const items = [], keep = new Set();
// Рендер - номер модели (берётся главный кадр карточки) или {id, img} - кадр, выбранный основателем.
// Модели, которой ещё нет на сайте, нужен ts: {n, p, url} - ссылка тогда ведёт на TurboSquid.
// Вариант, склеенный с другой карточкой (его страница - перенаправление): card - папка общей карточки, n и p - самого варианта.
const REF = '?referral=3d_molier-international';
for (const r of src.renders) {
  const id = String(typeof r === 'object' ? r.id : r);
  const a = rec.get(id), dir = DIR_BY_ID.get(id), f = fc.get(id), ts = r.ts;
  if (r.card) {
    if (!fs.existsSync(path.join(ROOT, 'models', r.card, 'index.html'))) { console.error('нет общей карточки', r.card); continue; }
    const file = await fetchTo(r.img, path.join(CACHE, 'r-' + crypto.createHash('sha1').update(r.img).digest('hex').slice(0, 16) + '.img'));
    const fn = name('r' + id + r.img);
    fs.writeFileSync(path.join(IMG_DIR, fn), await frame(file, true));
    keep.add(fn);
    items.push({ f: fn, t: 'r', s: r.card, n: r.n, p: r.p });
    continue;
  }
  if (delisted.has(id) || (!(a && dir && f) && !ts)) { console.error('рендер пропущен', id); continue; }
  const img = r.img || (a && a.image);
  const file = await fetchTo(img, path.join(CACHE, (r.img ? 'r-' + crypto.createHash('sha1').update(img).digest('hex').slice(0, 16) : id) + '.img'));
  const fn = name('r' + id + (r.img || ''));
  fs.writeFileSync(path.join(IMG_DIR, fn), await frame(file, true));
  keep.add(fn);
  if (dir && f) items.push({ f: fn, t: 'r', s: dir, n: r.n || ((a && a.display_name) || f.n).replace(/\s+3D Model$/i, '').replace(/\s*\(\d+\)$/, ''), p: f.p });
  else items.push({ f: fn, t: 'r', id, u: ts.url + REF, n: ts.n, p: ts.p });
}
for (const ph of src.photos) {
  const file = await fetchTo(ph.thumb, path.join(CACHE, 'c-' + crypto.createHash('sha1').update(ph.title).digest('hex').slice(0, 16) + '.img'), { 'User-Agent': UA });
  const fn = name('p' + ph.title);
  fs.writeFileSync(path.join(IMG_DIR, fn), await frame(file, false));
  keep.add(fn);
  items.push({ f: fn, t: 'p', a: ph.author, l: ph.license, lu: ph.licenseUrl, src: ph.page });
}
for (const f of fs.readdirSync(IMG_DIR)) if (!keep.has(f)) fs.unlinkSync(path.join(IMG_DIR, f));
items.sort((x, y) => x.f.localeCompare(y.f));    // порядок в файле не подсказывает тип
fs.writeFileSync(path.join(OUT_DIR, 'rounds.json'), JSON.stringify({ items }) + '\n');
const bytes = [...keep].reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size, 0);
console.log(`рендеров ${items.filter(x => x.t === 'r').length}, фото ${items.filter(x => x.t === 'p').length}, ${(bytes / 1048576).toFixed(1)} МБ`);
