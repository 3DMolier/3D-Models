/*
 * fix-home-alts.mjs - подписи картинок на главной странице.
 *
 * КАРТИНКА ПЕРВОГО ЭКРАНА. Самая крупная на сайте, первое, что встречает
 *    краулер, - и у неё был пустой alt внутри блока с aria-hidden. То есть
 *    и робот, и читающая программа проходили мимо неё как мимо пустого места.
 *    Ставим осмысленную подпись и снимаем aria-hidden: при нём alt бесполезен,
 *    скрытый элемент не читается.
 *
 * СЛОВО «UNDEFINED» в подписях плиток чинится не здесь. Причина была в
 * build-homepage.mjs: в alt подставлялось поле t.name, которого у плиток нет -
 * resolve() кладёт имя модели в t.modelName. Шаблон молча вывел «undefined», и
 * оно уехало в прод на тринадцати плитках. Генератор исправлен, мозаику он
 * пересобирает сам: node scripts/build-homepage.mjs --apply.
 *
 * Запуск:  node scripts/fix-home-alts.mjs --dry
 *          node scripts/fix-home-alts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const HERO_ALT = 'Professional 3D model catalog by 3D Molier';

const PAGES = ['index.html', 'preview/home/index.html'];

let heroFix = 0, files = 0;
for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  const before = h;

  h = h.replace(/<div class="hero-shot" aria-hidden="true"><img([^>]*?)alt=""/,
    (x, a) => { heroFix++; return '<div class="hero-shot"><img' + a + 'alt="' + HERO_ALT + '"'; });

  if (h === before) continue;
  files++;
  if (!DRY) fs.writeFileSync(file, h);
}
console.log('страниц изменено: ' + files);
console.log('  подпись картинки первого экрана: ' + heroFix);

if (DRY) console.log('(--dry, ничего не записано)');
