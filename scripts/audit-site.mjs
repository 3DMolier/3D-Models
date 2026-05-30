/**
 * Pre-deploy audit for 3D-Models site.
 * Run: node scripts/audit-site.mjs
 * Exits with code 1 if any errors are found.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function walk(dir) {
  const result = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Skip node_modules and .git
      if (item.name === 'node_modules' || item.name === '.git') continue;
      result.push(...walk(full));
    } else {
      result.push(full);
    }
  }
  return result;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

// ── Collect files ─────────────────────────────────────────────────────────────

const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
const jsonFiles = allFiles.filter(f =>
  f.replace(/\\/g, '/').includes('/data/categories/') && f.endsWith('.json')
);

console.log(`Auditing ${htmlFiles.length} HTML files, ${jsonFiles.length} category JSON files…\n`);

// ── 1. Per-HTML checks ────────────────────────────────────────────────────────

for (const file of htmlFiles) {
  const r = rel(file);
  const html = fs.readFileSync(file, 'utf8');

  // Skip og-source.html (design-only, not a real page)
  if (r.includes('assets/og/')) continue;

  // 1a. handleImageError present → site.js must be loaded
  if (html.includes('onerror="handleImageError(this)"') &&
      !html.includes('/assets/js/site')) {
    errors.push(`${r}: uses handleImageError but does not load site.js`);
  }

  // 1b. Direct static.turbosquid.com in img src (warn; allowed only in data-fallback or proxied)
  // Only flag when src value itself begins with the static domain (not url-encoded inside a proxy)
  const directStatic = [...html.matchAll(/<img[^>]+src="(https?:\/\/static\.turbosquid\.com[^"]*)"/g)];
  if (directStatic.length) {
    warnings.push(`${r}: ${directStatic.length} img tag(s) use static.turbosquid.com directly in src`);
  }

  // 1c. Missing <title>
  if (!/<title>.+<\/title>/s.test(html)) {
    errors.push(`${r}: missing <title>`);
  }

  // 1d. Missing meta description
  if (!/<meta\s+name="description"/.test(html)) {
    errors.push(`${r}: missing meta description`);
  }

  // 1e. Missing canonical (industry/category/collection/model pages only)
  if (/\/(industries|categories|collections|models)\//.test(r)) {
    if (!/rel="canonical"/.test(html)) {
      errors.push(`${r}: missing canonical link`);
    }
  }

  // 1f. Validate JSON-LD blocks
  const jsonLdBlocks = [...html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )];
  for (const block of jsonLdBlocks) {
    try {
      JSON.parse(block[1]);
    } catch {
      errors.push(`${r}: invalid JSON-LD`);
    }
  }

  // 1g. Industry pages must load site.min.js
  if (r.startsWith('industries/') && r.endsWith('/index.html')) {
    if (!html.includes('/assets/js/site')) {
      errors.push(`${r}: industry page missing site.js`);
    }
  }
}

// ── 2. Category JSON checks ───────────────────────────────────────────────────

for (const file of jsonFiles) {
  const r = rel(file);
  let models;
  try {
    models = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    errors.push(`${r}: invalid JSON`);
    continue;
  }

  if (!Array.isArray(models)) {
    errors.push(`${r}: JSON is not an array`);
    continue;
  }
  if (models.length === 0) {
    // Empty array is valid — category simply has no extra Load More models yet
    continue;
  }

  const required = ['title', 'url', 'img', 'price', 'cat'];
  let missingFields = 0;
  for (const m of models) {
    for (const field of required) {
      if (!m[field]) missingFields++;
    }
  }
  if (missingFields > 0) {
    warnings.push(`${r}: ${missingFields} missing required field(s) across ${models.length} models`);
  }
}

// ── 3. Report ─────────────────────────────────────────────────────────────────

if (warnings.length) {
  console.warn('WARNINGS:');
  warnings.forEach(w => console.warn('  ⚠', w));
  console.warn('');
}

if (errors.length) {
  console.error('ERRORS:');
  errors.forEach(e => console.error('  ✗', e));
  console.error(`\nAudit FAILED — ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Audit PASSED — 0 errors, ${warnings.length} warning(s).`);
