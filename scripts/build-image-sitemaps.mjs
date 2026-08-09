// build-image-sitemaps.mjs — карты изображений только по живым карточкам.
//
// После объединения в image-sitemap остались адреса свёрнутых карточек. Список
// собираем заново, беря превью со страниц; страницы-перенаправления пропускаем.
//
// Запуск:  node scripts/build-image-sitemaps.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const M = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
const HEAD = 32 * 1024;
const PER_FILE = 45000;

// Значение из match — это срез, удерживающий всю прочитанную строку. На 65 тысячах
// страниц такие срезы съедали больше четырёх гигабайт. Копируем в свою строку.
const copy = s => Buffer.from(s, 'utf8').toString('utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buf = Buffer.alloc(HEAD);
function head(slug) {
  let fd;
  try { fd = fs.openSync(path.join(M, slug, 'index.html'), 'r'); } catch (e) { return null; }
  try { const n = fs.readSync(fd, buf, 0, HEAD, 0); return buf.slice(0, n).toString('utf8'); }
  finally { fs.closeSync(fd); }
}

const rows = [];
let stubs = 0;
for (const slug of fs.readdirSync(M)) {
  const h = head(slug);
  if (!h) continue;
  if (h.includes('http-equiv="refresh"')) { stubs++; continue; }   // заглушка
  const img = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
  if (!img) continue;
  const t = (h.match(/<title>([^<]*)</) || [])[1] || '';
  rows.push({ slug: copy(slug), img: copy(img), t: copy(t.split(' | ')[0]) });
}
console.log('живых карточек с превью: ' + rows.length + ', заглушек пропущено: ' + stubs);

const written = [];
for (let i = 0; i < rows.length; i += PER_FILE) {
  const part = rows.slice(i, i + PER_FILE);
  const name = 'image-sitemap-' + (i / PER_FILE + 1) + '.xml';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    + ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    + part.map(r => '<url><loc>' + SITE + '/models/' + r.slug + '/</loc>'
      + '<image:image><image:loc>' + esc(r.img) + '</image:loc>'
      + '<image:title>' + esc(r.t) + '</image:title></image:image></url>').join('\n')
    + '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemaps', name), xml);
  written.push(name);
  console.log('  ' + name + ': ' + part.length + ' URL');
}

// Лишние файлы от прошлого, более крупного каталога убираем.
for (const f of fs.readdirSync(path.join(ROOT, 'sitemaps'))) {
  if (/^image-sitemap-\d+\.xml$/.test(f) && !written.includes(f)) {
    fs.unlinkSync(path.join(ROOT, 'sitemaps', f));
    console.log('  удалён лишний ' + f);
  }
}
console.log('\nготово: ' + written.length + ' файлов');
