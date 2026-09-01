/*
 * fix-keywords-block.mjs - ключевые слова на каждой карточке и ссылка в каталог.
 *
 * ПУНКТЫ 4 И 5 СПИСКА.
 *
 * 4. У четверти живых карточек блока «Keywords» не было вовсе. Причина: слова
 *    брались из выгрузки студии, а в ней у 11 791 записи поле пустое - у Tesla
 *    Model 3 и у Orchid Flower в том числе. Запасной источник есть и покрывает
 *    все 86 865 строк: колонка seo_keywords в data/models_master.csv.
 *
 *    Там лежат ФРАЗЫ вида «tesla model 3 3d model|vehicle 3d model». Ставить их
 *    в чипы как есть нельзя: по строке «tesla model 3 3d model» поиск в каталоге
 *    не найдёт ничего, потому что ищет по названию модели. Поэтому отрезаем
 *    служебные хвосты «3d model», «for games» и оставляем то, что действительно
 *    встречается в названиях.
 *
 * 5. Чипы вели на /search/?q=… Страница поиска на сайте есть, но пользоваться ею
 *    больше не хотим: поиск живёт в каталоге. Переводим ВСЕ чипы на
 *    /catalog/?q=… Каталог читает этот параметр (см. full-catalog.js).
 *
 * Повторный запуск безопасен.
 *
 * Запуск:  node scripts/fix-keywords-block.mjs --dry
 *          node scripts/fix-keywords-block.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── запасные ключевые слова из models_master.csv ──
const KW = new Map();
{
  const text = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines[0].split(',');
  const iId = head.indexOf('product_id');
  const iKw = head.indexOf('seo_keywords');
  // Разбор строки CSV с кавычками. Свой, потому что тащить зависимость ради
  // одного файла не стоит, а поля здесь простые.
  const cells = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const c = cells(lines[k]);
    const id = c[iId], raw = c[iKw];
    if (!id || !raw) continue;
    const list = [];
    for (let phrase of raw.split('|')) {
      phrase = phrase.toLowerCase()
        .replace(/\b3d\s+models?\b/g, '')
        .replace(/\bfor\s+(games|film|vr|rendering|animation)\b/g, '')
        .replace(/\s+/g, ' ').trim();
      if (phrase.length < 3 || phrase.length > 40) continue;
      if (!list.includes(phrase)) list.push(phrase);
    }
    if (list.length) KW.set(id, list.slice(0, 8));
  }
}
console.log('запасных наборов ключевых слов: ' + KW.size.toLocaleString('ru-RU'));

const chip = k => '<a href="/catalog/?q=' + encodeURIComponent(k) + '" class="chip chip--kw">' + esc(k) + '</a>';

/**
 * Позиция закрывающего тега того <div>, что начинается в start.
 * Считать закрывающие теги на глаз нельзя: блок вопросов вложен в
 * mp-details-left, и вставка «после двух </div>» уводила блок ключевых слов
 * на уровень выше - в mp-details-grid, рядом с боковой колонкой вместо того,
 * чтобы стоять под вопросами. Та же функция работает в apply-card-upgrade.mjs.
 */
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

let live = 0, added = 0, relinked = 0, noSource = 0;
const missing = [];
// --only <часть-имени-папки> - прогнать на нескольких карточках и посмотреть шов
const oi = process.argv.indexOf('--only');
const ONLY = oi > 0 ? process.argv[oi + 1] : null;
const dirs = fs.readdirSync(MODELS).filter(d => !ONLY || d.includes(ONLY));
for (const d of dirs) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const before = h;

  // 5. чипы ведут в каталог
  if (h.includes('class="chip chip--kw"') && h.includes('/search/?q=')) {
    h = h.replace(/href="\/search\/\?q=([^"]*)" class="chip chip--kw"/g,
      (x, q) => 'href="/catalog/?q=' + q + '" class="chip chip--kw"');
    relinked++;
  }

  // 4. блока нет - собираем из запасного источника
  if (!h.includes('mp-kw-block')) {
    const id = d.slice(d.lastIndexOf('-') + 1);
    const list = KW.get(id);
    if (!list) { noSource++; if (missing.length < 6) missing.push(d); }
    else {
      const block = '<div class="mp-kw-block"><div class="section-label mp-mb12">Keywords</div>'
        + '<div class="mp-chip-row">' + list.map(chip).join('') + '</div></div>';
      // Ставим туда же, куда ставил apply-card-upgrade: сразу после блока вопросов.
      const end = endOfDiv(h, h.indexOf('<div class="mp-faq-block">'));
      if (end > 0) { const cut = end + 6; h = h.slice(0, cut) + block + h.slice(cut); added++; }
    }
  }

  if (h !== before && !DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live.toLocaleString('ru-RU'));
console.log('чипы переведены в каталог: ' + relinked.toLocaleString('ru-RU'));
console.log('блоков добавлено: ' + added.toLocaleString('ru-RU'));
console.log('без источника слов: ' + noSource);
missing.forEach(m => console.log('   ' + m));
if (DRY) console.log('(--dry, ничего не записано)');
