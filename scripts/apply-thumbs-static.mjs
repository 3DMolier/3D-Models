/*
 * apply-thumbs-static.mjs - миниатюры и партнёрские ссылки на страницах БЕЗ генератора (13.11.2026).
 *
 * Карточки, категории, подкатегории, подборки и хаб категорий пересобирают их генераторы (lib/thumbs.mjs).
 * Здесь - всё остальное: главная и каталог (витрины - свой WebP), отрасли, игры, About, FAQ и прочие
 * (кадры TurboSquid через прокси wsrv.nl), и у всех - rel="sponsored noopener" на ссылках TurboSquid с referral.
 * Повторный запуск ничего не меняет: переведённые картинки и помеченные ссылки пропускаются.
 *
 *   node scripts/apply-thumbs-static.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { rewriteImgs, sponsorLinks } from './lib/thumbs.mjs';

const DRY = process.argv.includes('--dry');
const SKIP = /^(\.git|\.claude|\.tmp|\.github|node_modules|models|categories|collections|browse|partials|preview|t|scripts|tools|data|assets|sitemaps)$/;
const SHOWCASE = new Set(['index.html', 'catalog/index.html']);
const files = [];
const walk = (d, rel = '') => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!(rel === '' && SKIP.test(e.name))) walk(path.join(d, e.name), r); }
    else if (e.name.endsWith('.html')) files.push(r);
  }
};
walk(ROOT);
// Шапка и подвал (partials) - источник для всех генераторов: ссылки TurboSquid в них помечаем тоже.
for (const p of ['partials/header.html', 'partials/footer.html']) if (fs.existsSync(path.join(ROOT, p))) files.push(p);

let changed = 0, imgs = 0, links = 0;
for (const f of files) {
  const file = path.join(ROOT, f);
  const t = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(t.slice(0, 1500))) continue;
  let h = rewriteImgs(t, { showcase: SHOWCASE.has(f) });
  imgs += (h.match(/data-orig="/g) || []).length - (t.match(/data-orig="/g) || []).length;
  const h2 = sponsorLinks(h);
  links += (h2.match(/rel="sponsored /g) || []).length - (h.match(/rel="sponsored /g) || []).length;
  if (h2 !== t) { changed++; if (!DRY) fs.writeFileSync(file, h2); }
}
console.log(`страниц просмотрено ${files.length}, изменено ${changed}; картинок переведено ${imgs}, ссылок помечено ${links}` + (DRY ? ' (--dry)' : ''));
