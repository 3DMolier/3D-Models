/*
 * fix-us-spelling.mjs - единое американское написание (пункт 13).
 *
 * ЧТО БЫЛО. На сайте одновременно жили «Catalog» и «catalogue», «License» и
 * «Licence», «visualization» и «visualisation». Аудитория TurboSquid
 * американская, и разнобой в одном и том же слове на соседних экранах читается
 * как небрежность.
 *
 * ЧТО МЕНЯЕМ (по замеру на 9 000 карточек, вхождений):
 *   licence        41 935  ->  license
 *   catalogue      15 861  ->  catalog
 *   catalogued      8 606  ->  cataloged
 *   organised       6 611  ->  organized
 *   visualisation   5 778  ->  visualization
 *   programme       2 684  ->  program
 *   modelling       2 418  ->  modeling
 *   colour            276  ->  color
 *   metre              59  ->  meter
 *   recognise           8  ->  recognize
 *   analyse             2  ->  analyze
 *
 * ЧЕГО НЕ ТРОГАЕМ И ПОЧЕМУ.
 *
 * 1. «centre» - 18 119 вхождений, и почти все это ИМЯ ФУНКЦИИ во встроенном
 *    скрипте: `function centre(box)` и вызовы `centre(box)`. Переименование
 *    текста сломало бы скрипт, а переименование кода - правка ради правки.
 *    В прозе это слово встретилось трижды, в обороте «centre ice».
 *
 * 2. НАЗВАНИЯ МОДЕЛЕЙ. Двенадцать листингов называются «Coloured Playground
 *    Chalk», «Plasticine Modelling Clay with Tools Collection», «Ophthalmic
 *    Visual Field Analyser». Это имена товаров на TurboSquid; переписать их
 *    значит развести карточку с листингом, куда ведёт кнопка покупки.
 *    Названия маскируются на время замены.
 *
 * 3. АДРЕСА. В slug-ах те же слова: `/models/coloured-playground-chalk-…`.
 *    Замена там даёт ссылку на несуществующую страницу. Прятать только href и
 *    src НЕДОСТАТОЧНО - первый заход так и сделал, и адреса внутри разметки
 *    JSON-LD («url», «@id», «item», «image») всё равно переписались: там это
 *    обычные строковые значения, а не атрибуты. Поэтому маскируется любой
 *    абсолютный адрес, где бы он ни стоял, плюс относительные пути в кавычках.
 *
 *    Исключение - ссылки поиска `/search/?q=…`: в них лежит не адрес страницы,
 *    а поисковый запрос, и он обязан совпадать с подписью чипа. Оставь его без
 *    перевода - чип будет показывать «colored», а искать «coloured».
 *
 * Запуск:  node scripts/fix-us-spelling.mjs --dry
 *          node scripts/fix-us-spelling.mjs
 *          node scripts/fix-us-spelling.mjs --pages   (только не-карточки)
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const PAGES_ONLY = process.argv.includes('--pages');
// --only <путь> - прогнать одну страницу и напечатать результат, ничего не
// записывая. Нужно, чтобы проверить защиту адресов до прохода по 54 тысячам
// файлов: первый заход переписал slug внутри JSON-LD, и это выяснилось только
// после полного прогона.
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();

// Порядок важен: длинные формы раньше коротких, иначе «catalogued» станет
// «catalogd» после замены «catalogue».
const RULES = [
  ['catalogued', 'cataloged'],
  ['catalogue', 'catalog'],
  ['licenced', 'licensed'],
  ['licence', 'license'],
  ['visualisation', 'visualization'],
  ['visualise', 'visualize'],
  ['organised', 'organized'],
  ['organise', 'organize'],
  ['modelling', 'modeling'],
  ['programme', 'program'],
  ['colour', 'color'],
  ['optimise', 'optimize'],
  ['recognise', 'recognize'],
  ['analyser', 'analyzer'],
  ['analyse', 'analyze'],
  ['behaviour', 'behavior'],
  ['authorised', 'authorized'],
  ['metres', 'meters'],
];

const PROTECTED = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', '.protected-names.json'), 'utf8'));

/** Сохраняет регистр первой буквы: Licence -> License, licence -> license. */
function applyRules(s) {
  let out = s;
  for (const [uk, us] of RULES) {
    const re = new RegExp(uk, 'gi');
    out = out.replace(re, m => {
      // Полностью заглавное слово оставляем заглавным (LICENCE -> LICENSE).
      if (m === m.toUpperCase()) return us.toUpperCase();
      if (m[0] === m[0].toUpperCase()) return us[0].toUpperCase() + us.slice(1);
      return us;
    });
  }
  return out;
}

function convert(h) {
  const stash = [];
  const keep = v => { stash.push(v); return '\u0001' + (stash.length - 1) + '\u0001'; };

  // 1. АДРЕСА. Прятать только href и src недостаточно: в разметке JSON-LD те
  //    же ссылки лежат обычными значениями - "url":"…/models/coloured-…/",
  //    "@id", "item", "image". Первый заход это пропустил, и slug превратился
  //    в colored-playground-chalk - страница по такому адресу не существует.
  //    Поэтому сперва прячем ЛЮБОЙ абсолютный адрес, где бы он ни стоял.
  let t = h.replace(/https?:\/\/[^"'<>\s)]+/g, v => keep(v));
  //    затем атрибуты со ссылками (там остаются относительные пути)
  t = t.replace(/(href|src|data-fallback|data-placeholder)="([^"]*)"/g,
    (x, attr, val) => {
      // Ссылки поиска - исключение: там в адресе лежит не slug страницы, а
      // поисковый запрос, и он обязан совпадать с подписью чипа. Если оставить
      // «?q=coloured» под подписью «colored», чип ищет одно, а показывает
      // другое. Такие адреса переводим вместе с текстом.
      if (attr === 'href' && val.startsWith('/search/?q=')) return x;
      return attr + '="' + keep(val) + '"';
    });
  //    и относительные пути в кавычках - те же поля JSON-LD.
  //    Ссылки поиска и здесь исключение: без этого маска перехватывала их
  //    после предыдущего правила, и чип показывал «color», а искал «colour».
  t = t.replace(/"(\/[^"]*)"/g, (x, v) => v.startsWith('/search/?q=') ? x : '"' + keep(v) + '"');

  // 2. названия моделей
  for (const nm of PROTECTED) {
    if (!t.includes(nm)) continue;
    t = t.split(nm).join(keep(nm));
  }

  // 3. имя функции centre и её вызовы - см. пункт 1 в шапке
  t = t.replace(/\bcentre\b/g, () => keep('centre'));

  t = applyRules(t);

  // возвращаем спрятанное
  t = t.replace(/\u0001(\d+)\u0001/g, (x, i) => stash[Number(i)]);
  return t;
}

if (ONLY) {
  const h = fs.readFileSync(path.join(ROOT, ONLY), 'utf8');
  const out = convert(h);
  const n = re => (out.match(re) || []).length;
  console.log('проверка одной страницы: ' + ONLY);
  console.log('  адресов со словом colored: ' + n(/colored-playground/g) + '   (ждём 0)');
  console.log('  название Coloured в h1:    ' + n(/<h1[^>]*>Coloured/g) + '   (ждём 1)');
  console.log('  строка License:            ' + n(/>License</g) + '   (ждём 1)');
  console.log('  catalogue осталось:        ' + n(/catalogue/g) + '   (ждём 0)');
  console.log('  visualisation осталось:    ' + n(/visualisation/g) + '   (ждём 0)');
  console.log('  function centre цела:      ' + n(/function centre\(/g) + '   (ждём 1)');
  const bad = [...out.matchAll(/(?:href|url|@id|item|image)"?[:=]"?"?([^"]*colored[^"]*)"/g)].map(m => m[1]);
  console.log('  подозрительные адреса:     ' + bad.length + (bad.length ? '  ' + bad[0] : ''));
  process.exit(0);
}

// ── обход ──
const files = [];
(function walk(rel, d) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === '.git') continue;
    if (PAGES_ONLY && it.name === 'models') continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) { if (d < 3 || rel === 'models') walk(nx, d + 1); }
    else if (it.name.endsWith('.html')) files.push(nx);
  }
})('', 0);

let changed = 0, skipped = 0, hits = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  const h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) { skipped++; continue; }
  const out = convert(h);
  if (out === h) continue;
  changed++;
  // грубая оценка числа правок
  hits += Math.abs(h.length - out.length) || 1;
  if (!DRY) fs.writeFileSync(file, out);
}
console.log('файлов просмотрено: ' + files.length + ', перенаправлений пропущено: ' + skipped);
console.log('файлов изменено: ' + changed);
if (DRY) console.log('(--dry, ничего не записано)');
