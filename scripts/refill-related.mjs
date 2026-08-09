// refill-related.mjs — дозаполнение блока «похожие» до шести карточек.
//
// После объединения вариантов из блока убрались повторы и ссылки на саму себя,
// и почти у половины страниц осталось меньше шести карточек. Здесь блок дополняется
// живыми моделями той же категории, которых там ещё нет.
//
// Разметка карточки взята с существующей страницы дословно, чтобы вёрстка и стили
// совпадали: model-card card-glow mp-rc-link + img-wrap + mp-rc-body.
//
// Запуск:  node scripts/refill-related.mjs --dry
//          node scripts/refill-related.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const WANT = 6;

// ── каталог ──
function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const info = new Map();
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  info.set(r[ix('slug')], { name: r[ix('product_name')], price: +r[ix('price')] || 0, cat: r[ix('category')] || '' });
}

const alive = new Set(fs.readdirSync(MODELS));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// живые модели по категориям — источник для дозаполнения
const byCat = new Map();
for (const slug of alive) {
  const m = info.get(slug);
  if (!m || !m.cat) continue;
  if (!byCat.has(m.cat)) byCat.set(m.cat, []);
  byCat.get(m.cat).push(slug);
}

// превью берём со страницы модели — там уже проверенные ссылки
const previewCache = new Map();
function preview(slug) {
  if (previewCache.has(slug)) return previewCache.get(slug);
  let u = null;
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    u = (h.match(/property="og:image" content="([^"]+)"/) || [])[1] || null;
  } catch (e) { }
  previewCache.set(slug, u);
  return u;
}

function card(slug) {
  const m = info.get(slug);
  const img = preview(slug);
  if (!m || !img) return null;
  return '<a href="/models/' + slug + '/" class="model-card card-glow mp-rc-link">'
    + '<div class="img-wrap mp-rc-img-wrap"><img src="' + esc(img) + '" alt="' + esc(m.name) + '"'
    + ' width="800" height="450" decoding="async" loading="lazy"'
    + ' data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">'
    + '<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>'
    + '<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">' + esc(m.name) + '</div></div>'
    + '<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">' + esc(m.cat) + '</span>'
    + '<span class="mp-rc-price">$' + m.price + '</span></div></div></a>';
}

let touched = 0, added = 0, checked = 0, noCat = 0;
for (const slug of alive) {
  const f = path.join(MODELS, slug, 'index.html');
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (++checked % 20000 === 0) console.log('  ' + checked + '/' + alive.size + '  дополнено ' + touched);

  const j = h.indexOf('Related 3D Models');
  if (j === -1) continue;
  const gridStart = h.indexOf('<div class="mp-related-grid">', j);
  const secEnd = h.indexOf('</section>', j);
  if (gridStart === -1 || secEnd === -1) continue;
  const inner = h.slice(gridStart + 28, secEnd);

  const have = new Set([...inner.matchAll(/href="\/models\/([^"\/]+)\//g)].map(m => m[1]));
  const need = WANT - have.size;
  if (need <= 0) continue;

  const cat = (info.get(slug) || {}).cat;
  if (!cat || !byCat.has(cat)) { noCat++; continue; }

  const pool = byCat.get(cat);
  const extra = [];
  // берём вразбивку по списку, чтобы у соседних страниц подборка не совпадала
  const start = Math.abs([...slug].reduce((a, c) => a + c.charCodeAt(0), 0)) % pool.length;
  for (let k = 0; k < pool.length && extra.length < need; k++) {
    const cand = pool[(start + k) % pool.length];
    if (cand === slug || have.has(cand)) continue;
    const c = card(cand);
    if (!c) continue;
    have.add(cand);
    extra.push(c);
  }
  if (!extra.length) continue;

  const out = h.slice(0, secEnd) + extra.join('') + h.slice(secEnd);
  if (!out.includes('<a href="/categories/other/" role="menuitem"')) { console.log('СТОП: меню на ' + slug); process.exit(1); }
  if (!DRY) fs.writeFileSync(f, out);
  touched++; added += extra.length;
}

console.log('\nстраниц дополнено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('карточек добавлено: ' + added);
if (noCat) console.log('без категории в каталоге: ' + noCat);
