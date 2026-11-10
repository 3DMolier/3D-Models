/*
 * import-ts-specs.mjs - характеристики из кабинета TurboSquid -> data/model-specs.json (10.11.2026, фаза 1
 * плана D:\Clode_Work_Folder\plans\2026-11-09-card-value-after-quality-drop.md).
 *
 * Источник - C:\Clode_Work_Folder\tools\turbosquid\ts-specs.json (собирает ts-specs-collect.mjs из gon.product
 * страницы редактора товара). Это карточки, которых нет в выгрузке студии: коллекции и версии (Rigged, Simple,
 * Animated, for Maya/Blender/C4D). build-model-records.mjs берёт model-specs.json только для записей без
 * характеристик студии, так что студия всегда главнее.
 *
 * Значения переводятся в словарь студии - карточка показывает их как есть:
 *   rigged true/false  -> «model is jointed» / «model is not jointed»
 *   unwrapped_u_vs     -> «Yes, non-overlapping», «Yes, overlapping», «Mixed», «No»
 *   geometry           -> «polygonal quads/tris», «polygonal quads only», «subdivision» ...
 * Полигоны и вершины 0-1 у старых коллекций - заглушка TurboSquid, а не число: пишем null, строки на карточке не будет.
 * Число текстур TurboSquid не отдаёт (только «есть/нет»), размеров текстур и габаритов нет - эти поля пустые.
 * Записи студии (без source) не перезаписываются никогда.
 *
 *   node scripts/import-ts-specs.mjs [--dry] [--limit N] [--order <файл с номерами>]
 *   --limit: перенести не больше N новых записей (порции ниже потолка ежедневной публикации 5 000 карточек)
 *   --order: порядок переноса (по умолчанию - порядок сбора: сначала карточки из карт сайта)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { formatsFromFiles } from './lib/formats.mjs';

const SRC = 'C:/Clode_Work_Folder/tools/turbosquid/ts-specs.json';
const ORDER_DEFAULT = 'C:/Clode_Work_Folder/tools/turbosquid/ts-specs-todo.txt';
const SPECS = path.join(ROOT, 'data', 'model-specs.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const li = args.indexOf('--limit'); const LIMIT = li >= 0 ? +args[li + 1] : Infinity;
const oi = args.indexOf('--order'); const ORDER = oi >= 0 ? args[oi + 1] : ORDER_DEFAULT;

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const specs = fs.existsSync(SPECS) ? JSON.parse(fs.readFileSync(SPECS, 'utf8')) : {};
const order = fs.existsSync(ORDER) ? fs.readFileSync(ORDER, 'utf8').split(/\s+/).filter(x => src[x]) : [];
const ids = [...new Set([...order, ...Object.keys(src)])];

const GEO = { polygonal_quads_tris: 'polygonal quads/tris', polygonal_quads_only: 'polygonal quads only', polygonal_tris_only: 'polygonal tris only',
  polygonal_ngons_only: 'polygonal ngons only', polygonal_ngons_used: 'polygonal ngons used', subdivision: 'subdivision', nurbs: 'nurbs' };
const UV = { yes_non_overlapping: 'Yes, non-overlapping', yes_overlapping: 'Yes, overlapping', mixed: 'Mixed', no: 'No' };
const count = v => { const n = Number(v); return Number.isFinite(n) && n > 1 ? Math.round(n) : null; };
const yesNo = (v, yes, no) => v === true ? yes : v === false ? no : '';

let added = 0, updated = 0, studio = 0, placeholder = 0, empty = 0;
for (const id of ids) {
  const p = src[id];
  const prev = specs[id];
  if (prev && prev.source !== 'turbosquid') { studio++; continue; }      // студия главнее
  if (!prev && added >= LIMIT) continue;
  const fmt = formatsFromFiles((p.files || []).map(name => ({ name })));
  const rec = {
    title: p.name || '',
    polygons: count(p.polygons), vertices: count(p.vertices),
    geometry: GEO[p.geometry] || '',
    rigged: yesNo(p.rigged, 'model is jointed', 'model is not jointed'),
    animated: yesNo(p.animated, 'model is animated', 'model is not animated'),
    unwrappedUVs: UV[p.unwrapped_u_vs] || '',
    textures: null, textureSizes: [], dimensions: null,
    formats: fmt.formats || [], formatCount: fmt.count || null,
    source: 'turbosquid', at: p.at || '',
  };
  if (!rec.polygons && Number(p.polygons) <= 1) placeholder++;
  if (!rec.polygons && !rec.geometry && !rec.unwrappedUVs && !rec.rigged && !rec.formats.length) { empty++; continue; }
  if (prev && JSON.stringify(prev) === JSON.stringify(rec)) continue;
  specs[id] = rec;
  prev ? updated++ : added++;
}
console.log(`в файле сбора ${Object.keys(src).length}: добавлено ${added}, обновлено ${updated}, `
  + `пропущено (данные студии) ${studio}, без данных ${empty}; заглушка «1 полигон» -> пусто: ${placeholder}`);
if (DRY) { console.log('--dry: не записано'); process.exit(0); }
fs.writeFileSync(SPECS, JSON.stringify(specs, null, 1));
console.log('записано: ' + path.relative(ROOT, SPECS));
