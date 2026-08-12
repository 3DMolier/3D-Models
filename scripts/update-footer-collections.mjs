// update-footer-collections.mjs — колонка «Collections» в подвале на всех страницах.
//
// В подвале колонка называлась «Collections», но вела на страницы КАТЕГОРИЙ с
// подписями «Best Vehicles», «Best Aircraft» - то есть на обычную выдачу
// каталога. Это часть той же путаницы, из-за которой раздел коллекций читался
// как ещё одна сортировка по машинам.
//
// Теперь колонка ведёт на настоящие темы товаров-коллекций.
//
// Запуск:  node scripts/update-footer-collections.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SKIP = new Set(['node_modules', 'data', 'assets', 'large_images', 'previews', 'sitemaps', '.git', 'temporary screenshots', 'scripts']);

const LINKS = [
  ['/collections/vehicles/', 'Vehicle Sets'],
  ['/collections/home-interior/', 'Interior Sets'],
  ['/collections/nature/', 'Nature Sets'],
  ['/collections/industrial/', 'Tool &amp; Industrial Sets'],
  ['/collections/', 'All collections &#8594;'],
];
const inner = cls => LINKS.map(([h, t]) => `<a href="${h}" class="${cls}">${t}</a>`).join('');

// Подвал существует в двух вариантах разметки: общий по сайту (cat-footer-*)
// и свой у страниц моделей (mp-footer-*). Обрабатываем оба - иначе обновились бы
// только 1338 страниц из 88 тысяч, а карточки моделей остались бы со ссылками
// на старые подборки.
const VARIANTS = [
  [/(<div class="cat-footer-col-hd">Collections<\/div>\s*<div class="cat-footer-links">)[\s\S]*?(<\/div>)/, 'nav-link'],
  [/(<div class="mp-footer-col-hd">Collections<\/div>\s*<div class="mp-footer-links">)[\s\S]*?(<\/div>)/, 'nav-link mp-footer-link'],
];

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;
  for (const [re, cls] of VARIANTS) {
    if (re.test(html)) html = html.replace(re, (m, open, close) => open + inner(cls) + close);
  }
  if (html === orig) return false;
  fs.writeFileSync(file, html);
  return true;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (SKIP.has(e.name)) continue; yield* walk(path.join(dir, e.name)); }
    else if (e.name.endsWith('.html')) yield path.join(dir, e.name);
  }
}

let changed = 0, seen = 0;
for (const f of walk(ROOT)) {
  seen++;
  if (processFile(f)) changed++;
  if (seen % 20000 === 0) console.error(`  ${seen} файлов, изменено ${changed}`);
}
console.error(`\nОбработано html: ${seen}, обновлён подвал: ${changed}.`);
