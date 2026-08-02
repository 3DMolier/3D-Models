// add-legal-footer-links.mjs — ссылки на /privacy/ и /terms/ в футер статических страниц.
// Карточки моделей правит enrich-cards.mjs (блок mp-footer-legal), здесь — всё остальное.
// Аудит seo-content показал 0 ссылок на Privacy со всего сайта, а Trust — самый тяжёлый
// фактор E-E-A-T в модели скилла (30 из 100).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const LINKS = '<a href="/privacy/" class="footer-link">Privacy</a>\n      <a href="/terms/" class="footer-link">Terms</a>';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'models' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

// На сайте два вида футера: простой (about, contact, коллекции) и трёхколоночный
// cat-footer (категории, отрасли, browse). Обрабатываем оба.
const VARIANTS = [
  {
    name: 'простой',
    anchor: /(<a href="\/custom-order\/" class="footer-link">Custom Order<\/a>)/,
    add: m => m + '\n      ' + LINKS,
  },
  {
    name: 'cat-footer',
    anchor: /(<p class="cat-footer-copy">[\s\S]*?<\/p>)/,
    add: m => m + '\n      <div class="cat-footer-legal">' +
      '<a href="/about/" class="nav-link">About</a>' +
      '<a href="/contact/" class="nav-link">Contact</a>' +
      '<a href="/privacy/" class="nav-link">Privacy</a>' +
      '<a href="/terms/" class="nav-link">Terms</a></div>',
  },
];

const files = walk(ROOT);
const stat = { already: 0, noFooter: 0 };
for (const v of VARIANTS) stat[v.name] = 0;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (src.includes('href="/privacy/"')) { stat.already++; continue; }
  const v = VARIANTS.find(v => v.anchor.test(src));
  if (!v) { stat.noFooter++; continue; }
  const next = src.replace(v.anchor, v.add);
  if (next === src) { stat.noFooter++; continue; }
  if (!DRY) fs.writeFileSync(f, next);
  stat[v.name]++;
}
console.log('страниц: ' + files.length + (DRY ? '   (--dry, не записано)' : ''));
for (const v of VARIANTS) console.log('  футер «' + v.name + '»: ' + stat[v.name]);
console.log('  уже были ссылки: ' + stat.already);
console.log('  футер не распознан: ' + stat.noFooter);
