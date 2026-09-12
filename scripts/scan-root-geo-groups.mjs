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
 * ПРИЗНАК. Общий корень публикации TurboSquid + близкая геометрия + одна
 * категория + похожие названия. Корень говорит «выложено одним автором как одна
 * работа», геометрия - «это тот же меш», категория - «тот же род вещи»,
 * название - «та же вещь, а не соседняя деталь из той же поставки».
 *
 * ── ПЕРЕПИСАНО 12.09.2026 ПОСЛЕ ДВУХ ПРОМАХОВ ──────────────────────────────
 *
 * Основатель прислал четыре карточки бабочек, которые обязаны были склеиться:
 * red-admiral / red-admirable и две bhutanitis lidderdalii. Разбор показал две
 * разные дыры, и обе в первой редакции этого файла.
 *
 * ПРОМАХ ПЕРВЫЙ: геометрия сверялась ДО ЕДИНИЦЫ. Мех и оснастка меняют меш на
 * несколько процентов - 28 400 против 30 052 у одной пары, 24 178 против
 * 25 662 у другой, - и родство переставало быть видимым. Теперь допуск 10% и
 * по полигонам, и по вершинам.
 *
 * ПРОМАХ ВТОРОЙ, ХУЖЕ. Требовалось слово, общее для ВСЕХ членов группы. В
 * корне бабочки девять карточек, у восьми геометрия совпадает до единицы - и
 * группа всё равно разваливалась, потому что одна называется «Bhutanitis
 * Lidderdalii Sitting Pose», без слов butterfly, bhutan и glory. Одно чужое
 * имя обнуляло общее слово для всей девятки. Так отсеялись 700 групп.
 *
 * Теперь карточки связываются ПОПАРНО, а группа - связная компонента. «Sitting
 * Pose» попадает в семью через «Bhutanitis Lidderdalii Butterfly Rigged», хотя
 * со «Bhutan Glory Butterfly» у неё нет ни одного общего слова.
 *
 * ПОЧЕМУ ДВА УСЛОВИЯ, А НЕ ОДНО. Допуск без похожести названий связывает разные
 * детали одной поставки: «HP Omen 15 Bottom Cover Panel Black» и «Notebook
 * Keyboard Panel with Touchpad Black» лежат под одним корнем, в одной
 * категории, полигонаж рядом - но это разные детали ноутбука. Общего у имён
 * только «panel» и «black», похожесть 0,25, и связь не возникает.
 *
 * ЧЕГО ЭТО ПРАВИЛО НЕ УМЕЕТ. Составные сцены. «Desert Tropical Island with Palm
 * Tree» и «Tropical Palm Tree» - остров и пальма, похожесть 0,6, связь
 * возникает. Отделить «остров С пальмой» от «бабочки ИЛИ её второго имени»
 * автоматически не выходит: и там и там одно имя оказывается надмножеством
 * другого. Сказано вслух, чтобы не выдавать правило за безошибочное.
 *
 * ОГРАНИЧИТЕЛИ:
 *   • не больше 12 карточек в группе - крупные корни это семейства;
 *   • разброс полигонов внутри группы не больше 25%: связь попарная, и без
 *     потолка цепочка уходит далеко от того, с чего началась;
 *   • число С ЕДИНИЦЕЙ в названии - разные товары, а не варианты:
 *     «10 LB / 14 LB Medicine Ball», «48 / 55 inch TV»;
 *   • наборы (is_collection) не трогаем - набор не вариант предмета;
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
const TOL = 0.10;         // допуск по полигонам и вершинам между парой
const SIM = 0.5;          // порог похожести названий
const MAX_SPREAD = 1.25;  // потолок разброса полигонов внутри группы

const all = [];
for (const f of fs.readdirSync(RECS).filter(x => /^records-\d+\.json$/.test(x)))
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, f), 'utf8'))) all.push(r);

/*
 * Слова исполнения снимаются вместе со служебными: именно ими вариант и
 * отличается от варианта, и учитывать их в похожести значит штрафовать за то,
 * ради чего склейка затевается.
 */
const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'with', 'for', 'in', 'on', 'to', 'by', 'or',
  '3d', 'model', 'models', 'collection', 'set', 'new', 'old', 'used', 'rigged', 'rigid',
  'animated', 'simplified', 'simple', 'generic', 'low', 'poly', 'lowpoly', 'fur', 'furry',
  'pose', 'posed', 'standing', 'sitting', 'walking', 'running', 'flying', 'swimming',
  'lying', 'idle', 'neutral', 'clean', 'dirty', 'version', 'variant', 'type', 'style',
  'edition',
  /*
   * Цвет и отделка - 12.09.2026. Их здесь не было, и это стоило основателю
   * ещё одной находки: «Mirror Disco Ball» и «Gold Yellow Disco Ball» при
   * одинаковой до единицы геометрии давали похожесть 0,4 при пороге 0,5.
   * Цвет - самая частая ось варианта, считать его различающим словом значит
   * штрафовать ровно за то, ради чего склейка и нужна.
   */
  'red', 'yellow', 'green', 'blue', 'black', 'white', 'grey', 'gray', 'silver', 'gold',
  'brown', 'orange', 'pink', 'purple', 'beige', 'bronze', 'copper', 'maroon', 'ivory',
  'camo', 'camouflage', 'sand', 'khaki', 'tan', 'olive', 'dark', 'light', 'metallic',
  'transparent', 'chrome', 'mirror', 'matte', 'glossy', 'polished', 'painted', 'glowing',
  'rusty', 'worn', 'damaged', 'weathered', 'aged', 'colored', 'coloured', 'color', 'colour']);
const toks = n => new Set(String(n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)));

// Число с единицей измерения - признак разных товаров.
const UNIT = /\b\d{1,4}\s*(lb|lbs|kg|ml|vol|inch|in|cm|mm|ft|hp|gb|tb|oz|mah|watt|volt|litre|liter|gallon|pcs|mp|k)\b/i;

/** Доля общих значащих слов: пересечение к объединению. */
const sim = (a, b) => {
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  const u = a.size + b.size - i;
  return u ? i / u : 0;
};

/*
 * ── ДВА СПОСОБА СВЯЗАТЬ, а не один ─────────────────────────────────────────
 *
 * 12.09.2026 основатель прислал «Mirror Disco Ball» и «Gold Yellow Disco Ball».
 * Геометрия у них совпадает ДО ЕДИНИЦЫ - 35 386 полигонов, 39 765 вершин, - но
 * корни публикации РАЗНЫЕ: Kde94Dp8FX и MqRDr3EnXW. Группировка внутри корня
 * такую пару поймать не может в принципе.
 *
 * Для разных корней был отдельный проход geo (scan-geometry-groups.mjs), но его
 * ограничитель «номера TurboSquid в пределах 1 000» отсёк и эту пару: разброс
 * 1 300. Ограничитель стоял там потому, что ТОЧНАЯ геометрия сама по себе
 * переклеивает - 19 крейсеров Ticonderoga на общей болванке корпуса, 16
 * прицепов с ливреями Coca-Cola и DHL, 17 футболистов разных клубов.
 *
 * Теперь вместо номеров работает похожесть имён, и она разбирает эти случаи
 * лучше: у крейсеров общего только «uss», у прицепов только «trailer», у
 * футболистов только «player» - связь не возникает. А у дискошаров после снятия
 * цвета остаётся «disco ball» против «disco ball», похожесть 0,67.
 *
 * Итого связь возникает двумя путями, и оба требуют одной категории и похожих
 * имён:
 *   1. общий корень публикации + геометрия в пределах 10%;
 *   2. РАЗНЫЕ корни, но геометрия совпадает точно.
 * Второй путь строже по геометрии именно потому, что корень там не помогает.
 */
const byCat = new Map();
for (const r of all) {
  if (r.status === 'new' || r.is_collection) continue;
  const s = r.specs || {};
  if (!s.polygons || !s.vertices) continue;
  const c = r.category_name || '';
  if (!byCat.has(c)) byCat.set(c, []);
  byCat.get(c).push(r);
}

const found = [];
const cut = { размер: 0, разброс: 0, единицы: 0, ужеСклеены: 0 };
for (const [, items] of byCat) {
  const n = items.length;
  if (n < 2) continue;
  const T = items.map(x => toks(x.name));
  const par = [...Array(n).keys()];
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const link = (i, j) => { const x = find(i), y = find(j); if (x !== y) par[y] = x; };

  // путь 1: общий корень, геометрия с допуском
  const byRoot = new Map();
  for (let i = 0; i < n; i++) {
    const rt = items[i].root;
    if (!rt || rt === '0') continue;
    if (!byRoot.has(rt)) byRoot.set(rt, []);
    byRoot.get(rt).push(i);
  }
  for (const idx of byRoot.values()) {
    if (idx.length < 2) continue;
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a], j = idx[b];
      const A = items[i].specs, B = items[j].specs;
      const bp = Math.min(A.polygons, B.polygons), bv = Math.min(A.vertices, B.vertices);
      if (Math.abs(A.polygons - B.polygons) > bp * TOL) continue;
      if (Math.abs(A.vertices - B.vertices) > bv * TOL) continue;
      if (sim(T[i], T[j]) < SIM) continue;
      link(i, j);
    }
  }

  // путь 2: геометрия совпадает точно, корень значения не имеет
  const byGeo = new Map();
  for (let i = 0; i < n; i++) {
    const g = items[i].specs.polygons + 'x' + items[i].specs.vertices;
    if (!byGeo.has(g)) byGeo.set(g, []);
    byGeo.get(g).push(i);
  }
  for (const idx of byGeo.values()) {
    if (idx.length < 2) continue;
    // Крупная связка на одной болванке - это семейство разных товаров, а не
    // варианты вещи. Похожесть имён такие и так разберёт, но считать пары
    // внутри сотни карточек незачем.
    if (idx.length > 40) continue;
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a], j = idx[b];
      if (sim(T[i], T[j]) < SIM) continue;
      link(i, j);
    }
  }

  const comp = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!comp.has(r)) comp.set(r, []);
    comp.get(r).push(items[i]);
  }
  for (const cl of comp.values()) {
    if (cl.length < 2) continue;
    if (cl.length > MAX_CARDS) { cut.размер++; continue; }
    const polys = cl.map(x => x.specs.polygons);
    if (Math.max(...polys) > Math.min(...polys) * MAX_SPREAD) { cut.разброс++; continue; }
    if (cl.some(x => UNIT.test(x.name))) { cut.единицы++; continue; }
    const slugs = new Set(cl.map(x => x.slug));
    if (cl.some(x => (x.family || []).some(v => slugs.has(v.slug)))) { cut.ужеСклеены++; continue; }
    const sorted = cl.slice().sort((a, b) => b.sales - a.sales);
    found.push({
      cat: sorted[0].category_name, poly: sorted[0].specs.polygons,
      slugs: sorted.map(x => x.slug), names: sorted.map(x => x.name),
    });
  }
}

found.sort((a, b) => b.slugs.length - a.slugs.length);
const cards = found.reduce((s, x) => s + x.slugs.length, 0);
console.log('групп: ' + found.length + ', карточек в них: ' + cards
  + ', свернётся: ' + (cards - found.length));
console.log('отсеяно: крупных групп ' + cut.размер + ', с большим разбросом ' + cut.разброс
  + ', с единицами измерения ' + cut.единицы + ', уже склеены ' + cut.ужеСклеены);

const tally = {};
for (const f of found) tally[f.cat] = (tally[f.cat] || 0) + 1;
console.log('\nпо категориям:');
Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([c, n]) => console.log('  ' + String(n).padStart(4) + '  ' + c));

if (DRY) {
  console.log('\n--- первые 8 групп ---');
  for (const f of found.slice(0, 8)) {
    console.log('\n  ' + f.cat + ', ' + f.poly + ' полиг.');
    f.names.forEach(n => console.log('      ' + n.slice(0, 60)));
  }
  console.log('\nсухой прогон, файл не записан');
} else {
  fs.writeFileSync(OUT, JSON.stringify(found.map(f => f.slugs)), 'utf8');
  console.log('\nзаписано: data/rootgeo-groups.json');
}
