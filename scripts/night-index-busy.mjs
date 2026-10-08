/*
 * night-index-busy.mjs - занят ли репозиторий кем-то ещё.
 *
 * Зачем отдельный скрипт. Ночная задача проверяла это командой
 * `git -C "<путь>" diff --cached --name-only`. Чтобы такая команда работала без
 * подтверждения, в разрешающий список пришлось бы вписать git - а это открывает
 * и push, и reset, и всё остальное. Вместо этого разрешается ровно один скрипт,
 * а git он вызывает внутри себя.
 *
 * Печатает «свободен» или «занят: N файлов в индексе» и выходит с кодом 0 или 1,
 * чтобы годилось и человеку, и условию в скрипте.
 *
 * Запуск:  node scripts/night-index-busy.mjs
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/paths.mjs';

let out = '';
try {
  out = execFileSync('git', ['-C', ROOT, 'diff', '--cached', '--name-only'], { encoding: 'utf8' });
} catch (e) {
  console.log('не удалось спросить git: ' + e.message);
  process.exit(0); // не знаем - значит не мешаем работать
}
const staged = out.split('\n').filter(Boolean);
if (staged.length) {
  console.log('занят: ' + staged.length + ' файлов в индексе - работает человек или другая задача');
  process.exit(1);
}
console.log('свободен');
process.exit(0);
