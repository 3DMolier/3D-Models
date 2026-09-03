/*
 * apply-rebuild.mjs - ПОДМЕНА СТРАНИЦ. Единственный шаг, меняющий сайт.
 *
 * Шаг 3.4 плана «Пересборка страниц из единой записи».
 *
 * БЕЗ ЯВНОЙ КОМАНДЫ ОСНОВАТЕЛЯ НЕ ЗАПУСКАТЬ. Скрипт переписывает карточки
 * моделей. Всё, что можно было проверить заранее, проверено:
 * compare-rebuild.mjs показывает каждое отличие, validate-records.mjs
 * проверяет сами данные.
 *
 * ЧТО ДЕЛАЕТ. Для каждой живой записи собирает страницу из записи и кладёт на
 * место старой. Заглушки свёрнутых карточек НЕ трогает - они не карточки.
 * Новые модели (status: new) по умолчанию НЕ создаёт: у них нет превью, пока
 * не починен студийный сайт. Создать их можно флагом --with-new.
 *
 * ЗАЩИТЫ
 *   • --dry по умолчанию НЕТ: запуск без флагов уже пишет. Это осознанно -
 *     сухих прогонов было достаточно, а тихая команда, которая ничего не
 *     делает, опаснее явной.
 *   • --limit N     переписать только первые N карточек, для пробы;
 *   • --only <кусок имени> - одну или несколько по имени папки;
 *   • перед записью каждая страница проверяется: непустая, есть <h1>, есть
 *     канонический адрес, нет управляющих символов. Не прошла - файл НЕ
 *     переписывается, и она попадает в отчёт.
 *
 * ПОСЛЕ ЗАПУСКА обязательно:
 *   node scripts/validate-data.mjs      проверки разметки
 *   node scripts/audit-site.mjs         аудит
 *   node scripts/check-internal-links.mjs   ссылки
 *
 * Запуск:  node scripts/apply-rebuild.mjs --limit 20
 *          node scripts/apply-rebuild.mjs --only atlantic-salmon
 *          node scripts/apply-rebuild.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from './render-card.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const RECS = path.join(ROOT, 'data', 'records');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const LIMIT = Number(arg('--limit')) || 0;
const ONLY = arg('--only');
const WITH_NEW = process.argv.includes('--with-new');

const CTRL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]');

/** Страница годна к записи? Проверяем то, что ломалось раньше. */
function usable(html) {
  if (!html || html.length < 4000) return 'страница подозрительно короткая';
  if (html.indexOf('<h1') === -1) return 'нет заголовка';
  if (html.indexOf('rel="canonical"') === -1) return 'нет канонического адреса';
  if (CTRL.test(html)) return 'управляющие символы';
  if (html.indexOf('undefined') !== -1) return 'в разметку попало undefined';
  return null;
}

const t0 = Date.now();
const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));

let written = 0, skipped = 0, created = 0, failed = 0, rejected = 0;
const problems = [];

for (let k = 0; k < idx.chunks; k++) {
  const recs = JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'));
  for (const r of recs) {
    if (ONLY && !r.slug.includes(ONLY)) continue;
    if (LIMIT && written + created >= LIMIT) break;
    const isNew = r.status === 'new';
    if (isNew && !WITH_NEW) { skipped++; continue; }

    const dir = path.join(MODELS, r.slug);
    const file = path.join(dir, 'index.html');

    // Заглушку не трогаем: это не карточка, а перенаправление.
    if (!isNew) {
      let head = '';
      try { head = fs.readFileSync(file, 'utf8').slice(0, 400); } catch (e) { skipped++; continue; }
      if (/http-equiv="refresh"/i.test(head)) { skipped++; continue; }
    } else if (!r.image) {
      /*
       * Новая модель без превью - пустая карточка: вместо снимка заглушка
       * сайта. Такую страницу выпускать нельзя, она не продаёт и портит
       * впечатление о каталоге. Ждём, пока превью появится в выгрузке.
       */
      skipped++;
      continue;
    } else if (fs.existsSync(file)) {
      /*
       * У новой модели страницы быть не должно. Если файл есть - адрес занят, и
       * почти наверняка заглушкой свёрнутого варианта. Затереть её значит убить
       * перенаправление: старые ссылки начнут вести на чужую карточку.
       *
       * Сборщик записей такие адреса и так отсеивает (344 штуки), но проверка
       * здесь дешёвая, а цена промаха - потерянное перенаправление.
       */
      rejected++;
      if (problems.length < 10) problems.push(r.slug + ': адрес занят, новую страницу НЕ создаём');
      continue;
    }

    let html;
    try { html = renderCard(r); }
    catch (e) {
      failed++;
      if (problems.length < 10) problems.push(r.slug + ': сборка упала - ' + e.message);
      continue;
    }

    const why = usable(html);
    if (why) {
      rejected++;
      if (problems.length < 10) problems.push(r.slug + ': ' + why);
      continue;
    }

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, html);
    if (isNew) created++; else written++;
  }
  if (LIMIT && written + created >= LIMIT) break;
  if (!LIMIT && !ONLY) console.log('  … кусок ' + (k + 1) + ' из ' + idx.chunks
    + ', переписано ' + written.toLocaleString('ru-RU'));
}

console.log('\nпереписано карточек: ' + written.toLocaleString('ru-RU'));
if (created) console.log('создано новых: ' + created.toLocaleString('ru-RU'));
console.log('пропущено (заглушки и новые): ' + skipped.toLocaleString('ru-RU'));
if (failed) console.log('СБОРКА УПАЛА: ' + failed);
if (rejected) console.log('НЕ ПРОШЛИ ПРОВЕРКУ, файл не тронут: ' + rejected);
problems.forEach(p => console.log('   ' + p));
console.log('время: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
console.log('\nДАЛЬШЕ ОБЯЗАТЕЛЬНО:');
console.log('  node scripts/validate-data.mjs');
console.log('  node scripts/audit-site.mjs');
console.log('  node scripts/check-internal-links.mjs');
