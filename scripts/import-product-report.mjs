/*
 * import-product-report.mjs - приём свежего Product Report из Excel.
 *
 * ЗАЧЕМ. Цена, дата публикации, сертификат и категории TurboSquid приходят
 * только отсюда. data/product-report.json - это тот же отчёт, разложенный в
 * JSON; из него живут category-map.mjs, merge-variants.mjs, build-collections.mjs
 * и сверка цен на карточках.
 *
 * ПОЧЕМУ ЭТО ВАЖНО. Отчёт в репозитории был собран из июльской выгрузки, а цены
 * с тех пор менялись. Tesla Model 3 стоит $129 - проверено на самой странице
 * TurboSquid, - а на карточке значилось $149: в заголовке, у кнопки, в тексте,
 * в вопросах и в характеристиках. Цена берётся ТОЛЬКО из этого файла.
 *
 * ПОЧЕМУ ЧЕРЕЗ CSV. Отчёт весит 55 МБ: 90 тысяч строк на 104 колонки. Разбор
 * .xlsm библиотекой не заканчивается за разумное время - две попытки висели по
 * 45 минут без единой строки вывода, в том числе с отключёнными стилями и
 * формулами и с чтением одного листа. LibreOffice выгружает нужный лист в CSV
 * примерно за минуту, а CSV разбирается за секунды. Скрипт делает это сам.
 *
 * Запуск:  node scripts/import-product-report.mjs "C:/.../!2026-08-02 Product Report.xlsm"
 *          node scripts/import-product-report.mjs <уже готовый .csv>
 *          добавить --dry, чтобы только посмотреть разницу
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const OUT = path.join(ROOT, 'data', 'product-report.json');
const SOFFICE = 'C:/Program Files/LibreOffice/program/soffice.exe';
const SRC = process.argv[2];
const DRY = process.argv.includes('--dry');

if (!SRC || !fs.existsSync(SRC)) {
  console.log('нужен путь к Product Report (.xlsm или .csv)');
  console.log('пример: node scripts/import-product-report.mjs "C:/Users/MSI-PC/Downloads/!2026-08-02 Product Report.xlsm"');
  process.exit(1);
}

// ── при необходимости превращаем .xlsm в CSV ──
let csvPath = SRC;
if (/\.xlsm?$/i.test(SRC)) {
  if (!fs.existsSync(SOFFICE)) {
    console.error('нет LibreOffice по пути ' + SOFFICE);
    console.error('либо поставь его, либо выгрузи лист MAIN в CSV вручную и передай CSV.');
    process.exit(1);
  }
  const tmp = path.join(os.tmpdir(), 'report-csv-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  console.log('выгружаю лист MAIN в CSV через LibreOffice, это около минуты...');
  // Последнее число в строке фильтра - номер листа. MAIN идёт вторым, первый
  // лист - stat, и без этого номера выгружается именно он.
  execFileSync(SOFFICE, ['--headless',
    '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,true,false,false,2',
    '--outdir', tmp, SRC], { stdio: 'pipe', timeout: 15 * 60 * 1000 });
  const made = fs.readdirSync(tmp).filter(f => f.toLowerCase().endsWith('.csv'));
  if (!made.length) { console.error('LibreOffice не создал CSV'); process.exit(1); }
  csvPath = path.join(tmp, made[0]);
  console.log('получен ' + made[0] + '  ' + Math.round(fs.statSync(csvPath).size / 1024 / 1024) + ' МБ');
}

// ── разбор CSV ──
// Свой разбор, а не split(','): в названиях моделей встречаются и запятые, и
// кавычки, и переносы строк внутри поля.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

console.log('читаю CSV...');
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
console.log('строк: ' + rows.length);
const hdr = rows[0].map(h => String(h).trim());
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
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  // LibreOffice отдаёт даты как ДД.ММ.ГГГГ или ММ/ДД/ГГГГ - приводим к ISO.
  m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s || null;
};
const num = v => {
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? n : null;
};

const out = [];
let noPid = 0, noPrice = 0;
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r.length) continue;
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
    // LibreOffice выгружает год с разделителем разрядов: «2 017». Чистим, а
    // если не осталось четырёх цифр - берём год из даты, она всегда корректна.
    year: (String(r[C.year] || '').replace(/[^\d]/g, '').match(/^\d{4}$/) || [])[0]
      || String(ymd(r[C.date]) || '').slice(0, 4) || '',
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
  let up = 0, down = 0, added = 0, gone = 0, certChanged = 0;
  const examples = [];
  for (const r of out) {
    const o = byPid.get(r.pid);
    if (!o) { added++; continue; }
    if (r.price !== null && o.price !== r.price) {
      if (r.price > o.price) up++; else down++;
      if (examples.length < 8) examples.push(r.name + ': $' + o.price + ' -> $' + r.price);
    }
    if ((o.cert || '') !== (r.cert || '')) certChanged++;
  }
  const now = new Set(out.map(r => r.pid));
  for (const p of byPid.keys()) if (!now.has(p)) gone++;
  console.log('\nпротив прежнего отчёта:');
  console.log('  цена выросла у ' + up + ', снизилась у ' + down);
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
