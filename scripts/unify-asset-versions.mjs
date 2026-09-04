/*
 * unify-asset-versions.mjs - приводит ?v= у общих ассетов к одному числу.
 *
 * Зачем. Один и тот же файл подключался с разными номерами версии: главная
 * просила styles.min.css?v=38, а 54 098 остальных страниц - ?v=34. Номер в
 * запросе не меняет то, что отдаёт сервер, но меняет ключ кеша в браузере:
 * посетитель, у которого лежит старый ответ на ?v=34, продолжает видеть на
 * карточках устаревший CSS, хотя на главной у него свежий. То же с site.min.js
 * (v=33 на 669 страницах против v=34) и model-pages.min.css (v=33 на двух).
 *
 * Что делает. Находит максимальный номер, встреченный на сайте для каждого
 * файла, и проставляет его везде. Максимум, а не минимум: свежий ключ заставит
 * браузер перечитать файл, а занижение оставило бы часть людей на старом кеше.
 *
 * Запуск:  node scripts/unify-asset-versions.mjs --dry
 *          node scripts/unify-asset-versions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const RE = /(\/assets\/(?:js|css)\/([a-z-]+\.min\.(?:js|css))\?v=)(\d+)/g;

const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(next);
    else if (e.name.endsWith('.html')) pages.push(next);
  }
})('');

// проход первый: какой максимум у каждого файла
const max = new Map();
for (const rel of pages) {
  const h = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const m of h.matchAll(RE)) {
    const v = +m[3];
    if (!max.has(m[2]) || max.get(m[2]) < v) max.set(m[2], v);
  }
}
console.log('целевые версии:');
for (const [f, v] of [...max.entries()].sort()) console.log('  ' + f + ' -> v=' + v);

// проход второй: правим
let touched = 0, refs = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const h = fs.readFileSync(file, 'utf8');
  let n = 0;
  const out = h.replace(RE, (m, head, name, v) => {
    const want = max.get(name);
    if (+v === want) return m;
    n++;
    return head + want;
  });
  if (n) {
    touched++; refs += n;
    if (!DRY) fs.writeFileSync(file, out);
  }
}
console.log('\nстраниц изменено: ' + touched + (DRY ? '  (--dry)' : '') + ', ссылок на ассеты поправлено: ' + refs);
