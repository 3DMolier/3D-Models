/*
 * fix-browse-stubs.mjs - заглушки /browse/NNN/ убираем из индекса (пункт 2).
 *
 * ЧТО ПРОВЕРЕНО. Из пяти требований четыре уже выполнены:
 *   - заглушек в sitemap НЕТ (0 из 65);
 *   - внутренних ссылок на них НЕТ (0);
 *   - цепочки перенаправлений НЕТ: /browse/169/ ведёт сразу на /browse/;
 *   - страниц /browse/ живых 109 (1-109), заглушек 65 (110-174).
 * Не выполнено одно: заглушка отдаёт HTTP 200 и не помечена noindex, поэтому
 * поисковик считает её обычной страницей и продолжает обходить.
 *
 * ЧЕГО СДЕЛАТЬ НЕЛЬЗЯ. Настоящий 301 на GitHub Pages невозможен: сервер отдаёт
 * только статические файлы, заголовков он не выставляет. Единственный доступный
 * механизм - meta refresh плюс canonical, он и стоит. Настоящие 301 появятся,
 * только если поставить перед сайтом Cloudflare, - это отдельное решение.
 *
 * ЧТО ДЕЛАЕМ. Ставим на заглушки noindex, follow - ровно как на других
 * заглушках сайта (/full-catalog/). Тогда адрес выпадет из индекса, а вес по
 * ссылкам продолжит перетекать на живую страницу.
 *
 * Запуск:  node scripts/fix-browse-stubs.mjs --dry
 *          node scripts/fix-browse-stubs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const ROBOTS = '<meta name="robots" content="noindex, follow">';

let stubs = 0, fixed = 0, already = 0, live = 0;
const dirs = [];
(function collect(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) if (it.isDirectory()) dirs.push(rel + '/' + it.name);
})('browse');

for (const rel of dirs) {
  const file = path.join(ROOT, rel, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (!/http-equiv="refresh"/i.test(h)) { live++; continue; }
  stubs++;
  if (/<meta name="robots"/.test(h)) { already++; continue; }
  // Ставим сразу за canonical: там же, где стоит на остальных заглушках сайта.
  const before = h;
  h = h.replace(/(<link rel="canonical"[^>]*>)/, (x, a) => a + ROBOTS);
  if (h === before) h = h.replace(/(<title>)/, () => ROBOTS + '<title>');
  if (h === before) continue;
  fixed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('страниц /browse/: живых ' + live + ', заглушек ' + stubs);
console.log('проставлен noindex: ' + fixed + (already ? ', уже было: ' + already : ''));
if (DRY) console.log('(--dry, ничего не записано)');
