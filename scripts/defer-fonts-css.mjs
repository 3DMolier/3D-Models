/*
 * defer-fonts-css.mjs - снимаем fonts.css с критического пути (пункт 13).
 *
 * ЧТО НАШЛОСЬ. По пункту 13 почти всё уже сделано в прошлые заходы: preconnect
 * и dns-prefetch к p.turbosquid.com, preload шрифта и LCP-картинки, width и
 * height у всех 38 593 картинок в выборке, lazy у всех, кроме главной, скрипты
 * отложены, встроенного JS 8 КБ. Осталась одна вещь.
 *
 * ПРОБЛЕМА. В head четыре таблицы стилей блокируют отрисовку, и самая крупная
 * из них по назначению НЕ срочная: fonts.css (17,9 КБ) - это кириллица,
 * греческий, вьетнамский и прочие подмножества. Латиницу, которой набрана
 * страница, отдаёт critical-fonts.css на 451 байт. То есть браузер ждал 17,9 КБ
 * ради шрифтов, которые на английской странице почти не нужны.
 *
 * РЕШЕНИЕ. Грузим fonts.css как print - такой лист отрисовку не блокирует, - и
 * по событию load переключаем на all. Для отключённого JS оставляем обычный
 * link в noscript. Шрифты подключены с font-display: swap, поэтому текст виден
 * сразу и ничего не мигает.
 *
 * ЧЕГО СДЕЛАТЬ НЕЛЬЗЯ. Пункт про srcset и «не грузить полноразмерные превью в
 * маленькие карточки» не выполним: превью лежат на CDN TurboSquid, и там есть
 * только 1920x1080 - запросы на 1200x630, 600x600, 300x300 отдают 404. Свои
 * уменьшенные копии - это 54 077 карточек по 25 картинок, отдельная история.
 * Смягчает то, что все картинки, кроме главной, помечены lazy и в маленькие
 * карточки за экраном не грузятся вообще.
 *
 * Запуск:  node scripts/defer-fonts-css.mjs --dry
 *          node scripts/defer-fonts-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');

const files = [];
(function walk(rel, d) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === '.git') continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) { if (d < 3 || rel === 'models') walk(nx, d + 1); }
    else if (it.name.endsWith('.html')) files.push(nx);
  }
})('', 0);
console.log('файлов HTML: ' + files.length);

let done = 0, already = 0, skipped = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) { skipped++; continue; }
  if (h.includes('media="print" onload="this.media=')) { already++; continue; }
  const before = h;
  h = h.replace(/<link([^>]*?)href="(\/assets\/css\/fonts\.css[^"]*)"([^>]*?)>/,
    (whole, a, href, b) => {
      if (/media=/.test(whole)) return whole;
      return '<link' + a + 'href="' + href + '"' + b + ' media="print" onload="this.media=\'all\'">'
        + '<noscript><link rel="stylesheet" href="' + href + '"></noscript>';
    });
  if (h === before) continue;
  done++;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('страниц переведено на неблокирующий fonts.css: ' + done);
console.log('уже было сделано: ' + already + ', перенаправлений пропущено: ' + skipped);
if (DRY) console.log('(--dry, ничего не записано)');
