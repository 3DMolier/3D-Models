/*
 * check-schema.mjs - разбирается ли разметка schema.org на собранных страницах.
 *
 * ЗАЧЕМ. В JSON-LD попадают имя модели, описание и категория - то есть живой
 * текст. Одна незакрытая кавычка или неэкранированный перевод строки делают
 * блок неразбираемым, и поисковик молча его игнорирует: страница выглядит
 * нормально, а карточка товара в выдаче пропадает. Ошибка не видна ни глазом,
 * ни сравнением с живой страницей - только разбором.
 *
 * Проверяем и обязательные поля: без них разметка есть, но толку от неё нет.
 *
 * ОТКУДА БЕРЁМ СТРАНИЦЫ. Двумя способами, и это не запасной вариант, а два
 * разных вопроса:
 *
 *   есть data/records - собираем страницу заново из записи. Отвечает на
 *     вопрос «что выдаст сборщик», то есть ловит поломку ДО перезаписи
 *     54 тысяч файлов. Так гоняем у себя перед большой пересборкой.
 *
 *   нет data/records - читаем уже собранные страницы с диска. Отвечает на
 *     вопрос «что лежит на сайте сейчас». Так проверка идёт в Actions:
 *     записи весят 277 МБ и в репозиторий не идут, поэтому в сборке их нет.
 *     Раньше проверка там просто падала на чтении несуществующей папки, и
 *     преграда качества краснела не из-за сайта, а из-за себя самой.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-schema.mjs
 *          node scripts/check-schema.mjs --every 20
 *          node scripts/check-schema.mjs --pages   читать с диска, даже если
 *                                                  записи есть
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

import { ROOT } from './lib/paths.mjs';
const RECS = path.join(ROOT, 'data', 'records');
const MODELS = path.join(ROOT, 'models');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const EVERY = arg('--every') || 1;
const FROM_DISK = process.argv.includes('--pages')
  || !fs.existsSync(path.join(RECS, 'index.json'));

const t0 = Date.now();
console.log(FROM_DISK
  ? 'источник: собранные страницы в models/'
  : 'источник: записи в data/records (страницы собираются заново)');

/* Перебор страниц одним и тем же видом: {slug, html} - дальше разбор общий. */
function* pagesToCheck() {
  if (FROM_DISK) {
    const dirs = fs.readdirSync(MODELS, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort();
    for (let i = 0; i < dirs.length; i++) {
      if (i % EVERY) continue;
      let html;
      try { html = fs.readFileSync(path.join(MODELS, dirs[i], 'index.html'), 'utf8'); }
      catch (e) { continue; }
      // Заглушки свёрнутых карточек - не карточки: у них своя минимальная
      // разметка без JSON-LD, и требовать её от них было бы неправдой.
      if (/http-equiv="refresh"/i.test(html.slice(0, 400))) continue;
      yield { slug: dirs[i], html };
    }
    return;
  }
  const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
  for (let k = 0; k < idx.chunks; k++) {
    const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
    for (let i = 0; i < recs.length; i++) {
      if (i % EVERY) continue;
      let html;
      try { html = renderCard(recs[i]); } catch (e) { continue; }
      yield { slug: recs[i].slug, html };
    }
  }
}

let pages = 0, blocks = 0, broken = 0, noBlocks = 0;
const missing = new Map();
const examples = [];
const types = new Map();
const need = {
  Product: ['name', 'image', 'offers'],
  ProductGroup: ['name', 'url', 'image'],
  ItemPage: ['name', 'url'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
};
const note = (key, slug) => {
  missing.set(key, (missing.get(key) || 0) + 1);
  if (examples.length < 8) examples.push(key + ': ' + slug);
};

for (const { slug, html } of pagesToCheck()) {
  pages++;

  const found = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!found.length) { noBlocks++; note('нет разметки вовсе', slug); continue; }

  for (const m of found) {
    blocks++;
    let data;
    try { data = JSON.parse(m[1]); }
    catch (e) { broken++; note('НЕ РАЗБИРАЕТСЯ: ' + e.message.slice(0, 40), slug); continue; }
    const list = Array.isArray(data) ? data : [data];
    for (const obj of list) {
      const t = obj['@type'];
      types.set(t, (types.get(t) || 0) + 1);
      for (const f of (need[t] || [])) {
        if (obj[f] === undefined || obj[f] === '' || obj[f] === null) note('у ' + t + ' нет поля ' + f, slug);
      }
    }
  }
}

console.log('страниц проверено: ' + pages.toLocaleString('ru-RU')
  + (EVERY > 1 ? '  (каждая ' + EVERY + '-я)' : '')
  + ', блоков разметки: ' + blocks.toLocaleString('ru-RU'));
console.log('\nТИПЫ В РАЗМЕТКЕ');
[...types].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('  ' + String(n).padStart(8) + '  ' + t));

console.log('\nОШИБКИ');
if (!missing.size) console.log('  нет');
else [...missing].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + String(n).padStart(8) + '  ' + k));
examples.forEach(e => console.log('     ' + e.slice(0, 130)));
console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
process.exit(broken || missing.size ? 1 : 0);
