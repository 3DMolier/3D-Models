/*
 * refresh-date-modified.mjs - приводит дату изменения карточек к правде.
 *
 * 20.08.2026 переписаны все 59 638 живых карточек: описание разбито на абзацы и
 * дополнено числами геометрии, в характеристики добавлены полигоны, вершины,
 * текстуры и развёртка, появились ключевые слова. При этом dateModified остался
 * 2026-08-02 - страницы утверждали, что не менялись восемнадцать дней.
 *
 * Почему это важно. Свежесть - сильный сигнал для поисковых и языковых моделей:
 * страницы моложе трёх месяцев цитируются в AI-ответах примерно втрое чаще, а
 * при возрасте от полугода выпадают из выборки. Мы сделали работу и не сообщили
 * о ней.
 *
 * Дата ставится 2026-08-20 - день, когда содержимое действительно изменилось,
 * а не день запуска этого скрипта. Проверяется по истории git.
 *
 * datePublished НЕ ТРОГАЕТСЯ: это дата выхода модели на TurboSquid, у каждой
 * своя (в выборке из 400 карточек - 360 разных значений).
 *
 * Запуск:
 *   node refresh-date-modified.mjs --dry     посчитать, ничего не записывая
 *   node refresh-date-modified.mjs           применить
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;

const DATE = '2026-08-20';
const HUMAN = '20 August 2026';

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVariant = new Set(Object.keys(merged));
let live = fs.readdirSync(MODELS).filter(d => !isVariant.has(d)).sort();
if (LIMIT) live = live.slice(0, LIMIT);

const stat = { done: 0, schema: 0, visible: 0, already: 0, skipped: 0, published: 0 };

for (const slug of live) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { stat.skipped++; continue; }
  if (/http-equiv="refresh"/i.test(html)) { stat.skipped++; continue; }

  const before = html;

  // 1. разметка
  html = html.replace(/("dateModified"\s*:\s*")([^"]*)(")/g, (m, a, old, b) => {
    if (old !== DATE) stat.schema++;
    return a + DATE + b;
  });

  // 2. видимая строка «Updated <time datetime="...">...</time>»
  // Захватываем только блок после слова Updated, чтобы не задеть Published -
  // у них одинаковая разметка и разное значение.
  html = html.replace(/(Updated\s*<time datetime=")([^"]*)(">)([^<]*)(<\/time>)/g,
    (m, a, old, b, text, c) => {
      if (old !== DATE) stat.visible++;
      return a + DATE + b + HUMAN + c;
    });

  // Страховка: дата публикации остаться должна нетронутой.
  const pubBefore = (before.match(/"datePublished"\s*:\s*"([^"]*)"/) || [])[1];
  const pubAfter = (html.match(/"datePublished"\s*:\s*"([^"]*)"/) || [])[1];
  if (pubBefore !== pubAfter) {
    console.error('ОСТАНОВКА: у ' + slug + ' изменилась дата публикации ' + pubBefore + ' -> ' + pubAfter);
    process.exit(1);
  }
  if (pubBefore) stat.published++;

  if (html === before) { stat.already++; continue; }
  if (!DRY) fs.writeFileSync(file, html);
  stat.done++;
  if (stat.done % 10000 === 0) console.log('  ' + stat.done + '...');
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('карточек изменено:        ' + stat.done);
console.log('  правок в разметке:      ' + stat.schema);
console.log('  правок в видимой дате:  ' + stat.visible);
console.log('уже стояла нужная дата:   ' + stat.already);
console.log('пропущено (стубы, сбои):  ' + stat.skipped);
console.log('дат публикации сохранено: ' + stat.published);
console.log('новая дата изменения:     ' + DATE + '  («' + HUMAN + '»)');
