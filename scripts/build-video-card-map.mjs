/*
 * build-video-card-map.mjs - карта «ролик YouTube -> карточка модели на сайте».
 *
 * Нужна для обратной связки: сейчас описание ролика ведёт на TurboSquid и на
 * главную сайта, но не на страницу самой модели. Связь односторонняя - сайт
 * ссылается на видео, видео на сайт по существу нет.
 *
 * Слаг карточки заканчивается идентификатором модели TurboSquid, по нему и
 * сопоставляем. Варианты, слитые в основную карточку, ведут на основную:
 * ролик снят по той же модели, просто выставленной отдельным товаром.
 *
 * Результат кладём рядом со скриптами канала - их читает add_site_link.py.
 *
 * Запуск:  node build-video-card-map.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const LOG = 'D:/Clode_Work_Folder/tools/youtube/publish-log.csv';
const OUT = 'D:/Clode_Work_Folder/tools/youtube/video-card-map.json';
const SITE = 'https://3dmolierstudio.com';
const UTM = '?utm_source=youtube&utm_medium=referral&utm_campaign=video';

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const log = parseCsv(fs.readFileSync(LOG, 'utf8'));
const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));

const byId = new Map();
for (const slug of fs.readdirSync(path.join(ROOT, 'models'))) {
  const m = slug.match(/-(\d{5,})$/);
  if (m && !byId.has(m[1])) byId.set(m[1], merged[slug] || slug);
}

const map = {};
const stat = { total: 0, notConfident: 0, noCard: 0, stub: 0, ok: 0 };
for (const r of log) {
  if (!r.video_id) continue;
  stat.total++;
  if (String(r.confident).toLowerCase() !== 'true') { stat.notConfident++; continue; }
  const slug = byId.get(String(r.model_id).trim());
  if (!slug) { stat.noCard++; continue; }
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) { stat.stub++; continue; }
  const h = fs.readFileSync(file, 'utf8');
  // На перенаправление ссылаться нельзя - человек попадёт не туда, куда обещали.
  if (/http-equiv="refresh"/i.test(h)) { stat.stub++; continue; }
  const name = (h.match(/<h1[^>]*class="mp-h1"[^>]*>([\s\S]*?)<\/h1>/) || [])[1]
    ?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || slug;
  map[r.video_id] = { url: SITE + '/models/' + slug + '/' + UTM, name, slug };
  stat.ok++;
}

fs.writeFileSync(OUT, JSON.stringify(map, null, 1));

// Вторая карта: идентификатор модели -> карточка. Нужна build_description.py,
// который строит описание ДО загрузки ролика - идентификатора ролика тогда
// ещё нет, а идентификатор модели уже известен из сопоставителя.
const OUT2 = 'D:/Clode_Work_Folder/tools/youtube/model-card-map.json';
const byModel = {};
for (const [id, slug] of byId) {
  const file = path.join(ROOT, 'models', slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  const h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h)) continue;
  byModel[id] = slug;
}
fs.writeFileSync(OUT2, JSON.stringify(byModel));
console.log('карта моделей: ' + OUT2 + '  (' + Object.keys(byModel).length + ' записей)');
console.log('записей в журнале:        ' + stat.total);
console.log('без уверенной привязки:   ' + stat.notConfident);
console.log('карточка не найдена:      ' + stat.noCard);
console.log('карточка - перенаправление: ' + stat.stub);
console.log('роликов со ссылкой:       ' + stat.ok);
console.log('различных карточек:       ' + new Set(Object.values(map).map(v => v.slug)).size);
console.log('\nкарта: ' + OUT);
