/*
 * related.mjs - подбор похожих моделей.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Формула жила внутри rank-related.mjs вместе с чтением
 * fc-chunk, разбором CSV и записью в HTML. Теперь она нужна и сборке записей.
 * Скопировать значило бы завести второй экземпляр - при первой же правке весов
 * подборки разошлись бы между страницами и данными.
 *
 * ФОРМУЛА (решение основателя, не менять без его слова):
 *   40% подкатегория, 25% ключевые слова и название, 15% назначение,
 *   10% близость цены, 10% популярность.
 * Когда подкатегории нет ни у одной из двух моделей - а это 58% каталога, -
 * её сорок процентов уходят в схожесть названия, иначе главный вклад просто
 * обнулялся бы.
 * Аксессуару штраф 0.45: ключ от машины не альтернатива машине, сколько бы
 * общих слов у них ни было.
 *
 * Модуль ничего не читает с диска и ничего не пишет. На входе - список моделей
 * с полями { id, name, slug, cat, sub, uses, kw, price, sales }, на выходе -
 * готовые подборки.
 */

const ACCESSORY = [
  'smart key', 'key fob', 'car key', 'wheel rim', 'alloy wheel', 'spare wheel',
  'tyre', 'tire', 'hubcap', 'brake disc', 'brake pad', 'suspension',
  'hauler trailer', 'car trailer', 'scissor lift', 'wheel aligner', 'car jack',
  'jump starter', 'charger', 'charging cable', 'floor mat', 'car cover',
  'side mirror', 'wiper', 'seat belt', 'number plate', 'licence plate',
  'license plate', 'exhaust pipe', 'spark plug', 'oil filter', 'air filter',
  'battery pack', 'fuel can', 'jerry can', 'tow bar', 'roof rack', 'roof box',
  // Агрегаты. «Renault Sport F1 Hybrid Power Unit» - это двигатель, и рядом с
  // болидом он выглядит как альтернатива покупки, хотя это запчасть.
  'power unit', 'engine block', 'gearbox', 'turbocharger', 'radiator',
];
export const isAccessory = name => {
  const n = ' ' + String(name).toLowerCase() + ' ';
  return ACCESSORY.some(a => n.includes(' ' + a) || n.includes(a + ' ') || n.includes(a + 's'));
};

// Слова, которые не различают модели: они есть почти у всех.
const STOP = new Set(['the', 'and', 'for', 'with', 'set', 'collection', 'model', 'models', '3d',
  'new', 'old', 'generic', 'rigged', 'simple', 'interior', 'black', 'white', 'grey', 'gray', 'red', 'blue', 'green']);

const wordsOf = n => new Set((String(n).toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOP.has(w)));

const jac = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

/*
 * «Отпечаток» имени: чтобы в блоке не стояли десять цветов одной модели.
 * Слова СОРТИРУЮТСЯ, иначе «2020 Subaru XV Hybrid Crossover Yellow» и
 * «Subaru XV Hybrid Crossover 2020 Yellow» - одна модель с переставленными
 * словами - считаются разными и обе попадают в подборку.
 */
export const fingerprint = n => String(n).toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).sort().join(' ');

/**
 * Готовит набор моделей к подбору: считает слова, редкость слов и указатели.
 * @param {Array} models  { id, name, slug, cat, sub, uses, kw, price, sales }
 */
export function prepare(models) {
  const all = models.map(m => ({
    ...m,
    uses: new Set(m.uses || []),
    kw: new Set(m.kw || []),
    acc: isAccessory(m.name),
    w: wordsOf(m.name),
  }));
  const df = new Map();
  for (const m of all) for (const w of m.w) df.set(w, (df.get(w) || 0) + 1);
  const N = all.length || 1;
  const idf = w => Math.log(N / (1 + (df.get(w) || 0)));
  for (const m of all) m.wsum = [...m.w].reduce((a, w) => a + idf(w), 0) || 1;

  const byCat = new Map(), byWord = new Map();
  for (const m of all) {
    if (!byCat.has(m.cat)) byCat.set(m.cat, []);
    byCat.get(m.cat).push(m);
    for (const w of m.w) {
      if (!byWord.has(w)) byWord.set(w, []);
      byWord.get(w).push(m);
    }
  }
  // Внутри категории кандидаты добираются самыми продаваемыми.
  for (const list of byCat.values()) list.sort((a, b) => (b.sales || 0) - (a.sales || 0));
  return { all, idf, byCat, byWord };
}

/** Оценка кандидата c для модели me. */
export function score(me, c, idf) {
  let shared = 0;
  for (const w of me.w) if (c.w.has(w)) shared += idf(w);
  const nameSim = shared / (me.wsum + c.wsum - shared);

  const haveSub = !!me.sub && !!c.sub;
  const subHit = haveSub && me.sub === c.sub ? 1 : 0;
  const useSim = jac(me.uses, c.uses);
  const kwSim = jac(me.kw, c.kw);

  const p1 = me.price || 0, p2 = c.price || 0;
  const priceSim = (p1 && p2) ? Math.max(0, 1 - Math.abs(p1 - p2) / Math.max(p1, p2)) : 0;
  const pop = Math.min(1, Math.log10(1 + (c.sales || 0)) / 3);

  const W = haveSub
    ? { sub: 0.40, kw: 0.25, use: 0.15, price: 0.10, pop: 0.10 }
    : { sub: 0.00, kw: 0.65, use: 0.15, price: 0.10, pop: 0.10 };

  let s = W.sub * subHit + W.kw * (0.6 * nameSim + 0.4 * kwSim)
    + W.use * useSim + W.price * priceSim + W.pop * pop;
  if (!me.acc && c.acc) s -= 0.45;
  return s;
}

/**
 * Подборка для одной модели.
 * @param {number} want  сколько нужно
 * @param {function} ok  дополнительная проверка кандидата (например, есть ли превью)
 */
export function pickFor(me, ctx, want = 10, ok = () => true) {
  const { idf, byCat, byWord } = ctx;
  const cand = new Map();
  // Кандидатов берём по общим словам, а не всю категорию: в Vehicles их 4 123,
  // и считать оценку для каждого на каждой странице слишком дорого.
  for (const w of me.w) for (const c of (byWord.get(w) || [])) {
    if (c.id === me.id || c.cat !== me.cat) continue;
    cand.set(c.id, c);
  }
  if (cand.size < 40) for (const c of (byCat.get(me.cat) || []).slice(0, 200)) {
    if (c.id !== me.id) cand.set(c.id, c);
  }

  const scored = [];
  for (const c of cand.values()) scored.push({ c, s: score(me, c, idf) });
  scored.sort((a, b) => b.s - a.s);

  const out = [], prints = new Set([fingerprint(me.name)]);
  for (const x of scored) {
    if (out.length >= want) break;
    const fp = fingerprint(x.c.name);
    if (prints.has(fp) || !ok(x.c)) continue;
    prints.add(fp);
    out.push(x.c);
  }
  return out;
}
