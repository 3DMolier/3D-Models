/*
 * fix-seo-fallback-block.mjs - убрать блок, сделанный «для роботов», из-под
 * подвала и вернуть его людям.
 *
 * Что не так. На /catalog/ и /search/ стоит секция с комментарием
 * «Static SEO fallback for crawlers without JS»: список популярных категорий
 * ссылками. Две беды сразу:
 *
 *   1. Она стоит ПОСЛЕ </footer>. Человек долистывает до подвала - и видит под
 *      ним ещё один кусок содержимого. Выглядит как сломанная вёрстка.
 *   2. На ней aria-hidden="true", хотя блок видимый. Зрячий посетитель ссылки
 *      видит и может нажать, а тот, кто читает экран голосом, не получает их
 *      вовсе. Это не «скрытый от людей текст для поисковика» - это видимый
 *      текст, отнятый у части людей.
 *
 * Ссылки сами по себе полезные, поэтому блок не удаляем, а переносим внутрь
 * <main> перед подвалом и снимаем aria-hidden. Тогда он работает и для
 * человека, и для краулера - в этом порядке.
 *
 * Запуск:
 *   node fix-seo-fallback-block.mjs --dry
 *   node fix-seo-fallback-block.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');
const FILES = ['catalog/index.html', 'search/index.html'];

for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  let h = fs.readFileSync(f, 'utf8');

  const m = h.match(/<!--\s*Static SEO fallback[^>]*-->\s*<section class="seo-fallback"[\s\S]*?<\/section>/i);
  if (!m) { console.log(rel.padEnd(24) + 'блока нет - уже исправлено'); continue; }
  let block = m[0];

  const after = h.indexOf(m[0]) > h.lastIndexOf('</footer>');
  if (!after && !/aria-hidden="true"/.test(block)) {
    console.log(rel.padEnd(24) + 'уже на месте и без aria-hidden');
    continue;
  }

  h = h.replace(m[0], '');

  // Комментарий про краулеров больше не нужен: блок теперь обычный раздел
  // страницы. aria-hidden снимаем - ссылки должны читаться голосом.
  block = block
    .replace(/<!--\s*Static SEO fallback[^>]*-->\s*/i, '')
    .replace(/\s*aria-hidden="true"/i, '');

  // Ставим перед подвалом. Если <main> закрывается - внутрь него, иначе просто
  // выше <footer>.
  const mainEnd = h.lastIndexOf('</main>');
  const footStart = h.lastIndexOf('<footer');
  if (mainEnd !== -1 && mainEnd < footStart) {
    h = h.slice(0, mainEnd) + block + h.slice(mainEnd);
  } else if (footStart !== -1) {
    h = h.slice(0, footStart) + block + h.slice(footStart);
  } else {
    console.log(rel.padEnd(24) + 'ОСТАНОВКА: не нашли, куда ставить');
    continue;
  }

  if (!DRY) fs.writeFileSync(f, h);
  console.log(rel.padEnd(24) + 'перенесён внутрь страницы, aria-hidden снят');
}
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'готово'));
