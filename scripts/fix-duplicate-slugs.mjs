/*
 * fix-duplicate-slugs.mjs - три модели имели по две живые страницы.
 *
 * Что нашли. Живых папок в models/ 54 082, а разных моделей 54 079: у трёх
 * турбосквидовских номеров оказалось по два адреса. Слаг для них построился
 * по-разному - там, где в названии цифра шла вплотную к скобке или к точке:
 *
 *   electric-scooter-1-1428089            electric-scooter1-1428089
 *   generic-pickup-2-1-1096820            generic-pickup-21-1096820
 *   ipad-pro-2020-12-9-inch-silver-...    ipad-pro-2020-129-inch-silver-...
 *
 * Страницы полностью одинаковые, и каждая ссылается canonical сама на себя,
 * то есть обе объявляют себя главной. Хуже того, обе лежат и в карте сайта,
 * и в картиночной карте - мы сами показываем Google один товар дважды.
 *
 * Какой адрес оставляем. Тот, который строит сам каталог. Сетка на /catalog/
 * и в поиске не хранит адреса, а собирает их из названия функцией makeSlug -
 * и для всех 54 079 записей результат совпадает с существующей папкой. То есть
 * слитная форма (electric-scooter1-...) и есть рабочая, а дефисная - остаток
 * старого генератора. Оставить дефисную значило бы отправлять всю сетку через
 * перенаправление, и починить это скриптом нельзя: адрес строится в браузере.
 * Внутренние ссылки на дефисные варианты (36 и 25) переводятся отдельно - вот
 * их как раз поправить легко.
 *
 * Почему meta refresh, а не 301. Хостинг статический, своих заголовков он не
 * отдаёт. Настоящий 301 появится только если встанет Cloudflare.
 *
 * Запуск:  node scripts/fix-duplicate-slugs.mjs --dry
 *          node scripts/fix-duplicate-slugs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const SITE = 'https://3dmolierstudio.com';

// [лишний адрес, адрес, который остаётся]
const PAIRS = [
  ['electric-scooter-1-1428089', 'electric-scooter1-1428089'],
  ['generic-pickup-2-1-1096820', 'generic-pickup-21-1096820'],
  ['ipad-pro-2020-12-9-inch-silver-1562907', 'ipad-pro-2020-129-inch-silver-1562907'],
];

// Заглушку делаем по образцу уже существующих на сайте, чтобы она вела себя
// ровно так же, как остальные 34 тысячи.
function stub(from, to) {
  // Формат берём у уже существующих заглушек сайта, чтобы все 34 тысячи вели
  // себя одинаково: canonical на цель, title и описание по названию цели плюс
  // location.replace для тех, у кого meta refresh отработает медленно.
  const t = fs.readFileSync(path.join(ROOT, 'models', to, 'index.html'), 'utf8');
  const name = ((t.match(/<h1 class="mp-h1">([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
  const title = ((t.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
  if (!name) throw new Error('у цели ' + to + ' нет H1 - заглушку не из чего сделать');
  const u = '/models/' + to + '/';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<meta http-equiv="refresh" content="0; url=' + u + '">'
    + '<link rel="canonical" href="' + SITE + u + '">'
    + '<title>' + title + '</title>'
    + '<meta name="description" content="This model page has moved to ' + name + ' on 3D Molier.">'
    + '<script>location.replace("' + u + '");</script></head><body>'
    + '<p>This page has moved to <a href="' + u + '">' + name + '</a>.</p></body></html>';
}


let made = 0;
for (const [from, to] of PAIRS) {
  const fromFile = path.join(ROOT, 'models', from, 'index.html');
  const toFile = path.join(ROOT, 'models', to, 'index.html');
  if (!fs.existsSync(fromFile)) { console.log('нет ' + from + ' - пропускаю'); continue; }
  if (!fs.existsSync(toFile)) { console.log('ВНИМАНИЕ: нет цели ' + to + ' - не трогаю ' + from); continue; }
  const cur = fs.readFileSync(fromFile, 'utf8');
  if (/http-equiv="refresh"/i.test(cur.slice(0, 400))) { console.log(from + ' уже заглушка'); continue; }
  if (!DRY) fs.writeFileSync(fromFile, stub(from, to));
  made++;
  console.log('заглушка: /models/' + from + '/  ->  /models/' + to + '/');
}

// Из карт сайта лишние адреса убираем: заглушки там быть не должно.
let cut = 0;
const smDir = path.join(ROOT, 'sitemaps');
for (const f of fs.readdirSync(smDir)) {
  if (!f.endsWith('.xml')) continue;
  const file = path.join(smDir, f);
  let xml = fs.readFileSync(file, 'utf8');
  const before = xml;
  for (const [from] of PAIRS) {
    // Вырезаем целиком <url>…</url>, внутри которого этот адрес.
    const re = new RegExp('<url>(?:(?!</url>)[\\s\\S])*?/models/' + from + '/(?:(?!</url>)[\\s\\S])*?</url>\\s*', 'g');
    const n = (xml.match(re) || []).length;
    if (n) { xml = xml.replace(re, ''); cut += n; }
  }
  if (xml !== before) {
    if (!DRY) fs.writeFileSync(file, xml);
    console.log('карта сайта ' + f + ': записей убрано');
  }
}

console.log('\nзаглушек сделано: ' + made + ', записей вырезано из карт: ' + cut
  + (DRY ? '   (--dry, ничего не записано)' : ''));
