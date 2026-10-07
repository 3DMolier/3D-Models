/*
 * build-category-stats.mjs - медианы по категориям для текста карточки.
 *
 * Зачем. Замер 07.10.2026: у шаблонной карточки уникально 25,5% пятисловных
 * отрывков, порог seo-programmatic - 40%. Половина предложений в описании не
 * содержала ни одного числа самой модели, то есть была одинаковой для тысяч
 * страниц. Чтобы это починить, тексту нужны факты, которых раньше не было:
 * «против медианы 23 417 полигонов в своей категории эта модель выше середины»,
 * «при медианной цене $99 эта стоит $49».
 *
 * Медиану нельзя считать внутри card-content.mjs: он знает только одну запись,
 * а медиана - свойство всего каталога. Поэтому считаем один раз здесь и кладём
 * рядом с данными. Файл маленький, читается при импорте генератора.
 *
 * Ключ - СЛАГ категории (r.category), не подпись: подпись меняется, слаг нет.
 *
 * Запуск:  node scripts/build-category-stats.mjs
 * В конвейере стоит ПЕРЕД build-model-records.mjs и apply-rebuild.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const RECS = path.join(ROOT, 'data', 'records');
const OUT = path.join(ROOT, 'data', 'category-stats.json');

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const acc = new Map();
let records = 0;

for (let k = 0; k < idx.chunks; k++) {
  const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
  for (const r of recs) {
    records++;
    const cs = r.category;
    if (!cs) continue;
    if (!acc.has(cs)) acc.set(cs, { poly: [], price: [], sales: [] });
    const a = acc.get(cs);
    const p = r.specs && r.specs.polygons;
    if (p > 0) a.poly.push(p);
    const pr = Number(r.price);
    if (pr > 0) a.price.push(pr);
    const sl = Number(r.sales || r.total_sales || 0);
    if (sl > 0) a.sales.push(sl);
  }
}

// Медиана считается только там, где выборка достаточна: на трёх моделях она
// говорит о случайности, а не о категории, и фраза «против медианы» врала бы.
const MIN_N = 20;
const med = a => { if (a.length < MIN_N) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

const out = {};
for (const [cs, a] of [...acc.entries()].sort()) {
  out[cs] = {
    polyMed: med(a.poly), priceMed: med(a.price), salesMed: med(a.sales),
    n: a.poly.length,
  };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const withPoly = Object.values(out).filter(v => v.polyMed).length;
console.log('записей просмотрено: ' + records + ', категорий: ' + Object.keys(out).length
  + ', из них с медианой полигонов: ' + withPoly);
console.log('файл: data/category-stats.json');
