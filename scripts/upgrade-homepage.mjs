/*
 * upgrade-homepage.mjs - привести главную к тому, как это делают большие
 * магазины 3D-моделей, и убрать с неё справочник.
 *
 * Как у других. Смотрел живьём: у turbosquid.com 663 слова и ноль таблиц,
 * у cgtrader.com 498 слов и ноль таблиц. Порядок один и тот же - герой с
 * поиском, плитки категорий, подборки, короткая полоса доверия из четырёх
 * фраз, и всё. Вопросы либо вынесены отдельной страницей, либо стоят
 * маленьким блоком у самого низа. Никто не кладёт на витрину таблицу с
 * характеристиками каталога: витрина продаёт работу, а не рассказывает о ней.
 *
 * Что делаем.
 *   1. Снимаем с главной таблицу и блок вопросов - их там быть не должно.
 *   2. Добавляем одну секцию про студию. У TurboSquid на главной есть блок
 *      про авторов; здесь автор и есть студия, и это единственное, чего на
 *      главной действительно не хватало: кто это всё сделал.
 *   3. Семь вопросов переносим на /faq/ и туда же переносим разметку FAQPage.
 *      На главной эта разметка объявляла вопросы, которых на странице нет, -
 *      Google требует, чтобы размеченное было видно человеку. Теперь оно
 *      видно, просто на своей странице.
 *   4. Ссылка на /faq/ в подвале.
 *
 * Запуск:
 *   node upgrade-homepage.mjs --preview   -> preview/home/ и preview/faq/
 *   node upgrade-homepage.mjs --apply     -> index.html, faq/, styles.css
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PREVIEW = argv.includes('--preview');
if (!APPLY && !PREVIEW) { console.error('нужен --preview или --apply'); process.exit(1); }

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');

// ── Секция про студию ────────────────────────────────────────────────────────
// Факты взяты со страницы /about/, не выдуманы: основатель, год начала,
// объём выпущенного, оценка покупателей на CGTrader.
const STUDIO = {
  label: 'The Studio',
  // Заголовок нарочно не про «одну студию и один стандарт»: ровно эта мысль
  // уже стоит ниже, в блоке про лицензирование данных. Повторять её здесь -
  // значит писать два текста об одном.
  h2: 'The modeller behind the catalogue',
  body: '3D Molier is Andrey Simonenko, a modeller who has been building production assets '
    + 'since 2003. More than 100,000 models have come out of this studio, and every one of them '
    + 'is made the same way: real-world scale, clean topology, materials attached, objects named '
    + 'rather than left as Object001. Not a marketplace of many hands working to many standards.',
  rating: '4.8 out of 5 from 126 buyers on CGTrader',
  cta: ['About the studio', '/about/'],
};

// ── Вопросы. Уезжают с главной на свою страницу ──────────────────────────────
const FAQ = [
  ['What file formats do the models come in?',
   'FBX, OBJ, MAX, C4D, Maya, Blender and others, depending on the model. The exact list of files, '
   + 'with their sizes, is on the TurboSquid product page each model links to - that page is the one '
   + 'kept in step with the actual files.'],
  ['Are the models CheckMate certified?',
   'Every model in this catalogue is built to the CheckMate specification. TurboSquid has since closed '
   + 'the certification programme, so models published after that carry no badge - not because anything '
   + 'changed in how they are made, but because there is no longer anyone issuing the mark. Models from '
   + 'the years when the programme ran still show it on their TurboSquid page.'],
  ['What does the CheckMate specification cover?',
   'The things that break an import rather than the things that make a render look good: real-world '
   + 'scale, clean topology with no stray or duplicated geometry, materials and textures attached where '
   + 'they belong, and objects named rather than left as Object001. It is the standard this studio builds '
   + 'to on every model, certified or not.'],
  ['Can I use these models in commercial work?',
   'Yes. Every model is sold under the Royalty Free licence, so a single purchase covers commercial use '
   + 'without a payment for each project it appears in. The full licence text is on the product page.'],
  ['Are the models rigged?',
   'Most are static builds. Where a subject exists both as a static model and as a rigged one, the two '
   + 'are listed together on the same page, so choosing between them does not mean hunting for a '
   + 'separate product.'],
  ['What do they cost?',
   'From $1 to $2,999, with most of the catalogue between $29 and $89. Larger, heavier and rigged '
   + 'builds sit at the upper end.'],
  ['How do I buy one?',
   'Open the model here, check the numbers, then use the link to its TurboSquid page. Payment, download '
   + 'and the licence all happen on TurboSquid - this site is the catalogue, not the checkout.'],
];

// ── Разметка ─────────────────────────────────────────────────────────────────
const SECTION_STUDIO = `<!-- ═══════════════════════════════════════ STUDIO ═══════════════════════════ -->
<section class="page-section" id="studio">
<div class="max-w-7xl mx-auto">
<div class="studio-row">
<div class="studio-copy">
<div class="section-label">${esc(STUDIO.label)}</div>
<h2 class="section-h2">${esc(STUDIO.h2)}</h2>
<p class="studio-text">${esc(STUDIO.body)}</p>
<p class="studio-rating"><span class="studio-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span> ${esc(STUDIO.rating)}</p>
<a href="${STUDIO.cta[1]}" class="studio-link">${esc(STUDIO.cta[0])} &rarr;</a>
</div>
</div>
</div>
</section>
`;

const CSS = `
/* ── Homepage: the studio behind the catalogue ───────────────────────── */
.studio-row     { display: grid; grid-template-columns: minmax(0, 620px); justify-content: start; }
.studio-text    { font-size: 16px; line-height: 1.75; color: #374151; margin: 14px 0 0; }
.studio-rating  { display: flex; align-items: center; gap: 9px; font-size: 14px; color: #6b7280; margin: 18px 0 0; }
.studio-stars   { color: #d99b1c; letter-spacing: 1px; font-size: 13px; }
.studio-link    { display: inline-block; margin-top: 20px; font-size: 14px; font-weight: 600;
                  color: var(--accent, #1659c9); text-decoration: none; }
.studio-link:hover { text-decoration: underline; }

/* ── FAQ page ────────────────────────────────────────────────────────── */
.faq-wrap       { max-width: 760px; margin: 0 auto; padding: 56px 24px 88px; }
.faq-h1         { font-family: 'Playfair Display', serif; font-size: clamp(26px, 3.4vw, 36px);
                  font-weight: 700; letter-spacing: -.03em; color: #111111; line-height: 1.15; margin: 0 0 10px; }
.faq-lede       { font-size: 15px; color: #6b7280; line-height: 1.65; margin: 0 0 8px; }
.faq-q          { font-size: 16px; font-weight: 600; color: #111111; line-height: 1.4; margin: 34px 0 8px; }
.faq-a          { font-size: 15px; color: #374151; line-height: 1.8; margin: 0; }
.faq-a a        { color: var(--accent, #1659c9); text-decoration: none; }
.faq-a a:hover  { text-decoration: underline; }
`;

// ── Сборка главной ───────────────────────────────────────────────────────────
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Если предыдущая попытка уже вставила таблицу и вопросы - вырезаем.
let removed = 0;
for (const id of ['catalogue-facts', 'questions']) {
  const re = new RegExp('<!--[^>]*-->\\s*<section class="page-section[^"]*" id="' + id + '">[\\s\\S]*?</section>\\s*');
  if (re.test(html)) { html = html.replace(re, ''); removed++; }
}
if (removed) console.log('  снято с главной прежних секций: ' + removed);

// Замороженные счётчики сертификации: программа CheckMate закрыта, эти числа
// больше не вырастут, а каталог растёт.
const FROZEN = [
  [/<div class="stats-num">41,783<\/div>\s*<div class="stats-label">CheckMate Certified<\/div>/,
   '<div class="stats-num">100%</div><div class="stats-label">Built to CheckMate Standard</div>',
   'плитка первого экрана'],
];
for (const [re, to, what] of FROZEN) {
  if (!re.test(html)) { console.log('  уже исправлено: ' + what); continue; }
  html = html.replace(re, () => to);
  console.log('  убран замороженный счётчик: ' + what);
}

// Секция про студию - перед лицензированием данных, то есть после подборок.
if (html.includes('id="studio"')) console.log('  секция про студию уже стоит');
else {
  const marker = html.match(/<!--[═\s]*DATA LICENSING[═\s]*-->/);
  if (!marker) { console.error('не нашёл разделитель DATA LICENSING'); process.exit(1); }
  html = html.replace(marker[0], SECTION_STUDIO + marker[0]);
  console.log('  добавлена секция про студию');
}

// Разметку FAQPage снимаем с главной - она уезжает на /faq/.
let faqDropped = 0;
html = html.replace(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>\s*/gi, (all, body) => {
  if (!/"FAQPage"/.test(body)) return all;
  faqDropped++;
  return '';
});
console.log('  снято блоков FAQPage с главной: ' + faqDropped);

// Ссылка на вопросы в подвале, рядом с About.
if (html.includes('href="/faq/"')) console.log('  ссылка в подвале уже есть');
else {
  const re = /(<a href="\/about\/" class="footer-link">[^<]*<\/a>)/;
  if (!re.test(html)) console.log('  ВНИМАНИЕ: не нашёл ссылку About в подвале, добавь вручную');
  else {
    html = html.replace(re, (m, a) => a + '<a href="/faq/" class="footer-link">FAQ</a>');
    console.log('  добавлена ссылка на /faq/ в подвал');
  }
}

// ── Сборка страницы вопросов из оболочки About ───────────────────────────────
// Берём готовую страницу: у неё та же шапка, меню и подвал, значит новая
// страница гарантированно не разъедется с остальным сайтом.
function buildFaq(homeHtml) {
  let a = fs.readFileSync(path.join(ROOT, 'about', 'index.html'), 'utf8');

  const body = '<main id="main-content" class="faq-wrap">\n'
    + '<h1 class="faq-h1">Questions about buying these models</h1>\n'
    + '<p class="faq-lede">Everything people ask before they click through to TurboSquid.</p>\n'
    + FAQ.map(([q, ans]) => `<h2 class="faq-q">${esc(q)}</h2>\n<p class="faq-a">${esc(ans)}</p>`).join('\n')
    + '\n</main>';

  // Меняем только содержимое <main>, шапка и подвал остаются от about.
  const start = a.indexOf('<main id="main-content"');
  const end = a.indexOf('</main>', start);
  if (start < 0 || end < 0) throw new Error('не разобрал оболочку about');
  a = a.slice(0, start) + body + '\n' + a.slice(end + 7);

  // Заголовок, описание, канонический адрес.
  const title = 'FAQ - Buying 3D Models | 3D Molier';
  const desc = 'Formats, licensing, the CheckMate standard, rigging and prices - the questions '
    + 'people ask before buying a 3D Molier model.';
  a = a.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
  a = a.replace(/(<meta name="description" content=")[^"]*(")/, (m, x, y) => x + desc + y);
  a = a.replace(/(<meta property="og:description" content=")[^"]*(")/, (m, x, y) => x + desc + y);
  a = a.replace(/(<meta property="og:title" content=")[^"]*(")/, (m, x, y) => x + title + y);
  a = a.replace(/(<link rel="canonical" href=")[^"]*(")/, () => '<link rel="canonical" href="https://3dmolierstudio.com/faq/"');

  // Разметку с about убираем и кладём свою, собранную из видимых вопросов.
  a = a.replace(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  const unesc = s => String(s).replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const schema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    '@id': 'https://3dmolierstudio.com/faq/#faq',
    mainEntity: FAQ.map(([q, ans]) => ({
      '@type': 'Question', name: unesc(q),
      acceptedAnswer: { '@type': 'Answer', text: unesc(ans) },
    })),
  };
  const tag = '<script type="application/ld+json">'
    + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>';
  a = a.replace('</body>', tag + '</body>');

  // Подвал берём с уже поправленной главной, чтобы ссылка на /faq/ была и тут.
  const fA = a.lastIndexOf('<footer'), fH = homeHtml.lastIndexOf('<footer');
  if (fA > 0 && fH > 0) {
    const endA = a.indexOf('</footer>', fA), endH = homeHtml.indexOf('</footer>', fH);
    if (endA > 0 && endH > 0) a = a.slice(0, fA) + homeHtml.slice(fH, endH + 9) + a.slice(endA + 9);
  }
  return a;
}

const faqHtml = buildFaq(html);

// ── Запись ───────────────────────────────────────────────────────────────────
if (PREVIEW) {
  const put = (dir, text) => {
    const out = path.join(ROOT, 'preview', dir);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'),
      text.replace('</head>', '<style>' + CSS + '</style>\n<meta name="robots" content="noindex, nofollow">\n</head>'));
  };
  put('home', html);
  put('faq', faqHtml);
  console.log('\nпредпросмотр:');
  console.log('  https://3dmolierstudio.com/preview/home/');
  console.log('  https://3dmolierstudio.com/preview/faq/');
} else {
  const cssFile = path.join(ROOT, 'assets', 'css', 'styles.css');
  const css = fs.readFileSync(cssFile, 'utf8');
  if (css.includes('.studio-row')) console.log('  стили уже на месте');
  else fs.writeFileSync(cssFile, css.replace(/\s*$/, '\n') + CSS);
  html = html.replace(/(assets\/css\/[a-z-]+\.(?:min\.)?css\?v=)(\d+)/g, (m, a, v) => a + (+v + 1));
  fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  fs.mkdirSync(path.join(ROOT, 'faq'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'faq', 'index.html'), faqHtml);
  console.log('\nзаписано: index.html, faq/index.html, assets/css/styles.css');
}

const words = t => t.slice(t.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
console.log('\nслов на главной: ' + words(html) + '   (turbosquid.com 663, cgtrader.com 498)');
console.log('таблиц на главной: ' + (html.match(/<table/g) || []).length);
console.log('вопросов на /faq/: ' + FAQ.length);
