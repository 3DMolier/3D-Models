/*
 * bump-asset-version.mjs - единая версия у ссылок на CSS и JS.
 *
 * ЗАЧЕМ. Номер в «?v=» - это ключ кеша браузера. Пока он не меняется, вернувшийся
 * посетитель продолжает получать старый файл, даже если на сервере лежит новый.
 *
 * ЧТО БЫЛО. Номера разъехались: styles.min.css стоял как v=40 на 226 страницах,
 * v=38 на одной и v=33 на двадцати одной. С этих двадцати одной страницы человек,
 * заходивший раньше, получал бы CSS месячной давности.
 *
 * ПРАВИЛО. Один номер на весь сайт, поднимается при каждой правке CSS или JS.
 *
 * Запуск:  node scripts/bump-asset-version.mjs 41 --dry
 *          node scripts/bump-asset-version.mjs 41
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const V = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!/^\d+$/.test(V || '')) { console.log('нужен номер версии: node scripts/bump-asset-version.mjs 41'); process.exit(1); }

const files = [];
(function walk(rel, d) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
  for (const it of ents) {
    if (it.name === 'node_modules' || it.name === '.git') continue;
    const nx = rel ? rel + '/' + it.name : it.name;
    if (it.isDirectory()) { if (d < 3 || rel === 'models') walk(nx, d + 1); }
    else if (it.name.endsWith('.html')) files.push(nx);
  }
})('', 0);

let done = 0, skipped = 0, links = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) { skipped++; continue; }
  const before = h;
  h = h.replace(/(\/assets\/(?:css|js)\/[a-z0-9.-]+\.(?:css|js))\?v=\d+/g,
    (x, a) => { links++; return a + '?v=' + V; });
  if (h === before) continue;
  done++;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('страниц: ' + done + ', ссылок переставлено: ' + links + ', перенаправлений пропущено: ' + skipped);
if (DRY) console.log('(--dry, ничего не записано)');
