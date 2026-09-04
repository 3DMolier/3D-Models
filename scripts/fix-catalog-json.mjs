// fix-catalog-json.mjs — приводит data/catalog.json в соответствие с объединениями.
//
// data/catalog.json - отдельный список на 1000 позиций, который питает страницу
// поиска (/search/) и «Top 1000» (/catalog/). Он собирался 31.05 и с тех пор ни
// разу не пересобирался, хотя карточки-варианты с тех пор свели в одну.
// В итоге в поиске «Ford Crown Victoria Police Car» и «…Simple Interior»
// показывались двумя плитками, хотя вторая давно главная, а первая - страница-
// перенаправление. Индекс полного каталога (fc-chunk-*) пересобирался, а этот
// файл - нет, поэтому расхождение и не всплывало.
//
// Что делает:
//   • свёрнутый вариант -> заменяется своей главной карточкой (по карте объединений);
//   • появившиеся дубли схлопываются, остаётся одна запись;
//   • записи без живой карточки выбрасываются.
//
// Запуск:  node scripts/fix-catalog-json.mjs --dry
//          node scripts/fix-catalog-json.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const FILE = path.join(ROOT, 'data', 'catalog.json');
const DRY = process.argv.includes('--dry');

const HEAD = 400;
const buf = Buffer.alloc(HEAD);
function isStub(slug) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, slug, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}

const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
console.log('было записей: ' + rows.length);

// Имя и цену главной берём с её живой карточки, иначе в выдаче осталась бы
// подпись свёрнутого варианта при ссылке на главную.
const titleOf = slug => {
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    return (h.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1]?.trim() || null;
  } catch (e) { return null; }
};

const seen = new Set();
const out = [];
let remapped = 0, deduped = 0, dropped = 0;

for (const r of rows) {
  // Карта бывает цепочкой: вариант -> главная, а та позже сама стала вариантом
  // третьей карточки. Идём до конца цепочки, иначе 8 записей остались бы
  // указывать на страницу-перенаправление.
  // Идём по цепочке до ЖИВОЙ карточки, а не до конца записей. Раньше цикл шёл,
  // пока в карте есть следующий шаг, и на взаимной паре «живая <-> заглушка»
  // останавливался на заглушке — живая карточка вылетала из каталога как свёрнутая.
  // Карту чистит merge-variants.mjs, но проверка нужна и здесь: файл каталога
  // пересобирают и отдельно, между прогонами объединения.
  let slug = r.s;
  const guard = new Set([slug]);
  while (isStub(slug) && map[slug] && !guard.has(map[slug])) { slug = map[slug]; guard.add(slug); }
  if (slug !== r.s) remapped++;
  if (isStub(slug)) { dropped++; continue; }
  if (seen.has(slug)) { deduped++; continue; }
  seen.add(slug);
  const rec = { ...r, s: slug };
  if (slug !== r.s) {
    const t = titleOf(slug);
    if (t) rec.n = t;
    // Превью главной есть не всегда - файлы генерировались под прежний состав
    // каталога. Если его нет, оставляем снимок исходной карточки: он лежит на
    // диске и показывает тот же предмет, иначе в выдаче была бы битая картинка.
    const cand = '/previews/' + slug + '.webp';
    if (fs.existsSync(path.join(ROOT, cand))) rec.img = cand;
  }
  out.push(rec);
}

console.log('переведено на главную: ' + remapped);
console.log('схлопнуто дублей:      ' + deduped);
console.log('выброшено (нет живой): ' + dropped);
console.log('стало записей:         ' + out.length);

const cv = out.filter(x => /crown victoria/i.test(x.n));
console.log('\nCrown Victoria в результате: ' + cv.length);
for (const x of cv) console.log('   ' + x.n + '  ->  ' + x.s);

if (DRY) { console.log('\n(--dry, файл не тронут)'); process.exit(0); }
fs.writeFileSync(FILE, JSON.stringify(out));
console.log('\ndata/catalog.json записан');
