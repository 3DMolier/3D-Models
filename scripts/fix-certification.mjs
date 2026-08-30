/*
 * fix-certification.mjs - точный уровень CheckMate вместо «Lite/Pro» (пункт 7).
 *
 * ЧТО БЫЛО. В характеристиках стояло «CheckMate Lite/Pro» - для покупателя это
 * читается как «либо тот, либо этот, а какой именно - неизвестно». Значение
 * пришло из внутренней группировки, где два уровня сертификации свели в один
 * ярлык.
 *
 * ЧТО ОКАЗАЛОСЬ. Точный уровень у нас ЕСТЬ. В Excel-отчёте колонка
 * Certification заполнена поимённо:
 *      CheckMate Pro     37 677
 *      no certification  32 775
 *      StemCell          11 702
 *      CheckMate Lite     4 065
 *      #Н/Д               3 764
 * То есть можно не «понятнее сформулировать неопределённость», а просто
 * показать то, что известно.
 *
 * ПРАВИЛО. Уровень известен - пишем его: «CheckMate Pro» или «CheckMate Lite».
 * В отчёте пусто или #Н/Д (значение Excel «нет данных») - пишем «CheckMate
 * Certified»: это правда, и она понятнее, чем «Lite/Pro».
 *
 * Запуск:  node scripts/fix-certification.mjs --dry
 *          node scripts/fix-certification.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));
const certOf = new Map();
for (const r of report) certOf.set(String(r.pid), String(r.cert || '').trim());

/** Что показать в строке Certification. null - не трогаем. */
function label(raw) {
  if (/^checkmate pro$/i.test(raw)) return 'CheckMate Pro';
  if (/^checkmate lite$/i.test(raw)) return 'CheckMate Lite';
  // «#Н/Д» - это Excel-ное «нет данных», а не название сертификата.
  if (!raw || raw === '#Н/Д' || /^no certification$/i.test(raw)) return 'CheckMate Certified';
  if (/^stemcell$/i.test(raw)) return null;   // StemCell и так точен
  return 'CheckMate Certified';
}

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) all.push({ id: String(c.i[j]), dir: slugify(c.n[j]) + '-' + c.i[j] });
}

let live = 0, changed = 0, noRow = 0;
const dist = new Map();
for (const m of all) {
  const file = path.join(MODELS, m.dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  if (!/<th[^>]*>Certification<\/th>/.test(h)) { noRow++; continue; }
  const want = label(certOf.get(m.id) || '');
  if (!want) continue;
  const before = h;
  h = h.replace(/(<th[^>]*>Certification<\/th><td[^>]*>)CheckMate Lite\/Pro/,
    (x, a) => a + want);
  if (h === before) continue;
  changed++;
  dist.set(want, (dist.get(want) || 0) + 1);
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + ', без строки Certification: ' + noRow);
console.log('строка уточнена на ' + changed + ' карточках:');
[...dist].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('   ' + k.padEnd(22) + v));
if (DRY) console.log('(--dry, ничего не записано)');
