/*
 * csv.mjs - разбор CSV с кавычками.
 *
 * Свой, а не зависимость: файл у нас один, поля простые, а лишний пакет в
 * репозитории требует аудита (правило репо о зависимостях).
 *
 * Раньше каждый скрипт резал строку через split(','), и это молча ломалось на
 * названиях с запятой внутри кавычек: «Chair, Table and Lamp Set» превращался
 * в три поля, и все колонки после него съезжали.
 */

/** Разбирает одну строку CSV в массив значений. */
export function cells(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Читает CSV и вызывает fn(row) на каждой строке, где row - объект по заголовку.
 * Построчно, а не целиком в память: models_master.csv весит 58 МБ.
 */
export function readCsv(text, fn) {
  const lines = text.split(/\r?\n/);
  const head = cells(lines[0]);
  const row = {};
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const c = cells(lines[k]);
    for (let j = 0; j < head.length; j++) row[head[j]] = c[j];
    fn(row, k);
  }
  return head;
}
