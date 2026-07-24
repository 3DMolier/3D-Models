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

// ---- 1. модели ----
const models = dirsWithIndex('models');
const mEntries = models.map(s => urlEntry(`${BASE}/models/${s}/`, 'monthly', '0.7'));
console.log(`Модели на диске: ${models.length}`);
writeUrlset('sitemap-models-1.xml', mEntries.slice(0, LIMIT));
writeUrlset('sitemap-models-2.xml', mEntries.slice(LIMIT));

// ---- 2. категории (страница 1 каждой) ----
const cats = dirsWithIndex('categories');
console.log(`Категории на диске: ${cats.length}`);
writeUrlset('sitemap-categories.xml', cats.map(c => urlEntry(`${BASE}/categories/${c}/`, 'weekly', '0.9')));

// ---- 3. остальным страничным сайтмапам - свежий lastmod ----
const touch = ['sitemap-main.xml', 'sitemap-collections.xml', 'sitemap-industries.xml',
  'sitemap-category-hubs.xml', 'sitemap-models-top1000.xml', 'sitemap-models-checkmate.xml',
  'sitemap-models-high-price.xml', 'sitemap-models-longtail-1.xml'];
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
const ORDER = ['sitemap-main.xml', 'sitemap-categories.xml', 'sitemap-category-hubs.xml',
  'sitemap-collections.xml', 'sitemap-industries.xml', 'sitemap-models-1.xml', 'sitemap-models-2.xml',
  'sitemap-models-top1000.xml', 'sitemap-models-checkmate.xml', 'sitemap-models-high-price.xml',
  'sitemap-models-longtail-1.xml', 'image-sitemap-1.xml', 'image-sitemap-2.xml'];
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
