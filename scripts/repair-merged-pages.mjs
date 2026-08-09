// repair-merged-pages.mjs — исправление объединённых карточек по замечаниям.
//
// 1. Восстановить заголовок Specifications. При вставке списка вариантов я применил
//    замену функцией с '$1' внутри — в функции это НЕ подстановка группы, а literal.
//    В итоге заголовок затёрся строкой «$1».
// 2. Убрать дубли в блоке «похожие»: после перевода ссылок на главную карточку там
//    оказалось по несколько карточек, ведущих на один адрес.
// 3. Упорядочить список вариантов: главный первым, дальше по номеру выпуска.
//
// Запуск:  node scripts/repair-merged-pages.mjs --dry
//          node scripts/repair-merged-pages.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

// ── 1. заголовок Specifications ──
const fixHeading = h => h.replace(/<\/section>\$1<\/h2>/g, '</section><h2 class="mp-block-h2">Specifications</h2>');

// ── 2. дубли в блоке похожих ──
function dedupeRelated(h) {
  const start = h.indexOf('Related 3D Models');
  if (start === -1) return h;
  const secStart = h.lastIndexOf('<section', start);
  const secEnd = h.indexOf('</section>', start);
  if (secStart === -1 || secEnd === -1) return h;
  const sec = h.slice(secStart, secEnd + 10);

  // карточка = <a href="/models/SLUG/" …> … </a>
  const cards = [...sec.matchAll(/<a href="\/models\/([^"\/]+)\/"[\s\S]*?<\/a>/g)];
  if (cards.length < 2) return h;
  const seen = new Set();
  let out = sec;
  for (const c of cards) {
    if (seen.has(c[1])) out = out.replace(c[0], '');   // повтор того же адреса
    else seen.add(c[1]);
  }
  return out === sec ? h : h.slice(0, secStart) + out + h.slice(secEnd + 10);
}

// ── 3. порядок вариантов ──
function sortVariants(h) {
  const m = h.match(/(<ul class="mp-var-list">)([\s\S]*?)(<\/ul>)/);
  if (!m) return h;
  const items = [...m[2].matchAll(/<li class="mp-var[^"]*">[\s\S]*?<\/li>/g)].map(x => x[0]);
  if (items.length < 3) return h;

  const key = li => {
    if (/is-main/.test(li)) return [-1, ''];                  // главный всегда первым
    const name = (li.match(/mp-var-name">([^<]*)/) || [])[1] || '';
    const num = name.match(/(\d+)/);
    return [num ? +num[1] : 9999, name];
  };
  const sorted = items.slice().sort((a, b) => {
    const ka = key(a), kb = key(b);
    return (ka[0] - kb[0]) || String(ka[1]).localeCompare(String(kb[1]));
  });
  if (sorted.join('') === items.join('')) return h;
  return h.replace(m[0], m[1] + sorted.join('') + m[3]);
}

// ── обход ──
const slugs = fs.readdirSync(MODELS);
let touched = 0, headings = 0, deduped = 0, sorted = 0, checked = 0;
for (const s of slugs) {
  const f = path.join(MODELS, s, 'index.html');
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (++checked % 20000 === 0) console.log('  ' + checked + '/' + slugs.length + '  исправлено ' + touched);

  const before = h;
  const a = fixHeading(h); if (a !== h) headings++;
  const b = dedupeRelated(a); if (b !== a) deduped++;
  const c = sortVariants(b); if (c !== b) sorted++;
  if (c === before) continue;

  if (!c.includes('<a href="/categories/other/" role="menuitem"')) { console.log('СТОП: меню на ' + s); process.exit(1); }
  for (const blk of c.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(blk.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { console.log('СТОП: битый JSON-LD на ' + s); process.exit(1); }
  }
  if (!DRY) fs.writeFileSync(f, c);
  touched++;
}

console.log('\nстраниц изменено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('  заголовок Specifications восстановлен: ' + headings);
console.log('  дублей в блоке похожих убрано:         ' + deduped);
console.log('  списков вариантов упорядочено:         ' + sorted);
