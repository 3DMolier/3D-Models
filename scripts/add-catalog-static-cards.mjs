/*
 * add-catalog-static-cards.mjs - живые карточки в разметке /catalog/.
 *
 * ПУНКТ 4 СПИСКА. Сейчас в разметке каталога 24 пустых «скелета» и всего шесть
 * ссылок на модели. Всё остальное рисует скрипт. Значит без JS страница почти
 * пуста, а robots видит каталог на 54 079 моделей как страницу с шестью
 * ссылками. Обход к карточкам идёт через /browse/ и страницы категорий, но
 * сам каталог в этой цепочке не участвует, хотя он - главная страница раздела.
 *
 * ЧТО ДЕЛАЕМ. На место скелетов ставим 48 настоящих карточек - самые продаваемые,
 * с картинками, ценами и ссылками. Скрипт при первой отрисовке перезаписывает
 * содержимое сетки, поэтому для человека с JS ничего не меняется: он увидит
 * обычную ленту. Меняется только то, что получает робот и человек без JS.
 *
 * Плюс ссылка на /browse/ рядом с сеткой: оттуда доступны все 54 079 карточек
 * постранично, без единой строчки скрипта.
 *
 * Запуск:  node scripts/add-catalog-static-cards.mjs --dry
 *          node scripts/add-catalog-static-cards.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const FILE = path.join(ROOT, 'catalog', 'index.html');
const DRY = process.argv.includes('--dry');
const COUNT = 48;
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const cats = idx.cats || [];
const imgCache = new Map();
const imgFor = (ic, id) => {
  if (ic < 0) return '';
  if (!imgCache.has(ic)) {
    const f = path.join(ROOT, 'data', 'fc-img-chunk-' + ic + '.json');
    imgCache.set(ic, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
  }
  return imgCache.get(ic)[String(id)] || '';
};

const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    all.push({ id: c.i[j], name: c.n[j], price: c.p[j], sales: c.s[j], cat: cats[c.g[j]] || '', ic: c.ic ? c.ic[j] : -1 });
  }
}
all.sort((a, b) => (b.sales - a.sales) || (b.price - a.price));

const picked = [];
for (const m of all) {
  if (picked.length >= COUNT) break;
  const slug = slugify(m.name) + '-' + m.id;
  if (!fs.existsSync(path.join(ROOT, 'models', slug, 'index.html'))) continue;
  const img = imgFor(m.ic, m.id);
  if (!img) continue;
  picked.push({ ...m, slug, img });
}

const catDisp = s => s.replace(/-3d-models$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const card = (m, i) => {
  const load = i < 4 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return '<a href="/models/' + m.slug + '/" class="model-card card-glow">'
    + '<div class="img-wrap mc-img"><img src="' + esc(m.img) + '" alt="' + esc(m.name) + ' 3D model preview" '
    + 'width="800" height="450" decoding="async" ' + load + ' data-placeholder="' + PLACEHOLDER + '" onerror="imgErr(this)">'
    + '<div class="img-placeholder" aria-hidden="true"><span class="mc-ph-icon">&#128247;</span></div></div>'
    + '<div class="mc-body"><div class="mc-meta"><h3 class="mc-title">' + esc(m.name) + '</h3></div>'
    + '<div class="mc-foot"><span class="chip mc-chip">' + esc(catDisp(m.cat)) + '</span>'
    + '<span class="mc-price">$' + m.price + '</span></div></div></a>';
};

let h = fs.readFileSync(FILE, 'utf8');
const before = h;

// Меняем блок скелетов на настоящие карточки.
const gridRe = /(<div id="model-grid"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>)/;
const m = h.match(gridRe);
if (!m) throw new Error('не найдена сетка #model-grid');
h = h.replace(gridRe, (x, open, inner, close) => open + '\n' + picked.map(card).join('\n') + '\n' + close);

// Ссылка на постраничный обход - путь ко всем карточкам без скрипта.
if (!h.includes('/browse/1/')) {
  h = h.replace(/(<div id="model-grid")/,
    '<p class="cat-desc" style="margin-bottom:16px;">Showing the ' + COUNT + ' best-selling models. '
    + '<a href="/browse/1/">Browse all 54,079 models page by page &#8594;</a></p>\n$1');
}

if (h === before) { console.log('ничего не изменилось'); process.exit(0); }
if (!DRY) fs.writeFileSync(FILE, h);
console.log('в разметку каталога поставлено карточек: ' + picked.length);
console.log('ссылок на модели теперь: ' + ((h.match(/href="\/models\//g) || []).length));
if (DRY) console.log('(--dry, ничего не записано)');
