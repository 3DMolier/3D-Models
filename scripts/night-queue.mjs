/*
 * night-queue.mjs - очередь карточек на рукописное описание.
 *
 * Порядок важен: карточек 59 639, за ночь выходит сотня-полторы, поэтому
 * первыми должны идти те, где текст даёт отдачу уже завтра. Сортируем по
 * показам в поиске (данные GSC за 90 дней), потом по цене - дорогая модель
 * приносит больше с той же строчки текста.
 *
 * Уже написанные карточки помечены в самом файле карточки меткой
 * <!-- written:v1 -->, а список пройденного лежит в tools/night-writer/done.txt.
 * Метка - источник правды: если файл списка потеряется, очередь пересоберётся
 * по меткам.
 *
 * Запуск:  node night-queue.mjs [--rebuild]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const WORK = path.join(ROOT, 'tools', 'night-writer');
const GSC = 'D:/Clode_Work_Folder/tools/ga-analytics/gsc-top-pages.json';
const MARK = '<!-- written:v1 -->';

fs.mkdirSync(WORK, { recursive: true });

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVar = new Set(Object.keys(merged));

const impressions = new Map();
if (fs.existsSync(GSC)) {
  for (const r of JSON.parse(fs.readFileSync(GSC, 'utf8'))) {
    const m = r.url.match(/\/models\/([^/]+)\//);
    if (m) impressions.set(m[1], r.impressions);
  }
}
console.log('карточек с показами в GSC: ' + impressions.size);

const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const cell = (h, k) => {
  const m = h.match(new RegExp('<th[^>]*>\\s*' + k + '\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>'));
  return m ? plain(m[1]) : '';
};

const rows = [];
const done = [];
let live = 0;
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  if (isVar.has(slug)) continue;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h)) continue;
  live++;
  if (h.includes(MARK)) { done.push(slug); continue; }
  rows.push({
    slug,
    imp: impressions.get(slug) || 0,
    price: +(cell(h, 'Price').match(/\$([\d.]+)/) || [])[1] || 0,
  });
}

rows.sort((a, b) => (b.imp - a.imp) || (b.price - a.price) || a.slug.localeCompare(b.slug));

fs.writeFileSync(path.join(WORK, 'queue.json'), JSON.stringify(rows.map(r => r.slug), null, 0));
fs.writeFileSync(path.join(WORK, 'done.txt'), done.join('\n') + (done.length ? '\n' : ''));

const withImp = rows.filter(r => r.imp > 0).length;
console.log('живых карточек:      ' + live);
console.log('уже написано:        ' + done.length);
console.log('в очереди:           ' + rows.length);
console.log('  из них с показами: ' + withImp + '  (их пишем первыми)');
console.log('\nпервые десять в очереди:');
rows.slice(0, 10).forEach((r, i) => console.log('  ' + (i + 1) + '. показов ' + String(r.imp).padStart(3)
  + '  $' + String(r.price).padEnd(5) + '  ' + r.slug));
