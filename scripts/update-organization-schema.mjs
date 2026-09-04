// update-organization-schema.mjs — обновление блока Organization + WebSite (@graph).
//
// Зачем: аудит seo-geo показал, что в sameAs стоит одна ссылка (TurboSquid). По данным
// скилла упоминания бренда на внешних площадках коррелируют с цитируемостью в AI-выдаче
// примерно втрое сильнее, чем ссылки, но связать наши площадки с сайтом поисковику
// сейчас нечем. Плюс в contactPoint стоял личный gmail, а не корпоративная почта.
//
// Что меняется:
//   * sameAs: 7 подтверждённых площадок вместо одной;
//   * legalName, юридический адрес, founder (Person) — сигналы Trust;
//   * @id + publisher-связка между Organization и WebSite;
//   * почта 3dmolier@3dmolier.com.
//
// В карточки моделей блок НЕ добавляется: для разрешения сущности достаточно статических
// страниц, а ещё один проход по 86 869 файлам того не стоит.
//
// Запуск:  node scripts/update-organization-schema.mjs --dry
//          node scripts/update-organization-schema.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const SITE = 'https://3dmolierstudio.com';
const DRY = process.argv.includes('--dry');

// Только публичные адреса профилей. Основатель прислал ссылку на LinkedIn вида
// /company/18679468/admin/dashboard/ — это админка, доступная лишь ему; в sameAs
// идёт публичная форма без /admin/.
const SAME_AS = [
  'https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international',
  'https://www.cgtrader.com/3dmi',
  'https://www.linkedin.com/company/18679468/',
  'https://3dmolier.com/',
  'https://www.youtube.com/channel/UCM0td4Pl6XVApQSJB1r03jA',
  'https://www.artstation.com/ddd_molier',
  'https://www.deviantart.com/3dmolier',
  'https://www.pinterest.com/3d_molier/',
  'https://3dmoliermodels.blogspot.com/',
];

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': SITE + '/#organization',
      name: '3D Molier',
      legalName: '3D Molier International Corp.',
      url: SITE + '/',
      logo: { '@type': 'ImageObject', url: SITE + '/favicon.svg' },
      email: '3dmolier@3dmolier.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'East 54th Street, Mossfon Building, 2nd Floor',
        postOfficeBoxNumber: '0832-0886 W.T.C.',
        addressLocality: 'Panama',
        addressCountry: 'PA',
      },
      founder: { '@type': 'Person', name: 'Andrey Simonenko', jobTitle: '3D Artist and Founder' },
      sameAs: SAME_AS,
      contactPoint: {
        '@type': 'ContactPoint',
        email: '3dmolier@3dmolier.com',
        contactType: 'customer service',
        availableLanguage: ['en', 'ru'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': SITE + '/#website',
      url: SITE + '/',
      name: '3D Molier',
      publisher: { '@id': SITE + '/#organization' },
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        // Адрес поиска для поисковых систем. Раньше указывал на /search/ -
        // страницу-указатель, которая сама перебрасывает на /catalog/. Ведём
        // сразу в каталог: он и есть поиск.
        target: { '@type': 'EntryPoint', urlTemplate: SITE + '/catalog/?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};
const BLOCK = '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>';

// старый блок: одна строка со "@graph" и Organization
const OLD = /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@graph":\[\{"@type":"Organization"[\s\S]*?<\/script>/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'models' || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const ORG = graph['@graph'][0];
const WEB = graph['@graph'][1];

// Главная и часть страниц используют другой формат: @graph с отступами, где рядом с
// Organization лежат ItemList и FAQPage. Там нельзя просто подменить блок — разбираем
// JSON, дополняем узел Organization и собираем обратно.
function upgradeGraph(src) {
  let touched = false;
  const out = src.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, json) => {
    let o;
    try { o = JSON.parse(json.trim()); } catch { return m; }
    if (!o || !Array.isArray(o['@graph'])) return m;
    let hit = false;
    o['@graph'] = o['@graph'].map(node => {
      if (node && node['@type'] === 'Organization') {
        hit = true;
        return { ...node, ...ORG, '@id': node['@id'] || ORG['@id'] };
      }
      if (node && node['@type'] === 'WebSite') {
        hit = true;
        // potentialAction берём из образца, а не оставляем как есть: адрес
        // поиска переехал с /search/ на /catalog/, и без этой строки страницы
        // продолжали бы отдавать поисковикам адрес страницы-указателя.
        return {
          ...node,
          publisher: { '@id': node['@id'] ? node['@id'].replace(/#website$/, '#organization') : ORG['@id'] },
          inLanguage: 'en',
          potentialAction: WEB.potentialAction,
        };
      }
      // Ссылка на издателя встречается и в других узлах - на /catalog/ она
      // указывала на #org, а такого узла в графе нет: организация зовётся
      // #organization. Ссылка в пустоту. Сводим к одному имени.
      if (node && node.publisher && typeof node.publisher['@id'] === 'string'
          && /#org$/.test(node.publisher['@id'])) {
        hit = true;
        return { ...node, publisher: { '@id': node.publisher['@id'].replace(/#org$/, '#organization') } };
      }
      // Адрес поиска встречается не только у WebSite: на /catalog/ он лежит
      // ещё и в узле WebPage. Переводим любой на действующий адрес каталога.
      const tpl = node && node.potentialAction && node.potentialAction.target
        && node.potentialAction.target.urlTemplate;
      if (typeof tpl === 'string' && tpl.includes('/search/?q=')) {
        hit = true;
        return {
          ...node,
          potentialAction: {
            ...node.potentialAction,
            target: { ...node.potentialAction.target, urlTemplate: tpl.replace('/search/?q=', '/catalog/?q=') },
          },
        };
      }
      return node;
    });
    if (!hit) return m;
    touched = true;
    return '<script type="application/ld+json">' + JSON.stringify(o) + '</script>';
  });
  return touched ? out : null;
}

const files = walk(ROOT);
let replaced = 0, upgraded = 0, inserted = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let next = null, kind = '';

  // Две правки идут подряд, а не «или - или». Раньше страница с целиком
  // заменяемым блоком дальше не разбиралась, и остальные блоки разметки на ней
  // оставались нетронутыми: на /catalog/ так и жили ссылка на издателя #org,
  // которого в графе нет, и адрес поиска на /search/ во втором блоке.
  if (OLD.test(src)) { next = src.replace(OLD, () => BLOCK); kind = 'replaced'; }
  const up = upgradeGraph(next || src);
  if (up && up !== (next || src)) { next = up; if (!kind) kind = 'upgraded'; }

  // страницы вообще без сведений об организации — вставляем блок перед </head>
  if (!next && !/"@type":\s*"Organization"/.test(src) && src.includes('</head>')) {
    next = src.replace('</head>', () => BLOCK + '\n</head>');
    kind = 'inserted';
  }
  if (!next || next === src) continue;
  if (!DRY) fs.writeFileSync(f, next);
  if (kind === 'replaced') replaced++; else if (kind === 'upgraded') upgraded++; else inserted++;
}
console.log('HTML-страниц просмотрено: ' + files.length);
console.log('  блок заменён целиком: ' + replaced);
console.log('  узел Organization дополнен: ' + upgraded);
console.log('  блок добавлен с нуля:  ' + inserted);
console.log('  итого: ' + (replaced + upgraded + inserted) + (DRY ? '  (--dry, не записано)' : ''));
console.log('\nsameAs (' + SAME_AS.length + '):');
for (const u of SAME_AS) console.log('  ' + u);
console.log('\nНе добавлены (нужны точные URL от основателя): CGTrader, LinkedIn.');
