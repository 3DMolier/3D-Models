// rebuild-related.mjs — пересборка блока «похожие» целиком.
//
// Заплатки не сработали, поэтому блок собирается заново:
//   • ровно 6 карточек ВНУТРИ сетки .mp-related-grid — прошлая версия вставляла их
//     после закрывающих </div>, карточки оказывались вне сетки и растягивались
//     во всю ширину, ломая вёрстку;
//   • подбор по СХОЖЕСТИ названия, а не по алфавиту — иначе рядом с коллекцией
//     африканских животных стояли «Blue Locomotive», «Blue Nike Joggers»,
//     «Blue Nokia 3310», «Blue Nudibranch»: просто соседи по списку на букву B;
//   • только живые страницы, без самой себя и без свёрнутых вариантов.
//
// Запуск:  node scripts/rebuild-related.mjs --dry
//          node scripts/rebuild-related.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const WANT = 6;

function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const info = new Map();
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  info.set(r[ix('slug')], {
    name: r[ix('product_name')] || '', price: +r[ix('price')] || 0,
    cat: r[ix('category')] || '', sub: r[ix('subcategory')] || '',
  });
}

const alive = new Set(fs.readdirSync(MODELS));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// слова названия без служебных — по ним и меряем схожесть
const STOP = new Set(['3d', 'model', 'models', 'the', 'and', 'for', 'with', 'of', 'a', 'an', 'in', 'on',
  'rigged', 'rigid', 'animated', 'pose', 'collection', 'set', 'new', 'old', 'blue', 'red', 'green',
  'black', 'white', 'grey', 'gray', 'silver', 'gold', 'yellow', 'orange', 'pink', 'purple', 'brown']);
const words = n => new Set(String(n).toLowerCase().match(/[a-z]{3,}/g)?.filter(w => !STOP.has(w)) || []);

const byCat = new Map();
const wordsOf = new Map();
for (const slug of alive) {
  const m = info.get(slug);
  if (!m || !m.cat) continue;
  if (!byCat.has(m.cat)) byCat.set(m.cat, []);
  byCat.get(m.cat).push(slug);
  wordsOf.set(slug, words(m.name));
}

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

// Обратный индекс «слово -> страницы». Без него на каждую из 67 тысяч страниц
// перебиралась вся её категория, а в «Other» их больше десяти тысяч — прогон
// не укладывался и в десять минут. Теперь смотрим только тех, кто делит слово.
const byWord = new Map();
for (const [slug, w] of wordsOf) {
  for (const x of w) {
    if (!byWord.has(x)) byWord.set(x, []);
    const arr = byWord.get(x);
    if (arr.length < 400) arr.push(slug);      // очень частые слова не раздуваем
  }
}

// ── подбор: сперва по общим словам названия, потом по подкатегории, потом по категории ──
function pick(slug) {
  const me = info.get(slug);
  if (!me || !byCat.has(me.cat)) return [];
  const mine = wordsOf.get(slug) || new Set();
  const pool = byCat.get(me.cat);

  const hits = new Map();
  for (const x of mine) {
    for (const cand of (byWord.get(x) || [])) {
      if (cand === slug) continue;
      const c = info.get(cand);
      if (!c || c.cat !== me.cat) continue;    // держимся своей категории
      hits.set(cand, (hits.get(cand) || 0) + 1);
    }
  }
  const scored = [];
  for (const [cand, common] of hits) {
    const sub = (info.get(cand) || {}).sub === me.sub ? 1 : 0;
    scored.push({ cand, score: common * 10 + sub });
  }
  scored.sort((a, b) => b.score - a.score);

  const out = [];
  for (const s of scored) { if (out.length >= WANT) break; const c = card(s.cand); if (c) out.push(c); }
  // добираем по категории, если схожих не хватило
  if (out.length < WANT) {
    const start = Math.abs([...slug].reduce((a, c) => a + c.charCodeAt(0), 0)) % pool.length;
    for (let k = 0; k < pool.length && out.length < WANT; k++) {
      const cand = pool[(start + k) % pool.length];
      if (cand === slug || scored.some(x => x.cand === cand)) continue;
      const c = card(cand);
      if (c) out.push(c);
    }
  }
  return out;
}

let touched = 0, checked = 0, noGrid = 0, thin = 0;
for (const slug of alive) {
  const f = path.join(MODELS, slug, 'index.html');
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (++checked % 20000 === 0) console.log('  ' + checked + '/' + alive.size + '  пересобрано ' + touched);

  const j = h.indexOf('Related 3D Models');
  if (j === -1) continue;
  const gs = h.indexOf('<div class="mp-related-grid">', j);
  const se = h.indexOf('</section>', j);
  if (gs === -1 || se === -1) { noGrid++; continue; }

  const cards = pick(slug);
  if (cards.length < WANT) thin++;
  if (!cards.length) continue;

  // Собираем секцию заново от сетки до конца: так закрывающие теги гарантированно
  // на месте, а карточки — внутри сетки, а не после неё.
  const head = h.slice(0, gs) + '<div class="mp-related-grid">';
  const out = head + cards.join('') + '</div></div></section>' + h.slice(se + 10);

  if (!out.includes('<a href="/categories/other/" role="menuitem"')) { console.log('СТОП: меню на ' + slug); process.exit(1); }
  if (!DRY) fs.writeFileSync(f, out);
  touched++;
}

console.log('\nстраниц пересобрано: ' + touched + (DRY ? '  (--dry)' : ''));
if (noGrid) console.log('без сетки в разметке: ' + noGrid);
if (thin) console.log('нашлось меньше ' + WANT + ' похожих: ' + thin);
