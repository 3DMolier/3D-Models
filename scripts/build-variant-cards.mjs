/*
 * build-variant-cards.mjs - карточка модели с разделением презентации и версий.
 *
 * Чем отличается от прошлой попытки (build-variant-demo.mjs, забракована 20.08).
 * Та строила отдельную страницу с нуля и растеряла всё, ради чего карточка нужна:
 * зум, характеристики, описание, вопросы, related, подвал. Здесь берётся НАСТОЯЩАЯ
 * карточка и правится точечно - остальное остаётся ровно таким, как было.
 *
 * Что делаем:
 *   1. Галерея. В карточке был один кадр на версию - подставляем все кадры САМОЙ
 *      модели из инвентаря. Кадры сшитых версий в презентацию не идут: их бывает
 *      под полторы сотни и модель в них тонет.
 *   2. Лента кадров - одна строка со стрелками по бокам, как на TurboSquid.
 *      Остаётся в левой колонке и не заезжает под блок покупки.
 *   3. Секция версий. Была узким списком у характеристик - переносим вниз, к
 *      related, и оформляем такой же сеткой: превью, название, цена, переход на
 *      TurboSquid. Снизу линия, отделяющая её от «Related 3D Models».
 *   4. Характеристики - в правую колонку, одной колонкой. Quick Info убран: он
 *      дублировал цену, категорию и сертификацию.
 *   5. Из инвентаря добавляем то, чего в каталоге нет вовсе: полигоны, вершины,
 *      геометрию, риг, число текстур, развёртку - и ключевые слова (у 84%
 *      моделей их там 20-25 против четырёх на карточке).
 *   6. Похожие модели дополняем до 10 - два полных ряда вместо ряда и огрызка.
 *   7. Подвал - общий с главной страницей.
 *
 * Данные берём из самой карточки (цены, ссылки, превью версий - они там уже
 * выверены) и из инвентаря (кадры, геометрия, слова). Ничего не выдумываем.
 *
 * Запуск:  node build-variant-cards.mjs [--outdir preview/cards] [--noindex]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const OUTDIR = argv.includes('--outdir') ? argv[argv.indexOf('--outdir') + 1] : 'preview/cards';
const NOINDEX = argv.includes('--noindex');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'variant-demo.json'), 'utf8'));

const esc = s => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Разбираем существующий список версий: там уже лежат превью, названия, цены и
// ссылки с нужной реферальной меткой. Своё ничего не сочиняем.
function parseVersions(html) {
  const sec = (html.match(/<section class="mp-variants">([\s\S]*?)<\/section>/) || [])[1];
  if (!sec) return [];
  const out = [];
  for (const m of sec.matchAll(/<li class="mp-var([^"]*)">([\s\S]*?)<\/li>/g)) {
    const isMain = /is-main/.test(m[1]);
    const li = m[2];
    const thumb = (li.match(/class="mp-var-thumb"[^>]*src="([^"]+)"/) || [])[1] || '';
    let name = (li.match(/<span class="mp-var-name">([\s\S]*?)<\/span>/) || [])[1] || '';
    name = name.replace(/<span class="mp-var-badge">[\s\S]*$/, '').replace(/<[^>]+>/g, '').trim();
    const price = (li.match(/<span class="mp-var-price">([^<]*)<\/span>/) || [])[1] || '';
    const link = (li.match(/class="mp-var-link" href="([^"]+)"/) || [])[1] || '';
    const id = (link.match(/-(\d+)(?:\?|$)/) || [])[1] || '';
    // Старые подписи бывают бессодержательными - «Standard (2)», «Standard (3)».
    // Настоящее имя модели лежит в адресе TurboSquid и говорит куда больше,
    // поэтому в заголовок берём его, а старую подпись оставляем меткой отличия.
    const fromLink = (link.match(/3d-models\/([a-z0-9-]+)-\d+/i) || [])[1] || '';
    const pretty = fromLink
      ? fromLink.replace(/-3d-model$/, '').split('-')
        .map(w => /^(3d|us|uv|la|mk|ii|iii|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      : name;
    // Хвост «(2)» в подписи различал одинаковые ярлыки в старом списке. В сетке
    // версии и так подписаны настоящими именами, и этот хвост только мешает.
    const bare = name.trim().replace(/\s*\(\d+\)$/, '');
    const weak = /^standard$/i.test(bare);
    out.push({ isMain, thumb, name: pretty || name, tag: weak ? '' : bare, price, link, id });
  }
  return out;
}

// ── похожие модели: доводим до 10 ───────────────────────────────────────────
// В сетке помещается пять в ряд, а карточек стояло шесть: второй ряд с одной
// штукой выглядел обрубком. Берём тех же соседей по категории, что и
// rebuild-related.mjs (тот же models_master.csv, тот же отбор по общим словам
// названия), и дополняем до десяти - двух полных рядов.
const RELATED_WANT = 10;
const master = (() => {
  const map = new Map();
  try {
    const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
    const H = L[0].split(',');
    const ix = n => H.indexOf(n);
    const pc = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
    for (let i = 1; i < L.length; i++) {
      if (!L[i]) continue;
      const r = pc(L[i]);
      map.set(r[ix('slug')], { name: r[ix('product_name')] || '', price: +r[ix('price')] || 0, cat: r[ix('category')] || '' });
    }
  } catch (e) { console.log('  models_master.csv не прочитан: похожие не дополняю'); }
  return map;
})();
const STOP = new Set(['3d', 'model', 'models', 'the', 'and', 'for', 'with', 'of', 'set', 'collection',
  'rigged', 'animated', 'low', 'high', 'poly', 'pbr', 'game', 'ready', 'realistic', 'generic', 'new', 'old']);
const titleWords = n => new Set(String(n).toLowerCase().match(/[a-z]{3,}/g)?.filter(w => !STOP.has(w)) || []);

function extraRelated(slug, exclude, want) {
  const me = master.get(slug);
  if (!me || !me.cat) return [];
  const mine = titleWords(me.name);
  const scored = [];
  for (const [s, m] of master) {
    if (m.cat !== me.cat || exclude.has(s) || s === slug) continue;
    if (!fs.existsSync(path.join(ROOT, 'models', s, 'index.html'))) continue;
    let score = 0;
    for (const w of titleWords(m.name)) if (mine.has(w)) score++;
    // Совпадение слов - лучший признак, но одним им ряд не набрать: у «Pig Sow
    // Landrace» соседей по словам нет вовсе. Поэтому берём и просто соседей по
    // категории, ставя их после совпавших и предпочитая близкие по цене.
    scored.push({ s, m, score, near: Math.abs((m.price || 0) - (me.price || 0)) });
    if (scored.length > 1200) break;
  }
  scored.sort((a, b) => b.score - a.score || a.near - b.near);
  const out = [];
  for (const { s, m } of scored) {
    if (out.length >= want) break;
    let img = null;
    try {
      const h = fs.readFileSync(path.join(ROOT, 'models', s, 'index.html'), 'utf8');
      img = (h.match(/property="og:image" content="([^"]+)"/) || [])[1] || null;
    } catch (e) { }
    if (!img) continue;
    out.push(`<a href="/models/${s}/" class="model-card card-glow mp-rc-link">`
      + `<div class="img-wrap mp-rc-img-wrap"><img src="${esc(img)}" alt="${esc(m.name)}" width="800" height="450"`
      + ` decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
      + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
      + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(m.name)}</div></div>`
      + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">${esc(m.cat)}</span>`
      + `<span class="mp-rc-price">$${m.price}</span></div></div></a>`);
  }
  return out;
}

// Подвал главной страницы: карточки должны носить его же, а не свой обрезанный.
const HOME_FOOTER = (() => {
  try {
    const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const i = h.lastIndexOf('<footer');
    return i < 0 ? null : h.slice(i, h.indexOf('</footer>', i) + '</footer>'.length);
  } catch { return null; }
})();

// Позиция ПЕРЕД закрывающим </div> блока, начинающегося на start. Считаем
// вложенность: иначе вставка попадает внутрь первой вложенной карточки.
function endOfDiv(html, start) {
  if (start < 0) return -1;
  let depth = 0, i = start;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return m.index; }
    else depth++;
  }
  return -1;
}

// Кадры версии из инвентаря. Ключ - идентификатор TurboSquid, он же в ссылке.
//
// Порядок. Приложение отдаёт вложения вперемешку, и в презентацию первыми лезли
// технические кадры - сетка, развёртка, листы текстур. Правильный порядок задан
// самой студией в имени файла: «..._000.jpg», «..._001.jpg» и так далее, причём
// красивые рендеры идут в начале нумерации, а техническое - в хвосте (и почти
// всегда в png). Поэтому сортируем по этому числу.
// Разбор текста на предложения. Режем по точке перед заглавной буквой, но не
// внутри тегов: в описании встречаются ссылки, и разрыв посреди тега испортил бы
// разметку. Поэтому куски с незакрытым тегом склеиваем обратно.
function sentences(text) {
  const raw = String(text).trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
  const out = [];
  for (const piece of raw) {
    const prev = out[out.length - 1];
    const unbalanced = prev !== undefined
      && (prev.split('<').length !== prev.split('>').length
        || /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*$/i.test(prev));
    if (unbalanced) out[out.length - 1] = prev + ' ' + piece;
    else out.push(piece);
  }
  return out;
}

// Группировка предложений в абзацы. Одинокое предложение в конце выглядит
// обрывком, поэтому приклеиваем его к предыдущему абзацу.
function paras(list, per) {
  const out = [];
  for (let i = 0; i < list.length; i += per) out.push(list.slice(i, i + per).join(' '));
  if (out.length > 1 && list.length % per === 1) {
    const tail = out.pop();
    out[out.length - 1] += ' ' + tail;
  }
  return out;
}

// Текстуры: одно число покупателю ничего не говорит, а размеры карт говорят
// многое. Поле details инвентаря хранит их построчно:
//   «- 10.png (4096 x 4096)\n- 5.png (2048 x 2048)»
// Сворачиваем в «20 maps - 10 at 4096x4096, 5 at 2048x2048».
// Записей два вида, оба встречаются массово:
//   «- 10.png (4096 x 4096)»    количество перед расширением, размер в скобках
//   «- (21 .png) 4096 x 4096»   количество в скобках, размер после
// Размеры удаётся разобрать у 72% моделей; у остальных остаётся одно число.
function texSizes(d) {
  const t = String(d.details || '');
  const out = [];
  for (const m of t.matchAll(/(\d+)\s*\.\w+\s*\((\d+)\s*x\s*(\d+)\)/gi)) out.push({ n: +m[1], w: +m[2], h: +m[3] });
  if (!out.length) {
    for (const m of t.matchAll(/\(\s*(\d+)\s*\.?\w*\s*\)\s*(\d+)\s*x\s*(\d+)/gi)) out.push({ n: +m[1], w: +m[2], h: +m[3] });
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h);
}
function texLine(d) {
  const n = d.ntextures ? Number(d.ntextures) : null;
  const sizes = texSizes(d);
  if (!n && !sizes.length) return null;
  if (!sizes.length) return String(n) + ' maps';
  // Обычный «x», а не сущность: значение проходит через esc() и сущность бы
  // экранировалась второй раз.
  // Когда размер один на все карты, «21 maps - 21 at 4096x4096» звучит глупо.
  if (sizes.length === 1) return (n || sizes[0].n) + ' maps at ' + sizes[0].w + 'x' + sizes[0].h;
  const parts = sizes.map(s => s.n + ' at ' + s.w + 'x' + s.h);
  return (n ? n + ' maps - ' : '') + parts.join(', ');
}

function frameOrder(u) {
  const n = (String(u).match(/_(\d{2,4})\.(?:jpg|jpeg|png|webp)/i) || [])[1];
  const isPng = /\.png(?:\?|$)/i.test(u);
  // Без номера кадр кладём в конец, но перед техническими png.
  return (n === undefined ? 9000 : Number(n)) + (isPng ? 10000 : 0);
}
function framesFor(group, id) {
  const raw = group.main.id === id
    ? (group.main.data.images || [])
    : ((group.vars.find(x => x.id === id) || {}).data || {}).images || [];
  const sorted = raw.slice().sort((a, b) => frameOrder(a) - frameOrder(b));
  // Кадр «_000» - квадратная миниатюра 1200x1200, повторяющая следующий кадр
  // 1480x800. Проверено на выборке: из 14 моделей квадратными оказались все 14.
  // В презентации она лишняя, но если других кадров нет - оставляем, иначе
  // карточка останется вовсе без картинки.
  if (sorted.length > 1 && frameOrder(sorted[0]) === 0) return sorted.slice(1);
  return sorted;
}

const STYLE = `<style>
/* Лента кадров. Горизонтальная прокрутка была незаметна, а раскрытие всех кадров
   в высоту растягивало страницу на экраны вниз: крупный снимок уезжал наверх, и
   после клика по миниатюре приходилось скроллить обратно, чтобы его увидеть.
   Плюс справа от растянутой ленты зияла пустая колонка.
   Поэтому лента - панель ФИКСИРОВАННОЙ высоты со своей прокруткой. Длина
   страницы от числа кадров больше не зависит вообще. */
/* Одна строка кадров со стрелками по бокам, как на TurboSquid. Сетка в несколько
   рядов давала простыню и заезжала под правый блок. */
.mp-gal-row{display:flex;align-items:center;gap:8px}
.mp-gal-strip{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;
  scroll-behavior:smooth;scrollbar-width:none;flex:1 1 auto;min-width:0;padding-bottom:2px}
.mp-gal-strip::-webkit-scrollbar{display:none}
.mp-gal-strip .mp-gal-thumb{flex:0 0 104px;width:104px;height:auto;aspect-ratio:16/10}
.mp-gal-strip .mp-gal-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.mp-gal-arrow{flex:0 0 auto;width:30px;height:56px;display:flex;align-items:center;justify-content:center;
  background:#fff;border:1px solid #d4d4d4;border-radius:4px;font-size:19px;line-height:1;color:#111;cursor:pointer}
.mp-gal-arrow:hover{border-color:#111}
.mp-gal-arrow[disabled]{opacity:.3;cursor:default}
.mp-gal-hint{font-size:12px;color:#6b7280;margin-top:8px}
/* Липкий крупный снимок пробовали - он конфликтует с шапкой сайта и оставляет
   провал над собой. Вместо этого лента фиксированной высоты: снимок и лента
   помещаются на один экран, и подтягивать ничего не нужно. */
/* Лента остаётся в левой колонке под снимком и НЕ лезет под правый блок:
   во всю ширину она наезжала на карточку с ценой. Левую колонку делаем шире,
   правую уже. Селектор не слабее «.mp-hero-grid > .mp-gallery» в model-pages.css,
   иначе правило сайта перебивает это по точности. */
@media(min-width:900px){
  .mp-hero-grid{grid-template-columns:2.2fr 1fr}
  .mp-hero-grid > .mp-gallery{grid-column:1;grid-row:2}
}
/* Отбивка между кадрами модели и кадрами версий. Намеренно сдержанная: линия и
   подпись в том же стиле, что section-label, без цветных плашек. */
.mp-gal-split{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:16px 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.mp-gal-split::after{content:"";flex:1;height:1px;background:#e5e5e5}
.mp-gal-thumb--var{position:relative}
.mp-gal-thumb--var::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#111;opacity:.5;border-radius:2px 0 0 2px;z-index:1}
.mp-gal-cap-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:13px}
.mp-gal-cap-price{color:#6b7280;font-variant-numeric:tabular-nums}
.mp-gal-cap-link{color:#1659c9;text-decoration:none;font-weight:600}
.mp-gal-cap-tag{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;border:1px solid #d4d4d4;border-radius:20px;padding:2px 8px}
/* Секция версий - той же сеткой, что related, чтобы читалась как часть страницы. */
.mp-versions-section{margin:34px 0 0}
.mp-ver-chip{font-size:11px}
/* Характеристики переезжают в правую колонку - так договаривались, и заодно это
   лечит пустоту: раньше слева стояли описание, характеристики и вопросы, а
   справа болталась одна карточка Quick Info. Колонка узкая, поэтому таблица
   раскладывается строками «подпись - значение», как в Quick Info. */
.mp-sidebar-col .mp-spec-block{max-width:none;margin:0}
.mp-sidebar-col .mp-spec-block .mp-block-h2{font-size:15px;margin:0 0 12px}
.mp-sidebar-col .mp-spec-table{width:100%;border-collapse:collapse;font-size:13px}
.mp-sidebar-col .mp-spec-table th,.mp-sidebar-col .mp-spec-table td{display:block;width:auto}
.mp-sidebar-col .mp-spec-table tr{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
  padding:8px 0;border-bottom:1px solid #ececec}
.mp-sidebar-col .mp-spec-table tr:last-child{border-bottom:0}
.mp-sidebar-col .mp-spec-table th{color:#6b7280;font-weight:500;text-align:left;flex:0 0 auto}
.mp-sidebar-col .mp-spec-table td{text-align:right;flex:1 1 auto;overflow-wrap:anywhere}
.mp-spec-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:20px}
/* Характеристики в ОДНУ колонку - так решил основатель. Двухстолбцовую раскладку
   пробовали ради выравнивания высот, от неё отказались. Левый блок шире правого:
   в узкой колонке подпись и значение перестают расползаться по краям. */
@media(min-width:900px){ .mp-details-grid{grid-template-columns:2.2fr 1fr} }
/* Разделитель между «All Versions» и «Related 3D Models». Внутренний блок был
   шириной с контейнер и не совпадал с линией над секцией версий - та идёт во всю
   ширину окна. Поэтому граница у самой секции. */
.mp-versions-section{border-bottom:1px solid #e5e5e5}
/* Ключевые слова из инвентаря: у 84% моделей они там есть и их заметно больше
   тех четырёх, что стояли на карточке. Оформление берём у существующих чипов,
   чтобы блок не выглядел приезжим. */
.mp-kw-block{margin-top:26px}
.mp-footer-back{padding-top:14px}
/* Описание было уже вопросов: у .mp-desc-text стоит max-width 680px, а у блока
   вопросов ограничение снято. Рядом это читалось как разная вёрстка. */
.mp-details-left .mp-desc-text{max-width:none}
/* Абзацный отступ по умолчанию (15px) меньше межстрочного расстояния (27px),
   и абзацы читались слитно. Делаем зазор заметнее строки. */
.mp-details-left .mp-desc-text{margin:0 0 20px}
.mp-details-left .mp-desc-text:last-of-type{margin-bottom:0}
/* Зум в просмотрщике. При увеличении картинка становится больше сцены, а
   flex-центрирование вместе с прокруткой прижимает её к левому верхнему углу -
   отсюда «скачок». margin:auto центрирует корректно и при переполнении, а
   прокрутку сцены выставляет скрипт ниже, по точке, куда человек нажал. */
.mp-lb.is-zoom .mp-lb-stage{overflow:auto;align-items:flex-start;justify-content:flex-start}
.mp-lb.is-zoom .mp-lb-img{margin:auto}
@media(prefers-color-scheme:dark){
 .mp-section-split{background:#2b2f37}
 .mp-gal-arrow{background:#171a1f;border-color:#3a3f4a;color:#e5e7eb}
 .mp-gal-arrow:hover{border-color:#e5e7eb}
 .mp-spec-card{background:#171a1f;border-color:#2b2f37}
 .mp-sidebar-col .mp-spec-table tr{border-color:#2b2f37}
 .mp-sidebar-col .mp-spec-table th{color:#9ca3af}
 .mp-gal-hint{color:#9ca3af}
 .mp-gal-more{border-color:#3a3f4a;color:#e5e7eb}
 .mp-gal-more:hover{border-color:#e5e7eb}
 .mp-gal-split{color:#9ca3af}
 .mp-gal-split::after{background:#3a3f4a}
 .mp-gal-thumb--var::before{background:#e5e7eb}
 .mp-gal-cap-tag{border-color:#3a3f4a;color:#9ca3af}
}
</style>`;

const SCRIPT = `<script>
(function(){
  var strip=document.querySelector('.mp-gal-strip');
  var prev=document.querySelector('.mp-gal-prev'), next=document.querySelector('.mp-gal-next');
  if(!strip||!prev||!next) return;

  // Стрелки листают ленту на видимую ширину, как на TurboSquid.
  function page(dir){ strip.scrollLeft += dir * Math.max(120, strip.clientWidth - 40); }
  prev.addEventListener('click',function(){ page(-1); });
  next.addEventListener('click',function(){ page(1); });

  // Гасим стрелку, когда листать в её сторону больше нечего.
  function sync(){
    var max=strip.scrollWidth-strip.clientWidth-1;
    prev.disabled = strip.scrollLeft<=0;
    next.disabled = strip.scrollLeft>=max;
  }
  strip.addEventListener('scroll',sync);
  window.addEventListener('resize',sync);
  sync();

  // Колесо мыши над лентой листает её вбок, а не крутит страницу.
  strip.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    if(strip.scrollWidth<=strip.clientWidth) return;
    e.preventDefault(); strip.scrollLeft += e.deltaY;
  },{passive:false});
})();

(function(){
  // Зум в просмотрщике не должен прыгать в левый верхний угол. Сам просмотрщик
  // живёт в site.js и создаётся при первом открытии, поэтому ждём его появления
  // и следим за классом is-zoom. Запоминаем точку, куда человек нажал, и после
  // увеличения ставим прокрутку так, чтобы эта точка осталась на месте.
  var anchor = null;
  document.addEventListener('mousedown', function(e){
    var im = e.target.closest ? e.target.closest('.mp-lb-img') : null;
    if(!im) { anchor = null; return; }
    var r = im.getBoundingClientRect();
    anchor = {
      fx: (e.clientX - r.left) / (r.width || 1),   // доля по ширине
      fy: (e.clientY - r.top) / (r.height || 1),
      cx: e.clientX, cy: e.clientY
    };
  }, true);

  function centre(box){
    var stage = box.querySelector('.mp-lb-stage');
    var im = box.querySelector('.mp-lb-img');
    if(!stage || !im) return;
    var apply = function(){
      var maxX = stage.scrollWidth - stage.clientWidth;
      var maxY = stage.scrollHeight - stage.clientHeight;
      if(maxX <= 0 && maxY <= 0) return;
      var a = anchor || { fx:.5, fy:.5, cx: stage.getBoundingClientRect().left + stage.clientWidth/2,
                          cy: stage.getBoundingClientRect().top + stage.clientHeight/2 };
      var sr = stage.getBoundingClientRect();
      // Точка a.fx/a.fy внутри увеличенной картинки должна оказаться там же на
      // экране, где была до увеличения.
      stage.scrollLeft = Math.max(0, Math.min(maxX, a.fx * im.offsetWidth - (a.cx - sr.left)));
      stage.scrollTop  = Math.max(0, Math.min(maxY, a.fy * im.offsetHeight - (a.cy - sr.top)));
    };
    if(im.complete) apply(); else im.addEventListener('load', apply, { once:true });
    requestAnimationFrame(apply);
  }

  function watch(box){
    new MutationObserver(function(){
      if(box.classList.contains('is-zoom')) centre(box);
    }).observe(box, { attributes:true, attributeFilter:['class'] });
  }

  var seen = document.querySelector('.mp-lb');
  if(seen) watch(seen);
  else new MutationObserver(function(_, obs){
    var b = document.querySelector('.mp-lb');
    if(b){ watch(b); obs.disconnect(); }
  }).observe(document.body, { childList:true });
})();
</script>`;

function build(group) {
  const slug = group.main.slug;
  const src = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(src)) { console.log('  нет карточки: ' + slug); return null; }
  let html = fs.readFileSync(src, 'utf8');

  const versions = parseVersions(html);
  if (!versions.length) { console.log('  нет блока версий: ' + slug); return null; }
  const main = versions.find(v => v.isMain) || versions[0];

  // ── 1. лента кадров ────────────────────────────────────────────────────────
  // Только кадры САМОЙ модели. Кадры сшитых версий из презентации убраны: их
  // было под полторы сотни, и они сбивали - версия показывается одним главным
  // ракурсом в секции ниже, оттуда же переход на TurboSquid.
  // Раскладка как на TurboSquid: одна строка, остальное листается стрелками.
  const mkThumb = (srcUrl, ver) =>
    `<button type="button" class="mp-gal-thumb" data-full="${esc(srcUrl)}"`
    + ` data-cap="${esc(ver.name)}" data-owner="${esc(ver.id)}" data-price="${esc(ver.price)}" data-link="${esc(ver.link)}"`
    + ` title="${esc(ver.name)}" aria-label="${esc(ver.name)}">`
    + `<img src="${esc(srcUrl)}" alt="${esc(ver.name)}" width="200" height="113" loading="lazy" decoding="async">`
    + `</button>`;

  const mainFrames = framesFor(group, main.id);
  if (!mainFrames.length) { console.log('  нет кадров в инвентаре: ' + slug); return null; }

  const strip = mainFrames.map(u => mkThumb(u, main)).join('');
  const total = mainFrames.length;

  html = html.replace(/<div class="mp-gal-strip">[\s\S]*?<\/div>(?=<\/div>)/, () =>
    `<div class="mp-gal-row">`
    + `<button type="button" class="mp-gal-arrow mp-gal-prev" aria-label="Previous frames">&#8249;</button>`
    + `<div class="mp-gal-strip">${strip}</div>`
    + `<button type="button" class="mp-gal-arrow mp-gal-next" aria-label="Next frames">&#8250;</button>`
    + `</div>`
    + `<div class="mp-gal-hint">${total} frames</div>`);

  // Подпись под крупным снимком. Версий в презентации больше нет, поэтому здесь
  // всегда основная модель - оставляем цену и переход на TurboSquid.
  html = html.replace(/<div class="mp-gal-cap" data-gal-cap>([\s\S]*?)<\/div>/, () =>
    `<div class="mp-gal-cap-row" data-cap-row>`
    + `<span class="mp-gal-cap-price" data-cap-price>${esc(main.price)}</span>`
    + `<a class="mp-gal-cap-link" data-cap-link href="${esc(main.link)}" target="_blank" rel="noopener">View on TurboSquid &#8599;</a>`
    + `</div>`);

  // ── 2. секция версий вниз, сеткой как related ─────────────────────────────
  html = html.replace(/<section class="mp-variants">[\s\S]*?<\/section>/, '');

  // Каждая версия - один главный ракурс, название, цена и переход на TurboSquid.
  // Больше ничего: галерей у сшитых карточек нет.
  const verCards = versions.map(v =>
    `<a href="${esc(v.link)}" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link">`
    + `<div class="img-wrap mp-rc-img-wrap">`
    + `<img src="${esc(v.thumb)}" alt="${esc(v.name)}" width="800" height="450" decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
    + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
    + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(v.name)}${v.isMain ? ' <span class="mp-var-badge">main</span>' : ''}</div></div>`
    + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">${v.tag ? esc(v.tag) : 'View on TurboSquid'}</span>`
    + `<span class="mp-rc-price">${esc(v.price)}</span></div></div></a>`).join('');

  const verSection = `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">Same model, other versions</div>`
    + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
    + `<div class="mp-related-grid">${verCards}</div>`
    + `<div class="mp-section-split" role="separator"></div>`
    + `</div></section>`;

  // Тоже функцией: в карточках версий есть цены со знаком «$».
  html = html.replace('<section class="mp-related-section">', () => verSection + '<section class="mp-related-section">');

  // ── 3. характеристики - в правую колонку, Quick Info внутрь них ───────────
  // Quick Info дублировал характеристики: цена, категория и сертификация были в
  // обоих блоках. Оставляем один блок, а уникальную строку Quick Info («Rig»)
  // переносим в него.
  const quick = {};
  const qiM = html.match(/<div class="mp-info-card">[\s\S]*?<div class="mp-info-rows">([\s\S]*?)<\/div><\/div>/);
  if (qiM) {
    for (const m of qiM[1].matchAll(/<span class="mp-info-row-label">([^<]*)<\/span>\s*(<span[^>]*>|<a[^>]*>)([^<]*)/g)) {
      quick[m[1].trim()] = { html: m[2] + m[3] + (m[2].startsWith('<a') ? '</a>' : '</span>'), text: m[3].trim() };
    }
    html = html.replace(/<div class="mp-info-card">[\s\S]*?<div class="mp-info-rows">[\s\S]*?<\/div><\/div>/, '');
  }

  const specM = html.match(/<div class="mp-spec-block">[\s\S]*?(?=<div class="mp-faq-block">)/);
  if (specM) {
    let spec = specM[0];
    html = html.replace(spec, '');
    // Строки Quick Info, которых нет в характеристиках, дописываем в таблицу.
    const have = [...spec.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    // Главное, ради чего собирался инвентарь: полигоны, вершины, риг и остальная
    // геометрия. На карточке их не было - каталог таких данных не содержит.
    const d = group.main.data || {};
    const rows = [
      ['Polygons', d.polygons ? Number(d.polygons).toLocaleString('en-US') : null],
      ['Vertices', d.vertices ? Number(d.vertices).toLocaleString('en-US') : null],
      ['Geometry', d.geometry || null],
      ['Rig', /is jointed/i.test(d.rigged || '') ? 'Rigged' : (d.rigged ? 'Static' : null)],
      ['Animation', /is animated/i.test(d.animated || '') ? 'Animated' : null],
      ['Textures', texLine(d)],
      ['UV mapping', d.unwrapped_uvs || null],
    ];
    let extra = '';
    for (const [k, v] of rows) {
      if (!v) continue;
      // Если такая строка уже есть в таблице - заменяем значение, а не плодим
      // вторую: именно так «Rig» оказывался в списке дважды.
      if (have.includes(k.toLowerCase())) {
        spec = spec.replace(new RegExp('(<th[^>]*>\\s*' + k + '\\s*</th>\\s*<td[^>]*>)[\\s\\S]*?(</td>)', 'i'),
          (m, a, b) => a + esc(v) + b);
      } else {
        extra += `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
        have.push(k.toLowerCase());
      }
    }
    // Quick Info добавляем последним и только то, чего ещё нет: инвентарь точнее.
    for (const [k, v] of Object.entries(quick)) {
      if (have.includes(k.toLowerCase())) continue;
      extra += `<tr><th>${esc(k)}</th><td>${v.html}</td></tr>`;
      have.push(k.toLowerCase());
    }
    if (extra) spec = spec.replace('</tbody>', extra + '</tbody>');

    // Убираем дубли. «Primary industries» и «Typical use» перекрывали друг друга
    // и повторяли блок Use Cases, который стоит тут же и уже сделан кнопками.
    for (const k of ['Primary industries', 'Typical use']) {
      spec = spec.replace(new RegExp('<tr>\\s*<th[^>]*>\\s*' + k + '\\s*</th>[\\s\\S]*?</tr>', 'i'), '');
    }
    // Границу колонки ищем счётом тегов, а не первым попавшимся «</div></div>»:
    // при наивном поиске блок характеристик уехал ВНУТРЬ карточки Quick Info.
    const at = endOfDiv(html, html.indexOf('<div class="mp-sidebar-col">'));
    if (at > 0) html = html.slice(0, at) + '<div class="mp-spec-card">' + spec + '</div>' + html.slice(at);
    else console.log('  не нашёл конец правой колонки: ' + slug);
  }

  // Короткий список «Search Keywords» в правой колонке дублировал полный список
  // под описанием - оставляем один, полный.
  html = html.replace(/<div>\s*<div class="section-label[^"]*">Search Keywords<\/div>[\s\S]*?<\/div>\s*<\/div>/i, '');
  // Плашка «Quality Certified» повторяла строку Certification в характеристиках.
  html = html.replace(/<div class="mp-cert-card">[\s\S]*?<\/div>\s*<\/div>/i, '');

  // ── 3я. описание дополняем данными геометрии ──────────────────────────────
  // Договаривались, что текст опирается на собственные числа модели, а не на
  // общие слова. В каталоге этих чисел нет - они появились только сейчас, из
  // инвентаря. Вариант предложения выбирается по идентификатору, чтобы соседние
  // карточки не выглядели под копирку.
  const dd = group.main.data || {};
  const poly = Number(dd.polygons) || 0;
  if (poly) {
    const seed = Number(main.id) || 0;
    const pn = poly.toLocaleString('en-US');
    const vn = (Number(dd.vertices) || 0).toLocaleString('en-US');
    const rigged = /is jointed/i.test(dd.rigged || '');
    const weight = poly > 800000 ? 'heavy' : poly > 200000 ? 'mid-weight' : 'light';
    const MESH = [
      `The mesh carries ${pn} polygons and ${vn} vertices, which puts it in the ${weight} bracket for this category.`,
      `At ${pn} polygons and ${vn} vertices this is a ${weight} asset: dense enough for close framing, and honest about what it costs a scene.`,
      `Geometry weighs in at ${pn} polygons over ${vn} vertices - a ${weight} build for its class.`,
      `Counted at the source, the model is ${pn} polygons and ${vn} vertices, a ${weight} load for a scene.`,
    ];
    const sizes = texSizes(dd);
    const TEX = sizes.length ? [
      `Texture work runs to ${dd.ntextures} maps, the largest at ${sizes[0].w}x${sizes[0].h}, so the surface holds up when the camera moves in.`,
      `It ships ${dd.ntextures} maps with the top set authored at ${sizes[0].w}x${sizes[0].h} - enough resolution to fill a frame rather than sit in the background.`,
      `Maps: ${dd.ntextures} of them, peaking at ${sizes[0].w}x${sizes[0].h}, which is where the close-up detail comes from.`,
    ] : [];
    const RIG = rigged
      ? [`The model is jointed, so it can be posed or animated without rebuilding the hierarchy.`]
      : [`It is a static build - no rig to strip out if all you need is a rendered object.`];
    const pickN = (arr, k) => arr.length ? arr[Math.abs(seed + k) % arr.length] : '';
    const add = [pickN(MESH, 0), pickN(TEX, 3), pickN(RIG, 0)].filter(Boolean).join(' ');
    if (add) {
      // Раньше всё это шло одним абзацем в девять предложений - читать тяжело.
      // Разбиваем: исходный текст по три предложения, а числа геометрии выносим
      // в отдельный последний абзац, они и по смыслу стоят особняком.
      html = html.replace(/<p class="mp-desc-text">([\s\S]*?)<\/p>/, (m, body) =>
        paras(sentences(body), 3).concat([add])
          .map(p => `<p class="mp-desc-text">${p}</p>`).join(''));
    }
  }

  // ── 3а. ключевые слова из инвентаря ───────────────────────────────────────
  // На карточке их было четыре, собранных из названия. В инвентаре у 84% моделей
  // лежит настоящий список - у выбранных здесь по 20-25 штук. Русские слова
  // отбрасываем: сайт английский.
  const kw = (group.main.data && group.main.data.kwList) ? group.main.data.kwList : [];
  const clean = [...new Set(kw
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s.length > 2 && s.length < 46 && /^[a-z0-9][a-z0-9 \-'/&.]*$/.test(s)))]
    .slice(0, 24);
  if (clean.length) {
    // Кнопками и со ссылкой на поиск - как короткий список, который тут стоял
    // раньше. Слово, по которому нельзя перейти, бесполезно.
    const block = `<div class="mp-kw-block"><div class="section-label mp-mb12">Keywords</div>`
      + `<div class="mp-chip-row">${clean.map(k =>
        `<a href="/search/?q=${encodeURIComponent(k)}" class="chip chip--kw">${esc(k)}</a>`).join('')}</div></div>`;
    // Кладём под вопросы, в левую колонку: это текст, а не характеристика.
    const faqEnd = endOfDiv(html, html.indexOf('<div class="mp-faq-block">'));
    if (faqEnd > 0) html = html.slice(0, faqEnd + '</div>'.length) + block + html.slice(faqEnd + '</div>'.length);
  }

  // ── 3б. подвал как на главной ─────────────────────────────────────────────
  // У карточек стоял свой обрезанный подвал в одну строку, у главной - полный,
  // с четырьмя колонками ссылок. Ставим общий, а ссылку «назад в категорию»
  // сохраняем: она полезна и была только здесь.
  if (HOME_FOOTER) {
    const cur = html.match(/<footer class="mp-footer">[\s\S]*?<\/footer>/);
    if (cur) {
      const back = (cur[0].match(/<a[^>]*class="nav-link mp-back-link"[\s\S]*?<\/a>/) || [''])[0];
      html = html.replace(cur[0], () => HOME_FOOTER.replace('</footer>',
        (back ? `<div class="max-w-7xl mx-auto mp-footer-back">${back}</div>` : '') + '</footer>'));
    }
  }

  // ── 3в. похожие модели до полных двух рядов ───────────────────────────────
  const relM = html.match(/<section class="mp-related-section">[\s\S]*?<div class="mp-related-grid">([\s\S]*?)<\/div><\/div><\/section>/);
  let relAdded = 0;
  if (relM) {
    const already = new Set([...relM[1].matchAll(/href="\/models\/([^/"]+)\//g)].map(m => m[1]));
    // Считаем ТОЛЬКО реально стоящие карточки. Раньше сюда подмешивались
    // идентификаторы версий, счётчик показывал 10 и добор не срабатывал.
    const need = RELATED_WANT - already.size;
    // Версии в похожие попадать не должны, но на размер ряда не влияют.
    versions.forEach(v => { if (v.slugPath) already.add(v.slugPath); });
    if (need > 0) {
      const add = extraRelated(slug, already, need);
      relAdded = add.length;
      if (add.length) html = html.replace(relM[1], () => relM[1] + add.join(''));
    }
  }

  // ── 4. стили, скрипт, служебное ───────────────────────────────────────────
  html = html.replace('</head>', STYLE + '</head>');
  html = html.replace('</body>', SCRIPT + '</body>');
  if (NOINDEX && !/name="robots"/.test(html)) {
    html = html.replace('</title>', '</title>\n<meta name="robots" content="noindex, nofollow">');
  }
  // Длинного тире в текстах быть не должно - правило проекта. В генераторе
  // card-content.mjs оно уже убрано, но выпущенные карточки его ещё несут
  // (59 672 страницы на 20.08.2026), поэтому чистим и здесь.
  const dashes = (html.match(/-|-|-|-|-|-/g) || []).length;
  html = html.replace(/\s*(?:-|-|-|-|-|-)\s*/g, ' - ');
  return { slug, html, total, versions: versions.length, dashes, relAdded, kw: clean.length };
}

const outBase = path.join(ROOT, OUTDIR);
fs.mkdirSync(outBase, { recursive: true });
const made = [];
for (const g of GROUPS) {
  const r = build(g);
  if (!r) continue;
  const dir = path.join(outBase, r.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), r.html);
  made.push(r);
  console.log("  собрано: " + r.slug + "  версий " + r.versions + ", кадров " + r.total + ", похожих +" + r.relAdded + ", слов " + r.kw + ", тире убрано " + r.dashes);
}
console.log('\nготово, страниц: ' + made.length);
made.forEach(r => console.log('   https://3dmolierstudio.com/' + OUTDIR + '/' + r.slug + '/'));
