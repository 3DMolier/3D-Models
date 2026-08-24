/*
 * night-apply.mjs - поставить написанные за ночь тексты на карточки.
 *
 * Читает tools/night-writer/written.json - массив вида
 *   [{ "slug": "...", "paragraphs": ["...", "..."], "keywords": ["...", "..."] }]
 * и заменяет на карточке описание, ключевые слова, описание в разметке и в
 * мета-тегах. Ставит метку <!-- written:v1 -->, чтобы очередь знала о пройденном.
 *
 * Почему меняем и разметку, и мета-теги: если их не тронуть, поисковик и
 * языковые модели продолжат читать старый шаблонный текст, а человек - новый.
 * На странице оказалось бы два разных описания одной вещи.
 *
 * Замены делаются только функциями: строка замены со знаком доллара ломает
 * текст молча - «$179» однажды превратилось в «Standard79».
 *
 * Запуск:
 *   node night-apply.mjs --dry
 *   node night-apply.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const WORK = path.join(ROOT, 'tools', 'night-writer');
const DRY = process.argv.includes('--dry');
const MARK = '<!-- written:v1 -->';

const esc = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonEsc = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const items = JSON.parse(fs.readFileSync(path.join(WORK, 'written.json'), 'utf8'));

// ── Проверка чисел ───────────────────────────────────────────────────────────
// Любое число в тексте должно быть взято из справки. Написать «1 033 880
// полигонов» там, где их 668 834, - значит соврать покупателю в проверяемой
// мелочи, а такую ложь он заметит на странице TurboSquid за десять секунд.
// Поэтому карточка с несходящимся числом не ставится вовсе.
const briefFile = path.join(WORK, 'brief.json');
const briefs = fs.existsSync(briefFile)
  ? new Map(JSON.parse(fs.readFileSync(briefFile, 'utf8')).map(b => [b.slug, b])) : new Map();

const numbersIn = s => (String(s).match(/\d[\d,.]*/g) || [])
  .map(x => x.replace(/[,\s]/g, '').replace(/\.$/, '')).filter(x => x.length > 1);

function checkNumbers(slug, paragraphs) {
  const b = briefs.get(slug);
  if (!b) return ['справки нет, числа проверить не могу'];
  const allowed = new Set(numbersIn(JSON.stringify(b)));
  // Годы и мелкие количества («two versions», «4K») пропускаем: они не из
  // справки, но и не выдают себя за измеренные величины.
  const bad = [];
  for (const p of paragraphs) {
    for (const n of numbersIn(p)) {
      if (allowed.has(n)) continue;
      if (/^(19|20)\d\d$/.test(n)) continue;
      if (+n <= 12) continue;
      bad.push(n);
    }
  }
  return bad.length ? ['числа не из справки: ' + [...new Set(bad)].join(', ')] : [];
}
const stat = { ok: 0, skip: 0, badNum: 0, noDesc: 0, noKw: 0, schema: 0, meta: 0 };
const doneAdd = [];
const problems = [];

for (const it of items) {
  const { slug, paragraphs, keywords } = it;
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) { problems.push(slug + ': нет файла'); stat.skip++; continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(MARK)) { problems.push(slug + ': уже написано, пропускаю'); stat.skip++; continue; }
  if (!Array.isArray(paragraphs) || paragraphs.length < 2) { problems.push(slug + ': меньше двух абзацев'); stat.skip++; continue; }
  const numErr = checkNumbers(slug, paragraphs);
  if (numErr.length) { problems.push(slug + ': ' + numErr.join('; ')); stat.badNum++; continue; }

  // ── 1. Видимое описание ───────────────────────────────────────────────────
  const blocks = [...html.matchAll(/<p class="mp-desc-text">[\s\S]*?<\/p>/g)].map(m => m[0]);
  if (!blocks.length) { problems.push(slug + ': не нашёл блок описания'); stat.noDesc++; continue; }
  const newDesc = paragraphs.map(p => '<p class="mp-desc-text">' + esc(p) + '</p>').join('');
  // Первый абзац меняем на всё новое описание, остальные убираем.
  blocks.forEach((b, i) => { html = html.replace(b, () => (i === 0 ? newDesc : '')); });

  // ── 2. Ключевые слова ─────────────────────────────────────────────────────
  if (Array.isArray(keywords) && keywords.length) {
    const row = '<div class="mp-chip-row">' + keywords.map(k =>
      '<a href="/search/?q=' + encodeURIComponent(k) + '" class="chip chip--kw">' + esc(k) + '</a>').join('') + '</div>';
    const before = html;
    html = html.replace(/(<div class="mp-kw-block">[\s\S]*?)<div class="mp-chip-row">[\s\S]*?<\/div>/,
      (all, head) => head + row);
    if (html === before) stat.noKw++;
  }

  // ── 3. Описание в разметке и мета-тегах ───────────────────────────────────
  // Берём первый абзац: он самодостаточен и укладывается в длину.
  const lead = paragraphs[0];
  const oneSentence = lead.split(/(?<=\.)\s/)[0];

  html = html.replace(/"description":"((?:[^"\\]|\\.)*)"/g, (all, old) => {
    // Меняем только шаблонные описания, не трогая имена и прочие поля.
    // Все семь шаблонных формулировок из card-content.mjs плюс старая восьмая.
    // Список неполный - и описание в разметке молча останется шаблонным, а на
    // странице будут два разных текста об одной вещи.
    if (!/is a production-ready |is a detailed |is ready to drop|belongs to our |Looking for a |is one of the |is a finished |professional 3D model in the /i.test(old)) return all;
    stat.schema++;
    return '"description":"' + jsonEsc(lead) + '"';
  });
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,
    (all, a, b) => { stat.meta++; return a + esc(oneSentence).replace(/"/g, '&quot;') + b; });
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,
    (all, a, b) => a + esc(oneSentence).replace(/"/g, '&quot;') + b);

  // ── 4. Метка ──────────────────────────────────────────────────────────────
  html = html.replace('</body>', MARK + '</body>');
  if (!html.includes(MARK)) html += MARK;

  if (!DRY) fs.writeFileSync(file, html);
  doneAdd.push(slug);
  stat.ok++;
}

if (!DRY && doneAdd.length) {
  fs.appendFileSync(path.join(WORK, 'done.txt'), doneAdd.join('\n') + '\n');
  const pf = path.join(WORK, 'progress.json');
  const p = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : { total: 0, nights: [] };
  p.total += doneAdd.length;
  p.nights.push({ at: new Date().toISOString(), written: doneAdd.length });
  if (p.nights.length > 60) p.nights = p.nights.slice(-60);
  fs.writeFileSync(pf, JSON.stringify(p, null, 1));
}

console.log((DRY ? 'ПРОБНЫЙ ПРОГОН' : 'записано') + ':');
console.log('  карточек написано:      ' + stat.ok);
console.log('  пропущено:              ' + stat.skip);
console.log('  ОТКЛОНЕНО, числа врут:  ' + stat.badNum);
console.log('  без блока описания:     ' + stat.noDesc);
console.log('  ключевые не подставил:  ' + stat.noKw);
console.log('  описаний в разметке:    ' + stat.schema + ', мета-тегов: ' + stat.meta);
if (problems.length) { console.log('\nвнимание:'); problems.slice(0, 20).forEach(p => console.log('  ' + p)); }
if (!DRY) {
  const done = fs.readFileSync(path.join(WORK, 'done.txt'), 'utf8').split('\n').filter(Boolean).length;
  const queue = JSON.parse(fs.readFileSync(path.join(WORK, 'queue.json'), 'utf8')).length;
  console.log('\nвсего написано: ' + done + ' из ' + queue + '  (' + (100 * done / queue).toFixed(2) + '%)');
}
