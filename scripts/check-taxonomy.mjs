/*
 * check-taxonomy.mjs - сторож единого источника категорий.
 *
 * Проверяет, что ни одна поверхность сайта не разошлась с data/taxonomy.json
 * и data/model-categories.json. Разошлось - значит кто-то правил категорию
 * руками в странице вместо источника, и через месяц мы снова получим
 * «Ship & Boat» в заголовке и «Ships» в чипе.
 *
 * Запускать после любой сборки страниц - как audit-site.mjs.
 * Возвращает код 1, если что-то разошлось: годится для проверки перед пушем.
 *
 * Запуск:  node scripts/check-taxonomy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, catBySlug, nameOf, menuNameOf, h1Of, escName, loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const modelCat = loadModelCategories();
const problems = [];
const add = (kind, detail) => problems.push(kind + ': ' + detail);

// ── 1. данные каталога: колонка g должна быть id из taxonomy ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const order = CATEGORIES.slice().sort((a, b) => a.id - b.id).map(c => c.slug);
if (JSON.stringify(idx.cats) !== JSON.stringify(order)) add('fc-index.cats', 'порядок не совпадает с taxonomy.json');
const slugOfId = new Map();
let gBad = 0;
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    slugOfId.set(id, slugify(c.n[j]) + '-' + id);
    const want = catBySlug(modelCat[id]);
    if (!want || c.g[j] !== want.id) gBad++;
  }
}
if (gBad) add('колонка g', gBad + ' моделей не совпадают с model-categories.json');

// ── 2. карточки: крошка, строка Category, разметка ──
let crumbBad = 0, specBad = 0, ldBad = 0, cards = 0;
const ex = [];
for (const [id, cat] of Object.entries(modelCat)) {
  const dir = slugOfId.get(id);
  if (!dir) continue;
  const file = path.join(ROOT, 'models', dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  const h = fs.readFileSync(file, 'utf8');
  cards++;
  const nm = escName(nameOf(cat));
  const cm = h.match(/<a href="\/categories\/([a-z0-9-]+)\/" class="mp-bc-link">([^<]*)<\/a>/);
  if (!cm || cp(cm[1]) !== cat || cp(cm[2]) !== nm) {
    crumbBad++;
    if (ex.length < 5) ex.push(dir + ': крошка «' + (cm ? cm[2] + '» (' + cm[1] + ')' : 'нет') + ', ждали «' + nm + '» (' + cat + ')');
  }
  const sm = h.match(/>Category<\/th><td[^>]*>[\s\S]*?href="\/categories\/([a-z0-9-]+)\//);
  if (sm && cp(sm[1]) !== cat) specBad++;
  const lm = h.match(/"category"\s*:\s*"([^"]*)"/);
  if (lm && cp(lm[1]) !== nameOf(cat)) ldBad++;
}
if (crumbBad) add('хлебные крошки', crumbBad + ' карточек');
ex.forEach(e => add('  пример', e));
if (specBad) add('строка Category', specBad + ' карточек');
if (ldBad) add('поле category в разметке', ldBad + ' карточек');

// ── 3. чипы в сетках ──
const idOfSlug = new Map();
for (const [id, dir] of slugOfId) idOfSlug.set(dir, id);
let chipBad = 0;
const chipEx = [];
(function walk(rel, d) {
  if (d > 5) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === 'models' || it.name === 'partials' || it.name.startsWith('.')) continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) { walk(nx, d + 1); continue; }
    if (it.name !== 'index.html') continue;
    const h = fs.readFileSync(path.join(ROOT, nx), 'utf8');
    if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
    for (const m of h.matchAll(/<a href="\/models\/([a-z0-9-]+)\/" class="model-card card-glow">[\s\S]*?<span class="chip mc-chip">([^<]*)<\/span>/g)) {
      const id = idOfSlug.get(cp(m[1]));
      if (!id) continue;
      const want = escName(nameOf(modelCat[id]));
      if (cp(m[2]) !== want) {
        chipBad++;
        if (chipEx.length < 5) chipEx.push(nx + ': «' + m[2] + '» вместо «' + want + '» у ' + m[1]);
      }
    }
  }
})('', 0);
if (chipBad) add('чипы в сетках', chipBad + ' штук');
chipEx.forEach(e => add('  пример', e));

// ── 4. заголовки страниц категорий ──
let headBad = 0;
for (const c of CATEGORIES) {
  const f = path.join(ROOT, 'categories', c.slug, 'index.html');
  if (!fs.existsSync(f)) { add('страница категории', 'нет ' + c.slug); continue; }
  const h = fs.readFileSync(f, 'utf8');
  const h1 = cp((h.match(/<h1 class="cat-page-h1">([\s\S]*?)<\/h1>/) || [])[1] || '');
  if (h1 !== escName(h1Of(c.slug))) { headBad++; add('  H1', c.slug + ': «' + h1 + '» вместо «' + escName(h1Of(c.slug)) + '»'); }
}
if (headBad) add('заголовки категорий', headBad + ' штук');

// ── 5. меню в шапке ──
{
  const h = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8');
  let menuBad = 0;
  for (const c of CATEGORIES) {
    const m = h.match(new RegExp('href="/categories/' + c.slug + '/"[^>]*>(?:<span class="mega-name">)?([^<]+)'));
    if (!m) continue;
    const want = escName(menuNameOf(c.slug));
    if (cp(m[1]).trim() !== want) { menuBad++; add('  меню', c.slug + ': «' + m[1].trim() + '» вместо «' + want + '»'); }
  }
  if (menuBad) add('подписи в меню', menuBad + ' штук');
}

console.log('категорий в источнике: ' + CATEGORIES.length + ', моделей: ' + Object.keys(modelCat).length
  + ', карточек проверено: ' + cards);
if (!problems.length) {
  console.log('\nТаксономия сходится: единый источник, ни одного расхождения.');
  process.exit(0);
}
console.log('\nРАСХОЖДЕНИЯ:');
for (const p of problems) console.log('  ' + p);
process.exit(1);
