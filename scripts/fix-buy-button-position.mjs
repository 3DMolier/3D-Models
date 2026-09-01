/*
 * fix-buy-button-position.mjs - нижняя кнопка покупки на своё место.
 *
 * ПУНКТ 2 СПИСКА. Кнопка «Buy on TurboSquid» стояла ПОСЛЕ сетки из двух колонок,
 * то есть под обеими сразу. Левая колонка (описание, вопросы, ключевые слова)
 * почти всегда короче правой (характеристики), поэтому между концом текста и
 * кнопкой оставалась широкая пустая полоса, а сама кнопка висела в ней одна.
 *
 * Переносим кнопку внутрь правой колонки, сразу под карточку характеристик:
 * там она примыкает к цене и к списку форматов, то есть стоит рядом с тем, что
 * человек читает перед покупкой, и пустой полосы больше нет.
 *
 * Повторный запуск безопасен: перенесённую кнопку скрипт уже не трогает.
 *
 * Запуск:  node scripts/fix-buy-button-position.mjs --dry
 *          node scripts/fix-buy-button-position.mjs
 *          node scripts/fix-buy-button-position.mjs --only <кусок-имени-папки>
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const oi = process.argv.indexOf('--only');
const ONLY = oi > 0 ? process.argv[oi + 1] : null;

/** Позиция закрывающего </div> для <div>, начинающегося в start. */
function endOfDiv(html, start) {
  if (start < 0) return -1;
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return m.index; }
    else depth++;
  }
  return -1;
}

let live = 0, moved = 0, already = 0, noButton = 0, noSidebar = 0;
for (const d of fs.readdirSync(MODELS).filter(x => !ONLY || x.includes(ONLY))) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;

  const bi = h.indexOf('<a href="https://www.turbosquid.com/3d-models/');
  const btnStart = h.search(/<a href="[^"]*" target="_blank" rel="noopener" class="btn-ts-lg mp-btn-full">/);
  if (btnStart < 0) { noButton++; continue; }

  const sideStart = h.indexOf('<div class="mp-sidebar-col">');
  const sideEnd = endOfDiv(h, sideStart);
  if (sideEnd < 0) { noSidebar++; continue; }

  // Уже перенесена - кнопка стоит ВНУТРИ правой колонки.
  if (btnStart > sideStart && btnStart < sideEnd) { already++; continue; }

  const btnEnd = h.indexOf('</a>', btnStart);
  if (btnEnd < 0) { noButton++; continue; }
  const btn = h.slice(btnStart, btnEnd + 4);

  // Сначала вырезаем, потом вставляем: иначе вторая позиция уезжает.
  let out = h.slice(0, btnStart) + h.slice(btnEnd + 4);
  const newSideEnd = endOfDiv(out, out.indexOf('<div class="mp-sidebar-col">'));
  if (newSideEnd < 0) { noSidebar++; continue; }
  out = out.slice(0, newSideEnd) + btn + out.slice(newSideEnd);

  if (out !== h) { moved++; if (!DRY) fs.writeFileSync(file, out); }
}

console.log('живых карточек: ' + live.toLocaleString('ru-RU'));
console.log('кнопка перенесена: ' + moved.toLocaleString('ru-RU'));
console.log('уже на месте: ' + already.toLocaleString('ru-RU'));
console.log('без нижней кнопки: ' + noButton.toLocaleString('ru-RU') + ', без правой колонки: ' + noSidebar);
if (DRY) console.log('(--dry, ничего не записано)');
