// category-map.mjs — категория модели по РЕАЛЬНЫМ данным TurboSquid (data/product-report.json),
// а не по угадыванию слов в названии.
//
// В product-report.json у каждой модели уже есть cat1/cat2 — категория, которую
// на TurboSquid проставил сам автор при публикации. Это ровно те графы из
// Excel-отчёта, о которых говорил основатель. До этого сайт классифицировал
// модели по ключевым словам в названии (classify15.mjs), и слово могло случайно
// совпасть не с той категорией — отсюда авианосец в «Characters & People»,
// промышленная техника в «Furniture & Interior» и т.д.
//
// Правило: если модель есть в отчёте — категория берётся из cat1+cat2 (таблица
// ниже). Если модели в отчёте нет (0.1% случаев, обычно новые карточки) —
// вызывающий код сам делает fallback на классификатор по словам.
//
// Экспорт: classifyByReport(pid) -> slug | null

import fs from 'node:fs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';

const REPORT = JSON.parse(fs.readFileSync(ROOT + '/data/product-report.json', 'utf8'));
const byPid = new Map();
for (const r of REPORT) byPid.set(String(r.pid), r);

// cat1 -> slug по умолчанию (используется, если cat2 не даёт более точного правила)
const CAT1_DEFAULT = {
  'Vehicles': 'vehicles',
  'Nature': 'nature-plants',
  'Industrial': 'industrial-equipment',
  'Characters': 'characters-people',
  'Interior Design': 'furniture-interior',
  'Architecture': 'architecture-landmarks',
  'Fashion and Beauty': 'clothing-accessories',
  'Technology': 'electronics-gadgets',
  'Science': 'medical-3d-models',
  'Food and Drink': 'food-beverages',
  'Weaponry': 'weapons',
  'Sports': 'sports-recreation',
  'Furnishings': 'furniture-interior',
  'Toys and Games': 'toys-games',
  'art': 'signage-decor',
  'Office': 'other',
  'Music': 'musical-instruments',
  'Symbols': 'other',
  'Currency': 'other',
  'Holidays': 'signage-decor',
};

// (cat1, cat2) -> slug — переопределяет CAT1_DEFAULT там, где cat2 указывает
// на другую, более узкую категорию сайта.
const CAT2_OVERRIDE = {
  'Vehicles|aircraft': 'aircraft',
  'Vehicles|vessel': 'ships',
  'Vehicles|spacecraft': 'space-scifi',
  'Vehicles|tank': 'military-vehicles',
  'Vehicles|armored car': 'military-vehicles',
  'Nature|Animal': 'animals-creatures',
  'Industrial|industrial container': 'containers-storage',
  'Industrial|tools': 'tools',
  'Characters|mythological creatures': 'animals-creatures',
  'Interior Design|housewares': 'kitchen-tableware',
  'Science|astronomy': 'space-scifi',
  'Science|weather instruments': 'nature-plants',
  'Science|smoking': 'other',
  'Food and Drink|food container': 'containers-storage',
};

// «Collection/Pack/Bundle/Kit» - это форма поставки (несколько предметов в
// одном лоте), а не предмет сам по себе. TurboSquid не тегирует это отдельной
// категорией, поэтому определяем по названию раньше отчётной категории.
const COLLECTION_WORD = /\b(collection|collections|pack|bundle|kit|kits)\b/i;

export function classifyByReport(pid, name = '') {
  if (COLLECTION_WORD.test(name)) return 'collections-sets';
  const r = byPid.get(String(pid));
  if (!r || !r.cat1) return null;
  const key = r.cat1 + '|' + (r.cat2 || '');
  let slug = CAT2_OVERRIDE[key] || CAT1_DEFAULT[r.cat1] || null;
  // TurboSquid тегирует «HMS Queen Elizabeth with F35 Planes» как cat2=aircraft
  // (по самолётам на борту), хотя сам предмет - авианосец. Тот же авианосец без
  // самолётов помечен normально (vessel). Ловим по слову "carrier" в названии.
  if (slug === 'aircraft' && /\bcarrier\b/i.test(name)) slug = 'military-vehicles';
  // TurboSquid держит светильники внутри Interior Design/fixtures вместе с
  // сантехникой - на сайте под них есть отдельная категория Lighting.
  if (slug === 'furniture-interior' && /\b(lamp|lamps|light|lights|bulb|bulbs|lantern|chandelier|sconce|luminaire)\b/i.test(name)) slug = 'lighting';
  return slug;
}

export function reportRow(pid) {
  return byPid.get(String(pid)) || null;
}
