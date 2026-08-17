// build-inventory-todo.mjs — очередь на сбор данных из inventory по остальной базе.
//
// Берём все ЖИВЫЕ карточки сайта и вычитаем те, по которым характеристики уже
// собраны (data/model-specs.json). Заглушки не берём: у них нет своей страницы,
// данные им некуда класть.
//
// Результат: data/inventory-todo.json — список product id в порядке от новых к
// старым (у свежих моделей выше шанс, что они есть в inventory).
//
// Запуск:  node scripts/build-inventory-todo.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DATA = path.join(ROOT, 'data');

const specs = JSON.parse(fs.readFileSync(path.join(DATA, 'model-specs.json'), 'utf8'));
const have = new Set(Object.keys(specs));

// Уже известно, что этих в inventory нет: варианты под софт и наборы, у которых
// в студии нет отдельной записи. Повторно их не спрашиваем.
const missPath = path.join(DATA, 'inventory-missing.json');
const known = fs.existsSync(missPath) ? new Set(JSON.parse(fs.readFileSync(missPath, 'utf8'))) : new Set();

const HEAD = 400, buf = Buffer.alloc(HEAD);
const isStub = f => {
  let fd;
  try { fd = fs.openSync(f, 'r'); } catch (e) { return true; }
  try { const n = fs.readSync(fd, buf, 0, HEAD, 0); return /http-equiv="refresh"/.test(buf.slice(0, n).toString('utf8')); }
  finally { fs.closeSync(fd); }
};

const todo = [];
let live = 0, stubs = 0, already = 0, skipKnown = 0;
for (const slug of fs.readdirSync(MODELS)) {
  const f = path.join(MODELS, slug, 'index.html');
  if (isStub(f)) { stubs++; continue; }
  live++;
  const id = (slug.match(/(\d+)$/) || [])[1];
  if (!id) continue;
  if (have.has(id)) { already++; continue; }
  if (known.has(id)) { skipKnown++; continue; }
  todo.push(id);
}
// от новых к старым: id на TurboSquid растут во времени
todo.sort((a, b) => Number(b) - Number(a));

fs.writeFileSync(path.join(DATA, 'inventory-todo.json'), JSON.stringify(todo));
console.log('живых карточек:        ' + live);
console.log('заглушек пропущено:    ' + stubs);
console.log('данные уже есть:       ' + already);
if (skipKnown) console.log('заведомо нет в studio: ' + skipKnown);
console.log('в очередь на сбор:     ' + todo.length);
const perNight = 45 * 60 * 10;   // 45 моделей в минуту, 10 часов
console.log('\nпри 45 моделях в минуту это ' + Math.ceil(todo.length / perNight) + ' ночей по 10 часов');
