/*
 * check-new-merge.mjs - надо ли схлопывать новые модели, и с чем.
 *
 * ЗАЧЕМ. Основатель сказал: список моделей полный, ДО схлопывания, и то, что
 * добавим, надо склеить с существующей базой. Значит перед тем как заводить
 * страницы, надо понять: сколько новых моделей - это варианты уже живущих на
 * сайте карточек, сколько - варианты друг друга, и сколько действительно
 * одиночки.
 *
 * По чему сверяем. У TurboSquid есть свой ключ группировки `root_id`: у
 * вариантов одной модели он общий. Он точнее наших догадок по названию.
 * Дополнительно смотрим `origin_geometry_id` из выгрузки студии - признак
 * «тот же меш», проставленный самой студией.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-new-merge.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const live = [], fresh = [];
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    (r.status === 'new' ? fresh : live).push(r);
  }
}
console.log('живых карточек: ' + live.length.toLocaleString('ru-RU')
  + ', новых записей: ' + fresh.length.toLocaleString('ru-RU'));

// Ключи существующих карточек: и своя группа, и группы всех вариантов внутри.
const liveRoot = new Map();
const liveGeom = new Map();
for (const r of live) {
  if (r.root) liveRoot.set(r.root, r.slug);
  if (r.geometry_id) liveGeom.set(r.geometry_id, r.slug);
}

let joinsLive = 0, joinsEachOther = 0, alone = 0, noPreview = 0;
const groups = new Map();
const ex = [];
for (const r of fresh) {
  if (!r.image) noPreview++;
  const toLive = (r.root && liveRoot.get(r.root)) || (r.geometry_id && liveGeom.get(r.geometry_id));
  if (toLive) {
    joinsLive++;
    if (ex.length < 5) ex.push(r.slug.slice(0, 42) + '  ->  в семью ' + String(toLive).slice(0, 40));
    continue;
  }
  const key = r.root || r.geometry_id;
  if (!key) { alone++; continue; }
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r.slug);
}
for (const [, list] of groups) {
  if (list.length > 1) joinsEachOther += list.length;
  else alone++;
}

console.log('\n--- что делать с новыми ---');
console.log('  ' + String(joinsLive).padStart(5) + '  прирастают к существующей карточке (вариант живущей модели)');
console.log('  ' + String(joinsEachOther).padStart(5) + '  склеиваются между собой в новые семьи');
console.log('  ' + String(alone).padStart(5) + '  одиночки - каждая своя карточка');
console.log('\nбез превью среди новых: ' + noPreview.toLocaleString('ru-RU')
  + ' (страницу собрать не из чего)');
console.log('\nпримеры прирастающих:');
ex.forEach(x => console.log('   ' + x));
