// refresh-sitemaps.mjs - пересборка сайтмапов по РЕАЛЬНЫМ файлам на диске (не по каталогу fc-chunk,
// он отстаёт). Идемпотентно, можно гонять после каждого обновления сайта.
//
// Что делает:
//   1. models-1.xml / models-2.xml  - из фактических папок models/*/ (сплит по 50 000)
//   2. sitemap-categories.xml       - из фактических папок categories/*/ (все 25)
//   3. остальным страничным сайтмапам обновляет <lastmod> на сегодня
//      (image-sitemap-* не трогает - картинки не менялись)
//   4. удаляет пустые сайтмапы и выкидывает их из индекса
//   5. пересобирает sitemap-index.xml и корневой sitemap.xml
//
// Запуск: node scripts/refresh-sitemaps.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SM = path.join(ROOT, 'sitemaps');
const BASE = 'https://3dmolierstudio.com';
const TODAY = new Date().toISOString().slice(0, 10);
const LIMIT = 50000;

const dirsWithIndex = sub => fs.readdirSync(path.join(ROOT, sub), { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, sub, d.name, 'index.html')))
  .map(d => d.name).sort();

const urlEntry = (loc, cf, pr) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pr}</priority>\n  </url>`;

const writeUrlset = (file, entries) => {
  fs.writeFileSync(path.join(SM, file),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`, 'utf8');
  console.log(`  ${file}: ${entries.length} URL`);
};

// Страница-перенаправление, оставленная на месте свёрнутой карточки.
const isRedirectStub = p => {
  try { return /http-equiv="refresh"/i.test(fs.readFileSync(p, 'utf8').slice(0, 400)); }
  catch { return false; }
};

// Страница, закрытая от индексации. Звать на неё обход сайтмапом - противоречие:
// карта говорит «индексируй», мета-тег говорит «не индексируй». Поисковик такие
// расхождения запоминает, а мы теряем доверие ко всей карте.
const isNoindex = p => {
  try {
    const h = fs.readFileSync(p, 'utf8');
    const m = h.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);
    return !!m && /noindex/i.test(m[1]);
  } catch { return false; }
};

// ---- 1. модели ----
// Заглушки в сайтмап НЕ идут. Фильтр стоял только на коллекциях и отраслях, а
// моделей после объединений свёрнуто 28 391 из 86 914 — и мы сами звали обход на
// каждый старый адрес. Для Google это заявка «страница жива, индексируй»: дубли
// держались в выдаче именно поэтому, при том что на самой странице стоит canonical
// на главную карточку. В сайтмапе должны быть только живые карточки.
const allModelDirs = dirsWithIndex('models');
const models = allModelDirs.filter(s => !isRedirectStub(path.join(ROOT, 'models', s, 'index.html')));
const mEntries = models.map(s => urlEntry(`${BASE}/models/${s}/`, 'monthly', '0.7'));
console.log(`Модели на диске: ${allModelDirs.length}, из них живых: ${models.length}`
  + `, заглушек не включено: ${allModelDirs.length - models.length}`);
writeUrlset('sitemap-models-1.xml', mEntries.slice(0, LIMIT));
writeUrlset('sitemap-models-2.xml', mEntries.slice(LIMIT));

// ---- 2. категории (страница 1 каждой) ----
// Отбор как у коллекций и отраслей: без заглушек и без закрытых от индексации.
// 26.08.2026 в карту попадала categories/weapons-tools/ - страница-указатель на
// две новых категории, помеченная noindex. Плюс сам корень раздела /categories/
// в карте не значился, хотя страница появилась: та же дыра, что была у
// /industries/ и которую нашёл Ahrefs.
const allCats = dirsWithIndex('categories');
const cats = allCats.filter(c => {
  const p = path.join(ROOT, 'categories', c, 'index.html');
  return !isRedirectStub(p) && !isNoindex(p);
});
console.log(`Категории на диске: ${allCats.length}, в карту идут: ${cats.length}`);
{
  const entries = [];
  if (fs.existsSync(path.join(ROOT, 'categories', 'index.html'))) {
    entries.push(urlEntry(`${BASE}/categories/`, 'weekly', '0.9'));
  } else {
    console.log('  categories/: корневой страницы нет, в сайтмап не добавляю');
  }
  entries.push(...cats.map(c => urlEntry(`${BASE}/categories/${c}/`, 'weekly', '0.9')));
  writeUrlset('sitemap-categories.xml', entries);
}

// ---- 2а. коллекции и отрасли — тоже из фактических папок ----
// Раньше этим двум файлам правилась только дата, а список URL оставался прежним.
// 06.08.2026 после удаления 23 коллекций-дублей в сайтмапе остались все 20 адресов,
// из которых 17 отдавали 404. Теперь список собирается с диска, как у категорий.
// Страницы-перенаправления в сайтмап не попадают: у 19 старых подборок
// (/collections/best-vehicle-3d-models/ и т.п.) на месте остался только meta
// refresh на новую тему, и звать туда обход незачем. Сама проверка объявлена выше:
// теперь через неё проходят и модели.
for (const [dir, file, freq, prio] of [
  ['collections', 'sitemap-collections.xml', 'weekly', '0.7'],
  ['industries', 'sitemap-industries.xml', 'monthly', '0.6'],
]) {
  const items = dirsWithIndex(dir).filter(x => {
    const p = path.join(ROOT, dir, x, 'index.html');
    return !isRedirectStub(p) && !isNoindex(p);
  });
  // Корень раздела добавляем только если страница действительно есть. У
  // /collections/ она есть, у /industries/ - нет, и до августа 2026 карта звала
  // обход на 404: Ahrefs его там и нашёл.
  const entries = [];
  if (fs.existsSync(path.join(ROOT, dir, 'index.html'))) {
    entries.push(urlEntry(`${BASE}/${dir}/`, freq, prio));
  } else {
    console.log('  ' + dir + '/: корневой страницы нет, в сайтмап не добавляю');
  }
  for (const x of items) {
    entries.push(urlEntry(`${BASE}/${dir}/${x}/`, freq, prio));
    // страницы пагинации темы, если они есть
    const pageDir = path.join(ROOT, dir, x, 'page');
    if (!fs.existsSync(pageDir)) continue;
    for (const n of fs.readdirSync(pageDir).map(Number).filter(n => n > 0).sort((a, b) => a - b)) {
      if (!fs.existsSync(path.join(pageDir, String(n), 'index.html'))) continue;
      // Опустевшие страницы пагинации превращены в перенаправления
      // (redirect-empty-pagination.mjs). Файл на диске есть, но вести на него
      // поисковик нельзя: в сайтмапе должны стоять только конечные адреса.
      if (/http-equiv="refresh"/i.test(fs.readFileSync(path.join(pageDir, String(n), 'index.html'), 'utf8'))) continue;
      entries.push(urlEntry(`${BASE}/${dir}/${x}/page/${n}/`, freq, '0.5'));
    }
  }
  writeUrlset(file, entries);
  console.log(`${dir} на диске: ${items.length}  ->  ${file}: ${entries.length} URL`);
}

// ---- 2б. убираем ТЕМАТИЧЕСКИЕ сайтмапы ----
// checkmate/longtail/high-price/top1000 - это ПОДМНОЖЕСТВА models-1/2, они не добавляли
// ни одного нового URL: 174 414 записей на 87 783 уникальных страницы (50% дублей).
// Google URL-ы дедуплицирует, так что краул-бюджет они не жгли, но отчётность в GSC
// путали и размывали сигналы lastmod/priority. Убираем из индекса и с диска.
const OBSOLETE = ['sitemap-models-top1000.xml', 'sitemap-models-checkmate.xml',
  'sitemap-models-high-price.xml', 'sitemap-models-longtail-1.xml', 'sitemap-models-longtail-2.xml'];
for (const f of OBSOLETE) {
  const p = path.join(SM, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`  удалён дублирующий ${f}`); }
}

// ---- 2в. хабы категорий: пересобираем СПИСКОМ С ДИСКА ----
// /categories/<cat>/ уже есть в sitemap-categories.xml - здесь только /page/N/.
//
// Раньше файл собирался один раз и потом лишь фильтровался, поэтому расходился
// с диском в обе стороны: страницы удалённых категорий висели в нём вечно
// (после разделения «Weapons & Tools» - 16 несуществующих URL, то есть 404 для
// обхода), а страницы новых категорий не попадали вовсе (204 URL, включая всю
// пагинацию Weapons и Tools). Теперь список всегда строится заново.
{
  const p = path.join(SM, 'sitemap-category-hubs.xml');
  const CATS_DIR = path.join(ROOT, 'categories');
  const urls = [];
  for (const cat of fs.readdirSync(CATS_DIR).sort()) {
    const pageDir = path.join(CATS_DIR, cat, 'page');
    if (!fs.existsSync(pageDir)) continue;
    const nums = fs.readdirSync(pageDir).map(Number).filter(n => n > 0).sort((a, b) => a - b);
    for (const n of nums) {
      if (!fs.existsSync(path.join(pageDir, String(n), 'index.html'))) continue;
      // Опустевшие страницы пагинации превращены в перенаправления
      // (redirect-empty-pagination.mjs). Файл на диске есть, но вести на него
      // поисковик нельзя: в сайтмапе должны стоять только конечные адреса.
      if (/http-equiv="refresh"/i.test(fs.readFileSync(path.join(pageDir, String(n), 'index.html'), 'utf8'))) continue;
      urls.push(`  <url>\n    <loc>${BASE}/categories/${cat}/page/${n}/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`);
    }
  }
  fs.writeFileSync(p, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 'utf8');
  console.log(`  sitemap-category-hubs.xml: пересобран с диска -> ${urls.length} URL`);
}

// ---- 3. остальным страничным сайтмапам - свежий lastmod ----
// collections и industries сюда больше не входят: их списки пересобираются с диска
// в шаге 2а, и дата там уже проставлена.
const touch = ['sitemap-main.xml', 'sitemap-category-hubs.xml', 'sitemap-browse.xml'];
for (const f of touch) {
  const p = path.join(SM, f);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, s.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${TODAY}</lastmod>`), 'utf8');
  console.log(`  ${f}: lastmod -> ${TODAY}`);
}

// ---- 4. чистим пустые сайтмапы ----
for (const f of fs.readdirSync(SM).filter(f => f.endsWith('.xml'))) {
  const s = fs.readFileSync(path.join(SM, f), 'utf8');
  if (!/<loc>/.test(s)) { fs.unlinkSync(path.join(SM, f)); console.log(`  удалён пустой ${f}`); }
}

// ---- 5. индекс ----
const ORDER = ['sitemap-main.xml', 'sitemap-categories.xml', 'sitemap-category-hubs.xml', 'sitemap-browse.xml',
  'sitemap-collections.xml', 'sitemap-industries.xml', 'sitemap-models-1.xml', 'sitemap-models-2.xml',
  'image-sitemap-1.xml', 'image-sitemap-2.xml'];
const present = ORDER.filter(f => fs.existsSync(path.join(SM, f)));
const isImg = f => f.startsWith('image-sitemap');
// у image-сайтмапов lastmod оставляем прежний (картинки не менялись)
const oldIdx = fs.existsSync(path.join(ROOT, 'sitemap-index.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap-index.xml'), 'utf8') : '';
const oldLm = f => (oldIdx.match(new RegExp(`${f}</loc>\\s*<lastmod>([^<]+)</lastmod>`)) || [, TODAY])[1];

const idx = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  present.map(f => `  <sitemap>\n    <loc>${BASE}/sitemaps/${f}</loc>\n    <lastmod>${isImg(f) ? oldLm(f) : TODAY}</lastmod>\n  </sitemap>`).join('\n') +
  `\n</sitemapindex>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap-index.xml'), idx, 'utf8');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), idx, 'utf8');
console.log(`\nsitemap-index.xml + sitemap.xml: ${present.length} сайтмапов, lastmod ${TODAY}`);
