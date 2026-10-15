/*
 * Публикация большой правки (впервые - 37 592 карточки после правок A и B в
 * генераторе 07.10.2026; затем noindex 08.10.2026; счётчик Analytics 15.10.2026).
 * Автоматический путь (scripts/daily-site-update.mjs) останавливается на потолке
 * 5 000 изменённых карточек и просит человека - решение принято, все 17 проверок
 * зелёные.
 *
 * Порядок тот же, что в ежедневной задаче: add по областям и маскам В КАВЫЧКАХ
 * (иначе оболочка раскроет маску в десятки тысяч путей и git упадёт), затем
 * коммит, затем push с проверкой через ls-remote.
 *
 * --parts: частями. Карточки четырьмя коммитами по буквам, каждый со своим push
 * и проверкой, последним - данные, карты сайта и код. Упадёт на середине - то,
 * что ушло, уже на сайте, а остаток можно дослать повторным запуском.
 *
 *   node scripts/publish-big-change.mjs msg.txt [--parts]
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

const msgFile = process.argv[2];
if (!msgFile || msgFile.startsWith('--')) { say('укажите файл с текстом коммита: node scripts/publish-big-change.mjs msg.txt [--parts]'); process.exit(1); }
const PARTS = process.argv.includes('--parts');
const baseMsg = fs.readFileSync(msgFile, 'utf8');

const stagedList = () => git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
const addCards = letters => { for (const ch of letters) { try { git('add', 'models/' + ch + '*'); } catch (e) { /* нет карточек на эту букву */ } } };
const addAreas = () => { for (const a of AREAS) { try { git('add', a); } catch (e) { say('  пропуск ' + a + ': менять нечего'); } } };

function commitAndPush(label) {
  const staged = stagedList();
  const cards = staged.filter(l => l.startsWith('models/')).length;
  say(label + ': в индексе файлов ' + staged.length + ', из них карточек ' + cards);
  if (!staged.length) { say('  нечего публиковать'); return true; }
  const head0 = baseMsg.split('\n')[0];
  const msg = baseMsg.replace(head0, head0 + (label ? ' (' + label + ')' : ''))
    .replace('{FILES}', String(staged.length)).replace('{CARDS}', String(cards));
  git('commit', '-q', '-m', msg);
  const head = git('rev-parse', 'HEAD').trim();
  say('  коммит ' + head.slice(0, 12) + ', push');
  git('push', 'origin', 'HEAD:main');
  const remote = git('ls-remote', 'origin', 'main').split(/\s/)[0];
  const ok = remote === head;
  say('  на GitHub: ' + remote.slice(0, 12) + (ok ? ' - совпадает' : ' - НЕ СОВПАДАЕТ, остановлено'));
  return ok;
}

if (!PARTS) {
  addAreas(); addCards('123456789abcdefghijklmnopqrstuvwxyz');
  if (!commitAndPush('')) process.exit(1);
} else {
  const groups = [['цифры и a-f', '123456789abcdef'], ['g-l', 'ghijkl'], ['m-r', 'mnopqr'], ['s-z', 'stuvwxyz']];
  const total = groups.length + 1;
  for (let i = 0; i < groups.length; i++) {
    addCards(groups[i][1]);
    if (!commitAndPush('часть ' + (i + 1) + ' из ' + total + ': карточки ' + groups[i][0])) process.exit(1);
  }
  addAreas();
  if (!commitAndPush('часть ' + total + ' из ' + total + ': данные, карты сайта, код')) process.exit(1);
}
say('ГОТОВО: опубликовано');
