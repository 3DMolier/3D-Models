/*
 * seed-lastmod.mjs - разовый засев карты дат изменения страниц по истории git.
 *
 * Зачем. data/page-lastmod.json хранит дату, когда страница ПРАВДА менялась.
 * При первом заполнении брать её из разметки нельзя: dateModified там один на
 * весь сайт (дата последней общей пересборки), и все 37 683 карточки получают
 * одно и то же число - сигнал опять ничего не значит.
 *
 * История git знает правду: для каждого файла есть дата последнего коммита, где
 * он менялся. Один проход по журналу - и у каждой страницы своя честная дата.
 *
 * Запуск:  node scripts/seed-lastmod.mjs [--since 2026-01-01]
 * Повторно запускать не нужно: дальше карту ведёт lib/lastmod.mjs по хешам.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { ROOT } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const since = argv.includes('--since') ? argv[argv.indexOf('--since') + 1] : '2026-01-01';
const store = path.join(ROOT, 'data', 'page-lastmod.json');

let map = {};
try { map = JSON.parse(fs.readFileSync(store, 'utf8')); } catch { }

// git log отдаёт коммиты от новых к старым: первая встреча пути - его последнее изменение.
const git = spawn('git', ['log', '--since', since, '--name-only', '--pretty=format:C%cs'], { cwd: ROOT });
const rl = readline.createInterface({ input: git.stdout, crlfDelay: Infinity });

const dateOf = new Map();
let cur = null, lines = 0;
for await (const line of rl) {
  lines++;
  if (!line) continue;
  if (line[0] === 'C' && /^C\d{4}-\d{2}-\d{2}$/.test(line)) { cur = line.slice(1); continue; }
  if (!cur || !line.endsWith('index.html')) continue;
  const p = line.replace(/\\/g, '/');
  if (!dateOf.has(p)) dateOf.set(p, cur);
}
console.log(`журнал: строк ${lines}, страниц с датой ${dateOf.size}`);

let set = 0, kept = 0, gone = 0, stubs = 0;
for (const [rel, date] of dateOf) {
  const file = path.join(ROOT, rel);
  let body;
  try { body = fs.readFileSync(file); } catch { gone++; continue; }
  // Страницы-перенаправления в карты сайта не попадают - и в карту дат незачем.
  if (/http-equiv="refresh"/.test(body.slice(0, 400).toString('utf8'))) { stubs++; continue; }
  const hash = crypto.createHash('sha1').update(body).digest('hex').slice(0, 12);
  /*
   * Дата из журнала главнее того, что уже лежит в карте: при засеве в карту
   * попадает dateModified из разметки, а он один на весь сайт. Журнал знает,
   * когда менялся именно этот файл, - его и ставим.
   */
  map[rel] = [date, hash];
  set++;
}

// По строке на страницу: иначе однострочный JSON даёт diff на весь файл.
const keys = Object.keys(map).sort();
const out = '{\n' + keys.map(k => `${JSON.stringify(k)}:${JSON.stringify(map[k])}`).join(',\n') + '\n}\n';
fs.writeFileSync(store, out, 'utf8');
console.log(`даты проставлены: ${set}, перенаправлений пропущено: ${stubs}, файлов нет: ${gone}`);
console.log(`в карте всего страниц: ${Object.keys(map).length}`);
