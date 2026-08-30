/*
 * apply-taxonomy.mjs - привести весь сайт к единому источнику категорий.
 *
 * Источник: data/taxonomy.json (имена) и data/model-categories.json (кто где).
 * Отсюда переписываются ВСЕ поверхности, где категория показывается человеку
 * или роботу:
 *
 *   карточка модели   - хлебные крошки, строка Category, кнопка Browse
 *                       Category, поле category в разметке товара, разметка
 *                       хлебных крошек;
 *   списки            - чип под карточкой в сетке;
 *   страница категории- H1, title, og и twitter заголовки;
 *   шапка и подвал    - названия пунктов меню;
 *   каталог           - подписи кнопок фильтра.
 *
 * ПОЧЕМУ ЭТО ВООБЩЕ ПОНАДОБИЛОСЬ. Имя категории хранилось в четырёх местах
 * независимо, и они разошлись у 11 категорий из 26: у `ships` заголовок
 * страницы говорил «Ship & Boat», чип - «Ships»; у `nature-plants` -
 * «Nature & Plant» против «Nature & Plants»; у `architecture-landmarks» меню
 * говорило «Architecture», чип - «Architecture Landmarks» без амперсанда.
 *
 * Запуск:  node scripts/apply-taxonomy.mjs --dry
 *          node scripts/apply-taxonomy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, catBySlug, nameOf, menuNameOf, h1Of, escName, loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const modelCat = loadModelCategories();

// ── 1. карточки моделей ──
let cards = 0, crumbFix = 0, specFix = 0, ldFix = 0, chipFix = 0, ctaFix = 0, textFix = 0;
let aboutFix = 0, moreFix = 0, backFix = 0, phFix = 0;
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const slugOfId = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) slugOfId.set(String(c.i[j]), slugify(c.n[j]) + '-' + c.i[j]);
}

for (const [id, cat] of Object.entries(modelCat)) {
  const dir = slugOfId.get(id);
  if (!dir) continue;
  const file = path.join(ROOT, 'models', dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const nm = escName(nameOf(cat));

  // хлебные крошки
  h = h.replace(/<a href="\/categories\/[a-z0-9-]+\/" class="mp-bc-link">[^<]*<\/a>/,
    () => { crumbFix++; return '<a href="/categories/' + cat + '/" class="mp-bc-link">' + nm + '</a>'; });
  // строка Category в таблице характеристик
  h = h.replace(/(>Category<\/th><td[^>]*>)([\s\S]*?)(<\/td>)/, (x, a, inner, b) => {
    specFix++;
    const rebuilt = inner.replace(/href="\/categories\/[a-z0-9-]+\/"/, 'href="/categories/' + cat + '/"')
      .replace(/>([^<>]+)<\/a>/, '>' + nm + '</a>');
    return a + rebuilt + b;
  });
  // Разметка хлебных крошек. Имя здесь обязано совпадать с ВИДИМЫМ текстом
  // крошки, иначе разметка спорит со страницей. Заголовок страницы категории
  // («Other 3D Models») тут не годится - в крошке написано «Other».
  h = h.replace(/("name":")[^"]*(","item":"https:\/\/3dmolierstudio\.com\/categories\/)[a-z0-9-]+(\/")/,
    (x, a, b, c) => a + nameOf(cat).replace(/"/g, '') + b + cat + c);
  // поле category в разметке товара
  h = h.replace(/("category"\s*:\s*")[^"]*(")/, (x, a, b) => { ldFix++; return a + nameOf(cat).replace(/"/g, '') + b; });

  // Чип категории над названием. Он тоже ссылка на /categories/, и тоже отставал:
  // у прожектора крошка говорила «Lighting», а чип - «Other».
  h = h.replace(/<a href="\/categories\/[a-z0-9-]+\/" class="(chip[^"]*)">[^<]*<\/a>/,
    (x, cls) => { chipFix++; return '<a href="/categories/' + cat + '/" class="' + cls + '">' + nm + '</a>'; });

  // Кнопка «Browse … Models». Вела в СТАРУЮ категорию: на карточке пробкового
  // шлема сверху стояло «Clothing & Accessories», а кнопка предлагала
  // «Browse Weapons Models».
  // Пробелы и переносы внутри кнопки сохраняем: если их схлопнуть, «изменятся»
  // все 54 тысячи карточек, и настоящие правки утонут в этой пустой разнице.
  h = h.replace(/(<a href=")\/categories\/[a-z0-9-]+\/("[^>]*>\s*Browse )[^<]*?( Models\s*<\/a>)/,
    (x, a, b, c) => { ctaFix++; return a + '/categories/' + cat + '/' + b + nm + c; });

  // Название категории в тексте описания и в вопросах. Здесь оно не ссылка, а
  // просто слово, и рассинхрон читается особенно грубо: «is one of the Vehicles
  // models» на странице светильника.
  h = h.replace(/(is one of the )([A-Za-z][A-Za-z&; ]{1,40}?)( models in the 3D Molier catalogue)/,
    (x, a, cur, b) => { if (cur.trim() !== nm) textFix++; return a + nm + b; });
  h = h.replace(/(Browsing the )([A-Za-z][A-Za-z&; ]{1,40}?)( category shows)/,
    (x, a, cur, b) => { if (cur.trim() !== nm) textFix++; return a + nm + b; });

  /*
   * Ещё три места, где категория жила отдельной жизнью. Их пропустили в первый
   * заход, и на 32 448 карточках - 60% каталога - они противоречили чипу и
   * строке Specifications. Например у Grey Teddy Bear чип и характеристики
   * говорили Toys & Games, а эти три - Animals & Creatures.
   *   about в разметке ItemPage - то, чем страница объявляет себя поисковику;
   *   «More in …»               - подпись над блоком похожих;
   *   «← All … Models»          - ссылка назад в категорию.
   */
  h = h.replace(/("about":\{"@type":"Thing","name":")[^"]*(")/,
    (x, a, b) => { aboutFix++; return a + nameOf(cat).replace(/"/g, '') + b; });
  h = h.replace(/(<div class="section-label mp-mb8">More in )[^<]*(<\/div>)/,
    (x, a, b) => { moreFix++; return a + nm + b; });
  h = h.replace(/(<a href=")\/categories\/[a-z0-9-]+\/("[^>]*>\s*(?:&#8592;|&larr;|←)\s*All )[^<]*?( Models\s*<\/a>)/,
    (x, a, b, c) => { backFix++; return a + '/categories/' + cat + '/' + b + nm + c; });
  // Подпись под главной картинкой - её видно, если картинка не загрузилась.
  // На карточке Grey Teddy Bear там стояло «Animals & Creatures» при категории
  // Toys & Games: место редкое, но человек попадает на него именно тогда, когда
  // и без того видит пустой прямоугольник.
  h = h.replace(/(<span class="mp-placeholder-cat">)[^<]*(<\/span>)/g,
    (x, a, b) => { phFix++; return a + nm + b; });

  if (h !== before) { cards++; if (!DRY) fs.writeFileSync(file, h); }
}
console.log('карточек приведено к источнику: ' + cards
  + ' (крошек ' + crumbFix + ', строк Category ' + specFix + ', полей в разметке ' + ldFix
  + ', чипов ' + chipFix + ', кнопок Browse ' + ctaFix + ', упоминаний в тексте ' + textFix
  + ', about ' + aboutFix + ', «More in» ' + moreFix + ', ссылок назад ' + backFix
  + ', подписей под картинкой ' + phFix + ')');

// ── 2. чипы в сетках и заголовки страниц категорий ──
// Чип показывает категорию ТОЙ модели, на которую ведёт ссылка, поэтому
// разбираем каждую карточку в сетке отдельно, а не заменяем текст скопом.
let gridPages = 0, chips = 0, heads = 0;
const pages = [];
(function walk(rel, d) {
  if (d > 5) return;
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === 'models' || it.name === 'partials' || it.name.startsWith('.')) continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) walk(nx, d + 1);
    else if (it.name === 'index.html') pages.push(nx);
  }
})('', 0);

const idOfSlug = new Map();
for (const [id, dir] of slugOfId) idOfSlug.set(dir, id);

for (const rel of pages) {
  const file = path.join(ROOT, rel);
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  const before = h;

  h = h.replace(/(<a href="\/models\/([a-z0-9-]+)\/" class="model-card card-glow">[\s\S]*?<span class="chip mc-chip">)([^<]*)(<\/span>)/g,
    (x, head, dir, cur, tail) => {
      const id = idOfSlug.get(cp(dir));
      const cat = id ? modelCat[id] : null;
      if (!cat) return x;
      const want = escName(nameOf(cat));
      if (cur === want) return x;
      chips++;
      return head + want + tail;
    });

  // заголовок страницы категории и всё, что его повторяет
  const m = rel.match(/^categories\/([a-z0-9-]+)\/(?:page\/\d+\/)?index\.html$/);
  if (m && catBySlug(m[1])) {
    const slug = m[1], want = escName(h1Of(slug));
    const pageNo = (rel.match(/\/page\/(\d+)\//) || [])[1];
    h = h.replace(/(<h1 class="cat-page-h1">)[\s\S]*?(<\/h1>)/, (x, a, b) => { heads++; return a + want + b; });
    h = h.replace(/(<div class="section-label">)[\s\S]*?(<\/div>)/, (x, a, b) => a + escName(nameOf(slug)) + b);
    const title = (pageNo ? want + ' - Page ' + pageNo : want) + ' | 3D Molier';
    h = h.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + title + '</title>');
    for (const attr of ['property="og:title"', 'name="twitter:title"']) {
      const re = new RegExp('(<meta ' + attr + ' content=")[^"]*(")');
      if (re.test(h)) h = h.replace(re, (x, a, b) => a + title + b);
    }
  }

  if (h !== before) { gridPages++; if (!DRY) fs.writeFileSync(file, h); }
}
console.log('страниц со списками и заголовками: ' + gridPages + ' (чипов ' + chips + ', заголовков ' + heads + ')');

// ── 3. шапка и подвал ──
let chromeFix = 0;
for (const f of ['partials/header.html', 'partials/footer.html']) {
  const file = path.join(ROOT, f);
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const isMenu = f.endsWith('header.html');
  for (const c of CATEGORIES) {
    const want = escName(isMenu ? menuNameOf(c.slug) : nameOf(c.slug));
    // подпись пункта меню: <a href="/categories/<slug>/" ...><span class="mega-name">Имя</span>
    h = h.replace(new RegExp('(href="/categories/' + c.slug + '/"[^>]*>(?:<span class="mega-name">)?)([^<]+)'),
      (x, a, cur) => (cur.trim() === want ? x : (chromeFix++, a + want)));
  }
  if (h !== before && !DRY) fs.writeFileSync(file, h);
}
console.log('подписей в шапке и подвале поправлено: ' + chromeFix);

// ── 4. кнопки фильтра каталога ──
{
  const file = path.join(ROOT, 'catalog', 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  let n = 0;
  for (const c of CATEGORIES) {
    h = h.replace(new RegExp('(<button class="ftag" data-cat="' + c.slug + '">)([^<]*)(</button>)'),
      (x, a, cur, b) => {
        const want = escName(nameOf(c.slug));
        return cur === want ? x : (n++, a + want + b);
      });
  }
  if (h !== before && !DRY) fs.writeFileSync(file, h);
  console.log('подписей кнопок фильтра поправлено: ' + n);
}

if (DRY) console.log('\n(--dry, ничего не записано)');
