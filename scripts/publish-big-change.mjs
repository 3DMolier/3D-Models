/*
 * Одноразовая публикация большой правки: 37 592 карточки после правок A и B в
 * генераторе. Автоматический путь (scripts/daily-site-update.mjs) останавливается
 * на потолке 5 000 изменённых карточек и просит человека - решение принято, все
 * 17 проверок зелёные.
 *
 * Порядок тот же, что в ежедневной задаче: add по областям и маскам В КАВЫЧКАХ
 * (иначе оболочка раскроет маску в десятки тысяч путей и git упадёт), затем
 * коммит, затем push с проверкой через ls-remote.
 */
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
  'scripts/build-category-stats.mjs', 'tools/batch-writer', 'tools/night-writer'];

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

const msg = `content: уникальность карточек - независимый ключ слота и числа в тексте

Правка A: варианты фраз выбирались линейными производными одного seed, и
сочетание повторялось с периодом lcm(7,10,12,4,8) = 840. На 35 500 шаблонных
карточек это 840 текстовых скелетов, каждый примерно у 42 страниц. Теперь ключ
считается хешем от пары (seed, имя слота) - сочетаний около 1,1 млрд, скелет у
каждой карточки свой. То же сделано в блоке FAQ.

Правка B: в предложениях, где не было ни одного своего числа, появились данные
карточки - полигонаж, отношение вершин к полигонам, сравнение с медианой
категории по полигонам и цене, число покупок (только от 10 продаж: ниже порога
это работает против нас). Медианы считает новый build-category-stats.mjs.

Замер до и после (5-словные отрывки, выборка 710 живых карточек):
median уникальности шаблонной карточки 24,3% -> 25,7%; рукописные 44,4%,
не изменились. Прирост скромный и это честная цифра: фраза с медианой
одинакова у всех карточек раздела, поэтому для читателя она полезна, а для
метрики почти нет. Порог 40% берёт только рукописный текст.

Плюс линия пакетной генерации описаний (tools/batch-writer): Message Batches
API, приёмка по ТЗ 2.1, откалиброванная по рукописным эталонам - все 18 из 18
проходят. Публикации она не делает.

Файлов: ${staged.length}, из них карточек: ${cards}.
Проверки: validate-data 17 из 17, audit-site 0 ошибок,
check-internal-links 0 адресов в никуда.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
`;
say('коммит');
git('commit', '-q', '-m', msg);
const head = git('rev-parse', 'HEAD').trim();
say('коммит ' + head.slice(0, 12));

say('push');
git('push', 'origin', 'HEAD:main');
const remote = git('ls-remote', 'origin', 'main').split(/\s/)[0];
say('на GitHub: ' + remote.slice(0, 12) + (remote === head ? ' - совпадает' : ' - НЕ СОВПАДАЕТ, нужен человек'));
say(remote === head ? 'ГОТОВО: опубликовано' : 'ВНИМАНИЕ: проверить вручную');
