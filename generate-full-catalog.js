const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// ── 1. Image map ─────────────────────────────────────────────────────────────
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

// ── 2. Cert encoder ──────────────────────────────────────────────────────────
function certCode(c) {
  if (!c) return 0;
  const s = String(c).toLowerCase();
  if (s.includes('stem')) return 1;
  if (s.includes('check')) return 2;
  return 0;
}

// ── 3. Load catalog ──────────────────────────────────────────────────────────
const wb   = XLSX.readFile(path.join(root, 'Models_and_Sales_clear.xlsx'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1);

const models = rows
  .filter(r => r[0] && r[1])
  .map(r => {
    const id    = Number(r[0]);
    const name  = String(r[1]).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const price = Math.round(Number(r[4]) || 0);
    const sales = Math.round(Number(r[5]) || 0);
    const cert  = certCode(r[7]);
    const img   = imageMap[String(id)] || '';
    return [id, name, price, sales, cert, img];
  });

console.log(`Models: ${models.length}`);

// ── 4. Write JS data file ────────────────────────────────────────────────────
const dataDir = path.join(root, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const lines = models.map(([id, name, price, sales, cert, img]) =>
  `[${id},"${name}",${price},${sales},${cert},"${img}"]`
);

const js = `var FC=${JSON.stringify(models.length)};\nvar FM=[${lines.join(',')}];`;
const outPath = path.join(dataDir, 'fc.js');
fs.writeFileSync(outPath, js, 'utf8');
const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`✓ data/fc.js written: ${mb} MB`);

// ── 5. Price bracket counts (for sidebar) ────────────────────────────────────
const brackets = { u5:0, u15:0, u30:0, u60:0, u120:0, u999:0 };
models.forEach(([,,price]) => {
  if (price < 5)        brackets.u5++;
  else if (price < 15)  brackets.u15++;
  else if (price < 30)  brackets.u30++;
  else if (price < 60)  brackets.u60++;
  else if (price < 120) brackets.u120++;
  else                  brackets.u999++;
});
console.log('Price brackets:', brackets);

const certCounts = { none:0, sc:0, cm:0 };
models.forEach(([,,,,cert]) => {
  if (cert === 1) certCounts.sc++;
  else if (cert === 2) certCounts.cm++;
  else certCounts.none++;
});
console.log('Cert counts:', certCounts);
