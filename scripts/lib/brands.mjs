/*
 * brands.mjs - список торговых марок, из-за которых модель становится Editorial.
 *
 * ЗАЧЕМ. TurboSquid требует лицензию Editorial Uses Only для всего, что
 * изображает реальный товар под чужой торговой маркой: Tesla Model 3, Boeing
 * 737, iPhone. У нас на карточках стояло «Royalty Free (TurboSquid)» без
 * разбора - и в характеристиках, и в тексте вопросов, и в разметке FAQPage.
 * Для покупателя это прямая дезинформация: он планирует рекламную съёмку с
 * моделью, которую в рекламе использовать нельзя.
 *
 * ПОЧЕМУ СПИСОК РУКОПИСНЫЙ. Проверить лицензию у источника нельзя: страницы
 * TurboSquid отдают 403 на всех 28 пробах обычным HTTPS. Значит определяем по
 * названию, а название - единственное, что у нас есть. Список открытый: марку
 * добавить или убрать - одна строка.
 *
 * ПОЧЕМУ ЦЕЛЫЕ СЛОВА. Без границ слова «Ram» ловит «Ramp» и «Battering Ram»,
 * «Kia» - «Kiosk», «Smart» - «Smartphone». Поэтому сопоставление идёт по целым
 * словам, а многословные марки («Land Rover», «Rolls Royce») - по фразе.
 *
 * ЛОВУШКИ, КОТОРЫЕ УЧТЕНЫ ОТДЕЛЬНО.
 *   Ford      - есть «Ford» как брод (переправа). Но в каталоге это всегда
 *               автомобиль, а брод назывался бы «River Ford»; риск принят.
 *   Fiat      - латинское слово, но в каталоге только марка.
 *   Apple     - фрукт! Одноимённая марка ловится только в связке с товаром
 *               (iPhone, iPad, MacBook, iMac, AirPods, Apple Watch).
 *   Dodge     - глагол. Ловим только с моделью или словом Ram/Charger и т.п.
 *   Polo, Golf, Focus, Fusion, Escape - названия моделей, совпадающие с
 *               обычными словами. Их в списке нет: марка важнее модели.
 */

// Простые марки: достаточно встретить слово, чтобы модель стала Editorial.
export const BRANDS = [
  // автомобили
  'Tesla', 'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Suzuki',
  'Lexus', 'Infiniti', 'Acura', 'Isuzu', 'Daihatsu',
  'Volkswagen', 'Audi', 'BMW', 'Mercedes', 'Mercedes-Benz', 'Porsche', 'Opel',
  // SEAT в списке нет намеренно: все 139 совпадений оказались сиденьями -
  // «Car Seat Belt», «Plastic Stadium Seat», «Child Safety Seat». Настоящих
  // машин этой марки в каталоге не нашлось, а цена ошибки тут высокая.
  'Skoda', 'Bentley', 'Lamborghini', 'Ferrari', 'Maserati', 'Alfa Romeo',
  'Fiat', 'Lancia', 'Bugatti', 'Rolls Royce', 'Rolls-Royce', 'Aston Martin',
  'Jaguar', 'Land Rover', 'Range Rover', 'Mini Cooper', 'Volvo', 'Saab',
  'Peugeot', 'Renault', 'Citroen', 'Dacia', 'Bugatti',
  'Ford', 'Chevrolet', 'Chevy', 'Cadillac', 'Buick', 'GMC', 'Chrysler', 'Jeep',
  'Dodge', 'Lincoln', 'Pontiac', 'Hummer', 'Rivian', 'Lucid Motors',
  'Hyundai', 'Kia', 'Genesis Motors', 'SsangYong',
  'Lada', 'UAZ', 'GAZ', 'KamAZ', 'ZIL', 'Moskvich',
  'Koenigsegg', 'Pagani', 'McLaren', 'Lotus Cars', 'Morgan Motor',
  'BYD', 'Geely', 'Chery', 'Haval', 'NIO', 'Xpeng',
  // грузовики, спецтехника
  'Scania', 'MAN Truck', 'DAF', 'Iveco', 'Freightliner', 'Peterbilt', 'Kenworth',
  'Mack Truck', 'Western Star', 'Tatra', 'Caterpillar', 'Komatsu', 'Liebherr',
  'JCB', 'Bobcat', 'Case IH', 'John Deere', 'New Holland', 'Massey Ferguson',
  'Claas', 'Fendt', 'Kubota', 'Hitachi', 'Doosan', 'Sany', 'XCMG', 'Terex',
  'Manitou', 'Grove Crane', 'Tadano', 'Palfinger', 'Wirtgen', 'Bomag', 'Hamm',
  // мотоциклы
  'Harley-Davidson', 'Harley Davidson', 'Ducati', 'Yamaha', 'Kawasaki', 'KTM',
  'Aprilia', 'Triumph Motorcycles', 'Indian Motorcycle', 'Vespa', 'Piaggio',
  'Husqvarna', 'Moto Guzzi', 'MV Agusta', 'Zero Motorcycles',
  // авиация
  'Boeing', 'Airbus', 'Embraer', 'Bombardier', 'Cessna', 'Gulfstream', 'Learjet',
  'Dassault', 'Sukhoi', 'Tupolev', 'Ilyushin', 'Antonov', 'Yakovlev', 'Mikoyan',
  'Lockheed', 'Northrop', 'Grumman', 'McDonnell Douglas', 'Fokker', 'Saab Aircraft',
  'Pilatus', 'Piper Aircraft', 'Beechcraft', 'Cirrus Aircraft', 'Diamond Aircraft',
  'Sikorsky', 'Bell Helicopter', 'Eurocopter', 'Robinson Helicopter', 'Mil Mi',
  'ATR Aircraft', 'De Havilland', 'Comac', 'Irkut',
  // техника и электроника
  'iPhone', 'iPad', 'iMac', 'MacBook', 'AirPods', 'Apple Watch', 'Apple TV',
  'Samsung', 'Xiaomi', 'Huawei', 'OnePlus', 'Oppo', 'Vivo Phone', 'Realme',
  'Google Pixel', 'Nokia', 'Motorola', 'BlackBerry', 'HTC', 'Asus', 'Acer',
  'Lenovo', 'ThinkPad', 'Dell', 'Alienware', 'HP Laptop', 'Microsoft Surface',
  'PlayStation', 'Xbox', 'Nintendo', 'Switch Console', 'Oculus', 'Meta Quest',
  'GoPro', 'DJI', 'Canon', 'Nikon', 'Sony', 'Fujifilm', 'Leica', 'Panasonic',
  'Hasselblad', 'Polaroid', 'Sennheiser', 'Bose', 'JBL', 'Beats by Dre', 'Marshall Amp',
  'LG Electronics', 'Philips', 'Siemens', 'Bosch', 'Whirlpool', 'Electrolux',
  'Dyson', 'Roomba', 'iRobot', 'Nespresso', 'Keurig', 'DeLonghi', 'SodaStream',
  'Intel', 'AMD Ryzen', 'Nvidia', 'GeForce', 'Radeon', 'Raspberry Pi', 'Arduino',
  'Tesla Powerwall', 'Segway', 'Peloton',
  // одежда, обувь, спорт
  'Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Under Armour', 'Asics',
  'Converse', 'Vans Shoes', 'Timberland', 'Dr Martens', 'Crocs', 'Birkenstock',
  'Levis', 'Gucci', 'Prada', 'Louis Vuitton', 'Chanel', 'Hermes Bag', 'Versace',
  'Balenciaga', 'Burberry', 'Rolex', 'Omega Watch', 'Casio', 'Seiko', 'Fossil Watch',
  'Ray-Ban', 'Oakley', 'The North Face', 'Patagonia Jacket', 'Columbia Sportswear',
  'Wilson Sports', 'Spalding', 'Titleist', 'Callaway Golf', 'Head Sports', 'Babolat',
  // еда, напитки, товары
  'Coca-Cola', 'Coca Cola', 'Pepsi', 'Sprite Can', 'Fanta', 'Red Bull', 'Monster Energy',
  'Heineken', 'Budweiser', 'Corona Beer', 'Guinness', 'Carlsberg', 'Stella Artois',
  'Jack Daniels', 'Jim Beam', 'Absolut Vodka', 'Smirnoff', 'Bacardi', 'Hennessy',
  'Starbucks', 'McDonalds', 'Burger King', 'KFC', 'Subway Restaurant', 'Dominos Pizza',
  'Pringles', 'Oreo', 'Nutella', 'Kelloggs', 'Nestle', 'Danone', 'Heinz', 'Kraft',
  'Lays Chips', 'Doritos', 'Snickers', 'Ferrero Rocher', 'Toblerone', 'Haribo',
  'Tic Tac', 'Evian', 'Perrier', 'San Pellegrino',
  // прочее
  'Lego', 'Barbie', 'Hot Wheels', 'Nerf', 'Playmobil', 'Rubiks',
  'IKEA', 'Herman Miller', 'Eames', 'Vitra', 'Knoll',
  'Amazon Echo', 'Alexa Device', 'Google Nest', 'Ring Doorbell',
  'FedEx', 'UPS Truck', 'DHL', 'Maersk', 'Shell Station', 'BP Station', 'Texaco',
  'Yeti Cooler', 'Stanley Cup Tumbler', 'Zippo', 'Swiss Army Knife', 'Victorinox',
  'Glock', 'Beretta', 'Smith Wesson', 'Colt Firearms', 'Remington', 'Kalashnikov',
  'Heckler Koch', 'Sig Sauer', 'Barrett Rifle', 'Winchester', 'Mossberg',
];

// Готовые проверки: многословные - по фразе, односложные - по целому слову.
const RES = BRANDS.map(b => {
  const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
  return { brand: b, re: new RegExp('(^|[^A-Za-z0-9])' + esc + '($|[^A-Za-z0-9])', 'i') };
});

/** Какая марка нашлась в названии, или null. */
export function brandOf(name) {
  const n = ' ' + String(name) + ' ';
  for (const { brand, re } of RES) if (re.test(n)) return brand;
  return null;
}
