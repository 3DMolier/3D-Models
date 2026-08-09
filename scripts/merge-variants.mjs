// merge-variants.mjs — объединение карточек-вариантов одной модели.
//
// Две группы, обе с галереей превью:
//   A. Варианты под софт:  «X», «X for Maya», «X for Cinema 4D» -> одна страница «X»
//   B. Варианты по цвету:  «X Sand», «X Khaki», «X Green»       -> одна страница «X»
//
// Товары НЕ теряются: каждая свёрнутая карточка становится строкой со ссылкой на
// свой листинг TurboSquid. Продажи идут туда же, куда и раньше.
//
// Главной выбирается: для софта — версия без суффикса (базовая, под 3ds Max),
// для цвета и при отсутствии базовой — та, у которой больше продаж.
//
// Запуск:  node scripts/merge-variants.mjs --dry            посчитать и показать примеры
//          node scripts/merge-variants.mjs --dry --sample slug   вывести готовую разметку
//          node scripts/merge-variants.mjs --only soft      только группа A
//          node scripts/merge-variants.mjs                  выполнить обе

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const oi = process.argv.indexOf('--only');
const ONLY = oi !== -1 ? process.argv[oi + 1] : null;
const si = process.argv.indexOf('--sample');
const SAMPLE = si !== -1 ? process.argv[si + 1] : null;

const SOFT = /\s+for\s+(maya|cinema\s*4d|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\s*$/i;
const COLOR = /\s+(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|desert|olive|beige|pink|purple)\s*$/i;
// «Fur» — это та же модель с мехом, отдельный товар дороже базового
// (Virginia Deer Rigged $179 против Virginia Deer Fur Rigged $199).
// Слово встречается и в середине названия, поэтому убираем его как отдельный токен.
// Проверено на 3529 карточках: единственный случай, где Fur — сам предмет, это
// «Kennel Cage with Jack Russell Terrier Fur Coat», и там всё равно собака.
const FUR = /\s*\bfur\b\s*/ig;
const hasFur = n => /\bfur\b/i.test(n);
// «Animated» — та же модель с анимацией, снова отдельный товар со своей ценой.
// Слово встречается и в начале названия («Animated Flight Bhutan Glory Butterfly»),
// поэтому тоже снимается как токен, а не как суффикс.
const ANIM = /\s*\banimated\b\s*/ig;
const hasAnim = n => /\banimated\b/i.test(n);
// Позы и оснастка: «Ragdoll Cat», «Ragdoll Cat Sitting Pose», «Ragdoll Cat Rigged» —
// одна и та же модель. Проверено на переслияние: основы вроде «woman» или «soldier»
// не возникают, у таких названий всегда есть уточнение, а «Businessman» из 7 карточек
// действительно одна модель.
const POSE = /\s*\b(?:t[\s-]?pose|(?:standing|sitting|walking|running|swimming|flying|jumping|lying|crouching|attack|idle|neutral|resting|eating|sleeping|dead)\s+pose|pose)\b\s*/ig;
const RIG = /\s*\b(?:rigged|rigid)\b\s*/ig;
const poseOf = n => {
  const m = n.match(/\b(t[\s-]?pose|(?:standing|sitting|walking|running|swimming|flying|jumping|lying|crouching|attack|idle|neutral|resting|eating|sleeping|dead)\s+pose|pose)\b/i);
  return m ? m[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;
};
const hasRig = n => /\b(rigged|rigid)\b/i.test(n);
// Коллекции с индексами: «Flowers Collection», «Flowers Collection 8», «… 16».
//
// Правило намеренно СУЖЕНО до наборов. Если брать любое число в конце, под нож
// попадают товары, где число — часть предмета: «Neon Tube Light Number 1/2/4» это
// разные цифры-вывески, «Minigolf Course Hole 1/2/3» — разные лунки, «Industrial
// Cable 6/7/10» — разные кабели. Такие 435 групп мы не трогаем.
// Потолок 20 отсекает характеристики вроде «Butane Cylinder CP 250».
// Слово ТОЛЬКО «collection», и индекс идёт сразу после него: «Flowers Collection 8».
// Set, Pack, Bundle и Kit намеренно исключены — у них число чаще относится к предмету,
// а не к выпуску серии. Так под правило не попадает ничего спорного.
const IDX = /\s+([1-9]|1\d|20)\s*$/;
const COLL = /\bcollections?\s+([1-9]|1\d|20)\s*$|\bcollections?\s*$/i;
const isColl = n => COLL.test(n);
const collLabel = n => {
  const m = n.match(/\b(collections?)\s*(\d{1,2})?\s*$/i);
  if (!m) return 'Collection';
  const word = m[1].replace(/\b\w/g, c => c.toUpperCase());
  return m[2] ? word + ' ' + m[2] : word;
};

// ── данные каталога ──
function pc(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = L[0].split(',');
const ix = n => H.indexOf(n);
const rows = [];
for (let i = 1; i < L.length; i++) {
  if (!L[i]) continue;
  const r = pc(L[i]);
  rows.push({
    id: r[ix('product_id')], name: r[ix('product_name')], slug: r[ix('slug')],
    url: r[ix('referral_url')] || r[ix('turbosquid_url')],
    price: +r[ix('price')] || 0, sales: +r[ix('sales_qty')] || 0,
  });
}
// В models_master.csv реферальный код устарел: там 3d_molier-studio, а на карточках
// сайта и во всех наших материалах — 3d_molier-international. Без нормализации
// 5245 объединённых страниц получили бы чужой код и продажи по ним не засчитались бы.
const REFERRAL = 'referral=3d_molier-international';
const fixRef = u => {
  if (!u) return u;
  if (/referral=/.test(u)) return u.replace(/referral=3d_molier-[A-Za-z]+/g, REFERRAL);
  return u + (u.includes('?') ? '&' : '?') + REFERRAL;
};
for (const r of rows) r.url = fixRef(r.url);

const bySlug = new Map(rows.map(r => [r.slug, r]));

// ── группировка ──
function buildGroups(kind) {
  const re = kind === 'soft' ? SOFT : (kind === 'collection' ? IDX : COLOR);
  const g = {};
  for (const r of rows) {
    // Существование страницы здесь НЕ проверяем. Раньше проверяли — и уже удалённые
    // варианты выпадали из групп, а значит не попадали в карту «вариант -> главная».
    // После обрыва 08.08 это оставило 6247 ссылок в никуда: страницы удалены, а чем
    // их заменить, неизвестно. Отсутствие файла обрабатывается ниже, при слиянии.
    if (kind === 'collection' && !COLL.test(r.name)) continue;      // только наборы
    if (kind !== 'collection' && isColl(r.name)) continue;          // их разбирает свой проход
    if (kind === 'color' && SOFT.test(r.name)) continue;   // софт разбирается отдельно
    // Для группы «софт» снимаем ещё Fur и Animated: мех, анимация и базовая версия —
    // одна и та же модель в разных исполнениях.
    const base = (kind === 'soft'
      ? r.name.replace(re, '').replace(FUR, ' ').replace(ANIM, ' ').replace(POSE, ' ').replace(RIG, ' ').replace(/\s{2,}/g, ' ')
      : r.name.replace(re, '')).trim();
    if (base.length < 8) continue;
    const key = base.toLowerCase();
    (g[key] = g[key] || { base, items: [] }).items.push(r);
  }
  const out = [];
  for (const [, grp] of Object.entries(g)) {
    if (grp.items.length < 2) continue;
    // группа считается вариантами, если внутри есть различие по софту ИЛИ по меху;
    // иначе это просто одинаково названные разные товары — их не трогаем
    const varies = grp.items.some(x => re.test(x.name))
      || (kind === 'soft' && new Set(grp.items.map(x => hasFur(x.name))).size > 1)
      || (kind === 'soft' && new Set(grp.items.map(x => hasAnim(x.name))).size > 1)
      || (kind === 'soft' && new Set(grp.items.map(x => (poseOf(x.name) || '') + hasRig(x.name))).size > 1);
    if (!varies) continue;
    // Главная — САМАЯ БАЗОВАЯ версия: без суффикса софта и без меха, то есть под
    // 3ds Max. Сортировка по продажам тут не годится: у меховой версии их обычно
    // больше, и она вытесняла базовую (Virginia Deer Fur Rigged забирал главенство
    // у Virginia Deer Rigged). Продажи решают только внутри равных по «базовости».
    // Главная — самая «голая» версия: без софта, без меха, без анимации, без позы
    // и без оснастки. Веса убывающие, чтобы порядок был предсказуем.
    const rank = x => (re.test(x.name) ? 16 : 0)
      + (kind === 'soft' && hasFur(x.name) ? 8 : 0)
      + (kind === 'soft' && hasAnim(x.name) ? 4 : 0)
      + (kind === 'soft' && poseOf(x.name) ? 2 : 0)
      + (kind === 'soft' && hasRig(x.name) ? 1 : 0);
    const main = grp.items.slice().sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales))[0];
    const rest = grp.items.filter(x => x.slug !== main.slug);
    if (!rest.length) continue;
    // Заголовок берём ОТ ГЛАВНОЙ карточки, сняв только суффикс софта. Если брать
    // нормализованный ключ группы, из названия исчезнут Fur и Animated — а они там
    // могут быть по делу: у «Animated Flight Bhutan Glory Butterfly» неанимированной
    // версии не существует вовсе, и заголовок без Animated был бы просто неверным.
    const title = main.name.replace(re, '').trim();
    out.push({ base: title, main, rest, kind });
  }
  return out;
}

// ── превью варианта: берём из его страницы, там уже проверенные ссылки ──
function previewOf(slug) {
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    return (h.match(/property="og:image" content="([^"]+)"/) || [])[1] || null;
  } catch (e) { return null; }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── разметка галереи и списка вариантов ──
function buildBlocks(g) {
  const all = [g.main, ...g.rest];
  const shots = all.map(x => ({ r: x, img: previewOf(x.slug) })).filter(x => x.img);
  // Метка должна читаться сама по себе: «Maya · Fur» понятно, «Maya» рядом с
  // «Maya» из меховой версии — нет.
  const label = x => {
    if (g.kind === 'soft') {
      const m = x.name.match(SOFT);
      const soft = m ? m[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Autodesk 3ds Max';
      const bits = [soft];
      if (hasFur(x.name)) bits.push('Fur');
      if (hasAnim(x.name)) bits.push('Animated');
      const p = poseOf(x.name);
      if (p) bits.push(p);
      else if (hasRig(x.name)) bits.push('Rigged');
      return bits.join(' · ');
    }
    if (g.kind === 'collection') return collLabel(x.name);
    const m = x.name.match(COLOR);
    return m ? m[1].replace(/\b\w/g, c => c.toUpperCase()) : g.base;
  };

  // Галерея статическая: все снимки лежат в разметке, поэтому их видят и поисковик,
  // и AI-краулеры, которые не исполняют скрипты. Скрипт только переключает крупный.
  let gal = '';
  if (shots.length > 1) {
    gal = '<div class="mp-gallery" data-gallery>'
      + '<div class="mp-gal-strip">'
      + shots.map((s, i) => '<button type="button" class="mp-gal-thumb' + (i ? '' : ' is-on')
        + '" data-full="' + esc(s.img) + '" aria-label="' + esc(label(s.r)) + '">'
        + '<img src="' + esc(s.img) + '" alt="' + esc(g.base + ' — ' + label(s.r)) + '"'
        + ' width="200" height="113" loading="lazy" decoding="async"></button>').join('')
      + '</div></div>';
  }

  // Один и тот же формат бывает выложен на TurboSquid несколькими листингами —
  // ссылки у них разные, а метка получалась одинаковой. Нумеруем повторы, иначе
  // в списке подряд идут два одинаковых «Cinema 4D» без объяснения.
  const seen = {};
  const uniqLabel = x => {
    const base = label(x);
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? base + ' (' + seen[base] + ')' : base;
  };

  const head = g.kind === 'soft' ? 'Available Formats'
    : g.kind === 'collection' ? 'All Sets in This Series' : 'Available Colors';
  const list = '<section class="mp-variants"><h2 class="mp-block-h2">' + head + '</h2>'
    + '<ul class="mp-var-list">'
    + all.map((x, i) => '<li class="mp-var' + (i ? '' : ' is-main') + '">'
      + '<span class="mp-var-name">' + esc(uniqLabel(x))
      + (i ? '' : ' <span class="mp-var-badge">main</span>') + '</span>'
      + '<span class="mp-var-price">$' + x.price + '</span>'
      + '<a class="mp-var-link" href="' + esc(x.url) + '" target="_blank" rel="noopener">View on TurboSquid</a>'
      + '</li>').join('')
    + '</ul></section>';

  // Цены у вариантов расходятся: меховая версия дороже базовой. Показываем диапазон,
  // иначе на карточке будет одна цена, а по ссылке другая.
  const prices = all.map(x => x.price).filter(Boolean);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const priceText = prices.length && lo !== hi ? '$' + lo + ' – $' + hi : (prices.length ? '$' + lo : null);

  return { gallery: gal, list, shots: shots.length, all, priceText };
}

// ── применение к странице главной ──
function mergeInto(g) {
  const file = path.join(MODELS, g.main.slug, 'index.html');
  // Читаем через try: слаг может оказаться главным в одной группе и вариантом в
  // другой. 08.08.2026 такой случай (volkswagen-beetle-1966-rigged-red) обрушил
  // прогон на середине — страница была удалена раньше, чем дошла очередь до её
  // собственной группы. Ниже группы ещё и разводятся по claimed, но защита нужна.
  let html;
  try { html = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { ok: false, why: 'главной страницы уже нет' }; }
  if (html.includes('mp-variants')) return { ok: false, why: 'уже объединена' };
  const before = html;
  const { gallery, list, shots, priceText } = buildBlocks(g);
  if (shots < 2) return { ok: false, why: 'меньше двух превью' };

  // цена в характеристиках — диапазоном, если варианты стоят по-разному
  if (priceText && priceText.includes('–')) {
    html = html.replace(/(<td[^>]*>\s*Price\s*<\/td>\s*<td[^>]*>)([^<]*)(<\/td>)/i,
      (m, a, _b, c) => a + priceText + c);
  }

  // заголовок и H1 — на базовое имя без суффикса
  const baseEsc = esc(g.base);
  html = html.replace(/<h1 class="mp-h1">[\s\S]*?<\/h1>/, () => '<h1 class="mp-h1">' + baseEsc + '</h1>');

  // галерея — сразу после героя
  if (!html.includes('data-gallery')) {
    html = html.replace(/(<img[^>]*class="mp-hero-img"[^>]*>\s*<\/div>)/, (m) => m + gallery);
    if (!html.includes('data-gallery')) html = html.replace(/(<\/div>\s*)(<h1 class="mp-h1")/, (m, a, b) => a + gallery + b);
  }
  // список вариантов — перед характеристиками
  if (!html.includes('mp-variants')) {
    html = html.replace(/(<h2 class="mp-block-h2">\s*Specifications)/i, () => list + '$1');
    if (!html.includes('mp-variants')) html = html.replace(/(<table class="mp-spec-table")/, () => list + '$1');
  }

  if (!html.includes('mp-variants')) return { ok: false, why: 'не нашёл, куда вставить список' };
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) return { ok: false, why: 'пострадало меню' };
  for (const b of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { return { ok: false, why: 'битый JSON-LD' }; }
  }
  return { ok: true, html, changed: html !== before };
}

// ── ход работы ──
const groups = [];
if (!ONLY || ONLY === 'soft') groups.push(...buildGroups('soft'));
if (!ONLY || ONLY === 'color') groups.push(...buildGroups('color'));
if (!ONLY || ONLY === 'collection') groups.push(...buildGroups('collection'));

// Один слаг не должен попасть в две группы: иначе он удаляется как вариант в первой,
// а во второй оказывается главным — и группа рушится на чтении несуществующего файла.
// Проходы идут в порядке приоритета: софт, затем цвет, затем наборы.
{
  const claimed = new Set();
  const kept = [];
  for (const g of groups) {
    if (claimed.has(g.main.slug)) continue;
    const rest = g.rest.filter(r => !claimed.has(r.slug));
    if (!rest.length) continue;
    claimed.add(g.main.slug);
    for (const r of rest) claimed.add(r.slug);
    kept.push({ ...g, rest });
  }
  groups.length = 0;
  groups.push(...kept);
}

console.log('групп: ' + groups.length
  + '  (софт ' + groups.filter(g => g.kind === 'soft').length
  + ', цвет ' + groups.filter(g => g.kind === 'color').length
  + ', наборы ' + groups.filter(g => g.kind === 'collection').length + ')');
console.log('страниц свернётся: ' + groups.reduce((s, g) => s + g.rest.length, 0));

if (SAMPLE) {
  const g = groups.find(x => x.main.slug === SAMPLE) || groups.find(x => x.rest.length >= 2);
  const b = buildBlocks(g);
  console.log('\nпример: «' + g.base + '»  главная ' + g.main.slug + '  вариантов ' + g.rest.length + '  снимков ' + b.shots);
  console.log('\n--- галерея ---\n' + b.gallery.slice(0, 700));
  console.log('\n--- список ---\n' + b.list);
  process.exit(0);
}

// Карту пишем ПО ХОДУ, а не в конце. 08.08.2026 прогон рухнул на середине, карта
// не записалась вовсе — и починить ссылки на уже удалённые страницы стало нечем.
let merged = 0, deleted = 0, skipped = 0; const reasons = {};
const MAP_FILE = path.join(ROOT, 'data', 'merged-variants.json');
const map = (!DRY && fs.existsSync(MAP_FILE)) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
const flush = () => { if (!DRY) fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1)); };
for (const g of groups) {
  // Соответствие «вариант -> главная» записываем ДО попытки слияния и независимо
  // от её исхода. Иначе группы, уже объединённые прошлым прогоном, не попадут в
  // карту — а их варианты с диска удалены, и чинить ссылки на них будет нечем.
  const mainAlive = fs.existsSync(path.join(MODELS, g.main.slug, 'index.html'));
  if (mainAlive) for (const r of g.rest) map[r.slug] = g.main.slug;

  const res = mergeInto(g);
  if (!res.ok) { skipped++; reasons[res.why] = (reasons[res.why] || 0) + 1; continue; }
  if (!DRY) fs.writeFileSync(path.join(MODELS, g.main.slug, 'index.html'), res.html);
  merged++;
  for (const r of g.rest) {
    const dir = path.join(MODELS, r.slug);
    if (!DRY) {
      try {
        const files = fs.readdirSync(dir);
        if (files.length === 1 && files[0] === 'index.html') {
          fs.unlinkSync(path.join(dir, 'index.html'));
          fs.rmdirSync(dir);
          deleted++;
        }
      } catch (e) { }
    } else deleted++;
  }
  if (merged % 500 === 0) { flush(); console.log('  объединено ' + merged + ', удалено ' + deleted); }
}
flush();

console.log('\nобъединено групп: ' + merged);
console.log('удалено страниц:  ' + deleted);
if (skipped) console.log('пропущено групп:  ' + skipped + '  ' + JSON.stringify(reasons));
if (!DRY) {
  flush();
  console.log('\nкарта свёрнутых: data/merged-variants.json');
  console.log('ДАЛЬШЕ ОБЯЗАТЕЛЬНО:');
  console.log('  node scripts/build-category-hubs.mjs');
  console.log('  node scripts/build-browse-index.mjs');
  console.log('  node scripts/refresh-sitemaps.mjs');
} else console.log('\n(--dry, ничего не тронуто)');
