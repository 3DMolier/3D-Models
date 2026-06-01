#!/usr/bin/env python3
"""
master_fixes_v3.py — Comprehensive automated fixes:
1. Remove duplicate About link from homepage nav
2. Fix copyright 2024/2025 -> 2026
3. Fix collection breadcrumbs (/ -> /)
4. Add og:image fallback to pages missing it
5. Fix Product.url on 1000 model pages
6. Add aria-labels to catalog/search inputs
"""
import re, pathlib

ROOT = pathlib.Path(__file__).parent.parent
BASE = "https://3dmolierstudio.com"
OG_FALLBACK = f"{BASE}/assets/og/3d-molier-og.jpg"

def read(p):
    return p.read_text(encoding="utf-8")

def write(p, txt):
    p.write_text(txt, encoding="utf-8")

# ── 1. Remove duplicate About from homepage nav ──────────────────────────────

def fix_homepage_nav_duplicate():
    p = ROOT / "index.html"
    txt = read(p)
    # The duplicate: two identical About links close together
    # Keep the first, remove the second
    first  = '<a href="/about/" class="nav-link">About</a>\n      <a href="/custom-order/" class="nav-link">Custom Order</a>'
    bad    = '<a href="/about/" class="nav-link">About</a>\n      <a href="/contact/" class="nav-link">Contact</a>\n      <a href="/about/" class="nav-link">About</a>'
    if bad in txt:
        good = '<a href="/about/" class="nav-link">About</a>\n      <a href="/contact/" class="nav-link">Contact</a>'
        write(p, txt.replace(bad, good))
        print("  Homepage nav: removed duplicate About link")
        return
    # Broader fallback — find any second occurrence of About nav link
    count = txt.count('<a href="/about/" class="nav-link">About</a>')
    if count > 1:
        # Remove last occurrence
        idx = txt.rfind('<a href="/about/" class="nav-link">About</a>')
        new = txt[:idx] + txt[idx:].replace('<a href="/about/" class="nav-link">About</a>', '', 1)
        write(p, new)
        print("  Homepage nav: removed duplicate About link (fallback)")
    else:
        print("  Homepage nav: no duplicate found")

# ── 2. Fix copyright year ─────────────────────────────────────────────────────

def fix_copyright():
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = read(p)
        new = txt.replace("© 2024 3D Molier", "© 2026 3D Molier")
        new = new.replace("© 2025 3D Molier", "© 2026 3D Molier")
        if new != txt:
            write(p, new)
            updated += 1
    print(f"  Copyright fix: {updated} files updated")

# ── 3. Fix collection breadcrumbs ─────────────────────────────────────────────

def fix_collection_breadcrumbs():
    updated = 0
    for p in (ROOT / "collections").rglob("*.html"):
        txt = read(p)
        new = txt
        # Fix Home breadcrumb link
        new = new.replace('href="/" style="color:#7A8DB0', 'href="/" style="color:#7A8DB0')
        # Fix Collections breadcrumb link
        new = new.replace('href="/collections/" style="color:#7A8DB0', 'href="/collections/" style="color:#7A8DB0')
        if new != txt:
            write(p, new)
            updated += 1
    print(f"  Collection breadcrumbs: {updated} files updated")

    # Also fix the generator
    gen = ROOT / "scripts" / "generate_collection_pages.py"
    gt = read(gen)
    gn = gt.replace('href="/" style="color:#7A8DB0', 'href="/" style="color:#7A8DB0')
    gn = gn.replace('href="/collections/" style="color:#7A8DB0', 'href="/collections/" style="color:#7A8DB0')
    if gn != gt:
        write(gen, gn)
        print("  Generator breadcrumbs: fixed")

# ── 4. Add og:image fallback to pages missing it ─────────────────────────────

PAGES_MISSING_OG_IMAGE = [
    "404.html",
    "about/index.html",
    "collections/index.html",
    "contact/index.html",
    "custom-order/index.html",
    "search/index.html",
    "industries/advertising/index.html",
    "industries/aerospace/index.html",
    "industries/architecture/index.html",
    "industries/film-video-production/index.html",
    "industries/game-development/index.html",
    "industries/medical/index.html",
    "industries/military-defense/index.html",
    "industries/virtual-reality/index.html",
    "categories/weapons-tools/index.html",
    # New pages (may not exist yet, handled gracefully)
    "industries/softwaredevelopment/index.html",
    "industries/eventmanagement/index.html",
    "industries/hardware/index.html",
    "industries/3dprinting/index.html",
    "categories/other/index.html",
]

def fix_og_image():
    tag = f'<meta property="og:image" content="{OG_FALLBACK}">'
    updated = 0
    for rel in PAGES_MISSING_OG_IMAGE:
        p = ROOT / rel
        if not p.exists():
            continue
        txt = read(p)
        if 'property="og:image"' in txt:
            continue
        # Insert after og:url or og:site_name or before </head>
        if 'property="og:site_name"' in txt:
            new = txt.replace(
                '<meta property="og:site_name"',
                tag + '\n<meta property="og:site_name"', 1)
        elif '</head>' in txt:
            new = txt.replace('</head>', tag + '\n</head>', 1)
        else:
            continue
        if new != txt:
            write(p, new)
            updated += 1
    print(f"  og:image fallback: {updated} files updated")

# ── 5. Fix Product.url on 1000 model pages ───────────────────────────────────

def fix_product_url():
    updated = 0
    for p in (ROOT / "models").rglob("index.html"):
        txt = read(p)
        # Skip if url field already exists in the Product schema context
        # Check if Product schema exists but has no url field right after @type
        if '"@type": "Product"' not in txt and '"@type":"Product"' not in txt:
            continue
        if '"url": "https://3dmolier.github.io' in txt:
            continue
        # Derive the canonical URL from the path
        rel = str(p.relative_to(ROOT)).replace("\\", "/")
        parts = rel.split("/")
        if parts[-1] == "index.html":
            parts = parts[:-1]
        page_url = BASE + "/" + "/".join(parts) + "/"
        # Add url field after "@type": "Product"
        new = re.sub(
            r'("@type"\s*:\s*"Product"\s*,)',
            f'\\1\n      "url": "{page_url}",',
            txt
        )
        if new != txt:
            write(p, new)
            updated += 1
    print(f"  Product.url: {updated} files updated")

# ── 6. Add aria-labels to catalog/search inputs ──────────────────────────────

def fix_aria_labels():
    updated = 0
    targets = [
        ROOT / "catalog" / "index.html",
        ROOT / "search" / "index.html",
    ]
    for p in targets:
        if not p.exists():
            continue
        txt = read(p)
        changed = False
        # Search input
        if 'id="search-input"' in txt and 'aria-label="Search' not in txt:
            txt = txt.replace(
                'id="search-input"',
                'id="search-input" aria-label="Search 3D models"'
            )
            changed = True
        # Sort select
        if 'id="sort-select"' in txt and 'aria-label="Sort' not in txt:
            txt = txt.replace(
                'id="sort-select"',
                'id="sort-select" aria-label="Sort models by"'
            )
            changed = True
        # Category filter (catalog sidebar)
        if 'id="cat-all"' in txt and 'aria-label=' not in txt[txt.find('id="cat-all"')-5:txt.find('id="cat-all"')+100]:
            txt = txt.replace('id="cat-all"', 'id="cat-all" aria-label="Show all categories"')
            changed = True
        if changed:
            write(p, txt)
            updated += 1
    print(f"  Aria-labels: {updated} files updated")

# ── 7. Fix footer copyright in catalog and search (they use different pattern) ─

def fix_catalog_footer_year():
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = read(p)
        new = txt
        # Match any year pattern in footer copyright statements
        new = re.sub(r'© (2024|2025) 3D Molier', '© 2026 3D Molier', new)
        if new != txt:
            write(p, new)
            updated += 1
    print(f"  Copyright (regex): {updated} files updated")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("1. Fixing homepage nav duplicate...")
    fix_homepage_nav_duplicate()

    print("2. Fixing copyright year...")
    fix_catalog_footer_year()

    print("3. Fixing collection breadcrumbs...")
    fix_collection_breadcrumbs()

    print("4. Adding og:image fallback...")
    fix_og_image()

    print("5. Fixing Product.url in model pages...")
    fix_product_url()

    print("6. Fixing aria-labels...")
    fix_aria_labels()

    print("\nAll done!")

if __name__ == "__main__":
    main()
