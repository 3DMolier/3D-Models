/*
 * rename-collections-sets.mjs - «Collections & Sets» -> «Model Bundles & Sets».
 *
 * ПУНКТ 8 СПИСКА. На сайте две разные сущности назывались почти одинаково:
 *   /collections/                  - тематические подборки
 *   /categories/collections-sets/  - категория «наборы моделей»
 * Для человека разница не очевидна, а для поиска это два конкурирующих
 * названия на один смысл. Категорию переименовываем в «Model Bundles & Sets».
 *
 * Адрес НЕ трогаем. Слаг collections-sets остаётся: менять его значит завести
 * ещё 4 651 перенаправление ради слова в заголовке. Меняется только то, что
 * читает человек.
 *
 * Название встречается не только на самой категории: оно стоит в меню на
 * каждой странице и в чипе под каждой карточкой этой категории - всего около
 * 165 тысяч мест. Поэтому проход по всему сайту, а не по одной папке.
 *
 * Запуск:  node scripts/rename-collections-sets.mjs --dry
 *          node scripts/rename-collections-sets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');

// Порядок важен: сначала мнемоника, потом голый амперсанд, иначе второй
// вариант съест часть первого.
const PAIRS = [
  ['Collections &amp; Sets', 'Model Bundles &amp; Sets'],
  ['Collections & Sets', 'Model Bundles & Sets'],
];

const targets = [];
(function walk(rel, depth) {
  if (depth > 5) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name.startsWith('.')) continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) { walk(nx, depth + 1); continue; }
    if (/\.(html|js)$/.test(it.name)) targets.push(nx);
  }
})('', 0);

let files = 0, hits = 0;
for (const rel of targets) {
  const file = path.join(ROOT, rel);
  const h = fs.readFileSync(file, 'utf8');
  let out = h, n = 0;
  for (const [from, to] of PAIRS) {
    const c = out.split(from).length - 1;
    if (c) { out = out.split(from).join(to); n += c; }
  }
  if (!n) continue;
  files++; hits += n;
  if (!DRY) fs.writeFileSync(file, out);
}

console.log('файлов изменено: ' + files + ', замен: ' + hits);
if (DRY) console.log('(--dry, ничего не записано)');
