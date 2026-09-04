/*
 * fix-3d-printing-page.mjs - правки страницы /industries/3d-printing/.
 *
 * По списку правок основателя, раздел 9:
 *
 * 1. Пустой блок «Available Categories». В разметке есть заголовок и пустой
 *    <div class="ind-cat-list"></div> - читатель видит заголовок, под ним
 *    ничего, и сразу «Supported Formats». Настоящий баг шаблона.
 *
 *    Категории берём НЕ на глаз, а по факту: модели, у которых название
 *    заканчивается на «for 3D Print», и категория из их хлебных крошек.
 *    Таких моделей 111. Показываем категории, где их не меньше трёх, и
 *    служебную «other» не показываем.
 *
 * 2. H1 «3D Printing 3D Models» - набор ключевых слов. Меняем на
 *    «3D Models for 3D Printing»: это и естественнее, и ближе к тому, что
 *    человек действительно ищет.
 *
 * 3. Обещание «Production-ready». Чистая топология не делает модель готовой к
 *    печати: нужны watertight geometry, manifold mesh, толщина стенок, корректные
 *    нормали, масштаб. Обещать это всему каталогу нельзя. Формулировка меняется
 *    на «Selected models suitable for 3D printing and prototyping».
 *
 * Запуск:  node scripts/fix-3d-printing-page.mjs --dry
 *          node scripts/fix-3d-printing-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const FILE = path.join(ROOT, 'industries', '3d-printing', 'index.html');
const DRY = process.argv.includes('--dry');
const MIN = 3;

// ── считаем, что реально пригодно для печати ──
const counts = new Map();
let total = 0;
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  const raw = (h.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1];
  if (!raw) continue;
  const name = raw.replace(/<[^>]+>/g, '').trim();
  if (!/for\s+3d\s+print(ing)?\s*$/i.test(name)) continue;
  total++;
  const m = h.match(/class="mp-bc-link">Home[\s\S]{0,300}?href="\/categories\/([a-z0-9-]+)\/"/);
  if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
}
console.log('моделей «for 3D Print»: ' + total);

// человеческие названия категорий берём с самих страниц категорий
const picked = [...counts.entries()]
  .filter(([slug, n]) => n >= MIN && slug !== 'other')
  .sort((a, b) => b[1] - a[1])
  .map(([slug, n]) => {
    let title = slug;
    try {
      const ch = fs.readFileSync(path.join(ROOT, 'categories', slug, 'index.html'), 'utf8');
      const h1 = (ch.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
      if (h1) title = h1.replace(/<[^>]+>/g, '').trim();
    } catch (e) { /* нет страницы - оставим слаг */ }
    // У одних категорий в H1 стоит «&», у других уже «&amp;». Если вставить как
    // есть, в блоке рядом окажутся «Animal & Creature» и «Signage &amp; Decor».
    // Сначала раскрываем мнемоники, потом экранируем ровно один раз.
    const plain = title
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    title = plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { slug, n, title, plain };
  });
console.log('категорий в блок: ' + picked.length);
for (const p of picked) console.log("  " + String(p.n).padStart(3) + "  " + p.plain);

const list = picked
  .map(p => '<a href="/categories/' + p.slug + '/" class="ind-cat-link">' + p.title + '</a>\n<br>\n')
  .join('');

let h = fs.readFileSync(FILE, 'utf8');
const before = h;

// 1. заполняем пустой блок
h = h.replace(/(<div class="ind-cat-list">)\s*(<\/div>)/, (m, a, b) => a + '\n' + list + b);

// 2. H1 и title
h = h.replace(/(<h1[^>]*>)3D Printing 3D Models(<\/h1>)/, (m, a, b) => a + '3D Models for 3D Printing' + b);
const T = '3D Models for 3D Printing &amp; Prototyping | 3D Molier';
h = h.replace(/<title>[\s\S]*?<\/title>/, '<title>' + T + '</title>');
h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, b) => a + T + b);
h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, b) => a + T + b);

// 3. снимаем обещание готовности к печати со всего каталога
const D = 'Selected models suitable for 3D printing and prototyping: clean topology, '
  + 'real-world scale and formats that slicers read without conversion.';
h = h.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + D + b);
h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, b) => a + D + b);
h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, b) => a + D + b);
h = h.replace(/Production-ready 3D assets with clean topology and real-world scale for 3D printing services, rapid prototyping, product visualization and additive manufacturing workflows\./g,
  'Selected models suitable for 3D printing and prototyping. Clean topology and real-world scale; '
  + 'print readiness - watertight geometry, wall thickness, normals - is noted per model where it has been checked.');

if (h !== before) {
  console.log('\ndescription: ' + D.length + ' симв., title: ' + T.replace(/&amp;/g, '&').length);
  if (!DRY) fs.writeFileSync(FILE, h);
  console.log(DRY ? 'страница НЕ записана (--dry)' : 'страница обновлена');
} else {
  console.log('\nничего не изменилось - проверь шаблоны замен');
}
