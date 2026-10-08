/*
 * night-prune-queue.mjs - убрать из приоритетной очереди уже написанные карточки.
 *
 * Зачем отдельный скрипт. Ночной прогон делал это вручную: читал
 * priority-slugs.json, сравнивал с model-hand-desc.json и перезаписывал файл.
 * Каждая такая запись - отдельное подтверждение, а ночью подтверждать некому, и
 * прогон вис. Теперь это одна разрешённая команда.
 *
 * Чистит по факту, а не по списку прогона: написанным считается то, что лежит в
 * data/model-hand-desc.json. Если прогон написал меньше, чем собирался, очередь
 * всё равно сойдётся с действительностью.
 *
 * Запуск:  node scripts/night-prune-queue.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const DRY = process.argv.includes('--dry');
const QUEUE = path.join(ROOT, 'tools', 'night-writer', 'priority-slugs.json');
const HAND = path.join(ROOT, 'data', 'model-hand-desc.json');

let queue;
try { queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8')); }
catch (e) { console.log('очереди нет или она нечитаема: ' + e.message); process.exit(0); }
if (!Array.isArray(queue)) { console.log('очередь не список, не трогаю'); process.exit(1); }

const done = new Set(Object.keys(JSON.parse(fs.readFileSync(HAND, 'utf8'))));
const left = queue.filter(s => !done.has(s));
const removed = queue.length - left.length;

if (!removed) { console.log('очередь уже чистая: ' + queue.length + ' адресов'); process.exit(0); }
if (DRY) { console.log('(--dry) убрать можно ' + removed + ', останется ' + left.length); process.exit(0); }
fs.writeFileSync(QUEUE, JSON.stringify(left));
console.log('очередь: ' + queue.length + ' -> ' + left.length + ' (убрано написанных: ' + removed + ')');
