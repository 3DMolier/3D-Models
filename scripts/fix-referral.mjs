// fix-referral.mjs — одноразово: заменить неверный referral=3d_molier-studio на
// правильный referral=3d_molier-international во ВСЕХ html (модели, категории, статика).
// Хэндл магазина в пути (Artists/3d_molier-International) НЕ трогаем - меняем только параметр referral=.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SKIP = new Set(['node_modules','data','assets','large_images','previews','sitemaps','.git','temporary screenshots','scripts']);
const BAD = 'referral=3d_molier-studio';
const GOOD = 'referral=3d_molier-international';

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (SKIP.has(e.name)) continue; yield* walk(path.join(dir, e.name)); }
    else if (e.name.endsWith('.html')) yield path.join(dir, e.name);
  }
}
let seen = 0, changed = 0;
for (const f of walk(ROOT)) {
  seen++;
  const html = fs.readFileSync(f, 'utf8');
  if (!html.includes(BAD)) continue;
  fs.writeFileSync(f, html.split(BAD).join(GOOD));
  changed++;
  if (changed % 10000 === 0) console.error(`  ${seen} просмотрено, ${changed} исправлено`);
}
console.error(`\nПросмотрено html: ${seen}, исправлено referral: ${changed}.`);
