/*
 * validate-records.mjs - проверки по ЗАПИСЯМ, а не по разметке.
 *
 * Этап 5 плана «Пересборка страниц из единой записи».
 *
 * ЗАЧЕМ. validate-data.mjs читает 88 тысяч HTML-файлов и вытаскивает значения
 * регулярками. Это полчаса работы и постоянный риск проверить не то: регулярка
 * с британским написанием молча перестала находить строку лицензии, счётчик
 * чипов считал три разные роли одним классом. Данные надо проверять там, где
 * они лежат, а не там, где они напечатаны.
 *
 * Здесь проверяется САМА ЗАПИСЬ. На HTML остаются только те проверки, которые
 * действительно о разметке: целостность адресов, скрытые блоки, управляющие
 * символы. Они живут в validate-data.mjs.
 *
 * Запуск:  node scripts/validate-records.mjs
 *          node scripts/validate-records.mjs --limit 12
 */
import fs from 'node:fs';
import path from 'node:path';
import { isMilitary } from './lib/military.mjs';
import { brandOf } from './lib/brands.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');
const MODELS = path.join(ROOT, 'models');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > 0 ? Number(process.argv[i + 1]) : 6; })();

const t0 = Date.now();
const problems = [];
const fail = (n, msg, examples) => problems.push({ n, msg, examples });
const fmt = v => Number(v).toLocaleString('ru-RU');

// ── источники, с которыми сверяемся ──
const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'taxonomy.json'), 'utf8')).categories;
const catName = new Map(tax.map(c => [c.slug, c.name]));
const SITE_INDUSTRIES = new Set(fs.readdirSync(path.join(ROOT, 'industries'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name));
const dirs = new Set(fs.readdirSync(MODELS));

// ── записи ──
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const records = [];
for (let k = 0; k < idx.chunks; k++) {
  records.push(...JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8')));
}
const live = records.filter(r => r.status !== 'new');
console.log('записей: ' + fmt(records.length) + ' (живых ' + fmt(live.length)
  + ', новых ' + fmt(records.length - live.length) + ')');

const bad = () => [];
const b1 = bad(), b2 = bad(), b3 = bad(), b4 = bad(), b5 = bad(),
  b6 = bad(), b7 = bad(), b8 = bad(), b9 = bad(), b10 = bad();
const bySlug = new Map(records.map(r => [r.slug, r]));

for (const r of records) {
  // 1. адрес - существующая папка (у новых модели папки ещё нет)
  if (r.status !== 'new' && !dirs.has(r.slug)) b1.push(r.slug);

  // 2. категория из таксономии, подпись ей соответствует
  if (!catName.has(r.category)) b2.push(r.slug + ': «' + r.category + '»');
  else if (catName.get(r.category) !== r.category_name) {
    b2.push(r.slug + ': слаг ' + r.category + ', подпись «' + r.category_name + '»');
  }

  // 3. отрасли существуют разделами сайта
  for (const s of r.industries || []) {
    if (!SITE_INDUSTRIES.has(s)) { b3.push(r.slug + ': ' + s); break; }
  }

  // 4. лицензия отвечает марке
  /*
   * Марку берём из записи, а не вычисляем заново из имени. Вычисление здесь
   * расходилось с записью: у записи марка выведена из заголовка страницы
   * («Bell Helicopter»), а сырое имя модели её не содержит в том же виде.
   * У поля должен быть один хозяин, иначе проверка спорит с данными.
   */
  const wantLic = r.brand ? 'Editorial Uses Only (TurboSquid)' : 'Royalty Free (TurboSquid)';
  if (r.licence !== wantLic) b4.push(r.slug + ': «' + r.licence + '», ожидалось «' + wantLic + '»');

  // 5. боевые сценарии - только у военных
  if (r.military && !isMilitary(r.name, r.category)) b5.push(r.slug);

  // 6. сертификат из известного набора
  if (!['CheckMate Pro', 'CheckMate Lite', 'StemCell', 'no certification'].includes(r.cert)) {
    b6.push(r.slug + ': «' + r.cert + '»');
  }

  // 7. у каждого варианта семьи есть картинка и адрес товара
  for (const v of r.family || []) {
    if (!v.image || !v.ts_url) { b7.push(r.slug + ' -> ' + v.slug); break; }
  }

  // 8. соседи ведут на существующие живые карточки
  for (const v of r.related || []) {
    const t = bySlug.get(v.slug);
    if (!t || t.status === 'new') { b8.push(r.slug + ' -> ' + v.slug); break; }
  }

  // 9. цена и превью на месте у живой карточки
  if (r.status !== 'new') {
    if (!r.price) b9.push(r.slug + ': цена ' + r.price);
    else if (!r.image) b9.push(r.slug + ': нет превью');
  }

  // 10. модель не может быть сама себе вариантом или соседом
  if ((r.family || []).some(v => v.slug === r.slug)
    || (r.related || []).some(v => v.slug === r.slug)) b10.push(r.slug);
}

const check = (n, list, msg) => {
  console.log('  [' + n + '] ' + msg + ': ' + (list.length ? 'НАРУШЕНИЙ ' + fmt(list.length) : 'чисто'));
  if (list.length) fail(n, msg, list);
};
check(1, b1, 'адрес записи - существующая папка');
check(2, b2, 'категория из таксономии и её подпись');
check(3, b3, 'отрасли существуют разделами сайта');
check(4, b4, 'лицензия отвечает марке');
check(5, b5, 'боевые сценарии только у военных моделей');
check(6, b6, 'сертификат из известного набора');
check(7, b7, 'у вариантов семьи есть превью и ссылка');
check(8, b8, 'соседи ведут на живые карточки');
check(9, b9, 'у живой карточки есть цена и превью');
check(10, b10, 'модель не ссылается сама на себя');

console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
if (!problems.length) { console.log('\nВСЕ 10 ПРОВЕРОК ПРОЙДЕНЫ'); process.exit(0); }
console.log('\nНАРУШЕНИЙ: ' + problems.length);
for (const p of problems) {
  console.log('\n  [' + p.n + '] ' + p.msg + ' - ' + fmt(p.examples.length));
  p.examples.slice(0, LIMIT).forEach(e => console.log('      ' + e));
}
process.exit(1);
