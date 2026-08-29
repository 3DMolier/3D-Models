/*
 * apply-industries.mjs - все упоминания отраслей на карточке из одного источника.
 *
 * ЧТО БЫЛО. Одна страница отвечала на вопрос «для каких отраслей эта модель»
 * тремя разными способами, из трёх разных источников данных. На
 * drilling-machine-generic-1335730:
 *   «Used In»   Hardware / Game Development / Film Production / Advertising /
 *               Virtual Reality           - выведено из КАТЕГОРИИ модели
 *   абзац       visualization, advertising and 3D printing
 *                                         - поле use_cases из CSV
 *   FAQ         Film & Video Production, Advertising and Graphics Multimedia
 *               and Web Design            - поле industries из CSV
 * Последнее к тому же называет отрасль, которой на сайте нет: страницы
 * «Graphics Multimedia and Web Design» не существует, ссылаться некуда.
 *
 * ЧТО ДЕЛАЕТ СКРИПТ. Берёт data/model-industries.json (единый набор slug-ов на
 * модель, см. lib/industries.mjs) и переписывает из него ПЯТЬ мест:
 *   1. чипы «Used In» под кнопкой покупки;
 *   2. чипы «Use Cases» под таблицей характеристик;
 *   3. предложение о применении в абзаце описания;
 *   4. ответ «Which industries use…» в разделе вопросов;
 *   5. тот же ответ в разметке FAQPage - отдельно, потому что у части карточек
 *      видимый текст и JSON-LD расходятся экранированием.
 *
 * Отрасли и сценарии - две проекции ОДНОГО набора: чипы «Used In» показывают
 * имя отрасли, «Use Cases» и абзац - формулировку сценария для той же отрасли.
 * Разойтись они больше не могут.
 *
 * Запуск:  node scripts/apply-industries.mjs --dry
 *          node scripts/apply-industries.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { INDUSTRY_LABEL, INDUSTRY_NAME, useLabel, listOf } from './lib/industries.mjs';
import { loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const IND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-industries.json'), 'utf8'));
const modelCat = loadModelCategories();

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    all.push({ id: String(c.i[j]), name: c.n[j], dir: slugify(c.n[j]) + '-' + c.i[j] });
  }
}

const chip = (slug, text) =>
  '<a href="/industries/' + slug + '/" class="chip chip--sm">' + text + '</a>';

let live = 0, usedIn = 0, useCases = 0, prose = 0, faq = 0, ld = 0, changed = 0, noInd = 0;
for (const m of all) {
  const file = path.join(MODELS, m.dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const list = IND[m.id];
  if (!list || !list.length) { noInd++; continue; }
  const cat = modelCat[m.id] || 'other';
  const before = h;

  const names = list.map(s => INDUSTRY_NAME[s]);
  const uses = list.map(s => useLabel(s, cat));

  // 1. чипы «Used In»
  h = h.replace(/(<div class="mp-industries">\s*<div class="mp-field-label">Used In<\/div>\s*<div class="mp-chip-row">)[\s\S]*?(<\/div>)/,
    (x, head, tail) => {
      usedIn++;
      return head + list.map(s => chip(s, INDUSTRY_LABEL[s])).join('') + tail;
    });

  // 2. чипы «Use Cases»
  h = h.replace(/(<div class="section-label mp-mb12">Use Cases<\/div>\s*<div class="mp-chip-row-8">)[\s\S]*?(<\/div>)/,
    (x, head, tail) => {
      useCases++;
      // Повторов быть не должно: у двух отраслей может совпасть формулировка.
      const seen = new Set();
      const items = [];
      for (let i = 0; i < list.length; i++) {
        if (seen.has(uses[i])) continue;
        seen.add(uses[i]);
        items.push(chip(list[i], uses[i]));
      }
      return head + items.join('') + tail;
    });

  // 3. предложение о применении в абзаце. Четыре заготовки, у всех меняется
  //    только перечисление - остальной текст оставляем как есть, он разный у
  //    разных карточек и держит уникальность страницы.
  const u3 = listOf([...new Set(uses)].slice(0, 3));
  //    Флаг g обязателен: то же предложение стоит и в мета-описании страницы,
  //    а оно идёт в документе раньше видимого абзаца. Без g заменялось только
  //    мета-описание, и страница расходилась сама с собой уже внутри себя.
  const PROSE = [
    /(On this listing the stated applications are )[^.<]+(\.)/g,
    /(Buyers most often take it for )[^.<]+(\.)/g,
    /(The listing flags )[^.<]+( as the intended applications\.)/g,
    /(It is catalogued for )[^.<]+(\.)/g,
  ];
  for (const re of PROSE) {
    re.lastIndex = 0;
    if (!re.test(h)) continue;
    re.lastIndex = 0;
    h = h.replace(re, (x, a, b) => { prose++; return a + u3 + b; });
    break;
  }

  // 4-5. ответ про отрасли. Меняем только перечисление, чтобы не потерять
  //      разные хвосты фразы у разных карточек.
  const nAll = listOf(names);
  const IND_RE = [
    /(This listing is catalogued for )[^.<]+(\. Those are the sectors)/g,
    /(It is tagged for )[^.<]+(\. The categorisation reflects)/g,
    /()[^.<]*?( are the primary industries on this listing)/g,
  ];
  for (const re of IND_RE.slice(0, 2)) {
    h = h.replace(re, (x, a, b) => { faq++; return a + nAll + b; });
  }
  h = h.replace(/([>"])([A-Za-z][^.<"]{0,120}?) are the primary industries on this listing/g,
    (x, lead, old) => { faq++; return lead + nAll + ' are the primary industries on this listing'; });

  // 6. хвост мета-описания: «Built for visualization, advertising, 3D printing.»
  //    Это то, что человек видит в выдаче, - и там стояли те же старые
  //    сценарии. Перечисление через запятую, без «and»: строка короткая.
  //    Тегов описания три: description, og:description, twitter:description.
  //    Первый заход поправил только первый, и соцсети продолжали показывать
  //    прежние сценарии.
  h = h.replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content="[^"]*?Built for )[^."]+(\.)/g,
    (x, a, b) => { prose++; return a + [...new Set(uses)].slice(0, 3).join(', ') + b; });

  // 7. описание в разметке Product у карточек старого шаблона: «This asset is
  //    widely used in X for Y». Отрасли там перечислены сырыми тегами
  //    TurboSquid, включая ту, страницы которой у нас нет.
  h = h.replace(/(This asset is widely used in )[^."]{0,160}?( for )/g,
    (x, a, b) => { ld++; return a + nAll.replace(/&amp;/g, '&') + b; });

  if (h === before) continue;
  changed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + (noInd ? ', без отраслей: ' + noInd : ''));
console.log('изменено карточек: ' + changed);
console.log('  чипы «Used In»: ' + usedIn);
console.log('  чипы «Use Cases»: ' + useCases);
console.log('  предложение в абзаце: ' + prose);
console.log('  перечисление в ответе (текст + разметка): ' + faq);
console.log('  описание в разметке Product: ' + ld);
if (DRY) console.log('(--dry, ничего не записано)');
