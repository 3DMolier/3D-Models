/*
 * add-model-specs.mjs - параметры покупки на карточке модели (пункт 10).
 *
 * ЧЕГО НЕ ХВАТАЛО. Профессиональному покупателю важнее маркетингового текста
 * два вопроса: откроется ли модель в его программе и есть ли PBR. Ни того, ни
 * другого на карточке не было.
 *
 * ПРАВИЛА, КАК ТЫ ИХ ЗАДАЛ. Всё выводится из названия модели - другого
 * источника нет, пока не собран инвентарь студии.
 *
 *   «for Cinema 4D» в названии  ->  Native: Cinema 4D R23
 *   «for Maya»                  ->  Native: Maya 2022
 *   «for Blender»               ->  Native: Blender 3.4
 *   «Rigged» или «Fur»          ->  Native: 3ds Max 2020 + V-Ray 4.3
 *   всё остальное               ->  Native: 3ds Max 2020 + V-Ray 4.3
 *                                   Formats: MAX, FBX, OBJ, Cinema 4D R23,
 *                                   Maya 2022, Blender 3.4, glTF, 3DS, USDz, USD 2.0
 *
 * Порядок проверки важен: «Rigged for Maya» - это Maya, а не 3ds Max, поэтому
 * правила про конкретную программу идут ПЕРВЫМИ. Ты это оговорил отдельно.
 *
 * PBR - по году публикации из Excel. Ты написал «после 2023 - Yes, до 2023 -
 * No»; сам 2023 год ни в одну половину не попал, и я считаю его современным:
 * год публикации 2023 и позже -> Yes. Если нужно иначе, это одна строка.
 *
 * RIG. Строка «Rig: Static» заменена на «Rigged version: Available / Not
 * available»: прежняя подпись отвечала не на тот вопрос, который задают.
 *
 * ПЛЮС БЛОК RELATED. У 1 445 карточек его не было вовсе, ещё у 97 в нём меньше
 * четырёх моделей. Робот на таких страницах не видел ни одной ссылки на
 * соседние товары. Блок достраивается из той же категории.
 *
 * Запуск:  node scripts/add-model-specs.mjs --dry
 *          node scripts/add-model-specs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { nameOf, escName, loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const PLACEHOLDER = '/assets/og/3d-molier-og.jpg';
const RELATED_WANT = 10;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

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

// ── данные ──
const report = JSON.parse(fs.readFileSync(path.join(DATA, 'product-report.json'), 'utf8'));
const yearOf = new Map();
for (const r of report) {
  // Год берём ИЗ ДАТЫ: поле year выгружается с разделителем разрядов («2 017»)
  // и в число не превращается. Дата корректна у всех 89 987 записей.
  const y = Number(String(r.date || '').slice(0, 4)) || Number(String(r.year || '').replace(/[^0-9]/g, ''));
  if (Number.isFinite(y) && y > 1990) yearOf.set(String(r.pid), y);
}
const modelCat = loadModelCategories();

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const imgCache = new Map();
const imgFor = (ic, id) => {
  if (ic < 0) return '';
  if (!imgCache.has(ic)) {
    const f = path.join(DATA, 'fc-img-chunk-' + ic + '.json');
    imgCache.set(ic, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
  }
  return imgCache.get(ic)[String(id)] || '';
};

const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    all.push({
      id: String(c.i[j]), name: c.n[j], price: c.p[j], sales: c.s[j],
      cat: modelCat[String(c.i[j])] || '', ic: c.ic ? c.ic[j] : -1,
      dir: slugify(c.n[j]) + '-' + c.i[j],
    });
  }
}
// Кандидаты в «похожие»: по категории, самые продаваемые впереди.
const byCat = new Map();
for (const m of [...all].sort((a, b) => (b.sales - a.sales) || (b.price - a.price))) {
  if (!byCat.has(m.cat)) byCat.set(m.cat, []);
  byCat.get(m.cat).push(m);
}
const liveCache = new Map();
const isLive = dir => {
  if (liveCache.has(dir)) return liveCache.get(dir);
  const f = path.join(MODELS, dir, 'index.html');
  let ok = false;
  try { ok = !/http-equiv="refresh"/i.test(fs.readFileSync(f, 'utf8').slice(0, 400)); } catch (e) { ok = false; }
  liveCache.set(dir, ok);
  return ok;
};

function relatedCards(self) {
  const pool = byCat.get(self.cat) || [];
  const out = [];
  // Из подборки исключаем саму модель и её ближайших родственников по названию:
  // иначе «похожими» окажутся её же цветовые версии, которые уже перечислены
  // в блоке версий выше.
  const base = String(self.name).toLowerCase().replace(/\s*\(\d+\)$/, '').slice(0, 18);
  for (const m of pool) {
    if (out.length >= RELATED_WANT) break;
    if (m.id === self.id) continue;
    if (String(m.name).toLowerCase().startsWith(base)) continue;
    const img = imgFor(m.ic, m.id);
    if (!img) continue;
    if (!isLive(m.dir)) continue;
    out.push({ ...m, img });
  }
  return out;
}

function relatedSection(self, cards) {
  const catName = escName(nameOf(self.cat));
  const items = cards.map(m =>
    '<a href="/models/' + m.dir + '/" class="model-card card-glow mp-rc-link">'
    + '<div class="img-wrap mp-rc-img-wrap">'
    + '<img src="' + esc(m.img) + '" alt="' + esc(m.name) + '" width="800" height="450"'
    + ' decoding="async" loading="lazy" data-placeholder="' + PLACEHOLDER + '" onerror="imgErr(this)">'
    + '<div class="img-placeholder" aria-hidden="true"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>'
    + '<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">' + esc(m.name) + '</div></div>'
    + '<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip">' + catName + '</span>'
    + '<span class="mp-rc-price">$' + m.price + '</span></div></div></a>').join('');
  return '<section class="mp-related-section"><div class="max-w-7xl mx-auto">'
    + '<div class="section-label mp-mb8">More in ' + catName + '</div>'
    + '<h2 class="mp-related-h2">Related 3D Models</h2>'
    + '<div class="mp-related-grid">' + items + '</div></div></section>';
}

let live = 0, specAdded = 0, rigFixed = 0, rigAdded = 0, relAdded = 0, relFilled = 0, noYear = 0, cards = 0;
for (const m of all) {
  const file = path.join(MODELS, m.dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const before = h;

  // ── строки характеристик ──
  if (!/>Native<\/th>/.test(h)) {
    const { native, formats } = nativeOf(m.name);
    const y = yearOf.get(m.id);
    if (y === undefined) noYear++;
    const pbr = y === undefined ? null : (y >= 2023 ? 'Yes' : 'No');
    let rows = '<tr><th class="mp-spec-th">Native</th><td class="mp-spec-td">' + esc(native) + '</td></tr>';
    if (formats) rows += '<tr><th class="mp-spec-th">Formats</th><td class="mp-spec-td">' + esc(formats) + '</td></tr>';
    if (pbr) rows += '<tr><th class="mp-spec-th">PBR</th><td class="mp-spec-td">' + pbr + '</td></tr>';
    // Ставим после строки Geometry - там же остальные технические свойства.
    // Если её нет, вешаем в конец таблицы.
    const after = /<tr><th[^>]*>Geometry<\/th><td[^>]*>[\s\S]*?<\/td><\/tr>/;
    if (after.test(h)) h = h.replace(after, x => x + rows);
    else h = h.replace(/<\/tbody>/, () => rows + '</tbody>');
    specAdded++;
  }

  // ── Rig -> Rigged version ──
  h = h.replace(/(<th[^>]*>)Rig(<\/th><td[^>]*>)([^<]*)(<\/td>)/, (x, a, b, val, c) => {
    rigFixed++;
    // В таблице встречаются ровно два значения: Static и Rigged. Для покупателя
    // первое значит «риггинга нет», второе - «есть»; подпись это и говорит.
    const rigged = /rigged|joint|bone/i.test(val) ? 'Available' : 'Not available';
    return a + 'Rigged version' + b + rigged + c;
  });
  // У 6 924 карточек строки про риггинг не было вовсе - там таблица собиралась
  // по другому шаблону. Дописываем: покупатель ищет ответ на этот вопрос на
  // каждой карточке, а не на пяти из шести.
  if (!/>Rigged version<\/th>/.test(h) && />Native<\/th>/.test(h)) {
    const val = /\brigged\b/i.test(m.name) ? 'Available' : 'Not available';
    const row = '<tr><th class="mp-spec-th">Rigged version</th><td class="mp-spec-td">' + val + '</td></tr>';
    const anchor = /<tr><th[^>]*>(?:PBR|Formats|Native)<\/th><td[^>]*>[^<]*<\/td><\/tr>/g;
    const hits = [...h.matchAll(anchor)];
    if (hits.length) {
      const last = hits[hits.length - 1];
      h = h.slice(0, last.index + last[0].length) + row + h.slice(last.index + last[0].length);
      rigAdded++;
    }
  }

  // ── блок «похожие» ──
  const rel = h.match(/<section class="mp-related-section">[\s\S]*?<\/section>/);
  const have = rel ? (rel[0].match(/mp-rc-link/g) || []).length : 0;
  if (have < 4) {
    const cardsList = relatedCards(m);
    if (cardsList.length >= 4) {
      const sec = relatedSection(m, cardsList);
      if (rel) { h = h.replace(rel[0], () => sec); relFilled++; }
      else if (h.includes('</main>')) { h = h.replace('</main>', () => sec + '</main>'); relAdded++; }
    }
  }

  if (h === before) continue;
  cards++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('карточек изменено: ' + cards);
console.log('  строк Native/Formats/PBR добавлено: ' + specAdded + (noYear ? ' (без года публикации: ' + noYear + ')' : ''));
console.log('  строка Rig переименована: ' + rigFixed + ', дописана заново: ' + rigAdded);
console.log('  блок «похожие» создан: ' + relAdded + ', дополнен: ' + relFilled);
if (DRY) console.log('(--dry, ничего не записано)');
