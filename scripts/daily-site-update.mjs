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
/*
 * Ролики канала -> карточки. Опись канала (channel-videos.json) снимается
 * отдельно скриптом tools/youtube/scan_channel_videos.py; здесь мы только
 * пересопоставляем её с карточками, потому что состав карточек меняется каждый
 * день: склейка вариантов и новые модели.
 */
run('link-channel-videos.mjs');
/*
 * Медианы по категориям для текста карточки (полигоны, цена). Считаются по
 * записям ПРОШЛОГО прогона - это верно: медиана раздела за сутки не меняется, а
 * порядок «сначала статистика, потом записи» избавляет от второго проходa по
 * 38 тысячам записей. Если файла нет, генератор просто не ставит фразы с
 * медианой, поэтому шаг не критический.
 */
run('build-category-stats.mjs');
/*
 * Характеристики из кабинета TurboSquid для карточек, которых нет в выгрузке студии (фаза 1 плана
 * 2026-11-09-card-value-after-quality-drop, 10.11.2026): до 2 000 новых карточек в день, чтобы вместе с
 * ночными текстами остаться ниже потолка 5 000. С 11.11 - 10.11 публикация несла только ночные тексты
 * (решение основателя). Когда всё перенесено, шаг ничего не меняет.
 */
/*
 * Галереи из превью TurboSquid (фаза 2, решение основателя 10.11.2026): кадры студии не отдаются. По 2 500 карточек
 * в день в том же порядке, что и характеристики (сначала карточки без данных студии), - первые дни это одни и те же
 * карточки, и вместе с ночными текстами выходит ниже потолка 5 000. Готовит галереи gallery_classify.py в фоне.
 */
if (new Date().toISOString().slice(0, 10) >= '2026-11-11') {
  if (fs.existsSync('D:/Clode_Work_Folder/tools/turbosquid/ts-specs.json'))
    say(run('import-ts-specs.mjs', ['--limit', '2500']).trim().split('\n')[0]);
  if (fs.existsSync('D:/Clode_Work_Folder/tools/turbosquid/ts-gallery.jsonl'))
    say(run('release-ts-gallery.mjs', ['--limit', '2500']).trim().split('\n')[0]);
}
const recOut = run('build-model-records.mjs');
const vid = (recOut.match(/карточек с роликом: ([\d\s,]+)/) || [])[1];
if (vid) say('карточек с роликом: ' + vid.trim());
// ролики снятых моделей, у которых карточки ещё нет: ждут обновления каталога из студии
const noCard = (recOut.match(/карточки ещё нет: (\d+)/) || [])[1];
if (noCard) say('ежедневных роликов без карточки: ' + noCard);
const pagesOut = run('apply-rebuild.mjs');
say((pagesOut.match(/переписано карточек: [\d\s,]+/) || ['страницы пересобраны'])[0]);
/*
 * Подписи версий из данных (фаза 5, решение основателя 10.11.2026: «выпускай по 2000 в день»). Они меняют ~17 тыс.
 * карточек, поэтому идут ТОЛЬКО в свободный остаток до потолка: сначала собраны характеристики, галереи и ночные
 * тексты, затем считаем изменённые карточки, выпускаем min(2000, остаток - 300 запаса) и пересобираем страницы ещё
 * раз. Подписи никогда не остановят публикацию остального.
 */
{
  /*
   * Счётчик Ahrefs ставится в конце, и до него ВСЕ 38 тыс. пересобранных карточек отличаются от опубликованных:
   * 10.11.2026 пробный прогон насчитал 38 077 и не выпустил ничего. Поэтому ставим его здесь же (шаг вставляет
   * только туда, где счётчика нет, повтор в конце ничего не меняет) и только потом считаем.
   */
  run('inject-ahrefs.mjs');
  const cardsNow = git('status', '--porcelain').split('\n').filter(l => l.includes(' models/')).length;
  const room = Math.min(2000, MAX_CHANGED - cardsNow - 300);
  if (room >= 100) {
    // пробный прогон - пробный: список выпущенных не пополняется (см. память «Пробный запуск должен быть пробным»)
    say(run('release-version-facts.mjs', ['--limit', String(room), ...(DRY ? ['--dry'] : [])]).trim().split('\n')[0]
      + ' (изменено карточек до выпуска: ' + cardsNow + ')');
    if (!DRY) { run('apply-rebuild.mjs'); run('inject-ahrefs.mjs'); }
  } else say('подписи версий: сегодня места нет (изменено карточек ' + cardsNow + ')');
}

run('rebuild-search-index.mjs');
run('add-new-to-catalog.mjs');
// Имя и адрес в выгрузке каталога - из записей. Без этого шага каталог
// показывает вчерашние названия склеенных карточек: на плитке одно, на
// странице другое (5 699 штук на 16.09.2026).
run('sync-catalog-names.mjs');
// Продажи - не в открытые файлы (основатель 09.11.2026): колонка s в fc-chunk
// становится баллом популярности, sales из catalog.json убирается. После всех,
// кто пишет fc-chunk, и до тех, кто по нему сортирует.
say(run('hide-public-sales.mjs').trim().split('\n')[0]);
run('build-category-hubs.mjs');
run('build-categories-hub.mjs');
run('build-subcategories.mjs');
run('build-browse-index.mjs');
// Подборки собираются здесь же: их плитки должны вести на живые карточки, а
// лишние страницы пагинации - сворачиваться в перенаправления ДО сайтмапов.
run('build-collections.mjs');
// Свои WebP 600 px для витрин (13.11.2026, lib/thumbs.mjs): кадры TurboSquid, появившиеся на главной, в каталоге и
// на первых страницах разделов. Сегодня новые идут через прокси wsrv.nl, со следующей сборки - своим файлом.
say(run('build-showcase-thumbs.mjs').trim().split('\n').pop());
run('sync-counters.mjs');
/*
 * Приоритетная карта идёт ДО общих: build-model-sitemaps читает её список и не
 * дублирует сильные адреса у себя. Зачем это всё - в шапке build-priority-sitemap.mjs.
 * Блок «Hand-picked models» на главной (add-home-featured.mjs) снят 09.10.2026 по
 * решению основателя: текстовый список ссылок, пользы от него не измерено.
 */
run('build-priority-sitemap.mjs');
run('build-model-sitemaps.mjs');
run('refresh-sitemaps.mjs');
run('redirect-empty-pagination.mjs');
/*
 * Страница «ссылка в профиле» Instagram (/instagram/, 28.10.2026): новые посты
 * попадают на неё сами. Сборка живёт в tools/meta и ходит в Meta API - если API
 * недоступен, остаётся вчерашняя страница, а сайт публикуется как обычно.
 */
try {
  execFileSync(node, ['D:/Clode_Work_Folder/tools/meta/ig-page-daily.js'],
    { cwd: 'D:/Clode_Work_Folder/tools/meta', encoding: 'utf8', maxBuffer: 1 << 26, timeout: 15 * 60 * 1000 });
  say('страница Instagram пересобрана');
} catch (e) {
  // причина - из вывода самого скрипта, а не «Command failed» (29.10.2026 по нему ничего не понять)
  const why = String((e.stderr || '') + (e.stdout || '') || e.message).trim().split('\n').slice(-3).join(' | ');
  say('страница Instagram не пересобрана (оставлена вчерашняя): ' + why);
}
// счётчик Ahrefs Web Analytics во все страницы, после всех генераторов (28.10.2026)
run('inject-ahrefs.mjs');
run('refresh-sitemaps.mjs');
say('списки, счётчики и сайтмапы пересобраны');

// ── 2. проверки ─────────────────────────────────────────────────────────────
const vd = run('validate-data.mjs');
// Число проверок не зашиваем: 30.10.2026 добавили 18-ю, а здесь ждали «ВСЕ 17» -
// всё зелёное, а публикация остановлена. Признак успеха - сама фраза и код 0.
const allOk = vd.match(/ВСЕ (\d+) ПРОВЕРОК ПРОЙДЕНЫ/);
if (!allOk) {
  const bad = (vd.match(/\n\s{2}\[\d+\][^\n]*/g) || []).slice(-6).join('\n');
  say('validate-data НЕ ПРОЙДЕН:\n' + bad);
  finish(1, 'ОСТАНОВЛЕНО: проверки не прошли, сайт не публикуется.');
}
say('validate-data: ' + allOk[1] + ' из ' + allOk[1]);

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
  'custom-order/index.html', 'data-licensing/index.html', 'full-catalog/index.html', 'instagram', 'ig', 'tt'];
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
  + 'Проверки: validate-data все проверки, audit-site 0 ошибок,\n'
  + 'check-internal-links 0 адресов в никуда.\n\n'
  + 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
git('commit', '-q', '-m', msg);
const head = git('rev-parse', 'HEAD').trim();
say('коммит: ' + head.slice(0, 12) + ', файлов ' + staged);

/*
 * После пуша с правкой assets/js или assets/css GitHub Action пересобирает .min-файлы и кладёт
 * свой коммит «chore: auto-minify CSS and JS» прямо в main. На следующий день наш пуш тогда
 * отвергается: ветка на GitHub впереди. Повторить сборку у себя нельзя - у Action свежий terser
 * (5.51.2 против 5.48.0 на 09.11.2026), вывод другой. Поэтому подтягиваем такие коммиты слиянием,
 * но только если в них одни .min-файлы от бота. Что-то другое - останавливаемся и зовём человека.
 */
git('fetch', '-q', 'origin', 'main');
const ahead = git('rev-list', 'HEAD..origin/main').split('\n').filter(Boolean);
if (ahead.length) {
  const files = git('diff', '--name-only', 'HEAD...origin/main').split('\n').filter(Boolean);
  const bots = git('log', '--format=%an', 'HEAD..origin/main').split('\n').filter(Boolean);
  const onlyMin = files.every(f => /^assets\/(js|css)\/[^/]+\.min\.(js|css)$/.test(f));
  if (!onlyMin || !bots.every(a => a === 'github-actions[bot]')) {
    finish(1, 'ОСТАНОВЛЕНО: на GitHub ' + ahead.length + ' коммит(ов), которых нет здесь, и это не сборка .min. Нужен человек.');
  }
  git('merge', '-q', '--no-edit', '-m', 'merge: сборка .min с GitHub (auto-minify)', 'origin/main');
  say('подтянуто с GitHub: ' + ahead.length + ' коммит(ов) сборки .min (' + files.join(', ') + ')');
}
const pushed = git('rev-parse', 'HEAD').trim();

git('push', 'origin', 'HEAD:main');
const remote = git('ls-remote', 'origin', 'main').split(/\s/)[0];
if (remote !== pushed) finish(1, 'ОСТАНОВЛЕНО: push прошёл, но на GitHub другой коммит. Нужен человек.');
say('опубликовано на GitHub');
finish(0, 'ГОТОВО: сайт обновлён и опубликован.');
