/*
 * reclassify-models.mjs - точечная чистка категорий (пункт 7 списка).
 *
 * ЧТО НЕ ТАК. В «Vehicles» лежат авиационный двигатель, ручка управления
 * вертолётом, салон Boeing 737, телебашня Tokyo Skytree, спасательный круг,
 * позиция ЗРК THAAD и девять гидроцилиндров. Основатель перечислил их сам, и
 * проверка подтвердила каждый пример. Для поиска это размывает тему страницы:
 * он пытается понять, о чём /categories/vehicles/, и находит там здания и
 * авиадетали.
 *
 * ПОЧЕМУ ПРАВИЛА УЗКИЕ. Широкий классификатор по ключевым словам уже
 * проверялся на всём каталоге: из 531 «подозрительной» модели почти все лежали
 * ПРАВИЛЬНО - «Bell Motorcycle Helmet» это шлем, а не мотоцикл, «Laptop Bag»
 * это сумка, а не ноутбук. Категория приходит из настоящей классификации
 * TurboSquid и надёжнее любой эвристики по названию. Поэтому здесь правило
 * срабатывает только внутри одной названной категории и только на однозначном
 * словосочетании. Затронуто около 120 моделей из 54 079, а не «5-10% на
 * дополнительную проверку».
 *
 * ЧТО МЕНЯЕТСЯ.
 *   data/category-overrides.json  - решение сохраняется отдельным файлом,
 *                                   чтобы следующая пересборка страниц
 *                                   категорий его не затёрла;
 *   data/fc-chunk-*.json          - колонка g, от неё зависят фильтр каталога,
 *                                   выдача поиска и отбор в подкатегории;
 *   карточка модели               - хлебные крошки, чип категории и разметка
 *                                   дорожки.
 *
 * ЧТО НЕ МЕНЯЕТСЯ. Готовые страницы категорий: они собраны генератором
 * build-category-hubs.mjs, который берёт категорию из отчёта о продажах.
 * Пока их не пересобрали, перенесённая модель ещё видна в старом списке.
 * Генератор научен читать overrides, так что после ближайшей пересборки
 * списки сойдутся.
 *
 * Запуск:  node scripts/reclassify-models.mjs --dry
 *          node scripts/reclassify-models.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

// [откуда, куда, [однозначные словосочетания]]
const RULES = [
  ['vehicles', 'aircraft', ['aircraft engine', 'turboprop', 'jet engine', 'helicopter cyclic',
    'helicopter control', 'cockpit', 'boeing', 'airbus', 'airliner', 'fuselage', 'landing gear']],
  ['vehicles', 'industrial-equipment', ['hydraulic cylinder', 'hydraulic cylinders', 'gearbox', 'industrial pump']],
  ['vehicles', 'architecture-landmarks', ['broadcasting tower', 'skytree', 'observation tower', 'lighthouse']],
  ['vehicles', 'ships', ['life saving buoy', 'lifebuoy', 'life buoy', 'ship propeller']],
  ['vehicles', 'weapons', ['battle position', 'missile launcher', 'anti ballistic']],
];

const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcher = terms => new RegExp('(^|[^a-z0-9])(' + terms.map(escRe).join('|') + ')([^a-z0-9]|$)', 'i');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const cats = idx.cats;

// Человеческое имя категории берём с её страницы - выдумывать не надо.
const dispOf = new Map();
for (const c of cats) {
  let t = c.replace(/-3d-models$/, '').replace(/-/g, ' ');
  try {
    const h = fs.readFileSync(path.join(ROOT, 'categories', c, 'index.html'), 'utf8');
    const h1 = (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
    if (h1) t = h1.replace(/<[^>]+>/g, '').replace(/\s*3D\s+Models?\s*$/i, '').trim();
  } catch (e) { /* нет страницы */ }
  dispOf.set(c, (' ' + t).slice(1));
}

// ── кого переносим ──
const moves = new Map();          // id -> {name, from, to}
const chunks = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  chunks.push(c);
  for (let j = 0; j < c.i.length; j++) {
    const g = c.g[j];
    if (g < 0) continue;
    const now = cats[g], name = String(c.n[j]);
    for (const [from, to, terms] of RULES) {
      if (now !== from) continue;
      if (!matcher(terms).test(name)) continue;
      moves.set(String(c.i[j]), { name: (' ' + name).slice(1), from, to });
      c.g[j] = cats.indexOf(to);
      break;
    }
  }
}
console.log('моделей к переносу: ' + moves.size);
const byPair = new Map();
for (const m of moves.values()) {
  const k = m.from + ' -> ' + m.to;
  byPair.set(k, (byPair.get(k) || 0) + 1);
}
for (const [k, n] of [...byPair.entries()].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k);

// ── карточки ──
let cardsFixed = 0, cardsMissing = 0;
for (const [id, m] of moves) {
  const slug = slugify(m.name) + '-' + id;
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) { cardsMissing++; continue; }
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const toDisp = esc(dispOf.get(m.to) || m.to);

  // дорожка
  h = h.replace(/<a href="\/categories\/[a-z0-9-]+\/" class="mp-bc-link">[^<]*<\/a>/,
    () => '<a href="/categories/' + m.to + '/" class="mp-bc-link">' + toDisp + '</a>');
  // строка «Category» в таблице характеристик
  h = h.replace(/(>Category<\/th><td[^>]*>)([\s\S]*?)(<\/td>)/,
    (x, a, inner, b) => a + inner.replace(/href="\/categories\/[a-z0-9-]+\/"/, 'href="/categories/' + m.to + '/"')
      .replace(/>([^<>]+)<\/a>/, '>' + toDisp + '</a>') + b);
  // разметка дорожки
  h = h.replace(/("item":"https:\/\/3dmolierstudio\.com\/categories\/)[a-z0-9-]+(\/")/,
    (x, a, b) => a + m.to + b);

  if (h !== before) { cardsFixed++; if (!DRY) fs.writeFileSync(file, h); }
}

// ── запись ──
if (!DRY) {
  for (let k = 0; k < chunks.length; k++) {
    fs.writeFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), JSON.stringify(chunks[k]));
  }
  const overrides = {};
  for (const [id, m] of moves) overrides[id] = m.to;
  fs.writeFileSync(path.join(DATA, 'category-overrides.json'), JSON.stringify(overrides, null, 1));
}

console.log('карточек поправлено: ' + cardsFixed + (cardsMissing ? ', не найдено на диске: ' + cardsMissing : ''));
console.log('решение сохранено в data/category-overrides.json');
if (DRY) console.log('(--dry, ничего не записано)');
