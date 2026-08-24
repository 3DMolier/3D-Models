/*
 * fix-gallery-order.mjs - показывать сначала красивые кадры, потом технические.
 *
 * Что не так. В галерее первыми стоят кадры с номерами 1001, 1002, 1003 - это
 * технические ракурсы: сетка, глина, развёртка. Человек открывает карточку и
 * первым делом видит проволочную модель вместо снимка вещи. Остальные кадры
 * идут вразнобой: 004, 006, 009, 008, 007, 003, 002, 001, 005.
 *
 * Как надо. Сначала презентационные кадры по возрастанию номера, потом
 * технические - тоже по возрастанию. Номер 000 - квадратный дубль первого
 * кадра, его отправляем к техническим: на витрине он лишний.
 *
 * Первый кадр становится главной картинкой карточки и попадает в разметку и в
 * мета-теги - иначе в выдаче и в соцсетях останется прежний технический.
 *
 * Запуск:
 *   node fix-gallery-order.mjs --dry [--limit N]
 *   node fix-gallery-order.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;

// Номер кадра из имени файла. Правило выведено из данных: всего 45 833 кадра,
// из них 36 594 с номерами 001-099 - это съёмка, 3 020 с номерами 1000-1099 -
// технические ракурсы, 6 105 с номером 000 - квадратные дубли первого кадра.
// Номера 1100 и выше (13 штук) техническими НЕ считаем: это цифры внутри
// названия модели - corvette201502, ciscoipphone784100.
function frameRank(url) {
  const file = String(url).split('/').pop().split('?')[0];
  const m = file.match(/(\d{1,4})\.(jpe?g|png|webp)$/i);
  const isPng = /\.png$/i.test(file);
  if (!m) return { group: 1, num: 0 };            // без номера - после нумерованных
  const num = +m[1];
  if (isPng || (num >= 1000 && num <= 1099)) return { group: 3, num };  // технические - в конец
  if (num === 0) return { group: 2, num };        // квадратный дубль - перед техническими
  return { group: 0, num };                       // съёмка
}

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVar = new Set(Object.keys(merged));
let slugs = fs.readdirSync(path.join(ROOT, 'models')).filter(d => !isVar.has(d)).sort();
if (LIMIT) slugs = slugs.slice(0, LIMIT);

const THUMB = /<button type="button" class="mp-gal-thumb[^"]*"[\s\S]*?<\/button>/g;
const stat = { live: 0, withGallery: 0, reordered: 0, alreadyOk: 0, heroChanged: 0, deduped: 0 };

for (const slug of slugs) {
  const file = path.join(ROOT, 'models', slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(html)) continue;
  stat.live++;

  const strip = html.match(/<div class="mp-gal-strip">([\s\S]*?)<\/div>\s*<\/div>/);
  if (!strip) continue;
  const buttons = strip[1].match(THUMB);
  if (!buttons || buttons.length < 2) continue;
  stat.withGallery++;

  // Один и тот же кадр встречался дважды на 1 271 карточке - убираем повтор.
  const seenUrl = new Set();
  const items = [];
  for (const b of buttons) {
    const url = (b.match(/data-full="([^"]+)"/) || [])[1] || '';
    if (url && seenUrl.has(url)) continue;
    seenUrl.add(url);
    items.push({ b, url, ...frameRank(url) });
  }
  const deduped = items.length !== buttons.length;

  // Устойчивая сортировка: съёмка, дубли, технические; внутри - по номеру.
  const sorted = items.slice().sort((a, b) => (a.group - b.group) || (a.num - b.num));
  if (!deduped && sorted.every((x, i) => x === items[i])) { stat.alreadyOk++; continue; }

  // Пересобираем полосу: подписи «View N of M» тоже должны идти по порядку.
  const total = sorted.length;
  const rebuilt = sorted.map((x, i) => {
    let b = x.b;
    b = b.replace(/class="mp-gal-thumb[^"]*"/, () => 'class="mp-gal-thumb' + (i === 0 ? ' is-on' : '') + '"');
    b = b.replace(/aria-label="View \d+ of \d+"/, () => 'aria-label="View ' + (i + 1) + ' of ' + total + '"');
    b = b.replace(/alt="([^"]*?) - view \d+"/, (m, name) => 'alt="' + name + ' - view ' + (i + 1) + '"');
    return b;
  }).join('');

  html = html.replace(strip[1], () => rebuilt);

  // Главная картинка - первый кадр после сортировки.
  const oldHero = (html.match(/<div class="hero-img-frame mp-hero-frame">\s*<img src="([^"]+)"/) || [])[1];
  const newHero = sorted[0].url;
  if (oldHero && newHero && oldHero !== newHero) {
    html = html.replace(oldHero, () => newHero);          // в самой картинке
    // og:image и twitter:image ссылались на прежний кадр.
    html = html.split(oldHero).join(newHero);
    stat.heroChanged++;
  }

  if (deduped) stat.deduped++;
  if (!DRY) fs.writeFileSync(file, html);
  stat.reordered++;
  if (stat.reordered % 5000 === 0) console.log('  ' + stat.reordered + '...');
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('живых карточек:        ' + stat.live);
console.log('с галереей:            ' + stat.withGallery);
console.log('  порядок исправлен:   ' + stat.reordered);
console.log('  главная картинка изменилась: ' + stat.heroChanged);
console.log('  убраны дубли кадров: ' + stat.deduped);
console.log('  уже было верно:      ' + stat.alreadyOk);
