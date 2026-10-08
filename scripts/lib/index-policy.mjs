/*
 * index-policy.mjs - какие карточки просим Google индексировать, и чья дата
 * изменения стоит в разметке. Обе правки сидят за выключателем
 * data/index-policy.json: ежедневная публикация в 11:30 не должна выкатить их
 * сама, пока основатель не увидел примеры.
 *
 * ПОЧЕМУ NOINDEX. 08.10.2026 разобрали провал выдачи: страницы в индексе есть
 * (из 20 случайных карточек 14 «Submitted and indexed»), но сайт целиком то
 * показывают, то нет - 04.08 выключили, 26-30.09 включили на позиции ~10,
 * 01.10 опять выключили, в дни спам-апдейта Google. Ручной меры нет. Профиль
 * сайта - 37 683 карточки, у 2 733 рукописный текст, остальные собраны из
 * шаблона с уникальностью ~26%, показы когда-либо получали 5 209. Под такой
 * профиль и пишется политика против массового контента. Шаблонные карточки без
 * спроса закрываем от индекса, страницы остаются для людей и ссылок.
 *
 * ПРАВИЛО. Карточка индексируется, если есть хоть одно доказательство ценности:
 *   - рукописное описание (hand_desc в записи);
 *   - показы в Google когда-либо (data/search-evidence.json - только растёт);
 *   - продаж на TurboSquid не меньше min_sales.
 * Напишет ночная смена текст - карточка вернётся в индекс сама.
 *
 * ДАТА ИЗМЕНЕНИЯ. До этой правки dateModified и строка «Updated ...» на всех
 * карточках были одной константой из data/site-updated.json, а карта сайта
 * говорила другое. С page_dates дата берётся из data/page-lastmod.json - того же
 * журнала, что и <lastmod>, подробности в scripts/lib/lastmod.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

const read = (f, dflt) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); } catch { return dflt; } };

export const POLICY = Object.assign({ enabled: false, min_sales: 3, page_dates: false }, read('index-policy.json', {}));
const evidence = new Set(read('search-evidence.json', { slugs: [] }).slugs || []);

export function isIndexable(r) {
  if (!POLICY.enabled) return true;
  if (Array.isArray(r.hand_desc) ? r.hand_desc.length : r.hand_desc) return true;
  if (evidence.has(r.slug)) return true;
  return Number(r.sales || 0) >= POLICY.min_sales;
}

/* Дата из журнала lastmod для карточки, или null, если журнала нет/выключено. */
let lm = null;
export function pageDate(slug) {
  if (!POLICY.page_dates) return null;
  if (!lm) lm = read('page-lastmod.json', {});
  const v = lm['models/' + slug + '/index.html'];
  return v ? (Array.isArray(v) ? v[0] : v.date) : null;
}

/* Отметка в начале страницы - её ищут сборщики карт сайта (читают первые байты). */
export const NOINDEX_META = '<meta name="robots" content="noindex, follow">';
export const isNoindexHead = h => h.includes('name="robots" content="noindex');
