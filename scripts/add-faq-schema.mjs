// add-faq-schema.mjs — разметка FAQPage для блока вопросов на карточке.
//
// Блок «Questions About This Model» стоит на каждой карточке: четыре вопроса в
// <h3 class="mp-faq-q"> и ответы в <p class="mp-faq-a">. Разметки при этом нет
// ни на одной из 61 857 страниц.
//
// Оговорка про пользу. Расширенные сниппеты FAQ Google для большинства сайтов
// отключил в 2023, на обычную выдачу это не повлияет. Смысл в другом: AI-ответы
// (Google AIO, Bing Copilot, Perplexity) опираются на структуру, и размеченная
// пара «вопрос - ответ» цитируется охотнее, чем тот же текст без разметки.
//
// Схему кладём ОТДЕЛЬНЫМ блоком, не трогая Product/ProductGroup, ItemPage и
// BreadcrumbList: они уже проверены и ломать их незачем.
//
// Запуск:  node scripts/add-faq-schema.mjs --dry
//          node scripts/add-faq-schema.mjs

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

// Текст ответа очищаем от тегов И раскрываем HTML-сущности. Содержимое
// <script type="application/ld+json"> как HTML не разбирается, поэтому «&amp;»
// внутри него остаётся пятью символами - поисковик читает «Film &amp; Video».
// Так и вышло на 37 112 карточках, чинили скриптом fix-entities-in-jsonld.mjs.
const strip = s => s
  .replace(/<[^>]+>/g, '')
  .replace(/&#8212;/g, ' - ')
  .replace(/&(quot|#39|#x27|apos|lt|gt|nbsp|amp);/g, (m, e) =>
    ({ quot: '"', '#39': "'", '#x27': "'", apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[e])
  .replace(/\s+/g, ' ')
  .trim();

function faqPairs(html) {
  const block = html.match(/<div class="mp-faq-block">([\s\S]*?)<\/div>/);
  const src = block ? block[1] : html;
  const qs = [...src.matchAll(/<h3 class="mp-faq-q">([\s\S]*?)<\/h3>\s*<p class="mp-faq-a">([\s\S]*?)<\/p>/g)];
  return qs.map(m => ({ q: strip(m[1]), a: strip(m[2]) })).filter(x => x.q && x.a);
}

let checked = 0, touched = 0, already = 0, noBlock = 0, broken = 0;
for (const slug of fs.readdirSync(MODELS)) {
  if (isStub(slug)) continue;
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  checked++;

  if (html.includes('"@type":"FAQPage"')) { already++; continue; }

  const pairs = faqPairs(html);
  if (pairs.length < 2) { noBlock++; continue; }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://3dmolierstudio.com/models/' + slug + '/#faq',
    mainEntity: pairs.map(p => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  };
  // «<» экранируем как \u003c: иначе текст, содержащий «</script>», закрыл бы
  // тег раньше времени. Для JSON это законная запись, читается как обычный «<».
  const tag = '<script type="application/ld+json">\n'
    + JSON.stringify(schema).replace(/</g, '\\u003c') + '\n</script>';

  // Вставляем перед закрытием body — рядом с остальными блоками разметки.
  let out;
  if (html.includes('</body>')) out = html.replace('</body>', tag + '</body>');
  else out = html + tag;

  // Каждый блок разметки должен остаться разбираемым: битый JSON-LD у нас
  // уже случался, повторять нельзя.
  let ok = true;
  for (const b of out.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { ok = false; }
  }
  if (!ok) { broken++; continue; }

  if (!DRY) fs.writeFileSync(file, out);
  touched++;
  if (touched % 10000 === 0) console.log('  размечено ' + touched);
}

console.log('\nнастоящих карточек:        ' + checked);
console.log('размечено FAQPage:         ' + touched + (DRY ? '  (--dry)' : ''));
if (already) console.log('уже было размечено:        ' + already);
if (noBlock) console.log('без блока вопросов:        ' + noBlock);
if (broken) console.log('ПРОПУЩЕНО из-за JSON:      ' + broken);
