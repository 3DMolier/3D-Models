/*
 * scan-geometry-groups.mjs - найти карточки одной и той же модели, у которых
 * названия разведены полностью и по имени родство не видно.
 *
 * Откуда взялась задача. Основатель прислал восемь групп: «Cadillac Gage V-100
 * Armored Scout Vehicle with Interior Green», «Desert Armored Recon Vehicle 4x4
 * Tan with Interior» и «4x4 Armored Recon Vehicle Woodland Camouflage with
 * Interior» - одна машина в трёх ливреях, но общих слов почти нет. Все проходы
 * merge-variants.mjs работают по названию и такое не ловят.
 *
 * Признак. В карточке есть точные Polygons и Vertices. У перевыложенной той же
 * модели они совпадают до единицы: 291 700 / 307 640 у всех трёх машин выше.
 *
 * Почему одного совпадения мало. По всей базе таких групп 11 179 на 30 651
 * карточку, и крупные из них - НЕ варианты:
 *   19 крейсеров Ticonderoga (CG-52 ... CG-73) на общей болванке корпуса;
 *   16 прицепов с ливреями Coca-Cola, DHL, FedEx, UPS, Walmart;
 *   16 карточек «Leopard / Snow Leopard / Tiger» на одном меше кошки;
 *   17 футболистов Arsenal, Chelsea, Juventus, Real Madrid.
 * Это разные товары с собственным спросом в поиске, их сворачивать нельзя.
 *
 * Поэтому три ограничителя:
 *   • не больше 4 карточек в группе - крупные семьи отсекаются целиком;
 *   • не меньше 5 000 полигонов - у мелочи совпадение бывает случайным;
 *   • номера TurboSquid в пределах 1 000 - варианты выкладывают одной партией
 *     (у группы Cadillac разброс 901, у Hawkei 32, у WWII 5).
 *
 * Сеть не нужна: всё берётся из файлов сайта.
 *
 * Запуск:
 *   node scan-geometry-groups.mjs --dry     посчитать и показать примеры
 *   node scan-geometry-groups.mjs           записать data/geo-groups.json
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

const MAX_CARDS = 4;
const MIN_POLY = 5000;
const MAX_ID_SPAN = 1000;

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVar = new Set(Object.keys(merged));

// Срез строки в V8 держит ссылку на весь исходный HTML. На 60 тысячах карточек
// это гигабайты и падение по памяти - копируем через Buffer.
const copy = s => Buffer.from(String(s), 'utf8').toString('utf8');

const rows = [];
let live = 0, noGeo = 0;
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  if (isVar.has(slug)) continue;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h)) continue;
  live++;
  const p = (h.match(/<th>Polygons<\/th><td>([\d,]+)</) || [])[1];
  const v = (h.match(/<th>Vertices<\/th><td>([\d,]+)</) || [])[1];
  if (!p || !v) { noGeo++; continue; }
  const poly = +p.replace(/,/g, ''), vert = +v.replace(/,/g, '');
  rows.push({
    slug: copy(slug),
    name: copy((h.match(/<h1[^>]*>([^<]+)</) || [])[1] || slug),
    geo: poly + '/' + vert,
    poly,
    id: +((slug.match(/-(\d+)$/) || [])[1] || 0),
  });
}

const by = new Map();
for (const r of rows) { if (!by.has(r.geo)) by.set(r.geo, []); by.get(r.geo).push(r); }
const all = [...by.values()].filter(g => g.length > 1);
const span = g => Math.max(...g.map(r => r.id)) - Math.min(...g.map(r => r.id));
const sel = all.filter(g => g.length <= MAX_CARDS && g[0].poly >= MIN_POLY && span(g) <= MAX_ID_SPAN)
  .map(g => g.slice().sort((a, b) => a.id - b.id));

console.log('живых карточек:            ' + live);
console.log('без данных о геометрии:    ' + noGeo);
console.log('групп с общей геометрией:  ' + all.length + ' на ' + all.reduce((s, g) => s + g.length, 0) + ' карточек');
console.log('после ограничителей:       ' + sel.length + ' на ' + sel.reduce((s, g) => s + g.length, 0) + ' карточек');
console.log('свернётся страниц:         ' + sel.reduce((s, g) => s + g.length - 1, 0));

console.log('\nвыборка для глазной проверки:');
for (let i = 0; i < 15 && sel.length; i++) {
  const g = sel[Math.floor((i + 0.5) * sel.length / 15)];
  console.log('  ' + g[0].poly + ' полигонов, разброс номеров ' + span(g));
  g.forEach(r => console.log('      ' + r.name.slice(0, 78)));
}

const out = path.join(ROOT, 'data', 'geo-groups.json');
if (!DRY) {
  fs.writeFileSync(out, JSON.stringify(sel.map(g => g.map(r => r.slug))));
  console.log('\nзаписано: data/geo-groups.json');
} else {
  console.log('\nПРОБНЫЙ ПРОГОН, ничего не записано');
}
