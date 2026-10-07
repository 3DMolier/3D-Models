/*
 * run-night.mjs - ночной прогон: 1 000-5 000 карточек за ночь.
 *
 * Один проход делает всё: очередь -> справки -> партия в Batches API -> приёмка
 * по ТЗ -> применение к карточкам -> чистка очереди -> сводка в Telegram.
 * Публикации здесь нет: сайт выкладывает задача Windows в 11:30, и она сама
 * увидит дописанные карточки.
 *
 * ПОЧЕМУ 5 000 ЗА НОЧЬ ВОЗМОЖНЫ. Ограничение не в нас, а в последовательности:
 * когда я пишу сам, каждая карточка занимает место в рассуждении, и за ночь
 * выходит сотня. Пакетный режим снимает это целиком: 5 000 запросов уходят одной
 * посылкой, считаются на стороне API параллельно, и мне остаётся приёмка -
 * машинная проверка, которой всё равно, сто карточек или пять тысяч.
 *
 * Запуск:
 *   node tools/batch-writer/run-night.mjs --count 2000 --model sonnet
 *   node tools/batch-writer/run-night.mjs --count 5000 --rounds 1 --quiet
 *
 * Деление на раунды нужно для осторожности на первых прогонах: партия по 500
 * проверяется целиком, и если приёмка валит половину, дальше прогон не идёт.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const ROOT = path.resolve(HERE, '..', '..');
const NOTIFY = 'D:/Clode_Work_Folder/tools/notify/telegram-send.js';
const LOG = path.join(HERE, 'night-log.txt');

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const COUNT = Number(arg('--count')) || 2000;
const ROUNDS = Number(arg('--rounds')) || 1;
const MODEL = arg('--model') || 'sonnet';
const QUIET = process.argv.includes('--quiet');
// Доля принятых, ниже которой прогон останавливается сам: значит сломался промпт
// или данные, и гнать дальше - жечь деньги и портить каталог.
const MIN_PASS = Number(arg('--min-pass')) || 0.6;

const say = s => {
  const line = new Date().toISOString().slice(0, 19).replace('T', ' ') + '  ' + s;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG, line + '\n'); } catch (e) { /* лог не критичен */ }
};
const node = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const tg = text => { try { execFileSync(process.execPath, [NOTIFY, text], { encoding: 'utf8' }); } catch (e) { say('Telegram не ушёл: ' + e.message); } };

const perRound = Math.ceil(COUNT / ROUNDS);
let appliedTotal = 0, rejectedTotal = 0, costTotal = 0;

for (let r = 1; r <= ROUNDS; r++) {
  say('раунд ' + r + ' из ' + ROUNDS + ', карточек ' + perRound);

  // 1. очередь и справки. Приоритетная очередь главнее обычной.
  const prio = path.join(ROOT, 'tools', 'night-writer', 'priority-slugs.json');
  let slugsArg = [];
  try {
    if (JSON.parse(fs.readFileSync(prio, 'utf8')).length) slugsArg = ['--slugs', 'tools/night-writer/priority-slugs.json'];
  } catch (e) { /* нет файла - идём по обычной очереди */ }
  say(node('scripts/night-brief.mjs', [...slugsArg, '--count', String(perRound)]).trim().split('\n').slice(-1)[0]);

  // 2. партия
  const sub = node('tools/batch-writer/submit.mjs', ['--count', String(perRound), '--model', MODEL]);
  say(sub.trim().split('\n').filter(Boolean).slice(-3).join(' | '));

  // 3. ждём и забираем
  const col = node('tools/batch-writer/collect.mjs', ['--wait', '10800']);
  const okN = Number((col.match(/принято:\s+(\d+)/) || [])[1] || 0);
  const badN = Number((col.match(/отклонено:\s+(\d+)/) || [])[1] || 0);
  const cost = Number((col.match(/стоимость партии: \$([\d.]+)/) || [])[1] || 0);
  say('приёмка: принято ' + okN + ', отклонено ' + badN + ', $' + cost.toFixed(2));
  for (const l of col.split('\n').filter(l => /^\s{2}\d+ x /.test(l))) say('  причина:' + l);
  costTotal += cost; rejectedTotal += badN;

  const pass = okN / Math.max(1, okN + badN);
  if (pass < MIN_PASS) {
    const m = 'ОСТАНОВЛЕНО: приёмку прошли только ' + Math.round(pass * 100) + '% (порог '
      + Math.round(MIN_PASS * 100) + '%). Партия не применена, смотри tools/batch-writer/rejects.json';
    say(m); tg('3DMolier, ночная генерация: ' + m); process.exit(1);
  }
  if (!okN) { say('принятых нет, раунд пропущен'); continue; }

  // 4. применяем: сначала пробный прогон, он же второй рубеж по числам
  const dry = node('scripts/night-apply.mjs', ['--dry']);
  const liar = Number((dry.match(/ОТКЛОНЕНО, числа врут:\s+(\d+)/) || [])[1] || 0);
  if (liar) say('внимание: night-apply нашёл карточек с неверными числами: ' + liar + ' - они не применятся');
  const apl = node('scripts/night-apply.mjs');
  const wrote = Number((apl.match(/карточек написано:\s+(\d+)/) || [])[1] || 0);
  appliedTotal += wrote;
  say('применено к карточкам: ' + wrote);

  // 5. чистим очередь от применённых
  try {
    const written = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'night-writer', 'written.json'), 'utf8')).map(c => c.slug);
    const done = new Set(written);
    const before = JSON.parse(fs.readFileSync(prio, 'utf8'));
    const after = before.filter(s => !done.has(s));
    if (after.length !== before.length) {
      fs.writeFileSync(prio, JSON.stringify(after));
      say('приоритетная очередь: ' + before.length + ' -> ' + after.length);
    }
  } catch (e) { say('очередь не почищена: ' + e.message); }
}

const hand = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-hand-desc.json'), 'utf8'))).length;
const summary = '3DMolier, ночная генерация описаний\n'
  + 'применено за прогон: ' + appliedTotal + '\n'
  + 'отклонено приёмкой: ' + rejectedTotal + '\n'
  + 'стоимость: $' + costTotal.toFixed(2) + '\n'
  + 'всего уникальных описаний: ' + hand + '\n'
  + 'публикация - задачей в 11:30';
say('ИТОГ: применено ' + appliedTotal + ', отклонено ' + rejectedTotal + ', $' + costTotal.toFixed(2));
if (!QUIET) tg(summary);
