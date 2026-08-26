/*
 * add-img-chunk-map.mjs - в каком чанке лежит картинка каждой модели.
 *
 * ЗАЧЕМ. Картинки каталога разложены по 18 файлам fc-img-chunk-*.json общим
 * весом 19 МБ. Поиск грузил только первые шесть - в скрипте стояла константа
 * FC_IMG_CHUNKS=6 с пометкой «в чанках 0-5 реальные данные». Когда-то это
 * было правдой; каталог с тех пор вырос до 18 чанков, и у большинства
 * результатов поиска картинка просто не находилась - человек видел пустую
 * рамку. Загрузить все 18 нельзя: 19 МБ на телефоне неприемлемо.
 *
 * ПОЧЕМУ НЕ ПРОСТО «ВЫЧИСЛИТЬ НУЖНЫЙ ЧАНК». Первое, что приходит в голову -
 * чанки идут диапазонами номеров, значит нужный ищется двоичным поиском.
 * Проверено: не идут. Диапазоны перекрываются полностью, chunk0 это
 * 893043..2460244, chunk1 - 895566..2501236. Номера разбросаны.
 *
 * ЧТО ДЕЛАЕМ. Кладём номер картиночного чанка рядом с самой моделью - новой
 * колонкой ic в fc-chunk-*.json. Эти файлы поиск и каталог и так загружают
 * целиком, так что ни одного лишнего запроса не появляется, а прибавка около
 * 110 КБ на все 54 тысячи моделей. Дальше клиент грузит ровно те картиночные
 * чанки, которые нужны показанным сейчас карточкам.
 *
 * Запуск:  node scripts/add-img-chunk-map.mjs --dry
 *          node scripts/add-img-chunk-map.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website/data';
const DRY = process.argv.includes('--dry');

const imgIdx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-img-index.json'), 'utf8'));
const where = new Map();
for (let k = 0; k < imgIdx.chunks; k++) {
  const file = path.join(DATA, 'fc-img-chunk-' + k + '.json');
  if (!fs.existsSync(file)) { console.log('нет ' + file); continue; }
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const id of Object.keys(c)) where.set(id, k);
}
console.log('картинок в индексе: ' + where.size + ' в ' + imgIdx.chunks + ' чанках');

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
let have = 0, none = 0;
const perChunk = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const file = path.join(DATA, 'fc-chunk-' + k + '.json');
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ic = new Array(c.i.length);
  for (let j = 0; j < c.i.length; j++) {
    const w = where.get(String(c.i[j]));
    ic[j] = w === undefined ? -1 : w;
    if (w === undefined) none++; else { have++; perChunk.set(w, (perChunk.get(w) || 0) + 1); }
  }
  c.ic = ic;
  if (!DRY) fs.writeFileSync(file, JSON.stringify(c));
}
idx.keys = ['i', 'n', 'p', 's', 'c', 'g', 'ic'];
idx.imgChunks = imgIdx.chunks;
if (!DRY) fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx, null, 1));

console.log('моделей каталога с картинкой: ' + have + ', без картинки: ' + none);
console.log('сколько моделей каталога приходится на каждый картиночный чанк:');
for (const [k, n] of [...perChunk.entries()].sort((a, b) => a[0] - b[0]))
  console.log('  chunk' + String(k).padStart(2) + '  ' + n);
if (DRY) console.log('\n(--dry, ничего не записано)');
