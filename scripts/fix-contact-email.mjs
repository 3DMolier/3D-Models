// fix-contact-email.mjs — замена старой почты на корпоративную.
// dddmolier@gmail.com -> 3dmolier@3dmolier.com
// Правится и генератор create_industry_pages.py, иначе старый адрес вернётся при пересборке.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const OLD = 'dddmolier@gmail.com';
const NEW = '3dmolier@3dmolier.com';
const DRY = process.argv.includes('--dry');

const FILES = [
  'contact/index.html',
  'custom-order/index.html',
  'index.html',
  'llms.txt',
  'llms-full.txt',
  'scripts/create_industry_pages.py',
];

let total = 0;
for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { console.log('нет файла: ' + rel); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const n = (src.match(new RegExp(OLD.replace(/[.]/g, '\\.'), 'g')) || []).length;
  if (!n) { console.log('чисто: ' + rel); continue; }
  if (!DRY) fs.writeFileSync(f, src.split(OLD).join(NEW));
  total += n;
  console.log((DRY ? 'нашёл ' : 'заменил ') + n + ' в ' + rel);
}
console.log('\nВсего: ' + total + (DRY ? ' (--dry, не записано)' : ''));
