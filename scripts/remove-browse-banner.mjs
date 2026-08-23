/*
 * remove-browse-banner.mjs - убрать полосу «Browsing the whole library?».
 *
 * Текст «See the complete index of all 86,869 models - every model page in one
 * place» написан не для читателя, а чтобы обходчик нашёл /browse/. Человеку на
 * витрине он не нужен, а число в нём ещё и своё, отличное от остальных чисел на
 * странице.
 *
 * Страница /browse/ не осиротеет: у неё своя карта сайта
 * sitemaps/sitemap-browse.xml, обходчик придёт по ней.
 *
 * Запуск:
 *   node remove-browse-banner.mjs --dry
 *   node remove-browse-banner.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');
const PAGES = ['index.html', 'full-catalog/index.html', 'catalog/index.html'];

// Полоса - это секция с одним абзацем по центру. Режем секцию целиком, иначе
// останется пустой отступ там, где был текст.
const RE = /<section[^>]*>\s*<div class="max-w-7xl mx-auto" style="text-align:center[^"]*">\s*<p[^>]*>Browsing the whole library\?[\s\S]*?<\/section>/;

let done = 0;
for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.log('  нет файла: ' + rel); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!RE.test(html)) { console.log('  уже убрано: ' + rel); continue; }
  const next = html.replace(RE, '');
  if (next.includes('Browsing the whole library')) { console.log('  ОСТАЛСЯ текст: ' + rel); continue; }
  if (!DRY) fs.writeFileSync(file, next);
  console.log('  убрано: ' + rel + '  (-' + (html.length - next.length) + ' симв.)');
  done++;
}
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН' : 'записано') + ', страниц: ' + done);
