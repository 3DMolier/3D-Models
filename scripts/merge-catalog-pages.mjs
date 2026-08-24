/*
 * merge-catalog-pages.mjs - один каталог вместо двух.
 *
 * Почему. В меню стояли две вкладки про одно и то же: «Top 1000» (/catalog/) и
 * «Full Catalog» (/full-catalog/). Разбор показал, что выбирать между ними
 * посетителю не из чего:
 *
 *   /catalog/       в данных 857 моделей, хотя заголовок обещает 1 000,
 *                   а title - «90,000+ Assets». 51 показ в поиске, 0 кликов.
 *                   Люди уходят через 10,5 секунды.
 *   /full-catalog/  59 637 моделей, поиск и фильтры по всему каталогу.
 *                   0 показов в поиске, но люди сидят 36,1 секунды и
 *                   возвращаются: 64 просмотра на 12 человек.
 *
 * То есть трафик шёл на слабую страницу, а работала сильная.
 *
 * Что делаем. Содержимое полного каталога переезжает на /catalog/ - этот адрес
 * Google хотя бы видит, и после объединения слово «full» теряет смысл: полного
 * и неполного каталога больше нет, есть каталог. /full-catalog/ становится
 * перенаправлением: на него ведут ссылки из блога и Pinterest, они не должны
 * упасть в 404.
 *
 * Заодно чиним числа. Сайт называл одно и то же четырьмя способами - 58,527,
 * 65,000+, 86,000+ и 90,000+. Настоящее число моделей в данных каталога -
 * 59 637 (fc-index.json), его и пишем.
 *
 * И убираем плашку «41,783 CheckMate / 12,666 StemCell»: это счётчики закрытой
 * программы TurboSquid, они больше не вырастут, а каталог растёт. На главной их
 * уже убрали, здесь оставались.
 *
 * Запуск:
 *   node merge-catalog-pages.mjs --dry
 *   node merge-catalog-pages.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

const TOTAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8')).total;
const N = TOTAL.toLocaleString('en-US');
console.log('настоящее число моделей в данных каталога: ' + N + '\n');

// ── 1. Страница каталога ─────────────────────────────────────────────────────
{
  let h = fs.readFileSync(path.join(ROOT, 'full-catalog', 'index.html'), 'utf8');
  // Защита от повторного запуска. На первом прогоне /full-catalog/ становится
  // перенаправлением; если запустить скрипт ещё раз, он прочитает заглушку и
  // запишет её в /catalog/ - страница начнёт перенаправлять сама на себя.
  // Так и вышло, восстанавливали из git.
  if (/http-equiv="refresh"/i.test(h)) {
    console.error('ОСТАНОВКА: /full-catalog/ уже перенаправление - объединение выполнено ранее.');
    console.error('Чтобы прогнать заново: git checkout HEAD -- full-catalog/index.html');
    process.exit(1);
  }
  const was = h.length;

  // Адреса: страница живёт по /catalog/.
  h = h.replace(/https:\/\/3dmolierstudio\.com\/full-catalog\//g, () => 'https://3dmolierstudio.com/catalog/');

  // Заголовки и описания - без «full» и с настоящим числом.
  h = h.replace(/<title>[\s\S]*?<\/title>/, () =>
    '<title>3D Model Catalog - ' + N + ' Models | 3D Molier on TurboSquid</title>');
  h = h.replace(/<h1>[\s\S]*?<\/h1>/, () =>
    '<h1>Catalog <span class="text-accent">-</span> ' + N + ' 3D Models</h1>');
  for (const attr of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
    h = h.replace(new RegExp('(<meta ' + attr + ' content=")[^"]*(")'), (m, a, b) =>
      a + 'Browse all ' + N + ' professional 3D models by 3D Molier on TurboSquid. '
      + 'Search by name, filter by price and category.' + b);
  }
  for (const attr of ['property="og:title"', 'name="twitter:title"']) {
    h = h.replace(new RegExp('(<meta ' + attr + ' content=")[^"]*(")'), (m, a, b) =>
      a + '3D Model Catalog - ' + N + ' Models | 3D Molier' + b);
  }

  // Плашка: два счётчика закрытой программы убираем, число моделей чиним.
  const stats = h.match(/<div class="hero-stats">[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="popular-searches")/);
  if (!stats) console.log('  ВНИМАНИЕ: не нашёл плашку со счётчиками');
  else {
    const next = '<div class="hero-stats">'
      + '<div class="hs"><div class="v">' + N + '</div><div class="l">Models</div></div>'
      + '<div class="hs"><div class="v">26</div><div class="l">Categories</div></div>'
      + '<div class="hs"><div class="v">$1-$2,999</div><div class="l">Price Range</div></div>'
      + '</div>';
    h = h.replace(stats[0], () => next);
    console.log('  плашка: убраны 41,783 CheckMate и 12,666 StemCell');
  }

  // Подпись в поле поиска до загрузки данных.
  h = h.replace(/(placeholder=")Search [\d,]+ models…(")/, (m, a, b) => a + 'Search ' + N + ' models…' + b);

  // Остальные упоминания старых чисел в тексте страницы.
  for (const [from, to] of [[/58,527/g, N], [/65,000\+/g, N], [/86,000\+/g, N], [/\bAll 86K\b/g, 'All ' + N]]) {
    h = h.replace(from, () => to);
  }

  if (!DRY) fs.writeFileSync(path.join(ROOT, 'catalog', 'index.html'), h);
  console.log('  /catalog/ - страница заменена содержимым полного каталога (' + was + ' -> ' + h.length + ' символов)');
}

// ── 2. Перенаправление со старого адреса ─────────────────────────────────────
{
  const stub = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=/catalog/">
<link rel="canonical" href="https://3dmolierstudio.com/catalog/">
<meta name="robots" content="noindex, follow">
<title>Moved to the 3D Model Catalog | 3D Molier</title>
<meta name="description" content="The full catalogue has moved. Browse all ${N} 3D models by 3D Molier.">
<script>location.replace("/catalog/");</script>
</head>
<body><p>This page has moved to <a href="/catalog/">the 3D model catalog</a>.</p></body>
</html>
`;
  if (!DRY) fs.writeFileSync(path.join(ROOT, 'full-catalog', 'index.html'), stub);
  console.log('  /full-catalog/ - перенаправление на /catalog/');
}

// ── 3. Подпись в поиске после загрузки всех кусков ───────────────────────────
{
  const file = path.join(ROOT, 'assets', 'js', 'full-catalog.js');
  let js = fs.readFileSync(file, 'utf8');
  const before = js;
  // Каждый прогон дописывал одну и ту же строку - в файле оказалось три
  // объявления totalModels. Правим только если её ещё нет.
  if (js.includes('totalModels')) { console.log('  full-catalog.js: правка уже на месте'); js = null; }
  if (js) {
  // Подпись ставилась по числу уже загруженных записей, а первый кусок - 10 000.
  // Отсюда «Search 10000 models…» при 59 637 в каталоге. Берём общее число из
  // индекса, а не то, что успело догрузиться.
  js = js.replace('var totalChunks=0, loadedChunks=0, imgChunks=0, totalImgChunks=0;',
    () => 'var totalChunks=0, loadedChunks=0, imgChunks=0, totalImgChunks=0;\n'
      + '// Всего моделей в каталоге - из fc-index.json. Подпись в поиске должна\n'
      + '// называть весь каталог, а не первый загруженный кусок в 10 000 записей.\n'
      + 'var totalModels=0;');
  js = js.replace('  totalChunks = fcIdx.chunks;', () => '  totalChunks = fcIdx.chunks;\n  totalModels = fcIdx.total || 0;');
  js = js.replace("qEl.placeholder='Search '+FC.n.length+' models…';",
    () => "qEl.placeholder='Search '+(totalModels||FC.n.length).toLocaleString()+' models…';");
  }
  if (js && js === before) console.log('  ВНИМАНИЕ: full-catalog.js не изменился, проверить вручную');
  else if (js) { if (!DRY) fs.writeFileSync(file, js); console.log('  full-catalog.js: подпись поиска берёт общее число, а не первый кусок'); }
}

// ── 4. Ссылки по всему сайту ─────────────────────────────────────────────────
// Порядок важен: сначала точные пары из меню, иначе на их месте окажутся две
// одинаковые вкладки «Catalog».
const EXACT = [
  ['<a href="/full-catalog/" class="nav-link">Full Catalog</a>', '', 'вкладка меню убрана'],
  ['<a href="/catalog/" class="nav-link">Top 1000</a>', '<a href="/catalog/" class="nav-link">Catalog</a>', 'вкладка меню переименована'],
  ['<a href="/full-catalog/">Full Catalog</a>', '', 'пункт мобильного меню убран'],
  ['<a href="/catalog/">Top 1000 Models</a>', '<a href="/catalog/">Catalog</a>', 'пункт мобильного меню переименован'],
  ['<a href="/catalog/" class="sec-more">Top 1000 &rarr;</a>', '<a href="/catalog/" class="sec-more">All models &rarr;</a>', 'ссылка в секции'],
  ['<a href="/catalog/" class="footer-link">Top 1000 &#8594;</a>', '<a href="/catalog/" class="footer-link">Catalog &#8594;</a>', 'ссылка в подвале'],
  ['<a href="/full-catalog/">All 58,527 Models</a>', '<a href="/catalog/">All ' + N + ' models</a>', 'ссылка в тексте'],
  ['<a href="/full-catalog/">65,000+ 3D models</a>', '<a href="/catalog/">' + N + ' 3D models</a>', 'ссылка в тексте'],
  ['<a href="/full-catalog/">All 86K</a>', '<a href="/catalog/">All ' + N + '</a>', 'ссылка в тексте'],
  ['<a href="/full-catalog/">Browse all 86,000+ models</a>', '<a href="/catalog/">Browse all ' + N + ' models</a>', 'ссылка в тексте'],
  ['<a href="/catalog/">top 1,000 best-sellers</a>', '<a href="/catalog/">full catalogue</a>', 'ссылка в тексте'],
  ['<a href="/catalog/">top 1000</a>', '<a href="/catalog/">catalogue</a>', 'ссылка в тексте'],
  ['<a href="/catalog/">Top 1000</a>', '<a href="/catalog/">Catalog</a>', 'ссылка в тексте'],
];

// Пропускаем служебные папки ТОЛЬКО в корне: имя «tools» носит и корневая
// папка со скриптами, и категория /categories/tools/. Проверка по имени
// выбрасывала 36 страниц категории «Tools» вместе со служебной папкой.
const SKIP_TOP = new Set(['node_modules', '.git', '.claude', 'scripts', 'tools', 'data', 'assets', 'preview']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (dir === ROOT && SKIP_TOP.has(e.name)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const files = walk(ROOT);
console.log('\nстраниц к обходу: ' + files.length);
const hits = {};
let touched = 0;
const stubFull = path.join(ROOT, 'full-catalog', 'index.html');

for (const file of files) {
  if (file === stubFull) continue;                       // это перенаправление
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h)) continue;         // прочие заглушки
  const before = h;
  for (const [from, to, label] of EXACT) {
    if (!h.includes(from)) continue;
    const n = h.split(from).length - 1;
    h = h.split(from).join(to);
    hits[label] = (hits[label] || 0) + n;
  }
  // Всё, что осталось смотреть на /full-catalog/, переводим на /catalog/.
  if (h.includes('href="/full-catalog/"')) {
    const n = h.split('href="/full-catalog/"').length - 1;
    h = h.split('href="/full-catalog/"').join('href="/catalog/"');
    hits['прочие ссылки переведены на /catalog/'] = (hits['прочие ссылки переведены на /catalog/'] || 0) + n;
  }
  if (h === before) continue;
  if (!DRY) fs.writeFileSync(file, h);
  touched++;
  if (touched % 10000 === 0) console.log('  ' + touched + '...');
}

console.log('\nстраниц изменено: ' + touched);
Object.entries(hits).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('   ' + String(v).padStart(7) + '  ' + k));
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано')
  + '\nfull-catalog.min.js и min.css пересоберёт сборка; имена файлов не меняем,\nчтобы не трогать список в .github/workflows/minify.yml.');
