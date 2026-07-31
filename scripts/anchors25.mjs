// anchors25.mjs - весовой добор для классификатора сайта.
//
// classify15.mjs работает по принципу «первое совпадение в списке» - это быстро,
// но 27% моделей падают в мусорную корзину `other`: у них нет ни одного слова
// из списков. Здесь второй слой: якорные существительные с ВЕСАМИ.
// Срабатывает ТОЛЬКО когда основной классификатор промолчал, поэтому уже
// работающие 73% не затрагиваются.
//
// Вес: специфичное существительное (helicopter=3) перебивает родовое (box=1),
// чтобы в многословном названии победил главный предмет.
//
// Экспортирует anchorClassify(name) -> slug категории или null.

const A = (t, c, w = 1) => ({ t, c, w });

export const ANCHORS = [
  // --- медицина ---
  A(['microscope', 'endoscope', 'syringe', 'scalpel', 'stethoscope', 'defibrillator', 'catheter', 'forceps', 'suture', 'bandage', 'wheelchair', 'crutch', 'prosthesis', 'implant', 'pill', 'capsule', 'tablet', 'vaccine', 'virus', 'bacteria', 'coronavirus', 'covid', 'dna', 'chromosome', 'neuron', 'cornea', 'retina', 'ovary', 'uterus', 'placenta', 'sperm', 'plasma', 'petri', 'pipette', 'centrifuge', 'autoclave', 'oximeter', 'nebulizer', 'inhaler', 'ampoule', 'vial', 'iv', 'infusion'], 'medical-3d-models', 3),
  // --- еда ---
  A(['icecream', 'popsicle', 'candy', 'lollipop', 'marshmallow', 'popcorn', 'croissant', 'baguette', 'pretzel', 'bagel', 'muffin', 'cupcake', 'pie', 'tart', 'pancake', 'waffle', 'crepe', 'dumpling', 'taco', 'burrito', 'nachos', 'hotdog', 'noodle', 'ramen', 'pasta', 'spaghetti', 'curry', 'kebab', 'falafel', 'hummus', 'yogurt', 'pudding', 'jelly', 'tiramisu', 'macaron', 'turkey', 'chicken', 'steak', 'bacon', 'sausage', 'ham', 'salami', 'sushi', 'salad', 'soup', 'fries', 'rosemary', 'basil', 'thyme', 'parsley', 'cinnamon', 'pepper', 'salt', 'sugar', 'honey', 'jam', 'sauce', 'ketchup', 'mustard', 'mayonnaise', 'watermelon', 'melon', 'pineapple', 'mango', 'papaya', 'avocado', 'lemon', 'lime', 'peach', 'pear', 'plum', 'cherry', 'grape', 'strawberry', 'raspberry', 'blueberry', 'apricot', 'coconut', 'pomegranate', 'carrot', 'potato', 'tomato', 'onion', 'garlic', 'broccoli', 'cabbage', 'lettuce', 'cucumber', 'pumpkin', 'corn', 'mushroom', 'champignon', 'whisky', 'whiskey', 'vodka', 'champagne', 'lemonade', 'soda', 'cola', 'espresso', 'cappuccino'], 'food-beverages', 3),
  // --- животные ---
  A(['shell', 'seashell', 'feather', 'cockroach', 'rattlesnake', 'python', 'cobra', 'viper', 'gecko', 'iguana', 'chameleon', 'alligator', 'tortoise', 'toad', 'newt', 'salamander', 'axolotl', 'squid', 'jellyfish', 'starfish', 'oyster', 'clam', 'mussel', 'scallop', 'urchin', 'lobster', 'shrimp', 'prawn', 'barnacle', 'coral', 'anemone', 'seahorse', 'stingray', 'eel', 'salmon', 'tuna', 'trout', 'carp', 'catfish', 'piranha', 'goldfish', 'koi', 'penguin', 'flamingo', 'peacock', 'ostrich', 'pelican', 'toucan', 'woodpecker', 'raven', 'crow', 'sparrow', 'finch', 'seagull', 'heron', 'stork', 'vulture', 'falcon', 'hawk', 'squirrel', 'hedgehog', 'raccoon', 'badger', 'otter', 'beaver', 'armadillo', 'sloth', 'koala', 'kangaroo', 'camel', 'llama', 'alpaca', 'buffalo', 'bison', 'antelope', 'gazelle', 'hyena', 'lynx', 'cougar', 'leopard', 'cheetah', 'panda', 'gorilla', 'chimpanzee', 'walrus', 'seal', 'narwhal', 'trilobite', 'ammonite', 'mammoth', 'larva', 'caterpillar', 'cocoon', 'snail', 'slug', 'worm', 'centipede', 'termite', 'locust', 'cicada', 'dragonfly', 'grasshopper', 'ladybug', 'wasp', 'hornet'], 'animals-creatures', 3),
  // --- природа ---
  A(['tumbleweed', 'seaweed', 'algae', 'lichen', 'ivy', 'bamboo', 'reed', 'wheat', 'barley', 'acorn', 'pinecone', 'sunflower', 'tulip', 'daisy', 'orchid', 'lily', 'rose', 'peony', 'magnolia', 'lavender', 'daffodil', 'poppy', 'dahlia', 'jasmine', 'hibiscus', 'lotus', 'bouquet', 'blossom', 'bloom', 'petal', 'sapling', 'stump', 'log', 'driftwood', 'coral reef', 'iceberg', 'glacier', 'dune', 'canyon', 'waterfall', 'geyser'], 'nature-plants', 3),
  // --- космос ---
  A(['spacesuit', 'extravehicular', 'cosmonaut', 'astronaut', 'spaceport', 'cosmodrome', 'lunar', 'orbiter', 'rover', 'probe', 'telescope', 'observatory', 'orbit', 'iss', 'apollo', 'skylab', 'soyuz', 'shuttle'], 'space-scifi', 3),
  // --- электроника ---
  A(['subnotebook', 'notebook', 'netbook', 'ultrabook', 'macbook', 'server', 'rack', 'motherboard', 'ssd', 'hdd', 'ram', 'dimm', 'cpu', 'gpu', 'heatsink', 'modem', 'switch', 'ethernet', 'rj45', 'hdmi', 'vinyl', 'turntable', 'cassette', 'walkman', 'jukebox', 'gramophone', 'phonograph', 'calculator', 'scanner', 'copier', 'plotter', 'oscilloscope', 'multimeter', 'transistor', 'capacitor', 'resistor', 'led', 'lcd', 'oled', 'barcode', 'terminal', 'atm', 'kiosk'], 'electronics-gadgets', 3),
  // --- промышленность ---
  A(['scaffolding', 'scaffold', 'girder', 'truss', 'rebar', 'derrick', 'gantry', 'winch', 'hoist', 'pulley', 'bearing', 'flange', 'manifold', 'actuator', 'piston', 'crankshaft', 'camshaft', 'radiator', 'silo', 'clarifier', 'baler', 'shredder', 'crusher', 'lathe', 'mill', 'welder', 'grinder', 'sander', 'substation', 'transformer', 'reactor', 'condenser', 'nozzle', 'bollard'], 'industrial-equipment', 3),
  // --- архитектура / экстерьер ---
  A(['pyramid', 'ziggurat', 'obelisk', 'aqueduct', 'amphitheater', 'amphitheatre', 'colonnade', 'archway', 'architrave', 'frieze', 'cornice', 'balustrade', 'gazebo', 'pergola', 'pavilion', 'kiosk building', 'lighthouse', 'windmill', 'watermill', 'silo building', 'greenhouse', 'terrace', 'balcony', 'staircase', 'elevator', 'escalator', 'window', 'door', 'gate', 'railing', 'chimney'], 'architecture-landmarks', 2),
  // --- мебель и интерьер ---
  A(['curtain', 'drapes', 'blind', 'carpet', 'rug', 'doormat', 'cushion', 'pillow', 'mattress', 'bathtub', 'toilet', 'sink', 'washbasin', 'bidet', 'urinal', 'shower', 'faucet', 'radiator heater', 'fireplace', 'mirror', 'wardrobe', 'sideboard', 'console table', 'coffee table', 'recliner', 'beanbag'], 'furniture-interior', 3),
  // --- кухня ---
  A(['grill', 'barbecue', 'bbq', 'toaster', 'blender', 'mixer', 'juicer', 'microwave', 'oven', 'stove', 'cooker', 'fridge', 'refrigerator', 'freezer', 'dishwasher', 'colander', 'strainer', 'grater', 'peeler', 'whisk', 'spatula', 'corkscrew', 'thermos', 'flask bottle', 'lunchbox'], 'kitchen-tableware', 3),
  // --- одежда и аксессуары ---
  A(['wallet', 'purse', 'clutch', 'satchel', 'briefcase', 'suitcase', 'luggage', 'duffel', 'crown', 'tiara', 'diadem', 'brooch', 'earring', 'pendant', 'cufflink', 'wig', 'hairstyle', 'sandal', 'slipper', 'loafer', 'stiletto', 'sneakers', 'bikini', 'swimsuit', 'lingerie', 'kimono', 'poncho', 'tracksuit', 'sportswear', 'stocking', 'mitten', 'headband', 'wristband', 'shoelace', 'zipper', 'buckle'], 'clothing-accessories', 3),
  // --- тара и хранение ---
  A(['envelope', 'trolley', 'cart', 'pallet', 'hamper', 'jerrycan', 'canister', 'drum', 'vat', 'silo container', 'dispenser', 'organizer', 'tote', 'wrapper', 'blister', 'sachet', 'pouch', 'ampoule box'], 'containers-storage', 2),
  // --- вывески и декор ---
  A(['newspaper', 'magazine', 'poster', 'billboard', 'signboard', 'placard', 'pennant', 'garland', 'wreath', 'ornament', 'figurine', 'sculpture', 'trophy', 'medal', 'plaque', 'candle', 'candlestick', 'vase', 'balloon', 'confetti', 'streamer', 'bubble', 'emoji', 'emoticon', 'gesture'], 'signage-decor', 2),
  // --- спорт ---
  A(['sleigh', 'sled', 'toboggan', 'snowboard', 'waterski', 'wakeboard', 'kayak paddle', 'dumbbell', 'barbell', 'kettlebell', 'treadmill', 'yoga', 'punchbag', 'shinpad', 'mouthguard', 'cleats', 'jersey', 'whistle', 'hurdle', 'javelin', 'discus'], 'sports-recreation', 3),
  // --- музыка ---
  A(['guitar', 'piano', 'violin', 'cello', 'drum', 'trumpet', 'saxophone', 'flute', 'clarinet', 'oboe', 'tuba', 'trombone', 'harp', 'banjo', 'ukulele', 'mandolin', 'accordion', 'harmonica', 'xylophone', 'marimba', 'tambourine', 'synthesizer', 'keytar', 'lute', 'sitar', 'bagpipe'], 'musical-instruments', 3),
  // --- освещение ---
  A(['lamp', 'lightbulb', 'floodlight', 'spotlight', 'headlight', 'taillight', 'torch', 'flashlight', 'candelabra', 'neon'], 'lighting', 3),
  // --- транспорт ---
  A(['sleigh vehicle', 'stagecoach', 'carriage', 'chariot', 'rickshaw', 'wheelbarrow', 'handcart', 'snowmobile', 'atv', 'quadbike', 'golfcart', 'monorail', 'locomotive', 'tram', 'railcar', 'boxcar', 'caboose', 'ambulance', 'hearse', 'limousine', 'snowplow', 'excavator', 'backhoe', 'grader', 'roller', 'paver', 'harvester', 'combine'], 'vehicles', 3),
  // --- игрушки ---
  A(['teddy', 'plush', 'doll', 'figurine toy', 'rubberduck', 'bobblehead', 'nendoroid', 'funko', 'yoyo', 'kaleidoscope', 'spinner'], 'toys-games', 3),
  // --- вода/лёд -> природа. Слова fire/flame/smoke/cloud/lightning НЕ берём:
  // они чаще про технику («Fire Siren», «Fire Truck», «Smoke Detector»), чем про природу.
  A(['splash', 'droplet', 'bubbles', 'foam', 'snowflake', 'icicle', 'iceberg'], 'nature-plants', 1),
  // --- воздухоплавание: «Hot Air Balloon» иначе уезжает в декор по слову balloon ---
  A(['hot air balloon', 'airship', 'zeppelin', 'blimp', 'weather balloon', 'parachute', 'paraglider', 'hang glider'], 'aircraft', 4),
  // --- пожарное/аварийное оборудование ---
  A(['siren', 'strobe', 'extinguisher', 'hydrant', 'smoke detector', 'sprinkler', 'alarm'], 'industrial-equipment', 3),
  // --- составные названия еды (в один токен не ловятся) ---
  A(['ice cream', 'whipped cream', 'french fries', 'hot dog', 'fried egg', 'peanut butter', 'chewing gum'], 'food-beverages', 4),
  // --- деньги и мелкие предметы коллекционирования ---
  A(['coin', 'banknote', 'dollar', 'euro', 'penny', 'cent', 'quarter', 'nickel', 'bullion', 'ingot', 'medallion', 'token'], 'signage-decor', 2),
];

const norm = name => {
  const set = new Set();
  for (const t of (String(name).toLowerCase().match(/[a-z0-9]+/g) || [])) {
    set.add(t);
    if (t.length > 4 && t.endsWith('ies')) set.add(t.slice(0, -3) + 'y');
    if (t.length > 3 && t.endsWith('es')) set.add(t.slice(0, -2));
    if (t.length > 3 && t.endsWith('s')) set.add(t.slice(0, -1));
  }
  return set;
};

export function anchorClassify(name) {
  const low = String(name).toLowerCase();
  const toks = norm(name);
  const score = {};
  for (const a of ANCHORS) {
    let hit = 0;
    for (const kw of a.t) {
      if (kw.includes(' ')) { if (low.includes(kw)) hit += a.w; }
      else if (toks.has(kw)) hit += a.w;
    }
    if (hit) score[a.c] = (score[a.c] || 0) + hit;
  }
  const best = Object.entries(score).sort((x, y) => y[1] - x[1])[0];
  return best ? best[0] : null;
}
