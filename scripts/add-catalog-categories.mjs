/*
 * add-catalog-categories.mjs - категория каждой модели в данных каталога.
 *
 * ЗАЧЕМ. На /catalog/ фильтров два: цена и сертификат. Категории среди них нет,
 * и это не забытая кнопка - в данных каталога категории просто не существует.
 * Колонки в fc-chunk-*.json: i (номер TurboSquid), n (название), p (цена),
 * s (продажи), c (сертификат). Буква c - это cert, а не category; на это легко
 * купиться и решить, что данные уже есть.
 *
 * Откуда берём. Единственное место, где категория модели записана честно, -
 * хлебные крошки её собственной страницы: <a class="mp-bc-link">Home … href=
 * "/categories/<слаг>/". Их и читаем. Ничего не выдумываем: если крошки нет,
 * модель остаётся без категории и в фильтр не попадает, а число таких моделей
 * печатается - молчаливая потеря хуже видимой.
 *
 * Что пишем. В каждый чанк добавляется массив g - номер категории в общем
 * списке, по одному на модель, в том же порядке, что и остальные колонки. Сам
 * список кладём в fc-index.json полем cats. Так на клиенте не появляется ни
 * одного лишнего запроса: категория приезжает вместе с чанком.
 *
 * Запуск:  node scripts/add-catalog-categories.mjs --dry
 *          node scripts/add-catalog-categories.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

// ── читаем категорию из хлебных крошек каждой живой карточки ──
const catOfId = new Map();
let live = 0, noCrumb = 0;
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const id = (d.match(/-(\d{5,})$/) || [])[1];
  if (!id) continue;
  const m = h.match(/class="mp-bc-link">Home[\s\S]{0,300}?href="\/categories\/([a-z0-9-]+)\/"/);
  if (!m) { noCrumb++; continue; }
  // Копируем строку принудительно. Результат match - это «срез» исходной строки:
  // движок хранит ссылку на родителя, и 54 тысячи таких срезов удерживают в
  // памяти 54 тысячи страниц целиком. Первый прогон на этом и упал.
  catOfId.set(id, (' ' + m[1]).slice(1));
}
console.log('живых карточек ' + live + ', с категорией ' + catOfId.size + ', без крошек ' + noCrumb);

// Список категорий берём из счётчиков: это тот же порядок, что на /categories/.
const counts = JSON.parse(fs.readFileSync(path.join(DATA, 'category-counts.json'), 'utf8'));
const cats = Object.keys(counts.counts || {});
const catIndex = new Map(cats.map((c, i) => [c, i]));
// Категория, встреченная в крошках, но отсутствующая в списке, - это рассинхрон,
// а не повод молча её потерять.
const unknown = new Map();
for (const c of catOfId.values()) if (!catIndex.has(c)) unknown.set(c, (unknown.get(c) || 0) + 1);
if (unknown.size) {
  console.log('категории из крошек, которых нет в category-counts.json:');
  for (const [c, n] of unknown) console.log('  ' + c + '  ' + n + ' моделей');
}

// ── раскладываем по чанкам ──
const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
let tagged = 0, missed = 0;
const perCat = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const file = path.join(DATA, 'fc-chunk-' + k + '.json');
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const g = new Array(c.i.length);
  for (let j = 0; j < c.i.length; j++) {
    const slug = catOfId.get(String(c.i[j]));
    const gi = slug !== undefined && catIndex.has(slug) ? catIndex.get(slug) : -1;
    g[j] = gi;
    if (gi < 0) missed++; else { tagged++; perCat.set(gi, (perCat.get(gi) || 0) + 1); }
  }
  c.g = g;
  if (!DRY) fs.writeFileSync(file, JSON.stringify(c));
}
idx.keys = ['i', 'n', 'p', 's', 'c', 'g'];
idx.cats = cats;
if (!DRY) fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx, null, 1));

console.log('\nмоделей с категорией в каталоге: ' + tagged + ', без категории: ' + missed);
console.log('по категориям:');
for (const [gi, n] of [...perCat.entries()].sort((a, b) => b[1] - a[1]))
  console.log('  ' + String(n).padStart(6) + '  ' + cats[gi]);
if (DRY) console.log('\n(--dry, ничего не записано)');
