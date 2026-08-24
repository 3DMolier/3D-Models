/*
 * localize-home-images.mjs - забрать картинки главной к себе и отдать в WebP.
 *
 * Почему только главная. Уникальных картинок в каталоге 86 244, средний вес
 * 132 КБ - это около 11 ГБ в JPEG и 7,8 ГБ в WebP. У GitHub Pages жёсткий
 * предел на опубликованный сайт - 1 ГБ, так что забрать всё нельзя: сайт
 * просто перестанет собираться. Главная - 37 картинок, весь входной трафик и
 * тот экран, по которому меряется скорость показа.
 *
 * Выигрыш здесь не только от формата. Источник всегда 1920x1080, а плитки
 * показываются шириной 295-635 точек. Отдаём под удвоенную ширину показа -
 * этого хватает и на экраны с высокой плотностью, а весит в разы меньше.
 *
 * Запуск:
 *   node localize-home-images.mjs --dry
 *   node localize-home-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img', 'home');
const DRY = process.argv.includes('--dry');

// Ширина под удвоенный размер показа. Первый экран - во всю ширину окна,
// широкие плитки 635, обычные 313, подборки 305, полоса студии в половину.
const WIDTH = { hero: 1920, wide: 1280, tile: 640, band: 1280 };

const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, x => {
    if (x.statusCode !== 200) { x.resume(); return rej(new Error('HTTP ' + x.statusCode)); }
    const parts = [];
    x.on('data', d => parts.push(d));
    x.on('end', () => res(Buffer.concat(parts)));
  }).on('error', rej);
});

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Какую ширину дать - зависит от того, где картинка стоит.
function roleOf(url) {
  const i = html.indexOf(url);
  const before = html.slice(Math.max(0, i - 400), i);
  if (before.includes('hero-shot')) return 'hero';
  if (before.includes('studio-media')) return 'band';
  if (/tile--6x[12]/.test(before)) return 'wide';
  return 'tile';
}

const urls = [...new Set([...html.matchAll(/https:\/\/p\.turbosquid\.com\/[^"']+\.jpg/g)].map(m => m[0]))];
console.log('картинок на главной: ' + urls.length);
if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

let jpegBytes = 0, webpBytes = 0, done = 0, failed = 0;
const map = {};
for (const url of urls) {
  const role = roleOf(url);
  // Имя файла - от адреса: короткое, стабильное, без совпадений.
  const base = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  const name = base + '.webp';
  const dest = path.join(OUT_DIR, name);
  try {
    const buf = await get(url);
    jpegBytes += buf.length;
    const img = sharp(buf);
    const meta = await img.metadata();
    const w = Math.min(WIDTH[role], meta.width || WIDTH[role]);
    const out = await img.resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    webpBytes += out.length;
    if (!DRY) fs.writeFileSync(dest, out);
    map[url] = '/assets/img/home/' + name;
    done++;
    console.log('  ' + role.padEnd(5) + ' ' + String(Math.round(buf.length / 1024)).padStart(4) + ' КБ -> '
      + String(Math.round(out.length / 1024)).padStart(4) + ' КБ  ' + meta.width + 'x' + meta.height
      + ' -> ' + w + 'px  ' + name);
  } catch (e) {
    failed++;
    console.log('  ОШИБКА ' + String(e.message).slice(0, 40) + '  ' + url.slice(-46));
  }
  await new Promise(r => setTimeout(r, 150));
}

console.log('\nскачано и сжато: ' + done + ', ошибок: ' + failed);
console.log('было JPEG:  ' + (jpegBytes / 1024 / 1024).toFixed(2) + ' МБ');
console.log('стало WebP: ' + (webpBytes / 1024 / 1024).toFixed(2) + ' МБ'
  + '  (' + (100 - 100 * webpBytes / jpegBytes).toFixed(0) + '% меньше)');

if (!DRY) {
  fs.writeFileSync(path.join(OUT_DIR, 'map.json'), JSON.stringify(map, null, 1));
  console.log('\nкарта адресов: assets/img/home/map.json');
}
console.log(DRY ? '\nПРОБНЫЙ ПРОГОН, файлы не записаны' : '\nЗаписано. Подстановку в разметку делает build-homepage.mjs.');
