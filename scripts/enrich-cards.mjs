// enrich-cards.mjs — наращивание контента карточек моделей (основной шаблон).
//
// Что делает на каждой странице /models/<slug>/index.html:
//   1. Переписывает абзац «About This Model» — глубже, с реальными данными модели.
//   2. Добавляет таблицу Specifications.
//   3. Добавляет 4 вопроса-ответа (H2 + H3) — объём и цитируемость для AI-выдачи.
//   4. Вставляет Product + Offer JSON-LD.
//   5. Чинит рассинхрон после реклассификации: текст «Other» при другой категории.
//   6. preconnect к CDN превью, укороченный title, бамп версии CSS.
//
// Тексты живут в scripts/card-content.mjs (общий модуль с enrich-legacy-cards.mjs).
// Источник фактов: data/models_master.csv. Категория берётся из хлебной крошки самой
// страницы — она уже отражает реклассификацию, CSV в этой части устарел.
//
// НЕ публикуем: sales_qty, estimated_revenue, downloads, shopping_carts.
//
// Запуск:  node scripts/enrich-cards.mjs --dry --limit 20
//          node scripts/enrich-cards.mjs --all

import fs from 'node:fs';
import path from 'node:path';
import { esc, description, specTable, faqBlock, productSchema, dateLine, pageSchema } from './card-content.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
// Дата пересборки карточек. Менять ТОЛЬКО когда контент реально обновлён —
// иначе dateModified превращается в накрутку свежести.
const UPDATED_ISO = '2026-08-02';
const UPDATED_HUMAN = '2 August 2026';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = args.includes('--limit') ? +args[args.indexOf('--limit') + 1] : 0;

// ── 1. факты по моделям ───────────────────────────────────────────────────────
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}

const facts = new Map();
{
  const lines = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
  const H = lines[0].split(',');
  const c = n => H.indexOf(n);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const r = parseCsvLine(lines[i]);
    facts.set(r[c('product_id')], {
      cert: r[c('certification')], sub: r[c('subcategory')],
      industries: (r[c('industries')] || '').split('|').filter(Boolean),
      uses: (r[c('use_cases')] || '').split('|').filter(Boolean),
      keywords: (r[c('seo_keywords')] || '').split('|').filter(Boolean),
      days: +r[c('days_in_sales')] || 0,
    });
  }
}

// ── 2. карта slug -> текущая категория (для чипов в блоке Related) ────────────
// Сборка идёт по 86 869 файлам и занимает ~8 минут, поэтому кэшируется на диск.
// В кэше лежат только слаги с index.html, поэтому он же заменяет список папок:
// 86 869 вызовов fs.existsSync на этом диске сами по себе стоят минуты.
// После правок категорий (реклассификация, enrich-legacy-cards) — с --refresh-catmap.
const CATMAP = path.join(ROOT, 'scripts', '.catmap.json');
let catOf, dirs;
if (fs.existsSync(CATMAP) && !args.includes('--refresh-catmap')) {
  catOf = new Map(Object.entries(JSON.parse(fs.readFileSync(CATMAP, 'utf8'))));
  dirs = [...catOf.keys()];
  console.error('Карта категорий из кэша: ' + catOf.size + ' записей (--refresh-catmap чтобы пересобрать).\n');
} else {
  dirs = fs.readdirSync(MODELS).filter(d => fs.existsSync(path.join(MODELS, d, 'index.html')));
  catOf = new Map();
  const buf = Buffer.alloc(8192);
  let n = 0;
  for (const d of dirs) {
    let fd;
    try { fd = fs.openSync(path.join(MODELS, d, 'index.html'), 'r'); } catch { continue; }
    const read = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const m = buf.toString('utf8', 0, read).match(/"position":2,"name":"([^"]+)"/);
    if (m) catOf.set(d, m[1].replace(/&amp;/g, '&'));
    if (++n % 20000 === 0) console.error('  карта категорий: ' + n + '/' + dirs.length);
  }
  fs.writeFileSync(CATMAP, JSON.stringify(Object.fromEntries(catOf)));
  console.error('Карта категорий собрана и закэширована: ' + catOf.size + ' записей.\n');
}

// ── 3. обработка одной страницы ───────────────────────────────────────────────
function enrich(slug) {
  const file = path.join(MODELS, slug, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  // идемпотентность: прошлый прогон снимаем и собираем заново.
  // Границы блоков ищем по их собственным закрывающим тегам, а не по соседнему блоку:
  // после бага с $1 внутри таблицы мог оказаться посторонний фрагмент разметки.
  if (html.includes('mp-spec-block')) {
    html = html.replace(/\s*<div class="mp-spec-block">[\s\S]*?<\/tbody><\/table>\s*<\/div>/, '');
    html = html.replace(/\s*<div class="mp-faq-block">[\s\S]*?<\/p>\s*<\/div>/, '');
    if (html.includes('mp-spec-block') || html.includes('mp-faq-block')) return { skip: 'старые блоки не снялись' };
  }
  html = html.replace(/\s*<div class="mp-meta-line">[\s\S]*?<\/div>/, '');
  html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"@type":"ItemPage"[^]*?<\/script>\s*/, '');

  const id = (slug.match(/-(\d+)$/) || [])[1];
  const f = facts.get(id);
  if (!f) return { skip: 'нет данных в CSV' };

  const name = (html.match(/<h1 class="mp-h1">\s*([\s\S]*?)\s*<\/h1>/) || [])[1];
  const price = (html.match(/<span class="mp-price">\$([\d.]+)<\/span>/) || [])[1];
  const hero = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
  const tsUrl = (html.match(/href="(https:\/\/www\.turbosquid\.com\/3d-models\/[^"]+?)"/) || [])[1];
  const cat = catOf.get(slug);
  const catSlug = (html.match(/"position":2,"name":"[^"]+","item":"[^"]*\/categories\/([a-z0-9-]+)\//) || [])[1];
  if (!name || !price || !hero || !tsUrl || !cat || !catSlug) return { skip: 'не извлеклись поля' };

  const seed = +id;
  const clean = name.replace(/\s+/g, ' ').trim();
  const desc = description(f, clean, cat, price, seed);

  // ВАЖНО: во всех заменах ниже подставляем ФУНКЦИЮ, а не строку. В сгенерированном
  // тексте есть цены вида «$19», и в строке замены «$1» трактуется как ссылка на
  // первую группу регулярки — в результате в описание попадал кусок чужой разметки.
  const put = s => () => s;

  // 3.1 новое описание (заодно снимает рассинхрон «Other» после реклассификации)
  if (!/<p class="mp-desc-text">[\s\S]*?<\/p>/.test(html)) return { skip: 'не найден mp-desc-text' };
  html = html.replace(/<p class="mp-desc-text">[\s\S]*?<\/p>/, put('<p class="mp-desc-text">' + desc + '</p>'));

  // 3.2 заголовок блока Related — тоже мог остаться «More in Other»
  html = html.replace(/(<div class="section-label mp-mb8">More in )[^<]+(<\/div>)/, (m, a, b) => a + esc(cat) + b);

  // 3.3 чипы категорий на карточках Related — актуальная категория соседа
  html = html.replace(/<a href="\/models\/([a-z0-9-]+)\/" class="model-card card-glow mp-rc-link">([\s\S]*?)<\/a>/g,
    (block, relSlug) => {
      const rc = catOf.get(relSlug);
      if (!rc) return block;
      return block.replace(/(<span class="chip chip-teal mp-rc-chip">)[^<]*(<\/span>)/, '$1' + esc(rc) + '$2');
    });

  // 3.4 чип-ключевик «other» остался от старой классификации
  if (cat !== 'Other') {
    const kw = cat.toLowerCase().split(/[\s&]+/).filter(Boolean)[0];
    html = html.replace('<a href="/search/?q=other" class="chip chip--kw">other</a>',
      `<a href="/search/?q=${encodeURIComponent(kw)}" class="chip chip--kw">${esc(kw)}</a>`);
  }

  // 3.4.1 строка авторства и дат — сразу под абзацем About This Model
  const meta = dateLine(f, UPDATED_ISO, UPDATED_HUMAN);
  html = html.replace(/(<p class="mp-desc-text">[\s\S]*?<\/p>)/, m => m + '\n' + meta);
  if (!html.includes('mp-meta-line')) return { skip: 'строка дат не вставилась' };

  // 3.5 новые блоки: Specifications перед Use Cases, вопросы после Search Keywords
  const spec = specTable(f, clean, cat, catSlug, price);
  const faq = faqBlock(f, clean, cat, catSlug, price, tsUrl, seed);
  html = html.replace(/(\s*<div><div class="section-label mp-mb12">Use Cases<\/div>)/, m => '\n' + spec + m);
  html = html.replace(/(<div><div class="section-label mp-mb12">Search Keywords<\/div>[\s\S]*?<\/div><\/div>)/, m => m + '\n' + faq);
  if (!html.includes('mp-spec-block') || !html.includes('mp-faq-block')) return { skip: 'блоки не вставились' };

  // 3.6 Product JSON-LD — вставляем перед BreadcrumbList, если его нет
  const ps = productSchema({ name: clean, slug, id, hero, tsUrl, cat, price, desc, f, site: SITE });
  if (/"@type":"Product"/.test(html)) {
    html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"@type":"Product"[^]*?<\/script>/, put(ps));
  } else {
    html = html.replace(/(<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList")/, m => ps + '\n' + m);
  }
  if (!/"@type":"Product"/.test(html)) return { skip: 'схема не вставилась' };

  // 3.6.1 ItemPage: даты, автор, связь с Organization и WebSite
  const pgs = pageSchema({ name: clean, slug, cat, catSlug, desc, hero, f, site: SITE, updatedIso: UPDATED_ISO });
  html = html.replace(/(<script type="application\/ld\+json">\s*\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList")/, m => pgs + '\n' + m);
  // крошке нужен @id, на который ссылается ItemPage
  html = html.replace('{"@context":"https://schema.org","@type":"BreadcrumbList",',
    () => `{"@context":"https://schema.org","@type":"BreadcrumbList","@id":"${SITE}/models/${slug}/#breadcrumb",`);
  if (!/"@type":"ItemPage"/.test(html)) return { skip: 'ItemPage не вставился' };

  // 3.7 preconnect к CDN превью: 7 картинок карточки грузятся с p.turbosquid.com
  if (!html.includes('p.turbosquid.com" crossorigin')) {
    html = html.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
      '<link rel="preconnect" href="https://p.turbosquid.com" crossorigin>\n' +
      '<link rel="dns-prefetch" href="https://p.turbosquid.com">\n' +
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  }

  // 3.8 title: хвост «on TurboSquid» всё равно обрезался в выдаче — вместе с брендом
  html = html.replace(/(<title>[^<]*?) on TurboSquid<\/title>/, '$1</title>');

  // 3.9 футер: ссылки на юридические страницы. Аудит показал 0 ссылок на Privacy
  //     с карточек, а Trust — самый тяжёлый фактор E-E-A-T.
  if (!html.includes('mp-footer-legal')) {
    html = html.replace(/(<p class="mp-footer-copy">[\s\S]*?<\/p>)/, m => m +
      '\n      <div class="mp-footer-legal">' +
      '<a href="/about/">About</a> <a href="/contact/">Contact</a> ' +
      '<a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a></div>');
  }

  // 3.10 бамп версии CSS — добавлены стили .mp-spec-table / .mp-faq-* / .mp-footer-legal
  html = html.replace(/\.css\?v=33/g, '.css?v=34').replace(/\.js\?v=33/g, '.js?v=34');

  // 3.10 контроль: меню на месте
  if (!html.includes('<a href="/categories/other/" role="menuitem"')) return { skip: 'ПОСТРАДАЛО МЕНЮ' };

  return { html };
}

// ── 4. прогон ─────────────────────────────────────────────────────────────────
const targets = LIMIT ? dirs.slice(0, LIMIT) : dirs;
let ok = 0, skipped = 0; const reasons = {}; const t0 = Date.now();
for (let i = 0; i < targets.length; i++) {
  const slug = targets[i];
  let r;
  try { r = enrich(slug); } catch (e) { r = { skip: 'ошибка: ' + e.message.slice(0, 60) }; }
  if (r.skip) {
    skipped++; reasons[r.skip] = (reasons[r.skip] || 0) + 1;
    if (r.skip === 'ПОСТРАДАЛО МЕНЮ') { console.error('СТОП на ' + slug); process.exit(1); }
  } else {
    if (!DRY) fs.writeFileSync(path.join(MODELS, slug, 'index.html'), r.html);
    ok++;
  }
  if ((i + 1) % 10000 === 0) console.error('  ' + (i + 1) + '/' + targets.length + '  обогащено ' + ok + '  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' c)');
}
console.error('\nОбогащено: ' + ok + (DRY ? ' (--dry, файлы не записаны)' : '') + '   Пропущено: ' + skipped);
console.error(JSON.stringify(reasons, null, 1));
