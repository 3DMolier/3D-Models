/*
 * build-seek-find.mjs - предметы для игры /play/seek-and-find/.
 *
 * ЗАЧЕМ. Игра «найди предметы»: сцена из десятков наших моделей, игрок ищет
 * по списку. Новых рендеров не делаем - предметы вырезаются из главных
 * кадров карточек (scripts/lib/cutout.mjs), а сцену раскладывает сама игра
 * в браузере, каждый раз новую.
 *
 * ОТКУДА ДАННЫЕ.
 *   data/records/records-*.json - название, категория, главный кадр, корень семьи.
 *   data/fc-chunk-*.json        - свежая цена (records бывают старее).
 *   data/delisted.json          - снятые с TurboSquid, не берём.
 *   models/<папка>/             - адрес карточки ТОЛЬКО отсюда, по номеру.
 *
 * ОТБОР по темам (категории сайта). Лидеры продаж, одна модель на семью
 * (поле root), без наборов и анатомии. Вырезка проходит, только если предмет
 * один (parts = 1), не касается краёв кадра и не съеден фоном.
 *
 * ВЫХОД. play/seek-and-find/objects.json и play/seek-and-find/img/<номер>.webp
 * (сторона до 360 px, прозрачный фон). Главные кадры кэшируются во временной
 * папке, повторный запуск ничего не скачивает заново.
 *
 * Исключения после просмотра глазами - scripts/games/seek-find-exclude.json.
 *
 * Запуск:  node scripts/build-seek-find.mjs [--limit 185]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { cutout } from './lib/cutout.mjs';

const OUT_DIR = path.join(ROOT, 'play', 'seek-and-find');
const IMG_DIR = path.join(OUT_DIR, 'img');
const CACHE = path.join(os.tmpdir(), '3dmolier-hero-cache');
const LIMIT = +(process.argv[process.argv.indexOf('--limit') + 1]) || 185;

const THEMES = {
  kitchen: { name: 'Kitchen Counter', cats: ['kitchen-tableware', 'food-beverages'] },
  workshop: { name: 'Workshop Bench', cats: ['tools'] },
  gadgets: { name: 'Gadget Desk', cats: ['electronics-gadgets'] },
  toybox: { name: 'Toy Box', cats: ['toys-games', 'sports-recreation'] },
  clinic: { name: "Doctor's Office", cats: ['medical-3d-models'] },
};
const BAD = /\b(collection|set|pack|kit|rigged|cartoon|low ?poly|generic|animated|fur|anatomy|skeleton|skull|bones?|organs?|muscles?|brain|heart|lungs?|liver|kidneys?|stomach|intestines?|colon|veins?|arter(y|ies)|nerv\w*|cells?|teeth|tooth|spine|spinal|spleen|pancreas|uterus|placenta|fetus|ribcage|joint|cross section|cutaway|wireframe|mockup|blank|virus|cocaine|ecstasy|condom|speculum|emoji|head|hands?|eye|tongue|court|park|stadium)\b/i;

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const delisted = new Set(Object.keys(read('data/delisted.json')));
const DIR_BY_ID = new Map();
for (const d of fs.readdirSync(path.join(ROOT, 'models'))) {
  const id = d.slice(d.lastIndexOf('-') + 1);
  if (/^[0-9]+$/.test(id) && !DIR_BY_ID.has(id)) DIR_BY_ID.set(id, d);
}
const price = new Map();
const idx = read('data/fc-index.json');
for (let k = 0; k < idx.chunks; k++) {
  const c = read('data/fc-chunk-' + k + '.json');
  for (let j = 0; j < c.i.length; j++) price.set(String(c.i[j]), Math.round(c.p[j]));
}
const recs = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data/records')).filter(f => /^records-\d+\.json$/.test(f)).sort()) {
  const r = read('data/records/' + f);
  recs.push(...(Array.isArray(r) ? r : Object.values(r)));
}

async function hero(rec) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, rec.id + '.img');
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return f;
  const r = await fetch(rec.image, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('http ' + r.status);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}
// display_name короче, но бывает обрубком («Glass of» у Glass of Ice Tea with Lemon):
// берём его, только если это начало полного имени и он не кончается предлогом
const clean = n => String(n || '').split(' | ')[0].replace(/\s+3D Models?$/i, '').replace(/\s+\d+$/, '').trim();
function shortName(a) {
  const full = clean(a.name), dn = clean(a.display_name);
  return dn && full.startsWith(dn) && !/\b(of|with|and|for|in|on|the|a|an|to)$/i.test(dn) ? dn : full;
}
// просмотр вырезок глазами: белое на светлом столе, площадки, анатомия и неуместное
const EXCLUDE = new Set(read('scripts/games/seek-find-exclude.json').ids.map(String));

fs.mkdirSync(IMG_DIR, { recursive: true });
const out = { built: new Date().toISOString().slice(0, 10), themes: {} };
const keep = new Set();
for (const [key, th] of Object.entries(THEMES)) {
  const pool = recs.filter(a => th.cats.includes(a.category) && a.image && !BAD.test(a.name)
    && !delisted.has(a.id) && DIR_BY_ID.has(a.id) && price.get(a.id) > 0)
    .sort((a, b) => (b.sales || 0) - (a.sales || 0) || a.id.localeCompare(b.id));
  const roots = new Set(), names = new Set(), items = [];
  let tried = 0, rejected = 0;
  for (const a of pool) {
    if (items.length >= LIMIT) break;
    if (EXCLUDE.has(a.id)) continue;
    const nm = shortName(a);
    const root = a.root || a.geometry_id || a.id;
    const base = nm.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    if (roots.has(root) || names.has(base)) continue;
    const dir = DIR_BY_ID.get(a.id);
    const html = fs.readFileSync(path.join(ROOT, 'models', dir, 'index.html'), 'utf8');
    if (/http-equiv=["']?refresh/i.test(html)) continue;
    tried++;
    let r;
    try { r = await cutout(await hero(a), 360); } catch (e) { console.error('  нет кадра', a.id, e.message); continue; }
    const q = r && r.quality;
    if (!q || q.parts !== 1 || q.edgeTouch > 0 || q.fgFrac < 0.02 || q.fgFrac > 0.6 || q.fill < 0.25) { rejected++; continue; }
    fs.writeFileSync(path.join(IMG_DIR, a.id + '.webp'), r.buf);
    keep.add(a.id + '.webp');
    roots.add(root); names.add(base);
    items.push({ i: a.id, s: dir, n: nm, p: price.get(a.id), w: r.w, h: r.h });
  }
  out.themes[key] = { name: th.name, items };
  console.log(`${th.name}: ${items.length} (проверено ${tried}, вырезка не прошла ${rejected})`);
}
// картинки, которых больше нет в наборе, убираем
for (const f of fs.readdirSync(IMG_DIR)) if (!keep.has(f)) fs.unlinkSync(path.join(IMG_DIR, f));
fs.writeFileSync(path.join(OUT_DIR, 'objects.json'), JSON.stringify(out) + '\n');
const bytes = [...keep].reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size, 0);
console.log(`всего ${keep.size} картинок, ${(bytes / 1048576).toFixed(1)} МБ`);
