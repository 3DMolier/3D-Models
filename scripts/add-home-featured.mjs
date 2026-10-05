/*
 * add-home-featured.mjs - блок «Hand-picked models» на главной.
 *
 * Зачем. 05.10.2026 проверка в Search Console: единственная проиндексированная
 * страница сайта - главная. Карточки Google либо «обошёл и не проиндексировал»,
 * либо не видел вовсе. Ссылки на карточки с главной были только восемь, и те -
 * бестселлеры; до остальных робот идёт через каталог и 1 105 страниц разбивки.
 *
 * Блок даёт короткий путь от самой обходимой страницы к тем карточкам, ради
 * которых обход и нужен: у них рукописное описание, то есть живой уникальный
 * текст, а не шаблон. Человеку он тоже полезен - это витрина лучшего, с ценой
 * и разделом, а не ссылочная свалка ради робота.
 *
 * Список берётся из data/priority-slugs.json (его собирает build-priority-sitemap.mjs)
 * и устойчив: порядок задан продажами, а не случайностью, поэтому при ежедневной
 * сборке блок не дёргается и страница не переписывается впустую.
 *
 * Запуск: node scripts/add-home-featured.mjs [--n 30]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const N = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) : 30;
const BEGIN = '<!-- HOME-FEATURED:BEGIN -->';
const END = '<!-- HOME-FEATURED:END -->';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hand = (() => {
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-hand-desc.json'), 'utf8')))); }
  catch { return new Set(); }
})();
const priority = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'priority-slugs.json'), 'utf8')); }
  catch { return []; }
})();
if (!priority.length) { console.log('data/priority-slugs.json пуст - сначала node scripts/build-priority-sitemap.mjs'); process.exit(1); }

// Записи нужны ради названия, цены и раздела: в блоке не должно быть голых адресов.
const bySlug = new Map();
for (let i = 0; i < 40; i++) {
  const f = path.join(ROOT, 'data', 'records', `records-${i}.json`);
  if (!fs.existsSync(f)) continue;
  for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    if (r.status === 'live') bySlug.set(r.slug, r);
  }
}

const pick = [];
for (const slug of priority) {
  if (!hand.has(slug)) continue;            // только с рукописным текстом
  const r = bySlug.get(slug);
  if (!r) continue;
  pick.push(r);
  if (pick.length >= N) break;
}
if (pick.length < 6) { console.log(`годных карточек всего ${pick.length} - блок не ставлю`); process.exit(1); }

const catSlug = r => (r.category || '').toLowerCase();
const items = pick.map(r =>
  '<a href="/models/' + r.slug + '/" class="hp-feat-item">'
  + '<span class="hp-feat-name">' + esc(r.display_name || r.name) + '</span>'
  + '<span class="hp-feat-meta">' + esc(r.category_name || '') + (r.price ? ' &#183; $' + r.price : '') + '</span>'
  + '</a>').join('');

const block = BEGIN + `
<section class="page-section" id="hand-picked">
  <div class="max-w-7xl mx-auto">
    <div class="sec-head">
      <h2 class="section-h2">Hand-picked models</h2>
      <a href="/catalog/" class="sec-more">Whole catalogue &rarr;</a>
    </div>
    <p class="hp-feat-lead">Models we have written up ourselves - what they are, how they are built and where they fit.</p>
    <div class="hp-feat-grid">${items}</div>
  </div>
</section>
<style>
.hp-feat-lead{color:var(--muted,#6b7280);margin:0 0 18px;max-width:70ch}
.hp-feat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
/* color:inherit обязателен: без него браузер красит название своим синим
   (rgb(0,0,238)), и блок выпадает из оформления сайта - поймано на проде. */
.hp-feat-item{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--line,#e5e7eb);border-radius:10px;text-decoration:none;color:inherit;min-height:44px;justify-content:center}
.hp-feat-item:hover{border-color:var(--accent,#0ea5e9)}
.hp-feat-name{font-weight:600;line-height:1.3;color:inherit}
.hp-feat-meta{font-size:13px;color:var(--muted,#6b7280)}
</style>
` + END;

const file = path.join(ROOT, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const had = html.includes(BEGIN);

if (had) {
  const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const next = html.replace(re, block);
  if (next === html) { console.log('блок на месте и не изменился'); process.exit(0); }
  html = next;
} else {
  // Ставим сразу после блока бестселлеров - он уже про модели, продолжение логично.
  const anchor = '<section class="page-section page-section--gray" id="best-sellers">';
  const at = html.indexOf(anchor);
  if (at < 0) { console.log('не нашёл блок бестселлеров на главной - вставлять некуда'); process.exit(1); }
  const close = html.indexOf('</section>', at);
  if (close < 0) { console.log('не нашёл конец блока бестселлеров'); process.exit(1); }
  const cut = close + '</section>'.length;
  html = html.slice(0, cut) + '\n' + block + '\n' + html.slice(cut);
}

fs.writeFileSync(file, html, 'utf8');
console.log(`${had ? 'обновлён' : 'добавлен'} блок Hand-picked models: ${pick.length} карточек`);
