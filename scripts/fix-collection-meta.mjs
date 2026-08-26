/*
 * fix-collection-meta.mjs - описания страниц подборок.
 *
 * Две беды, и вторая серьёзнее первой.
 *
 * 1. Описания короткие: 84-105 знаков при полезных 120-158. Треть места в
 *    выдаче не использована.
 *
 * 2. У всех страниц пагинации одной подборки описание СОВПАДАЕТ дословно.
 *    /collections/architecture/ и её страницы 2-6 объявляют себя одинаково,
 *    и для поиска это шесть страниц с одинаковым описанием - ровно то, на что
 *    Search Console ругается как на дубли. Номер страницы обязан быть в
 *    описании, как он есть в title.
 *
 * Запуск:  node scripts/fix-collection-meta.mjs --dry
 *          node scripts/fix-collection-meta.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const COLL = path.join(ROOT, 'collections');
const DRY = process.argv.includes('--dry');
const TAIL = ' Real-world scale, clean topology and all popular formats.';

let touched = 0, dedup = 0, lengthened = 0;
for (const name of fs.readdirSync(COLL, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const dir = path.join(COLL, name.name);
  const pageDir = path.join(dir, 'page');
  const pages = fs.existsSync(pageDir)
    ? fs.readdirSync(pageDir).filter(n => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b)
    : [];
  const total = 1 + pages.length;

  const files = [[1, path.join(dir, 'index.html')]]
    .concat(pages.map(n => [n, path.join(pageDir, String(n), 'index.html')]));

  for (const [n, file] of files) {
    if (!fs.existsSync(file)) continue;
    let h = fs.readFileSync(file, 'utf8');
    if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
    const m = h.match(/<meta name="description" content="([^"]*)"/);
    if (!m) continue;
    let d = m[1];

    // Номер страницы - чтобы описания страниц пагинации перестали совпадать.
    const hasPage = /page\s+\d+\s+of\s+\d+/i.test(d);
    let next = d.replace(/\s+$/, '');
    if (total > 1 && !hasPage) {
      // Точку в конце восстанавливаем: без неё выходит «by 3D Molier Page 1 of 6».
      next = next.replace(/\.?$/, '.') + ` Page ${n} of ${total}.`;
      dedup++;
    }
    // Хвост подбираем по длине: длинный влезает не всегда.
    if (next.length < 120) {
      for (const t of [TAIL, ' Real-world scale and all popular formats.', ' All popular formats included.']) {
        if ((next + t).length <= 158) { next += t; lengthened++; break; }
      }
    }

    if (next === d) continue;
    h = h.replace(/(<meta name="description" content=")[^"]*(")/, (x, a, b) => a + next + b);
    // og и twitter описывают ту же страницу - расходиться им незачем.
    for (const attr of ['property="og:description"', 'name="twitter:description"']) {
      const re = new RegExp('(<meta ' + attr + ' content=")[^"]*(")');
      if (re.test(h)) h = h.replace(re, (x, a, b) => a + next + b);
    }
    if (!DRY) fs.writeFileSync(file, h);
    touched++;
  }
}

console.log('страниц подборок изменено: ' + touched);
console.log('  добавлен номер страницы (было дословное совпадение): ' + dedup);
console.log('  описание дополнено до полезной длины: ' + lengthened);
if (DRY) console.log('(--dry, ничего не записано)');
