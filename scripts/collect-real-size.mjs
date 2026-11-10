#!/usr/bin/env node
/*
 * collect-real-size.mjs - размеры НАСТОЯЩЕГО предмета из Википедии (фаза 3 плана
 * D:\Clode_Work_Folder\plans\2026-11-09-card-value-after-quality-drop.md, 10.11.2026).
 *
 * ЧТО ЭТО И ЧЕГО ЭТО НЕ ЕСТЬ. Строка Dimensions на карточке - замер самой модели из выгрузки студии, и на нём
 * держатся фразы шаблона («built at true scale, no unit fix on import»). Размер из Википедии - это размер
 * оригинала (Boeing 777-9 длиной 76.73 m), а не нашей модели. Поэтому он живёт в другом поле и другой строке
 * («Real-world size», со ссылкой на статью) и в прозу шаблона не попадает.
 *
 * Решение основателя 10.11.2026: только явные реальные модели (Boeing 777X, Peterbilt 579), с пометкой
 * источника; для обобщённых предметов («Office Chair», камень, дерево) размеры не выдумывать. Поэтому
 * сверка строгая, и всё сомнительное идёт не на карточку, а в очередь ручной проверки:
 *   - заголовок статьи - имя собственное (каждое слово после первого с заглавной или с цифрой);
 *   - каждое значимое слово заголовка есть в названии модели;
 *   - статья с карточкой изделия (самолёт, машина, оружие, корабль, здание...), а не компания или список;
 *   - значение одно: несколько поколений, списки, «или» -> поле пропускаем;
 *   - год в названии модели должен попасть в годы выпуска поколения из статьи;
 *   - игрушки, логотипы, миниатюры - отбрасываем; детали («Engine», «Cockpit», «Battery Module») и сцены
 *     («... with Landing Pad») - только в ручную проверку.
 *
 * Сеть: только en.wikipedia.org (публичный API, без ключей). Ответы кешируются в
 * C:\Clode_Work_Folder\tools\real-size-cache, повторный прогон сеть не трогает.
 *
 * Запуск (HTTPS_PROXY и NODE_USE_ENV_PROXY=1 для Node fetch):
 *   node scripts/collect-real-size.mjs [--limit N] [--validate] [--offline]
 *     --validate  прогнать по карточкам, где размеры студии УЖЕ есть, и сверить: так меряется точность сверки
 *     --offline   только кеш
 * Пишет C:\Clode_Work_Folder\tools\real-size-cache\candidates[-validate].json. На карточки ничего не идёт:
 * одобренные записи переносятся в data/model-real-size.json отдельным шагом после проверки.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = 'C:/Clode_Work_Folder/tools/real-size-cache';
const arg = n => process.argv.includes(n);
const argv = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT = Number(argv('--limit', 0)) || Infinity;
const VALIDATE = arg('--validate');
const OFFLINE = arg('--offline');
fs.mkdirSync(CACHE + '/http', { recursive: true });

// ── сеть с кешем ────────────────────────────────────────────────────────────
const UA = { 'User-Agent': '3DMolier-catalog/1.0 (https://3dmolierstudio.com)' };
let netCalls = 0;
async function api(params) {
  const url = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&maxlag=5&' + new URLSearchParams(params);
  const f = CACHE + '/http/' + crypto.createHash('sha1').update(url).digest('hex') + '.json';
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (OFFLINE) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise(r => setTimeout(r, 250 + attempt * 3000));
    try {
      const res = await fetch(url, { headers: UA });
      const j = await res.json();
      if (j.error && j.error.code === 'maxlag') continue;
      netCalls++;
      fs.writeFileSync(f, JSON.stringify(j));
      return j;
    } catch (e) { if (attempt === 3) throw e; }
  }
  return null;
}

// ── слова ───────────────────────────────────────────────────────────────────
const toks = s => String(s).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(['the', 'of', 'and', 'de', 'la', 'le', 'du', 'des', 'von', 'der', 'di', 'family', 'series']);
// Сокращения марок в наших названиях
const ALIAS = [[['heckler', 'koch'], 'hk'], [['mercedes', 'benz'], 'mercedes'], [['rolls', 'royce'], 'rr']];
// Не реальный предмет в натуральную величину
const TOY = /\b(toys?|lego|miniatures?|diecast|die[- ]cast|scale model|rc|r\/c|figurines?|key ?chains?|logos?|emblems?|badges?|signs?|posters?|cakes?|cookies?|ornaments?|souvenirs?|plush|papercraft|origami|icons?|model kit|stickers?|decals?|statuettes?|cartoon|stylized|stylised|chibi|low poly toy)\b/i;
// Деталь или узел: размер целого к ней не относится
const PART = /\b(engines?|motors?|wheels?|tires?|tyres?|rims?|seats?|cockpits?|cabins?|doors?|hoods?|bumpers?|headlights?|taillights?|dashboards?|steering|gearbox|transmission|exhausts?|propellers?|rotors?|blades?|landing gear|turrets?|barrels?|magazines?|scopes?|stocks?|grips?|suppressors?|silencers?|batter(y|ies)|modules?|boards?|chips?|screens?|keyboards?|parts?|components?|disassembled|internals?|internal|cutaway|exploded|skeleton|frames?|body kit|kits?|fuselage|wings?|tails?|nose|sections?|mock-?up|warheads?|tubes?|tripods?|decks?|stages?|boosters?|skybridges?|clocks?|ammo|ammunition|cartridges?|bullets?|shells?|missiles?|rockets?|bombs?|pylons?|containers?)\b/i;
// Набор или сцена из нескольких предметов
const SCENE = /\b(sets?|collections?|packs?|bundles?|fleet|lineup|scene|diorama|crew|with|and|on|in)\b/i;
// Слова версии, которые не меняют предмет (их выбрасываем перед поиском)
const NOISE = /\b(rigged\d*|simple interior|with interior|full interior|detailed interior|interior and exterior|low ?poly|lowpoly|high ?poly|animated|generic|clean|dirty|damaged|destroyed|wrecked|rusty|old|new|abandoned|for (c4d|maya|blender|3ds ?max|unity|unreal)|3d model|pbr|black|white|red|green|blue|yellow|grey|gray|silver|orange|gold|golden|brown|pink|purple|beige|camo|camouflage|desert|matte|glossy|dark|light|dirt|winter|summer)\b/gi;

const titleProper = t => t.replace(/\s*\(.*?\)\s*/g, ' ').trim().split(/\s+/).slice(1)
  .every(w => /^[A-Z0-9&'’.\-–/]/.test(w) || ['de', 'la', 'of', 'and', 'the', 'von', 'der', 'du', 'di', 'des', 'le', 'van', 'del', 'da'].includes(w));

function titleInName(title, name) {
  const base = title.replace(/\s*\(.*?\)\s*/g, ' ');
  let tt = toks(base).filter(t => !STOP.has(t));
  const nt = new Set(toks(name));
  const squash = toks(name).join('');
  for (const [full, short] of ALIAS) if (full.every(w => tt.includes(w)) && nt.has(short)) tt = tt.filter(w => !full.includes(w));
  const miss = tt.filter(t => !(nt.has(t) || ((/\d/.test(t) || t.length >= 5) && squash.includes(t))));
  return { ok: tt.length > 0 && miss.length === 0, miss };
}

// ── разбор статьи ───────────────────────────────────────────────────────────
// Карточки изделий, у которых размеры - свойство предмета
const IB = /\{\{\s*(Infobox (automobile|motorcycle|aircraft type|aircraft begin|weapon|ship characteristics|ship begin|spacecraft|space ?craft class|locomotive|rail vehicle|train|bus|tram|tractor|truck|building|skyscraper|tower|bridge|lighthouse|monument|structure|dam|rocket|launch vehicle|military vehicle|tank|firearm|gun|artillery|mobile phone|information appliance|computer|camera|musical instrument|boat|yacht|submarine)|Aircraft specs|Aircraft specifications)\b/i;
const KIND = txt => {
  const m = txt.match(IB); if (!m) return null;
  const k = m[1].toLowerCase();
  if (/aircraft/.test(k)) return 'aircraft';
  if (/automobile|motorcycle|bus|tractor|truck/.test(k)) return 'vehicle';
  if (/ship|boat|yacht|submarine/.test(k)) return 'ship';
  if (/building|skyscraper|tower|bridge|lighthouse|monument|structure|dam/.test(k)) return 'structure';
  if (/weapon|tank|military|firearm|gun|artillery/.test(k)) return 'weapon';
  return 'other';
};

function clean(v) {
  return String(v || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{\s*(efn|sfn|refn|cite|citation needed|cn|nbsp|abbr|clarify|when|by whom|r)\b[^{}]*\}\}/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
const U = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048, ftin: 0.3048, yd: 0.9144 };
/** Одно значение длины: {m: метры, src: 'исходная запись'} или null, если значение не одно или не разобрать. */
function length1(raw) {
  const v = clean(raw);
  if (!v) return null;
  if (/<br|\{\{\s*(ubl|unbulleted|plainlist|flatlist|hlist|bulleted)|\n\s*[*#]|\bor\b|;|\bto\b/i.test(v)) return { multi: true };
  const conv = [...v.matchAll(/\{\{\s*(?:convert|cvt)\s*\|\s*([\d.,]+)\s*\|\s*(mm|cm|m|in|ft|yd)\b(?:\s*\|\s*([\d.,]+)\s*\|\s*in\b)?/gi)];
  let m = null, src = '';
  if (conv.length > 1) return { multi: true };
  if (conv.length === 1) {
    const c = conv[0]; const n = Number(c[1].replace(/,/g, ''));
    m = n * U[c[2].toLowerCase()] + (c[3] ? Number(c[3]) * U.in : 0);
    src = c[1] + ' ' + c[2] + (c[3] ? ' ' + c[3] + ' in' : '');
    // Рядом с шаблоном ещё число - это уже второе значение
    if (/\d/.test(v.replace(c[0], '').replace(/\{\{[^{}]*\}\}/g, '').replace(/\([^)]*\)/g, ''))) return { multi: true };
  } else {
    const plain = v.replace(/\([^)]*\)/g, '');
    const ft = plain.match(/([\d.,]+)\s*ft\s*(?:([\d.,]+)\s*in)?/i);
    const all = [...plain.matchAll(/([\d.,]+)\s*(mm|cm|m|in|ft)\b/gi)];
    if (ft && all.length <= 2) { m = Number(ft[1].replace(/,/g, '')) * U.ft + (ft[2] ? Number(ft[2]) * U.in : 0); src = ft[0].trim(); }
    else if (all.length === 1) { m = Number(all[0][1].replace(/,/g, '')) * U[all[0][2].toLowerCase()]; src = all[0][0]; }
    else return all.length ? { multi: true } : null;
  }
  if (!Number.isFinite(m) || m <= 0) return null;
  // Пометка в скобках словами («gun forward», «hull», «fuselage») - важна, без неё значение двусмысленно
  const note = (v.match(/\(([^)]*[a-z]{3,}[^)]*)\)/i) || [])[1];
  return { m, src, unit: (src.match(/[a-z]+$/i) || [''])[0].toLowerCase(), note: note && !/\d\s*(mm|cm|m|in|ft)\b/i.test(note) ? note.trim() : '' };
}

/** Шаблон {{...}} целиком, начиная с позиции idx (с учётом вложенных шаблонов и ссылок). */
function block(txt, idx) {
  let depth = 0;
  for (let i = idx; i < txt.length - 1; i++) {
    const two = txt.substr(i, 2);
    if (two === '{{') { depth++; i++; } else if (two === '}}') { depth--; i++; if (depth === 0) return txt.slice(idx, i + 1); }
  }
  return txt.slice(idx);
}
/** Значение параметра шаблона: до следующего «|» или «}}» на нулевой глубине. */
function field(txt, names) {
  for (const n of names) {
    const re = new RegExp('\\|\\s*' + n.replace(/[?]/g, '\\?').replace(/ /g, '[ _]') + '\\s*=', 'ig');
    let m;
    while ((m = re.exec(txt))) {
      let i = m.index + m[0].length, depth = 0, out = '';
      while (i < txt.length) {
        const two = txt.substr(i, 2);
        if (two === '{{' || two === '[[') { depth++; out += two; i += 2; continue; }
        if (two === '}}' || two === ']]') { if (depth === 0) break; depth--; out += two; i += 2; continue; }
        if (txt[i] === '|' && depth === 0) break;
        out += txt[i]; i++;
      }
      if (clean(out)) return out;
    }
  }
  return null;
}
/** Блок с характеристиками нужного вида: у самолёта - шаблон Aircraft specs, у корабля - ship characteristics. */
function specBlock(txt, kind) {
  const pick = re => { const m = re.exec(txt); return m ? block(txt, m.index) : null; };
  if (kind === 'aircraft') return pick(/\{\{\s*Aircraft spec(?:s|ifications)\b/i);
  if (kind === 'ship') return pick(/\{\{\s*Infobox ship characteristics\b/i) || pick(/\{\{\s*Infobox (boat|yacht|submarine)\b/i);
  return pick(IB);
}

function extract(full, kind) {
  const txt = specBlock(full, kind) || '';
  const out = {}; const multi = [];
  const put = (label, raw) => {
    if (raw == null) return;
    const r = length1(raw);
    if (!r) return;
    if (r.multi) { multi.push(label); return; }
    out[label] = r;
  };
  if (kind === 'aircraft') {
    const heli = /\|\s*helicopter\?\s*=\s*y/i.test(txt) || /\|\s*main rot (number|dia)/i.test(txt);
    const t = txt;
    const mOrFt = (k) => {
      const m = clean(field(t, [k + ' m']));
      if (m) return m + ' m';
      const ft = clean(field(t, [k + ' ft'])); const inch = clean(field(t, [k + ' in']));
      if (ft) return ft + ' ft' + (inch ? ' ' + inch + ' in' : '');
      return field(t, [k + ' main']);
    };
    put('Length', mOrFt('length'));
    if (heli) put('Rotor diameter', mOrFt('main rot dia') || mOrFt('span'));
    else put('Wingspan', mOrFt('span'));
    put('Height', mOrFt('height'));
  } else if (kind === 'ship') {
    put('Length', field(txt, ['Ship length', 'length']));
    put('Beam', field(txt, ['Ship beam', 'beam']));
    put('Height', field(txt, ['Ship height']));
  } else if (kind === 'structure') {
    put('Height', field(txt, ['architectural', 'height']));
    put('Length', field(txt, ['length']));
    put('Width', field(txt, ['width']));
  } else {
    put('Length', field(txt, ['length', 'overall length']));
    put('Width', field(txt, ['width']));
    put('Height', field(txt, ['height']));
    put('Diameter', field(txt, ['diameter']));
  }
  // Вариант, к которому относятся характеристики самолёта: «==Specifications (777-9)==»
  const variant = kind === 'aircraft' ? ((full.match(/==+\s*Specifications?\s*\(([^)]+)\)\s*==+/i) || [])[1] || '') : '';
  const ib = full.match(IB) ? block(full, full.match(IB).index) : '';
  const prod = field(ib, ['production', 'model_years', 'model years', 'manufacture', 'built', 'production_date']);
  return { dims: out, multi, variant: variant.trim(), production: prod ? clean(prod).replace(/\[\[|\]\]/g, '') : '' };
}

// ── карточки ────────────────────────────────────────────────────────────────
const recs = [];
for (const f of fs.readdirSync(ROOT + '/data/records')) if (/^records-\d+\.json$/.test(f)) recs.push(...JSON.parse(fs.readFileSync(ROOT + '/data/records/' + f, 'utf8')));
const sm = new Set();
for (const d of [ROOT, ROOT + '/sitemaps']) for (const f of fs.readdirSync(d)) if (/sitemap.*\.xml$/.test(f))
  for (const m of fs.readFileSync(d + '/' + f, 'utf8').matchAll(/\/models\/([^/<]+)\/</g)) sm.add(m[1]);
const CATS = new Set(['Vehicles', 'Aircraft', 'Ships & Boats', 'Weapons', 'Space & Sci-Fi', 'Industrial Equipment', 'Architecture & Landmarks']);
const hasDim = r => !!(r.specs && r.specs.dimensions);
const pool = recs.filter(r => sm.has(r.slug) && CATS.has(r.category_name) && (VALIDATE ? hasDim(r) : !hasDim(r)));
console.log('карточек в работе: ' + pool.length + (VALIDATE ? ' (проверка: размеры студии уже есть)' : ''));

const results = [];
let done = 0;
// 6 потоков: через прокси ответ ~1,6 с, по одному 7 тыс. карточек шли бы ~6 ч
async function one(r) {
  const name = r.name;
  const res = { id: r.id, slug: r.slug, name, category: r.category_name, status: 'none', why: '' };
  results.push(res);
  done++;
  if (done % 100 === 0) console.log('  ' + done + ' / ' + Math.min(pool.length, LIMIT) + ', запросов в сеть ' + netCalls);
  if (TOY.test(name)) { res.why = 'игрушка/знак'; return; }
  /*
   * Путь 1 - кусок названия как заголовок Википедии. «A-29 Super Tucano» в Википедии - перенаправление на
   * «Embraer EMB 314 Super Tucano», «HK G36» - на «Heckler & Koch G36». Перенаправление - псевдоним, заведённый
   * людьми, поэтому совпадение точное. Куски от 2 до 6 слов подряд, берём самый длинный, который ведёт на
   * статью-имя собственное (не «Attack aircraft», не «Intermodal container») и не на страницу неоднозначности.
   */
  const words = name.replace(/\b(rigged\d*|simple interior|with interior|low ?poly|lowpoly|game ready|simplified|for (c4d|maya|blender|3ds ?max))\b/gi, ' ')
    .replace(/\s+/g, ' ').trim().split(' ');
  const grams = [];
  for (let n = Math.min(6, words.length); n >= 2; n--) for (let i = 0; i + n <= words.length; i++) grams.push({ t: words.slice(i, i + n).join(' '), n, i });
  let title = null, via = '';
  if (grams.length) {
    const g = await api({ action: 'query', titles: grams.slice(0, 50).map(x => x.t).join('|'), redirects: 1, prop: 'pageprops', ppprop: 'disambiguation' });
    const q = (g && g.query) || {};
    const step = new Map();
    for (const x of [...(q.normalized || []), ...(q.redirects || [])]) step.set(x.from, x.to);
    const ok = new Map((q.pages || []).filter(p => !p.missing && !p.invalid && !(p.pageprops && 'disambiguation' in p.pageprops)).map(p => [p.title, p]));
    const resolve = t => { for (let k = 0; k < 4 && step.has(t); k++) t = step.get(t); return t; };
    for (const x of grams) {
      const fin = resolve(x.t);
      if (ok.has(fin) && titleProper(fin) && !/^(List of|Lists of)\b/i.test(fin)) { title = fin; via = x.t; break; }
    }
  }
  // Путь 2 - поиск по названию без слов версии и цвета, заголовок статьи целиком должен быть в названии
  let hits = [];
  if (!title) {
    const qs = name.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
    const s = await api({ action: 'query', list: 'search', srsearch: qs, srlimit: 5, srnamespace: 0 });
    hits = ((s && s.query && s.query.search) || []).map(h => h.title)
      .filter(t => !/^(List of|Lists of)\b/i.test(t) && !/\(disambiguation\)/i.test(t));
    const good = hits.filter(t => titleProper(t) && titleInName(t, name).ok)
      .sort((a, b) => toks(b.replace(/\(.*?\)/g, '')).length - toks(a.replace(/\(.*?\)/g, '')).length);
    if (good.length) { title = good[0]; via = 'поиск'; }
  }
  if (!title) { res.why = 'нет статьи с таким названием' + (hits[0] ? ' (первая: ' + hits[0] + ')' : ''); return; }
  res.via = via;
  const p = await api({ action: 'query', prop: 'revisions|info', rvprop: 'content|ids', rvslots: 'main', inprop: 'url', titles: title, redirects: 1 });
  const page = p && p.query && p.query.pages && p.query.pages[0];
  if (!page || page.missing || !page.revisions) { res.why = 'статья не открылась'; return; }
  const txt = page.revisions[0].slots.main.content;
  const kind = KIND(txt);
  res.article = page.title; res.url = page.fullurl; res.revid = page.revisions[0].revid; res.kind = kind;
  if (!kind) { res.status = 'none'; res.why = 'в статье нет карточки изделия'; return; }
  const ex = extract(txt, kind);
  res.dims = ex.dims; res.variant = ex.variant; res.production = ex.production; res.multi = ex.multi;
  if (!Object.keys(ex.dims).length) { res.why = ex.multi.length ? 'несколько значений: ' + ex.multi.join(', ') : 'размеров в карточке статьи нет'; return; }
  /*
   * Нужен главный размер - длина, высота или размах. Одна ширина (автобус, трамвай) или один диаметр (у ракеты
   * TOW «152 mm» - калибр, а не размер изделия) читаются как случайная цифра, а не как размер предмета.
   */
  if (!['Length', 'Height', 'Wingspan'].some(k => ex.dims[k])) { res.why = 'нет длины, высоты или размаха (' + Object.keys(ex.dims).join(', ') + ')'; return; }
  // «Specifications (estimates)», «(intended)» - оценки и планы, а не размеры изделия
  if (/estimat|intended|projected|proposed|planned|approximate/i.test(ex.variant)) { res.status = 'reject'; res.why = 'характеристики-оценка: ' + ex.variant; return; }
  // Дальше - найдено. Решаем: сразу на карточку или в ручную проверку.
  const flags = [];
  // Главный предмет стоит до «with», «carrying», «loads», «for»: «F-35 Carrying Storm Shadow», «Tripod for TOW»
  const before = name.split(/\b(with|carrying|loads|loading|for|towing|transporting|on top of)\b/i)[0];
  const viaGram = via && via !== 'поиск';
  if (viaGram ? !before.includes(via) : !titleInName(page.title, before).ok) flags.push('предмет статьи не главный в названии');
  const known = new Set([...toks(page.title), ...(viaGram ? toks(via) : [])]);
  const rest = toks(name.replace(NOISE, ' ')).filter(t => !known.has(t) && !/^(19|20)\d\d$/.test(t));
  const restStr = rest.join(' ');
  // У статьи об оружии слова «missile», «bomb», «rocket» описывают сам предмет, а не его часть
  const partRx = kind === 'weapon' ? new RegExp(PART.source.replace(/\|ammo\|ammunition\|cartridges\?\|bullets\?\|shells\?\|missiles\?\|rockets\?\|bombs\?/, ''), 'i') : PART;
  if (partRx.test(restStr) && !partRx.test(page.title)) flags.push('деталь: ' + (restStr.match(partRx) || [''])[0]);
  if (SCENE.test(restStr)) flags.push('набор/сцена: ' + (restStr.match(SCENE) || [''])[0]);
  if (page.title.trim().split(/\s+/).length === 1 && !/\d/.test(page.title)) flags.push('заголовок из одного слова');
  if (/\(/.test(page.title)) flags.push('статья о поколении/версии: ' + page.title.match(/\(([^)]*)\)/)[1]);
  /*
   * Версия. «Specifications (Boeing 737-800 with CFM56-7B26)»: главное - обозначение до «with» и запятой.
   * Совпало с названием - хорошо. В названии своё обозначение, которого в версии нет (Hawk T1 против Hawk 128,
   * SH-3H против SH-3D) - это другой самолёт, отказ. В названии версии нет вовсе (Boeing 767 Delta) - берём,
   * а на карточке пишем, чей размер: «Boeing 767 (767-300ER)».
   */
  if (ex.variant) {
    const core = ex.variant.split(/\s+with\s+|,|\s[-–]\s|\(/i)[0].trim();
    const desig = s => toks(s).filter(t => /\d/.test(t) && !/^(19|20)\d\d$/.test(t) && t !== '3d');
    const nameSet = new Set(toks(name));
    const coreToks = toks(core).filter(t => !STOP.has(t));
    // Совпало: версия названа в карточке, или характеристики - самого предмета статьи («MiG-35» в «Mikoyan MiG-35»)
    const titleSet = new Set(toks(page.title));
    const same = coreToks.length && (coreToks.every(t => nameSet.has(t)) || coreToks.every(t => titleSet.has(t)));
    if (!same) {
      // Только слова заголовка статьи: кусок «Boeing 727-200» ведёт на «Boeing 727», и его «200» - это версия
      // карточки, а не совпадение с характеристиками 727-100
      const own = desig(name).filter(t => !titleSet.has(t));
      const theirs = new Set(toks(core));
      if (own.length && !own.some(t => theirs.has(t))) { res.status = 'reject'; res.why = 'другая версия: в названии ' + own.join(' ') + ', в статье ' + core; return; }
      res.variantNote = 'версия не названа, размер версии ' + core;
    }
  }
  for (const [k, v] of Object.entries(ex.dims)) if (v.note) flags.push(k + ': пометка «' + v.note + '»');
  // Год в названии против лет выпуска
  const yr = (name.match(/\b(19[0-9]\d|20[0-4]\d)\b/) || [])[1];
  if (yr) {
    const ys = (ex.production.match(/\b(19|20)\d\d\b/g) || []).map(Number);
    const open = /present|current/i.test(ex.production);
    if (!ys.length) flags.push('год ' + yr + ', а годы выпуска в статье не указаны');
    else if (+yr < Math.min(...ys) - 1 || +yr > (open ? 9999 : Math.max(...ys) + 1)) { res.status = 'reject'; res.why = 'год ' + yr + ' вне выпуска ' + ex.production; return; }
  }
  res.status = flags.length ? 'review' : 'auto';
  res.why = flags.join('; ');
}
const queue = pool.slice(0, LIMIT);
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < queue.length) { const r = queue[next++]; await one(r).catch(e => console.log('  сбой ' + r.id + ': ' + e.message)); }
}));

// Сверка с замером студии: совпадает ли самый большой размер статьи с самым большым размером модели
if (VALIDATE) {
  const toM = s => {
    const u = (String(s).match(/\b(mm|cm|m|in|ft)\b/i) || [, 'm'])[1].toLowerCase();
    return Math.max(...(String(s).match(/\d+(?:\.\d+)?/g) || []).map(Number)) * U[u];
  };
  const byId = new Map(recs.map(r => [r.id, r]));
  for (const x of results.filter(x => x.dims && Object.keys(x.dims).length)) {
    const model = toM(byId.get(x.id).specs.dimensions);
    const wiki = Math.max(...Object.values(x.dims).map(d => d.m));
    x.model = byId.get(x.id).specs.dimensions; x.ratio = +(model / wiki).toFixed(3);
  }
}

const out = CACHE + '/candidates' + (VALIDATE ? '-validate' : '') + '.json';
fs.writeFileSync(out, JSON.stringify(results, null, 1));
const cnt = {}; for (const x of results) cnt[x.status] = (cnt[x.status] || 0) + 1;
console.log('итог: ' + JSON.stringify(cnt) + ', запросов в сеть ' + netCalls + '\n' + out);
if (VALIDATE) {
  const v = results.filter(x => x.ratio && (x.status === 'auto' || x.status === 'review'));
  const near = (x, p) => Math.abs(x.ratio - 1) <= p;
  for (const st of ['auto', 'review']) {
    const a = v.filter(x => x.status === st);
    console.log(st + ': ' + a.length + ', в пределах 10% ' + a.filter(x => near(x, 0.1)).length + ', 25% ' + a.filter(x => near(x, 0.25)).length);
  }
}
