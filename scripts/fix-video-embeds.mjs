/*
 * fix-video-embeds.mjs - убрать с карточек плееры, которые не запускаются.
 *
 * Что случилось. Встроив ролики, я не проверил, разрешено ли их встраивание.
 * У 188 из 464 роликов канала владелец запретил воспроизведение на других
 * сайтах, и на 116 карточках из 240 вместо видео показывалось «Видео
 * недоступно. Владелец видео запретил его просмотр на других сайтах».
 *
 * Признак запрета - oEmbed отдаёт 401 Unauthorized. Квоту API это не тратит,
 * так что проверять можно все ролики разом (scratchpad/scan-embeddable.mjs).
 *
 * Что делаем:
 *   - где у модели есть другой клип, который встраивать разрешено, - меняем
 *     ролик на него (20 карточек);
 *   - где все клипы модели запрещены (96 карточек) - убираем плеер и ставим
 *     обложку-ссылку на YouTube. Разметку VideoObject с таких карточек
 *     снимаем: она обещает поисковику видео, которое на странице не играет.
 *
 * Правильное лечение - разрешить встраивание в настройках роликов. Тогда эти
 * 96 вернутся полноценными плеерами вместе с разметкой.
 *
 * Запуск:
 *   node fix-video-embeds.mjs --dry
 *   node fix-video-embeds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const SCRATCH = 'C:/Users/MSI-PC/AppData/Local/Temp/claude/D--Clode-Work-Folder/22612e3b-7998-4889-adec-0160bab9ad4d/scratchpad';
const DRY = process.argv.includes('--dry');
const CHANNEL = 'https://www.youtube.com/@dddmolier';

const status = JSON.parse(fs.readFileSync(SCRATCH + '/embeddable.json', 'utf8'));
const fix = JSON.parse(fs.readFileSync(SCRATCH + '/video-fix.json', 'utf8'));
const cards = JSON.parse(fs.readFileSync('D:/Clode_Work_Folder/tools/youtube/video-card-map.json', 'utf8'));

// Названия роликов - из журнала публикаций.
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); rows.push(out);
  }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const titles = new Map();
for (const r of parseCsv(fs.readFileSync('D:/Clode_Work_Folder/tools/youtube/publish-log.csv', 'utf8'))) {
  if (r.video_id) titles.set(r.video_id, r.title.replace(/\s*\|\s*3D Molier International\s*$/i, '').trim());
}

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');
const BLOCK = /<div class="mp-video">[\s\S]*?<\/div>(?=<div class="mp-faq-block">)/;

const swapBy = new Map(fix.swaps.map(s => [s.slug, s]));
const deadBy = new Set(fix.dead.map(d => d.slug));

const stat = { swapped: 0, linked: 0, untouched: 0, noBlock: 0 };
const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVar = new Set(Object.keys(merged));

for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  if (isVar.has(slug)) continue;
  const file = path.join(ROOT, 'models', slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (!html.includes('<!-- video:v1 -->')) continue;

  const swap = swapBy.get(slug);
  const dead = deadBy.has(slug);
  if (!swap && !dead) { stat.untouched++; continue; }
  if (!BLOCK.test(html)) { stat.noBlock++; console.log('  блок не найден: ' + slug); continue; }

  const old = html.match(BLOCK)[0];
  const clips = Object.entries(cards).filter(([, c]) => c.slug === slug).length;

  if (swap) {
    // Меняем идентификатор всюду: кнопка, обложка, подпись, разметка.
    const t = titles.get(swap.to) || '';
    let next = old.split(swap.from).join(swap.to);
    next = next.replace(/data-title="[^"]*"/, () => 'data-title="' + attr(t) + '"');
    next = next.replace(/aria-label="Play video: [^"]*"/, () => 'aria-label="Play video: ' + attr(t) + '"');
    next = next.replace(/<p class="mp-video-cap">[^<]*/, () => '<p class="mp-video-cap">' + esc(t) + ' - from the 3D Molier channel.');
    html = html.replace(old, () => next);
    // Разметка: там тот же идентификатор и название.
    html = html.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"VideoObject"[\s\S]*?<\/script>/,
      (m) => m.split(swap.from).join(swap.to).replace(/"name":"[^"]*"/, () => '"name":"' + t.replace(/"/g, '\\"') + '"'));
    stat.swapped++;
  } else {
    // Плеера не будет: обложка ведёт на YouTube, разметку снимаем.
    const vid = (old.match(/data-yt="([^"]+)"/) || [])[1];
    const t = titles.get(vid) || '';
    const more = clips > 1
      ? ' <a href="' + CHANNEL + '" target="_blank" rel="noopener">' + (clips - 1)
        + ' more clip' + (clips > 2 ? 's' : '') + ' of this model on our channel</a>.'
      : ' <a href="' + CHANNEL + '" target="_blank" rel="noopener">More models on our channel</a>.';
    const next = '<div class="mp-video">'
      + '<h2 class="mp-block-h2">See this model in motion</h2>'
      + '<a href="https://www.youtube.com/watch?v=' + attr(vid) + '" target="_blank" rel="noopener"'
      + ' class="mp-video-frame mp-video-out" aria-label="Watch on YouTube: ' + attr(t) + '">'
      + '<img src="https://i.ytimg.com/vi/' + attr(vid) + '/hqdefault.jpg" alt="" width="480" height="360"'
      + ' loading="lazy" decoding="async">'
      + '<span class="mp-video-play" aria-hidden="true"></span>'
      + '<span class="mp-video-out-tag">Watch on YouTube</span>'
      + '</a>'
      + '<p class="mp-video-cap">' + esc(t) + ' - plays on the 3D Molier channel.' + more + '</p>'
      + '</div>';
    html = html.replace(old, () => next);
    // Разметка обещала бы поисковику видео, которого на странице нет.
    html = html.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"VideoObject"[\s\S]*?<\/script>/, '');
    // Обработчик клика больше не нужен - ссылка работает сама.
    html = html.replace(/<script>\(function\(\)\{var b=document\.querySelector\("\.mp-video-frame"\);[\s\S]*?\}\)\(\);<\/script>/, '');
    stat.linked++;
  }

  // Оформление ссылки-обложки: подпись поверх, чтобы было видно, что уводит.
  if (!html.includes('.mp-video-out-tag{')) {
    html = html.replace('.mp-video-cap{',
      () => '.mp-video-out{text-decoration:none;display:block}'
        + '.mp-video-out-tag{position:absolute;right:10px;bottom:10px;background:rgba(17,17,17,.82);'
        + 'color:#fff;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:6px}'
        + '.mp-video-cap{');
  }

  if (!DRY) fs.writeFileSync(file, html);
}

console.log((DRY ? 'ПРОБНЫЙ ПРОГОН' : 'записано') + ':');
console.log('  ролик заменён на разрешённый: ' + stat.swapped);
console.log('  плеер заменён ссылкой:        ' + stat.linked);
console.log('  не трогали (работает):        ' + stat.untouched);
console.log('  блок не найден:               ' + stat.noBlock);
