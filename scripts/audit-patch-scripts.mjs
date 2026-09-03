/*
 * audit-patch-scripts.mjs - какие скрипты стали лишними после пересборки.
 *
 * ЗАЧЕМ. Пятый пункт плана основателя: «после этого 70 скриптов-заплаток
 * удаляются». Заплатка - это скрипт, который правит УЖЕ ГОТОВЫЕ страницы
 * регулярками. Пока страницу собирали вразнобой, они были нужны; теперь
 * страница собирается из записи, и правка, которую они вносят, либо уже
 * внутри генератора, либо откатится при первой же пересборке.
 *
 * Удалять по списку из головы нельзя. Скрипт делит их на три кучи по
 * признакам, которые видно в коде:
 *   ЗАПЛАТКА   - читает models/<slug>/index.html и пишет его обратно;
 *   ИСТОЧНИК   - собирает данные или страницы с нуля, нужен и дальше;
 *   ПРОВЕРКА   - ничего не пишет.
 *
 * И отдельно: на кого ещё ссылаются из других скриптов и из рабочих потоков
 * (.github/workflows). На такие не замахиваемся без разбора.
 *
 * Ничего не удаляет и ничего не пишет - только показывает.
 *
 * Запуск:  node scripts/audit-patch-scripts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DIR = path.join(ROOT, 'scripts');

// Ядро пересборки - его не трогаем ни при каких признаках.
const CORE = new Set([
  'build-model-records.mjs', 'render-card.mjs', 'card-content.mjs',
  'build-related.mjs', 'apply-rebuild.mjs', 'compare-rebuild.mjs',
  'validate-records.mjs', 'validate-data.mjs', 'audit-site.mjs',
  'check-render-health.mjs', 'check-schema.mjs', 'check-capture-roundtrip.mjs',
  'check-css-classes.mjs', 'check-internal-links.mjs', 'check-cert-change.mjs',
  'extract-display-names.mjs', 'extract-gallery.mjs', 'preview-rebuild.mjs',
  'merge-variants.mjs', 'build-homepage.mjs', 'build-browse-index.mjs',
  'build-category-hubs.mjs', 'refresh-sitemaps.mjs', 'build-model-sitemaps.mjs',
  'build-image-sitemaps.mjs', 'import-product-report.mjs',
  'import-studio-inventory.mjs', 'receive-studio-batch.mjs',
  'audit-patch-scripts.mjs', 'catch-batch.mjs', 'build-redirect-stubs.mjs',
]);

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.mjs'));
const body = new Map(files.map(f => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]));

/*
 * Ссылки бывают двух родов, и путать их нельзя.
 *   ВВОЗ    - `import ... from './X.mjs'`: удалишь X - другой скрипт сломается.
 *   УПОМИНАНИЕ - имя в комментарии: «правило жило в fix-formats-tags.mjs».
 * Первая версия считала одинаково и записала в занятые половину списка,
 * хотя это были мои же пояснения, откуда взялось правило.
 */
const refs = new Map(files.map(f => [f, new Set()]));
const mentions = new Map(files.map(f => [f, new Set()]));
for (const [f, src] of body) {
  // Строки кода без комментариев - только в них ищем настоящий ввоз.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const other of files) {
    if (other === f) continue;
    if (new RegExp("(from|import)\\s*\\(?\\s*['\"][^'\"]*" + other.replace('.', '\\.') + "['\"]").test(code)) {
      refs.get(other).add(f);
    } else if (src.includes(other)) {
      mentions.get(other).add(f);
    }
  }
}
const wf = path.join(ROOT, '.github', 'workflows');
if (fs.existsSync(wf)) {
  for (const w of fs.readdirSync(wf)) {
    const src = fs.readFileSync(path.join(wf, w), 'utf8');
    for (const f of files) if (src.includes(f)) refs.get(f).add('workflow:' + w);
  }
}

const groups = { заплатка: [], источник: [], проверка: [], ядро: [] };
for (const [f, src] of body) {
  if (CORE.has(f)) { groups['ядро'].push(f); continue; }
  const writes = /writeFileSync/.test(src);
  /*
   * Заплатка правит КАРТОЧКИ МОДЕЛЕЙ на месте: читает models/<slug>/index.html
   * и пишет туда же. Ключевое - обход папки models, а не просто упоминание.
   *
   * Сборщики отдельных страниц (страница вопросов, лицензия, коллекции,
   * подкатегории) тоже пишут файлы и тоже используют replace, но карточки не
   * трогают - они собирают СВОЮ страницу с нуля. Первая версия записала их в
   * заплатки, и по такому списку я снёс бы работающие части сайта.
   */
  const walksCards = /readdirSync\(\s*MODELS|readdirSync\(\s*['"]models|MODELS,\s*\w+,\s*['"]index\.html/.test(src);
  if (!writes) groups['проверка'].push(f);
  else if (walksCards && /\.replace\(/.test(src)) groups['заплатка'].push(f);
  else groups['источник'].push(f);
}

const show = (name, list) => {
  console.log('\n=== ' + name.toUpperCase() + ': ' + list.length + ' ===');
  for (const f of list.sort()) {
    const r = [...refs.get(f)];
    console.log('  ' + f.padEnd(40) + (r.length ? '  <- ' + r.join(', ') : ''));
  }
};

console.log('всего .mjs в scripts: ' + files.length);
show('заплатка - правит готовые страницы', groups['заплатка']);
show('источник - собирает данные или страницы', groups['источник']);
show('проверка - ничего не пишет', groups['проверка']);
console.log('\n=== ЯДРО (не трогаем): ' + groups['ядро'].length + ' ===');

const busy = groups['заплатка'].filter(f => refs.get(f).size);
console.log('\nиз заплаток на кого-то ссылаются: ' + busy.length
  + (busy.length ? ' -> ' + busy.join(', ') : ''));
