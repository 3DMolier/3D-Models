/*
 * prompt.mjs - промпт для пакетной генерации описаний карточек.
 *
 * Это ТЗ 2.1, то самое, по которому я писал 2 676 карточек руками, переложенное
 * в системный промпт. Правила здесь не пересказаны мягко, а заданы как условия
 * приёмки: всё, что ниже, проверяется машинно в check.mjs, и карточка, не
 * прошедшая проверку, не публикуется.
 *
 * Почему именно так. Три попытки отдать эту работу другой модели в сентябре-
 * октябре 2026 провалились на одном и том же: модель выдумывала числа (размеры в
 * миллиметрах, напряжение, вес), писала о «листинге» вместо предмета и повторяла
 * одни и те же пятисловные обороты на сотнях карточек. Поэтому:
 *   - числа РАЗРЕШЕНЫ только из справки, и это проверяется;
 *   - запрещены мета-обороты про листинг;
 *   - в промпт идут 3 эталона из моих собственных карточек той же категории.
 *
 * Эталоны берутся из data/model-hand-desc.json: это не абстрактный пример, а
 * текст, который уже стоит на сайте и прошёл приёмку.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', '..');

export const SYSTEM = `You write product descriptions for 3D Molier, a catalog of 3D models sold on TurboSquid. You are writing for a working 3D artist who is deciding whether this model will survive in their scene.

HARD RULES. Every one of these is checked by a machine before your text is published. A violation means the card is thrown away.

1. STRUCTURE: exactly 3 paragraphs. 150 to 210 words in total. 5 to 9 sentences in total. Every sentence 12 to 25 words. The first sentence at most 158 characters.
2. NUMBERS: use only numbers that appear in the brief. You may also use a year from the brief and small counting numbers up to twelve. Never invent millimetres, metres, kilograms, volts, watts, horsepower, seat counts, crew counts or any other measurement that is not in the brief. If the brief has no geometry, write about the object without numbers.
3. NO META-TALK: never write about the listing, the page, the catalog entry, the record or the data. Do not write "the listing states", "is recorded", "according to the data". Write about the object and about the file a buyer downloads.
4. EVERY PARAGRAPH must contain at least one observable fact about the object itself - a part, a surface, a shape, how it is built.
5. NAMING: use the model name at most twice. Do not repeat any single naming word more than five times.
6. NO REPEATED PHRASING: do not reuse a five-word sequence from one card in another card. Vary how you say the sales count, the versions, the maps and the year. Unavoidable technical strings such as "maps at 4096 x 4096" are fine.
7. VERSIONS: when the brief lists versions, name them in the third paragraph - what differs, not just how many.
8. LICENCE: when the brief says Editorial Uses Only, say plainly that the model is for editorial work and not for advertising. When the licence is Royalty Free, do not discuss licensing at all.
9. SALES: mention the number of buyers only when the brief shows ten or more. Below that, do not mention sales.
10. SPELLING: American spelling. Use the hyphen "-" and never an em dash or en dash. No typographic quotes.
11. KEYWORDS: 8 to 10 search phrases, each 2 to 6 words, at most one of them generic. Never use "catalog 3d asset", "professional 3d model" or "digital scene asset".

TONE: plain, concrete, confident. No marketing adjectives that carry no information ("stunning", "amazing", "high-quality"). No promises you cannot read off the brief. Write as someone who has opened the file.

OUTPUT: a single JSON object and nothing else:
{"paragraphs": ["...", "...", "..."], "keywords": ["...", "..."]}`;

/* Эталоны: берём карточки с рукописным текстом, по возможности той же категории. */
let HAND = {};
try { HAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'model-hand-desc.json'), 'utf8')); } catch (e) { HAND = {}; }
let CATOF = new Map();
try {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'records', 'index.json'), 'utf8'));
  for (let k = 0; k < idx.chunks; k++) {
    for (const r of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'records', 'records-' + k + '.json'), 'utf8'))) {
      if (HAND[r.slug]) CATOF.set(r.slug, r.category);
    }
  }
} catch (e) { /* без категорий эталоны всё равно годятся */ }

const BY_CAT = new Map();
for (const slug of Object.keys(HAND)) {
  const c = CATOF.get(slug) || 'other';
  if (!BY_CAT.has(c)) BY_CAT.set(c, []);
  BY_CAT.get(c).push(slug);
}

/** Три эталона: сначала своя категория, потом любые. Выбор устойчивый по слагу. */
export function exemplarsFor(catSlug, slug, n = 3) {
  const h = (s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; })(String(slug));
  const own = (BY_CAT.get(catSlug) || []).filter(s => s !== slug);
  const any = Object.keys(HAND).filter(s => s !== slug);
  const pool = own.length >= n ? own : own.concat(any);
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool[(h + i * 7919) % pool.length]);
  return out.map(s => ({ slug: s, paragraphs: HAND[s] }));
}

/**
 * Сообщение для одной карточки: справка как есть плюс эталоны.
 * Справку отдаём JSON-ом, а не прозой: модель не должна догадываться, что из
 * этого факт, а что наша формулировка.
 */
export function userMessage(brief) {
  const ex = exemplarsFor(brief.categorySlug || brief.category || 'other', brief.slug);
  const exText = ex.map((e, i) => `EXAMPLE ${i + 1} (already published on the site, written by hand):\n${e.paragraphs.join('\n\n')}`).join('\n\n');
  return `${exText}

Now write the description for this model. BRIEF (the only source of facts you may use):

${JSON.stringify(brief, null, 1)}

Return only the JSON object.`;
}
