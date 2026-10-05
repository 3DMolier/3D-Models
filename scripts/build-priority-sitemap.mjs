/*
 * build-priority-sitemap.mjs - отдельная карта для сильных страниц каталога.
 *
 * Зачем. 05.10.2026 проверка в Search Console показала: каталог почти не в
 * индексе. Главная проиндексирована, /catalog/ и разделы «обойдены, не
 * проиндексированы», а у обычных карточек вердикт «адрес Google неизвестен» -
 * то есть робот до них просто не дошёл. Сваливать 37 683 одинаковых по силе
 * адреса в одну кучу и ждать, что их возьмут целиком, бессмысленно: обход
 * конечен, и тратить его надо на то, что может ранжироваться.
 *
 * Что считаем сильной страницей:
 *   · есть рукописное описание (уникальный текст, а не шаблон), либо
 *   · модель реально продаётся: от 10 продаж.
 * Сортировка по продажам - сверху то, на что есть спрос.
 *
 * Эти адреса уходят в sitemap-priority.xml и ИСКЛЮЧАЮТСЯ из sitemap-models-*,
 * чтобы один адрес не лежал в двух картах. Карта ставится первой в индексе.
 *
 * Запуск: node scripts/build-priority-sitemap.mjs
 * Результат: sitemaps/sitemap-priority.xml + data/priority-slugs.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { createLastmod } from './lib/lastmod.mjs';

const SITE = 'https://3dmolierstudio.com';
const MIN_SALES = 10;
const LIMIT = 6000;             // больше нет смысла: это уже вся сильная часть каталога

const hand = (() => {
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-hand-desc.json'), 'utf8')))); }
  catch { return new Set(); }
})();

const rows = [];
for (let i = 0; i < 40; i++) {
  const f = path.join(ROOT, 'data', 'records', `records-${i}.json`);
  if (!fs.existsSync(f)) continue;
  for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    if (r.status !== 'live') continue;
    const sales = r.sales || 0;
    const hasHand = hand.has(r.slug);
    if (!hasHand && sales < MIN_SALES) continue;
    rows.push({ slug: r.slug, sales, hasHand });
  }
}
rows.sort((a, b) => b.sales - a.sales || a.slug.localeCompare(b.slug));
const take = rows.slice(0, LIMIT);

const lm = createLastmod(ROOT);
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + take.map(r => '<url><loc>' + SITE + '/models/' + r.slug + '/</loc>'
    + '<lastmod>' + lm.lastmodFor('/models/' + r.slug + '/') + '</lastmod>'
    + '<changefreq>weekly</changefreq><priority>0.9</priority></url>').join('\n')
  + '\n</urlset>\n';

fs.mkdirSync(path.join(ROOT, 'sitemaps'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'sitemaps', 'sitemap-priority.xml'), xml, 'utf8');
fs.writeFileSync(path.join(ROOT, 'data', 'priority-slugs.json'),
  JSON.stringify(take.map(r => r.slug), null, 0), 'utf8');
lm.save();

const withHand = take.filter(r => r.hasHand).length;
console.log(`sitemap-priority.xml: ${take.length} адресов`
  + ` (с рукописным текстом ${withHand}, остальные - от ${MIN_SALES} продаж)`);
console.log(`data/priority-slugs.json: ${take.length} slug`);
