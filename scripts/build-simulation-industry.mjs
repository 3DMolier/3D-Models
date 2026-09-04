/*
 * build-simulation-industry.mjs - страница /industries/simulation/.
 *
 * ЗАЧЕМ. На страницах категорий в блоке «Used in Industries» пункт Simulation
 * вёл в /catalog/ - то есть в общий каталог, а не в отраслевую страницу, как
 * все остальные одиннадцать пунктов. Человек, пришедший за моделями для
 * симуляторов, получал ленту из 54 тысяч моделей вперемешку.
 *
 * КАК СДЕЛАНО. Страница собирается из живой отраслевой страницы как из образца:
 * так шапка, подвал, версии стилей и разметка гарантированно совпадают с
 * остальными одиннадцатью. Меняются только тексты, список категорий и адреса.
 *
 * Блок Top 3D Models заполняет scripts/fix-industry-top-models.mjs - там же
 * лежит список допустимых категорий для каждой отрасли.
 *
 * Запуск:  node scripts/build-simulation-industry.mjs --dry
 *          node scripts/build-simulation-industry.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, nameOf, escName } from './lib/taxonomy.mjs';

import { ROOT } from './lib/paths.mjs';
const SRC = path.join(ROOT, 'industries', 'aerospace', 'index.html');
const DIR = path.join(ROOT, 'industries', 'simulation');
const OUT = path.join(DIR, 'index.html');
const DRY = process.argv.includes('--dry');
const BASE = 'https://3dmolierstudio.com';

const SLUG = 'simulation';
const NAME = 'Simulation';
const TITLE = 'Simulation 3D Models - Training, Defense &amp; Engineering | 3D Molier';
const DESC = 'Production-ready 3D models for simulation: flight and driving trainers, defense '
  + 'and medical simulators, industrial digital twins. Real-world scale, clean topology, '
  + 'all popular formats.';
const H1 = 'Simulation 3D Models';
const LEAD = 'Models used in training simulators and digital twins: aircraft and vehicles for '
  + 'flight and driving trainers, military hardware for defense simulation, anatomy and equipment '
  + 'for medical training, plant and machinery for industrial simulation. Real-world scale matters '
  + 'here more than anywhere else, and every model on this site is built to it.';

// Категории, которые действительно используются в симуляции.
const CATS = ['aircraft', 'vehicles', 'military-vehicles', 'ships', 'medical-3d-models',
  'industrial-equipment', 'architecture-landmarks'];

const USE_CASES = [
  ['Flight and driving trainers', 'Cockpits, airframes and road vehicles with correct proportions for procedure training.'],
  ['Defense simulation', 'Military vehicles, aircraft and hardware for wargaming and mission rehearsal.'],
  ['Medical training', 'Anatomy, instruments and clinical equipment for procedure simulators.'],
  ['Industrial digital twins', 'Machinery, plant equipment and infrastructure for process modelling.'],
];

/*
 * Короткий список «Common Use Cases» в левой колонке. Раньше он целиком
 * доставался от страницы-образца Aerospace, и генератор его не трогал: рядом с
 * «Flight simulation training» стояли «Commercial advertising», «Feature film
 * VFX» и «Museum exhibits». Эти три отвечают на другой запрос - человек,
 * который ищет simulation 3D models, приходит не за рекламой и не за музеем.
 * Заменены на формулировки, под которые страницу и должны находить, и подобраны
 * под её же подборку моделей: Tesla и Ford Transit - вождение, Skull и Anatomy -
 * медицина, UH-60 и Airbus - авиация и оборона.
 */
const UC_LIST = [
  'Flight simulation training',
  'Driving simulators',
  'Digital twin development',
  'Defense training simulation',
  'Medical procedure simulation',
  'Industrial operator training',
  'Emergency response simulation',
];

let src = fs.readFileSync(SRC, 'utf8');

// ── тексты ──
let h = src;
h = h.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + TITLE + '</title>');
for (const re of [/(<meta name="description" content=")[^"]*(")/, /(<meta property="og:description" content=")[^"]*(")/, /(<meta name="twitter:description" content=")[^"]*(")/]) {
  if (re.test(h)) h = h.replace(re, (x, a, b) => a + DESC + b);
}
for (const re of [/(<meta property="og:title" content=")[^"]*(")/, /(<meta name="twitter:title" content=")[^"]*(")/]) {
  if (re.test(h)) h = h.replace(re, (x, a, b) => a + TITLE + b);
}
h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, (x, a, b) => a + BASE + '/industries/' + SLUG + '/' + b);
for (const re of [/(<meta property="og:url" content=")[^"]*(")/]) {
  if (re.test(h)) h = h.replace(re, (x, a, b) => a + BASE + '/industries/' + SLUG + '/' + b);
}
h = h.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/, (x, a, b) => a + H1 + b);

// Вводный абзац образца заменяем целиком: он про аэрокосмос.
h = h.replace(/(<h1[^>]*>[\s\S]*?<\/h1>\s*)<p[^>]*>[\s\S]*?<\/p>/, (x, head) => head + '<p class="ind-lead">' + LEAD + '</p>');

// ── список категорий ──
const catLinks = CATS.map(s => '<a href="/categories/' + s + '/" class="ind-cat-link">'
  + escName(nameOf(s)) + '</a>\n<br>\n').join('');
h = h.replace(/(<div class="ind-cat-list">)[\s\S]*?(<\/div>)/, (x, a, b) => a + '\n' + catLinks + b);

// ── случаи применения ──
const cards = USE_CASES.map(([t, d]) =>
  '<div class="ind-use-card"><div class="ind-use-title">' + t + '</div>'
  + '<p class="ind-use-text">' + d + '</p></div>').join('');
h = h.replace(/(<div class="ind-use-grid">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/, (x, a, b) => a + cards + b);

// ── короткий список слева ──
const ucItems = UC_LIST.map(t => '<li class="ind-uc-item">' + t + '</li>').join('\n');
h = h.replace(/(<ul class="ind-uc-list">)[\s\S]*?(<\/ul>)/, (x, a, b) => a + '\n' + ucItems + '\n' + b);

// ── заголовок блока моделей и хлебные крошки ──
h = h.replace(/Top 3D Models for [^<]*/, 'Top 3D Models for ' + NAME);
h = h.replace(/(<span class="[^"]*bc-current[^"]*">)[^<]*(<\/span>)/, (x, a, b) => a + NAME + b);
// Разметка хлебных крошек и остальные упоминания отрасли.
h = h.replace(/Aerospace/g, NAME);
h = h.replace(/aerospace/g, SLUG);

if (!DRY) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(OUT, h);
}
console.log('страница ' + (DRY ? 'собрана вхолостую' : 'записана') + ': ' + OUT);
console.log('  категорий в блоке: ' + CATS.length + ', случаев применения: ' + USE_CASES.length);
console.log('  размер: ' + Math.round(h.length / 1024) + ' КБ');
console.log('\nдальше: node scripts/fix-industry-top-models.mjs   (заполнит Top 3D Models)');
