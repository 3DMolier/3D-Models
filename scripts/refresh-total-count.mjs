/*
 * refresh-total-count.mjs - размер каталога, вписанный в разметку.
 *
 * ЗАЧЕМ ЕЩЁ ОДИН. refresh-site-counts.mjs знает шесть страниц и свои шаблоны
 * фраз; всё, что записано иначе, он обходит и честно рапортует «уже верно».
 * После склейки восьми карточек кои и починки сорока шести промахнувшихся
 * склеек живых страниц стало 54 025, а в разметке сорока страниц осталось
 * 54 077 - в заголовке каталога, в подписях кнопок, в разметке schema.org.
 *
 * Здесь проще и надёжнее: берём ПРЕЖНЕЕ число из аргумента, новое - из
 * data/fc-index.json (единственный источник размера каталога) и меняем всюду,
 * в обоих написаниях - с разделителем разрядов и без.
 *
 * Запуск:  node scripts/refresh-total-count.mjs 54077 --dry
 *          node scripts/refresh-total-count.mjs 54077
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const OLD = process.argv[2];
if (!/^\d+$/.test(OLD || '')) { console.log('укажи прежнее число: node scripts/refresh-total-count.mjs 54077'); process.exit(1); }

const NEW = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8')).total);
const grp = n => Number(n).toLocaleString('en-US');
if (OLD === NEW) { console.log('число не изменилось: ' + grp(NEW)); process.exit(0); }
console.log('было ' + grp(OLD) + '  ->  стало ' + grp(NEW));

const files = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === '.git' || it.name === '.tmp') continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) walk(nx);
    else if (/\.(html|xml|json)$/.test(it.name)) files.push(nx);
  }
})('');

const reGrouped = new RegExp(grp(OLD).replace(',', ','), 'g');
const rePlain = new RegExp('\\b' + OLD + '\\b', 'g');
let pages = 0, hits = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  const n = (h.match(reGrouped) || []).length + (h.match(rePlain) || []).length;
  if (!n) continue;
  const out = h.replace(reGrouped, grp(NEW)).replace(rePlain, NEW);
  pages++; hits += n;
  if (!DRY) fs.writeFileSync(file, out);
}
console.log('страниц: ' + pages.toLocaleString('ru-RU') + ', вхождений заменено: ' + hits.toLocaleString('ru-RU'));
if (DRY) console.log('(--dry, ничего не записано)');
