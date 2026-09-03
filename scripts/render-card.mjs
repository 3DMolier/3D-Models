/*
 * render-card.mjs - СТРАНИЦА КАК ФУНКЦИЯ ОТ ЗАПИСИ.
 *
 * Этап 2 плана «Пересборка страниц из единой записи».
 *
 * ЗАЧЕМ. Сейчас одну карточку рисуют вразнобой: обвязку копирует
 * build-new-cards.mjs, содержимое собирает card-content.mjs, поверх ходит
 * apply-card-upgrade.mjs, а расхождения потом чинят двенадцать правил
 * apply-taxonomy.mjs. Категория в таблице и категория в ответе FAQ - это
 * ДВА разных места, поэтому они и разъезжались.
 *
 * Здесь всё рисуется из одной записи. «В таблице одно, в ответе другое»
 * становится невозможным по построению: значение берётся из одного поля.
 *
 * ЧТО ЭТОТ МОДУЛЬ НЕ ДЕЛАЕТ. Не пишет файлы и не ходит по каталогу models.
 * Он чистый: запись на входе, строка HTML на выходе. Запись файлов - дело
 * этапа 3, где сборка идёт в теневую папку и сравнивается с нынешней.
 *
 * ИСПОЛЬЗУЕТ. card-content.mjs - там выверенные тексты: правила PBR, лицензия
 * по бренду, военные обороты, американское написание. Переписывать их заново
 * значило бы завести второй экземпляр той же логики, то есть ровно ту беду,
 * от которой мы уходим.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  esc, catSlug, description, specTable, faqBlock, dateLine, pageSchema, productSchema,
} from './card-content.mjs';
import { INDUSTRY_NAME, useLabel } from './lib/industries.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SITE = 'https://3dmolierstudio.com';

// ── обвязка: шапка и подвал из единственного источника ──────────────────────
// Правило репо: хедер и футер правятся только в partials/. Читаем их оттуда,
// а не копируем из соседней карточки, как делал build-new-cards.mjs.
const HEADER = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8').trim();
const FOOTER = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim();

// Метка версии стилей - из главной страницы. Зашитое число возвращалось при
// каждой пересборке и отправляло посетителю старые стили; так уже трижды было.
const ASSET_V = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/styles\.min\.css\?v=(\d+)/) || [, '1'])[1];

/*
 * Дата обновления страниц. Берётся из файла, а не из «сегодня»: иначе каждый
 * прогон переписывал бы все 54 тысячи страниц новой датой, даже если в них
 * ничего не изменилось, - и сборка перестала бы быть воспроизводимой.
 * Двигать её надо осознанно, когда содержимое действительно поменялось.
 * Сейчас на всех живых страницах стоит 2026-08-20 - день последней правки.
 */
const SITE_UPDATED = (() => {
  const f = path.join(ROOT, 'data', 'site-updated.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).updated;
  return '2026-08-20';
})();
const SITE_UPDATED_HUMAN = new Date(SITE_UPDATED)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Запись -> объект `f`, который понимает card-content.mjs.
 * Это единственное место перевода: дальше по коду поля записи не встречаются.
 */
export function toContentFields(r) {
  const s = r.specs || null;
  return {
    cert: r.cert || '',
    days: r.days_in_sales || 0,
    // Настоящая дата публикации из отчёта TurboSquid. Ей верят и проза, и
    // разметка, и строка «On sale since» - вместо вычисления по дням в продаже.
    published: r.date || '',
    // Признак анимации: снят со страниц, в источниках данных его нет.
    animated: !!r.animated,
    // Отрасли отдаём СЛАГАМИ - ровно так, как они лежат в записи. Подписи
    // выводит card-content через industriesOf; переводить их здесь значило бы
    // завести второе место, где решается, как называется отрасль.
    industries: r.industries || [],
    keywords: r.keywords && r.keywords.length ? r.keywords : (r.seo_keywords || []),
    sub: r.subcategory || '',
    // Назначения выводятся из отраслей и категории, а не из колонки Excel:
    // на карточке это «film & TV VFX», «game assets», а в Excel лежат
    // «visualization», «advertising» - другой словарь и другой смысл.
    uses: (r.industries || []).map(i => useLabel(i, r.category)).filter(Boolean),
    // card-content ищет среди вариантов слово rigged, значит ждёт СПИСОК имён,
    // а не их количество. Отдаём имена членов семьи.
    variants: (r.family || []).map(v => v.name),
    specs: s ? {
      polygons: s.polygons, vertices: s.vertices, geometry: s.geometry,
      textures: s.textures, textureSizes: s.textureSizes || [],
      unwrappedUVs: s.unwrappedUVs || '', dimensions: s.dimensions || '',
    } : null,
  };
}

/*
 * Показываемый снимок. У новой модели превью может ещё не быть - студийный сайт
 * чинится. Пустой src заставляет браузер запросить саму страницу вместо
 * картинки, а пустой og:image это негодная разметка. Ставим заглушку сайта.
 */
export const heroImg = r => r.image || PLACEHOLDER;

/*
 * Уменьшенная копия студийного снимка.
 *
 * ЗАЧЕМ. Студия отдаёт кадр 1200x1200 весом 303 КБ. Им же рисовалась миниатюра
 * галереи размером 108 пикселей - и так двенадцать раз на странице: около
 * 3,9 МБ картинок ради полосы превью. Посетитель на телефоне платит за это
 * трафиком и ожиданием, а видит те же 108 пикселей.
 *
 * У студии есть готовые копии по высоте: h100 (2 КБ), h200 (5 КБ), h400
 * (12 КБ). Больших нет - h500 и выше отдают 404, проверено.
 *
 * ЧТО КУДА:
 *   главный снимок  - ОРИГИНАЛ. Это продающая картинка над сгибом, ей нужна
 *                     резкость, и h400 на экране с двойной плотностью мылит;
 *   миниатюры       - h200: показываются в 108 пикселей, запас двукратный;
 *   плитки соседей
 *   и версий        - h400: показываются около 220x150;
 *   увеличенный вид - ОРИГИНАЛ, он грузится только по щелчку.
 *
 * Чужих адресов (TurboSquid, i.ytimg) не трогаем: у них таких копий нет.
 */
const STUDIO = 'https://www.3dmolier-studio.com/assets/';
export const studioSize = (url, tag) => {
  const u = String(url || '');
  if (!u.startsWith(STUDIO)) return u;
  return 'https://www.3dmolier-studio.com/images/' + tag + '/assets/' + u.slice(STUDIO.length);
};


/*
 * Описание приходит одной строкой, а на странице оно тремя абзацами: сплошной
 * текст на десять предложений никто не читает. Режем по границам предложений на
 * три примерно равные части - ровно так это выглядит на живых страницах.
 *
 * Точку внутри чисел и сокращений не трогаем: делим только там, где за точкой
 * идёт пробел и заглавная буква.
 */
export function descParagraphs(text, per = 3) {
  const sentences = String(text).split(/(?<=\.)\s+(?=[A-Z0-9])/).filter(Boolean);
  /*
   * По три предложения в абзаце - так разбиты живые страницы: шесть
   * предложений дают два абзаца, одиннадцать - четыре. Прежнее правило «всегда
   * три абзаца» расходилось с живыми на 15% страниц.
   * Остаток из одного предложения не оставляем отдельным абзацем: он читается
   * как оборванная мысль. Его добирает предыдущий.
   */
  const out = [];
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per));
  if (out.length > 1 && out[out.length - 1].length < 2) {
    const tail = out.pop();
    out[out.length - 1].push(...tail);
  }
  return out.map(g => '<p class="mp-desc-text">' + g.join(' ') + '</p>').join('');
}

/** Показываемое имя: у склеенной карточки - имя семьи, у обычной - своё. */
export const nm = r => r.display_name || r.name;

/** Устойчивое число из строки: одна и та же запись всегда даёт один вариант. */
export const seedOf = s => {
  let h = 0;
  const v = String(s);
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  return h;
};

/** Голова страницы: заголовок, соцразметка, стили, разметка schema.org. */
export function head(r, desc, schema) {
  const url = SITE + '/models/' + r.slug + '/';
  /*
   * «3D Model» приписываем, только если его нет в самом названии. Иначе
   * получалось «1 Euro Coin Espana 3D Model 3D Model» - у 18 страниц из
   * пятисот в выборке, то есть примерно у двух тысяч по каталогу.
   */
  const base0 = nm(r);
  const base = /3d\s+models?\s*$/i.test(base0) ? base0 : base0 + ' 3D Model';
  const title = base + (r.price ? ' - $' + r.price : '') + ' | 3D Molier';
  const social = base + ' | 3D Molier';
  const short = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155);
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(short)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(social)}">
<meta property="og:description" content="${esc(short)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="3D Molier Models">
<meta property="og:image" content="${esc(heroImg(r))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(social)}">
<meta name="twitter:description" content="${esc(short)}">
<meta name="twitter:image" content="${esc(heroImg(r))}">
<link rel="preconnect" href="https://p.turbosquid.com" crossorigin>
<link rel="dns-prefetch" href="https://p.turbosquid.com">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<link rel="preload" href="/assets/fonts/font-13.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/css/model-pages.min.css?v=${ASSET_V}">
<link rel="stylesheet" href="/assets/css/fonts.css?v=${ASSET_V}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/assets/css/fonts.css?v=${ASSET_V}"></noscript>
${schema}
</head>`;
}


const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';

/**
 * Первый экран: крупный снимок, галерея вариантов, название, цена, кнопки.
 *
 * Галерея строится из семьи модели - тех вариантов, что свёрнуты в эту
 * карточку. Их картинки и подписи лежат в записи, выводить их здесь заново не
 * нужно: подпись «Swimming Pose» решается один раз, в lib/variant-label.mjs.
 */
export function hero(r) {
  const alt = esc(nm(r)) + ' 3D model preview';
  // Первым в галерее идёт сама модель, дальше варианты.
  /*
   * Галерея бывает двух родов, и они не смешиваются:
   *   у склеенной карточки это ВАРИАНТЫ модели - у каждого своя цена и ссылка;
   *   у обычной - несколько снимков ОДНОЙ модели, снятых студией.
   * Второй род есть у 985 карточек, и его адреса лежат в записи отдельным
   * полем: восстановить их из выгрузки нельзя, см. extract-gallery.mjs.
   */
  /*
   * Каждому кадру проставляем происхождение: «own» - снимок самой модели,
   * «variant» - обложка варианта из семьи. Это нужно снимающей стороне.
   * Раньше extract-gallery.mjs отличал их по хосту: «не turbosquid - значит
   * снял студию». У 171 семьи обложки вариантов тоже лежат на студийном
   * хосте, и следующее снятие затянуло бы их в галерею модели. На третьей
   * сборке они появились бы на странице дважды - и так каждый круг.
   * Признак в разметке снимает догадку: страница сама говорит, что есть что.
   */
  /*
   * У снимков самой модели подписи нет - и не надо её выдумывать.
   *
   * Генератор подставлял «View», и под каждым из двенадцати кадров стояло одно
   * и то же слово. Это не подпись, а шум: оно не отличает кадры друг от друга и
   * ничего не сообщает. На живых страницах подписей у таких галерей нет вовсе.
   * Настоящая подпись есть ровно у двух снимков во всей базе - их оставляем.
   *
   * У вариантов семьи всё наоборот: «Standard», «Rigged», «Red» различают
   * товары с разной ценой, и они на живых страницах есть. Их не трогаем.
   */
  const ownShots = (r.gallery || []).map(g => ({
    image: g.url, short: g.cap || '', label: g.cap || '',
    price: r.price, ts_url: r.ts_url, kind: 'own',
  }));

  /*
   * Раньше семья и своя галерея исключали друг друга: есть варианты - свои
   * снимки не показываем. У двух карточек это стоило бы настоящего студийного
   * кадра. Теперь варианты идут первыми, а свои снимки добавляются следом -
   * кроме тех, что и так являются обложкой варианта или самой модели.
   */
  const shots = (r.family || []).length
    ? (() => {
      const cover = new Set([heroImg(r), ...r.family.map(v => v.image)].filter(Boolean));
      return [{ image: heroImg(r), short: 'Standard', label: 'Standard', price: r.price, ts_url: r.ts_url, kind: 'variant' }]
        .concat(r.family.filter(v => v.image).map(v => ({ ...v, kind: 'variant' })))
        .concat(ownShots.filter(s => !cover.has(s.image)));
    })()
    : ownShots;

  /*
   * Не больше двенадцати миниатюр. Это правило жило только в merge-variants.mjs
   * и build-new-cards.mjs, и генератор о нём не знал: у 272 карточек полоса
   * выросла бы до 19 кадров. Обоснование там же, в старом коде: в серии бывает
   * и 44 выпуска, полоса разъезжается, а страница тяжелеет впустую - каждая
   * миниатюра это ещё одна картинка. Полный список вариантов остаётся ниже,
   * в блоке версий, так что ничего не теряется.
   */
  const shown = shots.slice(0, 12);

  /*
   * Подпись выводим только настоящую. У кадров самой модели её нет, и
   * придуманное «View» не должно просочиться ни в data-cap (оттуда его берёт
   * увеличенный вид), ни в title, ни в alt. Вместо него доступное имя -
   * «название, кадр N»: оно хотя бы различает кадры для чтения с экрана.
   */
  const thumbs = shown.length > 1 ? shown.map((v, i) => {
    const named = v.label ? esc(v.label) : esc(nm(r)) + ', view ' + (i + 1);
    return `<button type="button" class="mp-gal-thumb${i ? '' : ' is-on'}" data-kind="${v.kind}" data-full="${esc(v.image)}"`
    + (v.label ? ` data-cap="${esc(v.label)}"` : '')
    + ` data-price="${esc('$' + (v.price || r.price))}"`
    + ` data-link="${esc(v.ts_url)}" title="${named}" aria-label="${named}">`
    // Миниатюра - уменьшенная копия. Полный кадр остаётся в data-full: его
    // берёт увеличенный вид, и грузится он только по щелчку.
    + `<img src="${esc(studioSize(v.image, 'h200'))}" alt="${named}" width="200" height="113"`
    + ` loading="lazy" decoding="async">`
    + (v.short ? `<span class="mp-gal-lbl">${esc(v.short)}</span>` : '')
    + `</button>`;
  }).join('') : '';

  /*
   * Строка над полосой показывает подпись выбранного кадра. У галереи без
   * вариантов подписывать нечего, и на живых страницах этой строки там нет -
   * она пришла из карточек с вариантами вместе с чужим словом «Standard».
   */
  const hasLabels = shown.some(v => v.short);

  const gallery = thumbs
    ? `<div class="mp-gallery" data-gallery>`
      + (hasLabels ? `<div class="mp-gal-cap" data-gal-cap>Standard</div>` : '')
      + `<div class="mp-gal-strip">${thumbs}</div></div>`
    : '';

  // Пять - тот же предел, что и в остальных местах (MAX_INDUSTRIES). Без него
  // в первом экране печаталось больше чипов, чем в таблице и в Use Cases.
  const inds = (r.industries || []).slice(0, 5);
  const industries = inds.length
    ? `<div class="mp-industries"><div class="mp-field-label">Used In</div><div class="mp-chip-row">`
      + inds.map(s => `<a href="/industries/${s}/" class="chip chip--sm">${INDUSTRY_NAME[s] || s}</a>`).join('')
      + `</div></div>`
    : '';

  return `<section class="mp-hero-section"><div class="max-w-7xl mx-auto"><div class="mp-hero-grid">`
    + `<div class="hero-img-frame mp-hero-frame">`
    + `<img src="${esc(heroImg(r))}" alt="${alt}" width="1200" height="675" decoding="async"`
    + ` loading="eager" fetchpriority="high" class="mp-hero-img"`
    + ` data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)">`
    + `<div class="img-placeholder mp-placeholder"><span class="mp-placeholder-icon">&#128247;</span>`
    + `<span class="mp-placeholder-cat">${esc(r.category_name)}</span></div></div>`
    + gallery
    + `<div class="mp-info-col">`
    /*
     * Разметка шапки взята с живой страницы: бирюзовый чип категории и
     * отдельный значок сертификата. Своя разметка выглядела бы иначе на
     * 54 тысячах страниц сразу, а задача пересборки - сохранить вид.
     */
    + `<div class="mp-badge-row">`
    + `<a href="/categories/${r.category}/" class="chip chip-teal chip--sm">${esc(r.category_name)}</a>`
    + (r.cert && r.cert !== 'no certification'
      ? `<span class="cert-badge">&#10003;&nbsp;${esc(r.cert)}</span>` : '')
    + `</div>`
    + `<h1 class="mp-h1">${esc(nm(r))}</h1>`
    + `<div class="mp-price-row"><span class="mp-price">$${r.price}</span>`
    + `<span class="mp-price-label">USD on TurboSquid</span></div>`
    + `<div class="mp-ctas">`
    + `<a href="${esc(r.ts_url)}" target="_blank" rel="noopener" class="btn-primary mp-btn-center">Buy on TurboSquid</a>`
    + `<a href="/categories/${r.category}/" class="btn-ghost mp-btn-browse">Browse ${esc(r.category_name)} Models</a>`
    + `</div>`
    + industries
    + `</div></div></div></section>`;
}

/**
 * Две колонки: слева описание, вопросы и ключевые слова, справа характеристики
 * и кнопка покупки.
 *
 * Кнопка покупки стоит ВНУТРИ правой колонки, под характеристиками. Снаружи, под
 * обеими колонками, она висела в широкой пустой полосе - левая колонка почти
 * всегда короче правой.
 */
/*
  * faqHtml приходит снаружи, а не считается здесь: тот же самый блок уходит в
  * разметку FAQPage. Считать его дважды значит допустить, что однажды они
  * разойдутся - а разметка, обещающая поисковику вопрос, которого на странице
  * нет, нарушает его правила.
  */
export function details(r, f, seed, faqHtml) {
  /*
    * Слаг категории берём ИЗ ЗАПИСИ. Выводить его из подписи нельзя: у
    * «Model Bundles & Sets» правило даёт model-bundles-sets, а раздел
    * называется collections-sets, и ссылка вела бы в 404.
    */
   const cs = r.category;
  const desc = description(f, nm(r), r.category_name, r.price, seed, cs);
  const kw = f.keywords && f.keywords.length
    ? `<div class="mp-kw-block"><div class="section-label mp-mb12">Keywords</div><div class="mp-chip-row">`
      + f.keywords.slice(0, 24).map(k =>
        `<a href="/catalog/?q=${encodeURIComponent(k)}" class="chip chip--kw">${esc(k)}</a>`).join('')
      + `</div></div>`
    : '';

  return `<section class="mp-details-section"><div class="max-w-7xl mx-auto"><div class="mp-details-grid">`
    + `<div class="mp-details-left">`
    + `<div class="section-label mp-mb12">About This Model</div>`
    + descParagraphs(desc)
    /*
     * Строка «By … · Published … · Updated …». Её в генераторе не было вовсе:
     * страница теряла и указание автора, и даты - то, по чему поисковик судит
     * о свежести материала.
     */
    + dateLine(f, SITE_UPDATED, SITE_UPDATED_HUMAN, r.date)
    // Ролик стоит перед вопросами - как на живых страницах.
    + videoBlock(r)
    + faqHtml
    + kw
    + `</div>`
    + `<div class="mp-sidebar-col"><div class="mp-spec-card">`
    // Таблица, а не сетка: сетку карточка использует только в узкой раскладке,
    // а на живых страницах стоит таблица характеристик.
    + specTable(f, nm(r), r.category_name, cs, r.price,
      { brand: r.brand, hideIndustryRows: true, selfName: r.name })
    /*
     * «Use Cases» - подписи назначений рядом с характеристиками. Ссылка ведёт в
     * отрасль, а подпись показывает, ЧТО с моделью делают: у отрасли
     * «architecture» это «interior visualization». Обе стороны берутся из
     * одного места - отраслей в записи, поэтому разойтись не могут.
     */
    + (f.uses.length
      ? '<div><div class="section-label mp-mb12">Use Cases</div><div class="mp-chip-row-8">'
        + r.industries.map((ind, i) => f.uses[i]
          ? '<a href="/industries/' + ind + '/" class="chip chip--sm">' + esc(f.uses[i]) + '</a>' : '').join('')
        + '</div></div>'
      : '')
    + `</div>`
    + `<a href="${esc(r.ts_url)}" target="_blank" rel="noopener" class="btn-ts-lg mp-btn-full">Buy on TurboSquid</a>`
    + `</div>`
    + `</div></div></section>`;
}

/** Хлебные крошки. Категория здесь та же, что в таблице - поле одно. */
export function breadcrumbs(r) {
  /*
   * Классы здесь не украшение, а раскладка. У обёртки должен быть mp-bc-inner:
   * именно он даёт flex, отступы и перенос строки. У ссылки «Home» класс
   * mp-bc-link, а не bc-link - такого правила в стилях нет вовсе, ссылка
   * осталась бы синей и подчёркнутой. Обе описки задели бы все 54 025 страниц,
   * и сверка их не поймала: она сличала содержимое, а не имена классов.
   */
  return `<div class="mp-bc-bar"><div class="max-w-7xl mx-auto px-6 py-3 mp-bc-inner">`
    + `<a href="/" class="mp-bc-link">Home</a><span class="mp-bc-sep">&#8250;</span>`
    + `<a href="/categories/${r.category}/" class="mp-bc-link">${esc(r.category_name)}</a>`
    + `<span class="mp-bc-sep">&#8250;</span><span class="mp-bc-current">${esc(nm(r))}</span>`
    + `</div></div>`;
}

/*
 * Нижний блок «сделаем на заказ». Разметка взята с живой страницы: свои классы
 * означали бы, что на 54 тысячах страниц блок вдруг выглядит иначе.
 */
export const ctaSection = () => `<section class="mp-cta-section"><div class="mp-cta-inner">`
  + `<div class="mp-cta-card"><div class="mp-cta-text">`
  + `<div class="section-label mp-mb8">Custom Order</div>`
  + `<h2 class="mp-cta-heading">Need a similar custom 3D model?</h2>`
  + `<p class="mp-cta-desc">Get a model built to your exact specifications - dimensions, file format, `
  + `topology, rigging or any technical requirement. Professional delivery within agreed timelines.</p>`
  /*
   * Кнопка ровно та же, что на живых страницах: класс mp-cta-btn держит её в
   * одну строку и не даёт сжиматься (white-space: nowrap, flex-shrink: 0), а
   * подпись со стрелкой стоит на 10 623 карточках. Без класса кнопка
   * переносилась бы посреди слова, а подпись я подменил бы по своему вкусу -
   * пересборка не должна менять то, о чём её не просили.
   */
  + `</div><a href="/custom-order/" class="btn-primary mp-cta-btn">Request Custom Model &#8594;</a></div></div></section>`;

/** Скрипты в конце страницы. */
export const scripts = () => `<script src="/assets/js/site.min.js?v=${ASSET_V}" defer></script>`
  + `<script src="/assets/js/model-page.min.js?v=${ASSET_V}" defer></script>`;



/** Карточка внутри блоков «версии» и «похожие». */
function relatedCard({ href, image, title, badge, chip, price, external }) {
  const tail = external ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${esc(href)}"${tail} class="model-card card-glow mp-rc-link">`
    + `<div class="img-wrap mp-rc-img-wrap">`
    // Плитка показывается около 220x150 - берём копию h400, она и на экране
    // с двойной плотностью резкая, а весит 12 КБ вместо 303 КБ.
    + `<img src="${esc(studioSize(image, 'h400'))}" alt="${esc(title)}" width="800" height="450" decoding="async"`
    + ` loading="lazy" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)">`
    + `<div class="img-placeholder" aria-hidden="true"><span class="mp-rc-placeholder-icon">&#128247;</span></div>`
    + `</div><div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(title)}`
    + (badge ? ` <span class="mp-var-badge">${esc(badge)}</span>` : '')
    + `</div></div><div class="mp-rc-foot">`
    + `<span class="chip chip-teal mp-rc-chip mp-ver-chip">${esc(chip)}</span>`
    + `<span class="mp-rc-price">$${price}</span></div></div></a>`;
}

/**
 * «Все версии этой модели». Строится из семьи: сама модель первой с пометкой
 * main, затем свёрнутые варианты. Ссылки ведут на TurboSquid - у вариантов
 * своей страницы больше нет, но товар остался, и продажа по ним идёт туда же.
 */
export function versionsBlock(r) {
  if (!(r.family || []).length) return '';
  const cards = [relatedCard({
    href: r.ts_url, image: heroImg(r), title: nm(r), badge: 'main',
    chip: 'View on TurboSquid', price: r.price, external: true,
  })].concat(r.family.map(v => relatedCard({
    href: v.ts_url, image: v.image || r.image, title: v.name,
    badge: v.short === 'Standard' ? '' : v.short,
    chip: 'View on TurboSquid', price: v.price || r.price, external: true,
  })));
  return `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">Same model, other versions</div>`
    + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
    + `<div class="mp-related-grid">${cards.join('')}</div></div></section>`;
}

/**
 * «Похожие модели». Список соседей приходит ГОТОВЫМ в записи - ранжирование
 * это отдельная задача над всем каталогом, и решать её во время отрисовки
 * одной страницы нельзя: пришлось бы держать весь каталог в памяти на каждой
 * из 54 тысяч страниц.
 */
export function relatedBlock(r) {
  const list = r.related || [];
  if (!list.length) return '';
  const cards = list.map(v => relatedCard({
    href: '/models/' + v.slug + '/', image: v.image, title: v.name,
    badge: '', chip: v.category_name || r.category_name, price: v.price, external: false,
  }));
  return `<section class="mp-related-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">More in ${esc(r.category_name)}</div>`
    + `<h2 class="mp-related-h2">Related 3D Models</h2>`
    + `<div class="mp-related-grid">${cards.join('')}</div>`
    + `</div>`
    + `<div class="max-w-7xl mx-auto mp-footer-back"><a href="/categories/${r.category}/"`
    + ` class="nav-link mp-back-link">&#8592; All ${esc(r.category_name)} Models</a></div>`
    + `</section>`;
}


/*
 * Разметка хлебных крошек. Её не было в генераторе, хотя на живых страницах она
 * есть: без неё поисковик не показывает путь «Home › Категория › Модель» под
 * ссылкой в выдаче. Имена здесь обязаны совпадать с видимыми крошками, иначе
 * разметка спорит со страницей.
 */
export function breadcrumbSchema(r) {
  const url = SITE + '/models/' + r.slug + '/';
  const j = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': url + '#breadcrumb',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: r.category_name, item: SITE + '/categories/' + r.category + '/' },
      { '@type': 'ListItem', position: 3, name: nm(r), item: url },
    ],
  };
  return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
}

/*
 * Разметка вопросов и ответов. Тоже отсутствовала. Вопросы берутся ИЗ ТОГО ЖЕ
 * блока, что напечатан на странице: разметка, обещающая поисковику вопрос,
 * которого на странице нет, - прямое нарушение его правил.
 */
export function faqSchema(r, faqHtml) {
  const qs = [...faqHtml.matchAll(/<h3 class="mp-faq-q">([\s\S]*?)<\/h3>\s*<p class="mp-faq-a">([\s\S]*?)<\/p>/g)];
  if (!qs.length) return '';
  const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#8217;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const j = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': SITE + '/models/' + r.slug + '/#faq',
    mainEntity: qs.map(m => ({
      '@type': 'Question',
      name: strip(m[1]),
      acceptedAnswer: { '@type': 'Answer', text: strip(m[2]) },
    })),
  };
  return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
}


/*
 * Блок с роликом. Есть у 152 карточек, в генераторе его не было - пересборка
 * потеряла бы и его, и разметку VideoObject.
 *
 * Встраиваем НЕ голым iframe: он тянет около мегабайта плеера и ставит куки
 * ещё до того, как посетитель решил смотреть. Вместо этого обложка с кнопкой,
 * плеер подгружается по клику. Обложка лежит на i.ytimg.com - домен без кук.
 */
export function videoBlock(r) {
  const v = r.video;
  if (!v || !v.id) return '';
  const more = v.count > 1
    ? ` <a href="https://www.youtube.com/@dddmolier" target="_blank" rel="noopener">`
      + `${v.count - 1} more clip${v.count > 2 ? 's' : ''} of this model on our channel</a>.`
    : '';
  return `<div class="mp-video"><h2 class="mp-block-h2">See this model in motion</h2>`
    + `<button type="button" class="mp-video-frame" data-yt="${esc(v.id)}" data-title="${esc(v.title)}"`
    + ` aria-label="Play video: ${esc(v.title)}">`
    + `<img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" width="480" height="360"`
    + ` loading="lazy" decoding="async">`
    + `<span class="mp-video-play" aria-hidden="true"></span></button>`
    + `<p class="mp-video-cap">${esc(v.title)} - from the 3D Molier channel.${more}</p></div>`;
}

/** Разметка ролика для поисковика. Описывает ровно тот ролик, что на странице. */
export function videoSchema(r) {
  const v = r.video;
  if (!v || !v.id) return '';
  const j = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: 'Animation of the ' + nm(r) + ' 3D model by 3D Molier.',
    thumbnailUrl: [
      'https://i.ytimg.com/vi/' + v.id + '/maxresdefault.jpg',
      'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg',
    ],
    uploadDate: v.date,
    embedUrl: 'https://www.youtube.com/embed/' + v.id,
    contentUrl: 'https://www.youtube.com/watch?v=' + v.id,
    publisher: { '@type': 'Organization', name: '3D Molier' },
  };
  return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
}

/**
 * СТРАНИЦА ЦЕЛИКОМ. Единственная точка сборки: всё, что видно на карточке,
 * приходит из одной записи. Ни одно значение не вычисляется дважды - категория
 * в крошках, в таблице, в ответах и в разметке schema.org берётся из одного
 * поля, поэтому разойтись им негде.
 */
export function renderCard(r) {
  const f = toContentFields(r);
  const seed = seedOf(r.slug);
  /*
    * Слаг категории берём ИЗ ЗАПИСИ. Выводить его из подписи нельзя: у
    * «Model Bundles & Sets» правило даёт model-bundles-sets, а раздел
    * называется collections-sets, и ссылка вела бы в 404.
    */
   const cs = r.category;
  const desc = description(f, nm(r), r.category_name, r.price, seed, cs);
  const faqHtml = faqBlock(f, nm(r), r.category_name, cs, r.price, r.ts_url, seed, { brand: r.brand, catSlug: cs });
  const schema = [
    pageSchema({
      name: r.name, slug: r.slug, cat: r.category_name, catSlug: cs,
      desc, hero: heroImg(r), f, site: SITE, updatedIso: SITE_UPDATED,
    }),
    productSchema({
      name: r.name, slug: r.slug, id: r.id, hero: heroImg(r), tsUrl: r.ts_url,
      cat: r.category_name, price: r.price, desc, f, site: SITE,
    }),
    breadcrumbSchema(r),
    videoSchema(r),
    faqSchema(r, faqHtml),
  ].filter(Boolean).join('');
  const NL = '\n';
  return '<!DOCTYPE html>' + NL + '<html lang="en">' + NL
    + head(r, desc, schema) + NL + '<body>' + NL
    + '<a href="#main-content" class="skip-link">Skip to main content</a>' + NL
    + HEADER + NL
    + '<main id="main-content" class="mp-main">'
    + breadcrumbs(r)
    + hero(r)
    + details(r, f, seed, faqHtml)
    + '</main>' + NL
    + versionsBlock(r)
    + relatedBlock(r)
    + ctaSection() + NL
    + FOOTER + NL
    + scripts() + NL + '</body>' + NL + '</html>';
}

export { SITE, HEADER, FOOTER, ASSET_V };
