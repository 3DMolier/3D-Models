/*
 * spelling.mjs - британское написание -> американское.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Правила лежали внутри одноразового скрипта, и это
 * уже дважды стоило нам молчаливых промахов: после перевода сайта на
 * американское написание регулярка с «Licence» перестала находить строку
 * лицензии, а список заготовок «для чего годится» перестал совпадать с текстом
 * страниц - там уже стояло «visualization», а в шаблоне «visualisation».
 * Ошибка тихая: скрипт отрабатывает, рапортует ноль правок, и всё выглядит
 * благополучно. Поэтому правила теперь в одном месте.
 *
 * Аудитория сайта - США, поэтому целевое написание американское.
 */

/** Пары «британское, американское». Порядок важен: длинное перед коротким. */
export const SPELLING_RULES = [
  ['catalogued', 'cataloged'],
  ['catalogue', 'catalog'],
  ['licenced', 'licensed'],
  ['licence', 'license'],
  ['visualisation', 'visualization'],
  ['visualise', 'visualize'],
  ['organised', 'organized'],
  ['organise', 'organize'],
  ['modelling', 'modeling'],
  ['programme', 'program'],
  ['colour', 'color'],
  ['optimise', 'optimize'],
  ['recognise', 'recognize'],
  ['analyser', 'analyzer'],
  ['analyse', 'analyze'],
  ['behaviour', 'behavior'],
  ['authorised', 'authorized'],
  ['metres', 'meters'],
];

/**
 * Переводит строку в американское написание, сохраняя регистр первой буквы:
 * LICENCE -> LICENSE, Licence -> License, licence -> license.
 * Работает по словам текста, адреса сюда передавать нельзя.
 */
export function toUS(s) {
  let out = String(s);
  for (const [uk, us] of SPELLING_RULES) {
    out = out.replace(new RegExp(uk, 'gi'), m => {
      if (m === m.toUpperCase()) return us.toUpperCase();
      if (m[0] === m[0].toUpperCase()) return us[0].toUpperCase() + us.slice(1);
      return us;
    });
  }
  return out;
}
