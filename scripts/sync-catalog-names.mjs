/*
 * sync-catalog-names.mjs - имя в каталоге берётся из записи, адрес - из папки.
 *
 * ЧТО БЫЛО НЕ ТАК. Выгрузка каталога (data/fc-chunk-*.json) хранит название
 * модели, и это название работает сразу в двух ролях:
 *   1) его видит посетитель на плитке;
 *   2) из него скрипт складывает адрес карточки: makeSlug(name) + '-' + id.
 * Две роли в одном поле связывают руки. После склейки вариантов главная
 * карточка получила новое имя - «License Plate - 8 US States», «North Korea Won
 * Banknote - 6 Denominations», - но папка осталась прежней. Поменять имя в
 * выгрузке значило сломать 5 774 адреса, поэтому имя не меняли, и каталог
 * показывал вчерашние названия: на плитке одно, на карточке другое.
 *
 * Это же место - последнее, где адрес карточки ВЫЧИСЛЯЛСЯ из названия. Правило
 * записано кровью (4 поломки за один день): адрес берут из существующей папки
 * по номеру.
 *
 * ЧТО ТЕПЕРЬ. В выгрузке появляется колонка u - адрес папки. Она разрежённая:
 * значение стоит только там, где вычисленный адрес не совпал бы с настоящим,
 * в остальных строках null, и вес выгрузки почти не растёт. Каталог и поиск
 * берут адрес из u, а к вычислению откатываются лишь для старых выгрузок.
 * После этого имя свободно: пишем в него display_name из записи.
 *
 * Ничего не публикует.
 *
 * Запуск:  node scripts/sync-catalog-names.mjs --dry
 *          node scripts/sync-catalog-names.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const RECS = path.join(DATA, 'records');
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const fmt = n => Number(n).toLocaleString('ru-RU');

// Слово в слово как в assets/js/full-catalog.js - иначе проверка врёт.
const makeSlug = (name, id) => String(name).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-').replace(/^-+|-+$/g, '') + '-' + id;

const dirs = new Set(fs.readdirSync(MODELS, { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name));

const ri = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const rec = new Map();
for (let k = 0; k < ri.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    rec.set(String(r.id), r);
  }
}
console.log('записей: ' + fmt(rec.size));

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
let renamed = 0, withSlug = 0, noRecord = 0, noDir = 0;
const ex = [];
const out = [];

for (let k = 0; k < idx.chunks; k++) {
  const f = path.join(DATA, 'fc-chunk-' + k + '.json');
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  const u = new Array(c.i.length).fill(null);
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    const r = rec.get(id);
    if (!r) { noRecord++; continue; }
    // Адрес - только настоящая папка. Если записи о папке верить нельзя
    // (её нет на диске), имя не трогаем вовсе: пусть работает старый расчёт.
    const slug = r.slug && dirs.has(r.slug) ? r.slug : null;
    if (!slug) { noDir++; continue; }
    const want = String(r.display_name || r.name || c.n[j]);
    if (slug !== makeSlug(want, id)) { u[j] = slug; withSlug++; }
    if (want !== c.n[j]) {
      if (ex.length < 8) ex.push(c.n[j] + '   ->   ' + want);
      c.n[j] = want;
      renamed++;
    }
  }
  c.u = u;
  out.push([f, c]);
}

console.log('имён обновлено из записи: ' + fmt(renamed));
console.log('строк с явным адресом (u): ' + fmt(withSlug));
console.log('без записи: ' + fmt(noRecord) + ' | папки из записи нет на диске: ' + fmt(noDir));
ex.forEach(e => console.log('    ' + e));

if (DRY) { console.log('\n(--dry, ничего не записано)'); process.exit(0); }

for (const [f, c] of out) fs.writeFileSync(f, JSON.stringify(c));
if (!idx.keys.includes('u')) {
  idx.keys.push('u');
  fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx));
  console.log('в fc-index.json добавлена колонка u');
}
console.log('выгрузка каталога переписана: ' + out.length + ' файлов');
