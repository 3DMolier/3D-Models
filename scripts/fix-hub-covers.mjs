/*
 * fix-hub-covers.mjs - обложки на /collections/ и /industries/.
 *
 * ПУНКТЫ 13 И 15 СПИСКА.
 *
 * ОБРЕЗКА. Обложка - прямоугольник 16:9 с object-fit: cover. Превью TurboSquid
 * бывают двух видов: 1920x1080 и 1080x1080. Квадратные в таком прямоугольнике
 * обрезаются сверху и снизу, и у модели отрезает то верх, то низ. Поэтому в
 * обложки берём ТОЛЬКО снимки 1920x1080 - соотношение совпадает с рамкой, и
 * обрезать нечего. Размер виден прямо в адресе превью.
 *
 * ОТНОСИМОСТЬ. Берём самую продаваемую модель раздела: она и представляет тему
 * лучше случайной, и снята, как правило, аккуратнее - её чаще переснимали.
 * Одну и ту же картинку двум разделам не даём.
 *
 * ЧЕСТНАЯ ОГОВОРКА. Посмотреть на снимки глазами в этой среде я не могу:
 * скриншоты браузера недоступны, а качать картинки на диск запрещено правилами
 * репозитория. Поэтому «красиво» здесь обеспечено косвенно - соотношением
 * сторон и продажами, а не разглядыванием. Если какая-то обложка не понравится,
 * скажи раздел - подставлю следующего по продажам.
 *
 * Запуск:  node scripts/fix-hub-covers.mjs --dry
 *          node scripts/fix-hub-covers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { COLLECTION_WORDS, INDUSTRY_WORDS, score } from './lib/hub-keywords.mjs';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const WIDE = /\/1920x1080\//;

// ── картинки и продажи по номеру модели ──
const IMG = new Map();
for (let k = 0; k < 18; k++) {
  const f = path.join(ROOT, 'data', 'fc-img-chunk-' + k + '.json');
  if (!fs.existsSync(f)) continue;
  for (const [id, url] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) if (!IMG.has(id)) IMG.set(id, url);
}
const SALES = new Map(), NAME = new Map();
{
  const lines = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
  const head = lines[0].split(',');
  const iId = head.indexOf('product_id'), iN = head.indexOf('product_name'), iS = head.indexOf('sales_qty');
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(',');
    if (!c[iId]) continue;
    SALES.set(c[iId], Number(c[iS]) || 0);
    NAME.set(c[iId], c[iN] || '');
  }
}

const used = new Set();
/*
 * Лучший представитель раздела. Сначала - совпадение названия со словами темы
 * (см. lib/hub-keywords.mjs), и только внутри одинаковой относимости решают
 * продажи. Одни продажи давали воздушные шары в теме «Aircraft» и бриллианты
 * в теме «Nature»: формально лидеры, а на обложке - ошибка.
 */
function pick(ids, words) {
  const good = ids.filter(id => { const u = IMG.get(id); return u && WIDE.test(u) && !used.has(u); });
  good.sort((a, b) => {
    const d = score(NAME.get(b) || '', words) - score(NAME.get(a) || '', words);
    if (d) return d;
    return (SALES.get(b) || 0) - (SALES.get(a) || 0);
  });
  const id = good[0];
  if (!id) return null;
  used.add(IMG.get(id));
  return id;
}

let changed = 0;

// ── 13. обложки коллекций ──
{
  const file = path.join(ROOT, 'collections', 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const themes = [...h.matchAll(/<a href="\/collections\/([a-z0-9-]+)\/" class="coll-theme-card">/g)].map(m => m[1]);
  console.log('тем в коллекциях: ' + themes.length);
  for (const t of themes) {
    const tf = path.join(ROOT, 'collections', t, 'index.html');
    if (!fs.existsSync(tf)) continue;
    const th = fs.readFileSync(tf, 'utf8');
    const ids = [...new Set([...th.matchAll(/href="\/models\/[a-z0-9-]*?-(\d+)\/"/g)].map(m => m[1]))];
    const id = pick(ids, COLLECTION_WORDS[t]);
    if (!id) { console.log('  ' + t + ': нет широкого превью среди ' + ids.length); continue; }
    const url = IMG.get(id);
    const re = new RegExp('(<a href="/collections/' + t + '/" class="coll-theme-card">\\s*<div class="coll-theme-cover">\\s*<img src=")[^"]*("[^>]*alt=")[^"]*(")');
    const out = h.replace(re, (x, a, b, c) => a + url + b + esc(NAME.get(id) || t) + c);
    if (out !== h) { h = out; changed++; }
  }
  if (h !== before && !DRY) fs.writeFileSync(file, h);
  console.log('обложек коллекций заменено: ' + changed);
}

// ── 15. обложки отраслей ──
{
  const file = path.join(ROOT, 'industries', 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const IND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-industries.json'), 'utf8'));
  const byInd = new Map();
  for (const [id, list] of Object.entries(IND)) for (const s of list) {
    if (!byInd.has(s)) byInd.set(s, []);
    byInd.get(s).push(id);
  }
  const cards = [...h.matchAll(/<a class="ind-hub-card" href="\/industries\/([a-z0-9-]+)\/">/g)].map(m => m[1]);
  console.log('отраслей: ' + cards.length);
  let add = 0;
  for (const s of cards) {
    if (new RegExp('href="/industries/' + s + '/">\\s*<div class="ind-hub-cover"').test(h)) continue;
    const id = pick(byInd.get(s) || [], INDUSTRY_WORDS[s]);
    if (!id) { console.log('  ' + s + ': нет широкого превью'); continue; }
    const img = '<div class="ind-hub-cover"><img src="' + IMG.get(id) + '" alt="' + esc(NAME.get(id) || s)
      + '" width="800" height="450" loading="lazy" decoding="async"></div>';
    h = h.replace('<a class="ind-hub-card" href="/industries/' + s + '/">',
      '<a class="ind-hub-card" href="/industries/' + s + '/">' + img);
    add++;
  }
  // стили карточки с обложкой - в тот же <style>, где остальные
  if (add && !/ind-hub-cover\{/.test(h)) {
    h = h.replace(/\.ind-hub-card\{[^}]*\}/, x => x.replace(/padding:[^;]*;/, 'padding:0;overflow:hidden;')
      + '.ind-hub-cover{aspect-ratio:16/9;background:#f2f2f2;overflow:hidden}'
      + '.ind-hub-cover img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}'
      + '.ind-hub-card:hover .ind-hub-cover img{transform:scale(1.04)}'
      + '.ind-hub-card>:not(.ind-hub-cover){padding-left:20px;padding-right:20px}'
      + '.ind-hub-name{padding-top:16px}.ind-hub-tag{padding-bottom:16px}');
  }
  if (h !== before && !DRY) fs.writeFileSync(file, h);
  console.log('обложек отраслей добавлено: ' + add);
}

if (DRY) console.log('(--dry, ничего не записано)');
