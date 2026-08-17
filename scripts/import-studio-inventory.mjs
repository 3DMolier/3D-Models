// import-studio-inventory.mjs — приём данных, собранных из нашего inventory.
//
// Пара к scripts/studio-inventory-collect.js. Тот работает в браузере (за
// логином) и выгружает studio-inventory.json; этот раскладывает выгрузку по
// файлам сайта.
//
// Что кладём:
//   data/new-previews.json  — pid -> адрес картинки. Формат уже используется
//                             сборкой карточек, поэтому дописываемся в него.
//   data/model-specs.json   — pid -> техданные: полигоны, вершины, геометрия,
//                             оснастка, анимация, UV, число и размеры текстур,
//                             габариты. Этого у нас не было вообще.
//
// Картинки НЕ скачиваем: адрес вида
//   https://www.3dmolier-studio.com/assets/<asset>/<file>_<Имя>.jpg
// открывается без авторизации, проверено. А /file/get/<id>/ без сессии отдаёт
// JSON, и на сайт его ставить нельзя.
//
// Запуск:  node scripts/import-studio-inventory.mjs <путь к studio-inventory.json> [--dry]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const SRC = process.argv[2];
const DRY = process.argv.includes('--dry');

if (!SRC || !fs.existsSync(SRC)) {
  console.log('нужен путь к studio-inventory.json');
  console.log('пример: node scripts/import-studio-inventory.mjs "C:/Users/MSI-PC/Downloads/studio-inventory.json"');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const result = dump.result || {};
const ids = Object.keys(result);
console.log('в выгрузке: ' + ids.length + ' моделей, не найдено в инвентаре: '
  + (dump.missing || []).length + ', ошибок: ' + (dump.failed || []).length);

// ── превью ──
const PREV = path.join(DATA, 'new-previews.json');
const prev = fs.existsSync(PREV) ? JSON.parse(fs.readFileSync(PREV, 'utf8')) : {};
const before = Object.keys(prev).length;

// Первым кадром берём тот, чьё имя кончается на _001/_000 — у студии это
// главный ракурс. Если такого нет, берём первый по списку.
function pickMain(images) {
  if (!images || !images.length) return null;
  const byMain = images.find(u => /_0*0?1\.(jpg|jpeg|png)$/i.test(u))
    || images.find(u => /_0*0\.(jpg|jpeg|png)$/i.test(u));
  return byMain || images[0];
}

let added = 0, already = 0, noImg = 0;
for (const id of ids) {
  const rec = result[id];
  const main = pickMain(rec.images);
  if (!main) { noImg++; continue; }
  if (prev[id]) { already++; continue; }
  prev[id] = main;
  added++;
}

// ── техданные ──
const SPECS = path.join(DATA, 'model-specs.json');
const specs = fs.existsSync(SPECS) ? JSON.parse(fs.readFileSync(SPECS, 'utf8')) : {};
const specsBefore = Object.keys(specs).length;

const num = v => {
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
// Габариты и размеры текстур студия пишет одной строкой details, вида
//   «- 14 png (4096x4096)\n- Dimensions 42,82 x 16,63 x H27,04m»
const parseDetails = d => {
  const s = String(d || '');
  const tex = [...s.matchAll(/(\d{2,5})\s*[xх×]\s*(\d{2,5})/gi)].map(m => m[1] + 'x' + m[2]);
  let dim = (s.match(/Dimensions?\s+([^\n]+)/i) || [])[1];
  // Студия пишет дробную часть через запятую («42,82 x 16,63 x H27,04m»).
  // Страница английская, там разделитель — точка, иначе число читается как
  // перечисление. Пробел перед единицей ставим тоже.
  if (dim) {
    dim = dim.trim()
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/([\d.])\s*([a-z]{1,2})\b/gi, '$1 $2')
      .replace(/\s{2,}/g, ' ');
  }
  return { textureSizes: [...new Set(tex)], dimensions: dim || null };
};

let specAdded = 0;
for (const id of ids) {
  const r = result[id];
  const det = parseDetails(r.details);
  const rec = {
    title: r.title || null,
    polygons: num(r.polygons),
    vertices: num(r.vertices),
    geometry: r.geometry || null,
    rigged: r.rigged || null,
    animated: r.animated || null,
    unwrappedUVs: r.unwrapped_uvs || null,
    textures: num(r.ntextures),
    textureSizes: det.textureSizes,
    dimensions: det.dimensions,
    images: (r.images || []).length,
  };
  // пустые поля не храним — файл и так будет крупным
  for (const k of Object.keys(rec)) {
    const v = rec[k];
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) delete rec[k];
  }
  if (Object.keys(rec).length <= 1) continue;
  if (!specs[id]) specAdded++;
  specs[id] = rec;
}

if (!DRY) {
  fs.writeFileSync(PREV, JSON.stringify(prev, null, 1));
  fs.writeFileSync(SPECS, JSON.stringify(specs, null, 1));
}

console.log('\nпревью: было ' + before + ', добавлено ' + added
  + ', уже были ' + already + ', без картинок ' + noImg + ', стало ' + Object.keys(prev).length);
console.log('техданные: было ' + specsBefore + ', добавлено ' + specAdded + ', стало ' + Object.keys(specs).length);

// краткая сводка по полноте
const withPoly = ids.filter(i => result[i].polygons).length;
const withTex = ids.filter(i => parseDetails(result[i].details).textureSizes.length).length;
const withDim = ids.filter(i => parseDetails(result[i].details).dimensions).length;
const imgs = ids.reduce((s, i) => s + (result[i].images || []).length, 0);
console.log('\nполнота: полигоны у ' + withPoly + ', размеры текстур у ' + withTex
  + ', габариты у ' + withDim + ', адресов картинок всего ' + imgs);
if (DRY) console.log('\n(--dry, ничего не записано)');
