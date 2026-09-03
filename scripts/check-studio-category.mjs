/*
 * check-studio-category.mjs - можно ли верить категории из выгрузки студии.
 *
 * ЗАЧЕМ. У 90 новых моделей категория вышла «Other»: в отчёте TurboSquid графы
 * cat1/cat2/cat3 стоят как «#Н/Д» - несчитанная формула, та же беда, что была с
 * сертификацией. В выгрузке студии у тех же моделей категория есть строкой
 * вида «vehicles, vehicle parts, wheel, truck wheel».
 *
 * Прежде чем брать её, надо проверить, а не поверить. Сверяем ТАМ, ГДЕ ОБЕ
 * ИЗВЕСТНЫ: если студийная строка совпадает с нашей категорией у моделей, где
 * отчёт не молчит, - источнику можно верить и там, где он единственный.
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-studio-category.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DL = 'C:/Users/MSI-PC/Downloads/';
const RECS = path.join(ROOT, 'data', 'records');

// Наши категории и слова, по которым их узнают в студийной строке.
const tax = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'taxonomy.json'), 'utf8')).categories;
const slugOf = new Map();
for (const c of tax) {
  slugOf.set(c.slug, c.slug);
  for (const w of String(c.name).toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 3) {
    if (!slugOf.has(w)) slugOf.set(w, c.slug);
  }
}

const studio = new Map();
for (const f of fs.readdirSync(DL)) {
  if (!/^studio-inventory-part-\d+\.json$/.test(f)) continue;
  const j = JSON.parse(fs.readFileSync(DL + f, 'utf8'));
  for (const [id, s] of Object.entries(j.result || {})) {
    const raw = typeof s.categories === 'string' ? s.categories
      : (Array.isArray(s.categories) ? s.categories.join(', ') : '');
    if (raw) studio.set(String(id), raw.toLowerCase());
  }
}
console.log('моделей с категорией в выгрузке студии: ' + studio.size.toLocaleString('ru-RU'));

/*
 * Строка студии иерархическая, от общего к частному:
 *   «vehicles, vehicle parts, wheel, truck wheel»
 * Брать первое совпадение - значит всегда останавливаться на самом общем
 * уровне, и тогда самолёт становится «vehicles», а кит - «nature». Поэтому
 * идём до конца и берём ПОСЛЕДНЕЕ узнанное слово: оно самое частное.
 */
const guess = raw => {
  let best = null;
  for (const part of raw.split(/[,;/]/)) {
    const t = part.trim().replace(/\s+/g, '-');
    if (slugOf.has(t)) best = slugOf.get(t);
    for (const w of part.trim().split(/\s+/)) if (slugOf.has(w)) best = slugOf.get(w);
  }
  return best;
};

const idx = JSON.parse(fs.readFileSync(path.join(RECS, 'index.json'), 'utf8'));
let checked = 0, hit = 0, miss = 0, noGuess = 0;
const wrong = new Map();
for (let k = 0; k < idx.chunks; k++) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECS, 'records-' + k + '.json'), 'utf8'))) {
    // Сверяем на ЖИВЫХ карточках: у них категория уже выверена и хабами, и людьми.
    if (r.status === 'new' || !r.category || r.category === 'other') continue;
    const raw = studio.get(String(r.id));
    if (!raw) continue;
    checked++;
    const g = guess(raw);
    if (!g) { noGuess++; continue; }
    if (g === r.category) hit++;
    else {
      miss++;
      const key = r.category + ' <- студия говорит ' + g;
      wrong.set(key, (wrong.get(key) || 0) + 1);
    }
  }
}

console.log('\nсверено живых карточек: ' + checked.toLocaleString('ru-RU'));
console.log('  совпало: ' + hit.toLocaleString('ru-RU')
  + ' (' + (checked ? Math.round(hit / checked * 100) : 0) + '%)');
console.log('  разошлось: ' + miss.toLocaleString('ru-RU'));
console.log('  студийная строка ничего нам не говорит: ' + noGuess.toLocaleString('ru-RU'));
console.log('\nчастые расхождения:');
[...wrong].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([k, v]) => console.log('   ' + String(v).padStart(5) + '  ' + k));
