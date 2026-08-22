/*
 * upgrade-homepage.mjs - довести главную до уровня карточек.
 *
 * На карточке у читателя есть таблица характеристик, списки и блок вопросов
 * с заголовками. На главной этого не было: 757 слов, ни одной таблицы, ни
 * одного <ul>, и всего 8 категорий из 26 в виде плиток.
 *
 * Отдельно - дефект. На главной объявлена схема FAQPage с четырьмя вопросами,
 * которых на странице нет вообще. Google требует, чтобы размеченное
 * содержимое было видно пользователю, иначе разметка считается нарушением.
 * Блок делаем видимым, схему пересобираем из того, что человек реально видит.
 *
 * Про сертификацию. TurboSquid закрыл программу CheckMate и новые модели не
 * сертифицирует, а студия продолжает строить всё по той же спецификации.
 * Значит, любое число сертифицированных заморожено и с каждой новой моделью
 * врёт сильнее. Поэтому счётчиков сертификации на главной не осталось: ни в
 * плитке первого экрана (было «41,783 CheckMate Certified»), ни в карточке
 * коллекции (было «917 quality-verified models»), ни в новых блоках. Вместо
 * числа - утверждение про стандарт, оно не устаревает.
 *
 * Остальные числа посчитаны по таблицам характеристик 59 639 живых карточек
 * (scratchpad/catalogue-stats.mjs) и относятся именно к страницам этого сайта.
 * Существующее «90,000+» в первом экране считает весь магазин TurboSquid -
 * другой знаменатель, поэтому в новых блоках прямо сказано, что считаются
 * страницы каталога.
 *
 * Запуск:
 *   node upgrade-homepage.mjs --preview   -> preview/home/index.html (noindex)
 *   node upgrade-homepage.mjs --apply     -> правит index.html и styles.css
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PREVIEW = argv.includes('--preview');
if (!APPLY && !PREVIEW) { console.error('нужен --preview или --apply'); process.exit(1); }

// ── Посчитанные числа ────────────────────────────────────────────────────────
const N = {
  pages: 59639,
  cats: 26,
  checkmate: 29889,
  stemcell: 11021,
  standard: 18727,
  scale: 59637,
  uvClean: 46609,
  quadsTris: 48906,
  rigged: 3354,
  animated: 1289,
  priceMin: 1,
  priceMax: 2999,
  priceMedian: 39,
  priceQ1: 29,
  priceQ3: 89,
  avgPoly: 177329,
  since: 2015,
};
N.certified = N.checkmate + N.stemcell;

const CATS = [
  ['Collections & Sets', 'collections-sets', 4713],
  ['Architecture Landmarks', 'architecture-landmarks', 4574],
  ['Vehicles', 'vehicles', 4123],
  ['Clothing & Accessories', 'clothing-accessories', 3900],
  ['Electronics & Gadgets', 'electronics-gadgets', 3706],
  ['Furniture & Interior', 'furniture-interior', 3702],
  ['Animals & Creatures', 'animals-creatures', 3514],
  ['Characters & People', 'characters-people', 2888],
  ['Medical', 'medical-3d-models', 2796],
  ['Food & Beverages', 'food-beverages', 2787],
  ['Tools', 'tools', 2735],
  ['Kitchen & Tableware', 'kitchen-tableware', 2614],
  ['Industrial Equipment', 'industrial-equipment', 2488],
  ['Weapons', 'weapons', 1982],
  ['Sports & Recreation', 'sports-recreation', 1953],
  ['Other', 'other', 1850],
  ['Nature & Plants', 'nature-plants', 1581],
  ['Aircraft', 'aircraft', 1514],
  ['Signage & Decor', 'signage-decor', 1444],
  ['Containers & Storage', 'containers-storage', 1435],
  ['Toys & Games', 'toys-games', 1015],
  ['Ships', 'ships', 701],
  ['Musical Instruments', 'musical-instruments', 482],
  ['Space & Sci-Fi', 'space-scifi', 482],
  ['Lighting', 'lighting', 434],
  ['Military Vehicles', 'military-vehicles', 224],
];

const n = x => x.toLocaleString('en-US');
const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');

// ── Таблица «каталог в цифрах» ───────────────────────────────────────────────
const TABLE = [
  ['Model pages', n(N.pages) + ' across ' + N.cats + ' categories'],
  ['Quality standard', 'Every model is built to the TurboSquid CheckMate specification - real-world '
    + 'scale, clean topology, no stray geometry, materials attached and objects named.'],
  ['Real-world scale', n(N.scale) + ' of ' + n(N.pages) + ' - effectively the whole catalogue'],
  ['Clean UV layout', n(N.uvClean) + ' have non-overlapping UVs, so they take new materials without a re-unwrap'],
  ['Geometry', n(N.quadsTris) + ' are polygonal quads and tris'],
  ['Rigged or animated', n(N.rigged) + ' rigged, ' + n(N.animated) + ' animated. The rest are static builds.'],
  ['Price', '$' + N.priceMin + ' to $' + n(N.priceMax) + '. Half sit between $' + N.priceQ1
    + ' and $' + N.priceQ3 + ', with $' + N.priceMedian + ' in the middle.'],
  ['Typical size', n(N.avgPoly) + ' polygons on average'],
  ['On sale since', String(N.since)],
];

// ── Списки ───────────────────────────────────────────────────────────────────
const INCLUDED = [
  'Modelled to real-world scale, so it lands at the right size next to everything else in the scene instead of being rescaled by eye.',
  'Sold under the TurboSquid Royalty Free licence, which covers commercial delivery without a fee per project.',
  'Its own page here lists polygon and vertex counts, geometry type, UV layout, texture sizes and price before you click through.',
  'Where a model exists as both a static build and a rigged one, both sit on the same page under All Versions of This Model.',
];

// ── Вопросы. Ответы честные: то, чего мы не знаем по данным, не выдумываем ────
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
   'Most are not - ' + n(N.rigged) + ' of ' + n(N.pages) + ' ship rigged and ' + n(N.animated)
   + ' are animated, so a static build is the usual case. Several subjects exist in both forms, and where '
   + 'they do, the static and the rigged version are listed together on the same page.'],
  ['What do they cost?',
   'From $' + N.priceMin + ' to $' + n(N.priceMax) + '. Half the catalogue falls between $' + N.priceQ1
   + ' and $' + N.priceQ3 + ', with the middle price at $' + N.priceMedian + '. Larger, heavier and rigged '
   + 'builds sit at the upper end.'],
  ['How do I buy one?',
   'Open the model here, check the numbers, then use the link to its TurboSquid page. Payment, download '
   + 'and the licence all happen on TurboSquid - this site is the catalogue, not the checkout.'],
];

// ── Разметка ─────────────────────────────────────────────────────────────────
const catList = CATS.map(([name, slug, count]) =>
  `<li class="hm-cat"><a href="/categories/${slug}/"><span class="hm-cat-name">${esc(name)}</span>`
  + `<span class="hm-cat-n">${n(count)}</span></a></li>`).join('');

const SECTION_FACTS = `<!-- ═══════════════════════════════════════ CATALOGUE IN NUMBERS ══════════════ -->
<section class="page-section page-section--gray" id="catalogue-facts">
<div class="max-w-7xl mx-auto">
<div class="section-intro">
<div class="section-label">What Is In Here</div>
<h2 class="section-h2">The catalogue in numbers</h2>
</div>
<p class="section-desc hm-lede">Every figure below is counted from the ${n(N.pages)} model pages on this site, not estimated.</p>
<div class="hm-cols">
<div class="hm-col">
<table class="hm-table">
<tbody>
${TABLE.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
<div class="hm-col">
<h3 class="hm-h3">What every model here comes with</h3>
<ul class="hm-list">
${INCLUDED.map(x => `<li>${esc(x)}</li>`).join('\n')}
</ul>
</div>
</div>
<h3 class="hm-h3 hm-h3--wide">All ${N.cats} categories</h3>
<ul class="hm-cat-list">${catList}</ul>
</div>
</section>
`;

const SECTION_FAQ = `<!-- ═══════════════════════════════════════ QUESTIONS ═════════════════════════ -->
<section class="page-section" id="questions">
<div class="max-w-7xl mx-auto">
<div class="section-intro">
<div class="section-label">Before You Buy</div>
<h2 class="section-h2">Questions people ask first</h2>
</div>
<div class="hm-faq">
${FAQ.map(([q, a]) => `<h3 class="hm-q">${esc(q)}</h3>\n<p class="hm-a">${esc(a)}</p>`).join('\n')}
</div>
</div>
</section>
`;

// ── Стили. Повторяют оформление карточек: та же таблица, те же заголовки. ─────
const CSS = `
/* ── Homepage: facts table, lists, questions ─────────────────────────── */
.hm-lede        { max-width: 720px; margin: -24px 0 32px; }
.hm-cols        { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 48px; align-items: start; }
.hm-table       { width: 100%; border-collapse: collapse; font-size: 14px; }
.hm-table th,
.hm-table td    { text-align: left; padding: 11px 0; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
.hm-table th    { font-weight: 500; color: #6b7280; width: 34%; padding-right: 20px; }
.hm-table td    { color: #1f2937; line-height: 1.6; }
.hm-table tr:last-child th,
.hm-table tr:last-child td { border-bottom: none; }
.hm-h3          { font-size: 15px; font-weight: 600; color: #111111; margin: 0 0 14px; }
.hm-h3--wide    { margin: 48px 0 16px; }
.hm-list        { margin: 0; padding: 0; list-style: none; }
.hm-list li     { position: relative; padding-left: 18px; margin-bottom: 14px; font-size: 14.5px; color: #374151; line-height: 1.7; }
.hm-list li::before { content: ""; position: absolute; left: 0; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent, #1659c9); }
.hm-cat-list    { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0 28px; margin: 0; padding: 0; list-style: none; }
.hm-cat a       { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #e5e5e5; text-decoration: none; }
.hm-cat a:hover .hm-cat-name { color: var(--accent, #1659c9); }
.hm-cat-name    { font-size: 14px; color: #1f2937; }
.hm-cat-n       { font-size: 12.5px; color: #6b7280; font-variant-numeric: tabular-nums; }
.hm-faq         { max-width: 760px; }
.hm-q           { font-size: 15px; font-weight: 600; color: #111111; line-height: 1.4; margin: 26px 0 6px; }
.hm-faq .hm-q:first-child { margin-top: 0; }
.hm-a           { font-size: 14.5px; color: #374151; line-height: 1.75; margin: 0; }
@media (max-width: 860px) {
  .hm-cols      { grid-template-columns: 1fr; gap: 36px; }
  .hm-table th  { width: 42%; }
}
`;

// ── Сборка ───────────────────────────────────────────────────────────────────
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Замороженные счётчики сертификации убираем: программа CheckMate закрыта,
// эти числа больше никогда не вырастут, а каталог растёт.
// Между соседними тегами в разметке местами перевод строки, местами ничего -
// поэтому ищем регулярным выражением с гибким пробелом.
const FROZEN = [
  [/<div class="stats-num">41,783<\/div>\s*<div class="stats-label">CheckMate Certified<\/div>/,
   '<div class="stats-num">100%</div><div class="stats-label">Built to CheckMate Standard</div>',
   'плитка первого экрана'],
  // Подборка - это те модели, что успели получить знак, пока программа
  // работала. Писать здесь «построено по стандарту» нельзя: выйдет, что
  // остальные построены иначе, а это не так.
  [/<div class="col-desc">917 quality-verified models<\/div>/,
   '<div class="col-desc">Models that carry the TurboSquid mark</div>',
   'карточка коллекции'],
];
for (const [re, to, what] of FROZEN) {
  if (!re.test(html)) { console.error('не нашёл: ' + what); process.exit(1); }
  html = html.replace(re, () => to);
  console.log('  убран замороженный счётчик: ' + what);
}

// Новые секции идут перед баннером-призывом, после лицензирования данных.
const anchor = html.indexOf('<!-- ═══════════════════════════════════════\nCTA BANNER');
const marker = html.match(/<!--[═\s]*CTA BANNER[═\s]*-->/);
if (!marker) { console.error('не нашёл разделитель CTA BANNER'); process.exit(1); }
html = html.replace(marker[0], SECTION_FACTS + SECTION_FAQ + marker[0]);

// Схему FAQPage пересобираем из видимых вопросов - иначе разметка обещает
// поисковику то, чего человек на странице не находит.
let faqReplaced = 0;
html = html.replace(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, (all, body) => {
  if (!/"FAQPage"/.test(body)) return all;
  faqReplaced++;
  const unesc = s => String(s).replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://3dmolierstudio.com/#faq',
    mainEntity: FAQ.map(([q, a]) => ({
      '@type': 'Question', name: unesc(q),
      acceptedAnswer: { '@type': 'Answer', text: unesc(a) },
    })),
  };
  return '<script type="application/ld+json">'
    + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>';
});
if (faqReplaced !== 1) { console.error('ожидал ровно один блок FAQPage, нашёл ' + faqReplaced); process.exit(1); }

if (PREVIEW) {
  // В предпросмотре стили кладём прямо в страницу, чтобы её можно было
  // смотреть до того, как обновится общий css.
  html = html.replace('</head>', '<style>' + CSS + '</style>\n<meta name="robots" content="noindex, nofollow">\n</head>');
  const out = path.join(ROOT, 'preview', 'home');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log('предпросмотр: preview/home/index.html');
  console.log('  https://3dmolierstudio.com/preview/home/');
} else {
  const cssFile = path.join(ROOT, 'assets', 'css', 'styles.css');
  let css = fs.readFileSync(cssFile, 'utf8');
  if (css.includes('.hm-table')) console.log('стили уже на месте, css не трогаю');
  else fs.writeFileSync(cssFile, css.replace(/\s*$/, '\n') + CSS);
  // Ссылки на css с версией - поднимаем, иначе браузер отдаст старый файл.
  html = html.replace(/(assets\/css\/[a-z-]+\.(?:min\.)?css\?v=)(\d+)/g, (m, a, v) => a + (+v + 1));
  fs.writeFileSync(path.join(ROOT, 'index.html'), html);
  console.log('главная обновлена, стили добавлены в assets/css/styles.css');
}

console.log('  секций добавлено: 2, вопросов: ' + FAQ.length + ', строк в таблице: ' + TABLE.length
  + ', категорий в списке: ' + CATS.length);
console.log('  сумма по категориям: ' + n(CATS.reduce((a, c) => a + c[2], 0)) + ' (должно быть ' + n(N.pages) + ')');
