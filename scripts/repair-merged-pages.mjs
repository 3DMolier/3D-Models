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
// Литерал «$1» стоит там, где был открывающий тег заголовка вместе со словом
// Specifications, а закрывающий </h2> уцелел. Встречается в двух окружениях —
// сразу после </section> и внутри <div class="mp-spec-block">, поэтому чиним
// по самому литералу с закрывающим тегом, а не по соседям.
const fixHeading = h => h
  .replace(/\$1<\/h2>/g, '<h2 class="mp-block-h2">Specifications</h2>')
  .replace(/<h2 class="mp-block-h2">Specifications<\/h2>\s*<h2 class="mp-block-h2">Specifications<\/h2>/g,
    '<h2 class="mp-block-h2">Specifications</h2>');

// ── 2. дубли в блоке похожих ──
function dedupeRelated(h, selfSlug) {
  const start = h.indexOf('Related 3D Models');
  if (start === -1) return h;
  const secStart = h.lastIndexOf('<section', start);
  const secEnd = h.indexOf('</section>', start);
  if (secStart === -1 || secEnd === -1) return h;
  const sec = h.slice(secStart, secEnd + 10);

  // карточка = <a href="/models/SLUG/" …> … </a>
  const cards = [...sec.matchAll(/<a href="\/models\/([^"\/]+)\/"[\s\S]*?<\/a>/g)];
  if (cards.length < 2) return h;
  // Убираем повторы и ссылку на саму себя: после объединения карточки вариантов
  // ведут на главную, и в блоке «похожие» появлялась ссылка страницы на себя же.
  // Варианты и так перечислены выше, в списке форматов.
  const seen = new Set();
  let out = sec;
  for (const c of cards) {
    if (c[1] === selfSlug || seen.has(c[1])) out = out.replace(c[0], '');
    else seen.add(c[1]);
  }
  return out === sec ? h : h.slice(0, secStart) + out + h.slice(secEnd + 10);
}

// ── 3. заголовок серии ──
// У карточек-серий заголовок остался от главной записи: «Rigged African Animals
// Collection 7 for Maya» на карточке из 42 выпусков. Как название серии это
// бессмыслица. Приводим к нормализованному виду — «African Animals Collection».
const SOFT_T = /\s+for\s+(maya|cinema\s*4d|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\s*$/i;
function fixSeriesTitle(h) {
  if (!h.includes('All Sets in This Series')) return h;
  const m = h.match(/<h1 class="mp-h1">([^<]*)<\/h1>/);
  if (!m) return h;
  const clean = m[1]
    .replace(SOFT_T, '')
    .replace(/\s+(?:[1-9]|1\d|20)\s*$/, '')
    .replace(/\s*\b3d\s+models?\b\s*/ig, ' ')
    .replace(/\s*\b(?:rigged|rigid)\b\s*/ig, ' ')
    .replace(/\s{2,}/g, ' ').trim();
  if (!clean || clean === m[1] || clean.length < 6) return h;
  return h.replace(m[0], '<h1 class="mp-h1">' + clean + '</h1>');
}

// ── 4. порядок вариантов ──
function sortVariants(h) {
  const m = h.match(/(<ul class="mp-var-list">)([\s\S]*?)(<\/ul>)/);
  if (!m) return h;
  const items = [...m[2].matchAll(/<li class="mp-var[^"]*">[\s\S]*?<\/li>/g)].map(x => x[0]);
  if (items.length < 3) return h;

  const key = li => {
    if (/is-main/.test(li)) return [-1, ''];                  // главный всегда первым
    const name = (li.match(/mp-var-name">([^<]*)/) || [])[1] || '';
    // Номер берём ТОЛЬКО после слова Collection. Иначе первая цифра находилась
    // в «3D Models», и подпись «Collection 7 · 3D Models» сортировалась как 3.
    const num = name.match(/\bcollections?\s+(\d+)/i);
    return [num ? +num[1] : 0, name];
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
let touched = 0, headings = 0, deduped = 0, sorted = 0, titles = 0, checked = 0;
for (const s of slugs) {
  const f = path.join(MODELS, s, 'index.html');
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (++checked % 20000 === 0) console.log('  ' + checked + '/' + slugs.length + '  исправлено ' + touched);

  const before = h;
  const a = fixHeading(h); if (a !== h) headings++;
  const b = dedupeRelated(a, s); if (b !== a) deduped++;
  const t = fixSeriesTitle(b); if (t !== b) titles++;
  const c = sortVariants(t); if (c !== t) sorted++;
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
console.log('  заголовков серий поправлено:           ' + titles);
