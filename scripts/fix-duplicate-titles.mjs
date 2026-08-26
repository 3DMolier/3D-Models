/*
 * fix-duplicate-titles.mjs - одинаковые заголовки у разных моделей.
 *
 * ЧТО НАШЛИ. 539 карточек делят между собой 263 заголовка. Пять разных
 * самолётов называются «Scale Model with Stand 3D Model - $69», четыре разные
 * машины - «Subaru Outback 2025 3D Model - $129».
 *
 * ПОЧЕМУ. H1 и title собираются из УКОРОЧЕННОГО имени, у которого отброшено
 * начало - как раз то, что модель и различает. В описании при этом стоит полное
 * имя, и расхождение видно прямо на странице:
 *
 *   H1:    Scale Model with Stand
 *   desc:  Buy Boeing 737 Max 8 Scale Model with Stand 3D model...
 *
 * Для поиска это страницы-близнецы, а марка - главное слово запроса: человек
 * ищет «boeing 737 max 8 model», а не «scale model with stand».
 *
 * ЧТО ДЕЛАЕМ. Возвращаем полное имя из данных каталога - но только там, где
 * заголовок и правда повторяется. Трогать все 54 тысячи карточек ради этого
 * незачем: короткое имя само по себе читается лучше, беда только в совпадениях.
 *
 * Длина. Полное имя длиннее, и с ценой заголовок вылезает за разумные 65-70
 * знаков. В таком случае цену из заголовка убираем: марка важнее, а цена и так
 * есть на странице и в разметке товара.
 *
 * Запуск:  node scripts/fix-duplicate-titles.mjs --dry
 *          node scripts/fix-duplicate-titles.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const MAXLEN = 70;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Результат match - срез исходной строки, который держит в памяти всю страницу.
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);

// ── полные имена из каталога ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const fullName = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) fullName.set(String(c.i[j]), c.n[j]);
}

// ── кто с кем делит заголовок ──
const byTitle = new Map();
const dirs = fs.readdirSync(MODELS);
for (const d of dirs) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  const t = cp((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
  if (!t) continue;
  if (!byTitle.has(t)) byTitle.set(t, []);
  byTitle.get(t).push(cp(d));
}
const dupes = [...byTitle.entries()].filter(([, v]) => v.length > 1);
console.log('заголовков с повторами: ' + dupes.length + ', страниц в них: '
  + dupes.reduce((s, x) => s + x[1].length, 0));

let fixed = 0, noName = 0, sameAlready = 0, priceDropped = 0;
for (const [, list] of dupes) {
  for (const d of list) {
    const id = (d.match(/-(\d{5,})$/) || [])[1];
    const full = id ? fullName.get(id) : null;
    if (!full) { noName++; continue; }

    const file = path.join(MODELS, d, 'index.html');
    let h = fs.readFileSync(file, 'utf8');
    const before = h;

    const h1 = cp((h.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    if (h1 === full) { sameAlready++; continue; }

    // title: «<полное имя> 3D Model - $NN | 3D Molier», цена уходит, если длинно
    const price = cp((h.match(/<title>[\s\S]*?(- \$[\d,]+)[\s\S]*?<\/title>/) || [])[1] || '');
    let title = full + ' 3D Model' + (price ? ' ' + price : '') + ' | 3D Molier';
    if (title.length > MAXLEN && price) { title = full + ' 3D Model | 3D Molier'; priceDropped++; }

    h = h.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + esc(title) + '</title>');
    h = h.replace(/(<h1 class="mp-h1">)[\s\S]*?(<\/h1>)/, (x, a, b) => a + esc(full) + b);
    // og и twitter описывают ту же страницу
    for (const attr of ['property="og:title"', 'name="twitter:title"']) {
      const re = new RegExp('(<meta ' + attr + ' content=")[^"]*(")');
      if (re.test(h)) h = h.replace(re, (x, a, b) => a + esc(title) + b);
    }

    if (h === before) continue;
    if (!DRY) fs.writeFileSync(file, h);
    fixed++;
  }
}

console.log('карточек исправлено: ' + fixed);
console.log('  уже совпадало с полным именем: ' + sameAlready);
console.log('  цену убрали из заголовка ради длины: ' + priceDropped);
if (noName) console.log('  полного имени нет в каталоге: ' + noName);
if (DRY) console.log('(--dry, ничего не записано)');
