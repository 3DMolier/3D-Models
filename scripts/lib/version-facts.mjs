/*
 * version-facts.mjs - чем версия модели отличается от главной, ИЗ ДАННЫХ (фаза 5 плана
 * D:\Clode_Work_Folder\plans\2026-11-09-card-value-after-quality-drop.md, 10.11.2026).
 *
 * Сейчас плитка версии в блоке «All Versions of This Model» знает только метку из названия («Rigged», «Black»,
 * «Simple Interior»). Метка - слово из названия, а не факт: «Simple Interior» не говорит, насколько легче сетка,
 * а у цветовых версий не сказано, что сетка та же. Здесь - только то, что есть в выгрузке студии или в кабинете
 * TurboSquid: полигоны и вершины, риг, мех, число текстур. Нет данных - нет подписи.
 *
 *   главная:          «217,696 polygons»            (+ «rigged», «fur», если есть)
 *   та же сетка:      «Same polygon count»          (полигоны и вершины совпали; + отличия рига, меха, текстур)
 *   другая сетка:     «197,576 polygons (-9%)»      (процент к главной, если она известна)
 */
const fmt = n => Number(n).toLocaleString('en-US');

/** Подпись главной модели. */
export function mainFacts(m) {
  if (!m || !m.poly) return '';
  const p = [fmt(m.poly) + ' polygons'];
  if (m.rig) p.push('rigged');
  if (m.fur) p.push('fur');
  return p.join(', ');
}

/** Подпись версии v относительно главной m. */
export function versionFacts(v, m) {
  if (!v || !v.poly) return '';
  const p = [];
  const same = m && m.poly && v.poly === m.poly && (!v.vert || !m.vert || v.vert === m.vert);
  // Не «Same mesh»: совпадение полигонов и вершин - это та же топология, а форма бывает другой (поза, лента медали)
  if (same) p.push('Same polygon count');
  else {
    let s = fmt(v.poly) + ' polygons';
    if (m && m.poly) {
      const pct = Math.round((v.poly / m.poly - 1) * 100);
      if (pct) s += ' (' + (pct > 0 ? '+' : '-') + Math.abs(pct) + '%)';
    }
    p.push(s);
  }
  // Риг и мех называем, только если они отличают версию от главной (или главная неизвестна, а у версии они есть)
  if (m ? v.rig !== m.rig : v.rig) p.push(v.rig ? 'rigged' : 'no rig');
  if (m ? v.fur !== m.fur : v.fur) p.push(v.fur ? 'fur' : 'no fur');
  if (m && m.tex && v.tex && v.tex !== m.tex) p.push(v.tex + ' textures');
  const out = p.join(', ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Подпись в плитке: мелкой строкой под названием, без нового класса CSS. Метка data-vf - для разборщиков
 * (night-brief): без неё подпись приклеилась бы к названию версии.
 */
export const factsHtml = t => t
  ? `<span data-vf style="display:block;margin-top:4px;font-size:12px;font-weight:400;color:#555">${String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`
  : '';
