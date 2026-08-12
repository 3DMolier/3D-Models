// add-hero-preload.mjs — предзагрузка главного снимка карточки.
//
// Замер на живой карточке: LCP 2612 мс при пороге 2500. Виновата не картинка -
// она скачивается за 367 мс, preconnect к p.turbosquid.com и fetchpriority=high
// уже стоят. Дело в очерёдности: браузер узнаёт про снимок, только доразобрав
// разметку до <img>, а до этого ждёт четыре файла стилей.
//
// <link rel="preload" as="image"> в <head> запускает загрузку сразу, не дожидаясь
// разбора тела. Для LCP-элемента это штатный приём.
//
// Ставим ТОЛЬКО для героя и только если его адрес известен: лишние preload вредят,
// они соперничают за канал с тем, что действительно нужно.
//
// Запуск:  node scripts/add-hero-preload.mjs --dry
//          node scripts/add-hero-preload.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

const HEAD = 400;
const headBuf = Buffer.alloc(HEAD);
function isStub(dir) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, dir, 'index.html'), 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, headBuf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(headBuf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}

let checked = 0, touched = 0, already = 0, noHero = 0;
for (const slug of fs.readdirSync(MODELS)) {
  if (isStub(slug)) continue;
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  checked++;

  if (/<link rel="preload"[^>]*as="image"/.test(html)) { already++; continue; }

  // Адрес героя берём из самого тега, а не из og:image: на объединённых карточках
  // герой переключается галереей, и в src стоит именно тот снимок, что видит
  // посетитель первым.
  const m = html.match(/<img[^>]*class="mp-hero-img"[^>]*>/);
  const src = m ? (m[0].match(/\ssrc="([^"]+)"/) || [])[1] : null;
  if (!src || !/^https?:/.test(src)) { noHero++; continue; }

  const tag = '<link rel="preload" as="image" href="' + src + '" fetchpriority="high">';
  if (!html.includes('</head>')) { noHero++; continue; }
  const out = html.replace('</head>', tag + '</head>');

  if (!out.includes('<a href="/categories/other/" role="menuitem"')) continue;
  if (!DRY) fs.writeFileSync(file, out);
  touched++;
  if (touched % 20000 === 0) console.log('  добавлено ' + touched);
}

console.log('\nнастоящих карточек:      ' + checked);
console.log('предзагрузка добавлена:  ' + touched + (DRY ? '  (--dry)' : ''));
if (already) console.log('уже было:                ' + already);
if (noHero) console.log('без героя или head:      ' + noHero);
