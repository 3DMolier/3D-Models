/*
 * sync-prices.mjs - цены на сайте по данным Product Report.
 *
 * ПРАВИЛО. Цена берётся ТОЛЬКО из отчёта (data/product-report.json, который
 * собирается из присланного Excel). Ни сайт студии, ни старые данные каталога
 * источником цены не являются. Каждый раз, когда приходит новый Excel:
 *     node scripts/import-product-report.mjs <файл.xlsm>
 *     node scripts/sync-prices.mjs
 *
 * ЧТО БЫЛО. Tesla Model 3 стоила на TurboSquid $129 - проверено на самой
 * странице, - а на карточке значилось $149 сразу в пяти местах: в заголовке,
 * рядом с кнопкой, в тексте описания, в вопросах и в характеристиках. Цена
 * жила в данных каталога и в готовых страницах, и обе копии отстали.
 *
 * ГДЕ ЦЕНА ЖИВЁТ НА КАРТОЧКЕ:
 *   <title>… - $149 | 3D Molier</title>
 *   og:title и twitter:title
 *   строка «$149 USD on TurboSquid» под названием
 *   строка Price в характеристиках
 *   "price":"149.00" в разметке товара
 *   текст описания и вопросов: «listed at $149», «priced at $149»
 * Плюс колонка p в data/fc-chunk-*.json - из неё живут каталог, поиск,
 * страницы категорий и подкатегорий.
 *
 * Запуск:  node scripts/sync-prices.mjs --dry
 *          node scripts/sync-prices.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

// ── цена из отчёта ──
const report = JSON.parse(fs.readFileSync(path.join(DATA, 'product-report.json'), 'utf8'));
const priceOf = new Map();
for (const r of report) if (r.price !== null && r.price !== undefined) priceOf.set(String(r.pid), r.price);
console.log('цен в отчёте: ' + priceOf.size);

// ── 1. данные каталога ──
const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const chunks = [];
let dataFixed = 0, noReport = 0;
const nameOfId = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  chunks.push(c);
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    nameOfId.set(id, c.n[j]);
    const want = priceOf.get(id);
    if (want === undefined) { noReport++; continue; }
    if (c.p[j] !== want) { c.p[j] = want; dataFixed++; }
  }
}
console.log('в данных каталога цена исправлена у ' + dataFixed + ' моделей'
  + (noReport ? ', нет в отчёте: ' + noReport : ''));
if (!DRY) {
  for (let k = 0; k < chunks.length; k++) {
    fs.writeFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), JSON.stringify(chunks[k]));
  }
}

// ── 2. карточки ──
let cards = 0, live = 0, places = 0;
const examples = [];
for (const [id, name] of nameOfId) {
  const want = priceOf.get(id);
  if (want === undefined) continue;
  const dir = slugify(name) + '-' + id;
  const file = path.join(MODELS, dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;

  const before = h;
  const W = '$' + want;
  let n = 0;
  const was = (h.match(/>Price<\/th><td[^>]*>\$([\d,]+)/) || [])[1];

  // Правим ПО СЛОТАМ, а не заменой старого числа по всей странице. Цены
  // соседних моделей в блоках «похожие» и «все версии» тоже стоят в долларах и
  // случайно совпадают - их трогать нельзя. Каждый слот ниже принадлежит именно
  // этой модели.
  const slots = [
    // заголовок вкладки: «… 3D Model - $149 | 3D Molier»
    [/(<title>[^<]*?- )\$\d+(?= \| )/, a => a + W],
    // описания для поиска и соцсетей: «Vehicles asset, $149.»
    [/((?:<meta name="description"|<meta property="og:description"|<meta name="twitter:description") content="[^"]*?asset, )\$\d+/g, a => a + W],
    // крупная цена под названием
    [/(<span class="mp-price">)\$\d+/, a => a + W],
    // строка в характеристиках
    [/(>Price<\/th><td[^>]*>)\$[\d,]+/, a => a + W],
    // разметка товара
    [/("price"\s*:\s*")[\d.]+(")/, (a, b) => a + Number(want).toFixed(2) + b],
    // текст описания и та же фраза внутри разметки страницы
    [/((?:available at|listed at|priced at) )\$\d+/g, a => a + W],
    // ответ в блоке вопросов и тот же ответ в разметке
    [/(The price is )\$\d+(?= USD)/g, a => a + W],
  ];
  for (const [re, fn] of slots) {
    h = h.replace(re, (...m) => { n++; return fn(m[1], m[2]); });
  }

  // Цена главной версии в блоке «все версии». Это первая карточка блока - у неё
  // стоит значок main; остальные принадлежат другим моделям.
  h = h.replace(/(<div class="mp-rc-title">[^<]*<span class="mp-var-badge">main<\/span>[\s\S]{0,300}?<span class="mp-rc-price">)\$\d+/,
    (x, a) => { n++; return a + W; });

  if (h === before) continue;
  places += n;
  cards++;
  if (examples.length < 8) examples.push(name + ': $' + (was || '?') + ' -> $' + want);
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек просмотрено: ' + live);
console.log('карточек с неверной ценой: ' + cards + ', мест исправлено: ' + places);
examples.forEach(e => console.log('    ' + e));
if (DRY) console.log('(--dry, ничего не записано)');
