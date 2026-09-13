/*
 * cat-keywords.mjs - ключевые слова категорий, ОДИН экземпляр на весь проект.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Список жил внутри classify15.mjs, а трём другим
 * скриптам он тоже был нужен - build-category-hubs.mjs, build-new-cards.mjs и
 * merge-variants.mjs добывали его так: прочитать ИСХОДНИК classify15.mjs,
 * вырезать из текста кусок между «const CATS = [» и «];» и скормить eval.
 * Держалось это на том, что в чужом файле не поменяют форматирование.
 *
 * Импортировать classify15.mjs напрямую нельзя: при загрузке он читает весь
 * каталог и печатает отчёт. Поэтому список переехал сюда, а classify15.mjs
 * забирает его отсюда же.
 *
 * Формат строки: [слаг категории, отображаемое имя, ключевые слова].
 * ВНИМАНИЕ: отображаемое имя здесь - историческое и местами расходится с
 * data/taxonomy.json («Ships» против «Ships & Boats»). Для ПОКАЗА берите имя
 * из lib/taxonomy.mjs; здесь оно оставлено только чтобы не менять поведение
 * классификатора.
 */
export const CATS = [
  ['medical-3d-models','Medical',['anatomy','anatomical','skeleton','skull','bone','bones','muscle','organ','heart','brain','tooth','teeth','surgical','surgery','vein','artery','virus','prosthetic','spine','rib','pelvis','anatomically','medical','cardiovascular','circulatory','respiratory','digestive','nervous','kidney','liver','lung','lungs','stomach','intestine','fetus','embryo','dental','blood','cell','tendon','ligament','cartilage','torso']],
  ['aircraft','Aircraft',['aircraft','airplane','airliner','plane','jet','jets','helicopter','chopper','drone','uav','ucav','fighter','bomber','boeing','airbus','sikorsky','eurocopter','agustawestland','biplane','glider','tiltrotor','warplane','turbofan','turboprop','aviation']],
  ['ships','Ships',['ship','boat','warship','naval','navy','yacht','submarine','frigate','destroyer','cruiser','vessel','galleon','buoy','lcs','tanker','barge','sailboat','canoe','ferry','corvette','carrier','dinghy','catamaran','tugboat']],
  ['weapons','Weapons',['gun','guns','rifle','pistol','revolver','shotgun','sniper','firearm','knife','dagger','sword','blade','axe','machete','grenade','ammo','ammunition','bullet','cartridge','bayonet','holster']],
  ['tools','Tools',['hammer','wrench','screwdriver','drill','saw','pliers','toolbox','crowbar','spanner','chisel','clamp','vise','sander','grinder','trowel','shovel','rake','broom','ladder','toolkit']],
  ['military-vehicles','Military Vehicles',['tank','tanks','artillery','howitzer','mlrs','launcher','missile','rocket','armored','armoured','apc','humvee','ifv','cannon','mortar','turret','ballistic']],
  ['animals-creatures','Animals & Creatures',['dog','cat','fish','bird','horse','lion','tiger','bear','wolf','fox','deer','cow','pig','sheep','goat','rabbit','mouse','rat','snake','lizard','frog','turtle','crocodile','dinosaur','dragon','shark','whale','dolphin','insect','beetle','spider','ant','bee','butterfly','moth','fly','mosquito','scorpion','crab','octopus','monkey','elephant','giraffe','zebra','rooster','chicken','duck','eagle','owl','parrot','dachshund','macaque','pangolin','capybara','creature','animal','fur','beast','reptile','rodent','mammal','predator']],
  ['nature-plants','Nature & Plants',['tree','trees','plant','plants','flower','flowers','grass','leaf','leaves','bush','shrub','rock','rocks','stone','mountain','terrain','cactus','palm','fern','moss','mushroom','vine','forest','landscape','cliff','boulder']],
  ['food-beverages','Food & Beverages',['food','fruit','banana','drink','beverage','coffee','tea','wine','beer','pizza','burger','bread','cake','meat','vegetable','bottle','cocktail','sandwich','donut','cookie','milk','juice','egg','cheese','chocolate']],
  ['furniture-interior','Furniture & Interior',['chair','table','sofa','couch','bed','lamp','furniture','cabinet','desk','shelf','wardrobe','drawer','stool','bench','bookshelf','armchair','nightstand','dresser','ottoman','cupboard']],
  ['clothing-accessories','Clothing & Accessories',['shirt','tshirt','jacket','coat','dress','trousers','pants','jeans','hoodie','sweater','hat','cap','shoe','shoes','boot','boots','sneaker','glove','gloves','scarf','bag','backpack','handbag','jewelry','ring','necklace','bracelet','watch','glasses','sunglasses','belt','tie','sock','uniform','helmet','suit','mask','costume','armor','armour','vest','cape','goggles','apron','gown']],
  ['electronics-gadgets','Electronics & Gadgets',['phone','smartphone','iphone','laptop','computer','pc','tablet','camera','tv','television','monitor','speaker','headphone','earphone','earbuds','console','keyboard','mouse','router','microphone','gadget','processor','circuit','sensor','projector','printer','webcam','smartwatch','samsung','apple','ipad','macbook','imac','xiaomi','huawei','sony','dell','lenovo','nintendo','xbox','playstation','usb','charger','adapter','headset','gpu','cpu','ssd','remote','ipod','airpods',]],
  ['industrial-equipment','Industrial Equipment',['crane','machine','machinery','industrial','hvac','pump','valve','conveyor','generator','compressor','excavator','bulldozer','turbine','boiler','pipe','pipeline','gearbox','cnc','robot','robotic','hydraulic','forklift','tank','container','pallet','scaffold','ladder','engine','motor','gear','pump']],
  ['architecture-landmarks','Architecture Landmarks',['building','house','home','tower','monument','statue','landmark','colosseum','stadium','bridge','church','cathedral','castle','temple','mosque','architecture','structure','facade','skyscraper','apartment','villa','pavilion','fountain','gate','arch','wall','roof','column','stairs','fence','barn','warehouse','hangar']],
  ['characters-people','Characters & People',['man','woman','men','women','human','people','person','character','soldier','sailor','worker','warrior','zombie','knight','robot','cyborg','boy','girl','male','female','body','skin','hand','hands','head','face','avatar','ninja','pirate','king','queen','doctor','nurse','police','firefighter']],
  ['vehicles','Vehicles',['car','cars','truck','van','suv','sedan','coupe','bus','motorcycle','motorbike','scooter','vehicle','cadillac','chevrolet','chevy','toyota','mercedes','ford','bmw','audi','honda','nissan','tesla','volkswagen','limousine','pickup','wheel','tire','tyre','trailer','tractor','wagon','automobile','ambulance','jeep','bicycle','bike','forklift']],
  ['containers-storage','Containers & Storage',['box','boxes','crate','barrel','canister','bin','bucket','jar','carton','case','package','packaging','storage','sack','pouch','cargo','basket','tin','keg']],
  ['sports-recreation','Sports & Recreation',['ball','football','basketball','soccer','tennis','golf','hockey','rugby','fitness','gym','dumbbell','treadmill','skateboard','surfboard','racket','bowling','dartboard','frisbee','trophy']],
  ['kitchen-tableware','Kitchen & Tableware',['kitchen','bowl','pot','pan','plate','cup','mug','kettle','teapot','cutlery','spoon','utensil','saucepan','ladle','tableware','dish','pitcher','tray','jug']],
  ['space-scifi','Space & Sci-Fi',['star','planet','moon','galaxy','nebula','asteroid','comet','spaceship','spacecraft','satellite','cosmic','celestial','meteor','supernova','stars','solar','universe']],
  ['lighting','Lighting',['lantern','chandelier','bulb','streetlight','floodlight','spotlight','sconce','headlamp','luminaire','lightbulb']],
  ['toys-games','Toys & Games',['toy','toys','doll','lego','figurine','plush','puzzle','dice','boardgame','chess','teddy','rubik']],
  ['signage-decor','Signage & Decor',['sign','signs','banner','poster','frame','sculpture','vase','clock','ornament','decor','plaque','billboard','flag','pennant']],
  ['musical-instruments','Musical Instruments',['guitar','piano','drum','violin','trumpet','flute','saxophone','cello','harp','accordion','synthesizer','ukulele','banjo']],
  ['collections-sets','Collections & Sets',['collection','collections','pack','bundle','kit','kits','series','assortment']],
];
