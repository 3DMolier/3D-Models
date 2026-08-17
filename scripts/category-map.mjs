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
  // Шторы и жалюзи лежат в housewares вместе с посудой, и по продажам они
  // возглавляли «Kitchen & Tableware» - первым, что видел посетитель кухонной
  // категории, была «Stage Curtain». Это убранство комнаты, а не посуда.
  if (slug === 'kitchen-tableware' && /\b(curtain|curtains|drape|drapes|drapery|blind|blinds|valance)\b/i.test(name)) slug = 'furniture-interior';

  // TurboSquid складывает в Weaponry/armour ВСЮ защитную экипировку, включая
  // мотоциклетные, велосипедные и спортивные шлемы, каски и защиту слуха.
  // Для их каталога это последовательно, для нашей витрины - нет: посетитель
  // категории «Оружие» находил там шлем Bell и наушники 3M PELTOR.
  // Боевые и исторические доспехи остаются на месте, уезжает только гражданское.
  if (r.cat1 === 'Weaponry') {
    const military = /\b(military|combat|tactical|army|soldier|pilot|aviator|swat|riot|police|knight|viking|medieval|samurai|gladiator|roman|greek|spartan|crusader|cuirassier)\b/i.test(name);
    if (/\b(ear\s?muffs?|earmuffs?|ear\s?plugs?|earplugs?|ear\s?defender|ear\s?protection|hearing\s?protection)\b/i.test(name)) return 'clothing-accessories';
    const isHead = /\b(helmets?|headgear)\b/i.test(name);
    // Рабочая защита - не оружие и не спорт: каски строителей, сварщиков,
    // пожарных и спасателей уходят к промышленному оборудованию.
    if (!military && isHead && /\b(fire|firefighter|firefighting|welding|welder|construction|hard\s?hat|miner|mining|rescue|industrial|safety)\b/i.test(name)) return 'industrial-equipment';
    if (!military && isHead
      && /\b(motorcycle|motorbike|moped|motocross|off[\s-]?road|bicycle|bike|cycling|cycle|skate|skateboard|skateboarding|ski|snowboard|hockey|football|baseball|equestrian|jockey|racing|race|f1|formula|aerodynamic|kart|rally|snowmobile|paintball|airsoft|climbing|bmx|scooter|skydiving|parachute|sport|sports)\b/i.test(name)) return 'sports-recreation';
    if (!military && /\b(hats?|beanie|bandana|balaclava|headband)\b/i.test(name)) return 'clothing-accessories';
  }

  // Architecture/site components у TurboSquid - это всё, что раскладывают по
  // участку, вместе с уличным мусором: газеты, битое стекло, мятые стаканчики,
  // бетонный лом, стружка от токарной обработки. Беседки, фонтаны и площадки
  // тут по делу и остаются; уезжает именно мусор и лом.
  if (slug === 'architecture-landmarks' && (r.cat2 || '') === 'site components') {
    const keepsArch = /\b(tower|monument|pedestal|window|building|house|wall|bridge|statue|memorial|facade|roof)\b/i.test(name);
    if (!keepsArch) {
      if (/\b(trash\s?can|waste\s?bin|garbage\s?can|dustbin|recycle\s?bin)\b/i.test(name)) return 'containers-storage';
      if (/\b(litter|trash|garbage|waste|debris|rubble|scrap|junk|shavings)\b/i.test(name)
        || /\b(crumpled|crushed|broken)\b/i.test(name)) return 'other';
    }
  }
  return slug;
}

export function reportRow(pid) {
  return byPid.get(String(pid)) || null;
}
