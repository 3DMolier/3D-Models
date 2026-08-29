/*
 * set-editorial-licence.mjs - Editorial Uses Only для брендовых моделей.
 *
 * ЗАЧЕМ. На карточках стояло «Royalty Free (TurboSquid)» без разбора: и в
 * характеристиках, и в разделе вопросов, и в разметке FAQPage, которую читают
 * поисковики. Но модель реального товара под чужой торговой маркой - Tesla
 * Model 3, Boeing 737, iPhone - продаётся на TurboSquid по лицензии Editorial
 * Uses Only: её нельзя использовать в рекламе и в товарах на продажу.
 *
 * ЧЕМ ЭТО БЫЛО ПЛОХО. Дело не в одной неточной строке. Ответы прямо утверждали
 * обратное: «covers commercial use in games, film, advertising», «Commercial
 * use is included», «puts no limit on where the model is actually used». То
 * есть покупатель, планирующий рекламную съёмку, получал письменное разрешение
 * на то, что лицензией запрещено, - и упирался в запрет уже после оплаты.
 *
 * ПОЧЕМУ НЕЛЬЗЯ ПРОСТО ЗАМЕНИТЬ СЛОВА. Подстановка «Royalty Free» ->
 * «Editorial Uses Only» дала бы «лицензия Editorial Uses Only разрешает рекламу»
 * - хуже прежнего. Поэтому ответ переписывается целиком, по типу вопроса.
 *
 * ЧЕТЫРЕ МЕСТА:
 *   1. строка «Licence» в характеристиках;
 *   2. «Can … be used in a commercial project?» - ответ меняется с «да» на «нет»;
 *   3. «How much does … cost?» - цена сохраняется, утверждение о лицензии нет;
 *   4. «Can … be modified after purchase?» - остаётся «да», добавляется запрет
 *      коммерческого использования;
 *   5. «Which industries use …?» - отрасли остаются, снимается хвост «лицензия
 *      не ограничивает, где применять модель».
 * Замена идёт целой строкой ответа, поэтому видимый текст и JSON-LD меняются
 * одновременно и разойтись не могут.
 *
 * КАК ОПРЕДЕЛЯЕМ БРЕНД. По названию, список марок - в scripts/lib/brands.mjs.
 * Проверить у источника нельзя: страницы TurboSquid отдают 403 на обычный
 * HTTPS, 28 проб из 28.
 *
 * Запуск:  node scripts/set-editorial-licence.mjs --dry
 *          node scripts/set-editorial-licence.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { brandOf } from './lib/brands.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const A_COMMERCIAL = 'No. The model depicts a real branded product, so TurboSquid lists it under '
  + 'the Editorial Uses Only licence. It may be used in news, commentary, education, personal '
  + 'projects and similar editorial contexts, but not in advertising, on merchandise or in any '
  + 'product offered for sale.';
const A_MODIFY = 'Yes. The licence allows editing the geometry, retopologising, changing materials '
  + 'and adapting the asset to a project. What it does not allow is reselling or redistributing the '
  + 'model file itself, or using the result commercially: this listing is Editorial Uses Only.';
const IND_TAIL_OLD = ', though the Royalty Free licence puts no limit on where the model is actually used.';
const IND_TAIL_NEW = '. The licence, however, is Editorial Uses Only: the model depicts a real '
  + 'branded product and may appear in editorial work only, not in advertising or in products for sale.';
const costAnswer = price => price
  + ', paid once. TurboSquid handles payment and delivery. The licence is Editorial Uses Only, '
  + 'because the model depicts a real branded product: it covers editorial contexts such as news, '
  + 'commentary and education, but not advertising or products for sale.';

// ── каталог ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const branded = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const b = brandOf(c.n[j]);
    if (b) branded.push({ id: String(c.i[j]), name: c.n[j], price: c.p[j], brand: b, dir: slugify(c.n[j]) + '-' + c.i[j] });
  }
}
console.log('брендовых моделей по названию: ' + branded.length);

// Пробелы между тегами обязательны: часть карточек собрана с отступами, и без
// \s* регулярка их пропускала - 84 карточки остались бы с прежним текстом.
const FAQ = /<h3 class="mp-faq-q">([^<]*)<\/h3>\s*<p class="mp-faq-a">([\s\S]*?)<\/p>/g;
let live = 0, rowFix = 0, ldFix = 0, changed = 0, missing = 0, leftover = 0, unknown = 0;
const perKind = { commercial: 0, cost: 0, modif: 0, ind: 0 };
const byBrand = new Map();
const unknownEx = [];

for (const m of branded) {
  const file = path.join(MODELS, m.dir, 'index.html');
  if (!fs.existsSync(file)) { missing++; continue; }
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const before = h;

  // 1. характеристики
  // Значение может быть обёрнуто в ссылку на /license/ - она появилась позже
  // этого скрипта. Без учёта обёртки таблица осталась бы «Royalty Free», хотя
  // ответы и разметка уже говорили «Editorial»: страница противоречила бы сама
  // себе, и молча.
  h = h.replace(/(<th[^>]*>Licence<\/th><td[^>]*>(?:<a href="\/license\/">)?)Royalty Free \(TurboSquid\)/,
    (x, a) => { rowFix++; return a + 'Editorial Uses Only (TurboSquid)'; });

  // 2-5. ответы. Собираем сначала все пары, потом заменяем строками: замена
  // строкой цепляет и видимый текст, и тот же текст внутри JSON-LD.
  const jobs = [];
  FAQ.lastIndex = 0;
  let f;
  while ((f = FAQ.exec(h)) !== null) {
    const q = (' ' + f[1]).slice(1);
    const a = (' ' + f[2]).slice(1);
    if (!/Royalty[ -]Free/i.test(a)) continue;
    let na = null, kind = null;
    if (/commercial project/i.test(q)) { na = A_COMMERCIAL; kind = 'commercial'; }
    else if (/How much/i.test(q)) {
      // Цену берём из самого ответа: она там уже стоит в нужном виде.
      const p = a.match(/\$[\d,]+ USD/);
      na = costAnswer(p ? p[0] : '$' + m.price + ' USD');
      kind = 'cost';
    } else if (/modified after/i.test(q)) { na = A_MODIFY; kind = 'modif'; }
    else if (/industries/i.test(q) && a.includes(IND_TAIL_OLD)) {
      na = a.split(IND_TAIL_OLD).join(IND_TAIL_NEW); kind = 'ind';
    }
    if (!na) { unknown++; if (unknownEx.length < 5) unknownEx.push(q + ' || ' + a.slice(0, 90)); continue; }
    jobs.push([a, na, kind]);
  }
  for (const [a, na, kind] of jobs) {
    if (!h.includes(a)) continue;
    h = h.split(a).join(na);
    perKind[kind]++;
  }

  // Тот же разбор отдельно по JSON-LD. Полагаться на то, что видимый текст и
  // текст в разметке совпадают побайтово, нельзя: у части карточек они
  // расходятся экранированием, и после замены только видимого текста поисковик
  // продолжал бы читать «Royalty Free» в FAQPage - то есть страница говорила бы
  // человеку одно, а роботу другое.
  h = h.replace(/("name":"([^"]*)",\s*"acceptedAnswer":\s*\{\s*"@type":"Answer",\s*"text":")([^"]*)(")/g,
    (whole, head, q, a, tail) => {
      if (!/Royalty[ -]Free/i.test(a)) return whole;
      let na = null;
      if (/commercial project/i.test(q)) na = A_COMMERCIAL;
      else if (/How much/i.test(q)) {
        const p = a.match(/\$[\d,]+ USD/);
        na = costAnswer(p ? p[0] : '$' + m.price + ' USD');
      } else if (/modified after/i.test(q)) na = A_MODIFY;
      else if (/industries/i.test(q) && a.includes(IND_TAIL_OLD)) na = a.split(IND_TAIL_OLD).join(IND_TAIL_NEW);
      if (!na) { unknown++; return whole; }
      ldFix++;
      return head + na + tail;
    });

  if (/Royalty[ -]Free/i.test(h)) leftover++;
  if (h === before) continue;
  changed++;
  byBrand.set(m.brand, (byBrand.get(m.brand) || 0) + 1);
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + (missing ? ', без страницы: ' + missing : ''));
console.log('изменено карточек: ' + changed);
console.log('  строка Licence: ' + rowFix);
console.log('  ответ про коммерческое использование: ' + perKind.commercial);
console.log('  ответ про цену: ' + perKind.cost);
console.log('  ответ про изменение модели: ' + perKind.modif);
console.log('  ответ про отрасли: ' + perKind.ind);
console.log('  ответов поправлено в разметке FAQPage: ' + ldFix);
if (unknown) { console.log('  НЕРАЗОБРАННЫХ ответов: ' + unknown); unknownEx.forEach(e => console.log('     ' + e)); }
console.log('карточек, где «Royalty Free» осталось: ' + leftover);
console.log('--- по маркам, топ-10:');
[...byBrand].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log('   ' + k.padEnd(18) + v));
if (DRY) console.log('(--dry, ничего не записано)');
