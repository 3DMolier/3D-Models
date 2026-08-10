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

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const M = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
const PER_FILE = 45000;
const HEAD = 400;
const buf = Buffer.alloc(HEAD);

function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(M, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, buf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}

const today = new Date().toISOString().slice(0, 10);
const slugs = [];
let stubs = 0;
for (const d of fs.readdirSync(M)) {
  if (isStub(d)) { stubs++; continue; }
  slugs.push(d);
}
console.log('настоящих карточек: ' + slugs.length + ', перенаправлений пропущено: ' + stubs);

const written = [];
for (let i = 0; i < slugs.length; i += PER_FILE) {
  const part = slugs.slice(i, i + PER_FILE);
  const name = 'sitemap-models-' + (i / PER_FILE + 1) + '.xml';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + part.map(s => '<url><loc>' + SITE + '/models/' + s + '/</loc>'
      + '<lastmod>' + today + '</lastmod>'
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
console.log('\nготово: ' + written.length + ' файлов');
