// polish-card-meta.mjs - доводка мета-данных карточек модели.
//
// Три правки, все идемпотентные, можно гонять повторно:
//
//   1. Длинное тире в <title>. Генератор ставил «Tesla Model 3 3D Model - $149»,
//      а правило проекта - только дефис. Меняем на «-» в title, og:title и
//      twitter:title. В видимом тексте страницы тире не трогаем.
//
//   2. Короткое описание. Шаблон давал 102-116 знаков при полезных 150-160:
//      «Buy X 3D model by 3D Molier on TurboSquid. CheckMate Lite certified.
//      Vehicles asset, $149.» Дописываем назначение из строки «Typical use»
//      таблицы характеристик - она у каждой карточки своя, поэтому описания
//      остаются разными, а не шаблонными. Длиннее 160 не делаем: режем по слову.
//
//   3. У ProductGroup нет variesBy. Есть productGroupID и hasVariant, но не сказано,
//      ЧЕМ отличаются версии. Ось выводим из подписей вариантов: только цвета -
//      schema.org/color, иначе текстом «version».
//
// Заглушки не трогаем: у них нет ни таблицы, ни разметки товара.
//
// Запуск:  node scripts/polish-card-meta.mjs --dry            посчитать
//          node scripts/polish-card-meta.mjs --dry --sample slug   показать до/после
//          node scripts/polish-card-meta.mjs                  выполнить

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const si = process.argv.indexOf('--sample');
const SAMPLE = si !== -1 ? process.argv[si + 1] : null;

const DESC_MIN = 150, DESC_MAX = 160;

// Значение из match - срез, удерживающий всю страницу. На 58 тысячах карточек
// такие срезы уже дважды роняли прогоны по памяти. Копируем в свою строку.
const copy = s => Buffer.from(String(s), 'utf8').toString('utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const COLOR_WORD = /^(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|camouflage|desert|olive|beige|pink|purple|maroon)(\s*\+\s*\w+)*$/i;

// ── 1. длинное тире в заголовках ──
function fixDash(h) {
  let out = h;
  out = out.replace(/<title>([\s\S]*?)<\/title>/, (m, t) =>
    '<title>' + t.replace(/\s*(?:-|-|-)\s*/g, ' - ') + '</title>');
  out = out.replace(/(<meta (?:property="og:title"|name="twitter:title") content=")([^"]*)(")/g,
    (m, a, t, c) => a + t.replace(/\s*(?:-|-|-)\s*/g, ' - ') + c);
  return out;
}

// ── 2. описание ──
// «Typical use» берём из таблицы характеристик: строка вида
// <tr><th scope="row">Typical use</th><td>visualization, advertising, 3D printing</td></tr>
function typicalUse(h) {
  const m = h.match(/<th[^>]*>\s*Typical use\s*<\/th>\s*<td[^>]*>([^<]*)<\/td>/i);
  return m ? copy(unesc(m[1]).trim()) : null;
}

function extendDesc(desc, use) {
  if (!use) return null;
  if (desc.length >= DESC_MIN) return null;              // уже достаточно длинное
  if (/\bBuilt for\b/i.test(desc)) return null;          // уже дописано прошлым прогоном
  const tail = ' Built for ' + use.replace(/\s*,\s*$/, '') + '.';
  let out = desc.replace(/\s+$/, '') + tail;
  if (out.length <= DESC_MAX) return out;
  // Не влезло целиком - режем хвост по запятой, потом по слову.
  const room = DESC_MAX - desc.length - ' Built for .'.length;
  if (room < 12) return null;                            // дописывать нечего
  const parts = use.split(',').map(s => s.trim()).filter(Boolean);
  let acc = '';
  for (const p of parts) {
    const next = acc ? acc + ', ' + p : p;
    if (next.length > room) break;
    acc = next;
  }
  if (!acc) return null;
  out = desc.replace(/\s+$/, '') + ' Built for ' + acc + '.';
  return out.length <= DESC_MAX ? out : null;
}

function fixDesc(h) {
  const m = h.match(/<meta name="description" content="([^"]*)"/);
  if (!m) return { html: h, changed: false };
  const cur = copy(unesc(m[1]));
  const next = extendDesc(cur, typicalUse(h));
  if (!next) return { html: h, changed: false };
  const enc = esc(next);
  let out = h.replace(/(<meta name="description" content=")[^"]*(")/, (x, a, b) => a + enc + b);
  // og и twitter повторяют описание - держим их в согласии, иначе в соцсетях
  // и в предпросмотре останется старый короткий текст.
  const curEnc = m[1];
  out = out.replace(/(<meta property="og:description" content=")([^"]*)(")/,
    (x, a, v, c) => a + (v === curEnc ? enc : v) + c);
  out = out.replace(/(<meta name="twitter:description" content=")([^"]*)(")/,
    (x, a, v, c) => a + (v === curEnc ? enc : v) + c);
  return { html: out, changed: true, before: cur, after: next };
}

// ── 3. variesBy у ProductGroup ──
function axisOf(variants) {
  const labels = variants.map(v => String(v.name || '').trim())
    .filter(n => n && !/^(standard|base|main)$/i.test(n));
  if (!labels.length) return 'version';
  if (labels.every(n => COLOR_WORD.test(n))) return 'https://schema.org/color';
  return 'version';
}

function fixVariesBy(h) {
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let out = h, changed = false, axis = null;
  for (const b of blocks) {
    const raw = b[1].trim();
    if (!raw.includes('"ProductGroup"')) continue;
    let j;
    try { j = JSON.parse(raw); } catch (e) { return { html: h, changed: false, broken: true }; }
    if (Array.isArray(j) || j['@type'] !== 'ProductGroup' || j.variesBy) continue;
    axis = axisOf(j.hasVariant || []);
    // Порядок полей сохраняем: variesBy кладём сразу за productGroupID, как в примерах
    // schema.org, чтобы диффы читались.
    const rebuilt = {};
    for (const [k, v] of Object.entries(j)) {
      rebuilt[k] = v;
      if (k === 'productGroupID') rebuilt.variesBy = axis;
    }
    if (!rebuilt.variesBy) rebuilt.variesBy = axis;
    out = out.replace(b[0], '<script type="application/ld+json">' + JSON.stringify(rebuilt) + '</script>');
    changed = true;
  }
  return { html: out, changed, axis };
}

// ── обход ──
const HEAD = 400;
const headBuf = Buffer.alloc(HEAD);
function isStub(file) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (e) { return true; }
  try {
    const n = fs.readSync(fd, headBuf, 0, HEAD, 0);
    return /http-equiv="refresh"/.test(headBuf.slice(0, n).toString('utf8'));
  } finally { fs.closeSync(fd); }
}

const slugs = fs.readdirSync(MODELS);
let seen = 0, live = 0, touched = 0, dashes = 0, descs = 0, varies = 0, brokenJson = 0;
const axes = {};
const samples = [];

for (const slug of slugs) {
  const file = path.join(MODELS, slug, 'index.html');
  if (++seen % 20000 === 0) console.log('  ' + seen + '/' + slugs.length + '  изменено ' + touched);
  if (isStub(file)) continue;
  live++;
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  const before = h;

  const a = fixDash(h);
  if (a !== h) dashes++;
  const d = fixDesc(a);
  if (d.changed) descs++;
  const v = fixVariesBy(d.html);
  if (v.broken) { brokenJson++; continue; }
  if (v.changed) { varies++; axes[v.axis] = (axes[v.axis] || 0) + 1; }
  const out = v.html;
  if (out === before) continue;

  // преграды: меню на месте, вся разметка разбирается
  if (!out.includes('<a href="/categories/other/" role="menuitem"')) {
    console.log('СТОП: пострадало меню на ' + slug); process.exit(1);
  }
  for (const blk of out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(blk.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { console.log('СТОП: битый JSON-LD на ' + slug); process.exit(1); }
  }
  if (!/<title>[^<]+<\/title>/.test(out)) { console.log('СТОП: пустой title на ' + slug); process.exit(1); }

  if (samples.length < 3 && d.changed && (!SAMPLE || slug === SAMPLE)) {
    samples.push({ slug, before: d.before, after: d.after,
      title: (out.match(/<title>([^<]*)<\/title>/) || [])[1], axis: v.axis });
  }
  if (!DRY) fs.writeFileSync(file, out);
  touched++;
}

console.log('\nпапок просмотрено:  ' + seen);
console.log('живых карточек:     ' + live);
console.log('изменено страниц:   ' + touched + (DRY ? '  (--dry)' : ''));
console.log('  тире в заголовке: ' + dashes);
console.log('  описание дописано:' + descs);
console.log('  variesBy добавлен:' + varies + '  ' + JSON.stringify(axes));
if (brokenJson) console.log('  пропущено из-за битого JSON-LD: ' + brokenJson);
console.log('\nпримеры:');
for (const s of samples) {
  console.log('\n  ' + s.slug);
  console.log('    title:  ' + s.title);
  console.log('    было (' + s.before.length + '):  ' + s.before);
  console.log('    стало (' + s.after.length + '): ' + s.after);
  if (s.axis) console.log('    variesBy: ' + s.axis);
}
