/*
 * fill-missing-catalog-images.mjs - вернуть картинки плиткам в каталоге.
 *
 * Что было. В каталоге и в поиске часть моделей показывалась серой заглушкой
 * с иконкой. Причина не в карточках - там картинки на месте: модель есть в
 * fc-chunk (список), но её нет в fc-img-chunk (картинки). Эти два набора
 * собирались в разное время, и модели, добавленные позже, остались без
 * изображения.
 *
 * Откуда берём. С самой карточки модели: там лежит рабочий адрес снимка,
 * обычно на студийном сервере. Каталог такие адреса пропускает через
 * images.weserv.nl, который отдаёт их в WebP - проверено, 668 КБ превращаются
 * в 51 КБ.
 *
 * Сеть не нужна: всё берётся из файлов сайта.
 *
 * Запуск:
 *   node fill-missing-catalog-images.mjs --dry
 *   node fill-missing-catalog-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

// Какие модели вообще есть в каталоге.
const inCatalog = new Map();
for (let i = 0; i < 6; i++) {
  const f = path.join(DATA, 'fc-chunk-' + i + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.i.forEach((id, k) => inCatalog.set(String(id), d.n[k]));
}

// У каких уже есть картинка.
const imgFiles = [];
for (let i = 0; i < 18; i++) {
  const f = path.join(DATA, 'fc-img-chunk-' + i + '.json');
  if (fs.existsSync(f)) imgFiles.push(f);
}
const haveImg = new Set();
for (const f of imgFiles) Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))).forEach(id => haveImg.add(id));

const missing = [...inCatalog.keys()].filter(id => !haveImg.has(id));
console.log('моделей в каталоге:        ' + inCatalog.size);
console.log('из них с картинкой:        ' + [...inCatalog.keys()].filter(id => haveImg.has(id)).length);
console.log('без картинки:              ' + missing.length);

// Идентификатор -> слаг живой карточки.
const merged = JSON.parse(fs.readFileSync(path.join(DATA, 'merged-variants.json'), 'utf8'));
const slugById = new Map();
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  const m = slug.match(/-(\d{5,})$/);
  if (m && !slugById.has(m[1])) slugById.set(m[1], merged[slug] || slug);
}

const found = {};
let noCard = 0, noImg = 0, expiring = 0;
for (const id of missing) {
  const slug = slugById.get(id);
  if (!slug) { noCard++; continue; }
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) { noCard++; continue; }
  const h = fs.readFileSync(file, 'utf8');
  const hero = (h.match(/<div class="hero-img-frame mp-hero-frame">\s*<img src="([^"]+)"/) || [])[1];
  if (!hero) { noImg++; continue; }
  // Подписанные ссылки живут час - записывать их в данные бессмысленно.
  if (/X-Amz-Signature|[?&]signature=/.test(hero)) { expiring++; continue; }
  found[id] = hero;
}

console.log('\nнашли картинку на карточке: ' + Object.keys(found).length);
console.log('  карточки нет:             ' + noCard);
console.log('  картинки на карточке нет: ' + noImg);
console.log('  ссылка с истекающим сроком (пропускаем): ' + expiring);

const hosts = {};
Object.values(found).forEach(u => { const d = u.replace(/^https?:\/\//, '').split('/')[0]; hosts[d] = (hosts[d] || 0) + 1; });
console.log('\nоткуда картинки: ' + Object.entries(hosts).map(([k, v]) => k + ' - ' + v).join(', '));

if (!Object.keys(found).length) { console.log('\nнечего добавлять'); process.exit(0); }

// Дописываем в последний кусок: он самый свежий и обычно неполный.
const last = imgFiles[imgFiles.length - 1];
const d = JSON.parse(fs.readFileSync(last, 'utf8'));
const before = Object.keys(d).length;
Object.assign(d, found);
if (!DRY) fs.writeFileSync(last, JSON.stringify(d));
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН' : 'записано') + ': ' + path.basename(last)
  + '  ' + before + ' -> ' + Object.keys(d).length + ' записей');
