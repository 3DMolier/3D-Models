/*
 * check-video-embed.mjs - у каких роликов запрещено встраивание.
 *
 * ЗАЧЕМ. На карточке стоит плеер. Если у ролика снята галка «Разрешить
 * встраивание», зритель получает «Видео недоступно. Владелец запретил просмотр
 * на других сайтах» - то есть карточка выглядит сломанной. Поэтому таким
 * роликам карточка показывает обложку со ссылкой на YouTube, а не плеер, и
 * список запрещённых обязан быть полным ДО публикации.
 *
 * КАК. oEmbed отдаёт 401 ровно на запрещённых и не тратит квоту API. Наружу
 * уходит только публичный номер ролика, никаких ключей.
 *
 * Проверяем лишь то, что ещё не проверено: номера из data/video-card-links.json
 * и из журналов, которых нет в tools/youtube/no-embed-ids.json. На 04.10.2026 в
 * списке 202 номера из 512 проверенных, а на канале их уже 834.
 *
 * Запуск:  node scripts/check-video-embed.mjs --dry
 *          node scripts/check-video-embed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const NOEMBED = 'D:/Clode_Work_Folder/tools/youtube/no-embed-ids.json';
const INV = 'D:/Clode_Work_Folder/tools/youtube/channel-videos.json';
const DRY = process.argv.includes('--dry');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const LIMIT = Number(arg('--limit')) || 0;

const known = new Set(JSON.parse(fs.readFileSync(NOEMBED, 'utf8')));
const ids = new Map();   // id -> название, для отчёта

const links = path.join(DATA, 'video-card-links.json');
if (fs.existsSync(links)) {
  for (const list of Object.values(JSON.parse(fs.readFileSync(links, 'utf8'))))
    for (const v of list) ids.set(v.id, v.title);
}
// Опись канала нужна, чтобы проверить и те ролики, что пока ни к чему не
// привязаны: привяжутся позже, а проверка уже будет сделана.
if (fs.existsSync(INV)) {
  for (const v of JSON.parse(fs.readFileSync(INV, 'utf8'))) if (!ids.has(v.id)) ids.set(v.id, v.title);
}

const todo = [...ids.keys()].filter(id => !known.has(id));
console.log('номеров всего: ' + ids.size + ', уже в списке запрещённых: '
  + (ids.size - todo.length) + ', проверить: ' + todo.length);
if (LIMIT) todo.length = Math.min(todo.length, LIMIT);

const check = async id => {
  const u = 'https://www.youtube.com/oembed?url='
    + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(u, { redirect: 'follow' });
      if (r.status === 401) return 'no-embed';
      if (r.ok) return 'ok';
      if (r.status === 404) return 'gone';
      if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * attempt)); continue; }
      return 'http-' + r.status;
    } catch (e) {
      if (attempt === 3) return 'error';
      await new Promise(s => setTimeout(s, 1000 * attempt));
    }
  }
  return 'error';
};

const found = [], gone = [], failed = [];
let okCount = 0, done = 0;
const BATCH = 8;                  // по восемь за раз: oEmbed не любит шквала
for (let i = 0; i < todo.length; i += BATCH) {
  const part = todo.slice(i, i + BATCH);
  const res = await Promise.all(part.map(check));
  part.forEach((id, j) => {
    const v = res[j];
    if (v === 'no-embed') found.push(id);
    else if (v === 'ok') okCount++;
    else if (v === 'gone') gone.push(id);
    else failed.push(id + ' (' + v + ')');
  });
  done += part.length;
  if (done % 80 === 0 || done === todo.length) {
    console.log('  проверено ' + done + ' из ' + todo.length
      + ': встраивание запрещено у ' + found.length + ', удалено/нет: ' + gone.length);
  }
}

console.log('\nвстраивание разрешено: ' + okCount);
console.log('встраивание ЗАПРЕЩЕНО: ' + found.length);
console.log('ролика нет (удалён или приватный): ' + gone.length);
if (failed.length) console.log('не удалось проверить: ' + failed.length + ' - ' + failed.slice(0, 5).join(', '));

if (DRY) { console.log('\n(--dry, список не изменён)'); process.exit(0); }
if (found.length) {
  const next = [...known, ...found];
  fs.writeFileSync(NOEMBED, JSON.stringify(next, null, 1));
  console.log('\nв no-embed-ids.json: было ' + known.size + ', стало ' + next.length);
} else {
  console.log('\nсписок не изменился');
}
