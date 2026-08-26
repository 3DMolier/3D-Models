/*
 * sync-chrome.mjs - хедер и футер из одного источника.
 *
 * ЗАЧЕМ. Сейчас шапка и подвал физически лежат в каждой из 54 879 живых
 * страниц, и они уже разошлись: хедеров на сайте 13 разных версий, и это не
 * задумка - подсветки текущего раздела в шапке нет вообще, так что она обязана
 * быть одинаковой везде. Что накопилось:
 *   - на 52 150 карточках в шапке нет ссылок Privacy и Terms;
 *   - на 12 отраслевых страницах не было ещё и Contact;
 *   - у кнопки Categories стоит aria-controls="nav-categories-menu", а блока с
 *     таким id нет ни на одной странице - ссылка в никуда для читалок экрана;
 *   - в подвале карточек нет ссылки на FAQ, она есть только на главной;
 *   - на одной карточке класс превратился в "mega-$esc" - след неудачной
 *     подстановки через $ в String.replace.
 * Дальше будет только хуже: любая правка шапки - это 54 тысячи файлов, и часть
 * их каждый раз промахивается мимо замены.
 *
 * ПОЧЕМУ НЕ ПОДГРУЖАТЬ ШАПКУ СКРИПТОМ. Это первое, что приходит в голову, и
 * это ошибка. Меню - главная внутренняя перелинковка сайта; если оно
 * появляется только после выполнения JS, ссылки теряют вес, а шапка начинает
 * рисоваться после первой отрисовки и дёргает вёрстку. Хостинг - GitHub Pages,
 * серверных вставок там нет. Поэтому правильный способ ровно один: держать
 * источник в одном файле, а в страницы впечатывать его на сборке. В HTML шапка
 * остаётся, но пишется она в одном месте.
 *
 * ЧТО ПЕРЕМЕННОГО. В подвале карточки последним блоком идёт ссылка «назад в
 * свою категорию» - она у каждой карточки своя и обязана сохраниться. В
 * образце подвала на её месте стоит метка MP_FOOTER_BACK; при раскладке туда
 * подставляется тот блок, который на этой странице уже есть, а если его нет -
 * пустота.
 *
 * Запуск:
 *   node scripts/sync-chrome.mjs --extract   собрать образцы из index.html
 *   node scripts/sync-chrome.mjs --dry       показать, что изменится
 *   node scripts/sync-chrome.mjs             разложить по страницам
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const PARTS = path.join(ROOT, 'partials');
const HEADER = path.join(PARTS, 'header.html');
const FOOTER = path.join(PARTS, 'footer.html');
const MARK = '<!--MP_FOOTER_BACK-->';

const EXTRACT = process.argv.includes('--extract');
const DRY = process.argv.includes('--dry');

const reHeader = /<header[\s\S]*?<\/header>/i;
const reFooter = /<footer[\s\S]*?<\/footer>/i;
const reBack = /<div class="max-w-7xl mx-auto mp-footer-back">[\s\S]*?<\/div>/i;

// ── сбор образца из главной ──────────────────────────────────────────────────
if (EXTRACT) {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  let head = (home.match(reHeader) || [])[0];
  let foot = (home.match(reFooter) || [])[0];
  if (!head || !foot) throw new Error('на главной не нашлись header или footer');

  // Кнопка Categories ссылается на id, которого нет. Ставим id тому блоку, что
  // она на самом деле открывает - соседнему nav-mega сразу после кнопки.
  if (!/id="nav-categories-menu"/.test(head)) {
    const before = head;
    head = head.replace(/(aria-controls="nav-categories-menu">[\s\S]*?<div class="nav-dropdown nav-mega")(\s+role="menu")/,
      (m, a, b) => a + ' id="nav-categories-menu"' + b);
    if (head === before) throw new Error('не удалось привязать id к меню Categories');
  }

  // У подвала карточек последним блоком идёт ссылка «назад в категорию».
  // На главной её нет, поэтому метку ставим сами, перед закрытием.
  foot = foot.replace(/<\/footer>$/i, MARK + '</footer>');

  fs.mkdirSync(PARTS, { recursive: true });
  fs.writeFileSync(HEADER, head);
  fs.writeFileSync(FOOTER, foot);
  console.log('образцы записаны:');
  console.log('  ' + HEADER + '  ' + head.length + ' симв.');
  console.log('  ' + FOOTER + '  ' + foot.length + ' симв.');
  process.exit(0);
}

// ── раскладка по страницам ───────────────────────────────────────────────────
if (!fs.existsSync(HEADER) || !fs.existsSync(FOOTER)) {
  console.error('нет образцов. Сначала: node scripts/sync-chrome.mjs --extract');
  process.exit(1);
}
const head = fs.readFileSync(HEADER, 'utf8');
const footTpl = fs.readFileSync(FOOTER, 'utf8');
if (!footTpl.includes(MARK)) throw new Error('в образце подвала нет метки ' + MARK);

const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(next);
    else if (e.name === 'index.html') pages.push(next);
  }
})('');

let live = 0, stubs = 0, hFix = 0, fFix = 0, touched = 0, noHead = 0, noFoot = 0, backKept = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  // Страницы-перенаправления не трогаем: у них своя минимальная разметка.
  if (/http-equiv="refresh"/i.test(html.slice(0, 400))) { stubs++; continue; }
  live++;
  let out = html;

  if (reHeader.test(out)) {
    // Замену делаем функцией: в шапке есть символы $, и в строке замены
    // они были бы истолкованы как подстановка. Ровно так на одной карточке
    // класс превратился в "mega-$esc".
    const cur = (out.match(reHeader) || [])[0];
    if (cur !== head) { out = out.replace(reHeader, () => head); hFix++; }
  } else noHead++;

  if (reFooter.test(out)) {
    const cur = (out.match(reFooter) || [])[0];
    const back = (cur.match(reBack) || [''])[0];
    if (back) backKept++;
    const want = footTpl.replace(MARK, () => back);
    if (cur !== want) { out = out.replace(reFooter, () => want); fFix++; }
  } else noFoot++;

  if (out !== html) { touched++; if (!DRY) fs.writeFileSync(file, out); }
}

console.log('страниц всего ' + pages.length + ', живых ' + live + ', заглушек пропущено ' + stubs);
console.log('шапку заменили на ' + hFix + ' стр., подвал на ' + fFix + ' стр.');
console.log('ссылок «назад в категорию» сохранено: ' + backKept);
if (noHead || noFoot) console.log('без шапки ' + noHead + ', без подвала ' + noFoot);
console.log('изменено файлов: ' + touched + (DRY ? '   (--dry, ничего не записано)' : ''));
