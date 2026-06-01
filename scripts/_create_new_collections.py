#!/usr/bin/env python3
"""
Creates 6 new thematic collection landing pages by adapting content
from the closest matching existing collection pages.
"""
import re, shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE_URL = "https://3dmolierstudio.com"

NEW_COLLECTIONS = [
    {
        "slug": "aircraft-3d-models-for-flight-simulation",
        "source": "best-aircraft-3d-models",
        "title": "Aircraft 3D Models for Flight Simulation",
        "seo_title": "Aircraft 3D Models for Flight Simulation | 3D Molier",
        "meta": "Professional aircraft 3D models for flight simulation, training software and aerospace visualization. CheckMate certified, real-world scale.",
        "h1": "Aircraft 3D Models for Flight Simulation",
        "intro": "Accurate aircraft 3D assets for flight simulation platforms, training software and aerospace visualization tools. All models feature real-world scale, correct proportions and clean topology — verified by TurboSquid's CheckMate certification.",
        "icon": "✈️",
        "label": "Flight Simulation",
        "related_cat": "/categories/aircraft/",
        "related_cat_label": "All Aircraft Models",
        "ts_url": "https://www.turbosquid.com/Search/aircraft?referral=3d_molier-studio",
    },
    {
        "slug": "uav-drone-3d-models-for-defense-visualization",
        "source": "3d-models-for-defense-simulation",
        "title": "UAV & Drone 3D Models for Defense Visualization",
        "seo_title": "UAV & Drone 3D Models for Defense Visualization | 3D Molier",
        "meta": "Military UAV, combat drone and unmanned aerial vehicle 3D models for defense visualization, simulation and contractor presentations.",
        "h1": "UAV & Drone 3D Models for Defense Visualization",
        "intro": "Military UAVs, combat drones, surveillance aircraft and unmanned vehicle 3D assets for defense visualization, simulation briefings and contractor presentations. Production-quality models used by defense agencies and simulation studios.",
        "icon": "🛡️",
        "label": "Defense Visualization",
        "related_cat": "/categories/military-vehicles/",
        "related_cat_label": "All Military Models",
        "ts_url": "https://www.turbosquid.com/Search/military?referral=3d_molier-studio",
    },
    {
        "slug": "medical-anatomy-3d-models-for-education",
        "source": "best-medical-3d-models",
        "title": "Medical Anatomy 3D Models for Education",
        "seo_title": "Medical Anatomy 3D Models for Education & Training | 3D Molier",
        "meta": "Anatomically accurate medical 3D models for medical education, surgical training and healthcare visualization. Full body, skeletal and organ systems.",
        "h1": "Medical Anatomy 3D Models for Education & Training",
        "intro": "Anatomically accurate full-body, skeletal and organ 3D models for medical education, surgical training simulations and healthcare visualization. Each model is built to real anatomical proportions and optimized for medical software, VR surgical training platforms and educational publishing.",
        "icon": "🔬",
        "label": "Medical Education",
        "related_cat": "/categories/medical-3d-models/",
        "related_cat_label": "All Medical Models",
        "ts_url": "https://www.turbosquid.com/Search/medical?referral=3d_molier-studio",
    },
    {
        "slug": "industrial-equipment-3d-models-for-technical-animation",
        "source": "best-industrial-equipment-3d-models",
        "title": "Industrial Equipment 3D Models for Technical Animation",
        "seo_title": "Industrial Equipment 3D Models for Technical Animation | 3D Molier",
        "meta": "Industrial machinery, factory equipment and technical 3D models for engineering animation, product visualization and industrial training content.",
        "h1": "Industrial Equipment 3D Models for Technical Animation",
        "intro": "Detailed industrial machinery, factory equipment, conveyor systems and manufacturing assets for technical animation, engineering visualization and industrial training videos. Models are optimized for 3ds Max, Cinema 4D and Blender rendering pipelines.",
        "icon": "⚙️",
        "label": "Technical Animation",
        "related_cat": "/categories/industrial-equipment/",
        "related_cat_label": "All Industrial Models",
        "ts_url": "https://www.turbosquid.com/Search/industrial?referral=3d_molier-studio",
    },
    {
        "slug": "ship-3d-models-for-maritime-simulation",
        "source": "best-ship-3d-models",
        "title": "Ship 3D Models for Maritime Simulation",
        "seo_title": "Ship 3D Models for Maritime Simulation & Training | 3D Molier",
        "meta": "Naval vessel, cargo ship and maritime 3D models for maritime simulation, port training and naval visualization. Real-world scale, production-ready.",
        "h1": "Ship 3D Models for Maritime Simulation & Training",
        "intro": "Naval vessels, cargo ships, coast guard cutters, tankers and pleasure craft 3D assets for maritime simulation, port and logistics training, and naval visualization tools. All models are built to real-world scale with accurate hull geometry.",
        "icon": "🚢",
        "label": "Maritime Simulation",
        "related_cat": "/categories/ships/",
        "related_cat_label": "All Ship Models",
        "ts_url": "https://www.turbosquid.com/Search/ship?referral=3d_molier-studio",
    },
    {
        "slug": "vehicle-3d-models-for-advertising",
        "source": "best-vehicle-3d-models",
        "title": "Vehicle 3D Models for Advertising & Marketing",
        "seo_title": "Vehicle 3D Models for Advertising & Marketing | 3D Molier",
        "meta": "Photorealistic car, truck and vehicle 3D models for automotive advertising, commercial campaigns and digital marketing renders. CheckMate certified.",
        "h1": "Vehicle 3D Models for Advertising & Marketing",
        "intro": "Photorealistic car, truck, van and specialty vehicle 3D assets for automotive advertising, commercial film campaigns, product launches and digital marketing renders. Every model features clean, render-ready geometry and accurate brand proportions.",
        "icon": "🚗",
        "label": "Advertising",
        "related_cat": "/categories/vehicles/",
        "related_cat_label": "All Vehicle Models",
        "ts_url": "https://www.turbosquid.com/Search/vehicle?referral=3d_molier-studio",
    },
]

ORG_SCHEMA = '{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"3D Molier","url":"https://3dmolierstudio.com/","logo":"https://3dmolierstudio.com/favicon.svg","sameAs":["https://www.turbosquid.com/Search/Artists/3d_molier-International"]},{"@type":"WebSite","url":"https://3dmolierstudio.com/","name":"3D Molier","potentialAction":{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https://3dmolierstudio.com/search/?q={search_term_string}"},"query-input":"required name=search_term_string"}}]}'

for col in NEW_COLLECTIONS:
    dest_dir = ROOT / "collections" / col["slug"]
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / "index.html"

    # Skip if already exists and looks complete
    if dest_file.exists() and len(dest_file.read_text(encoding="utf-8")) > 5000:
        print(f"SKIP (exists): {col['slug']}")
        continue

    # Copy source collection page
    src_file = ROOT / "collections" / col["source"] / "index.html"
    if not src_file.exists():
        print(f"ERROR: source not found: {src_file}")
        continue

    html = src_file.read_text(encoding="utf-8")
    src_slug = col["source"]
    new_slug = col["slug"]
    url = f"{BASE_URL}/collections/{new_slug}/"

    # Replace URL references
    html = html.replace(f"/collections/{src_slug}/", f"/collections/{new_slug}/")
    html = html.replace(f"{BASE_URL}/collections/{src_slug}/", url)

    # Replace title/meta/h1
    old_src_data = {
        "best-aircraft-3d-models": ("Best Aircraft 3D Models", "Aircraft 3D Models"),
        "3d-models-for-defense-simulation": ("3D Models for Defense &amp; Simulation", "Defense &amp; Simulation 3D Models"),
        "best-medical-3d-models": ("Best Medical 3D Models", "Medical 3D Models"),
        "best-industrial-equipment-3d-models": ("Best Industrial Equipment 3D Models", "Industrial Equipment 3D Models"),
        "best-ship-3d-models": ("Best Ship 3D Models", "Ship 3D Models"),
        "best-vehicle-3d-models": ("Best Vehicle 3D Models", "Vehicle 3D Models"),
    }

    # Update <title>
    html = re.sub(r'<title>[^<]+</title>', f'<title>{col["seo_title"]}</title>', html)

    # Update meta description
    html = re.sub(r'<meta name="description" content="[^"]*"',
                  f'<meta name="description" content="{col["meta"]}"', html)

    # Update og:title
    html = re.sub(r'<meta property="og:title" content="[^"]*"',
                  f'<meta property="og:title" content="{col["title"]}"', html)

    # Update og:description
    html = re.sub(r'<meta property="og:description" content="[^"]*"',
                  f'<meta property="og:description" content="{col["meta"]}"', html)

    # Update og:url
    html = re.sub(r'<meta property="og:url" content="[^"]*"',
                  f'<meta property="og:url" content="{url}"', html)

    # Update canonical
    html = re.sub(r'<link rel="canonical" href="[^"]*"',
                  f'<link rel="canonical" href="{url}"', html)

    # Update hreflang
    html = re.sub(r'<link rel="alternate" hreflang="en" href="[^"]*"',
                  f'<link rel="alternate" hreflang="en" href="{url}"', html)
    html = re.sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*"',
                  f'<link rel="alternate" hreflang="x-default" href="{url}"', html)

    # Update H1 (collection hero title)
    html = re.sub(r'<h1 class="coll-h1">[^<]*</h1>',
                  f'<h1 class="coll-h1">{col["title"]}</h1>', html)

    # Update intro paragraph (first <p class="coll-intro"> or similar)
    html = re.sub(r'<p class="coll-intro">[^<]*</p>',
                  f'<p class="coll-intro">{col["intro"]}</p>', html)

    # Update breadcrumb last item
    html = re.sub(r'<span class="bc-current">[^<]+</span>',
                  f'<span class="bc-current">{col["title"]}</span>', html)

    # Update page-label chip
    html = re.sub(r'<div class="section-label">[^<]*</div>',
                  f'<div class="section-label">{col["label"]}</div>', html, count=1)

    # Update JSON-LD BreadcrumbList
    html = re.sub(
        r'"name":\s*"[^"]+",\s*"item":\s*"' + re.escape(f"{BASE_URL}/collections/{src_slug}/"),
        f'"name":"{col["title"]}","item":"{url}"', html
    )

    # Update Schema @type CollectionPage name/description/url
    html = re.sub(r'"name":\s*"[^"]*' + re.escape(src_slug) + r'[^"]*"',
                  f'"name":"{col["title"]}"', html)

    # Update "View all" link to TurboSquid
    html = html.replace(col["ts_url"].replace(
        re.sub(r'\?.*', '', col["ts_url"]), re.sub(r'\?.*', '', col["ts_url"])),
        col["ts_url"])

    # Ensure Organization schema is present
    if '"Organization"' not in html:
        html = html.replace("</head>",
                             f'<script type="application/ld+json">{ORG_SCHEMA}</script>\n</head>', 1)

    dest_file.write_text(html, encoding="utf-8")
    print(f"Created: collections/{new_slug}/")

print("\nNew collection pages done.")
