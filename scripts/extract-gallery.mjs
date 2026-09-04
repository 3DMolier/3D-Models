/*
 * extract-gallery.mjs - снять галереи со страниц в отдельный файл данных.
 *
 * ЗАЧЕМ. Примерно у тысячи карточек галерея - это несколько снимков ОДНОЙ
 * модели, а не её варианты. Такие галереи собирал build-new-cards.mjs из
 * выгрузки студии, но адреса там другого вида: в выгрузке
 * «3dmolier-studio.com/uploads/files/…», а на страницах
 * «www.3dmolier-studio.com/assets/…». Восстановить вторые из первых нельзя.
 *
 * Значит, единственный источник этих адресов сейчас - сами страницы. Снимаем их
 * один раз в data/model-gallery.json, и дальше запись берёт галерею оттуда.
 * Это перенос ДАННЫХ, а не вёрстки: разметку по-прежнему рисует генератор.
 *
 * ВРЕМЕННО. Основатель чинит картинки на студийном сайте. Когда его API
 * заработает, этот файл надо пересобрать из источника, а не из страниц, и
 * скрипт удалить. Пока он - единственный способ не потерять галереи при
 * пересборке.
 *
 * Запуск:  node scripts/extract-gallery.mjs --dry
 *          node scripts/extract-gallery.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodeEntities } from './lib/html-entities.mjs';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const OUT = path.join(ROOT, 'data', 'model-gallery.json');
const DRY = process.argv.includes('--dry');

const t0 = Date.now();
const out = {};
let scanned = 0, withGallery = 0, shots = 0;

for (const d of fs.readdirSync(MODELS)) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  scanned++;
  if (h.indexOf('mp-gal-thumb') === -1) continue;

  const list = [];
  for (const m of h.matchAll(/<button[^>]*class="mp-gal-thumb[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const full = (tag.match(/data-full="([^"]*)"/) || [])[1];
    const cap = (tag.match(/data-cap="([^"]*)"/) || [])[1] || '';
    if (!full) continue;
    /*
     * Берём только снимки самой модели: варианты семьи генератор собирает сам
     * из записи.
     *
     * У страниц нового образца происхождение написано прямо в разметке
     * (data-kind), и гадать не нужно. Старые страницы его не несут - для них
     * остаётся прежнее правило по хосту: всё, что НЕ turbosquid, снято
     * студией. Правило неточное: у 171 семьи обложки вариантов тоже лежат на
     * студийном хосте, и они сюда попадут. Как только страницы пересобраны,
     * признак есть у всех, и неточность уходит сама.
     *
     * Первая версия правила проверяла один хост 3dmolier-studio.com и
     * пропустила снимки на s3.3dmolier.com: две галереи потерялись молча.
     */
    const kind = (tag.match(/data-kind="([^"]*)"/) || [])[1];
    if (kind) { if (kind !== 'own') continue; }
    else if (/turbosquid\.com/i.test(full)) continue;
    /*
     * Заглушка - не снимок. Её подставляют варианту, у которого картинки нет
     * вовсе; правило по хосту принимало её за студийную работу и тащило в
     * галерею. Так набралось 54 пустых кадра на 18 карточках.
     */
    if (/\/assets\/og\/3d-molier-og\.jpg/i.test(full)) continue;
    /*
     * Кладём в запись раскодированный адрес. В разметке между параметрами
     * подписи стоит «&amp;»; сохрани его как есть - генератор экранирует
     * второй раз, адрес станет «&amp;amp;», подпись AWS не сойдётся и снимок
     * отдаст 403. Так пострадали бы 2 664 снимка.
     */
    list.push({ url: decodeEntities(full), cap: decodeEntities(cap) });
  }
  if (!list.length) continue;
  out[d] = list;
  withGallery++;
  shots += list.length;
}

console.log('живых карточек просмотрено: ' + scanned.toLocaleString('ru-RU'));
console.log('с галереей студийных снимков: ' + withGallery.toLocaleString('ru-RU')
  + ', снимков всего: ' + shots.toLocaleString('ru-RU'));
if (!DRY) {
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('записано: data/model-gallery.json');
} else console.log('(--dry, ничего не записано)');
console.log('время: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
