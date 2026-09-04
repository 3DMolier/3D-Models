/*
 * add-category-hub-images.mjs - картинки на карточках /categories/.
 *
 * ПУНКТ 9 СПИСКА. Страница-хаб показывала 26 одинаковых прямоугольников с
 * текстом. Выбрать категорию глазами было нельзя - только вчитываясь.
 * Ставим на каждую карточку превью самой продаваемой модели этой категории:
 * картинка уже лежит в data/fc-img-chunk-*.json, ничего скачивать не нужно.
 *
 * Заодно приводим числа под названиями к единственному источнику. Там стояло
 * «4,629 models» при 4,649 в data/category-counts.json: подписи не обновляли с
 * прошлой пересборки каталога.
 *
 * Повторный запуск ничего не ломает: карточка с картинкой пропускается.
 *
 * Запуск:  node scripts/add-category-hub-images.mjs --dry
 *          node scripts/add-category-hub-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const FILE = path.join(ROOT, 'categories', 'index.html');

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8')).counts;
const nf = n => Number(n).toLocaleString('en-US');

// лучший по продажам представитель каждой категории
const best = new Map();                                   // slug -> {id, name, sales, ic}
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const slug = idx.cats[c.g[j]];
    if (!slug) continue;
    const cur = best.get(slug);
    const sales = c.s[j] || 0;
    if (!cur || sales > cur.sales) best.set(slug, { id: c.i[j], name: c.n[j], sales, ic: c.ic ? c.ic[j] : -1 });
  }
}

const imgCache = new Map();
const imgFor = (ic, id) => {
  if (ic < 0) return '';
  if (!imgCache.has(ic)) {
    const f = path.join(ROOT, 'data', 'fc-img-chunk-' + ic + '.json');
    imgCache.set(ic, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
  }
  return imgCache.get(ic)[String(id)] || '';
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let h = fs.readFileSync(FILE, 'utf8');
const before = h;
let imgAdded = 0, imgMissing = 0, countFixed = 0;

h = h.replace(/<a class="cat-hub-card" href="\/categories\/([a-z0-9-]+)\/">([\s\S]*?)<\/a>/g,
  (whole, slug, inner) => {
    let out = inner;

    // число моделей - из единственного источника
    if (counts[slug]) {
      out = out.replace(/(<div class="cat-hub-tag">)([\d,]+)( models<\/div>)/,
        (x, a, cur, b) => { if (cur !== nf(counts[slug])) countFixed++; return a + nf(counts[slug]) + b; });
    }

    if (/cat-hub-img/.test(out)) return '<a class="cat-hub-card" href="/categories/' + slug + '/">' + out + '</a>';

    const b = best.get(slug);
    const url = b ? imgFor(b.ic, b.id) : '';
    if (!url) { imgMissing++; return '<a class="cat-hub-card" href="/categories/' + slug + '/">' + out + '</a>'; }
    imgAdded++;
    // Подпись alt описывает, ЧТО на снимке, а не повторяет название категории:
    // читающей программе «Aircraft» рядом с заголовком «Aircraft» ничего не даёт.
    const img = '<div class="cat-hub-img"><img src="' + url + '" alt="' + esc(b.name)
      + '" loading="lazy" decoding="async" width="800" height="450"></div>';
    return '<a class="cat-hub-card" href="/categories/' + slug + '/">' + img + out + '</a>';
  });

// стили карточки с картинкой - в тот же <style>, где лежат остальные
if (!/cat-hub-img\{/.test(h)) {
  h = h.replace(/\.cat-hub-card\{[^}]*\}/,
    x => x.replace('padding:18px 20px;', 'padding:0;overflow:hidden;')
      + '.cat-hub-img{aspect-ratio:16/9;background:#f2f2f2;overflow:hidden}'
      + '.cat-hub-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}'
      + '.cat-hub-card:hover .cat-hub-img img{transform:scale(1.04)}'
      + '.cat-hub-card>:not(.cat-hub-img){padding-left:20px;padding-right:20px}'
      + '.cat-hub-name{padding-top:16px}.cat-hub-tag{padding-bottom:16px}');
}

console.log('картинок добавлено: ' + imgAdded + ', без картинки: ' + imgMissing
  + ', чисел поправлено: ' + countFixed);
if (h === before) console.log('изменений нет');
else if (!DRY) { fs.writeFileSync(FILE, h); console.log('записано: categories/index.html'); }
else console.log('(--dry, ничего не записано)');
