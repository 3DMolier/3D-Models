/*
 * remove-long-dashes.mjs - убрать со всего сайта длинное и среднее тире.
 *
 * Правило основателя: тире на сайте не бывает, только дефис. Правило
 * безусловное - оно и про русскую переписку, и про английские тексты страниц.
 * Помимо вкуса у него есть и практический смысл: длинное тире в английской
 * прозе давно читается как след машинного текста.
 *
 * По сайту таких знаков 48 072 в 14 076 файлах, из них 13 876 - карточки
 * моделей. Записаны они четырьмя способами: символом «—», символом «–» и
 * мнемониками &#8212; и &#8211;.
 *
 * Меняем сам знак, пробелы вокруг не трогаем: «Privacy Policy — 3D Molier»
 * становится «Privacy Policy - 3D Molier», а «$1&#8211;$2,999» - «$1-$2,999»,
 * ровно как уже написано на /catalog/.
 *
 * Внутрь <script> и <style> не лезем: там тире не текст, а часть кода.
 *
 * Сеть не нужна.
 *
 * Запуск:
 *   node remove-long-dashes.mjs --dry
 *   node remove-long-dashes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');

const DASH = /—|–|&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;/gi;
// Обычные <script> и <style> пропускаем: там тире было бы частью кода.
// А вот JSON-LD - это текст: его name и description показываются в выдаче,
// и тире оттуда видно людям. Поэтому блоки ld+json чистим наравне с версткой.
const SKIP = /<script(?![^>]*ld\+json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi;

function clean(html) {
  // Куски кода вынимаем, чистим остальное, возвращаем на место. Метка -
  // нулевой байт: в HTML его не бывает. «Пробел-число-пробел» в этой роли
  // задел бы обычные числа в тексте и подставил бы вместо них куски кода.
  const held = [];
  const masked = html.replace(SKIP, m => { held.push(m); return '\u0000' + (held.length - 1) + '\u0000'; });
  const hits = (masked.match(DASH) || []).length;
  const fixed = masked.replace(DASH, '-');
  const out = fixed.replace(/\u0000(\d+)\u0000/g, (m, i) => held[+i]);
  return { out, hits };
}

const stat = { files: 0, hits: 0, cards: 0 };
function run(rel) {
  const f = path.join(ROOT, rel);
  let h;
  try { h = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
  if (!DASH.test(h)) { DASH.lastIndex = 0; return; }
  DASH.lastIndex = 0;
  const { out, hits } = clean(h);
  if (!hits || out === h) return;
  if (!DRY) fs.writeFileSync(f, out);
  stat.files++; stat.hits += hits;
  if (rel.startsWith('models/')) stat.cards++;
  if (stat.files % 2000 === 0) console.log('  ' + stat.files + ' файлов...');
}

run('index.html');
run('404.html');
for (const d of ['about', 'catalog', 'collections', 'contact', 'custom-order', 'data-licensing',
  'faq', 'privacy', 'search', 'terms', 'industries', 'browse', 'categories']) {
  run(d + '/index.html');
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const sub of fs.readdirSync(dir)) {
    run(d + '/' + sub + '/index.html');
    const pageDir = path.join(dir, sub, 'page');
    if (!fs.existsSync(pageDir)) continue;
    for (const p of fs.readdirSync(pageDir)) run(d + '/' + sub + '/page/' + p + '/index.html');
  }
}
for (const s of fs.readdirSync(path.join(ROOT, 'models'))) run('models/' + s + '/index.html');

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('файлов исправлено:  ' + stat.files + ' (карточек моделей: ' + stat.cards + ')');
console.log('знаков заменено:    ' + stat.hits);
