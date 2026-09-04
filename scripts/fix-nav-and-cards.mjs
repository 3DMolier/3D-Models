/*
 * fix-nav-and-cards.mjs - правки по пунктам 10, 12, 16, 17, 18 списка.
 *
 * 12. ГЛАВНАЯ НЕ ССЫЛАЛАСЬ НИ НА ОДНУ СВОЮ КАРТОЧКУ. Проверка: 16 ссылок
 *     наружу, на TurboSquid, и ноль на /models/. Блок «Best sellers» уводил
 *     человека с сайта первым же кликом - при том, что своя страница есть у
 *     каждой из 54 079 моделей и это самая сильная часть сайта для поиска.
 *     Номер модели есть прямо в адресе TurboSquid, по нему и находим свою
 *     карточку. Путь к покупке не теряется: на карточке кнопка «View on
 *     TurboSquid» стоит первой.
 *
 * 17. SEARCH В ГЛАВНОМ МЕНЮ. Рядом стоят «Catalog» и «Search», а каталог и так
 *     с поиском. Убираем «Search» из шапки. Сама страница /search/ остаётся -
 *     на неё ведут ссылки из подвала и с других страниц.
 *
 * 16. «VIEW ALL CATEGORIES» в меню категорий. Меню на 26 пунктов в три
 *     колонки уже есть, но выхода на сам раздел /categories/ из него не было.
 *
 * 18. ХЛЕБНЫЕ КРОШКИ. На страницах категорий шаг «Categories» вёл на
 *     /catalog/. Раздел /categories/ существует, и вести надо туда: иначе
 *     дорожка обещает одно, а приводит в другое место.
 *
 * 10. КАРТОЧКА В СПИСКЕ ЧИТАЛАСЬ КАК «Vehicles Tesla Model 3 Vehicles $149».
 *     Название категории попадало в текст дважды: один раз как подпись
 *     заглушки под картинкой, второй - как чип внизу. Заглушка декоративная,
 *     закрываем её от читалок экрана aria-hidden. Вид не меняется.
 *
 * Запуск:  node scripts/fix-nav-and-cards.mjs --dry
 *          node scripts/fix-nav-and-cards.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);

// ── карта: номер модели -> адрес нашей карточки ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
const localOf = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) localOf.set(String(c.i[j]), '/models/' + slugify(c.n[j]) + '-' + c.i[j] + '/');
}

const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name.startsWith('.')) continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) walk(nx);
    else if (it.name === 'index.html') pages.push(nx);
  }
})('');

let p12 = 0, l12 = 0, p17 = 0, p16 = 0, p18 = 0, p10 = 0, l10 = 0, noLocal = 0;

// ── 12: плитки главной на свои карточки ──
// Только там, где плитка ведёт на конкретный товар TurboSquid. Ссылки на
// магазин целиком (Search/Artists) трогать нельзя - у них нет своей страницы.
const tileRe = /href="https:\/\/www\.turbosquid\.com\/3d-models\/[a-z0-9-]*?-(\d{5,})\?referral=[^"]*"([^>]*?)class="tile/g;
for (const rel of ['index.html', 'preview/home/index.html']) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  let n = 0;
  h = h.replace(tileRe, (m, id, mid) => {
    const loc = localOf.get(id);
    if (!loc) { noLocal++; return m; }
    n++;
    // target и rel убираем: своя страница открывается в той же вкладке.
    const cleaned = String(mid).replace(/\s*target="_blank"/, '').replace(/\s*rel="noopener"/, '');
    return 'href="' + loc + '"' + cleaned + 'class="tile';
  });
  if (h !== before) { p12++; l12 += n; if (!DRY) fs.writeFileSync(file, h); }
}

// ── 17 и 16: шапка ──
{
  const file = path.join(ROOT, 'partials', 'header.html');
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  // Search уходит из шапки. Формы записи две: с классом и без.
  h = h.replace(/<a href="\/search\/"[^>]*>\s*Search\s*<\/a>/g, '');
  // Выход на раздел категорий последним пунктом меню категорий.
  if (!/nav-categories-menu[\s\S]{0,4000}?href="\/categories\/"/.test(h)) {
    h = h.replace(/(<div class="nav-dropdown nav-mega" id="nav-categories-menu"[^>]*>)([\s\S]*?)(<\/div>)/,
      (m, a, inner, b) => a + inner
        + '<a href="/categories/" role="menuitem" class="mega-item mega-item--all"><span class="mega-name">View all categories &#8594;</span></a>' + b);
  }
  if (h !== before) { p16 = 1; p17 = 1; if (!DRY) fs.writeFileSync(file, h); }
}

// ── 18 и 10: по всем страницам ──
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  const before = h;

  // 18: шаг «Categories» в дорожке ведёт в раздел категорий, а не в каталог.
  h = h.replace(/href="\/catalog\/"( class="bc-link")>Categories</g, (m, cls) => 'href="/categories/"' + cls + '>Categories<');
  // и то же в разметке дорожки
  h = h.replace(/("name":"Categories","item":")https:\/\/3dmolierstudio\.com\/catalog\/(")/g,
    (m, a, b) => a + 'https://3dmolierstudio.com/categories/' + b);
  if (h !== before) p18++;

  // 10: подпись заглушки не должна читаться как второе название категории.
  const mid = h;
  const n10 = (h.match(/<div class="img-placeholder">/g) || []).length;
  if (n10) {
    h = h.split('<div class="img-placeholder">').join('<div class="img-placeholder" aria-hidden="true">');
    if (h !== mid) { p10++; l10 += n10; }
  }

  if (h !== before && !DRY) fs.writeFileSync(file, h);
}

console.log('12. плиток главной переведено на свои карточки: ' + l12 + ' на ' + p12 + ' стр.'
  + (noLocal ? ', без своей карточки: ' + noLocal : ''));
console.log('17. Search убран из шапки: ' + (p17 ? 'да' : 'нет'));
console.log('16. «View all categories» в меню: ' + (p16 ? 'да' : 'нет'));
console.log('18. дорожка «Categories» -> /categories/: ' + p18 + ' стр.');
console.log('10. заглушек закрыто от читалок: ' + l10 + ' на ' + p10 + ' стр.');
if (DRY) console.log('(--dry, ничего не записано)');
