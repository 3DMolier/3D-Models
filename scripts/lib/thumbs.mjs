/*
 * thumbs.mjs - адреса миниатюр (13.11.2026, задание основателя по скорости сайта).
 *
 * ЗАЧЕМ. Плитки и миниатюры показываются шириной 106-371 px, а грузились оригиналами TurboSquid
 * 1920x1080 по 86-325 КБ: страница категории весила 6-9 МБ. Уменьшить кадр по адресу у CDN TurboSquid
 * нельзя - у каждого размера своя подпись в адресе.
 *
 * ДВА ПУТИ:
 *   1. Витрины (главная, каталог, хаб категорий, первые страницы категорий и подкатегорий) - свой WebP
 *      шириной 600 px из assets/img/t/<sha1 адреса>.webp. Качает и ужимает scripts/build-showcase-thumbs.mjs
 *      ПОСЛЕ генераторов: он находит на витринах кадры TurboSquid без своего файла. Новая модель на витрине
 *      первый день идёт через прокси, со следующей сборки - своим файлом.
 *      600, а не 200 px: плитка на телефоне 325 px при плотности экрана 2, кадр 200 px там мылит;
 *      рендеры на белом фоне в WebP 600 px весят 6-15 КБ (замер 13.11.2026).
 *   2. Остальное - прокси wsrv.nl (WebP, q=75) с srcset 400w/800w. Замер 13.11.2026: 4-18 КБ вместо
 *      86-156 КБ, холодный запрос 0,4-1,3 с (TurboSquid без кеша - 0,8-1,5 с), из кеша ~0,15 с.
 *
 * ЗАПАСНОЙ ХОД. В data-orig - исходный адрес TurboSquid. onerror снимает srcset и ставит его (иначе браузер
 * продолжал бы брать кандидата из srcset), второй отказ уходит прежнему обработчику страницы. Код в самом
 * атрибуте, а не в site.js: тот грузится в конце страницы, а ошибка прокси может прийти раньше.
 *
 * Только адреса p.turbosquid.com. Студийные кадры (3dmolier-studio.com) прокси не спасёт - студия не отвечает.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const THUMB_DIR = path.join(ROOT, 'assets', 'img', 't');
export const THUMB_URL = '/assets/img/t/';
export const THUMB_W = 600;
export const TS_RE = /^https:\/\/p\.turbosquid\.com\//;

export const isTs = u => TS_RE.test(String(u || ''));
/** Адрес через wsrv.nl. amp=true - для HTML-атрибута (&amp;), false - для JS. */
export const wsrv = (u, w, amp = true) => {
  const a = amp ? '&amp;' : '&';
  // Слэши и точки не кодируем (как в примере wsrv): адрес короче, страница легче; прочее - кодируем.
  return 'https://wsrv.nl/?url=' + String(u).replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9_.\/~-]/g, c => encodeURIComponent(c))
    + a + 'w=' + w + a + 'output=webp' + a + 'q=75';
};
export const localName = u => crypto.createHash('sha1').update(String(u)).digest('hex').slice(0, 16) + '.webp';

let have = null;
/** Свой WebP для адреса TurboSquid, если он уже скачан; иначе ''. */
export const localThumb = u => {
  if (!isTs(u)) return '';
  if (!have) { try { have = new Set(fs.readdirSync(THUMB_DIR)); } catch { have = new Set(); } }
  const n = localName(u);
  return have.has(n) ? THUMB_URL + n : '';
};

const escAttr = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/"/g, '&quot;');
/* onerror: первый отказ - исходный адрес без srcset, второй - прежний обработчик страницы (fn). */
const onErr = fn => `onerror="var o=this.getAttribute('data-orig');if(o&&this.src!=o){this.removeAttribute('srcset');this.src=o}`
  + (fn ? `else if(window.${fn})${fn}(this)` : '') + `"`;

/** Плитка сетки: показывается 240-370 px. */
export const SIZES_TILE = '(max-width: 640px) 90vw, 400px';

/**
 * Атрибуты картинки: строка, которая встаёт ВМЕСТО `src="..."` и прежнего `onerror="..."` в теге.
 *   orig     - исходный адрес (TurboSquid или любой другой);
 *   w        - ширина src через прокси (400);
 *   set      - ширины srcset через прокси ([400, 800]) или null - один src;
 *   sizes    - атрибут sizes для srcset;
 *   showcase - витрина: свой WebP, если скачан;
 *   fn       - прежний обработчик ошибки страницы ('imgErr', 'handleImageError', 'galThumbFail') или ''.
 * Не TurboSquid - возвращается прежний вид: src и onerror с прежним обработчиком.
 */
export function imgAttrs(orig, { w = 400, set = [400, 800], sizes = SIZES_TILE, showcase = false, fn = 'imgErr' } = {}) {
  const u = String(orig || '');
  if (!isTs(u)) return `src="${escAttr(u)}"` + (fn ? ` onerror="${fn}(this)"` : '');
  if (showcase) {
    const l = localThumb(u);
    if (l) return `src="${l}" data-orig="${escAttr(u)}" ${onErr(fn)}`;
  }
  const srcset = set && set.length
    ? ` srcset="${set.map(x => wsrv(u, x) + ' ' + x + 'w').join(', ')}"` + (sizes ? ` sizes="${sizes}"` : '')
    : '';
  return `src="${wsrv(u, w)}"${srcset} data-orig="${escAttr(u)}" ${onErr(fn)}`;
}

/** Адрес для <link rel="preload" as="image">: тот же, что получит первая картинка (без srcset). */
export function preloadHref(orig, { w = 400, showcase = false } = {}) {
  const u = String(orig || '');
  if (!isTs(u)) return u;
  return (showcase && localThumb(u)) || wsrv(u, w);
}

/**
 * Готовый <link rel="preload"> для первой картинки сетки - с теми же srcset/sizes, что у неё самой
 * (imagesrcset), иначе телефон с плотностью 2 скачал бы кадр дважды: 400 из предзагрузки и 800 из srcset.
 */
export function preloadTag(orig, { w = 400, set = [400, 800], sizes = SIZES_TILE, showcase = false } = {}) {
  const u = String(orig || '');
  if (!u) return '';
  const tag = (href, extra = '') => `<link rel="preload" as="image" href="${href}"${extra} fetchpriority="high">`;
  if (!isTs(u)) return tag(escAttr(u));
  const l = showcase && localThumb(u);
  if (l) return tag(l);
  if (!set || !set.length) return tag(wsrv(u, w));
  return tag(wsrv(u, w), ` imagesrcset="${set.map(x => wsrv(u, x) + ' ' + x + 'w').join(', ')}" imagesizes="${sizes}"`);
}

/**
 * Перевод ГОТОВОЙ страницы (для страниц без генератора: главная, каталог, отрасли): каждая <img> с адресом
 * TurboSquid получает свой WebP (showcase) или прокси, прежний обработчик onerror сохраняется вторым шагом.
 * Уже переведённые (data-orig) и чужие картинки не трогаются.
 */
export function rewriteImgs(html, { showcase = false } = {}) {
  return String(html).replace(/<img\b[^>]*>/g, tag => {
    if (/\bdata-orig="/.test(tag)) return tag;
    const m = tag.match(/\bsrc="(https:\/\/p\.turbosquid\.com\/[^"]+)"/);
    if (!m) return tag;
    const fn = (tag.match(/\bonerror="(\w+)\(this\)"/) || [])[1] || '';
    const big = /\bwidth="(\d+)"/.test(tag) && +tag.match(/\bwidth="(\d+)"/)[1] >= 1000;
    const attrs = imgAttrs(m[1].replace(/&amp;/g, '&'), big ? { w: 800, set: null, showcase, fn } : { showcase, fn });
    return tag.replace(/\s+onerror="[^"]*"/, '').replace(m[0], () => attrs);
  });
}

/*
 * ПАРТНЁРСКИЕ ССЫЛКИ (13.11.2026). Ссылки на TurboSquid с ?referral= - партнёрские, Google просит помечать их
 * rel="sponsored". Ставим «sponsored noopener» на каждую такую ссылку готовой страницы.
 */
const REF_A = /<a\b[^>]*\bhref="https?:\/\/(?:www\.)?turbosquid\.com\/[^"]*[?&](?:amp;)?referral=[^"]*"[^>]*>/gi;
export function sponsorLinks(html) {
  return String(html).replace(REF_A, tag => {
    if (/\brel="[^"]*\bsponsored\b/i.test(tag)) return tag;
    if (/\brel="/i.test(tag)) return tag.replace(/\brel="([^"]*)"/i, (_, v) => `rel="sponsored ${v.replace(/\bsponsored\b/g, '').trim() || 'noopener'}"`);
    return tag.replace(/^<a\b/i, '<a rel="sponsored noopener"');
  });
}
