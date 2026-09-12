// add-new-to-catalog.mjs — новые модели в индекс каталога и поиска.
//
// rebuild-search-index собирает индекс ФИЛЬТРАЦИЕЙ старой выгрузки: он умеет
// выбросить свёрнутое, но не умеет добавить то, чего в выгрузке не было. Из-за
// этого 1132 новые карточки живут на сайте, а в поиске и полном каталоге их нет
// (скрипт сам об этом предупреждает: «живых, но НЕ в индексе»).
//
// Формат колоночный: i - id, n - имя, p - цена, s - продажи, c - код
// сертификации (2 = CheckMate, 1 = StemCell, 0 = без сертификации; так их
// читает assets/js/full-catalog.js).
//
// Запуск:  node scripts/add-new-to-catalog.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const CHUNK = 10000;

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const KEYS = idx.keys;
const rows = [];
for (let n = 0; n < idx.chunks; n++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + n + '.json'), 'utf8'));
  const len = c[KEYS[0]].length;
  for (let i = 0; i < len; i++) {
    const r = {};
    for (const k of KEYS) r[k] = c[k][i];
    rows.push(r);
  }
}
const have = new Set(rows.map(r => String(r.i)));
console.log('в индексе сейчас: ' + rows.length);

const certCode = c => /CheckMate/i.test(c || '') ? 2 : (/StemCell/i.test(c || '') ? 1 : 0);
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/*
 * Папки карточек по номеру модели.
 *
 * Раньше адрес вычислялся из названия: slugify(имя) + номер. У модели «Broken
 * Glass Fragments1» вычисленный адрес не совпал с настоящим, скрипт решил, что
 * живой карточки нет, и не добавил её: страница на сайте есть, а в поиске и
 * полном каталоге её нет. Поймано проверкой счётчиков как расхождение в одну
 * модель.
 *
 * Правило уже записано кровью: АДРЕС КАРТОЧКИ НЕ ВЫЧИСЛЯТЬ - искать папку по
 * номеру.
 */
const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const did = d.slice(d.lastIndexOf('-') + 1);
  if (/^[0-9]+$/.test(did) && !DIR_BY_ID.has(did)) DIR_BY_ID.set(did, d);
}
const HEAD = 400, buf = Buffer.alloc(HEAD);
const isLive = slug => {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, slug, 'index.html'), 'r'); } catch (e) { return false; }
  try { const n = fs.readSync(fd, buf, 0, HEAD, 0); return !/http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8')); }
  finally { fs.closeSync(fd); }
};

const np = JSON.parse(fs.readFileSync(path.join(DATA, 'new-products.json'), 'utf8'));
let added = 0, skipHave = 0, skipDead = 0;
for (const p of np) {
  const id = String(p.pid);
  if (have.has(id)) { skipHave++; continue; }
  // Только живые карточки: свёрнутые в заглушку в индексе не нужны, иначе поиск
  // снова начнёт показывать то, что мы объединили.
  const dir = DIR_BY_ID.get(id);
  if (!dir || !isLive(dir)) { skipDead++; continue; }
  rows.push({ i: Number(id), n: p.name, p: +p.price || 0, s: 0, c: certCode(p.cert) });
  added++;
}
console.log('из new-products добавлено: ' + added + ', уже были: ' + skipHave + ', нет живой карточки: ' + skipDead);

/*
 * Второй источник: ЗАПИСИ. new-products.json знает только про свежие поставки,
 * а карточка выпадает из индекса и по другой причине.
 *
 * 12.09.2026: основатель ввёл правило «главной становится лидер продаж», и в
 * 25 группах главная сменилась. Прежняя главная ушла в заглушку, а новая
 * воскресла из заглушки - её выбросил rebuild-search-index на прошлом прогоне,
 * и вернуть её было нечем. Сайт показывал 44 501 карточку, поиск - 44 476.
 *
 * Правило то же, что и выше: берём только ЖИВЫЕ карточки и только те, которых
 * в индексе нет. Адрес - из папки по номеру, не вычисляем.
 */
const RECS = path.join(DATA, 'records');
let addedRec = 0;
if (fs.existsSync(RECS)) {
  for (const f of fs.readdirSync(RECS).filter(x => /^records-\d+\.json$/.test(x))) {
    for (const r of JSON.parse(fs.readFileSync(path.join(RECS, f), 'utf8'))) {
      const id = String(r.id);
      if (have.has(id)) continue;
      const dir = DIR_BY_ID.get(id);
      if (!dir || !isLive(dir)) continue;
      have.add(id);
      /*
       * Имя здесь - ИСХОДНОЕ, не имя семьи. Полный каталог строит адрес плитки
       * из имени: makeSlug(name) + номер. У склеенной карточки папка названа по
       * исходному имени главной, а имя семьи другое - «Dark Skin Cobra
       * Crawling» вместо dark-skin-cobra-crawling-animated-rigged-2413184, и
       * плитка вела в никуда. Поймано проверкой [16].
       */
      rows.push({ i: Number(id), n: r.name, p: +r.price || 0,
        s: +r.sales || 0, c: certCode(r.cert) });
      addedRec++;
    }
  }
}
console.log('из записей добавлено: ' + addedRec);

if (!DRY) {
  const chunks = Math.ceil(rows.length / CHUNK);
  for (let n = 0; n < chunks; n++) {
    const part = rows.slice(n * CHUNK, (n + 1) * CHUNK);
    const col = {};
    for (const k of KEYS) col[k] = part.map(r => r[k]);
    fs.writeFileSync(path.join(DATA, 'fc-chunk-' + n + '.json'), JSON.stringify(col));
  }
  for (let n = chunks; n < idx.chunks; n++) {
    const f = path.join(DATA, 'fc-chunk-' + n + '.json');
    if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('  удалён лишний fc-chunk-' + n + '.json'); }
  }
  idx.total = rows.length; idx.chunks = chunks;
  fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx));
  console.log('\nстало в индексе: ' + rows.length + ', чанков: ' + chunks);
} else console.log('\n(--dry, ничего не записано)');
