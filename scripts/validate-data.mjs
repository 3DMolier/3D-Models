/*
 * validate-data.mjs - обязательные проверки данных перед деплоем (пункт 11).
 *
 * ЗАЧЕМ. Каждая правка из твоих файлов начиналась одинаково: ты находил на
 * живом сайте противоречие, которое машина могла бы поймать сама. Три разных
 * счётчика Aircraft, «Rigged version: Not available» под списком из четырёх
 * rigged-версий, Teddy Bear с двумя категориями, боевые сценарии у Air France,
 * заявление про PBR на /data-licensing/ против «PBR: No» на карточках. Этот
 * скрипт проверяет двенадцать условий - десять твоих плюс две проверки против
 * событий 3-9 августа, - и падает с кодом 1, если хоть одно нарушено.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ audit-site.mjs. Тот следит за разметкой и ссылками - что
 * страница цела. Этот следит за СОГЛАСОВАННОСТЬЮ ДАННЫХ - что страница не
 * противоречит сама себе и остальному сайту.
 *
 * Запуск:  node scripts/validate-data.mjs
 *          node scripts/validate-data.mjs --sample 5000   (быстрая проверка)
 *
 * ПРОВЕРКИ 11 и 12 добавлены после разбора провала трафика:
 *   11 - ни одного массового 404: каждый адрес из карты сайта, в том числе из
 *        её предыдущей версии, обязан иметь файл. 08.08 их не стало у 21 634
 *        адресов, и сутки они отдавали 404;
 *   12 - вес сайта против лимита публикации Pages: 06.08 выкладка сорвалась по
 *        таймауту на 3,33 ГБ, и об этом узнали не сразу.
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
// Маркером в fix-us-spelling.mjs был символ с кодом 1; ловим его и любые
// другие управляющие, кроме табуляции, перевода строки и возврата каретки.
const CTRL_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g');

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

/*
 * ── 11. НИ ОДНОГО МАССОВОГО 404 ───────────────────────────────────────────────
 * 08.08.2026 объединение вариантов удалило схлопнутые страницы, и 21 634
 * прежних адреса начали отдавать 404 - и поисковикам, у которых они были в
 * индексе, и внешним ссылкам. Так продолжалось сутки, до отдельного коммита с
 * перенаправлениями. Эта проверка поймала бы такое ДО выкладки.
 *
 * Сравниваем два набора: что лежит в текущих картах сайта и что было в
 * предыдущей зафиксированной версии карт. Каждый адрес из обоих наборов обязан
 * иметь файл на диске - живую страницу или заглушку-перенаправление.
 */
{
  const smDir = path.join(ROOT, 'sitemaps');
  const urls = new Set();
  const addFrom = text => {
    for (const m of text.matchAll(/<loc>https:\/\/3dmolierstudio\.com([^<]*)<\/loc>/g)) urls.add(m[1]);
  };
  for (const f of fs.readdirSync(smDir)) {
    if (/^image-sitemap/.test(f)) continue;   // там адреса картинок, не страниц
    addFrom(fs.readFileSync(path.join(smDir, f), 'utf8'));
  }
  // и то, что мы обещали поисковику в прошлый раз
  let prevCount = 0;
  try {
    const { execSync } = await import('node:child_process');
    for (const f of fs.readdirSync(smDir)) {
      if (/^image-sitemap/.test(f)) continue;
      try {
        const old = execSync('git show HEAD:sitemaps/' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const before = urls.size;
        addFrom(old);
        prevCount += urls.size - before;
      } catch (e) { /* файла в прошлой версии не было - это новая карта */ }
    }
  } catch (e) { /* git недоступен - проверяем только текущие карты */ }

  const missing = [];
  for (const u of urls) {
    // адрес вида /models/xxx/ -> файл models/xxx/index.html
    const rel = u.replace(/^\/|\/$/g, '');
    const file = rel ? path.join(ROOT, rel, 'index.html') : path.join(ROOT, 'index.html');
    if (!fs.existsSync(file) && !fs.existsSync(path.join(ROOT, rel))) {
      missing.push(u);
      if (missing.length > 200) break;
    }
  }
  if (missing.length) {
    fail(11, 'адреса из карты сайта не имеют файла - будет ' + missing.length
      + (missing.length > 200 ? '+' : '') + ' штук 404', missing.slice(0, 6));
  }
  console.log('  [11] адресов страниц в картах: ' + urls.size
    + (prevCount ? ', из них только в прошлой версии: ' + prevCount : '') + ', без файла: ' + missing.length);
}

/*
 * ── 12. ВЕС САЙТА И ЛИМИТ ПУБЛИКАЦИИ ──────────────────────────────────────────
 * 06.08.2026 публикация GitHub Pages сорвалась: «Timeout reached, aborting!»
 * через 608 секунд при лимите в 10 минут. Сайт вырос до 3,33 ГБ и перестал
 * укладываться. Узнали об этом не сразу, потому что упавшая публикация ничего
 * не ломает видимо - в проде просто остаётся прежняя версия.
 *
 * 3,33 ГБ - известная точка отказа. Предупреждаем на 3,0 ГБ и валим сборку на
 * 3,3 ГБ, чтобы не выкладывать вслепую.
 */
{
  const WARN = 3.0 * 1024 ** 3, STOP = 3.3 * 1024 ** 3;
  let total = 0, files = 0;
  const stack = [ROOT];
  while (stack.length) {
    const d = stack.pop();
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const it of ents) {
      if (it.name === '.git' || it.name === 'node_modules') continue;
      const p = path.join(d, it.name);
      if (it.isDirectory()) stack.push(p);
      else { try { total += fs.statSync(p).size; files++; } catch (e) { /* исчез между чтением и stat */ } }
    }
  }
  const gb = (total / 1024 ** 3).toFixed(2);
  console.log('  [12] вес сайта: ' + gb + ' ГБ в ' + fmt(files) + ' файлах'
    + '  (порог предупреждения 3.00, отказа 3.30)');
  if (total >= STOP) {
    fail(12, 'вес ' + gb + ' ГБ - публикация Pages на такой величине уже срывалась по таймауту 06.08.2026', []);
  } else if (total >= WARN) {
    console.log('       ВНИМАНИЕ: до точки отказа осталось '
      + ((STOP - total) / 1024 ** 2).toFixed(0) + ' МБ');
  }
}

/*
 * ── 13. ЦЕЛОСТНОСТЬ АДРЕСОВ ───────────────────────────────────────────────────
 * Проверка появилась после того, как я сам сломал сайт. Правка американского
 * написания прятала адреса под служебные маркеры N, чтобы замена
 * слов не тронула slug-и. Маска атрибута легла поверх маски адреса, а
 * разворачивание шло в один слой - внутренний маркер остался в 916 662 местах
 * на всех 54 077 карточках. Картинки не грузились, кнопка покупки не работала.
 *
 * Ни одна из двенадцати прежних проверок этого не видела: они следят за
 * согласованностью данных, а не за тем, что адрес вообще является адресом.
 * Поэтому здесь два условия:
 *   - в файлах нет управляющих символов (их там быть не может ни при каких
 *     обстоятельствах: это следы незавершённой обработки);
 *   - каждый href и src - либо путь от корня, либо якорь, либо адрес со
 *     схемой; ничего другого браузер не откроет.
 */
{
  const ctrlFiles = [], badAttr = [];
  let ctrlPlaces = 0;
  const check = rel => {
    let h;
    try { h = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
    // Управляющие символы, кроме табуляции и переводов строк. Регулярка
    // собирается из строки: литеральный управляющий символ в исходнике
    // сам по себе создал бы ту же беду, что мы ловим.
    const ctrl = h.match(CTRL_RE);
    if (ctrl) { ctrlPlaces += ctrl.length; if (ctrlFiles.length < 6) ctrlFiles.push(rel + ' (' + ctrl.length + ')'); }
    for (const m of h.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const v = m[1];
      if (!v) continue;
      if (/^(?:https?:|mailto:|tel:|data:|\/|#|\.\.?\/)/.test(v)) continue;
      if (badAttr.length < 6) badAttr.push(rel + ': «' + v.slice(0, 40) + '»');
      break;
    }
  };
  const pages = [];
  (function walk(rel, d) {
    let ents;
    try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
    for (const it of ents) {
      if (it.name === 'node_modules' || it.name === '.git') continue;
      const nx = rel ? rel + '/' + it.name : it.name;
      if (it.isDirectory()) { if (d < 3) walk(nx, d + 1); }
      else if (it.name.endsWith('.html')) pages.push(nx);
    }
  })('', 0);
  for (const p of pages) check(p);
  // карточки - с тем же шагом выборки, что и основной проход
  const md = fs.readdirSync(MODELS);
  for (let k = 0; k < md.length; k += step) check('models/' + md[k] + '/index.html');

  console.log('  [13] проверено на целостность адресов: ' + (pages.length + Math.ceil(md.length / step)) + ' файлов');
  if (ctrlPlaces) fail(13, 'управляющие символы в файлах - следы незавершённой обработки, ' + ctrlPlaces + ' мест', ctrlFiles);
  if (badAttr.length) fail(13, 'href или src не является адресом', badAttr);
}

// ── отчёт ──
console.log('\nпроверено карточек: ' + live + (SAMPLE ? '  (выборка, шаг ' + step + ')' : ''));
if (!problems.length) {
  console.log('\nВСЕ 13 ПРОВЕРОК ПРОЙДЕНЫ');
  process.exit(0);
}
console.log('\nНАРУШЕНИЙ: ' + problems.length);
for (const p of problems) {
  console.log('\n  [' + p.check + '] ' + p.msg);
  p.examples.slice(0, 6).forEach(e => console.log('      ' + e));
}
process.exit(1);
