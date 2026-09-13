/*
 * redirect-empty-pagination.mjs - перенаправить опустевшие страницы пагинации
 * категорий на первую страницу своей категории.
 *
 * Что не так. Объединение вариантов уменьшило каталог с 59 637 до 54 079
 * страниц, и хабы категорий пересобрались на меньшее число страниц: было 603,
 * стало 551. Но страницы, которые больше не нужны, никуда не делись - они
 * лежат на диске в том виде, в каком их собрали в прошлый раз, только сетка на
 * них теперь пустая. Например /categories/medical-3d-models/page/31/: ни одной
 * карточки, canonical на самого себя, от индекса не закрыта. Таких 511.
 *
 * Для поиска это тонкий контент в масштабе: пятьсот пустых адресов, на которые
 * тратится краул-бюджет, и каждый заявляет себя каноническим.
 *
 * Решение основателя: не удалять, а перенаправлять на первую страницу своей
 * категории. Внешние ссылки и вес не теряются, 404 не появляется, а Google
 * постепенно уберёт адреса из индекса. Разметка заглушки - та же, что у
 * свёрнутых карточек моделей (build-redirect-stubs.mjs), чтобы на сайте был
 * один приём, а не два.
 *
 * Сколько страниц нужно категории, берём из data/category-counts.json - его
 * пишет build-category-hubs.mjs. Значит порядок такой: сначала чистка каталога
 * и сборка хабов, потом этот скрипт.
 *
 * Запуск:
 *   node redirect-empty-pagination.mjs --dry
 *   node redirect-empty-pagination.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const DRY = process.argv.includes('--dry');
const SITE = 'https://3dmolierstudio.com';
const PER_PAGE = 100;

const cc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-counts.json'), 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/*
 * noindex ставится, когда его просят явно - для заглушек /browse/.
 *
 * У свёрнутых КАРТОЧЕК его нет намеренно: вместе с canonical он рискует
 * перенести запрет индексации на целевую страницу (см. build-redirect-stubs).
 * У /browse/ правило обратное - это служебный указатель, и проверка [10]
 * требует noindex на его заглушках. Тридцать четыре штуки были без него:
 * шаблон один, а правила у двух поверхностей разные.
 */
function stub(target, title, noindex = false) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<meta http-equiv="refresh" content="0; url=' + target + '">'
    + '<link rel="canonical" href="' + SITE + target + '">'
    + (noindex ? '<meta name="robots" content="noindex, follow">' : '')
    + '<title>' + esc(title) + ' | 3D Molier</title>'
    + '<meta name="description" content="' + esc('This page has moved to ' + title + ' on 3D Molier.') + '">'
    + '<script>location.replace("' + target + '");</script></head><body>'
    + '<p>This page has moved to <a href="' + target + '">' + esc(title) + '</a>.</p>'
    + '</body></html>';
}

let done = 0, already = 0, skippedNonEmpty = 0;
const perCat = {};
for (const [slug, models] of Object.entries(cc.counts)) {
  const dir = path.join(ROOT, 'categories', slug, 'page');
  if (!fs.existsSync(dir)) continue;
  const need = Math.max(1, Math.ceil(models / PER_PAGE));
  const target = '/categories/' + slug + '/';
  for (const p of fs.readdirSync(dir)) {
    if (!/^\d+$/.test(p) || +p <= need) continue;
    const file = path.join(dir, p, 'index.html');
    if (!fs.existsSync(file)) continue;
    const h = fs.readFileSync(file, 'utf8');
    if (/http-equiv="refresh"/i.test(h)) { already++; continue; }
    // Страховка: перенаправляем только по-настоящему пустые. Если карточки
    // вдруг есть, значит счётчик разошёлся с диском - такую страницу не трогаем
    // и говорим об этом вслух.
    if (/class="(?:mc|cat-card)"/.test(h)) { skippedNonEmpty++; continue; }
    const title = (h.match(/<title[^>]*>([^<|]+)/) || [])[1] || slug;
    const clean = title.replace(/\s*-\s*Page\s*\d+\s*$/i, '').trim();
    if (!DRY) fs.writeFileSync(file, stub(target, clean));
    done++;
    perCat[slug] = (perCat[slug] || 0) + 1;
  }
}

// То же самое случилось с browse: индекс пересобрался на 109 страниц, а на
// диске остались 174 от прошлой сборки. Лишние показывают старый список и
// заголовок «Page 132 of 174 ... of 86907» - каталога такого размера давно нет.
{
  const dir = path.join(ROOT, 'browse');
  const nums = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /^\d+$/.test(x)).map(Number) : [];
  // Сколько страниц нужно, спрашиваем у сайтмапа browse: его пишет
  // build-browse-index.mjs в том же прогоне, что и сами страницы.
  const sm = path.join(ROOT, 'sitemaps', 'sitemap-browse.xml');
  const live = new Set();
  if (fs.existsSync(sm)) {
    for (const m of fs.readFileSync(sm, 'utf8').matchAll(/\/browse\/(\d+)\//g)) live.add(+m[1]);
  }
  let bdone = 0, balready = 0;
  if (live.size) {
    for (const n of nums.sort((a, b) => a - b)) {
      if (live.has(n)) continue;
      const file = path.join(dir, String(n), 'index.html');
      if (!fs.existsSync(file)) continue;
      const h = fs.readFileSync(file, 'utf8');
      if (/http-equiv="refresh"/i.test(h)) { balready++; continue; }
      if (!DRY) fs.writeFileSync(file, stub('/browse/', 'Complete 3D Model Index', true));
      bdone++;
    }
    console.log('\nbrowse: перенаправлено лишних страниц: ' + bdone + ', уже были заглушками: ' + balready);
  } else console.log('\nbrowse: сайтмапа нет, страницы не трогаю');
}

/*
 * ── подкатегории ────────────────────────────────────────────────────────────
 *
 * 13.09.2026. Тот же осадок, но этажом ниже. Подкатегории пересобрались на 124
 * страницы, а на диске их лежало 1 105 - остальные от прежних сборок, когда
 * каталог был вдвое больше. И они НЕ пустые: показывают старую сетку, где
 * плитки ведут на карточки, свёрнутые с тех пор в заглушки. Проверка
 * check-unknown-tiles насчитала таких плиток 996.
 *
 * Живые адреса берём из sitemap-subcategories.xml - его пишет тот же прогон,
 * что и сами страницы. Чего в нём нет, того генератор больше не создаёт.
 *
 * Условие «страница пустая» здесь не годится: осиротевшие как раз полны
 * устаревших плиток. Отсутствие в сайтмапе - признак сам по себе достаточный.
 */
{
  const sm = path.join(ROOT, 'sitemaps', 'sitemap-subcategories.xml');
  const live = new Set();
  if (fs.existsSync(sm)) {
    for (const m of fs.readFileSync(sm, 'utf8').matchAll(/<loc>https?:\/\/[^/]+(\/categories\/[^<]+)<\/loc>/g)) live.add(m[1]);
  }
  let sdone = 0, salready = 0;
  if (live.size) {
    const cats = fs.readdirSync(path.join(ROOT, 'categories'), { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);
    for (const cat of cats) {
      const catDir = path.join(ROOT, 'categories', cat);
      for (const sub of fs.readdirSync(catDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'page').map(d => d.name)) {
        const pageDir = path.join(catDir, sub, 'page');
        const urls = [['/categories/' + cat + '/' + sub + '/', path.join(catDir, sub, 'index.html')]];
        if (fs.existsSync(pageDir)) {
          for (const n of fs.readdirSync(pageDir).filter(x => /^\d+$/.test(x)))
            urls.push(['/categories/' + cat + '/' + sub + '/page/' + n + '/', path.join(pageDir, n, 'index.html')]);
        }
        for (const [url, file] of urls) {
          if (live.has(url) || !fs.existsSync(file)) continue;
          const h = fs.readFileSync(file, 'utf8');
          if (/http-equiv="refresh"/i.test(h)) { salready++; continue; }
          const title = (h.match(/<title[^>]*>([^<|]+)/) || [])[1] || sub;
          const clean = title.replace(/\s*-\s*Page\s*\d+\s*$/i, '').trim();
          // Ведём на первую страницу самой подкатегории, а если её больше нет -
          // на категорию: посетитель должен попасть к ближайшему живому списку.
          const home = '/categories/' + cat + '/' + sub + '/';
          if (!DRY) fs.writeFileSync(file, stub(live.has(home) ? home : '/categories/' + cat + '/', clean));
          sdone++;
        }
      }
    }
    console.log('\nподкатегории: перенаправлено лишних страниц: ' + sdone
      + ', уже были заглушками: ' + salready);
  } else console.log('\nподкатегории: сайтмапа нет, страницы не трогаю');
}

console.log('перенаправлено пустых страниц: ' + done);
console.log('  уже были заглушками:        ' + already);
if (skippedNonEmpty) console.log('  НЕ ТРОНУТЫ, карточки есть:  ' + skippedNonEmpty);
const top = Object.entries(perCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (top.length) console.log('\nбольше всего: ' + top.map(([k, v]) => k + ' ' + v).join(', '));
console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
if (!DRY && done) console.log('\nДАЛЬШЕ: node scripts/refresh-sitemaps.mjs - заглушки не должны стоять в сайтмапе.');
