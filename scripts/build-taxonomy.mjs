/*
 * build-taxonomy.mjs - единый список «модель -> категория».
 *
 * ЗАЧЕМ. Категория модели жила сразу в нескольких местах: в хлебных крошках
 * карточки, в чипе под карточкой в сетке, в списке страницы категории, в
 * колонке g данных каталога. Совпадать они не обязаны были ничем, кроме
 * привычки, и разошлись. Теперь ответ один и лежит в data/model-categories.json,
 * а имена категорий - в data/taxonomy.json. Всё остальное из них генерируется.
 *
 * ОТКУДА БЕРЁМ. Основа - текущая колонка g: она собрана из хлебных крошек
 * карточек, а те, в свою очередь, из классификации TurboSquid. Это самый
 * надёжный из имеющихся источников: проверка 531 «подозрительной» модели
 * показала, что почти все лежат правильно.
 *
 * Поверх основы ложатся ручные исправления из data/category-overrides.json.
 * Туда попадает то, что проверено глазами, а не выведено правилом.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Правила «один тип товара - одна категория». Проверено: из
 * 315 типов, размазанных по категориям, почти все размазаны ЗАКОННО. Коробка
 * на кухне, коробка на складе и коробка под товар - разные вещи; шлем боевой,
 * спортивный и пробковый - тоже. Поэтому исправляются только однозначные
 * случаи, и каждый записывается в overrides поимённо.
 *
 * Запуск:  node scripts/build-taxonomy.mjs --dry
 *          node scripts/build-taxonomy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, catBySlug } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

// Однозначные исправления. Формат: [откуда, куда, [словосочетания], [исключения]].
// Каждое правило - про конкретный предмет, а не про общий признак.
const FIXES = [
  // Пробковый шлем - головной убор колониальной эпохи, а не оружие и не
  // защитное снаряжение. Девять таких лежали в Weapons, десятый - в Clothing.
  ['weapons', 'clothing-accessories', ['pith helmet', 'pith helmets']],
  // Прожектор - светильник. Лежали в Vehicles и в Tools.
  ['vehicles', 'lighting', ['searchlight', 'searchlights']],
  ['tools', 'lighting', ['searchlight', 'searchlights']],
];

const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcher = terms => new RegExp('(^|[^a-z0-9])(' + terms.map(escRe).join('|') + ')([^a-z0-9]|$)', 'i');

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const oldCats = idx.cats || [];

const overFile = path.join(DATA, 'category-overrides.json');
const overrides = fs.existsSync(overFile) ? JSON.parse(fs.readFileSync(overFile, 'utf8')) : {};
const overBefore = Object.keys(overrides).length;

// ── читаем текущее состояние и применяем правила ──
const chunks = [];
/*
 * Категории из записей моделей - единственное место, где известна категория
 * модели, ещё не попавшей в колонку g каталога.
 */
const RECORD_CAT = (() => {
  const out = {};
  const f = path.join(DATA, "records", "index.json");
  if (!fs.existsSync(f)) return out;
  const ix = JSON.parse(fs.readFileSync(f, "utf8"));
  for (let k = 0; k < ix.chunks; k++) {
    for (const r of JSON.parse(fs.readFileSync(path.join(DATA, "records", "records-" + k + ".json"), "utf8"))) {
      if (r.category) out[String(r.id)] = r.category;
    }
  }
  return out;
})();

const modelCat = {};
let fixed = 0;
const fixLog = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  chunks.push(c);
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    /*
     * Порядок источников: ручное решение -> запись модели -> прежний код в
     * каталоге -> «other».
     *
     * ЗАЧЕМ ДОБАВЛЕНА ЗАПИСЬ. Здесь был замкнутый круг: таксономия берёт
     * категорию из колонки g каталога, а новые модели попадают в каталог без
     * неё. Выходило «other», это записывалось в единый источник, и на
     * следующей сборке «other» побеждал настоящую категорию из отчёта
     * TurboSquid - 581 новая карточка оказалась бы заперта в «Other» навсегда.
     *
     * Запись категорию знает, поэтому спрашиваем её. Ручные решения выше
     * всего: они проверены глазами.
     */
    let slug = overrides[id] || RECORD_CAT[id] || oldCats[c.g[j]] || 'other';
    const name = String(c.n[j]);
    for (const [from, to, terms, not] of FIXES) {
      if (slug !== from) continue;
      if (!matcher(terms).test(name)) continue;
      if (not && matcher(not).test(name)) continue;
      slug = to;
      overrides[id] = to;                 // запоминаем поимённо
      fixed++;
      const key = from + ' -> ' + to;
      if (!fixLog.has(key)) fixLog.set(key, []);
      if (fixLog.get(key).length < 3) fixLog.get(key).push(name);
      break;
    }
    modelCat[id] = slug;
  }
}

// ── сверяем со словарём категорий ──
const unknown = new Map();
for (const s of Object.values(modelCat)) if (!catBySlug(s)) unknown.set(s, (unknown.get(s) || 0) + 1);
if (unknown.size) {
  console.log('ВНИМАНИЕ: категории, которых нет в taxonomy.json:');
  for (const [s, n] of unknown) console.log('  ' + s + '  ' + n + ' моделей');
}

// ── переписываем колонку g строго по id из taxonomy.json ──
let regen = 0;
for (const c of chunks) {
  for (let j = 0; j < c.i.length; j++) {
    const slug = modelCat[String(c.i[j])];
    const cat = catBySlug(slug);
    const want = cat ? cat.id : -1;
    if (c.g[j] !== want) { c.g[j] = want; regen++; }
  }
}

console.log('моделей в списке: ' + Object.keys(modelCat).length);
console.log('исправлено правилами: ' + fixed);
for (const [k, ex] of fixLog) console.log('  ' + k + '  ' + ex.join(' | '));
console.log('значений g переписано: ' + regen);
console.log('ручных исправлений было ' + overBefore + ', стало ' + Object.keys(overrides).length);

const counts = {};
for (const s of Object.values(modelCat)) counts[s] = (counts[s] || 0) + 1;

if (!DRY) {
  fs.writeFileSync(path.join(DATA, 'model-categories.json'), JSON.stringify(modelCat));
  fs.writeFileSync(overFile, JSON.stringify(overrides, null, 1));
  for (let k = 0; k < chunks.length; k++) {
    fs.writeFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), JSON.stringify(chunks[k]));
  }
  // cats в индексе - производная от taxonomy.json, порядок по id.
  idx.cats = CATEGORIES.slice().sort((a, b) => a.id - b.id).map(c => c.slug);
  fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx, null, 1));
  // счётчики тоже отсюда, чтобы не разошлись с реальностью
  fs.writeFileSync(path.join(DATA, 'category-counts.json'),
    JSON.stringify({ total: Object.keys(modelCat).length, counts }, null, 1));
}

console.log('\nпо категориям:');
for (const [s, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
  console.log('  ' + String(n).padStart(6) + '  ' + s);
if (DRY) console.log('\n(--dry, ничего не записано)');
