// collapse-duplicates.mjs — удаление коллекций, дублирующих хабы категорий и отраслей.
//
// Основание (Search Console за 28 дней + разбор вёрстки):
//   • 19 коллекций дали 1 клик, 12 отраслей — 1 клик; карточки моделей — 106.
//   • По «ship 3d model» три наши страницы толкались на позициях 63, 67 и 78:
//     коллекция, категория и вторая коллекция. Ни одна не выигрывала.
//   • Коллекции НЕ ссылаются на наши карточки: 0 внутренних ссылок против 100 у хаба
//     категории, зато 32 ссылки прямо на TurboSquid. Вес каталогу не передают.
//
// Остаются: хабы категорий, страницы отраслей (у них есть внутренние ссылки) и две
// коллекции по сертификации — у них нет эквивалента среди категорий.
//
// Редиректов на GitHub Pages нет, удалённые адреса отдадут 404. Для схлопывания это
// рабочий сигнал: Google убирает страницу из индекса и сводит запросы на оставшуюся.
//
// УДАЛЕНИЕ ТОЧЕЧНОЕ, БЕЗ РЕКУРСИИ. В каталоге коллекции лежит ровно один index.html:
// удаляем именно его, затем убираем каталог обычным rmdir — он откажется работать,
// если внутри осталось что-то ещё. Любая неожиданность останавливает процесс сама.
//
// Запуск:  node scripts/collapse-duplicates.mjs --dry
//          node scripts/collapse-duplicates.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');

const REPLACED_BY = {
  'best-ship-3d-models': '/categories/ships/',
  'ship-3d-models-for-maritime-simulation': '/categories/ships/',
  'best-medical-3d-models': '/categories/medical-3d-models/',
  'medical-anatomy-3d-models-for-education': '/categories/medical-3d-models/',
  'best-military-vehicle-3d-models': '/categories/military-vehicles/',
  'uav-drone-3d-models-for-defense-visualization': '/categories/military-vehicles/',
  'best-vehicle-3d-models': '/categories/vehicles/',
  'vehicle-3d-models-for-advertising': '/categories/vehicles/',
  'best-aircraft-3d-models': '/categories/aircraft/',
  'aircraft-3d-models-for-flight-simulation': '/categories/aircraft/',
  'best-architecture-landmark-3d-models': '/categories/architecture-landmarks/',
  'best-industrial-equipment-3d-models': '/categories/industrial-equipment/',
  'industrial-equipment-3d-models-for-technical-animation': '/categories/industrial-equipment/',
  '3d-models-for-advertising': '/industries/advertising/',
  '3d-models-for-aerospace-visualization': '/industries/aerospace/',
  '3d-models-for-architecture-visualization': '/industries/architecture/',
  '3d-models-for-defense-simulation': '/industries/military-defense/',
  '3d-models-for-event-management': '/industries/event-management/',
  '3d-models-for-film-production': '/industries/film-video-production/',
  '3d-models-for-game-development': '/industries/game-development/',
  '3d-models-for-hardware-presentation': '/industries/hardware/',
  '3d-models-for-medical-visualization': '/industries/medical/',
  '3d-models-for-vr-projects': '/industries/virtual-reality/',
};
const KEEP = ['checkmate-certified-3d-models', 'stemcell-certified-3d-models'];

const COLL = path.join(ROOT, 'collections');
const existing = fs.readdirSync(COLL, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const kill = existing.filter(c => REPLACED_BY[c]);
const keep = existing.filter(c => !REPLACED_BY[c]);
const unknown = keep.filter(c => !KEEP.includes(c));

console.log('коллекций всего: ' + existing.length);
console.log('под удаление:    ' + kill.length);
console.log('остаются:        ' + keep.join(', '));
if (unknown.length) console.log('БЕЗ ЯВНОГО РЕШЕНИЯ (не трогаю): ' + unknown.join(', '));

// ── 1. внутренние ссылки на удаляемые: переписываем на замену ──
console.log('\n=== ССЫЛКИ НА УДАЛЯЕМЫЕ СТРАНИЦЫ ===');
const SCAN = ['index.html', 'collections/index.html', 'about/index.html', 'catalog/index.html',
  'full-catalog/index.html', 'search/index.html', 'custom-order/index.html', 'data-licensing/index.html',
  'sitemap.xml', 'llms.txt', 'llms-full.txt'];
for (const c of ['categories', 'industries']) {
  const dir = path.join(ROOT, c);
  if (!fs.existsSync(dir)) continue;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) SCAN.push(c + '/' + d.name + '/index.html');
  }
}
// Индекс коллекций — особый случай: там карточки и разметка ItemList. Подменять в них
// адреса нельзя, получится «список коллекций», ведущий в категории. Оттуда записи
// удаляются целиком, отдельной процедурой ниже.
const COLL_INDEX = 'collections/index.html';

const fixes = [];
for (const rel of SCAN) {
  if (rel === COLL_INDEX) continue;
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const hits = kill.filter(c => html.includes('/collections/' + c + '/'));
  if (hits.length) fixes.push({ rel, hits });
}
console.log('страниц со ссылками: ' + fixes.length + ' (плюс индекс коллекций — отдельно)');

let rewritten = 0;
for (const { rel, hits } of fixes) {
  const f = path.join(ROOT, rel);
  let html = fs.readFileSync(f, 'utf8');
  for (const c of hits) html = html.split('/collections/' + c + '/').join(REPLACED_BY[c]);
  // страховка на меню — та же, что в reclassify-other.mjs
  if (rel.endsWith('.html') && !html.includes('<a href="/categories/other/" role="menuitem"')) {
    console.log('  ОСТАНОВКА: пострадало меню на ' + rel);
    process.exit(1);
  }
  if (!DRY) fs.writeFileSync(f, html);
  console.log('  ' + (DRY ? 'переписал бы ' : 'переписал ') + rel + '  (' + hits.length + ')');
  rewritten++;
}

// ── 1б. индекс коллекций: убираем карточки и записи ItemList удалённых ──
{
  const f = path.join(ROOT, COLL_INDEX);
  let html = fs.readFileSync(f, 'utf8');
  const cardsBefore = (html.match(/class="coll-idx-card"/g) || []).length;
  const itemsBefore = (html.match(/"@type":"ListItem"/g) || []).length;

  for (const c of kill) {
    // карточка: <a href="/collections/C/" class="coll-idx-card"> … </a>
    const open = '<a href="/collections/' + c + '/" class="coll-idx-card">';
    let i = html.indexOf(open);
    while (i !== -1) {
      const end = html.indexOf('</a>', i);
      if (end === -1) break;
      html = html.slice(0, i) + html.slice(end + 4);
      i = html.indexOf(open);
    }
    // запись списка: {"@type":"ListItem", … /collections/C/"}
    html = html.replace(new RegExp(',?\\{"@type":"ListItem"[^{}]*?' + c.replace(/[-]/g, '\\-') + '\\/"\\}', 'g'), '');
  }
  // После вырезания записей в массиве остаются висячие запятые — чиним,
  // иначе JSON-LD становится невалидным (первый прогон на этом и остановился).
  html = html.replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']').replace(/,\s*,/g, ',');

  // позиции в списке после удаления идут с дырами — перенумеровываем
  let pos = 0;
  html = html.replace(/"position":\d+/g, () => '"position":' + (++pos));

  const cardsAfter = (html.match(/class="coll-idx-card"/g) || []).length;
  const itemsAfter = (html.match(/"@type":"ListItem"/g) || []).length;
  console.log('\n=== ИНДЕКС КОЛЛЕКЦИЙ ===');
  console.log('  карточек: ' + cardsBefore + ' → ' + cardsAfter);
  console.log('  записей ItemList: ' + itemsBefore + ' → ' + itemsAfter);

  let bad = 0;
  for (const b of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); } catch (e) { bad++; }
  }
  if (bad) { console.log('  ОСТАНОВКА: битый JSON-LD после правки (' + bad + ')'); process.exit(1); }
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) {
    console.log('  ОСТАНОВКА: пострадало меню'); process.exit(1);
  }
  if (!DRY) fs.writeFileSync(f, html);
}

// ── 2. удаление: файл, затем пустой каталог ──
console.log('\n=== УДАЛЕНИЕ ===');
let removed = 0, skipped = 0;
for (const c of kill) {
  const dir = path.join(COLL, c);
  if (!fs.existsSync(dir)) { console.log('  нет каталога: ' + c); continue; }
  const files = fs.readdirSync(dir);
  const unexpected = files.filter(f => f !== 'index.html');
  if (unexpected.length) {
    console.log('  ПРОПУСК ' + c + ': посторонние файлы — ' + unexpected.join(', '));
    skipped++;
    continue;
  }
  if (!DRY) {
    fs.unlinkSync(path.join(dir, 'index.html'));
    fs.rmdirSync(dir);                 // откажется, если каталог не пуст
  }
  console.log('  ' + (DRY ? 'удалил бы ' : 'удалил   ') + '/collections/' + c + '/  →  ' + REPLACED_BY[c]);
  removed++;
}

console.log('\nпереписано страниц: ' + rewritten);
console.log('удалено коллекций:  ' + removed + (skipped ? ', пропущено ' + skipped : ''));
if (DRY) console.log('\n(--dry: ничего не тронуто)');
else console.log('\nДальше обязательно: node scripts/refresh-sitemaps.mjs');
