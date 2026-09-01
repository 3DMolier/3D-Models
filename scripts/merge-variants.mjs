// merge-variants.mjs - объединение карточек-вариантов одной модели.
//
// Две группы, обе с галереей превью:
//   A. Варианты под софт:  «X», «X for Maya», «X for Cinema 4D» -> одна страница «X»
//   B. Варианты по цвету:  «X Sand», «X Khaki», «X Green»       -> одна страница «X»
//
// Товары НЕ теряются: каждая свёрнутая карточка становится строкой со ссылкой на
// свой листинг TurboSquid. Продажи идут туда же, куда и раньше.
//
// Главной выбирается: для софта - версия без суффикса (базовая, под 3ds Max),
// для цвета и при отсутствии базовой - та, у которой больше продаж.
//
// Запуск:  node scripts/merge-variants.mjs --dry            посчитать и показать примеры
//          node scripts/merge-variants.mjs --dry --sample slug   вывести готовую разметку
//          node scripts/merge-variants.mjs --only soft      только группа A
//          node scripts/merge-variants.mjs                  выполнить обе

import fs from 'node:fs';
import path from 'node:path';
// Категория новых товаров по данным отчёта TurboSquid - тот же источник, по
// которому построены хабы категорий.
import { classifyByReport } from './category-map.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const oi = process.argv.indexOf('--only');
const ONLY = oi !== -1 ? process.argv[oi + 1] : null;
const si = process.argv.indexOf('--sample');
const SAMPLE = si !== -1 ? process.argv[si + 1] : null;

// Софт ищем ГДЕ УГОДНО в названии, не только в конце. «African Animals Rigged
// for Maya Collection» и «… for Cinema Collection» - одна модель, но маркер стоит
// в середине, и при поиске только по концовке они оставались двумя карточками.
// Таких названий 571.
const SOFT = /\s+for\s+(maya|cinema\s*4d|cinema|c4d|blender|3ds\s*max|max|unity|unreal|houdini|modo|lightwave|sketchup)\b/i;
// «Simplified» в конце - упрощённая версия той же модели, отдельный товар дешевле
// базового (Honda Accord 2025 против того же Simplified). Берём ТОЛЬКО концовку:
// в середине «Simple» значит другое - «Trolleybus Simple Interior» это описание
// салона, а не вариант. По каталогу: 476 с концовкой против 570 прочих.
const SIMPL = /\s+simplified\s*$/i;
const hasSimpl = n => SIMPL.test(n);
const COLOR = /\s+(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|desert|olive|beige|pink|purple)\s*$/i;
// «Fur» - это та же модель с мехом, отдельный товар дороже базового
// (Virginia Deer Rigged $179 против Virginia Deer Fur Rigged $199).
// Слово встречается и в середине названия, поэтому убираем его как отдельный токен.
// Проверено на 3529 карточках: единственный случай, где Fur - сам предмет, это
// «Kennel Cage with Jack Russell Terrier Fur Coat», и там всё равно собака.
const FUR = /\s*\bfur\b\s*/ig;
const hasFur = n => /\bfur\b/i.test(n);
// «Animated» - та же модель с анимацией, снова отдельный товар со своей ценой.
// Слово встречается и в начале названия («Animated Flight Bhutan Glory Butterfly»),
// поэтому тоже снимается как токен, а не как суффикс.
const ANIM = /\s*\banimated\b\s*/ig;
const hasAnim = n => /\banimated\b/i.test(n);
// Позы и оснастка: «Ragdoll Cat», «Ragdoll Cat Sitting Pose», «Ragdoll Cat Rigged» -
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
// попадают товары, где число - часть предмета: «Neon Tube Light Number 1/2/4» это
// разные цифры-вывески, «Minigolf Course Hole 1/2/3» - разные лунки, «Industrial
// Cable 6/7/10» - разные кабели. Такие 435 групп мы не трогаем.
// Потолок 20 отсекает характеристики вроде «Butane Cylinder CP 250».
// Слово ТОЛЬКО «collection», и индекс идёт сразу после него: «Flowers Collection 8».
// Set, Pack, Bundle и Kit намеренно исключены - у них число чаще относится к предмету,
// а не к выпуску серии. Так под правило не попадает ничего спорного.
const IDX = /\s+([1-9]|1\d|20)\s*$/;
const COLL = /\bcollections?\s+([1-9]|1\d|20)\s*$|\bcollections?\s*$/i;
// Проверяем БЕЗ суффикса софта. Иначе «African Animals Rigged Collection 2 for Maya»
// не опознавалось как коллекция (имя кончается на «for Maya»), уходило в проход по
// софту и склеивалось там в пару Maya+Cinema 4D - вместо того чтобы войти в общую
// серию. Так вокруг African Animals осталось девять мелких пар вместо одной карточки.
const isColl = n => COLL.test(String(n).replace(SOFT, '').trim());
// Номер выпуска идёт сразу за словом Collection, но НЕ обязательно в конце имени:
// «Rigged African Animals Collection 7 for Cinema 4D». Поиск только по концовке
// терял номер у 44 выпусков серии - подписи превращались в «Collection · Rigged ·
// Cinema 4D (2)», а список выстраивался по алфавиту вместо порядка выпусков.
const collLabel = n => {
  const m = String(n).replace(SOFT, '').match(/\bcollections?\s+(\d{1,2})\b/i);
  return m ? 'Collection ' + m[1] : 'Collection';
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
    img: r[ix('image_url')] || '', cat: r[ix('category')] || '',
  });
}
// В models_master.csv реферальный код устарел: там 3d_molier-studio, а на карточках
// сайта и во всех наших материалах - 3d_molier-international. Без нормализации
// 5245 объединённых страниц получили бы чужой код и продажи по ним не засчитались бы.

/*
 * Адрес карточки берём из СУЩЕСТВУЮЩЕЙ папки, а не из колонки slug.
 * В models_master.csv она построена другим правилом: у «Harivake Koi Fish(1)»
 * там стоит harivake-koi-fish-1-1142255, а папка на диске называется
 * harivake-koi-fish1-1142255. Из-за расхождения заглушка появилась по
 * несуществующему адресу, а настоящая страница осталась живой - на сайте
 * оказались две карточки одной модели.
 * Тот же промах был у плитки на главной: адрес нельзя вычислять, его надо брать.
 */
const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(MODELS)) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^\d+$/.test(id) && !DIR_BY_ID.has(id)) DIR_BY_ID.set(id, d);
}
let slugFixed = 0;
for (const r of rows) {
  const real = DIR_BY_ID.get(String(r.id));
  if (real && real !== r.slug) { r.slug = real; slugFixed++; }
}
if (slugFixed) console.log('адресов взято из существующих папок: ' + slugFixed);
const REFERRAL = 'referral=3d_molier-international';
const fixRef = u => {
  if (!u) return u;
  if (/referral=/.test(u)) return u.replace(/referral=3d_molier-[A-Za-z]+/g, REFERRAL);
  return u + (u.includes('?') ? '&' : '?') + REFERRAL;
};
for (const r of rows) r.url = fixRef(r.url);

// ── новые товары, которых ещё нет в выгрузке ────────────────────────────────
// models_master.csv собран в мае и не знает о 2550 моделях, вышедших позже. Их
// карточки уже стоят на сайте (scripts/build-new-cards.mjs), но объединение их
// не видело вовсе: проходы строятся по rows, а rows приходили только из CSV.
// Значит новый цветовой или софтовый вариант существующей модели оставался
// отдельной карточкой - ровно тот дубль, который мы всё это время вычищаем.
// Подмешиваем их сюда, а не правим CSV: выгрузку пересобирают, правка пропала бы.
{
  const NP = path.join(ROOT, 'data', 'new-products.json');
  if (fs.existsSync(NP)) {
    const known = new Set(rows.map(r => String(r.id)));
    const np = JSON.parse(fs.readFileSync(NP, 'utf8'));
    const prevFile = path.join(ROOT, 'data', 'new-previews.json');
    const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : {};
    const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // Категория в CSV - отображаемое имя («Animals & Creatures»), тем же должно
    // быть и здесь: по ней работает проход «одна машина - одна карточка».
    const clsSrc2 = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
    const CATS2 = eval('[' + clsSrc2.split('const CATS = [')[1].split('];')[0] + ']');
    const disp2 = Object.fromEntries(CATS2.map(c => [c[0], c[1]])); disp2.other = 'Other';
    let added = 0;
    for (const p of np) {
      const id = String(p.pid);
      if (known.has(id)) continue;
      const slug = slugify(p.name) + '-' + id;
      // Только те, у кого карточка реально существует: иначе группа соберётся
      // вокруг страницы, которой нет, и слияние упадёт на чтении файла.
      if (!fs.existsSync(path.join(MODELS, slug, 'index.html'))) continue;
      const cat = disp2[classifyByReport(id, p.name) || 'other'] || 'Other';
      rows.push({
        id, name: p.name, slug,
        url: fixRef(p.link || ('https://www.turbosquid.com/3d-models/' + slug)),
        price: +p.price || 0, sales: 0, img: prev[id] || '', cat,
      });
      added++;
    }
    if (added) console.log('подмешано новых товаров вне выгрузки: ' + added);
  }
}

// Правила по цвету и по «Simplified» смотрят на КОНЕЦ названия, а у части товаров
// в конце висит «3D Model»: «Side Loading Forklift Truck Orange 3D Model». Цвет
// оказывался не последним, и три одинаковых погрузчика разного цвета оставались
// тремя карточками. Для группировки берём имя без этого хвоста; в подписях и
// заголовках используется по-прежнему полное имя.
const TRAIL3D = /\s*\b3d\s+models?\s*$/i;
for (const r of rows) r.gname = String(r.name || '').replace(TRAIL3D, '').trim();

const bySlug = new Map(rows.map(r => [r.slug, r]));

// models_master.csv - выгрузка на 86 865 моделей, снятая до того, как на сайте
// появились свежие карточки. Модели новее выгрузки в ней отсутствуют, и витрина
// их молча теряла: выпал ГЛАВНЫЙ - блок не строился совсем; выпал ВАРИАНТ - список
// выходил короче семьи и пересобирался вхолостую каждый прогон (у Kawasaki Corleo
// 2 версии из 12). Итого со страниц пропали 36 ссылок на TurboSquid. Поэтому
// недостающую строку собираем из самой карточки: имя из H1, цена из Offer,
// ссылка - собственная товарная со страницы.
const synth = new Map();
function rowFor(slug) {
  const hit = bySlug.get(slug);
  if (hit) return hit;
  if (synth.has(slug)) return synth.get(slug);
  let h;
  try { h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8'); }
  catch (e) { synth.set(slug, null); return null; }
  if (/http-equiv="refresh"/.test(h.slice(0, 400))) { synth.set(slug, null); return null; }
  const cp = s => Buffer.from(String(s), 'utf8').toString('utf8');
  const name = cp((h.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1] || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .trim();
  if (!name) { synth.set(slug, null); return null; }
  // Берём ТОЛЬКО каноническую форму /3d-models/: ссылка /FullPreview/<id> живёт
  // редиректом и добавляет лишний переход перед корзиной.
  const raw = cp((h.match(/https?:\/\/(?:www\.)?turbosquid\.com\/3d-models\/[^"']+/) || [])[0] || '');
  const url = !raw ? ''
    : /referral=/.test(raw) ? raw.replace(/referral=3d_molier-[A-Za-z]+/g, REFERRAL)
      : raw + (raw.includes('?') ? '&' : '?') + REFERRAL;
  const price = +((h.match(/"@type"\s*:\s*"Offer"[\s\S]{0,300}?"price"\s*:\s*"?([0-9.]+)/) || [])[1] || 0);
  const row = {
    id: (slug.match(/-(\d+)$/) || [])[1] || '',
    name, gname: name.replace(TRAIL3D, '').trim(), slug, url,
    price, sales: 0, img: '', cat: '', fromCard: true,
  };
  synth.set(slug, row);
  return row;
}

// ── проход «одна машина - одна карточка» ────────────────────────────────────
// Одна и та же техника выложена карточками с разными окончаниями: Simplified,
// Rigid, Rigid for Cinema, Rigid for Maya, Low Poly, другой цвет. Правила по софту
// и по цвету их не сводят - основы различаются описаниями: «1955 Mercedes Benz
// 300SL Gullwing», «Mercedes-Benz 300SL Coupe Black», «Mercedes-Benz 300SL Classic
// Sports Car Red», «Mercedes-Benz 300SL Gullwing Coupe Blue Simplified».
//
// Личность техники - марка и код модели. В ключ идут токены с цифрой (300sl, g580),
// короткие обозначения комплектаций (se, sl, amg) и частые по каталогу слова -
// так марки определяются сами, без ручного списка. Описания отбрасываем.
const TECH_CATS = /^(vehicles|military vehicles|aircraft|ships|industrial equipment)$/i;
const IDENT_FILLER = new Set(['the', 'and', 'of', 'with', 'for', 'a', 'an',
  'car', 'cars', 'vehicle', 'vehicles', 'auto', 'automobile', 'aircraft', 'airplane',
  'plane', 'jet', 'helicopter', 'chopper', 'boat', 'ship', 'vessel',
  'sports', 'sport', 'classic', 'vintage', 'retro', 'old', 'new', 'modern',
  'coupe', 'sedan', 'hatchback', 'wagon', 'estate', 'liftback', 'fastback',
  'suv', 'crossover', 'compact', 'luxury', 'concept', 'custom', 'tuning', 'edition',
  'rigged', 'rigid', 'animated', 'simplified', 'simple', 'basic', 'full', 'detailed',
  'interior', 'exterior', 'lights', 'dirty', 'clean', 'used',
  'low', 'poly', 'polygon', 'game', 'ready', 'pbr', 'realistic', 'model', 'models', '3d']);
// Запчасти - отдельные товары, а не варианты. Без списка «Tesla Model 3 Right Seat»
// и чехол попадали в группу к самой машине.
const IDENT_PART = /\b(seat|seats|cover|covers|frame|frameset|fork|wheel|wheels|wheelset|tire|tires|rim|rims|engine|suspension|hitch|mirror|bumper|hood|door|steering|dashboard|cockpit|propeller|rotor|tunnel|garage|hangar|showroom|stand|display|logo|badge|emblem|part|parts|kit)\b/i;
// Сцена с человеком - другой товар: «Woman Riding Vespa 125» стоит $239 против $79.
const IDENT_FIGURE = /\b(woman|women|man|men|girl|boy|kid|kids|rider|riding|driver|driving|pilot|person|people|character|couple|family|crew)\b/i;
// Сцена или комплект - тоже другой товар. «Airport Runway with Airbus A400M» ($199)
// и «… A400M with Humvee Inside» ($229) не варианты самолёта за $179.
const IDENT_SCENE = /\b(runway|airport|terminal|hangar|dock|harbou?r|scene|diorama|environment|street|road|parking|circuit|racetrack|track|station|platform|warehouse|factory|inside)\b/i;
const COLOR_ANY = /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|olive|beige|pink|purple|maroon)\b/ig;
// Та же выборка без флага g - для match() с группой: у глобального регэкспа
// match возвращает список совпадений, а не группы, и цвет из подписи пропадал.
const COLOR_ANY_ONE = /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|olive|beige|pink|purple|maroon)\b/i;
const isYear = t => /^(19|20)\d{2}$/.test(t);
// Код модели: не короче трёх знаков и с цифрой - 300sl, 350, g580, 911, a320.
// Одиночная «3» из «Tesla Model 3» кодом не считается: по ней в одну группу
// попадали сиденья и чехлы. «3d» отсеивается длиной.
const isCode = t => t.length >= 3 && /\d/.test(t) && !isYear(t);

function identTokens(name) {
  return String(name).toLowerCase()
    .replace(SOFT, ' ')
    .replace(COLOR_ANY, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    // «300 SL» и «300SL» - одно и то же. Без склейки карточки одной машины
    // расходились по двум группам только из-за пробела в названии.
    .replace(/\b(\d{2,4})\s+([a-z]{1,3})\b/g, '$1$2')
    .split(' ').filter(Boolean).filter(t => !IDENT_FILLER.has(t));
}

const identRows = rows.filter(r => TECH_CATS.test(r.cat) && !isColl(r.name));
const identDf = new Map();
for (const r of identRows) for (const t of new Set(identTokens(r.name))) identDf.set(t, (identDf.get(t) || 0) + 1);
const IDENT_BRAND_DF = 100;

function identityOf(r) {
  if (!TECH_CATS.test(r.cat) || isColl(r.name)) return null;
  if (IDENT_PART.test(r.name) || IDENT_FIGURE.test(r.name) || IDENT_SCENE.test(r.name)) return null;
  const toks = identTokens(r.name);
  const years = [...new Set(toks.filter(isYear))].sort().join(' ');
  const core = [...new Set(toks.filter(t => !isYear(t)
    && (isCode(t) || t.length <= 3 || (identDf.get(t) || 0) >= IDENT_BRAND_DF)))].sort();
  if (!core.some(isCode)) return null;          // без кода модели не рискуем
  if (core.length < 2) return null;             // одного токена мало
  return { core: core.join(' '), years };
}

// Настоящая карточка, а не страница-перенаправление. Главной группы может быть
// только настоящая: если выбрать заглушку, вставлять список вариантов некуда -
// 1761 группа так и не слилась, молча, с пометкой «не нашёл, куда вставить».
const CARD_HEAD = 400;
const cardBuf = Buffer.alloc(CARD_HEAD);
function isRealCard(slug) {
  let fd;
  try { fd = fs.openSync(path.join(MODELS, slug, 'index.html'), 'r'); } catch (e) { return false; }
  try {
    const n = fs.readSync(fd, cardBuf, 0, CARD_HEAD, 0);
    return !/http-equiv="refresh"/.test(cardBuf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}

// ── группировка ──
function buildGroups(kind) {
  const re = kind === 'soft' ? SOFT : (kind === 'collection' ? IDX : COLOR);
  const g = {};
  for (const r of rows) {
    // Существование страницы здесь НЕ проверяем. Раньше проверяли - и уже удалённые
    // варианты выпадали из групп, а значит не попадали в карту «вариант -> главная».
    // После обрыва 08.08 это оставило 6247 ссылок в никуда: страницы удалены, а чем
    // их заменить, неизвестно. Отсутствие файла обрабатывается ниже, при слиянии.
    // Через isColl, а не COLL напрямую: имя с суффиксом софта иначе не проходит
    // ни сюда, ни в проход по софту - и товар выпадает из объединения совсем.
    if (kind === 'collection' && !isColl(r.name)) continue;      // только наборы
    if (kind !== 'collection' && isColl(r.name)) continue;          // их разбирает свой проход
    if (kind === 'color' && SOFT.test(r.name)) continue;   // софт разбирается отдельно
    // Для группы «софт» снимаем ещё Fur и Animated: мех, анимация и базовая версия -
    // одна и та же модель в разных исполнениях.
    // Для наборов основу тоже чистим. Одна серия бывает названа по-разному:
    // «African Animals 3D Models Collection 4» ($449) и «African Animals Collection 5»
    // ($499) - это выпуски 4 и 5 одного ряда, цены идут непрерывно. Без чистки они
    // попадали в разные группы. Слова «3D Models» и «Rigged» из основы убираем,
    // при этом в списке вариантов они остаются видны в подписи.
    const base = (kind === 'soft'
      // Цвет снимаем и здесь. Иначе проход по софту забирал «Side Loading Forklift
      // Truck Yellow» вместе с «… Yellow Rigged» раньше, чем цветовой проход успевал
      // собрать Yellow + Red + Orange, - и погрузчик оставался тремя карточками.
      ? r.gname.replace(re, '').replace(SIMPL, '').replace(COLOR, '').replace(FUR, ' ').replace(ANIM, ' ')
        .replace(POSE, ' ').replace(RIG, ' ').replace(/\s{2,}/g, ' ')
      : kind === 'collection'
        // Порядок важен: сперва снимаем суффикс софта, и только потом индекс.
        // У «African Animals Rigged Collection 2 for Maya» индекс стоит НЕ в конце,
        // и при обратном порядке он оставался в основе - выпуск не попадал в серию.
        ? r.name.replace(SOFT, '').replace(re, '').replace(/\s*\b3d\s+models?\b\s*/ig, ' ')
          .replace(RIG, ' ').replace(/\s{2,}/g, ' ')
        : r.gname.replace(re, '')).trim();
    // Отсечка по длине основы. Была 8 знаков, и она молча выбрасывала целые
    // семейства коротко названных моделей: «Dolphin» это 7 знаков, поэтому
    // «Dolphin Rigged», «… for Cinema 4D» и «… for Maya» так и остались тремя
    // карточками. Тем же способом терялись Raccoon, Meerkat, Hyena, Leopard,
    // Elk, Bat, Cow - всего 94 группы и 437 карточек.
    // Опущено до 3: группа всё равно не собирается без второго участника и без
    // различия по софту, меху, анимации, позе или оснастке (проверка varies
    // ниже), так что склеить двух разных «Bat» это правило не может.
    if (base.length < 3) continue;
    const key = base.toLowerCase();
    if (process.env.DBG && r.slug.startsWith(process.env.DBG)) console.log('DBG ' + kind + '  key=«' + key + '»  ' + r.slug);
    (g[key] = g[key] || { base, items: [] }).items.push(r);
  }
  const out = [];
  for (const [, grp] of Object.entries(g)) {
    if (grp.items.length < 2) continue;
    // группа считается вариантами, если внутри есть различие по софту ИЛИ по меху;
    // иначе это просто одинаково названные разные товары - их не трогаем
    const varies = grp.items.some(x => re.test(x.gname))
      || (kind === 'soft' && new Set(grp.items.map(x => hasFur(x.name))).size > 1)
      || (kind === 'soft' && new Set(grp.items.map(x => hasAnim(x.name))).size > 1)
      || (kind === 'soft' && new Set(grp.items.map(x => (poseOf(x.name) || '') + hasRig(x.name))).size > 1)
      || (kind === 'soft' && new Set(grp.items.map(x => hasSimpl(x.name))).size > 1);
    if (!varies) continue;
    // Главная - САМАЯ БАЗОВАЯ версия: без суффикса софта и без меха, то есть под
    // 3ds Max. Сортировка по продажам тут не годится: у меховой версии их обычно
    // больше, и она вытесняла базовую (Virginia Deer Fur Rigged забирал главенство
    // у Virginia Deer Rigged). Продажи решают только внутри равных по «базовости».
    // Главная - самая «голая» версия: без софта, без меха, без анимации, без позы
    // и без оснастки. Веса убывающие, чтобы порядок был предсказуем.
    const rank = x => (re.test(x.gname) ? 16 : 0)
      + (kind === 'soft' && hasFur(x.name) ? 8 : 0)
      + (kind === 'soft' && hasAnim(x.name) ? 4 : 0)
      + (kind === 'soft' && poseOf(x.name) ? 2 : 0)
      + (kind === 'soft' && hasRig(x.name) ? 1 : 0)
      + (kind === 'soft' && hasSimpl(x.gname) ? 32 : 0)
      // Для набора главной должна стать самая «чистая» запись серии: без софта,
      // без индекса, без «Rigged» и «3D Models». Иначе карточку на 42 выпуска
      // возглавляла «…Collection 7 for Maya» - как заголовок серии это бессмыслица.
      + (kind === 'collection' && SOFT.test(x.name) ? 8 : 0)
      + (kind === 'collection' && IDX.test(x.name.replace(SOFT, '')) ? 4 : 0)
      + (kind === 'collection' && hasRig(x.name) ? 2 : 0)
      + (kind === 'collection' && /\b3d\s+models?\b/i.test(x.name) ? 1 : 0);
    // Главной может быть только ЖИВАЯ страница. Правила «базовости» со временем
    // менялись, и после правки весов главной становилась запись, которую прошлый
    // прогон уже свернул и удалил: слияние падало с «главной страницы уже нет»
    // (122 группы), карта не пополнялась, а на диске оставалась старая карточка.
    // Так две «African Animals … for Maya/Cinema Collection» и жили отдельно.
    const order = grp.items.slice().sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales));
    const main = order.find(x => isRealCard(x.slug)) || order.find(x => fs.existsSync(path.join(MODELS, x.slug, 'index.html'))) || order[0];
    const rest = grp.items.filter(x => x.slug !== main.slug);
    if (!rest.length) continue;
    // Заголовок берём ОТ ГЛАВНОЙ карточки, сняв только суффикс софта. Если брать
    // нормализованный ключ группы, из названия исчезнут Fur и Animated - а они там
    // могут быть по делу: у «Animated Flight Bhutan Glory Butterfly» неанимированной
    // версии не существует вовсе, и заголовок без Animated был бы просто неверным.
    // Для серии заголовок - нормализованное имя ряда, а не имя главной записи.
    // Самые «чистые» страницы серии удалены прошлыми прогонами, и главной остаётся
    // случайная: карточку на 42 выпуска возглавляла «…Collection 7 for Maya».
    // Как заголовок серии это бессмыслица, а «African Animals Collection» - верно.
    const title = kind === 'collection'
      ? grp.base
      : main.name.replace(re, '').trim();
    out.push({ base: title, main, rest, kind });
  }
  return out;
}

// Маркеры исполнения, которые снимаем с заголовка объединённой карточки техники.
const IDENT_MARKS = [
  SOFT,
  /\s*\b(?:low\s+poly|lowpoly)\b\s*/ig,
  /\s*\b(?:rigged|rigid|animated|simplified)\b\s*/ig,
  /\s*\b(?:simple|basic|full|detailed)\s+interior\b\s*/ig,
  /\s*\b(?:dirty|clean)\b\s*/ig,
  COLOR_ANY,
  /\s*\bcolor\b\s*/ig,
];
// Описательный «хвост» в заголовке объединённой карточки не нужен: главной может
// оказаться «Mercedes-Benz 300SL Classic Sports Car Red», и серия из 11 исполнений
// получала заголовок с чужим описанием. Убираем только общие слова - Gullwing,
// Atlas и прочие имена остаются.
const IDENT_TITLE_FILLER = /\b(classic|vintage|retro|sports?|car|cars|vehicle|automobile|coupe|sedan|suv|crossover|luxury|modern|airlines?|airways)\b/ig;
const identTitle = n => {
  let s = String(n);
  for (const re of IDENT_MARKS) s = s.replace(re, ' ');
  s = s.replace(IDENT_TITLE_FILLER, ' ').replace(/\s{2,}/g, ' ').trim();
  // Если после чистки осталось меньше двух слов, чистка съела слишком много -
  // возвращаем исходное имя без маркеров исполнения.
  if (s.split(/\s+/).filter(Boolean).length < 2) {
    s = String(n);
    for (const re of IDENT_MARKS) s = s.replace(re, ' ');
    s = s.replace(/\s{2,}/g, ' ').trim();
  }
  return s.replace(/\s+([,.])/g, '$1').trim();
};

// Заголовок объединённой карточки техники - только то, что общее у ВСЕХ версий.
// Иначе главной оказывается «Jet Airliner Airbus A330-200 Qatar», а внутри ещё
// Emirates, Lufthansa и Cathay Pacific: название обещает не то, что на странице.
// Слово остаётся, если встречается в имени каждой версии (без учёта дефисов
// и регистра: «Mercedes-Benz» и «Mercedes Benz» - одно и то же).
const normTok = w => w.toLowerCase().replace(/[^a-z0-9]+/g, '');
function commonTitle(main, rest) {
  const setsOf = n => new Set(String(n).split(/\s+/).map(normTok).filter(Boolean));
  const others = rest.map(x => setsOf(x.name));
  const kept = String(main.name).split(/\s+/)
    .filter(w => { const t = normTok(w); return t && others.every(s => s.has(t)); });
  const title = identTitle(kept.join(' '));
  // Чистка могла срезать слишком много: у группы Porsche Cayenne общими остались
  // только «AWD 4dr» - как название карточки это бессмыслица. Требуем хотя бы одно
  // полноценное слово и разумную длину, иначе берём имя главной.
  const ws = title.split(/\s+/).filter(Boolean);
  const meaningful = ws.length >= 2 && title.length >= 10 && ws.some(w => w.length >= 4 && !/\d/.test(w));
  return meaningful ? title : identTitle(main.name);
}

// ── проход по Root ID из отчёта «Product Report» ────────────────────────────
//
// Root ID доказывает, что модели сделаны из одного исходника. Это снимает старое
// ограничение: «Blue Sultana Grape Cluster» и «Sultana Blue Grape Cluster Lying»
// по именам разные, по корню - одна модель.
//
// Но корень НЕ означает «одна карточка». Внутри одного корня законно лежат и сам
// предмет, и его детали: в корне «Gas Pump» вместе с колонками лежат сопла, в
// корне «Summer Workwear» - комплект и отдельно ботинки, каска, брюки. Поэтому:
//   • детали (is_split из отчёта) из объединения исключаются, остаются своими
//     карточками;
//   • остальное сводится по набору слов имени без маркеров исполнения - набор,
//     а не строка, поэтому перестановка слов не мешает.
const REPORT = path.join(ROOT, 'data', 'product-report.json');
const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : [];
const byPid = new Map(report.map(r => [String(r.pid), r]));

const ROOT_MARKS = [
  SOFT,
  /\b(rigged|rigid|animated|simplified|simple|lowpoly|low\s*poly|generic)\b/ig,
  /\b(t[\s-]?pose|standing|sitting|walking|running|swimming|flying|jumping|lying|neutral|pose)\b/ig,
  /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|beige|pink|purple|maroon|bronze|copper)\b/ig,
  /\b3d\s*(model|models)\b/ig,
  /\b(19|20)\d{2}\b/g,
];
const ROOT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'with', 'for', 'in', 'on', 'to', 'by']);
function rootPrint(name) {
  let s = String(name || '').toLowerCase();
  for (const re of ROOT_MARKS) s = s.replace(re, ' ');
  const toks = s.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !ROOT_STOP.has(t));
  return [...new Set(toks)].sort().join(' ');
}


// ── точечные объединения по прямому указанию основателя ─────────────────────
//
// Общий корень у этих карточек проходит через root+category-проход, но в самом
// корне ещё 150+ других самолётов/зданий (та же исходная модель, перекрашенная
// под разные авиакомпании и типы) - автоматический потолок ROOTCAT_MAX режет
// такие корни целиком, и нужную пару внутри они не выделяют. Основатель указал
// эти пары явно - тот же критерий, что и для Eurofighter: тот же предмет плюс
// добавка/переименование = одна карточка.
const MANUAL_GROUPS = [
  { main: '2377479', rest: ['2377666'] },   // United 737-900 / -900 ER - тот же борт
  { main: '2015826', rest: ['899043'] },    // Caesars Superdome = Mercedes-Benz Superdome (переименование)
  { main: '1439041', rest: ['1435958', '1439217'] }, // Disneyland Cinderella Castle / Cinderella Castle / Magic Castle
  { main: '2026371', rest: ['2025434', '2344240', '2346155'] }, // HMS Queen Elizabeth + варианты с вооружением
  // Присланы основателем 24.08.2026. Названия разведены полностью, общих слов
  // почти нет - ни один проход по имени такое не соберёт. Часть ловится по
  // геометрии (проход geo), но у «Simplified» меш облегчён, а у тросов в
  // карточках вовсе нет Polygons - эти указываем руками.
  // Тросы - ДВЕ пары, а не одна группа. С крюками и без - разные меши
  // (4448 и 6880 полигонов), то есть разные предметы, а не варианты одного.
  { main: '1283452', rest: ['2553243'] },                       // трос буксировочный без крюков
  { main: '1283453', rest: ['2554921'] },                       // трос буксировочный с крюками
  // Присланы основателем 01.09.2026. Восемь карточек кои: полигонаж и число
  // вершин совпадают, родительский ID в отчёте общий. Автоматические проходы их
  // не собрали, и вот почему: проход rootcat берёт только технику - машины,
  // самолёты, корабли, военку, промоборудование, - а рыбы это Animals &
  // Creatures. Родителей ДВА (9E2MddrTSS и Mrvqw97UQa), поэтому и групп две.
  // Главной в каждой берём карточку с наибольшими продажами.
  { main: '2144139', rest: ['2141469'] },                       // Harivake Koi Fish
  { main: '1144472', rest: ['1142255', '1144466', '1144469', '1144510', '1144516'] }, // Koi Fish, позы и цвета
  { main: '2471077', rest: ['2471619', '2471626', '2471978'] }, // Cadillac Gage V-100: green / tan / woodland / simplified
  { main: '2472126', rest: ['2472131'] },                       // WWII артиллерия: green / desert
  { main: '2499896', rest: ['2499928', '2499929'] },            // Thales Hawkei: базовый / camo / simplified
  { main: '2491809', rest: ['2491817'] },                       // ракетная установка: desert / forest camo
  { main: '2474120', rest: ['2474133'] },                       // Kawasaki Corleo: white copper / light blue
  // Купе основателя разошлись по двум семьям: у них разные меши (124409 и
  // 174823 полигона) - это полная и Simplified версии одного Volkswagen Baja
  // Concept. Правило про Simplified в скрипте уже есть, но по названиям эти
  // две семьи не сходятся. Сводим Simplified-семью в основную.
  { main: '2509323', rest: ['2509316'] },                       // Baja Concept: полная версия и Simplified
];
function buildManualGroups() {
  const byId = new Map(rows.map(r => [r.id, r]));
  const out = [];
  for (const { main: mainId, rest: restIds } of MANUAL_GROUPS) {
    const main = byId.get(mainId);
    const rest = restIds.map(id => byId.get(id)).filter(Boolean);
    if (!main || !rest.length) continue;
    out.push({ base: commonTitle(main, rest), main, rest, kind: 'manual' });
  }
  return out;
}

// ── проход «корень внутри техники» ──────────────────────────────────────────
//
// Критерий основателя: если предмет тот же, а отличие - добавка или другое
// название, это одна карточка. «Eurofighter Typhoon Jet» и «… Jet with Weaponry»
// - один самолёт; «Devil Emoji» и «Angry Emoji» - разные предметы.
//
// Автоматически различить это по названию не вышло. Перебрал: полное совпадение
// слов (развело Eurofighter), отказ от проверки имени (43 364 карточки в кашу),
// самое редкое общее слово (слило 21 разный пельмень и 17 эмодзи), имя корня из
// отчёта (у Eurofighter оно пустое). Сработало другое - три ограничителя:
//
//   • только техника: там корень почти всегда означает одну машину, тогда как
//     в еде и мелочёвке - вид товара;
//   • корень не «0»: это пустое значение, в нём 139 несвязанных вещей, от шасси
//     седана до DeLorean;
//   • не больше шести карточек: крупные корни - это семейства, а не машины,
//     в одном лежат Airbus A321, Boeing 767 и 737. Таких 393, их не трогаем.
const ROOTCAT = /^(vehicles|military vehicles|aircraft|ships|industrial equipment)$/i;
const ROOTCAT_MAX = 6;

function buildRootCatGroups() {
  if (!report.length) return [];
  const byRoot = new Map();
  for (const r of rows) {
    const rep = byPid.get(String(r.id));
    if (!rep || !rep.root || rep.root === '0' || rep.split) continue;
    if (!ROOTCAT.test(rep.cat1 || '')) continue;
    if (isColl(r.name)) continue;
    if (!byRoot.has(rep.root)) byRoot.set(rep.root, []);
    byRoot.get(rep.root).push(r);
  }

  const out = [];
  for (const [, items] of byRoot) {
    // Потолок считаем по ЖИВЫМ карточкам, а не по всем строкам корня. В корне
    // Eurofighter 14 позиций, но 10 из них уже свёрнуты прошлыми проходами -
    // живых всего 4. Счёт по всем строкам отбрасывал такие корни целиком.
    const alive = items.filter(x => isRealCard(x.slug));
    if (alive.length < 2 || alive.length > ROOTCAT_MAX) continue;
    const rank = x => (SOFT.test(x.name) ? 16 : 0)
      + (/\bsimplified\b/i.test(x.name) ? 8 : 0)
      + (/\blow\s*poly\b/i.test(x.name) ? 4 : 0)
      + (hasRig(x.name) ? 2 : 0)
      + (poseOf(x.name) ? 1 : 0);
    const order = items.slice().sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales));
    const main = order.find(x => isRealCard(x.slug))
      || order.find(x => fs.existsSync(path.join(MODELS, x.slug, 'index.html'))) || order[0];
    const rest = order.filter(x => x.slug !== main.slug);
    if (!rest.length) continue;
    out.push({ base: commonTitle(main, rest), main, rest, kind: 'rootcat' });
  }
  return out;
}

// zero=false - модели с НАСТОЯЩИМ корнем из отчёта. Это самый надёжный признак
// родства, поэтому проход идёт рано.
// zero=true  - модели, у которых в отчёте root="0", то есть корня нет вовсе.
//
// Почему их пришлось развести. Строка "0" в JS истинна, поэтому проверка
// !rep.root её не отсекала, и 4669 моделей (5% каталога) группировались по
// фальшивому ключу «0|отпечаток имени». Сам по себе такой ключ работает - по
// имени родство видно, - но проход шёл РАНЬШЕ прохода по софту и забирал
// участников себе. Три дельфина («Dolphin Rigged», «… for Cinema 4D»,
// «… for Maya») из-за этого стали двумя карточками: две с root="0" слиплись
// между собой, третья с настоящим корнем осталась снаружи, и общая группа уже
// не собиралась - её участники были заняты.
// Просто выключить группировку по "0" нельзя: без неё перестают сливаться 935
// карточек, которые сливались верно (Samsung Galaxy, Apple Watch, KUKA Robot).
// Поэтому проход не выключен, а перенесён в конец очереди: сперва софт, цвет и
// техника собирают полные семьи, а «нулевой корень» подбирает то, что осталось.
function buildRootGroups(zero = false) {
  if (!report.length) return [];
  const g = new Map();
  for (const r of rows) {
    const rep = byPid.get(String(r.id));
    if (!rep || !rep.root) continue;
    if (zero ? rep.root !== '0' : rep.root === '0') continue;
    if (rep.split) continue;                 // деталь - своя карточка
    if (isColl(r.name)) continue;            // наборы разбирает свой проход
    const p = rootPrint(rep.name || r.name);
    if (!p || p.length < 3) continue;
    const key = rep.root + '|' + p;
    if (!g.has(key)) g.set(key, []);
    g.get(key).push(r);
  }

  const out = [];
  for (const [, items] of g) {
    if (items.length < 2) continue;
    // Главная - самое «голое» исполнение; при равенстве решают продажи.
    const rank = x => (SOFT.test(x.name) ? 16 : 0)
      + (/\bsimplified\b/i.test(x.name) ? 8 : 0)
      + (/\blow\s*poly\b/i.test(x.name) ? 4 : 0)
      + (hasRig(x.name) ? 2 : 0)
      + (poseOf(x.name) ? 1 : 0);
    const order = items.slice().sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales));
    const main = order.find(x => isRealCard(x.slug)) || order.find(x => fs.existsSync(path.join(MODELS, x.slug, 'index.html'))) || order[0];
    const rest = order.filter(x => x.slug !== main.slug);
    if (!rest.length) continue;
    out.push({ base: commonTitle(main, rest), main, rest, kind: zero ? 'root0' : 'root' });
  }
  return out;
}

function buildIdentityGroups() {
  const byCore = new Map();
  for (const r of rows) {
    const id = identityOf(r);
    if (!id) continue;
    if (!byCore.has(id.core)) byCore.set(id.core, []);
    byCore.get(id.core).push({ r, years: id.years });
  }

  const out = [];
  const emit = items => {
    if (items.length < 2) return;
    // Главная - самая «голая» версия: без софта, без оснастки, без упрощения,
    // без Low Poly. Продажи решают только внутри равных по «базовости».
    const rank = x => (SOFT.test(x.name) ? 16 : 0)
      + (hasSimpl(x.name) || /\bsimplified\b/i.test(x.name) ? 8 : 0)
      + (/\blow\s*poly\b/i.test(x.name) ? 4 : 0)
      + (hasRig(x.name) ? 2 : 0)
      + (/\bsimple\s+interior\b/i.test(x.name) ? 1 : 0);
    const order = items.map(x => x.r).sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales));
    const main = order.find(x => isRealCard(x.slug)) || order.find(x => fs.existsSync(path.join(MODELS, x.slug, 'index.html'))) || order[0];
    const rest = order.filter(x => x.slug !== main.slug);
    if (!rest.length) return;
    out.push({ base: commonTitle(main, rest), main, rest, kind: 'identity' });
  };

  for (const [, items] of byCore) {
    const yearSets = [...new Set(items.map(x => x.years).filter(Boolean))];
    if (yearSets.length <= 1) { emit(items); continue; }
    // Несколько поколений в одном ряду: «Porsche 911 1970» и «Porsche 911 2020» -
    // разные машины. Сливаем только внутри своего года, безгодовые не трогаем.
    for (const y of yearSets) emit(items.filter(x => x.years === y));
  }
  return out;
}

// ── проход «одна геометрия» ─────────────────────────────────────────────────
//
// Последний по очереди: он смотрит не на название, а на число полигонов и
// вершин, и подбирает то, что не разобрали проходы по имени. Группы приходят
// готовыми из data/geo-groups.json - как они отобраны и почему крупные семьи
// (19 крейсеров Ticonderoga, 16 фирменных прицепов) туда не попадают, написано
// в scripts/scan-geometry-groups.mjs.
function buildGeoGroups() {
  const F = path.join(ROOT, 'data', 'geo-groups.json');
  if (!fs.existsSync(F)) return [];
  const out = [];
  // Главная - самая «голая» версия, тот же порядок, что и в проходе по технике:
  // без софта, без упрощения, без Low Poly, без оснастки. Продажи решают внутри
  // равных.
  const rank = x => (SOFT.test(x.name) ? 16 : 0)
    + (hasSimpl(x.name) || /\bsimplified\b/i.test(x.name) ? 8 : 0)
    + (/\blow\s*poly\b/i.test(x.name) ? 4 : 0)
    + (hasRig(x.name) ? 2 : 0);
  for (const slugs of JSON.parse(fs.readFileSync(F, 'utf8'))) {
    const items = slugs.map(s => bySlug.get(s)).filter(Boolean);
    if (items.length < 2) continue;
    const order = items.slice().sort((a, b) => (rank(a) - rank(b)) || (b.sales - a.sales));
    const main = order.find(x => isRealCard(x.slug)) || order[0];
    const rest = order.filter(x => x.slug !== main.slug);
    if (!rest.length) continue;
    out.push({ base: commonTitle(main, rest), main, rest, kind: 'geo' });
  }
  return out;
}

// ── превью варианта: берём из его страницы, там уже проверенные ссылки ──
// Снимок варианта. Страницы вариантов из прошлых прогонов уже удалены, читать
// og:image не с чего - и галерея серии из 44 выпусков схлопывалась до трёх
// картинок. Запасной источник - data/preview-index.json (см. build-preview-index.mjs).
// Колонка image_url из выгрузки для этого не годится: там угаданный адрес
// static.turbosquid.com/Preview/…_D_Main.jpg, он отдаёт 404.
const PREVIEW_INDEX = path.join(ROOT, 'data', 'preview-index.json');
const prevIdx = fs.existsSync(PREVIEW_INDEX) ? JSON.parse(fs.readFileSync(PREVIEW_INDEX, 'utf8')) : {};
let prevIdxAdded = 0;
function previewOf(slug) {
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    const og = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
    // Запоминаем до удаления страницы, чтобы галерея не потерялась в следующий раз.
    if (og && prevIdx[slug] !== og) { prevIdx[slug] = Buffer.from(og, 'utf8').toString('utf8'); prevIdxAdded++; }
    if (og) return og;
  } catch (e) { /* страница свёрнута прошлым прогоном - берём из индекса */ }
  return prevIdx[slug] || null;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── разметка галереи и списка вариантов ──
function buildBlocks(g) {
  const all = [g.main, ...g.rest];
  // Не больше 12 миниатюр: в серии бывает и 44 выпуска, полоса превью тогда
  // разъезжается, а страница тяжелеет впустую. Полный список - ниже, в вариантах.
  const shots = all.map(x => ({ r: x, img: previewOf(x.slug) })).filter(x => x.img).slice(0, 12);
  // Метка должна читаться сама по себе: «Maya · Fur» понятно, «Maya» рядом с
  // «Maya» из меховой версии - нет.
  const label = x => {
    if (g.kind === 'soft') {
      const m = x.name.match(SOFT);
      const soft = m ? m[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Autodesk 3ds Max';
      // Цвет теперь снимается и с основы этого прохода, значит он различает версии
      // внутри группы - без него «Yellow» и «Red» получили бы одну подпись.
      const cm = x.gname.match(COLOR);
      const bits = cm ? [cm[1].replace(/\b\w/g, c => c.toUpperCase()), soft] : [soft];
      if (hasFur(x.name)) bits.push('Fur');
      if (hasAnim(x.name)) bits.push('Animated');
      const p = poseOf(x.name);
      if (p) bits.push(p);
      else if (hasRig(x.name)) bits.push('Rigged');
      if (hasSimpl(x.name)) bits.push('Simplified');
      return bits.join(' · ');
    }
    if (g.kind === 'collection') {
      // Подпись должна различать выпуски РАЗНЫХ рядов внутри одной серии:
      // «Collection 4» из ряда 3D Models и «Collection 4» из ряда Rigged - это
      // разные товары с разной ценой, и по одной цифре их не отличить.
      const bits = [collLabel(x.name)];
      if (/\b3d\s+models?\b/i.test(x.name)) bits.push('3D Models');
      if (hasRig(x.name)) bits.push('Rigged');
      const sm = x.name.match(SOFT);
      if (sm) bits.push(sm[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      return bits.join(' · ');
    }
    if (g.kind === 'identity' || g.kind === 'root' || g.kind === 'rootcat') {
      // Подпись описывает исполнение: цвет, софт, оснастка, упрощение, Low Poly.
      const bits = [];
      // Цветов в названии бывает несколько: у фески свой цвет у шапки и свой у
      // кисточки. Берём ВСЕ - иначе двенадцать вариантов получают подписи «Black»
      // и «Black (2)», по которым ничего не выбрать.
      const cs = [...new Set((x.name.match(COLOR_ANY) || []).map(c => c.toLowerCase()))];
      if (cs.length) bits.push(cs.map(c => c.replace(/\b\w/g, ch => ch.toUpperCase())).join(' + '));
      const sm = x.name.match(SOFT);
      if (sm) bits.push(sm[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      if (hasRig(x.name)) bits.push('Rigged');
      if (/\blow\s*poly\b/i.test(x.name)) bits.push('Low Poly');
      if (/\bsimplified\b/i.test(x.name)) bits.push('Simplified');
      if (/\bsimple\s+interior\b/i.test(x.name)) bits.push('Simple Interior');
      if (hasAnim(x.name)) bits.push('Animated');
      return bits.length ? bits.join(' · ') : 'Standard';
    }
    const m = x.gname.match(COLOR);
    return m ? m[1].replace(/\b\w/g, c => c.toUpperCase()) : g.base;
  };

  // Короткая подпись под миниатюрой: в плитку 108px полная метка не влезает, а без
  // подписи по одинаковым машинам разного цвета не понять, где что.
  const shortLabel = x => {
    if (g.kind === 'collection') {
      const m = collLabel(x.name).match(/\d+/);
      return m ? 'Set ' + m[0] : 'Set';
    }
    if (g.kind === 'color') {
      const m = x.gname.match(COLOR);
      return m ? m[1].replace(/\b\w/g, c => c.toUpperCase()) : 'Base';
    }
    if (g.kind === 'identity' || g.kind === 'root' || g.kind === 'rootcat') {
      const cs2 = [...new Set((x.name.match(COLOR_ANY) || []).map(c => c.toLowerCase()))];
      if (cs2.length) return cs2.map(c => c.replace(/\b\w/g, ch => ch.toUpperCase())).join('+');
      const sm = x.name.match(SOFT);
      if (sm) return sm[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (/\blow\s*poly\b/i.test(x.name)) return 'Low Poly';
      if (/\bsimplified\b/i.test(x.name)) return 'Simplified';
      if (hasRig(x.name)) return 'Rigged';
      return 'Standard';
    }
    // Для форматов подписываем ОТЛИЧИЕ, а не общий софт. У Ragdoll Cat почти все
    // версии под 3ds Max, и подпись «3ds Max» под каждой миниатюрой ничего не
    // говорит: различают их поза, мех и анимация.
    const cs = x.gname.match(COLOR);
    if (cs) return cs[1].replace(/\b\w/g, c => c.toUpperCase());
    const p = poseOf(x.name);
    if (p) return p;
    if (hasFur(x.name)) return 'Fur';
    if (hasAnim(x.name)) return 'Animated';
    if (hasSimpl(x.gname)) return 'Simplified';
    if (hasRig(x.name)) return 'Rigged';
    const m = x.name.match(SOFT);
    return m ? m[1].replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Standard';
  };

  // Галерея статическая: все снимки лежат в разметке, поэтому их видят и поисковик,
  // и AI-краулеры, которые не исполняют скрипты. Скрипт только переключает крупный.
  let gal = '';
  if (shots.length > 1) {
    gal = '<div class="mp-gallery" data-gallery>'
      // Подпись к крупному снимку. Без неё непонятно, какой выпуск сейчас открыт:
      // на карточке серии из 44 наборов картинки различаются, а чем - не сказано.
      + '<div class="mp-gal-cap" data-gal-cap>' + esc(label(shots[0].r)) + '</div>'
      + '<div class="mp-gal-strip">'
      + shots.map((s, i) => '<button type="button" class="mp-gal-thumb' + (i ? '' : ' is-on')
        + '" data-full="' + esc(s.img) + '" data-cap="' + esc(label(s.r)) + '"'
        + ' title="' + esc(label(s.r)) + '" aria-label="' + esc(label(s.r)) + '">'
        + '<img src="' + esc(s.img) + '" alt="' + esc(g.base + ' - ' + label(s.r)) + '"'
        + ' width="200" height="113" loading="lazy" decoding="async">'
        + '<span class="mp-gal-lbl">' + esc(shortLabel(s.r)) + '</span></button>').join('')
      + '</div></div>';
  }

  // Один и тот же формат бывает выложен на TurboSquid несколькими листингами -
  // ссылки у них разные, а метка получалась одинаковой. Нумеруем повторы, иначе
  // в списке подряд идут два одинаковых «Cinema 4D» без объяснения.
  const seen = {};
  const uniqLabel = x => {
    const base = label(x);
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? base + ' (' + seen[base] + ')' : base;
  };

  // Заголовок витрины. У проходов manual и geo родство найдено не по цвету, и
  // «Available Colors» над списком «Jar Stand / Spice Rack Organizer» человека
  // сбивает. Смотрим на сами подписи: если КАЖДАЯ - это цвет, заголовок про
  // цвета честен, иначе говорим нейтрально про версии модели.
  const allColors = all.every(x => COLOR_ANY_ONE.test(label(x)));
  const head = g.kind === 'soft' ? 'Available Formats'
    : g.kind === 'collection' ? 'All Sets in This Series'
      : (g.kind === 'identity' || g.kind === 'root' || g.kind === 'rootcat') ? 'All Versions of This Model'
        : (g.kind === 'manual' || g.kind === 'geo') ? (allColors ? 'Available Colors' : 'All Versions of This Model')
          : 'Available Colors';
  // Версии идут ВНИЗ страницы сеткой карточек, а не узким списком в правой
  // колонке над характеристиками.
  //
  // Раньше здесь строился <section class="mp-variants"> - список в боковой
  // колонке. Из-за него правая колонка вытягивалась намного ниже левой, под ней
  // зияла пустота, а девять версий приходилось разглядывать в узкой полосе.
  // Скрипт apply-card-upgrade переносил их вниз и боковой блок удалял, но
  // следующий прогон склейки вставлял его обратно - и на карточке оказывались
  // ОБА блока сразу: сбоку девять версий, внизу две устаревшие.
  //
  // Чтобы это не повторялось, склейка сразу собирает нижнюю секцию. Разметка -
  // та же, что у блока «Related 3D Models», поэтому читается как часть страницы.
  const list = '<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">'
    + '<div class="section-label mp-mb8">Same model, other versions</div>'
    + '<h2 class="mp-related-h2">' + head + '</h2>'
    + '<div class="mp-related-grid">'
    + all.map((x, i) => {
      const img = previewOf(x.slug);
      const label = uniqLabel(x);
      // «Standard» в чипе ничего не сообщает - у главной версии показываем
      // нейтральное действие.
      const tag = /^standard$/i.test(String(label).trim().replace(/\s*\(\d+\)$/, '')) ? 'View on TurboSquid' : label;
      return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link">'
        + '<div class="img-wrap mp-rc-img-wrap">'
        + (img
          ? '<img src="' + esc(img) + '" alt="' + esc(label) + '" width="800" height="450"'
          + ' decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">'
          : '')
        + '<div class="img-placeholder" aria-hidden="true"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>'
        + '<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">' + esc(label)
        + (i ? '' : ' <span class="mp-var-badge">main</span>') + '</div></div>'
        + '<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">' + esc(tag) + '</span>'
        + '<span class="mp-rc-price">$' + x.price + '</span></div></div></a>';
    }).join('')
    + '</div></div></section>';

  // Цены у вариантов расходятся: меховая версия дороже базовой. Показываем диапазон,
  // иначе на карточке будет одна цена, а по ссылке другая.
  const prices = all.map(x => x.price).filter(Boolean);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const priceText = prices.length && lo !== hi ? '$' + lo + ' - $' + hi : (prices.length ? '$' + lo : null);

  return { gallery: gal, list, shots: shots.length, all, priceText };
}

// ── применение к странице главной ──
function mergeInto(g) {
  const file = path.join(MODELS, g.main.slug, 'index.html');
  // Читаем через try: слаг может оказаться главным в одной группе и вариантом в
  // другой. 08.08.2026 такой случай (volkswagen-beetle-1966-rigged-red) обрушил
  // прогон на середине - страница была удалена раньше, чем дошла очередь до её
  // собственной группы. Ниже группы ещё и разводятся по claimed, но защита нужна.
  let html;
  try { html = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { ok: false, why: 'главной страницы уже нет' }; }

  // Главная может оказаться страницей-перенаправлением: все участники группы уже
  // свёрнуты прошлым прогоном по другим правилам, и isRealCard в buildGroups не нашёл
  // ни одной живой - сработал запасной выбор «лишь бы файл существовал». Вставлять
  // список вариантов в заглушку некуда, в ней нет ни характеристик, ни таблицы, и
  // раньше такие 2547 групп падали с невнятным «не нашёл, куда вставить список».
  if (/http-equiv="refresh"/.test(html.slice(0, 400))) {
    return { ok: false, why: 'главная уже свёрнута в заглушку' };
  }

  // Уже объединённую карточку не пропускаем, а ПЕРЕСОБИРАЕМ: состав группы мог
  // вырасти. Так и вышло с African Animals - после чистки основы от «3D Models»
  // и «Rigged» серия выросла с 4 выпусков до 26, но старый блок мешал обновиться.
  // Старую галерею запоминаем. Превью варианта читаются с его страницы, а она уже
  // удалена прошлым прогоном - заново собрать столько же снимков не выйдет. Если
  // новая галерея беднее старой, оставляем старую: терять снимки нельзя.
  const oldGal = (html.match(/<div class="mp-gallery" data-gallery>[\s\S]*?<\/div><\/div>/) || [])[0] || '';
  const oldShots = (oldGal.match(/mp-gal-thumb/g) || []).length;
  html = html.replace(/<div class="mp-gallery" data-gallery>[\s\S]*?<\/div><\/div>/g, '');
  // Убираем и старый боковой список, и прежнюю нижнюю секцию версий: обе
  // соберутся заново. Заодно исчезают пустые карточки-обёртки, оставшиеся
  // от бокового блока.
  html = html.replace(/<section class="mp-variants">[\s\S]*?<\/section>/g, '');
  html = html.replace(/<section class="mp-related-section mp-versions-section">[\s\S]*?<\/section>/g, '');
  html = html.replace(/<div class="mp-spec-card">\s*<div class="mp-spec-block">\s*<\/div>\s*<\/div>/g, '');
  html = html.replace(/<div class="mp-spec-card">\s*<\/div>/g, '');
  const before = html;
  let { gallery, list, shots, priceText } = buildBlocks(g);
  // Страховка «оставить галерею, где снимков больше» больше не нужна: превью
  // берутся из постоянного индекса, а не со страниц вариантов. Хуже того, она
  // вредила - держала разметку прошлого прогона, ещё без подписей к снимкам
  // (у Ragdoll Cat старых 18 против нынешних 12 из-за потолка). Старую берём,
  // только если новую собрать не из чего.
  if (shots < 2 && oldShots >= 2) { gallery = oldGal; shots = oldShots; }
  // Раньше нехватка превью отменяла ВЕСЬ блок - вместе со списком версий и
  // ссылками на TurboSquid. А превью пропадает по причине, к списку отношения не
  // имеющей: страница варианта уже свёрнута в заглушку и её og:image не попал в
  // preview-index.json. Так шесть главных карточек остались вообще без витрины.
  // Галерея без снимков не нужна, список версий - нужен всегда, поэтому теперь
  // при нехватке снимков отказываемся только от галереи.
  if (shots < 2) { gallery = oldShots ? oldGal : ''; }

  // цена в характеристиках - диапазоном, если варианты стоят по-разному
  if (priceText && priceText.includes('-')) {
    html = html.replace(/(<td[^>]*>\s*Price\s*<\/td>\s*<td[^>]*>)([^<]*)(<\/td>)/i,
      (m, a, _b, c) => a + priceText + c);
  }

  // заголовок и H1 - на базовое имя без суффикса
  const baseEsc = esc(g.base);
  // Что стояло в H1 ДО замены. Страницу пересобирают многократно, и во вкладке
  // остаётся заголовок прошлого прогона, а не имя из выгрузки: у Lexus GX 550
  // H1 уже был «Lexus GX 550», а вкладка держала «Lexus GX 550 2024».
  const prevH1 = (html.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1] || '';
  html = html.replace(/<h1 class="mp-h1">[\s\S]*?<\/h1>/, () => '<h1 class="mp-h1">' + baseEsc + '</h1>');

  // Вкладка, соцпревью и хлебные крошки должны говорить то же, что H1. Иначе на
  // странице «Mercedes-Benz 300SL» вкладка остаётся «…300SL Classic Sports Car Red»
  // - это и разнобой для читателя, и разные заголовки для поиска на одной странице.
  // Меняем и имя из выгрузки, и заголовок прошлого прогона - что найдётся.
  // Длинные варианты первыми, иначе короткий съест часть длинного.
  // Собираем заново, а не подменяем строку: карточку пересобирали несколько раз,
  // и во вкладке мог остаться заголовок позапрошлого прогона, которого нет ни в
  // выгрузке, ни в текущем H1. У Lexus GX 550 так и было - H1 уже верный, а
  // вкладка держала «Lexus GX 550 2024». Хвост после «3D Model» (цена, имя сайта)
  // сохраняем как есть.
  const olds = [esc(g.main.name), prevH1].filter(x => x && x !== baseEsc)
    .sort((a, b) => b.length - a.length);
  const swap = s => { for (const o of olds) if (s.includes(o)) return s.split(o).join(baseEsc); return s; };
  // Замена ТОЛЬКО функцией. Строкой нельзя: хвост заголовка содержит цену, и
  // «$159» в строке замены читается как ссылка на группу 1 - заголовок размножался
  // сам в себя («… 3D Model -  3D Model - … $159 | 3D Molier</title>59 |
  // 3D Molier</title>»). Так испортились 4442 страницы.
  // Хвост заголовка приклеивать нельзя: он начинается со слов «3D Model», а имя
  // товара тоже бывает кончается на «3D Model» («Side Loading Forklift Truck
  // Yellow 3D Model»). Каждый прогон дописывал ещё одно, и во вкладке набралось
  // восемь повторов подряд. Собираем заголовок целиком, из имени и цены.
  const titleName = baseEsc.replace(/\s*\b3d\s+models?\s*$/i, '');
  const retitle = (re, open, close) => {
    const m = html.match(re);
    if (!m) return;
    if (m[1] === undefined) { html = html.replace(re, swap); return; }
    const price = (m[1].match(/\$([\d.,]+)/) || [])[1];
    const withPrice = /\$[\d.,]+/.test(m[1]);
    // Разделитель - дефис, не длинное тире: правило проекта. Генератор ставил
    // «-», и оно висело в заголовке каждой карточки.
    const built = open + titleName + ' 3D Model'
      + (withPrice && price ? ' - $' + price : '') + ' | 3D Molier' + close;
    html = html.replace(re, () => built);
  };
  retitle(/<title>[\s\S]*?(\s*3D Model[\s\S]*?)<\/title>/, '<title>', '</title>');
  retitle(/<meta property="og:title" content="[^"]*?(\s*3D Model[^"]*?)"/, '<meta property="og:title" content="', '"');
  retitle(/<meta name="twitter:title" content="[^"]*?(\s*3D Model[^"]*?)"/, '<meta name="twitter:title" content="', '"');
  html = html.replace(/<span class="mp-bc-current">[\s\S]*?<\/span>/,
    '<span class="mp-bc-current">' + baseEsc + '</span>');

  // Галерея - ПОД большой картинкой, третьим элементом сетки героя. Раньше якорем
  // был «</div> сразу за героем», но между ними стоит заглушка img-placeholder,
  // совпадения не было, и срабатывал запасной вариант - полоса превью уезжала в
  // правую колонку над заголовком. Место в первой колонке задаёт CSS.
  if (!html.includes('data-gallery')) {
    html = html.replace(/(<div class="mp-info-col">)/, m => gallery + m);
    if (!html.includes('data-gallery')) {
      html = html.replace(/(<img[^>]*class="mp-hero-img"[^>]*>\s*<\/div>)/, m => m + gallery);
    }
  }
  // Секция версий - ВНИЗ страницы, перед блоком «Related 3D Models».
  // В функции замены '$1' - ЛИТЕРАЛ, а не подстановка группы: из-за этого
  // когда-то заголовок Specifications затирался строкой «$1» на 9158 страницах.
  // Поэтому и здесь замена только функцией.
  if (!html.includes('mp-versions-section')) {
    if (html.includes('<section class="mp-related-section">')) {
      html = html.replace('<section class="mp-related-section">', m => list + m);
    } else if (html.includes('</main>')) {
      html = html.replace('</main>', m => list + m);
    }
  }

  if (!html.includes('mp-versions-section')) return { ok: false, why: 'не нашёл, куда вставить секцию версий' };
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) return { ok: false, why: 'пострадало меню' };
  for (const b of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { return { ok: false, why: 'битый JSON-LD' }; }
  }
  return { ok: true, html, changed: html !== before };
}

// ── ход работы ──
const groups = [];
if (!ONLY || ONLY === 'manual') groups.push(...buildManualGroups());
if (!ONLY || ONLY === 'rootcat') groups.push(...buildRootCatGroups());
if (!ONLY || ONLY === 'root') groups.push(...buildRootGroups());
if (!ONLY || ONLY === 'identity') groups.push(...buildIdentityGroups());
if (!ONLY || ONLY === 'soft') groups.push(...buildGroups('soft'));
if (!ONLY || ONLY === 'color') groups.push(...buildGroups('color'));
// «Нулевой корень» - последним: он подбирает родство по имени там, где точные
// проходы выше уже разобрали свои семьи. Раньше он стоял вместе с настоящим
// корнем и перехватывал участников (см. комментарий у buildRootGroups).
if (!ONLY || ONLY === 'root0') groups.push(...buildRootGroups(true));
if (!ONLY || ONLY === 'collection') groups.push(...buildGroups('collection'));
// Геометрия - в самом конце: признак сильный, но грубее имени, и приоритет
// должен остаться за проходами, которые видят смысл названия.
if (!ONLY || ONLY === 'geo') groups.push(...buildGeoGroups());

// Один слаг не должен попасть в две группы: иначе он удаляется как вариант в первой,
// а во второй оказывается главным - и группа рушится на чтении несуществующего файла.
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
  + ', наборы ' + groups.filter(g => g.kind === 'collection').length
  + ', техника ' + groups.filter(g => g.kind === 'identity').length
  + ', по Root ID ' + groups.filter(g => g.kind === 'root').length
  + ', нулевой корень ' + groups.filter(g => g.kind === 'root0').length
  + ', корень+категория ' + groups.filter(g => g.kind === 'rootcat').length
  + ', по геометрии ' + groups.filter(g => g.kind === 'geo').length + ')');
console.log('страниц свернётся: ' + groups.reduce((s, g) => s + g.rest.length, 0));

// Список групп прохода для глазной проверки:  --dry --list identity 20
const li = process.argv.indexOf('--list');
if (li !== -1) {
  const kind = process.argv[li + 1] || 'identity';
  const n = +process.argv[li + 2] || 15;
  const gs = groups.filter(g => g.kind === kind).sort((a, b) => b.rest.length - a.rest.length);
  console.log('\nгрупп «' + kind + '»: ' + gs.length
    + ', свернётся ' + gs.reduce((s, g) => s + g.rest.length, 0));
  for (const g of gs.slice(0, n)) {
    console.log('\n[' + (g.rest.length + 1) + '] ' + g.base);
    for (const x of [g.main, ...g.rest]) console.log('    $' + x.price + '  ' + x.name);
  }
  process.exit(0);
}

if (SAMPLE) {
  const g = groups.find(x => x.main.slug === SAMPLE) || groups.find(x => x.rest.length >= 2);
  const b = buildBlocks(g);
  console.log('\nпример: «' + g.base + '»  главная ' + g.main.slug + '  вариантов ' + g.rest.length + '  снимков ' + b.shots);
  console.log('\n--- галерея ---\n' + b.gallery.slice(0, 700));
  console.log('\n--- список ---\n' + b.list);
  process.exit(0);
}

// Карту пишем ПО ХОДУ, а не в конце. 08.08.2026 прогон рухнул на середине, карта
// не записалась вовсе - и починить ссылки на уже удалённые страницы стало нечем.
let merged = 0, deleted = 0, skipped = 0; const reasons = {};
// Главные, которым список собран текущим прогоном. Пасс витрины ниже их пропускает:
// в --dry страницы не пишутся, и без этой пометки он посчитал бы их своими.
const mergedMains = new Set();
const MAP_FILE = path.join(ROOT, 'data', 'merged-variants.json');
// Карту читаем и в --dry: без неё сухой прогон не показывает, что с ней станет.
// Записи наружу не идут - flush при DRY ничего не делает.
const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
const flush = () => { if (!DRY) fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1)); };

// ── приведение карты в порядок ───────────────────────────────────────────────
// Карта копилась прогонами и никогда не чистилась. Правила выбора главной со
// временем менялись, и одна и та же пара записывалась в ОБЕ стороны: «black -> base»
// от старого прогона и «base -> black» от нового. Таких взаимных пар накопилось 392,
// а цепочек «вариант -> главная, которая сама уже свёрнута» - 5889.
//
// Вред не косметический. fix-catalog-json идёт по карте от ЖИВОЙ страницы, упирается
// во вторую половину взаимной пары (заглушку) и выбрасывает запись как свёрнутую -
// из каталога и поиска так пропали живые карточки. build-redirect-stubs спасала
// только собственная проверка «дошли до живой».
//
// Правило простое: ключ карты - это свёрнутый адрес. Если на диске по нему лежит
// НАСТОЯЩАЯ карточка, запись ложная и её быть не должно. Цепочки доводим до конечной
// живой страницы. Записи без живой цели оставляем как есть: по ним ещё строятся
// перенаправления, и удалить их значит превратить старый адрес в 404.
// Цель самой заглушки. Цепочка в карте бывает замкнутой: две заглушки записаны
// друг на друга, а живая страница, куда обе ведут НА ДИСКЕ, в карте не значится -
// её свёл другой проход. Ход только по карте упирается в цикл и возвращает null,
// запись остаётся смотреть на заглушку, и посетитель получает двойной переход,
// а canonical указывает на страницу-перенаправление. Таких главных 7.
function redirectOf(slug) {
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    return (h.match(/http-equiv="refresh" content="0; url=\/models\/([^"\/]+)\//) || [])[1] || null;
  } catch (e) { return null; }
}

function normalizeMap(m) {
  const cache = new Map();
  const real = s => { if (!cache.has(s)) cache.set(s, isRealCard(s)); return cache.get(s); };
  const resolve = s => {
    const seen = new Set();
    let cur = s;
    while (cur && !real(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const next = m[cur];
      // Карта в приоритете; когда она обрывается или заворачивает на уже пройденное,
      // спрашиваем саму заглушку, куда она перенаправляет.
      cur = (next && !seen.has(next)) ? next : redirectOf(cur);
    }
    return (cur && real(cur)) ? cur : null;
  };
  let dropped = 0, rewired = 0;
  for (const v of Object.keys(m)) {
    if (real(v)) { delete m[v]; dropped++; continue; }
    const dest = resolve(m[v]);
    if (dest && dest !== m[v]) { m[v] = dest; rewired++; }
  }
  if (dropped || rewired) console.log('карта до работы: убрано ложных ' + dropped + ', цепочек сведено ' + rewired);
}
normalizeMap(map);
for (const g of groups) {
  // Соответствие «вариант -> главная» записываем ДО попытки слияния и независимо
  // от её исхода. Иначе группы, уже объединённые прошлым прогоном, не попадут в
  // карту - а их варианты с диска удалены, и чинить ссылки на них будет нечем.
  // Главная должна быть НАСТОЯЩЕЙ карточкой, а не заглушкой. existsSync принимал
  // и заглушку - и группы, все участники которых уже свёрнуты прошлым прогоном по
  // другим правилам (таких 2547), писали в карту «вариант -> заглушка», а следом
  // падали на вставке списка. Именно так в карте и завелись взаимные пары: живая
  // страница получала запись «я свёрнута» в сторону заглушки, которая ведёт на неё же.
  const mainAlive = isRealCard(g.main.slug);
  if (mainAlive) for (const r of g.rest) map[r.slug] = g.main.slug;

  const res = mergeInto(g);
  // WHY=1 - вывести слаг каждой непрошедшей группы. Без этого причина «не нашёл,
  // куда вставить список» видна только счётчиком, и разбирать её не на чем.
  if (!res.ok) {
    skipped++; reasons[res.why] = (reasons[res.why] || 0) + 1;
    if (process.env.WHY) console.log('SKIP\t' + res.why + '\t' + g.main.slug);
    continue;
  }
  if (!DRY) fs.writeFileSync(path.join(MODELS, g.main.slug, 'index.html'), res.html);
  merged++; mergedMains.add(g.main.slug);
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

// ── витрина на карточках, объединённых прошлыми прогонами ────────────────────
// Группы собираются из выгрузки, а главной берётся первая ЖИВАЯ запись группы.
// Когда все записи группы уже свёрнуты прошлым прогоном в главную ИЗ ДРУГОЙ группы
// (порядок проходов со временем менялся), живой среди них нет - и группа падает с
// «главная уже свёрнута в заглушку», таких 2553. Само объединение при этом работает:
// посетитель с любого старого адреса попадает на живую карточку. Не хватает только
// списка вариантов НА НЕЙ - 1098 главных стоят без витрины.
//
// Поэтому состав берём не из группы, а из КАРТЫ: она знает всех свёрнутых и их
// главную, в том числе сведённых разными проходами. Трогаем только карточки БЕЗ
// блока: где список собран текущим прогоном, он полнее, и перебивать его нечем.
// Пасс общий по всей карте, а не по текущим группам, и трогает около 10 тысяч
// карточек. При точечном прогоне (--only) это посторонняя правка: она попадёт в
// тот же коммит, что и разбираемый проход, и разобрать потом, что откуда, будет
// нечем. Общий прогон её выполняет всегда, точечный - только по флагу --showcase.
let showcased = 0, showSkipped = 0; const showReasons = {};
if (!ONLY || process.argv.includes('--showcase')) {
  const byMain = new Map();
  for (const [v, mainSlug] of Object.entries(map)) {
    if (v === mainSlug) continue;
    if (!byMain.has(mainSlug)) byMain.set(mainSlug, []);
    byMain.get(mainSlug).push(v);
  }
  for (const [mainSlug, variants] of byMain) {
    if (mergedMains.has(mainSlug)) continue;
    const mainRow = rowFor(mainSlug);
    if (!mainRow) continue;
    let html;
    try { html = fs.readFileSync(path.join(MODELS, mainSlug, 'index.html'), 'utf8'); } catch (e) { continue; }
    // Раньше пропускали любую карточку с блоком. Но блок собирается из ГРУППЫ
    // прохода, а семья в карте бывает больше: у Volkswagen Baja Concept проход
    // manual перебрал список из двух строк поверх пяти, и три ссылки на листинги
    // TurboSquid со страницы пропали. Таких усечённых главных 971. Поэтому
    // сверяем длину: блок короче семьи - пересобираем.
    {
      // Версии теперь лежат нижней секцией карточками, а не боковым списком.
      const sec = html.match(/<section class="mp-related-section mp-versions-section">([\s\S]*?)<\/section>/);
      if (sec && (sec[1].match(/class="model-card card-glow mp-rc-link"/g) || []).length >= variants.length + 1) continue;
    }
    if (/http-equiv="refresh"/.test(html.slice(0, 400))) continue;
    const rest = variants.map(s => rowFor(s)).filter(x => x && x.slug !== mainSlug);
    if (!rest.length) continue;
    // Заголовок НЕ переписываем: он собран прошлым прогоном и уже верен. Берём его
    // же из H1 - тогда замена в mergeInto ничего не меняет. Обратное преобразование
    // мнемоник обязательно: mergeInto экранирует base заново, иначе «&amp;» на
    // странице превратится в «&amp;amp;».
    const h1 = (html.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1];
    const base = h1
      ? h1.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      : mainRow.name;
    const kind = isColl(mainRow.name) ? 'collection' : 'identity';
    const res = mergeInto({ base, main: mainRow, rest, kind });
    if (!res.ok) {
      showSkipped++; showReasons[res.why] = (showReasons[res.why] || 0) + 1;
      if (process.env.WHY) console.log('SHOW-SKIP\t' + res.why + '\t' + mainSlug);
      continue;
    }
    if (!DRY) fs.writeFileSync(path.join(MODELS, mainSlug, 'index.html'), res.html);
    showcased++;
  }
}
console.log('\nвитрина восстановлена на карточках: ' + showcased + (DRY ? '  (--dry)' : ''));
if (showSkipped) console.log('  без витрины осталось: ' + showSkipped + '  ' + JSON.stringify(showReasons));

// Индекс превью пополняем ДО выхода: страницы вариантов уже удалены, и в
// следующий прогон их og:image взять будет неоткуда.
if (!DRY && prevIdxAdded) {
  fs.writeFileSync(PREVIEW_INDEX, JSON.stringify(prevIdx));
  console.log('\nв индекс превью добавлено: ' + prevIdxAdded);
}

// ── уборка осиротевших блоков ───────────────────────────────────────────────
// Когда появился проход по технике, часть цветовых групп лишилась участников и
// исчезла. Их бывшие главные остались живы, но с блоком вариантов от прошлого
// прогона: заголовок «2025 Straight Truck», а во вкладке и крошках «…Blue».
// Снимаем блок и возвращаем имя из выгрузки.
// ВАЖНО: при --only в groups лежит лишь часть проходов, и «не входит в groups»
// перестаёт означать «осиротевший». Прогон `--only manual` 13.08 собрал 4 группы
// и снял блоки у 13 041 объединённой карточки - на сайте пропали все объединения.
// Поэтому: при --only уборку не делаем вовсе, а список главных берём не только
// из текущего прогона, но и из карты объединений, где записаны все главные.
if (!DRY && !ONLY) {
  const mains = new Set(groups.map(g => g.main.slug));
  for (const main of Object.values(map)) mains.add(main);
  let cleaned = 0;
  for (const slug of fs.readdirSync(MODELS)) {
    if (mains.has(slug)) continue;
    const file = path.join(MODELS, slug, 'index.html');
    let h;
    try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    // Чистим и старый боковой список, и нижнюю секцию: у страницы, переставшей
    // быть главной в группе, версий быть не должно ни в каком виде.
    if (!h.includes('<section class="mp-variants">') && !h.includes('mp-versions-section')) continue;
    const real = (bySlug.get(slug) || {}).name;
    if (!real) continue;
    const out0 = h.replace(/<div class="mp-gallery" data-gallery>[\s\S]*?<\/div><\/div>/g, '')
      .replace(/<section class="mp-variants">[\s\S]*?<\/section>/g, '')
      .replace(/<section class="mp-related-section mp-versions-section">[\s\S]*?<\/section>/g, '');
    const nameEsc = esc(real);
    const shortName = nameEsc.replace(/\s*\b3d\s+models?\s*$/i, '');
    let out = out0.replace(/<h1 class="mp-h1">[\s\S]*?<\/h1>/, '<h1 class="mp-h1">' + nameEsc + '</h1>')
      .replace(/<span class="mp-bc-current">[\s\S]*?<\/span>/, '<span class="mp-bc-current">' + nameEsc + '</span>')
      // Имя тоже может кончаться на «3D Model» - приклеивать хвост нельзя,
      // иначе слова копятся с каждым прогоном. Собираем заголовок заново.
      .replace(/<title>[\s\S]*?\s*3D Model([\s\S]*?)<\/title>/, (m, tail) => {
        const pr = (tail.match(/\$([\d.,]+)/) || [])[1];
        return '<title>' + shortName + ' 3D Model'
          + (pr ? ' - $' + pr : '') + ' | 3D Molier</title>';
      })
      .replace(/<meta property="og:title" content="[^"]*?\s*3D Model[^"]*"/,
        () => '<meta property="og:title" content="' + shortName + ' 3D Model | 3D Molier"');
    if (out === h) continue;
    if (!out.includes('<a href="/categories/other/" role="menuitem"')) continue;
    fs.writeFileSync(file, out);
    cleaned++;
  }
  if (cleaned) console.log('\nосиротевших блоков убрано: ' + cleaned);
}

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
