const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// Collect all pages to convert
const targets = [];

// Category pages
const catDir = path.join(root, 'categories');
fs.readdirSync(catDir).forEach(d => {
  const p = path.join(catDir, d, 'index.html');
  if(fs.existsSync(p)) targets.push(p);
});

// Collection pages
const colDir = path.join(root, 'collections');
fs.readdirSync(colDir).forEach(d => {
  const p = path.join(colDir, d, 'index.html');
  if(fs.existsSync(p)) targets.push(p);
});
targets.push(path.join(colDir, 'index.html'));

// Industry pages
const indDir = path.join(root, 'industries');
fs.readdirSync(indDir).forEach(d => {
  const p = path.join(indDir, d, 'index.html');
  if(fs.existsSync(p)) targets.push(p);
});

// 404 page
targets.push(path.join(root, '404.html'));

console.log('Processing', targets.length, 'pages...');

// Replacements to apply to every file
const replacements = [
  // ── BODY ────────────────────────────────────────────────────────────────────
  [/background: #07090F/g, 'background: #fafafa'],
  [/background:#07090F/g, 'background:#fafafa'],
  [/color: #EDF2FF/g, 'color: #111111'],
  [/color:#EDF2FF/g, 'color:#111111'],
  [/; color: #EDF2FF/g, '; color: #111111'],

  // ── DARK SURFACES → WHITE ────────────────────────────────────────────────
  [/background: #0D1117/g, 'background: #ffffff'],
  [/background:#0D1117/g, 'background:#ffffff'],
  [/background: #0E1220/g, 'background: #ffffff'],
  [/background:#0E1220/g, 'background:#ffffff'],
  [/background: #131A22/g, 'background: #f5f5f5'],
  [/background:#131A22/g, 'background:#f5f5f5'],
  [/background: #151A2E/g, 'background: #f5f5f5'],
  [/background:#151A2E/g, 'background:#f5f5f5'],
  [/background: #0A0D16/g, 'background: #111111'],
  [/background:#0A0D16/g, 'background:#111111'],
  [/background: #1E2B44/g, 'background: #f5f5f5'],

  // ── DARK BORDERS → LIGHT ─────────────────────────────────────────────────
  [/border: 1px solid rgba\(255,255,255,0\.07\)/g, 'border: 1px solid #e5e5e5'],
  [/border:1px solid rgba\(255,255,255,0\.07\)/g, 'border:1px solid #e5e5e5'],
  [/border: 1px solid rgba\(255,255,255,\.07\)/g, 'border: 1px solid #e5e5e5'],
  [/border:1px solid rgba\(255,255,255,\.07\)/g, 'border:1px solid #e5e5e5'],
  [/border: 1px solid #1E2B44/g, 'border: 1px solid #e5e5e5'],
  [/border:1px solid #1E2B44/g, 'border:1px solid #e5e5e5'],
  [/border-bottom: 1px solid rgba\(255,255,255,0\.07\)/g, 'border-bottom: 1px solid #e5e5e5'],
  [/border-bottom:1px solid rgba\(255,255,255,0\.07\)/g, 'border-bottom:1px solid #e5e5e5'],
  [/border-top: 1px solid #1E2B44/g, 'border-top: 1px solid #e5e5e5'],
  [/border-top:1px solid #1E2B44/g, 'border-top:1px solid #e5e5e5'],
  [/border-top: 1px solid rgba\(255,255,255,0\.07\)/g, 'border-top: 1px solid #e5e5e5'],
  [/border-top:1px solid rgba\(255,255,255,0\.07\)/g, 'border-top:1px solid #e5e5e5'],
  [/border-color: #1E2B44/g, 'border-color: #e5e5e5'],

  // ── SCROLLBAR ────────────────────────────────────────────────────────────
  [/::-webkit-scrollbar-track \{ background: #07090F; \}/g, '::-webkit-scrollbar-track { background: #fafafa; }'],
  [/::-webkit-scrollbar-thumb \{ background: #1E2B44;/g, '::-webkit-scrollbar-thumb { background: #d1d5db;'],

  // ── MUTED TEXT ────────────────────────────────────────────────────────────
  [/color: #7A8DB0/g, 'color: #6b7280'],
  [/color:#7A8DB0/g, 'color:#6b7280'],
  [/color: #4A5C7A/g, 'color: #6b7280'],
  [/color:#4A5C7A/g, 'color:#6b7280'],
  [/color: #9CA3AF/g, 'color: #6b7280'],
  [/color:#9CA3AF/g, 'color:#6b7280'],

  // ── HEADINGS ─────────────────────────────────────────────────────────────
  [/h1,h2,h3\{[^}]*color:#fff[^}]*\}/g, (m) => m.replace('color:#fff', 'color:#111111')],
  [/h1,h2,h3 \{[^}]*color: #fff[^}]*\}/g, (m) => m.replace('color: #fff', 'color: #111111')],
  [/color: #fff;/g, 'color: #111111;'],
  [/color:#fff;/g, 'color:#111111;'],
  [/color: #ffffff;/g, 'color: #111111;'],
  [/; color: #fff\b/g, '; color: #111111'],

  // ── NAV ──────────────────────────────────────────────────────────────────
  [/background: rgba\(7,9,15,0\.9[25]\)/g, 'background: rgba(255,255,255,0.97)'],
  [/background:rgba\(7,9,15,0\.9[25]\)/g, 'background:rgba(255,255,255,0.97)'],
  [/background: rgba\(7,9,15,0\.85\)/g, 'background: rgba(255,255,255,0.97)'],
  [/background:rgba\(7,9,15,0\.85\)/g, 'background:rgba(255,255,255,0.97)'],
  [/background: rgba\(7,9,15,0\.95\)/g, 'background: rgba(255,255,255,0.97)'],
  [/background:rgba\(7,9,15,0\.95\)/g, 'background:rgba(255,255,255,0.97)'],

  // Nav logo colors
  [/font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#fff;/g,
   "font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#111111;"],
  [/font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:#fff;/g,
   "font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:#111111;"],

  // ── TEAL → BLACK (accent) ────────────────────────────────────────────────
  // btn-primary teal bg → black
  [/background: #00E5C4; color: #07090F;/g, 'background: #111111; color: #ffffff;'],
  [/background:#00E5C4;color:#07090F;/g, 'background:#111111;color:#ffffff;'],
  // Teal nav button (TurboSquid button)
  [/background:#00E5C4;color:#07090F;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px/g,
   'background:#111111;color:#ffffff;font-weight:700;font-size:13px;padding:8px 18px;border-radius:4px'],
  // Teal color in various contexts
  [/color: #00E5C4/g, 'color: #111111'],
  [/color:#00E5C4/g, 'color:#111111'],
  // Teal border-color
  [/border-color: #00E5C4/g, 'border-color: #111111'],
  [/border-color:#00E5C4/g, 'border-color:#111111'],
  // Teal box-shadow (remove glow)
  [/box-shadow: 0 2px 12px rgba\(0,229,196,0\.3\)/g, 'box-shadow: none'],
  [/box-shadow:0 2px 12px rgba\(0,229,196,0\.3\)/g, 'box-shadow:none'],
  [/box-shadow: 0 4px 20px rgba\(0,229,196,0\.4\)/g, 'box-shadow: none'],
  [/box-shadow: 0 0 0 3px rgba\(0,229,196,0\.[12]\)/g, 'box-shadow: 0 0 0 3px rgba(0,0,0,0.1)'],
  // btn-primary hover teal
  [/\.btn-primary:hover\s*\{\s*background: #00CCB0;/g, '.btn-primary:hover { background: #333333;'],
  [/background: #00CCB0;/g, 'background: #333333;'],
  // Teal in CSS class defs
  [/\.teal\{color:#00E5C4;\}/g, '.teal{color:#111111;}'],
  [/\.teal \{ color: #00E5C4; \}/g, '.teal { color: #111111; }'],
  // Teal in HTML span (class="teal")
  [/background: #00E5C4/g, 'background: #111111'],
  [/background:#00E5C4/g, 'background:#111111'],

  // ── NAV LINK HOVER ───────────────────────────────────────────────────────
  [/\.nav-link:hover\s*\{[^}]*color: #EDF2FF/g, (m) => m.replace('color: #EDF2FF', 'color: #111111')],
  [/\.nav-links a:hover \{ color: #fff/g, '.nav-links a:hover { color: #111111'],
  // Nav link underline teal → black
  [/background: #00E5C4;\s*transition: width/g, 'background: #111111; transition: width'],

  // ── GRAIN OVERLAY ────────────────────────────────────────────────────────
  // Remove body::before grain (replace with empty)
  [/body::before \{[\s\S]*?opacity: 0\.[34];[\s\S]*?\}/g, ''],

  // ── FOOTER ───────────────────────────────────────────────────────────────
  [/footer.*?background: #0D1117/g, (m) => m.replace('background: #0D1117', 'background: #111111')],
  [/background:#0D1117;border-top:1px solid rgba\(255,255,255,0\.07\)/g,
   'background:#111111;border-top:none'],

  // ── SECTION ALTERNATING BG ───────────────────────────────────────────────
  [/background: rgba\(14,18,32,0\.4\)/g, 'background: #f5f5f5'],
  [/background:rgba\(14,18,32,0\.4\)/g, 'background:#f5f5f5'],
  [/background: rgba\(14,18,32,0\.[345]\)/g, 'background: #f5f5f5'],

  // ── INPUT FIELDS ─────────────────────────────────────────────────────────
  [/border:1px solid rgba\(255,255,255,\.1\)/g, 'border:1px solid #d1d5db'],
  [/border:1px solid rgba\(255,255,255,0\.1\)/g, 'border:1px solid #d1d5db'],

  // ── REMAINING DARK COLORS ─────────────────────────────────────────────────
  [/color: #EDF2FF/g, 'color: #111111'],
  [/color:#EDF2FF/g, 'color:#111111'],
];

let changed = 0;
targets.forEach(filePath => {
  if(!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  if(c.charCodeAt(0) === 0xFEFF) c = c.slice(1);

  const original = c;
  replacements.forEach(([re, rep]) => {
    if(typeof rep === 'function') {
      c = c.replace(re, rep);
    } else {
      c = c.replace(re, rep);
    }
  });

  if(c !== original) {
    fs.writeFileSync(filePath, c, 'utf8');
    changed++;
    console.log('✓', filePath.replace(root + '/', '').replace(root + '\\', ''));
  } else {
    console.log('- (unchanged)', filePath.replace(root + '/', '').replace(root + '\\', ''));
  }
});

console.log('\nDone:', changed, 'files updated out of', targets.length);
