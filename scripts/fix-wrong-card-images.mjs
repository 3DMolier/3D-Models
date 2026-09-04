/*
 * fix-wrong-card-images.mjs - карточки, показывающие чужой товар.
 *
 * ЧТО НАШЛИ. У 47 карточек главной картинкой и og:image стоит снимок модели
 * «Male Full Body Anatomy and Skin». Среди них торты, баклажаны, ошейники для
 * собак, баскетбольные кольца и упаковки Apple. В выдаче и в мессенджерах эти
 * страницы разворачиваются анатомическим манекеном. Это не мелочь оформления:
 * человек видит не тот товар, о котором страница.
 *
 * ОТКУДА. Похоже на запасной вариант какого-то давнего генератора: когда своей
 * картинки не нашлось, подставилась первая попавшаяся из общего списка. Ошибка
 * такого рода тихая - страница валидна, картинка грузится, аудит молчит.
 *
 * ЧТО ДЕЛАЕМ. Берём картинку по номеру самой модели из данных каталога
 * (fc-img-chunk-*.json) - это авторитетный источник, номер не совпасть не
 * может. Если для модели картинки нет, страницу не трогаем: показать заглушку
 * можно, но подменять одну неверную картинку другой наугад нельзя.
 *
 * Запуск:  node scripts/fix-wrong-card-images.mjs --dry
 *          node scripts/fix-wrong-card-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';

// Признак беды - имя файла картинки. Список открытый: если найдётся ещё одна
// такая «дежурная» картинка, её достаточно дописать сюда.
const WRONG = ['malefullbodyanatomyandskin'];

// ── картинка по номеру модели ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-img-index.json'), 'utf8'));
const imgOf = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const f = path.join(ROOT, 'data', 'fc-img-chunk-' + k + '.json');
  if (!fs.existsSync(f)) continue;
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [id, url] of Object.entries(c)) imgOf.set(id, url);
}

let looked = 0, hit = 0, fixed = 0, noImg = 0, replaced = 0;
const noImgList = [];
// Проходим не только карточки: та же неверная картинка попала в списки
// категорий и подборок - их собирал генератор из тех же данных.
const targets = [];
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) targets.push(['models/' + d, path.join(ROOT, 'models', d, 'index.html')]);
(function walk(rel, depth) {
  if (depth > 4) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name.startsWith('.')) continue;
    const nx = rel + '/' + it.name;
    if (it.isDirectory()) { walk(nx, depth + 1); continue; }
    if (it.name === 'index.html') targets.push([rel, path.join(ROOT, nx)]);
  }
})('categories', 0);
(function walk(rel, depth) {
  if (depth > 4) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name.startsWith('.')) continue;
    const nx = rel + '/' + it.name;
    if (it.isDirectory()) { walk(nx, depth + 1); continue; }
    if (it.name === 'index.html') targets.push([rel, path.join(ROOT, nx)]);
  }
})('collections', 0);

for (const [d, file] of targets) {
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  looked++;

  // Своя ли это модель анатомии - решаем по адресу страницы, а не по картинке.
  const isOwn = WRONG.some(w => d.replace(/-/g, '').includes(w.slice(0, 20)));
  if (isOwn) continue;
  const wrongUrl = WRONG.map(w => {
    const m = h.match(new RegExp('https://[^"\']*' + w + '[^"\']*'));
    return m ? m[0] : null;
  }).find(Boolean);
  if (!wrongUrl) continue;
  hit++;

  const ownId = (d.match(/-(\d{5,})$/) || [])[1];
  const before = h;
  let n = 0, skipped = 0;

  // Один и тот же неверный адрес встречается в разных ролях: как собственная
  // картинка страницы (og:image, twitter:image, главный снимок) и как
  // миниатюра ЧУЖОЙ модели в блоке «похожие». Заменять их одним и тем же
  // нельзя - во втором случае нужна картинка той модели, на которую ведёт
  // ссылка рядом. Поэтому для каждого вхождения ищем ближайшую ссылку слева.
  for (;;) {
    const at = h.indexOf(wrongUrl);
    if (at < 0) break;
    const near = h.slice(Math.max(0, at - 700), at);
    const m = [...near.matchAll(/href="\/models\/[a-z0-9-]*?-(\d{5,})\/"/g)].pop();
    const id = m ? m[1] : ownId;
    let good = id ? imgOf.get(id) : null;
    // Защита от вечного цикла. У части моделей в данных каталога лежит ТА ЖЕ
    // неверная картинка. Подставив её, мы бы нашли её на следующем витке снова
    // и снова - первый прогон на этом и завис. Такие случаи считаем «нечем
    // заменить».
    if (good && WRONG.some(w => good.includes(w))) good = null;
    if (!good) {
      // Своей картинки нет нигде: ни в данных каталога, ни в выгрузке студии.
      // Ставим общую заставку сайта. Заставка честнее чужого товара:
      // анатомический манекен на карточке собачьей игрушки - это не изъян
      // оформления, а неверные сведения о товаре.
      skipped++;
      good = PLACEHOLDER;
    }
    h = h.slice(0, at) + good + h.slice(at + wrongUrl.length);
    n++;
  }

  if (skipped) { noImg++; noImgList.push(d + ' (' + skipped + ')'); }
  if (h === before) continue;
  replaced += n;
  fixed++;
  if (!DRY) fs.writeFileSync(file, h);
  console.log('  ' + d + '  (' + n + ' мест' + (skipped ? ', пропущено ' + skipped : '') + ')');
}

console.log('\nживых карточек просмотрено: ' + looked);
console.log('с чужой картинкой: ' + hit + ', исправлено: ' + fixed + ', адресов заменено: ' + replaced);
if (noImg) {
  console.log('не нашлось своей картинки, не трогали: ' + noImg);
  noImgList.slice(0, 10).forEach(d => console.log('  ' + d));
}
if (DRY) console.log('(--dry, ничего не записано)');
