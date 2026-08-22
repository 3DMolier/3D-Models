/*
 * build-lead-block.mjs — самодостаточный блок в 134-167 слов в начале карточки.
 *
 * Зачем. Разбор seo-geo показал: цитируемый языковыми моделями блок должен быть
 * длиной 134-167 слов и читаться без остального текста. У нас таких блоков не
 * было ни одного - после разбивки описания на абзацы самый длинный вышел 80 слов.
 * При этом 44% цитат берутся из первой трети страницы.
 *
 * Что делает. Берёт ЖИВУЮ карточку, вытаскивает факты из её же таблицы
 * характеристик (там уже есть полигоны, вершины, геометрия, риг, текстуры,
 * развёртка, сертификация, цена, год) и складывает из них один абзац нужной
 * длины. Ставит его первым в разделе About This Model.
 *
 * Ничего не выдумывается: каждая цифра берётся со страницы. Формулировки
 * выбираются по идентификатору модели, чтобы соседние карточки не читались
 * под копирку.
 *
 * Запуск:  node build-lead-block.mjs slug1,slug2,slug3 [--outdir preview/lead]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const SLUGS = (argv.find(a => !a.startsWith('--')) || '').split(',').filter(Boolean);
const OUTDIR = argv.includes('--outdir') ? argv[argv.indexOf('--outdir') + 1] : 'preview/lead';

const esc = s => String(s == null ? '' : s)
  .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Факты берём из таблицы характеристик самой карточки.
function facts(html) {
  const f = {};
  for (const m of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const k = m[1].replace(/<[^>]+>/g, '').trim();
    const v = m[2].replace(/<[^>]+>/g, '').trim();
    if (k) f[k] = v;
  }
  f.h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
  return f;
}

const words = s => s.trim().split(/\s+/).filter(Boolean).length;

function compose(f, seed) {
  const pick = (arr, k) => arr[Math.abs(seed + k) % arr.length];
  const name = f.Model || f.h1;
  const cat = f.Category || 'model';
  const price = f.Price || '';
  const poly = f.Polygons || '';
  const vert = f.Vertices || '';
  const geom = (f.Geometry || '').toLowerCase();
  const tex = f.Textures || '';
  // В таблице развёртка записана как «Yes, non-overlapping» - в предложение это
  // вставляется как «with yes, non-overlapping UVs». Оставляем только суть.
  const uv = String(f['UV mapping'] || '').replace(/^\s*yes\s*,?\s*/i, '').trim();
  const rig = f.Rig || '';
  const cert = f.Certification || '';
  const year = f['On sale since'] || '';
  const scale = f['Real-world scale'] || '';
  const lic = f.Licence || '';

  const n = Number(String(poly).replace(/[^\d]/g, '')) || 0;
  const weight = n > 800000 ? 'heavy' : n > 200000 ? 'mid-weight' : 'light';

  const out = [];

  out.push(pick([
    `The ${name} is a production-ready ${cat} 3D model from the 3D Molier catalogue${price ? ', priced at ' + price + ' on TurboSquid' : ''}.`,
    `${name} is a finished ${cat} asset in the 3D Molier catalogue${price ? ', sold at ' + price + ' through TurboSquid' : ''}.`,
    `In the 3D Molier catalogue, ${name} is a ${cat} model built for production use${price ? ' and listed at ' + price + ' on TurboSquid' : ''}.`,
  ], 0));

  if (poly && vert) {
    out.push(pick([
      `Its mesh carries ${poly} polygons over ${vert} vertices${geom ? ', built as ' + geom : ''}, which places it in the ${weight} bracket: dense enough to hold up under close framing, and predictable about what it costs a populated scene.`,
      `The geometry counts ${poly} polygons and ${vert} vertices${geom ? ' in ' + geom : ''}, a ${weight} build that survives a close camera without turning the scene budget into a problem.`,
      `Counted at the source, the model is ${poly} polygons and ${vert} vertices${geom ? ' of ' + geom : ''} - a ${weight} asset whose cost to a scene is known before it is imported.`,
    ], 1));
  }

  if (tex) {
    out.push(pick([
      `Texture work runs to ${tex}${uv ? ', ' + uv.toLowerCase() + ' UVs' : ''}, so surfaces stay sharp as the camera moves in and materials can be re-authored without unwrapping the model again.`,
      `It ships ${tex}${uv ? ' and ' + uv.toLowerCase() + ' UVs' : ''}, which is enough resolution to fill a frame rather than sit blurred in the background.`,
      `Surfacing is handled by ${tex}${uv ? ', laid out with ' + uv.toLowerCase() + ' UVs' : ''} - detail that only shows once the shot gets close.`,
    ], 2));
  }

  if (rig) {
    out.push(/rigged/i.test(rig)
      ? `The model is rigged, so it can be posed or animated without rebuilding the hierarchy first.`
      : `It is a static build rather than a jointed one, so there is no rig to strip out when the model is only needed as a rendered object.`);
  }

  if (cert) {
    out.push(pick([
      `It carries TurboSquid's ${cert} certification, meaning a reviewer manually checked topology, object and material naming${scale ? ' and real-world scale' : ''} before it went on sale${year ? ' in ' + year : ''}.`,
      `${cert} certification means the mesh passed TurboSquid's manual audit - clean topology, named objects and materials${scale ? ', correct real-world scale' : ''} - before publication${year ? ' in ' + year : ''}.`,
    ], 3));
  } else if (year) {
    out.push(`The listing dates back to ${year} and is still maintained as part of the active catalogue.`);
  }

  if (lic) out.push(`Delivery is under the ${lic} licence, a single purchase covering commercial work.`);

  return out.join(' ');
}

fs.mkdirSync(path.join(ROOT, OUTDIR), { recursive: true });
const made = [];
for (const slug of SLUGS) {
  const src = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(src)) { console.log('  нет карточки: ' + slug); continue; }
  let html = fs.readFileSync(src, 'utf8');
  const f = facts(html);
  const seed = Number((slug.match(/-(\d+)$/) || [])[1]) || 0;

  let text = compose(f, seed);
  let w = words(text);
  // Целимся в 134-167 слов. Короче - добавляем предложение о применении,
  // длиннее - снимаем последнее.
  if (w < 134) {
    const uses = [...html.matchAll(/class="chip chip--sm">([^<]+)</g)].map(m => m[1]).slice(0, 4);
    if (uses.length) text += ` Typical use covers ${uses.join(', ')}, where the object has to read correctly on camera without becoming the subject of the shot.`;
    w = words(text);
  }
  while (w > 167) {
    const parts = text.split(/(?<=\.)\s+/);
    parts.pop();
    text = parts.join(' ');
    w = words(text);
  }

  const block = `<p class="mp-desc-text mp-lead">${esc(text)}</p>`;
  // Ставим первым абзацем раздела About This Model.
  const before = html;
  html = html.replace(/<p class="mp-desc-text">/, () => block + '<p class="mp-desc-text">');
  if (html === before) { console.log('  не нашёл описание: ' + slug); continue; }

  const style = `<style>.mp-lead{font-size:16px;line-height:1.75;color:#1f2937;`
    + `border-left:3px solid #d4d4d4;padding-left:16px}`
    + `@media(prefers-color-scheme:dark){.mp-lead{color:#e5e7eb;border-color:#3a3f4a}}</style>`;
  html = html.replace('</head>', style + '</head>');
  if (!/name="robots"/.test(html)) html = html.replace('</title>', '</title>\n<meta name="robots" content="noindex, nofollow">');

  const dir = path.join(ROOT, OUTDIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  made.push({ slug, w });
  console.log('  ' + slug.padEnd(42) + w + ' слов');
}
console.log('\nготово: ' + made.length);
made.forEach(m => {
  console.log('  старая: https://3dmolierstudio.com/models/' + m.slug + '/');
  console.log('  новая:  https://3dmolierstudio.com/' + OUTDIR + '/' + m.slug + '/');
});
