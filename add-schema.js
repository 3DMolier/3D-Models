const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';
const base = 'https://3dmolier.github.io/3D-Models';
let changed = 0;

function save(p, c) { fs.writeFileSync(p, c, 'utf8'); changed++; }

function insertSchema(html, jsonObj) {
  const block = `\n<script type="application/ld+json">\n${JSON.stringify(jsonObj, null, 2)}\n</script>`;
  // Insert before </head>
  return html.replace('</head>', block + '\n</head>');
}

// Category name → slug mapping
const catSlug = {
  'Vehicles': 'vehicles', 'Aircraft': 'aircraft',
  'Military Vehicles': 'military-vehicles', 'Medical': 'medical-3d-models',
  'Ships': 'ships', 'Other': 'other', 'Architecture': 'architecture-landmarks',
  'Industrial Equipment': 'industrial-equipment', 'Characters & People': 'characters-people',
  'Electronics & Gadgets': 'electronics-gadgets', 'Food & Beverages': 'food-beverages',
  'Furniture & Interior': 'furniture-interior', 'Animals & Creatures': 'animals-creatures',
  'Clothing & Accessories': 'clothing-accessories', 'Nature & Plants': 'nature-plants',
  'Weapons & Tools': 'weapons-tools',
};
const catName = {
  'vehicles': 'Vehicles', 'aircraft': 'Aircraft', 'military-vehicles': 'Military Vehicles',
  'medical-3d-models': 'Medical', 'ships': 'Ships', 'other': 'Other',
  'architecture-landmarks': 'Architecture & Landmarks', 'industrial-equipment': 'Industrial Equipment',
  'characters-people': 'Characters & People', 'electronics-gadgets': 'Electronics & Gadgets',
  'food-beverages': 'Food & Beverages', 'furniture-interior': 'Furniture & Interior',
  'animals-creatures': 'Animals & Creatures', 'clothing-accessories': 'Clothing & Accessories',
  'nature-plants': 'Nature & Plants', 'weapons-tools': 'Weapons & Tools',
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. HOMEPAGE — WebSite + SearchAction + Organization
// ══════════════════════════════════════════════════════════════════════════════
{
  const p = path.join(root, 'index.html');
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('"WebSite"')) {
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${base}/#website`,
          "url": `${base}/`,
          "name": "3D Molier",
          "description": "88,000+ professional 3D models for film, games, architecture, medical and aerospace. All models on TurboSquid.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": { "@type": "EntryPoint", "urlTemplate": `${base}/search/?q={search_term_string}` },
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "@id": `${base}/#org`,
          "name": "3D Molier",
          "url": `${base}/`,
          "logo": `${base}/favicon.svg`,
          "contactPoint": { "@type": "ContactPoint", "email": "dddmolier@gmail.com", "contactType": "customer service" },
          "sameAs": ["https://www.turbosquid.com/Search/Artists/3d_molier-International"]
        }
      ]
    };
    c = insertSchema(c, schema);
    save(p, c);
    console.log('✓ homepage: WebSite + SearchAction + Organization');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. MODEL PAGES — BreadcrumbList (add alongside existing Product schema)
// ══════════════════════════════════════════════════════════════════════════════
const modelsDir = path.join(root, 'models');
let modelCount = 0;
fs.readdirSync(modelsDir).forEach(sub => {
  const p = path.join(modelsDir, sub, 'index.html');
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('"BreadcrumbList"')) return; // already has it

  // Extract from existing JSON-LD
  const jm = c.match(/"name":\s*"([^"]+)".*?"category":\s*"([^"]+)"/s);
  if (!jm) return;
  const modelName = jm[1];
  const category = jm[2];
  const slug = catSlug[category] || 'other';
  const catDisplayName = catName[slug] || category;

  const canonMatch = c.match(/href="(https:\/\/3dmolier\.github\.io\/3D-Models\/models\/[^"]+)"/);
  const modelUrl = canonMatch ? canonMatch[1] : `${base}/models/${sub}/`;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
      { "@type": "ListItem", "position": 2, "name": catDisplayName, "item": `${base}/categories/${slug}/` },
      { "@type": "ListItem", "position": 3, "name": modelName, "item": modelUrl }
    ]
  };
  c = insertSchema(c, breadcrumb);
  save(p, c);
  modelCount++;
});
console.log(`✓ model pages: BreadcrumbList added to ${modelCount} pages`);

// ══════════════════════════════════════════════════════════════════════════════
// 3. CATEGORY PAGES — BreadcrumbList + ItemList
// ══════════════════════════════════════════════════════════════════════════════
const catDir = path.join(root, 'categories');
fs.readdirSync(catDir).forEach(slug => {
  const p = path.join(catDir, slug, 'index.html');
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('"BreadcrumbList"')) return;

  const displayName = catName[slug] || slug;
  const pageTitle = c.match(/<title>([^<]+)<\/title>/)?.[1] || displayName;
  const catUrl = `${base}/categories/${slug}/`;

  // Extract model count from page (e.g., "7,518")
  const countMatch = c.match(/(\d[\d,]+)\s*<\/div>\s*<div[^>]*>Total Models/);
  const totalModels = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : undefined;

  // Extract featured model links from the page
  const modelLinks = [];
  const mlRe = /href="(\/3D-Models\/models\/[^"]+)"\s[^>]*class="[^"]*model-card[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*mc-name[^"]*"[^>]*>([^<]+)</g;
  let mm;
  while ((mm = mlRe.exec(c)) !== null && modelLinks.length < 5) {
    modelLinks.push({ url: `https://3dmolier.github.io${mm[1]}`, name: mm[2].trim() });
  }

  const schemas = [];

  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
      { "@type": "ListItem", "position": 2, "name": "3D Model Categories", "item": `${base}/catalog/` },
      { "@type": "ListItem", "position": 3, "name": displayName, "item": catUrl }
    ]
  });

  if (modelLinks.length > 0) {
    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `${displayName} 3D Models`,
      "url": catUrl,
      "itemListElement": modelLinks.map((m, i) => ({
        "@type": "ListItem", "position": i + 1, "name": m.name, "url": m.url
      }))
    };
    if (totalModels) itemList.numberOfItems = totalModels;
    schemas.push(itemList);
  }

  schemas.forEach(s => { c = insertSchema(c, s); });
  save(p, c);
});
console.log(`✓ category pages: BreadcrumbList + ItemList added`);

// ══════════════════════════════════════════════════════════════════════════════
// 4. COLLECTION PAGES — BreadcrumbList + ItemList
// ══════════════════════════════════════════════════════════════════════════════
const colDir = path.join(root, 'collections');
fs.readdirSync(colDir).forEach(slug => {
  const p = path.join(colDir, slug, 'index.html');
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('"BreadcrumbList"') || slug === 'index.html') return;

  const titleMatch = c.match(/<title>([^<|—]+)/);
  const displayName = titleMatch ? titleMatch[1].trim() : slug;
  const colUrl = `${base}/collections/${slug}/`;

  const modelLinks = [];
  const mlRe = /href="(\/3D-Models\/models\/[^"]+)"\s[^>]*class="[^"]*model-card[^"]*"[^>]*>[\s\S]*?<[^>]*class="[^"]*mc-name[^"]*"[^>]*>([^<]+)</g;
  let mm;
  while ((mm = mlRe.exec(c)) !== null && modelLinks.length < 5) {
    modelLinks.push({ url: `https://3dmolier.github.io${mm[1]}`, name: mm[2].trim() });
  }

  const schemas = [{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
      { "@type": "ListItem", "position": 2, "name": "Collections", "item": `${base}/collections/` },
      { "@type": "ListItem", "position": 3, "name": displayName, "item": colUrl }
    ]
  }];

  if (modelLinks.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": displayName,
      "url": colUrl,
      "itemListElement": modelLinks.map((m, i) => ({
        "@type": "ListItem", "position": i + 1, "name": m.name, "url": m.url
      }))
    });
  }

  schemas.forEach(s => { c = insertSchema(c, s); });
  save(p, c);
});
console.log('✓ collection pages: BreadcrumbList + ItemList added');

// ══════════════════════════════════════════════════════════════════════════════
// 5. INDUSTRY PAGES — BreadcrumbList
// ══════════════════════════════════════════════════════════════════════════════
const indDir = path.join(root, 'industries');
fs.readdirSync(indDir).forEach(slug => {
  const p = path.join(indDir, slug, 'index.html');
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('"BreadcrumbList"')) return;

  const titleMatch = c.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const displayName = titleMatch ? titleMatch[1].trim() : slug;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
      { "@type": "ListItem", "position": 2, "name": "Industries", "item": `${base}/catalog/` },
      { "@type": "ListItem", "position": 3, "name": displayName, "item": `${base}/industries/${slug}/` }
    ]
  };
  c = insertSchema(c, breadcrumb);
  save(p, c);
});
console.log('✓ industry pages: BreadcrumbList added');

// ══════════════════════════════════════════════════════════════════════════════
// 6. ABOUT / CONTACT / CUSTOM-ORDER — BreadcrumbList
// ══════════════════════════════════════════════════════════════════════════════
[
  { slug: 'about', name: 'About' },
  { slug: 'contact', name: 'Contact' },
  { slug: 'custom-order', name: 'Custom 3D Model Order' }
].forEach(({ slug, name }) => {
  const p = path.join(root, slug, 'index.html');
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('"BreadcrumbList"')) return;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${base}/` },
      { "@type": "ListItem", "position": 2, "name": name, "item": `${base}/${slug}/` }
    ]
  };
  c = insertSchema(c, breadcrumb);
  save(p, c);
});
console.log('✓ about/contact/custom-order: BreadcrumbList added');

// ══════════════════════════════════════════════════════════════════════════════
// 7. SEARCH PAGE — SearchAction schema
// ══════════════════════════════════════════════════════════════════════════════
{
  const p = path.join(root, 'search', 'index.html');
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('"SearchAction"')) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Search 3D Models — 3D Molier",
      "url": `${base}/search/`,
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": `${base}/search/?q={search_term_string}` },
        "query-input": "required name=search_term_string"
      }
    };
    c = insertSchema(c, schema);
    save(p, c);
    console.log('✓ search page: SearchAction added');
  }
}

console.log(`\nTotal: ${changed} files updated`);
