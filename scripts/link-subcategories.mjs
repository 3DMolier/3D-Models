/*
 * link-subcategories.mjs - ссылки на подкатегории со страниц категорий.
 *
 * ЗАЧЕМ. Страницы подкатегорий построены, но на них никто не ссылается - для
 * поиска их всё равно что нет. Место для ссылок на странице категории уже
 * есть: ряд «чипов» под описанием. Беда в том, куда они ведут:
 *
 *   <a href="/search/?q=Helicopter" class="chip">Helicopters</a>
 *
 * Это адрес результатов поиска. Он закрыт в robots.txt («Disallow: /search/?»)
 * и склеен каноникой на общий /search/, то есть ссылка ведёт на страницу,
 * которую поиск не индексирует, а человек получает пустой экран, пока не
 * загрузятся 3 МБ каталога. Теперь такие чипы ведут на настоящую страницу
 * подкатегории, где список уже в разметке.
 *
 * Чипы, для которых подкатегории нет, остаются как были: выдумывать под них
 * страницы ради ровного ряда - худшая из причин заводить страницу.
 *
 * Запуск:  node scripts/link-subcategories.mjs --dry
 *          node scripts/link-subcategories.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const CATEGORIES = path.join(ROOT, 'categories');
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const subs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'subcategories.json'), 'utf8'));
const byCat = new Map();
for (const s of subs) {
  if (!byCat.has(s.cat)) byCat.set(s.cat, []);
  byCat.get(s.cat).push(s);
}

let pages = 0, added = 0, kept = 0;
for (const [cat, list] of byCat) {
  // Первая страница категории плюс ближайшие страницы пагинации. Дальше не
  // идём: на 200-й странице каталога ряд из четырёх ссылок никого не спасёт, а
  // правку пришлось бы вносить в сотни файлов ради этого.
  const DEEP = 3;
  const files = [path.join(CATEGORIES, cat, 'index.html')];
  const pageDir = path.join(CATEGORIES, cat, 'page');
  if (fs.existsSync(pageDir)) {
    for (let n = 2; n <= DEEP; n++) {
      const f = path.join(pageDir, String(n), 'index.html');
      if (fs.existsSync(f)) files.push(f);
    }
  }

  const links = list
    .sort((a, b) => b.n - a.n)
    // Поле в subcategories.json называется sub, а не slug. И приписывать «s»
    // к названию нельзя: выходили «Knife & Swords» и «Drone & UAVs».
    .map(s => `<a href="/categories/${cat}/${s.sub}/" class="chip">${esc(s.title)} <span class="chip-n">${s.n}</span></a>`)
    .join('\n');

  for (const file of files) {
    let h = fs.readFileSync(file, 'utf8');
    // Страница уже размечена - и в ней не осталось чипов на /search/. Второе
    // условие нужно после того, как поиск переехал в каталог: страницы,
    // размеченные до переезда, обязаны пройти ещё раз, чтобы уцелевшие чипы
    // сменили адрес. Повтор безопасен: ряд собирается заново из
    // subcategories.json, и если он совпал с тем, что в файле, файл не пишется.
    if (h.includes('class="chip-n"') && !h.includes('href="/search/?q=')) continue;
    const before = h;
    const m = h.match(/<div class="cat-tags">([\s\S]*?)<\/div>/);

    if (m) {
      // Ряд чипов есть - заменяем его. Старые чипы, которым не нашлось
      // подкатегории, оставляем: выдумывать под них страницу ради ровного
      // ряда - худшая из причин заводить страницу.
      // Ловим оба адреса: и старый /search/, и уже переведённый /catalog/.
      // Иначе повторный прогон по переведённой странице не нашёл бы эти чипы
      // и молча выбросил их из ряда.
      const old = [...m[1].matchAll(/<a href="\/(?:search|catalog)\/\?q=([^"]*)" class="chip">([^<]*)<\/a>/g)];
      const haveTitles = list.map(s => s.title.toLowerCase().replace(/[^a-z]/g, ''));
      const leftovers = old.filter(o => {
        const t = o[2].toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');
        return !haveTitles.some(x => x === t || x.replace(/s$/, '') === t || t.indexOf(x) === 0 || x.indexOf(t) === 0);
      // Поиска отдельной страницей больше нет: /search/ - указатель на
      // /catalog/. Ведём чип сразу в каталог, он читает ?q= из адреса.
      }).map(o => o[0].replace('/search/?q=', '/catalog/?q='));
      kept += leftovers.length;
      const block = '<div class="cat-tags">\n' + links + (leftovers.length ? '\n' + leftovers.join('\n') : '') + '\n</div>';
      h = h.replace(/<div class="cat-tags">[\s\S]*?<\/div>/, () => block);
    } else if (/<p class="cat-desc">[\s\S]*?<\/p>/.test(h)) {
      // Первая страница категории, но ряда чипов на ней не было.
      h = h.replace(/(<p class="cat-desc">[\s\S]*?<\/p>)/, (x, p) => p + '\n<div class="cat-tags">\n' + links + '\n</div>');
    } else if (h.includes('<div id="model-grid"')) {
      // Страница пагинации: героя и описания нет, ставим прямо над сеткой.
      h = h.replace('<div id="model-grid"', '<div class="cat-tags">\n' + links + '\n</div>\n    <div id="model-grid"');
    } else {
      continue;
    }

    // Правило для числа внутри чипа кладём прямо в страницу, а не в общую
    // таблицу стилей. Иначе пришлось бы поднять версию styles.min.css, а это
    // правка всех 54 878 страниц ради одной строчки оформления.
    if (!h.includes('.chip-n{')) {
      h = h.replace('</head>', '<style>.chip-n{opacity:.5;font-size:11px;margin-left:2px}</style></head>');
    }

    if (h === before) continue;
    if (!DRY) fs.writeFileSync(file, h);
    pages++;
    added += list.length;
  }
}

console.log('страниц категорий обновлено: ' + pages);
console.log('ссылок на подкатегории проставлено: ' + added + ', старых чипов сохранено: ' + kept);
if (DRY) console.log('(--dry, ничего не записано)');
