/*
 * collect.mjs - забрать результаты партии, проверить и сложить в written.json.
 *
 * Ждёт, пока партия досчитается (обычно минуты-часы, предел по API - сутки),
 * затем разбирает построчный JSONL, проверяет каждую карточку по ТЗ 2.1
 * (check.mjs) и делит результат на две части:
 *   tools/night-writer/written.json   - принятые, их применяет night-apply.mjs;
 *   tools/batch-writer/rejects.json   - брак с причинами, уходит в следующий прогон.
 *
 * Отказ - это нормальная часть работы, а не авария: лучше потерять карточку и
 * переписать её, чем поставить на сайт выдуманное число.
 *
 * Запуск:
 *   node tools/batch-writer/collect.mjs [--wait 3600] [--no-wait]
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkCard, crossCardRepeats } from './check.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const ROOT = path.resolve(HERE, '..', '..');
const STATE = path.join(HERE, 'state.json');
const BRIEFS = path.join(ROOT, 'tools', 'night-writer', 'brief.json');
const WRITTEN = path.join(ROOT, 'tools', 'night-writer', 'written.json');
const REJECTS = path.join(HERE, 'rejects.json');

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const WAIT_S = Number(arg('--wait')) || 7200;
const NO_WAIT = process.argv.includes('--no-wait');

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('нет переменной ANTHROPIC_API_KEY'); process.exit(1); }
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const briefs = new Map(JSON.parse(fs.readFileSync(BRIEFS, 'utf8')).map(b => [b.slug, b]));

const H = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let info, waited = 0;
for (;;) {
  const r = await fetch('https://api.anthropic.com/v1/messages/batches/' + state.id, { headers: H });
  if (!r.ok) { console.error('API: ' + r.status + ' ' + (await r.text()).slice(0, 300)); process.exit(1); }
  info = await r.json();
  const c = info.request_counts || {};
  console.log('состояние: ' + info.processing_status + ' | готово ' + (c.succeeded || 0)
    + ', в работе ' + (c.processing || 0) + ', ошибок ' + ((c.errored || 0) + (c.canceled || 0) + (c.expired || 0)));
  if (info.processing_status === 'ended') break;
  if (NO_WAIT) { console.log('партия ещё считается, выходим (--no-wait)'); process.exit(0); }
  if (waited >= WAIT_S) { console.error('ждали ' + waited + ' с, партия не закончилась'); process.exit(1); }
  await sleep(30000); waited += 30;
}

const rr = await fetch(info.results_url, { headers: H });
if (!rr.ok) { console.error('результаты недоступны: ' + rr.status); process.exit(1); }
const body = await rr.text();

let ok = [], bad = [], broken = 0, inTok = 0, outTok = 0;
for (const line of body.split('\n')) {
  if (!line.trim()) continue;
  let row; try { row = JSON.parse(line); } catch { broken++; continue; }
  const slug = state.map[row.custom_id];
  if (!slug) { broken++; continue; }
  if (row.result?.type !== 'succeeded') {
    bad.push({ slug, why: ['запрос не удался: ' + (row.result?.type || 'нет результата')] });
    continue;
  }
  const u = row.result.message?.usage || {};
  inTok += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  outTok += u.output_tokens || 0;
  let txt = (row.result.message.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  txt = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let card; try { card = JSON.parse(txt); } catch { bad.push({ slug, why: ['ответ не разобран как JSON'] }); continue; }
  card.slug = slug;
  const brief = briefs.get(slug);
  if (!brief) { bad.push({ slug, why: ['справки нет, проверить нечем'] }); continue; }
  const why = checkCard(card, brief);
  if (why.length) bad.push({ slug, why, card }); else ok.push(card);
}

// повторы между карточками партии
const kill = crossCardRepeats(ok);
if (kill.size) {
  const keep = [];
  for (const c of ok) {
    if (kill.has(c.slug)) bad.push({ slug: c.slug, why: ['повтор пятисловного оборота: ' + kill.get(c.slug).join(' | ')], card: c });
    else keep.push(c);
  }
  ok = keep;
}

fs.writeFileSync(WRITTEN, JSON.stringify(ok, null, 2) + '\n');
fs.writeFileSync(REJECTS, JSON.stringify(bad, null, 1) + '\n');

const price = { 'claude-sonnet-5-5': [1, 5], 'claude-haiku-4-5-20251001': [0.5, 2.5], 'claude-opus-5-5': [2, 10] }[state.model] || [1, 5];
const cost = (inTok / 1e6) * price[0] + (outTok / 1e6) * price[1];
console.log('');
console.log('принято:   ' + ok.length);
console.log('отклонено: ' + bad.length + (broken ? ', строк не разобрано: ' + broken : ''));
console.log('токенов: вход ' + inTok.toLocaleString('ru-RU') + ', выход ' + outTok.toLocaleString('ru-RU'));
console.log('стоимость партии: $' + cost.toFixed(2) + ' (' + (cost / Math.max(1, ok.length)).toFixed(4) + ' за принятую карточку)');
const top = new Map();
for (const b of bad) for (const w of b.why) { const k = w.replace(/[:(].*$/, '').trim(); top.set(k, (top.get(k) || 0) + 1); }
if (top.size) {
  console.log('почему отклоняли:');
  for (const [k, v] of [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  ' + v + ' x ' + k);
}
console.log('');
console.log('дальше: node scripts/night-apply.mjs --dry, затем без --dry');
