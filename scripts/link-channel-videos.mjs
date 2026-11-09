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
/*
 * Технические слова варианта (решение основателя 22.10.2026, «один ролик на семью»):
 * Simple / Simplified, with Interior, Low Poly, рендер (Redshift, V-Ray, Corona), PBR,
 * Game Ready - облёт тот же, что у основной модели. Правило общее с
 * D:/Clode_Work_Folder/tools/video/video-families.mjs.
 *
 * Только вторым заходом: у части вариантов своя карточка (Aston Martin V12 Vantage и
 * его Simple Interior, Low Poly Pigeon), и широкий ключ сводит их в одно имя на две
 * карточки - привязка терялась. Сначала строгий ключ, широкий - когда строгий пуст.
 */
const VARIANT = /\b(simplified|simple|(with|without|no)\s+interior|interior|low\s*-?\s*poly|lowpoly|redshift|v-?ray|corona|arnold|octane|pbr|game\s*ready)\b/gi;

const normWith = wide => s => {
  let x = String(s)
    .replace(TAIL[0], ' ').replace(TAIL[1], ' ')
    .toLowerCase()
    .replace(NOISE, ' ')
    .replace(MARKS, ' ');
  if (wide) x = x.replace(VARIANT, ' ');
  return x.replace(/[^a-z0-9]+/g, ' ').trim();
};
const norm = normWith(false), normWide = normWith(true);

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
const byName = new Map(), byNameWide = new Map();
const put = (map, k, slug) => {
  if (!k || k.length < 4) return;
  if (!map.has(k)) map.set(k, new Set());
  map.get(k).add(slug);
};
const add = (name, slug) => { put(byName, norm(name), slug); put(byNameWide, normWide(name), slug); };
let records = 0;
// номер модели -> адрес живой карточки (свёрнутая версия -> главная карточка семьи); для ручных привязок
const slugById = new Map();
for (let k = 0; k < ri.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new') continue;
    records++;
    add(r.name, r.slug);
    if (r.display_name) add(r.display_name, r.slug);
    slugById.set(String(r.id), r.slug);
    for (const v of (r.family || [])) { add(v.name, r.slug); if (v.id && !slugById.has(String(v.id))) slugById.set(String(v.id), r.slug); }
  }
}
console.log('карточек в индексе: ' + fmt(records) + ', имён: ' + fmt(byName.size));

/*
 * РУЧНЫЕ ПРИВЯЗКИ - data/video-manual-links.json { "<id ролика>": { model: "<номер TurboSquid>", ... } } (09.11.2026).
 * Для роликов, которые по названию не сходятся: облёт студии назван иначе, чем товар («Swivel Office Chair
 * with Armrests» = Office Chair, совпали полигоны и цена), опечатки (Moos, Dymond), лишнее VDB у товара,
 * вольные названия 2015 года. Пары проверены руками; номер, а не адрес - адрес ищем здесь каждый день.
 * Карточка ещё не собрана (status new) - ролик ждёт и встанет сам, когда она появится.
 * Ручная привязка сильнее автоматической: её смотрел человек.
 */
const MANUAL_FILE = path.join(DATA, 'video-manual-links.json');
const manual = fs.existsSync(MANUAL_FILE) ? JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8')) : {};
let manualHit = 0, manualWait = 0;

/*
 * ОБЛЁТЫ СТУДИИ: имя файлов кадров = адрес карточки (09.11.2026).
 * upload_daily.py пишет в upload-log.csv пустой tsid почти у всех облётов, а slug облёта короче адреса
 * карточки: «sardine-school-swimming-animated» против sardine-school-swimming-animated-rigged-for-blender-2618236.
 * Зато в описании облёта (tools/video/manifests/<slug>.json) есть filenamePrefix - имя файлов модели в студии,
 * «Sardine_School_Swimming_Animated_Rigged_For_Blender_», и оно дословно совпадает с адресом карточки без номера.
 * Берём только единственное совпадение среди живых карточек.
 */
const UPLOAD_LOG = 'D:/Clode_Work_Folder/tools/youtube/upload-log.csv', MANIFESTS = 'D:/Clode_Work_Folder/tools/video/manifests/';
const prefixByVideo = new Map();
if (fs.existsSync(UPLOAD_LOG)) {
  const slugify = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const line of fs.readFileSync(UPLOAD_LOG, 'utf8').split(/\r?\n/).slice(1)) {
    const [, vid, slug] = line.split(',');
    if (!vid || !slug) continue;
    try {
      const m = JSON.parse(fs.readFileSync(MANIFESTS + slug + '.json', 'utf8'));
      const p = slugify(String(m.filenamePrefix || '').replace(/_+$/, ''));
      if (p) prefixByVideo.set(vid, p);
    } catch { /* описания облёта нет */ }
  }
}
const liveByBase = new Map();
for (const s of new Set(slugById.values())) {
  const b = s.replace(/-\d+$/, '');
  if (!liveByBase.has(b)) liveByBase.set(b, new Set());
  liveByBase.get(b).add(s);
}
let prefixHit = 0;

const links = {};
let hit = 0, ambiguous = 0, nohit = 0, dated = 0;
const exAmb = [], exNo = [];
for (const v of inv) {
  const mv = manual[v.id];
  if (mv && mv.model) {
    const ms = slugById.get(String(mv.model));
    if (!ms) { manualWait++; continue; }
    if (!links[ms]) links[ms] = [];
    links[ms].push({ id: v.id, title: v.title, date: v.published });
    manualHit++; hit++;
    if (v.published) dated++;
    continue;
  }
  const pset = prefixByVideo.has(v.id) ? liveByBase.get(prefixByVideo.get(v.id)) : null;
  if (pset && pset.size === 1) {
    const ps = [...pset][0];
    if (!links[ps]) links[ps] = [];
    links[ps].push({ id: v.id, title: v.title, date: v.published });
    prefixHit++; hit++;
    if (v.published) dated++;
    continue;
  }
  const k = norm(v.title), kw = normWide(v.title);
  // строгий ключ; пусто - широкий (технические слова варианта сняты)
  let set = byName.get(k);
  if (!set) set = byNameWide.get(kw);
  let slug = null;
  if (set && set.size === 1) slug = [...set][0];
  else if (set && set.size > 1) {
    ambiguous++;
    if (exAmb.length < 6) exAmb.push(v.title.slice(0, 60) + '  -> ' + set.size + ' карточек');
    continue;
  } else slug = byPrefix(k, byName) || byPrefix(kw, byNameWide);
  if (!slug) { nohit++; if (exNo.length < 12) exNo.push(v.published + '  ' + v.title.slice(0, 64)); continue; }
  if (!links[slug]) links[slug] = [];
  links[slug].push({ id: v.id, title: v.title, date: v.published });
  hit++;
  if (v.published) dated++;
}
console.log('роликов на канале: ' + fmt(inv.length));
console.log('  привязано к карточке: ' + fmt(hit) + ' (карточек ' + fmt(Object.keys(links).length) + ')'
  + (manualHit || manualWait ? ', из них вручную ' + fmt(manualHit) + '; ручных ждут карточку: ' + fmt(manualWait) : '')
  + ', по имени файлов облёта: ' + fmt(prefixHit));
console.log('  имя совпало с несколькими карточками, не беру: ' + fmt(ambiguous));
console.log('  модель по названию не нашлась: ' + fmt(nohit));
if (exAmb.length) { console.log('\n--- неоднозначные ---'); exAmb.forEach(x => console.log('  ' + x)); }
if (exNo.length) { console.log('\n--- не нашлись (первые) ---'); exNo.forEach(x => console.log('  ' + x)); }

if (DRY) { console.log('\n(--dry, ничего не записано)'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(links, null, 1));
console.log('\nзаписано: ' + path.relative(ROOT, OUT));
