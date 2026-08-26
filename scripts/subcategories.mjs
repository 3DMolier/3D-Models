/*
 * subcategories.mjs - список подкатегорий и правила отбора моделей.
 *
 * Почему список рукописный. Частотный анализ названий даёт слова, а не темы:
 * в «Vehicles» самые частые слова - truck, rigged, electric, interior. Из них
 * «rigged» и «interior» это свойство модели, а не вид товара, и страница
 * «Interior 3D Models» внутри «Vehicles» была бы мусором. Поэтому список
 * собран руками по результатам анализа, а не автоматически.
 *
 * terms - слова, по которым модель попадает в подкатегорию. Совпадение только
 * по целому слову: «bus» не должен ловить «business», «jet» - «jetty».
 * not - слова, которые отменяют попадание.
 * min - ниже этого числа страницу не делаем: тонкая страница вредит.
 */

export const MIN_MODELS = 30;

export const SUBCATS = {
  aircraft: [
    { slug: 'helicopters', title: 'Helicopter', terms: ['helicopter', 'helicopters', 'chopper'] },
    { slug: 'fighter-jets', title: 'Fighter Jet', terms: ['fighter', 'interceptor'], not: ['fire fighter', 'firefighter'] },
    { slug: 'airliners', title: 'Airliner', terms: ['airliner', 'boeing', 'airbus', 'airlines'] },
    { slug: 'drones', title: 'Drone & UAV', terms: ['drone', 'drones', 'uav', 'quadcopter'] },
  ],
  vehicles: [
    { slug: 'trucks', title: 'Truck', terms: ['truck', 'trucks', 'lorry'] },
    { slug: 'trailers', title: 'Trailer', terms: ['trailer', 'trailers'] },
    { slug: 'suvs', title: 'SUV', terms: ['suv', 'suvs', 'crossover'] },
    { slug: 'buses', title: 'Bus', terms: ['bus', 'buses', 'coach'] },
    { slug: 'motorcycles', title: 'Motorcycle', terms: ['motorcycle', 'motorbike', 'scooter', 'moped'] },
  ],
  'medical-3d-models': [
    { slug: 'human-anatomy', title: 'Human Anatomy', terms: ['anatomy', 'anatomical'] },
    { slug: 'skeleton-bones', title: 'Skeleton & Bone', terms: ['skeleton', 'skull', 'bone', 'bones', 'vertebra', 'femur'] },
    { slug: 'dental', title: 'Dental', terms: ['dental', 'tooth', 'teeth', 'dentist'] },
    { slug: 'medical-equipment', title: 'Medical Equipment', terms: ['equipment', 'monitor', 'ventilator', 'defibrillator', 'stretcher', 'wheelchair', 'syringe', 'scanner'] },
  ],
  'animals-creatures': [
    { slug: 'dogs', title: 'Dog', terms: ['dog', 'dogs', 'puppy', 'terrier', 'retriever', 'bulldog'] },
    { slug: 'fish-marine', title: 'Fish & Marine Animal', terms: ['fish', 'shark', 'whale', 'dolphin', 'octopus', 'crab'] },
    { slug: 'birds', title: 'Bird', terms: ['bird', 'birds', 'eagle', 'owl', 'parrot', 'pigeon', 'duck', 'chicken'] },
    { slug: 'insects', title: 'Insect', terms: ['insect', 'butterfly', 'beetle', 'spider', 'bee', 'ant', 'dragonfly'] },
  ],
  'electronics-gadgets': [
    { slug: 'smartphones', title: 'Smartphone', terms: ['iphone', 'smartphone', 'galaxy', 'pixel'], not: [] },
    { slug: 'cameras', title: 'Camera', terms: ['camera', 'cameras', 'camcorder', 'lens'] },
    { slug: 'laptops-computers', title: 'Laptop & Computer', terms: ['laptop', 'macbook', 'notebook', 'computer', 'imac', 'desktop'] },
    { slug: 'headphones-audio', title: 'Headphones & Audio', terms: ['headphones', 'headphone', 'earbuds', 'airpods', 'speaker', 'soundbar'] },
  ],
  weapons: [
    { slug: 'rifles', title: 'Rifle', terms: ['rifle', 'rifles', 'carbine', 'ak-47', 'ak47', 'm4', 'sniper'] },
    { slug: 'pistols', title: 'Pistol', terms: ['pistol', 'revolver', 'handgun', 'glock'] },
    { slug: 'missiles-rockets', title: 'Missile & Rocket', terms: ['missile', 'missiles', 'rocket', 'warhead', 'torpedo'] },
    { slug: 'knives-swords', title: 'Knife & Sword', terms: ['knife', 'knives', 'sword', 'swords', 'dagger', 'machete', 'axe'] },
  ],
  'furniture-interior': [
    { slug: 'chairs', title: 'Chair', terms: ['chair', 'chairs', 'armchair', 'stool'] },
    { slug: 'tables', title: 'Table', terms: ['table', 'tables', 'desk'] },
    { slug: 'sofas', title: 'Sofa', terms: ['sofa', 'sofas', 'couch', 'settee'] },
    { slug: 'beds', title: 'Bed', terms: ['bed', 'beds', 'mattress', 'bunk'] },
    { slug: 'cabinets-storage', title: 'Cabinet & Shelving', terms: ['cabinet', 'wardrobe', 'shelf', 'shelving', 'dresser', 'bookcase'] },
  ],
  'nature-plants': [
    { slug: 'trees', title: 'Tree', terms: ['tree', 'trees', 'oak', 'pine', 'maple', 'birch', 'palm'] },
    { slug: 'flowers', title: 'Flower', terms: ['flower', 'flowers', 'rose', 'orchid', 'tulip', 'lily'] },
    { slug: 'rocks-terrain', title: 'Rock & Terrain', terms: ['rock', 'rocks', 'stone', 'boulder', 'cliff', 'terrain'] },
  ],
  'industrial-equipment': [
    { slug: 'cranes', title: 'Crane', terms: ['crane', 'cranes', 'hoist'] },
    { slug: 'tractors-agriculture', title: 'Tractor & Agriculture', terms: ['tractor', 'harvester', 'combine', 'plough', 'plow'] },
    { slug: 'robots-automation', title: 'Industrial Robot', terms: ['robot', 'robotic', 'manipulator', 'automation'] },
    { slug: 'forklifts-loaders', title: 'Forklift & Loader', terms: ['forklift', 'loader', 'excavator', 'bulldozer', 'backhoe'] },
  ],
  ships: [
    { slug: 'boats-yachts', title: 'Boat & Yacht', terms: ['boat', 'boats', 'yacht', 'dinghy', 'catamaran'] },
    { slug: 'submarines', title: 'Submarine', terms: ['submarine', 'submarines', 'sub'] },
    { slug: 'naval-ships', title: 'Naval Ship', terms: ['destroyer', 'frigate', 'carrier', 'cruiser', 'corvette', 'uss', 'battleship'] },
  ],
  lighting: [
    { slug: 'lamps', title: 'Lamp', terms: ['lamp', 'lamps', 'chandelier', 'sconce'] },
    { slug: 'bulbs', title: 'Light Bulb', terms: ['bulb', 'bulbs', 'led'] },
    { slug: 'lanterns-outdoor', title: 'Lantern & Outdoor Light', terms: ['lantern', 'streetlight', 'floodlight', 'spotlight'] },
  ],
  'sports-recreation': [
    { slug: 'balls', title: 'Ball', terms: ['ball', 'balls'] },
    { slug: 'hockey', title: 'Hockey', terms: ['hockey', 'puck'] },
    { slug: 'fitness-gym', title: 'Fitness & Gym', terms: ['dumbbell', 'barbell', 'treadmill', 'gym', 'fitness', 'kettlebell'] },
    { slug: 'camping-outdoor', title: 'Camping & Outdoor', terms: ['tent', 'camping', 'backpack', 'sleeping bag', 'campfire'] },
  ],
  'food-beverages': [
    { slug: 'fruit-vegetables', title: 'Fruit & Vegetable', terms: ['fruit', 'apple', 'banana', 'orange', 'tomato', 'vegetable', 'lemon', 'grape'] },
    { slug: 'desserts-sweets', title: 'Dessert & Sweets', terms: ['chocolate', 'candy', 'cake', 'cookie', 'donut', 'dessert', 'ice cream'] },
    // Кофейное зерно и кофемолка - не напиток.
    { slug: 'drinks', title: 'Drink', terms: ['drink', 'juice', 'soda', 'beer', 'wine', 'coffee', 'cocktail'], not: ['bean', 'beans', 'grinder', 'machine', 'maker', 'mill'] },
  ],
  'containers-storage': [
    { slug: 'shipping-containers', title: 'Shipping Container', terms: ['shipping container', 'iso container', 'freight'] },
    { slug: 'boxes-crates', title: 'Box & Crate', terms: ['box', 'boxes', 'crate', 'carton'] },
    { slug: 'barrels-drums', title: 'Barrel & Drum', terms: ['barrel', 'barrels', 'drum', 'keg', 'canister'] },
  ],
  // «Other» - это не тема, а корзина для того, что не разложили. Внутри неё
  // сидят три настоящие товарные группы; вытащить их важнее всего: страница
  // «Other 3D Models» ничего не говорит ни человеку, ни поиску.
  other: [
    { slug: 'emoji', title: 'Emoji', terms: ['emoji', 'emojis', 'emoticon'] },
    // «Money Face Emoji» это эмодзи, а не деньги - у него своя подкатегория.
    { slug: 'coins-currency', title: 'Coin & Currency', terms: ['coin', 'coins', 'banknote', 'euro', 'dollar', 'currency', 'money'], not: ['emoji', 'emoticon'] },
    { slug: 'stationery-office', title: 'Stationery & Office', terms: ['pen', 'pencil', 'envelope', 'notebook', 'binder', 'stapler', 'clipboard', 'eraser', 'marker'] },
  ],
};
