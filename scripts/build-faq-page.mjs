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

const MAIL = 'mailto:3dmolier@3dmolier.com';

const FAQ = [
  ['What file formats do the models come in?',
   'Usually MAX, C4D, Maya, Blender, FBX and OBJ. Which of them a particular model ships in is listed '
   + 'in its Specifications table, and the exact files with their sizes are on the TurboSquid product '
   + 'page it links to. Need a format that is not there? We convert models on request - write to '
   + '<a href="' + MAIL + '">3dmolier@3dmolier.com</a> and tell us the model and the format you need.'],
  ['Are the models CheckMate certified?',
   'Many are, and the badge is shown on the model page. Every model in this catalogue is built to the '
   + 'CheckMate specification whether or not it carries the mark: TurboSquid has since closed the '
   + 'certification programme, so work published after that has no badge simply because there is no '
   + 'longer anyone issuing it. What the standard actually requires - geometry, UV unwrapping, textures '
   + 'and materials - is written out on our <a href="/model-standards/">model quality standards</a> page.'],
  ['What is StemCell?',
   'StemCell is the stricter of the two TurboSquid standards. A StemCell model is authored once and '
   + 'delivered across every major format and render engine without anyone repairing it in between: PBR '
   + 'materials that survive the conversion, consistent naming, predictable scale. A StemCell model is '
   + 'therefore also CheckMate. The full requirements are on our '
   + '<a href="/model-standards/">model quality standards</a> page.'],
  ['Can I use these models in commercial work?',
   'Most of them, yes - they are sold Royalty Free, and one purchase covers commercial use for as long '
   + 'as the work is shown. But not all: models of real branded products carry an Editorial Uses Only '
   + 'licence, which allows news, commentary, teaching and film, and not advertising or merchandise. '
   + 'The licence is stated on every model page, in the Specifications table. Read it before you buy - '
   + 'and see <a href="/license/">licences explained</a> for what each one allows in practice.'],
  ['Are the models rigged?',
   'Some are. When a model is rigged, it says so in the description and in the Specifications table on '
   + 'its page - and you can filter the catalogue by it. Where a subject exists both as a static model '
   + 'and as a rigged one, the two are listed together on the same page.'],
  ['Why are the models so inexpensive?',
   'Because you are buying a licence to use the model, not the model itself with full rights. That is '
   + 'what lets us price far below what the model cost to build - roughly ten times less than producing '
   + 'it yourself or commissioning it from a studio. The work is paid for once, across many buyers, '
   + 'instead of once by one.'],
  ['Can I order a new model, or have an existing one modified?',
   'Yes. We build to order and we adapt models we have already made - a different colour scheme, a '
   + 'rig, a lower poly count, another format. See <a href="/custom-order/">custom orders</a> for how '
   + 'it works, or write to <a href="' + MAIL + '">3dmolier@3dmolier.com</a>.'],
  ['Can I buy in bulk by sending you a list of models in a spreadsheet?',
   'Yes. Send us an Excel or CSV file with the models you want - names, links or TurboSquid IDs, '
   + 'whatever you have - and we will find them and come back with the list. Write to '
   + '<a href="' + MAIL + '">3dmolier@3dmolier.com</a>.'],
  ['Is there a discount for a bulk purchase?',
   'Yes. Send us the request and we will agree the terms individually - the discount depends on how '
   + 'many models you need and which. Write to <a href="' + MAIL + '">3dmolier@3dmolier.com</a>.'],
  ['Can I license the catalogue as data, for AI or 3D reconstruction training?',
   'Yes. Beyond single-model sales we license the collection as a dataset - meshes, textures and '
   + 'metadata at volume, for machine learning, simulation and reconstruction work, under terms written '
   + 'for that use rather than for a single project. See <a href="/data-licensing/">3D data licensing</a>.'],
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
