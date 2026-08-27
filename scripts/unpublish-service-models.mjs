/*
 * unpublish-service-models.mjs - служебные позиции не должны быть на сайте.
 *
 * ЧТО НАШЛИ. В публичной выдаче лежала модель «to remove - Race Rowboats
 * Collection»: живая карточка, ссылки с витрины подборок, со страницы категории,
 * из общего индекса и две записи в картах сайта. Служебная отметка попала в
 * заголовок страницы и была видна и людям, и поисковикам.
 *
 * ПОЧЕМУ СПИСОК ИМЁН, А НЕ ПОИСК ПО СЛОВАМ. Поиск по «test», «draft», «temp»
 * даёт 96 совпадений, и 95 из них - настоящие товары: «Male Crash Test Dummy»,
 * «Laboratory Test Tubes», «Draft Beer Tower». Отсеивать их правилом нельзя.
 * Служебная отметка узнаётся по началу названия: «to remove - …».
 *
 * ЧТО ДЕЛАЕМ. Карточка превращается в перенаправление на живой аналог, запись
 * убирается из данных каталога, ссылки на неё переводятся на тот же аналог.
 * Просто удалить страницу нельзя: адрес мог попасть в индекс, и вместо товара
 * человек получил бы 404.
 *
 * Запуск:  node scripts/unpublish-service-models.mjs --dry
 *          node scripts/unpublish-service-models.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const SITE = 'https://3dmolierstudio.com';

// [номер служебной позиции, номер живого аналога]
const UNPUBLISH = [
  ['1395340', '2518496'],   // «to remove - Race Rowboats Collection» -> Race Rowboats Collection
  ['949974', '2536612'],    // «to remove - Football Penalty Flags Red …» -> Football Penalty Flags Red Collection
];

// Служебная отметка узнаётся по началу названия. Если появится новая позиция, о
// которой в списке выше ничего нет, скрипт скажет об этом и остановится: молча
// пропустить её нельзя - именно так «to remove» и оказалось в публичной выдаче.
const SERVICE_RE = /^\s*to\s+remove\b/i;

const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-index.json'), 'utf8'));
const chunks = [];
const nameOf = new Map();
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), 'utf8'));
  chunks.push(c);
  for (let j = 0; j < c.i.length; j++) nameOf.set(String(c.i[j]), c.n[j]);
}

// Сначала проверяем, все ли служебные позиции известны.
const known = new Set(UNPUBLISH.map(p => p[0]));
const unknown = [];
for (const [id, nm] of nameOf) if (SERVICE_RE.test(nm) && !known.has(id)) unknown.push(id + '  ' + nm);
if (unknown.length) {
  console.error('В каталоге есть служебные позиции, которых нет в списке замен:');
  unknown.forEach(u => console.error('   ' + u));
  console.error('Допиши их в UNPUBLISH с номером живого аналога и запусти снова.');
  process.exit(1);
}

let stubbed = 0, linksFixed = 0, pagesFixed = 0, dataRemoved = 0;
const pairs = [];
for (const [badId, goodId] of UNPUBLISH) {
  const badName = nameOf.get(badId), goodName = nameOf.get(goodId);
  if (!badName) { console.log('  ' + badId + ': нет в каталоге, пропускаю'); continue; }
  if (!goodName) { console.log('  ' + goodId + ': аналога нет в каталоге - не трогаю ' + badId); continue; }
  const badSlug = slugify(badName) + '-' + badId;
  const goodSlug = slugify(goodName) + '-' + goodId;
  const goodFile = path.join(MODELS, goodSlug, 'index.html');
  if (!fs.existsSync(goodFile)) { console.log('  нет страницы аналога ' + goodSlug); continue; }
  pairs.push({ badSlug, goodSlug, goodName });

  // 1. карточка -> перенаправление в общем формате сайта
  const badFile = path.join(MODELS, badSlug, 'index.html');
  if (fs.existsSync(badFile)) {
    const t = fs.readFileSync(goodFile, 'utf8');
    const title = ((t.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const u = '/models/' + goodSlug + '/';
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
      + '<meta http-equiv="refresh" content="0; url=' + u + '">'
      + '<link rel="canonical" href="' + SITE + u + '">'
      + '<title>' + title + '</title>'
      + '<meta name="description" content="This model page has moved to ' + goodName + ' on 3D Molier.">'
      + '<script>location.replace("' + u + '");<\/script></head><body>'
      + '<p>This page has moved to <a href="' + u + '">' + goodName + '</a>.</p></body></html>';
    if (!DRY) fs.writeFileSync(badFile, html);
    stubbed++;
  }

  // 2. данные каталога
  for (const c of chunks) {
    const at = c.i.indexOf(Number(badId));
    if (at < 0) continue;
    for (const key of ['i', 'n', 'p', 's', 'c', 'g', 'ic']) if (Array.isArray(c[key])) c[key].splice(at, 1);
    dataRemoved++;
  }
}

if (dataRemoved && !DRY) {
  for (let k = 0; k < chunks.length; k++) {
    fs.writeFileSync(path.join(DATA, 'fc-chunk-' + k + '.json'), JSON.stringify(chunks[k]));
  }
  idx.total = chunks.reduce((s, c) => s + c.i.length, 0);
  fs.writeFileSync(path.join(DATA, 'fc-index.json'), JSON.stringify(idx, null, 1));
}

// 3. ссылки на служебную позицию по всему сайту
if (pairs.length) {
  const walk = rel => {
    let ents;
    try { ents = fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true }); } catch (e) { return; }
    for (const it of ents) {
      if (it.name === 'node_modules' || it.name.startsWith('.')) continue;
      const nx = rel ? rel + '/' + it.name : it.name;
      if (it.isDirectory()) { walk(nx); continue; }
      if (!/\.(html|xml)$/.test(it.name)) continue;
      const file = path.join(ROOT, nx);
      let h = fs.readFileSync(file, 'utf8');
      const before = h;
      let n = 0;
      for (const p of pairs) {
        if (nx === 'models/' + p.badSlug + '/index.html') continue;   // саму заглушку не трогаем
        const k = h.split('/models/' + p.badSlug + '/').length - 1;
        if (k) { h = h.split('/models/' + p.badSlug + '/').join('/models/' + p.goodSlug + '/'); n += k; }
        // подпись со служебной отметкой тоже заменяем на нормальное имя
        const k2 = h.split('to remove - ').length - 1;
        if (k2) { h = h.split('to remove - ').join(''); n += k2; }
      }
      if (h !== before) { pagesFixed++; linksFixed += n; if (!DRY) fs.writeFileSync(file, h); }
    }
  };
  walk('');
}

console.log('заглушек сделано: ' + stubbed + ', записей убрано из каталога: ' + dataRemoved);
console.log('страниц со ссылками поправлено: ' + pagesFixed + ', ссылок и подписей: ' + linksFixed);
if (DRY) console.log('(--dry, ничего не записано)');
