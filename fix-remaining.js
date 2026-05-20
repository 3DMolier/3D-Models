const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';

// ── PAGE LISTS ────────────────────────────────────────────────────────────────
const catColPages = [];
['categories','collections'].forEach(dir => {
  const d = path.join(root, dir);
  fs.readdirSync(d).forEach(sub => {
    const p = path.join(d, sub, 'index.html');
    if (fs.existsSync(p)) catColPages.push(p);
  });
});
catColPages.push(path.join(root, 'collections', 'index.html'));

const industryPages = [];
const indDir = path.join(root, 'industries');
fs.readdirSync(indDir).forEach(sub => {
  const p = path.join(indDir, sub, 'index.html');
  if (fs.existsSync(p)) industryPages.push(p);
});

const page404 = path.join(root, '404.html');

let changed = 0;

// ── HELPER ────────────────────────────────────────────────────────────────────
function save(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  changed++;
  console.log('✓', path.relative(root, filePath).replace(/\\/g, '/'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CATEGORY + COLLECTION PAGES — nav + remaining dark inline styles
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\nFixing ${catColPages.length} category/collection pages...`);

catColPages.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  const orig = c;

  // ── NAV: replace utility class attributes with inline styles ──────────────
  c = c.replace(
    '<header class="sticky top-0 z-50 border-b border-[#1E2B44]" style="background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);">',
    '<header style="position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);border-bottom:1px solid #e5e5e5;">'
  );
  c = c.replace(
    '<nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">',
    '<nav style="max-width:1280px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:32px;">'
  );
  c = c.replace(
    '<a href="/3D-Models/" class="flex items-center gap-2.5 shrink-0" style="text-decoration:none;">',
    '<a href="/3D-Models/" style="display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none;">'
  );
  c = c.replace(
    '<div class="hidden md:flex items-center gap-6">',
    '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'
  );
  c = c.replace(
    '<div class="flex items-center gap-3 shrink-0">',
    '<div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">'
  );

  // ── BREADCRUMB ────────────────────────────────────────────────────────────
  c = c.replace(
    '<div style="border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">',
    '<div style="border-bottom:1px solid #e5e5e5;background:#ffffff;">'
  );
  // Breadcrumb inner div with max-w-7xl utility class
  c = c.replace(
    /class="max-w-7xl mx-auto px-6 py-3" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6b7280;"/g,
    'style="max-width:1280px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:8px;font-size:13px;color:#6b7280;"'
  );
  // Separator arrows
  c = c.replace(/<span style="color:#1E2B44;">›<\/span>/g, '<span style="color:#d1d5db;">›</span>');
  // Hover events (white text on hover is invisible on light bg)
  c = c.replace(/onmouseover="this\.style\.color='#EDF2FF'"/g, "onmouseover=\"this.style.color='#111111'\"");
  c = c.replace(/onmouseout="this\.style\.color='#7A8DB0'"/g, "onmouseout=\"this.style.color='#6b7280'\"");

  // ── DARK BORDERS (inline HTML) ────────────────────────────────────────────
  c = c.replace(/border-bottom:1px solid #1E2B44/g, 'border-bottom:1px solid #e5e5e5');
  c = c.replace(/border-top:1px solid #1E2B44/g, 'border-top:1px solid #e5e5e5');
  c = c.replace(/border:1px solid #1E2B44/g, 'border:1px solid #e5e5e5');

  // ── STATS GRID GAP (dark separator between grid cells) ────────────────────
  c = c.replace(/gap:1px;background:#1E2B44;/g, 'gap:1px;background:#e5e5e5;');

  // ── LOGO BOX GRADIENT → solid black ──────────────────────────────────────
  c = c.replace(/background:linear-gradient\(135deg,#00E5C4,#0099FF\)/g, 'background:#111111');

  // ── ICON BOXES (teal bg) → neutral ───────────────────────────────────────
  c = c.replace(/background:rgba\(0,229,196,0\.08\);border:1px solid rgba\(0,229,196,0\.2\)/g,
    'background:#f5f5f5;border:1px solid #e5e5e5');
  c = c.replace(/background: rgba\(0,229,196,0\.08\); border: 1px solid rgba\(0,229,196,0\.2\)/g,
    'background: #f5f5f5; border: 1px solid #e5e5e5');

  // ── REMAINING DARK BACKGROUNDS ────────────────────────────────────────────
  c = c.replace(/background:rgba\(14,18,32,0\.[3-9]\)/g, 'background:#f5f5f5');
  c = c.replace(/background: rgba\(14,18,32,0\.[3-9]\)/g, 'background: #f5f5f5');

  // ── CSS STYLE BLOCK — btn-ts teal → neutral ───────────────────────────────
  c = c.replace('background: rgba(0,229,196,0.1); color: #111111;', 'background: #f5f5f5; color: #111111;');
  c = c.replace('border: 1px solid rgba(0,229,196,0.25); cursor: pointer;', 'border: 1px solid #e5e5e5; cursor: pointer;');
  c = c.replace('background: rgba(0,229,196,0.18); border-color: rgba(0,229,196,0.5); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,229,196,0.15);',
    'background: #ebebeb; border-color: #d1d5db; transform: translateY(-1px); box-shadow: none;');
  c = c.replace('box-shadow: 0 0 0 3px rgba(0,229,196,0.3);', 'box-shadow: 0 0 0 3px rgba(0,0,0,0.1);');

  // ── btn-ghost hover teal → neutral ────────────────────────────────────────
  c = c.replace('border-color: rgba(0,229,196,0.4); background: rgba(0,229,196,0.05); transform: translateY(-1px);',
    'border-color: #111111; background: transparent; transform: translateY(-1px);');
  c = c.replace('box-shadow: 0 0 0 3px rgba(0,229,196,0.25);', 'box-shadow: 0 0 0 3px rgba(0,0,0,0.1);');

  // ── btn-primary focus teal → neutral ──────────────────────────────────────
  c = c.replace('box-shadow: 0 0 0 3px rgba(0,229,196,0.4);', 'box-shadow: 0 0 0 3px rgba(0,0,0,0.15);');

  // ── model-card hover teal → neutral ───────────────────────────────────────
  c = c.replace('border-color: rgba(0,229,196,0.3);', 'border-color: #d1d5db;');
  c = c.replace('0 2px 8px rgba(0,229,196,0.08)', '0 2px 8px rgba(0,0,0,0.04)');
  c = c.replace('box-shadow: 0 0 0 2px rgba(0,229,196,0.4);', 'box-shadow: 0 0 0 2px rgba(0,0,0,0.1);');
  // model-card hover dark shadow → lighter
  c = c.replace('0 8px 40px rgba(0,0,0,0.5),', '0 8px 32px rgba(0,0,0,0.1),');

  // ── related-card hover teal → neutral ─────────────────────────────────────
  c = c.replace('border-color: rgba(0,229,196,0.35); transform: translateY(-2px);',
    'border-color: #d1d5db; transform: translateY(-2px);');
  c = c.replace('box-shadow: 0 0 0 2px rgba(0,229,196,0.5);', 'box-shadow: 0 0 0 2px rgba(0,0,0,0.1);');

  // ── card-glow teal gradient → subtle ─────────────────────────────────────
  c = c.replace('background: linear-gradient(135deg, rgba(0,229,196,0.15) 0%, transparent 50%, rgba(79,107,255,0.08) 100%);',
    'background: linear-gradient(135deg, rgba(0,0,0,0.04) 0%, transparent 60%);');

  // ── img-wrap dark gradient → lighter ─────────────────────────────────────
  c = c.replace('background: linear-gradient(to top, rgba(7,9,15,0.8) 0%, transparent 55%);',
    'background: linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 55%);');

  // ── footer: fix logo text color (black text on black footer) ─────────────
  // Footer has background:#111111 but logo span has color:#111111 (invisible)
  // The footer logo span is after the 28px icon div
  c = c.replace(
    '<span style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:#111111;">3D Molier</span>',
    '<span style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:#ffffff;">3D Molier</span>'
  );
  // Also footer has nav-link CSS which gives color:#6b7280 — that works on dark footer (gray on black is readable)
  // Footer inner border should be white-ish on dark bg
  c = c.replace(
    '<div style="border-top:1px solid #e5e5e5;padding-top:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">',
    '<div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
  );
  // Footer nav-links need to be visible on dark bg: override nav-link color in footer
  // The footer uses class="nav-link" links; nav-link color is #6b7280 (readable on dark)
  // The footer copyright text
  c = c.replace(
    '<p style="font-size:12px;color:#6b7280;">',
    '<p style="font-size:12px;color:rgba(255,255,255,0.5);">'
  );

  // ── footer: max-w-7xl → inline max-width ─────────────────────────────────
  c = c.replace(
    '<footer style="border-top:1px solid #e5e5e5;padding:48px 24px 32px;background:#111111;">\n  <div class="max-w-7xl mx-auto">',
    '<footer style="border-top:1px solid #e5e5e5;padding:48px 24px 32px;background:#111111;">\n  <div style="max-width:1280px;margin:0 auto;">'
  );

  if (c !== orig) save(filePath, c);
  else console.log('- (no change)', path.relative(root, filePath).replace(/\\/g, '/'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INDUSTRY PAGES — fix blue accent + broken dark-theme CSS
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\nFixing ${industryPages.length} industry pages...`);

industryPages.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  const orig = c;

  // body text color (off-white → dark)
  c = c.replace('color:#E8EAF0;font-family:', 'color:#111111;font-family:');
  c = c.replace('color: #E8EAF0; font-family:', 'color: #111111; font-family:');

  // .btn blue → black
  c = c.replace('background:#4F9EFF;color:#07090F;', 'background:#111111;color:#ffffff;');
  c = c.replace('background: #4F9EFF; color: #07090F;', 'background: #111111; color: #ffffff;');

  // .btn-ghost transparent border/color → solid light
  c = c.replace('border:1px solid rgba(255,255,255,.15);color:#E8EAF0;', 'border:1px solid #d1d5db;color:#111111;');
  c = c.replace('border: 1px solid rgba(255,255,255,.15); color: #E8EAF0;', 'border: 1px solid #d1d5db; color: #111111;');
  c = c.replace('border:1px solid rgba(255,255,255,0.15);color:#E8EAF0;', 'border:1px solid #d1d5db;color:#111111;');
  c = c.replace('border-color:rgba(255,255,255,.3);', 'border-color:#111111;');
  c = c.replace('border-color: rgba(255,255,255,.3);', 'border-color: #111111;');
  c = c.replace('border-color:rgba(255,255,255,0.3);', 'border-color:#111111;');

  // .accent blue → dark
  c = c.replace('.accent{color:#4F9EFF;}', '.accent{color:#111111;}');
  c = c.replace('.accent { color: #4F9EFF; }', '.accent { color: #111111; }');
  c = c.replace('color:#4F9EFF;margin-bottom:12px', 'color:#6b7280;margin-bottom:12px');
  c = c.replace('color: #4F9EFF; margin-bottom: 12px', 'color: #6b7280; margin-bottom: 12px');

  // .tag blue → neutral
  c = c.replace('background:#4F9EFF22;color:#4F9EFF;border:1px solid #4F9EFF33;', 'background:#f5f5f5;color:#555555;border:1px solid #e5e5e5;');
  c = c.replace('background: #4F9EFF22; color: #4F9EFF; border: 1px solid #4F9EFF33;', 'background: #f5f5f5; color: #555555; border: 1px solid #e5e5e5;');

  // .model-card hover blue → neutral
  c = c.replace('border-color:#4F9EFF44;', 'border-color:#d1d5db;');
  c = c.replace('border-color: #4F9EFF44;', 'border-color: #d1d5db;');

  if (c !== orig) save(filePath, c);
  else console.log('- (no change)', path.relative(root, filePath).replace(/\\/g, '/'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 404 PAGE — fix CSS variables not updated by batch script
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\nFixing 404.html...');

if (fs.existsSync(page404)) {
  let c = fs.readFileSync(page404, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  const orig = c;

  // CSS variables
  c = c.replace('--teal: #00E5C4;', '--teal: #111111;');
  c = c.replace('--bg: #07090F;', '--bg: #fafafa;');
  c = c.replace('--surface: #0D1117;', '--surface: #ffffff;');
  c = c.replace('--border: rgba(255,255,255,0.07);', '--border: #e5e5e5;');

  // body text color
  c = c.replace('color: #E8EAF0; font-family:', 'color: #111111; font-family:');
  c = c.replace('color: #E8EAF0;font-family:', 'color: #111111;font-family:');

  // btn-ghost color fix
  c = c.replace('border: 1px solid var(--border); color: #E8EAF0;', 'border: 1px solid var(--border); color: #111111;');
  c = c.replace('border-color: rgba(255,255,255,0.2);', 'border-color: #111111;');

  // 404 code text: teal gradient → use black with gradient
  c = c.replace(
    'background: linear-gradient(135deg, var(--teal), #0099FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;',
    'color: #111111;'
  );

  if (c !== orig) save(page404, c);
  else console.log('- (no change) 404.html');
}

console.log('\nDone:', changed, 'files updated');
