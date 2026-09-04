/*
 * check-image-sizes.mjs - какие размеры картинок стоят на карточках.
 *
 * ЗАЧЕМ. Студийный снимок весит 303 КБ, а миниатюра галереи показывается в 108
 * пикселей. Проверяем, что генератор ставит уменьшенные копии там, где нужно, и
 * оригинал там, где он оправдан: в шапке карточки и в увеличенном виде.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-image-sizes.mjs
 *          node scripts/check-image-sizes.mjs --every 20
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const EVERY = arg('--every') || 7;

// Вес по замерам: оригинал 303 КБ, h400 12 КБ, h200 5 КБ, h100 2 КБ.
const WEIGHT = { original: 303, h400: 12, h200: 5, h100: 2 };
const kindOf = u => {
  const m = String(u).match(/3dmolier-studio\.com\/images\/(h\d+)\//);
  if (m) return m[1];
  return /3dmolier-studio\.com\/assets\//.test(u) ? 'original' : null;
};

const dirs = fs.readdirSync(MODELS);
let n = 0, withStudio = 0;
const tally = new Map();
let bytes = 0, bytesIfAllOriginal = 0;
const badHero = [];

for (let i = 0; i < dirs.length; i += EVERY) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, dirs[i], 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  n++;
  const srcs = [...h.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
  const studio = srcs.map(kindOf).filter(Boolean);
  if (!studio.length) continue;
  withStudio++;
  for (const k of studio) {
    tally.set(k, (tally.get(k) || 0) + 1);
    bytes += WEIGHT[k] || 0;
    bytesIfAllOriginal += WEIGHT.original;
  }
  // Главный снимок должен остаться оригиналом: это продающая картинка.
  const hero = (h.match(/<img src="([^"]*)"[^>]*class="mp-hero-img"/) || [])[1];
  if (hero && kindOf(hero) && kindOf(hero) !== 'original') badHero.push(dirs[i]);
}

console.log('карточек просмотрено: ' + n.toLocaleString('ru-RU')
  + (EVERY > 1 ? '  (каждая ' + EVERY + '-я)' : ''));
console.log('из них со студийными снимками: ' + withStudio.toLocaleString('ru-RU'));
console.log('\n--- какие размеры стоят ---');
for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(6) + '  ' + k.padEnd(10) + (WEIGHT[k] || '?') + ' КБ за штуку');
}
if (withStudio) {
  console.log('\nв среднем на карточку со студийными снимками:');
  console.log('  сейчас:        ' + Math.round(bytes / withStudio) + ' КБ');
  console.log('  было бы всё в оригинале: ' + Math.round(bytesIfAllOriginal / withStudio) + ' КБ');
  console.log('  выигрыш: в ' + (bytesIfAllOriginal / (bytes || 1)).toFixed(1) + ' раза');
}
console.log(badHero.length
  ? '\nГЛАВНЫЙ СНИМОК НЕ ОРИГИНАЛ у ' + badHero.length + ': ' + badHero.slice(0, 3).join(', ')
  : '\nглавный снимок везде оригинал - как задумано');
