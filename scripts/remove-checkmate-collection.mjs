/*
 * remove-checkmate-collection.mjs - убрать подборку «CheckMate Certified».
 *
 * Почему. TurboSquid закрыл программу CheckMate, новые модели не сертифицирует,
 * а студия продолжает строить всё по той же спецификации. Отдельная подборка
 * «сертифицированные» вводит покупателя в заблуждение: раз она есть, значит
 * остальные модели чем-то хуже - а это не так, разница только в том, успела ли
 * модель попасть в программу до её закрытия.
 *
 * Сама страница /collections/checkmate-certified-3d-models/ давно превращена в
 * перенаправление на /collections/ и в карту сайта не входит. Её оставляем как
 * есть: внешние ссылки должны куда-то приходить, а не падать в 404. Убираем
 * только то, что подборку рекламирует - карточку на главной, плитку в полном
 * каталоге, пункт в подсказках поиска и запись в данных.
 *
 * Подборку StemCell не трогаем - решение по ней за основателем.
 *
 * Запуск:
 *   node remove-checkmate-collection.mjs --dry
 *   node remove-checkmate-collection.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');
const SLUG = 'checkmate-certified-3d-models';

const write = (file, text) => { if (!DRY) fs.writeFileSync(file, text); };
let changed = 0;

// ── 1. Данные ────────────────────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'data', 'collections.json');
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = list.filter(c => c.collection_slug !== SLUG);
  if (next.length === list.length) console.log('  collections.json: записи нет');
  else {
    write(file, JSON.stringify(next, null, 2) + '\n');
    console.log('  collections.json: убрана 1 запись, осталось ' + next.length);
    changed++;
  }
}

// ── 2. Карточка на главной и плитка в каталоге ───────────────────────────────
// Это ссылка <a> со всем содержимым внутри. Вырезаем целиком, иначе останется
// пустая рамка в сетке.
function cutAnchor(html, href) {
  const i = html.indexOf('<a href="' + href + '"');
  if (i < 0) return null;
  let depth = 0, end = -1;
  const re = /<a\b|<\/a>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</a>') { depth--; if (depth === 0) { end = m.index + 4; break; } }
    else depth++;
  }
  return end < 0 ? null : html.slice(0, i) + html.slice(end);
}

for (const rel of ['index.html', 'full-catalog/index.html', 'preview/home/index.html']) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  for (const href of ['/collections/' + SLUG + '/', '/collections/' + SLUG]) {
    let next;
    while ((next = cutAnchor(html, href))) html = next;
  }
  if (html === before) { console.log('  ' + rel + ': ссылок нет'); continue; }
  write(file, html);
  console.log('  ' + rel + ': карточка подборки вырезана');
  changed++;
}

// ── 3. Подсказки поиска ──────────────────────────────────────────────────────
// Весь список страниц лежит одной строкой `var PAGES=[...]`, поэтому построчно
// его трогать нельзя - вырежется всё. Разбираем как данные и собираем обратно.
{
  const file = path.join(ROOT, 'assets', 'js', 'search.js');
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/var PAGES\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) console.log('  search.js: список PAGES не найден');
  else {
    const pages = JSON.parse(m[1]);
    const next = pages.filter(p => !String(p.page || '').includes(SLUG));
    if (next.length === pages.length) console.log('  search.js: записи нет');
    else {
      const out = src.slice(0, m.index) + 'var PAGES=' + JSON.stringify(next) + ';'
        + src.slice(m.index + m[0].length);
      write(file, out);
      console.log('  search.js: убрана 1 запись, осталось ' + next.length
        + ' (минифицированную версию пересоберёт сборка)');
      changed++;
    }
  }
}

// ── 4. Генератор ─────────────────────────────────────────────────────────────
// Слаг перечислен в списке OLD - это ровно то, что нужно: генератор оставляет
// на его месте перенаправление и не собирает подборку заново. Не трогаем.
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'build-collections.mjs'), 'utf8');
  const inOld = /const OLD = \[[\s\S]*?\];/.exec(src);
  console.log('  build-collections.mjs: слаг в списке OLD (перенаправление): '
    + (inOld && inOld[0].includes(SLUG) ? 'да, менять не нужно' : 'НЕТ - проверить вручную'));
}

// ── 5. Страница-перенаправление ──────────────────────────────────────────────
{
  const file = path.join(ROOT, 'collections', SLUG, 'index.html');
  const ok = fs.existsSync(file) && /http-equiv="refresh"/.test(fs.readFileSync(file, 'utf8'));
  console.log('  страница подборки: ' + (ok ? 'перенаправляет на /collections/, оставляем' : 'ПРОВЕРИТЬ ВРУЧНУЮ'));
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН' : 'записано') + ', мест изменено: ' + changed);
