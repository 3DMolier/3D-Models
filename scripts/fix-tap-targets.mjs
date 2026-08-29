/*
 * fix-tap-targets.mjs - размер касаний на телефоне (44x44).
 *
 * ЧТО НАШЛОСЬ. Явных min-height во всём CSS было пять штук: под палец ничего не
 * подгонялось, высота получалась из шрифта и отступов. Замеры кликабельных
 * элементов: .nav-link 30px, .search-btn 30px, a.chip 26px, .ftag 26px,
 * .ps-tag 24px, .mc-qv 32px, .mp-btn-store 34px, .btn-primary--sm 34px.
 *
 * ЧТО ЭТО ЗНАЧИТ. Норму WCAG 2.2 уровня AA - 24x24 - сайт проходит. 44x44 это
 * уровень AAA и рекомендация Apple: речь про удобство попадания пальцем, а не
 * про нарушение стандарта. Поэтому правка узкая - только под сенсорный экран.
 *
 * ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ.
 *   .mp-gal-thumb, .mp-lb-close, .mp-lb-nav - в первом заходе я вписал их
 *     наугад, а замер показал, что превью галереи и так 64px в высоту. Правило
 *     для элемента, который и без него проходит, только ломает раскладку:
 *     inline-flex сбил бы картинку внутри плитки. Убрано.
 *   .tag, .mc-chip, .mp-rc-chip, .chip--kw, .ftag-sep - это span, а не ссылки.
 *     Подписи пальцем не нажимают.
 *   .skip-link - им пользуются только с клавиатуры, касание к нему не приходит.
 *
 * ДВЕ ГРУППЫ. Кнопки и чипы центрируем по обеим осям. Строку подсказки поиска
 * .ac-item центрировать нельзя - текст уехал бы в середину строки; ей даём
 * только высоту и вертикальное выравнивание.
 *
 * ПОЧЕМУ ЭТО ДЁШЕВО. Правка только в CSS: ни один из 54 077 файлов карточек не
 * трогается, круг деплоя по моделям не нужен.
 *
 * Запуск:  node scripts/fix-tap-targets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const CSS = path.join(ROOT, 'assets', 'css');
const MARK = 'Размер касаний на телефоне';

const HEAD = `
/* ── ${MARK} ────────────────────────────────────────────
   На экранах до 767px всё, во что целятся пальцем, получает 44px по высоте.
   На компьютере размеры прежние: курсор попадает и в 26 пикселей, а более
   крупная шапка съедала бы полезную часть страницы.
   Норму WCAG 2.2 AA (24x24) сайт проходил и раньше; 44x44 - это уровень AAA
   и рекомендация Apple, то есть удобство, а не соответствие стандарту. */
@media (max-width: 767px) {
`;

// Кнопки и чипы: центрируем содержимое по обеим осям.
const CENTRED = {
  'styles.css': ['.btn-primary', '.btn-ghost', '.btn-ts', '.btn-primary--sm', '.btn-ghost--sm',
    '.btn-ghost--md', '.search-btn', '.search-tag', 'a.chip'],
  'model-pages.css': ['.mp-btn-store', '.btn-primary', '.btn-ghost', '.btn-ts-lg', '.btn-custom', 'a.chip'],
  'full-catalog.css': ['.ftag', '.ps-tag', '.mc-qv'],
  'search.css': ['.btn-ts-ghost'],
};
// Только высота, без display и выравнивания: у этих элементов своя раскладка.
// .nav-mobile-toggle - это строка «Categories ▾» с подписью слева и стрелкой
// справа (justify-content: space-between). Центрирование сгоняло бы их в
// середину. .nav-mobile-sub a и .ac-item - строки списка, текст слева.
const ROWS = {
  'search.css': ['.ac-item'],
  'styles.css': ['.nav-mobile-toggle', '.nav-mobile-sub a'],
};

const files = new Set([...Object.keys(CENTRED), ...Object.keys(ROWS)]);
let done = 0;
for (const f of files) {
  const file = path.join(CSS, f);
  if (!fs.existsSync(file)) { console.log('  нет файла: ' + f); continue; }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARK)) { console.log('  уже сделано: ' + f); continue; }

  // Ставим только те селекторы, которые в этом листе есть: правило для
  // несуществующего класса - мусор, в котором потом никто не разберётся.
  const has = sel => s.includes(sel.replace(/^a/, ''));
  const centred = (CENTRED[f] || []).filter(has);
  const rows = (ROWS[f] || []).filter(has);
  if (!centred.length && !rows.length) { console.log('  подходящих селекторов нет: ' + f); continue; }

  let body = '';
  if (centred.length) {
    body += centred.map(x => '  ' + x).join(',\n')
      + ' {\n    min-height: 44px;\n    display: inline-flex;\n'
      + '    align-items: center;\n    justify-content: center;\n  }\n';
  }
  if (rows.length) {
    body += rows.map(x => '  ' + x).join(',\n')
      + ' {\n    min-height: 44px;\n    display: flex;\n    align-items: center;\n  }\n';
  }
  fs.writeFileSync(file, s + HEAD + body + '}\n');
  done++;
  console.log('  ' + f + ': ' + [...centred, ...rows].join(', '));
}
console.log('листов обновлено: ' + done);
