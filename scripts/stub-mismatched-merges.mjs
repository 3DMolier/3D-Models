/*
 * stub-mismatched-merges.mjs - заменить заглушками страницы, которые склейка
 * промахнулась мимо.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. build-redirect-stubs.mjs сюда не годится по двум
 * причинам, и обе - его правильные свойства, а не изъяны:
 *   1) он НИКОГДА не перезаписывает настоящую карточку - это защита от того,
 *      чтобы одной опечаткой в карте не снести живую страницу;
 *   2) папку без index.html он считает живой карточкой, поэтому просто удалить
 *      файл и позвать его - не работает: страница исчезает, а заглушка не
 *      появляется. Я на этом уже споткнулся: 46 адресов на минуту стали 404.
 *
 * Здесь список закрытый и проверенный: это ровно те страницы, которые в
 * data/merged-variants.json помечены свёрнутыми, но остались живыми - потому
 * что заглушка ушла по вычисленному адресу, а не по настоящему (см.
 * fix-merge-slug-mismatch.mjs). Каждая заменяется заглушкой на главную карточку
 * своей группы.
 *
 * Запуск:  node scripts/stub-mismatched-merges.mjs --dry
 *          node scripts/stub-mismatched-merges.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isStub = f => { try { return /http-equiv="refresh"/i.test(fs.readFileSync(f, 'utf8').slice(0, 400)); } catch (e) { return false; } };
const nameOf = slug => {
  try {
    const h = fs.readFileSync(path.join(MODELS, slug, 'index.html'), 'utf8');
    return (h.match(/<h1[^>]*>([^<]*)</) || [])[1] || slug;
  } catch (e) { return slug; }
};

/** Конечная главная карточка группы: идём по карте, пока не упрёмся в живую. */
function finalTarget(slug) {
  let cur = map[slug];
  const seen = new Set([slug]);
  while (cur && map[cur] && !seen.has(cur)) { seen.add(cur); cur = map[cur]; }
  if (!cur) return null;
  const f = path.join(MODELS, cur, 'index.html');
  if (!fs.existsSync(f) || isStub(f)) return null;
  return cur;
}

const stub = (target, title) =>
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  + '<meta http-equiv="refresh" content="0; url=/models/' + target + '/">'
  + '<link rel="canonical" href="https://3dmolierstudio.com/models/' + target + '/">'
  + '<title>' + esc(title) + ' 3D Model | 3D Molier</title>'
  + '<meta name="description" content="This model page has moved to ' + esc(title) + ' on 3D Molier.">'
  + '<script>location.replace("/models/' + target + '/");</script></head>'
  + '<body><p>This page has moved to <a href="/models/' + target + '/">' + esc(title) + '</a>.</p></body></html>';

let made = 0, noTarget = 0;
const sample = [];
for (const slug of Object.keys(map)) {
  const file = path.join(MODELS, slug, 'index.html');
  if (!fs.existsSync(file) || isStub(file)) continue;      // уже заглушка или папки нет
  const target = finalTarget(slug);
  if (!target) { noTarget++; continue; }
  if (!DRY) fs.writeFileSync(file, stub(target, nameOf(target)));
  made++;
  if (sample.length < 8) sample.push(slug + '  ->  ' + target);
}

console.log('заменено заглушками: ' + made + ', без живой главной: ' + noTarget);
sample.forEach(s => console.log('   ' + s));
if (DRY) console.log('(--dry, ничего не записано)');
