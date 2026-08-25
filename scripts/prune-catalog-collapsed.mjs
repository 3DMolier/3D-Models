/*
 * prune-catalog-collapsed.mjs - убрать из данных каталога модели, которые уже
 * свёрнуты в другую карточку.
 *
 * Что не так. Объединение вариантов удалило 5 557 страниц и поставило на их
 * место перенаправления, но список каталога (data/fc-chunk-*.json) собирался
 * раньше и об этом не знает. В сетке остаются 5 603 плитки, которые ведут на
 * перенаправление: посетитель видит один и тот же товар несколько раз, а
 * счётчик над сеткой завышает каталог на пять с половиной тысяч.
 *
 * Хабы категорий, browse-индекс, сайтмапы и catalog.json после объединения
 * пересобираются своими скриптами - а этот набор данных остался без хозяина.
 *
 * Признак живой карточки берём с диска, а не из карты объединений: карта знает
 * только про свои свёртки, а страница могла исчезнуть и по другой причине.
 *
 * Сеть не нужна: всё берётся из файлов сайта.
 *
 * Запуск:
 *   node prune-catalog-collapsed.mjs --dry
 *   node prune-catalog-collapsed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

// Идентификаторы моделей, у которых на диске лежит настоящая карточка.
const live = new Set();
let dirs = 0, stubs = 0;
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  const m = slug.match(/-(\d{5,})$/);
  if (!m) continue;
  dirs++;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h)) { stubs++; continue; }
  live.add(m[1]);
}
console.log('каталогов моделей:   ' + dirs);
console.log('  перенаправлений:   ' + stubs);
console.log('  живых карточек:    ' + live.size);

const idxFile = path.join(DATA, 'fc-index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
const KEYS = idx.keys;
const SIZE = idx.chunk_size;

// Собираем все строки подряд, чтобы потом разложить их обратно ровными кусками:
// клиент вычисляет номер куска делением позиции на chunk_size, и «дырявые»
// куски сломали бы пагинацию.
const rows = [];
for (let i = 0; i < idx.chunks; i++) {
  const f = path.join(DATA, 'fc-chunk-' + i + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let k = 0; k < d[KEYS[0]].length; k++) rows.push(KEYS.map(key => d[key][k]));
}
const before = rows.length;
// Один товар был записан дважды - «Blackbeard Hypersonic Missile Launcher
// with Castelion Missiles Rigged». В сетке он показывался двумя плитками.
const seenId = new Set();
let dup = 0;
const kept = rows.filter(r => {
  const id = String(r[0]);
  if (!live.has(id)) return false;
  if (seenId.has(id)) { dup++; return false; }
  seenId.add(id);
  return true;
});
console.log('\nзаписей в каталоге:  ' + before);
console.log('  свёрнуты, убираем: ' + (before - kept.length - dup));
console.log('  повторы, убираем:  ' + dup);
console.log('  остаётся:          ' + kept.length);

if (before === kept.length) { console.log('\nчистить нечего'); process.exit(0); }

const chunks = Math.ceil(kept.length / SIZE);
if (DRY) {
  console.log('\nПРОБНЫЙ ПРОГОН: кусков станет ' + chunks + ' (было ' + idx.chunks + ')');
  process.exit(0);
}

for (let i = 0; i < Math.max(chunks, idx.chunks); i++) {
  const f = path.join(DATA, 'fc-chunk-' + i + '.json');
  if (i >= chunks) { if (fs.existsSync(f)) fs.unlinkSync(f); continue; }
  const slice = kept.slice(i * SIZE, (i + 1) * SIZE);
  const out = {};
  KEYS.forEach((key, k) => { out[key] = slice.map(r => r[k]); });
  fs.writeFileSync(f, JSON.stringify(out));
}
idx.total = kept.length;
idx.chunks = chunks;
fs.writeFileSync(idxFile, JSON.stringify(idx));
console.log('\nзаписано: fc-index.json total ' + before + ' -> ' + kept.length
  + ', кусков ' + chunks);
console.log('\nДАЛЬШЕ: обновить числа на страницах, где каталог посчитан вручную -');
console.log('  /catalog/, /search/, /about/, /custom-order/, /data-licensing/');
