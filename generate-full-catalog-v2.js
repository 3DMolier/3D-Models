/**
 * Generates two compact JSON files for the full catalog:
 *   data/fc.json     — columnar core data (~3.8MB raw, ~0.6MB gzip)
 *   data/fc-img.json — id→url image map (~4.5MB raw, ~1.1MB gzip)
 *
 * Columnar format compresses ~3x better than row-based because
 * values of the same type cluster together for the gzip algorithm.
 */
const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// ── Image map ────────────────────────────────────────────────────────────────
const imageMap = {};

const csv = fs.readFileSync(path.join(root, 'turbosquid_images_output.csv'), 'utf8').split('\n').slice(1);
csv.forEach(line => {
  const f = line.match(/"([^"]*)"/g); if (!f || f.length < 5) return;
  const pid = f[1].replace(/"/g, ''), url = f[4].replace(/"/g, '');
  if (pid && url.startsWith('http')) imageMap[pid] = url;
});

const wb2  = XLSX.readFile(path.join(root, 'TS_Images.xlsx'));
const imgR = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }).slice(1);
imgR.forEach(r => {
  const m = (r[0] || '').match(/-(\d+)(?:\?|$)/);
  if (!m) return;
  if (!imageMap[m[1]]) imageMap[m[1]] = r[2];
});
console.log(`Image map: ${Object.keys(imageMap).length} entries`);

// ── Cert encoder ─────────────────────────────────────────────────────────────
function certCode(c) {
  if (!c) return 0;
  const s = String(c).toLowerCase();
  if (s.includes('stem'))  return 1;
  if (s.includes('check')) return 2;
  return 0;
}

// ── Load catalog ─────────────────────────────────────────────────────────────
const wb   = XLSX.readFile(path.join(root, 'Models_and_Sales_clear.xlsx'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1);

// Sort by sales descending (bestsellers first — default view)
const models = rows
  .filter(r => r[0] && r[1])
  .map(r => ({
    id:    Number(r[0]),
    name:  String(r[1]),
    price: Math.round(Number(r[4]) || 0),
    sales: Math.round(Number(r[5]) || 0),
    cert:  certCode(r[7]),
  }))
  .sort((a, b) => b.sales - a.sales);

console.log(`Models: ${models.length}`);

// ── Columnar core data (NO images) ──────────────────────────────────────────
const core = {
  i: models.map(m => m.id),
  n: models.map(m => m.name),
  p: models.map(m => m.price),
  s: models.map(m => m.sales),
  c: models.map(m => m.cert),
};

const dataDir = path.join(root, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const corePath = path.join(dataDir, 'fc.json');
fs.writeFileSync(corePath, JSON.stringify(core), 'utf8');
const coreMB = (fs.statSync(corePath).size / 1024 / 1024).toFixed(2);
console.log(`✓ data/fc.json: ${coreMB} MB`);

// ── Image map (only models that have images) ─────────────────────────────────
const imgOut = {};
models.forEach(m => {
  const url = imageMap[String(m.id)];
  if (url) imgOut[m.id] = url;
});

const imgPath = path.join(dataDir, 'fc-img.json');
fs.writeFileSync(imgPath, JSON.stringify(imgOut), 'utf8');
const imgMB = (fs.statSync(imgPath).size / 1024 / 1024).toFixed(2);
console.log(`✓ data/fc-img.json: ${imgMB} MB (${Object.keys(imgOut).length} images)`);
