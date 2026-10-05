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

const DAY = s => new Date(s).toISOString().slice(0, 10);
const HASH_LEN = 12;

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
    const hash = crypto.createHash('sha1').update(body).digest('hex').slice(0, HASH_LEN);
    mtimes[key] = st.mtimeMs;

    if (prev && prev.hash === hash) {                 // перезаписали тем же содержимым
      stats.unchanged++;
      return prev.date;
    }
    if (!prev) {                                      // первая встреча - не врём «сегодня»
      const seed = fromMarkup(file) || DAY(st.mtime);
      map[key] = [seed, hash];
      stats.seeded++;
      return seed;
    }
    map[key] = [today, hash];                         // содержимое правда изменилось
    stats.changed++;
    return today;
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
