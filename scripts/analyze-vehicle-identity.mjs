// analyze-vehicle-identity.mjs — РАСЧЁТ, НИЧЕГО НЕ МЕНЯЕТ.
//
// Задача. Одна машина выложена несколькими карточками, которые называются
// по-разному: «1955 Mercedes Benz 300SL Gullwing», «Mercedes-Benz 300SL Coupe
// Black», «Mercedes-Benz 300SL Classic Sports Car Red», «Mercedes-Benz 300SL
// Gullwing Coupe Blue Simplified». Правила по софту и по цвету их не сводят:
// основы различаются описательными словами (Coupe, Classic, Sports Car, Gullwing)
// и годом.
//
// Идея. Личность машины — это марка и код модели. Собираем ключ из токенов:
//   • содержащих цифру          — 300sl, g580, 350
//   • длиной до трёх букв       — se, sl, gt, amg (комплектации)
//   • частых по каталогу        — mercedes, benz, bmw, audi (марки)
// Всё остальное — описания (gullwing, coupe, sports, classic) — отбрасываем.
//
// Год отдельно. Сливать «Porsche 911 1970» с «Porsche 911 2020» нельзя, это разные
// поколения. Поэтому карточки без года присоединяются к годовым ТОЛЬКО когда
// годовая группа ровно одна.
//
// Запуск:  node scripts/analyze-vehicle-identity.mjs
//          node scripts/analyze-vehicle-identity.mjs --show 40

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const shi = process.argv.indexOf('--show');
const SHOW = shi !== -1 ? +process.argv[shi + 1] || 25 : 25;

function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const alive = new Set(fs.readdirSync(MODELS));

const rows = [];
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  if (!alive.has(r[ix('slug')])) continue;              // считаем по живым карточкам
  if (!/vehicle/i.test(r[ix('category')] || '')) continue;
  rows.push({ slug: r[ix('slug')], name: r[ix('product_name')] || '', price: +r[ix('price')] || 0 });
}
console.log('живых карточек в Vehicles: ' + rows.length);

// Описательные слова — не признак модели.
const FILLER = new Set(['the', 'and', 'of', 'with', 'for', 'a', 'an',
  'car', 'cars', 'vehicle', 'vehicles', 'auto', 'automobile',
  'sports', 'sport', 'classic', 'vintage', 'retro', 'old', 'new', 'modern',
  'coupe', 'sedan', 'hatchback', 'wagon', 'estate', 'liftback', 'fastback',
  'suv', 'crossover', 'compact', 'luxury', 'concept', 'custom', 'tuning', 'edition',
  'rigged', 'rigid', 'animated', 'simplified', 'simple', 'basic', 'full', 'detailed',
  'interior', 'exterior', 'lights', 'dirty', 'clean', 'used',
  'low', 'poly', 'polygon', 'game', 'ready', 'pbr', 'realistic', 'model', 'models', '3d']);

// Запчасти и обвес — это отдельные товары, а не варианты машины. Без этого списка
// «Tesla Model 3 Right Seat», чехол и тоннель попадали в одну группу с машиной.
const PART = /\b(seat|seats|cover|covers|frame|frameset|fork|wheel|wheels|wheelset|tire|tires|rim|rims|engine|suspension|hitch|mirror|bumper|hood|door|steering|dashboard|tunnel|garage|showroom|stand|display|logo|badge|emblem|part|parts|kit)\b/i;
// Сцена с человеком — другой товар, а не вариант машины: «Woman Riding Vespa 125»
// стоит $239 против $79 за сам скутер.
const FIGURE = /\b(woman|women|man|men|girl|boy|kid|kids|rider|riding|driver|driving|person|people|character|couple|family)\b/i;
// Кузов, который реально другой товар: их НЕ отбрасываем.
// roadster, convertible, cabriolet, pickup, truck, van, limousine — остаются в ключе.

const COLORW = /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|desert|olive|beige|pink|purple)\b/g;
const SOFTW = /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/ig;
const isYear = t => /^(19|20)\d{2}$/.test(t);

function tokens(name) {
  return String(name).toLowerCase()
    .replace(SOFTW, ' ')
    .replace(COLORW, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean).filter(t => !FILLER.has(t));
}

// Частота слова по Vehicles — так марки определяются сами, без списка.
const df = new Map();
for (const r of rows) for (const t of new Set(tokens(r.name))) df.set(t, (df.get(t) || 0) + 1);
const BRAND_DF = 100;

// Код модели: не короче трёх знаков и с цифрой — 300sl, 350, g580, 911.
// Одиночная «3» из «Tesla Model 3» кодом не считается: по ней в одну группу
// попадали сиденья, чехлы и тоннель. «3d» отсеивается длиной.
const isCode = t => t.length >= 3 && /\d/.test(t) && !isYear(t);

function identity(name) {
  if (PART.test(name) || FIGURE.test(name)) return null;   // запчасть или сцена с человеком
  const toks = tokens(name);
  const years = [...new Set(toks.filter(isYear))].sort();
  const core = [...new Set(toks.filter(t => !isYear(t)
    && (isCode(t) || t.length <= 3 || (df.get(t) || 0) >= BRAND_DF)))].sort();
  if (!core.some(isCode)) return null;                   // без кода модели не рискуем
  if (core.length < 2) return null;                      // одного токена мало
  return { core: core.join(' '), years: years.join(' ') };
}

// ── группировка ──
const byCore = new Map();
let noId = 0;
for (const r of rows) {
  const id = identity(r.name);
  if (!id) { noId++; continue; }
  if (!byCore.has(id.core)) byCore.set(id.core, []);
  byCore.get(id.core).push({ ...r, years: id.years });
}
console.log('без опознанного кода модели (не трогаем): ' + noId);

const groups = [];
for (const [core, items] of byCore) {
  if (items.length < 2) continue;
  const yearSets = [...new Set(items.map(x => x.years).filter(Boolean))];
  if (yearSets.length <= 1) {
    groups.push({ core, items, note: yearSets.length ? 'один год' : 'без года' });
  } else {
    // Несколько поколений: сливаем только внутри своего года, безгодовые оставляем.
    for (const y of yearSets) {
      const part = items.filter(x => x.years === y);
      if (part.length > 1) groups.push({ core, items: part, note: 'год ' + y });
    }
  }
}

const collapse = groups.reduce((s, g) => s + g.items.length - 1, 0);
console.log('\nгрупп к объединению: ' + groups.length);
console.log('карточек свернётся:  ' + collapse);
console.log('останется в Vehicles: ' + (rows.length - collapse));

groups.sort((a, b) => b.items.length - a.items.length);
console.log('\n── ' + SHOW + ' крупнейших групп ──');
for (const g of groups.slice(0, SHOW)) {
  console.log('\n[' + g.items.length + '] ' + g.core + '   (' + g.note + ')');
  for (const x of g.items) console.log('    $' + x.price + '  ' + x.name);
}

const m = groups.find(g => /300sl/.test(g.core));
if (m) {
  console.log('\n── контрольный пример 300SL ──');
  for (const x of m.items) console.log('    $' + x.price + '  ' + x.name);
}
