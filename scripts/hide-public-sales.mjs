/*
 * hide-public-sales.mjs - убрать число продаж из открытых файлов данных сайта.
 *
 * ЗАЧЕМ. Решение основателя 09.11.2026: «не публиковать количество продаж в
 * общий доступ». Хостинг отдаёт папку data/ как есть, и до этой правки любой мог
 * скачать data/fc-chunk-*.json (колонка s - точные продажи 38 тыс. моделей) и
 * data/catalog.json (поле sales). Полный каталог ещё и печатал «N sold» на плитках.
 *
 * ЧТО ДЕЛАЕТ.
 *  - fc-chunk-*.json: колонку s заменяет баллом популярности 0..1000. Балл
 *    считается заново из data/records (их хостинг не отдаёт) по плотному рангу:
 *    0 - продаж нет, 1..1000 - от меньших продаж к большим, равные продажи -
 *    равный балл. Порядок «по популярности» в каталоге, хабах, коллекциях и
 *    играх остаётся прежним, а самого числа в файле больше нет.
 *  - catalog.json: поле sales удаляется (его никто не читает).
 * Повторный запуск ничего не меняет: балл каждый раз считается из записей.
 *
 * Стоит в daily-site-update.mjs после всех, кто пишет fc-chunk (rebuild-search-index,
 * add-new-to-catalog), и до тех, кто по нему сортирует.
 *
 *   node scripts/hide-public-sales.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

const sales = new Map();
for (const f of fs.readdirSync(path.join(DATA, 'records')).filter(x => /^records-\d+\.json$/.test(x)))
  for (const r of JSON.parse(fs.readFileSync(path.join(DATA, 'records', f), 'utf8')))
    sales.set(String(r.id), Number(r.sales || r.total_sales || 0));

// плотный ранг по возрастанию: самое малое ненулевое число продаж - 1
const levels = [...new Set([...sales.values()].filter(v => v > 0))].sort((a, b) => a - b);
const K = levels.length;
const rankOf = new Map(levels.map((v, i) => [v, i + 1]));
const score = v => !v ? 0 : K === 1 ? 1000 : 1 + Math.round(999 * (rankOf.get(v) - 1) / (K - 1));
if (K > 1000) console.log('ВНИМАНИЕ: уровней продаж ' + K + ' больше 1000, соседние уровни сольются в один балл');

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
let rows = 0, changed = 0, noRec = 0;
for (let n = 0; n < idx.chunks; n++) {
  const f = path.join(DATA, 'fc-chunk-' + n + '.json');
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  const s = c.i.map(id => {
    const v = sales.get(String(id));
    if (v === undefined) { noRec++; return 0; }
    return score(v);
  });
  rows += s.length;
  changed += s.filter((v, j) => v !== c.s[j]).length;
  c.s = s;
  if (!DRY) fs.writeFileSync(f, JSON.stringify(c));
}

const catFile = path.join(DATA, 'catalog.json');
let catStripped = 0;
if (fs.existsSync(catFile)) {
  const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
  for (const r of cat) if ('sales' in r) { delete r.sales; catStripped++; }
  if (catStripped && !DRY) fs.writeFileSync(catFile, JSON.stringify(cat));
}

console.log(`fc-chunk: строк ${rows}, балл изменён у ${changed}, без записи (балл 0) ${noRec}; уровней продаж ${K}`);
console.log(`catalog.json: поле sales убрано у ${catStripped}` + (DRY ? '  (--dry, ничего не записано)' : ''));
