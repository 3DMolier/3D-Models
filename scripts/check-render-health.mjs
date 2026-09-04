/*
 * check-render-health.mjs - собирается ли страница из КАЖДОЙ записи.
 *
 * Сравнение с живыми страницами (compare-rebuild.mjs) проверяет только те
 * записи, у которых страница уже есть. Мимо него проходят 1 073 новые модели и
 * все краевые случаи: запись без характеристик, без семьи, без ключевых слов,
 * с нулевой ценой, с очень длинным именем.
 *
 * Здесь собирается страница из каждой записи и проверяется по тем же признакам,
 * по которым apply-rebuild.mjs решает, можно ли записывать файл: длина,
 * заголовок, канонический адрес, отсутствие управляющих символов и слова
 * undefined в разметке.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-render-health.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

import { ROOT } from './lib/paths.mjs';
const RECS = path.join(ROOT, 'data', 'records');
const CTRL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]');

const t0 = Date.now();
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));

const stat = { всего: 0, новых: 0, упало: 0, короткая: 0, 'без h1': 0, 'без canonical': 0, 'управляющие символы': 0, undefined: 0 };
const ex = new Map();
const note = (key, slug) => {
  stat[key]++;
  if (!ex.has(key)) ex.set(key, []);
  const list = ex.get(key);
  if (list.length < 5) list.push(slug);
};

// Заодно считаем, у скольких записей каких полей нет - краевые случаи видны сразу.
const gaps = { 'без характеристик': 0, 'без семьи': 0, 'без ключевых слов': 0, 'без соседей': 0, 'без превью': 0, 'нулевая цена': 0 };
let minLen = Infinity, maxLen = 0, sumLen = 0;

for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    stat.всего++;
    if (r.status === 'new') stat.новых++;
    if (!r.specs) gaps['без характеристик']++;
    if (!(r.family || []).length) gaps['без семьи']++;
    if (!(r.keywords || []).length) gaps['без ключевых слов']++;
    if (!(r.related || []).length) gaps['без соседей']++;
    if (!r.image) gaps['без превью']++;
    if (!r.price) gaps['нулевая цена']++;

    let html;
    try { html = renderCard(r); }
    catch (e) { note('упало', r.slug + ': ' + e.message); continue; }

    sumLen += html.length;
    if (html.length < minLen) minLen = html.length;
    if (html.length > maxLen) maxLen = html.length;

    if (html.length < 4000) note('короткая', r.slug + ' (' + html.length + ')');
    if (html.indexOf('<h1') === -1) note('без h1', r.slug);
    if (html.indexOf('rel="canonical"') === -1) note('без canonical', r.slug);
    if (CTRL.test(html)) note('управляющие символы', r.slug);
    if (html.indexOf('undefined') !== -1) note('undefined', r.slug);
  }
}

console.log('записей: ' + stat.всего.toLocaleString('ru-RU') + ' (новых ' + stat.новых.toLocaleString('ru-RU') + ')');
console.log('размер страницы: от ' + minLen.toLocaleString('ru-RU') + ' до ' + maxLen.toLocaleString('ru-RU')
  + ', в среднем ' + Math.round(sumLen / stat.всего).toLocaleString('ru-RU') + ' байт');
console.log('\nКРАЕВЫЕ СЛУЧАИ В ДАННЫХ');
for (const [k, v] of Object.entries(gaps)) console.log('  ' + String(v).padStart(7) + '  ' + k);

console.log('\nПРОВЕРКА СБОРКИ');
let bad = 0;
for (const [k, v] of Object.entries(stat)) {
  if (['всего', 'новых'].includes(k)) continue;
  console.log('  ' + String(v).padStart(7) + '  ' + k);
  if (v) { bad++; (ex.get(k) || []).forEach(s => console.log('           ' + s.slice(0, 120))); }
}
console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
if (!bad) console.log('\nВСЕ ЗАПИСИ СОБИРАЮТСЯ В ГОДНУЮ СТРАНИЦУ');
process.exit(bad ? 1 : 0);
