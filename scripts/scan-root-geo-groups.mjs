/*
 * scan-root-geo-groups.mjs - отбор склеек по признаку основателя (11.09.2026).
 *
 * ОТКУДА ЗАДАЧА. Основатель прислал три карточки плюмерии - красную, жёлтую и
 * «экзотическую». Один цветок, один корень публикации, одинаковая геометрия до
 * единицы, но проходы merge-variants.mjs их не взяли:
 *   • rootcat ограничен техникой (vehicles|military|aircraft|ships|industrial);
 *   • geo требует не меньше 5 000 полигонов (у плюмерии 2 000) и разброс
 *     номеров до 1 000 (у плюмерии 1 881).
 * Так же мимо прошли лоси и кои, которых пришлось склеивать руками.
 *
 * ПРИЗНАК. Общий корень публикации TurboSquid + ТОЧНОЕ совпадение полигонов и
 * вершин + одна категория. Корень говорит «выложено одним автором как одна
 * работа», геометрия - «это буквально тот же меш», категория - «это тот же род
 * вещи». Три условия вместе, поодиночке ни одно не годится.
 *
 * ОГРАНИЧИТЕЛИ, чтобы не склеить разные товары:
 *   • не больше 12 карточек в группе - крупные корни это семейства;
 *   • имена обязаны делить хотя бы одно значащее слово: в корне j2D99XWowR
 *     лежат евромонеты И «Bozok Laser Guided Rocket» с тем же полигонажем;
 *   • число С ЕДИНИЦЕЙ в названии - разные товары, а не варианты:
 *     «10 LB / 14 LB Medicine Ball», «48 / 55 inch TV»;
 *   • наборы (collection/set/pack) не трогаем - набор не вариант предмета;
 *   • уже склеенные между собой пропускаем.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО. Отделять «настоящие варианты» (цвет, поза, софт) от
 * «разных предметов на общем меше» (штат на номерном знаке, номинал купюры)
 * автоматически не выходит: словарь описательных различий уводил номиналы КНДР
 * в безопасный класс, а плюмерию - в опасный. Решение основателя 11.09.2026:
 * склеивать и то и другое, номиналы и штаты сохранять в ключевых словах.
 *
 * Сеть не нужна: всё берётся из записей data/records.
 *
 * Запуск:
 *   node scripts/scan-root-geo-groups.mjs --dry   посчитать и показать примеры
 *   node scripts/scan-root-geo-groups.mjs         записать data/rootgeo-groups.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const DRY = process.argv.includes('--dry');
const RECS = path.join(ROOT, 'data', 'records');
const OUT = path.join(ROOT, 'data', 'rootgeo-groups.json');

const MAX_CARDS = 12;

const all = [];
for (const f of fs.readdirSync(RECS).filter(x => /^records-\d+\.json$/.test(x)))
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, f), 'utf8'))) all.push(r);

// Слова, которые есть у всех подряд и родства не доказывают.
const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'with', 'for', 'in', 'on', 'to', 'by',
  '3d', 'model', 'models', 'collection', 'set', 'new', 'old', 'used', 'rigged', 'animated',
  'simplified', 'simple', 'generic', 'low', 'poly', 'lowpoly', 'fur', 'pose', 'posed']);
const toks = n => new Set(String(n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)));

// Число с единицей измерения - признак разных товаров.
const UNIT = /\b\d{1,4}\s*(lb|lbs|kg|ml|vol|inch|in|cm|mm|ft|hp|gb|tb|oz|mah|watt|volt|litre|liter|gallon|pcs|mp|k)\b/i;

const groups = new Map();
for (const r of all) {
  if (r.status === 'new') continue;
  if (r.is_collection) continue;
  const s = r.specs || {};
  if (!r.root || r.root === '0' || !s.polygons || !s.vertices) continue;
  const k = r.root + '|' + s.polygons + '|' + s.vertices + '|' + (r.category_name || '');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const found = [];
const cut = { размер: 0, нетОбщегоСлова: 0, единицы: 0, ужеСклеены: 0 };
for (const [k, g] of groups) {
  if (g.length < 2) continue;
  if (g.length > MAX_CARDS) { cut.размер++; continue; }
  const slugs = new Set(g.map(x => x.slug));
  if (g.some(x => (x.family || []).some(v => slugs.has(v.slug)))) { cut.ужеСклеены++; continue; }
  const sets = g.map(x => toks(x.name));
  const common = [...sets[0]].filter(t => sets.every(s => s.has(t)));
  if (!common.length) { cut.нетОбщегоСлова++; continue; }
  if (g.some(x => UNIT.test(x.name))) { cut.единицы++; continue; }
  found.push({
    root: k.split('|')[0], poly: g[0].specs.polygons, cat: g[0].category_name,
    common: common.slice(0, 3).join(' '),
    slugs: g.slice().sort((a, b) => b.sales - a.sales).map(x => x.slug),
    names: g.slice().sort((a, b) => b.sales - a.sales).map(x => x.name),
  });
}

found.sort((a, b) => b.slugs.length - a.slugs.length);
const cards = found.reduce((s, x) => s + x.slugs.length, 0);
console.log('групп: ' + found.length + ', карточек в них: ' + cards
  + ', свернётся: ' + (cards - found.length));
console.log('отсеяно: крупных корней ' + cut.размер + ', без общего слова ' + cut.нетОбщегоСлова
  + ', с единицами измерения ' + cut.единицы + ', уже склеены ' + cut.ужеСклеены);

const byCat = {};
for (const f of found) byCat[f.cat] = (byCat[f.cat] || 0) + 1;
console.log('\nпо категориям:');
Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([c, n]) => console.log('  ' + String(n).padStart(4) + '  ' + c));

if (DRY) {
  console.log('\n--- первые 10 групп ---');
  for (const f of found.slice(0, 10)) {
    console.log('\n  ' + f.cat + ', ' + f.poly + ' полиг., общее «' + f.common + '»');
    f.names.forEach(n => console.log('      ' + n.slice(0, 60)));
  }
  console.log('\nсухой прогон, файл не записан');
} else {
  fs.writeFileSync(OUT, JSON.stringify(found.map(f => f.slugs)), 'utf8');
  console.log('\nзаписано: data/rootgeo-groups.json');
}
