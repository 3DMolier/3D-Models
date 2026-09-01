/*
 * tune-catalog-page.mjs - страница /catalog/ по замечаниям 12-12.7.
 *
 * ЧТО МЕНЯЕМ И ПОЧЕМУ
 *  12    Строка «Showing the 48 best-selling models» врала всем, у кого работает
 *        скрипт: он тут же перерисовывает сетку. Убираем её. Ссылку на /browse/
 *        оставляем, но переносим под сетку: через неё робот обходит все 54 077
 *        карточек, без неё постраничный обход остаётся без входа.
 *  12.1  Ряд «Popular:» дублировал ряд «Category:» - те же aircraft, ship,
 *        helicopter. Убираем ряд, поиск и категории на месте.
 *  12.2  Категории, цена и сертификат лежали в одной строке через разделители и
 *        сливались в кашу. Раскладываем по строкам.
 *  12.3  Двадцать шесть категорий без чисел читаются как стена. Дописываем
 *        количество моделей из data/category-counts.json - единственного
 *        источника этих чисел на сайте.
 *  12.4  Фильтр по сертификату убираем: стандарт у моделей один.
 *
 * Правки 12.5-12.7 лежат в assets/js/full-catalog.js и assets/css/full-catalog.css.
 *
 * Запуск:  node scripts/tune-catalog-page.mjs --dry
 *          node scripts/tune-catalog-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const FILE = path.join(ROOT, 'catalog', 'index.html');

const counts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8')).counts;
const nf = n => Number(n).toLocaleString('en-US');

let h = fs.readFileSync(FILE, 'utf8');
const before = h;
const done = [];

// ── 12.1 ряд «Popular:» ──
h = h.replace(/<div class="popular-searches" id="popular-searches">[\s\S]*?<\/div>\s*(?=<div class="search-row">)/,
  () => { done.push('убран ряд Popular'); return ''; });

// ── 12.4 группа «Cert:» вместе с разделителем перед ней ──
h = h.replace(/<div class="ftag-sep"><\/div><span class="fb-label">Cert:<\/span>(?:<button class="ftag" data-cert="\d">[^<]*<\/button>)+/,
  () => { done.push('убран фильтр Cert'); return ''; });

// ── 12.2 и 12.3 строки фильтров ──
// Категории и цена были одной строкой через разделитель. Делаем две строки,
// у каждой своя подпись слева, и дописываем числа к категориям.
h = h.replace(/(<button class="ftag" data-cat="([a-z0-9-]+)">)([^<]*)(<\/button>)/g,
  (x, a, slug, label, b) => counts[slug]
    ? a + label + ' <span class="ftag-n">' + nf(counts[slug]) + '</span>' + b
    : x);
if (/ftag-n/.test(h)) done.push('к категориям добавлены числа');

h = h.replace(/<span class="fb-label">Category:<\/span>/,
  () => { done.push('строка категорий'); return '<div class="fb-row"><span class="fb-label">Category:</span>'; });
h = h.replace(/<div class="ftag-sep"><\/div><span class="fb-label">Price:<\/span>/,
  () => { done.push('строка цены'); return '</div><div class="fb-row"><span class="fb-label">Price:</span>'; });
h = h.replace(/(<button class="ftag" data-price="u999">[^<]*<\/button>)(<div class="ftag-sep"><\/div>)?/,
  (x, btn) => btn + '</div>');

// ── 12 строка про 48 карточек ──
h = h.replace(/<p class="cat-desc"[^>]*>Showing the 48 best-selling models\.\s*<a href="\/browse\/1\/">([^<]*)<\/a>\s*<\/p>/,
  () => { done.push('убрана строка про 48 карточек'); return ''; });

// ссылка на постраничный обход - под сеткой, рядом с кнопкой «Load more»
if (!/fc-browse-all/.test(h)) {
  h = h.replace(/(<button id="lm-btn"[\s\S]*?<\/button>)/,
    (x, btn) => { done.push('ссылка на постраничный обход перенесена под сетку');
      return btn + '<p class="fc-browse-all"><a href="/browse/1/">Browse all '
        + nf(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8')).total)
        + ' models page by page &#8594;</a></p>'; });
}

if (h === before) console.log('изменений нет');
else {
  if (!DRY) fs.writeFileSync(FILE, h);
  done.forEach(d => console.log('  ' + d));
  console.log(DRY ? '(--dry, ничего не записано)' : 'записано: catalog/index.html');
}
