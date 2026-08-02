// apply-fetched-previews.mjs — подстановка превью, собранных сборщиком с TurboSquid.
//
// Вход: tools/artstation/fetched-previews.json  вида { "<slug>": "<https://p.turbosquid.com/ts-thumb/...>" }
// (сборщик лежит там, потому что там установлен Playwright и настроен Chrome с CDP —
//  TurboSquid отдаёт 403 на прямые HTTP-запросы.)
//
// Что меняет на странице: og:image, twitter:image, src и data-fallback у героя,
// alt героя, и поле image в Product/ItemPage JSON-LD. Блок-заглушку не трогаем —
// она нужна на случай, если картинка не загрузится.
//
// Запуск:  node scripts/apply-fetched-previews.mjs --dry
//          node scripts/apply-fetched-previews.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const SRC = 'D:/Clode_Work_Folder/tools/artstation/fetched-previews.json';
const DRY = process.argv.includes('--dry');

if (!fs.existsSync(SRC)) {
  console.error('Нет файла ' + SRC + '\nСначала: node D:/Clode_Work_Folder/tools/artstation/fetch-missing-previews.js');
  process.exit(1);
}
const map = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const slugs = Object.keys(map);
console.log('собранных превью: ' + slugs.length);

let ok = 0, skip = 0; const reasons = {};
for (const slug of slugs) {
  const url = map[slug];
  if (!url || !url.includes('ts-thumb')) { skip++; reasons['ссылка не похожа на превью'] = (reasons['ссылка не похожа на превью'] || 0) + 1; continue; }
  const file = path.join(MODELS, slug, 'index.html');
  if (!fs.existsSync(file)) { skip++; reasons['нет страницы'] = (reasons['нет страницы'] || 0) + 1; continue; }

  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(url)) { skip++; reasons['уже стоит'] = (reasons['уже стоит'] || 0) + 1; continue; }

  const name = (html.match(/<h1 class="mp-h1">\s*([\s\S]*?)\s*<\/h1>/) || [])[1] || '';
  const put = s => () => s;

  html = html.replace(/(<meta property="og:image" content=")([^"]*)(">)/, (m, a, _b, c) => a + url + c);
  html = html.replace(/(<meta name="twitter:image" content=")([^"]*)(">)/, (m, a, _b, c) => a + url + c);

  // герой: подменяем src, data-fallback и alt-заглушку
  html = html.replace(/(<img )src="[^"]*"([^>]*class="mp-hero-img")/, (m, a, b) => a + 'src="' + url + '"' + b);
  html = html.replace(/(class="mp-hero-img"[^>]*?)data-fallback="[^"]*"/, (m, a) => a + 'data-fallback="' + url + '"');
  if (name) {
    html = html.replace(/(<img[^>]*class="mp-hero-img"[^>]*\balt=")3D Model preview(")/,
      (m, a, b) => a + name.replace(/"/g, '') + ' 3D model preview' + b);
    html = html.replace(/(<img [^>]*\balt=")3D Model preview("[^>]*class="mp-hero-img")/,
      (m, a, b) => a + name.replace(/"/g, '') + ' 3D model preview' + b);
  }

  // картинка в схемах
  html = html.replace(/("@type":"Product"[\s\S]{0,400}?"image":")[^"]*(")/, (m, a, b) => a + url + b);
  html = html.replace(/("primaryImageOfPage":")[^"]*(")/, (m, a, b) => a + url + b);

  if (!html.includes(url)) { skip++; reasons['не подставилось'] = (reasons['не подставилось'] || 0) + 1; continue; }
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) { console.error('СТОП: меню на ' + slug); process.exit(1); }

  if (!DRY) fs.writeFileSync(file, html);
  ok++;
}
console.log('обновлено: ' + ok + (DRY ? ' (--dry, не записано)' : '') + '   пропущено: ' + skip);
if (skip) console.log(JSON.stringify(reasons, null, 1));
