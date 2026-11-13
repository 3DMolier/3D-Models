/*
 * lastmod.mjs - настоящая дата изменения страницы для карт сайта.
 *
 * Зачем. До 05.10.2026 все карты сайта проставляли <lastmod> сегодняшним числом
 * КАЖДУЮ сборку: 76 035 адресов ежедневно сообщали Google, что изменились.
 * Сигнал, который всегда говорит «всё новое», не значит ничего - его перестают
 * читать, а краул-бюджет уходит на перечитывание неизменившихся страниц вместо
 * тех, которых Google ни разу не видел. Проверка 05.10.2026: карточки каталога
 * в индексе отсутствуют, часть адресов Google вообще неизвестна.
 *
 * Как считаем. По содержимому файла: берём хеш, сравниваем с прошлым прогоном.
 * Содержимое не менялось - дата остаётся прежней, менялось - ставим дату сборки.
 *
 * Два файла, и это не случайность:
 *   data/page-lastmod.json         - дата и хеш, по строке на страницу. Лежит в
 *                                    git: без него на чистой машине все даты
 *                                    слетят в «сегодня» и ложь вернётся.
 *   data/.page-lastmod-mtime.json  - местный кеш времени файла, в git не идёт.
 *                                    Он лишь позволяет не перечитывать то, что
 *                                    и так не трогали.
 *
 * Первая встреча со страницей. Не ставим «сегодня» всем подряд, иначе получим
 * ту же ложь одним днём позже: берём dateModified из разметки страницы, а если
 * его нет - дату последнего изменения файла на диске. Разовый засев по истории
 * git делает scripts/seed-lastmod.mjs - он точнее всех.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { POLICY } from './index-policy.mjs';
import { AHREFS_RE } from './ahrefs.mjs';

const DAY = s => new Date(s).toISOString().slice(0, 10);
const HASH_LEN = 12;

/*
 * Даты внутри страницы при сравнении не учитываем (с page_dates, см.
 * lib/index-policy.mjs). Карточка сама несёт свою дату изменения - если бы она
 * входила в хеш, страница считала бы себя изменённой из-за собственной даты.
 */
const DATE_MOD = /("dateModified"\s*:\s*")[^"]*(")/g;
const DATE_UPD = /(Updated <time datetime=")[^"]*(">)[^<]*(<\/time>)/g;
export const maskDates = s => s.replace(DATE_MOD, '$1$2').replace(DATE_UPD, '$1$2$3');
/*
 * Счётчик Google Analytics у карточек тоже не содержимое. 15.10.2026 его вернули
 * на все 37 683 карточки разом (потерян 02.09); войди он в хеш - у всех карточек
 * встала бы одна дата изменения, та самая ошибка, что чинили 05.10. Только для
 * /models/: у остальных страниц он стоит давно, их хеши считаны вместе с ним.
 */
const GA_BLOCK = /\n?<!-- Google tag \(gtag\.js\) --><script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script><script>[\s\S]*?<\/script>/;
/*
 * Оболочка страницы - не содержимое (29.10.2026). Шапка, подвал и номер версии стилей
 * одинаковы на всех страницах; войди они в хеш - любая правка меню или сброс кеша
 * стилей ставит сегодняшнюю дату на все 38 тысяч карточек. Так и случилось 29.10:
 * версия стилей v51 -> v52 сдвинула даты у 38 669 страниц, настоящих правок было 7 тысяч.
 * Миграция хешей на это правило - scripts/rehash-lastmod-chrome.mjs (разовая).
 */
const CHROME_HEADER = /<header id="site-header">[\s\S]*?<\/header>/;
const CHROME_FOOTER = /<footer[\s>][\s\S]*?<\/footer>/;
const ASSET_VER = /(\.(?:css|js))\?v=\d+/g;
// Медиана по категории («Against a median of 7,661 polygons across our Other models», «median
// across the same category is $49») пересчитывается каждый день и плавает на единицы - это
// справка о разделе, а не правка модели. 29.10.2026 одна она сдвигала даты у ~13 тысяч карточек.
// 12.11.2026 медиана полигонов в тексте округлена: «median of about 28,000», «the roughly 28,000 polygon median».
// «about »/«roughly » вырезаются вместе с числом - старый и новый вид дают один хеш, и разовая смена текста
// на ~30 тыс. карточек даты не сдвигает.
const CAT_MEDIAN = /(median (?:of |across the same category is ))(?:about )?(\$?)[\d,]+/g;
// «next to the 7,661 median of our range», «the 28,670 polygon median of our Electronics»
const CAT_MEDIAN_BEFORE = /(?:roughly )?\$?[\d,]+((?: [a-z]+)? median (?:of|across) )/g;
/*
 * Ссылки ключевых слов (09.11.2026): /catalog/?q=... и /search/?q=... переведены на #q= - 594 тыс. ссылок с карточек
 * плодили ~91 тыс. адресов-копий каталога для поисковика. Смена адреса ссылки - не правка модели: в хеше
 * приводим #q= к прежнему ?q=, тогда даты у 36 тыс. карточек не сдвигаются и миграция хешей не нужна.
 */
const KW_FRAGMENT = /href="\/(catalog|search)\/#q=/g;
/*
 * Шаблон поиска в разметке WebSite/SearchAction (10.11.2026): /catalog/?q={search_term_string} переведён на
 * #q= на 590 страницах - старые адреса ?q= теперь уводит на #q= скрипт каталога. Это не правка содержимого:
 * в хеше приводим к прежнему виду, даты категорий и подборок не сдвигаются.
 */
const SA_FRAGMENT = /\/catalog\/#q=\{search_term_string\}/g;
/*
 * Блок Keywords целиком (10.11.2026): теги сокращены до 5-6 (render-card.mjs, realTags). Набор тегов -
 * навигация, а не правка модели; войди он в хеш - сокращение сдвинуло бы даты у 38 тыс. карточек разом.
 * Журнал дат перенесён на это правило разово (38 027 записей, даты прежние) до пересборки карточек.
 */
const KW_BLOCK = /<div class="mp-kw-block">[\s\S]*?<div class="mp-chip-row">[\s\S]*?<\/div><\/div>/;
/*
 * Картинки и их доставка (13.11.2026): миниатюры переведены на прокси wsrv.nl и свои WebP (lib/thumbs.mjs), у
 * главного снимка появилась предзагрузка, у ссылок TurboSquid - rel="sponsored". Это доставка и разметка, а не
 * правка модели; войди они в хеш - даты сдвинулись бы у всех 38 тыс. карточек и всех разделов разом.
 * Каждая <img> в хеше - просто «<img>» (адрес, srcset, размеры, обработчики не считаются), предзагрузка и
 * preconnect/dns-prefetch выпадают, «rel="sponsored ...» приводится к прежнему «rel="...».
 * Журнал дат перенесён на это правило разово: scripts/rehash-lastmod-images.mjs (даты прежние).
 */
const IMG_TAG = /<img\b[^>]*>/g;
const PRELOAD_IMG = /<link rel="preload" as="image"[^>]*>\n?/g;
const PRECONNECT = /<link rel="(?:preconnect|dns-prefetch)"[^>]*>\n?/g;
const REL_SPONSORED = /\brel="sponsored /g;
// Асинхронная загрузка шрифтов (13.11.2026, разделы и подборки) приводится к прежнему синхронному виду.
const FONTS_ASYNC = /<link rel="stylesheet" href="\/assets\/css\/fonts\.css" media="print" onload="this\.media='all'">\s*<noscript>(<link rel="stylesheet" href="\/assets\/css\/fonts\.css">)<\/noscript>/g;
export const stripChrome = (s, images = true) => {
  s = s.replace(CHROME_HEADER, '').replace(CHROME_FOOTER, '').replace(ASSET_VER, '$1')
    .replace(CAT_MEDIAN, '$1$2').replace(CAT_MEDIAN_BEFORE, '$1').replace(KW_BLOCK, '').replace(KW_FRAGMENT, 'href="/$1/?q=')
    .replace(SA_FRAGMENT, '/catalog/?q={search_term_string}');
  return images
    ? s.replace(IMG_TAG, '<img>').replace(PRELOAD_IMG, '').replace(PRECONNECT, '').replace(REL_SPONSORED, 'rel="').replace(FONTS_ASYNC, '$1')
    : s;
};
/* images=false - правило до 13.11.2026, нужно только разовому переносу журнала (rehash-lastmod-images.mjs). */
export const hashBody = (body, masked = POLICY.page_dates, isModel = false, images = true) => {
  let s = masked ? maskDates(body.toString('utf8')) : null;
  if (s !== null && isModel) s = s.replace(GA_BLOCK, '');
  // Счётчик Ahrefs (28.10.2026) тоже не содержимое, и для всех страниц: см. lib/ahrefs.mjs
  if (s !== null) s = s.replace(AHREFS_RE, '');
  if (s !== null) s = stripChrome(s, images);
  return crypto.createHash('sha1').update(s !== null ? s : body).digest('hex').slice(0, HASH_LEN);
};
const humanDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
/* Вписать дату изменения в карточку - ту же, что уходит в <lastmod>. */
function stampDate(s, iso) {
  return s.replace(DATE_MOD, '$1' + iso + '$2').replace(DATE_UPD, '$1' + iso + '$2' + humanDate(iso) + '$3');
}

export function createLastmod(root, buildDate) {
  const store = path.join(root, 'data', 'page-lastmod.json');
  const cacheFile = path.join(root, 'data', '.page-lastmod-mtime.json');
  let map = {};          // путь -> [дата, хеш]
  let mtimes = {};       // путь -> mtimeMs (местный кеш, не в git)
  try { map = JSON.parse(fs.readFileSync(store, 'utf8')); } catch { }
  try { mtimes = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { }
  const today = buildDate || new Date().toISOString().slice(0, 10);
  const stats = { unchanged: 0, changed: 0, seeded: 0, missing: 0 };
  const touched = new Set();

  // Адрес страницы -> файл на диске: /models/x/ -> models/x/index.html
  const fileFor = (urlPath) => {
    const rel = String(urlPath).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    return path.join(root, rel, 'index.html');
  };

  // Дата из разметки страницы - ею засеиваем карту при первой встрече.
  const fromMarkup = (file) => {
    try {
      const head = fs.readFileSync(file, 'utf8').slice(0, 8000);
      const m = head.match(/"dateModified":"(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    } catch { return null; }
  };

  const read = (key) => {
    const v = map[key];
    if (!v) return null;
    return Array.isArray(v) ? { date: v[0], hash: v[1] } : { date: v.date, hash: v.hash };
  };

  function lastmodFor(urlPath) {
    const file = fileFor(urlPath);
    let st;
    try { st = fs.statSync(file); } catch { stats.missing++; return today; }

    const key = path.relative(root, file).replace(/\\/g, '/');
    touched.add(key);
    const prev = read(key);

    // Файл не трогали с прошлого прогона - читать и хешировать незачем.
    if (prev && mtimes[key] === st.mtimeMs) { stats.unchanged++; return prev.date; }

    let body;
    try { body = fs.readFileSync(file); } catch { stats.missing++; return today; }
    const hash = hashBody(body, undefined, key.startsWith('models/'));
    mtimes[key] = st.mtimeMs;

    if (prev && prev.hash === hash) {                 // перезаписали тем же содержимым
      stats.unchanged++;
      return stamp(file, key, body, prev.date);
    }
    if (!prev) {                                      // первая встреча - не врём «сегодня»
      const seed = fromMarkup(file) || DAY(st.mtime);
      map[key] = [seed, hash];
      stats.seeded++;
      return stamp(file, key, body, seed);
    }
    map[key] = [today, hash];                         // содержимое правда изменилось
    stats.changed++;
    return stamp(file, key, body, today);
  }

  // Карточка показывает ту же дату, что карта сайта. Только при page_dates и
  // только для /models/: у остальных страниц даты ставят свои генераторы.
  function stamp(file, key, body, date) {
    if (!POLICY.page_dates || !key.startsWith('models/')) return date;
    const s = body.toString('utf8');
    const t = stampDate(s, date);
    if (t !== s) {
      fs.writeFileSync(file, t);
      mtimes[key] = fs.statSync(file).mtimeMs;
      stats.stamped = (stats.stamped || 0) + 1;
    }
    return date;
  }

  /*
   * save({ prune }) - записать карту.
   * prune: выбросить страницы, которых в этом прогоне не спрашивали. Нужно,
   * когда прогон охватывает все карты сайта; при частичном прогоне - нельзя,
   * иначе потеряем даты половины сайта.
   */
  function save({ prune = false } = {}) {
    if (prune) for (const k of Object.keys(map)) if (!touched.has(k)) delete map[k];
    const keys = Object.keys(map).sort();
    const body = '{\n' + keys.map(k => `${JSON.stringify(k)}:${JSON.stringify(map[k])}`).join(',\n') + '\n}\n';
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, body, 'utf8');            // по строке на страницу - чтобы diff был маленьким
    fs.writeFileSync(cacheFile, JSON.stringify(mtimes), 'utf8');
    return { ...stats, total: keys.length };
  }

  return { lastmodFor, save, stats };
}
