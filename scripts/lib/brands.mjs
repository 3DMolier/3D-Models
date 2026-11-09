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
  // Музыкальные марки (27.10.2026: шесть новых Gibson шли бы как Royalty Free).
  // «Fender» один не годится: так называют и кранец у лодки.
  'Gibson', 'Les Paul', 'Epiphone', 'Ibanez', 'Gretsch', 'Rickenbacker', 'Steinway',
  'Stratocaster', 'Telecaster', 'Fender Guitar', 'Fender Stratocaster', 'Korg', 'Roland',
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

/*
 * 09.11.2026: марки из разметки названий при отборе моделей под Fab.
 *
 * Список выше ловил половину брендовых моделей: в отчёте TurboSquid от 02.10
 * нашлось ещё ~9 000 моделей с чужой маркой (Kuka, Oshkosh, JLG, Makita,
 * DeWalt, Thule, Humvee...), и на сайте они стояли как Royalty Free.
 * Источник - D:/Clode_Work_Folder/reports/fab-ip/flags-*.tsv, взяты только
 * отметки «марка» и «изделие под маркой». Франшизы, люди и организации сюда
 * не входят: на TurboSquid они не всегда Editorial, решение за основателем.
 *
 * Каждая марка проверена по всем названиям сайта. Слова, которые бывают
 * обычными (Amazon - река, Colt - жеребёнок, HP - лошадиные силы, Staples -
 * скобы), вынесены в AMBIGUOUS ниже: там марка засчитывается только рядом с
 * изделием. Обрывки фраз (Bottega, Canin, Levi) заменены целой фразой.
 */
export const BRANDS_FAB = [
  '3doodler', '3DR', '4Moms', '4Secure', '66fit', '70mai', '7fresh', '7up', '9FORTY', '9Twenty', 'A-Premium',
  'AAI', 'Abac', 'ABB', 'Abbott', 'Abiomed', 'Absolut', 'ABT', 'ABUS', 'Accuray', 'Acela', 'ActiMaris',
  'Activia', 'Addis', 'ADP', 'Advair', 'Advair Diskus', 'Aermacchi', 'Aeroflot', 'AES', 'AESOP', 'Afikim',
  'Agrifac', 'Agusta', 'AgustaWestland', 'Ahuja', 'AIDC', 'Aillen', 'Air Jordan', 'Airboard', 'AirDresser',
  'Airflite', 'AirflowTest', 'Airgometer', 'Airmill', 'AirPower', 'AirSelfie', 'Airstream', 'AirTag', 'AirTV',
  'AK70', 'AKAI', 'Alcatel', 'Alexander Dennis', 'Aliengo', 'Allen and Heath', 'Allinson', 'Allmand', 'Allmax',
  'Allseas', 'Allseas Pioneering Spirit', 'Almarai', 'Alpina', 'Alpinestars', 'Alstom', 'Alti2', 'Altimaster',
  'Altman', 'Alvis', 'Amazon Basics', 'Ambu', 'Amerex', 'AMG', 'Amiga', 'Amocam', 'AmpliTank', 'Anesty',
  'Anker', 'Annies', 'Anthter', 'AntMiner', 'Anycubic', 'AOGULA', 'AON2', 'Aperol', 'Apis Cor', 'Aplio',
  'Apple Lisa', 'Apple Performa', 'Apple-1', 'Aqara', 'Aquaracer', 'Aquasurf', 'Araven', 'ArcadePro',
  'ArcWorld', 'ARDES', 'AriaDNA', 'Ariat', 'Arlo', 'Armand de Brignac', 'Armortech', 'ARRI', 'ARTAS',
  'Arturia', 'Asber', 'Assmann', 'Astell', 'Astell and Kern', 'AstraZeneca', 'AstroAI', 'AT&T', 'ATIE',
  'Atlas Copco', 'ATOUN', 'ATR', 'ATT', 'Atwater', 'Audemars', 'Audemars Piguet', 'Audioengine', 'Autel',
  'Avatr', 'AVD', 'Aveeno', 'AVIC', 'Avicopter', 'Avro', 'Axess', 'AYRO', 'Babboe', 'BabyBjorn', 'BaBylissPRO',
  'Baccarat Rouge 540', 'Bachans', 'BACtrack', 'BAE', 'BAE Systems', 'Baileys', 'BalloonToons', 'Bandai',
  'Bang and Olufsen', 'Bank of America', 'Barbasol', 'Barclays', 'Bardwell', 'Bardwell and McAlister',
  'Barilla', 'Barrett', 'Baseus', 'Bauer', 'Baumann', 'Bausch', 'Bausch and Lomb', 'Baxter', 'Baybee',
  'Baykar', 'Bayraktar', 'BD', 'Bear Cruzer', 'Beatbot', 'Beautural', 'Beaverlab', 'BEETRO', 'BeeWrap',
  'Behringer', 'Beissbarth', 'Belaz', 'BELCAT', 'Bell 206', 'Bell 360', 'Bell 407', 'Bell 412', 'Bellamore',
  'Bennington', 'Bentgo', 'Beosound', 'Berchtold', 'Beriev', 'Bernette', 'Bernzomatic', 'Bertazzon',
  'Bessacarr', 'Bestva', 'Bevi', 'Bic', 'Bigbelly', 'Bikeep', 'Bilt Rite', 'Biltema', 'Bio Bidet', 'BiOM',
  'BioRad', 'BioStore', 'Bissell', 'Bitmain', 'Bittel', 'BKT', 'Black and Decker', 'BlackHawk', 'Blackmagic',
  'Blighter', 'BlueOrchids', 'Bluerock', 'BlueROV2', 'Blueye', 'Boavision', 'Bodum', 'Bodycraft', 'Boivin',
  'BOKA', 'Bolex', 'Bombay Sapphire', 'Bonaok', 'Bonsaii', 'Boom Supersonic', 'Boon Glo', 'Bordens', 'Borum',
  'Boscaro', 'Boseno', 'Boss BF 3', 'Bostitch', 'Bottega Veneta', 'Bowflex', 'Bozena', 'BPL', 'Bragg', 'BRAUD',
  'Braun', 'Breadman', 'Brecknell', 'Breg', 'BRELLA', 'Brembo', 'Breo', 'Breville', 'Brewart', 'Brignac',
  'Brita', 'Britax', 'BRK', 'Browning', 'Bruder', 'BSN', 'Buckbootz', 'Bug-a-Salt', 'Bullpadel', 'Bushnell',
  'Buzz Optics', 'Caesars', 'CAIG', 'Calibrite', 'Calottery', 'Calpol', 'Camcopter', 'Cammenga', 'Campbells',
  'Campingaz', 'Camry', 'Canadair', 'Canadian Pacific', 'Canidae', 'Cannondale', 'Capsa Healthcare',
  'Caran dAche', 'Careobot', 'Carhartt', 'CarPostal', 'Carrom', 'CarScan', 'Casamigos', 'Caskmates',
  'Castelion', 'Castrol', 'CCbetter', 'CCM', 'Celestron', 'Cellink', 'CEM', 'CeraVe', 'Chainway', 'Chandon',
  'Changhe', 'ChargePoint', 'Chauvet', 'Cheetos', 'Chenowth', 'CheyTac', 'Chicco', 'Chick fil A', 'Chipolo',
  'Chobani', 'Choya', 'Christian Dior', 'Christian Louboutin', 'Chromecast', 'Chubb', 'Chupa', 'Chups',
  'Cicare', 'Ciclotte', 'Cicret', 'Cinetech', 'Cintiq', 'Circle2', 'Cisco', 'CITC', 'Citea', 'Citi',
  'Citibike', 'Clay Paky', 'CleanStar', 'Clicgear', 'CLOi', 'Cloudline', 'Cobas', 'Cobham', 'Cobod',
  'Cobra CB', 'CocaCola', 'Cockerill', 'Cofrimell', 'Colapz', 'Coldream', 'Coleman', 'Colgate', 'Collomix',
  'Colnago', 'Colorchecker', 'ColorSource', 'Combilift', 'Compstick', 'ComTac', 'Conair', 'Conde', 'Conder',
  'Connelly', 'Conow', 'Constructam', 'Contura', 'Cooler Master', 'CopAir', 'CoronaVac', 'Coronita', 'COSORI',
  'CoviVac', 'Crankbrothers', 'Crayola', 'Crazy Richard', 'Creality', 'Cremo', 'Cressi', 'Crockpot', 'Crosley',
  'Crosman', 'CrossHelmet', 'Crowcon', 'Cruzee', 'Cryogas', 'CryoTrans', 'CSX', 'Ctronics', 'Cub Cadet',
  'Cubify', 'Cuisinart', 'Cuppone', 'Curaprox', 'Cutler-Hammer', 'CyberDog', 'CyberKnife', 'Cybertruck',
  'Cynamed', 'D-Wave', 'Da Vinci Surgical', 'Daewoo', 'DAGOR', 'Dake', 'Daktronics', 'Darco', 'Darkfin',
  'Datamars', 'David Clark', 'Davidoff', 'DB Cargo', 'DEC PDP 11', 'Deerma', 'Deglon', 'Deiss', 'Deka',
  'DeLorean', 'Demaclenko', 'Denso', 'Denza', 'Dermapen', 'Desert Eagle', 'DesignJet', 'DeSoutter', 'Destinus',
  'Detecto', 'Devtac', 'DeWalt', 'Dewolt', 'Dewulf', 'DGCRANE', 'Dibal', 'Dickies', 'Digit Robot', 'Dior',
  'Dior Sauvage', 'Directv', 'Discbine', 'Ditoo', 'Divoom', 'DKN', 'DMC-12', 'Dockwise', 'Dolan', 'Dolby',
  'Dolby Atmos', 'Dolce Gabbana', 'Dolce Gusto', 'Domestos', 'Domyos', 'Dongfeng', 'Donyer', 'Dornier', 'DPD',
  'Dr Browns', 'Dr Pepper', 'Dragonhawk', 'Drass', 'Dreamcast', 'DS X E-TENSE', 'DTV Shredder', 'DualSense',
  'Duke And Son', 'Dundalk LeisureCraft', 'Dunlop', 'DuoDrum', 'DuraStar', 'Durex', 'Duronic', 'Dustbuster',
  'Dye i5', 'DYMO', 'Dynapro', 'Dynatron', 'Dynetics', 'E-M10', 'E-One', 'eActros', 'EADS', 'EarPod',
  'EarPods', 'Earthway', 'Eastman', 'Easybrau', 'Easybreath', 'EasyFold', 'EasyStyle', 'EatMyTackle', 'eBay',
  'EBO', 'ECA Group', 'Echo Dot', 'EcoFlow', 'Ecovacs', 'EctoLife', 'EdgeStar', 'Ehang', 'Eisco', 'EKM',
  'Elbit', 'Elgato', 'Elgi', 'EliteBook', 'Elkay', 'Elmers', 'Elmira Northstar', 'Elster', 'ELTA', 'eMac',
  'EMD', 'Emerson', 'Emooqi', 'Empire Paintball', 'Enabot', 'Ender-3', 'Enerpac', 'Enerzen', 'Engel',
  'EnjoyCool', 'Enviro 400', 'Enviro400', 'EnviroVent', 'Envo', 'EOTECH', 'EPICKA', 'Epiroc', 'Epson',
  'Ergotron', 'ESAB', 'Essager', 'ESYNiC', 'Ethel M', 'Etihad', 'eTrex', 'Eurofighter', 'Eve Button',
  'evenGLO', 'Everlast', 'EverShield', 'EVgo', 'Eviation', 'EVL', 'EvlTest', 'Evlution', 'EvoSling',
  'Expanscape', 'F-Beauty', 'Facom', 'Fairchild Republic', 'Fairtex', 'Falcon III', 'Falon Tech', 'Fancii',
  'Fancy Feast', 'Farberware', 'Fatek', 'FatMax', 'Faymonville', 'Fazioli', 'Feastables', 'Featherlite',
  'Febreze', 'FED-3', 'Federal Signal', 'Feeke', 'Feimate', 'Fellhoelter', 'Fenton', 'Fenty', 'Ferrero',
  'Ferrero Raffaello', 'Fibaro', 'Fieldking', 'FIFINE', 'Fiio', 'FILA', 'Filiofocus', 'FingerLock',
  'FireChief', 'FireMagic', 'Firetti', 'Firman', 'Fisher F22', 'Fisher Price', 'FK Irons', 'Flambeau',
  'Fleetwood Bounder', 'Flexio', 'Flexpicker', 'Flextail', 'Flipper Zero', 'FLIR', 'Fliteboard',
  'Flitescooter', 'FlixBus', 'FloTool', 'FLSmidth', 'Flxible', 'Flybar', 'FN P90', 'FN SCAR', 'Focus Creation',
  'Foodi', 'Footjoy', 'Forbes', 'FORCE3', 'Foreo', 'ForgedAir', 'Formlabs', 'Fortwo', 'Fosmon', 'Fotodent',
  'Foxconn', 'Franchi', 'Franziskaner', 'Freemotion', 'Freewire', 'Freixenet', 'Frenan', 'Frenchs',
  'Freshburst', 'Frigidaire', 'Frilixa', 'Friskies', 'Fritos', 'Frogg Toggs', 'Frontgate', 'Fuel3D', 'Fuggler',
  'Fuji X-T2', 'Fujinon', 'Fujitsu', 'Fullstar', 'FumeCaddie', 'Funai', 'Furby', 'Furla', 'Fuzion', 'Fybots',
  'Gaerne', 'Gaiam', 'Galaxy S20', 'Gallet', 'Gamevice', 'Gamewell', 'Gardall', 'Gardena', 'Garmin',
  'Garmin Descent', 'Garrett Wade', 'Gasmaster', 'Gatik', 'Gatso', 'Gaussin', 'Gaussin H2', 'Gazprom', 'GE',
  'GearLight', 'Gearwrench', 'Gebruder Ihle', 'Generac', 'General Atomics', 'General Dynamics',
  'General Electric', 'General Motors', 'Gentex', 'Gerber', 'Germfree', 'Getac', 'Gewa', 'Ghirardelli',
  'Gillette', 'GilletteLabs', 'Gillig', 'Gira', 'Giro', 'GITAI', 'Glasdon', 'Glassco', 'Glocusent', 'GNA',
  'Go1', 'Goalrilla', 'GoFit', 'Goldwyn', 'Goodyear', 'Google', 'Goplus', 'Gore Tex', 'Gosky', 'GoXLR',
  'Goyard', 'GP PowerBank', 'Greenfield Robotics', 'Greubel Forsey', 'Gri Gri', 'Groundsmaster', 'Growneer',
  'Grundens', 'Guimbal', 'Hager', 'Haier', 'HAL Tejas', 'Haliade-X', 'Hallam', 'HAMILTON-C1', 'Hangkai',
  'Hankook', 'Hape', 'Hario', 'Harloff', 'Harmattan AI', 'Harney and Sons', 'Harpic', 'Harrys', 'Harvia',
  'Hatco', 'HDW', 'Heatbox', 'Heckler and Koch', 'Heets', 'Heine', 'Heiniken', 'Hella', 'Hendi',
  'HendrickCars', 'Henex', 'Henriques', 'HENSOLDT', 'Hermle', 'HESA', 'Heuer', 'HexClad', 'HEXFET', 'Hi-Lift',
  'Hi-Point', 'Hicober', 'HiCombat', 'Hills Aging Care', 'Hilmor', 'Hino', 'HK G36', 'HMMWV', 'Hobby Caravan',
  'Hoka', 'Holiday Aisle', 'Holmatro', 'Holmer', 'Hololens', 'Homegroove', 'HomeKit', 'HOmeLabs', 'HomePod',
  'Homido', 'HondaJet', 'Honeywell', 'Hopkins FloTool', 'Hospivac', 'Hoto', 'Houndsbay', 'Hoversurf',
  'Hozelock', 'HP DesignJet', 'HPE', 'Huawey', 'Hubble Hugo', 'Huggies', 'Humvee', 'Hydrema', 'Hylands',
  'Hyosung', 'Hyperloop One', 'HyperX', 'IAI', 'IBM', 'iBook', 'Icom', 'Icon Airflite', 'IEK', 'Iglooworks',
  'Ihle', 'iHome', 'iHome Control', 'IIc', 'IIe', 'IIIDScan', 'iKettle', 'Ilco', 'Illustra', 'ILT Zenview',
  'IMER', 'IMI', 'Impiantinox', 'In N Out', 'InBody', 'Inciner8', 'Indego', 'Infant Optics', 'Infinicut',
  'Infinix', 'Ingersoll', 'INKAS', 'InnoSpire', 'Innova', 'Insight Technology', 'Insta360', 'Instan Pot',
  'InstaView', 'Intuos', 'iOttie', 'iPads', 'iPhones', 'iPod', 'iPod Nano', 'iPod Shuffle', 'iPod Touch',
  'iPonatic', 'IQOS', 'iROCKER', 'Irwin Naturals', 'ismartgate', 'IWI', 'Jabra', 'Jackery', 'Jacobs Coffee',
  'Jagermeister', 'Jameson', 'Janssen', 'Japonesque', 'Jarraff', 'JavaPresse', 'Jazzy Select', 'JBH',
  'JCDecaux', 'Jeeps', 'JEOL', 'Jetboil', 'Jetsurf', 'Jisulife', 'JJ Electronics', 'JLG', 'JMS', 'JNV',
  'Johnnie Walker', 'Johnsons', 'Joma', 'JOOLA', 'Joseph Joseph', 'JST', 'Juicy Jay', 'Jumbotron',
  'Jungheinrich', 'Junkers', 'JURO', 'Justrite', 'JVC', 'JYM', 'K5 Security Robot', 'Ka Bar', 'Kaba', 'Kaged',
  'Kaged Muscle', 'Kalmar', 'KAMAG', 'Kaman', 'Kamingo', 'Kamov', 'Karadeniz', 'Karcher', 'Kavass', 'Keltek',
  'Kemper', 'Kikkoman', 'Kinder Surprise', 'KitchenAid', 'KitKat', 'Kiwibot', 'Klein Tools', 'Klimov',
  'Klipsch', 'KLM', 'KMW', 'Knightscope', 'Kodak', 'Kohler', 'KOKA', 'Kongsberg', 'Kool-Aid', 'Kopron', 'Koss',
  'Kovea', 'Kriss', 'KRISS Vector', 'Krombacher', 'Krug', 'Kruizinga', 'Krusovice', 'Kuka', 'Kurkdjian',
  'Kwikset', 'L3Harris', 'Laaers', 'Labcold', 'Labconco', 'Labtron', 'Lafarge', 'Lamicall', 'LandPack',
  'Landworks', 'Laserliner', 'Latin Percussion', 'Latrails', 'LauncherOne', 'Lavazza', 'LBR', 'Le Creuset',
  'Leatherman', 'LeeBoy', 'Lematec', 'LEMONDAR', 'Levi Strauss', 'Levoit', 'Lews', 'LG', 'Libman', 'Lifeloc',
  'Liliwise', 'Lincat', 'Linde', 'Linet', 'LineTrike', 'Lion8', 'Listerine', 'Little Tikes', 'Littmann',
  'LiXiang', 'LiXiang L6', 'Logitech', 'LOL Doll', 'Lomb', 'Loncy', 'LONGCHAMP', 'LOreal', 'LOTES', 'Lotte',
  'Louboutin', 'Lucky John', 'Lufthansa', 'Lutron', 'Luxardo', 'Lycoming', 'M and Ms', 'Mac Mini', 'Mac Pro',
  'Mac Studio', 'Mach-E', 'Maison Francis Kurkdjian', 'MakerBot', 'Makita', 'Mammoet', 'Marc Jacobs',
  'Marcel Deiss', 'Marvis', 'Mauser', 'Maybach', 'Maybelline', 'Maybelline New York', 'Maytag', 'McDonald\'s',
  'MCI', 'MCI 102DL3', 'MCI D4500', 'Medstor', 'Mega Millions', 'Meinl', 'MENCK', 'Mengshi', 'Mentos',
  'Merrell', 'MessagePad', 'Messerschmitt', 'Metabo', 'Metro Goldwyn Mayer', 'MetroCard', 'Michelin',
  'Microlab', 'Microlino', 'Micromax', 'Microsoft', 'Miedema', 'MightyFly', 'Mijia', 'MikaMax', 'Mikasa',
  'Mikrotechna', 'Milanion', 'Mildef', 'Mildseven', 'Mindray', 'Minipresso', 'MINIWARE', 'MiniWire', 'Minox',
  'MINTiD', 'Mirafit', 'Mirinda', 'Mirokai', 'Mishimoto', 'Mitaka', 'Mitutoyo', 'Mizuno', 'MKBeacon',
  'MLTOOLS', 'MMIST', 'MMs', 'MOBi-One', 'Mobil', 'MobileStudio', 'Modobag', 'Moet', 'Moggaro', 'Molift',
  'Mondial Forni', 'Mondraker', 'Monoprice', 'Mopec', 'mophie', 'Moschino', 'MOSER', 'Mosqzap', 'Motoman',
  'Mottez', 'MouKey', 'MovieTech', 'MSA', 'MSA Gallet', 'MTV', 'Muhle', 'MXR', 'N-Strike', 'Naio', 'Namco',
  'Nanni', 'Nanoleaf', 'NARS', 'NasalCrom', 'Natuzzi', 'Nautique', 'Navya', 'Nayun', 'Neabot', 'NEARX', 'NEC',
  'Neorest', 'Nescafe', 'Nesco', 'Nest Protect', 'Netgear', 'Neuralink', 'Nexus 9', 'Nielsen', 'Nihon Kohden',
  'NIKKOR', 'Nilkamal', 'Ninebot', 'Ninja Foodi', 'Niton', 'Nivea', 'Nnewvante', 'NOCO', 'Noras',
  'Norfolk Southern', 'Norinco', 'Novex', 'NOVOSTAR', 'Nulink', 'Nulo', 'NUX', 'NxtWear', 'NZXT', 'O2VAPE',
  'Obrien', 'Ocean Signal', 'OceanGate', 'Oceanic Viper', 'Ochiai', 'Ocoopa', 'Octanorm', 'OfficeJet', 'OGIO',
  'Oklahoma Joes', 'Old Spice', 'OLFA', 'Olufsen', 'OM-D-E-M10', 'OMIS', 'OmniLink', 'Omnimove', 'Omtech',
  'Onduline', 'Onelink', 'OneTouch', 'OneWeb', 'Onewheel', 'ONEWRAP', 'OnGuard', 'Onset HOBO', 'Ontour',
  'OOCL', 'Ooni', 'Optistar', 'Optistar Elite', 'OptiTrack', 'Optivisor', 'Optoma', 'OrthoCare', 'Oscartielle',
  'Oshkosh', 'OSSUR', 'Osterizer', 'OTICO', 'OTO Melara', 'Ottobock', 'Ouija', 'Outland Living', 'Outsunny',
  'Ove Decors', 'OXO', 'Ozempic', 'Paillard', 'Paillard Bolex', 'Paiste', 'Pampers', 'Panavia', 'Pantene',
  'Pantone', 'Panwoods', 'PARKY', 'Patagonia Better Sweater', 'Patek', 'Patek Philippe', 'Paulaner', 'Pavoni',
  'Pavony', 'PayPass', 'PayPoint', 'PEBEO', 'Peli', 'PELTOR', 'PenPower', 'Pentax', 'Pentheon', 'PepsiCo',
  'Perard', 'Perego', 'Performancebox', 'Persil', 'Personna', 'Peterbild', 'PETKIT', 'Pettibone', 'Pfizer',
  'Phantom Flex4K', 'Philco', 'Philipp Plein', 'Phison', 'Photoshop', 'Piguet', 'Pirelli', 'PistenBully',
  'Pixel 3 XL', 'PixelBloc', 'PJP', 'PlanetSolar', 'Planmeca', 'Plantronics', 'Playseat', 'Playtrix',
  'Plymovent', 'Pocketalk', 'PocketBook', 'Poietis', 'Polikarpov', 'Polyform', 'Ponsse', 'PopGrip',
  'PopSockets', 'Porter Cable', 'Potain', 'Potis', 'Poulan', 'Powerball', 'Powerbeats', 'PowerBook',
  'Powerbuilt', 'PowerCore', 'Powerlock', 'PowerRay', 'Powerrider', 'Powership', 'PowerVision', 'PowMr',
  'PowrLiner', 'Pragma', 'Pragma Industries', 'Pratt and Whitney', 'Pratt Whitney', 'Premista',
  'President Salted Butter', 'Pressalit', 'Prestone', 'PrimeSense', 'Pro Tec', 'Procuity', 'PROENGIN',
  'ProForm', 'Proglide', 'ProLaser', 'PRONEXT', 'ProSecur', 'Prosper Beauty', 'Proterra', 'ProVecta', 'ProX',
  'PRR', 'PS5', 'Pulsefire', 'Pure2Improve', 'Purell', 'PXN', 'Pyle', 'Pyramex', 'Pyrex', 'PZL', 'QFX',
  'QuadCast', 'QuadraLean', 'Qualcomm', 'QUEN', 'Quench', 'QuicKART', 'QuickJack', 'QuikHeel', 'Quikrete',
  'Quiksilver', 'Rabbit R1', 'Racelogic', 'Rachio', 'RadBurro', 'Radia', 'RadRunner', 'RAMTONX', 'RANSENERS',
  'Rasasi', 'Rasson', 'Rattique', 'RAVO', 'Rawlings', 'Raymetrics', 'Raytheon', 'Razer', 'Razer Kiyo', 'RCA',
  'Recaro', 'Reddragon', 'Reichert', 'Remy Martin', 'Revell', 'Rexing', 'Rezvani', 'Rheem', 'Rheinmetall',
  'Rhotheta', 'Ricon', 'Riddell', 'RideAlong', 'Rimowa', 'Ripsaw', 'RipStik', 'Ritfit', 'Ritmix', 'RKDMO',
  'RoadMate', 'Robfin', 'Robotiq', 'RoboTurtle', 'Rocketsan', 'Rode', 'ROG', 'Roketsan', 'Roku', 'Rolleiflex',
  'Rolson', 'Romica', 'Ronald McDonald', 'Roper Whitney', 'Rosenbauer', 'Rosle', 'Rossya', 'Rowenta', 'Roxell',
  'Royal Canin', 'RTFKT', 'RTX', 'Rubbermaid', 'Rubik', 'Ryobi', 'S-Class', 'Sabian', 'Sabrent', 'Saf T Liner',
  'SafeSea', 'Sagaform', 'SAIC', 'SAITE', 'Sakrete', 'Salewa', 'SAMCOM', 'Samsonite', 'Sandee', 'SanDisk',
  'Sanfine', 'Saro', 'Sauvage', 'Saxenda', 'ScanSnap', 'Scarpa', 'Schiebel', 'Schlage', 'Schopf', 'SCHOTTEL',
  'Schrade', 'Schutt', 'SCILOGEX', 'Scrabble', 'SCUBAPRO', 'Sea Doo', 'Seabob', 'Seage', 'Seamaster', 'seca',
  'Seeburg', 'Sega', 'Sega Mega Drive', 'SelectTech', 'Senfeng', 'Senoh', 'SensoSmart', 'Sensys', 'Sentro',
  'Sepura', 'ServeBot', 'Shaldag', 'Sharpie', 'ShearGuru', 'Sherp', 'Shield AI', 'Shimpo', 'Shinola',
  'Shinymod', 'Shop-Vac', 'ShredTech', 'Shure', 'Siat', 'SIDIANTOL', 'SIG', 'Signascript', 'Signia',
  'SIHUADON', 'SILAPRO', 'Silberschnitt', 'Silca', 'Sileno', 'Silentwind', 'Silk Epil', 'Simonelli', 'Simrad',
  'Singumator', 'Sirchie', 'SITERWELL', 'Sizzix', 'Sk8-Hi', 'Skechers', 'Skee', 'Skeldar', 'Skittles', 'SKLZ',
  'Sky-Watcher', 'Skydio', 'Skydroid', 'Skydweller', 'Skynex', 'SkyPanel', 'SkyQuest', 'SkyWatch',
  'SlagPotCarrier', 'Slazenger', 'Slinky', 'Slip Ins', 'Smart EQ', 'Smartecarte', 'SmartKART', 'Smartpad',
  'SmartWasher', 'SmartXide', 'Smashbox', 'Smeg', 'Smiths Detection', 'Snakeboard', 'SNC', 'SNES',
  'SnowPlow Fisher', 'Snugglers', 'SODI', 'SODI RX8', 'Sodimac', 'Soehnle', 'Softail', 'SolarEdge', 'SolaSpot',
  'Sole E35', 'Solo Cup', 'Sonicaid', 'Sonos', 'SOOCAS', 'Soudal', 'Soundcore', 'Source Four', 'SpaceAid',
  'SpaceShipTwo', 'Spacetop', 'Spaten', 'Speakman', 'Spectra Direkt', 'Speed Queen', 'Speedglas', 'Speedo',
  'Spirobank', 'SPRI', 'Spurtar', 'Square D', 'SSBC', 'Stallbrook', 'Staples Center', 'Staxxon', 'SteelSeries',
  'Steinel', 'Steora', 'Step2', 'Steyr', 'Stiga', 'STIHL', 'Stolt', 'Strandmon', 'StreamCam', 'Streamlight',
  'StrongPoint', 'Stryker', 'Studebaker', 'STX', 'Suavitel', 'Subea', 'SUHD', 'Suigei', 'Sullair', 'SunChips',
  'Supacat', 'Super Soaker', 'Superdry', 'Superfone', 'Supermarine', 'Superstrata', 'Surftek',
  'Sweet Baby Rays', 'Swingline', 'Symbicort', 'Synca', 'Syncros', 'SYPAQ', 'Tacklife', 'Tacx', 'Tag Heuer',
  'Taimi', 'Takamine', 'Talens', 'Talkboy', 'Talkgirl', 'Tamagotchi', 'Tanqueray', 'Targus', 'Tatamia',
  'Tatsuno', 'Tavor', 'TC Electronic', 'TC Helicon', 'TCL', 'TDK', 'Techamor', 'Tefal', 'Teichenne', 'Tekever',
  'TEKTON', 'Tektronix', 'Telegrafia', 'Telegrafia Pavian', 'Televes', 'TellerScan', 'Telwin', 'Temflex',
  'Tenax', 'Tengden', 'Teqball', 'Terra Dos', 'Tesmec', 'TGB', 'Thales', 'Thermo Scientific', 'Thermonator',
  'Thies', 'ThirtyTwo', 'Throwflame', 'Thrustmaster', 'Thule', 'Thule Basin', 'TICONN', 'Tiger-Mate',
  'Tigercat', 'TingTingo', 'Tipp', 'Tipp Ex', 'TLD', 'Toggs', 'Tolsen', 'Tombow', 'TomTom', 'TonePrint',
  'Topeak', 'Topps', 'TORIN', 'Tortex', 'Toshiba', 'Tostitos', 'Toyo', 'Trackimo', 'Transmedics',
  'Trek Farley', 'Tremcar', 'Treo', 'Trezor', 'Tribord', 'Tricel', 'Triflex', 'Trijicon', 'Trimble',
  'Trivision', 'Trizor', 'Trodat', 'Trodat Professional', 'Trombia', 'Tronxy', 'TrueBeam', 'Trustfire',
  'TUD Toy', 'Tuff Stuff', 'Tullamore', 'Tullamore Dew', 'Tupperware', 'Turanor', 'Tweel', 'Twinings', 'Twix',
  'Tyco', 'U-Boat Worx', 'U-Haul', 'Ubiquiti', 'Uestco', 'UGG', 'UKRJET', 'ULANZI', 'Uline', 'ULMA', 'ULPower',
  'UltraLyte', 'Unger', 'Unitree', 'Universal Robots', 'Universal Studios', 'Uralmash', 'UralSpetsTrans',
  'Urberg', 'Urbos', 'Urbos3', 'Urisys', 'USA Today', 'V-Raptor', 'Vacutainer', 'Vanish', 'Varco', 'Varian',
  'VDL', 'VEHHE', 'Veilside', 'VeloChampion', 'Verifone', 'Verizon', 'Versaflo', 'Vervaet', 'VESEN', 'Vestil',
  'Vetter', 'VEVOR', 'VHB', 'Viagra', 'Vichy Catalan', 'Victoreen', 'Victory Innovations', 'Victrola',
  'View-Master', 'ViewSonic', 'Villeroy and Boch', 'Villeroy Boch', 'Vimec', 'ViperJet', 'VIRB',
  'Virgin Galactic', 'Vise Grip', 'Vision60', 'Vistabule', 'Vivomove', 'Vlogistics', 'VMAC', 'VOCOPRO',
  'Vodafone', 'VOF', 'Vollrath', 'Voltex', 'Vornado', 'Vossloh', 'VOX', 'Vuelift', 'Wacaco', 'Wacom', 'Waeco',
  'WAHL', 'Wallenius', 'Wallypower', 'Walmart', 'Walther', 'Washbrook', 'Waxkiss', 'Waymo', 'WD 40', 'Wegovy',
  'Wemo', 'WEN', 'Westland', 'Westpack', 'Whiskas', 'Whoop', 'Wiffle', 'Willys', 'Wilton', 'Winbot',
  'Wine Enthusiast', 'Wiss', 'Witeg', 'WoodRiver', 'Workpro', 'WorldCard', 'Worx', 'Wrigley', 'Wuliangye',
  'Wuling', 'Wurth', 'WYKDL', 'X-Rite', 'Xanax', 'Xcelsior', 'XDR', 'Xenith', 'Xerox', 'XGIMI', 'XP-Pen',
  'XPG', 'XPPen', 'Xprinter', 'XRocker', 'Xserve', 'XTRATUF', 'XTURISMO', 'Yaber', 'Yaheetech', 'Yale Assure',
  'YANMAR', 'Yarbo', 'Yaskawa', 'Yealink', 'Yoplait', 'Youtube', 'YSL', 'YuMi', 'Yuneec', 'ZALA', 'Zamboni',
  'Zapcat', 'Zarmig', 'Zeekr', 'Zendure', 'Zero DSRP', 'Ziamv', 'Zivko', 'ZMart', 'Zojirushi', 'Zorb', 'ZOSI',
  'Zozen', 'Zulay', 'Zupapa', 'ZYN',
];

/*
 * Слова-марки, которые бывают и обычными словами, местами, именами.
 *   with   - марка засчитывается, только если в названии есть одно из слов
 *            (изделие этой марки): Apple + Mac, Bell + 412, Stanley + Hammer;
 *   unless - марка засчитывается всегда, кроме названий с чужим смыслом
 *            (Amazon, но не Amazon Parrot и не Amazon Piranha).
 * ЛОВУШКА: в названиях есть хвост «Rigged for Cinema 4D / Maya / Blender».
 * Слова-платформы в with не ставить: Apple + Cinema поймало собаку.
 */
export const AMBIGUOUS = {
  'Apple': { with: [
    'iMac', 'eMac', 'Mac', 'Macs', 'Macintosh', 'Lisa', 'Magic', 'Store', 'Retail', 'Studio', 'Cinema Display',
    'Tracker', 'PowerBook', 'HomeKit', 'Pencil', 'Computer', 'Computers', 'Lightning', 'Thunderbolt',
    'EarPods', 'Wireless', 'Remote', 'Vision', 'HomePod', 'AirTag', 'Keyboard', 'Mouse', 'Trackpad', 'Display',
    'Laptop', 'Logo', 'Newton', 'Adapter', 'Charger', 'Cable', 'Mighty', 'Performa', 'IIe', 'IIc', 'II', 'III',
    'Power Mac', 'M1', 'M2', 'M3', 'M4', 'Watch', 'TV', 'Pro Display', 'Smart Cover', 'Smart Covers',
    // фруктовые названия (Apple Pie, Cider Vinegar, Apple Slicer) этими словами не ловятся
    'Accessories', 'AirPort', 'Cables', 'Card', 'Cases', 'Chargers', 'Electronics', 'Face Shield',
    'Leather Sleeve', 'Leather Wallet', 'MacBooks', 'MagSafe', 'Mobile Chips', 'Monitor', 'Monitors', 'Pencils',
    'Remotes', 'Smart Case', 'Smartwatch', 'Knit Band', 'Sport Loop', 'S1', 'Watches', 'Polishing Cloth',
    'Server', 'Keypad', 'Packaging Boxes'] },
  'Steam Deck': { with: ['Valve', 'Console', 'Handheld', 'OLED', 'Dock', 'Gaming', 'Controller'] },
  'Steam Machine': { with: ['Valve', 'Console'] },
  'Steam Controller': { with: ['Valve'] },
  'Bell': { with: [
    'Helicopter', 'JetRanger', 'Boeing', 'Venom', 'Textron', 'AH', 'UH', 'V', 'Huey', '206', '212', '214',
    '222', '230', '407', '412', '429', '430', '47', '505', '525', 'Osprey', 'Cobra', 'Kiowa', 'Airacobra'] },
  'Razor': { with: ['PowerWing', 'Scooter', 'E100', 'E200', 'E300', 'E Prime', 'Power Core'] },
  'da Vinci': { with: ['Surgical', 'Xi', 'Si', 'SP', 'Surgeon'] },
  'Palm': { with: ['Pilot', 'Treo', 'Tungsten', 'PDA', 'Zire', 'Z22'] },
  'Checker': { with: ['Cab', 'Marathon', 'Taxi', 'Motors'] },
  'Orion': { with: ['Safety', 'Flare', 'Flares', 'Signal', 'Transit', 'Glasses'] },
  'Corvette': { with: [
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'Stingray', 'Z06', 'ZR1', 'Grand Sport'] },
  'Amazon': { unless: [
    'Parrot', 'Piranha', 'River', 'Rainforest', 'Jungle', 'Basin', 'Warrior', 'Warriors', 'Woman', 'Lily',
    'Frog', 'Molly', 'Tree', 'Forest', 'Tribe', 'Indian'] },
  'HP': { with: [
    'Omen', 'EliteBook', 'ENVY', 'OfficeJet', 'DesignJet', 'Sprout', 'Laptop', 'Ink', 'Cartridge', 'Server',
    'Printer', 'Notebook', 'Pavilion', 'Spectre', 'LaserJet', 'DeskJet', 'Chromebook', 'ProBook', 'ZBook',
    'Monitor', 'Keyboard', 'Mouse', 'HDD', 'SSD', 'Bag', '652', 'Elite', 'Desktop', 'PC', 'Calculator'] },
  '3M': { with: [
    'Respirator', 'Respiratory', 'Peltor', 'Versaflo', 'Tekk', 'Speedglas', 'Temflex', 'VHB', 'Cogent', 'LED',
    'Tape', 'Mask', 'N95', 'Shield', 'Headset', 'Earmuffs', 'Hearing', 'Helmet', 'Glasses', 'Floppy', 'Scotch',
    'Littmann', 'Command', 'Post-it', 'Filter', 'Scanner', 'Stethoscope'] },
  'Bushmaster': { unless: ['Snake', 'Viper', 'Pit'] },
  'Piper': { with: [
    'PA', 'J', 'Cub', 'Aircraft', 'Airplane', 'Plane', 'Cherokee', 'Warrior', 'Seaplane', 'Monoplane',
    'Bonanza', 'Monocular', 'Telescope', 'Hangar', 'Archer', 'Seneca', 'Comanche', 'Malibu', 'Aztec', 'Navajo'] },
  'Pioneer': { with: [
    'DJ', 'CDJ', 'DJM', 'PLX', 'Mixer', 'Turntable', 'Receiver', 'Amplifier', 'Stereo', 'Speaker', 'Speakers',
    'Headphones', 'Player', 'Console', 'XDJ', 'DDJ'] },
  'Sprite': { with: [
    'Bottle', 'Bottles', 'Can', 'Cans', 'Canned', 'Refrigerator', 'Refrigerators', 'Fridge', 'Vending',
    'Package', 'Soda', 'Drink', 'Glass', 'Aluminum'] },
  'Blue Bird': { with: ['Bus', 'Vision', 'TX3', 'Commercial'] },
  'Corona': { with: ['Beer', 'Extra', 'Bottle', 'Bottles'] },
  'KAI': { with: ['T-50', 'FA-50', 'KF-21', 'Surion', 'Eagle', 'Jet'] },
  'Sawyer': { with: ['Robot', 'Pedestal', 'Edition', 'Cobot'] },
  'Black Diamond': { with: ['Carabiner', 'MiniWire', 'Trekking', 'Poles', 'Headlamp', 'Harness', 'Climbing'] },
  'Brother': { with: [
    'Sewing', 'Fax', 'Typewriter', 'Overlock', 'Serger', 'Printer', 'Label', 'Embroidery', 'Machine'] },
  'Pratt': { with: ['Whitney'] },
  'Strider': { with: ['Knife', 'SMF'] },
  'Hawker': { with: [
    'Hurricane', 'Hunter', 'Siddeley', 'Typhoon', 'Tempest', 'Fury', 'Harrier', 'Beechcraft'] },
  'Vogue': { with: ['Magazine', 'Magazines'] },
  'Nitro': { with: ['Z16', 'Staxx', 'Venom', 'Boat', 'Snowboard', 'Bindings', 'Crosman'] },
  'Cirrus': { with: ['Vision', 'SF50', 'SR22', 'SR20', 'Jet', 'Aircraft'] },
  'Colt': { with: [
    'Python', 'M1911', '1911', 'Revolver', 'Pistol', 'Peacemaker', 'Anaconda', 'Government', 'Rifle',
    'Carbine', 'M4', 'AR-15', 'Gun', 'Handgun'] },
  'Pivotal': { with: ['Helix', 'eVTOL', 'VTOL'] },
  'New Era': { with: ['Cap', 'Hat', '9FORTY', '9Twenty', '59FIFTY', 'Baseball'] },
  'ETC': { with: ['ColorSource', 'Source'] },
  'Uppercut': { with: ['Pomade', 'Deluxe'] },
  'Scotch': { with: ['Tape', 'Tapes', 'C60ST', 'Dispenser'] },
  'Tide': { with: ['Detergent', 'Washing', 'Pods', 'Powder', 'Laundry'] },
  'Ariel': { with: ['Detergent', 'Washing', 'Powder', 'Pods', 'Laundry'] },
  'CFM': { with: ['International', 'CFM56', 'LEAP'] },
  'Commodore': { with: ['Amiga', 'Monitor', 'Computer', '64', 'PET', 'C64'] },
  'EOS': { with: ['Lip', 'Balm', 'Moisturizer'] },
  'Trek': { with: ['Bike', 'Bicycle', 'Farley', 'Fat', 'Madone', 'Domane', 'Marlin'] },
  'Glade': { with: ['Freshener', 'Spray', 'Candle', 'PlugIns'] },
  'HAL': { with: ['Tejas', 'Dhruv', 'Rudra', 'Prachand', 'LCA', 'HJT'] },
  'Hoover': { with: ['Vacuum', 'Washing', 'Upright', 'Cleaner', 'Constellation', 'Machine'] },
  'Kookaburra': { with: ['Cricket', 'Ball', 'Bat', 'Wicket', 'Stumps'] },
  'Patron': { with: ['Tequila', 'Reposado', 'Cristalino', 'Anejo', 'Silver'] },
  'Quencher': { with: ['Tumbler', 'Stanley'] },
  'reMarkable': { with: ['Paper Pro', 'Tablet', 'Notepad', 'Stylus'] },
  'Singer': { with: ['Sewing', 'Sew'] },
  'Aerophone': { with: ['AE', 'Roland'] },
  'Automata': { with: ['EVA', 'Arm', 'Robot'] },
  'Axon': { with: ['Body', 'Camera', 'Taser'] },
  'Blunt': { with: ['Soundwave', 'Speaker'] },
  'Boon': { with: ['Glo'] },
  'BOSS': { with: [
    'BF', 'Flanger', 'Pedal', 'Products', 'Sealant', 'DAT', 'Chorus', 'Overdrive', 'Distortion', 'Looper',
    'Katana', 'Delay'] },
  'Craftsman': { with: ['Toolbox', 'Tool', 'Level', 'Chest', 'Wrench', 'Socket', 'Drill', 'Mower', 'Ratchet'] },
  'Esquire': { with: ['Magazine', 'Magazines'] },
  'WARN': { with: ['Winch', 'EVO10', 'EVO', 'VR'] },
  'FN': { with: [
    'P90', 'SCAR', 'FAL', 'Minimi', 'MAG', 'Five-seveN', 'Herstal', 'F2000', 'FNX', '509', 'M249'] },
  'Visa': { with: ['Card', 'Credit', 'Debit'] },
  'Iridium': { with: ['Satellite', 'Extreme', 'Phone'] },
  'NOW': { with: ['Dandelion', 'Spirulina', 'Foods', 'Supplement', 'Supplements', 'Capsules', 'Vitamin'] },
  'Taser': { with: ['X26', 'X2', 'X7', 'Pulse', 'Axon', 'Bolt'] },
  'Vigor': { with: ['Wrench', 'Ratchet', 'Impact'] },
  'VITA': { with: ['Shade', 'Shades', 'Guide'] },
  'Airhead': { with: ['Vest', 'Life'] },
  'AMD': { with: [
    'Graphics', 'Radeon', 'Ryzen', 'F1', 'CPU', 'Processor', 'GPU', 'Card', 'Threadripper', 'EPYC'] },
  'Backbone': { with: ['Controller', 'Gaming'] },
  'Brent': { with: ['Pottery', 'Wheel'] },
  'Chamberlain': { with: ['Garage', 'Remote', 'Opener'] },
  'Contender': { with: ['Boat', '39', 'Fishing'] },
  'DEFY': { with: ['Grappling', 'Dummy'] },
  'Urban Decay': { with: ['Naked', 'Eyeshadow', 'Palette', 'Brush', 'Makeup', 'Lipstick'] },
  'Kindle': { with: ['Oasis', 'Paperwhite', 'E-Reader', 'Reader', 'Amazon', 'Scribe'] },
  'Eureka': { with: ['Ergonomic', 'Desk', 'Vacuum'] },
  'Heil': { with: ['Microphone', 'Mic'] },
  'ICA': { with: ['Traffic', 'Ticket'] },
  'NBC': { with: ['News', 'Microphone', 'Mic'] },
  'Krone': { with: ['Silage', 'Forage', 'Wagon', 'Mower', 'Baler', 'Tractor', 'MX', 'BiG'] },
  'Lays': { with: ['Chips', 'Potato', 'Crisps'] },
  'Ledger': { with: ['Crypto', 'Nano', 'Wallet'] },
  'Nurture': { with: ['Fruity'] },
  'DEC': { with: ['PDP', 'VAX', 'VT100', 'Computer'] },
  'Pedigree': { with: ['Food', 'Canned', 'Dentastix', 'Treats'] },
  'Spam': { with: ['Canned', 'Can', 'Tin', 'Musubi'] },
  'Sunbeam': { with: ['Heating', 'Toaster', 'Mixer', 'Iron', 'Pad', 'Blender'] },
  'Zenith': { with: ['Radio', 'Watch', 'Trans-Oceanic', 'TV', 'Television'] },
  'Verbatim': { with: ['HDD', 'SSD', 'Disc', 'CD', 'DVD', 'USB', 'Fingerprint', 'Drive', 'Flash'] },
  'ANA': { with: ['Newme', 'Avatar', 'Airways', 'Boeing', 'Airbus', 'Airline'] },
  'Bounty': { with: ['Chocolate', 'Bar', 'Towel', 'Towels'] },
  'BP': { with: ['Gas', 'Pump', 'Petrol', 'Fuel', 'Station'] },
  'Bulwark': { with: ['FR', 'iQ', 'Pant', 'Shirt'] },
  'Carnation': { with: ['Money', 'Counter', 'CR7', 'Milk', 'Evaporated'] },
  'Divvy': { with: ['Bike', 'Bicycle'] },
  'DMM': { with: ['Swivel', 'Carabiner', 'Climbing', 'Belay'] },
  'Elo': { with: ['PayPoint', 'Touch', 'POS'] },
  'ETA': { with: ['Quartz', 'Movement', 'Caliber'] },
  'GPO': { with: ['Retro', 'Boombox', 'Record', 'Turntable', 'Radio'] },
  'Hardy': { with: ['Reel', 'Fishing', 'Rod'] },
  'Keeler': { with: ['Slit', 'Lamp', 'Ophthalmoscope', 'Tonometer'] },
  'KEEN': { with: ['Boots', 'Boot', 'Shoes', 'Sandals', 'Footwear'] },
  'Keystone': { with: ['RV', 'Trailer', 'Camper', 'Montana', 'Cougar'] },
  'NOV': { with: ['TDX', 'Drilling'] },
  'NYX': { with: ['Palette', 'Shadow', 'Lipstick', 'Cosmetics', 'Makeup', 'Eyeshadow'] },
  'OTO': { with: ['Melara'] },
  'Physio': { with: ['Control', 'Lifepak'] },
  'YETI': { with: ['Roadie', 'Tundra', 'Rambler', 'Cooler', 'Hopper', 'Tumbler'] },
  'Stamina': { with: ['Airgometer', 'Bike', 'Exercise', 'Rower', 'Treadmill'] },
  'Starboard': { with: ['SUP', 'Paddle', 'Allstar', 'Windsurf'] },
  'Underwood': { with: ['Typewriter'] },
  'Vans': { with: ['Sneakers', 'Slip-On', 'Sk8', 'Sk8-Hi', 'Shoes', 'Old Skool', 'Authentic', 'Era'] },
  'Harbin': { with: ['Z', 'Helicopter', 'Haitun', 'Y-12', 'Y'] },
  'Toro': { with: ['Blower', 'Mower', 'Groundsmaster', 'Snowblower', 'TimeCutter', 'Recycler', 'Trimmer'] },
  'Stanley': { with: [
    'Hammer', 'FatMax', 'Level', 'Vacuum', 'Bottle', 'Flask', 'Thermos', 'Mug', 'Mugs', 'Scraper', 'Brace',
    'Knife', 'Tape', 'Tool', 'Tools', 'Quencher', 'Tumbler', 'Powerlock', 'Claw', 'Termos', 'Toolbox',
    'Screwdriver', 'Chisel', 'Plane', 'Utility', 'Food Jar', 'Jar', 'Cooler', 'Lunch', 'Roller'] },
  'Hobart': { with: ['Dishwasher', 'Welder', 'Welding', 'AM900', 'Mixer', 'MIG'] },
  'Hamilton': { with: [
    'Beach', 'Watch', 'PSR', 'Pulsar', 'Khaki', 'Needle', 'C1', 'Ventilation', 'Ventilator', 'Hub'] },
  'Polaris': { with: [
    'ATV', 'MV85', 'DAGOR', 'Slingshot', 'Snowmobile', 'Sled', 'Compressor', 'RZR', 'Ranger', 'Sportsman',
    'Trike', 'FS'] },
  'Marshall': { with: [
    'Amplifier', 'Amp', 'Speaker', 'Acton', 'Stanmore', 'Woburn', 'Headphones', 'Audio', 'Cabinet', 'Guitar',
    'MS2', 'Emberton', 'Kilburn'] },
  'Yale': { with: ['Pallet', 'Forklift', 'Reach', 'Lock', 'Assure', 'Key', 'Truck', 'Jack'] },
  'Cairns': { with: ['Helmet', 'Fire'] },
  'Jordan': { with: ['Air', 'Socks', 'Basketball', 'Shoes', 'Sneakers', 'Retro', 'Cleats'] },
  'Alexa': { with: ['Amazon', 'Mini', 'ARRI', 'Voice', 'Echo', 'LF'] },
  'Beats': { with: [
    'Flex', 'Pill', 'Studio', 'Solo', 'Monster', 'Dre', 'Headphones', 'Earphones', 'Earbuds', 'Speaker', 'Fit'] },
  'Kratos': { with: ['XQ-58', 'GDS-01', 'Valkyrie', 'UAV', 'Drone', 'Defense'] },
  'Kepler': { with: ['Robot', 'Humanoid'] },
  'Robinson': { with: ['R22', 'R44', 'R66', 'R88', 'R', 'Helicopter', 'Rotorcraft'] },
  'Ural': { with: [
    'M70', '4320', 'Truck', 'Motorcycle', 'Motorbike', 'Motorcycles', 'Sidecar', 'Cradle', 'Gear Up', '375',
    '43206', 'Next', 'Typhoon'] },
  'Ferguson': { with: ['Tractor', 'TE20', '698', 'Massey'] },
  'Xian': { with: ['H-6', 'Y20', 'Y-20', 'Bomber', 'Aircraft', 'JH-7', 'MA60'] },
  'Shaanxi': { with: ['KJ-500', 'Y', 'Y-8', 'Y-9', 'Aircraft'] },
  'Shenyang': { with: ['FC', 'J', 'Fighter'] },
  'Nabi': { with: ['Bus', '416'] },
  'Kinder': { with: ['Surprise', 'Surprises', 'Egg', 'Eggs', 'Bueno', 'Joy', 'Chocolate'] },
  'Columbia': { with: ['Jacket', 'Hat', 'Sportswear', 'Boots', 'Fleece', 'Shoes', 'Parka'] },
  'FIGS': { with: ['Scrub', 'Scrubs'] },
  'Emirates': { with: ['Airline', 'Airlines', 'Check', 'Airbus', 'Boeing', 'A380'] },
  'Fuji': { with: ['Camera', 'X-T2', 'X', 'Fujifilm', 'Instax', 'Film'] },
  'Kent': { with: ['Comb', 'Atwater', 'Brush'] },
  'IRWIN': { with: ['Strait', 'Chalk', 'Naturals', 'Vise', 'Clamp', 'Tools', 'Drill', 'Quick-Grip'] },
  'New Yorker': { with: ['Magazine', 'Magazines'] },
  'Four Seasons': { with: ['Hotel', 'Bahrain', 'Resort'] },
  'Code 3': { with: ['Lightbar', 'mx7000', 'Lightning', 'Light', 'Police'] },
  'Ace of Spades': { with: ['Champagne', 'Brignac', 'Wine', 'Bottle', 'Bottles'] },
  'Brunswick': { with: ['Pool', 'Billiard', 'Billiards', 'Cue', 'Bowling'] },
  'American Standard': { with: ['Urinal', 'Toilet', 'Sink', 'Faucet', 'Bathtub', 'Lavatory'] },
  'Iberia': { with: ['Cargo', 'ULD', 'AKE', 'Airline', 'Airlines', 'Container'] },
  'Kittyhawk': { with: ['Taxi'] },
  'Kryptonite': { with: ['Lock', 'U-Lock', 'Bicycle'] },
  'Hyperion': { with: ['XP-1', 'Hypercar', 'Supercar'] },
  'Loona': { with: ['Petbot', 'Robot'] },
  'Cassie': { with: ['Robot'] },
  'Elektra': { with: ['Espresso', 'Coffee', 'Casa', 'Epoque'] },
  'Taurus': { with: ['KEPD', 'Missile', 'Wash'] },
  'Olympus': { with: ['OM-D', 'OM', 'BX51M', 'Microscope', 'Camera', 'Pen', 'Tough', 'E-M10', 'Zuiko'] },
  'Tiffany': { with: ['Watch', 'Pocket', 'Co', 'Ring', 'Necklace', 'Bracelet', 'Jewelry'] },
  'Hayabusa': { with: ['Boxing', 'Gloves', 'T3'] },
  'Williamsburg': { with: ['Paint', 'Paints', 'Oil'] },
  'Kalamazoo': { with: ['Handcar', 'Railway'] },
  'Fogo': { with: ['Charcoal'] },
  'Imperia': { with: ['Pasta'] },
  'Harris': { with: ['Falcon', 'T7', 'Radio', 'PTT', 'Microphone'] },
  'Kingston': { with: ['HyperX', 'SDRAM', 'DDR4', 'DDR3', 'DDR5', 'RAM', 'SSD', 'USB', 'Memory', 'Flash'] },
  'Armstrong': { with: ['Acoustical', 'Ceiling', 'Panel', 'Flooring', 'Tile'] },
  'Allison': { with: ['Transmission', '4000', '3000'] },
  'Blackstone': { with: ['Griddle', 'Grill', 'Fryer', 'Smoker'] },
  'Wilson': { with: [
    'Football', 'Baseball', 'Volleyball', 'Tennis', 'Basketball', 'Ball', 'Racket', 'Golf', 'A1217'] },
  'Nikola': { with: ['One', 'Tre', 'Two', 'Truck', 'Semi'] },
  'Murray': { with: ['Pedal', 'Roadster', 'Mower', 'Bicycle', 'Bike'] },
  'Gilbert': { with: ['Rugby'] },
  'Winston': { with: ['Cigarette', 'Cigarettes'] },
  'Torc': { with: ['Helmet', 'T50', 'Route'] },
  'Easton': { with: ['Baseball', 'Batting', 'Catcher', 'Helmet', 'Bat', 'Softball'] },
  'Flexi': { with: ['Leash', 'Retractable', 'Bouncy'] },
  'Vittoria': { with: ['Barzo', 'Tire', 'Tires', 'Tyre'] },
  'Leland': { with: ['CO2', 'Tap'] },
  'Big Joe': { with: ['Bean', 'Bag', 'Chair', 'Sack'] },
  'Johnston': { with: ['Sweeper', 'CN101', 'CX400'] },
  'Ruffles': { with: ['Chips', 'Cheddar'] },
  'Boosted': { with: ['Board', 'Skateboard', 'Dual'] },
  'Donner': { with: ['Harp', 'DLH', 'Music', 'Guitar', 'Keyboard', 'Drum'] },
  'Godiva': { with: ['Chocolate', 'Chocolates', 'Candies', 'Candy'] },
  'Tivoli': { with: ['Audio', 'Radio', 'PAL'] },
  'Magellan': { with: ['GPS', 'RoadMate', 'Explorist', 'Navigator'] },
  'Enki': { with: ['Razer', 'Chair'] },
  'Aurelia': { with: ['Drone', 'X6', 'X8', 'Hexacopter'] },
  'Eero': { with: ['Wi-Fi', 'Mesh', 'Router', 'Amazon'] },
  'Yokohama': { with: ['Tire', 'Tyre', 'Tires', 'Wheel'] },
  'Yamaguchi': { with: ['Massager', 'Massage', 'Chair'] },
  'Jumeirah': { with: ['Hotel'] },
  'Sherwood': { with: ['Hockey'] },
  'Cotswold': { with: ['Boots'] },
  'Volta': { with: ['Charging', 'Charger'] },
  'Kensington': { with: ['Thunderbolt', 'Docking', 'Dock', 'Lock', 'Mouse', 'Trackball', 'Keyboard'] },
  'Norton': { with: ['Core', 'Antivirus', 'Router', 'Commando', 'Motorcycle'] },
  'Dayton': { with: ['Blower', 'Motor', 'Heater', 'Fan'] },
  'Wabash': { with: ['Caboose', 'Trailer', 'Railroad', 'Railway'] },
  'Weber': { with: ['Grill', 'Kettle', 'Chimney', 'Starter', 'Barbecue', 'BBQ', 'Genesis'] },
  'Roche': { with: ['Cobas', 'Urisys', 'Accu-Chek', 'Analyzer'] },
  'Schneider': { with: ['Electric', 'Electrical', 'Enclosure', 'Breaker'] },
  'Rockwell': { with: ['B-1', 'B', 'Lancer', 'Automation', 'International', 'Bomber'] },
  'Ryan': { with: ['Firebee', 'BQM'] },
  'Cameron': { with: ['BOP', 'Blowout', 'Annular'] },
  'Gregory': { with: ['Paragon', 'Backpack', 'Pack'] },
  'Sanford': { with: ['Pencils', 'Pencil', 'Marker'] },
  'Mueller': { with: ['Hand Blender', 'Immersion', 'Austria', 'Mixer', 'Frother'] },
  'Apec': { with: ['Water', 'Filtration', 'Filter'] },
  'Rheinische': { with: ['Post'] },
  'Kiva': { with: ['Robot', 'Warehouse'] },
  'Kuri': { with: ['Robot'] },
  'Primus': { with: ['Stove', 'Kerosene', 'Burner', 'Lantern'] },
  'TOTO': { with: ['Toilet', 'Neorest', 'Washlet', 'Bidet'] },
  'Damen': { with: ['Ferry', 'Barge', 'Pontoon', 'Shipyards', 'Tug', 'RoPax', 'Stan'] },
  'Duffy': { with: ['Boat', 'Electric'] },
  'Tropicana': { with: ['Boxcar', 'Juice', 'Refrigerated', 'Orange'] },
  'Saphir': { with: ['Medaille', 'Polish', 'Shoe'] },
  'Stroh': { with: ['Rum'] },
  'Kustom': { with: ['ProLaser', 'Signals', 'LIDAR', 'Radar'] },
  'Contigo': { with: ['Mug', 'Bottle', 'Tumbler', 'Autoseal'] },
  'Emperador': { with: ['Brandy'] },
  'Barco': { with: ['Projector', 'Display', 'ClickShare'] },
  'American Security': { with: ['Safe', 'ESL10', 'ESL'] },
  'Belleville': { with: ['795', 'Boots', 'Boot'] },
  'Kasa': { with: ['Smart', 'Plug', 'Outdoor', 'Camera'] },
  'Hardin': { with: ['Honey', 'Extractor'] },
};

// Готовые проверки: многословные - по фразе, односложные - по целому слову.
const word = s => {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
  return new RegExp('(^|[^A-Za-z0-9])' + esc + '($|[^A-Za-z0-9])', 'i');
};
const RES = [...BRANDS, ...BRANDS_FAB].map(b => ({ brand: b, re: word(b) }));
const AMB = Object.entries(AMBIGUOUS).map(([b, r]) => ({
  brand: b, re: word(b), with: r.with ? r.with.map(word) : null, unless: (r.unless || []).map(word),
}));

/*
 * Отдельные модели, марку которых нельзя опознать общим правилом.
 * «Bell» и «Ring» - настоящие марки (вертолёты Bell, звонки Ring от Amazon), но
 * оба слова слишком общие: списком они поймали бы «Church Bell», «Boxing Ring»,
 * «Ring Set» и сотни других. Здесь их ровно два, и они названы поимённо.
 * Живые страницы у обеих уже стоят с лицензией Editorial - убирать ограничение
 * на основании того, что наш список неполон, нельзя.
 */
const BRAND_BY_ID = {
  '1196786': 'Bell',   // Bell 412 Fire Department Helicopter
  '2478366': 'Ring',   // Ring Smart Video Doorbell
};

/** Марка по номеру модели, если общее правило её не находит. */
export const brandById = id => BRAND_BY_ID[String(id)] || null;

/** Какая марка нашлась в названии, или null. */
export function brandOf(name) {
  const n = ' ' + String(name) + ' ';
  for (const { brand, re } of RES) if (re.test(n)) return brand;
  for (const a of AMB) {
    if (!a.re.test(n)) continue;
    if (a.with && !a.with.some(w => w.test(n))) continue;
    if (a.unless.some(w => w.test(n))) continue;
    return a.brand;
  }
  return null;
}
