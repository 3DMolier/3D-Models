/*
 * link-channel-videos.mjs - привязать ролики канала к карточкам по НАЗВАНИЮ.
 *
 * ЗАЧЕМ. Журналов загрузки два, и ни один не является описью канала:
 * publish-log.csv не знает ежедневных загрузок, upload-log.csv не знает старых.
 * Опись снимается с самого канала (tools/youtube/scan_channel_videos.py ->
 * channel-videos.json), и вот её мы сопоставляем с карточками.
 *
 * КАК СОПОСТАВЛЯЕМ. Только по названию и только однозначно. Название ролика -
 * это имя модели плюс хвост: « | 3D Molier International», « - 3D Model»,
 * признаки исполнения («Animated», «Rigged», «For Maya», «Showcase», «Split»).
 * Хвост снимаем, остаток сверяем с именами моделей - именем записи, показанным
 * именем и именами всех свёрнутых версий. Совпало с одной карточкой - берём;
 * совпало с несколькими или ни с одной - НЕ берём. Лучше карточка без ролика,
 * чем облёт чужой модели: это ошибка, которую покупатель заметит сразу.
 *
 * ВЫХОД: data/video-card-links.json  { "<slug>": [{ id, title, date }] }
 * Его читает build-model-records.mjs как третий источник роликов.
 *
 * Запуск:  node scripts/link-channel-videos.mjs --dry
 *          node scripts/link-channel-videos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const RECS = path.join(DATA, 'records');
const INV = 'D:/Clode_Work_Folder/tools/youtube/channel-videos.json';
const OUT = path.join(DATA, 'video-card-links.json');
const DRY = process.argv.includes('--dry');
const fmt = n => Number(n).toLocaleString('ru-RU');

/*
 * Хвосты в названиях роликов. Это не часть имени модели: один и тот же меш
 * выходит на канал и как «Showcase», и как «Animated Rigged For Maya».
 */
const TAIL = [
  /\s*\|\s*3d\s*molier.*$/i,
  /\s*[-–]\s*3d\s*model\s*$/i,
];
/*
 * Ролики 2007-2016 годов названы вольно: «3d model of Ball and Chain Flail by
 * 3d_molier International», «Ford F 150 Raptor 2017 Rigged 3d model by
 * 3d_molier». Подпись студии и слова «3d model» к имени модели не относятся.
 */
const NOISE = /\b(by\s+)?3d[\s_]*molier(\s+international)?\b|\b3dmolier(\s*studio)?\b|\b3d\s*model(s)?\s*(of|by)?\b|\bhd\b|\b4k\b/gi;
const MARKS = /\b(showcase|split|turntable|turn\s*table|rotation|flyaround|fly\s*around|animated|animation|rigged|rig|idle|loop|preview|render|demo|for\s+(maya|blender|cinema\s*4d|c4d|3ds\s*max|max|unreal|unity|houdini|modo|lightwave|sketchup))\b/gi;

const norm = s => String(s)
  .replace(TAIL[0], ' ').replace(TAIL[1], ' ')
  .toLowerCase()
  .replace(NOISE, ' ')
  .replace(MARKS, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/*
 * Второй заход: обрезаем название справа по словам.
 *
 * У ролика в конце часто остаётся то, чего в имени модели нет вовсе - поза,
 * ракурс, номер дубля. Имя модели при этом стоит в начале. Поэтому пробуем
 * «всё название», потом без последнего слова, потом без двух и так далее, и
 * берём ПЕРВОЕ попадание - самое длинное из возможных. Короче трёх слов или
 * двенадцати знаков не опускаемся: «ford» или «chair» совпадёт с чем угодно.
 */
const MIN_WORDS = 3, MIN_CHARS = 12;
function byPrefix(key, byName) {
  const w = key.split(' ').filter(Boolean);
  for (let n = w.length; n >= MIN_WORDS; n--) {
    const k = w.slice(0, n).join(' ');
    if (k.length < MIN_CHARS) break;
    const set = byName.get(k);
    if (set && set.size === 1) return [...set][0];
    if (set && set.size > 1) return null;   // неоднозначно - дальше не лезем
  }
  return null;
}

const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
const ri = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));

/*
 * Индекс имён. Ключ - нормализованное имя, значение - набор адресов карточек.
 * Набор, а не адрес: одноимённых моделей в каталоге хватает, и такие названия
 * мы потом просто не берём.
 */
const byName = new Map();
const add = (name, slug) => {
  const k = norm(name);
  if (!k || k.length < 4) return;
  if (!byName.has(k)) byName.set(k, new Set());
  byName.get(k).add(slug);
};
let records = 0;
for (let k = 0; k < ri.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new') continue;
    records++;
    add(r.name, r.slug);
    if (r.display_name) add(r.display_name, r.slug);
    for (const v of (r.family || [])) add(v.name, r.slug);
  }
}
console.log('карточек в индексе: ' + fmt(records) + ', имён: ' + fmt(byName.size));

const links = {};
let hit = 0, ambiguous = 0, nohit = 0, dated = 0;
const exAmb = [], exNo = [];
for (const v of inv) {
  const k = norm(v.title);
  const set = byName.get(k);
  let slug = null;
  if (set && set.size === 1) slug = [...set][0];
  else if (set && set.size > 1) {
    ambiguous++;
    if (exAmb.length < 6) exAmb.push(v.title.slice(0, 60) + '  -> ' + set.size + ' карточек');
    continue;
  } else slug = byPrefix(k, byName);
  if (!slug) { nohit++; if (exNo.length < 12) exNo.push(v.published + '  ' + v.title.slice(0, 64)); continue; }
  if (!links[slug]) links[slug] = [];
  links[slug].push({ id: v.id, title: v.title, date: v.published });
  hit++;
  if (v.published) dated++;
}
console.log('роликов на канале: ' + fmt(inv.length));
console.log('  привязано к карточке: ' + fmt(hit) + ' (карточек ' + fmt(Object.keys(links).length) + ')');
console.log('  имя совпало с несколькими карточками, не беру: ' + fmt(ambiguous));
console.log('  модель по названию не нашлась: ' + fmt(nohit));
if (exAmb.length) { console.log('\n--- неоднозначные ---'); exAmb.forEach(x => console.log('  ' + x)); }
if (exNo.length) { console.log('\n--- не нашлись (первые) ---'); exNo.forEach(x => console.log('  ' + x)); }

if (DRY) { console.log('\n(--dry, ничего не записано)'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(links, null, 1));
console.log('\nзаписано: ' + path.relative(ROOT, OUT));
