/*
 * fix-merge-slug-mismatch.mjs - доклеить страницы, которые склейка промахнулась.
 *
 * ЧТО СЛУЧИЛОСЬ. merge-variants.mjs брал адрес карточки из колонки slug в
 * models_master.csv. Эта колонка построена ДРУГИМ правилом, чем имена папок на
 * диске: «Harivake Koi Fish(1)» дал в CSV harivake-koi-fish-1-1142255, а папка
 * называется harivake-koi-fish1-1142255. Расходятся 372 адреса из 86 865.
 *
 * Последствие: заглушка создавалась по НЕСУЩЕСТВУЮЩЕМУ адресу, а настоящая
 * страница оставалась живой. На сайте получались две карточки одной модели:
 * одна в блоке версий главной, другая сама по себе. Таких 46.
 *
 * Причину устранили в merge-variants.mjs - адрес теперь берётся из существующей
 * папки. Здесь доклеиваем то, что уже разъехалось: дописываем в карту свёрнутых
 * настоящий адрес. Лишние заглушки по вычисленным адресам НЕ удаляем: они
 * безвредны, ведут на ту же главную карточку, а удаление дало бы 404 на
 * адресах, которые уже опубликованы.
 *
 * После запуска обязательно:  node scripts/build-redirect-stubs.mjs
 *
 * Запуск:  node scripts/fix-merge-slug-mismatch.mjs --dry
 *          node scripts/fix-merge-slug-mismatch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const MAP = path.join(ROOT, 'data', 'merged-variants.json');
const DRY = process.argv.includes('--dry');

const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));

// папки по номеру модели
const byId = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^\d+$/.test(id)) { if (!byId.has(id)) byId.set(id, []); byId.get(id).push(d); }
}
const isLive = d => {
  try { return !/http-equiv="refresh"/i.test(fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8').slice(0, 400)); }
  catch (e) { return false; }
};

let added = 0;
const sample = [];
for (const [key, target] of Object.entries(map)) {
  const id = key.slice(key.lastIndexOf('-') + 1);
  for (const other of byId.get(id) || []) {
    if (other === key || map[other]) continue;
    if (!isLive(other)) continue;
    map[other] = target;
    added++;
    if (sample.length < 8) sample.push(other + '  ->  ' + target);
  }
}

console.log('записей в карте было: ' + (Object.keys(map).length - added));
console.log('дописано настоящих адресов: ' + added);
sample.forEach(s => console.log('   ' + s));
if (added && !DRY) {
  fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
  console.log('карта обновлена: data/merged-variants.json');
  console.log('ТЕПЕРЬ: node scripts/build-redirect-stubs.mjs');
} else if (DRY) console.log('(--dry, ничего не записано)');
