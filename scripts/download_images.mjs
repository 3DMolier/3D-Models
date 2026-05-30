/**
 * Download top-1000 catalog images from p.turbosquid.com and save as webp.
 * Creates:
 *   large_images/{slug}.webp  — 800×450, quality 82
 *   previews/{slug}.webp      — 400×225, quality 72
 *
 * Run: node scripts/download_images.mjs
 * Requires: npm install sharp
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Lazy-import sharp ─────────────────────────────────────────────────────
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp not found. Install it: npm install sharp');
  process.exit(1);
}

// ── Setup dirs ─────────────────────────────────────────────────────────────
const LARGE_DIR = path.join(ROOT, 'large_images');
const PREV_DIR  = path.join(ROOT, 'previews');
fs.mkdirSync(LARGE_DIR, { recursive: true });
fs.mkdirSync(PREV_DIR,  { recursive: true });

// ── Load catalog ───────────────────────────────────────────────────────────
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
console.log(`Catalog: ${catalog.length} models\n`);

// ── HTTP download helper ───────────────────────────────────────────────────
function fetchBuffer(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; image-downloader/1.0)',
        'Referer': 'https://www.turbosquid.com/',
      },
      timeout,
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchBuffer(res.headers.location, timeout));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Sleep ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Process one model ──────────────────────────────────────────────────────
async function processModel(m, idx, total) {
  const slug   = m.s || '';
  const imgUrl = m.img || '';
  if (!slug || !imgUrl) return;

  const largePath = path.join(LARGE_DIR, slug + '.webp');
  const prevPath  = path.join(PREV_DIR,  slug + '.webp');

  // Skip if both already exist
  if (fs.existsSync(largePath) && fs.existsSync(prevPath)) {
    console.log(`[${idx+1}/${total}] SKIP (exists): ${slug}`);
    return;
  }

  try {
    const buf = await fetchBuffer(imgUrl);
    const img = sharp(buf);

    await img.clone().resize(800, 450, { fit: 'cover' })
      .webp({ quality: 82 }).toFile(largePath);
    await img.clone().resize(400, 225, { fit: 'cover' })
      .webp({ quality: 72 }).toFile(prevPath);

    console.log(`[${idx+1}/${total}] OK: ${slug}`);
  } catch (err) {
    console.warn(`[${idx+1}/${total}] FAIL (${err.message}): ${slug}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const CONCURRENCY = 4;
const DELAY_MS    = 200;

let active = 0, idx = 0;
const total = catalog.length;

await new Promise(resolve => {
  function next() {
    if (idx >= total && active === 0) { resolve(); return; }
    while (active < CONCURRENCY && idx < total) {
      const m = catalog[idx++];
      active++;
      processModel(m, idx - 1, total)
        .then(() => { active--; next(); })
        .catch(() => { active--; next(); });
      if (DELAY_MS > 0) sleep(DELAY_MS);
    }
  }
  next();
});

// ── Summary ────────────────────────────────────────────────────────────────
const largeCount = fs.readdirSync(LARGE_DIR).filter(f => f.endsWith('.webp')).length;
const prevCount  = fs.readdirSync(PREV_DIR).filter(f => f.endsWith('.webp')).length;
console.log(`\nDone! large_images: ${largeCount} files, previews: ${prevCount} files`);
