/*
 * ahrefs.mjs - счётчик Ahrefs Web Analytics (28.10.2026, просьба основателя: «Start
 * monitoring» в проекте Ahrefs 3dmolierstudio и код сервиса на сайт).
 *
 * Счётчик без cookies, ставится в <head> рядом с Google Analytics. Ключ data-key -
 * публичный идентификатор проекта, он виден в коде любой страницы.
 *
 * Два правила, оба из прошлых ошибок:
 *   - в сравнение содержимого для lastmod он НЕ входит (lib/lastmod.mjs вырезает его
 *     так же, как GA): иначе 55 тысяч страниц разом получили бы «обновлено сегодня»,
 *     как это случилось с пунктом подвала 28.10.2026;
 *   - на страницы-перенаправления не ставится: заглушка не визит, она тут же уводит.
 */
export const AHREFS_TAG = '<script src="https://analytics.ahrefs.com/analytics.js" data-key="igkyXlOW8OD+1w8KdljhPg" async></script>';
export const AHREFS_RE = /\n?<script src="https:\/\/analytics\.ahrefs\.com\/analytics\.js" data-key="[^"]*" async><\/script>/g;

/** Вставить счётчик перед </head>, если его ещё нет и страница не перенаправление. */
export function injectAhrefs(html) {
  if (html.includes('analytics.ahrefs.com/analytics.js')) return html;
  if (/http-equiv="refresh"/i.test(html.slice(0, 600))) return html;
  const i = html.indexOf('</head>');
  if (i < 0) return html;
  return html.slice(0, i) + AHREFS_TAG + '\n' + html.slice(i);
}
