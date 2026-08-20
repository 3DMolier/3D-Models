/*
 * build-variant-demo.mjs — прототип новой раскладки карточки: презентация и
 * вариации разнесены по двум блокам.
 *
 * Задача, поставленная 20.08.2026. Раньше на объединённой карточке кадры главной
 * модели и кадры её вариаций лежали в одной галерее вперемешку, и читатель не мог
 * понять, что именно он смотрит: тот же танк или его версию с ригом. Теперь:
 *
 *   Блок 1 «Presentation» - кадры САМОЙ модели, дальше кадры вариаций, но каждая
 *     вариация отбита полосой во всю ширину, своим цветом, своим значком на каждой
 *     миниатюре и своей подписью в увеличенном виде. Группы вариаций схлопнуты.
 *   Блок 2 «Variations» - сами объединённые карточки: чем отличаются, сколько
 *     полигонов, какой риг. Клик по вариации не уводит со страницы (их адреса
 *     всё равно ведут перенаправлением сюда же), а раскрывает её кадры в блоке 1.
 *
 * Шапку и подвал копируем из настоящей карточки: демонстрация должна выглядеть
 * как страница сайта, а не как отдельная поделка.
 *
 * Запуск:  node build-variant-demo.mjs
 * Выход:   preview/variant-layout/<slug>/index.html  (с noindex)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DATA = path.join(ROOT, 'data', 'variant-demo.json');
const OUTBASE = path.join(ROOT, 'preview', 'variant-layout');

const esc = s => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = n => { const v = Number(n); return Number.isFinite(v) ? v.toLocaleString('en-US') : null; };

// Цвета вариаций. Смысл не в красоте, а в том, чтобы полоса, значок на миниатюре
// и карточка во втором блоке читались как одно и то же - глазом, без чтения.
const HUES = ['#d9480f', '#0b7285', '#5f3dc4', '#2b8a3e', '#a61e4d', '#946200', '#1864ab'];

// Чем вариация отличается от главной. Берём из данных, где можно, иначе из имени:
// это то, ради чего человек и открывает список вариаций.
function differences(v, mainData) {
  const out = [];
  const slug = v.slug, d = v.data || {};
  const jointed = /is jointed/i.test(d.rigged || '');
  const mainJointed = /is jointed/i.test((mainData || {}).rigged || '');
  if (jointed !== mainJointed) out.push(jointed ? 'Rigged' : 'No rig');
  else if (jointed) out.push('Rigged');
  if (/is animated/i.test(d.animated || '')) out.push('Animated');
  const colour = (slug.match(/\b(black|blue|red|yellow|pink|green|white|orange|grey|gray|silver|sand|desert)\b/i) || [])[1];
  if (colour) out.push(colour[0].toUpperCase() + colour.slice(1).toLowerCase());
  if (/\bdusty|dirty|weathered\b/i.test(slug)) out.push('Weathered');
  if (/\brealistic\b/i.test(slug)) out.push('Realistic');
  const app = (slug.match(/for-(maya|cinema-?4d|c4d|blender|3ds-?max|max|unity|unreal)\b/i) || [])[1];
  if (app) out.push('For ' + app.replace(/-/g, ' '));
  if (/\bfur\b/i.test(slug)) out.push('Fur');
  if (/\blow-?poly\b/i.test(slug)) out.push('Low poly');
  return out.length ? out : ['Alternate version'];
}

// Человеческое имя из адреса: в данных парсера title бывает пустым или служебным.
function nameFromSlug(slug) {
  return slug.replace(/-\d+$/, '').replace(/-3d-model$/, '').split('-')
    .map(w => /^(mk|iv|ii|iii|us|uv|3d)$/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function galleryOf(rec, limit) {
  return (rec && rec.images ? rec.images : []).slice(0, limit || 12);
}

function build(group) {
  const mainSlug = group.main.slug;
  const donorPath = path.join(ROOT, 'models', mainSlug, 'index.html');
  if (!fs.existsSync(donorPath)) { console.log('  пропускаю ' + mainSlug + ': карточки нет на диске'); return null; }
  const donor = fs.readFileSync(donorPath, 'utf8');
  const header = (donor.match(/<body[^>]*>([\s\S]*?<\/header>)/) || [])[1];
  if (!header) { console.log('  пропускаю ' + mainSlug + ': не нашёл шапку'); return null; }
  const footer = donor.slice(donor.indexOf('</main>') + '</main>'.length);
  const bodyClass = (donor.match(/<body([^>]*)>/) || [, ''])[1];
  // Часть карточек несёт обрезанный H1 - например «Freightliner Truck with»,
  // где имя оборвано на предлоге. Для показа это выглядит как наша ошибка,
  // поэтому такой заголовок заменяем именем из адреса. Сама обрезка - отдельная
  // болячка каталога, чинить её надо не здесь.
  let h1 = ((donor.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
  if (!h1 || /\b(with|and|for|of|in|on|the|a)$/i.test(h1)) h1 = nameFromSlug(mainSlug);

  const md = group.main.data || {};
  const mainImgs = galleryOf(md, 10);

  // ── блок 1: презентация ────────────────────────────────────────────────────
  const mainThumbs = mainImgs.map((src, i) =>
    `<button type="button" class="vp-thumb${i ? '' : ' is-on'}" data-full="${esc(src)}" data-owner="main" aria-label="Frame ${i + 1} of the base model">`
    + `<img src="${esc(src)}" alt="${esc(h1)} frame ${i + 1}" loading="lazy" decoding="async"></button>`).join('');

  const varZones = group.vars.map((v, n) => {
    const hue = HUES[n % HUES.length];
    const imgs = galleryOf(v.data, 8);
    if (!imgs.length) return '';
    const nm = nameFromSlug(v.slug);
    const diffs = differences(v, md);
    const thumbs = imgs.map((src, i) =>
      `<button type="button" class="vp-thumb vp-thumb--var" data-full="${esc(src)}" data-owner="${esc(v.id)}" data-owner-name="${esc(nm)}" data-hue="${hue}" aria-label="Frame ${i + 1} of variation ${esc(nm)}">`
      + `<img src="${esc(src)}" alt="${esc(nm)} frame ${i + 1}" loading="lazy" decoding="async">`
      + `<span class="vp-thumb-badge" style="background:${hue}">${esc(diffs[0])}</span></button>`).join('');
    return `<details class="vp-zone" id="zone-${esc(v.id)}" style="--hue:${hue}">`
      + `<summary class="vp-zone-bar">`
      + `<span class="vp-zone-flag">Variation</span>`
      + `<span class="vp-zone-name">${esc(nm)}</span>`
      + `<span class="vp-zone-tags">${diffs.map(d => `<span class="vp-tag">${esc(d)}</span>`).join('')}</span>`
      + `<span class="vp-zone-count">${imgs.length} frames</span>`
      + `<span class="vp-zone-caret" aria-hidden="true">&#9662;</span>`
      + `</summary>`
      + `<div class="vp-zone-body"><p class="vp-zone-note">These frames show <strong>${esc(nm)}</strong>, not the base model above.</p>`
      + `<div class="vp-thumbs">${thumbs}</div></div></details>`;
  }).join('');

  // ── блок 2: вариации ───────────────────────────────────────────────────────
  const varCards = group.vars.map((v, n) => {
    const hue = HUES[n % HUES.length];
    const d = v.data || {};
    const cover = (d.images || [])[0] || '';
    const nm = nameFromSlug(v.slug);
    const diffs = differences(v, md);
    const poly = num(d.polygons);
    return `<button type="button" class="vv-card" data-goto="${esc(v.id)}" style="--hue:${hue}">`
      + (cover ? `<span class="vv-cover"><img src="${esc(cover)}" alt="${esc(nm)}" loading="lazy" decoding="async"></span>` : '')
      + `<span class="vv-body">`
      + `<span class="vv-name">${esc(nm)}</span>`
      + `<span class="vv-tags">${diffs.map(x => `<span class="vv-tag">${esc(x)}</span>`).join('')}</span>`
      + `<span class="vv-meta">${poly ? poly + ' polygons' : ''}${d.geometry ? ' &middot; ' + esc(d.geometry) : ''}</span>`
      + `<span class="vv-open">Show its frames &#8594;</span>`
      + `</span></button>`;
  }).join('');

  const polyMain = num(md.polygons);
  const totalFrames = mainImgs.length + group.vars.reduce((a, v) => a + galleryOf(v.data, 8).length, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(h1)} &#8212; layout preview | 3D Molier</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Layout preview: presentation and variations split into two blocks.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">
<style>
.vp-wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.vp-note{background:#fff8e1;border:1px solid #f2c94c;border-radius:10px;padding:12px 16px;margin:18px 0;font-size:14px;line-height:1.55}
.vp-block{border:1px solid rgba(0,0,0,.14);border-radius:14px;margin:26px 0;overflow:hidden}
.vp-block-hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid rgba(0,0,0,.1);background:rgba(0,0,0,.025)}
.vp-block-num{font-size:12px;font-weight:800;letter-spacing:.12em;opacity:.5}
.vp-block-title{font-size:19px;font-weight:800}
.vp-block-sub{font-size:13px;opacity:.65}
.vp-block-body{padding:20px}
.vp-stage{background:#f4f5f7;border-radius:10px;overflow:hidden;margin-bottom:6px}
/* Рендеры студии - это 1480x800, почти 16:9. При сцене 4:3 сверху и снизу
   оставались широкие пустые поля, поэтому держим 16:9. */
.vp-stage img{width:100%;height:auto;display:block;aspect-ratio:16/9;object-fit:contain}
.vp-cap{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;padding:9px 12px;border-radius:8px;margin:8px 0 18px;background:#eef1f4}
.vp-cap-dot{width:10px;height:10px;border-radius:50%;background:#333;flex:none}
.vp-cap.is-var{color:#fff}
.vp-cap.is-var .vp-cap-dot{background:#fff}
.vp-own{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.55;margin:0 0 8px}
.vp-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px}
.vp-thumb{position:relative;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#f4f5f7;cursor:pointer;aspect-ratio:1}
.vp-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.vp-thumb.is-on{border-color:#111}
.vp-thumb--var{border-color:var(--hue);border-style:dashed}
/* Выбранный кадр внутри зоны вариации должен остаться её цвета: правило
   .vp-thumb.is-on выше по весу и иначе перекрашивало рамку в чёрный, разрывая
   связь «полоса - значок - карточка», ради которой цвет и вводился. */
.vp-zone .vp-thumb.is-on{border-color:var(--hue);border-style:solid;box-shadow:0 0 0 3px color-mix(in srgb, var(--hue) 35%, transparent)}
.vp-thumb-badge{position:absolute;left:0;right:0;bottom:0;color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 4px;text-align:center;text-transform:uppercase}
.vp-zone{margin:16px 0 0;border:2px dashed var(--hue);border-radius:12px;overflow:hidden;background:color-mix(in srgb, var(--hue) 5%, transparent)}
.vp-zone-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 14px;cursor:pointer;background:var(--hue);color:#fff;list-style:none}
.vp-zone-bar::-webkit-details-marker{display:none}
.vp-zone-flag{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;background:rgba(255,255,255,.25);padding:3px 8px;border-radius:20px}
.vp-zone-name{font-weight:800;font-size:15px}
.vp-zone-tags{display:flex;gap:6px;flex-wrap:wrap}
.vp-tag{font-size:11px;font-weight:700;background:rgba(255,255,255,.22);padding:2px 8px;border-radius:20px}
.vp-zone-count{margin-left:auto;font-size:12px;opacity:.85}
.vp-zone-caret{transition:transform .15s}
.vp-zone[open] .vp-zone-caret{transform:rotate(180deg)}
.vp-zone-body{padding:14px}
.vp-zone-note{font-size:13px;margin:0 0 10px;opacity:.85}
.vv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px}
.vv-card{display:flex;flex-direction:column;text-align:left;padding:0;border:1px solid rgba(0,0,0,.14);border-left:5px solid var(--hue);border-radius:11px;overflow:hidden;background:transparent;cursor:pointer;font:inherit;color:inherit}
.vv-card:hover{border-color:var(--hue)}
.vv-cover{display:block;aspect-ratio:16/10;background:#f4f5f7}
.vv-cover img{width:100%;height:100%;object-fit:cover;display:block}
.vv-body{display:block;padding:12px 14px 14px}
.vv-name{display:block;font-weight:700;font-size:14px;margin-bottom:7px}
.vv-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
.vv-tag{font-size:11px;font-weight:700;color:#fff;background:var(--hue);padding:2px 8px;border-radius:20px}
.vv-meta{display:block;font-size:12px;opacity:.6}
.vv-open{display:block;font-size:12px;font-weight:700;color:var(--hue);margin-top:9px}
@media(prefers-color-scheme:dark){
 .vp-block{border-color:rgba(255,255,255,.18)}
 .vp-block-hd{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12)}
 .vp-stage,.vp-thumb,.vv-cover{background:#1f2229}
 .vp-cap{background:#262a33}
 .vp-note{background:#2c2718;border-color:#7a6320}
 .vv-card{border-color:rgba(255,255,255,.18)}
 .vp-thumb.is-on{border-color:#fff}
}
</style>
</head>
<body${bodyClass}>
${header}
<main class="cat-main" id="main-content">
<div class="vp-wrap">
  <p class="vp-note"><strong>Layout preview.</strong> This page shows one thing only: how the presentation and the merged variations sit in two separate blocks. Everything else on a real card - description, specification, FAQ, pricing - stays exactly as it is today. Variation type here: <strong>${esc(group.kind)}</strong>.</p>
  <h1 class="cat-page-h1">${esc(h1)}</h1>

  <section class="vp-block">
    <div class="vp-block-hd">
      <span class="vp-block-num">BLOCK 1</span>
      <span class="vp-block-title">Presentation</span>
      <span class="vp-block-sub">${mainImgs.length} frames of this model${group.vars.length ? ' &middot; ' + group.vars.length + ' variations kept apart below' : ''}${polyMain ? ' &middot; ' + polyMain + ' polygons' : ''}</span>
    </div>
    <div class="vp-block-body">
      <div class="vp-stage"><img id="vp-big" src="${esc(mainImgs[0] || '')}" alt="${esc(h1)}"></div>
      <div class="vp-cap" id="vp-cap"><span class="vp-cap-dot"></span><span id="vp-cap-text">Base model &#8212; ${esc(h1)}</span></div>
      <p class="vp-own">Frames of this model</p>
      <div class="vp-thumbs">${mainThumbs}</div>
      ${varZones ? `<p class="vp-own" style="margin-top:26px">Frames that belong to a variation, not to this model</p>${varZones}` : ''}
    </div>
  </section>

  <section class="vp-block">
    <div class="vp-block-hd">
      <span class="vp-block-num">BLOCK 2</span>
      <span class="vp-block-title">Variations of this model</span>
      <span class="vp-block-sub">${group.vars.length} merged cards &middot; ${totalFrames} frames in total</span>
    </div>
    <div class="vp-block-body">
      <p class="vp-zone-note">These were separate products before we merged them. Each differs in rig, finish or modification. Pick one to see its frames in the block above.</p>
      <div class="vv-grid">${varCards}</div>
    </div>
  </section>
</div>
</main>
${footer}
<script>
(function(){
  var big=document.getElementById('vp-big'), cap=document.getElementById('vp-cap'), capT=document.getElementById('vp-cap-text');
  var base=${JSON.stringify('Base model — ' + h1)};
  document.addEventListener('click',function(e){
    var t=e.target.closest('.vp-thumb');
    if(t){
      document.querySelectorAll('.vp-thumb.is-on').forEach(function(x){x.classList.remove('is-on');});
      t.classList.add('is-on');
      big.src=t.getAttribute('data-full');
      var owner=t.getAttribute('data-owner');
      if(owner==='main'){ cap.classList.remove('is-var'); cap.style.background=''; capT.textContent=base; }
      else { cap.classList.add('is-var'); cap.style.background=t.getAttribute('data-hue');
             capT.textContent='Variation — '+t.getAttribute('data-owner-name')+' (not the base model)'; }
      return;
    }
    var c=e.target.closest('.vv-card');
    if(c){
      var z=document.getElementById('zone-'+c.getAttribute('data-goto'));
      if(z){ z.open=true; z.scrollIntoView({behavior:'smooth',block:'center'});
             var f=z.querySelector('.vp-thumb'); if(f) f.click(); }
    }
  });
})();
</script>`;
  return { slug: mainSlug, html };
}

const groups = JSON.parse(fs.readFileSync(DATA, 'utf8'));
fs.mkdirSync(OUTBASE, { recursive: true });
const made = [];
for (const g of groups) {
  const r = build(g);
  if (!r) continue;
  const dir = path.join(OUTBASE, r.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), r.html);
  made.push('/preview/variant-layout/' + r.slug + '/');
  console.log('  собрано: ' + r.slug + '  (' + Math.round(r.html.length / 1024) + ' КБ)');
}
console.log('\nготово, страниц: ' + made.length);
made.forEach(u => console.log('   https://3dmolierstudio.com' + u));
