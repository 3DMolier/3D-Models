/*
 * build-model-records.mjs - ОДНА ЗАПИСЬ НА МОДЕЛЬ.
 *
 * Этап 1 плана «Пересборка страниц из единой записи».
 *
 * ЗАЧЕМ. Правда о модели размазана по шести источникам, и они расходятся. Одна
 * и та же вещь, посчитанная в разных местах по-разному, за один день дала
 * четыре поломки, и ни одна не упала - все молчали. Здесь источники сводятся в
 * одну запись, и у КАЖДОГО поля назначен один хозяин. Если источники спорят,
 * побеждает хозяин, а спор попадает в отчёт - молчания больше нет.
 *
 * ХОЗЯЕВА ПОЛЕЙ
 *   id, slug      имя папки models/<slug> - единственный ключ. Адрес НИКОГДА
 *                 не вычисляется из названия: правило слагов в данных и на
 *                 диске расходится у 372 моделей.
 *   name, price,  models_master.csv - выгрузка из Excel, её ведёт основатель
 *   sales, days,  («цена только из Excel»)
 *   subcategory,
 *   use_cases,
 *   seo_keywords
 *   cert, date    product-report.json - отчёт TurboSquid
 *   ts_url        product-report.json (link) плюс наш реферальный код
 *   category      data/model-categories.json, имя - data/taxonomy.json
 *   industries    data/model-industries.json
 *   image         data/fc-img-chunk-*.json, запасной - data/preview-index.json
 *   specs,        выгрузка студии (studio-inventory-part-*.json),
 *   keywords      запасной - data/model-specs.json
 *   family        data/merged-variants.json - какие адреса свёрнуты сюда
 *   brand         scripts/lib/brands.mjs
 *   military      scripts/lib/military.mjs
 *
 * ВЫХОД
 *   data/records/records-NN.json  записи кусками по 5000
 *   data/records/index.json       сколько кусков, сколько записей, когда собрано
 *   data/records/conflicts.json   где источники разошлись
 *
 * Запуск:  node scripts/build-model-records.mjs --dry
 *          node scripts/build-model-records.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from './lib/csv.mjs';
import { brandOf, brandById } from './lib/brands.mjs';
import { isMilitary } from './lib/military.mjs';
import { classifyByReport } from './category-map.mjs';
import { parseDetails, num } from './lib/specs.mjs';
import { variantLabel, variantShortLabel } from './lib/variant-label.mjs';
import { familyName } from './lib/model-name.mjs';
import { attachRelated } from './build-related.mjs';
import { formatsFromFiles } from './lib/formats.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'records');
const DRY = process.argv.includes('--dry');
const DL = 'C:/Users/MSI-PC/Downloads/';
const CHUNK = 5000;
const REFERRAL = 'referral=3d_molier-international';

/*
 * Сертификация приходит из Excel через отчёт и тащит его мусор: у 2 180 моделей
 * там стоит «#Н/Д» - непроставленная формула, а не уровень. Плюс «Stemcell» с
 * маленькой буквы. Приводим к четырём допустимым значениям; всё непонятное
 * считаем отсутствием сертификата, а не выдумываем уровень.
 */
const CERT = ['CheckMate Pro', 'CheckMate Lite', 'StemCell'];
const normCert = v => {
  const t = String(v == null ? '' : v).trim();
  const hit = CERT.find(c => c.toLowerCase() === t.toLowerCase());
  return hit || 'no certification';
};

/*
 * «Данных нет» и «сертификата нет» - разные вещи.
 *
 * В отчёте TurboSquid у 3 763 моделей в этой графе стоит «#Н/Д»: формула не
 * посчиталась. Приравнять это к «нет сертификата» - значит снять значок с тех,
 * у кого он есть: 465 моделей потеряли бы StemCell на пустом месте, потому что
 * отчёт про них просто промолчал.
 *
 * Поэтому пустое и «#Н/Д» считаем молчанием и спрашиваем Excel.
 */
const certSilent = v => { const t = String(v == null ? '' : v).trim(); return !t || t.startsWith('#'); };

/*
 * КТО СВЕЖЕЕ, ТОТ И ХОЗЯИН.
 *
 * Решение основателя от 01.09.2026: при споре источников брать данные из того
 * файла, который новее. Это отменяет прежнее правило «цена только из Excel» -
 * оно было верным, пока выгрузка Excel была свежей.
 *
 * На сегодня: models_master.csv от 15.05.2026, product-report.json от
 * 27.08.2026. Отчёт новее на три с половиной месяца, поэтому имя, цена и
 * сертификация берутся из него, а из Excel - то, чего в отчёте нет вовсе:
 * продажи, дни в продаже, подкатегория, назначения, ключевые фразы.
 *
 * Даты берём у самих файлов, а не вписываем: следующая выгрузка Excel сделает
 * хозяином её, и никакой правки кода для этого не понадобится.
 */
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const CSV_FILE = path.join(DATA, 'models_master.csv');
const REPORT_FILE = path.join(DATA, 'product-report.json');
const CSV_NEWER = mtime(CSV_FILE) > mtime(REPORT_FILE);
const dt = f => new Date(mtime(f)).toISOString().slice(0, 10);

const t0 = Date.now();
const say = m => console.log(m);

// ── 1. ключ: живые папки ────────────────────────────────────────────────────
say('читаю папки карточек...');
const live = [];                                   // { id, slug }
const stubOf = new Map();                          // slug свёрнутой -> сама папка
for (const d of fs.readdirSync(MODELS)) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (!/^\d+$/.test(id)) continue;
  let head;
  try { head = fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8').slice(0, 400); }
  catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(head)) { stubOf.set(d, id); continue; }
  live.push({ id, slug: d });
}
say('живых карточек: ' + live.length.toLocaleString('ru-RU')
  + ', заглушек: ' + stubOf.size.toLocaleString('ru-RU'));

const byId = new Map(live.map(x => [x.id, { id: x.id, slug: x.slug }]));


/*
 * НОВЫЕ МОДЕЛИ. Студия выпускает их каждый месяц, и они должны попадать на сайт
 * без ручной работы. Запись собирается для них так же, как для остальных, но с
 * состоянием `new`: страницы ещё нет, её создаст генератор.
 *
 * ЗДЕСЬ ЕДИНСТВЕННОЕ МЕСТО, ГДЕ АДРЕС ВЫЧИСЛЯЕТСЯ. Правило простое: у новой
 * модели папки ещё нет, значит взять адрес неоткуда - его надо назначить. Но
 * назначается он ОДИН РАЗ, при создании, и дальше уже читается с диска, как у
 * всех прочих. Именно смешение этих двух вещей - «назначить один раз» и
 * «вычислять каждый раз» - дало за один день четыре поломки.
 *
 * Правило слага то же, по которому названы существующие 54 025 папок.
 */
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

say('ищу новые модели...');
{
  const f = path.join(DATA, 'new-products.json');
  let added = 0, already = 0, taken = 0;
  if (fs.existsSync(f)) {
    const np = JSON.parse(fs.readFileSync(f, 'utf8'));
    const usedSlug = new Set([...byId.values()].map(r => r.slug));
    for (const p of np) {
      const id = String(p.pid || p.id || '');
      if (!/^\d+$/.test(id)) continue;
      if (byId.has(id)) { already++; continue; }
      const slug = slugify(p.name || '') + '-' + id;
      // Столкновение адресов: если такой уже занят, страницу не создаём и
      // говорим об этом вслух - молча подменять чужой адрес нельзя.
      if (usedSlug.has(slug) || fs.existsSync(path.join(MODELS, slug))) { taken++; continue; }
      usedSlug.add(slug);
      byId.set(id, { id, slug, status: 'new', name: p.name || '', price: Number(p.price) || 0 });
      added++;
    }
  }
  say('новых моделей к созданию: ' + added
    + (already ? ', уже на сайте: ' + already : '')
    + (taken ? ', ПРОПУЩЕНО из-за занятого адреса: ' + taken : ''));
}

// ── 2. Excel: имя, цена, продажи, подкатегория, назначения, ключевые фразы ──
say('читаю models_master.csv...');
let csvRows = 0;
/*
 * Имя, цена и картинка по ЛЮБОМУ номеру, а не только по живым карточкам.
 * Свёрнутые варианты страницы не имеют, но остаются товарами на TurboSquid, и
 * галерея на странице-семье показывает именно их.
 */
const memberName = new Map(), memberPrice = new Map(), memberImg = new Map();
readCsv(fs.readFileSync(path.join(DATA, 'models_master.csv'), 'utf8'), row => {
  csvRows++;
  if (row.product_id) {
    if (row.product_name) memberName.set(row.product_id, row.product_name);
    if (row.price) memberPrice.set(row.product_id, Number(row.price) || 0);
  }
  const r = byId.get(row.product_id);
  if (!r) return;
  // Спорные поля - только если Excel свежее отчёта.
  if (CSV_NEWER) { r.name = row.product_name || ''; r.price = Number(row.price) || 0; }
  else { r.excel_name = row.product_name || ''; r.excel_price = Number(row.price) || 0; }
  r.sales = Number(row.sales_qty) || 0;
  r.days_in_sales = Number(row.days_in_sales) || 0;
  r.subcategory = row.subcategory || '';
  r.use_cases = (row.use_cases || '').split('|').map(s => s.trim()).filter(Boolean);
  /*
   * Из ключевых фраз срезаем служебные хвосты - ровно так, как это сделано на
   * живых страницах: там «1 euro coin espana 3d model» показано как «1 euro
   * coin espana», а «3d model download» как «download». Фраза с хвостом ещё и
   * не находится поиском по каталогу: он ищет по названию модели.
   */
  r.seo_keywords = (row.seo_keywords || '').split('|')
    .map(x => x.toLowerCase()
      .replace(/\b3d\s+models?\b/g, '')
      .replace(/\bfor\s+(games|film|vr|rendering|animation)\b/g, '')
      .replace(/\s+/g, ' ').trim())
    .filter(x => x.length > 2);
  r.csv_cert = row.certification || '';
  r.csv_category = row.category || '';
});
say('строк в Excel: ' + csvRows.toLocaleString('ru-RU'));

// ── 3. отчёт TurboSquid: сертификация, дата, ссылка на товар ────────────────
say('читаю product-report.json...');
{
  const rep = JSON.parse(fs.readFileSync(path.join(DATA, 'product-report.json'), 'utf8'));
  for (const p of rep) {
    if (p.pid) {
      if (p.name && !memberName.has(p.pid)) memberName.set(p.pid, p.name);
      if (p.price && !memberPrice.has(p.pid)) memberPrice.set(p.pid, Number(p.price) || 0);
    }
    const r = byId.get(p.pid);
    if (!r) continue;
    // Запасные имя и цена: у 1 130 живых карточек строки в Excel ещё нет -
    // это модели, вышедшие после последней выгрузки. Без запаса запись
    // осталась бы без названия и цены.
    if (!CSV_NEWER) { if (p.name) r.name = p.name; if (p.price) r.price = Number(p.price) || 0; }
    if (r.name === undefined) { r.name = p.name || ''; r.from_report = true; }
    if (r.price === undefined) r.price = Number(p.price) || 0;
    if (r.sales === undefined) r.sales = 0;
    /*
     * Отчёт новее, поэтому хозяин графы - он. Но если он молчит («#Н/Д»),
     * берём значение из Excel. Объединённую метку «CheckMate Lite/Pro» взять
     * нельзя: она не говорит, Pro это или Lite, а выбрать наугад - значит
     * заявить на карточке то, чего мы не знаем. Таких случаев среди молчания
     * отчёта сейчас нет ни одного.
     */
    r.cert = certSilent(p.cert) && r.csv_cert && !/Lite\/Pro/i.test(r.csv_cert)
      ? normCert(r.csv_cert)
      : normCert(p.cert);
    r.date = p.date || '';
    r.year = p.date ? Number(String(p.date).slice(0, 4)) : null;
    r.root = p.root || '';
    r.report_name = p.name || '';
    r.report_price = Number(p.price) || 0;
    // Ссылку строим сами: в отчёте она без реферального кода, а в Excel код
    // устарел (3d_molier-studio вместо 3d_molier-international).
    r.ts_url = 'https://www.turbosquid.com/3d-models/' + r.slug + '?' + REFERRAL;
  }
}

// ── 4. категория и отрасли ──────────────────────────────────────────────────
say('читаю категории и отрасли...');
{
  const cat = JSON.parse(fs.readFileSync(path.join(DATA, 'model-categories.json'), 'utf8'));
  const tax = JSON.parse(fs.readFileSync(path.join(DATA, 'taxonomy.json'), 'utf8')).categories;
  const nameOfCat = new Map(tax.map(c => [c.slug, c.name]));
  const ind = JSON.parse(fs.readFileSync(path.join(DATA, 'model-industries.json'), 'utf8'));
  for (const r of byId.values()) {
    /*
     * Категория из единого источника. У новых моделей её там ещё нет - их
     * никто не раскладывал, - поэтому для них спрашиваем отчёт TurboSquid.
     * Без этого все 1 073 новинки уехали бы в «Other» и там потерялись.
     * Как только модель попадёт в model-categories.json, источник победит.
     */
    r.category = cat[r.id] || (r.status === 'new' ? (classifyByReport(r.id, r.name || '') || 'other') : 'other');
    r.category_name = nameOfCat.get(r.category) || 'Other';
    r.industries = ind[r.id] || [];
  }
}

// ── 5. картинка ─────────────────────────────────────────────────────────────
say('читаю превью...');
{
  const img = new Map();
  for (const f of fs.readdirSync(DATA)) {
    if (!/^fc-img-chunk-\d+\.json$/.test(f)) continue;
    for (const [id, url] of Object.entries(JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')))) {
      if (!img.has(id)) img.set(id, url);
    }
  }
  // Запасной источник ключуется СЛАГОМ, а не номером.
  const prev = JSON.parse(fs.readFileSync(path.join(DATA, 'preview-index.json'), 'utf8'));
  for (const [id, url] of img) memberImg.set(id, url);
  /*
   * Главный снимок берём СО СТРАНИЦЫ, если она есть: он выбран вручную, а в
   * fc-img-chunk у той же модели лежит другой ракурс. Без этого пересборка
   * молча подменила бы кадр на 2 273 карточках.
   */
  const heroFile = path.join(DATA, 'model-hero.json');
  const heroPicked = fs.existsSync(heroFile) ? JSON.parse(fs.readFileSync(heroFile, 'utf8')) : {};
  for (const r of byId.values()) r.image = heroPicked[r.slug] || img.get(r.id) || prev[r.slug] || '';
  // Превью свёрнутых вариантов лежат в индексе по СЛАГУ - добираем их оттуда.
  for (const [sl, url] of Object.entries(prev)) {
    const fid = sl.slice(sl.lastIndexOf('-') + 1);
    if (/^\d+$/.test(fid) && !memberImg.has(fid)) memberImg.set(fid, url);
  }
}

// ── 6. измеренные характеристики и ключевые слова ───────────────────────────
say('читаю выгрузку студии...');
{
  let n = 0;
  for (const f of fs.readdirSync(DL)) {
    if (!/^studio-inventory-part-\d+\.json$/.test(f)) continue;
    const j = JSON.parse(fs.readFileSync(DL + f, 'utf8'));
    for (const [id, s] of Object.entries(j.result || {})) {
      const r = byId.get(id);
      if (!r) continue;
      n++;
      // Разбираем details СРАЗУ: размеры текстур и габариты нужны карточке, а
      // сырая строка не нужна никому. Раньше разбор делал отдельный импорт, и
      // потому полные характеристики были лишь у 1 475 моделей из 48 319.
      const det = parseDetails(s.details);
      const fmt = formatsFromFiles(s.files);
      r.specs = {
        polygons: num(s.polygons), vertices: num(s.vertices),
        geometry: s.geometry || '', rigged: s.rigged || '', animated: s.animated || '',
        textures: num(s.ntextures), unwrappedUVs: s.unwrapped_uvs || '',
        textureSizes: det.textureSizes, dimensions: det.dimensions,
        formats: fmt.formats || [], formatCount: fmt.count || null,
      };
      /*
       * Ключевые слова в выгрузке лежат ОДНОЙ СТРОКОЙ, а не списком: «Splashed
       * Out Liquid liquid splash fluid splash water splash…». Первый заход
       * проверял Array.isArray и получал 6 151 вместо 48 тысяч.
       * Режем по словам, отбрасываем повторы и служебные короткие обрывки.
       */
      const kwRaw = typeof s.keywords === 'string' ? s.keywords
        : (Array.isArray(s.keywords) ? s.keywords.join(' ') : '');
      let kw = kwRaw ? [...new Set(kwRaw.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2))] : [];
      if (!kw.length && Array.isArray(s.tags) && s.tags.length) kw = s.tags;
      // Предел 24, как на живых страницах. При 18 карточки теряли по несколько
      // слов, и это была потеря без причины: список приходит из источника.
      if (kw.length) r.keywords = kw.slice(0, 24);
      /*
       * Признаки из выгрузки, которых нет больше нигде.
       * origin_geometry_id - настоящий ключ «тот же меш», проставленный студией
       * у 70 295 моделей. Он точнее, чем сравнение полигонов и вершин, по
       * которому мы до сих пор искали варианты одной модели.
       * Форматов файлов в выгрузке НЕТ - поля files не существует. Значит,
       * сверить показанные форматы с источником по-прежнему нечем, и строки
       * Native/Formats остаются выведенными по названию.
       */
      r.geometry_id = s.origin_geometry_id || null;
      r.has_rig = !!s.has_rig;
      r.has_fur = !!s.has_fur;
      r.is_collection = !!s.is_collection;
      if (Array.isArray(s.modifications) && s.modifications.length) r.modifications = s.modifications;
    }
  }
  say('записей выгрузки сопоставлено: ' + n.toLocaleString('ru-RU'));
  // Запасные характеристики для новых моделей.
  const ms = JSON.parse(fs.readFileSync(path.join(DATA, 'model-specs.json'), 'utf8'));
  let extra = 0;
  for (const [id, s] of Object.entries(ms)) {
    const r = byId.get(id);
    if (!r || r.specs) continue;
    extra++;
    r.specs = {
      polygons: num(s.polygons), vertices: num(s.vertices),
      geometry: s.geometry || '', rigged: s.rigged || '', animated: s.animated || '',
      textures: num(s.textures), unwrappedUVs: s.unwrappedUVs || '',
      textureSizes: s.textureSizes || [], dimensions: s.dimensions || null,
      formats: s.formats || [], formatCount: s.formatCount || null,
    };
  }
  if (extra) say('характеристик из model-specs.json: ' + extra);
}

// Ключевые слова, снятые со страниц: они написаны фразами, а в выгрузке студии
// лежат отдельными словами. Собрать фразы из слов нельзя, а по фразам ищут.
const PAGE_KW = new Map(Object.entries(
  fs.existsSync(path.join(DATA, 'model-keywords.json'))
    ? JSON.parse(fs.readFileSync(path.join(DATA, 'model-keywords.json'), 'utf8'))
    : {}));

// Заголовки, снятые со страниц скриптом extract-display-names.mjs.
const DISPLAY_NAME = new Map(Object.entries(
  fs.existsSync(path.join(DATA, 'model-display-name.json'))
    ? JSON.parse(fs.readFileSync(path.join(DATA, 'model-display-name.json'), 'utf8'))
    : {}));

/*
 * Подтип и признак анимации, снятые со страниц.
 *
 * Подтип («Medicine», «Large Truck») есть у 1 097 карточек, которых нет ни в
 * Excel, ни в отчёте: их собирали прямо из выгрузки студии. Признак анимации
 * есть у 173. Ни того ни другого в источниках данных нет - только на страницах.
 */
const SUBTYPE = new Map(Object.entries(
  fs.existsSync(path.join(DATA, 'model-subtype.json'))
    ? JSON.parse(fs.readFileSync(path.join(DATA, 'model-subtype.json'), 'utf8'))
    : {}));
const ANIMATED = new Map(Object.entries(
  fs.existsSync(path.join(DATA, 'model-animated.json'))
    ? JSON.parse(fs.readFileSync(path.join(DATA, 'model-animated.json'), 'utf8'))
    : {}));

// ── 7. семья: какие адреса свёрнуты в эту карточку ──────────────────────────
say('читаю карту свёрнутых...');
{
  const map = JSON.parse(fs.readFileSync(path.join(DATA, 'merged-variants.json'), 'utf8'));
  const family = new Map();
  for (const [from, to] of Object.entries(map)) {
    if (!family.has(to)) family.set(to, []);
    family.get(to).push(from);
  }
  /*
   * Семья - это не просто список адресов. Галерее на карточке нужны у каждого
   * члена картинка, цена и подпись, иначе их пришлось бы искать по вторым
   * источникам прямо во время отрисовки. Собираем всё здесь, один раз.
   *
   * Имя и цена свёрнутого варианта живут в отчёте и в Excel по его СОБСТВЕННОМУ
   * номеру - страницы у него больше нет, но товар на TurboSquid остался, и
   * ссылка на него со страницы-семьи должна работать.
   */
  for (const r of byId.values()) {
    const slugs = family.get(r.slug) || [];
    r.family = slugs.map(sl => {
      const fid = sl.slice(sl.lastIndexOf('-') + 1);
      const nm = memberName.get(fid) || sl.replace(/-\d+$/, '').replace(/-/g, ' ');
      return {
        slug: sl, id: fid, name: nm,
        label: variantLabel(nm), short: variantShortLabel(nm),
        price: memberPrice.get(fid) || 0,
        image: memberImg.get(fid) || '',
        ts_url: 'https://www.turbosquid.com/3d-models/' + sl + '?' + REFERRAL,
      };
    });
    /*
     * Заголовок склеенной карточки - имя СЕМЬИ, а не имя главной модели.
     * Решение основателя: страница показывает всю группу, и обещать в
     * заголовке «Boeing 717-200 Hawaiian Airlines», когда внутри ещё пять
     * авиакомпаний, нельзя. Уже применено на 7 625 карточках, пересборка
     * обязана это сохранить.
     */
    /*
     * Заголовок берём СО СТРАНИЦЫ, если она есть. Вычислять его заново нельзя:
     * правило «оставить слова, общие для всех членов семьи» отрезает значимое -
     * «1903 Petrol Electric Autocar» превращалось в «1903 Electric Autocar», а
     * «20 ft ISO Container» в «ISO Container». Так вышло на 1 684 страницах.
     * Заголовки складывались годами и правились руками; это данные, а не вывод.
     * Вычисление остаётся для НОВЫХ моделей - у них страницы ещё нет.
     */
    r.display_name = DISPLAY_NAME.get(r.slug)
      || (r.family.length ? familyName(r.name, r.family.map(v => v.name)) : r.name);
  }
}

// ── галерея собственных снимков модели ──
/*
 * У 985 карточек галерея - это несколько снимков ОДНОЙ модели, а не её
 * варианты. Их адреса ведут на студийный сайт и восстановить их из выгрузки
 * нельзя: там другой вид адреса. Сняты со страниц в data/model-gallery.json
 * скриптом extract-gallery.mjs - см. его шапку, это временная мера до починки
 * студийного API.
 */
{
  const f = path.join(DATA, 'model-gallery.json');
  const gal = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  let n = 0, dropped = 0;
  for (const r of byId.values()) {
    let g = gal[r.slug];
    if (!g || !g.length) continue;
    /*
     * Отсеиваем то, что галереей не является. Снимали со старых страниц по
     * правилу «не turbosquid - значит студийный снимок», а у 171 семьи обложки
     * вариантов тоже лежат на студийном хосте. Такие адреса совпадают с
     * обложкой варианта или самой модели - по этому их и узнаём.
     *
     * Держать поле чистым важнее, чем кажется: страница рисуется из записи,
     * и обложка варианта, оставшаяся в галерее, показалась бы на странице
     * дважды. Когда страницы пересобраны, они несут признак data-kind, и
     * снятие само перестанет их подбирать - но запись должна быть верной уже
     * сейчас.
     */
    /*
     * Чистим ТОЛЬКО у карточек с семьёй. У обычной карточки первый снимок
     * галереи и есть главный кадр модели - живая страница показывает его
     * первой миниатюрой. Первая версия чистки этого не различала и срезала
     * первый кадр у 1 209 карточек.
     */
    const cover = (r.family || []).length
      ? new Set([r.image, ...r.family.map(v => v.image)].filter(Boolean))
      : new Set();
    const clean = g.filter(x => !cover.has(x.url));
    dropped += g.length - clean.length;
    if (clean.length) { r.gallery = clean; n++; }
  }
  say('карточек со своей галереей: ' + n.toLocaleString('ru-RU')
    + (dropped ? ', отсеяно обложек вариантов: ' + dropped.toLocaleString('ru-RU') : ''));
}

// ── ролик с канала ──────────────────────────────────────────────────────────
/*
 * Ролики лежат в журнале публикаций YouTube: дата, номер ролика, название,
 * номер модели и признак «уверенно опознана». Берём только уверенные и по
 * одному на карточку - самый свежий: пять почти одинаковых клипов подряд
 * читаются как мусор.
 *
 * Источник настоящий, поэтому снимать со страниц не нужно - в отличие от
 * заголовков и галерей.
 */
{
  const f = 'D:/Clode_Work_Folder/tools/youtube/publish-log.csv';
  let n = 0;
  if (fs.existsSync(f)) {
    const byModel = new Map();
    readCsv(fs.readFileSync(f, 'utf8'), row => {
      if (String(row.confident).toLowerCase() !== 'true') return;
      const id = String(row.model_id || '').trim();
      if (!id) return;
      if (!byModel.has(id)) byModel.set(id, []);
      byModel.get(id).push({ id: row.video_id, title: row.title, date: row.date });
    });
    for (const r of byId.values()) {
      const list = byModel.get(r.id);
      if (!list || !list.length) continue;
      list.sort((a, b) => (a.date < b.date ? 1 : -1));
      const top = list[0];
      // Название в журнале с хвостом « | 3D Molier International» - на странице
      // он лишний, там и так видно, чей канал.
      r.video = {
        id: top.id,
        title: String(top.title).replace(/\s*\|\s*3D Molier.*$/i, '').trim(),
        date: top.date,
        count: list.length,
      };
      n++;
    }
  }
  /*
   * Запасной источник - сама страница. У 25 карточек ролик на сайте есть, а в
   * журнале публикаций его нет: их привязывали руками. Журнал остаётся главным
   * (в нём есть дата и число роликов), страница добирает то, чего он не знает.
   */
  const pageVid = fs.existsSync(path.join(DATA, 'model-video-page.json'))
    ? JSON.parse(fs.readFileSync(path.join(DATA, 'model-video-page.json'), 'utf8'))
    : {};
  let fromPage = 0;
  for (const r of byId.values()) {
    if (r.video) continue;
    const v = pageVid[r.slug];
    if (!v || !v.id) continue;
    r.video = { id: v.id, title: v.title, date: '', count: 1 };
    fromPage++;
  }
  say('карточек с роликом: ' + (n + fromPage).toLocaleString('ru-RU')
    + (fromPage ? ' (из них со страниц: ' + fromPage + ')' : ''));
}

// ── 8. производные признаки ─────────────────────────────────────────────────
for (const r of byId.values()) {
  // Значения по умолчанию для 69 карточек, которых нет в отчёте TurboSquid:
  // без этого поле просто отсутствует в записи, и потребитель молча получает
  // undefined вместо значения.
  /*
   * «Побеждает свежий» значит «свежий, ЕСЛИ он о ней знает». Отчёт новее
   * Excel, но 71 живой модели в нём просто нет - и цена обнулялась, хотя в
   * Excel она есть. На странице Apple Monitors Collection стоит 29, а в
   * записи оказался ноль. Поэтому: сначала свежий, потом второй, и только
   * потом значение по умолчанию.
   */
  if (r.name === undefined && r.excel_name) r.name = r.excel_name;
  if (!r.price && r.excel_price) r.price = r.excel_price;
  if (r.name === undefined) r.name = r.slug.replace(/-\d+$/, '').replace(/-/g, ' ');
  if (r.price === undefined) r.price = 0;
  if (r.sales === undefined) r.sales = 0;
  if (r.days_in_sales === undefined) r.days_in_sales = 0;
  /*
   * Подтип: сперва Excel, потом снятый со страницы. У 1 097 карточек строки в
   * Excel нет вовсе, и без этого запаса строка «Type» пропала бы со страницы.
   */
  if (!r.subcategory) r.subcategory = SUBTYPE.get(r.slug) || '';
  if (r.subcategory === undefined) r.subcategory = '';
  // Признак анимации живёт только на странице - в источниках данных его нет.
  if (ANIMATED.get(r.slug)) r.animated = true;
  if (r.use_cases === undefined) r.use_cases = [];
  if (r.seo_keywords === undefined) r.seo_keywords = [];
  if (r.cert === undefined) r.cert = 'no certification';
  if (r.date === undefined) { r.date = ''; r.year = null; }
  if (r.root === undefined) r.root = '';
  if (r.ts_url === undefined) r.ts_url = 'https://www.turbosquid.com/3d-models/' + r.slug + '?' + REFERRAL;
  if (!r.status) r.status = 'live';
  r.brand = brandOf(r.name || '') || brandById(r.id) || null;
  r.military = isMilitary(r.name || '', r.category);
  r.licence = r.brand ? 'Editorial Uses Only (TurboSquid)' : 'Royalty Free (TurboSquid)';
  // Ключевые слова: со страницы, если она есть; иначе из выгрузки студии.
  const pk = PAGE_KW.get(r.slug);
  if (pk && pk.length) r.keywords = pk;
  if (!r.keywords) r.keywords = null;
  if (!r.specs) r.specs = null;
}

// ── 9. где источники разошлись ──────────────────────────────────────────────
const conflicts = { noCsv: [], noReport: [], noImage: [], price: [], name: [], cert: [] };
const CERT_SAME = (a, b) => String(a || '').toLowerCase().replace(/[^a-z]/g, '')
  === String(b || '').toLowerCase().replace(/[^a-z]/g, '');
for (const r of byId.values()) {
  if (r.from_report) conflicts.noCsv.push(r.slug);
  if (r.cert === undefined) conflicts.noReport.push(r.slug);
  if (!r.image) conflicts.noImage.push(r.slug);
  const exPrice = CSV_NEWER ? r.price : r.excel_price;
  if (r.report_price && exPrice && r.report_price !== exPrice) {
    conflicts.price.push({ slug: r.slug, excel: exPrice, report: r.report_price });
  }
  const exName = CSV_NEWER ? r.name : r.excel_name;
  if (r.report_name && exName && r.report_name !== exName) {
    conflicts.name.push({ slug: r.slug, excel: exName, report: r.report_name });
  }
  // «CheckMate Lite/Pro» в Excel - огрублённое значение, а не спор: точный
  // уровень знает только отчёт. Сравниваем лишь когда Excel называет уровень.
  if (r.cert && r.csv_cert && !/Lite\/Pro/i.test(r.csv_cert) && !CERT_SAME(r.cert, r.csv_cert)) {
    conflicts.cert.push({ slug: r.slug, report: r.cert, excel: r.csv_cert });
  }
  // Колонку category из Excel НЕ сравниваем: там сырая категория TurboSquid
  // («Toys and Games»), у нас своя таксономия из 26 категорий. Это разные
  // словари, а не расхождение.
}

say('');
say('ИСТОЧНИКИ: Excel ' + dt(CSV_FILE) + ', отчёт ' + dt(REPORT_FILE)
  + '  ->  хозяин спорных полей: ' + (CSV_NEWER ? 'Excel' : 'отчёт TurboSquid'));
say('РАСХОЖДЕНИЯ ИСТОЧНИКОВ');
say('  нет строки в Excel:          ' + conflicts.noCsv.length.toLocaleString('ru-RU'));
say('  нет строки в отчёте:         ' + conflicts.noReport.length.toLocaleString('ru-RU'));
say('  нет превью:                  ' + conflicts.noImage.length.toLocaleString('ru-RU'));
say('  цена Excel != отчёт:         ' + conflicts.price.length.toLocaleString('ru-RU'));
say('  имя Excel != отчёт:          ' + conflicts.name.length.toLocaleString('ru-RU'));
say('  сертификация Excel != отчёт: ' + conflicts.cert.length.toLocaleString('ru-RU'));
for (const k of ['price', 'cert']) {
  conflicts[k].slice(0, 3).forEach(x => say('     ' + k + ': ' + JSON.stringify(x)));
}

// ── 10. запись ──────────────────────────────────────────────────────────────
if (DRY) { say('\n(--dry, ничего не записано)  ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с'); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));

/*
 * Соседи для блока «похожие» - часть сборки, а не отдельный проход. Раньше это
 * был отдельный скрипт, и повторный запуск сборки молча стирал его работу.
 */
say('подбираю соседей...');
{
  const list = [...byId.values()];
  const { done, empty } = attachRelated(list);
  say('подборок: ' + done.toLocaleString('ru-RU') + ', пустых: ' + empty.toLocaleString('ru-RU'));
}

const all = [...byId.values()].sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
// Служебные поля, нужные только для сверки, в запись не кладём.
const clean = r => { const { csv_cert, csv_category, report_name, report_price, excel_name, excel_price, ...keep } = r; return keep; };
let chunks = 0;
for (let i = 0; i < all.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, 'records-' + chunks + '.json'),
    JSON.stringify(all.slice(i, i + CHUNK).map(clean)));
  chunks++;
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
  total: all.length, chunks, chunk_size: CHUNK, built: new Date().toISOString(),
}, null, 1));
fs.writeFileSync(path.join(OUT, 'conflicts.json'), JSON.stringify(conflicts, null, 1));

say('\nзаписано: ' + all.length.toLocaleString('ru-RU') + ' записей в ' + chunks + ' кусках');
say('  data/records/index.json, conflicts.json');
say('время: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
