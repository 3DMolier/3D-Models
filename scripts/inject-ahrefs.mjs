/*
 * inject-ahrefs.mjs - счётчик Ahrefs Web Analytics во все настоящие страницы сайта.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫМ ШАГОМ, А НЕ В КАЖДОМ ГЕНЕРАТОРЕ. <head> пишут больше десяти
 * генераторов и ручные страницы; правка каждого - десять мест, где можно промахнуться,
 * и следующий новый генератор снова забудет. Шаг стоит в ежедневной сборке
 * (daily-site-update.mjs) после всех генераторов, поэтому пересборка счётчик не сотрёт.
 * Повторный запуск ничего не меняет. Дату изменения страниц не двигает: lib/lastmod.mjs
 * вырезает счётчик из сравнения содержимого.
 *
 *   node scripts/inject-ahrefs.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { injectAhrefs } from './lib/ahrefs.mjs';

const DRY = process.argv.includes('--dry');
const SKIP = new Set(['.git', 'node_modules', 'scripts', 'tools', 'data', 'assets', 'preview', 'previews', 'temporary screenshots', 'large_images']);
let seen = 0, added = 0;
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('_')) walk(path.join(d, e.name)); continue; }
    if (!e.name.endsWith('.html')) continue;
    const p = path.join(d, e.name);
    const s = fs.readFileSync(p, 'utf8');
    seen++;
    const t = injectAhrefs(s);
    if (t !== s) { added++; if (!DRY) fs.writeFileSync(p, t); }
  }
};
walk(ROOT);
console.log('страниц просмотрено: ' + seen.toLocaleString('ru-RU') + ', счётчик добавлен: ' + added.toLocaleString('ru-RU') + (DRY ? ' (--dry)' : ''));
