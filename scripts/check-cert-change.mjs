/*
 * check-cert-change.mjs - что изменится на сайте в графе сертификации.
 *
 * Сверяет то, что сейчас написано на живой карточке, с тем, что даст запись.
 * Нужен, чтобы основатель принимал решение по числам, а не по обещаниям.
 *
 * Ничего не пишет и ничего не публикует.
 *
 * Запуск:  node scripts/check-cert-change.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');

/*
 * Строка про качество называется на страницах ДВУМЯ способами, и это не
 * оформление, а разный смысл:
 *   «Certification»    - сертификат есть, назван;
 *   «Quality standard» - сертификата нет, написано «Built to CheckMate
 *                        specification», то есть сделано по правилам, но не
 *                        проверено сторонним рецензентом.
 * Первая версия искала только первую и записала 18 131 карточку в «строки нет»,
 * а потом отрапортовала «изменений нет» - хотя именно там они и были.
 */
const onPage = html => {
  const m = html.match(/(?:Certification|Quality standard)<\/(?:th|dt|span)>\s*<(?:td|dd|span)[^>]*>([^<]*)</i);
  if (!m) return '';
  const v = m[1].trim();
  return /Built to CheckMate specification/i.test(v) ? 'no certification' : v;
};

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const dir = new Map();
const ex = new Map();
let checked = 0, same = 0, noRow = 0;

for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new') continue;
    let html;
    try { html = fs.readFileSync(path.join(ROOT, 'models', r.slug, 'index.html'), 'utf8'); } catch (e) { continue; }
    checked++;
    const was = onPage(html);
    if (!was) { noRow++; continue; }
    if (was === r.cert) { same++; continue; }
    const key = was + '  ->  ' + r.cert;
    dir.set(key, (dir.get(key) || 0) + 1);
    if (!ex.has(key)) ex.set(key, r.slug);
  }
}

console.log('живых карточек просмотрено: ' + checked.toLocaleString('ru-RU'));
console.log('совпало: ' + same.toLocaleString('ru-RU')
  + ' | строки сертификации на странице нет: ' + noRow.toLocaleString('ru-RU'));
console.log('\n--- что изменится ---');
[...dir].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log('  ' + String(v).padStart(6) + '  ' + k);
  console.log('          пример: ' + ex.get(k));
});
