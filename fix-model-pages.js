const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';
const modelsDir = path.join(root, 'models');

const targets = [];
fs.readdirSync(modelsDir).forEach(sub => {
  const p = path.join(modelsDir, sub, 'index.html');
  if (fs.existsSync(p)) targets.push(p);
});

console.log('Processing', targets.length, 'model pages...');

// Single-line replacements (safe for both LF and CRLF files)
const replacements = [
  // ── BODY ──────────────────────────────────────────────────────────────────
  ['body { background: #07090F; font-family: \'Inter\', sans-serif; color: #EDF2FF; }',
   'body { background: #fafafa; font-family: \'Inter\', sans-serif; color: #111111; }'],

  // ── SCROLLBAR ─────────────────────────────────────────────────────────────
  ['::-webkit-scrollbar-track { background: #07090F; }', '::-webkit-scrollbar-track { background: #fafafa; }'],
  ['::-webkit-scrollbar-thumb { background: #1E2B44; border-radius: 3px; }', '::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }'],

  // ── NAV LINK ──────────────────────────────────────────────────────────────
  ['.nav-link { color: #7A8DB0; font-size: 14px; font-weight: 500; text-decoration: none; padding: 6px 2px; position: relative; transition: color 0.2s; }',
   '.nav-link { color: #6b7280; font-size: 14px; font-weight: 500; text-decoration: none; padding: 6px 2px; position: relative; transition: color 0.2s; }'],
  ['.nav-link::after { content: \'\'; position: absolute; bottom: 0; left: 0; width: 0; height: 1px; background: #00E5C4; transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }',
   '.nav-link::after { content: \'\'; position: absolute; bottom: 0; left: 0; width: 0; height: 1px; background: #111111; transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }'],
  ['.nav-link:hover { color: #EDF2FF; }', '.nav-link:hover { color: #111111; }'],
  ['.nav-link:focus-visible { outline: none; color: #00E5C4; }', '.nav-link:focus-visible { outline: none; color: #111111; }'],

  // ── BTN-PRIMARY (teal → black) ────────────────────────────────────────────
  ['.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #00E5C4; color: #07090F; font-family: \'Inter\', sans-serif; font-weight: 600; font-size: 15px; padding: 13px 28px; border-radius: 8px; transition: background 0.2s, transform 0.15s, box-shadow 0.2s; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 2px 12px rgba(0,229,196,0.3); }',
   '.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #111111; color: #ffffff; font-family: \'Inter\', sans-serif; font-weight: 600; font-size: 15px; padding: 13px 28px; border-radius: 8px; transition: background 0.2s, transform 0.15s; border: none; cursor: pointer; text-decoration: none; }'],
  ['.btn-primary:hover { background: #00CCB0; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.4); }',
   '.btn-primary:hover { background: #333333; transform: translateY(-1px); }'],
  ['.btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.4); }',
   '.btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,0,0,0.15); }'],

  // ── BTN-GHOST ─────────────────────────────────────────────────────────────
  ['.btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #EDF2FF; font-family: \'Inter\', sans-serif; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 8px; border: 1px solid #1E2B44; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }',
   '.btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #111111; font-family: \'Inter\', sans-serif; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 8px; border: 1px solid #e5e5e5; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }'],
  ['.btn-ghost:hover { border-color: rgba(0,229,196,0.4); background: rgba(0,229,196,0.05); transform: translateY(-1px); }',
   '.btn-ghost:hover { border-color: #111111; background: transparent; transform: translateY(-1px); }'],
  ['.btn-ghost:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.25); }',
   '.btn-ghost:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,0,0,0.1); }'],

  // ── BTN-TS-LG (model page TurboSquid button) ─────────────────────────────
  ['.btn-ts-lg { display: inline-flex; align-items: center; gap: 10px; background: rgba(0,229,196,0.1); color: #00E5C4; font-family: \'Inter\', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 22px; border-radius: 8px; border: 1px solid rgba(0,229,196,0.3); cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s; }',
   '.btn-ts-lg { display: inline-flex; align-items: center; gap: 10px; background: #f5f5f5; color: #111111; font-family: \'Inter\', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 22px; border-radius: 8px; border: 1px solid #e5e5e5; cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.15s; }'],
  ['.btn-ts-lg:hover { background: rgba(0,229,196,0.18); border-color: rgba(0,229,196,0.55); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.15); }',
   '.btn-ts-lg:hover { background: #ebebeb; border-color: #d1d5db; transform: translateY(-1px); }'],
  ['.btn-ts-lg:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.3); }',
   '.btn-ts-lg:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,0,0,0.1); }'],

  // ── CHIP ──────────────────────────────────────────────────────────────────
  ['.chip { display: inline-flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid #1E2B44; color: #7A8DB0; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 100px; white-space: nowrap; }',
   '.chip { display: inline-flex; align-items: center; background: #f5f5f5; border: 1px solid #e5e5e5; color: #555555; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 100px; white-space: nowrap; }'],
  ['.chip-teal { background: rgba(0,229,196,0.07); border-color: rgba(0,229,196,0.2); color: #00E5C4; }',
   '.chip-teal { background: #f0f0f0; border-color: #d1d5db; color: #111111; }'],

  // ── SECTION LABEL ─────────────────────────────────────────────────────────
  ['.section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #00E5C4; }',
   '.section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #111111; }'],

  // ── MODEL CARD ────────────────────────────────────────────────────────────
  ['.model-card { background: #0E1220; border: 1px solid #1E2B44; border-radius: 12px; overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.4,0,0.2,1); }',
   '.model-card { background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.4,0,0.2,1); }'],
  ['.model-card:hover { border-color: rgba(0,229,196,0.3); box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,229,196,0.08); transform: translateY(-2px); }',
   '.model-card:hover { border-color: #d1d5db; box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-2px); }'],
  ['.card-glow::before { content: \'\'; position: absolute; inset: -1px; border-radius: inherit; background: linear-gradient(135deg, rgba(0,229,196,0.15) 0%, transparent 50%, rgba(79,107,255,0.08) 100%); opacity: 0; transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); z-index: -1; }',
   '.card-glow::before { content: \'\'; position: absolute; inset: -1px; border-radius: inherit; background: linear-gradient(135deg, rgba(0,0,0,0.03) 0%, transparent 60%); opacity: 0; transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); z-index: -1; }'],

  // ── IMG WRAP ──────────────────────────────────────────────────────────────
  ['.img-wrap::after { content: \'\'; position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.8) 0%, transparent 55%); }',
   '.img-wrap::after { content: \'\'; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 55%); }'],
  ['.img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1); filter: saturate(0.9) brightness(0.95); }',
   '.img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1); }'],

  // ── STAT BOX ──────────────────────────────────────────────────────────────
  ['.stat-box { background: #0E1220; border: 1px solid #1E2B44; border-radius: 10px; padding: 16px 20px; }',
   '.stat-box { background: #ffffff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px 20px; }'],
  ['.stat-box-num { font-family: \'Syne\', sans-serif; font-size: 22px; font-weight: 800; color: #EDF2FF; letter-spacing: -0.03em; line-height: 1; }',
   '.stat-box-num { font-family: \'Syne\', sans-serif; font-size: 22px; font-weight: 800; color: #111111; letter-spacing: -0.03em; line-height: 1; }'],
  ['.stat-box-label { font-size: 11px; color: #7A8DB0; margin-top: 4px; font-weight: 500; }',
   '.stat-box-label { font-size: 11px; color: #6b7280; margin-top: 4px; font-weight: 500; }'],

  // ── HERO IMAGE FRAME ──────────────────────────────────────────────────────
  ['.hero-img-frame img { width: 100%; height: 100%; object-fit: cover; display: block; filter: saturate(0.95) brightness(0.9); }',
   '.hero-img-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }'],
  ['.hero-img-frame::after { content: \'\'; position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.7) 0%, transparent 50%); pointer-events: none; }',
   '.hero-img-frame::after { content: \'\'; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 50%); pointer-events: none; }'],

  // ── BODY::BEFORE (grain overlay) ──────────────────────────────────────────
  ['opacity: 0.4;', 'opacity: 0;'],  // NOTE: only applied to body::before context — be careful

  // ── NAV HEADER (HTML — dark bg) ───────────────────────────────────────────
  ['<header class="sticky top-0 z-50" style="border-bottom:1px solid #1E2B44;background:rgba(7,9,15,0.85);backdrop-filter:blur(16px);">',
   '<header style="position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);border-bottom:1px solid #e5e5e5;">'],

  // ── NAV INNER (utility classes) ───────────────────────────────────────────
  ['<nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">',
   '<nav style="max-width:1280px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:32px;">'],
  ['<a href="/3D-Models/" class="flex items-center gap-2.5 shrink-0" style="text-decoration:none;">',
   '<a href="/3D-Models/" style="display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none;">'],
  ['<div class="hidden md:flex items-center gap-6">',
   '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'],
  ['<div class="flex items-center gap-3 shrink-0">',
   '<div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">'],

  // ── LOGO BOX GRADIENT → solid black ──────────────────────────────────────
  ['background:linear-gradient(135deg,#00E5C4,#0099FF)',
   'background:#111111'],
  // Logo text color
  ['color:#EDF2FF;">3D Molier</span>', 'color:#111111;">3D Molier</span>'],

  // ── BREADCRUMB ────────────────────────────────────────────────────────────
  ['<div style="border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">',
   '<div style="border-bottom:1px solid #e5e5e5;background:#ffffff;">'],
  // Breadcrumb inner (uses utility class for max-width)
  ['class="max-w-7xl mx-auto px-6 py-3" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#7A8DB0;flex-wrap:wrap;"',
   'style="max-width:1280px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:8px;font-size:13px;color:#6b7280;flex-wrap:wrap;"'],
  // Breadcrumb link colors
  ['style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color=\'#EDF2FF\'" onmouseout="this.style.color=\'#7A8DB0\'"',
   'style="color:#6b7280;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color=\'#111111\'" onmouseout="this.style.color=\'#6b7280\'"'],
  // Breadcrumb separator
  ['<span style="color:#1E2B44;">&#8250;</span>', '<span style="color:#d1d5db;">›</span>'],
  // Breadcrumb current page (white text → dark)
  ['style="color:#EDF2FF;white-space:nowrap', 'style="color:#111111;white-space:nowrap'],

  // ── SECTION BORDERS (inline) ──────────────────────────────────────────────
  ['border-bottom:1px solid #1E2B44', 'border-bottom:1px solid #e5e5e5'],
  ['border-top:1px solid #1E2B44', 'border-top:1px solid #e5e5e5'],

  // ── HERO IMAGE PLACEHOLDER (dark → light) ─────────────────────────────────
  ['background:linear-gradient(135deg,#0D1A28 0%,#0D2030 50%,#0A1520 100%)',
   'background:#f5f5f5'],

  // ── TEXT COLORS (inline) ─────────────────────────────────────────────────
  ['color:#EDF2FF;line-height:1.15', 'color:#111111;line-height:1.15'],  // h1 heading
  ['color:#EDF2FF;letter-spacing:-0.04em', 'color:#111111;letter-spacing:-0.04em'],  // price
  ['color:#C8D4EE;line-height:1.8', 'color:#6b7280;line-height:1.8'],  // description text
  ['color:#7A8DB0;font-weight:500;">', 'color:#6b7280;font-weight:500;">'],  // muted text
  ['color:#4A5C7A;text-transform:uppercase', 'color:#6b7280;text-transform:uppercase'],  // section subheadings
  ['color:#4A5C7A;">', 'color:#6b7280;">'],  // chip keyword text

  // ── INLINE COLOR: #7A8DB0 → #6b7280 (various instances) ──────────────────
  [/;color:#7A8DB0;/g, ';color:#6b7280;'],
  [/color:#7A8DB0;">/, 'color:#6b7280;">'],

  // ── FOOTER (dark → stays dark but fix text) ───────────────────────────────
  // Footer logo text (white text on dark footer is OK, but logo span might show black-on-black)
  // Footer text already uses #6b7280 which is readable on dark
];

let changed = 0;

targets.forEach((filePath, idx) => {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.charCodeAt(0) === 0xFEFF) c = c.slice(1);
  const orig = c;

  replacements.forEach(rep => {
    if (Array.isArray(rep) && rep.length === 2) {
      const [from, to] = rep;
      if (from instanceof RegExp) {
        c = c.replace(from, to);
      } else {
        c = c.replace(from, to);
      }
    }
  });

  // Fix h1 color (model title)
  c = c.replace(/font-weight:800;letter-spacing:-0\.03em;color:#EDF2FF;line-height/g,
    'font-weight:800;letter-spacing:-0.03em;color:#111111;line-height');

  // Fix price color
  c = c.replace(/font-size:36px;font-weight:800;color:#EDF2FF;letter-spacing/g,
    'font-size:36px;font-weight:800;color:#111111;letter-spacing');

  // Fix remaining EDF2FF (white) → dark
  c = c.replace(/color:#EDF2FF/g, 'color:#111111');
  c = c.replace(/color: #EDF2FF/g, 'color: #111111');

  // Fix image placeholder fallback text color (was #4F9EFF blue)
  c = c.replace(/color:#4F9EFF;opacity:0\.7/g, 'color:#6b7280;opacity:0.7');

  // Fix footer grid (max-w-7xl utility class)
  c = c.replace('<div class="max-w-7xl mx-auto">', '<div style="max-width:1280px;margin:0 auto;">');

  // Fix footer logo text color on dark footer
  c = c.replace(
    '<span style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:#111111;">3D Molier</span>',
    '<span style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:#ffffff;">3D Molier</span>'
  );

  // Fix footer copyright text
  c = c.replace('<p style="font-size:12px;color:#6b7280;">', '<p style="font-size:12px;color:rgba(255,255,255,0.5);">');

  // Fix footer inner border on dark bg
  c = c.replace(
    'border-top:1px solid #e5e5e5;padding-top:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;',
    'border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;'
  );

  if (c !== orig) {
    fs.writeFileSync(filePath, c, 'utf8');
    changed++;
    if (changed <= 5 || changed % 100 === 0) {
      console.log(`✓ [${changed}/${targets.length}]`, path.relative(root, filePath).replace(/\\/g, '/').split('/').pop());
    }
  }
});

console.log('\nDone:', changed, 'files updated out of', targets.length);
