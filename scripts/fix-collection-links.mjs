/*
 * fix-collection-links.mjs - подсказки поиска должны вести в настоящие подборки.
 *
 * Что было. В подсказках поиска висели семь подборок, и все семь оказались
 * перенаправлениями: «Best Aircraft 3D Models», «Best Ship 3D Models» и
 * «StemCell Certified 3D Models» просто выбрасывали человека на общий список,
 * остальные четыре уводили на подборку с другим названием. При этом на сайте
 * лежат шестнадцать живых подборок по шестьдесят моделей, и через поиск не
 * находилась ни одна из них.
 *
 * Подборка StemCell относится к закрытой программе TurboSquid - как и
 * CheckMate, которую убрали раньше. Отдельная полка «сертифицированные» теперь
 * вводит в заблуждение: знак получали те модели, что успели попасть в
 * программу до её закрытия, а не те, что построены лучше.
 *
 * Что делаем. Заменяем семь мёртвых подсказок на шестнадцать живых подборок,
 * названия берём с самих страниц - подсказка должна обещать то, что откроется.
 * В подвале полного каталога меняем ссылку StemCell на настоящую подборку.
 * Страницы-перенаправления по старым адресам оставляем: внешние ссылки должны
 * приходить хоть куда-то, а не в 404.
 *
 * Запуск:
 *   node fix-collection-links.mjs --dry
 *   node fix-collection-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

// Значок подбирается по теме подборки; названия берутся со страниц.
const ICONS = {
  architecture: '🏛️', 'art-media': '🎼', characters: '👤', 'currency-symbols': '💰',
  fashion: '👗', 'food-drink': '🍽️', holidays: '🎁', 'home-interior': '🛋️',
  industrial: '⚙️', nature: '🌿', 'science-medical': '🔬', sports: '⚽',
  technology: '💻', 'toys-games': '🧸', vehicles: '🚗', weapons: '🗡️',
};

// ── Собираем живые подборки ──────────────────────────────────────────────────
const live = [];
for (const dir of fs.readdirSync(path.join(ROOT, 'collections')).sort()) {
  const file = path.join(ROOT, 'collections', dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  const h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h)) continue;          // перенаправление, не подборка
  const title = ((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  if (!title) { console.log('  без заголовка, пропускаю: ' + dir); continue; }
  const models = new Set([...h.matchAll(/\/models\/([a-z0-9-]+)\//g)].map(m => m[1])).size;
  live.push({ type: 'collection', title, page: '/collections/' + dir + '/', icon: ICONS[dir] || '📦', models });
}
console.log('живых подборок найдено: ' + live.length);
live.forEach(c => console.log('   ' + c.icon + ' ' + c.title.padEnd(34) + c.page.padEnd(34) + 'моделей ' + c.models));

// ── Подсказки поиска ─────────────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'assets', 'js', 'search.js');
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/var PAGES\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) { console.error('не нашёл список PAGES'); process.exit(1); }
  const pages = JSON.parse(m[1]);
  const old = pages.filter(p => p.type === 'collection');

  // Ставим подборки на то же место, где они стояли: между категориями и
  // отраслями. Порядок пунктов в подсказках задаёт этот массив.
  const first = pages.findIndex(p => p.type === 'collection');
  const rest = pages.filter(p => p.type !== 'collection');
  const at = first < 0 ? rest.findIndex(p => p.type === 'industry') : first;
  const next = rest.slice(0, at).concat(live.map(({ models, ...c }) => c), rest.slice(at));

  const out = src.slice(0, m.index) + 'var PAGES=' + JSON.stringify(next) + ';' + src.slice(m.index + m[0].length);
  if (!DRY) fs.writeFileSync(file, out);
  console.log('\nsearch.js: подборок было ' + old.length + ', стало ' + live.length
    + '; всего пунктов ' + pages.length + ' -> ' + next.length);
  old.forEach(o => console.log('   убрано: ' + o.title));
}

// ── Подвал полного каталога ──────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'full-catalog', 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  const re = /<a href="\/collections\/stemcell-certified-3d-models\/">StemCell<\/a>/;
  if (!re.test(h)) console.log('\nfull-catalog: ссылки StemCell нет');
  else {
    // Ведём на настоящую подборку той же темы - научно-медицинскую.
    h = h.replace(re, () => '<a href="/collections/science-medical/">Science &amp; Medical</a>');
    if (!DRY) fs.writeFileSync(file, h);
    console.log('\nfull-catalog: StemCell -> Science & Medical');
  }
  // Соседняя ссылка «Best Vehicles» ведёт в категорию, а не в подборку -
  // в колонке Collections это сбивает.
  const re2 = /<a href="\/categories\/vehicles\/">Best Vehicles<\/a>/;
  if (re2.test(h)) {
    h = h.replace(re2, () => '<a href="/collections/vehicles/">Vehicle Collections</a>');
    if (!DRY) fs.writeFileSync(file, h);
    console.log('full-catalog: «Best Vehicles» вела в категорию -> подборка /collections/vehicles/');
  }
}

// ── Запись в данных ──────────────────────────────────────────────────────────
{
  const file = path.join(ROOT, 'data', 'collections.json');
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = list.filter(c => c.collection_slug !== 'stemcell-certified-3d-models');
  if (next.length === list.length) console.log('\ncollections.json: записи StemCell нет');
  else {
    if (!DRY) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    console.log('\ncollections.json: убрана запись StemCell, осталось ' + next.length);
  }
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано')
  + '\nСтраницы-перенаправления по старым адресам оставлены - внешние ссылки не должны падать в 404.'
  + '\nМинифицированную версию search.min.js пересоберёт сборка.');
