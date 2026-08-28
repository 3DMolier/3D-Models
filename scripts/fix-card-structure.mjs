/*
 * fix-card-structure.mjs - порядок секций и недостающие характеристики.
 *
 * ДВЕ ВЕЩИ.
 *
 * 1. ПОРЯДОК. На 315 карточках блок «Need a similar custom 3D model?» стоял
 *    ВЫШЕ блока похожих моделей. Это ровно то, на что ты жаловался: робот
 *    доходит до конца страницы и первым видит предложение заказать модель, а не
 *    ссылки на соседние товары. Для человека тоже плохо - предложение сделать
 *    заказ идёт раньше, чем показали, что уже есть. Часть этих карточек - мои:
 *    вчера я дописывал недостающий блок похожих перед </main>, а там уже стоял
 *    Custom Order. Переставляем: похожие, потом предложение заказа.
 *
 * 2. ХАРАКТЕРИСТИКИ ДВУХ КАРТОЧЕК. У endoscope-1245188 и
 *    hydroelectric-dam-1362739 нет ни блока вопросов, ни версий, ни таблицы
 *    характеристик - они собраны по старому шаблону. Достраиваем таблицу.
 *
 *    ЧЕГО В НЕЙ НЕ БУДЕТ. Полигонов, вершин и текстур: этих двух моделей нет в
 *    инвентаре студии (там 1 475 записей), а выдумывать числа в таблице
 *    характеристик нельзя - это те самые данные, по которым принимают решение о
 *    покупке. Ставим только то, что знаем наверняка: категорию, сертификат, год
 *    публикации, лицензию, цену и параметры файла по общим правилам.
 *
 * Запуск:  node scripts/fix-card-structure.mjs --dry
 *          node scripts/fix-card-structure.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { nameOf, escName, loadModelCategories } from './lib/taxonomy.mjs';
import { brandOf } from './lib/brands.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 1. порядок секций ──
let moved = 0, scanned = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  scanned++;
  const cta = h.indexOf('<section class="mp-cta-section"');
  const rel = h.indexOf('<section class="mp-related-section"');
  if (cta < 0 || rel < 0 || cta > rel) continue;

  // Вырезаем блок похожих целиком и ставим его перед предложением заказа.
  const relEnd = h.indexOf('</section>', rel);
  if (relEnd < 0) continue;
  const block = h.slice(rel, relEnd + 10);
  // Убедимся, что внутри нет вложенной </section>, иначе вырежем половину.
  if (block.slice(1).includes('<section')) continue;
  const without = h.slice(0, rel) + h.slice(relEnd + 10);
  const at = without.indexOf('<section class="mp-cta-section"');
  if (at < 0) continue;
  const out = without.slice(0, at) + block + without.slice(at);
  moved++;
  if (!DRY) fs.writeFileSync(file, out);
}
console.log('карточек осмотрено: ' + scanned);
console.log('блок похожих поднят выше предложения заказа: ' + moved);

// ── 2. характеристики двум карточкам ──
const FIX = ['endoscope-1245188', 'hydroelectric-dam-1362739'];
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));
const byPid = new Map(report.map(r => [String(r.pid), r]));
const modelCat = loadModelCategories();

const FORMATS = 'MAX, FBX, OBJ, Cinema 4D R23, Maya 2022, Blender 3.4, glTF, 3DS, USDz, USD 2.0';
const MAX_NATIVE = '3ds Max 2020 + V-Ray 4.3';
function nativeOf(name) {
  const n = String(name);
  if (/\bfor\s+cinema\s*4d\b/i.test(n)) return { native: 'Cinema 4D R23', formats: null };
  if (/\bfor\s+maya\b/i.test(n)) return { native: 'Maya 2022', formats: null };
  if (/\bfor\s+blender\b/i.test(n)) return { native: 'Blender 3.4', formats: null };
  if (/\brigged\b/i.test(n) || /\bfur\b/i.test(n)) return { native: MAX_NATIVE, formats: null };
  return { native: MAX_NATIVE, formats: FORMATS };
}

let built = 0;
for (const dir of FIX) {
  const file = path.join(MODELS, dir, 'index.html');
  if (!fs.existsSync(file)) { console.log('  нет файла: ' + dir); continue; }
  let h = fs.readFileSync(file, 'utf8');
  if (h.includes("<table class=\"mp-spec-table\"")) { console.log('  уже есть таблица: ' + dir); continue; }
  const id = dir.slice(dir.lastIndexOf('-') + 1);
  const r = byPid.get(id);
  if (!r) { console.log('  нет в отчёте: ' + dir); continue; }
  const cat = modelCat[id] || '';
  const year = String(r.date || '').slice(0, 4);
  const { native, formats } = nativeOf(r.name);
  const pbr = Number(year) >= 2023 ? 'Yes' : 'No';
  const licence = brandOf(r.name) ? 'Editorial Uses Only (TurboSquid)' : 'Royalty Free (TurboSquid)';

  const rows = [];
  const row = (k, v) => rows.push('<tr><th scope="row">' + k + '</th><td>' + v + '</td></tr>');
  row('Model', esc(r.name));
  if (cat) row('Category', '<a href="/categories/' + cat + '/">' + escName(nameOf(cat)) + '</a>');
  if (r.cert) row('Certification', esc(r.cert));
  if (year) row('On sale since', year);
  row('Native', esc(native));
  if (formats) row('Formats', esc(formats));
  row('PBR', pbr);
  row('Rigged version', /\brigged\b/i.test(r.name) ? 'Available' : 'Not available');
  row('Licence', licence);
  if (r.price != null) row('Price', '$' + r.price + ' USD');

  const block = '<div class="mp-spec-card"><div class="mp-spec-block">'
    + '<h2 class="mp-block-h2">Specifications</h2>'
    + '<table class="mp-spec-table"><tbody>' + rows.join('') + '</tbody></table>'
    + '</div></div>';

  // Кладём в правую колонку - туда же, где таблица стоит на обычных карточках.
  const side = h.indexOf('<div class="mp-sidebar-col">');
  if (side < 0) { console.log('  нет правой колонки: ' + dir); continue; }
  const at = side + '<div class="mp-sidebar-col">'.length;
  h = h.slice(0, at) + block + h.slice(at);
  built++;
  console.log('  собрана таблица: ' + dir + ' (' + rows.length + ' строк, лицензия ' + licence + ')');
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('таблиц характеристик собрано: ' + built);
if (DRY) console.log('(--dry, ничего не записано)');
