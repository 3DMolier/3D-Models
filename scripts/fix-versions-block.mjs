/*
 * fix-versions-block.mjs - «All Versions of This Model» в одном месте и полностью.
 *
 * ЧТО СЛОМАЛОСЬ. Блок версий существует на карточке ДВАЖДЫ:
 *   - узким списком в правой колонке, над характеристиками;
 *   - сеткой карточек внизу страницы.
 * Так быть не должно было. Версии переносили вниз скриптом apply-card-upgrade:
 * он читал боковой список, строил из него нижнюю сетку и боковой удалял. Но
 * позже прогонялась склейка вариантов (merge-variants --showcase), и она
 * вставляла боковой список ЗАНОВО - уже с полным набором версий, которых к
 * тому времени стало больше.
 *
 * Итог на странице: сбоку девять версий, внизу две. Правая колонка вытягивается
 * далеко вниз, под ней остаётся огромная пустота, а полный список версий видно
 * только в узкой боковой колонке.
 *
 * Масштаб: боковой блок на 13 880 карточках. На 10 225 из них показаны оба
 * блока сразу, на 2 152 внизу версий меньше, чем сбоку. На 3 655 карточках
 * боковой блок ЕДИНСТВЕННЫЙ - если просто удалить его, версии пропадут совсем,
 * поэтому нижнюю сетку там надо создать.
 *
 * ЧТО ДЕЛАЕМ. Боковой список - источник (он полный). Разбираем его, удаляем, и
 * из него же строим нижнюю сетку со ВСЕМИ версиями. Разбор и разметка взяты
 * из apply-card-upgrade.mjs, чтобы карточки выглядели ровно так же.
 *
 * Запуск:  node scripts/fix-versions-block.mjs --dry
 *          node scripts/fix-versions-block.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Результат match - срез исходной строки: он держит в памяти всю страницу.
const cp = v => (v === undefined || v === null) ? v : (' ' + v).slice(1);

const SIDE_RE = /<section class="mp-variants">[\s\S]*?<\/section>/;
const BOTTOM_RE = /<section class="mp-related-section mp-versions-section">[\s\S]*?<\/section>/;

// Разбор бокового списка - тот же, что в apply-card-upgrade.mjs.
function parseVersions(html) {
  const sec = (html.match(/<section class="mp-variants">([\s\S]*?)<\/section>/) || [])[1];
  if (!sec) return [];
  const out = [];
  for (const m of sec.matchAll(/<li class="mp-var([^"]*)">([\s\S]*?)<\/li>/g)) {
    const isMain = /is-main/.test(m[1]);
    const li = m[2];
    const thumb = cp((li.match(/class="mp-var-thumb"[^>]*src="([^"]+)"/) || [])[1] || '');
    let name = (li.match(/<span class="mp-var-name">([\s\S]*?)<\/span>/) || [])[1] || '';
    name = cp(name.replace(/<span class="mp-var-badge">[\s\S]*$/, '').replace(/<[^>]+>/g, '').trim());
    const price = cp((li.match(/<span class="mp-var-price">([^<]*)<\/span>/) || [])[1] || '');
    const link = cp((li.match(/class="mp-var-link" href="([^"]+)"/) || [])[1] || '');
    const fromLink = cp((link.match(/3d-models\/([a-z0-9-]+)-\d+/i) || [])[1] || '');
    const pretty = fromLink ? fromLink.replace(/-3d-model$/, '').split('-')
      .map(w => /^(3d|us|uv|la|mk|ii|iii|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : name;
    const bare = name.trim().replace(/\s*\(\d+\)$/, '');
    out.push({ isMain, thumb, name: pretty || name, tag: /^standard$/i.test(bare) ? '' : bare, price, link });
  }
  return out;
}

function buildSection(versions) {
  const cards = versions.map(v =>
    `<a href="${esc(v.link)}" target="_blank" rel="noopener" class="model-card card-glow mp-rc-link">`
    + `<div class="img-wrap mp-rc-img-wrap"><img src="${esc(v.thumb)}" alt="${esc(v.name)}" width="800" height="450"`
    + ` decoding="async" loading="lazy" data-placeholder="/assets/og/3d-molier-og.jpg" onerror="imgErr(this)">`
    + `<div class="img-placeholder" aria-hidden="true"><span class="mp-rc-placeholder-icon">&#128247;</span></div></div>`
    + `<div class="mp-rc-body"><div class="mp-rc-head"><div class="mp-rc-title">${esc(v.name)}`
    + `${v.isMain ? ' <span class="mp-var-badge">main</span>' : ''}</div></div>`
    + `<div class="mp-rc-foot"><span class="chip chip-teal mp-rc-chip mp-ver-chip">${v.tag ? esc(v.tag) : 'View on TurboSquid'}</span>`
    + `<span class="mp-rc-price">${esc(v.price)}</span></div></div></a>`).join('');
  return `<section class="mp-related-section mp-versions-section"><div class="max-w-7xl mx-auto">`
    + `<div class="section-label mp-mb8">Same model, other versions</div>`
    + `<h2 class="mp-related-h2">All Versions of This Model</h2>`
    + `<div class="mp-related-grid">${cards}</div></div></section>`;
}

let live = 0, hadSide = 0, fixed = 0, replaced = 0, created = 0, emptyCard = 0, noPlace = 0;
let beforeSum = 0, afterSum = 0;
for (const d of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, d, 'index.html');
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  if (!SIDE_RE.test(h)) continue;
  hadSide++;

  const versions = parseVersions(h);
  if (!versions.length) {
    // Боковой блок есть, а версий в нём нет - удалять нечего и строить не из
    // чего. Такое молча пропускать нельзя, поэтому считаем отдельно.
    emptyCard++;
    continue;
  }

  const oldBottom = h.match(BOTTOM_RE);
  beforeSum += oldBottom ? (oldBottom[0].match(/class="model-card card-glow mp-rc-link"/g) || []).length : 0;
  afterSum += versions.length;

  const before = h;
  // Боковой блок и пустая карточка-обёртка вокруг него, если он был там один.
  h = h.replace(SIDE_RE, '');
  h = h.replace(/<div class="mp-spec-card">\s*<div class="mp-spec-block">\s*<\/div>\s*<\/div>/g, '');
  h = h.replace(/<div class="mp-spec-card">\s*<\/div>/g, '');

  const sec = buildSection(versions);
  if (BOTTOM_RE.test(h)) { h = h.replace(BOTTOM_RE, () => sec); replaced++; }
  else if (h.includes('<section class="mp-related-section">')) {
    h = h.replace('<section class="mp-related-section">', () => sec + '<section class="mp-related-section">');
    created++;
  } else if (h.includes('</main>')) {
    h = h.replace('</main>', () => sec + '</main>');
    created++;
  } else { noPlace++; continue; }

  if (h === before) continue;
  fixed++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live);
console.log('с боковым блоком версий: ' + hadSide);
console.log('исправлено: ' + fixed + '  (нижняя сетка заменена ' + replaced + ', создана заново ' + created + ')');
console.log('версий внизу было ' + beforeSum + ', стало ' + afterSum);
if (emptyCard) console.log('боковой блок без версий, не тронули: ' + emptyCard);
if (noPlace) console.log('некуда вставить нижнюю секцию: ' + noPlace);
if (DRY) console.log('(--dry, ничего не записано)');
