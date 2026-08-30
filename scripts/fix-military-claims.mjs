/*
 * fix-military-claims.mjs - боевые сценарии только военным моделям (пункт 6).
 *
 * ЧТО БЫЛО. Заготовка текста для категории Aircraft писала одно и то же всем
 * самолётам: «It works for aerospace visualisation, flight and combat
 * simulation, war-game environments and aviation sequences in film and TV».
 * На Air France Airbus A380 и Airbus A319 Air France это выглядит нелепо:
 * пассажирский лайнер предлагается для боевой симуляции и военных игр. Ты
 * верно заметил - это шаблон, взятый от всей категории.
 *
 * РАСКЛАД. Из 1 495 моделей в Aircraft явные военные признаки только у 474.
 * Остальные 1 021 - гражданские или неопределённые, и всем им доставался
 * боевой текст.
 *
 * ПРАВИЛО. Боевые формулировки разрешены только при явном военном признаке в
 * названии (см. lib/military.mjs). Нет признака - модель считается
 * гражданской. Осторожность именно в эту сторону: назвать истребитель
 * гражданским - потерять точность, назвать лайнер боевым - сказать неправду.
 *
 * Генератор card-content.mjs исправлен там же, иначе перегенерация вернула бы
 * прежний текст.
 *
 * Запуск:  node scripts/fix-military-claims.mjs --dry
 *          node scripts/fix-military-claims.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { isMilitary } from './lib/military.mjs';
import { loadModelCategories } from './lib/taxonomy.mjs';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const DRY = process.argv.includes('--dry');
const slugify = s => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const MIL_SENT = 'It works for aerospace visualisation, flight and combat simulation, war-game environments and aviation sequences in film and TV.';
const CIV_SENT = 'It works for airline and airport visualisation, flight simulation, aviation sequences in film and TV, advertising renders and VR training.';
const MV_SENT = 'It suits battlefield simulation, war-game environments, defence training material and military VFX shots.';
// То же предложение встречается и в американском написании - после правки
// visualisation -> visualization, - и в мета-описании без точки в конце.
const variants = s => [s, s.replace(/visualisation/g, 'visualization')];

const modelCat = loadModelCategories();
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-index.json'), 'utf8'));
const all = [];
for (let k = 0; k < idx.chunks; k++) {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fc-chunk-' + k + '.json'), 'utf8'));
  for (let j = 0; j < c.i.length; j++) {
    all.push({ id: String(c.i[j]), name: c.n[j], dir: slugify(c.n[j]) + '-' + c.i[j] });
  }
}

let live = 0, changed = 0, toCiv = 0, mil = 0, other = 0;
for (const m of all) {
  const cat = modelCat[m.id] || 'other';
  const file = path.join(MODELS, m.dir, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  if (cat !== 'aircraft') { other++; continue; }
  // Проверяем И название из каталога, И заголовок страницы: у части карточек
  // они расходятся, и по одному только каталогу «Boeing B52 Stratofortress»
  // проходил мимо проверки.
  const h1 = (h.match(/<h1[^>]*>([^<]*)/) || [, ''])[1];
  if (isMilitary(m.name, cat) || isMilitary(h1, cat)) { mil++; continue; }

  const before = h;
  // Отдельный случай: на гражданский самолёт попала заготовка от военной
  // техники. Так вышло у Lockheed L1011 Stargazer - это переоборудованный
  // лайнер-носитель ракеты, а текст обещал «battlefield simulation» и
  // «defence training material».
  for (const from of variants(MV_SENT)) {
    if (h.includes(from)) h = h.split(from).join(from.includes('visualization') ? CIV_SENT.replace(/visualisation/g, 'visualization') : CIV_SENT);
  }
  for (const from of variants(MIL_SENT)) {
    if (!h.includes(from)) continue;
    const to = from.includes('visualization')
      ? CIV_SENT.replace(/visualisation/g, 'visualization') : CIV_SENT;
    h = h.split(from).join(to);
  }
  if (h === before) continue;
  changed++; toCiv++;
  if (!DRY) fs.writeFileSync(file, h);
}

console.log('живых карточек: ' + live + ', вне категории Aircraft: ' + other);
console.log('самолётов с военным признаком (текст не тронут): ' + mil);
console.log('гражданских самолётов, где убраны боевые сценарии: ' + toCiv);
if (DRY) console.log('(--dry, ничего не записано)');
