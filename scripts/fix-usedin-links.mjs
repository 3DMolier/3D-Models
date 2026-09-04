// fix-usedin-links.mjs - в секции "Used In" на страницах моделей превратить неактивные
// <span class="chip chip--sm">Industry</span> в кликабельные ссылки <a href="/industries/slug/">.
// Затрагивает ТОЛЬКО блок <div class="mp-industries">...<div class="mp-chip-row">...</div>,
// чтобы не задеть subject-чип и прочие span. Идемпотентно (уже-ссылки пропускает).
//   node scripts/fix-usedin-links.mjs --dry   (только счёт)
//   node scripts/fix-usedin-links.mjs         (правка)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

// карта name -> slug из enhance-thin-pages.mjs (IND), чтобы не расходилось
const src = fs.readFileSync(path.join(ROOT, 'scripts', 'enhance-thin-pages.mjs'), 'utf8');
const IND = eval('({' + src.split('const IND = {')[1].split('};')[0] + '})');
const NAME2SLUG = {};
for (const arr of Object.values(IND)) for (const [n, h] of arr) NAME2SLUG[n] = h;
console.log('индустрий в карте:', Object.keys(NAME2SLUG).length, Object.keys(NAME2SLUG).join(', '));

// блок Used In целиком
const BLOCK = /(<div class="mp-industries"><div class="mp-field-label">Used In<\/div><div class="mp-chip-row">)([\s\S]*?)(<\/div><\/div>)/;
const SPAN = /<span class="chip chip--sm">([^<]+)<\/span>/g;

let scanned = 0, changed = 0, spansFixed = 0, unknown = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') fixFile(p);
  }
}
function fixFile(file) {
  scanned++;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(BLOCK);
  if (!m) return;
  const inner = m[2];
  if (!inner.includes('<span')) return; // уже ссылки
  let localFixed = 0;
  const newInner = inner.replace(SPAN, (whole, name) => {
    const slug = NAME2SLUG[name] || NAME2SLUG[name.replace('&amp;', '&')];
    if (!slug) { unknown.add(name); return whole; }
    localFixed++;
    return `<a href="/industries/${slug}/" class="chip chip--sm">${name}</a>`;
  });
  if (localFixed === 0) return;
  const out = html.replace(BLOCK, m[1] + newInner + m[3]);
  if (!DRY) fs.writeFileSync(file, out, 'utf8');
  changed++; spansFixed += localFixed;
}
walk(MODELS);
console.log(`Просмотрено ${scanned}, страниц изменено ${changed}, чипов -> ссылок ${spansFixed}` + (DRY ? '  [DRY]' : ''));
if (unknown.size) console.log('НЕИЗВЕСТНЫЕ имена (пропущены):', [...unknown].join(' | '));
