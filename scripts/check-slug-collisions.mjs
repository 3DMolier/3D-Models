/*
 * check-slug-collisions.mjs - почему 344 новым моделям не досталось адреса.
 *
 * ЗАЧЕМ. Сборщик записей назначает новой модели адрес по её названию и номеру.
 * Если такая папка уже есть, он ОТКАЗЫВАЕТСЯ создавать запись и говорит вслух -
 * молча занять чужой адрес нельзя. Но 344 отказа надо понять: за ними может
 * стоять и настоящее столкновение имён, и та же самая модель, уже добавленная
 * под другим номером.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-slug-collisions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DATA = path.join(ROOT, 'data');
const MODELS = path.join(ROOT, 'models');

const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const np = JSON.parse(fs.readFileSync(path.join(DATA, 'new-products.json'), 'utf8'));
const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'records', 'index.json'), 'utf8'));
const known = new Set();
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(DATA, 'records', 'records-' + k + '.json'), 'utf8'))) {
    known.add(String(r.id));
  }
}

const kinds = new Map();
const ex = new Map();
let hit = 0;
for (const p of np) {
  const id = String(p.pid || p.id || '');
  if (!/^\d+$/.test(id) || known.has(id)) continue;
  const slug = slugify(p.name || '') + '-' + id;
  const dir = path.join(MODELS, slug);
  if (!fs.existsSync(dir)) continue; // не столкновение
  hit++;
  const file = path.join(dir, 'index.html');
  let kind;
  if (!fs.existsSync(file)) kind = 'папка есть, страницы нет';
  else {
    const head = fs.readFileSync(file, 'utf8').slice(0, 400);
    if (!/http-equiv="refresh"/i.test(head)) kind = 'занято живой карточкой';
    else {
      /*
       * Заглушка на этом адресе - чаще всего НЕ столкновение, а нормальный
       * исход: новый товар оказался версией уже существующей модели, склейка
       * свернула его страницу и поставила перенаправление на главную семьи.
       * Товар продаётся, покупатель попадает куда надо, делать нечего.
       *
       * Столкновение - это когда перенаправление ведёт в пустоту. Раньше оба
       * случая писались одной строкой «занято заглушкой», и отчёт читался как
       * тысяча поломок там, где их ноль. 16.09.2026: из 1 001 такой записи в
       * никуда не вела ни одна.
       */
      const to = (head.match(/url=\/models\/([^/"]+)/) || [])[1];
      let liveTarget = false;
      if (to) {
        try {
          const th = fs.readFileSync(path.join(MODELS, to, 'index.html'), 'utf8').slice(0, 400);
          liveTarget = !/http-equiv="refresh"/i.test(th);
        } catch (e) { liveTarget = false; }
      }
      kind = liveTarget
        ? 'уже склеен как версия другой модели (перенаправление на живую карточку)'
        : 'ЗАГЛУШКА ВЕДЁТ В НИКУДА - это надо чинить';
    }
  }
  kinds.set(kind, (kinds.get(kind) || 0) + 1);
  if (!ex.has(kind)) ex.set(kind, slug + '   (модель «' + (p.name || '') + '»)');
}

console.log('новых моделей, которым не досталось адреса: ' + hit);
for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(5) + '  ' + k);
  console.log('         пример: ' + ex.get(k).slice(0, 110));
}
