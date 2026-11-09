/*
 * night-sales-fix.mjs - сводка по правке продаж в рукописных текстах (только чтение).
 * Логика очереди - scripts/lib/sales-fix-queue.mjs. Ночной смене справки выдаёт
 * night-brief.mjs --sales-fix N (эта команда уже в разрешённом списке задачи).
 *
 *   node scripts/night-sales-fix.mjs
 */
import { salesFixQueue, DAILY } from './lib/sales-fix-queue.mjs';
const q = salesFixQueue(0);
console.log(`с продажами в тексте осталось: ${q.remaining} (из них в приоритетной карте ${q.inPriority})`);
console.log(`сегодня (${q.today}) переписано: ${q.doneToday} из потолка ${DAILY}, можно ещё ${q.room}`);
