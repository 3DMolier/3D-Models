/**
 * fix-static-turbosquid-images.mjs
 *
 * На части страниц в src картинок стоит адрес вида
 *   https://static.turbosquid.com/Preview/<id>/<n>/<Name>_D_Main.jpg
 * Это угаданный адрес из колонки image_url выгрузки models_master.csv. Он не
 * работает: сервер отвечает 403, посетитель видит битую картинку.
 *
 * Чем заменяем, по убыванию надёжности:
 *   1) og:image самой карточки, если ссылка ведёт на /models/<slug>/
 *   2) og:image страницы, на которой стоит картинка (для листингов)
 *   3) запись из data/preview-index.json по слагу
 * Если замены нет - картинку убираем совсем: пустое место лучше «сломанного
 * изображения», и вёрстка листингов это переживает (в витрине для такого случая
 * есть mp-var-thumb-empty).
 *
 * Запуск:  node scripts/fix-static-turbosquid-images.mjs --dry
 *          node scripts/fix-static-turbosquid-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const BAD = /https:\/\/static\.turbosquid\.com\/[^"']+/;
const copy = s => Buffer.from(String(s), 'utf8').toString('utf8');

const prevIdx = (() => {
  const p = path.join(ROOT, 'data', 'preview-index.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
})();

function ogOf(slug) {
  try {
    const h = fs.readFileSync(path.join(ROOT, 'models', slug, 'index.html'), 'utf8');
    const og = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
    if (og && !BAD.test(og)) return copy(og);
  } catch (e) { /* нет страницы */ }
  const v = prevIdx[slug];
  return v && !BAD.test(v) ? copy(v) : null;
}

// собираем страницы, минуя служебные каталоги
const pages = [];
(function walk(rel) {
  let ents;
  try { ents = fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(next);
    else if (e.name === 'index.html') pages.push(next);
  }
})('');

let touched = 0, replaced = 0, dropped = 0;
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  if (!BAD.test(html)) continue;
  const pageOg = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
  // Последняя опора: любая рабочая картинка этой же страницы. Сначала пробуем
  // галерею - там снимки именно этой модели, а не соседних версий.
  const gal = (html.match(/<div class="mp-gallery" data-gallery>[\s\S]*?<\/div><\/div>/) || [''])[0];
  const firstGood = (src) => {
    const m = [...String(src).matchAll(/src="(https:\/\/(?:p\.turbosquid\.com|www\.3dmolier-studio\.com)\/[^"]+)"/g)];
    return m.length ? copy(m[0][1]) : null;
  };
  const pageFallback = firstGood(gal) || firstGood(html);
  let out = html, локально = 0, убрано = 0;

  out = out.replace(/<img\b[^>]*>/g, tag => {
    if (!BAD.test(tag)) return tag;
    const near = (tag.match(/data-slug="([^"]+)"/) || [])[1];
    let repl = near ? ogOf(near) : null;
    if (!repl && rel.startsWith('models/')) repl = ogOf(rel.split('/')[1]);
    if (!repl && pageOg && !BAD.test(pageOg)) repl = copy(pageOg);
    if (!repl) repl = pageFallback;
    if (repl) { локально++; return tag.replace(BAD, repl); }
    убрано++;
    return '';
  });

  // og:image с тем же битым адресом - это мёртвое превью в соцсетях и поиске.
  if (pageOg && BAD.test(pageOg)) {
    const repl = (rel.startsWith('models/') ? ogOf(rel.split('/')[1]) : null) || pageFallback;
    if (repl) {
      out = out.replace(/(property="og:image" content=")[^"]+(")/, (m, a, b) => a + repl + b);
      out = out.replace(/(name="twitter:image" content=")[^"]+(")/, (m, a, b) => a + repl + b);
      локально++;
    }
  }

  // Тот же адрес живёт ещё в двух местах, и оба важнее, чем кажется:
  //   "image" / "primaryImageOfPage" в JSON-LD - это картинка, которую берёт
  //     поиск, битая ссылка обесценивает всю разметку страницы;
  //   data-fallback - запасной адрес для скрипта, когда основная не загрузилась,
  //     то есть запасной вариант вёл на ту же 403.
  if (BAD.test(out)) {
    const repl = (rel.startsWith('models/') ? ogOf(rel.split('/')[1]) : null) || pageFallback;
    if (repl) {
      const было = (out.match(new RegExp(BAD.source, 'g')) || []).length;
      out = out.replace(new RegExp(BAD.source, 'g'), repl);
      локально += было;
    }
  }

  if (out !== html) {
    touched++; replaced += локально; dropped += убрано;
    console.log('  ' + rel + ': заменено ' + локально + ', убрано ' + убрано);
    if (!DRY) fs.writeFileSync(file, out);
  }
}
console.log('\nстраниц изменено: ' + touched + (DRY ? '  (--dry)' : ''));
console.log('картинок заменено: ' + replaced + ', убрано: ' + dropped);
