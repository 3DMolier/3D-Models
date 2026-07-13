// enhance-thin-pages.mjs — раскатка обогащённого шаблона (перелинковка + категория + related)
// на "тонкие" страницы моделей (без блока mp-related-section).
//
// Данные: data/fc-chunk-*.json (id,name,price,cat) + data/fc-img-chunk-*.json (id->img url).
// Для каждой страницы: категория по ключевым словам, 6 похожих по токенам имени, обогащённое
// описание, use-cases/keywords/used-in, и ОБЯЗАТЕЛЬНО fallback-атрибуты на всех <img>
// (data-fallback + data-placeholder + onerror) — как на главной/Colosseum.
//
// Запуск (пилот):   node scripts/enhance-thin-pages.mjs --pilot 500
//           (все):  node scripts/enhance-thin-pages.mjs --all
//        (список):  node scripts/enhance-thin-pages.mjs --slugs slug1,slug2
// Без --write только считает и печатает превью (dry-run по умолчанию НЕ пишет? — пишет; см. флаг).
// Флаг --dry — не писать файлы, только отчёт.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DATA = path.join(ROOT, 'data');
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const STOP = new Set(['3d','model','models','for','the','and','of','with','a','an','to','by','in','on','rigged','rig','animated','set','pro','lite','vray','mb','max','maya','c4d','blender','fbx','obj','cinema','4d','3ds']);
const tokensOf = s => [...new Set(s.toLowerCase().match(/[a-z0-9]+/g) || [])].filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));

// ---- категории (порядок = приоритет; проверка по вхождению слова в имя) ----
// ЕДИНЫЙ 25-кат классификатор из classify15.mjs (крошки карточек ДОЛЖНЫ совпадать с хабами).
const _clsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'classify15.mjs'), 'utf8');
const CATS = eval('[' + _clsSrc.split('const CATS = [')[1].split('];')[0] + ']');
function classify(name) {
  const toks = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [slug, disp, kws] of CATS) {
    const hit = kws.find(k => toks.has(k));
    if (hit) return { slug, disp, subject: hit[0].toUpperCase() + hit.slice(1) };
  }
  return { slug: 'other', disp: 'Other', subject: '' };
}

// used-in / use-cases по категории (href на существующие /industries/*)
const IND = {
  'aircraft': [['Aerospace','aerospace'],['Military & Defense','military-defense'],['Film Production','film-video-production'],['Game Development','game-development'],['Virtual Reality','virtual-reality']],
  'ships': [['Film Production','film-video-production'],['Game Development','game-development'],['Military & Defense','military-defense'],['Virtual Reality','virtual-reality'],['Advertising','advertising']],
  'military-vehicles': [['Military & Defense','military-defense'],['Game Development','game-development'],['Film Production','film-video-production'],['Aerospace','aerospace'],['Virtual Reality','virtual-reality']],
  'vehicles': [['Advertising','advertising'],['Film Production','film-video-production'],['Game Development','game-development'],['Architecture','architecture'],['Virtual Reality','virtual-reality']],
  'medical-3d-models': [['Medical','medical'],['Game Development','game-development'],['Virtual Reality','virtual-reality'],['Film Production','film-video-production'],['Software Dev','software-development']],
  'industrial-equipment': [['Hardware','hardware'],['Game Development','game-development'],['Film Production','film-video-production'],['Advertising','advertising'],['Virtual Reality','virtual-reality']],
  'architecture-landmarks': [['Architecture','architecture'],['Advertising','advertising'],['Film Production','film-video-production'],['Virtual Reality','virtual-reality'],['Game Development','game-development']],
  'other': [['Game Development','game-development'],['Film Production','film-video-production'],['Advertising','advertising'],['Virtual Reality','virtual-reality'],['Architecture','architecture']],
};
const USES = {
  'aircraft': [['aerospace visualization','aerospace'],['military simulation','military-defense'],['film & TV VFX','film-video-production'],['game environments','game-development'],['VR training','virtual-reality']],
  'ships': [['film & TV VFX','film-video-production'],['game environments','game-development'],['naval simulation','military-defense'],['VR experiences','virtual-reality'],['advertising','advertising']],
  'military-vehicles': [['military simulation','military-defense'],['game environments','game-development'],['film & TV VFX','film-video-production'],['defense training','military-defense'],['VR training','virtual-reality']],
  'vehicles': [['automotive advertising','advertising'],['film & TV','film-video-production'],['game traffic','game-development'],['architectural viz','architecture'],['VR experiences','virtual-reality']],
  'medical-3d-models': [['medical education','medical'],['VR training','virtual-reality'],['film & TV VFX','film-video-production'],['health visualization','medical'],['software demos','software-development']],
  'industrial-equipment': [['industrial visualization','hardware'],['product rendering','advertising'],['game props','game-development'],['film & TV VFX','film-video-production'],['VR training','virtual-reality']],
  'architecture-landmarks': [['architecture visualization','architecture'],['advertising','advertising'],['film & TV VFX','film-video-production'],['VR experiences','virtual-reality'],['game environments','game-development']],
  'other': [['game assets','game-development'],['film & TV VFX','film-video-production'],['product rendering','advertising'],['VR experiences','virtual-reality'],['architectural viz','architecture']],
};
const USE_SENTENCE = {
  'aircraft': 'Ideal for aerospace, military and defense scenes — flight and battlefield simulation, war-game environments, film and TV VFX, and aerospace visualization.',
  'ships': 'A strong fit for naval and maritime scenes — film and TV VFX, game environments, naval simulation and marine visualization.',
  'military-vehicles': 'Built for military and defense scenes — battlefield simulation, war-game environments, defense training and film VFX.',
  'vehicles': 'Great for automotive advertising, film and TV backgrounds, game traffic and architectural visualization.',
  'medical-3d-models': 'Suited to medical education, VR anatomy training, health visualization and film production.',
  'industrial-equipment': 'Useful for industrial visualization, product rendering, game props and technical presentations.',
  'architecture-landmarks': 'Perfect for architecture visualization, advertising, film and TV VFX and VR experiences.',
  'other': 'Ready for game assets, film and TV VFX, product rendering and VR experiences.',
};

// ---- загрузка каталога ----
function loadAll() {
  const chunks = fs.readdirSync(DATA).filter(f => /^fc-chunk-\d+\.json$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const all = [];
  for (const f of chunks) {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, f)));
    for (let j = 0; j < d.i.length; j++) all.push({ id: d.i[j], name: d.n[j], price: d.p[j] });
  }
  const img = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^fc-img-chunk-\d+\.json$/.test(f))) {
    try { Object.assign(img, JSON.parse(fs.readFileSync(path.join(DATA, f)))); } catch {}
  }
  return { all, img };
}

// ---- подбор похожих ----
function relatedFor(model, all, img, toks, k = 6) {
  // toks[j] — предподсчитанный массив токенов all[j] (не токенизируем на каждой странице заново).
  const st = new Set(tokensOf(model.name));
  const scored = [];
  for (let j = 0; j < all.length; j++) {
    if (all[j].id === model.id) continue;
    const t = toks[j];
    let inter = 0; for (let x = 0; x < t.length; x++) if (st.has(t[x])) inter++;
    if (inter === 0) continue;
    scored.push({ j, s: inter, p: all[j].price });
  }
  scored.sort((a, b) => b.s - a.s || b.p - a.p);
  const out = [];
  for (const { j } of scored) {
    const m = all[j];
    if (!img[m.id]) continue;
    const slug = slugify(m.name) + '-' + m.id;
    if (!fs.existsSync(path.join(MODELS, slug, 'index.html'))) continue;
    out.push({ id: m.id, name: m.name, price: m.price, slug, img: img[m.id], cat: classify(m.name) });
    if (out.length >= k) break;
  }
  return out;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imgAttrs = url => `data-fallback="${url}" data-placeholder="${PLACEHOLDER}" onerror="imgErr(this)"`;

function description(name, price, cls, rigged, cert) {
  let s = `The ${esc(name)} is a production-ready ${cls.disp} 3D model, available at $${price} on TurboSquid.`;
  if (rigged && cert) s += ` It ships rigged for animation and is CheckMate certified, so you get clean topology, correct real-world scale and reliable, production-grade geometry.`;
  else if (cert) s += ` It is CheckMate certified, so you get clean topology, correct real-world scale and reliable, production-grade geometry.`;
  else if (rigged) s += ` It ships rigged for animation, with clean topology and correct real-world scale.`;
  else s += ` It is built with clean topology and correct real-world scale for production use.`;
  s += ` ${(USE_SENTENCE[cls.slug]||USE_SENTENCE.other)}`;
  return s;
}

function renderMain(d) {
  const { name, id, price, hero, tsUrl, cls, rel, rigged, cert, keywords } = d;
  const catHref = `/categories/${cls.slug}/`;
  const used = (IND[cls.slug]||IND.other).map(([n]) => `<span class="chip chip--sm">${n}</span>`).join(' ');
  const uses = (USES[cls.slug]||USES.other).map(([l, h]) => `<a href="/industries/${h}/" class="chip chip--sm">${l}</a>`).join(' ');
  const kw = keywords.map(k => `<a href="/search/?q=${encodeURIComponent(k)}" class="chip chip--kw">${esc(k)}</a>`).join(' ');
  const subjectChip = cls.subject ? ` <span class="chip chip--sm">${esc(cls.subject)}</span>` : '';
  const cards = rel.map(r => `        <a href="/models/${r.slug}/" class="model-card card-glow mp-rc-link">
        <div class="img-wrap mp-rc-img-wrap">
          <img src="${r.img}" alt="${esc(r.name)}" width="800" height="450" decoding="async" loading="lazy" ${imgAttrs(r.img)}><div class="img-placeholder"><span class="mp-rc-placeholder-icon">&#128247;</span></div>
        </div>
        <div class="mp-rc-body">
          <div class="mp-rc-head"><div class="mp-rc-title">${esc(r.name)}</div></div>
          <div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">${r.cat.disp}</span><span class="mp-rc-price">$${r.price}</span></div>
        </div>
      </a>`).join('\n');
  const certBadge = cert ? `\n          <span class="cert-badge">&#10003;&nbsp;CheckMate Certified</span>` : '';
  const certRows = cert
    ? `            <div class="mp-info-row"><span class="mp-info-row-label">Rig</span><span class="mp-info-row-val-sm">${rigged ? 'Rigged' : 'Static'}</span></div>
            <div class="mp-info-row-last">
              <span class="mp-info-row-label">Certification</span>
              <span class="mp-cert-gold">CheckMate</span>
            </div>`
    : `            <div class="mp-info-row-last"><span class="mp-info-row-label">Rig</span><span class="mp-info-row-val-sm">${rigged ? 'Rigged' : 'Static'}</span></div>`;
  const certCard = cert ? `        <div class="mp-cert-card"><div class="mp-cert-card-label">Quality Certified</div><p class="mp-cert-card-text">CheckMate Lite/Pro — passed TurboSquid's topology, scale and UV quality audit.</p></div>\n` : '';
  return `<main id="main-content" class="mp-main">
<div class="mp-bc-bar">
  <div class="max-w-7xl mx-auto px-6 py-3 mp-bc-inner">
    <a href="/" class="mp-bc-link">Home</a>
    <span class="mp-bc-sep">&#8250;</span>
    <a href="${catHref}" class="mp-bc-link">${cls.disp}</a>
    <span class="mp-bc-sep">&#8250;</span>
    <span class="mp-bc-current">${esc(name)}</span>
  </div>
</div>
<section class="mp-hero-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-hero-grid">
      <div class="hero-img-frame mp-hero-frame">
        <img src="${hero}" alt="${esc(name)} 3D model preview" width="1200" height="675" decoding="async" loading="eager" fetchpriority="high" class="mp-hero-img" ${imgAttrs(hero)}>
        <div class="img-placeholder mp-placeholder"><span class="mp-placeholder-icon">&#128247;</span><span class="mp-placeholder-cat">${cls.disp}</span></div>
      </div>
      <div class="mp-info-col">
        <div class="mp-badge-row">
          <a href="${catHref}" class="chip chip-teal chip--sm">${cls.disp}</a>${subjectChip}${certBadge}
        </div>
        <h1 class="mp-h1">${esc(name)}</h1>
        <div class="mp-price-row">
          <span class="mp-price">$${price}</span>
          <span class="mp-price-label">USD on TurboSquid</span>
        </div>
        <div class="mp-ctas">
          <a href="${tsUrl}" target="_blank" rel="noopener" class="btn-primary mp-btn-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View on TurboSquid
          </a>
          <a href="${catHref}" class="btn-ghost mp-btn-browse">
            Browse ${cls.disp} Models
          </a>
        </div>
        <div class="mp-industries"><div class="mp-field-label">Used In</div><div class="mp-chip-row">${used}</div></div>
      </div>
    </div>
  </div>
</section>
<section class="mp-details-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-details-grid">
      <div class="mp-details-left">
        <div>
          <div class="section-label mp-mb12">About This Model</div>
          <p class="mp-desc-text">${d.desc}</p>
        </div>
        <div><div class="section-label mp-mb12">Use Cases</div><div class="mp-chip-row-8">${uses}</div></div>
        <div><div class="section-label mp-mb12">Search Keywords</div><div class="mp-chip-row">${kw}</div></div>
      </div>
      <div class="mp-sidebar-col">
        <div class="mp-info-card">
          <div class="section-label mp-mb14">Quick Info</div>
          <div class="mp-info-rows">
            <div class="mp-info-row">
              <span class="mp-info-row-label">Price</span>
              <span class="mp-info-row-val">$${price}</span>
            </div>
            <div class="mp-info-row">
              <span class="mp-info-row-label">Category</span>
              <a href="${catHref}" class="mp-cat-link">${cls.disp}</a>
            </div>
${certRows}
          </div>
        </div>
${certCard}        <a href="${tsUrl}" target="_blank" rel="noopener" class="btn-ts-lg mp-btn-full">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Buy on TurboSquid
        </a>
      </div>
    </div>
  </div>
</section>
<section class="mp-related-section"><div class="max-w-7xl mx-auto"><div class="section-label mp-mb8">More in ${cls.disp}</div><h2 class="mp-related-h2">Related 3D Models</h2><div class="mp-related-grid">
${cards}
    </div></div></section>
<section class="mp-cta-section" aria-label="Custom order">
  <div class="mp-cta-inner">
    <div class="mp-cta-card">
      <div class="mp-cta-text">
        <div class="section-label mp-mb8">Custom Order</div>
        <h2 class="mp-cta-heading">Need a similar custom 3D model?</h2>
        <p class="mp-cta-desc">Get a model built to your exact specifications — dimensions, file format, topology, rigging or any technical requirement. Professional delivery within agreed timelines.</p>
      </div>
      <a href="/custom-order/" class="btn-primary mp-cta-btn">Request Custom Model &#8594;</a>
    </div>
  </div>
</section>
</main>`;
}

function productSchema(d) {
  return `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: d.name,
    url: `https://3dmolierstudio.com/models/${d.slug}/`, image: d.hero,
    description: d.desc.replace(/&amp;/g, '&').replace(/&#x27;/g, "'"),
    brand: { '@type': 'Brand', name: '3D Molier' }, category: d.cls.disp,
    offers: { '@type': 'Offer', price: (+d.price).toFixed(2), priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: d.tsUrl, seller: { '@type': 'Organization', name: 'TurboSquid' } },
  })}\n</script>`;
}
function breadcrumbSchema(d) {
  return `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://3dmolierstudio.com/' },
      { '@type': 'ListItem', position: 2, name: d.cls.disp, item: `https://3dmolierstudio.com/categories/${d.cls.slug}/` },
      { '@type': 'ListItem', position: 3, name: d.name, item: `https://3dmolierstudio.com/models/${d.slug}/` },
    ],
  })}\n</script>`;
}

// ---- обработка одной страницы ----
function enhance(slug, all, img, toks, force) {
  const file = path.join(MODELS, slug, 'index.html');
  if (!fs.existsSync(file)) return { slug, skip: 'нет файла' };
  let html = fs.readFileSync(file, 'utf8');
  if (!force && html.includes('mp-related-section')) return { slug, skip: 'уже обогащена' };

  const id = (slug.match(/-(\d+)$/) || [])[1];
  const name = (html.match(/<h1 class="mp-h1">\s*([\s\S]*?)\s*<\/h1>/) || [])[1]?.replace(/\s+/g, ' ').trim();
  const price = (html.match(/<span class="mp-price">\$([\d.]+)<\/span>/) || [])[1];
  const hero = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
  const tsUrl = (html.match(/href="(https:\/\/www\.turbosquid\.com\/3d-models\/[^"]+referral=[^"]+)"/) || [])[1];
  if (!id || !name || !price || !hero || !tsUrl) return { slug, skip: 'не извлеклись поля' };

  const cls = classify(name);
  const rigged = /\brig(ged)?\b/i.test(name);
  const cert = /CheckMate/i.test(html);
  const rel = relatedFor({ id: +id, name }, all, img, toks, 6);
  if (rel.length < 3) return { slug, skip: `мало похожих (${rel.length})` };
  const kws = [...tokensOf(name).slice(0, 4), cls.disp.split(' ')[0].toLowerCase()].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
  const desc = description(name, price, cls, rigged, cert);
  const d = { name, id, price, slug, hero, tsUrl, cls, rel, rigged, cert, keywords: kws, desc };

  // 1) main
  html = html.replace(/<main id="main-content"[\s\S]*<\/main>/, renderMain(d));
  // 2) схемы (Product + BreadcrumbList)
  html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"@type":\s*"Product"[^]*?<\/script>/, productSchema(d));
  html = html.replace(/<script type="application\/ld\+json">\s*\{[^]*?"BreadcrumbList"[^]*?<\/script>/, breadcrumbSchema(d));
  // 3) футер back-link
  html = html.replace(/<a href="\/(?:full-catalog|categories\/[a-z0-9-]+)\/" class="nav-link mp-back-link">&#8592; (?:Full Catalog|All [^<]+)<\/a>/,
    `<a href="/categories/${cls.slug}/" class="nav-link mp-back-link">&#8592; All ${cls.disp} Models</a>`);

  return { slug, html, cls: cls.disp, rel: rel.length };
}

// ---- выбор батча ----
function listThinSlugs() {
  return fs.readdirSync(MODELS).filter(n => fs.existsSync(path.join(MODELS, n, 'index.html')));
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const force = args.includes('--force');
  const { all, img } = loadAll();
  const toks = all.map(m => tokensOf(m.name)); // предподсчёт токенов (для быстрого подбора похожих)
  console.error(`Каталог: ${all.length} моделей, ${Object.keys(img).length} картинок.`);

  let targets;
  if (args.includes('--all')) {
    targets = listThinSlugs(); // все папки; enhance() пропустит уже обогащённые
  } else if (args.includes('--file')) {
    targets = fs.readFileSync(args[args.indexOf('--file') + 1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } else if (args.includes('--slugs')) {
    targets = args[args.indexOf('--slugs') + 1].split(',');
  } else if (args.includes('--pilot')) {
    const N = +args[args.indexOf('--pilot') + 1] || 500;
    const perCat = Math.ceil(N / 8);
    const buckets = {}; const picked = [];
    const dirs = listThinSlugs();
    for (const slug of dirs) {
      if (picked.length >= N) break;
      const file = path.join(MODELS, slug, 'index.html');
      let head;
      try { head = fs.readFileSync(file, 'utf8'); } catch { continue; }
      if (head.includes('mp-related-section')) continue; // rich
      const name = (head.match(/<h1 class="mp-h1">\s*([\s\S]*?)\s*<\/h1>/) || [])[1];
      if (!name) continue;
      const c = classify(name).slug;
      buckets[c] = (buckets[c] || 0);
      if (buckets[c] >= perCat) continue;
      buckets[c]++; picked.push(slug);
    }
    targets = picked;
    console.error('Пилот по категориям:', JSON.stringify(buckets));
  } else {
    console.error('Укажи --pilot N | --all | --slugs a,b'); process.exit(1);
  }

  let ok = 0, skip = 0, done = 0; const skips = {}; const written = [];
  const t0 = Date.now();
  for (const slug of targets) {
    const r = enhance(slug.trim(), all, img, toks, force);
    if (r.skip) { skip++; skips[r.skip] = (skips[r.skip] || 0) + 1; }
    else { if (!dry) { fs.writeFileSync(path.join(MODELS, r.slug, 'index.html'), r.html); written.push(r.slug); } ok++; }
    if (++done % 5000 === 0) console.error(`  прогресс: ${done}/${targets.length} (обогащено ${ok}, ${((Date.now()-t0)/1000).toFixed(0)}s)`);
  }
  if (!dry && written.length) {
    fs.writeFileSync(path.join(ROOT, 'scripts', 'enhanced-batch.txt'), written.join('\n') + '\n');
  }
  console.error(`\nОбогащено: ${ok}${dry ? ' (dry-run, не записано)' : ''}. Пропущено: ${skip}.`, JSON.stringify(skips));
  if (!dry) console.error(`Список изменённых: scripts/enhanced-batch.txt (${written.length} слагов).`);
}
main();
