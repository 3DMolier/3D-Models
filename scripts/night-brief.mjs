/*
 * night-brief.mjs - выдать факты по следующим N карточкам из очереди.
 *
 * Тексты пишутся руками, но факты выдумывать нельзя: полигоны, цена, текстуры,
 * риг и соседние версии берутся из самой карточки. Скрипт складывает их в
 * tools/night-writer/brief.json, оттуда я пишу тексты в written.json, а
 * night-apply.mjs ставит их на карточки.
 *
 * Отдельно отдаём «versions» - другие версии той же модели на той же странице.
 * Именно из-за них основатель поправил образец: нельзя писать «рига нет», если
 * ниже на странице лежит версия с ригом.
 *
 * Запуск:  node night-brief.mjs [--count 20]
 */
import fs from 'node:fs';
import path from 'node:path';
import { salesSentences } from './lib/sales-guard.mjs';
import { salesFixQueue, DAILY } from './lib/sales-fix-queue.mjs';
import { versionFacts, mainFacts } from './lib/version-facts.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const WORK = path.join(ROOT, 'tools', 'night-writer');
const argv = process.argv.slice(2);
const COUNT = argv.includes('--count') ? +argv[argv.indexOf('--count') + 1] : 20;

/*
 * --slugs <файл.json> - справки по ЯВНОМУ списку адресов (массив JSON), вместо
 * очереди. Нужно для разовых заходов: 04.10.2026 понадобились справки по 440
 * главным карточкам семей, чьи версии уже описаны руками, - очередь их не
 * предлагает, потому что сортирует по продажам, а не по этому признаку.
 */
const slugFile = argv.includes('--slugs') ? argv[argv.indexOf('--slugs') + 1] : null;
/*
 * --sales-fix N - справки по следующим N уже опубликованным текстам, где названы
 * продажи (очередь и дневной потолок - lib/sales-fix-queue.mjs). Включает --rewrite.
 */
const SALES_FIX = argv.includes('--sales-fix') ? Math.max(0, +argv[argv.indexOf('--sales-fix') + 1] || 0) : null;
let salesFixInfo = null;
if (SALES_FIX !== null) salesFixInfo = salesFixQueue(SALES_FIX);
const queue = salesFixInfo ? salesFixInfo.slugs
  : slugFile
  ? JSON.parse(fs.readFileSync(slugFile, 'utf8'))
  : JSON.parse(fs.readFileSync(path.join(WORK, 'queue.json'), 'utf8'));
const doneFile = path.join(WORK, 'done.txt');
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []);
/*
 * Уже написанное берём из data/model-hand-desc.json - там текст и живёт.
 * Метка <!-- written:v1 --> в файле страницы больше не ставится: страница
 * собирается из записи, и пометка в ней пропала бы при первой же пересборке
 * вместе с самим текстом, как это уже случилось с 1 762 карточками.
 */
/*
 * --rewrite - справки по УЖЕ написанным карточкам (не пропускать готовые). Нужно для
 * правки продаж (09.11.2026): night-sales-fix.mjs выдаёт список, справка несёт
 * нынешний текст (descriptionNow) и отдельно предложения с продажами (salesSentences).
 * --out <файл> - писать справку не в brief.json (для проверок в стороне от ночной смены).
 */
const REWRITE = argv.includes('--rewrite') || SALES_FIX !== null;
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(WORK, 'brief.json');
if (!REWRITE) {
  const f = path.join(ROOT, 'data', 'model-hand-desc.json');
  if (fs.existsSync(f)) for (const k of Object.keys(JSON.parse(fs.readFileSync(f, 'utf8')))) done.add(k);
} else done.clear();

/*
 * ПРОДАЖ В СПРАВКЕ НЕТ (решение основателя 09.11.2026: «не публиковать количество
 * продаж в общий доступ»). До этого справка несла sales, и около 3,5 тыс. текстов
 * вышли с фразами «sold 228 times». Без поля проверка чисел в night-apply.mjs
 * сама отклонит такое число, а checkSales там же ловит его словами.
 */

const plain = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'")
  .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cell = (h, k) => {
  const m = h.match(new RegExp('<th[^>]*>\\s*' + k + '\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>'));
  return m ? plain(m[1]) : '';
};

// Записи карточек по адресу - читаются один раз и только если справке нужны версии
let REC = null;
const recordBySlug = () => {
  if (!REC) {
    REC = new Map();
    const dir = path.join(ROOT, 'data', 'records');
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^records-\d+\.json$/.test(f))
      for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) REC.set(r.slug, r);
  }
  return REC;
};

const out = [];
for (const slug of queue) {
  if (out.length >= COUNT) break;
  if (done.has(slug)) continue;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }

  // Другие версии этой же модели - блок «All Versions of This Model».
  // Читать его обязательно: именно из-за него основатель поправил образец.
  // Написать «рига нет», когда ниже на странице лежит версия с ригом, - значит
  // отправить покупателя искать то, что уже есть на этой же странице.
  const body = h.slice(h.indexOf('<body'));
  const vi = body.indexOf('mp-versions-section');
  const verBlock = vi < 0 ? '' : body.slice(vi, body.indexOf('</section>', vi));
  const versions = [];
  if (verBlock) {
    const cards = verBlock.split('<a href=').slice(1);
    for (const c of cards) {
      // Название - без метки («main», «Red») и без подписи из данных (data-vf): иначе они приклеиваются к имени
      const titleHtml = ((c.match(/class="mp-rc-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '')
        .replace(/<span class="mp-var-badge">[\s\S]*?<\/span>/g, '').replace(/<span data-vf[\s\S]*?<\/span>/g, '');
      const name = plain(titleHtml);
      const price = plain((c.match(/class="mp-rc-price"[^>]*>([^<]*)/) || [])[1] || '');
      const isMain = /mp-var-badge[^>]*>\s*main/i.test(c);
      if (name) versions.push({ name, price, main: isMain });
    }
    /*
     * Чем версия отличается от главной - из данных (фаза 5, основатель 10.11.2026 согласился): полигоны, риг, мех,
     * текстуры. Берётся из записей, а не со страницы - подписи выпускаются на страницы частями, а факты нужны
     * тексту сразу. Поле facts есть только там, где данные есть; различия без него не придумываются.
     */
    const rec = recordBySlug().get(slug);
    if (rec) {
      const fam = new Map((rec.family || []).map(v => [plain(v.name).toLowerCase(), v]));
      for (const v of versions) {
        const t = v.main ? mainFacts(rec.self_spec) : (fam.has(v.name.toLowerCase()) ? versionFacts(fam.get(v.name.toLowerCase()).spec, rec.self_spec) : '');
        if (t) v.facts = t;
      }
    }
  }
  const verNames = versions.map(v => v.name);
  const verPrices = versions.map(v => v.price);

  const kw = [...h.matchAll(/class="chip chip--kw"[^>]*>([^<]*)</g)].map(m => plain(m[1]));
  const desc = [...h.matchAll(/<p class="mp-desc-text">([\s\S]*?)<\/p>/g)].map(m => plain(m[1]));

  out.push({
    slug,
    name: plain((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || slug),
    category: cell(h, 'Category'),
    price: cell(h, 'Price'),
    quality: cell(h, 'Quality standard') || cell(h, 'Certification'),
    // Лицензия - из строки характеристик. Без неё смена угадывала Editorial по
    // названию и ошибалась в обе стороны (26.10.2026: Samsonite, Apple Card).
    license: cell(h, 'License'),
    polygons: cell(h, 'Polygons'),
    vertices: cell(h, 'Vertices'),
    geometry: cell(h, 'Geometry'),
    uv: cell(h, 'UV mapping'),
    textures: cell(h, 'Textures'),
    rig: cell(h, 'Rig'),
    animation: cell(h, 'Animation'),
    dimensions: cell(h, 'Dimensions'),
    onSaleSince: cell(h, 'On sale since'),
    industries: cell(h, 'Primary industries'),
    typicalUse: cell(h, 'Typical use'),
    versions,
    keywordsNow: kw,
    descriptionNow: desc,
    wordsNow: desc.join(' ').split(/\s+/).filter(Boolean).length,
    ...(REWRITE ? { salesSentences: salesSentences(desc) } : {}),
  });
}

if (salesFixInfo) {
  const q = salesFixInfo;
  console.log(`правка продаж: осталось ${q.remaining}, сегодня переписано ${q.doneToday} из ${DAILY}`
    + (q.slugs.length ? '' : q.room ? ' - выдавать нечего' : ' - дневной потолок исчерпан, сегодня правку продаж больше не делать'));
  // пустая выдача не трогает brief.json: в нём может лежать справка обычного прогона
  if (!out.length) process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('справок собрано: ' + out.length + ' -> ' + path.relative(ROOT, OUT).split(path.sep).join('/'));
console.log('пройдено всего:  ' + done.size + ' из ' + queue.length);
out.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x.name.slice(0, 46).padEnd(48)
  + x.price.padEnd(10) + (x.versions.length ? 'версий: ' + x.versions.length + '  ' : '')
  + 'слов сейчас: ' + x.wordsNow + (x.keywordsNow.length ? '' : '  БЕЗ КЛЮЧЕВЫХ СЛОВ')));
