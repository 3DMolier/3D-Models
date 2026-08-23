/*
 * build-faq-page.mjs - страница /faq/ и ссылка на неё в подвалах.
 *
 * Почему отдельная страница. На главной стояла разметка FAQPage, объявлявшая
 * четыре вопроса, которых на странице не было вовсе - Google требует, чтобы
 * размеченное было видно читателю. Класть эти вопросы на витрину нельзя: у
 * cgtrader.com их на главной нет совсем, у turbosquid.com - крошечный блок в
 * самом низу. Поэтому вопросы живут своей страницей, и разметка стоит там же,
 * где текст, который она описывает.
 *
 * Оболочка берётся с /about/: та же шапка, меню и подвал, значит страница
 * гарантированно не разъедется с остальным сайтом.
 *
 * Ссылка в подвал ставится тем же способом, что и ссылки на /privacy/ и
 * /terms/ (см. add-legal-footer-links.mjs): два вида подвала, простой и
 * cat-footer. Карточки моделей здесь не трогаем - у них свой подвал, его
 * правит enrich-cards.mjs.
 *
 * Запуск:
 *   node build-faq-page.mjs --dry
 *   node build-faq-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');

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

const CSS = `
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

// ── Страница ─────────────────────────────────────────────────────────────────
let a = fs.readFileSync(path.join(ROOT, 'about', 'index.html'), 'utf8');

const body = '<main id="main-content" class="faq-wrap">\n'
  + '<h1 class="faq-h1">Questions about buying these models</h1>\n'
  + '<p class="faq-lede">Everything people ask before they click through to TurboSquid.</p>\n'
  + FAQ.map(([q, ans]) => `<h2 class="faq-q">${esc(q)}</h2>\n<p class="faq-a">${esc(ans)}</p>`).join('\n')
  + '\n</main>';

const start = a.indexOf('<main id="main-content"');
const end = a.indexOf('</main>', start);
if (start < 0 || end < 0) { console.error('не разобрал оболочку about'); process.exit(1); }
a = a.slice(0, start) + body + '\n' + a.slice(end + 7);

const title = 'FAQ - Buying 3D Models | 3D Molier';
const desc = 'Formats, licensing, the CheckMate standard, rigging and prices - the questions '
  + 'people ask before buying a 3D Molier model.';
a = a.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>');
a = a.replace(/(<meta name="description" content=")[^"]*(")/, (m, x, y) => x + desc + y);
a = a.replace(/(<meta property="og:description" content=")[^"]*(")/, (m, x, y) => x + desc + y);
a = a.replace(/(<meta property="og:title" content=")[^"]*(")/, (m, x, y) => x + title + y);
a = a.replace(/<link rel="canonical" href="[^"]*"/, '<link rel="canonical" href="https://3dmolierstudio.com/faq/"');
a = a.replace(/(<meta property="og:url" content=")[^"]*(")/, () => '<meta property="og:url" content="https://3dmolierstudio.com/faq/"');

// Разметку страницы About убираем и кладём свою, собранную из видимых вопросов.
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
// «<» пишем как <, иначе ответ со словом «</script>» закрыл бы тег.
a = a.replace('</body>', '<script type="application/ld+json">'
  + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script></body>');

if (!DRY) {
  fs.mkdirSync(path.join(ROOT, 'faq'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'faq', 'index.html'), a);
}
console.log('страница /faq/: ' + FAQ.length + ' вопросов, ' + a.length + ' символов');

// ── Стили ────────────────────────────────────────────────────────────────────
{
  const f = path.join(ROOT, 'assets', 'css', 'styles.css');
  const css = fs.readFileSync(f, 'utf8');
  if (css.includes('.faq-wrap')) console.log('стили уже на месте');
  else { if (!DRY) fs.writeFileSync(f, css.replace(/\s*$/, '\n') + CSS); console.log('стили добавлены в styles.css'); }
}

// ── Ссылка в подвалах ────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['models', 'node_modules', '.git', '.claude', 'preview', 'scripts', 'tools', 'data', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}
const VARIANTS = [
  { name: 'простой', re: /(<a href="\/about\/" class="footer-link">About<\/a>)/,
    add: m => m + '<a href="/faq/" class="footer-link">FAQ</a>' },
  { name: 'cat-footer', re: /(<a href="\/about\/" class="nav-link">About<\/a>)/,
    add: m => m + '<a href="/faq/" class="nav-link">FAQ</a>' },
];

let touched = 0, already = 0, noAnchor = 0;
const kinds = {};
for (const file of walk(ROOT)) {
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h)) continue;
  if (h.includes('href="/faq/"')) { already++; continue; }
  let hit = null;
  for (const v of VARIANTS) if (v.re.test(h)) { h = h.replace(v.re, (m) => v.add(m)); hit = v.name; break; }
  if (!hit) { noAnchor++; continue; }
  kinds[hit] = (kinds[hit] || 0) + 1;
  if (!DRY) fs.writeFileSync(file, h);
  touched++;
}
console.log('\nссылка на /faq/ в подвале:');
console.log('  страниц изменено:   ' + touched + '  ' + JSON.stringify(kinds));
console.log('  ссылка уже была:    ' + already);
console.log('  подвал не опознан:  ' + noAnchor);
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано')
  + '\nКарточки моделей не трогали - у них свой подвал (enrich-cards.mjs).');
