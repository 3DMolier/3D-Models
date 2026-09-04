/*
 * build-license-page.mjs - страница /license/ и ссылки на неё с карточек.
 *
 * ЗАЧЕМ. До 28.08.2026 на всех карточках стояло «Royalty Free» - слово
 * успокаивающее и всем понятное. Теперь на 4 059 брендовых карточках стоит
 * «Editorial Uses Only», а этого термина обычный покупатель не знает. Он видит
 * незнакомое ограничение без объяснения и уходит - хотя для его задачи оно,
 * возможно, ничему не мешает.
 *
 * ЧЕГО НА ЭТОЙ СТРАНИЦЕ НЕТ И НЕ БУДЕТ. Собственных юридических формулировок.
 * Мы пересказываем чужие условия; если TurboSquid их поменяет, наш текст
 * устареет - ровно та беда, которую 28.08 и чинили. Поэтому страница отвечает
 * только на вопрос «что это значит на практике» и в каждом разделе отсылает к
 * первоисточнику: лицензионному соглашению 3dmolier.com/legal и условиям
 * TurboSquid. В /terms/ уже сказано, что при расхождении побеждает соглашение,
 * - здесь повторяем то же самое.
 *
 * ЧТО ДЕЛАЕТ СКРИПТ.
 *   1. Собирает /license/index.html из каркаса страницы /terms/ - шапка,
 *      подвал, стили и разметка там уже правильные и обновляются sync-chrome.
 *   2. Превращает значение в строке «Licence» на карточках в ссылку сюда.
 *
 * Запуск:  node scripts/build-license-page.mjs --dry
 *          node scripts/build-license-page.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const OUT_DIR = path.join(ROOT, 'license');
const DRY = process.argv.includes('--dry');
const URL = 'https://3dmolierstudio.com/license/';

// ── каркас берём у /terms/: шапка и подвал там уже единые ──
const src = fs.readFileSync(path.join(ROOT, 'terms', 'index.html'), 'utf8');
const a = src.indexOf('<main');
const b = src.indexOf('</main>') + '</main>'.length;
if (a < 0 || b < 7) { console.error('не нашёл <main> в /terms/'); process.exit(1); }
let head = src.slice(0, a);
const tail = src.slice(b);

// Дата пересборки, а не вписанная строкой: иначе при следующем прогоне
// страница уверяла бы, что не менялась с 29 августа.
const TODAY = new Date().toISOString().slice(0, 10);
const TODAY_HUMAN = new Date().toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric' });

const TITLE = 'Model Licences Explained - Royalty Free and Editorial Uses Only | 3D Molier';
const DESC = 'What Royalty Free and Editorial Uses Only mean in practice when you buy a '
  + '3D Molier model on TurboSquid, and how to tell which one applies before you buy.';
head = head
  .replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + TITLE + '</title>')
  .replace(/(<meta name="description" content=")[^"]*(")/, (x, p, s) => p + DESC + s)
  .replace(/(<meta property="og:title" content=")[^"]*(")/, (x, p, s) => p + TITLE + s)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, (x, p, s) => p + DESC + s)
  .replace(/(<meta name="twitter:title" content=")[^"]*(")/, (x, p, s) => p + TITLE + s)
  .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (x, p, s) => p + DESC + s)
  .replace(/(<link rel="canonical" href=")[^"]*(")/, (x, p, s) => p + URL + s)
  .replace(/(<meta property="og:url" content=")[^"]*(")/, (x, p, s) => p + URL + s)
  // hreflang тоже переносится из каркаса и указывал на /terms/: страница
  // объявляла себя языковой версией чужого документа, споря с canonical.
  .replace(/(<link rel="alternate"[^>]*href=")[^"]*(")/g, (x, p, s) => p + URL + s);

// Разметку разбираем поштучно, а не сносим целиком. Organization и WebSite
// одинаковы на всех страницах и нужны здесь так же, как везде; WebPage и
// BreadcrumbList описывают конкретный документ - их переписываем под этот.
head = head.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
  let j;
  try { j = JSON.parse(body); } catch (e) { return ''; }
  const type = Array.isArray(j['@graph']) ? j['@graph'].map(x => x['@type']).join('+') : j['@type'];
  if (/Organization|WebSite/.test(type)) return whole;
  if (type === 'BreadcrumbList') {
    j.itemListElement = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://3dmolierstudio.com/' },
      { '@type': 'ListItem', position: 2, name: 'Model Licences', item: URL },
    ];
    return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
  }
  if (type === 'WebPage') {
    j.name = TITLE;
    j.description = DESC;
    j.url = URL;
    if (j['@id']) j['@id'] = URL + '#webpage';
    delete j.dateModified;
    j.dateModified = TODAY;
    return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
  }
  return '';
});

const TS = 'https://www.turbosquid.com/?referral=3d_molier-international';
const LEGAL = 'https://3dmolier.com/legal';

const MAIN = `<main id="main-content" class="legal-wrap">
<div class="legal-head">
<div class="section-label">Buying</div>
<h1 class="legal-h1">Model Licences Explained</h1>
<p class="legal-lead">Every model page shows a licence in its Specifications table. There are two, and the difference decides what you may do with the model after you buy it. This page says what each one means in practice.</p>
<p class="legal-updated">Last updated: <time datetime="${TODAY}">${TODAY_HUMAN}</time></p>
</div>
<div class="legal-body">
<h2>The short version</h2>
<p><strong>Royalty Free</strong> - buy once, use in commercial work. Client projects, released games, broadcast, print, advertising. You pay nothing further, however many times the finished work is shown or sold.</p>
<p><strong>Editorial Uses Only</strong> - the model shows a real branded product, so it may be used in editorial contexts: news, commentary, documentary, education, portfolio and personal work. It may not be used in advertising, on merchandise, or in anything offered for sale.</p>
<p>Neither licence lets you resell or redistribute the model file itself. That is the one rule both share.</p>

<h2>Why some models are Editorial Uses Only</h2>
<p>A model of a Tesla Model 3, a Boeing 737 or an iPhone depicts a product someone else owns the trademark to. Marketplaces list such models under an editorial licence because using them commercially would trade on a brand that is not ours to license. This is TurboSquid's rule, applied to the listing, not a limitation we add.</p>
<p>It is not a warning about quality. An Editorial model is built the same way as any other in the catalogue and carries the same certification.</p>

<h2>How to tell which one you are looking at</h2>
<p>Open any model page and find the <strong>Licence</strong> row in the Specifications table on the right. It says either <em>Royalty Free (TurboSquid)</em> or <em>Editorial Uses Only (TurboSquid)</em>. The questions section further down the page repeats the same answer in plain words.</p>
<p>The listing on <a href="${TS}" target="_blank" rel="noopener">TurboSquid</a> is the authoritative source. If our page and the listing ever disagree, the listing is right - tell us and we will fix the page.</p>

<h2>Common cases</h2>
<p><strong>An advertising campaign.</strong> Royalty Free, yes. Editorial, no - regardless of how the model is edited or how small it appears in the frame.</p>
<p><strong>A film or television production.</strong> Royalty Free, yes. Editorial models are fine in documentary and news contexts; a fictional feature that is sold or licensed is commercial use, so it needs a Royalty Free model.</p>
<p><strong>A game you intend to sell.</strong> Royalty Free only.</p>
<p><strong>A portfolio piece, a student project, a personal render.</strong> Both licences allow it.</p>
<p><strong>Architectural visualisation for a client.</strong> Royalty Free. A branded car in the driveway of a rendering sold to a developer is commercial use.</p>
<p><strong>Reselling the file, or bundling it into an asset pack.</strong> Neither licence allows it.</p>

<h2>Modifying a model</h2>
<p>Both licences allow editing: retopologising, changing materials, cutting the model down, adapting it to your pipeline. Editing an Editorial model does not turn it into a Royalty Free one - the restriction follows what the model depicts, not how much of it you changed.</p>

<h2>Where the binding terms live</h2>
<p>This page explains; it does not govern. The terms that actually apply are in our <a href="${LEGAL}" target="_blank" rel="noopener">Licence Agreement</a>, which also covers refunds, and in TurboSquid's own licence terms shown at checkout. Where this page and those documents differ, those documents prevail. Our <a href="/terms/">Terms of Use</a> say the same.</p>
<p>If you need a model for a use its licence does not cover, <a href="/custom-order/">commission one</a>: a model built for you carries no third-party trademark and no editorial restriction.</p>
</div>
</main>`;

if (!DRY) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), head + MAIN + tail);
}
console.log('страница /license/ собрана, ' + Math.round((head + MAIN + tail).length / 1024) + ' КБ');

// ── ссылка из строки Licence на карточках ──
let live = 0, linked = 0, already = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  // Проверяем именно строку Licence, а не любую ссылку на /license/: после
  // того как ссылка появилась в подвале, простая проверка стала срабатывать
  // на каждой странице, и скрипт молча переставал линковать новые карточки.
  if (/<th[^>]*>Licence<\/th><td[^>]*><a href="\/license\/">/.test(h)) { already++; continue; }
  const before = h;
  h = h.replace(/(<th[^>]*>Licence<\/th><td[^>]*>)((?:Royalty Free|Editorial Uses Only) \(TurboSquid\))(<\/td>)/,
    (x, p, val, s) => p + '<a href="/license/">' + val + '</a>' + s);
  if (h === before) continue;
  linked++;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('карточек: ' + live + ', ссылка проставлена: ' + linked
  + (already ? ', уже было: ' + already : ''));
if (DRY) console.log('(--dry, ничего не записано)');
