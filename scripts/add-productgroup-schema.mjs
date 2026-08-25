// add-productgroup-schema.mjs - ProductGroup для объединённых карточек.
//
// Проблема. Разметку Product пишет card-content.mjs один раз, с ОДНОЙ ценой.
// Объединение версий делает отдельный проход, который трогает только видимый HTML
// и JSON-LD не пересобирает. В итоге на 6803 объединённых карточках в разметке
// стоит цена главной версии, хотя внутри разброс: у African Animals заявлено $279,
// а по факту версии от $279 до $1499.
//
// Решение. На карточках со списком версий заменяем Product на ProductGroup:
//   • hasVariant - по одному Product на версию, с её ценой и ссылкой на TurboSquid;
//   • offers - AggregateOffer с реальным диапазоном цен;
//   • variesBy - только color, и только если версии действительно различаются
//     цветом. Google из вариативных свойств понимает color/size/material/pattern;
//     «оснастка» и «версия под софт» ему неизвестны, поэтому их не заявляем, а
//     оставляем в названии варианта.
//
// hasMerchantReturnPolicy и shippingDetails НЕ добавляем: продавец в offers -
// TurboSquid, и заявлять его политику от своего имени значит вводить Google
// в заблуждение о том, кто исполняет заказ.
//
// Данные берём из самой страницы: <ul class="mp-var-list"> уже содержит имя
// версии, цену и ссылку.
//
// Запуск:  node scripts/add-productgroup-schema.mjs --dry
//          node scripts/add-productgroup-schema.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const MODELS = path.join(ROOT, 'models');
const SITE = 'https://3dmolierstudio.com';
const DRY = process.argv.includes('--dry');

const COLORS = /\b(sand|khaki|green|black|white|red|blue|yellow|orange|grey|gray|silver|gold|brown|camo|beige|pink|purple|maroon|bronze|copper)\b/i;
const unesc = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/-/g, '-');

function variants(html) {
  const m = html.match(/<ul class="mp-var-list">([\s\S]*?)<\/ul>/);
  if (!m) return [];
  const out = [];
  for (const li of m[1].match(/<li class="mp-var[^"]*">[\s\S]*?<\/li>/g) || []) {
    const name = (li.match(/mp-var-name">([^<]*)/) || [])[1] || '';
    const price = (li.match(/mp-var-price">\$?([\d.,]+)/) || [])[1] || '';
    const url = (li.match(/class="mp-var-link" href="([^"]+)"/) || [])[1] || '';
    const sku = (url.match(/-(\d{5,})(?:\?|$)/) || [])[1] || '';
    if (!name || !price || !url) continue;
    out.push({ name: unesc(name).replace(/\s+main\s*$/i, '').trim(), price: +price.replace(/,/g, ''), url: unesc(url), sku });
  }
  return out;
}

let touched = 0, checked = 0, noProduct = 0, ranged = 0, broken = 0;
for (const slug of fs.readdirSync(MODELS)) {
  const file = path.join(MODELS, slug, 'index.html');
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  if (!html.includes('<ul class="mp-var-list">')) continue;
  checked++;

  const vs = variants(html);
  if (vs.length < 2) continue;

  // исходный Product - из него берём имя, картинку, описание, категорию
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  let prodRaw = null, prod = null;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim());
      if (j['@type'] === 'Product') { prodRaw = b; prod = j; break; }
    } catch (e) { /* битый блок - не наш случай, репорт ниже */ }
  }
  if (!prod) { noProduct++; continue; }

  const prices = vs.map(v => v.price).filter(p => p > 0);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  if (hi > lo) ranged++;

  const varyByColor = vs.filter(v => COLORS.test(v.name)).length >= 2;

  const group = {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${SITE}/models/${slug}/#group`,
    name: prod.name,
    url: `${SITE}/models/${slug}/`,
    image: prod.image,
    description: prod.description,
    brand: prod.brand,
    category: prod.category,
    productGroupID: String(prod.sku || slug),
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: lo.toFixed(2),
      highPrice: hi.toFixed(2),
      priceCurrency: 'USD',
      offerCount: vs.length,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'TurboSquid' },
    },
    hasVariant: vs.map(v => {
      const p = { '@type': 'Product', name: v.name };
      if (v.sku) p.sku = v.sku;
      const c = v.name.match(COLORS);
      if (varyByColor && c) p.color = c[1].replace(/\b\w/g, ch => ch.toUpperCase());
      p.offers = {
        '@type': 'Offer', price: v.price.toFixed(2), priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: v.url, seller: { '@type': 'Organization', name: 'TurboSquid' },
      };
      return p;
    }),
  };
  if (varyByColor) group.variesBy = ['https://schema.org/color'];

  const out = html.replace(prodRaw,
    '<script type="application/ld+json">\n' + JSON.stringify(group) + '\n</script>');

  // Проверяем КАЖДЫЙ блок: битый JSON-LD у нас уже случался, повторять нельзя.
  let ok = true;
  for (const b of out.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    try { JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()); }
    catch (e) { ok = false; }
  }
  if (!ok) { broken++; continue; }

  if (!DRY) fs.writeFileSync(file, out);
  touched++;
  if (touched % 2000 === 0) console.log('  размечено ' + touched);
}

console.log('\nкарточек со списком версий: ' + checked);
console.log('размечено ProductGroup:     ' + touched + (DRY ? '  (--dry)' : ''));
console.log('  из них с разбросом цен:   ' + ranged);
if (noProduct) console.log('без исходного Product:      ' + noProduct);
if (broken) console.log('ПРОПУЩЕНО из-за битого JSON: ' + broken);
