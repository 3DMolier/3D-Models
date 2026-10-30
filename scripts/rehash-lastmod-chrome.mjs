/*
 * rehash-lastmod-chrome.mjs - разовая миграция журнала дат на правило «оболочка не
 * содержимое» (lib/lastmod.mjs, stripChrome, 29.10.2026).
 *
 * Что делает. Для каждой страницы из data/page-lastmod.json сравнивает рабочую версию
 * с опубликованной (HEAD) по новому хешу - без шапки, подвала, версии стилей и дат.
 *   совпали   -> изменилась только оболочка: возвращаем дату из HEAD (и в разметку карточки);
 *   различны  -> правка настоящая: дата остаётся как есть.
 * Хеш в журнале пересчитывается по новому правилу у всех, иначе следующая сборка
 * сравнит новый хеш со старым и снова сдвинет все даты. Кеш mtime удаляется.
 *
 *   git archive HEAD | tar -x -C <папка>   (опубликованные страницы)
 *   node scripts/rehash-lastmod-chrome.mjs --head <папка> --dry
 *   node scripts/rehash-lastmod-chrome.mjs --head <папка>
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT } from './lib/paths.mjs';
import { hashBody } from './lib/lastmod.mjs';
import { POLICY } from './lib/index-policy.mjs';

const DRY = process.argv.includes('--dry');
const store = path.join(ROOT, 'data', 'page-lastmod.json');
const map = JSON.parse(fs.readFileSync(store, 'utf8'));
const headMap = JSON.parse(execSync('git show HEAD:data/page-lastmod.json', { cwd: ROOT, maxBuffer: 1 << 29 }).toString());
const keys = Object.keys(map);

// Опубликованные версии страниц: git archive HEAD во временную папку (первый вариант
// через cat-file --batch зависал на обмене через канал). Папку передаём --head <путь>.
const hi = process.argv.indexOf('--head');
const HEAD_DIR = hi > 0 ? process.argv[hi + 1] : null;
if (!HEAD_DIR) { console.log('нужен --head <папка с git archive HEAD>'); process.exit(1); }
async function headBodies(paths) {
  const out = new Map();
  for (const k of paths) {
    const f = path.join(HEAD_DIR, k);
    if (fs.existsSync(f)) out.set(k, fs.readFileSync(f));
  }
  return out;
}

const DATE_MOD = /("dateModified"\s*:\s*")[^"]*(")/g;
const DATE_UPD = /(Updated <time datetime=")[^"]*(">)[^<]*(<\/time>)/g;
const human = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const stampDate = (s, iso) => s.replace(DATE_MOD, '$1' + iso + '$2').replace(DATE_UPD, '$1' + iso + '$2' + human(iso) + '$3');

const st = { pages: 0, restored: 0, real: 0, same: 0, noHead: 0, missing: 0, stamped: 0 };
const CHUNK = 2000;
for (let a = 0; a < keys.length; a += CHUNK) {
  const part = keys.slice(a, a + CHUNK);
  const heads = await headBodies(part);
  for (const k of part) {
    const f = path.join(ROOT, k);
    if (!fs.existsSync(f)) { st.missing++; continue; }
    st.pages++;
    const isModel = k.startsWith('models/');
    let body = fs.readFileSync(f);
    const nh = hashBody(body, undefined, isModel);
    const hb = heads.get(k);
    const hd = headMap[k] && headMap[k][0];
    if (!hb || !hd) { st.noHead++; map[k] = [map[k][0], nh]; continue; }
    if (hashBody(hb, undefined, isModel) === nh) {
      if (map[k][0] !== hd) {
        st.restored++;
        if (POLICY.page_dates && isModel) {
          const s = body.toString('utf8'), t = stampDate(s, hd);
          if (t !== s) { st.stamped++; if (!DRY) fs.writeFileSync(f, t); }
        }
      } else st.same++;
      map[k] = [hd, nh];
    } else {
      st.real++;
      map[k] = [map[k][0], nh];
    }
  }
  process.stdout.write('.');
}
console.log('\n', st);
if (!DRY) {
  const ks = Object.keys(map).sort();
  fs.writeFileSync(store, '{\n' + ks.map(k => `${JSON.stringify(k)}:${JSON.stringify(map[k])}`).join(',\n') + '\n}\n', 'utf8');
  try { fs.unlinkSync(path.join(ROOT, 'data', '.page-lastmod-mtime.json')); } catch { }
  console.log('журнал записан, кеш mtime удалён');
} else console.log('(--dry, ничего не записано)');
