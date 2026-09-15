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
/*
 * ИСТОЧНИК ПРАВДЫ О НАПИСАННОМ - data/model-hand-desc.json, а не метка в файле
 * страницы.
 *
 * Метка <!-- written:v1 --> стояла прямо в карточке, и сам текст жил только
 * там же. Когда карточки перевели на сборку из записи, страницы перерисовались
 * из данных, и вместе с меткой исчез текст - 1 762 штуки. После этого очередь
 * считала написанными ноль карточек и предлагала писать заново уже написанное.
 *
 * Теперь текст лежит в data/model-hand-desc.json и переживает пересборку.
 * Метку в разметку не возвращаем: страница собирается из записи, и любая
 * пометка в ней - это снова правда, хранящаяся не там, где надо.
 */
const HAND = (() => {
  const f = path.join(ROOT, 'data', 'model-hand-desc.json');
  if (!fs.existsSync(f)) return new Set();
  return new Set(Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))));
})();

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

/*
 * Цена, продажи и состав семьи берутся из ЗАПИСЕЙ, а не разбором HTML
 * карточки: там они лежат полями. Вытаскивать их регуляркой из готовой
 * страницы значит читать то, что сам же и напечатал.
 */
const RECS = path.join(ROOT, 'data', 'records');
const byslug = new Map();
if (fs.existsSync(RECS)) {
  for (const f of fs.readdirSync(RECS).filter(x => /^records-\d+\.json$/.test(x)))
    for (const r of JSON.parse(fs.readFileSync(path.join(RECS, f), 'utf8'))) byslug.set(r.slug, r);
}

const rows = [];
const done = [];
let live = 0;
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  if (isVar.has(slug)) continue;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  if (HAND.has(slug)) { done.push(slug); continue; }
  const r = byslug.get(slug) || {};
  rows.push({
    slug,
    imp: impressions.get(slug) || 0,
    sales: +r.sales || 0,
    family: (r.family || []).length,
    price: +r.price || +(cell(h, 'Price').match(/\$([\d.]+)/) || [])[1] || 0,
  });
}

/*
 * ПОРЯДОК, утверждённый основателем 15.09.2026. Карточек без текста 36 421, за
 * прогон выходит сотня-полторы - значит вопрос не «когда всё», а «что первым».
 *
 *   1. ПРОДАЖИ. Карточка уже доказала спрос деньгами - самый твёрдый признак
 *      из всех, что у нас есть.
 *   2. ПОКАЗЫ В ПОИСКЕ. Google страницу показывает, а кликов нет: тексту тут
 *      работать заметнее всего.
 *   3. РАЗМЕР СЕМЬИ. Склеенная карточка работает за десяток - один текст
 *      закрывает все её версии. Плюс у пятисот таких текст уже частично
 *      написан: он лежит на свёрнутых адресах и годится как основа.
 *
 * Цена - последний разделитель: при прочих равных дорогая модель приносит
 * больше с той же строчки текста.
 *
 * Прежний порядок начинался с показов. Продажи стоят выше, потому что показ -
 * это обещание, а продажа - факт.
 */
rows.sort((a, b) => (b.sales - a.sales) || (b.imp - a.imp)
  || (b.family - a.family) || (b.price - a.price) || a.slug.localeCompare(b.slug));

fs.writeFileSync(path.join(WORK, 'queue.json'), JSON.stringify(rows.map(r => r.slug), null, 0));
fs.writeFileSync(path.join(WORK, 'done.txt'), done.join('\n') + (done.length ? '\n' : ''));

const withSales = rows.filter(r => r.sales > 0).length;
const withImp = rows.filter(r => r.sales === 0 && r.imp > 0).length;
const withFam = rows.filter(r => r.sales === 0 && r.imp === 0 && r.family > 0).length;
console.log('живых карточек:        ' + live);
console.log('уже написано:          ' + done.length);
console.log('в очереди:             ' + rows.length);
console.log('  1. с продажами:      ' + withSales);
console.log('  2. с показами:       ' + withImp);
console.log('  3. склеенные семьи:  ' + withFam);
console.log('  остальные:           ' + (rows.length - withSales - withImp - withFam));
console.log('\nпервые десять в очереди:');
rows.slice(0, 10).forEach((r, i) => console.log('  ' + (i + 1) + '. продаж ' + String(r.sales).padStart(3)
  + '  показов ' + String(r.imp).padStart(3) + '  версий ' + String(r.family).padStart(2)
  + '  $' + String(r.price).padEnd(5) + '  ' + r.slug));
