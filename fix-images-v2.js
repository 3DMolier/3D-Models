const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// ── 1. Build combined image map from CSV + XLSX ──────────────────────────────

const imageMap = {}; // product_id (string) → image_url

// CSV: source_row, product_id, title, product_url, image_url_big, count
const csvText = fs.readFileSync(path.join(root, 'turbosquid_images_output.csv'), 'utf8');
csvText.split('\n').slice(1).forEach(line => {
  if (!line.trim()) return;
  const fields = line.match(/"([^"]*)"/g);
  if (!fields || fields.length < 5) return;
  const pid = fields[1].replace(/"/g, '');
  const url = fields[4].replace(/"/g, '');
  if (pid && url && url.startsWith('http')) imageMap[pid] = url;
});

// XLSX: product_url (contains id), title, image_url
const wb = XLSX.readFile(path.join(root, 'TS_Images.xlsx'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
rows.slice(1).forEach(row => {
  const productUrl = row[0];
  const imageUrl = row[2];
  if (!productUrl || !imageUrl) return;
  // Extract product ID from URL: ends with -NNNNNN?referral or -NNNNNN
  const m = productUrl.match(/-(\d+)(?:\?|$)/);
  if (!m) return;
  const pid = m[1];
  if (!imageMap[pid]) imageMap[pid] = imageUrl; // CSV takes priority
});

console.log(`Combined image map: ${Object.keys(imageMap).length} entries`);

// ── 2. Helpers ───────────────────────────────────────────────────────────────

// Extract product_id from weserv URL (Preview/XXXXXX/YYY/ pattern)
function extractProductId(weservUrl) {
  const m = weservUrl.match(/Preview\/(\d{6})\/(\d{3})\//);
  if (!m) return null;
  return String(parseInt(m[1] + m[2], 10));
}

// Convert weserv URL → direct static.turbosquid.com URL (fallback)
function weservToStatic(weservUrl) {
  // https://images.weserv.nl/?url=static.turbosquid.com/Preview/...&w=600&...
  const m = weservUrl.match(/\?url=(static\.turbosquid\.com\/Preview\/[^&"]+)/);
  if (!m) return null;
  return 'https://' + m[1];
}

// ── 3. Collect all HTML files ────────────────────────────────────────────────

function collectFiles() {
  const files = [];
  const modelsDir = path.join(root, 'models');
  fs.readdirSync(modelsDir).forEach(slug => {
    const p = path.join(modelsDir, slug, 'index.html');
    if (fs.existsSync(p)) files.push(p);
  });
  ['categories', 'collections', 'industries'].forEach(dir => {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(slug => {
      const p = path.join(d, slug, 'index.html');
      if (fs.existsSync(p)) files.push(p);
    });
  });
  ['index.html', 'catalog/index.html', 'search/index.html', 'about/index.html'].forEach(rel => {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) files.push(p);
  });
  return files;
}

// ── 4. Replace ───────────────────────────────────────────────────────────────

const weservRe = /https:\/\/images\.weserv\.nl\/\?url=static\.turbosquid\.com\/Preview\/\d{6}\/\d{3}\/[^"&]+(?:&[^"]*)?/g;

let totalReplaced = 0, totalFallback = 0, filesChanged = 0;

collectFiles().forEach(p => {
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('weserv.nl')) return;

  let changed = false;

  html = html.replace(weservRe, (weservUrl) => {
    const pid = extractProductId(weservUrl);
    if (pid && imageMap[pid]) {
      changed = true;
      totalReplaced++;
      return imageMap[pid];
    }
    // Fallback: use direct static.turbosquid.com URL
    const staticUrl = weservToStatic(weservUrl);
    if (staticUrl) {
      changed = true;
      totalFallback++;
      return staticUrl;
    }
    return weservUrl;
  });

  if (changed) {
    fs.writeFileSync(p, html, 'utf8');
    filesChanged++;
    const label = p.replace(root + path.sep, '').replace(root + '/', '');
    const remaining = (html.match(/weserv\.nl/g) || []).length;
    console.log(`✓ ${label}${remaining ? '  ('+remaining+' still remain)' : ''}`);
  }
});

console.log('\n══════════════════════════════════');
console.log(`Files changed:        ${filesChanged}`);
console.log(`Replaced (from map):  ${totalReplaced}`);
console.log(`Replaced (fallback):  ${totalFallback}`);
console.log(`Total replacements:   ${totalReplaced + totalFallback}`);
console.log('══════════════════════════════════');
