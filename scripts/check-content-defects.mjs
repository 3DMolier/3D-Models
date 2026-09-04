/*
 * check-content-defects.mjs - явный брак в тексте карточек.
 *
 * ЗАЧЕМ. Проверки данных стерегут структуру: есть ли заголовок, сходятся ли
 * числа, не ведут ли ссылки в никуда. Но посетитель видит ТЕКСТ, и в нём
 * бывает брак, который структуру не нарушает: «undefined» вместо значения,
 * цена «$0», оборванная фраза, двойной пробел в заголовке.
 *
 * Такое не падает и не ломает проверок - просто выглядит как небрежность на
 * витрине, где продают за сотни долларов.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-content-defects.mjs
 *          node scripts/check-content-defects.mjs --every 3
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const EVERY = arg('--every') || 7;

const CHECKS = [
  ['«undefined» в тексте', b => />undefined</.test(b) || /\sundefined[\s.,<]/.test(b)],
  ['«NaN» в тексте', b => />NaN</.test(b) || /\$NaN/.test(b)],
  ['цена $0', b => /\$0\b/.test(b)],
  ['пустой заголовок', (b, h) => { const m = h.match(/<h1[^>]*>([^<]*)</); return !m || !m[1].trim(); }],
  ['двойной пробел в заголовке', (b, h) => { const m = h.match(/<h1[^>]*>([^<]*)</); return !!m && /\s{2,}/.test(m[1]); }],
  ['оборванная фраза', b => /\b(the|a|an|of|for|with|and|to|in)\s*<\/p>/i.test(b)],
  ['двойная точка', b => /\.\.(?!\.)/.test(b.replace(/<[^>]+>/g, ' '))],
  ['пустая ячейка таблицы', b => /<td[^>]*>\s*<\/td>/.test(b)],
  ['«$undefined» или «$ »', b => /\$\s*(undefined|<)/.test(b)],
];

const dirs = fs.readdirSync(MODELS);
const counts = new Map(CHECKS.map(c => [c[0], 0]));
const examples = new Map();
let n = 0;

for (let i = 0; i < dirs.length; i += EVERY) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, dirs[i], 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  n++;
  const body = h.slice(Math.max(0, h.indexOf('<body')));
  for (const [name, fn] of CHECKS) {
    if (!fn(body, h)) continue;
    counts.set(name, counts.get(name) + 1);
    if (!examples.has(name)) examples.set(name, dirs[i]);
  }
}

console.log('карточек просмотрено: ' + n.toLocaleString('ru-RU')
  + (EVERY > 1 ? '  (каждая ' + EVERY + '-я)' : ''));
let bad = 0;
for (const [name, v] of counts) {
  console.log('  ' + String(v).padStart(6) + '  ' + name
    + (v ? '   пример: ' + String(examples.get(name)).slice(0, 44) : ''));
  if (v) bad++;
}
console.log(bad ? '\nнайдено родов брака: ' + bad : '\nЯВНОГО БРАКА НЕТ');

// Возврат ненулевого кода - чтобы проверку можно было ставить преградой перед
// публикацией. Без него сборка в Actions видела красный вывод и всё равно
// считала шаг успешным.
process.exit(bad ? 1 : 0);
