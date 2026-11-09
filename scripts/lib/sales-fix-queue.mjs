/*
 * sales-fix-queue.mjs - очередь переписывания уже опубликованных рукописных текстов,
 * в которых названы продажи (основатель 09.11.2026: «не публиковать количество
 * продаж в общий доступ»; переписывать частями, несколько сотен в день).
 *
 * Механически вырезать предложение нельзя - абзац рвётся, поэтому ночная смена
 * переписывает только эти предложения. Потолок DAILY в сутки по Москве; счёт - по
 * тому, на сколько уменьшился остаток с начала дня (tools/night-writer/sales-fix-day.json).
 *
 * Пользуются: night-brief.mjs --sales-fix N (выдаёт справки ночной смене) и
 * night-sales-fix.mjs (сводка для человека).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { salesSentences } from './sales-guard.mjs';

export const DAILY = 400;
const WORK = path.join(ROOT, 'tools', 'night-writer');
const DAY_FILE = path.join(WORK, 'sales-fix-day.json');

// живая страница, не заглушка склейки: только на ней night-apply может поставить текст
const isLive = slug => {
  try {
    const fd = fs.openSync(path.join(ROOT, 'models', slug, 'index.html'), 'r');
    const b = Buffer.alloc(600); const n = fs.readSync(fd, b, 0, 600, 0); fs.closeSync(fd);
    return !/http-equiv="refresh"/.test(b.slice(0, n).toString('utf8'));
  } catch { return false; }
};

/* Состояние очереди и до n адресов к выдаче (0 - только посчитать). */
export function salesFixQueue(n = 0) {
  const hand = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-hand-desc.json'), 'utf8'));
  const todo = Object.keys(hand).filter(s => salesSentences(hand[s]).length);
  // сначала карточки из приоритетной карты сайта - их Google видит первыми
  const prio = new Set();
  try {
    const xml = fs.readFileSync(path.join(ROOT, 'sitemaps', 'sitemap-priority.xml'), 'utf8');
    for (const m of xml.matchAll(/\/models\/([^/<]+)\/<\/loc>/g)) prio.add(m[1]);
  } catch { /* без приоритетной карты - по порядку файла */ }
  todo.sort((a, b) => (prio.has(b) ? 1 : 0) - (prio.has(a) ? 1 : 0));

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
  let day = {};
  try { day = JSON.parse(fs.readFileSync(DAY_FILE, 'utf8')); } catch { /* первый запуск */ }
  if (day.date !== today) { day = { date: today, startRemaining: todo.length }; fs.writeFileSync(DAY_FILE, JSON.stringify(day)); }
  const doneToday = Math.max(0, day.startRemaining - todo.length);
  const room = Math.max(0, DAILY - doneToday);

  const slugs = [];
  for (const s of todo) { if (slugs.length >= Math.min(n, room)) break; if (isLive(s)) slugs.push(s); }
  return { slugs, remaining: todo.length, inPriority: todo.filter(s => prio.has(s)).length, doneToday, room, today };
}
