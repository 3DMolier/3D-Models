#!/usr/bin/env python3
"""
Generates 19 static collection pages + a /collections/ index page.
Reads: data/collections.json  +  data/top_models.csv
Output: collections/{slug}/index.html  and  collections/index.html
"""
import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

# ── Category → accent color + gradient (light theme) ─────────────────────────

CAT_STYLE: dict[str, tuple[str, str]] = {
    "Vehicles":               ("#4F9EFF", "135deg,#E8F0FA 0%,#D4E4F7 50%,#C8DCEE 100%"),
    "Aircraft":               ("#9F7AEA", "135deg,#EDE8FA 0%,#E0D6F7 50%,#D5CAF0 100%"),
    "Military Vehicles":      ("#4ADE80", "135deg,#E8FAF0 0%,#D4F5E2 50%,#C8EED8 100%"),
    "Ships":                  ("#38BDF8", "135deg,#E8F5FA 0%,#D4EDF7 50%,#C8E5F0 100%"),
    "Medical":                ("#00E5C4", "135deg,#E5FAF7 0%,#CCFBF1 50%,#B8F5EA 100%"),
    "Industrial Equipment":   ("#10B981", "135deg,#E8F5EE 0%,#D4F0E2 50%,#C0EAD4 100%"),
    "Architecture Landmarks": ("#F59E0B", "135deg,#FEF3E5 0%,#FDE8C8 50%,#FCDDB0 100%"),
    "Characters & People":    ("#8B5CF6", "135deg,#EDE8FA 0%,#E3D9F7 50%,#D8CAF3 100%"),
    "Animals & Creatures":    ("#F97316", "135deg,#FEF0E5 0%,#FDE1C8 50%,#FCD4B0 100%"),
    "Nature & Plants":        ("#34D399", "135deg,#E8FAF2 0%,#D4F5E8 50%,#C0F0DB 100%"),
    "Furniture & Interior":   ("#A78BFA", "135deg,#F0ECFE 0%,#E6E0FD 50%,#DCD3FB 100%"),
    "Weapons & Tools":        ("#EF4444", "135deg,#FEE8E8 0%,#FDD4D4 50%,#FCC0C0 100%"),
    "Electronics & Gadgets":  ("#60A5FA", "135deg,#E8F0FE 0%,#D4E4FD 50%,#C8D8FB 100%"),
    "Clothing & Accessories": ("#F472B6", "135deg,#FEE8F2 0%,#FDD4E8 50%,#FCC0DA 100%"),
    "Food & Beverages":       ("#FBBF24", "135deg,#FEF5E5 0%,#FDE9C0 50%,#FDE0A0 100%"),
    "Other":                  ("#00E5C4", "135deg,#E5FAF7 0%,#CCFBF1 50%,#B8F5EA 100%"),
}

# ── Per-collection extra metadata (icon, accent, short_desc) ─────────────────

COLLECTION_META: dict[str, dict] = {
    # ── Category collections
    "best-vehicle-3d-models": {
        "icon": "🚗", "color": "#4F9EFF",
        "short_desc": "Top-selling cars, trucks, motorcycles and specialty vehicles for film, games and advertising.",
        "related": ["best-aircraft-3d-models", "best-military-vehicle-3d-models", "3d-models-for-film-production"],
    },
    "best-military-vehicle-3d-models": {
        "icon": "🪖", "color": "#4ADE80",
        "short_desc": "Best-ranked tanks, fighter jets, warships and military equipment for simulation and games.",
        "related": ["best-aircraft-3d-models", "best-ship-3d-models", "3d-models-for-defense-simulation"],
    },
    "best-aircraft-3d-models": {
        "icon": "✈️", "color": "#9F7AEA",
        "short_desc": "Top airliners, helicopters, jets and drones for aerospace visualization and film production.",
        "related": ["best-military-vehicle-3d-models", "3d-models-for-aerospace-visualization", "3d-models-for-film-production"],
    },
    "best-ship-3d-models": {
        "icon": "🚢", "color": "#38BDF8",
        "short_desc": "Top cruise liners, cargo ships, yachts and historical vessels for film and simulation.",
        "related": ["best-military-vehicle-3d-models", "best-vehicle-3d-models", "3d-models-for-film-production"],
    },
    "best-industrial-equipment-3d-models": {
        "icon": "⚙️", "color": "#10B981",
        "short_desc": "Top machinery, robot arms, HVAC systems and oil rigs for engineering visualization.",
        "related": ["3d-models-for-hardware-presentation", "best-medical-3d-models", "best-vehicle-3d-models"],
    },
    "best-medical-3d-models": {
        "icon": "🏥", "color": "#00E5C4",
        "short_desc": "Top anatomy, skeletal and surgical 3D models for medical education and visualization.",
        "related": ["3d-models-for-medical-visualization", "best-architecture-landmark-3d-models", "checkmate-certified-3d-models"],
    },
    "best-architecture-landmark-3d-models": {
        "icon": "🏛️", "color": "#F59E0B",
        "short_desc": "Top skyscrapers, landmarks and building models for architecture visualization and VR.",
        "related": ["3d-models-for-architecture-visualization", "3d-models-for-vr-projects", "3d-models-for-event-management"],
    },
    # ── Industry collections
    "3d-models-for-aerospace-visualization": {
        "icon": "🚀", "color": "#9F7AEA",
        "short_desc": "Aircraft and aerospace assets for flight simulation, visualization and VFX production.",
        "related": ["best-aircraft-3d-models", "best-military-vehicle-3d-models", "3d-models-for-defense-simulation"],
    },
    "3d-models-for-medical-visualization": {
        "icon": "🔬", "color": "#00E5C4",
        "short_desc": "Anatomy and medical device 3D models for healthcare training and visualization software.",
        "related": ["best-medical-3d-models", "checkmate-certified-3d-models", "3d-models-for-vr-projects"],
    },
    "3d-models-for-defense-simulation": {
        "icon": "🛡️", "color": "#4ADE80",
        "short_desc": "Military vehicles, weapons and terrain for defense training simulations and war games.",
        "related": ["best-military-vehicle-3d-models", "3d-models-for-aerospace-visualization", "3d-models-for-game-development"],
    },
    "3d-models-for-film-production": {
        "icon": "🎬", "color": "#F97316",
        "short_desc": "High-detail assets for film VFX, motion pictures and commercial video production.",
        "related": ["3d-models-for-advertising", "checkmate-certified-3d-models", "best-vehicle-3d-models"],
    },
    "3d-models-for-vr-projects": {
        "icon": "🥽", "color": "#8B5CF6",
        "short_desc": "Optimized assets for real-time VR experiences, architectural walkthroughs and metaverse.",
        "related": ["3d-models-for-game-development", "3d-models-for-architecture-visualization", "3d-models-for-medical-visualization"],
    },
    "3d-models-for-game-development": {
        "icon": "🎮", "color": "#60A5FA",
        "short_desc": "Game-ready vehicles, characters and environments for Unity, Unreal and other engines.",
        "related": ["3d-models-for-vr-projects", "3d-models-for-defense-simulation", "checkmate-certified-3d-models"],
    },
    "3d-models-for-advertising": {
        "icon": "📢", "color": "#FBBF24",
        "short_desc": "Product and scene 3D models for advertising, e-commerce and digital marketing campaigns.",
        "related": ["3d-models-for-film-production", "stemcell-certified-3d-models", "best-vehicle-3d-models"],
    },
    "3d-models-for-architecture-visualization": {
        "icon": "🏗️", "color": "#F59E0B",
        "short_desc": "Buildings, interiors and landscaping assets for architectural presentations and renders.",
        "related": ["best-architecture-landmark-3d-models", "3d-models-for-vr-projects", "3d-models-for-event-management"],
    },
    "3d-models-for-event-management": {
        "icon": "🎪", "color": "#F472B6",
        "short_desc": "Venues, props and decorative assets for event planning and virtual event visualization.",
        "related": ["3d-models-for-architecture-visualization", "best-architecture-landmark-3d-models", "3d-models-for-advertising"],
    },
    "3d-models-for-hardware-presentation": {
        "icon": "💻", "color": "#60A5FA",
        "short_desc": "Electronics, machinery and product 3D models for hardware demos and technical marketing.",
        "related": ["best-industrial-equipment-3d-models", "3d-models-for-advertising", "3d-models-for-film-production"],
    },
    # ── Certification collections
    "checkmate-certified-3d-models": {
        "icon": "✅", "color": "#FFC600",
        "short_desc": "Only models that passed TurboSquid's rigorous CheckMate quality certification process.",
        "related": ["stemcell-certified-3d-models", "best-vehicle-3d-models", "3d-models-for-film-production"],
    },
    "stemcell-certified-3d-models": {
        "icon": "⭐", "color": "#A78BFA",
        "short_desc": "StemCell certified models — clean topology, consistent scale and universal rigging.",
        "related": ["checkmate-certified-3d-models", "3d-models-for-game-development", "3d-models-for-vr-projects"],
    },
}

LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'

PROXY_BASE = "https://images.weserv.nl/?url="


# ── Nav + Footer ──────────────────────────────────────────────────────────────

def nav_html():
    return """<header class="cat-header sticky top-0 z-50">
  <nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
    <a href="/3D-Models/" class="flex items-center gap-2.5 shrink-0 nav-logo-link">
      <div class="cat-logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <span class="cat-logo-text">3D Molier</span>
    </a>
    <div class="hidden md:flex items-center gap-6">
      <a href="/3D-Models/catalog/" class="nav-link">Catalog</a>
      <a href="/3D-Models/categories/vehicles/" class="nav-link">Vehicles</a>
      <a href="/3D-Models/categories/aircraft/" class="nav-link">Aircraft</a>
      <a href="/3D-Models/categories/military-vehicles/" class="nav-link">Military</a>
      <a href="/3D-Models/categories/medical-3d-models/" class="nav-link">Medical</a>
      <a href="/3D-Models/collections/" class="nav-link">Collections</a>
      <a href="/3D-Models/search/" class="nav-link flex items-center gap-1" title="Search">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/></svg>
        Search
      </a>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-primary btn-primary--sm">
        TurboSquid Store
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  </nav>
</header>"""


def footer_html():
    return """<footer class="cat-footer">
  <div class="max-w-7xl mx-auto">
    <div class="cat-footer-grid">
      <div>
        <div class="flex items-center gap-2.5 mb-4">
          <div class="cat-footer-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span class="cat-footer-text">3D Molier</span>
        </div>
        <p class="cat-footer-desc">Searchable catalog of 88,000+ professional 3D models. All models available on TurboSquid.</p>
      </div>
      <div>
        <div class="cat-footer-col-hd">Categories</div>
        <div class="cat-footer-links">
          <a href="/3D-Models/categories/vehicles/" class="nav-link">Vehicles</a>
          <a href="/3D-Models/categories/aircraft/" class="nav-link">Aircraft</a>
          <a href="/3D-Models/categories/military-vehicles/" class="nav-link">Military</a>
          <a href="/3D-Models/categories/medical-3d-models/" class="nav-link">Medical</a>
          <a href="/3D-Models/categories/ships/" class="nav-link">Ships</a>
        </div>
      </div>
      <div>
        <div class="cat-footer-col-hd">Collections</div>
        <div class="cat-footer-links">
          <a href="/3D-Models/collections/best-vehicle-3d-models/" class="nav-link">Best Vehicles</a>
          <a href="/3D-Models/collections/best-aircraft-3d-models/" class="nav-link">Best Aircraft</a>
          <a href="/3D-Models/collections/best-medical-3d-models/" class="nav-link">Best Medical</a>
          <a href="/3D-Models/collections/best-military-vehicle-3d-models/" class="nav-link">Best Military</a>
          <a href="/3D-Models/collections/" class="nav-link">View all →</a>
        </div>
      </div>
      <div>
        <div class="cat-footer-col-hd">TurboSquid</div>
        <div class="cat-footer-links">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Artist Store</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/vehicle?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Vehicle Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/aircraft?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Aircraft Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/medical?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Medical Models</a>
        </div>
      </div>
    </div>
    <div class="cat-footer-bottom">
      <p class="cat-footer-copy">© 2025 3D Molier. All 3D models sold via TurboSquid.</p>
      <a href="/3D-Models/" class="nav-link">← Back to home</a>
    </div>
  </div>
</footer>"""


# ── Single model card ─────────────────────────────────────────────────────────

def model_card_html(m: dict) -> str:
    cat   = m.get('category', 'Other')
    color, gradient = CAT_STYLE.get(cat, CAT_STYLE['Other'])
    title = m['product_name']
    img   = m.get('image_url', '')
    url   = m.get('referral_url', '#')
    cert  = m.get('certification', '')
    try:
        price_str = f"${float(m['price']):.0f}"
    except (ValueError, TypeError):
        price_str = f"${m['price']}"

    # Proxy TurboSquid images through weserv.nl
    raw_img = img
    if img and img.startswith("https://static.turbosquid"):
        img = PROXY_BASE + img.replace("https://", "") + "&w=600&q=85&output=webp"

    cert_html = ''
    if 'CheckMate' in cert:
        cert_html = '<span class="cert-badge">&#10003; CM</span>'
    elif 'Stem' in cert:
        cert_html = '<span class="cert-badge cert-badge-stem">SC</span>'

    if img:
        img_html = (
            f'<img src="{img}" data-src="{raw_img}" alt="{title} 3D model preview" loading="lazy" '
            f'onerror="imgErr(this)">'
            f'<div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span>'
            f'<span class="mc-ph-label">{cat}</span></div>'
        )
    else:
        img_html = (
            f'<div class="img-placeholder" style="display:flex;">'
            f'<span class="mc-ph-icon">&#128247;</span>'
            f'<span class="mc-ph-label">{cat}</span></div>'
        )

    return f'''<div class="model-card card-glow">
        <div class="img-wrap mc-img">{img_html}</div>
        <div class="mc-body">
          <div class="mc-meta">
            <h3 class="mc-title">{title}</h3>
            {cert_html}
          </div>
          <div class="mc-foot">
            <span class="chip mc-chip">{cat}</span>
            <span class="mc-price">{price_str}</span>
          </div>
          <a href="{url}" target="_blank" rel="noopener" class="btn-ts">
            {LINK_ICON}
            View on TurboSquid
          </a>
        </div>
      </div>'''


# ── Page <head> (shared between collection pages and the index) ───────────────

def page_head(title: str, description: str, canonical: str, breadcrumb_json: str = '') -> str:
    bc_tag = f'\n<script type="application/ld+json">{breadcrumb_json}</script>' if breadcrumb_json else ''
    return f"""<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="3D Molier Models">
<meta property="og:image" content="https://3dmolier.github.io/3D-Models/assets/og/3d-molier-og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="https://3dmolier.github.io/3D-Models/assets/og/3d-molier-og.jpg">
<link rel="icon" href="/3D-Models/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{canonical}">
<link rel="alternate" hreflang="x-default" href="{canonical}">
<link rel="preload" href="/3D-Models/assets/fonts/font-13.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/3D-Models/assets/css/critical-fonts.css">
<link rel="stylesheet" href="/3D-Models/assets/css/fonts.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/3D-Models/assets/css/fonts.css"></noscript>
<link rel="stylesheet" href="/3D-Models/assets/css/styles.min.css">{bc_tag}
</head>"""


# ── Collection detail page ────────────────────────────────────────────────────

def collection_page_html(col: dict, models: list[dict], all_cols: list[dict]) -> str:
    slug   = col['collection_slug']
    title  = col['collection_title']
    seo_t  = col['seo_title']
    meta_d = col['meta_description']
    intro  = col['intro_text']
    ts_url = col['turbosquid_collection_url']
    total  = col['total_matching_models']
    ctype  = col['collection_type']

    meta   = COLLECTION_META.get(slug, {})
    icon   = meta.get('icon', '📦')
    short_desc = meta.get('short_desc', intro)

    type_label = {'category': 'Best-of Category', 'industry': 'Industry Collection', 'certification': 'Quality Certified'}.get(ctype, 'Collection')

    cards_html = '\n      '.join(model_card_html(m) for m in models)

    # Related collections
    related_slugs = meta.get('related', [])
    related_html  = ''
    slug_to_col   = {c['collection_slug']: c for c in all_cols}
    for rel_slug in related_slugs[:3]:
        rc = slug_to_col.get(rel_slug)
        if not rc:
            continue
        rc_meta = COLLECTION_META.get(rel_slug, {})
        rc_icon = rc_meta.get('icon', '📦')
        rc_raw_desc = rc_meta.get('short_desc', '')
        rc_desc = rc_raw_desc[:60] + '…' if rc_raw_desc else ''
        related_html += f'''<a href="/3D-Models/collections/{rel_slug}/" class="coll-card">
          <div class="coll-icon">{rc_icon}</div>
          <div class="coll-content">
            <div class="coll-card-title">{rc['collection_title']}</div>
            <div class="coll-card-desc">{rc_desc}</div>
          </div>
          <span class="coll-card-arrow">&#8594;</span>
        </a>\n'''

    base = "https://3dmolier.github.io/3D-Models"
    coll_url = f"{base}/collections/{slug}/"
    bc = json.dumps({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Home","item":f"{base}/"},
        {"@type":"ListItem","position":2,"name":"Collections","item":f"{base}/collections/"},
        {"@type":"ListItem","position":3,"name":title,"item":coll_url},
    ]}, ensure_ascii=False)
    head = page_head(seo_t, meta_d, coll_url, bc)

    return f'''<!DOCTYPE html>
<html lang="en">
{head}
<body class="relative min-h-screen">

{nav_html()}

<main class="cat-main">

<!-- Breadcrumb -->
<div class="cat-bc">
  <div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner">
    <a href="/3D-Models/" class="bc-link">Home</a>
    <span class="bc-sep">&#8250;</span>
    <a href="/3D-Models/collections/" class="bc-link">Collections</a>
    <span class="bc-sep">&#8250;</span>
    <span class="bc-current">{title}</span>
  </div>
</div>

<!-- Collection Hero -->
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="coll-hero">

      <div class="coll-hero-left">
        <div class="coll-hero-badge">{type_label}</div>

        <div class="coll-hero-row">
          <div class="coll-hero-icon">{icon}</div>
          <h1 class="coll-h1">{title}</h1>
        </div>

        <p class="coll-intro">{intro}</p>

        <div class="coll-actions">
          <a href="{ts_url}" target="_blank" rel="noopener" class="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Browse on TurboSquid
          </a>
          <a href="/3D-Models/collections/" class="btn-ghost">&#8592; All Collections</a>
        </div>
      </div>

      <!-- Stats panel -->
      <div class="cat-stats">
        <div class="cat-stat-cell">
          <div class="cat-stat-num">{total:,}</div>
          <div class="cat-stat-label">Total Models</div>
        </div>
        <div class="cat-stat-cell">
          <div class="cat-stat-num">{len(models)}</div>
          <div class="cat-stat-label">Featured</div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- Model Grid — all 24 in HTML for SEO -->
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header">
      <div>
        <div class="section-label">Hand-picked</div>
        <h2 class="section-h2">Featured Models</h2>
      </div>
      <a href="{ts_url}" target="_blank" rel="noopener" class="btn-ghost btn-ghost--md">
        View all on TurboSquid
      </a>
    </div>

    <div class="model-grid">
      {cards_html}
    </div>
  </div>
</section>

<!-- Related Collections -->
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="coll-rel-wrap">
      <div class="section-label">Explore More</div>
      <h2 class="section-h2 coll-rel-h2">Related Collections</h2>
      <div class="rel-grid">
        {related_html}
      </div>
    </div>
  </div>
</section>

</main>

{footer_html()}
<script src="/3D-Models/assets/js/site.min.js" defer></script>
</body>
</html>'''


# ── Collections index page (/collections/) ───────────────────────────────────

def collections_index_html(all_cols: list[dict]) -> str:
    by_type: dict[str, list[dict]] = {'category': [], 'industry': [], 'certification': []}
    for c in all_cols:
        by_type.setdefault(c['collection_type'], []).append(c)

    type_labels = {
        'category':      ('Best-of Category',   'Top-ranked 3D models within each product category.'),
        'industry':      ('By Industry',         'Curated sets for specific production industries.'),
        'certification': ('Certified Quality',   'Only models that passed rigorous quality certification.'),
    }

    sections_html = ''
    for ctype, cols_in_type in by_type.items():
        if not cols_in_type:
            continue
        label, sub = type_labels[ctype]
        cards_html = ''
        for c in cols_in_type:
            slug  = c['collection_slug']
            title = c['collection_title']
            total = c['total_matching_models']
            feat  = len(c['model_ids'])
            meta  = COLLECTION_META.get(slug, {})
            icon  = meta.get('icon', '📦')
            raw_desc = meta.get('short_desc', c['intro_text'])
            desc = raw_desc[:80] + '…'

            cards_html += f'''<a href="/3D-Models/collections/{slug}/" class="coll-idx-card">
              <div class="coll-idx-head">
                <div class="coll-idx-icon">{icon}</div>
                <div class="coll-idx-title">{title}</div>
              </div>
              <p class="coll-idx-desc">{desc}</p>
              <div class="coll-idx-foot">
                <span class="coll-idx-count">{feat} featured &middot; {total:,} total</span>
                <span class="coll-idx-action">Explore &#8594;</span>
              </div>
            </a>\n'''

        sections_html += f'''
    <div class="coll-sec">
      <div class="coll-sec-hd">
        <div class="section-label">{label}</div>
        <p class="coll-sec-sub">{sub}</p>
      </div>
      <div class="model-grid">
        {cards_html}
      </div>
    </div>'''

    base = "https://3dmolier.github.io/3D-Models"
    idx_bc = json.dumps({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Home","item":f"{base}/"},
        {"@type":"ListItem","position":2,"name":"Collections","item":f"{base}/collections/"},
    ]}, ensure_ascii=False)
    head = page_head(
        "3D Model Collections &#8212; Curated Sets by 3D Molier | TurboSquid",
        "19 curated 3D model collections by 3D Molier: best vehicles, aircraft, medical, military and more. Organized by category, industry and certification level.",
        f"{base}/collections/",
        idx_bc,
    )

    return f'''<!DOCTYPE html>
<html lang="en">
{head}
<body class="relative min-h-screen">

{nav_html()}

<main class="cat-main">

<!-- Breadcrumb -->
<div class="cat-bc">
  <div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner">
    <a href="/3D-Models/" class="bc-link">Home</a>
    <span class="bc-sep">&#8250;</span>
    <span class="bc-current">Collections</span>
  </div>
</div>

<!-- Page Hero -->
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="section-label">Hand-Picked Sets</div>
    <h1 class="coll-idx-h1">3D Model Collections</h1>
    <p class="coll-idx-intro">
      19 curated collections organized by product category, production industry and certification level. Each collection links directly to TurboSquid for purchase.
    </p>
  </div>
</section>

<!-- Collections Grid -->
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    {sections_html}
  </div>
</section>

</main>

{footer_html()}
<script src="/3D-Models/assets/js/site.min.js" defer></script>
</body>
</html>'''


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(BASE_DIR / 'data' / 'collections.json', encoding='utf-8') as f:
        all_cols: list[dict] = json.load(f)

    id_to_model: dict[str, dict] = {}
    with open(BASE_DIR / 'data' / 'top_models.csv', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            id_to_model[row['product_id']] = row

    for col in all_cols:
        slug   = col['collection_slug']
        models = [id_to_model[mid] for mid in col['model_ids'] if mid in id_to_model]
        missing = len(col['model_ids']) - len(models)

        out_dir = BASE_DIR / 'collections' / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        html = collection_page_html(col, models, all_cols)
        (out_dir / 'index.html').write_text(html, encoding='utf-8')
        note = f" ({missing} IDs not in top_models)" if missing else ""
        print(f"  {slug:<52}  {len(models)} models{note}")

    idx_dir = BASE_DIR / 'collections'
    idx_dir.mkdir(exist_ok=True)
    idx_html = collections_index_html(all_cols)
    (idx_dir / 'index.html').write_text(idx_html, encoding='utf-8')
    print(f"  {'collections/index.html':<52}  {len(all_cols)} collections listed")

    print(f"\nDone: {len(all_cols)} collection pages + index generated in collections/\n")


if __name__ == '__main__':
    main()
