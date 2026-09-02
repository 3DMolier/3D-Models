/*
 * preview-rebuild.mjs - пробный прогон пересборки на нескольких карточках.
 *
 * ЗАЧЕМ. Перед подменой 54 тысяч страниц основатель должен посмотреть глазами,
 * что получается. Скрипт собирает выбранные карточки НЕ на место живых, а в
 * папку .tmp/preview - живой сайт при этом не трогается вовсе.
 *
 * Карточки подбираются четырёх родов, по просьбе основателя:
 *   1. со схлопнутыми вариантами (есть семья);
 *   2. без вариантов (одиночная модель);
 *   3. с полной галереей студийных снимков;
 *   4. с роликом с YouTube.
 *
 * Рядом кладётся index.html - список отобранного, чтобы ходить по карточкам
 * из одного места, и для каждой карточки ссылка на её живой вид, чтобы
 * сравнивать «было - стало» в соседних вкладках.
 *
 * Смотреть через статический сервер от корня репозитория: страницы ссылаются
 * на /assets/... от корня сайта, из файла напрямую они откроются без стилей.
 *
 * Запуск:  node scripts/preview-rebuild.mjs
 *          node scripts/preview-rebuild.mjs --per 5
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const RECS = path.join(ROOT, 'data', 'records');
const OUT = path.join(ROOT, '.tmp', 'preview');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : 0; };
const PER = arg('--per') || 5;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── отбор ───────────────────────────────────────────────────────────────────
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
const pick = {
  'со схлопнутыми вариантами': [],
  'без вариантов': [],
  'с галереей студийных снимков': [],
  'с роликом с YouTube': [],
};

for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    if (r.status === 'new') continue;
    // Берём только те, у которых живая страница на месте: без неё не с чем сравнивать.
    if (!fs.existsSync(path.join(ROOT, 'models', r.slug, 'index.html'))) continue;
    const fam = (r.family || []).length;
    const gal = (r.gallery || []).length;
    /*
     * Ролик - самое редкое (263 карточки), поэтому его проверяем первым:
     * иначе карточка с роликом уйдёт в «со схлопнутыми» и в разделе с роликом
     * окажется пусто.
     */
    if (r.video && r.video.id && pick['с роликом с YouTube'].length < PER) {
      pick['с роликом с YouTube'].push(r);
    } else if (gal >= 4 && pick['с галереей студийных снимков'].length < PER) {
      pick['с галереей студийных снимков'].push(r);
    } else if (fam >= 3 && pick['со схлопнутыми вариантами'].length < PER) {
      pick['со схлопнутыми вариантами'].push(r);
    } else if (!fam && !gal && pick['без вариантов'].length < PER) {
      pick['без вариантов'].push(r);
    }
  }
}

// ── сборка ──────────────────────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let made = 0;
const rows = [];
for (const [kind, list] of Object.entries(pick)) {
  for (const r of list) {
    const dir = path.join(OUT, r.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderCard(r));
    made++;
    rows.push({ kind, r });
  }
}

// ── список для обхода ───────────────────────────────────────────────────────
const byKind = new Map();
for (const x of rows) {
  if (!byKind.has(x.kind)) byKind.set(x.kind, []);
  byKind.get(x.kind).push(x.r);
}

let body = '';
for (const [kind, list] of byKind) {
  body += '<h2>' + esc(kind) + ' <span class="n">' + list.length + '</span></h2><table><tr>'
    + '<th>модель</th><th>что внутри</th><th>стало</th><th>было</th></tr>';
  for (const r of list) {
    const what = [];
    if ((r.family || []).length) what.push('вариантов: ' + r.family.length);
    if ((r.gallery || []).length) what.push('снимков: ' + r.gallery.length);
    if (r.video && r.video.id) what.push('ролик');
    what.push(r.cert);
    what.push('$' + r.price);
    body += '<tr><td>' + esc(r.display_name || r.name) + '</td>'
      + '<td class="w">' + esc(what.join(' · ')) + '</td>'
      + '<td><a href="/.tmp/preview/' + esc(r.slug) + '/">новая</a></td>'
      + '<td><a href="/models/' + esc(r.slug) + '/">живая</a></td></tr>';
  }
  body += '</table>';
}

fs.writeFileSync(path.join(OUT, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Пробный прогон пересборки</title>'
  + '<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#1a1a1a}'
  + 'h1{font-size:26px;margin-bottom:6px}h2{font-size:18px;margin:34px 0 10px}'
  + '.n{color:#888;font-weight:400}p.lead{color:#555;margin-top:0}'
  + 'table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e6e6e6;padding:8px 10px;text-align:left;font-size:14px}'
  + 'th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#777}'
  + 'td.w{color:#666}a{color:#0a58ca}</style>'
  + '<h1>Пробный прогон пересборки</h1>'
  + '<p class="lead">' + made + ' карточек собрано из записей. Живой сайт не тронут: '
  + 'это отдельные файлы в .tmp/preview. Столбец «было» открывает нынешнюю страницу, «стало» - новую.</p>'
  + body);

console.log('собрано карточек: ' + made);
for (const [kind, list] of byKind) console.log('  ' + String(list.length).padStart(2) + '  ' + kind);
console.log('\nсписок: .tmp/preview/index.html');
