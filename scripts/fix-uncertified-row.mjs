/*
 * fix-uncertified-row.mjs - убрать слово «uncertified» из таблицы характеристик.
 *
 * Почему. На 18 727 карточках стоит «Certification: Standard (uncertified)».
 * Это неверно передаёт суть: модели строятся по той же спецификации CheckMate,
 * что и остальные, просто TurboSquid закрыл программу и сертифицировать новые
 * работы больше некому. Строка читается как «качество не проверено», хотя речь
 * о том, что не выдан знак.
 *
 * Что пишем вместо. «Quality standard: Built to CheckMate specification».
 * Формулировку «CheckMate Certified» здесь ставить нельзя: покупатель откроет
 * страницу на TurboSquid, знака не найдёт и перестанет верить остальному, что
 * написано на карточке. Утверждение про спецификацию верно и проверке не
 * противоречит.
 *
 * Карточки со знаком (29 889 CheckMate, 11 021 StemCell) не трогаем - у них в
 * строке стоит настоящий сертификат.
 *
 * Запуск:
 *   node fix-uncertified-row.mjs --dry [--limit N]
 *   node fix-uncertified-row.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MODELS = path.join(ROOT, 'models');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const LIMIT = argv.includes('--limit') ? +argv[argv.indexOf('--limit') + 1] : 0;

const ROW = /<th scope="row">Certification<\/th>\s*<td>Standard \(uncertified\)<\/td>/g;
const NEW = '<th scope="row">Quality standard</th><td>Built to CheckMate specification</td>';

const merged = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'merged-variants.json'), 'utf8'));
const isVariant = new Set(Object.keys(merged));
let live = fs.readdirSync(MODELS).filter(d => !isVariant.has(d)).sort();
if (LIMIT) live = live.slice(0, LIMIT);

const stat = { done: 0, none: 0, skipped: 0, odd: 0 };
for (const slug of live) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { stat.skipped++; continue; }
  if (/http-equiv="refresh"/i.test(html)) { stat.skipped++; continue; }

  ROW.lastIndex = 0;
  const hits = (html.match(ROW) || []).length;
  if (!hits) {
    // Слово могло остаться где-то ещё - тогда точечной замены мало.
    if (html.includes('uncertified')) { stat.odd++; console.log('  проверить вручную: ' + slug); }
    stat.none++;
    continue;
  }
  if (hits !== 1) { stat.odd++; console.log('  вхождений ' + hits + ' на карточке ' + slug); }

  ROW.lastIndex = 0;
  let next = html.replace(ROW, () => NEW);
  if (next.includes('uncertified')) { stat.odd++; console.log('  осталось слово после замены: ' + slug); continue; }

  if (!DRY) fs.writeFileSync(file, next);
  stat.done++;
  if (stat.done % 5000 === 0) console.log('  ' + stat.done + '...');
}

console.log('\n' + (DRY ? 'ПРОБНЫЙ ПРОГОН, ничего не записано' : 'записано'));
console.log('карточек изменено:            ' + stat.done);
console.log('строки не было (со знаком):   ' + stat.none);
console.log('пропущено (перенаправления):  ' + stat.skipped);
console.log('требует внимания:             ' + stat.odd);
