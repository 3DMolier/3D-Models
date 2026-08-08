// compress-pages.mjs — уменьшение объёма страниц без изменения содержимого.
//
// Зачем: 06.08.2026 публикация на GitHub Pages упала с «Timeout reached, aborting!»
// через 608 секунд. У Pages лимит 10 минут на выкладку, и сайт (3.33 ГБ, 87 тысяч
// файлов) перестал в него укладываться после наращивания контента карточек.
//
// Что делаем, обе правки безопасны и содержимое не трогают:
//   1. Убираем data-fallback, если он ДОСЛОВНО равен src. Такой атрибут бесполезен:
//      обработчик ошибки повторяет ту же самую ссылку, которая уже не загрузилась.
//   2. Схлопываем отступы и переносы между тегами.
//
// Экономия по замеру: 11%, около 314 МБ.
//
// ВАЖНО: публикация Pages всегда выкладывает сайт ЦЕЛИКОМ, дробление на части
// её не ускоряет. Части нужны только чтобы коммиты и пуши шли посильными кусками.
//
// Запуск:  node scripts/compress-pages.mjs --dry            вся выборка, без записи
//          node scripts/compress-pages.mjs --chunk a-f      только models/[a-f]*
//          node scripts/compress-pages.mjs --chunk pages    всё кроме models/

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DRY = process.argv.includes('--dry');
const ci = process.argv.indexOf('--chunk');
const CHUNK = ci !== -1 ? process.argv[ci + 1] : null;

const compress = html => {
  // 1. дублирующий data-fallback
  let s = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)data-fallback="([^"]*)"/g,
    (m, a, src, b, fb) => (fb === src ? '<img' + a + 'src="' + src + '"' + b : m));
  // 2. отступы и переносы
  s = s.replace(/\n\s+/g, '\n').replace(/>\s+</g, '><').replace(/\n{2,}/g, '\n');
  return s;
};

// Правки чисто косметические, поэтому проверяем, что смысл не поехал:
// меню на месте, число ссылок на модели не изменилось, JSON-LD валиден.
const sane = (before, after, rel) => {
  if (!after.includes('<a href="/categories/other/" role="menuitem"')) return 'пострадало меню';
  const l1 = (before.match(/href="\/models\//g) || []).length;
  const l2 = (after.match(/href="\/models\//g) || []).length;
  if (l1 !== l2) return 'изменилось число ссылок на модели: ' + l1 + ' -> ' + l2;
  for (const b of after.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { return 'битый JSON-LD'; }
  }
  return null;
};

function targets() {
  const out = [];
  if (CHUNK === 'pages') {
    for (const d of ['categories', 'industries', 'collections', 'browse']) {
      const dir = path.join(ROOT, d);
      if (!fs.existsSync(dir)) continue;
      const walk = p => {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          const f = path.join(p, e.name);
          if (e.isDirectory()) walk(f);
          else if (e.name === 'index.html') out.push(f);
        }
      };
      walk(dir);
    }
    for (const f of ['index.html', 'catalog/index.html', 'full-catalog/index.html', 'search/index.html',
      'about/index.html', 'contact/index.html', 'privacy/index.html', 'terms/index.html',
      'custom-order/index.html', 'data-licensing/index.html', '404.html']) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p)) out.push(p);
    }
    return out;
  }
  const cm = path.join(ROOT, 'scripts', '.catmap.json');
  let slugs = fs.existsSync(cm) ? Object.keys(JSON.parse(fs.readFileSync(cm, 'utf8')))
    : fs.readdirSync(path.join(ROOT, 'models'));
  if (CHUNK) {
    const [a, b] = CHUNK.split('-');
    slugs = slugs.filter(s => { const c = s[0].toLowerCase(); return c >= a && c <= b; });
  }
  for (const s of slugs) out.push(path.join(ROOT, 'models', s, 'index.html'));
  return out;
}

const files = targets();
console.log('часть: ' + (CHUNK || 'всё') + ',  файлов: ' + files.length + (DRY ? '  (--dry)' : ''));

let done = 0, skip = 0, saved = 0, errors = 0;
for (const f of files) {
  let before;
  try { before = fs.readFileSync(f, 'utf8'); } catch (e) { skip++; continue; }
  const after = compress(before);
  if (after.length >= before.length) { skip++; continue; }
  const bad = sane(before, after, f);
  if (bad) {
    if (++errors <= 5) console.log('  ПРОПУСК ' + path.relative(ROOT, f) + ': ' + bad);
    continue;
  }
  saved += before.length - after.length;
  if (!DRY) fs.writeFileSync(f, after);
  if (++done % 20000 === 0) console.log('  ' + done + '/' + files.length + '  сэкономлено ' + Math.round(saved / 1024 / 1024) + ' МБ');
}
console.log('обработано: ' + done + ', пропущено: ' + skip + (errors ? ', с проблемами: ' + errors : ''));
console.log('экономия: ' + (saved / 1024 / 1024).toFixed(0) + ' МБ' + (DRY ? '  (не записано)' : ''));
