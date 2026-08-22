/*
 * fix-category-in-prose.mjs - категория в тексте описания должна совпадать с
 * категорией карточки.
 *
 * Что случилось. Когда категории пересчитали по настоящим данным TurboSquid,
 * значение обновили в таблице характеристик, хлебных крошках, кнопке Browse и
 * разметке - но не в предложении описания, где категория тоже называется.
 * В итоге 34 091 карточка из 59 639 (57%) пишет в тексте одно, а в таблице
 * другое: чаще всего «Other» против настоящей категории, а после разделения
 * оружия - «Weapons & Tools» против «Weapons».
 *
 * Источник правды - строка Category таблицы характеристик: её пересобирали по
 * данным студии, и с ней согласованы навигация и разметка.
 *
 * Одно и то же предложение лежит на карточке в трёх местах: дважды в блоках
 * JSON-LD и один раз в видимом описании. Правим все три, но амперсанд в них
 * пишется по-разному: внутри JSON-LD - сырой «&», в HTML - «&amp;». Поэтому
 * файл разбирается на куски JSON-LD и всё остальное, и каждый кусок правится
 * своим написанием. Если этого не делать, в разметку попадёт «&amp;» как есть.
 *
 * Формулировок семь (из card-content.mjs), карточке достаётся одна из них по
 * идентификатору - правим ту, что нашлась. Заодно чиним подпись ссылки на хаб
 * категории в блоке вопросов.
 *
 * Запуск:
 *   node fix-category-in-prose.mjs --dry [--limit N]
 *   node fix-category-in-prose.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;

// Формулировка и то, чем заменить категорию, если в таблице стоит «Other».
// Слово «Other» в предложение подставлять нельзя - «is a production-ready Other
// 3D model» не по-английски. Поэтому у каждой фразы свой запасной вариант:
// где можно, категория просто убирается, где без неё ломается грамматика -
// подставляется нейтральное слово.
const PATTERNS = [
  [/(is a production-ready )([A-Za-z][A-Za-z &;]*?)( 3D model)/g, ''],
  [/(is a detailed )([A-Za-z][A-Za-z &;]*?)( asset built for professional)/g, ''],
  [/(This )([A-Za-z][A-Za-z &;]*?)( model - [^<]*? - is ready to drop)/g, ''],
  [/(belongs to our )([A-Za-z][A-Za-z &;]*?)( range and is offered)/g, 'general'],
  [/(Looking for a )([A-Za-z][A-Za-z &;]*?)( asset\?)/g, '3D'],
  [/(is one of the )([A-Za-z][A-Za-z &;]*?)( models in the 3D Molier catalogue)/g, ''],
  [/(is a finished )([A-Za-z][A-Za-z &;]*?)( model rather than a base mesh)/g, ''],
];

const LD = /<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi;

const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const escAmp = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');

// Разбор файла на куски: блоки JSON-LD и всё остальное, по порядку.
function split(html) {
  const out = [];
  let last = 0, m;
  LD.lastIndex = 0;
  while ((m = LD.exec(html))) {
    if (m.index > last) out.push({ json: false, s: html.slice(last, m.index) });
    out.push({ json: true, s: m[0] });
    last = m.index + m[0].length;
  }
  out.push({ json: false, s: html.slice(last) });
  return out;
}

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVariant = new Set(Object.keys(merged));
let live = fs.readdirSync(MODELS).filter(d => !isVariant.has(d)).sort();
if (LIMIT) live = live.slice(0, LIMIT);

const stat = { done: 0, prose: 0, faq: 0, hits: 0, already: 0, noTable: 0, noProse: 0, skipped: 0 };
const moves = {};
const perCard = {};

for (const slug of live) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { stat.skipped++; continue; }
  if (/http-equiv="refresh"/i.test(html)) { stat.skipped++; continue; }

  const cat = plain((html.match(/<th[^>]*>\s*Category\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/) || [])[1] || '');
  if (!cat) { stat.noTable++; continue; }

  const parts = split(html);
  let touchedProse = false, foundProse = false, hits = 0;

  for (const [re, fallback] of PATTERNS) {
    re.lastIndex = 0;
    if (!re.test(html)) continue;
    foundProse = true;
    for (const p of parts) {
      re.lastIndex = 0;
      // В JSON-LD амперсанд сырой, в HTML - мнемоника.
      const want = cat === 'Other' ? fallback : (p.json ? cat : escAmp(cat));
      p.s = p.s.replace(re, (all, a, old, b) => {
        if (plain(old) === plain(want)) return all;
        hits++;
        const k = (plain(old) || '(пусто)') + ' -> ' + (plain(want) || '(без категории)');
        moves[k] = (moves[k] || 0) + 1;
        touchedProse = true;
        // Если категория убирается совсем, склеенные пробелы схлопываем.
        return (a + want + b).replace(/ {2,}/g, ' ');
      });
    }
    break;                       // формулировка на карточке всегда одна
  }
  if (!foundProse) stat.noProse++;

  // Подпись ссылки на хаб категории в блоке вопросов: «Browsing the <a ...>X</a>».
  // Хаб «Other» существует, поэтому здесь запасной вариант не нужен.
  let touchedFaq = false;
  for (const p of parts) {
    if (p.json) continue;
    p.s = p.s.replace(/(Browsing the <a href="\/categories\/[^"]*\/">)([^<]*)(<\/a>)/g,
      (all, a, old, b) => {
        if (plain(old) === cat) return all;
        touchedFaq = true;
        return a + escAmp(cat) + b;
      });
  }

  const next = parts.map(p => p.s).join('');
  if (next === html) { stat.already++; continue; }
  if (touchedProse) stat.prose++;
  if (touchedFaq) stat.faq++;
  stat.hits += hits;
  perCard[hits] = (perCard[hits] || 0) + 1;
  if (!DRY) fs.writeFileSync(file, next);
  stat.done++;
  if (stat.done % 5000 === 0) console.log('  ' + stat.done + '...');
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('карточек изменено:            ' + stat.done);
console.log('  поправлен текст описания:   ' + stat.prose + ' (замен всего ' + stat.hits + ')');
console.log('  поправлена подпись ссылки:  ' + stat.faq);
console.log('уже совпадало:                ' + stat.already);
console.log('нет категории в таблице:      ' + stat.noTable);
console.log('нет фразы про категорию:      ' + stat.noProse);
console.log('пропущено (перенаправления):  ' + stat.skipped);
console.log('\nсколько замен пришлось на карточку (ожидаем 3 - два JSON-LD и текст):');
Object.entries(perCard).sort((a, b) => a[0] - b[0])
  .forEach(([k, v]) => console.log('   ' + k + ' замен: ' + v + ' карточек'));
console.log('\nчто на что заменено (топ-12):');
Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));
