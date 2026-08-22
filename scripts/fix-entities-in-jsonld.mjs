/*
 * fix-entities-in-jsonld.mjs - убрать HTML-мнемоники из блоков JSON-LD.
 *
 * Что случилось. Тексты для блоков вопросов собирались тем же кодом, что и
 * видимая разметка, поэтому амперсанд в них экранирован как «&amp;». Внутри
 * <script type="application/ld+json"> это ошибка: содержимое script как HTML не
 * разбирается, мнемоники не раскрываются, и поисковик читает буквально
 * «Film &amp; Video Production» вместо «Film & Video Production».
 * Затронуто 37 112 карточек из 59 639, 48 792 вхождения, почти все - в полях
 * text блока FAQPage. Других мнемоник (&quot;, &#39;, &lt;) в JSON-LD нет.
 *
 * Правим только внутри блоков JSON-LD. Видимую разметку не трогаем - там
 * «&amp;» как раз правильно.
 *
 * Запуск:
 *   node fix-entities-in-jsonld.mjs --dry [--limit N]
 *   node fix-entities-in-jsonld.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;

const LD = /(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/gi;

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVariant = new Set(Object.keys(merged));
let live = fs.readdirSync(MODELS).filter(d => !isVariant.has(d)).sort();
if (LIMIT) live = live.slice(0, LIMIT);

const stat = { done: 0, occ: 0, clean: 0, broken: 0, skipped: 0 };

for (const slug of live) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { stat.skipped++; continue; }
  if (/http-equiv="refresh"/i.test(html)) { stat.skipped++; continue; }

  let occ = 0, bad = false;
  const next = html.replace(LD, (all, open, body, close) => {
    let j = body;
    // Двойное кодирование («&amp;amp;») развернётся не с первого прохода.
    for (let i = 0; i < 5 && /&(amp|quot|lt|gt|#39|apos|nbsp);/.test(j); i++) {
      j = j.replace(/&(amp|quot|lt|gt|#39|apos|nbsp);/g, (m, e) => {
        occ++;
        return { amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'", apos: "'", nbsp: ' ' }[e];
      });
    }
    // Кавычка и угловые скобки внутри JSON-строки ломают либо JSON, либо
    // разбор тега script. Такой блок оставляем как был и отмечаем.
    if (j !== body) {
      try { JSON.parse(j); } catch (e) { bad = true; return all; }
      if (/<\/script/i.test(j)) { bad = true; return all; }
    }
    return open + j + close;
  });

  if (bad) { stat.broken++; }
  if (next === html) { stat.clean++; continue; }
  stat.occ += occ;
  if (!DRY) fs.writeFileSync(file, next);
  stat.done++;
  if (stat.done % 5000 === 0) console.log('  ' + stat.done + '...');
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('карточек изменено:           ' + stat.done);
console.log('мнемоник раскрыто:           ' + stat.occ);
console.log('уже было чисто:              ' + stat.clean);
console.log('блоков оставлено как есть:   ' + stat.broken + '  (замена ломала JSON или тег)');
console.log('пропущено (перенаправления): ' + stat.skipped);
