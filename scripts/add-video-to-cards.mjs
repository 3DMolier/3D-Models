/*
 * add-video-to-cards.mjs - привязать ролики канала к карточкам моделей.
 *
 * У студии есть канал 3D Molier International (@dddmolier), на нём 557 роликов,
 * и в tools/youtube/publish-log.csv уже записано, к какой модели TurboSquid
 * относится каждый ролик и насколько привязка надёжна. 466 привязок помечены
 * уверенными, они ложатся на 240 живых карточек - на 95 из них роликов больше
 * одного, это пронумерованные ракурсы одной модели (025, 026, 027...).
 *
 * Берём на карточку один ролик - самый свежий. Пять почти одинаковых клипов
 * подряд читаются как мусор, а разметка должна описывать ровно то, что человек
 * видит на странице.
 *
 * Как встраиваем. Не голым <iframe>: он тянет около мегабайта плеера и ставит
 * куки ещё до того, как посетитель решил смотреть. Вместо этого - обложка с
 * кнопкой, а плеер подгружается по клику, с домена youtube-nocookie.com.
 * Обложка лежит на i.ytimg.com, это домен без кук.
 *
 * Стили и обработчик встраиваются прямо в эти 240 карточек, а не в общий
 * model-pages.css: иначе пришлось бы двигать номер версии css и переливать
 * все 59 639 карточек ради блока, который есть у 240.
 *
 * Запуск:
 *   node add-video-to-cards.mjs --dry [--limit N]
 *   node add-video-to-cards.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const LOG = 'D:/Clode_Work_Folder/tools/youtube/publish-log.csv';
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;
const MARK = '<!-- video:v1 -->';
const CHANNEL = 'https://www.youtube.com/@dddmolier';

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');

// ── Журнал публикаций ────────────────────────────────────────────────────────
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
    out.push(cur);
    rows.push(out);
  }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const log = parseCsv(fs.readFileSync(LOG, 'utf8'))
  .filter(r => r.video_id && String(r.confident).toLowerCase() === 'true');

// ── Идентификатор модели -> живая карточка ───────────────────────────────────
// Вариант, слитый в основную карточку, ведёт на основную: ролик снят по той же
// модели, просто выставленной отдельным товаром.
const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const byId = new Map();
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  const m = slug.match(/-(\d{5,})$/);
  if (m && !byId.has(m[1])) byId.set(m[1], merged[slug] || slug);
}

const perCard = new Map();
for (const r of log) {
  const slug = byId.get(String(r.model_id).trim());
  if (!slug) continue;
  if (!perCard.has(slug)) perCard.set(slug, []);
  perCard.get(slug).push(r);
}

// Самый свежий: по дате, при равной дате - по номеру в конце названия.
const numOf = t => +((t.match(/\s(\d{1,3})(?:\s|$)/) || [])[1] || 0);
for (const [, list] of perCard) {
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || numOf(b.title) - numOf(a.title));
}

let cards = [...perCard.entries()];
if (LIMIT) cards = cards.slice(0, LIMIT);
console.log('карточек с уверенной привязкой: ' + perCard.size + (LIMIT ? ' (берём ' + cards.length + ')' : ''));

// ── Стили и обработчик ───────────────────────────────────────────────────────
const CSS = '<style>'
  + '.mp-video{margin:26px 0 0}'
  + '.mp-video .mp-block-h2{margin:0 0 12px}'
  + '.mp-video-frame{position:relative;display:block;width:100%;aspect-ratio:16/9;border:0;padding:0;'
  + 'border-radius:10px;overflow:hidden;background:#0e1116;cursor:pointer}'
  + '.mp-video-frame img{width:100%;height:100%;object-fit:cover;display:block;'
  + 'transition:transform .4s cubic-bezier(.2,.7,.3,1),opacity .2s}'
  + '.mp-video-frame:hover img{transform:scale(1.03);opacity:.86}'
  + '.mp-video-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
  + 'width:66px;height:46px;border-radius:12px;background:rgba(17,17,17,.82);'
  + 'display:flex;align-items:center;justify-content:center;transition:background .2s}'
  + '.mp-video-frame:hover .mp-video-play{background:#e12b28}'
  + '.mp-video-play::after{content:"";border-style:solid;border-width:9px 0 9px 15px;'
  + 'border-color:transparent transparent transparent #fff;margin-left:3px}'
  + '.mp-video-frame:focus-visible{outline:2px solid #0d9488;outline-offset:2px}'
  + '.mp-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}'
  + '.mp-video-cap{margin:9px 0 0;font-size:13px;color:#6b7280;line-height:1.5}'
  + '.mp-video-cap a{color:#0d9488;text-decoration:none}'
  + '.mp-video-cap a:hover{text-decoration:underline}'
  + '</style>';

// Обложка вместо плеера: пока не нажали, страница не обращается к YouTube.
const JS = '<script>(function(){'
  + 'var b=document.querySelector(".mp-video-frame");if(!b)return;'
  + 'b.addEventListener("click",function(){'
  + 'var id=b.getAttribute("data-yt");if(!id||b.dataset.on)return;b.dataset.on="1";'
  + 'var f=document.createElement("iframe");'
  + 'f.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&rel=0";'
  + 'f.title=b.getAttribute("data-title")||"Video";'
  + 'f.allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture";'
  + 'f.setAttribute("allowfullscreen","");f.loading="lazy";'
  + 'b.innerHTML="";b.appendChild(f);b.style.cursor="default";});'
  + '})();<\/script>';

// ── Обход карточек ───────────────────────────────────────────────────────────
const stat = { ok: 0, already: 0, noAnchor: 0, skip: 0, multi: 0 };
for (const [slug, list] of cards) {
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) { stat.skip++; continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(html)) { stat.skip++; continue; }
  if (html.includes(MARK)) { stat.already++; continue; }
  if (!html.includes('<div class="mp-faq-block">')) { stat.noAnchor++; continue; }

  const v = list[0];
  const title = v.title.replace(/\s*\|\s*3D Molier International\s*$/i, '').trim();
  const modelName = (html.match(/<h1[^>]*class="mp-h1"[^>]*>([\s\S]*?)<\/h1>/) || [])[1]
    ?.replace(/<[^>]+>/g, '').trim() || slug;
  const moving = /animated|rigged/i.test(title);
  const heading = moving ? 'See this model in motion' : 'Model preview video';
  const thumb = 'https://i.ytimg.com/vi/' + v.video_id + '/hqdefault.jpg';
  const watch = 'https://www.youtube.com/watch?v=' + v.video_id;
  if (list.length > 1) stat.multi++;

  const more = list.length > 1
    ? ' <a href="' + CHANNEL + '" target="_blank" rel="noopener">' + (list.length - 1)
      + ' more clip' + (list.length > 2 ? 's' : '') + ' of this model on our channel</a>.'
    : ' <a href="' + CHANNEL + '" target="_blank" rel="noopener">More models on our channel</a>.';

  const block = '<div class="mp-video">'
    + '<h2 class="mp-block-h2">' + heading + '</h2>'
    + '<button type="button" class="mp-video-frame" data-yt="' + attr(v.video_id) + '"'
    + ' data-title="' + attr(title) + '" aria-label="Play video: ' + attr(title) + '">'
    + '<img src="' + attr(thumb) + '" alt="" width="480" height="360" loading="lazy" decoding="async">'
    + '<span class="mp-video-play" aria-hidden="true"></span>'
    + '</button>'
    + '<p class="mp-video-cap">' + esc(title) + ' - from the 3D Molier channel.' + more + '</p>'
    + '</div>';

  html = html.replace('<div class="mp-faq-block">', () => block + '<div class="mp-faq-block">');

  // Разметка VideoObject. Описываем ровно тот ролик, который на странице виден
  // и запускается по клику - иначе Google считает разметку недостоверной.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: 'Animation of the ' + modelName + ' 3D model by 3D Molier.',
    thumbnailUrl: ['https://i.ytimg.com/vi/' + v.video_id + '/maxresdefault.jpg', thumb],
    uploadDate: v.date,
    embedUrl: 'https://www.youtube.com/embed/' + v.video_id,
    contentUrl: watch,
    publisher: { '@type': 'Organization', name: '3D Molier', url: 'https://3dmolierstudio.com/' },
  };
  const tag = '<script type="application/ld+json">'
    + JSON.stringify(schema).replace(/</g, '\\u003c') + '<\/script>';

  html = html.replace('</head>', () => CSS + MARK + '</head>');
  html = html.replace('</body>', () => JS + tag + '</body>');

  if (!DRY) fs.writeFileSync(file, html);
  stat.ok++;
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('карточек с видео:        ' + stat.ok);
console.log('  из них с 2+ роликами:  ' + stat.multi + ' (показываем самый свежий, остальные ссылкой на канал)');
console.log('уже было:                ' + stat.already);
console.log('нет якоря для вставки:   ' + stat.noAnchor);
console.log('пропущено:               ' + stat.skip);
