const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// 1. Parse CSV into product_id → image_url_big map
const csvPath = path.join(root, 'turbosquid_images_output.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');
const lines = csvText.split('\n');

const imageMap = {}; // product_id (string) → image_url_big
let csvRows = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // CSV is quoted: "row","product_id","title","product_url","image_url_big","count"
  // Remove surrounding quotes from each field
  const fields = line.match(/"([^"]*)"/g);
  if (!fields || fields.length < 5) continue;

  const productId = fields[1].replace(/"/g, '');
  const imageUrl = fields[4].replace(/"/g, '');

  if (productId && imageUrl && imageUrl.startsWith('http')) {
    imageMap[productId] = imageUrl;
    csvRows++;
  }
}

console.log(`Loaded ${csvRows} image URLs from CSV`);

// 2. Helper: extract product_id from weserv URL
// Pattern: ?url=static.turbosquid.com/Preview/XXXXXX/YYY/...
// XXXXXX + YYY (padded to total 9 digits) = product_id
function extractProductId(weservUrl) {
  const m = weservUrl.match(/Preview\/(\d{6})\/(\d{3})\//);
  if (!m) return null;
  const combined = m[1] + m[2]; // 9 digits e.g. "001214116"
  return String(parseInt(combined, 10)); // remove leading zeros → "1214116"
}

// 3. Collect all HTML files to process (models + categories + collections + industries + root pages)
function collectFiles() {
  const files = [];

  // models/*/index.html
  const modelsDir = path.join(root, 'models');
  fs.readdirSync(modelsDir).forEach(slug => {
    const p = path.join(modelsDir, slug, 'index.html');
    if (fs.existsSync(p)) files.push(p);
  });

  // categories/*/index.html, collections/*/index.html, industries/*/index.html
  ['categories', 'collections', 'industries'].forEach(dir => {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(slug => {
      const p = path.join(d, slug, 'index.html');
      if (fs.existsSync(p)) files.push(p);
    });
  });

  // root-level pages
  ['index.html', 'catalog/index.html', 'search/index.html', 'about/index.html'].forEach(rel => {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) files.push(p);
  });

  return files;
}

const allFiles = collectFiles();
let totalReplaced = 0;
let filesChanged = 0;
let notFound = 0;
const notFoundIds = new Set();

// Regex to match full weserv src attribute
const weservRe = /https:\/\/images\.weserv\.nl\/\?url=static\.turbosquid\.com\/Preview\/\d{6}\/\d{3}\/[^"&]+(?:&[^"]*)?/g;

allFiles.forEach(p => {
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('weserv.nl')) return;

  let changed = false;
  let replacedInFile = 0;

  html = html.replace(weservRe, (weservUrl) => {
    const pid = extractProductId(weservUrl);
    if (!pid) return weservUrl;

    const newUrl = imageMap[pid];
    if (newUrl) {
      changed = true;
      replacedInFile++;
      return newUrl;
    } else {
      notFoundIds.add(pid);
      notFound++;
      return weservUrl;
    }
  });

  if (changed) {
    fs.writeFileSync(p, html, 'utf8');
    filesChanged++;
    totalReplaced += replacedInFile;
    const label = p.replace(root + '/', '').replace(root + '\\', '');
    console.log(`✓ ${label}: ${replacedInFile} replaced`);
  }
});

console.log('\n══════════════════════════════════');
console.log(`Files changed:      ${filesChanged}`);
console.log(`URLs replaced:      ${totalReplaced}`);
console.log(`Unique IDs missing: ${notFoundIds.size}`);
if (notFoundIds.size > 0 && notFoundIds.size <= 30) {
  console.log('Missing IDs:', [...notFoundIds].slice(0, 30).join(', '));
}
console.log('══════════════════════════════════');
