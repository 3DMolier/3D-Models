/*
 * fix-legacy-links.mjs - убирает ссылки на прошлое поколение сайта.
 *
 * По списку правок основателя (P0, пункты 3-5, 7, 20-21):
 *
 * 1. /full-catalog/ - страница заменена сообщением «This page has moved».
 *    На неё ведут 129 внутренних ссылок, в основном из /browse/. Каждая такая
 *    ссылка заставляет Google идти через промежуточную страницу. Переводим их
 *    сразу на /catalog/.
 *
 * 2. Старые подборки /collections/best-*-3d-models/ - это заглушки-редиректы,
 *    а Best Military вообще нет на диске. При этом на них ссылаются все 12
 *    отраслевых страниц. Переводим на конечный адрес каждой заглушки; для
 *    Best Aircraft конечного адреса нет (заглушка ведёт на общий /collections/),
 *    поэтому отправляем на реальную категорию /categories/aircraft/.
 *
 * 3. Формулировка «Top 1000» - имя прошлой архитектуры. Страницы с тысячей
 *    избранных моделей больше нет, а подпись осталась ссылкой на /catalog/.
 *    Меняем на нейтральное «View catalog».
 *
 * Запуск:  node scripts/fix-legacy-links.mjs --dry
 *          node scripts/fix-legacy-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');

// куда ведут заглушки старых подборок (прочитано из самих заглушек)
const BEST = {
  '/collections/best-vehicle-3d-models/': '/collections/vehicles/',
  '/collections/best-medical-3d-models/': '/collections/science-medical/',
  '/collections/best-military-vehicle-3d-models/': '/collections/weapons/',
  // заглушка ведёт на общий /collections/ - это не ответ на запрос «лучшие
  // самолёты», поэтому отправляем в категорию, где они действительно есть
  '/collections/best-aircraft-3d-models/': '/categories/aircraft/',
};

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

let tFull = 0, tBest = 0, tTop = 0, touched = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  let out = html;

  // 1. /full-catalog/ -> /catalog/  (кроме самой страницы-указателя)
  if (!rel.startsWith('full-catalog/')) {
    const n = (out.match(/href="\/full-catalog\/"/g) || []).length;
    if (n) { out = out.split('href="/full-catalog/"').join('href="/catalog/"'); tFull += n; }
  }

  // 2. старые подборки -> живые адреса
  for (const [from, to] of Object.entries(BEST)) {
    const n = (out.match(new RegExp('href="' + from.replace(/\//g, '\\/') + '"', 'g')) || []).length;
    if (n) { out = out.split('href="' + from + '"').join('href="' + to + '"'); tBest += n; }
  }

  // 3. «Top 1000» как подпись ссылки
  if (/Top 1000/.test(out)) {
    const before = out;
    out = out.replace(/>Top 1000\s*(&rarr;|→)?\s*</g, (m, arrow) => '>View catalog ' + (arrow || '&rarr;') + '<');
    out = out.replace(/Top 1000 Models/g, 'Model catalog');
    out = out.replace(/Top 1000/g, 'Catalog');
    if (out !== before) tTop++;
  }

  if (out !== html) {
    touched++;
    if (!DRY) fs.writeFileSync(file, out);
  }
}
console.log('страниц изменено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('  ссылок /full-catalog/ -> /catalog/: ' + tFull);
console.log('  ссылок на старые подборки переведено: ' + tBest);
console.log('  страниц с «Top 1000» поправлено: ' + tTop);
