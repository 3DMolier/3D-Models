/*
 * real-size.mjs - строка «Real-world size» карточки: размер НАСТОЯЩЕГО предмета из Википедии (фаза 3, 10.11.2026).
 *
 * Не путать со строкой Dimensions: та - замер самой модели из выгрузки студии, на ней держатся фразы шаблона
 * про масштаб при импорте. Здесь - размер оригинала (самолёта, моста, винтовки), поэтому рядом всегда стоит,
 * ЧЕЙ это размер (статья и версия) и ссылка на источник. Данные - data/model-real-size.json, собирает
 * scripts/collect-real-size.mjs, на карточку попадают только записи, прошедшие проверку.
 *
 * Числа не пересчитываются, если источник метрический: «76.73 m» остаётся «76.73 m» (меньше метра - в мм).
 * Футы и дюймы переводятся в метры (от 100 м - целые, от 1 м - до сотых, меньше - мм), исходное значение -
 * в скобках, чтобы перевод можно было проверить глазом.
 */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ORDER = ['Length', 'Wingspan', 'Rotor diameter', 'Beam', 'Width', 'Height', 'Diameter'];
const group = n => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

/** Одно значение: {m, src, unit} -> «76.73 m», «1.75 m (69 in)», «309 mm». */
export function fmtLen(d) {
  const unit = (d.unit || '').toLowerCase();
  const metric = ['mm', 'cm', 'm'].includes(unit);
  if (metric) {
    const n = Number(String(d.src).replace(/,/g, '').match(/[\d.]+/)[0]);
    if (unit === 'm' && n < 1) return group(+(n * 1000).toFixed(1)) + ' mm';
    return group(n) + ' ' + unit;
  }
  const m = d.m;
  const conv = m >= 100 ? group(Math.round(m)) + ' m' : m >= 1 ? m.toFixed(2) + ' m' : Math.round(m * 1000) + ' mm';
  return conv + ' (' + String(d.src).replace(/\b(\d{4,})\b/g, x => group(Number(x))) + ')';
}

/** Чей это размер: «Boeing EA-18G Growler», «Boeing 777X (777-9)». */
export function subjectOf(rs) {
  // «Boeing 737-800 with CFM56-7B26» -> «Boeing 737-800»: двигатель покупателю модели не нужен
  let v = (rs.variant || '').split(/\s+with\s+/i)[0].replace(/[,\s]+$/, '').trim();
  if (!v) return rs.article;
  const tt = new Set(rs.article.toLowerCase().split(/[^a-z0-9]+/));
  if (v.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).every(w => tt.has(w))) return rs.article;
  // Слова статьи в начале версии не повторяем: «Boeing 737 Next Generation (737-800)», не «(Boeing 737-800)»
  const aw = new Set(rs.article.toLowerCase().split(/\s+/));
  const vw = v.split(/\s+/);
  while (vw.length > 1 && aw.has(vw[0].toLowerCase())) vw.shift();
  v = vw.join(' ').replace(/^[-–]\s*/, '');
  return rs.article + ' (' + v + ')';
}

/** Значение ячейки таблицы характеристик. */
export function realSizeCell(rs) {
  const parts = ORDER.filter(k => rs.dims && rs.dims[k]).map((k, i) => (i ? k.toLowerCase() : k) + ' ' + fmtLen(rs.dims[k]));
  if (!parts.length) return '';
  return esc(parts.join(', '))
    // <small>, а не свой класс: правка CSS сайта ради одной подписи не нужна
    + `<br><small>${esc(subjectOf(rs))}, source: <a href="${esc(rs.url)}" rel="noopener" target="_blank">Wikipedia</a></small>`;
}
