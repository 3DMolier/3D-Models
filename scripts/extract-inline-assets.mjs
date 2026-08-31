/*
 * extract-inline-assets.mjs - убрать встроенные CSS и JS из карточек.
 *
 * ЗАЧЕМ. Разбор веса сайта показал: карточка весит 49 КБ, и только 25% из них -
 * собственный текст модели. Остальное - обвязка, повторённая 54 077 раз. Два
 * куска этой обвязки лежали внутри страниц без всякой нужды:
 *
 *   <style> с правилами ленты кадров   4,8 КБ  ->  260 МБ по каталогу
 *   <script> галереи и лайтбокса       3,2 КБ  ->  190 МБ по каталогу
 *
 * Оба блока побайтово одинаковы на всех карточках - проверено на выборке из
 * 4 000 страниц, вариант ровно один. Смысла копировать их 54 тысячи раз нет:
 * браузер и так скачивает model-pages.css, а скрипт закешируется после первой
 * открытой карточки.
 *
 * ПОЧЕМУ ЭТО ВАЖНО НЕ ТОЛЬКО ДЛЯ ДИСКА. 06.08.2026 публикация GitHub Pages
 * сорвалась по таймауту: сайт вырос до 3,33 ГБ и перестал укладываться в
 * десятиминутный лимит. Сейчас 3,13 ГБ - до той же точки 178 МБ. Этот перенос
 * освобождает примерно 430 МБ, то есть возвращает запас.
 *
 * ЧТО НЕ ТРОГАЕМ. Крошечный <script> с window.dataLayer и gtag - это
 * инициализация аналитики, она обязана стоять в head до остальных скриптов.
 * И редкие блоки видео (14 карточек из 4 000 в выборке): там разметка своя,
 * общего файла для них нет.
 *
 * Запуск:  node scripts/extract-inline-assets.mjs --dry
 *          node scripts/extract-inline-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const VER = (() => { const i = process.argv.indexOf('--v'); return i > 0 ? process.argv[i + 1] : '46'; })();
const JS_TAG = '<script src="/assets/js/model-page.min.js?v=' + VER + '" defer></script>';

/*
 * Опознаём переносимые блоки по содержимому, а не по точному началу строки:
 * первый заход искал текст «(function(){ var strip=…» дословно и не нашёл ни
 * одного скрипта - в файле там другие переносы и отступы. Признак должен быть
 * устойчив к форматированию.
 */
const CSS_HEAD = '/* Лента кадров.';
const isGalleryJs = body => body.includes('.mp-gal-strip') && body.includes('.mp-lb') && body.length > 2000;

let live = 0, cssOut = 0, jsOut = 0, changed = 0, saved = 0, skippedCss = 0, skippedJs = 0;

for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const before = h;

  // 1. блок стилей ленты кадров
  h = h.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (whole, body) => {
    if (!body.includes(CSS_HEAD)) { skippedCss++; return whole; }
    cssOut++;
    return '';
  });

  // 2. скрипт галереи. Ставим внешний файл на его место - в конце body, где он
  //    и стоял; defer снимает вопрос готовности разметки.
  h = h.replace(/<script(?![^>]*src=)(?![^>]*type="application)[^>]*>([\s\S]*?)<\/script>/g, (whole, body) => {
    if (!isGalleryJs(body)) { skippedJs++; return whole; }
    jsOut++;
    return JS_TAG;
  });

  if (h === before) continue;
  changed++;
  saved += before.length - h.length;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('  блок <style> вынесен: ' + cssOut);
console.log('  скрипт галереи вынесен: ' + jsOut);
console.log('  оставлено на месте: стилей ' + skippedCss + ', скриптов ' + skippedJs
  + '  (аналитика и редкие блоки видео)');
console.log('  карточек изменено: ' + changed);
console.log('  освобождено: ' + (saved / 1024 / 1024).toFixed(0) + ' МБ');
if (DRY) console.log('(--dry, ничего не записано)');
