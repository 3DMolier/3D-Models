/*
 * add-formats-to-cards.mjs - форматы и их количество в таблице характеристик.
 *
 * ЧЕГО ЖДЁТ. data/model-specs.json с полями formats и formatCount. Их пишет
 * scripts/import-studio-inventory.mjs из выгрузки студийного инвентаря, а сам
 * инвентарь собирается в браузере под логином (invStart / await invSave).
 * Пока студийный API отвечает 500, данных нет и скрипт честно скажет об этом,
 * а не проставит пустые строки.
 *
 * ОТКУДА БЕРУТСЯ ФОРМАТЫ. Из списка загруженных файлов модели: сколько файлов -
 * столько форматов, а окончание имени и есть формат (..._max_vray, ..._fbx,
 * ..._c4d). Разбор - в scripts/lib/formats.mjs. Больше этих сведений нигде нет:
 * в models_master.csv таких колонок не существует.
 *
 * КУДА СТАВИМ. Двумя строками таблицы характеристик, сразу после «Geometry»:
 *   Formats        3ds Max + V-Ray, FBX, OBJ, Cinema 4D
 *   Format count   4
 * Плюс тем же составом в разметку товара (additionalProperty), чтобы формат
 * читал не только человек.
 *
 * Запуск:  node scripts/add-formats-to-cards.mjs --dry
 *          node scripts/add-formats-to-cards.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);

const SPECS = path.join(ROOT, 'data', 'model-specs.json');
if (!fs.existsSync(SPECS)) {
  console.error('нет ' + SPECS + ' - сначала импорт инвентаря');
  process.exit(1);
}
const specs = JSON.parse(fs.readFileSync(SPECS, 'utf8'));
const withFormats = Object.entries(specs).filter(([, v]) => v && Array.isArray(v.formats) && v.formats.length);
console.log('записей в model-specs.json: ' + Object.keys(specs).length
  + ', из них с форматами: ' + withFormats.length);
if (!withFormats.length) {
  console.log('\nФорматов пока нет ни у одной модели. Это не ошибка скрипта:');
  console.log('инвентарь студии ещё не собран (её API отвечает 500). Как оживёт -');
  console.log('в консоли вкладки inventory: invStart(), потом await invSave(),');
  console.log('затем node scripts/import-studio-inventory.mjs <файл>, и запустить этот скрипт снова.');
  process.exit(0);
}

// ── куда вставлять ──
// Строку кладём после «Geometry»: там же стоят полигоны и вершины, то есть
// технические свойства модели, а не условия продажи.
const AFTER = /<tr><th[^>]*>Geometry<\/th><td[^>]*>[\s\S]*?<\/td><\/tr>/;

let touched = 0, noCard = 0, alreadyThere = 0, noAnchor = 0;
for (const [id, spec] of withFormats) {
  // Адрес карточки строим тем же правилом, что и каталог.
  const slugFromName = spec.title
    ? String(spec.title).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-').replace(/^-+|-+$/g, '') + '-' + id
    : null;
  const file = slugFromName ? path.join(MODELS, slugFromName, 'index.html') : null;
  if (!file || !fs.existsSync(file)) { noCard++; continue; }

  let h = fs.readFileSync(file, 'utf8');
  if (h.includes('>Formats</th>')) { alreadyThere++; continue; }
  if (!AFTER.test(h)) { noAnchor++; continue; }

  const list = spec.formats.join(', ');
  const count = spec.formatCount || spec.formats.length;
  const rows = '<tr><th class="mp-spec-th">Formats</th><td class="mp-spec-td">' + esc(list) + '</td></tr>'
    + '<tr><th class="mp-spec-th">Format count</th><td class="mp-spec-td">' + count + '</td></tr>';
  h = h.replace(AFTER, x => x + rows);

  // Те же сведения в разметку товара - для машин, а не для глаз.
  // Между тегом и «{» стоит перевод строки - без \s* здесь ничего не совпадает.
  const prod = h.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?"@type"\s*:\s*"Product"[\s\S]*?)<\/script>/);
  if (prod) {
    try {
      const obj = JSON.parse(cp(prod[1]));
      const props = Array.isArray(obj.additionalProperty) ? obj.additionalProperty : [];
      props.push({ '@type': 'PropertyValue', name: 'File formats', value: list });
      props.push({ '@type': 'PropertyValue', name: 'Format count', value: String(count) });
      obj.additionalProperty = props;
      h = h.replace(prod[0], () => '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>');
    } catch (e) { /* разметку не портим: не разобралась - оставили как была */ }
  }

  if (!DRY) fs.writeFileSync(file, h);
  touched++;
}

console.log('карточек с форматами обновлено: ' + touched);
if (alreadyThere) console.log('  форматы уже стояли: ' + alreadyThere);
if (noCard) console.log('  карточки нет на диске: ' + noCard);
if (noAnchor) console.log('  не нашлось строки Geometry, вставлять некуда: ' + noAnchor);
if (DRY) console.log('(--dry, ничего не записано)');
