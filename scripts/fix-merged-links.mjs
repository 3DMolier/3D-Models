// fix-merged-links.mjs — перенаправление ссылок на свёрнутые карточки.
//
// После merge-variants.mjs 18 578 страниц перестают существовать, но ссылки на них
// остаются: в блоках «похожие» на каждой карточке (по 6 штук), в хабах категорий
// (по 100) и в точках входа (по 500).
//
// Ссылки не удаляем, а ПЕРЕВОДИМ на главную карточку группы: содержимое свёрнутой
// теперь живёт именно там, так что ссылка остаётся осмысленной, а блок не редеет.
//
// Карту берём из data/merged-variants.json, её пишет merge-variants.mjs.
//
// Запуск:  node scripts/fix-merged-links.mjs --dry
//          node scripts/fix-merged-links.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');

const mapFile = path.join(ROOT, 'data', 'merged-variants.json');
if (!fs.existsSync(mapFile)) {
  console.error('Нет data/merged-variants.json — сперва запусти merge-variants.mjs');
  process.exit(1);
}
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const dead = Object.keys(map);
console.log('свёрнутых слагов: ' + dead.length);

// Карта бывает цепочкой и даже кольцом: правила менялись между прогонами, и одна
// и та же карточка успевала побыть и главной, и вариантом (A -> B, B -> A, обе
// удалены). Разворачиваем цепочку до ЖИВОЙ страницы, с защитой от зацикливания;
// если по пути живой нет — берём живую из того же кольца.
const alive = new Set(fs.readdirSync(path.join(ROOT, 'models')));
const resolved = new Map();
function resolve(slug) {
  if (resolved.has(slug)) return resolved.get(slug);
  const seen = [];
  let cur = slug;
  while (cur && !alive.has(cur) && !seen.includes(cur)) { seen.push(cur); cur = map[cur]; }
  const dest = (cur && alive.has(cur)) ? cur : (seen.find(x => alive.has(x)) || null);
  for (const s of seen) resolved.set(s, dest);
  resolved.set(slug, dest);
  return dest;
}
let cyclic = 0;
for (const s of dead) if (!resolve(s)) cyclic++;
if (cyclic) console.log('  без живой цели: ' + cyclic);

// Обходить 68 тысяч страниц регуляркой по каждому из 18 тысяч слагов нельзя —
// это часы. Вместо этого вытаскиваем ссылки со страницы и сверяем по карте.
const LINK = /href="\/models\/([^"\/]+)\//g;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const targets = [];
for (const d of ['models', 'categories', 'browse', 'industries', 'collections']) {
  const dir = path.join(ROOT, d);
  if (fs.existsSync(dir)) walk(dir, targets);
}
for (const f of ['index.html', 'catalog/index.html', 'full-catalog/index.html', 'search/index.html']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) targets.push(p);
}
console.log('страниц к проверке: ' + targets.length);

let touched = 0, links = 0, checked = 0, broken = 0;
for (const f of targets) {
  let html;
  try { html = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (++checked % 20000 === 0) console.log('  ' + checked + '/' + targets.length + '  исправлено страниц ' + touched);

  let changed = 0;
  const out = html.replace(LINK, (m, slug) => {
    if (alive.has(slug)) return m;              // страница на месте, трогать нечего
    const to = resolve(slug);
    if (!to || to === slug) return m;
    changed++;
    return 'href="/models/' + to + '/';
  });
  if (!changed) continue;

  // ссылка могла вести на страницу, которой и так нет — считаем отдельно
  if (!out.includes('<a href="/categories/other/" role="menuitem"')) {
    console.log('  ОСТАНОВКА: пострадало меню на ' + path.relative(ROOT, f));
    process.exit(1);
  }
  if (!DRY) fs.writeFileSync(f, out);
  touched++; links += changed;
}

console.log('\nстраниц исправлено: ' + touched);
console.log('ссылок переведено:  ' + links + (DRY ? '  (--dry)' : ''));

// после перевода ссылок проверяем, не осталось ли указателей в никуда
if (!DRY) {
  const alive = new Set();
  for (const d of fs.readdirSync(path.join(ROOT, 'models'), { withFileTypes: true })) if (d.isDirectory()) alive.add(d.name);
  let dangling = 0; const examples = [];
  for (const f of targets.slice(0, 5000)) {
    let html; try { html = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const m of html.matchAll(LINK)) {
      if (!alive.has(m[1])) { dangling++; if (examples.length < 5) examples.push(m[1]); }
    }
  }
  console.log('\nпроверка 5000 страниц: ссылок в никуда ' + dangling);
  if (dangling) console.log('  примеры: ' + examples.join(', '));
}
