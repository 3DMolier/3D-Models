/*
 * fix-broken-category-links.mjs — разовая правка ссылок на несуществующие хабы.
 *
 * Ahrefs при обходе 19.08.2026 нашёл шесть страниц с 404, и две из них оказались
 * хабами категорий, на которые ведут ссылки из карточек:
 *     /categories/medical/       804 карточки   (хаб живёт на medical-3d-models)
 *     /categories/space-sci-fi/  225 карточек   (хаб живёт на space-scifi)
 * Причина - в card-content.mjs адрес хаба вычислялся из названия категории общим
 * правилом. Для 25 категорий из 27 правило работает, для этих двух - нет.
 * Причина уже исправлена там же (см. catSlug), этот скрипт лечит уже выпущенные
 * страницы.
 *
 * Меняется только адрес в href. Видимый текст ссылки («Medical», «Space & Sci-Fi»)
 * и так был правильным, его не трогаем.
 *
 * Запуск:  node fix-broken-category-links.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

const FIX = [
  ['href="/categories/medical/"', 'href="/categories/medical-3d-models/"'],
  ['href="/categories/space-sci-fi/"', 'href="/categories/space-scifi/"'],
];

// Проверяем, что цели существуют: чинить ссылку на другую несуществующую страницу
// было бы хуже, чем оставить как есть.
for (const [, to] of FIX) {
  const slug = to.match(/categories\/([^/]+)/)[1];
  if (!fs.existsSync(path.join(ROOT, 'categories', slug, 'index.html'))) {
    console.error('ОСТАНОВКА: хаб /categories/' + slug + '/ не найден на диске');
    process.exit(1);
  }
}

let scanned = 0, changed = 0;
const counts = {};

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (e.name !== 'index.html') continue;
    scanned++;
    let html = fs.readFileSync(p, 'utf8');
    let hit = false;
    for (const [from, to] of FIX) {
      if (!html.includes(from)) continue;
      html = html.split(from).join(to);
      counts[from] = (counts[from] || 0) + 1;
      hit = true;
    }
    if (!hit) continue;
    changed++;
    if (!DRY) fs.writeFileSync(p, html);
  }
}

walk(path.join(ROOT, 'models'));
// Хабы и подборки тоже могли получить такую ссылку из общего генератора.
for (const d of ['categories', 'collections', 'industries']) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full);
}

console.log('просмотрено страниц: ' + scanned);
console.log('исправлено: ' + changed + (DRY ? '  (пробный прогон, ничего не записано)' : ''));
for (const [k, v] of Object.entries(counts)) console.log('   ' + k + ' -> ' + v);
