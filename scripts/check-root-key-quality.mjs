/*
 * check-root-key-quality.mjs - можно ли склеивать по ключу root_id.
 *
 * ЗАЧЕМ. Разбирая новые модели, я предположил, что `root_id` из отчёта
 * TurboSquid - это ключ «варианты одной модели». Первый же пример показал
 * обратное: «2016 Chevrolet Express Emergency Car» и «Truck Tire with Steel
 * Wheel Rim Silver» имеют ОДИН root_id. Колесо не вариант машины - оно из неё
 * ВЫДЕЛЕНО (в отчёте есть отдельный признак is_split).
 *
 * Значит root_id группирует «сделанное из одного исходника», а не «одно и то
 * же в разных видах». Склейка по нему свалила бы на одну карточку машину и
 * колесо.
 *
 * Здесь это измеряется на живых карточках, где ответ известен: берём группы с
 * общим root_id и смотрим, есть ли у названий хоть одно общее значимое слово.
 * Нет общего слова - почти наверняка разные вещи.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-root-key-quality.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');

const STOP = new Set(['3d', 'model', 'models', 'with', 'and', 'for', 'the', 'set',
  'collection', 'new', 'old', 'white', 'black', 'grey', 'gray', 'silver', 'red',
  'blue', 'green', 'rigged', 'animated', 'simplified', 'game', 'ready']);
const words = s => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/)
  .filter(w => w.length > 2 && !STOP.has(w)));

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const byRoot = new Map();
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new' || !r.root) continue;
    if (!byRoot.has(r.root)) byRoot.set(r.root, []);
    byRoot.get(r.root).push(r);
  }
}

let groups = 0, mixed = 0, pairs = 0, badPairs = 0;
const ex = [];
for (const [, list] of byRoot) {
  if (list.length < 2) continue;
  groups++;
  let bad = false;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      pairs++;
      const a = words(list[i].name), b = words(list[j].name);
      let common = false;
      for (const w of a) if (b.has(w)) { common = true; break; }
      if (common) continue;
      badPairs++; bad = true;
      if (ex.length < 6) {
        ex.push('«' + String(list[i].name).slice(0, 40) + '»  и  «' + String(list[j].name).slice(0, 40) + '»');
      }
    }
  }
  if (bad) mixed++;
}

console.log('групп с общим root_id среди живых карточек: ' + groups.toLocaleString('ru-RU'));
console.log('  в них пар: ' + pairs.toLocaleString('ru-RU')
  + ', пар без единого общего слова: ' + badPairs.toLocaleString('ru-RU')
  + ' (' + (pairs ? Math.round(badPairs / pairs * 100) : 0) + '%)');
console.log('  групп, где такая пара есть: ' + mixed.toLocaleString('ru-RU')
  + ' из ' + groups.toLocaleString('ru-RU')
  + ' (' + (groups ? Math.round(mixed / groups * 100) : 0) + '%)');
console.log('\nпримеры того, что склеилось бы в одну карточку:');
ex.forEach(x => console.log('   ' + x));
