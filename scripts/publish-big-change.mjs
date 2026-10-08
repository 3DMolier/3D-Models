/*
 * Публикация большой правки (впервые - 37 592 карточки после правок A и B в
 * генераторе 07.10.2026; затем noindex 08.10.2026). Автоматический путь (scripts/daily-site-update.mjs) останавливается
 * на потолке 5 000 изменённых карточек и просит человека - решение принято, все
 * 17 проверок зелёные.
 *
 * Порядок тот же, что в ежедневной задаче: add по областям и маскам В КАВЫЧКАХ
 * (иначе оболочка раскроет маску в десятки тысяч путей и git упадёт), затем
 * коммит, затем push с проверкой через ls-remote.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const say = s => process.stdout.write(new Date().toISOString().slice(11, 19) + '  ' + s + '\n');

const AREAS = ['data', 'sitemaps', 'sitemap.xml', 'sitemap-index.xml', 'index.html',
  'catalog/index.html', 'browse', 'categories', 'collections', 'about/index.html',
  'custom-order/index.html', 'data-licensing/index.html', 'full-catalog/index.html',
  '.gitignore',
  // код: правки генератора и новая линия пакетной генерации
  'scripts/card-content.mjs', 'scripts/render-card.mjs', 'scripts/daily-site-update.mjs',
  'scripts/build-category-stats.mjs', 'tools/batch-writer', 'tools/night-writer',
  // 08.10.2026: noindex шаблонных карточек и дата изменения из журнала
  'scripts/lib/index-policy.mjs', 'scripts/lib/lastmod.mjs', 'scripts/build-model-sitemaps.mjs',
  'scripts/build-image-sitemaps.mjs', 'scripts/refresh-sitemaps.mjs', 'scripts/publish-big-change.mjs'];

say('добавляю области');
for (const a of AREAS) {
  try { git('add', a); } catch (e) { say('  пропуск ' + a + ': менять нечего'); }
}
say('добавляю карточки по буквам');
for (const ch of '123456789abcdefghijklmnopqrstuvwxyz') {
  try { git('add', 'models/' + ch + '*'); } catch (e) { /* нет карточек на эту букву */ }
}
const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
const cards = staged.filter(l => l.startsWith('models/')).length;
say('в индексе файлов: ' + staged.length + ', из них карточек: ' + cards);
if (!staged.length) { say('нечего публиковать'); process.exit(0); }

// Текст коммита - из файла: у каждой большой правки свой.
const msgFile = process.argv[2];
if (!msgFile) { say('укажите файл с текстом коммита: node scripts/publish-big-change.mjs msg.txt'); process.exit(1); }
const msg = fs.readFileSync(msgFile, 'utf8').replace('{FILES}', String(staged.length)).replace('{CARDS}', String(cards));
say('коммит');
git('commit', '-q', '-m', msg);
const head = git('rev-parse', 'HEAD').trim();
say('коммит ' + head.slice(0, 12));

say('push');
git('push', 'origin', 'HEAD:main');
const remote = git('ls-remote', 'origin', 'main').split(/\s/)[0];
say('на GitHub: ' + remote.slice(0, 12) + (remote === head ? ' - совпадает' : ' - НЕ СОВПАДАЕТ, нужен человек'));
say(remote === head ? 'ГОТОВО: опубликовано' : 'ВНИМАНИЕ: проверить вручную');
