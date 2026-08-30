/*
 * rank-related.mjs - качество блока «Related 3D Models» (пункт 5).
 *
 * ЧТО БЫЛО. Подбор шёл по одному признаку: взвешенная мера Жаккара по словам
 * названия внутри категории, плюс один процент за совпадение подкатегории.
 * Поэтому гибридному автомобилю попадались Car Smart Key, Car Hauler Trailer,
 * Wheel и Automotive Scissor Lift: слово «car» общее, а что это принадлежность,
 * а не альтернатива покупке, формула не знала. У Lexus NX Hybrid в подборку
 * попал Hybrid Baby Carrier - совпало слово «hybrid».
 *
 * ФОРМУЛА, КАК ТЫ ЕЁ ЗАДАЛ:
 *   40%  совпадение подкатегории
 *   25%  совпадение ключевых слов
 *   15%  совпадение типа и назначения
 *   10%  близость цены
 *   10%  популярность
 *
 * ГДЕ ПРИШЛОСЬ ОТСТУПИТЬ И ПОЧЕМУ. Подкатегория заполнена лишь у 42% моделей:
 * из 86 865 строк отчёта у 50 778 она пустая. Отдать ей 40% веса вслепую
 * значит для большинства карточек обнулить главный вклад и скатиться к почти
 * случайному порядку. Поэтому: если подкатегория есть у обеих моделей -
 * работает твоя раскладка; если нет - её 40% переливаются в схожесть названия,
 * то есть остаётся прежнее поведение, но уже с ценой и популярностью.
 *
 * ПУНКТ 6 ТВОЕГО СПИСКА - «аксессуары, колёса, ключи и оборудование в конце» -
 * сделан отдельным штрафом, а не весом: это не «чуть менее похоже», а другой
 * товар. Ключ от машины не альтернатива машине. Штраф срабатывает только когда
 * исходная модель сама не принадлежность: ключу от машины другой ключ показать
 * можно и нужно.
 *
 * Запуск:  node scripts/rank-related.mjs --dry
 *          node scripts/rank-related.mjs --show <slug>   (объяснить подбор)
 *          node scripts/rank-related.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const SHOW = (() => { const i = process.argv.indexOf('--show'); return i > 0 ? process.argv[i + 1] : null; })();
const WANT = 10;
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

/*
 * Принадлежности и оборудование. Список рукописный: вывести «это деталь, а не
 * товар» из данных нельзя. Проверяется по целым словам, поэтому «Wheel Loader»
 * (это машина) не попадает под «wheel» - там слово идёт с уточнением.
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
  // гибридным автомобилем он такая же не-альтернатива, как ключ от машины.
  'power unit', 'engine block', 'gearbox', 'transmission unit', 'turbocharger',
  'radiator', 'alternator', 'fuel pump', 'differential',
];
const isAccessory = name => {
  const n = ' ' + String(name).toLowerCase() + ' ';
  return ACCESSORY.some(a => n.includes(' ' + a) || n.includes(a + ' ') || n.includes(a + 's'));
};

// ── данные отчёта ──
function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const extra = new Map();
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  extra.set(String(r[ix('product_id')]).trim(), {
    sub: (r[ix('subcategory')] || '').trim().toLowerCase(),
    kw: new Set((r[ix('seo_keywords')] || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean)),
    uses: new Set((r[ix('use_cases')] || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean)),
  });
}

// ── каталог ──
const modelCat = loadModelCategories();
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const imgCache = new Map();
const imgFor = (ic, id) => {
  if (ic < 0) return '';
  if (!imgCache.has(ic)) {
    const f = path.join(ROOT, 'data', 'fc-img-chunk-' + ic + '.json');
    imgCache.set(ic, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
  }
  return imgCache.get(ic)[String(id)] || '';
};

const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    const e = extra.get(id) || { sub: '', kw: new Set(), uses: new Set() };
    all.push({
      id, name: c.n[j], price: c.p[j], sales: c.s[j],
      cat: modelCat[id] || 'other', ic: c.ic ? c.ic[j] : -1,
      dir: slugify(c.n[j]) + '-' + c.i[j],
      sub: e.sub, kw: e.kw, uses: e.uses,
      acc: isAccessory(c.n[j]),
    });
  }
}
const byId = new Map(all.map(m => [m.id, m]));

// ── слова названий и их редкость ──
const STOP = new Set(['the', 'and', 'for', 'with', 'set', 'collection', 'model', 'models', '3d',
  'new', 'old', 'generic', 'rigged', 'simple', 'interior', 'black', 'white', 'grey', 'gray', 'red', 'blue', 'green']);
const wordsOf = n => new Set((String(n).toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOP.has(w)));
const df = new Map();
for (const m of all) { m.w = wordsOf(m.name); for (const w of m.w) df.set(w, (df.get(w) || 0) + 1); }
const N = all.length;
const idf = w => Math.log(N / (1 + (df.get(w) || 0)));
for (const m of all) m.wsum = [...m.w].reduce((a, w) => a + idf(w), 0) || 1;

// кандидаты по категории и обратный указатель слово -> модели
const byCat = new Map();
for (const m of all) { if (!byCat.has(m.cat)) byCat.set(m.cat, []); byCat.get(m.cat).push(m); }
const byWord = new Map();
for (const m of all) for (const w of m.w) {
  if (!byWord.has(w)) byWord.set(w, []);
  byWord.get(w).push(m);
}

const jac = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

/** Оценка кандидата для модели me. Возвращает число 0..1 и разбор по частям. */
function score(me, c) {
  // 1. схожесть названия - взвешенная мера Жаккара по редкости слов
  let shared = 0;
  for (const w of me.w) if (c.w.has(w)) shared += idf(w);
  const nameSim = shared / (me.wsum + c.wsum - shared);

  // 2. подкатегория
  const haveSub = !!me.sub && !!c.sub;
  const subHit = haveSub && me.sub === c.sub ? 1 : 0;

  // 3. назначение: сценарии и ключевые слова
  const useSim = jac(me.uses, c.uses);
  const kwSim = jac(me.kw, c.kw);

  // 4. близость цены: 1 при равных, 0 при разнице в разы
  const p1 = me.price || 0, p2 = c.price || 0;
  const priceSim = (p1 && p2) ? Math.max(0, 1 - Math.abs(p1 - p2) / Math.max(p1, p2)) : 0;

  // 5. популярность: логарифм продаж, приведённый к 0..1
  const pop = Math.min(1, Math.log10(1 + (c.sales || 0)) / 3);

  // Раскладка весов. Когда подкатегории нет ни у одной из двух моделей, её
  // сорок процентов уходят в схожесть названия - иначе для 58% каталога
  // главный вклад просто обнулялся бы.
  const W = haveSub
    ? { sub: 0.40, kw: 0.25, use: 0.15, price: 0.10, pop: 0.10 }
    : { sub: 0.00, kw: 0.65, use: 0.15, price: 0.10, pop: 0.10 };

  let s = W.sub * subHit
    + W.kw * (0.6 * nameSim + 0.4 * kwSim)
    + W.use * useSim
    + W.price * priceSim
    + W.pop * pop;

  // Штраф за принадлежность. Не вес, а именно штраф: ключ от машины - не
  // альтернатива машине, сколько бы общих слов у них ни было.
  const penalty = (!me.acc && c.acc) ? 0.45 : 0;
  s -= penalty;

  return { s, nameSim, subHit, haveSub, kwSim, useSim, priceSim, pop, penalty };
}

/*
 * «Отпечаток» имени: чтобы в блоке не стояли десять цветов одной модели.
 * Слова СОРТИРУЮТСЯ, иначе «2020 Subaru XV Hybrid Crossover Yellow» и
 * «Subaru XV Hybrid Crossover 2020 Yellow» - одна и та же модель с переставленными
 * словами - считаются разными и обе попадают в подборку. Цвета и слова вроде
 * «rigged» уже в STOP, поэтому цветовые версии тоже схлопываются.
 */
const fingerprint = n => String(n).toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).sort().join(' ');

const liveCache = new Map();
const isLive = dir => {
  if (liveCache.has(dir)) return liveCache.get(dir);
  let ok = false;
  try { ok = !/http-equiv="refresh"/i.test(fs.readFileSync(path.join(MODELS, dir, 'index.html'), 'utf8').slice(0, 400)); }
  catch (e) { ok = false; }
  liveCache.set(dir, ok);
  return ok;
};

function pickFor(me) {
  // Кандидатов берём по общим словам, а не всю категорию: в Vehicles их 4 123,
  // и считать оценку для каждого на каждой странице слишком дорого.
  const cand = new Map();
  for (const w of me.w) for (const c of (byWord.get(w) || [])) {
    if (c.id === me.id || c.cat !== me.cat) continue;
    cand.set(c.id, c);
  }
  // Если общих слов мало, добираем самыми продаваемыми из категории.
  if (cand.size < 40) for (const c of (byCat.get(me.cat) || []).slice(0, 200)) {
    if (c.id !== me.id) cand.set(c.id, c);
  }

  const scored = [];
  for (const c of cand.values()) scored.push({ c, ...score(me, c) });
  scored.sort((a, b) => b.s - a.s);

  const out = [], prints = new Set([fingerprint(me.name)]);
  for (const x of scored) {
    if (out.length >= WANT) break;
    const fp = fingerprint(x.c.name);
    if (prints.has(fp)) continue;
    const img = imgFor(x.c.ic, x.c.id);
    if (!img) continue;
    if (!isLive(x.c.dir)) continue;
    prints.add(fp);
    out.push({ ...x, img });
  }
  return out;
}

if (SHOW) {
  const me = all.find(m => m.dir === SHOW || m.id === SHOW);
  if (!me) { console.log('не нашёл модель: ' + SHOW); process.exit(1); }
  console.log('модель: ' + me.name + '   категория ' + me.cat + ', подкатегория «' + (me.sub || 'нет') + '», $' + me.price);
  for (const x of pickFor(me)) {
    console.log('  ' + x.s.toFixed(3) + '  ' + x.c.name.slice(0, 52).padEnd(54)
      + 'имя ' + x.nameSim.toFixed(2)
      + (x.haveSub ? '  подкат ' + x.subHit : '  подкат нет')
      + '  цена ' + x.priceSim.toFixed(2)
      + '  прод ' + x.pop.toFixed(2)
      + (x.penalty ? '  ШТРАФ' : ''));
  }
  process.exit(0);
}

// ── перезапись блока ──
const chipName = new Map();
{
  const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'taxonomy.json'), 'utf8'));
  const arr = Array.isArray(tax) ? tax : (tax.categories || Object.values(tax));
  for (const c of arr) chipName.set(c.slug, c.name);
}
const cardHtml = m => '<a href="/models/' + m.c.dir + '/" class="model-card card-glow mp-rc-link">'
  + '<div class="img-wrap mp-rc-img-wrap">'
  + '<img src="' + esc(m.img) + '" alt="' + esc(m.c.name) + '" width="800" height="450"'
  + ' decoding="async" loading="lazy" data-placeholder="' + PLACEHOLDER + '" onerror="imgErr(this)">'
  + '<div class="img-placeholder" aria-hidden="true"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>'
  + '<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">' + esc(m.c.name) + '</div></div>'
  + '<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">'
  + esc(chipName.get(m.c.cat) || m.c.cat) + '</span>'
  + '<span class="mp-rc-price">$' + m.c.price + '</span></div></div></a>';

let live = 0, changed = 0, thin = 0, demoted = 0;
for (const me of all) {
  const file = path.join(MODELS, me.dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const picked = pickFor(me);
  if (picked.length < 4) { thin++; continue; }
  if (!me.acc && picked.some(x => x.c.acc)) demoted++;

  const before = h;
  h = h.replace(/(<section class="mp-related-section">[\s\S]*?<div class="mp-related-grid">)[\s\S]*?(<\/div><\/div><\/section>)/,
    (x, a, b) => a + picked.map(cardHtml).join('') + b);
  if (h === before) continue;
  changed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('блок пересобран: ' + changed + (thin ? ', подходящих меньше четырёх: ' + thin : ''));
console.log('карточек, где принадлежности всё же попали в подборку: ' + demoted);
if (DRY) console.log('(--dry, ничего не записано)');
