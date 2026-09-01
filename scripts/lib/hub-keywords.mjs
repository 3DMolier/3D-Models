/*
 * hub-keywords.mjs - слова, по которым обложка узнаётся как «про эту тему».
 *
 * ЗАЧЕМ. Выбирать обложку по одним продажам оказалось мало: у темы «Aircraft»
 * лидером продаж была коллекция воздушных шаров, у «Nature» - коллекция
 * бриллиантов, у «Industrial» - набор досок. Формально это самые продаваемые
 * товары раздела, а на обложке они выглядят ошибкой.
 *
 * Списки рукописные - как и подкатегории. Автоматически такие вещи не выводятся:
 * «планка» относится к промоборудованию, а «бриллиант» к природе только по
 * происхождению. Совпадение считаем по ЦЕЛЫМ словам названия.
 */

export const COLLECTION_WORDS = {
  'vehicles': ['car', 'cars', 'truck', 'trucks', 'suv', 'sedan', 'van', 'bus', 'vehicle', 'vehicles', 'motorcycle', 'trailer', 'pickup'],
  'aircraft': ['aircraft', 'airplane', 'airplanes', 'plane', 'planes', 'jet', 'jets', 'airliner', 'helicopter', 'helicopters', 'drone', 'drones'],
  'ships': ['ship', 'ships', 'boat', 'boats', 'yacht', 'vessel', 'warship', 'warships', 'submarine', 'ferry', 'tugboat'],
  'military': ['tank', 'tanks', 'military', 'armored', 'armoured', 'apc', 'artillery', 'soldier', 'soldiers', 'howitzer', 'infantry'],
  'space-scifi': ['space', 'planet', 'planets', 'satellite', 'satellites', 'rocket', 'rockets', 'spaceship', 'spacecraft', 'astronaut'],
  'home-interior': ['furniture', 'chair', 'chairs', 'table', 'tables', 'sofa', 'lamp', 'lamps', 'interior', 'bed', 'shelf', 'cabinet'],
  'nature': ['tree', 'trees', 'plant', 'plants', 'flower', 'flowers', 'rock', 'rocks', 'grass', 'forest', 'leaf', 'bush'],
  'industrial': ['machine', 'machines', 'industrial', 'factory', 'equipment', 'pump', 'valve', 'conveyor', 'crane', 'generator', 'compressor'],
  'food-drink': ['food', 'fruit', 'vegetable', 'vegetables', 'bread', 'cake', 'drink', 'drinks', 'bottle', 'bottles', 'coffee', 'wine', 'beer'],
  'science-medical': ['anatomy', 'medical', 'organ', 'organs', 'skeleton', 'bone', 'bones', 'microscope', 'laboratory', 'surgical', 'dental'],
  'technology': ['phone', 'laptop', 'computer', 'camera', 'monitor', 'server', 'electronics', 'gadget', 'headphones', 'console', 'tablet'],
  'fashion': ['clothing', 'shirt', 'dress', 'shoe', 'shoes', 'jacket', 'bag', 'hat', 'sneakers', 'apparel', 'jeans'],
  'architecture': ['building', 'buildings', 'house', 'houses', 'tower', 'bridge', 'facade', 'skyscraper', 'church', 'stadium'],
  'characters': ['character', 'characters', 'man', 'woman', 'people', 'crowd', 'worker', 'workers', 'rigged', 'human'],
  'sports': ['sport', 'sports', 'ball', 'gym', 'fitness', 'bicycle', 'bike', 'skateboard', 'tennis', 'football', 'golf'],
  'weapons': ['weapon', 'weapons', 'gun', 'guns', 'rifle', 'pistol', 'knife', 'sword', 'ammo', 'ammunition', 'grenade'],
  'toys-games': ['toy', 'toys', 'game', 'games', 'puzzle', 'doll', 'lego', 'chess', 'board'],
  'art-media': ['art', 'sculpture', 'painting', 'frame', 'statue', 'museum', 'canvas', 'instrument', 'guitar', 'piano'],
  'currency-symbols': ['coin', 'coins', 'money', 'banknote', 'bill', 'bills', 'currency', 'dollar', 'euro', 'symbol', 'logo'],
  'holidays': ['christmas', 'halloween', 'easter', 'holiday', 'gift', 'gifts', 'pumpkin', 'santa', 'decoration', 'ornament'],
};

export const INDUSTRY_WORDS = {
  'aerospace': ['aircraft', 'airplane', 'jet', 'airliner', 'rocket', 'satellite', 'helicopter', 'spacecraft'],
  'military-defense': ['tank', 'military', 'armored', 'armoured', 'warship', 'artillery', 'fighter', 'apc'],
  'medical': ['anatomy', 'medical', 'organ', 'skeleton', 'dental', 'surgical', 'hospital', 'heart'],
  'game-development': ['character', 'weapon', 'prop', 'environment', 'creature', 'rigged', 'low', 'poly'],
  'film-video-production': ['character', 'set', 'vehicle', 'building', 'crowd', 'scene', 'studio'],
  'architecture': ['building', 'house', 'tower', 'bridge', 'facade', 'interior', 'skyscraper', 'stadium'],
  'virtual-reality': ['interior', 'room', 'environment', 'furniture', 'scene', 'rigged'],
  'advertising': ['bottle', 'packaging', 'product', 'can', 'box', 'cosmetic', 'phone', 'watch'],
  'software-development': ['computer', 'laptop', 'server', 'phone', 'monitor', 'keyboard', 'device'],
  'event-management': ['stage', 'chair', 'table', 'tent', 'booth', 'stand', 'light', 'speaker'],
  'hardware': ['machine', 'tool', 'equipment', 'pump', 'valve', 'engine', 'motor', 'bearing'],
  'simulation': ['aircraft', 'vehicle', 'ship', 'trainer', 'cockpit', 'terminal', 'crane', 'truck'],
  '3d-printing': ['figurine', 'miniature', 'statue', 'model', 'toy', 'bust', 'sculpture'],
};

/** Сколько слов темы встретилось в названии как ЦЕЛЫЕ слова. */
export function score(name, words) {
  const set = new Set(String(name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  let n = 0;
  for (const w of words || []) if (set.has(w)) n++;
  return n;
}
