const fs   = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// Match all variants of the Catalog nav link and append All 86K after it
// Pattern: <a href="/3D-Models/catalog/"[^>]*>Catalog</a>
const CATALOG_RE = /(<a href="\/3D-Models\/catalog\/"[^>]*>Catalog<\/a>)/g;

function appendAfterCatalog(html, originalTag) {
  // Determine the style to use for the new link (match existing nav style)
  let newLink;
  if (originalTag.includes('nav-link')) {
    newLink = '<a href="/3D-Models/full-catalog/" class="nav-link">All 86K</a>';
  } else if (originalTag.includes('color:#555555')) {
    newLink = '<a href="/3D-Models/full-catalog/" style="color:#555555;text-decoration:none;font-size:14px;font-weight:500;">All 86K</a>';
  } else if (originalTag.includes('color:#6B7280') || originalTag.includes('color:#6b7280')) {
    newLink = '<a href="/3D-Models/full-catalog/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">All 86K</a>';
  } else {
    newLink = '<a href="/3D-Models/full-catalog/">All 86K</a>';
  }
  // Replace "Catalog" text with "Top 1000" in the original tag
  const updatedTag = originalTag.replace(/>Catalog</, '>Top 1000<');
  return updatedTag + newLink;
}

function collectAll() {
  const files = [];
  function scan(dir) {
    try {
      fs.readdirSync(dir).forEach(name => {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) {
          if (!['node_modules','assets','brand_assets','.git'].includes(name)) scan(p);
        } else if (name.endsWith('.html')) {
          files.push(p);
        }
      });
    } catch(e) {}
  }
  scan(root);
  return files;
}

let changed = 0;
collectAll().forEach(p => {
  let c = fs.readFileSync(p, 'utf8');
  // Skip if already updated
  if (c.includes('/full-catalog/')) return;
  if (!CATALOG_RE.test(c)) return;
  CATALOG_RE.lastIndex = 0;
  c = c.replace(CATALOG_RE, (match) => appendAfterCatalog(c, match));
  fs.writeFileSync(p, c, 'utf8');
  changed++;
});

console.log(`Updated nav in ${changed} files`);
