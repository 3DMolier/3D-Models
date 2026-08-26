/*
 * fix-fullpreview-links.mjs - переводит ссылки TurboSquid со старой формы на товарную.
 *
 * Зачем. На части карточек в витрине версий стоит адрес вида
 *   https://www.turbosquid.com/FullPreview/<id>?referral=...
 * Он рабочий, но это редирект: покупатель делает лишний переход, а часть
 * трафика на редиректах теряется. Каноническая форма - /3d-models/<slug>-<id>.
 *
 * Откуда берём канонический адрес. У модели с этим id есть собственная карточка
 * на сайте, и в ней уже стоит правильная ссылка. Никаких догадок: если карточки
 * нет или ссылки в ней нет, оставляем как было.
 *
 * Реферал переносим из старого адреса, а если его там не было - подставляем
 * общий 3d_molier-international в нижнем регистре.
 *
 * Запуск:  node scripts/fix-fullpreview-links.mjs --dry
 *          node scripts/fix-fullpreview-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const REFERRAL = 'referral=3d_molier-international';
const copy = s => Buffer.from(String(s), 'utf8').toString('utf8');

// id -> папка карточки
const byId = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const m = d.match(/-(\d+)$/);
  if (m) byId.set(m[1], copy(d));
}

const canon = new Map();
function canonFor(id) {
  if (canon.has(id)) return canon.get(id);
  let url = null;
  const dir = byId.get(id);
  if (dir) {
    try {
      const h = fs.readFileSync(path.join(MODELS, dir, 'index.html'), 'utf8');
      // именно ссылка на этот же товар, а не на соседнюю версию из витрины
      const re = new RegExp('https?://(?:www\\.)?turbosquid\\.com/3d-models/[^"\'\\s]*?' + id + '[^"\'\\s]*', 'g');
      const hit = (h.match(re) || [])[0];
      if (hit) url = copy(hit).replace(/[?&]referral=[^&"']*/g, '');
    } catch (e) { /* карточки нет */ }
  }
  canon.set(id, url);
  return url;
}

const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(next);
    else if (e.name === 'index.html') pages.push(next);
  }
})('');

let touched = 0, fixed = 0, kept = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  if (!/turbosquid\.com\/FullPreview\//.test(html)) continue;
  let n = 0;
  const out = html.replace(/https?:\/\/(?:www\.)?turbosquid\.com\/FullPreview\/(\d+)([^"'\s]*)/g, (m, id, tail) => {
    const base = canonFor(id);
    if (!base) { kept++; return m; }
    const ref = (tail.match(/referral=[^&"']*/) || [])[0] || REFERRAL;
    const norm = /^referral=3d_molier-international$/.test(ref) ? ref : REFERRAL;
    n++;
    return base + (base.includes('?') ? '&' : '?') + norm;
  });
  if (n) {
    touched++; fixed += n;
    if (!DRY) fs.writeFileSync(file, out);
  }
}
console.log('страниц изменено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('ссылок переведено на товарную форму: ' + fixed + ', оставлено без замены: ' + kept);
