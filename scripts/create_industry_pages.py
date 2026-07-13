#!/usr/bin/env python3
"""Create 8 industry landing pages + llms.txt + llms-full.txt + update robots.txt + sitemap."""
import pathlib, re, csv, json

ROOT = pathlib.Path(__file__).parent.parent
BASE = "https://3dmolierstudio.com"

def _load_fc_img_map():
    """Load product_id → p.turbosquid.com URL from fc-img-chunk-0..5 JSON files."""
    img_map = {}
    for i in range(6):
        p = ROOT / "data" / f"fc-img-chunk-{i}.json"
        if p.exists():
            with open(p, encoding="utf-8") as f:
                img_map.update(json.load(f))
    return img_map  # keys are strings like "1230754"

FC_IMG_MAP = _load_fc_img_map()

NAV = '''<a href="#main-content" class="skip-link">Skip to main content</a>
<header id="site-header">
<nav id="main-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">3D Molier</a>
    <div class="nav-links" id="nav-links">
      <a href="/catalog/" class="nav-link">Top 1000</a>
      <a href="/full-catalog/" class="nav-link">Full Catalog</a>
      <span class="nav-sep" aria-hidden="true"></span>
      <div class="nav-has-dropdown nav-has-mega" id="nav-cat-wrap">
        <button class="nav-link" id="nav-cat-btn" aria-haspopup="true" aria-expanded="false">Categories <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" role="menu">
          <a href="/categories/vehicles/" role="menuitem" class="mega-item"><span class="mega-name">Vehicles</span><span class="mega-desc">cars, trucks, motorcycles</span></a>
          <a href="/categories/aircraft/" role="menuitem" class="mega-item"><span class="mega-name">Aircraft</span><span class="mega-desc">airplanes, helicopters, drones</span></a>
          <a href="/categories/military-vehicles/" role="menuitem" class="mega-item"><span class="mega-name">Military</span><span class="mega-desc">defense, tanks, equipment</span></a>
          <a href="/categories/ships/" role="menuitem" class="mega-item"><span class="mega-name">Ships</span><span class="mega-desc">naval, cargo, yachts</span></a>
          <a href="/categories/medical-3d-models/" role="menuitem" class="mega-item"><span class="mega-name">Medical</span><span class="mega-desc">anatomy, surgery, pharma</span></a>
          <a href="/categories/industrial-equipment/" role="menuitem" class="mega-item"><span class="mega-name">Industrial</span><span class="mega-desc">machinery, HVAC, cranes</span></a>
          <a href="/categories/architecture-landmarks/" role="menuitem" class="mega-item"><span class="mega-name">Architecture</span><span class="mega-desc">buildings, monuments</span></a>
          <a href="/categories/other/" role="menuitem" class="mega-item"><span class="mega-name">Other</span><span class="mega-desc">characters, animals, props</span></a>
        </div>
      </div>
      <div class="nav-has-dropdown nav-has-mega" id="nav-ind-wrap">
        <button class="nav-link" id="nav-ind-btn" aria-haspopup="true" aria-expanded="false">Industries <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" role="menu">
          <a href="/industries/aerospace/" role="menuitem" class="mega-item"><span class="mega-name">Aerospace</span><span class="mega-desc">aviation, rockets, satellites</span></a>
          <a href="/industries/military-defense/" role="menuitem" class="mega-item"><span class="mega-name">Military &amp; Defense</span><span class="mega-desc">defense, simulation, training</span></a>
          <a href="/industries/medical/" role="menuitem" class="mega-item"><span class="mega-name">Medical</span><span class="mega-desc">anatomy, surgery, education</span></a>
          <a href="/industries/game-development/" role="menuitem" class="mega-item"><span class="mega-name">Game Development</span><span class="mega-desc">Unity, Unreal, real-time</span></a>
          <a href="/industries/film-video-production/" role="menuitem" class="mega-item"><span class="mega-name">Film Production</span><span class="mega-desc">VFX, animation, commercials</span></a>
          <a href="/industries/architecture/" role="menuitem" class="mega-item"><span class="mega-name">Architecture</span><span class="mega-desc">buildings, landmarks, viz</span></a>
          <a href="/industries/virtual-reality/" role="menuitem" class="mega-item"><span class="mega-name">Virtual Reality</span><span class="mega-desc">VR, AR, immersive scenes</span></a>
          <a href="/industries/advertising/" role="menuitem" class="mega-item"><span class="mega-name">Advertising</span><span class="mega-desc">product rendering, campaigns</span></a>
          <a href="/industries/software-development/" role="menuitem" class="mega-item"><span class="mega-name">Software Dev</span><span class="mega-desc">apps, demos, UI assets</span></a>
          <a href="/industries/event-management/" role="menuitem" class="mega-item"><span class="mega-name">Event Management</span><span class="mega-desc">exhibitions, staging, shows</span></a>
          <a href="/industries/hardware/" role="menuitem" class="mega-item"><span class="mega-name">Hardware</span><span class="mega-desc">devices, components, tech</span></a>
          <a href="/industries/3d-printing/" role="menuitem" class="mega-item"><span class="mega-name">3D Printing</span><span class="mega-desc">printing, prototyping, fab</span></a>
        </div>
      </div>
      <a href="/collections/" class="nav-link">Collections</a>
      <a href="/search/" class="nav-link">Search</a>
      <a href="/custom-order/" class="nav-link">Custom Order</a>
      <a href="/data-licensing/" class="nav-link">Data Licensing</a>
      <a href="/about/" class="nav-link">About</a>
    </div>
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" class="nav-cta" target="_blank" rel="noopener">TurboSquid ↗</a>
    <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="nav-mobile" id="nav-mobile" aria-hidden="true">
  <a href="/catalog/">Top 1000 Models</a>
  <a href="/full-catalog/">Full Catalog</a>
  <button class="nav-mobile-toggle" id="mob-cat-toggle" aria-expanded="false">Categories <span class="nav-caret">&#9662;</span></button>
  <div class="nav-mobile-sub" id="mob-cat-sub">
    <a href="/categories/vehicles/">Vehicles</a>
    <a href="/categories/aircraft/">Aircraft</a>
    <a href="/categories/military-vehicles/">Military</a>
    <a href="/categories/ships/">Ships</a>
    <a href="/categories/medical-3d-models/">Medical</a>
    <a href="/categories/industrial-equipment/">Industrial</a>
    <a href="/categories/architecture-landmarks/">Architecture</a>
    <a href="/categories/other/">Other</a>
  </div>
  <button class="nav-mobile-toggle" id="mob-ind-toggle" aria-expanded="false">Industries <span class="nav-caret">&#9662;</span></button>
  <div class="nav-mobile-sub" id="mob-ind-sub">
    <a href="/industries/aerospace/">Aerospace</a>
    <a href="/industries/military-defense/">Military &amp; Defense</a>
    <a href="/industries/medical/">Medical</a>
    <a href="/industries/game-development/">Game Development</a>
    <a href="/industries/film-video-production/">Film Production</a>
    <a href="/industries/architecture/">Architecture</a>
    <a href="/industries/virtual-reality/">Virtual Reality</a>
    <a href="/industries/advertising/">Advertising</a>
    <a href="/industries/software-development/">Software Development</a>
    <a href="/industries/event-management/">Event Management</a>
    <a href="/industries/hardware/">Hardware</a>
    <a href="/industries/3d-printing/">3D Printing</a>
  </div>
  <a href="/collections/">Collections</a>
  <a href="/search/">Search</a>
  <a href="/custom-order/">Custom Order</a>
  <a href="/data-licensing/">Data Licensing</a>
  <a href="/about/">About</a>
  <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" class="mobile-cta" target="_blank" rel="noopener">TurboSquid Store &#8599;</a>
</div>
</header>'''

FOOTER = '''<footer class="site-footer">
  <div class="max-w-7xl mx-auto">
    <div class="footer-grid">
      <div>
        <div class="footer-brand-row">
          <div class="footer-logo-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
          <span class="footer-brand-name">3D Molier</span>
        </div>
        <p class="footer-brand-desc">Professional 3D models for film, games, architecture, medical and aerospace. All models sold on TurboSquid.</p>
      </div>
      <div>
        <div class="footer-col-hd">Categories</div>
        <div class="footer-links">
          <a href="/categories/vehicles/" class="footer-link">Vehicles</a>
          <a href="/categories/aircraft/" class="footer-link">Aircraft</a>
          <a href="/categories/military-vehicles/" class="footer-link">Military</a>
          <a href="/categories/medical-3d-models/" class="footer-link">Medical</a>
          <a href="/categories/ships/" class="footer-link">Ships</a>
          <a href="/catalog/" class="footer-link">Top 1000 &#8594;</a>
        </div>
      </div>
      <div>
        <div class="footer-col-hd">Collections</div>
        <div class="footer-links">
          <a href="/collections/best-vehicle-3d-models/" class="footer-link">Best Vehicles</a>
          <a href="/collections/best-aircraft-3d-models/" class="footer-link">Best Aircraft</a>
          <a href="/collections/best-medical-3d-models/" class="footer-link">Best Medical</a>
          <a href="/collections/best-military-vehicle-3d-models/" class="footer-link">Best Military</a>
          <a href="/collections/" class="footer-link">View all &#8594;</a>
        </div>
      </div>
      <div>
        <div class="footer-col-hd">Company</div>
        <div class="footer-links">
          <a href="/about/" class="footer-link">About</a>
          <a href="/contact/" class="footer-link">Contact</a>
          <a href="/custom-order/" class="footer-link">Custom Order</a>
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="footer-link">TurboSquid Store</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">&#169; 2026 3D Molier. All 3D models sold via TurboSquid.</p>
    </div>
  </div>
</footer>'''

def head(title, desc, canonical, color="#00E5C4", *ld_blobs):
    hreflang = canonical
    bc_tag = ''.join(f'\n<script type="application/ld+json">{b}</script>' for b in ld_blobs if b)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{hreflang}">
<link rel="alternate" hreflang="x-default" href="{hreflang}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://3dmolierstudio.com/assets/og/3d-molier-og.jpg">
<meta property="og:site_name" content="3D Molier">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@3dmolier">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://3dmolierstudio.com/assets/og/3d-molier-og.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=33">
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=33">
<link rel="stylesheet" href="/assets/css/fonts.css?v=33">{bc_tag}
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
    "software-development": {
        "slug": "software-development",
        "title": "Software Development 3D Models — UI Assets & Tech Visuals | 3D Molier",
        "h1": "Software Development 3D Models",
        "desc": "High-quality 3D models for software companies, SaaS presentations, product demos, explainer videos and tech marketing. Clean and modern visuals for a digital-first audience.",
        "color": "#06B6D4",
        "intro": "High-quality 3D assets for software companies, SaaS presentations, product demos, explainer videos and tech marketing. Clean and modern visuals for a digital-first audience.",
        "use_cases": ["Product demo videos and presentations", "SaaS marketing and landing pages", "Tech explainer animations", "Developer blog illustrations", "Conference keynote slides", "App store screenshots and previews"],
        "categories": [("Electronics & Gadgets", "electronics-gadgets"), ("Industrial Equipment", "industrial-equipment"), ("Furniture & Interior", "furniture-interior")],
        "formats": ["FBX", "OBJ", "Blender", "Cinema 4D", "3ds Max", "GLB"],
    },
    "event-management": {
        "slug": "event-management",
        "title": "Event Management 3D Models — Venues, Stages & Exhibition Assets | 3D Molier",
        "h1": "Event Management 3D Models",
        "desc": "Professional 3D assets for event designers, venue planners, trade show organizers and entertainment companies. Visualize your event before the first chair is placed.",
        "color": "#EC4899",
        "intro": "Professional 3D assets for event designers, venue planners, trade show organizers and entertainment companies. Visualize your event before the first chair is placed.",
        "use_cases": ["Conference and trade show layout planning", "Stage and lighting design visualization", "Wedding and gala venue previews", "Corporate event marketing materials", "Concert and festival production", "Virtual event environment creation"],
        "categories": [("Furniture & Interior", "furniture-interior"), ("Architecture Landmarks", "architecture-landmarks"), ("Characters & People", "characters-people")],
        "formats": ["FBX", "OBJ", "Blender", "Cinema 4D", "3ds Max"],
    },
    "hardware": {
        "slug": "hardware",
        "title": "Hardware 3D Models — Electronics, Devices & Industrial Assets | 3D Molier",
        "h1": "Hardware 3D Models",
        "desc": "Precision 3D assets for hardware startups, electronics manufacturers, industrial designers and product teams. From a circuit board to a full assembly — visualized for manufacturing and marketing.",
        "color": "#10B981",
        "intro": "Precision 3D assets for hardware startups, electronics manufacturers, industrial designers and product teams. From a circuit board to a full assembly — visualized for manufacturing and marketing.",
        "use_cases": ["Product packaging and marketing visuals", "Industrial design presentations", "Technical documentation illustrations", "Investor pitch decks", "Manufacturing process visualization", "IoT product demos and prototypes"],
        "categories": [("Electronics & Gadgets", "electronics-gadgets"), ("Industrial Equipment", "industrial-equipment"), ("Vehicles", "vehicles")],
        "formats": ["FBX", "OBJ", "Blender", "Cinema 4D", "3ds Max", "STEP"],
    },
    "3d-printing": {
        "slug": "3d-printing",
        "title": "3D Printing Models — Prototyping, Manufacturing & Fabrication Assets | 3D Molier",
        "h1": "3D Printing 3D Models",
        "desc": "Production-ready 3D assets with clean topology and real-world scale for 3D printing services, rapid prototyping, product visualization and additive manufacturing workflows.",
        "color": "#84CC16",
        "intro": "Production-ready 3D assets with clean topology and real-world scale for 3D printing services, rapid prototyping, product visualization and additive manufacturing workflows.",
        "use_cases": ["Rapid prototyping and product design", "Custom manufacturing visualizations", "Educational STEM models", "Collectibles and figurines", "Architectural scale models", "Medical device prototypes"],
        "categories": [("Industrial Equipment", "industrial-equipment"), ("Medical", "medical-3d-models"), ("Vehicles", "vehicles")],
        "formats": ["OBJ", "STL", "FBX", "Blender", "3ds Max"],
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
    from urllib.parse import quote as _q
    _PLACEHOLDER = "/assets/og/3d-molier-og.jpg"
    slug = m["slug"]
    title = m["product_name"]
    cat = m["category"]
    orig_img = m.get("image_url", "")
    # Extract product ID from slug to look up p.turbosquid.com thumbnail
    _id_match = re.search(r'-(\d+)$', slug)
    _pid = _id_match.group(1) if _id_match else ""
    p_img = FC_IMG_MAP.get(_pid, "")
    if p_img:
        # Prefer p.turbosquid.com — works without any proxy
        img = p_img
        orig_img = p_img
    elif orig_img and orig_img.startswith("https://p.turbosquid.com"):
        img = orig_img
    elif orig_img:
        _clean = orig_img.replace("https://", "").replace("http://", "")
        img = "https://images.weserv.nl/?url=ssl:" + _q(_clean, safe="") + "&w=600&q=85&output=webp"
    else:
        img = ""
    try:
        price_str = f"${float(m['price']):.0f}"
    except:
        price_str = f"${m['price']}"
    img_tag = (f'<img src="{img}" alt="{title} 3D model — {cat}" width="800" height="450" decoding="async" loading="lazy"'
               f' data-fallback="{orig_img}" data-placeholder="{_PLACEHOLDER}" onerror="handleImageError(this)">') if orig_img else ""
    return f'''<a href="/models/{slug}/" class="model-card">
      {img_tag}
      <div class="model-card-body">
        <div class="model-card-name">{title}</div>
        <div class="model-card-price">{price_str}</div>
      </div>
    </a>'''

def build_industry_page(slug, meta):
    canonical = f"{BASE}/industries/{slug}/"
    color = meta["color"]
    top_models = get_top_models_for_cats([c[0] for c in meta["categories"]], 50)

    bc = json.dumps({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Home","item":f"{BASE}/"},
        {"@type":"ListItem","position":2,"name":"Industries","item":f"{BASE}/industries/"},
        {"@type":"ListItem","position":3,"name":meta["h1"],"item":canonical},
    ]}, ensure_ascii=False)
    il_elements = [
        {"@type":"ListItem","position":i+1,"name":m['product_name'],"url":f"{BASE}/models/{m['slug']}/"}
        for i, m in enumerate(top_models) if m.get('slug')
    ]
    il = json.dumps({"@context":"https://schema.org","@type":"ItemList","name":meta["h1"],"url":canonical,
        "numberOfItems":len(il_elements),"itemListElement":il_elements}, ensure_ascii=False)
    page_head = head(meta["title"], meta["desc"], canonical, color, bc, il)

    use_cases_html = "".join(f'<li class="ind-uc-item">{uc}</li>' for uc in meta["use_cases"])
    formats_html = "".join(f'<span class="chip">{fmt}</span> ' for fmt in meta["formats"])
    cat_links_html = "".join(
        f'<a href="/categories/{cat_slug}/" class="ind-cat-link">{cat_name} 3D Models</a><br>'
        for cat_name, cat_slug in meta["categories"]
    )

    # Top models (first 6 shown in HTML)
    models_html = "".join(model_card(m) for m in top_models[:6]) if top_models else ""
    models_section = f'''<section class="page-section">
    <div class="max-w-7xl mx-auto">
      <h2 class="section-h2 section-h2--mb24">Top 3D Models for {meta["h1"].replace(" 3D Models","")}</h2>
      <div class="model-grid">{models_html}</div>
      <div class="text-center mt-8">
        <a href="/catalog/" class="btn-primary">Browse Full Catalog</a>
        <a href="/search/" class="btn-ghost btn-ghost--md ind-search-ml">Search Models</a>
      </div>
    </div>
  </section>''' if models_html else ""

    return f'''{page_head}
{NAV}

<main class="cat-main" id="main-content">

  <!-- Hero -->
  <section class="page-section page-section--border-bottom">
    <div class="max-w-7xl mx-auto">
      <div class="section-label">Industry</div>
      <h1 class="cat-page-h1 ind-h1-mb">{meta["h1"]}</h1>
      <p class="section-desc ind-desc-wide">{meta["intro"]}</p>
      <div class="flex gap-3 flex-wrap">
        <a href="/catalog/" class="btn-primary">Browse Catalog</a>
        <a href="/custom-order/" class="btn-ghost">Request Custom Model</a>
      </div>
    </div>
  </section>

  <!-- Content -->
  <section class="page-section">
    <div class="max-w-7xl mx-auto ind-two-col">

      <div>
        <h2 class="section-h2 section-h2--mb24">Common Use Cases</h2>
        <ul class="ind-uc-list">{use_cases_html}</ul>
      </div>

      <div>
        <h2 class="section-h2 section-h2--mb24">Available Categories</h2>
        <div class="ind-cat-list">{cat_links_html}</div>
        <h2 class="section-h2 ind-h2-mb16">Supported Formats</h2>
        <div class="flex flex-wrap gap-2">{formats_html}</div>
      </div>

    </div>
  </section>

  {models_section}

  <!-- CTA -->
  <section class="page-section page-section--dark">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="section-h2 ind-cta-h2 ind-h2-mb16">Need a Custom 3D Model?</h2>
      <p class="section-desc mx-auto ind-cta-text">We build any 3D model to your exact specifications — new assets or modifications to existing catalog models.</p>
      <div class="flex gap-3 justify-center flex-wrap">
        <a href="/custom-order/" class="btn-primary">Request Custom Model</a>
        <a href="/contact/" class="btn-ghost--cta btn-ghost">Contact Us</a>
      </div>
    </div>
  </section>

</main>

{FOOTER}
<script src="/assets/js/site.min.js?v=33" defer></script>
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
- Catalog: https://3dmolierstudio.com/catalog/
- Search: https://3dmolierstudio.com/search/
- Vehicles: https://3dmolierstudio.com/categories/vehicles/
- Aircraft: https://3dmolierstudio.com/categories/aircraft/
- Military: https://3dmolierstudio.com/categories/military-vehicles/
- Medical: https://3dmolierstudio.com/categories/medical-3d-models/
- Ships: https://3dmolierstudio.com/categories/ships/

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
- Homepage: https://3dmolierstudio.com/
- Catalog (browse + filter): https://3dmolierstudio.com/catalog/
- Search: https://3dmolierstudio.com/search/
- Collections: https://3dmolierstudio.com/collections/
- About: https://3dmolierstudio.com/about/
- Contact: https://3dmolierstudio.com/contact/
- Custom Order: https://3dmolierstudio.com/custom-order/

## Categories
- Vehicles (7,518 total): https://3dmolierstudio.com/categories/vehicles/
- Aircraft (3,871 total): https://3dmolierstudio.com/categories/aircraft/
- Military Vehicles (1,733 total): https://3dmolierstudio.com/categories/military-vehicles/
- Medical (1,938 total): https://3dmolierstudio.com/categories/medical-3d-models/
- Ships (961 total): https://3dmolierstudio.com/categories/ships/
- Architecture Landmarks: https://3dmolierstudio.com/categories/architecture-landmarks/
- Industrial Equipment: https://3dmolierstudio.com/categories/industrial-equipment/
- Characters & People: https://3dmolierstudio.com/categories/characters-people/
- Animals & Creatures: https://3dmolierstudio.com/categories/animals-creatures/
- Nature & Plants: https://3dmolierstudio.com/categories/nature-plants/
- Furniture & Interior: https://3dmolierstudio.com/categories/furniture-interior/
- Electronics & Gadgets: https://3dmolierstudio.com/categories/electronics-gadgets/
- Clothing & Accessories: https://3dmolierstudio.com/categories/clothing-accessories/
- Food & Beverages: https://3dmolierstudio.com/categories/food-beverages/

## Industry Pages
- Aerospace: https://3dmolierstudio.com/industries/aerospace/
- Military & Defense: https://3dmolierstudio.com/industries/military-defense/
- Medical: https://3dmolierstudio.com/industries/medical/
- Game Development: https://3dmolierstudio.com/industries/game-development/
- Film & Video Production: https://3dmolierstudio.com/industries/film-video-production/
- Architecture: https://3dmolierstudio.com/industries/architecture/
- Virtual Reality: https://3dmolierstudio.com/industries/virtual-reality/
- Advertising: https://3dmolierstudio.com/industries/advertising/

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
- Request form: https://3dmolierstudio.com/custom-order/

## Sitemap
https://3dmolierstudio.com/sitemap.xml
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

Sitemap: https://3dmolierstudio.com/sitemap.xml
LLMs-txt: https://3dmolierstudio.com/llms.txt
LLMs-full: https://3dmolierstudio.com/llms-full.txt
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
    BASE_DOMAIN = "https://3dmolierstudio.com"

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
        "/industries/filmvideoproduction/": "/industries/film-video-production/",
        "/industries/games/": "/industries/game-development/",
        "/industries/simulation/": "/industries/aerospace/",
        "/industries/virtualreality/": "/industries/virtual-reality/",
        "/industries/militarydefense/": "/industries/military-defense/",
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
