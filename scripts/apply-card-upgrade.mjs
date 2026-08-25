/*
 * apply-card-upgrade.mjs - перенос утверждённой раскладки карточки на весь каталог.
 *
 * Прототип согласован на трёх превью (см. build-variant-cards.mjs и
 * /preview/cards/). Здесь то же самое применяется к живым карточкам в models/.
 *
 * Что меняется на каждой карточке:
 *   1. Описание разбивается на абзацы и дополняется предложениями из собственных
 *      чисел модели - полигоны, вершины, размер текстур, риг. Этих данных в
 *      каталоге не было вовсе, они пришли из инвентаря студии.
 *   2. В характеристики добавляются Polygons, Vertices, Geometry, Rig, Textures
 *      (с размерами карт) и UV mapping.
 *   3. Убираются дубли: Quick Info (повторял цену, категорию и сертификацию),
 *      строки Primary industries и Typical use (повторяли кнопки Use Cases),
 *      короткий список Search Keywords и плашка Quality Certified.
 *   4. Характеристики переезжают в правую колонку, левая становится шире.
 *   5. Под вопросами появляется полный список ключевых слов из инвентаря -
 *      ссылками на поиск. На карточке их было четыре, в инвентаре 20-25.
 *   6. Похожие модели дополняются до 10: пять в ряд, ряд и одна карточка
 *      выглядели обрубком.
 *   7. Подвал заменяется на общий с главной страницей.
 *   8. Длинное тире меняется на дефис - правило проекта.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Кадры презентации из инвентаря не подставляются: на 20.08.2026
 * студийный сервер отдаёт картинки лишь у ~18% моделей с годными адресами, и до
 * починки галерея вышла бы битой. Существующие изображения не трогаются - карточка
 * остаётся с тем кадром, что был. Кадры добавит отдельный прогон после починки.
 *
 * Запуск:
 *   node apply-card-upgrade.mjs --dry --limit 200     проверка без записи
 *   node apply-card-upgrade.mjs                        полный прогон
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const MARK = '<!-- card-upgrade:v1 -->';

const esc = s => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── данные инвентаря ────────────────────────────────────────────────────────
console.log('читаю инвентарь...');
const DL = 'C:/Users/MSI-PC/Downloads/';
const inv = new Map();
for (const f of fs.readdirSync(DL).filter(x => /^studio-inventory-part-\d+\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(DL + f, 'utf8'));
  for (const [id, r] of Object.entries(j.result)) {
    inv.set(id, {
      polygons: r.polygons, vertices: r.vertices, geometry: r.geometry,
      rigged: r.rigged, animated: r.animated, ntextures: r.ntextures,
      details: r.details, unwrapped_uvs: r.unwrapped_uvs, keywords: r.keywords,
    });
  }
}
console.log('записей инвентаря: ' + inv.size);

// ── справочники для похожих моделей ─────────────────────────────────────────
const master = new Map();
{
  const L = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
  const H = L[0].split(',');
  const ix = n => H.indexOf(n);
  const pc = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
  for (let i = 1; i < L.length; i++) {
    if (!L[i]) continue;
    const r = pc(L[i]);
    master.set(r[ix('slug')], { name: r[ix('product_name')] || '', price: +r[ix('price')] || 0, cat: r[ix('category')] || '' });
  }
}
const STOP = new Set(['3d', 'model', 'models', 'the', 'and', 'for', 'with', 'of', 'set', 'collection',
  'rigged', 'animated', 'low', 'high', 'poly', 'pbr', 'game', 'ready', 'realistic', 'generic', 'new', 'old']);
const titleWords = n => String(n).toLowerCase().match(/[a-z]{3,}/g)?.filter(w => !STOP.has(w)) || [];

const mergedMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVariant = new Set(Object.keys(mergedMap));
const allDirs = fs.readdirSync(MODELS);
const liveSet = new Set(allDirs.filter(d => !isVariant.has(d)));

// Обратный индекс «слово -> карточки» строим один раз: перебирать 60 тысяч
// кандидатов на каждую из 60 тысяч карточек было бы неделю.
const byWord = new Map();
const byCat = new Map();
for (const slug of liveSet) {
  const m = master.get(slug);
  if (!m || !m.cat) continue;
  if (!byCat.has(m.cat)) byCat.set(m.cat, []);
  byCat.get(m.cat).push(slug);
  for (const w of new Set(titleWords(m.name))) {
    if (!byWord.has(w)) byWord.set(w, []);
    const a = byWord.get(w);
    if (a.length < 300) a.push(slug);
  }
}
console.log('живых карточек: ' + liveSet.size + ', категорий: ' + byCat.size);

// Обложку соседа читаем с диска один раз и запоминаем.
const coverCache = new Map();
function cover(slug) {
  if (coverCache.has(slug)) return coverCache.get(slug);
  let u = null;
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    u = (h.match(/property="og:image" content="([^"]+)"/) || [])[1] || null;
  } catch (e) { }
  coverCache.set(slug, u);
  return u;
}

// ── разбор и сборка кусков ──────────────────────────────────────────────────
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
function paras(list, per) {
  const out = [];
  for (let i = 0; i < list.length; i += per) out.push(list.slice(i, i + per).join(' '));
  if (out.length > 1 && list.length % per === 1) out[out.length - 2] += ' ' + out.pop();
  return out;
}
function texSizes(d) {
  const t = String(d.details || '');
  const out = [];
  for (const m of t.matchAll(/(\d+)\s*\.\w+\s*\((\d+)\s*x\s*(\d+)\)/gi)) out.push({ n: +m[1], w: +m[2], h: +m[3] });
  if (!out.length) for (const m of t.matchAll(/\(\s*(\d+)\s*\.?\w*\s*\)\s*(\d+)\s*x\s*(\d+)/gi)) out.push({ n: +m[1], w: +m[2], h: +m[3] });
  return out.sort((a, b) => b.w * b.h - a.w * a.h);
}
function texLine(d) {
  const n = d.ntextures ? Number(d.ntextures) : null;
  const s = texSizes(d);
  if (!n && !s.length) return null;
  if (!s.length) return n + ' maps';
  if (s.length === 1) return (n || s[0].n) + ' maps at ' + s[0].w + 'x' + s[0].h;
  return (n ? n + ' maps - ' : '') + s.map(x => x.n + ' at ' + x.w + 'x' + x.h).join(', ');
}
// Ключевые слова в инвентаре записаны СЛОВАМИ ЧЕРЕЗ ПРОБЕЛ, а не списком через
// запятую: из 46 162 живых записей запятые есть лишь у 138, а переводы строки
// просто переносят ту же длинную строку. Поэтому режем по пробелам и знакам.
// Мусор отбрасываем: в части записей в это поле затекли размеры текстур
// («- (10 .png) 4096 x 4096»).
const KW_STOP = new Set(['the','and','for','with','from','this','that','are','was','has','have',
  'you','your','can','all','any','not','but','its','into','out','off','per','via','use','used',
  'png','jpg','jpeg','tga','psd','max','obj','fbx','c4d','mtl','tif','tiff','texture','textures',
  'model','models','3d','3ds','file','files','set','sets','pack','new','old','high','low','poly']);
function keywordsOf(d) {
  const kw = d.keywords;
  if (!kw || typeof kw !== 'string') return [];
  const words = kw.toLowerCase().split(/[^a-z0-9'+&-]+/);
  const out = [];
  for (const w0 of words) {
    const w = w0.replace(/^[-'+&]+|[-'+&]+$/g, '');
    if (w.length < 3 || w.length > 24) continue;
    if (/^\d+$/.test(w)) continue;          // 4096, 2048 и прочие размеры
    if (KW_STOP.has(w)) continue;
    if (out.indexOf(w) >= 0) continue;
    out.push(w);
    if (out.length >= 24) break;
  }
  return out.length >= 3 ? out : [];
}

function endOfDiv(html, start) {
  if (start < 0) return -1;
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return m.index; }
    else depth++;
  }
  return -1;
}
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
    const fromLink = (link.match(/3d-models\/([a-z0-9-]+)-\d+/i) || [])[1] || '';
    const pretty = fromLink ? fromLink.replace(/-3d-model$/, '').split('-')
      .map(w => /^(3d|us|uv|la|mk|ii|iii|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : name;
    const bare = name.trim().replace(/\s*\(\d+\)$/, '');
    out.push({ isMain, thumb, name: pretty || name, tag: /^standard$/i.test(bare) ? '' : bare, price, link });
  }
  return out;
}

const HOME_FOOTER = (() => {
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = h.lastIndexOf('<footer');
  return i < 0 ? null : h.slice(i, h.indexOf('</footer>', i) + '</footer>'.length);
})();

const STYLE = fs.readFileSync(path.join(ROOT, 'scripts', 'card-upgrade.css.txt'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'scripts', 'card-upgrade.js.txt'), 'utf8');

// ── одна карточка ───────────────────────────────────────────────────────────
function upgrade(slug) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { return { skip: 'нет файла' }; }
  if (html.includes(MARK)) return { skip: 'уже обновлена' };
  if (/http-equiv="refresh"/i.test(html)) return { skip: 'перенаправление' };

  const id = (slug.match(/-(\d+)$/) || [])[1];
  const d = (id && inv.get(id)) || {};
  const touched = [];

  // 1. описание
  const kwList = keywordsOf(d);
  const poly = Number(d.polygons) || 0;
  const descM = html.match(/<p class="mp-desc-text">([\s\S]*?)<\/p>/);
  if (descM) {
    let extraSent = '';
    if (poly) {
      const seed = Number(id) || 0;
      const pn = poly.toLocaleString('en-US');
      const vn = (Number(d.vertices) || 0).toLocaleString('en-US');
      const weight = poly > 800000 ? 'heavy' : poly > 200000 ? 'mid-weight' : 'light';
      const MESH = [
        `The mesh carries ${pn} polygons and ${vn} vertices, which puts it in the ${weight} bracket for this category.`,
        `At ${pn} polygons and ${vn} vertices this is a ${weight} asset: dense enough for close framing, and honest about what it costs a scene.`,
        `Geometry weighs in at ${pn} polygons over ${vn} vertices - a ${weight} build for its class.`,
        `Counted at the source, the model is ${pn} polygons and ${vn} vertices, a ${weight} load for a scene.`,
      ];
      const s = texSizes(d);
      const TEX = s.length ? [
        `Texture work runs to ${d.ntextures} maps, the largest at ${s[0].w}x${s[0].h}, so the surface holds up when the camera moves in.`,
        `It ships ${d.ntextures} maps with the top set authored at ${s[0].w}x${s[0].h} - enough resolution to fill a frame rather than sit in the background.`,
        `Maps: ${d.ntextures} of them, peaking at ${s[0].w}x${s[0].h}, which is where the close-up detail comes from.`,
      ] : [];
      const RIG = /is jointed/i.test(d.rigged || '')
        ? [`The model is jointed, so it can be posed or animated without rebuilding the hierarchy.`]
        : [`It is a static build - no rig to strip out if all you need is a rendered object.`];
      const pk = (a, k) => a.length ? a[Math.abs(seed + k) % a.length] : '';
      extraSent = [pk(MESH, 0), pk(TEX, 3), pk(RIG, 0)].filter(Boolean).join(' ');
      touched.push('текст');
    }
    const blocks = paras(sentences(descM[1]), 3);
    if (extraSent) blocks.push(extraSent);
    if (blocks.length > 1 || extraSent) {
      html = html.replace(descM[0], () => blocks.map(p => `<p class="mp-desc-text">${p}</p>`).join(''));
      if (!touched.includes('текст')) touched.push('абзацы');
    }
  }

  // 2. Quick Info -> в характеристики
  const quick = {};
  const qiM = html.match(/<div class="mp-info-card">[\s\S]*?<div class="mp-info-rows">([\s\S]*?)<\/div><\/div>/);
  if (qiM) {
    for (const m of qiM[1].matchAll(/<span class="mp-info-row-label">([^<]*)<\/span>\s*(<span[^>]*>|<a[^>]*>)([^<]*)/g)) {
      quick[m[1].trim()] = m[2] + m[3] + (m[2].startsWith('<a') ? '</a>' : '</span>');
    }
    html = html.replace(qiM[0], '');
    touched.push('quick info');
  }

  // 3. характеристики: данные инвентаря, чистка дублей, переезд вправо
  const specM = html.match(/<div class="mp-spec-block">[\s\S]*?(?=<div class="mp-faq-block">)/);
  if (specM) {
    let spec = specM[0];
    html = html.replace(spec, '');
    const have = [...spec.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    const rows = [
      ['Polygons', poly ? poly.toLocaleString('en-US') : null],
      ['Vertices', Number(d.vertices) ? Number(d.vertices).toLocaleString('en-US') : null],
      ['Geometry', d.geometry || null],
      ['Rig', /is jointed/i.test(d.rigged || '') ? 'Rigged' : (d.rigged ? 'Static' : null)],
      ['Animation', /is animated/i.test(d.animated || '') ? 'Animated' : null],
      ['Textures', texLine(d)],
      ['UV mapping', d.unwrapped_uvs || null],
    ];
    let extra = '';
    for (const [k, v] of rows) {
      if (!v) continue;
      if (have.includes(k.toLowerCase())) {
        spec = spec.replace(new RegExp('(<th[^>]*>\\s*' + k + '\\s*</th>\\s*<td[^>]*>)[\\s\\S]*?(</td>)', 'i'), (m, a, b) => a + esc(v) + b);
      } else { extra += `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`; have.push(k.toLowerCase()); }
    }
    for (const [k, v] of Object.entries(quick)) {
      if (have.includes(k.toLowerCase())) continue;
      extra += `<tr><th>${esc(k)}</th><td>${v}</td></tr>`; have.push(k.toLowerCase());
    }
    if (extra) spec = spec.replace('</tbody>', extra + '</tbody>');
    for (const k of ['Primary industries', 'Typical use']) {
      spec = spec.replace(new RegExp('<tr>\\s*<th[^>]*>\\s*' + k + '\\s*</th>[\\s\\S]*?</tr>', 'i'), '');
    }
    const at = endOfDiv(html, html.indexOf('<div class="mp-sidebar-col">'));
    if (at > 0) { html = html.slice(0, at) + '<div class="mp-spec-card">' + spec + '</div>' + html.slice(at); touched.push('характеристики'); }
    else html = html.replace('<div class="mp-faq-block">', () => spec + '<div class="mp-faq-block">');
  }

  // 4. дубли прочь
  html = html.replace(/<div>\s*<div class="section-label[^"]*">Search Keywords<\/div>[\s\S]*?<\/div>\s*<\/div>/i, '');
  html = html.replace(/<div class="mp-cert-card">[\s\S]*?<\/div>\s*<\/div>/i, '');

  // 5. ключевые слова под вопросами
  if (kwList.length) {
    const block = `<div class="mp-kw-block"><div class="section-label mp-mb12">Keywords</div>`
      + `<div class="mp-chip-row">${kwList.map(k => `<a href="/search/?q=${encodeURIComponent(k)}" class="chip chip--kw">${esc(k)}</a>`).join('')}</div></div>`;
    const faqEnd = endOfDiv(html, html.indexOf('<div class="mp-faq-block">'));
    if (faqEnd > 0) { html = html.slice(0, faqEnd + 6) + block + html.slice(faqEnd + 6); touched.push('слова:' + kwList.length); }
  }

  // 6. версии - вниз сеткой
  const versions = parseVersions(html);
  if (versions.length) {
    html = html.replace(/<section class="mp-variants">[\s\S]*?<\/section>/, '');
    const cards = versions.map(v =>
      `<a href="${esc(v.link)}" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link">`
      + `<div class="img-wrap mp-rc-img-wrap"><img src="${esc(v.thumb)}" alt="${esc(v.name)}" width="800" height="450"`
      + ` decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
      + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
      + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(v.name)}`
      + `${v.isMain ? ' <span class="mp-var-badge">main</span>' : ''}</div></div>`
      + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">${v.tag ? esc(v.tag) : 'View on TurboSquid'}</span>`
      + `<span class="mp-rc-price">${esc(v.price)}</span></div></div></a>`).join('');
    const sec = `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
      + `<div class="section-label mp-mb8">Same model, other versions</div>`
      + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
      + `<div class="mp-related-grid">${cards}</div></div></section>`;
    if (html.includes('<section class="mp-related-section">')) {
      html = html.replace('<section class="mp-related-section">', () => sec + '<section class="mp-related-section">');
    } else {
      html = html.replace('</main>', () => sec + '</main>');
    }
    touched.push('версии:' + versions.length);
  }

  // 7. похожие до 10
  const relM = html.match(/<section class="mp-related-section">[\s\S]*?<div class="mp-related-grid">([\s\S]*?)<\/div><\/div><\/section>/);
  if (relM) {
    const already = new Set([...relM[1].matchAll(/href="\/models\/([^/"]+)\//g)].map(m => m[1]));
    const need = 10 - already.size;
    if (need > 0) {
      const me = master.get(slug);
      const add = [];
      if (me && me.cat) {
        const mine = new Set(titleWords(me.name));
        const seen = new Set(), scored = [];
        for (const w of mine) for (const s of (byWord.get(w) || [])) {
          if (seen.has(s) || already.has(s) || s === slug) continue;
          seen.add(s);
          const m2 = master.get(s);
          if (!m2 || m2.cat !== me.cat) continue;
          let sc = 0; for (const x of titleWords(m2.name)) if (mine.has(x)) sc++;
          scored.push({ s, m: m2, sc });
        }
        if (scored.length < need) {
          for (const s of (byCat.get(me.cat) || [])) {
            if (seen.has(s) || already.has(s) || s === slug) continue;
            seen.add(s); scored.push({ s, m: master.get(s), sc: 0 });
            if (scored.length > need * 6) break;
          }
        }
        scored.sort((a, b) => b.sc - a.sc || Math.abs(a.m.price - me.price) - Math.abs(b.m.price - me.price));
        for (const { s, m } of scored) {
          if (add.length >= need) break;
          const img = cover(s);
          if (!img) continue;
          add.push(`<a href="/models/${s}/" class="model-card card-glow mp-rc-link">`
            + `<div class="img-wrap mp-rc-img-wrap"><img src="${esc(img)}" alt="${esc(m.name)}" width="800" height="450"`
            + ` decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
            + `<div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
            + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(m.name)}</div></div>`
            + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">${esc(m.cat)}</span>`
            + `<span class="mp-rc-price">$${m.price}</span></div></div></a>`);
        }
      }
      if (add.length) { html = html.replace(relM[1], () => relM[1] + add.join('')); touched.push('похожих+' + add.length); }
    }
  }

  // 8. подвал
  if (HOME_FOOTER) {
    const cur = html.match(/<footer class="mp-footer">[\s\S]*?<\/footer>/);
    if (cur) {
      const back = (cur[0].match(/<a[^>]*class="nav-link mp-back-link"[\s\S]*?<\/a>/) || [''])[0];
      html = html.replace(cur[0], () => HOME_FOOTER.replace('</footer>',
        (back ? `<div class="max-w-7xl mx-auto mp-footer-back">${back}</div>` : '') + '</footer>'));
      touched.push('подвал');
    }
  }

  // 9. стили, скрипт, метка, тире
  html = html.replace('</head>', STYLE + MARK + '</head>');
  html = html.replace('</body>', SCRIPT + '</body>');
  const dashes = (html.match(/-|-|-|-|-|-/g) || []).length;
  html = html.replace(/\s*(?:-|-|-|-|-|-)\s*/g, ' - ');

  if (!DRY) fs.writeFileSync(file, html);
  return { touched, dashes, hasInv: !!poly, kw: kwList.length };
}

// ── прогон ──────────────────────────────────────────────────────────────────
let list = [...liveSet].sort();
if (ONLY) list = ONLY.split(',');
if (LIMIT) list = list.slice(0, LIMIT);

const stat = { done: 0, skip: {}, noInv: 0, kwTotal: 0, dashes: 0, rel: 0, ver: 0 };
const t0 = Date.now();
for (const slug of list) {
  const r = upgrade(slug);
  if (r.skip) { stat.skip[r.skip] = (stat.skip[r.skip] || 0) + 1; continue; }
  stat.done++;
  if (!r.hasInv) stat.noInv++;
  stat.kwTotal += r.kw;
  stat.dashes += r.dashes;
  if (r.touched.some(x => x.startsWith('похожих'))) stat.rel++;
  if (r.touched.some(x => x.startsWith('версии'))) stat.ver++;
  if (stat.done % 5000 === 0) console.log('  ' + stat.done + '  (' + Math.round((Date.now() - t0) / 1000) + ' с)');
}
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('обновлено карточек: ' + stat.done);
console.log('  без данных инвентаря (текст без чисел): ' + stat.noInv);
console.log('  с ключевыми словами: ' + (stat.done - stat.noInv >= 0 ? '' : '') + stat.kwTotal + ' слов всего');
console.log('  дополнено похожими: ' + stat.rel + ', с секцией версий: ' + stat.ver);
console.log('  убрано длинных тире: ' + stat.dashes);
console.log('пропущено: ' + JSON.stringify(stat.skip));
console.log('время: ' + Math.round((Date.now() - t0) / 1000) + ' с');
