// build-preview-index.mjs — постоянный индекс превью «слаг -> og:image».
//
// Зачем. Галерея объединённой карточки собирается из превью всех вариантов, а
// превью читается со страницы варианта. Но варианты прошлых прогонов уже удалены
// с диска — и серия из 44 выпусков схлопывалась до трёх картинок. Колонка
// image_url из выгрузки не годится: там угаданный адрес вида
// static.turbosquid.com/Preview/…_D_Main.jpg, он отдаёт 404. Настоящий адрес —
// p.turbosquid.com/ts-thumb/… с хэшем, восстановить его по имени нельзя.
//
// Поэтому собираем индекс один раз: живые страницы читаем с диска, удалённые —
// из git HEAD, где они ещё лежат. Дальше merge-variants.mjs пополняет индекс сам,
// до удаления страниц, и потеря больше не повторится.
//
// Запуск:  node scripts/build-preview-index.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const OUT = path.join(ROOT, 'data', 'preview-index.json');
const REF = process.argv[2] || 'HEAD';   // дерево, из которого достаём удалённые страницы
const OG = /property="og:image" content="([^"]+)"/;

const index = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const before = Object.keys(index).length;

// Результат match в V8 — срез, удерживающий исходную строку целиком. Сложив
// 67 тысяч таких срезов, прогон съедал больше четырёх гигабайт и падал. Копируем
// значение в отдельную строку.
const copy = s => Buffer.from(s, 'utf8').toString('utf8');

// og:image лежит в <head>, читать всю страницу незачем — берём первые 32 КБ.
const HEAD_BYTES = 32 * 1024;
function ogOf(file) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (e) { return null; }
  try {
    const b = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, b, 0, HEAD_BYTES, 0);
    const m = b.slice(0, n).toString('utf8').match(OG);
    return m ? copy(m[1]) : null;
  } finally { fs.closeSync(fd); }
}

// ── 1. живые страницы ──
let fromDisk = 0;
const alive = new Set(fs.readdirSync(MODELS));
for (const slug of alive) {
  const og = ogOf(path.join(MODELS, slug, 'index.html'));
  if (og) { index[slug] = og; fromDisk++; }
}
console.log('с диска: ' + fromDisk);

// ── 2. удалённые — из git HEAD ──
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const want = Object.keys(map).filter(s => !alive.has(s) && !index[s]);
console.log('искать в git HEAD: ' + want.length);

if (!want.length) {
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log('\nв индексе: ' + Object.keys(index).length + ' (было ' + before + ')');
  process.exit(0);
}

// git cat-file --batch: на вход строки-ссылки, на выход «sha blob N\n» + N байт + \n,
// либо «<ссылка> missing\n». Идём порциями: при потоковой обработке git отдавал
// быстрее, чем разбирался ответ, буфер рос и прогон падал по нехватке памяти.
const CHUNK = 400;
let fromGit = 0, missing = 0;

for (let start = 0; start < want.length; start += CHUNK) {
  const part = want.slice(start, start + CHUNK);
  const input = part.map(s => REF + ':models/' + s + '/index.html\n').join('');
  let buf;
  try {
    buf = execFileSync('git', ['cat-file', '--batch'], { cwd: ROOT, input, maxBuffer: 512 * 1024 * 1024 });
  } catch (e) { console.log('  порция ' + start + ' не прочиталась: ' + e.message.slice(0, 80)); continue; }

  let off = 0, i = 0;
  while (off < buf.length && i < part.length) {
    const nl = buf.indexOf(10, off);
    if (nl === -1) break;
    const head = buf.slice(off, nl).toString('utf8');
    if (head.endsWith(' missing')) { missing++; i++; off = nl + 1; continue; }
    const size = +head.split(' ')[2];
    if (!Number.isFinite(size)) { off = nl + 1; continue; }
    const m = buf.slice(nl + 1, nl + 1 + Math.min(size, HEAD_BYTES)).toString('utf8').match(OG);
    if (m) { index[part[i]] = copy(m[1]); fromGit++; }
    i++;
    off = nl + 1 + size + 1;
  }
  if ((start / CHUNK) % 10 === 0) console.log('  ' + (start + part.length) + '/' + want.length + '  найдено ' + fromGit);
}

fs.writeFileSync(OUT, JSON.stringify(index));
console.log('\nиз git HEAD: ' + fromGit + ', не нашлось: ' + missing);
console.log('в индексе: ' + Object.keys(index).length + ' (было ' + before + ')');
