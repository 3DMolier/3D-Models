/*
 * build-licensing-sample.mjs - бесплатный образец метаданных для /data-licensing/.
 *
 * ЗАЧЕМ. Компании, которая покупает данные для обучения, ещё один рекламный
 * абзац ничего не говорит. Ей нужно посмотреть, что именно она получит.
 * Поэтому на странице лежит CSV на 100 моделей с настоящими значениями.
 *
 * ОТКУДА ДАННЫЕ. data/model-specs.json - выгрузка инвентаря студии, 1 475
 * моделей с полным набором характеристик. Берём только те, у которых заполнено
 * всё: образец с прочерками работает против нас.
 *
 * ЧЕГО В ОБРАЗЦЕ НЕТ И ПОЧЕМУ.
 *   formats  - берутся из списка загруженных файлов студии, а её API сейчас
 *              отвечает 500. Как оживёт - колонка добавится.
 *   keywords - собираются коллектором, но импортёр их пока не сохраняет.
 * Пустых колонок не ставим: пустая колонка в образце данных хуже отсутствующей,
 * она выглядит как «у них этого нет», а не «этого нет в образце».
 *
 * Запуск:  node scripts/build-licensing-sample.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const OUT = path.join(ROOT, 'assets', 'data', '3d-molier-metadata-sample-100.csv');
const N = 100;

const specs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-specs.json'), 'utf8'));
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const cats = idx.cats || [];
const meta = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    meta.set(String(c.i[j]), { name: c.n[j], price: c.p[j], sales: c.s[j], cat: cats[c.g[j]] || '' });
  }
}

const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const rows = [];
for (const [id, s] of Object.entries(specs)) {
  const m = meta.get(id);
  if (!m) continue;                              // нет в каталоге - нет и страницы
  // Ноль текстур - это данные, а не пропуск: у части моделей их и нет.
  // Поэтому проверяем наличие поля, а не его «истинность».
  if (!s.polygons || !s.vertices || !s.geometry) continue;
  if (s.textures === undefined) continue;
  const slug = slugify(m.name) + '-' + id;
  if (!fs.existsSync(path.join(ROOT, 'models', slug, 'index.html'))) continue;
  rows.push({
    model_id: id,
    title: m.name,
    category: m.cat,
    polygons: s.polygons,
    vertices: s.vertices,
    geometry: s.geometry,
    rigged: s.rigged || '',
    animated: s.animated || '',
    unwrapped_uvs: s.unwrappedUVs || '',
    textures: s.textures,
    texture_sizes: (s.textureSizes || []).join(' '),
    dimensions: s.dimensions,
    price_usd: m.price,
    license_type: 'Royalty Free (TurboSquid)',
    url: 'https://3dmolierstudio.com/models/' + slug + '/',
  });
}
// Берём разнообразие, а не одну категорию: образец должен показывать охват.
rows.sort((a, b) => a.category.localeCompare(b.category) || Number(b.polygons) - Number(a.polygons));
const byCat = new Map();
for (const r of rows) {
  if (!byCat.has(r.category)) byCat.set(r.category, []);
  byCat.get(r.category).push(r);
}
const picked = [];
let pass = 0;
while (picked.length < N && pass < 50) {
  for (const [, list] of byCat) {
    if (picked.length >= N) break;
    if (list[pass]) picked.push(list[pass]);
  }
  pass++;
}

const cols = Object.keys(picked[0] || {});
const q = v => {
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = [cols.join(','), ...picked.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n') + '\r\n';

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, csv, 'utf8');

console.log('подходящих моделей: ' + rows.length + ' из ' + Object.keys(specs).length);
console.log('в образец взято: ' + picked.length + ' из ' + byCat.size + ' категорий');
console.log('колонок: ' + cols.length + '  ' + cols.join(', '));
console.log('файл: ' + OUT + '  ' + Math.round(csv.length / 1024) + ' КБ');
