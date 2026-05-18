#!/usr/bin/env python3
"""Create 8 industry landing pages + llms.txt + llms-full.txt + update robots.txt + sitemap."""
import pathlib, re, csv

ROOT = pathlib.Path(__file__).parent.parent
BASE = "https://3dmolier.github.io/3D-Models"

NAV = '''<nav style="background:rgba(7,9,15,0.95);border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;z-index:50;">
  <div style="max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:32px;">
    <a href="/3D-Models/" style="font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#fff;text-decoration:none;letter-spacing:-0.02em;">
      3D <span style="color:#00E5C4;">Molier</span></a>
    <div style="display:flex;gap:20px;margin-left:auto;flex-wrap:wrap;">
      <a href="/3D-Models/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Home</a>
      <a href="/3D-Models/catalog/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Catalog</a>
      <a href="/3D-Models/search/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Search</a>
      <a href="/3D-Models/about/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">About</a>
      <a href="/3D-Models/custom-order/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Custom Order</a>
      <a href="/3D-Models/contact/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Contact</a>
    </div>
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"
       target="_blank" rel="noopener"
       style="background:#00E5C4;color:#07090F;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;">
      TurboSquid ↗</a>
  </div>
</nav>'''

FOOTER = '''<footer style="background:#0D1117;border-top:1px solid rgba(255,255,255,0.07);padding:32px 24px;margin-top:80px;">
  <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <p style="color:#6B7280;font-size:13px;">© 2025 3D Molier. All models on TurboSquid.</p>
    <div style="display:flex;gap:20px;">
      <a href="/3D-Models/about/" style="color:#6B7280;font-size:13px;text-decoration:none;">About</a>
      <a href="/3D-Models/contact/" style="color:#6B7280;font-size:13px;text-decoration:none;">Contact</a>
      <a href="/3D-Models/custom-order/" style="color:#6B7280;font-size:13px;text-decoration:none;">Custom Order</a>
    </div>
  </div>
</footer>'''

def head(title, desc, canonical, color="#00E5C4"):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="3D Molier">
<link rel="icon" href="/3D-Models/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Open+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{background:#07090F;color:#E8EAF0;font-family:'Open Sans',sans-serif;font-size:15px;line-height:1.7;}}
  h1,h2,h3{{font-family:'Playfair Display',serif;letter-spacing:-0.02em;color:#fff;}}
  .accent{{color:{color};}}
  .btn{{display:inline-block;background:{color};color:#07090F;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;transition:opacity .2s;}}
  .btn:hover{{opacity:.88;}}
  .btn-ghost{{display:inline-block;border:1px solid rgba(255,255,255,.15);color:#E8EAF0;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;transition:border-color .2s;}}
  .btn-ghost:hover{{border-color:rgba(255,255,255,.3);}}
  .card{{background:#0D1117;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px 28px;}}
  .tag{{display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:{color}22;color:{color};border:1px solid {color}33;}}
  .model-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;}}
  .model-card{{background:#0D1117;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;text-decoration:none;display:block;transition:transform .2s,border-color .2s;}}
  .model-card:hover{{transform:translateY(-3px);border-color:{color}44;}}
  .model-card img{{width:100%;height:160px;object-fit:cover;display:block;}}
  .model-card-body{{padding:12px;}}
  .model-card-name{{font-size:13px;font-weight:600;color:#EDF2FF;line-height:1.4;margin-bottom:6px;}}
  .model-card-price{{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#fff;}}
</style>
</head>
<body>'''

INDUSTRIES = {
    "aerospace": {
        "slug": "aerospace",
        "title": "Aerospace 3D Models — Aircraft, Rockets & Space Assets | 3D Molier",
        "h1": "Aerospace 3D Models",
        "desc": "Professional aerospace 3D models: commercial aircraft, military jets, helicopters, rockets, satellites and space vehicles for engineering visualization, flight simulation and film production.",
        "color": "#4F9EFF",
        "intro": "High-fidelity 3D assets for the aerospace industry — from commercial airliners and military jets to rockets, satellites and space vehicles. Used by aerospace engineers, defense contractors, simulation developers, flight training centers and film productions worldwide.",
        "use_cases": ["Flight simulation training", "Aerospace engineering visualization", "Defense system presentations", "Flight dynamics research", "Commercial advertising", "Feature film VFX", "Museum exhibits"],
        "categories": [("Aircraft", "aircraft"), ("Military Vehicles", "military-vehicles")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender"],
    },
    "military-defense": {
        "slug": "military-defense",
        "title": "Military & Defense 3D Models — Tanks, Aircraft & Weapons | 3D Molier",
        "h1": "Military & Defense 3D Models",
        "desc": "1,700+ military 3D models for defense training, simulation and game development: tanks, APCs, fighter jets, warships, drones, artillery and infantry equipment.",
        "color": "#4ADE80",
        "intro": "The most comprehensive collection of military and defense 3D models available. Spanning all branches and eras — ground forces, air power, naval vessels and special operations equipment. Used by defense training programs, serious games, military simulations and film productions.",
        "use_cases": ["Defense training simulators", "Wargame development", "Military museum exhibits", "Mission planning visualization", "Recruitment materials", "Documentary production"],
        "categories": [("Military Vehicles", "military-vehicles"), ("Aircraft", "aircraft"), ("Ships", "ships")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender", "COLLADA"],
    },
    "medical": {
        "slug": "medical",
        "title": "Medical 3D Models — Anatomy, Organs & Healthcare Assets | 3D Molier",
        "h1": "Medical 3D Models",
        "desc": "1,900+ medical and anatomical 3D models: human organs, skeletal systems, surgical equipment and medical devices. CheckMate certified for medical education and healthcare visualization.",
        "color": "#00E5C4",
        "intro": "Professional medical and anatomical 3D models for healthcare education, surgical training, pharmaceutical visualization and medical device presentations. Every model built to anatomical accuracy with clean topology and realistic textures.",
        "use_cases": ["Medical education", "Surgical simulation training", "Pharmaceutical marketing", "Patient education materials", "Medical device presentations", "VR/AR healthcare applications"],
        "categories": [("Medical", "medical-3d-models")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender"],
    },
    "game-development": {
        "slug": "game-development",
        "title": "Game-Ready 3D Models — Vehicles, Characters & Environments | 3D Molier",
        "h1": "Game Development 3D Models",
        "desc": "Production-ready 3D models for game development: optimized geometry, PBR textures, correct scale and multiple LODs. Vehicles, military, architecture, characters and more.",
        "color": "#F97316",
        "intro": "High-quality 3D assets optimized for real-time game engines including Unreal Engine and Unity. Clean topology, PBR-ready textures, correct real-world scale and optimized polygon counts. Covering vehicles, military hardware, architecture, characters, weapons and environment props.",
        "use_cases": ["AAA game development", "Indie game projects", "Mobile game assets", "VR game environments", "Game prototyping", "Level design", "Cutscene production"],
        "categories": [("Vehicles", "vehicles"), ("Military Vehicles", "military-vehicles"), ("Aircraft", "aircraft"), ("Characters & People", "characters-people")],
        "formats": ["FBX", "OBJ", "Blender", "COLLADA", "glTF"],
    },
    "film-video-production": {
        "slug": "film-video-production",
        "title": "Film & VFX 3D Models — Production-Ready Assets | 3D Molier",
        "h1": "Film & Video Production 3D Models",
        "desc": "Production-quality 3D models for film and video: vehicles, aircraft, military, architecture and characters. CheckMate certified, subdivision-ready and VFX-proven.",
        "color": "#F59E0B",
        "intro": "Cinema-quality 3D assets for film, television and commercial production. All models feature clean subdivision topology, accurate real-world scale, detailed texturing and optimized geometry. Trusted by VFX studios, commercials directors and documentary filmmakers worldwide.",
        "use_cases": ["Feature film VFX", "TV commercial production", "Documentary content", "Music video production", "Corporate video", "Motion graphics", "Broadcast graphics"],
        "categories": [("Vehicles", "vehicles"), ("Aircraft", "aircraft"), ("Military Vehicles", "military-vehicles"), ("Ships", "ships")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender", "Alembic"],
    },
    "architecture": {
        "slug": "architecture",
        "title": "Architecture 3D Models — Buildings, Landmarks & Interior Assets | 3D Molier",
        "h1": "Architecture 3D Models",
        "desc": "Professional architectural 3D models: famous landmarks, commercial buildings, residential structures and interior props. Perfect for architectural visualization and urban planning.",
        "color": "#A78BFA",
        "intro": "Architectural visualization 3D models spanning world-famous landmarks, commercial buildings, residential structures and interior design elements. Ideal for architecture studios, real estate developers, urban planning presentations and film production sets.",
        "use_cases": ["Architectural visualization", "Urban planning", "Real estate marketing", "Interior design presentations", "Film and TV set design", "City planning simulations"],
        "categories": [("Architecture Landmarks", "architecture-landmarks"), ("Furniture & Interior", "furniture-interior")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender", "SketchUp"],
    },
    "virtual-reality": {
        "slug": "virtual-reality",
        "title": "VR & AR 3D Models — Real-Time Optimized Assets | 3D Molier",
        "h1": "Virtual Reality & AR 3D Models",
        "desc": "Real-time optimized 3D models for VR and AR applications. Low-poly, PBR-ready and performance-tested for Unreal Engine, Unity and WebGL deployments.",
        "color": "#8B5CF6",
        "intro": "Real-time 3D assets engineered for virtual reality (VR) and augmented reality (AR) applications. Optimized polygon counts, PBR texture workflows and clean LOD hierarchies. Compatible with Unreal Engine 5, Unity, WebXR and all major XR platforms.",
        "use_cases": ["VR training simulations", "AR product visualization", "Virtual showrooms", "XR medical training", "Virtual museum tours", "Real estate VR walkthroughs", "Industrial VR training"],
        "categories": [("Vehicles", "vehicles"), ("Aircraft", "aircraft"), ("Medical", "medical-3d-models"), ("Architecture Landmarks", "architecture-landmarks")],
        "formats": ["FBX", "glTF", "OBJ", "Blender", "COLLADA"],
    },
    "advertising": {
        "slug": "advertising",
        "title": "Advertising & Commercial 3D Models — Product Visualization | 3D Molier",
        "h1": "Advertising & Commercial 3D Models",
        "desc": "High-resolution 3D models for advertising and commercial production: vehicles, products, architecture. CheckMate certified for close-up renders and hero shots.",
        "color": "#F472B6",
        "intro": "Premium 3D assets for advertising campaigns, product launches and brand activations. Models built to withstand close-up renders with highly detailed geometry, photorealistic materials and accurate real-world scale. Trusted by advertising agencies, CGI studios and marketing departments worldwide.",
        "use_cases": ["Product launch campaigns", "Automotive advertising", "CGI commercials", "Brand activations", "Social media content", "Packaging visualization", "Point-of-sale displays"],
        "categories": [("Vehicles", "vehicles"), ("Aircraft", "aircraft"), ("Industrial Equipment", "industrial-equipment")],
        "formats": ["FBX", "OBJ", "3ds Max", "Cinema 4D", "Blender", "Octane"],
    },
}

def get_top_models_for_cats(cats_list, n=6):
    """Read top_models.csv and return top N models for given categories."""
    data_path = ROOT / "data" / "top_models.csv"
    if not data_path.exists():
        return []
    rows = []
    with open(data_path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["category"] in cats_list:
                rows.append(r)
    rows.sort(key=lambda r: float(r.get("priority_score", 0) or 0), reverse=True)
    return rows[:n]

def model_card(m):
    slug = m["slug"]
    title = m["product_name"]
    cat = m["category"]
    img = m.get("image_url", "")
    if img and img.startswith("https://static.turbosquid"):
        img = "https://images.weserv.nl/?url=" + img.replace("https://", "") + "&w=600&q=85&output=webp"
    try:
        price_str = f"${float(m['price']):.0f}"
    except:
        price_str = f"${m['price']}"
    img_tag = f'<img src="{img}" alt="{title} 3D model — {cat}" loading="lazy" onerror="this.style.display=\'none\'">' if img else ""
    return f'''<a href="/3D-Models/models/{slug}/" class="model-card">
      {img_tag}
      <div class="model-card-body">
        <div class="model-card-name">{title}</div>
        <div class="model-card-price">{price_str}</div>
      </div>
    </a>'''

def build_industry_page(slug, meta):
    canonical = f"{BASE}/industries/{slug}/"
    color = meta["color"]
    page_head = head(meta["title"], meta["desc"], canonical, color)

    use_cases_html = "".join(f'<li style="color:#9CA3AF;margin-bottom:8px;">{uc}</li>' for uc in meta["use_cases"])
    formats_html = "".join(f'<span class="tag">{fmt}</span> ' for fmt in meta["formats"])
    cat_links_html = "".join(
        f'<a href="/3D-Models/categories/{cat_slug}/" style="color:{color};text-decoration:none;font-weight:600;">{cat_name} 3D Models</a><br>'
        for cat_name, cat_slug in meta["categories"]
    )

    # Top models
    cat_names = [c[0] for c in meta["categories"]]
    top_models = get_top_models_for_cats(cat_names, 6)
    models_html = "".join(model_card(m) for m in top_models) if top_models else ""
    models_section = f'''<section style="padding:0 24px 60px;">
    <div style="max-width:1200px;margin:0 auto;">
      <h2 style="font-size:26px;font-weight:700;margin-bottom:24px;">Top 3D Models for {meta["h1"].replace(" 3D Models","")}</h2>
      <div class="model-grid">{models_html}</div>
      <div style="text-align:center;margin-top:32px;">
        <a href="/3D-Models/catalog/" class="btn">Browse Full Catalog</a>
        <a href="/3D-Models/search/" class="btn-ghost" style="margin-left:12px;">Search Models</a>
      </div>
    </div>
  </section>''' if models_html else ""

    return f'''{page_head}
{NAV}

<main style="position:relative;z-index:1;">

  <!-- Hero -->
  <section style="padding:64px 24px 48px;border-bottom:1px solid rgba(255,255,255,0.07);">
    <div style="max-width:1200px;margin:0 auto;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{color};margin-bottom:12px;">Industry</div>
      <h1 style="font-size:clamp(32px,5vw,52px);font-weight:800;line-height:1.1;margin-bottom:20px;">{meta["h1"]}</h1>
      <p style="font-size:17px;color:#9CA3AF;line-height:1.8;max-width:720px;margin-bottom:32px;">{meta["intro"]}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="/3D-Models/catalog/" class="btn">Browse Catalog</a>
        <a href="/3D-Models/custom-order/" class="btn-ghost">Request Custom Model</a>
      </div>
    </div>
  </section>

  <!-- Content -->
  <section style="padding:56px 24px;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;">

      <div>
        <h2 style="font-size:22px;margin-bottom:20px;">Common Use Cases</h2>
        <ul style="list-style:none;padding:0;">{use_cases_html}</ul>
      </div>

      <div>
        <h2 style="font-size:22px;margin-bottom:20px;">Available Categories</h2>
        <div style="margin-bottom:24px;">{cat_links_html}</div>
        <h2 style="font-size:22px;margin-bottom:16px;">Supported Formats</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">{formats_html}</div>
      </div>

    </div>
  </section>

  {models_section}

  <!-- CTA -->
  <section style="padding:56px 24px 80px;background:#0D1117;">
    <div style="max-width:700px;margin:0 auto;text-align:center;">
      <h2 style="font-size:28px;font-weight:800;margin-bottom:16px;">Need a Custom 3D Model?</h2>
      <p style="color:#9CA3AF;margin-bottom:28px;line-height:1.7;">We build any 3D model to your exact specifications — new assets or modifications to existing catalog models.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="/3D-Models/custom-order/" class="btn">Request Custom Model</a>
        <a href="/3D-Models/contact/" class="btn-ghost">Contact Us</a>
      </div>
    </div>
  </section>

</main>

{FOOTER}
</body>
</html>'''


def create_industry_pages():
    created = 0
    for slug, meta in INDUSTRIES.items():
        out_dir = ROOT / "industries" / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        html = build_industry_page(slug, meta)
        (out_dir / "index.html").write_text(html, encoding="utf-8")
        created += 1
    print(f"  Industry pages: {created} created")


def create_llms_txt():
    content = """# 3D Molier Models

## What this site provides
Production-ready 3D models for simulation, technical visualization, animation, VFX, training scenes, games, advertising, architecture, medical visualization and real-time engines.

## Main pages
- Catalog: https://3dmolier.github.io/3D-Models/catalog/
- Search: https://3dmolier.github.io/3D-Models/search/
- Vehicles: https://3dmolier.github.io/3D-Models/categories/vehicles/
- Aircraft: https://3dmolier.github.io/3D-Models/categories/aircraft/
- Military: https://3dmolier.github.io/3D-Models/categories/military-vehicles/
- Medical: https://3dmolier.github.io/3D-Models/categories/medical-3d-models/
- Ships: https://3dmolier.github.io/3D-Models/categories/ships/

## Important facts
- 3D Molier sells 3D models through TurboSquid.
- This website is a searchable catalog and SEO landing site.
- Models may include CheckMate certification, real-world scale, clean topology, UV mapping and production-ready geometry depending on the product page.
"""
    (ROOT / "llms.txt").write_text(content, encoding="utf-8")
    print("  llms.txt written")

    full_content = """# 3D Molier — Full Site Context for AI/LLM Agents

## About 3D Molier
3D Molier is a professional 3D modeling studio operated by Andrey Simonenko. The studio has been producing 3D assets for 20+ years and has published over 88,000 models on TurboSquid. The catalog spans vehicles, aircraft, military hardware, medical anatomy, architecture, industrial equipment, ships, characters, nature assets, electronics, clothing, furniture and more.

## Business Model
- All models are sold exclusively through TurboSquid
- This website is a searchable SEO catalog / landing site — users click through to TurboSquid to purchase
- Custom 3D modeling services are offered directly (contact: dddmolier@gmail.com)
- All referral links use: ?referral=3d_molier-studio

## Main URLs
- Homepage: https://3dmolier.github.io/3D-Models/
- Catalog (browse + filter): https://3dmolier.github.io/3D-Models/catalog/
- Search: https://3dmolier.github.io/3D-Models/search/
- Collections: https://3dmolier.github.io/3D-Models/collections/
- About: https://3dmolier.github.io/3D-Models/about/
- Contact: https://3dmolier.github.io/3D-Models/contact/
- Custom Order: https://3dmolier.github.io/3D-Models/custom-order/

## Categories
- Vehicles (7,518 total): https://3dmolier.github.io/3D-Models/categories/vehicles/
- Aircraft (3,871 total): https://3dmolier.github.io/3D-Models/categories/aircraft/
- Military Vehicles (1,733 total): https://3dmolier.github.io/3D-Models/categories/military-vehicles/
- Medical (1,938 total): https://3dmolier.github.io/3D-Models/categories/medical-3d-models/
- Ships (961 total): https://3dmolier.github.io/3D-Models/categories/ships/
- Architecture Landmarks: https://3dmolier.github.io/3D-Models/categories/architecture-landmarks/
- Industrial Equipment: https://3dmolier.github.io/3D-Models/categories/industrial-equipment/
- Characters & People: https://3dmolier.github.io/3D-Models/categories/characters-people/
- Animals & Creatures: https://3dmolier.github.io/3D-Models/categories/animals-creatures/
- Nature & Plants: https://3dmolier.github.io/3D-Models/categories/nature-plants/
- Furniture & Interior: https://3dmolier.github.io/3D-Models/categories/furniture-interior/
- Electronics & Gadgets: https://3dmolier.github.io/3D-Models/categories/electronics-gadgets/
- Clothing & Accessories: https://3dmolier.github.io/3D-Models/categories/clothing-accessories/
- Food & Beverages: https://3dmolier.github.io/3D-Models/categories/food-beverages/

## Industry Pages
- Aerospace: https://3dmolier.github.io/3D-Models/industries/aerospace/
- Military & Defense: https://3dmolier.github.io/3D-Models/industries/military-defense/
- Medical: https://3dmolier.github.io/3D-Models/industries/medical/
- Game Development: https://3dmolier.github.io/3D-Models/industries/game-development/
- Film & Video Production: https://3dmolier.github.io/3D-Models/industries/film-video-production/
- Architecture: https://3dmolier.github.io/3D-Models/industries/architecture/
- Virtual Reality: https://3dmolier.github.io/3D-Models/industries/virtual-reality/
- Advertising: https://3dmolier.github.io/3D-Models/industries/advertising/

## File Formats Available
FBX, OBJ, 3ds Max (.max), Cinema 4D (.c4d), Blender (.blend), COLLADA (.dae), glTF — varies by model.

## Quality Certifications
- CheckMate Lite/Pro: TurboSquid's highest quality certification. Guarantees clean topology, correct normals, proper UV mapping and real-world scale.
- StemCell: TurboSquid's game-ready certification. Optimized for real-time engines with PBR textures.

## Custom Modeling
3D Molier accepts custom modeling commissions:
- New models built from reference materials or specifications
- Modifications to existing catalog models
- Contact: dddmolier@gmail.com
- Request form: https://3dmolier.github.io/3D-Models/custom-order/

## Sitemap
https://3dmolier.github.io/3D-Models/sitemap.xml
"""
    (ROOT / "llms-full.txt").write_text(full_content, encoding="utf-8")
    print("  llms-full.txt written")


def update_robots_txt():
    content = """User-agent: *
Allow: /
Disallow: /data/

# AI search crawlers
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: https://3dmolier.github.io/3D-Models/sitemap.xml
LLMs-txt: https://3dmolier.github.io/3D-Models/llms.txt
LLMs-full: https://3dmolier.github.io/3D-Models/llms-full.txt
"""
    (ROOT / "robots.txt").write_text(content, encoding="utf-8")
    print("  robots.txt updated")


def update_sitemap():
    sitemap_path = ROOT / "sitemap.xml"
    if not sitemap_path.exists():
        print("  sitemap.xml not found, skipping")
        return
    content = sitemap_path.read_text(encoding="utf-8")

    from datetime import date
    today = date.today().isoformat()
    BASE_DOMAIN = "https://3dmolier.github.io/3D-Models"

    new_entries = ""
    for slug in INDUSTRIES.keys():
        url = f"{BASE_DOMAIN}/industries/{slug}/"
        if url not in content:
            new_entries += f"""  <url>
    <loc>{url}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n"""

    # Add llms.txt entries
    for txt_file in ["llms.txt", "llms-full.txt"]:
        url = f"{BASE_DOMAIN}/{txt_file}"
        if url not in content:
            new_entries += f"""  <url>
    <loc>{url}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>\n"""

    if new_entries:
        new_content = content.replace("</urlset>", new_entries + "</urlset>")
        sitemap_path.write_text(new_content, encoding="utf-8")
        total = new_content.count("<url>")
        print(f"  sitemap.xml updated ({total} URLs)")
    else:
        print("  sitemap.xml: already up to date")


def fix_industry_links_in_existing_pages():
    """Fix broken industry links in category pages (filmvideoproduction -> film-video-production, etc.)"""
    slug_fixes = {
        "/industries/filmvideoproduction/": "/3D-Models/industries/film-video-production/",
        "/industries/games/": "/3D-Models/industries/game-development/",
        "/industries/simulation/": "/3D-Models/industries/aerospace/",
        "/industries/virtualreality/": "/3D-Models/industries/virtual-reality/",
        "/industries/aerospace/": "/3D-Models/industries/aerospace/",
        "/industries/militarydefense/": "/3D-Models/industries/military-defense/",
        "/industries/medical/": "/3D-Models/industries/medical/",
        "/industries/architecture/": "/3D-Models/industries/architecture/",
        "/industries/advertising/": "/3D-Models/industries/advertising/",
    }
    updated = 0
    for p in ROOT.rglob("*.html"):
        txt = p.read_text(encoding="utf-8")
        new = txt
        for bad, good in slug_fixes.items():
            new = new.replace(bad, good)
        if new != txt:
            p.write_text(new, encoding="utf-8")
            updated += 1
    print(f"  Industry link fixes: {updated} files updated")


def main():
    print("1. Creating industry pages...")
    create_industry_pages()

    print("2. Creating llms.txt files...")
    create_llms_txt()

    print("3. Updating robots.txt...")
    update_robots_txt()

    print("4. Updating sitemap.xml...")
    update_sitemap()

    print("5. Fixing industry links in existing pages...")
    fix_industry_links_in_existing_pages()

    print("\nAll done!")

if __name__ == "__main__":
    main()
