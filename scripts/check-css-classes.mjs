/*
 * check-css-classes.mjs - какие классы пропадают и появляются при пересборке.
 *
 * ЗАЧЕМ. Сверка сличала содержимое: сколько абзацев, какие строки таблицы,
 * та же ли цена. Имена классов она не смотрела - и пропустила две описки в
 * крошках: у обёртки потерялся mp-bc-inner (это flex-раскладка), а ссылка
 * «Home» получила класс bc-link, которого в стилях нет вовсе. Обе задели бы
 * все 54 025 страниц, и увидеть их можно было только глазами в diff.
 *
 * Здесь для каждой живой карточки берётся набор классов «было» и «стало», и
 * считается, какие классы исчезли, а какие добавились. Пропавший класс, у
 * которого есть правило в стилях, - почти всегда поломка раскладки.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-css-classes.mjs
 *          node scripts/check-css-classes.mjs --every 10
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

import { ROOT } from './lib/paths.mjs';
const RECS = path.join(ROOT, 'data', 'records');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const EVERY = arg('--every') || 1;

const classesOf = html => new Set([...html.matchAll(/class="([^"]*)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(Boolean));

// Правила из наших стилей: пропажу класса, у которого есть правило, надо
// объяснять - раскладка на него опирается.
const css = ['assets/css/model-pages.css', 'assets/css/styles.css']
  .map(f => path.join(ROOT, f))
  .filter(f => fs.existsSync(f))
  .map(f => fs.readFileSync(f, 'utf8')).join('\n');
const styled = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));

const t0 = Date.now();
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const lost = new Map(), gained = new Map();
let n = 0;

for (let k = 0; k < idx.chunks; k++) {
  const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
  for (let i = 0; i < recs.length; i++) {
    if (i % EVERY) continue;
    const r = recs[i];
    if (r.status === 'new') continue;
    let live;
    try { live = fs.readFileSync(path.join(ROOT, 'models', r.slug, 'index.html'), 'utf8'); } catch (e) { continue; }
    n++;
    const a = classesOf(live), b = classesOf(renderCard(r));
    for (const c of a) if (!b.has(c)) lost.set(c, (lost.get(c) || 0) + 1);
    for (const c of b) if (!a.has(c)) gained.set(c, (gained.get(c) || 0) + 1);
  }
}

const show = (title, map, mark) => {
  console.log('\n--- ' + title + ' ---');
  const rows = [...map].sort((a, b) => b[1] - a[1]);
  if (!rows.length) { console.log('   нет'); return; }
  for (const [c, v] of rows.slice(0, 25)) {
    console.log('   ' + String(v).padStart(6) + '  ' + c.padEnd(26)
      + (mark && styled.has(c) ? '  ЕСТЬ ПРАВИЛО В СТИЛЯХ' : ''));
  }
};

console.log('карточек сверено: ' + n.toLocaleString('ru-RU')
  + (EVERY > 1 ? '  (каждая ' + EVERY + '-я)' : ''));
show('ПРОПАДАЕТ', lost, true);
show('ПОЯВЛЯЕТСЯ', gained, false);
console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
