// update-nav-25.mjs — одноразовая глобальная замена nav-меню категорий с 8 на 25 категорий
// во ВСЕХ страницах (models, categories, industries, collections, статика). Desktop-дропдаун
// категорий → грид 3 колонки (inline-стиль, без правки CSS/кеша), mobile-подменю → 25 ссылок.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SKIP = new Set(['node_modules', 'data', 'assets', 'large_images', 'previews', 'sitemaps', '.git', 'temporary screenshots', 'scripts']);

// 25 категорий: [slug, display]
const CATS25 = [
  ['vehicles','Vehicles'], ['aircraft','Aircraft'], ['military-vehicles','Military Vehicles'],
  ['weapons-tools','Weapons & Tools'], ['ships','Ships'], ['animals-creatures','Animals & Creatures'],
  ['characters-people','Characters & People'], ['nature-plants','Nature & Plants'], ['medical-3d-models','Medical'],
  ['architecture-landmarks','Architecture'], ['furniture-interior','Furniture & Interior'], ['lighting','Lighting'],
  ['kitchen-tableware','Kitchen & Tableware'], ['food-beverages','Food & Beverages'], ['electronics-gadgets','Electronics'],
  ['industrial-equipment','Industrial'], ['containers-storage','Containers & Storage'], ['clothing-accessories','Clothing & Accessories'],
  ['sports-recreation','Sports & Recreation'], ['toys-games','Toys & Games'], ['musical-instruments','Musical Instruments'],
  ['signage-decor','Signage & Decor'], ['space-scifi','Space & Sci-Fi'], ['collections-sets','Collections & Sets'],
  ['other','Other'],
];

const desktopItems = CATS25.map(([s, d]) => `<a href="/categories/${s}/" role="menuitem" class="mega-item"><span class="mega-name">${d}</span></a>`).join('');
const DESKTOP = `<div class="nav-dropdown nav-mega" role="menu" style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));min-width:520px;gap:0 4px">${desktopItems}</div>`;

const mobileItems = CATS25.map(([s, d]) => `<a href="/categories/${s}/">${d}</a>`).join('');
const MOBILE = `<div class="nav-mobile-sub" id="mob-cat-sub">${mobileItems}</div>`;

// матчим ИМЕННО категорийный дропдаун (начинается со ссылки vehicles), в обоих вариантах (с id и без)
const reDesktop = /<div class="nav-dropdown nav-mega"[^>]*role="menu">\s*<a href="\/categories\/vehicles\/"[\s\S]*?<\/div>/;
const reMobile = /<div class="nav-mobile-sub" id="mob-cat-sub">[\s\S]*?<\/div>/;

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('mob-cat-sub') && !html.includes('/categories/vehicles/')) return false;
  const orig = html;
  html = html.replace(reDesktop, DESKTOP);
  html = html.replace(reMobile, MOBILE);
  if (html !== orig) { fs.writeFileSync(file, html); return true; }
  return false;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (SKIP.has(e.name)) continue; yield* walk(path.join(dir, e.name)); }
    else if (e.name.endsWith('.html')) yield path.join(dir, e.name);
  }
}

let changed = 0, seen = 0;
for (const f of walk(ROOT)) {
  seen++;
  if (processFile(f)) changed++;
  if (seen % 10000 === 0) console.error(`  ${seen} файлов, изменено ${changed}`);
}
console.error(`\nОбработано html: ${seen}, обновлено меню: ${changed}.`);
