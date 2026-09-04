/*
 * build-model-industries.mjs - data/model-industries.json, единый источник.
 *
 * Собирает по каждой модели упорядоченный набор наших отраслей: теги
 * TurboSquid из models_master.csv плюс отрасли, характерные для категории.
 * Правила и объяснение - в scripts/lib/industries.mjs.
 *
 * Из этого файла потом строятся ВСЕ упоминания отраслей на карточке:
 * чипы «Used In», чипы «Use Cases», абзац описания, ответ в FAQ и разметка.
 *
 * Запуск:  node scripts/build-model-industries.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { industriesOf, INDUSTRY_LABEL } from './lib/industries.mjs';
import { loadModelCategories } from './lib/taxonomy.mjs';

import { ROOT } from './lib/paths.mjs';
const OUT = path.join(ROOT, 'data', 'model-industries.json');

// ── теги из CSV ──
function parseCsvLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const lines = fs.readFileSync(path.join(ROOT, 'data', 'models_master.csv'), 'utf8').split(/\r?\n/);
const H = lines[0].split(',');
const cPid = H.indexOf('product_id'), cInd = H.indexOf('industries');
if (cPid < 0 || cInd < 0) { console.error('нет колонок product_id / industries'); process.exit(1); }
const rawOf = new Map();
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const r = parseCsvLine(lines[i]);
  rawOf.set(String(r[cPid]).trim(), (r[cInd] || '').split('|').filter(Boolean));
}
console.log('строк с тегами отраслей: ' + rawOf.size);

// ── категории ──
const modelCat = loadModelCategories();

// ── проходим каталог ──
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const out = {};
const dist = new Map();
let noRaw = 0, n = 0;
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    const id = String(c.i[j]);
    n++;
    const raw = rawOf.get(id);
    if (!raw) noRaw++;
    // Название нужно, чтобы узнать военную технику: ни категория, ни теги
    // листинга не отличают F-22 от пассажирского Airbus - оба «aircraft».
    const list = industriesOf(raw, modelCat[id] || 'other', c.n[j]);
    out[id] = list;
    for (const s of list) dist.set(s, (dist.get(s) || 0) + 1);
  }
}

fs.writeFileSync(OUT, JSON.stringify(out));
console.log('моделей: ' + n + (noRaw ? ', без тегов в CSV: ' + noRaw + ' (взяты отрасли категории)' : ''));
console.log('записан ' + OUT + '  ' + Math.round(fs.statSync(OUT).size / 1024) + ' КБ');
console.log('--- сколько моделей у каждой отрасли:');
for (const s of Object.keys(INDUSTRY_LABEL)) {
  console.log('   ' + s.padEnd(24) + String(dist.get(s) || 0).padStart(7));
}
