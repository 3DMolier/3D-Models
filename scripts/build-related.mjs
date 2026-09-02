/*
 * build-related.mjs - соседи для блока «похожие», прямо в записи.
 *
 * Пункт 2.4б плана «Пересборка страниц из единой записи».
 *
 * ПОЧЕМУ ОТДЕЛЬНЫМ ПРОХОДОМ. Подбор похожих - задача над ВСЕМ каталогом сразу:
 * нужны частоты слов по всем 55 тысячам моделей. Решать её во время отрисовки
 * одной страницы нельзя - пришлось бы держать весь каталог в памяти на каждой
 * из них. Поэтому считаем один раз и кладём готовый список в запись; генератор
 * потом просто его печатает.
 *
 * Формула не тронута - она вынесена как есть в scripts/lib/related.mjs.
 *
 * Запуск:  node scripts/build-related.mjs --dry
 *          node scripts/build-related.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { prepare, pickFor } from './lib/related.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const OUT = path.join(ROOT, 'data', 'records');
const DRY = process.argv.includes('--dry');
const WANT = 10;

/**
 * Дописывает соседей в готовые записи. Экспортируется, чтобы сборка записей
 * вызывала её сама: раньше это был отдельный проход, и повторный запуск
 * build-model-records.mjs молча стирал посчитанных соседей - страницы
 * оставались без блока «похожие», и заметить это можно было только сравнением.
 * Порядок, который нельзя перепутать, лучше порядка, который надо помнить.
 */
export function attachRelated(records, want = WANT) {
  const live = records.filter(r => r.status !== 'new' && r.image);
  const ctx = prepare(live.map(r => ({
    id: r.id, name: r.name, slug: r.slug, cat: r.category,
    sub: r.subcategory || '', uses: r.use_cases || [],
    kw: r.keywords || r.seo_keywords || [],
    price: r.price || 0, sales: r.sales || 0,
  })));
  const meById = new Map(ctx.all.map(m => [m.id, m]));
  const recById = new Map(records.map(r => [r.id, r]));
  let done = 0, empty = 0;
  for (const r of records) {
    const me = meById.get(r.id);
    if (!me) { r.related = []; empty++; continue; }
    r.related = pickFor(me, ctx, want).map(c => {
      const src = recById.get(c.id);
      return {
        slug: c.slug, name: src ? (src.display_name || src.name) : c.name,
        price: c.price, image: src ? src.image : '',
        category_name: src ? src.category_name : '',
      };
    }).filter(x => x.image);
    if (!r.related.length) empty++;
    done++;
  }
  return { done, empty };
}

const t0 = Date.now();
const idx = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
const chunks = [];
for (let k = 0; k < idx.chunks; k++) {
  chunks.push(JSON.parse(fs.readFileSync(path.join(OUT, 'records-' + k + '.json'), 'utf8')));
}
const records = chunks.flat();
console.log('записей: ' + records.length.toLocaleString('ru-RU'));

/*
 * В подборку берём только те модели, у которых СТРАНИЦА УЖЕ ЕСТЬ. Новые модели
 * (status: new) на сайте пока не опубликованы, и ссылка на них вела бы в 404.
 * Появятся страницы - следующий прогон включит их сам.
 */
const live = records.filter(r => r.status !== 'new' && r.image);
console.log('годятся в соседи: ' + live.length.toLocaleString('ru-RU'));

const ctx = prepare(live.map(r => ({
  id: r.id, name: r.name, slug: r.slug, cat: r.category,
  sub: r.subcategory || '', uses: r.use_cases || [], kw: r.keywords || r.seo_keywords || [],
  price: r.price || 0, sales: r.sales || 0,
})));
const meById = new Map(ctx.all.map(m => [m.id, m]));
const recById = new Map(records.map(r => [r.id, r]));

let done = 0, empty = 0, sum = 0;
for (const r of records) {
  const me = meById.get(r.id);
  // У новой модели соседей пока нет: её саму ещё не опубликовали, а соседей ей
  // подберёт следующий прогон - после того, как страница появится.
  if (!me) { r.related = []; empty++; continue; }
  const picked = pickFor(me, ctx, WANT);
  r.related = picked.map(c => {
    const src = recById.get(c.id);
    return {
      slug: c.slug, name: c.name, price: c.price,
      image: src ? src.image : '',
      category_name: src ? src.category_name : '',
    };
  }).filter(x => x.image);
  sum += r.related.length;
  if (!r.related.length) empty++;
  if (++done % 10000 === 0) console.log('  … ' + done.toLocaleString('ru-RU'));
}

console.log('подборок собрано: ' + done.toLocaleString('ru-RU')
  + ', пустых: ' + empty.toLocaleString('ru-RU')
  + ', в среднем соседей: ' + (sum / Math.max(1, done)).toFixed(1));

if (!DRY) {
  let n = 0;
  for (let k = 0; k < idx.chunks; k++) {
    fs.writeFileSync(path.join(OUT, 'records-' + k + '.json'), JSON.stringify(chunks[k]));
    n += chunks[k].length;
  }
  console.log('записано обратно: ' + n.toLocaleString('ru-RU') + ' записей');
} else console.log('(--dry, ничего не записано)');
console.log('время: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
