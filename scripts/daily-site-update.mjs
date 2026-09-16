/*
 * daily-site-update.mjs - ежедневная пересборка и публикация сайта.
 *
 * РЕШЕНИЕ ОСНОВАТЕЛЯ 14.09.2026: «Ролик вышел, текст написан - собираю,
 * прогоняю 17 проверок, публикую и присылаю отчёт. Да, делай так».
 *
 * Это отменяет прежнее правило «не деплоить без явной команды» РОВНО для этой
 * задачи и только при зелёных проверках. Любая красная - публикации нет.
 *
 * ЧТО ЗАБИРАЕТ КАЖДЫЙ ДЕНЬ
 *   • новые ролики канала - они приходят в tools/youtube/publish-log.csv после
 *     выгрузки в 10:30, и запись цепляет их к карточке по номеру модели;
 *   • рукописные описания, дописанные с прошлого прогона
 *     (data/model-hand-desc.json);
 *   • всё остальное, что изменилось в данных.
 *
 * ПОРЯДОК ШАГОВ важен и выведен кровью: таксономия -> записи -> страницы ->
 * списки. Соберёшь страницы раньше таксономии - категория застынет в тексте.
 *
 * ЗАЩИТЫ
 *   • 17 проверок + аудит + внутренние ссылки. Красная - выходим с кодом 1,
 *     ничего не публикуя;
 *   • потолок размера правки: больше MAX_CHANGED изменённых карточек - это не
 *     ежедневный прирост, а чья-то массовая правка. Останавливаемся и говорим
 *     вслух. Массовые правки Google уже наказал однажды - сами мы их в
 *     автоматическом режиме не публикуем;
 *   • git add поимённо, масками в кавычках. Никогда git add .
 *
 * Запуск:
 *   node scripts/daily-site-update.mjs --dry   пересобрать и проверить, не публикуя
 *   node scripts/daily-site-update.mjs         полный цикл
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/paths.mjs';

const DRY = process.argv.includes('--dry');
const MAX_CHANGED = 5000;
const LOG = path.join(ROOT, '..', 'daily-site-update.log');

const out = [];
const say = m => {
  const line = new Date().toISOString().slice(0, 19).replace('T', ' ') + '  ' + m;
  console.log(line);
  out.push(line);
};
const finish = (code, verdict) => {
  say(verdict);
  try { fs.appendFileSync(LOG, out.join('\n') + '\n\n', 'utf8'); } catch (e) { /* лог не главное */ }
  process.exit(code);
};

const node = process.execPath;
function run(script, args = []) {
  try {
    return execFileSync(node, [path.join(ROOT, 'scripts', script), ...args],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch (e) {
    say('ШАГ УПАЛ: ' + script + ' - ' + String(e.message).split('\n')[0]);
    finish(1, 'ОСТАНОВЛЕНО: сборка не прошла, сайт не тронут.');
  }
}
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

say('=== ежедневное обновление сайта ===');

/*
 * ── не мешать человеку ──────────────────────────────────────────────────────
 *
 * 15.09.2026, первый же боевой прогон: задача сработала в 11:51, ровно когда я
 * правил PBR и пересобирал карточки. Индекс git один на всех - мой коммит упал,
 * а задача могла унести в публикацию наполовину пересобранное состояние.
 *
 * Признак чужой работы - НЕПУСТОЙ ИНДЕКС: файлы, уже добавленные в коммит, но
 * ещё не закоммиченные. Сама задача так репозиторий не оставляет: она либо
 * коммитит всё, что добавила, либо не добавляет ничего. Значит индекс занят
 * человеком, и лезть туда нельзя.
 */
{
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  if (staged.length) {
    say('в индексе git уже лежит ' + staged.length + ' файлов - кто-то работает с репозиторием');
    finish(0, 'ПРОПУЩЕНО: репозиторий занят человеком. Следующий прогон завтра.');
  }
}

// ── 1. сборка: таксономия -> записи -> страницы -> списки ────────────────────
run('build-taxonomy.mjs');
const recOut = run('build-model-records.mjs');
const vid = (recOut.match(/карточек с роликом: ([\d\s,]+)/) || [])[1];
if (vid) say('карточек с роликом: ' + vid.trim());
const pagesOut = run('apply-rebuild.mjs');
say((pagesOut.match(/переписано карточек: [\d\s,]+/) || ['страницы пересобраны'])[0]);

run('rebuild-search-index.mjs');
run('add-new-to-catalog.mjs');
// Имя и адрес в выгрузке каталога - из записей. Без этого шага каталог
// показывает вчерашние названия склеенных карточек: на плитке одно, на
// странице другое (5 699 штук на 16.09.2026).
run('sync-catalog-names.mjs');
run('build-category-hubs.mjs');
run('build-categories-hub.mjs');
run('build-subcategories.mjs');
run('build-browse-index.mjs');
// Подборки собираются здесь же: их плитки должны вести на живые карточки, а
// лишние страницы пагинации - сворачиваться в перенаправления ДО сайтмапов.
run('build-collections.mjs');
run('sync-counters.mjs');
run('build-model-sitemaps.mjs');
run('refresh-sitemaps.mjs');
run('redirect-empty-pagination.mjs');
run('refresh-sitemaps.mjs');
say('списки, счётчики и сайтмапы пересобраны');

// ── 2. проверки ─────────────────────────────────────────────────────────────
const vd = run('validate-data.mjs');
if (!/ВСЕ 17 ПРОВЕРОК ПРОЙДЕНЫ/.test(vd)) {
  const bad = (vd.match(/\n\s{2}\[\d+\][^\n]*/g) || []).slice(-6).join('\n');
  say('validate-data НЕ ПРОЙДЕН:\n' + bad);
  finish(1, 'ОСТАНОВЛЕНО: проверки не прошли, сайт не публикуется.');
}
say('validate-data: 17 из 17');

const audit = run('audit-site.mjs');
if (!/Audit PASSED/.test(audit)) {
  say('audit-site НЕ ПРОЙДЕН');
  finish(1, 'ОСТАНОВЛЕНО: аудит не прошёл, сайт не публикуется.');
}
say('audit-site: 0 ошибок');

const links = run('check-internal-links.mjs');
const dead = +((links.match(/адресов, ведущих в никуда: ([\d\s]+)/) || [])[1] || '0').replace(/\s/g, '');
if (dead > 0) {
  say('битых внутренних ссылок: ' + dead);
  finish(1, 'ОСТАНОВЛЕНО: появились ссылки в никуда, сайт не публикуется.');
}
say('внутренние ссылки: 0 в никуда');

// ── 3. что изменилось ───────────────────────────────────────────────────────
const changed = git('status', '--porcelain').split('\n').filter(Boolean);
const models = changed.filter(l => l.includes(' models/')).length;
say('изменено файлов: ' + changed.length + ', из них карточек: ' + models);
if (!changed.length) finish(0, 'Менять нечего - сайт уже соответствует данным.');
if (models > MAX_CHANGED) {
  say('карточек изменено больше потолка (' + MAX_CHANGED + ')');
  finish(1, 'ОСТАНОВЛЕНО: правка слишком велика для автоматической публикации. Нужен человек.');
}
if (DRY) finish(0, 'ПРОБНЫЙ ПРОГОН: собрано и проверено, публикации нет.');

// ── 4. публикация ───────────────────────────────────────────────────────────
/*
 * git add поимённо и масками В КАВЫЧКАХ: без них оболочка раскрывает маску в
 * десятки тысяч путей и git падает с «Argument list too long».
 */
const AREAS = ['data', 'sitemaps', 'sitemap.xml', 'sitemap-index.xml', 'index.html',
  'catalog/index.html', 'browse', 'categories', 'collections', 'about/index.html',
  'custom-order/index.html', 'data-licensing/index.html', 'full-catalog/index.html'];
for (const a of AREAS) {
  if (!fs.existsSync(path.join(ROOT, a))) continue;
  try { git('add', a); } catch (e) { /* в этой области менять нечего */ }
}
for (const ch of '123456789abcdefghijklmnopqrstuvwxyz') {
  try { git('add', 'models/' + ch + '*'); } catch (e) { /* нет карточек на эту букву */ }
}
const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean).length;
if (!staged) finish(0, 'Изменения есть, но ни одно не из наших областей - публикации нет.');

const date = new Date().toISOString().slice(0, 10);
const msg = 'content: ежедневное обновление карточек ' + date + '\n\n'
  + 'Ролики канала, дописанные описания и всё, что изменилось в данных.\n'
  + 'Файлов: ' + staged + ', из них карточек: ' + models + '.\n\n'
  + 'Проверки: validate-data 17 из 17, audit-site 0 ошибок,\n'
  + 'check-internal-links 0 адресов в никуда.\n\n'
  + 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
git('commit', '-q', '-m', msg);
const head = git('rev-parse', 'HEAD').trim();
say('коммит: ' + head.slice(0, 12) + ', файлов ' + staged);

git('push', 'origin', 'HEAD:main');
const remote = git('ls-remote', 'origin', 'main').split(/\s/)[0];
if (remote !== head) finish(1, 'ОСТАНОВЛЕНО: push прошёл, но на GitHub другой коммит. Нужен человек.');
say('опубликовано на GitHub');
finish(0, 'ГОТОВО: сайт обновлён и опубликован.');
