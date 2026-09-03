/*
 * check-group-sanity.mjs - нет ли в группах склейки посторонних предметов.
 *
 * ЗАЧЕМ. Проход «корень+категория» собирает варианты по общему корню публикации
 * и совпадению категории. Этого мало: в группу «Container Ship Generic» попал
 * «Volkswagen Golf GTI 2025» - у них общий корень и обе вещи в одной категории,
 * но контейнеровоз и хэтчбек не варианты друг друга.
 *
 * Здесь проверяется простое и надёжное: у вариантов ОДНОЙ вещи в названиях
 * почти всегда есть общее значимое слово. «Triton» и «Triton Rigged» - есть.
 * «Container Ship» и «Golf GTI» - нет ни одного.
 *
 * Вход: вывод `merge-variants.mjs --dry --list rootcat N`, где группы идут
 * блоками «[N] Имя главной» и строками «  $цена  Имя варианта».
 *
 * Ничего не пишет.
 *
 * Запуск:  node scripts/check-group-sanity.mjs .tmp/rootcat-groups.txt
 */
import fs from 'node:fs';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.log('нужен файл с выводом --list'); process.exit(1); }

// Слова, которые есть у всех подряд и потому ничего не различают.
const STOP = new Set(['3d', 'model', 'models', 'with', 'and', 'for', 'the', 'set', 'new', 'old',
  'rigged', 'animated', 'simplified', 'simple', 'game', 'ready', 'fur', 'pose', 'posed',
  'black', 'white', 'grey', 'gray', 'silver', 'red', 'blue', 'green', 'yellow', 'orange',
  'gold', 'brown', 'camo', 'camouflage', 'olive', 'beige', 'pink', 'purple', 'maroon',
  'generic', 'collection', 'sand', 'khaki', 'maya', 'cinema', 'blender', 'max']);
const words = s => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/)
  .filter(w => w.length > 2 && !STOP.has(w)));

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const groups = [];
let cur = null;
for (const l of lines) {
  const head = l.match(/^\[(\d+)\]\s+(.+)$/);
  if (head) { cur = { main: head[2].trim(), items: [] }; groups.push(cur); continue; }
  const item = l.match(/^\s+\$\d+\s+(.+)$/);
  if (item && cur) cur.items.push(item[1].trim());
}

let bad = 0, ok = 0, outliers = 0;
const show = [];
for (const g of groups) {
  if (!g.items.length) continue;
  // Основа группы - слова, общие хотя бы для половины участников.
  const freq = new Map();
  for (const it of g.items) for (const w of words(it)) freq.set(w, (freq.get(w) || 0) + 1);
  const core = new Set([...freq].filter(([, n]) => n >= Math.ceil(g.items.length / 2)).map(([w]) => w));
  const strays = g.items.filter(it => {
    const w = words(it);
    for (const c of core) if (w.has(c)) return false;
    return true;
  });
  if (!strays.length) { ok++; continue; }
  bad++; outliers += strays.length;
  if (show.length < 8) show.push('«' + g.main.slice(0, 40) + '»  <-  ' + strays.slice(0, 3).map(s => '«' + s.slice(0, 34) + '»').join(', '));
}

console.log('групп разобрано: ' + groups.length);
console.log('  чистых: ' + ok + ', с посторонними: ' + bad
  + ' (' + (groups.length ? Math.round(bad / groups.length * 100) : 0) + '%)');
console.log('  посторонних карточек всего: ' + outliers);
console.log('\nчто попало бы в чужую семью:');
show.forEach(x => console.log('   ' + x));
process.exit(bad ? 1 : 0);
