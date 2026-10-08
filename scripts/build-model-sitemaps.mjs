// build-model-sitemaps.mjs — карты моделей только по НАСТОЯЩИМ карточкам.
//
// Страницы-перенаправления в сайтмап попадать не должны: поисковик тратит на них
// краул-бюджет и получает семь слов текста вместо товара. После объединения по
// Root ID таких страниц стало 25 012, и все они оказались в sitemap-models-*.xml —
// refresh-sitemaps.mjs правит только lastmod и список URL не пересобирает.
//
// Запуск:  node scripts/build-model-sitemaps.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
import { createLastmod } from './lib/lastmod.mjs';
import { isNoindexHead } from './lib/index-policy.mjs';
const M = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
// По 10 000 - столько в картах на сайте, и именно эти шесть адресов отправлены
// в Search Console. При 45 000 файл укладывался в два, а sitemap-models-3..6
// начинали отдавать 404 - у поисковика они уже в очереди на обход.
const PER_FILE = 10000;
const HEAD = 400;
const buf = Buffer.alloc(HEAD);

// Заглушка-перенаправление или карточка под noindex (lib/index-policy.mjs):
// карта сайта не должна звать на обход то, что сама страница просит не индексировать.
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(M, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    const h = buf.slice(0, n).toString('utf8');
    if (isNoindexHead(h)) { noindexed++; return 'noindex'; }
    return /http-equiv="refresh"/.test(h);
  } finally { fs.closeSync(fd); }
}
let noindexed = 0;

// lastmod - настоящая дата изменения страницы, а не дата сборки. Подробности и
// причина - в scripts/lib/lastmod.mjs.
const lm = createLastmod(ROOT);

// Сильные страницы живут в sitemap-priority.xml - здесь их не дублируем,
// иначе один адрес окажется в двух картах и приоритет перестанет читаться.
const priority = (() => {
  try { return new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'priority-slugs.json'), 'utf8'))); }
  catch { return new Set(); }
})();

const slugs = [];
let stubs = 0, inPriority = 0;
for (const d of fs.readdirSync(M)) {
  const stub = isStub(d);
  // Карточку под noindex в карту не зовём, но дату изменения ей ведём: журнал
  // вписывает её в саму страницу (dateModified, «Updated»). Без этого вызова
  // 08.10.2026 у 23 812 таких карточек застряла чужая дата 2026-09-04.
  if (stub === 'noindex') lm.lastmodFor('/models/' + d + '/');
  if (stub) { stubs++; continue; }
  if (priority.has(d)) { inPriority++; continue; }
  slugs.push(d);
}
console.log('настоящих карточек: ' + (slugs.length + inPriority)
  + ', из них в приоритетной карте: ' + inPriority
  + ', здесь: ' + slugs.length + ', перенаправлений и noindex пропущено: ' + stubs + ' (noindex ' + noindexed + ')');

const written = [];
for (let i = 0; i < slugs.length; i += PER_FILE) {
  const part = slugs.slice(i, i + PER_FILE);
  const name = 'sitemap-models-' + (i / PER_FILE + 1) + '.xml';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + part.map(s => '<url><loc>' + SITE + '/models/' + s + '/</loc>'
      + '<lastmod>' + lm.lastmodFor('/models/' + s + '/') + '</lastmod>'
      + '<changefreq>monthly</changefreq><priority>0.6</priority></url>').join('\n')
    + '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemaps', name), xml);
  written.push(name);
  console.log('  ' + name + ': ' + part.length + ' URL');
}

// Лишние файлы от прошлого, более крупного каталога убираем.
for (const f of fs.readdirSync(path.join(ROOT, 'sitemaps'))) {
  if (/^sitemap-models-\d+\.xml$/.test(f) && !written.includes(f)) {
    fs.unlinkSync(path.join(ROOT, 'sitemaps', f));
    console.log('  удалён лишний ' + f);
  }
}
const st = lm.save();
console.log(`  даты: без изменений ${st.unchanged}, обновлено ${st.changed}, впервые ${st.seeded}, файл не найден ${st.missing}`);
console.log('\nготово: ' + written.length + ' файлов');
