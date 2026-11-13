/*
 * rehash-lastmod-images.mjs - разовый перенос журнала дат (data/page-lastmod.json) на правило 13.11.2026:
 * картинки, предзагрузка, preconnect, rel="sponsored" и асинхронные шрифты не содержимое (lib/lastmod.mjs).
 *
 * Запускать ДО пересборки страниц. Для каждой записи журнала:
 *   страница на диске по старому правилу даёт тот же хеш, что в журнале -> хеш пересчитывается по новому, дата та же;
 *   не совпало (страницу уже меняли: ночные тексты, ручные правки) -> то же сравнение с опубликованной версией (HEAD);
 *   не совпало и там -> запись не трогаем: следующая сборка честно поставит новую дату.
 * Кеш mtime (data/.page-lastmod-mtime.json) удаляется - сборка перечитает страницы.
 *
 *   node scripts/rehash-lastmod-images.mjs --dry
 *   node scripts/rehash-lastmod-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/paths.mjs';
import { hashBody } from './lib/lastmod.mjs';

const DRY = process.argv.includes('--dry');
const store = path.join(ROOT, 'data', 'page-lastmod.json');
const map = JSON.parse(fs.readFileSync(store, 'utf8'));
const st = { disk: 0, head: 0, changed: 0, missing: 0, same: 0 };
const pending = [];
for (const [k, v] of Object.entries(map)) {
  const [date, hash] = Array.isArray(v) ? v : [v.date, v.hash];
  const f = path.join(ROOT, k);
  if (!fs.existsSync(f)) { st.missing++; continue; }
  const isModel = k.startsWith('models/');
  const body = fs.readFileSync(f);
  if (hashBody(body, undefined, isModel, false) === hash) {
    const nh = hashBody(body, undefined, isModel, true);
    if (nh === hash) st.same++; else { map[k] = [date, nh]; st.disk++; }
  } else pending.push([k, date, hash, isModel]);
}
// Несовпавшие - сверяем с опубликованной версией.
for (const [k, date, hash, isModel] of pending) {
  let body;
  try { body = execFileSync('git', ['show', 'HEAD:' + k], { cwd: ROOT, maxBuffer: 1 << 27 }); } catch { st.changed++; continue; }
  if (hashBody(body, undefined, isModel, false) === hash) { map[k] = [date, hashBody(body, undefined, isModel, true)]; st.head++; }
  else st.changed++;
}
console.log(`записей ${Object.keys(map).length}: пересчитано по диску ${st.disk}, по HEAD ${st.head}, хеш не изменился ${st.same}, `
  + `страница уже другая (дата сдвинется честно) ${st.changed}, файла нет ${st.missing}`);
if (DRY) process.exit(0);
const keys = Object.keys(map).sort();
fs.writeFileSync(store, '{\n' + keys.map(k => `${JSON.stringify(k)}:${JSON.stringify(map[k])}`).join(',\n') + '\n}\n', 'utf8');
try { fs.unlinkSync(path.join(ROOT, 'data', '.page-lastmod-mtime.json')); } catch { }
console.log('журнал записан, кеш mtime удалён');
