/*
 * import-product-report.mjs - приём свежего Product Report из Excel.
 *
 * ЗАЧЕМ. Цена, дата публикации, сертификат и категории TurboSquid приходят
 * только отсюда. data/product-report.json - это тот же отчёт, разложенный в
 * JSON; из него живут category-map.mjs, merge-variants.mjs, build-collections.mjs
 * и сверка цен на карточках.
 *
 * ПОЧЕМУ ЭТО ВАЖНО. Отчёт в репозитории был собран 10.08 из ИЮЛЬСКОГО файла, а
 * цены с тех пор менялись. Tesla Model 3 стоит $129, а на карточке значилось
 * $149 - в заголовке, у кнопки, в тексте, в вопросах и в характеристиках.
 * Цена берётся ТОЛЬКО из этого файла, не с сайта студии и не из старых данных.
 *
 * Колонки, которые нам нужны (MAIN-лист):
 *    2  Product_ID          41  Last Price, $
 *    3  Product_Name        98  Certification
 *   38  Date of publication 21-23  Category 1/2/3
 *   39  Year of publ         4  Link
 *
 * Запуск:  node scripts/import-product-report.mjs "C:/.../!2026-08-02 Product Report.xlsm" --dry
 *          node scripts/import-product-report.mjs "C:/.../!2026-08-02 Product Report.xlsm"
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const OUT = path.join(ROOT, 'data', 'product-report.json');
const SRC = process.argv[2];
const DRY = process.argv.includes('--dry');

if (!SRC || !fs.existsSync(SRC)) {
  console.log('нужен путь к Product Report (.xlsm)');
  console.log('пример: node scripts/import-product-report.mjs "C:/Users/MSI-PC/Downloads/!2026-08-02 Product Report.xlsm"');
  process.exit(1);
}

console.log('читаю ' + path.basename(SRC) + ' ...');
// Отчёт весит 55 МБ: 90 тысяч строк на 104 колонки. Полный разбор со стилями и
// формулами не заканчивается за разумное время - первый прогон висел 45 минут
// без единой строки вывода. Отключаем всё, что нам не нужно, и берём значения
// напрямую из ячеек, минуя построение матрицы строк.
const wb = XLSX.readFile(SRC, {
  cellDates: true,
  cellStyles: false, cellFormula: false, cellNF: false, cellText: false,
  bookVBA: false, bookDeps: false, bookProps: false, bookSheets: false,
});
// Лист называется «MAIN <дата>», дата меняется от выгрузки к выгрузке.
const sheetName = wb.SheetNames.find(n => /^MAIN/i.test(n));
if (!sheetName) { console.error('не нашёл лист MAIN. Листы: ' + wb.SheetNames.join(', ')); process.exit(1); }
console.log('лист: ' + sheetName);

// Работаем по ячейкам: sheet_to_json на 9,4 млн ячеек съедает всю память.
const sh = wb.Sheets[sheetName];
const range = XLSX.utils.decode_range(sh['!ref']);
const cell = (r, c) => {
  const v = sh[XLSX.utils.encode_cell({ r, c })];
  return v === undefined ? '' : (v.v === undefined ? '' : v.v);
};
const hdr = [];
for (let c = range.s.c; c <= range.e.c; c++) hdr[c] = String(cell(range.s.r, c)).trim();
console.log('строк в листе: ' + (range.e.r - range.s.r) + ', колонок: ' + (range.e.c + 1));
const col = name => {
  const i = hdr.findIndex(h => h.toLowerCase() === name.toLowerCase());
  if (i < 0) throw new Error('нет колонки «' + name + '» - проверь шапку отчёта');
  return i;
};
const C = {
  root: col('root_id_'), rootName: col('Root Name'),
  pid: col('Product_ID'), name: col('Product_Name'), link: col('Link'),
  cat1: col('Category 1'), cat2: col('Category 2'), cat3: col('Category 3'),
  multi: col('is_multimodel'), color: col('is_color_texture_variation'),
  simpl: col('is_simplified'), repro: col('is_full_reproduction'),
  split: col('is_split'), anim: col('is_animation (ERRORS)'), pose: col('is_pose'),
  date: col('Date of publication'), year: col('Year of publ'),
  price: col('Last Price, $'), cert: col('Certification'),
  reproPid: col('Full reproduction done_product ID'),
  reproRoot: col('Full reproduction done_root ID'),
};

const yes = v => {
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'да';
};
const ymd = v => {
  if (v instanceof Date && !isNaN(v)) {
    // Смещения часового пояса не учитываем: в отчёте это календарная дата.
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0')
      + '-' + String(v.getDate()).padStart(2, '0');
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : (s || null);
};
const num = v => {
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const out = [];
let noPid = 0, noPrice = 0;
for (let i = range.s.r + 1; i <= range.e.r; i++) {
  const r = {};
  for (const c of Object.values(C)) r[c] = cell(i, c);
  const pid = String(r[C.pid] || '').trim();
  if (!/^\d+$/.test(pid)) { noPid++; continue; }
  const price = num(r[C.price]);
  if (price === null) noPrice++;
  out.push({
    pid,
    root: String(r[C.root] || '').trim(),
    rootName: String(r[C.rootName] || '').trim(),
    name: String(r[C.name] || '').trim(),
    split: yes(r[C.split]), color: yes(r[C.color]), simpl: yes(r[C.simpl]),
    pose: yes(r[C.pose]), anim: yes(r[C.anim]), multi: yes(r[C.multi]),
    repro: yes(r[C.repro]),
    reproPid: String(r[C.reproPid] || '').trim() || pid,
    reproRoot: String(r[C.reproRoot] || '').trim(),
    cat1: String(r[C.cat1] || '').trim(),
    cat2: String(r[C.cat2] || '').trim(),
    cat3: String(r[C.cat3] || '').trim(),
    date: ymd(r[C.date]),
    year: String(r[C.year] || '').trim(),
    price,
    cert: String(r[C.cert] || '').trim(),
    link: String(r[C.link] || '').trim(),
  });
}

console.log('строк с номером товара: ' + out.length + (noPid ? ', пропущено без номера: ' + noPid : '')
  + (noPrice ? ', без цены: ' + noPrice : ''));

// ── что изменилось против прежнего отчёта ──
if (fs.existsSync(OUT)) {
  const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const byPid = new Map(old.map(r => [String(r.pid), r]));
  let priceUp = 0, priceDown = 0, added = 0, gone = 0, certChanged = 0;
  const examples = [];
  for (const r of out) {
    const o = byPid.get(r.pid);
    if (!o) { added++; continue; }
    if (o.price !== r.price && r.price !== null) {
      if (r.price > o.price) priceUp++; else priceDown++;
      if (examples.length < 8) examples.push(r.name + ': $' + o.price + ' -> $' + r.price);
    }
    if ((o.cert || '') !== (r.cert || '')) certChanged++;
  }
  const now = new Set(out.map(r => r.pid));
  for (const p of byPid.keys()) if (!now.has(p)) gone++;
  console.log('\nпротив прежнего отчёта:');
  console.log('  цена выросла у ' + priceUp + ', снизилась у ' + priceDown);
  console.log('  сертификат изменился у ' + certChanged);
  console.log('  новых товаров ' + added + ', пропало ' + gone);
  examples.forEach(e => console.log('    ' + e));
}

if (!DRY) {
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('\nзаписан ' + OUT + '  ' + Math.round(fs.statSync(OUT).size / 1024 / 1024) + ' МБ');
} else {
  console.log('\n(--dry, ничего не записано)');
}
