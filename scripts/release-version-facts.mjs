#!/usr/bin/env node
/*
 * release-version-facts.mjs - выпуск подписей версий частями (фаза 5 плана 2026-11-09-card-value-after-quality-drop).
 *
 * Решение основателя 10.11.2026: «выпускай по 2000 в день». Подписи меняют ~17 тыс. карточек с версиями, а потолок
 * ежедневной публикации 5 000 - поэтому daily-site-update.mjs зовёт этот шаг ПОСЛЕ первой сборки страниц и даёт
 * --limit = min(2000, свободный остаток до потолка). Так подписи никогда не останавливают публикацию характеристик,
 * галерей и ночных текстов.
 *
 * Порядок: сначала карточки из карт сайта, внутри - где больше версий с данными. Карточки, у которых подписей не
 * будет вовсе (данных нет ни у одной версии), не выпускаются - они ничего не меняют. Когда выпускать больше нечего,
 * ставится all: true: новые карточки получают подписи сразу.
 *
 *   node scripts/release-version-facts.mjs --limit 2000 [--dry]
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './lib/paths.mjs';
import { versionFacts } from './lib/version-facts.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT = Math.max(0, Number(arg('--limit', 2000)) || 0);
const DRY = process.argv.includes('--dry');
const FILE = path.join(ROOT, 'data', 'version-facts-released.json');
const state = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { all: false, ids: {} };
if (state.all) { console.log('подписи версий: выпущены все'); process.exit(0); }

const recs = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'records'))) if (/^records-\d+\.json$/.test(f))
  recs.push(...JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'records', f), 'utf8')));
const sm = new Set();
for (const d of [ROOT, path.join(ROOT, 'sitemaps')]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/sitemap.*\.xml$/.test(f))
  for (const m of fs.readFileSync(path.join(d, f), 'utf8').matchAll(/\/models\/([^/<]+)\/</g)) sm.add(m[1]);

const live = r => r.slug && fs.existsSync(path.join(ROOT, 'models', r.slug, 'index.html'));
const withFacts = r => (r.family || []).filter(v => versionFacts(v.spec, r.self_spec)).length;
const todo = recs.filter(r => !state.ids[String(r.id)] && (r.family || []).length && withFacts(r) && live(r))
  .map(r => ({ id: String(r.id), sm: sm.has(r.slug) ? 1 : 0, n: withFacts(r) }))
  .sort((a, b) => b.sm - a.sm || b.n - a.n || a.id.localeCompare(b.id));
const take = todo.slice(0, LIMIT);
const day = new Date().toISOString().slice(0, 10);
for (const x of take) state.ids[x.id] = day;
const left = todo.length - take.length;
if (!left) state.all = true;
if (!DRY) fs.writeFileSync(FILE, JSON.stringify(state, null, 0));
console.log(`подписи версий: выпущено сегодня ${take.length}, всего ${Object.keys(state.ids).length}, осталось ${left}`
  + (state.all ? ' - выпущены все' : '') + (DRY ? ' (--dry, не записано)' : ''));
