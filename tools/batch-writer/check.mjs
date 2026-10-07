/*
 * check.mjs - приёмка текста по ТЗ 2.1. Машинная, без снисхождения.
 *
 * Карточка, не прошедшая проверку, НЕ публикуется: она уходит в retry.json и
 * переписывается следующим прогоном. Так работает защита от того, на чём
 * провалились три внешние попытки: выдуманные числа, мета-обороты про листинг,
 * одни и те же пятисловные обороты на сотнях страниц.
 *
 * Числа против справки проверяет ещё и scripts/night-apply.mjs - это второй
 * рубеж, и он остаётся. Здесь проверка идёт ДО записи, чтобы не тратить правки
 * страниц на заведомый брак.
 *
 * Использование:
 *   import { checkCard, crossCardRepeats } from './check.mjs';
 */

/*
 * Запрещены ССЫЛКИ НА ИСТОЧНИК, а не слово «page» само по себе. Проверка этого
 * списка на моих 2 676 рукописных карточках сначала завалила 14 из 18: в них
 * сплошь «the page holds three builds», «three builds share the page» - и это
 * не мета-болтовня, а факт для покупателя (версии продаются рядом). Ловить надо
 * доказательные обороты: когда текст пересказывает запись вместо предмета.
 */
const META = [
  'the listing states', 'the listing says', 'the listing flags', 'per the listing',
  'according to the listing', 'according to the data', 'the data says', 'the data shows',
  'is recorded', 'are recorded', 'is stated', 'as stated', 'as listed',
  'the catalog entry', 'the record shows', 'this record', 'the product page says',
];
const BANNED_KW = ['catalog 3d asset', 'professional 3d model', 'digital scene asset'];
const FLUFF = ['stunning', 'amazing', 'breathtaking', 'high-quality', 'top-notch', 'cutting-edge', 'state of the art'];

const words = s => String(s).trim().split(/\s+/).filter(Boolean);
const sentences = s => String(s).split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);

/* Числа, которые разрешено писать: всё из справки + год + мелкий счёт до 12. */
function allowedNumbers(brief) {
  const ok = new Set();
  const add = v => {
    if (v === null || v === undefined) return;
    const s = String(v);
    for (const m of s.match(/\d[\d.,]*/g) || []) ok.add(m.replace(/[.,]/g, ''));
  };
  const walk = v => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.values(v).forEach(walk); return; }
    add(v);
  };
  walk(brief);
  for (let i = 0; i <= 12; i++) ok.add(String(i));
  return ok;
}

/**
 * Проверка одной карточки. Возвращает список причин отказа; пустой список - принято.
 */
export function checkCard(card, brief) {
  const bad = [];
  const ps = Array.isArray(card.paragraphs) ? card.paragraphs : [];
  if (ps.length !== 3) bad.push('абзацев ' + ps.length + ', нужно 3');
  const text = ps.join(' ');
  const w = words(text).length;
  if (w < 145 || w > 215) bad.push('слов ' + w + ', нужно 150-210');
  const ss = sentences(text);
  if (ss.length < 5 || ss.length > 9) bad.push('предложений ' + ss.length + ', нужно 5-9');
  for (const s of ss) {
    const n = words(s).length;
    if (n < 12 || n > 25) { bad.push('предложение на ' + n + ' слов: "' + s.slice(0, 50) + '..."'); break; }
  }
  if (ps[0] && sentences(ps[0])[0] && sentences(ps[0])[0].length > 158) bad.push('первое предложение длиннее 158 символов');

  const low = text.toLowerCase();
  for (const m of META) if (low.includes(m)) { bad.push('мета-оборот: ' + m); break; }
  for (const f of FLUFF) if (low.includes(f)) { bad.push('пустой эпитет: ' + f); break; }
  if (/[—–]/.test(text)) bad.push('длинное тире');
  if (/[“”‘’]/.test(text)) bad.push('типографские кавычки');

  // числа только из справки
  const ok = allowedNumbers(brief);
  for (const m of text.match(/\d[\d.,]*/g) || []) {
    const n = m.replace(/[.,]/g, '');
    if (!ok.has(n)) { bad.push('число не из справки: ' + m); break; }
  }

  // единицы измерения, которых в справке нет вовсе
  if (!JSON.stringify(brief).match(/\bmm\b|millimet|\bcm\b|centimet|\bkg\b|kilogram|\bvolt|\bwatt|horsepower/i)) {
    const m = text.match(/\b\d+\s*(mm|cm|m|kg|lb|v|w|hp)\b|\b(millimet|centimet|kilogram|volts?|watts?|horsepower)/i);
    if (m) bad.push('выдуманная единица измерения: ' + m[0]);
  }

  // имя модели не чаще двух раз
  if (brief.name) {
    const nm = String(brief.name).replace(/\s+3D\s+Models?$/i, '').trim();
    if (nm.length > 3) {
      const c = (low.match(new RegExp(nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (c > 2) bad.push('имя модели ' + c + ' раза, можно 2');
    }
  }

  // версии семьи обязаны быть упомянуты
  if (Array.isArray(brief.versions) && brief.versions.length > 1) {
    // Способов сказать про родню много: «five builds sit here», «a second pair
    // shares the page», «sits alongside this one». Проверка ищет любой из них -
    // на моих карточках узкий вариант давал ложные отказы.
    if (!/(builds?|versions?|variants?|shares? the page|sits? alongside|alongside (it|this)|on the page)/i.test(ps[2] || '')) {
      bad.push('версии семьи не упомянуты в третьем абзаце');
    }
  }

  // редакционная лицензия должна быть названа
  if (/editorial/i.test(JSON.stringify(brief.licence || brief.license || '')) && !/editorial/i.test(low)) {
    bad.push('редакционная лицензия не упомянута');
  }
  // продажи ниже 10 называть нельзя
  const sales = Number(brief.sales || 0);
  if (sales > 0 && sales < 10 && new RegExp('\\b' + sales + '\\b').test(text) && /buyer|sale|sold|bought/i.test(text)) {
    bad.push('названы продажи ниже порога 10');
  }

  // ключевые фразы
  const kw = Array.isArray(card.keywords) ? card.keywords : [];
  if (kw.length < 8 || kw.length > 10) bad.push('ключевых фраз ' + kw.length + ', нужно 8-10');
  for (const k of kw) {
    const n = words(k).length;
    if (n < 2 || n > 6) { bad.push('ключевая фраза на ' + n + ' слов: ' + k); break; }
    if (BANNED_KW.includes(String(k).toLowerCase())) { bad.push('запрещённая ключевая фраза: ' + k); break; }
  }
  return bad;
}

/**
 * Повторы между карточками: пятисловный оборот, встречающийся больше чем на
 * REPEAT_MAX карточках партии, валит те из них, что пришли позже. Технические
 * строки с размерами карт пропускаем - их не перепишешь.
 */
export function crossCardRepeats(cards, REPEAT_MAX = 2) {
  const seen = new Map();
  const kill = new Map();
  const tech = /\d+ x \d+/;
  for (const c of cards) {
    const w = words((c.paragraphs || []).join(' ')).map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const mine = new Set();
    for (let i = 0; i + 5 <= w.length; i++) {
      const g = w.slice(i, i + 5).join(' ');
      if (tech.test(g)) continue;
      mine.add(g);
    }
    for (const g of mine) {
      const prev = seen.get(g) || 0;
      if (prev >= REPEAT_MAX) {
        if (!kill.has(c.slug)) kill.set(c.slug, []);
        if (kill.get(c.slug).length < 3) kill.get(c.slug).push(g);
      }
      seen.set(g, prev + 1);
    }
  }
  return kill;
}
