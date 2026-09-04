/*
 * audit-crutches.mjs - поиск костылей по признакам, а не по памяти.
 *
 * ЗАЧЕМ. «Заплатка» - это не только скрипт, который правит готовые страницы.
 * Костыль опаснее: это место, где правда о модели хранится ВТОРОЙ раз. Пока
 * копии совпадают, всё тихо; расходятся они молча и всплывают месяцами позже.
 *
 * Что ищем:
 *   1. Скрипты, которые правят готовые карточки регулярками.
 *   2. Поля, которые снимаются СО СТРАНИЦ - то есть страница стала источником
 *      данных вместо данных.
 *   3. Файлы данных, хранящие то же, что и запись модели.
 *   4. Динамику, вписанную в разметку руками (правило репо: не хардкодить).
 *   5. Списки-исключения и ручные правила в коде.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/audit-crutches.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DIR = path.join(ROOT, 'scripts');
const DATA = path.join(ROOT, 'data');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.mjs'));
const body = new Map(files.map(f => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]));

const say = (t) => console.log('\n=== ' + t + ' ===');

// ── 1. правят готовые карточки ──
say('1. ПРАВЯТ ГОТОВЫЕ КАРТОЧКИ');
const patchers = [];
for (const [f, src] of body) {
  const walks = /readdirSync\(\s*MODELS|readdirSync\(\s*['"]models/.test(src);
  if (walks && /writeFileSync/.test(src) && /\.replace\(/.test(src)) patchers.push(f);
}
console.log(patchers.length ? patchers.map(f => '  ' + f).join('\n') : '  нет');

// ── 2. страница как источник данных ──
say('2. ДАННЫЕ, СНЯТЫЕ СО СТРАНИЦ (страница стала источником)');
const fromPages = [];
for (const f of fs.readdirSync(DATA)) {
  if (!f.endsWith('.json')) continue;
  // Файлы, которые пишут извлекающие скрипты.
  for (const [s, src] of body) {
    if (!/extract-/.test(s)) continue;
    if (src.includes(f)) fromPages.push([f, s]);
  }
}
if (!fromPages.length) console.log('  нет');
for (const [f, s] of fromPages) {
  const size = (fs.statSync(path.join(DATA, f)).size / 1024 / 1024).toFixed(1);
  console.log('  ' + f.padEnd(28) + size + ' МБ   пишет ' + s);
}

// ── 3. вторая копия правды о модели ──
say('3. ФАЙЛЫ, ДУБЛИРУЮЩИЕ ЗАПИСЬ МОДЕЛИ');
const RECS = path.join(DATA, 'records');
if (fs.existsSync(path.join(RECS, 'index.json'))) {
  const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
  const rec = new Map();
  for (let k = 0; k < idx.chunks; k++) {
    for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
      rec.set(String(r.id), r);
    }
  }
  // fc-chunk: имя, цена, сертификат, категория - всё это есть и в записи
  let fcRows = 0, mismatchName = 0, mismatchPrice = 0;
  const fi = path.join(DATA, 'fc-index.json');
  if (fs.existsSync(fi)) {
    const fidx = JSON.parse(fs.readFileSync(fi, 'utf8'));
    for (let k = 0; k < fidx.chunks; k++) {
      const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
      for (let j = 0; j < c.i.length; j++) {
        const r = rec.get(String(c.i[j]));
        if (!r) continue;
        fcRows++;
        if (String(c.n[j]) !== String(r.display_name || r.name)) mismatchName++;
        if (Number(c.p[j]) !== Number(r.price)) mismatchPrice++;
      }
    }
  }
  console.log('  fc-chunk-*.json: ' + fcRows.toLocaleString('ru-RU') + ' строк - имя, цена, сертификат, категория');
  console.log('    расходится с записью: имя ' + mismatchName.toLocaleString('ru-RU')
    + ', цена ' + mismatchPrice.toLocaleString('ru-RU'));
  const mc = path.join(DATA, 'model-categories.json');
  if (fs.existsSync(mc)) {
    const m = JSON.parse(fs.readFileSync(mc, 'utf8'));
    let diff = 0;
    for (const [id, cat] of Object.entries(m)) {
      const r = rec.get(String(id));
      if (r && r.category && r.category !== cat) diff++;
    }
    console.log('  model-categories.json: ' + Object.keys(m).length.toLocaleString('ru-RU')
      + ' записей, расходится с записью: ' + diff);
  }
}

// ── 4. динамика в разметке ──
say('4. ДИНАМИКА, ВПИСАННАЯ В РАЗМЕТКУ');
const pages = ['index.html', 'catalog/index.html', 'about/index.html',
  'search/index.html', 'collections/index.html', 'data-licensing/index.html'];
const num = /\b5[0-9][, ]?[0-9]{3}\b/g;
for (const p of pages) {
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) continue;
  const hits = [...new Set((fs.readFileSync(f, 'utf8').match(num) || []))];
  if (hits.length) console.log('  ' + p.padEnd(30) + hits.join(', '));
}

// ── 5. ручные списки и исключения в коде ──
say('5. РУЧНЫЕ СПИСКИ И ИСКЛЮЧЕНИЯ');
const manual = [];
for (const [f, src] of body) {
  const m = src.match(/const (MANUAL_[A-Z_]+|OVERRIDES|FIXES|CAT_SLUG_FIX|[A-Z_]*EXCEPT[A-Z_]*)\s*=/g);
  if (m) manual.push([f, [...new Set(m.map(x => x.replace(/const |\s*=/g, '')))].join(', ')]);
}
manual.slice(0, 12).forEach(([f, n]) => console.log('  ' + f.padEnd(32) + n));
const ov = path.join(DATA, 'category-overrides.json');
if (fs.existsSync(ov)) {
  console.log('  data/category-overrides.json: '
    + Object.keys(JSON.parse(fs.readFileSync(ov, 'utf8'))).length + ' ручных решений по категориям');
}
