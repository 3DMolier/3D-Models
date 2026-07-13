#!/usr/bin/env python3
"""Creates categories/other page + 4 new industry pages."""
import pathlib, csv

ROOT = pathlib.Path(__file__).parent.parent
BASE = "https://3dmolierstudio.com"
PROXY = "https://images.weserv.nl/?url="

NAV = '''<nav style="background:rgba(7,9,15,0.95);border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;z-index:50;">
  <div style="max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:32px;">
    <a href="/" style="font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#fff;text-decoration:none;letter-spacing:-0.02em;">3D <span style="color:#00E5C4;">Molier</span></a>
    <div style="display:flex;gap:20px;margin-left:auto;flex-wrap:wrap;">
      <a href="/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Home</a>
      <a href="/catalog/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Catalog</a>
      <a href="/search/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Search</a>
      <a href="/about/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">About</a>
      <a href="/custom-order/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Custom Order</a>
      <a href="/contact/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Contact</a>
    </div>
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener"
       style="background:#00E5C4;color:#07090F;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;">TurboSquid</a>
  </div>
</nav>'''

FOOTER = '''<footer style="background:#0D1117;border-top:1px solid rgba(255,255,255,0.07);padding:32px 24px;margin-top:80px;">
  <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <p style="color:#6B7280;font-size:13px;">© 2026 3D Molier. All models on TurboSquid.</p>
    <div style="display:flex;gap:20px;">
      <a href="/about/" style="color:#6B7280;font-size:13px;text-decoration:none;">About</a>
      <a href="/contact/" style="color:#6B7280;font-size:13px;text-decoration:none;">Contact</a>
      <a href="/custom-order/" style="color:#6B7280;font-size:13px;text-decoration:none;">Custom Order</a>
    </div>
  </div>
</footer>'''

BASE_CSS = '''<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#07090F;color:#E8EAF0;font-family:'Open Sans',sans-serif;font-size:15px;line-height:1.7;}
  h1,h2,h3{font-family:'Playfair Display',serif;letter-spacing:-0.02em;color:#fff;}
  .btn{display:inline-block;background:{COLOR};color:#07090F;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;transition:opacity .2s;}
  .btn:hover{opacity:.88;}
  .btn-ghost{display:inline-block;border:1px solid rgba(255,255,255,.15);color:#E8EAF0;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;transition:border-color .2s;}
  .btn-ghost:hover{border-color:rgba(255,255,255,.3);}
  .card{background:#0D1117;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px 28px;}
  .model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
  .model-card{background:#0D1117;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;text-decoration:none;display:block;transition:transform .2s,border-color .2s;}
  .model-card:hover{transform:translateY(-3px);border-color:{COLOR}44;}
  .model-card img{width:100%;height:150px;object-fit:cover;display:block;}
  .model-card-body{padding:10px 12px;}
  .model-card-name{font-size:12px;font-weight:600;color:#EDF2FF;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .model-card-price{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:#fff;}
  .tag{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:{COLOR}22;color:{COLOR};border:1px solid {COLOR}33;}
</style>'''

def get_models_for(category_name, limit=6):
    rows = []
    csv_path = ROOT / "data" / "top_models.csv"
    if not csv_path.exists():
        return rows
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("category", "").strip() == category_name:
                rows.append(row)
    rows.sort(key=lambda r: float(r.get("priority_score", 0) or 0), reverse=True)
    return rows[:limit]

def model_card(m, color):
    img = m.get("image_url", "")
    if img and img.startswith("https://static.turbosquid"):
        img = PROXY + img.replace("https://", "") + "&w=400&q=80&output=webp"
    slug = m.get("slug", "")
    name = m.get("product_name", "Unknown")
    price = m.get("price", "")
    try:
        price = f"${float(price):.0f}" if price else ""
    except:
        price = f"${price}" if price else ""
    img_html = f'<img src="{img}" alt="{name} 3D model" loading="lazy">' if img else f'<div style="height:150px;background:#131A22;display:flex;align-items:center;justify-content:center;color:#374151;font-size:12px;">No Image</div>'
    return f'''<a href="/models/{slug}/" class="model-card">
  {img_html}
  <div class="model-card-body">
    <div class="model-card-name">{name}</div>
    <div class="model-card-price">{price}</div>
  </div>
</a>'''

# ── categories/other ─────────────────────────────────────────────────────────

def create_other_category():
    color = "#00E5C4"
    models = get_models_for("Other", 12)
    models_html = "".join(model_card(m, color) for m in models)

    css = BASE_CSS.replace("{COLOR}", color)
    canonical = f"{BASE}/categories/other/"

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Other 3D Models — Miscellaneous Assets | 3D Molier</title>
<meta name="description" content="Browse miscellaneous and other 3D models by 3D Molier. Includes props, objects, and specialty assets for various projects.">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="Other 3D Models — Miscellaneous Assets | 3D Molier">
<meta property="og:description" content="Browse miscellaneous and other 3D models by 3D Molier. Includes props, objects, and specialty assets for various projects.">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/assets/og/3d-molier-og.jpg">
<meta property="og:site_name" content="3D Molier">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Open+Sans:wght@400;500&display=swap" rel="stylesheet">
{css}
</head>
<body>
{NAV}
<main style="max-width:1200px;margin:0 auto;padding:48px 24px 80px;">

  <div style="margin-bottom:40px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{color};margin-bottom:10px;">Category</div>
    <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;line-height:1.1;margin-bottom:16px;">Other 3D Models</h1>
    <p style="color:#9CA3AF;font-size:16px;max-width:640px;line-height:1.8;">
      A collection of miscellaneous 3D models covering specialty props, unique objects, and diverse assets that don't fit neatly into major categories. Ideal for scene dressing, product visualization, and creative projects.
    </p>
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:40px;">
    <span class="tag">Props</span>
    <span class="tag">Objects</span>
    <span class="tag">Specialty Assets</span>
    <span class="tag">Scene Dressing</span>
    <span class="tag">Product Viz</span>
  </div>

  <h2 style="font-size:22px;margin-bottom:20px;">Browse Models</h2>
  {'<div class="model-grid">' + models_html + '</div>' if models_html else '<p style="color:#9CA3AF;">Browse all models in the <a href="/catalog/" style="color:{color};">full catalog</a>.</p>'.replace('{color}', color)}

  <div style="margin-top:48px;padding:32px;background:#0D1117;border-radius:14px;border:1px solid rgba(255,255,255,.07);">
    <h2 style="font-size:20px;margin-bottom:12px;">Browse Full Catalog</h2>
    <p style="color:#9CA3AF;margin-bottom:20px;">Explore 1,000+ top-rated 3D models with category filters, price range and certification level.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <a href="/catalog/" class="btn">Browse Catalog</a>
      <a href="/search/" class="btn-ghost">Search Models</a>
      <a href="/custom-order/" class="btn-ghost">Request Custom</a>
    </div>
  </div>

</main>
{FOOTER}
</body>
</html>'''

    out = ROOT / "categories" / "other"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html, encoding="utf-8")
    print("  categories/other/index.html created")

# ── 4 new industry pages ──────────────────────────────────────────────────────

NEW_INDUSTRIES = {
    "softwaredevelopment": {
        "title": "Software Development 3D Models — UI Assets & Tech Visualizations | 3D Molier",
        "h1": "Software Development 3D Models",
        "desc": "3D models for software development visuals: server racks, computers, electronics, gadgets and tech environments for presentations, explainer videos and marketing.",
        "intro": "High-quality 3D assets for software companies, SaaS presentations, product demos, explainer videos and tech marketing. Clean and modern visuals for a digital-first audience.",
        "color": "#60A5FA",
        "use_cases": [
            "Product demo videos and presentations",
            "SaaS marketing and landing pages",
            "Tech explainer animations",
            "Developer blog illustrations",
            "Conference keynote slides",
            "App store screenshots and previews",
        ],
        "formats": ["FBX", "OBJ", "BLEND", "C4D", "MAX", "GLB"],
        "categories": [("Electronics & Gadgets", "electronics-gadgets"), ("Industrial Equipment", "industrial-equipment"), ("Furniture & Interior", "furniture-interior")],
    },
    "eventmanagement": {
        "title": "Event Management 3D Models — Stages, Furniture & Venues | 3D Molier",
        "h1": "Event Management 3D Models",
        "desc": "3D models for event planning and management: stages, furniture, venue setups, crowd assets and decorative props for visualizing live events and exhibitions.",
        "intro": "Professional 3D assets for event designers, venue planners, trade show organizers and entertainment companies. Visualize your event before the first chair is placed.",
        "color": "#F472B6",
        "use_cases": [
            "Conference and trade show layout planning",
            "Stage and lighting design visualization",
            "Wedding and gala venue previews",
            "Corporate event marketing materials",
            "Concert and festival production",
            "Virtual event environment creation",
        ],
        "formats": ["FBX", "OBJ", "BLEND", "C4D", "MAX"],
        "categories": [("Furniture & Interior", "furniture-interior"), ("Architecture Landmarks", "architecture-landmarks"), ("Characters & People", "characters-people")],
    },
    "hardware": {
        "title": "Hardware & Electronics 3D Models — Components & Devices | 3D Molier",
        "h1": "Hardware 3D Models",
        "desc": "3D models for hardware visualization: electronic components, PCBs, consumer electronics, industrial machines and mechanical assemblies for product design and marketing.",
        "intro": "Precision 3D assets for hardware startups, electronics manufacturers, industrial designers and product teams. From a PCB trace to a full assembly — visualized for manufacturing and marketing.",
        "color": "#34D399",
        "use_cases": [
            "Product packaging and marketing visuals",
            "Industrial design presentations",
            "Technical documentation illustrations",
            "Investor pitch decks",
            "Manufacturing process visualization",
            "IoT product demos and prototypes",
        ],
        "formats": ["FBX", "OBJ", "BLEND", "C4D", "MAX", "STEP"],
        "categories": [("Electronics & Gadgets", "electronics-gadgets"), ("Industrial Equipment", "industrial-equipment"), ("Vehicles", "vehicles")],
    },
    "3dprinting": {
        "title": "3D Printing Models — Printable Assets & Product Renders | 3D Molier",
        "h1": "3D Printing Models",
        "desc": "3D models suitable for 3D printing and additive manufacturing visualization: mechanical parts, props, product prototypes and detailed objects optimized for real-world scale.",
        "intro": "Production-ready 3D assets with clean topology and real-world scale for 3D printing services, rapid prototyping, product visualization and additive manufacturing workflows.",
        "color": "#FB923C",
        "use_cases": [
            "Rapid prototyping and product design",
            "Custom manufacturing visualizations",
            "Educational STEM models",
            "Collectibles and figurines",
            "Architectural scale models",
            "Medical device prototypes",
        ],
        "formats": ["OBJ", "STL", "FBX", "BLEND", "MAX"],
        "categories": [("Industrial Equipment", "industrial-equipment"), ("Medical", "medical-3d-models"), ("Vehicles", "vehicles")],
    },
}

def create_industry_page(slug, meta):
    color = meta["color"]
    css = BASE_CSS.replace("{COLOR}", color)
    canonical = f"{BASE}/industries/{slug}/"

    use_cases_html = "".join(f'<li style="color:#9CA3AF;margin-bottom:8px;padding-left:4px;">{uc}</li>' for uc in meta["use_cases"])
    formats_html = "".join(f'<span class="tag" style="margin:3px;">{fmt}</span>' for fmt in meta["formats"])
    cat_links_html = "".join(
        f'<a href="/categories/{cat_slug}/" style="color:{color};text-decoration:none;font-weight:600;display:block;margin-bottom:6px;">{cat_name} 3D Models</a>'
        for cat_name, cat_slug in meta["categories"]
    )

    # Top models from first category
    first_cat = meta["categories"][0][0] if meta["categories"] else ""
    models = get_models_for(first_cat, 6)
    models_html = "".join(model_card(m, color) for m in models)
    models_section = f'<h2 style="font-size:22px;margin-bottom:20px;">Top Models</h2><div class="model-grid">{models_html}</div>' if models_html else ""

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{meta["title"]}</title>
<meta name="description" content="{meta["desc"]}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{meta["title"]}">
<meta property="og:description" content="{meta["desc"]}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/assets/og/3d-molier-og.jpg">
<meta property="og:site_name" content="3D Molier">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Open+Sans:wght@400;500&display=swap" rel="stylesheet">
{css}
</head>
<body>
{NAV}
<main>

  <section style="padding:56px 24px 48px;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="max-width:1200px;margin:0 auto;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{color};margin-bottom:12px;">Industry</div>
      <h1 style="font-size:clamp(28px,4vw,48px);font-weight:800;line-height:1.1;margin-bottom:16px;">{meta["h1"]}</h1>
      <p style="font-size:16px;color:#9CA3AF;line-height:1.8;max-width:680px;margin-bottom:28px;">{meta["intro"]}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="/catalog/" class="btn">Browse Catalog</a>
        <a href="/custom-order/" class="btn-ghost">Request Custom Model</a>
      </div>
    </div>
  </section>

  <section style="padding:48px 24px;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
      <div>
        <h2 style="font-size:20px;margin-bottom:16px;">Common Use Cases</h2>
        <ul style="list-style:disc;padding-left:18px;">{use_cases_html}</ul>
      </div>
      <div>
        <h2 style="font-size:20px;margin-bottom:16px;">Related Categories</h2>
        <div style="margin-bottom:24px;">{cat_links_html}</div>
        <h2 style="font-size:20px;margin-bottom:12px;">Supported Formats</h2>
        <div>{formats_html}</div>
      </div>
    </div>
  </section>

  {f'<section style="padding:0 24px 48px;"><div style="max-width:1200px;margin:0 auto;">{models_section}</div></section>' if models_section else ""}

  <section style="padding:48px 24px 80px;background:#0D1117;">
    <div style="max-width:700px;margin:0 auto;text-align:center;">
      <h2 style="font-size:26px;font-weight:800;margin-bottom:12px;">Need a Custom 3D Model?</h2>
      <p style="color:#9CA3AF;margin-bottom:24px;line-height:1.7;">We build any 3D model to exact specifications — new assets or modifications to catalog models.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="/custom-order/" class="btn">Request Custom Model</a>
        <a href="/contact/" class="btn-ghost">Contact Us</a>
      </div>
    </div>
  </section>

</main>
{FOOTER}
</body>
</html>'''

    out = ROOT / "industries" / slug
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html, encoding="utf-8")
    print(f"  industries/{slug}/index.html created")

def main():
    print("Creating categories/other page...")
    create_other_category()

    print("Creating new industry pages...")
    for slug, meta in NEW_INDUSTRIES.items():
        create_industry_page(slug, meta)

    print("\nAll done!")

if __name__ == "__main__":
    main()
