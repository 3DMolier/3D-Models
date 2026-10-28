/*
 * build-price-duel.mjs - набор моделей для игры /play/price-duel/.
 *
 * ЗАЧЕМ. Игра «дороже или дешевле» показывает две модели каталога и просит
 * угадать, дороже ли вторая. Ей нужен небольшой список: название, цена,
 * категория, превью и адрес карточки.
 *
 * ОТКУДА ДАННЫЕ.
 *   data/fc-chunk-*.json  - название, цена, продажи, категория (свежие).
 *   data/taxonomy.json    - имя категории по номеру g.
 *   data/delisted.json    - снятые с TurboSquid, в игру не берём.
 *   models/<папка>/       - адрес карточки ТОЛЬКО отсюда, по номеру в конце
 *                           имени папки. Из названия адрес не вычисляем.
 *   previews/<папка>.webp - картинка 400x225; нет превью - модели нет в игре.
 * data/catalog.json не берём: он от августа, цены в нём устарели.
 *
 * ОТБОР. Лидеры продаж, не больше CAP на категорию, без почти-двойников
 * (одинаковые первые два слова названия), страницы-перенаправления пропускаем.
 * Продажи в выходной файл не пишем - игре они не нужны.
 *
 * Пересборка цен не запланирована (решение основателя 27.10.2026): файл
 * собирается один раз, дата цен стоит в подвале игры. Два запуска подряд
 * дают один и тот же файл.
 *
 * Запуск:  node scripts/build-price-duel.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const OUT = path.join(ROOT, 'play', 'price-duel', 'models.json');
const N = 240;
const CAP = 45;

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const idx = read('data/fc-index.json');
const catName = new Map(read('data/taxonomy.json').categories.map(c => [c.id, c.name]));
const delisted = new Set(Object.keys(read('data/delisted.json')));

const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^[0-9]+$/.test(id) && !DIR_BY_ID.has(id)) DIR_BY_ID.set(id, d);
}

const pool = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = read('data/fc-chunk-' + k + '.json');
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    if (delisted.has(id) || !(c.p[j] > 0)) continue;
    const dir = DIR_BY_ID.get(id);
    if (!dir || !fs.existsSync(path.join(ROOT, 'previews', dir + '.webp'))) continue;
    pool.push({ id, dir, n: c.n[j], p: Math.round(c.p[j]), s: c.s[j] || 0, c: catName.get(c.g[j]) || 'Other' });
  }
}
// Порядок: продажи, при равенстве - номер, чтобы повторный запуск дал тот же файл
pool.sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));

const perCat = {}, roots = new Set(), out = [];
let redirects = 0;
for (const m of pool) {
  if (out.length >= N) break;
  const root = m.n.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
  if (roots.has(root) || (perCat[m.c] || 0) >= CAP) continue;
  const html = fs.readFileSync(path.join(ROOT, 'models', m.dir, 'index.html'), 'utf8');
  if (/http-equiv=["']?refresh/i.test(html)) { redirects++; continue; }
  roots.add(root);
  perCat[m.c] = (perCat[m.c] || 0) + 1;
  out.push({ s: m.dir, n: m.n, p: m.p, c: m.c });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
const ps = out.map(m => m.p).sort((a, b) => a - b);
console.log('в пуле с превью: ' + pool.length + ', перенаправлений пропущено: ' + redirects);
console.log('в игре: ' + out.length + ', цены $' + ps[0] + '-$' + ps[ps.length - 1] + ', медиана $' + ps[ps.length >> 1]);
console.log(Object.entries(perCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
