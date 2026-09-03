/*
 * preview-new-models.mjs - пробные карточки НОВЫХ моделей.
 *
 * ЗАЧЕМ. У новых моделей страницы ещё нет, и сравнивать не с чем: тут вопрос не
 * «не сломали ли», а «годится ли». Собираем в отдельную папку, живой сайт не
 * трогаем.
 *
 * Отбор нарочно разный, чтобы видеть слабые места:
 *   одиночка          - обычная новая карточка;
 *   с галереей студии - все двенадцать кадров с нашего же сайта;
 *   отделённая деталь - колесо, сиденье: у них короткое название и мало данных;
 *   дорогая           - там, где ошибка обойдётся дороже всего.
 *
 * Запуск:  node scripts/preview-new-models.mjs
 *          node scripts/preview-new-models.mjs --per 4
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');
const OUT = path.join(ROOT, '.tmp', 'preview-new');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const PER = arg('--per') || 4;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'product-report.json'), 'utf8'));
const split = new Set(report.filter(r => r.split).map(r => String(r.pid)));

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const fresh = [];
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new' && r.image) fresh.push(r);
  }
}
fresh.sort((a, b) => a.slug.localeCompare(b.slug));

const pick = {
  'с полной галереей студии': [],
  'отделённая деталь': [],
  'дорогая модель': [],
  'обычная одиночка': [],
};
for (const r of fresh) {
  const gal = (r.gallery || []).length;
  if (gal >= 10 && pick['с полной галереей студии'].length < PER) pick['с полной галереей студии'].push(r);
  else if (split.has(String(r.id)) && pick['отделённая деталь'].length < PER) pick['отделённая деталь'].push(r);
  else if (r.price >= 150 && pick['дорогая модель'].length < PER) pick['дорогая модель'].push(r);
  else if (!gal && pick['обычная одиночка'].length < PER) pick['обычная одиночка'].push(r);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let made = 0;
let body = '';
for (const [kind, list] of Object.entries(pick)) {
  if (!list.length) continue;
  body += '<h2>' + esc(kind) + ' <span class="n">' + list.length + '</span></h2><table><tr>'
    + '<th>модель</th><th>что внутри</th><th>смотреть</th><th>на TurboSquid</th></tr>';
  for (const r of list) {
    fs.mkdirSync(path.join(OUT, r.slug), { recursive: true });
    fs.writeFileSync(path.join(OUT, r.slug, 'index.html'), renderCard(r));
    made++;
    const what = ['$' + r.price, r.cert, r.category_name || r.category];
    if ((r.gallery || []).length) what.push('кадров ' + ((r.gallery || []).length + 1));
    if (r.specs && r.specs.polygons) what.push(r.specs.polygons.toLocaleString('ru-RU') + ' полигонов');
    body += '<tr><td>' + esc(r.name) + '</td><td class="w">' + esc(what.join(' · ')) + '</td>'
      + '<td><a href="/.tmp/preview-new/' + esc(r.slug) + '/">открыть</a></td>'
      + '<td><a href="' + esc(r.ts_url) + '" target="_blank" rel="noopener">листинг</a></td></tr>';
  }
  body += '</table>';
}

fs.writeFileSync(path.join(OUT, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Новые модели - пробные карточки</title>'
  + '<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#1a1a1a}'
  + 'h1{font-size:26px;margin-bottom:6px}h2{font-size:18px;margin:34px 0 10px}.n{color:#888;font-weight:400}'
  + 'p.lead{color:#555;margin-top:0}table{border-collapse:collapse;width:100%}'
  + 'td,th{border-bottom:1px solid #e6e6e6;padding:8px 10px;text-align:left;font-size:14px}'
  + 'th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#777}'
  + 'td.w{color:#666}a{color:#0a58ca}</style>'
  + '<h1>Новые модели - пробные карточки</h1>'
  + '<p class="lead">' + made + ' карточек собрано из записей. Страниц на сайте у них ещё нет, '
  + 'сравнивать не с чем - вопрос не «не сломали ли», а «годится ли». '
  + 'Ссылка справа открывает листинг на TurboSquid, чтобы сверить с оригиналом.</p>'
  + body);

console.log('собрано карточек: ' + made);
for (const [kind, list] of Object.entries(pick)) if (list.length) console.log('  ' + String(list.length).padStart(2) + '  ' + kind);
console.log('\nсписок: .tmp/preview-new/index.html');
