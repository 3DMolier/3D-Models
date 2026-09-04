/*
 * fix-industry-top-models.mjs - блок «Top 3D Models for …» на отраслевых страницах.
 *
 * ЧТО БЫЛО НЕ ТАК.
 *
 * 1. Две разные подписи на один адрес. На /industries/medical/ стояли
 *    «Complete Female Body Anatomy» и «Complete Female Body Anatomy Fur», и обе
 *    вели на complete-female-body-anatomy-1611038. Меховая версия склеена в
 *    основную карточку, её страница - перенаправление. Для человека это два
 *    товара, которые открывают одно и то же. Ссылка должна строиться по номеру
 *    товара, и один адрес может быть в списке только один раз.
 *
 * 2. Нерелевантные модели. На Hardware среди шести моделей стоял «ARAHO Freezer
 *    Processor Factory Trawler» - рыболовное судно. На Military & Defense рядом
 *    с подлодками и эсминцем - «Railroad Tank Car». Отбор шёл по общим продажам
 *    без оглядки на тему отрасли.
 *
 * КАК СОБИРАЕМ ТЕПЕРЬ. У каждой отрасли свой список допустимых категорий
 * (ALLOWED). Внутри него берём самые продаваемые модели, у которых есть живая
 * карточка и превью. Адрес - из номера товара, повторов быть не может.
 *
 * 3D Printing - особый случай. Туда идут только модели, чья пригодность к печати
 * проверена, а это видно по названию: оно оканчивается на «for 3D Print».
 * Категорией такое не отберёшь.
 *
 * Запуск:  node scripts/fix-industry-top-models.mjs --dry
 *          node scripts/fix-industry-top-models.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { nameOf } from './lib/taxonomy.mjs';

import { ROOT } from './lib/paths.mjs';
const IND = path.join(ROOT, 'industries');
const DRY = process.argv.includes('--dry');
const COUNT = 6;
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

// Какие категории уместны на какой отрасли. Список рукописный: отрасль - это
// не категория, и вывести одно из другого нельзя.
const ALLOWED = {
  'aerospace': ['aircraft', 'space-scifi'],
  // Без aircraft и ships: они приводят гражданский A320 на страницу об обороне.
  'military-defense': ['military-vehicles', 'weapons'],
  'medical': ['medical-3d-models'],
  'game-development': ['characters-people', 'weapons', 'space-scifi'],
  'film-video-production': ['characters-people', 'vehicles', 'architecture-landmarks'],
  // Только сама архитектура: с мебелью и светом первыми шли диско-шар и гриль.
  'architecture': ['architecture-landmarks'],
  'virtual-reality': ['characters-people', 'architecture-landmarks', 'electronics-gadgets'],
  'advertising': ['food-beverages', 'containers-storage', 'clothing-accessories'],
  'software-development': ['electronics-gadgets'],
  'event-management': ['furniture-interior', 'signage-decor', 'lighting'],
  'hardware': ['industrial-equipment', 'tools', 'electronics-gadgets'],
  'simulation': ['aircraft', 'vehicles', 'military-vehicles', 'medical-3d-models'],
  // 3d-printing отбирается не категорией, а названием - см. PRINT_RE
};

// Сколько моделей одной категории пускать в блок. Без ограничения выходит шесть
// ноутбуков подряд: сортировка по продажам даёт один и тот же верх списка, и
// отрасль перестаёт отличаться от соседней. Но и жёсткая двойка не годится: у
// Medical допустимая категория всего одна, и блок остался бы из двух карточек.
// Поэтому предел зависит от того, из скольких категорий вообще есть выбор.
const capFor = allow => (allow && allow.length > 1)
  ? Math.max(2, Math.ceil(COUNT / allow.length))
  : COUNT;
const PRINT_RE = /for\s+3d\s+print(ing)?\s*$/i;

// ── каталог ──
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
    all.push({
      id: c.i[j], name: c.n[j], price: c.p[j], sales: c.s[j],
      cat: cats[c.g[j]] || '', ic: c.ic ? c.ic[j] : -1,
    });
  }
}
all.sort((a, b) => (b.sales - a.sales) || (b.price - a.price));

function pick(slug) {
  const allow = ALLOWED[slug];
  const out = [], seen = new Set(), perCat = new Map();
  const cap = capFor(allow);
  for (const m of all) {
    if (out.length >= COUNT) break;
    if (allow) { if (!allow.includes(m.cat)) continue; }
    else if (!PRINT_RE.test(m.name)) continue;      // 3d-printing
    if ((perCat.get(m.cat) || 0) >= cap) continue;
    const dir = slugify(m.name) + '-' + m.id;
    if (seen.has(dir)) continue;                     // один адрес - одна карточка
    const file = path.join(ROOT, 'models', dir, 'index.html');
    if (!fs.existsSync(file)) continue;
    // Перенаправления не берём: иначе в списке окажется карточка, которая
    // открывает чужую страницу - ровно то, что было с меховой версией.
    const head = fs.readFileSync(file, 'utf8').slice(0, 400);
    if (/http-equiv="refresh"/i.test(head)) continue;
    const img = imgFor(m.ic, m.id);
    if (!img) continue;
    seen.add(dir);
    perCat.set(m.cat, (perCat.get(m.cat) || 0) + 1);
    out.push({ ...m, dir, img });
  }
  return out;
}

function card(m, indName) {
  return '<a href="/models/' + m.dir + '/" class="model-card">\n'
    + '      <img src="' + esc(m.img) + '" alt="' + esc(m.name) + ' 3D model - ' + esc(indName) + '"'
    + ' width="800" height="450" decoding="async" loading="lazy" data-fallback="' + esc(m.img) + '"'
    + ' data-placeholder="' + PLACEHOLDER + '" onerror="handleImageError(this)">\n'
    + '      <div class="model-card-body">\n'
    + '        <div class="model-card-name">' + esc(m.name) + '</div>\n'
    + '        <div class="model-card-price">$' + m.price + '</div>\n'
    + '      </div>\n'
    + '    </a>';
}

let pages = 0, replaced = 0, thin = 0;
for (const d of fs.readdirSync(IND, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const file = path.join(IND, d.name, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  // Границу сетки ищем счётом тегов, а не регуляркой. Внутри каждой карточки
  // есть свои </div>, и нежадный шаблон обрывался на первом же из них: старые
  // карточки оставались на месте, а новые дописывались сверху - в блоке
  // Medical получилось 11 карточек вместо шести.
  const head = h.match(/<h2 class="section-h2 section-h2--mb24">Top 3D Models for ([^<]*)<\/h2>\s*<div class="model-grid">/);
  if (!head) { console.log('  ' + d.name + ': блок не найден'); continue; }
  const indName = head[1].trim();
  const gridStart = head.index + head[0].length;
  let depth = 1, pos = gridStart;
  while (depth > 0 && pos < h.length) {
    const open = h.indexOf('<div', pos), close = h.indexOf('</div>', pos);
    if (close < 0) break;
    if (open >= 0 && open < close) { depth++; pos = open + 4; }
    else { depth--; pos = close + 6; }
  }
  if (depth !== 0) { console.log('  ' + d.name + ': не нашёл конец сетки'); continue; }
  const gridEnd = pos - 6;   // позиция закрывающего </div> сетки
  const picked = pick(d.name);
  if (picked.length < COUNT) {
    thin++;
    console.log('  ' + d.name + ': подходящих моделей только ' + picked.length + ' из ' + COUNT);
  }
  if (!picked.length) continue;

  const before = h;
  const grid = '\n' + picked.map(x => card(x, indName)).join('\n') + '\n';
  h = h.slice(0, gridStart) + grid + h.slice(gridEnd);
  if (h === before) continue;
  pages++; replaced += picked.length;
  if (!DRY) fs.writeFileSync(file, h);
  console.log('  ' + d.name + ': ' + picked.map(x => x.name).join(' | ').slice(0, 110));
}

console.log('\nстраниц отраслей обновлено: ' + pages + ', карточек поставлено: ' + replaced);
if (thin) console.log('отраслей с неполным набором: ' + thin);
if (DRY) console.log('(--dry, ничего не записано)');
