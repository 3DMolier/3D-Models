/*
 * validate-data.mjs - обязательные проверки данных перед деплоем (пункт 11).
 *
 * ЗАЧЕМ. Каждая правка из твоих файлов начиналась одинаково: ты находил на
 * живом сайте противоречие, которое машина могла бы поймать сама. Три разных
 * счётчика Aircraft, «Rigged version: Not available» под списком из четырёх
 * rigged-версий, Teddy Bear с двумя категориями, боевые сценарии у Air France,
 * заявление про PBR на /data-licensing/ против «PBR: No» на карточках. Этот
 * скрипт проверяет ровно те десять условий, которые ты выписал, и падает с
 * кодом 1, если хоть одно нарушено.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ audit-site.mjs. Тот следит за разметкой и ссылками - что
 * страница цела. Этот следит за СОГЛАСОВАННОСТЬЮ ДАННЫХ - что страница не
 * противоречит сама себе и остальному сайту.
 *
 * Запуск:  node scripts/validate-data.mjs
 *          node scripts/validate-data.mjs --sample 5000   (быстрая проверка)
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadModelCategories } from './lib/taxonomy.mjs';
import { isMilitary } from './lib/military.mjs';
import { brandOf } from './lib/brands.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const SAMPLE = (() => { const i = process.argv.indexOf('--sample'); return i > 0 ? Number(process.argv[i + 1]) : 0; })();
const dec = s => String(s).replace(/&amp;/g, '&').trim();
const fmt = n => Number(n).toLocaleString('en-US');

const problems = [];
const fail = (check, msg, examples) => problems.push({ check, msg, examples: examples || [] });

// ── источники ──
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8'));
const modelCat = loadModelCategories();
const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'taxonomy.json'), 'utf8'));
const taxArr = Array.isArray(tax) ? tax : (tax.categories || Object.values(tax));
const catName = new Map(taxArr.map(c => [c.slug, c.name]));
const industries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-industries.json'), 'utf8'));
const SITE_INDUSTRIES = new Set(fs.readdirSync(path.join(ROOT, 'industries'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name));

// ── 1. счётчик на главной == авторитетный счётчик категории ──
{
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bad = [];
  for (const m of home.matchAll(/<a href="\/categories\/([a-z0-9-]+)\/"[\s\S]{0,700}?<span class="tile-n">([^<]*)</g)) {
    const want = counts.counts[m[1]];
    if (want === undefined) continue;
    if (m[2] !== fmt(want)) bad.push(m[1] + ': плитка ' + m[2] + ', источник ' + fmt(want));
  }
  if (bad.length) fail(1, 'счётчик на главной расходится с category-counts.json', bad);
}

// ── 2. счётчик на странице категории == тот же источник ──
{
  const bad = [];
  for (const [slug, want] of Object.entries(counts.counts)) {
    const f = path.join(ROOT, 'categories', slug, 'index.html');
    if (!fs.existsSync(f)) continue;
    const h = fs.readFileSync(f, 'utf8');
    const m = h.match(/<div class="cat-stat-num">([\d,]+)<\/div>/);
    if (m && m[1] !== fmt(want)) bad.push(slug + ': страница ' + m[1] + ', источник ' + fmt(want));
  }
  if (bad.length) fail(2, 'счётчик на странице категории расходится с источником', bad);
}

// ── 3-10: проходим по карточкам ──
const dirs = fs.readdirSync(MODELS);
const step = SAMPLE ? Math.max(1, Math.floor(dirs.length / SAMPLE)) : 1;
let live = 0;
const bad3 = [], bad4 = [], bad5 = [], bad6 = [], bad7 = [], bad8 = [], bad9 = [];

for (let k = 0; k < dirs.length; k += step) {
  const d = dirs[k];
  let h;
  try { h = fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const id = d.slice(d.lastIndexOf('-') + 1);
  const cat = modelCat[id];
  const want = cat ? catName.get(cat) : null;
  const h1 = (h.match(/<h1[^>]*>([^<]*)/) || [, ''])[1];

  // 3. категория одинакова во всех местах страницы
  if (want) {
    const seen = {
      чип: (h.match(/<a href="\/categories\/[a-z0-9-]+\/" class="chip[^"]*">([^<]*)</) || [])[1],
      Specifications: (h.match(/<th[^>]*>Category<\/th><td[^>]*>(?:<a[^>]*>)?([^<]*)</) || [])[1],
      about: (h.match(/"about":\{"@type":"Thing","name":"([^"]*)"/) || [])[1],
      'More in': (h.match(/<div class="section-label mp-mb8">More in ([^<]*)</) || [])[1],
    };
    const diff = Object.entries(seen).filter(([, v]) => v && dec(v) !== want);
    if (diff.length && bad3.length < 6) {
      bad3.push(d + ' -> должно «' + want + '», стоит ' + diff.map(([k2, v]) => k2 + '=«' + dec(v) + '»').join(', '));
    } else if (diff.length) bad3.push('…');
  }

  // 4. есть rigged-версия -> «Rigged versions: Available»
  {
    const av = (h.match(/<th[^>]*>Rigged versions<\/th><td[^>]*>([^<]*)</) || [, ''])[1];
    const sec = h.match(/<section class="mp-related-section mp-versions-section">[\s\S]*?<\/section>/);
    const titles = sec ? [...sec[0].matchAll(/<div class="mp-rc-title">([^<]*)</g)].map(x => x[1]) : [];
    const any = /\brigged/i.test(h1) || titles.some(t => /\brigged/i.test(t));
    if (any && /not available/i.test(av) && bad4.length < 6) bad4.push(d);
  }

  // 5. не военная модель -> без боевых сценариев
  if (cat === 'aircraft' && !isMilitary(h1, cat) && !isMilitary(d.replace(/-/g, ' '), cat)) {
    if (/combat simulation|war-game|battlefield simulation|defence training/i.test(h) && bad5.length < 6) bad5.push(d);
  }

  // 6. PBR: No -> страница не наследует утверждение «PBR как стандарт»
  {
    const pbr = (h.match(/<th[^>]*>PBR<\/th><td[^>]*>([^<]*)</) || [, ''])[1];
    if (/^\s*no\s*$/i.test(pbr) && /PBR materials as standard|complete UV unwraps and PBR/i.test(h) && bad6.length < 6) bad6.push(d);
  }

  // 7. лицензия только двух видов
  {
    const lic = (h.match(/<th[^>]*>Licen[cs]e<\/th><td[^>]*>(?:<a[^>]*>)?([^<]*)</) || [, ''])[1];
    if (lic && !/^(Royalty Free|Editorial Uses Only) \(TurboSquid\)$/.test(dec(lic)) && bad7.length < 6) bad7.push(d + ': «' + dec(lic) + '»');
  }

  // 8. брендовая модель -> Editorial Uses Only
  {
    const lic = (h.match(/<th[^>]*>Licen[cs]e<\/th><td[^>]*>(?:<a[^>]*>)?([^<]*)</) || [, ''])[1];
    if (brandOf(h1) && lic && !/Editorial Uses Only/.test(lic) && bad8.length < 6) bad8.push(d + ' (' + brandOf(h1) + '): «' + dec(lic) + '»');
  }

  // 9. отрасли существуют среди разделов сайта
  {
    const list = industries[id] || [];
    const unknown = list.filter(s => !SITE_INDUSTRIES.has(s));
    if (unknown.length && bad9.length < 6) bad9.push(d + ': ' + unknown.join(', '));
  }
}

if (bad3.length) fail(3, 'категория расходится внутри страницы', bad3);
if (bad4.length) fail(4, 'есть rigged-версия, а написано «Not available»', bad4);
if (bad5.length) fail(5, 'у невоенной модели боевые сценарии', bad5);
if (bad6.length) fail(6, 'PBR: No, но страница утверждает PBR как стандарт', bad6);
if (bad7.length) fail(7, 'лицензия не Royalty Free и не Editorial Uses Only', bad7);
if (bad8.length) fail(8, 'брендовая модель без Editorial Uses Only', bad8);
if (bad9.length) fail(9, 'отрасль модели не существует среди разделов сайта', bad9);

// ── 10. блок «нет результатов» и старые /browse/ ──
{
  const cat = fs.readFileSync(path.join(ROOT, 'catalog', 'index.html'), 'utf8');
  if (!/<div id="empty" hidden>/.test(cat)) {
    fail(10, 'блок «нет результатов» в каталоге не скрыт атрибутом hidden', []);
  }
  if (!/<div id="fc-progress"[^>]*\shidden>/.test(cat)) {
    fail(10, 'строка «Showing 0 of 0» в каталоге не скрыта атрибутом hidden', []);
  }
}
{
  // старые /browse/NNN/ - без внутренних ссылок и без записей в карте сайта
  const stubs = [];
  for (const d of fs.readdirSync(path.join(ROOT, 'browse'), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const f = path.join(ROOT, 'browse', d.name, 'index.html');
    if (!fs.existsSync(f)) continue;
    const h = fs.readFileSync(f, 'utf8');
    if (/http-equiv="refresh"/i.test(h)) stubs.push(d.name);
  }
  const smDir = path.join(ROOT, 'sitemaps');
  const sm = fs.existsSync(smDir) ? fs.readdirSync(smDir).map(f => fs.readFileSync(path.join(smDir, f), 'utf8')).join('') : '';
  const inMap = stubs.filter(s => sm.includes('/browse/' + s + '/'));
  if (inMap.length) fail(10, 'заглушки /browse/ попали в карту сайта', inMap.slice(0, 6));
  const noindex = stubs.filter(s => !/name="robots"[^>]*noindex/.test(fs.readFileSync(path.join(ROOT, 'browse', s, 'index.html'), 'utf8')));
  if (noindex.length) fail(10, 'заглушки /browse/ без noindex', noindex.slice(0, 6));
}

// ── отчёт ──
console.log('проверено карточек: ' + live + (SAMPLE ? '  (выборка, шаг ' + step + ')' : ''));
if (!problems.length) {
  console.log('\nВСЕ 10 ПРОВЕРОК ПРОЙДЕНЫ');
  process.exit(0);
}
console.log('\nНАРУШЕНИЙ: ' + problems.length);
for (const p of problems) {
  console.log('\n  [' + p.check + '] ' + p.msg);
  p.examples.slice(0, 6).forEach(e => console.log('      ' + e));
}
process.exit(1);
