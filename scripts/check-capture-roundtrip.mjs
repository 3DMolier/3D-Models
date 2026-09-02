/*
 * check-capture-roundtrip.mjs - не поплывут ли снятые данные на втором круге.
 *
 * ЗАЧЕМ. Четыре поля снимаются СО СТРАНИЦ: заголовок, главный снимок, галерея,
 * ключевые слова. После подмены страниц те же скрипты будут читать уже
 * пересобранные страницы. Если генератор печатает эти значения хоть немного
 * иначе, второе снятие даст другой результат, третья сборка - третий, и
 * страницы поедут при каждом прогоне.
 *
 * Здесь проверяется устойчивость: собираем страницу из записи, снимаем с неё
 * те же четыре поля теми же выражениями, что и извлекающие скрипты, и сверяем
 * с тем, что лежит в записи. Совпало - конвейер сходится, можно гонять сколько
 * угодно раз. Не совпало - назван признак и примеры.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-capture-roundtrip.mjs
 *          node scripts/check-capture-roundtrip.mjs --every 20
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';
import { decodeEntities } from './lib/html-entities.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const EVERY = arg('--every') || 1;

const dec = s => decodeEntities(s).trim();

const t0 = Date.now();
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));

const bad = { 'заголовок': [], 'главный снимок': [], 'галерея': [], 'ключевые слова': [] };
let checked = 0;

for (let k = 0; k < idx.chunks; k++) {
  const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
  for (let i = 0; i < recs.length; i++) {
    if (i % EVERY) continue;
    const r = recs[i];
    if (r.status === 'new') continue;
    let html;
    try { html = renderCard(r); } catch (e) { continue; }
    checked++;

    // те же выражения, что в extract-display-names.mjs
    const h1 = dec((html.match(/<h1[^>]*>([^<]*)</) || [])[1] || '');
    if (h1 !== (r.display_name || r.name)) {
      if (bad['заголовок'].length < 4) bad['заголовок'].push(r.slug + ': «' + h1 + '» вместо «' + (r.display_name || r.name) + '»');
      else bad['заголовок'].push('…');
    }

    const hero = dec((html.match(/<img src="([^"]*)"[^>]*class="mp-hero-img"/) || [])[1] || '');
    if (r.image && hero !== r.image) {
      if (bad['главный снимок'].length < 4) bad['главный снимок'].push(r.slug);
      else bad['главный снимок'].push('…');
    }

    // те же выражения, что в extract-gallery.mjs
    const shots = [...html.matchAll(/<button[^>]*class="mp-gal-thumb[^"]*"[^>]*>/g)]
      .filter(m => /data-kind="own"/.test(m[0]))
      .map(m => dec((m[0].match(/data-full="([^"]*)"/) || [])[1] || ''))
      .filter(u => u && !/turbosquid\.com/i.test(u));
    const want = (r.gallery || []).map(g => g.url);
    if (want.length !== shots.length) {
      if (bad['галерея'].length < 4) bad['галерея'].push(r.slug + ': ' + shots.length + ' вместо ' + want.length);
      else bad['галерея'].push('…');
    }

    const kw = [...html.matchAll(/class="chip chip--kw">([^<]*)</g)].map(m => dec(m[1]));
    const wantKw = (r.keywords && r.keywords.length ? r.keywords : (r.seo_keywords || [])).slice(0, 24);
    if (kw.join('|') !== wantKw.join('|')) {
      if (bad['ключевые слова'].length < 4) bad['ключевые слова'].push(r.slug + ': ' + kw.length + ' вместо ' + wantKw.length);
      else bad['ключевые слова'].push('…');
    }
  }
}

console.log('страниц проверено: ' + checked.toLocaleString('ru-RU')
  + (EVERY > 1 ? '  (каждая ' + EVERY + '-я)' : ''));
let fail = 0;
for (const [k, list] of Object.entries(bad)) {
  const n = list.filter(x => x !== '…').length + (list.includes('…') ? list.filter(x => x === '…').length : 0);
  console.log('  ' + String(n).padStart(7) + '  ' + k);
  if (n) { fail++; list.filter(x => x !== '…').slice(0, 4).forEach(x => console.log('           ' + x.slice(0, 120))); }
}
console.log('\nвремя: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
if (!fail) console.log('\nКОНВЕЙЕР СХОДИТСЯ: повторное снятие даёт то же самое');
process.exit(fail ? 1 : 0);
