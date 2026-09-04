/*
 * fix-focus-visible.mjs - видимый фокус с клавиатуры (пункт 12).
 *
 * ЧТО БЫЛО. Правила фокуса стояли на отдельных классах кнопок и карточек, и
 * почти все они гасили контур ради тени: «outline:none; box-shadow:0 0 0 3px
 * rgba(0,0,0,0.1)». На белом фоне такая тень не видна - человек, который ходит
 * по сайту с клавиатуры, не понимает, на каком он элементе. На каталоге, поиске,
 * статических страницах и 404 правил фокуса не было вовсе.
 *
 * ЧТО ДЕЛАЕМ.
 *   1. Общее правило для всего, что получает фокус, в оба листа, которые
 *      подключаются на страницах: styles.css и full-catalog.css (каталог
 *      styles.css не грузит).
 *   2. Слабые тени rgba(0,0,0,0.1…0.2) на :focus-visible дополняем настоящим
 *      контуром. Тень оставляем: она даёт мягкое свечение поверх контура.
 *
 * Минификацией занимается Action, .min.css руками не трогаем.
 *
 * Запуск:  node scripts/fix-focus-visible.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const CSS = path.join(ROOT, 'assets', 'css');
const RING = 'outline: 2px solid #1659c9; outline-offset: 2px;';

const BLOCK = `
/* ── Видимый фокус с клавиатуры ─────────────────────────────────────────────
   Общее правило: всё, что вообще получает фокус, обводится заметным контуром.
   Частные правила ниже перекрывают его там, где нужен свой вид. Без этого
   навигация с клавиатуры была слепой: тень rgba(0,0,0,.1) на белом не видна. */
a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible,
[tabindex]:focus-visible {
  ${RING}
  border-radius: 4px;
}
`;

let added = 0, strengthened = 0;
for (const f of ['styles.css', 'full-catalog.css', 'search.css', 'static-pages.css', '404.css', 'model-pages.css']) {
  const file = path.join(CSS, f);
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  // Усиливаем бледные правила: контур вместо снятого контура.
  s = s.replace(/:focus-visible\s*\{([^}]*)\}/g, (whole, body) => {
    if (!/outline:\s*none/.test(body)) return whole;
    if (!/rgba\(0,\s*0,\s*0/.test(body)) return whole;
    strengthened++;
    return whole.replace(/outline:\s*none;?/, () => RING);
  });

  // Общее правило - только в те листы, что подключаются как основные.
  if ((f === 'styles.css' || f === 'full-catalog.css') && !s.includes('Видимый фокус с клавиатуры')) {
    s += BLOCK;
    added++;
  }

  if (s === before) continue;
  fs.writeFileSync(file, s);
  console.log('  ' + f + ' обновлён');
}
console.log('общее правило добавлено в листов: ' + added + ', бледных правил усилено: ' + strengthened);
