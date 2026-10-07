/*
 * submit.mjs - отправка партии карточек в Message Batches API.
 *
 * Зачем пакетно. Ночной прогон должен давать 1 000-5 000 карточек. Обычными
 * запросами это упирается в лимиты и занимает часы; Batches API принимает до
 * 100 000 запросов одной посылкой, считает их асинхронно и стоит ВДВОЕ дешевле
 * (скидка 50% на вход и выход).
 *
 * Зависимостей не ставим: HTTP делает встроенный fetch. SDK здесь не нужен -
 * три вызова REST, зато ни одного нового пакета в проекте (правило репо: не
 * ставить зависимости без аудита).
 *
 * Ключ берётся из переменной окружения ANTHROPIC_API_KEY и никуда, кроме
 * api.anthropic.com, не уходит. В логи ключ не печатается.
 *
 * Запуск:
 *   node tools/batch-writer/submit.mjs --count 1000 [--model sonnet|haiku|opus] [--dry]
 *
 * Перед запуском нужна справка: scripts/night-brief.mjs собирает brief.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SYSTEM, userMessage } from './prompt.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const ROOT = path.resolve(HERE, '..', '..');
const BRIEFS = path.join(ROOT, 'tools', 'night-writer', 'brief.json');
const STATE = path.join(HERE, 'state.json');

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry');
const COUNT = Number(arg('--count')) || 1000;

const MODELS = {
  sonnet: { id: 'claude-sonnet-5-5', inB: 1.00, outB: 5.00 },     // $/млн, уже со скидкой пакета
  haiku: { id: 'claude-haiku-4-5-20251001', inB: 0.50, outB: 2.50 },
  opus: { id: 'claude-opus-5-5', inB: 2.00, outB: 10.00 },
};
const MK = MODELS[arg('--model') || 'sonnet'];
if (!MK) { console.error('модель: sonnet, haiku или opus'); process.exit(1); }

/*
 * ПРЕДОХРАНИТЕЛЬ ОТ СЛУЧАЙНОЙ ТРАТЫ. Решение основателя 07.10.2026: платить за
 * API сверх подписки он не будет, описания пишутся ночными сменами. Эта линия
 * остаётся готовой, но спящей, и включается только двумя сознательными
 * действиями: ключ в окружении И флаг --confirm-cost в команде. Без флага скрипт
 * печатает оценку и выходит, даже если ключ есть.
 *
 * Так сделано потому, что любой автоматический прогон (ночная задача, чужой
 * скрипт, повтор команды из истории) не может потратить деньги молча.
 */
const CONFIRMED = process.argv.includes('--confirm-cost');
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY && !DRY) {
  console.error('нет переменной ANTHROPIC_API_KEY - без неё партию не отправить');
  process.exit(1);
}

const briefs = JSON.parse(fs.readFileSync(BRIEFS, 'utf8')).slice(0, COUNT);
if (!briefs.length) { console.error('справок нет: сначала scripts/night-brief.mjs'); process.exit(1); }

/*
 * custom_id в API ограничен 64 символами, а слаг бывает длиннее
 * («skateboarding-shoe-nike-sb-dunk-high-pro-blue-1381752» и хуже). Поэтому
 * идентификатором идёт номер, а соответствие номер->слаг лежит в state.json.
 */
const requests = briefs.map((b, i) => ({
  custom_id: 'c' + i,
  params: {
    model: MK.id,
    max_tokens: 1200,
    system: [{
      type: 'text', text: SYSTEM,
      // Общая часть промпта одна для всей партии: кэш срезает её стоимость
      // там, где запросы считаются подряд.
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMessage(b) }],
  },
}));

// грубая оценка стоимости: 4 символа на токен
const chars = requests.reduce((s, r) => s + SYSTEM.length + r.params.messages[0].content.length, 0);
const inTok = Math.round(chars / 4), outTok = requests.length * 480;
const cost = (inTok / 1e6) * MK.inB + (outTok / 1e6) * MK.outB;
console.log('карточек в партии: ' + requests.length + ', модель: ' + MK.id);
console.log('вход ~' + inTok.toLocaleString('ru-RU') + ' токенов, выход ~' + outTok.toLocaleString('ru-RU'));
console.log('оценка стоимости партии: $' + cost.toFixed(2) + ' (цены пакетного режима, скидка 50% уже учтена)');

if (DRY) {
  fs.writeFileSync(path.join(HERE, 'sample-request.json'), JSON.stringify(requests[0], null, 1));
  console.log('(--dry) партия не отправлена; пример запроса: tools/batch-writer/sample-request.json');
  process.exit(0);
}
if (!CONFIRMED) {
  console.log('');
  console.log('ПАРТИЯ НЕ ОТПРАВЛЕНА: нет флага --confirm-cost.');
  console.log('Это платный путь. Основатель решил 07.10.2026 не платить за API сверх подписки,');
  console.log('описания пишутся ночными сменами. Если решение изменится - добавить --confirm-cost.');
  process.exit(0);
}

const res = await fetch('https://api.anthropic.com/v1/messages/batches', {
  method: 'POST',
  headers: {
    'x-api-key': KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ requests }),
});
if (!res.ok) {
  console.error('API отказал: ' + res.status + ' ' + (await res.text()).slice(0, 400));
  process.exit(1);
}
const batch = await res.json();
const state = {
  id: batch.id, model: MK.id, created: new Date().toISOString(),
  count: requests.length, estimate: Number(cost.toFixed(2)),
  map: Object.fromEntries(briefs.map((b, i) => ['c' + i, b.slug])),
};
fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
console.log('партия отправлена: ' + batch.id);
console.log('состояние: tools/batch-writer/state.json');
console.log('дальше: node tools/batch-writer/collect.mjs');
