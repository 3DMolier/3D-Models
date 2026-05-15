"""
Master fix script — applies all UI/UX corrections in one pass:
 1. Homepage: stats, category images, search, text, about link, favicon, fonts
 2. Catalog: fix category filter JS
 3. Generate model pages without Units Sold / Previews
 4. Global: fonts + favicon on every HTML file
 5. Favicon SVG
 6. About page (stub)
 7. Re-apply base path on new/changed files
"""

import csv, json, os, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = "/3D-Models"

# ──────────────────────────────────────────────────────────────────
# 1. FAVICON
# ──────────────────────────────────────────────────────────────────
FAVICON_SVG = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#00E5C4"/>
  <text x="4" y="23" font-family="Arial,sans-serif" font-weight="bold"
        font-size="16" fill="#07090F">3D</text>
</svg>"""

def write_favicon():
    (ROOT / "favicon.svg").write_text(FAVICON_SVG, encoding="utf-8")
    print("favicon.svg written")

# ──────────────────────────────────────────────────────────────────
# 2. GLOBAL FONT + FAVICON FIX (all HTML files)
# ──────────────────────────────────────────────────────────────────
FONT_REPLACEMENTS = [
    # Google Fonts URL
    ("family=Syne:wght@600;700;800&family=Inter:wght@400;500;600",
     "family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;500;600"),
    ("family=Syne:wght@600;700;800&amp;family=Inter:wght@400;500;600",
     "family=Playfair+Display:wght@600;700;800&amp;family=Open+Sans:wght@400;500;600"),
    # Individual family references in URL
    ("family=Syne",  "family=Playfair+Display"),
    ("family=Inter", "family=Open+Sans"),
    # CSS font-family declarations
    ("'Syne', sans-serif",  "'Playfair Display', serif"),
    ("'Syne',sans-serif",   "'Playfair Display',serif"),
    ("\"Syne\", sans-serif", "\"Playfair Display\", serif"),
    ("\"Syne\",sans-serif",  "\"Playfair Display\",serif"),
    ("'Inter', sans-serif",  "'Open Sans', sans-serif"),
    ("'Inter',sans-serif",   "'Open Sans',sans-serif"),
    ("\"Inter\", sans-serif", "\"Open Sans\", sans-serif"),
    ("\"Inter\",sans-serif",  "\"Open Sans\",sans-serif"),
    # inline style font-family
    ("font-family:'Syne'",         "font-family:'Playfair Display'"),
    ("font-family: 'Syne'",        "font-family: 'Playfair Display'"),
    ("font-family:\"Syne\"",       "font-family:\"Playfair Display\""),
    ("font-family: \"Syne\"",      "font-family: \"Playfair Display\""),
    ("font-family:'Inter'",        "font-family:'Open Sans'"),
    ("font-family: 'Inter'",       "font-family: 'Open Sans'"),
    ("font-family:\"Inter\"",      "font-family:\"Open Sans\""),
    ("font-family: \"Inter\"",     "font-family: \"Open Sans\""),
]

FAVICON_LINK = f'<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml">'

def fix_global(path: Path) -> bool:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False
    original = content

    for old, new in FONT_REPLACEMENTS:
        content = content.replace(old, new)

    if FAVICON_LINK not in content and "</head>" in content:
        content = content.replace("</head>", f"{FAVICON_LINK}\n</head>", 1)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False

def apply_global_fixes():
    files = [
        f for f in ROOT.rglob("*.html")
        if ".git" not in f.parts
        and "node_modules" not in f.parts
        and "temporary" not in str(f)
    ]
    changed = sum(1 for f in files if fix_global(f))
    print(f"Global font+favicon: {changed}/{len(files)} files updated")

# ──────────────────────────────────────────────────────────────────
# 3. HOMEPAGE FIXES
# ──────────────────────────────────────────────────────────────────
HOMEPAGE_CATS = [
    ("Vehicles",             "vehicles",              "🚗", "#4F9EFF",
     "https://static.turbosquid.com/Preview/001214/116/Tesla-Model-3_D_Main.jpg",
     "7,133 models"),
    ("Aircraft",             "aircraft",              "✈️", "#9F7AEA",
     "https://static.turbosquid.com/Preview/001230/754/Airbus-A320-Generic_D_Main.jpg",
     "3,871 models"),
    ("Military Vehicles",    "military-vehicles",     "🪖", "#4ADE80",
     "https://static.turbosquid.com/Preview/001085/902/Sikorsky-Uh-60-Black-Hawk-Us-Military-Utility-Helicopter_D_Main.jpg",
     "1,727 models"),
    ("Ships",                "ships",                 "⚓", "#38BDF8",
     "https://static.turbosquid.com/Preview/001357/949/Qatar-Traditional-Boat_D_Main.jpg",
     "983 models"),
    ("Medical",              "medical-3d-models",     "🧬", "#00E5C4",
     "https://static.turbosquid.com/Preview/001467/539/Male-Full-Body-Anatomy-And-Skin_D_Main.jpg",
     "2,125 models"),
    ("Industrial Equipment", "industrial-equipment",  "⚙️", "#10B981",
     "https://static.turbosquid.com/Preview/000955/965/20-Ft-Iso-Container-White_D_Main.jpg",
     "1,403 models"),
    ("Architecture",         "architecture-landmarks","🏛️", "#F59E0B",
     "https://static.turbosquid.com/Preview/001625/177/Eiffel-Tower_D_Main.jpg",
     "892 models"),
    ("Characters & People",  "characters-people",     "👤", "#8B5CF6",
     "https://static.turbosquid.com/Preview/001103/552/Man-Hands-2-Rigged-For-Cinema-4d_D_Main.jpg",
     "1,241 models"),
]

def make_cat_card(name, slug, icon, color, img, count):
    return f"""      <a href="{BASE}/categories/{slug}/" style="display:block;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);background:#0D1117;text-decoration:none;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 16px 40px rgba(0,0,0,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="position:relative;height:160px;overflow:hidden;background:linear-gradient(135deg,{color}22,{color}08);">
          <img src="{img}" alt="{name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(7,9,15,0.75) 0%,transparent 55%);"></div>
          <span style="position:absolute;bottom:10px;left:12px;font-size:26px;line-height:1;">{icon}</span>
          <span style="position:absolute;top:10px;right:10px;background:{color}22;border:1px solid {color}44;color:{color};font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:0.04em;">{count}</span>
        </div>
        <div style="padding:14px 16px 16px;">
          <div style="font-size:15px;font-weight:700;color:#EDF2FF;margin-bottom:8px;">{name}</div>
          <div style="font-size:13px;font-weight:600;color:#00E5C4;">Explore →</div>
        </div>
      </a>"""

def build_new_cats_grid():
    cards = "\n".join(make_cat_card(*c) for c in HOMEPAGE_CATS)
    return f"""    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">
{cards}
    </div>"""

def fix_homepage():
    path = ROOT / "index.html"
    content = path.read_text(encoding="utf-8")
    original = content

    # 3a. Stats: keep only 88K+
    stats_old = re.search(
        r'<!-- ═+\s*STATS\s*═+ -->\s*<section[^>]*>.*?</section>',
        content, re.DOTALL)
    if stats_old:
        new_stats = (
            '\n<!-- ═══════════════════════════════════════ STATS ════════════════════════════ -->\n'
            '<section style="padding:24px;border-top:1px solid #1E2B44;border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">\n'
            '  <div class="max-w-7xl mx-auto" style="display:flex;justify-content:center;">\n'
            '    <div style="text-align:center;padding:12px 32px;">\n'
            '      <div class="stat-num">88K+</div>\n'
            '      <div style="font-size:13px;color:#7A8DB0;margin-top:4px;font-weight:500;">3D Models on TurboSquid</div>\n'
            '    </div>\n'
            '  </div>\n'
            '</section>\n'
        )
        content = content[:stats_old.start()] + new_stats + content[stats_old.end():]
    else:
        print("WARNING: stats section not found with regex, trying string replace")

    # 3b. Replace category cards grid
    old_grid_start = '    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">'
    old_grid_end_marker = '  </div>\n</section>\n\n<!-- ═'
    gi = content.find(old_grid_start)
    ge = content.find(old_grid_end_marker, gi) if gi >= 0 else -1
    if gi >= 0 and ge >= 0:
        new_grid = build_new_cats_grid()
        content = content[:gi] + new_grid + "\n" + content[ge:]
    else:
        print("WARNING: category grid not found, skipping")

    # 3c. Fix homepage search bar — add JS handler (only if not already present)
    if "/3D-Models/search/?q=" not in content:
        search_js = """
<script>
(function(){
  var inp = document.querySelector('.search-input');
  var btn = document.querySelector('[aria-label="Search"]');
  function go(){ var q=(inp?inp.value:'').trim(); if(q) location.href='""" + BASE + """/search/?q='+encodeURIComponent(q); }
  if(btn) btn.addEventListener('click', go);
  if(inp) inp.addEventListener('keydown', function(e){ if(e.key==='Enter') go(); });
})();
</script>"""
        content = content.replace("</body>", search_js + "\n</body>", 1)

    # 3d. Remove "sales, revenue, CheckMate certification and " text
    content = content.replace(
        "Top models selected by sales, revenue, CheckMate certification and category priority",
        "Top models selected by category priority"
    )
    content = content.replace(
        "sales, revenue, CheckMate certification and ",
        ""
    )

    # 3e. Remove /about/ link from footer
    about_patterns = [
        '<a href="/about/" class="nav-link" style="font-size:12px;">About</a>',
        f'<a href="{BASE}/about/" class="nav-link" style="font-size:12px;">About</a>',
        '<a href="/about/">About</a>',
        f'<a href="{BASE}/about/">About</a>',
    ]
    for p in about_patterns:
        content = content.replace(p, "")

    if content != original:
        path.write_text(content, encoding="utf-8")
        print("index.html: fixed stats, category images, search JS, text, about link")
    else:
        print("WARNING: index.html unchanged — patterns may differ")

# ──────────────────────────────────────────────────────────────────
# 4. CATALOG FILTER FIX
# ──────────────────────────────────────────────────────────────────
def fix_catalog_filter():
    path = ROOT / "catalog" / "index.html"
    content = path.read_text(encoding="utf-8")

    # Replace the click-based cat-pill handler with a change-based one
    old_js = """\
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const cat = pill.dataset.cat;
    if (selCats.has(cat)) {{ selCats.delete(cat); pill.classList.remove('active'); }}
    else {{ selCats.add(cat); pill.classList.add('active'); }}
    applyFilters();
  });
}});"""

    new_js = """\
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    const cat = pill.dataset.cat;
    const cb  = pill.querySelector('input[type="checkbox"]');
    if (selCats.has(cat)) {
      selCats.delete(cat);
      pill.classList.remove('active');
      if (cb) cb.checked = false;
    } else {
      selCats.add(cat);
      pill.classList.add('active');
      if (cb) cb.checked = true;
    }
    applyFilters();
  });
});"""

    # Try both escaped and unescaped variants (f-string escaping in original generator)
    old_escaped = old_js.replace("{", "{{").replace("}", "}}")
    if old_js in content:
        content = content.replace(old_js, new_js)
        path.write_text(content, encoding="utf-8")
        print("catalog/index.html: category filter fixed")
    elif "pill.addEventListener('click'" in content:
        # Patch by finding the specific listener block
        content = re.sub(
            r"document\.querySelectorAll\('\.cat-pill'\)\.forEach\(pill => \{.*?pill\.addEventListener\('click'.*?\}\);\}\);",
            new_js,
            content,
            flags=re.DOTALL
        )
        path.write_text(content, encoding="utf-8")
        print("catalog/index.html: category filter fixed (regex)")
    else:
        print("WARNING: catalog filter pattern not found")

# ──────────────────────────────────────────────────────────────────
# 5. UPDATE MODEL PAGE GENERATOR — remove Units Sold + Previews
# ──────────────────────────────────────────────────────────────────
def update_model_generator():
    path = ROOT / "scripts" / "generate_model_pages.py"
    content = path.read_text(encoding="utf-8")
    original = content

    # Remove sales_qty stat chip (looks like: sales_qty display)
    # The stats grid in model pages shows: sales | full_previews | cert
    # We want to remove the first two, keep only cert

    # Pattern: the stats grid div with sales + previews chips
    # Replace stats grid with cert-only version
    old_stats = re.search(
        r'<div[^>]*class="[^"]*stats-grid[^"]*"[^>]*>.*?</div>\s*<!-- end stats',
        content, re.DOTALL
    )

    # More targeted: find the specific sales/previews chip lines
    # The generator builds something like:
    #   {m['sales_qty']} / Sales
    #   {m['full_previews']} / Previews
    # We want to remove those two stat items

    lines = content.split('\n')
    new_lines = []
    skip_next = False
    for i, line in enumerate(lines):
        if skip_next:
            skip_next = False
            continue
        # Skip lines that render sales_qty or full_previews stat boxes
        if ("sales_qty" in line or "full_previews" in line) and (
            "Sales" in line or "Previews" in line or "stat" in line.lower()
        ):
            # Check if it's inside the hero stats section (not a data access)
            # Heuristic: if it's in an HTML string with <div> patterns
            if '<div' in line or "Sales" in line or "Previews" in line:
                continue
        new_lines.append(line)

    content2 = '\n'.join(new_lines)
    if content2 != content:
        path.write_text(content2, encoding="utf-8")
        print("generate_model_pages.py: removed stats lines")
    else:
        # Fallback: direct string replacement for known patterns
        # These are f-string snippets in the generator
        for pattern in [
            # stat box with sales
            r'\s*<div[^>]*>\s*\{[^}]*sales_qty[^}]*\}[^<]*</div>\s*<div[^>]*>Sales[^<]*</div>',
            r'\s*<div[^>]*>\s*\{[^}]*full_previews[^}]*\}[^<]*</div>\s*<div[^>]*>Previews[^<]*</div>',
        ]:
            content = re.sub(pattern, '', content, flags=re.DOTALL)
        path.write_text(content, encoding="utf-8")
        print("generate_model_pages.py: stats removed via regex fallback")

# ──────────────────────────────────────────────────────────────────
# 6. ABOUT PAGE STUB
# ──────────────────────────────────────────────────────────────────
def write_about_page():
    about_dir = ROOT / "about"
    about_dir.mkdir(exist_ok=True)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>About 3D Molier — Professional 3D Models on TurboSquid</title>
<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  body{{background:#07090F;color:#E8EAF0;font-family:'Open Sans',sans-serif;}}
  .syne{{font-family:'Playfair Display',serif;}}
  nav{{background:rgba(7,9,15,0.9);border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;z-index:50;}}
  .nav-inner{{max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:32px;}}
  .nav-logo{{font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#fff;text-decoration:none;}}
  .nav-logo span{{color:#00E5C4;}}
</style>
</head>
<body>
<nav><div class="nav-inner">
  <a href="{BASE}/" class="nav-logo">3D <span>Molier</span></a>
</div></nav>
<div style="max-width:800px;margin:80px auto;padding:0 24px;">
  <h1 class="syne" style="font-size:48px;font-weight:800;color:#fff;letter-spacing:-0.03em;margin-bottom:24px;">
    About <span style="color:#00E5C4;">3D Molier</span>
  </h1>
  <p style="font-size:17px;color:#9CA3AF;line-height:1.8;margin-bottom:20px;">
    3D Molier is a professional 3D asset studio with 88,000+ models available on TurboSquid.
    We specialize in vehicles, aircraft, military equipment, medical visualization, architecture
    and many other categories.
  </p>
  <p style="font-size:17px;color:#9CA3AF;line-height:1.8;margin-bottom:40px;">
    All models are available for purchase directly on TurboSquid with full commercial licensing.
    The majority of our catalog is CheckMate certified — guaranteeing clean topology and
    production-ready geometry.
  </p>
  <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"
     target="_blank" rel="noopener"
     style="display:inline-block;background:#00E5C4;color:#07090F;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
    View Store on TurboSquid ↗
  </a>
</div>
</body>
</html>"""
    (about_dir / "index.html").write_text(html, encoding="utf-8")
    print("about/index.html written")

# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────
def main():
    print("=== Step 1: favicon ===")
    write_favicon()

    print("\n=== Step 2: homepage fixes ===")
    fix_homepage()

    print("\n=== Step 3: catalog filter fix ===")
    fix_catalog_filter()

    print("\n=== Step 4: about page ===")
    write_about_page()

    print("\n=== Step 5: update model generator ===")
    update_model_generator()

    print("\n=== Step 6: global font + favicon on all existing HTML ===")
    apply_global_fixes()

    print("\nAll fixes done. Next: re-run generate_model_pages.py, then fix_base_path.py")

if __name__ == "__main__":
    main()
