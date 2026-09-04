/*
 * receive-studio-batch.mjs - принять пачку данных, собранную в браузере.
 *
 * ЗАЧЕМ. У 674 моделей, вышедших в июле-августе, на сайте нет ни карточки, ни
 * превью: выгрузка каталога обрывается на ID 2587532. Всё нужное есть в нашем
 * же приложении студии, но за логином. Сбор идёт в авторизованной вкладке
 * (см. studio-inventory-collect.js), а этот скрипт принимает результат.
 *
 * ЧТО ДЕЛАЕТ.
 *   1. Кладёт собранное в studio-inventory-part-NN.json - тот же вид, в каком
 *      лежат прежние 15 частей. Второго пути для тех же данных не заводим:
 *      build-model-records.mjs уже умеет их читать.
 *   2. Дописывает модели в data/new-products.json, чтобы сборщик завёл для них
 *      записи. Строки берутся из отчёта TurboSquid - там уже есть имя, цена,
 *      дата, сертификат и категории.
 *
 * ЧЕГО НЕ ДЕЛАЕТ. Не создаёт страниц и ничего не публикует. После него надо
 * пересобрать записи и посмотреть пробный прогон.
 *
 * Вход: файл вида { "<turbosquid_id>": { specs..., images: [адреса] }, ... }
 *
 * Запуск:  node scripts/receive-studio-batch.mjs .tmp/xl/studio-batch.json
 *          добавить --dry, чтобы только посмотреть
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const DL = 'C:/Users/MSI-PC/Downloads/';
const SRC = process.argv[2];
const DRY = process.argv.includes('--dry');

if (!SRC || !fs.existsSync(SRC)) {
  console.log('нужен путь к собранному файлу');
  console.log('пример: node scripts/receive-studio-batch.mjs .tmp/xl/studio-batch.json');
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const ids = Object.keys(batch);
console.log('в пачке моделей: ' + ids.length.toLocaleString('ru-RU'));

/*
 * Сокращённая запись адресов. При сборе адреса ужимали: общее начало
 * «https://www.3dmolier-studio.com/assets/» отбрасывали, а поле называли `img`
 * вместо `images`. Иначе пачка не пролезала через переписку - 703 КБ против
 * 1,34 МБ. Здесь разворачиваем обратно, чтобы дальше по коду был один вид
 * данных, а не два.
 */
const ASSETS = 'https://www.3dmolier-studio.com/assets/';
for (const id of ids) {
  const r = batch[id];
  if (!r.images && Array.isArray(r.img)) {
    r.images = r.img.map(u => (/^https?:\/\//.test(u) ? u : ASSETS + u));
    delete r.img;
  }
}

// ── проверка целостности до записи ──────────────────────────────────────────
let noImg = 0, noSpec = 0, imgs = 0;
for (const id of ids) {
  const s = batch[id];
  const list = s.images || [];
  if (!list.length) noImg++; else imgs += list.length;
  if (!s.polygons && !s.vertices) noSpec++;
  /*
   * Адрес картинки должен быть публичным. Внутренний /file/get/ отдаёт JSON
   * без сессии и на сайте покажет пустоту - такие не берём.
   */
  const bad = list.filter(u => !/^https:\/\/www\.3dmolier-studio\.com\/assets\//.test(u));
  if (bad.length) {
    console.log('НЕГОДНЫЙ АДРЕС у ' + id + ': ' + bad[0]);
    process.exit(1);
  }
}
console.log('  с картинками: ' + (ids.length - noImg).toLocaleString('ru-RU')
  + ', снимков всего: ' + imgs.toLocaleString('ru-RU')
  + (noImg ? ', БЕЗ картинок: ' + noImg : '')
  + (noSpec ? ', без полигонов: ' + noSpec : ''));

// ── 1. часть выгрузки студии ────────────────────────────────────────────────
let n = 16;
while (fs.existsSync(DL + 'studio-inventory-part-' + n + '.json')) n++;
const partFile = DL + 'studio-inventory-part-' + n + '.json';

// ── 2. строки для new-products.json ─────────────────────────────────────────
const report = JSON.parse(fs.readFileSync(path.join(DATA, 'product-report.json'), 'utf8'));
const byPid = new Map(report.map(r => [String(r.pid).trim(), r]));
const npFile = path.join(DATA, 'new-products.json');
const np = JSON.parse(fs.readFileSync(npFile, 'utf8'));
const known = new Set(np.map(r => String(r.pid).trim()));

const add = [];
let noRow = 0;
for (const id of ids) {
  if (known.has(id)) continue;
  const row = byPid.get(id);
  // Без строки в отчёте у модели нет ни имени, ни цены, ни категории -
  // заводить карточку не из чего.
  if (!row) { noRow++; continue; }
  add.push(row);
}
console.log('в new-products.json добавится: ' + add.length.toLocaleString('ru-RU')
  + (noRow ? ', пропущено без строки в отчёте: ' + noRow : ''));

if (DRY) { console.log('\n(--dry, ничего не записано)'); process.exit(0); }

fs.writeFileSync(partFile, JSON.stringify({ result: batch }));
console.log('записано: ' + partFile);
fs.writeFileSync(npFile, JSON.stringify(np.concat(add)));
console.log('записано: data/new-products.json (' + (np.length + add.length).toLocaleString('ru-RU') + ' строк)');
console.log('\nдальше: node scripts/build-model-records.mjs');
