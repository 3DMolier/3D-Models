#!/usr/bin/env python3
"""
Master post-processing script v2.
Fixes: canonical URLs, OG tags, /categories/catalog/ links, nav updates,
Product schema url field, CTA on model pages, aria-labels.
"""
import re, pathlib, csv, json

ROOT = pathlib.Path(__file__).parent.parent
BASE = "https://3dmolierstudio.com"

# ── Helpers ──────────────────────────────────────────────────────────────────

def read_html(p):
    return p.read_text(encoding="utf-8")

def write_html(p, txt):
    p.write_text(txt, encoding="utf-8")

# ── 1. Fix /categories/catalog/ -> /catalog/ (Other slug bug) ────────────────

def fix_catalog_links():
    bad  = "/categories/catalog/"
    good = "/catalog/"
    total = 0
    for p in ROOT.rglob("*.html"):
        txt = read_html(p)
        if bad in txt:
            new = txt.replace(bad, good)
            write_html(p, new)
            total += 1
    print(f"  /categories/catalog/ fix: {total} files updated")

# ── 2. Canonical URLs ─────────────────────────────────────────────────────────

CANONICAL_RE = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]*>', re.IGNORECASE)
CANONICAL_RE2 = re.compile(r'<link[^>]+canonical[^>]*>', re.IGNORECASE)

def url_for_path(rel_path):
    """Compute canonical URL for a given relative path from ROOT."""
    parts = rel_path.replace("\\", "/").split("/")
    # Remove trailing index.html
    if parts and parts[-1] == "index.html":
        parts = parts[:-1]
    if not parts:
        return BASE + "/"
    return BASE + "/" + "/".join(parts) + "/"

def fix_canonicals():
    updated = 0
    for p in ROOT.rglob("*.html"):
        try:
            rel = str(p.relative_to(ROOT))
        except ValueError:
            continue
        canonical_url = url_for_path(rel)
        new_tag = f'<link rel="canonical" href="{canonical_url}">'
        txt = read_html(p)
        # Replace existing canonical
        if CANONICAL_RE.search(txt):
            new = CANONICAL_RE.sub(new_tag, txt)
        elif CANONICAL_RE2.search(txt):
            new = CANONICAL_RE2.sub(new_tag, txt)
        else:
            # Insert before </head>
            new = txt.replace("</head>", new_tag + "\n</head>", 1)
        if new != txt:
            write_html(p, new)
            updated += 1
    print(f"  Canonical URLs: {updated} files updated")

# ── 3. Open Graph tags ────────────────────────────────────────────────────────

OG_RE = re.compile(r'<meta\s+property=["\']og:[^>]+>', re.IGNORECASE)

def get_og_info(p, txt):
    """Extract title, description, image for OG tags from page content."""
    rel = str(p.relative_to(ROOT)).replace("\\", "/")
    canonical_url = url_for_path(str(p.relative_to(ROOT)))

    # Extract existing title
    title_m = re.search(r'<title>([^<]+)</title>', txt)
    title = title_m.group(1).strip() if title_m else "3D Molier"

    # Extract description
    desc_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', txt)
    if not desc_m:
        desc_m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', txt)
    desc = desc_m.group(1).strip() if desc_m else "Professional 3D models by 3D Molier on TurboSquid."

    # Extract image (first proxied image)
    img_m = re.search(r'<img[^>]+src=["\']([^"\']+images\.weserv\.nl[^"\']+)["\']', txt)
    if not img_m:
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+\.(jpg|png|webp))["\']', txt, re.IGNORECASE)
    image_url = img_m.group(1) if img_m else ""

    # Determine type
    og_type = "product" if "/models/" in rel else "website"

    return title, desc, image_url, canonical_url, og_type

def build_og_tags(title, desc, image_url, url, og_type):
    tags = f'''<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">'''
    if image_url:
        tags += f'\n<meta property="og:image" content="{image_url}">'
    tags += '\n<meta property="og:site_name" content="3D Molier">'
    return tags

def fix_og_tags():
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = read_html(p)
        # Remove existing OG tags
        existing_og = OG_RE.findall(txt)
        title, desc, image_url, url, og_type = get_og_info(p, txt)
        new_og = build_og_tags(title, desc, image_url, url, og_type)
        if existing_og:
            # Replace all existing OG tags with the new set (keep only first occurrence)
            txt_clean = OG_RE.sub("", txt)
            # Remove extra blank lines
            txt_clean = re.sub(r'\n\n\n+', '\n\n', txt_clean)
        else:
            txt_clean = txt
        # Insert after </title>
        if "</title>" in txt_clean:
            new = txt_clean.replace("</title>", "</title>\n" + new_og, 1)
        else:
            new = txt_clean.replace("</head>", new_og + "\n</head>", 1)
        if new != txt:
            write_html(p, new)
            updated += 1
    print(f"  OG tags: {updated} files updated")

# ── 4. Product schema - add url field ────────────────────────────────────────

def fix_schema_url():
    updated = 0
    for p in (ROOT / "models").rglob("*.html"):
        rel = str(p.relative_to(ROOT)).replace("\\", "/")
        page_url = url_for_path(str(p.relative_to(ROOT)))
        txt = read_html(p)
        # Find Product schema and add url if missing
        if '"@type": "Product"' in txt or '"@type":"Product"' in txt:
            if '"url":' not in txt:
                # Add url after @type
                new = re.sub(
                    r'("@type"\s*:\s*"Product"\s*,)',
                    f'\\1\n      "url": "{page_url}",',
                    txt
                )
                if new != txt:
                    write_html(p, new)
                    updated += 1
    print(f"  Product schema url: {updated} files updated")

# ── 5. Nav update — add Custom 3D Model link to all pages ────────────────────

NAV_STANDARD = '''<a href="/collections/" class="nav-link">Collections</a>
      <a href="/about/" class="nav-link">About</a>
      <a href="/custom-order/" class="nav-link">Custom Order</a>
      <a href="/contact/" class="nav-link">Contact</a>'''

def fix_nav():
    """Add Custom Order and Contact to nav where missing."""
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = read_html(p)
        changed = False

        # Pattern: nav has Collections but no custom-order
        if '/collections/' in txt and '/custom-order/' not in txt:
            # Find the Collections nav link and add after it
            new = re.sub(
                r'(<a[^>]+href="/collections/"[^>]*>Collections</a>)',
                r'\1\n      <a href="/about/" class="nav-link">About</a>'
                r'\n      <a href="/custom-order/" class="nav-link">Custom Order</a>'
                r'\n      <a href="/contact/" class="nav-link">Contact</a>',
                txt
            )
            if new != txt:
                txt = new
                changed = True

        # Fix simple nav patterns (in about/contact/custom-order pages with inline style nav)
        if '/contact/' in txt and '/custom-order/' not in txt:
            new = txt.replace(
                '<a href="/contact/"',
                '<a href="/custom-order/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Custom Order</a>\n      <a href="/contact/"'
            )
            if new != txt:
                txt = new
                changed = True

        if changed:
            write_html(p, txt)
            updated += 1
    print(f"  Nav update: {updated} files updated")

# ── 6. Add CTA on model pages ─────────────────────────────────────────────────

CTA_CUSTOM = '''<a href="/custom-order/" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 20px;background:rgba(0,229,196,0.08);border:1px solid rgba(0,229,196,0.25);border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;color:#00E5C4;transition:background 0.2s;margin-top:10px;" onmouseover="this.style.background='rgba(0,229,196,0.14)'" onmouseout="this.style.background='rgba(0,229,196,0.08)'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Request Similar Custom Model
              </a>'''

def fix_model_ctas():
    updated = 0
    for p in (ROOT / "models").rglob("*.html"):
        txt = read_html(p)
        # Find Buy on TurboSquid button and add CTA after it
        if "Buy on TurboSquid" in txt and "Request Similar Custom Model" not in txt:
            new = re.sub(
                r'(<a[^>]+class="btn-ts-lg"[^>]*>.*?Buy on TurboSquid.*?</a>)',
                r'\1\n              ' + CTA_CUSTOM.strip(),
                txt,
                flags=re.DOTALL
            )
            if new != txt:
                write_html(p, new)
                updated += 1
    print(f"  Model page CTAs: {updated} files updated")

# ── 7. aria-labels on inputs ──────────────────────────────────────────────────

def fix_aria_labels():
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = read_html(p)
        changed = False

        # Fix search input if no aria-label
        if 'id="search-input"' in txt and 'aria-label' not in txt[txt.find('id="search-input"')-5:txt.find('id="search-input"')+200]:
            new = txt.replace(
                'id="search-input"',
                'id="search-input" aria-label="Search 3D models"'
            )
            if new != txt:
                txt = new
                changed = True

        # Fix sort select
        if 'id="sort-select"' in txt and 'aria-label' not in txt[max(0,txt.find('id="sort-select"')-5):txt.find('id="sort-select"')+200]:
            new = txt.replace(
                'id="sort-select"',
                'id="sort-select" aria-label="Sort models by"'
            )
            if new != txt:
                txt = new
                changed = True

        if changed:
            write_html(p, txt)
            updated += 1
    print(f"  aria-labels: {updated} files updated")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("1. Fixing /categories/catalog/ links...")
    fix_catalog_links()

    print("2. Fixing canonical URLs...")
    fix_canonicals()

    print("3. Adding Open Graph tags...")
    fix_og_tags()

    print("4. Adding url to Product schemas...")
    fix_schema_url()

    print("5. Updating nav (Custom Order link)...")
    fix_nav()

    print("6. Adding CTA on model pages...")
    fix_model_ctas()

    print("7. Fixing aria-labels...")
    fix_aria_labels()

    print("\nAll done!")

if __name__ == "__main__":
    main()
