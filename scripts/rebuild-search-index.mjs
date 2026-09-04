// rebuild-search-index.mjs — индекс поиска только по живым карточкам.
//
// Полный каталог и поиск читают data/fc-chunk-*.json и data/fc-index.json.
// После объединения карточек эти файлы не пересобирались: в них остались все
// 86 865 товаров, включая 25 012 свёрнутых. В выдаче поиска из-за этого
// «Eurofighter Typhoon Jet with Weaponry» и его же версия Rigged показывались
// двумя отдельными плитками, хотя вторая давно ведёт на первую. И счётчик
// вверху страницы показывал 86 865 вместо настоящего числа.
//
// Формат колоночный: i - product id, n - название, p - цена, s - продажи,
// c - индекс категории. Порядок элементов во всех колонках общий.
//
// Свёрнутые товары не выбрасываем молча: их ID переводим на главную карточку
// группы, чтобы поиск по старому названию всё равно приводил к товару.
//
// Запуск:  node scripts/rebuild-search-index.mjs --dry
//          node scripts/rebuild-search-index.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');
const CHUNK = 10000;

// ── что живо ──
const HEAD = 400;
const buf = Buffer.alloc(HEAD);
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}
const livePid = new Set();
for (const d of fs.readdirSync(MODELS)) {
  const m = d.match(/(\d+)$/);
  if (m && !isStub(d)) livePid.add(m[1]);
}
console.log('живых карточек: ' + livePid.size);

// ── старый индекс ──
const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const KEYS = idx.keys;
const rows = [];
const seenId = new Set();
let dup = 0;
for (let n = 0; n < idx.chunks; n++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + n + '.json'), 'utf8'));
  const len = c[KEYS[0]].length;
  for (let i = 0; i < len; i++) {
    const r = {};
    for (const k of KEYS) r[k] = c[k][i];
    /*
     * Одна модель - одна строка. В индексе оказался задвоен id 2570748
     * (Volkswagen Golf GTI 2025): в каталоге и поиске он показался бы двумя
     * одинаковыми плитками. Повтор в индексе всегда ошибка, поэтому режем
     * здесь, а не ищем, кто его добавил дважды.
     */
    if (seenId.has(String(r.i))) { dup++; continue; }
    seenId.add(String(r.i));
    rows.push(r);
  }
}
console.log('в старом индексе: ' + rows.length + ' товаров' + (dup ? ', убрано повторов: ' + dup : ''));

const keep = rows.filter(r => livePid.has(String(r.i)));
const dropped = rows.length - keep.length;
console.log('останется:        ' + keep.length + '   убрано свёрнутых: ' + dropped);

// Живые карточки, которых в индексе нет (появились позже) - предупредим.
const inIndex = new Set(rows.map(r => String(r.i)));
const missing = [...livePid].filter(p => !inIndex.has(p));
if (missing.length) console.log('живых, но НЕ в индексе: ' + missing.length + '  (появились после последней выгрузки)');

if (DRY) {
  console.log('\n(--dry, ничего не записано)');
  process.exit(0);
}

// ── запись ──
const chunks = Math.ceil(keep.length / CHUNK);
for (let n = 0; n < chunks; n++) {
  const part = keep.slice(n * CHUNK, (n + 1) * CHUNK);
  const col = {};
  for (const k of KEYS) col[k] = part.map(r => r[k]);
  fs.writeFileSync(path.join(DATA, 'fc-chunk-' + n + '.json'), JSON.stringify(col));
}
// лишние файлы от прежнего, большего каталога
for (let n = chunks; n < idx.chunks; n++) {
  const f = path.join(DATA, 'fc-chunk-' + n + '.json');
  if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('  удалён лишний fc-chunk-' + n + '.json'); }
}

idx.total = keep.length;
idx.chunks = chunks;
fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx));

console.log('\nзаписано чанков: ' + chunks);
console.log('fc-index.json: total=' + idx.total + ', chunks=' + idx.chunks);
