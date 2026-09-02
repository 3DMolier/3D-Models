/*
 * compare-rebuild.mjs - чем пересобранная страница отличается от нынешней.
 *
 * Этап 3 плана «Пересборка страниц из единой записи».
 *
 * ПОЧЕМУ НЕ ТЕНЕВАЯ ПАПКА. В плане было «собрать в .shadow/ и сравнить». На
 * деле выкладывать 54 025 страниц на диск незачем: это 2,4 ГБ ради того, чтобы
 * тут же их прочитать. Собираем страницу в памяти, сравниваем с живой и
 * забываем. Смысл этапа сохранён полностью: ни один файл сайта не тронут.
 * Отдельные страницы можно выложить для разглядывания флагом --dump.
 *
 * ЧТО СРАВНИВАЕМ. Не байты - они разойдутся на каждой странице из-за отступов,
 * накопленных заплатками. Сравниваем то, что видит человек и робот:
 *   заголовок, канонический адрес, h1, цена, категория во ВСЕХ четырёх местах,
 *   лицензия, строки характеристик, число вопросов, миниатюр, чипов и карточек,
 *   военные обороты у невоенных моделей.
 *
 * Отличие само по себе не беда: половина из них - то, ради чего пересборка и
 * затевалась. Задача этапа - чтобы КАЖДОЕ отличие было объяснено, а не чтобы
 * их не было.
 *
 * Запуск:  node scripts/compare-rebuild.mjs --sample 500
 *          node scripts/compare-rebuild.mjs
 *          node scripts/compare-rebuild.mjs --dump atlantic-salmon-fish-1118994
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const RECS = path.join(ROOT, 'data', 'records');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SAMPLE = Number(arg('--sample')) || 0;
const DUMP = arg('--dump');

const t0 = Date.now();

// ── признаки страницы ───────────────────────────────────────────────────────
const one = (s, re) => { const m = s.match(re); return m ? m[1].trim() : null; };
const many = (s, re) => (s.match(re) || []).length;

function signals(html) {
  return {
    title: one(html, /<title>([^<]*)<\/title>/),
    canonical: one(html, /rel="canonical" href="([^"]*)"/),
    ogImage: one(html, /og:image" content="([^"]*)"/),
    h1: one(html, /<h1[^>]*>([^<]*)</),
    price: one(html, /class="mp-price">\$([\d.]+)</),
    // Категория в четырёх местах. Ради того, чтобы они не расходились, всё и затеяно.
    catCrumb: one(html, /<a href="\/categories\/([a-z0-9-]+)\/" class="mp-bc-link"/),
    catSpec: one(html, /Category<\/th><td[^>]*><a href="\/categories\/([a-z0-9-]+)\//),
    catSchema: one(html, /"category":"([^"]*)"/),
    catRelated: one(html, /class="section-label mp-mb8">More in ([^<]*)</),
    licence: one(html, /Licen[cs]e<\/th><td[^>]*>(?:<a[^>]*>)?([^<]*)</),
    // Живые страницы называют этот ряд то «Certification», то «Quality
    // standard» - две подписи одного и того же. Признак принимает обе, иначе
    // он показывает расхождение там, где отличается только слово.
    cert: one(html, /(?:Certification|Quality standard)<\/th>\s*<td[^>]*>([^<]*)</),
    // Считаем ВСЕ строки таблицы. Часть из них заплатки дописывали простым
    // <th> без scope, и признак видел только восемь строк из двадцати.
    /*
     * Строки таблицы сравниваем КАК НАБОР, отсортированно. Порядок на живых
     * страницах случайный: заплатки вставляли новые строки туда, куда
     * попадала регулярка. Требовать от пересборки повторить этот порядок
     * бессмысленно - важно, чтобы совпал состав.
     */
    specRows: [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim()).sort().join(','),
    specOrder: [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim()).join(','),
    faq: many(html, /mp-faq-q/g),
    thumbs: many(html, /mp-gal-thumb/g),
    chips: many(html, /chip--kw/g),
    related: many(html, /mp-rc-link/g),
    // Только чипы, ведущие в отрасль: класс chip--sm носят и категория, и
    // подкатегория, и назначения - по нему признак считал разное.
    industries: many(html, /href="\/industries\/[a-z0-9-]+\/" class="chip/g),
    /*
     * Структурные признаки. Их не было в первой версии сравнения, и оно
     * пропустило целый класс пропусков: отсутствовали два блока разметки из
     * четырёх, строка об авторе и датах, обёртка карточки характеристик,
     * а описание шло одним куском вместо трёх абзацев. Всё это невидимо для
     * признаков «что написано», но видно человеку и поисковику.
     */
    specCard: many(html, /class="mp-spec-card"/g),
    descParas: many(html, /class="mp-desc-text"/g),
    metaLine: many(html, /class="mp-meta-line"/g),
    /*
     * Набор имён классов. Признак появился после того, как в крошках
     * потерялся класс mp-bc-inner (это flex-раскладка) и «Home» получил
     * несуществующий bc-link вместо mp-bc-link. Обе описки задели бы все
     * страницы, а сверка их не видела: она сличала содержимое, но не то,
     * какими классами оно размечено.
     */
    cssClasses: [...new Set([...html.matchAll(/class="([^"]*)"/g)]
      .flatMap(m => m[1].split(/\s+/)).filter(Boolean))].sort().join(' '),
    /*
     * Дата публикации отдельным признаком. Без него правка прошла бы молча:
     * на живых страницах она ВЫЧИСЛЯЛАСЬ («сегодня минус дни в продаже») и
     * потому уехала вперёд на 153 дня у всех карточек, а теперь берётся
     * настоящей из отчёта. Признак есть - значит цифра попадёт в отчёт.
     */
    pubDate: (html.match(/Published <time datetime="([^"]*)"/) || [, ''])[1],
    backLink: many(html, /class="nav-link mp-back-link"/g),
    ctaCard: many(html, /class="mp-cta-card"/g),
    schemaBlocks: many(html, /application\/ld\+json/g),
    useCases: many(html, /class="mp-chip-row-8"/g),
    galleryStrip: many(html, /class="mp-gal-strip"/g),
    heroImg: many(html, /class="mp-hero-img"/g),
    detailsGrid: many(html, /class="mp-details-grid"/g),
  };
}

// ── записи ──────────────────────────────────────────────────────────────────
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));

if (DUMP) {
  for (let k = 0; k < idx.chunks; k++) {
    const r = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))
      .find(x => x.slug === DUMP);
    if (!r) continue;
    const dir = path.join(ROOT, '.tmp', 'shadow');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, DUMP + '.html'), renderCard(r));
    console.log('выложено: .tmp/shadow/' + DUMP + '.html');
    process.exit(0);
  }
  console.log('запись не найдена: ' + DUMP);
  process.exit(1);
}

const diffs = new Map();        // признак -> сколько страниц отличается
const examples = new Map();     // признак -> первые примеры
let checked = 0, missing = 0, failed = 0, identical = 0;
const failures = [];

for (let k = 0; k < idx.chunks; k++) {
  const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.status === 'new') continue;                       // страницы ещё нет
    if (SAMPLE && (checked + missing) % SAMPLE !== 0) { checked++; continue; }

    let live;
    try { live = fs.readFileSync(path.join(MODELS, r.slug, 'index.html'), 'utf8'); }
    catch (e) { missing++; continue; }

    let fresh;
    try { fresh = renderCard(r); }
    catch (e) {
      failed++;
      if (failures.length < 8) failures.push(r.slug + ': ' + e.message);
      continue;
    }

    const a = signals(live), b = signals(fresh);
    let same = true;
    for (const key of Object.keys(a)) {
      if (String(a[key]) === String(b[key])) continue;
      same = false;
      diffs.set(key, (diffs.get(key) || 0) + 1);
      if (!examples.has(key)) examples.set(key, []);
      const ex = examples.get(key);
      if (ex.length < 3) ex.push(r.slug + ':  было «' + a[key] + '»  ->  стало «' + b[key] + '»');
    }
    if (same) identical++;
    checked++;
  }
  if (!SAMPLE) console.log('  … кусок ' + (k + 1) + ' из ' + idx.chunks);
}

console.log('\nсравнено страниц: ' + checked.toLocaleString('ru-RU')
  + (SAMPLE ? '  (выборка, каждая ' + SAMPLE + '-я)' : '')
  + ', совпали полностью: ' + identical.toLocaleString('ru-RU'));
if (missing) console.log('нет живой страницы: ' + missing);
if (failed) { console.log('НЕ СОБРАЛИСЬ: ' + failed); failures.forEach(f => console.log('   ' + f)); }

console.log('\nОТЛИЧИЯ ПО ПРИЗНАКАМ');
[...diffs].sort((a, b) => b[1] - a[1]).forEach(([key, n]) => {
  console.log('  ' + String(n).padStart(7) + '  ' + key);
  (examples.get(key) || []).forEach(e => console.log('           ' + e.slice(0, 150)));
});
console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
