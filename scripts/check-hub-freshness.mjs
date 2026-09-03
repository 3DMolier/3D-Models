/*
 * check-hub-freshness.mjs - не отстали ли хабы, каталог и главная от записей.
 *
 * ЗАЧЕМ. Пересборка переписала 54 025 карточек, но хабы категорий, страницы
 * подкатегорий, каталог и главная собираются ДРУГИМИ скриптами и хранят копию
 * тех же данных: название, цену, снимок. Если запись говорит одно, а плитка на
 * хабе другое - посетитель видит одну цену в списке и другую на карточке.
 * Это ровно та беда, ради которой затевалась единая запись, только этажом выше.
 *
 * Здесь сверяется то, что показано на страницах-списках, с записями.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-hub-freshness.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const rec = new Map();
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    rec.set(r.slug, r);
  }
}

/*
 * Плитка на списке выглядит так: ссылка на карточку, где-то рядом цена и
 * название. Берём кусок разметки от ссылки до конца плитки и вытаскиваем цену.
 */
const TILE = /href="\/models\/([a-z0-9-]+)\/"([\s\S]{0,900}?)<\/(?:article|div)>/g;
const PRICE = /\$([0-9][0-9,]*)/;
const TITLE = /class="[^"]*(?:rc-title|mc-title|tile-title|s-mc-t)[^"]*"[^>]*>([^<]+)</;

const walk = dir => {
  const out = [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...walk(full));
    else if (it.name === 'index.html') out.push(full);
  }
  return out;
};

const groups = {
  'хабы категорий': walk(path.join(ROOT, 'categories')),
  'отрасли': walk(path.join(ROOT, 'industries')),
  'подборки': walk(path.join(ROOT, 'collections')),
  'каталог и главная': [path.join(ROOT, 'index.html'), path.join(ROOT, 'catalog', 'index.html')]
    .filter(f => fs.existsSync(f)),
};

let anyBad = 0;
for (const [name, files] of Object.entries(groups)) {
  let tiles = 0, badPrice = 0, unknown = 0;
  const ex = [];
  for (const f of files) {
    let h;
    try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const m of h.matchAll(TILE)) {
      const slug = m[1];
      const r = rec.get(slug);
      tiles++;
      if (!r) { unknown++; continue; }
      const pm = m[2].match(PRICE);
      if (!pm) continue;
      const shown = Number(pm[1].replace(/,/g, ''));
      if (!shown || shown === r.price) continue;
      badPrice++;
      if (ex.length < 4) {
        ex.push(path.relative(ROOT, f).replace(/\\/g, '/') + '  ' + slug.slice(0, 34)
          + ': показано $' + shown + ', в записи $' + r.price);
      }
    }
  }
  console.log('\n--- ' + name + ' (' + files.length + ' страниц) ---');
  console.log('  плиток: ' + tiles.toLocaleString('ru-RU')
    + ', цена расходится: ' + badPrice.toLocaleString('ru-RU')
    + (unknown ? ', ссылок на неизвестные записи: ' + unknown : ''));
  ex.forEach(x => console.log('     ' + x));
  anyBad += badPrice;
}

console.log('\nвсего расхождений цены: ' + anyBad.toLocaleString('ru-RU'));
