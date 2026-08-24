/*
 * night-brief.mjs - выдать факты по следующим N карточкам из очереди.
 *
 * Тексты пишутся руками, но факты выдумывать нельзя: полигоны, цена, текстуры,
 * риг и соседние версии берутся из самой карточки. Скрипт складывает их в
 * tools/night-writer/brief.json, оттуда я пишу тексты в written.json, а
 * night-apply.mjs ставит их на карточки.
 *
 * Отдельно отдаём «versions» - другие версии той же модели на той же странице.
 * Именно из-за них основатель поправил образец: нельзя писать «рига нет», если
 * ниже на странице лежит версия с ригом.
 *
 * Запуск:  node night-brief.mjs [--count 20]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const WORK = path.join(ROOT, 'tools', 'night-writer');
const argv = process.argv.slice(2);
const COUNT = argv.includes('--count') ? +argv[argv.indexOf('--count') + 1] : 20;

const queue = JSON.parse(fs.readFileSync(path.join(WORK, 'queue.json'), 'utf8'));
const doneFile = path.join(WORK, 'done.txt');
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []);

const plain = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'")
  .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cell = (h, k) => {
  const m = h.match(new RegExp('<th[^>]*>\\s*' + k + '\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>'));
  return m ? plain(m[1]) : '';
};

const out = [];
for (const slug of queue) {
  if (out.length >= COUNT) break;
  if (done.has(slug)) continue;
  let h;
  try { h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (h.includes('<!-- written:v1 -->')) continue;

  // Другие версии этой же модели - блок «All Versions of This Model».
  // Читать его обязательно: именно из-за него основатель поправил образец.
  // Написать «рига нет», когда ниже на странице лежит версия с ригом, - значит
  // отправить покупателя искать то, что уже есть на этой же странице.
  const body = h.slice(h.indexOf('<body'));
  const vi = body.indexOf('mp-versions-section');
  const verBlock = vi < 0 ? '' : body.slice(vi, body.indexOf('</section>', vi));
  const versions = [];
  if (verBlock) {
    const cards = verBlock.split('<a href=').slice(1);
    for (const c of cards) {
      const name = plain((c.match(/class="mp-rc-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
      const price = plain((c.match(/class="mp-rc-price"[^>]*>([^<]*)/) || [])[1] || '');
      const isMain = /mp-var-badge[^>]*>\s*main/i.test(c);
      if (name) versions.push({ name: name.replace(/\s*main\s*$/i, '').trim(), price, main: isMain });
    }
  }
  const verNames = versions.map(v => v.name);
  const verPrices = versions.map(v => v.price);

  const kw = [...h.matchAll(/class="chip chip--kw"[^>]*>([^<]*)</g)].map(m => plain(m[1]));
  const desc = [...h.matchAll(/<p class="mp-desc-text">([\s\S]*?)<\/p>/g)].map(m => plain(m[1]));

  out.push({
    slug,
    name: plain((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || slug),
    category: cell(h, 'Category'),
    price: cell(h, 'Price'),
    quality: cell(h, 'Quality standard') || cell(h, 'Certification'),
    polygons: cell(h, 'Polygons'),
    vertices: cell(h, 'Vertices'),
    geometry: cell(h, 'Geometry'),
    uv: cell(h, 'UV mapping'),
    textures: cell(h, 'Textures'),
    rig: cell(h, 'Rig'),
    animation: cell(h, 'Animation'),
    dimensions: cell(h, 'Dimensions'),
    onSaleSince: cell(h, 'On sale since'),
    industries: cell(h, 'Primary industries'),
    typicalUse: cell(h, 'Typical use'),
    versions,
    keywordsNow: kw,
    descriptionNow: desc,
    wordsNow: desc.join(' ').split(/\s+/).filter(Boolean).length,
  });
}

fs.writeFileSync(path.join(WORK, 'brief.json'), JSON.stringify(out, null, 1));
console.log('справок собрано: ' + out.length + ' -> tools/night-writer/brief.json');
console.log('пройдено всего:  ' + done.size + ' из ' + queue.length);
out.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x.name.slice(0, 46).padEnd(48)
  + x.price.padEnd(10) + (x.versions.length ? 'версий: ' + x.versions.length + '  ' : '')
  + 'слов сейчас: ' + x.wordsNow + (x.keywordsNow.length ? '' : '  БЕЗ КЛЮЧЕВЫХ СЛОВ')));
