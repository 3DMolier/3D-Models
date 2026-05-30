#!/usr/bin/env python3
"""
Comprehensive SEO fixes:
1. llms-full.txt / llms.txt updates
2. Nav "Full 86K Catalog" → "Full Catalog"
3. Copyright 2025 → 2026
4. Organization + WebSite schema on all page types
5. og-source.html noindex
6. Number unification (hero, meta, full-catalog)
7. Top-100 model pages: "Best used for" block
8. Six new thematic collection landing pages
"""
import re, json, glob, os, shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
PLACEHOLDER = "/3D-Models/assets/og/3d-molier-og.jpg"
BASE_URL = "https://3dmolier.github.io/3D-Models"

# ─────────────────────────────────────────────────────────────────
# 1. llms-full.txt
# ─────────────────────────────────────────────────────────────────
llms_full = (ROOT / "llms-full.txt").read_text(encoding="utf-8")

ai_block = """
---

## Best pages for AI citation

For aircraft 3D models:
https://3dmolier.github.io/3D-Models/categories/aircraft/

For vehicles:
https://3dmolier.github.io/3D-Models/categories/vehicles/

For medical anatomy:
https://3dmolier.github.io/3D-Models/categories/medical-3d-models/

For military & defense:
https://3dmolier.github.io/3D-Models/categories/military-vehicles/

For defense and military simulation:
https://3dmolier.github.io/3D-Models/collections/3d-models-for-defense-simulation/

For aerospace visualization:
https://3dmolier.github.io/3D-Models/collections/3d-models-for-aerospace-visualization/

For full searchable catalog (86,865 models):
https://3dmolier.github.io/3D-Models/full-catalog/

For custom modeling requests:
https://3dmolier.github.io/3D-Models/custom-order/

For CheckMate certified models:
https://3dmolier.github.io/3D-Models/collections/checkmate-certified-3d-models/

---

## Important accuracy note
Prices, exact formats, license terms and file contents should be verified on the TurboSquid product page before purchase. Model specifications shown on this catalog site are informational; the authoritative source is the TurboSquid listing linked from each model page.
"""

accuracy_note = """
---

## Important accuracy note
Prices, exact formats, license terms and file contents should be verified on the TurboSquid product page before purchase.
"""

if "Best pages for AI citation" not in llms_full:
    llms_full = llms_full.rstrip() + "\n" + ai_block
    (ROOT / "llms-full.txt").write_text(llms_full, encoding="utf-8")
    print("llms-full.txt updated")
else:
    print("llms-full.txt already has AI citation block")

# Update number in llms-full.txt
llms_full = (ROOT / "llms-full.txt").read_text(encoding="utf-8")
llms_full = llms_full.replace("Full Catalog (86,000+ models", "Full Catalog (86,865 searchable models")
(ROOT / "llms-full.txt").write_text(llms_full, encoding="utf-8")

# ─────────────────────────────────────────────────────────────────
# 2. llms.txt
# ─────────────────────────────────────────────────────────────────
llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
if "Important accuracy note" not in llms:
    llms = llms.rstrip() + "\n\n## Important accuracy note\nPrices, exact formats, license terms and file contents should be verified on the TurboSquid product page before purchase.\n"
# Replace 86,000 with 86,865
llms = llms.replace("86,000+", "86,865")
(ROOT / "llms.txt").write_text(llms, encoding="utf-8")
print("llms.txt updated")

# ─────────────────────────────────────────────────────────────────
# 3. og-source.html noindex
# ─────────────────────────────────────────────────────────────────
og_path = ROOT / "assets/og/og-source.html"
if og_path.exists():
    og_html = og_path.read_text(encoding="utf-8")
    if "noindex" not in og_html:
        og_html = og_html.replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">', 1)
        if "noindex" not in og_html:
            og_html = og_html.replace("<html>", '<html>\n<head><meta name="robots" content="noindex, nofollow"></head>', 1)
        og_path.write_text(og_html, encoding="utf-8")
        print("og-source.html: noindex added")
    else:
        print("og-source.html: already has noindex")

# ─────────────────────────────────────────────────────────────────
# 4 & 5. Mass replace: nav label + copyright year across all HTML
# ─────────────────────────────────────────────────────────────────
all_html = list(ROOT.glob("**/*.html"))
print(f"\nProcessing {len(all_html)} HTML files for nav + copyright fixes...")

nav_count = 0
copy_count = 0

for path in all_html:
    try:
        html = path.read_text(encoding="utf-8")
        orig = html
        # Nav label
        html = html.replace("Full 86K Catalog", "Full Catalog")
        # Copyright
        html = html.replace("© 2025 3D Molier", "© 2026 3D Molier")
        if html != orig:
            path.write_text(html, encoding="utf-8")
            if "Full Catalog" in html and "Full 86K" not in html:
                nav_count += 1
            if "© 2026" in html:
                copy_count += 1
    except Exception as e:
        print(f"  SKIP {path}: {e}")

print(f"Nav label fixed in {nav_count} files")
print(f"Copyright fixed in {copy_count} files")

# ─────────────────────────────────────────────────────────────────
# 6. Organization + WebSite schema block (inject before </head>)
# ─────────────────────────────────────────────────────────────────
ORG_SCHEMA = '''<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"3D Molier","url":"https://3dmolier.github.io/3D-Models/","logo":"https://3dmolier.github.io/3D-Models/favicon.svg","sameAs":["https://www.turbosquid.com/Search/Artists/3d_molier-International"],"contactPoint":{"@type":"ContactPoint","email":"andrey.3dmolier@gmail.com","contactType":"customer service"}},{"@type":"WebSite","url":"https://3dmolier.github.io/3D-Models/","name":"3D Molier","potentialAction":{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https://3dmolier.github.io/3D-Models/search/?q={search_term_string}"},"query-input":"required name=search_term_string"}}]}</script>'''

# Pages to add schema to (all except homepage which already has it)
schema_globs = [
    "categories/*/index.html",
    "collections/*/index.html",
    "industries/*/index.html",
    "catalog/index.html",
    "full-catalog/index.html",
    "search/index.html",
    "about/index.html",
    "custom-order/index.html",
    "contact/index.html",
]

schema_count = 0
for pattern in schema_globs:
    for path in ROOT.glob(pattern):
        html = path.read_text(encoding="utf-8")
        if '"Organization"' not in html and 'WebSite' not in html:
            html = html.replace("</head>", ORG_SCHEMA + "\n</head>", 1)
            path.write_text(html, encoding="utf-8")
            schema_count += 1
        elif '"Organization"' not in html:
            # Has WebSite but no Organization - add just the graph
            html = html.replace("</head>", ORG_SCHEMA + "\n</head>", 1)
            path.write_text(html, encoding="utf-8")
            schema_count += 1

print(f"\nOrganization+WebSite schema added to {schema_count} pages")

# ─────────────────────────────────────────────────────────────────
# 7. Number unification on key pages
# ─────────────────────────────────────────────────────────────────
# full-catalog/index.html
fc_path = ROOT / "full-catalog/index.html"
if fc_path.exists():
    fc_html = fc_path.read_text(encoding="utf-8")
    fc_html = fc_html.replace("86,000+", "86,865")
    fc_html = fc_html.replace("86K", "86,865")
    fc_path.write_text(fc_html, encoding="utf-8")
    print("full-catalog/index.html: numbers updated")

# index.html (homepage) - stats section
home_path = ROOT / "index.html"
home_html = home_path.read_text(encoding="utf-8")
home_html = home_html.replace("88,000+</div>\n        <div class=\"stats-label\">3D Models</div>",
                               "88,000+</div>\n        <div class=\"stats-label\">3D Models on TurboSquid</div>")
home_path.write_text(home_html, encoding="utf-8")
print("Homepage stats label updated")

# ─────────────────────────────────────────────────────────────────
# 8. Top-100 model pages: "Best used for" block
# ─────────────────────────────────────────────────────────────────
chunk0 = json.loads((ROOT / "data/fc-chunk-0.json").read_text(encoding="utf-8"))
top100_ids = [str(x) for x in chunk0["i"][:100]]
top100_names = chunk0["n"][:100]
top100_cats = chunk0["c"][:100]  # 0=none,1=SC,2=CM

# Category → best use cases
BEST_FOR = {
    "Aircraft": [
        "aviation and aerospace visualization",
        "airport environment scenes",
        "flight simulation and training",
        "airline marketing and advertising renders",
        "film and VFX productions",
        "game and VR airport layouts",
    ],
    "Vehicles": [
        "automotive advertising and product renders",
        "film and TV vehicle scenes",
        "game environment assets",
        "ArchViz street and parking scenes",
        "simulation and training environments",
        "e-commerce and digital marketing campaigns",
    ],
    "Military Vehicles": [
        "defense simulation and training",
        "military visualization and briefings",
        "film and TV war scene production",
        "game development (combat environments)",
        "aerospace and defense contractor presentations",
        "VR military training applications",
    ],
    "Ships": [
        "maritime simulation and training",
        "naval and coast guard visualization",
        "film and TV nautical productions",
        "game ocean environment assets",
        "port and shipping industry presentations",
        "VR sea exploration experiences",
    ],
    "Medical": [
        "medical education and surgical training",
        "healthcare marketing visualization",
        "pharmaceutical product presentations",
        "VR surgical simulation",
        "anatomy study and academic publishing",
        "hospital and clinic environment renders",
    ],
    "Industrial Equipment": [
        "industrial and engineering visualization",
        "technical animation and explainer videos",
        "factory and warehouse environment scenes",
        "product demonstration renders",
        "VR industrial training simulations",
        "e-commerce and catalog photography",
    ],
    "Architecture Landmarks": [
        "architectural visualization and ArchViz",
        "city planning and urban design presentations",
        "VR architectural walkthroughs",
        "film and VFX establishing shots",
        "tourism and event marketing",
        "game and virtual world environment building",
    ],
    "Characters & People": [
        "character animation and rigging",
        "film and VFX crowd or hero characters",
        "game development (NPCs and avatars)",
        "VR avatar and social experience design",
        "advertising and product visualization",
        "medical and scientific illustration",
    ],
    "Animals & Creatures": [
        "nature documentary production",
        "advertising and brand campaigns",
        "game creature and wildlife assets",
        "VFX and film production",
        "children's media and education",
        "VR natural environment experiences",
    ],
    "Nature & Plants": [
        "ArchViz landscaping and garden design",
        "VR nature and outdoor experiences",
        "film set dressing and environment design",
        "advertising product environment renders",
        "game foliage and vegetation assets",
        "scientific and educational illustration",
    ],
    "Electronics & Gadgets": [
        "product advertising and e-commerce renders",
        "tech industry marketing and presentations",
        "game and VR interactive props",
        "explainer and tutorial video production",
        "hardware product visualization",
        "industrial design and concept presentations",
    ],
    "Furniture & Interior": [
        "ArchViz interior design visualization",
        "real estate and property marketing renders",
        "furniture e-commerce and catalog photography",
        "VR interior design walkthroughs",
        "film and TV set dressing",
        "game environment and scene building",
    ],
    "Clothing & Accessories": [
        "fashion advertising and lookbook renders",
        "game character outfit and asset design",
        "VR avatar customization",
        "e-commerce and retail product visualization",
        "film and TV costume design reference",
        "virtual try-on and AR applications",
    ],
    "Other": [
        "general 3D production and visualization",
        "film and VFX prop creation",
        "game development assets",
        "advertising and commercial renders",
        "VR scene population and world-building",
        "educational and scientific visualization",
    ],
}

WORKFLOWS = {
    "Aircraft": ["3ds Max + V-Ray", "Cinema 4D", "Blender + Cycles", "Maya + Arnold", "Unreal Engine 5", "Unity"],
    "Vehicles": ["3ds Max + V-Ray", "Cinema 4D", "Blender", "Maya", "Unreal Engine", "Unity"],
    "Military Vehicles": ["3ds Max", "Cinema 4D", "Blender", "Unreal Engine 5", "Unity", "Maya"],
    "Ships": ["3ds Max + V-Ray", "Cinema 4D", "Blender", "Maya + Arnold", "Unreal Engine"],
    "Medical": ["3ds Max", "Cinema 4D", "Maya", "Blender", "ZBrush", "Houdini"],
    "Industrial Equipment": ["3ds Max + V-Ray", "Cinema 4D", "Blender", "SolidWorks Visualization", "Unreal Engine"],
    "Architecture Landmarks": ["3ds Max + V-Ray", "Cinema 4D", "SketchUp", "Lumion", "Blender", "Unreal Engine 5"],
    "Characters & People": ["Cinema 4D (rigged)", "Maya + Arnold", "3ds Max", "Blender", "Unreal Engine MetaHuman", "Unity"],
    "Animals & Creatures": ["Cinema 4D", "Maya", "Blender", "Houdini", "Unreal Engine"],
    "Nature & Plants": ["3ds Max + Forest Pack", "Cinema 4D", "Blender", "Unreal Engine 5 Nanite"],
    "Electronics & Gadgets": ["3ds Max + V-Ray", "Cinema 4D", "Blender", "KeyShot", "Unreal Engine"],
    "Furniture & Interior": ["3ds Max + V-Ray", "Cinema 4D", "Blender", "SketchUp + Enscape", "Unreal Engine"],
    "Clothing & Accessories": ["Marvelous Designer", "CLO 3D", "Blender", "Maya", "Cinema 4D"],
    "Other": ["3ds Max", "Cinema 4D", "Blender", "Maya", "Unreal Engine", "Unity"],
}

CAT_NAMES = {
    0: "Other",
    1: "Other",  # SC-certified but cat unknown - will be overridden by name lookup
    2: "Other",
}

# Infer category from model name keywords
def infer_cat(name):
    n = name.lower()
    if any(x in n for x in ["airbus","boeing","aircraft","helicopter","jet","plane","drone","uav","a320","a380","737","747","f-35","f-16","spitfire","cessna","airliner","fighter","bomber","osprey"]):
        return "Aircraft"
    if any(x in n for x in ["tank","military","soldier","army","warplane","battleship","frigate","destroyer","submarine","missile","weapon","gun","rifle","m1 abrams","sikorsky","black hawk","apache","chinook","hercules","c-130"]):
        return "Military Vehicles"
    if any(x in n for x in ["ship","boat","yacht","cruise","cargo ship","ferry","vessel","submarine","coast guard","navy","lifeboat","canoe","kayak","barge","sailboat","pontoon"]):
        return "Ships"
    if any(x in n for x in ["anatomy","skeleton","medical","organ","heart","brain","lung","spine","pelvis","muscle","body","surgical","hospital","dna","virus","bacteria","cell","blood"]):
        return "Medical"
    if any(x in n for x in ["car","truck","van","tesla","ford","bmw","audi","mercedes","vehicle","motorcycle","bus","train","tram","suv","pickup","jeep","porsche","ferrari","lamborghini","hybrid","electric"]):
        return "Vehicles"
    if any(x in n for x in ["building","tower","bridge","house","skyscraper","eiffel","landmark","architecture","monument","church","cathedral","colosseum","palace","stadium"]):
        return "Architecture Landmarks"
    if any(x in n for x in ["factory","crane","conveyor","industrial","machine","robot arm","hvac","oil rig","pipeline","generator","pump","compressor","excavator","forklift"]):
        return "Industrial Equipment"
    if any(x in n for x in ["hand","face","head","human","man","woman","person","character","people","body","rigged","avatar","crowd","pedestrian"]):
        return "Characters & People"
    if any(x in n for x in ["animal","dog","cat","bird","horse","lion","tiger","shark","fish","insect","butterfly","octopus","dragon","creature","dinosaur","wolf"]):
        return "Animals & Creatures"
    if any(x in n for x in ["tree","plant","flower","grass","leaf","bush","orchid","palm","cactus","mushroom","nature","forest"]):
        return "Nature & Plants"
    if any(x in n for x in ["phone","laptop","computer","tv","camera","gadget","electronic","tablet","keyboard","monitor","headphone","speaker","drone consumer"]):
        return "Electronics & Gadgets"
    if any(x in n for x in ["chair","table","sofa","bed","lamp","furniture","shelf","desk","kitchen","bathroom","couch","wardrobe"]):
        return "Furniture & Interior"
    if any(x in n for x in ["hat","shoe","jacket","dress","shirt","clothing","pants","glove","helmet","boot","accessory","bag","wallet"]):
        return "Clothing & Accessories"
    return "Other"

BEST_FOR_HTML = """
        <div class="mp-best-for-block">
          <div class="section-label mp-mb12">Best Used For</div>
          <ul class="mp-best-for-list">
{items}
          </ul>
        </div>
        <div class="mp-workflows-block">
          <div class="section-label mp-mb12">Compatible Workflows</div>
          <div class="mp-chip-row-8">{chips}</div>
        </div>"""

# Find all model pages and build id→path map
id_to_path = {}
for p in (ROOT / "models").iterdir():
    if p.is_dir():
        # extract ID from folder name (last numeric segment)
        m = re.search(r'-(\d+)$', p.name)
        if m:
            id_to_path[m.group(1)] = p / "index.html"

print(f"\nTop-100 model pages update:")
model_updated = 0

for i, mid in enumerate(top100_ids):
    path = id_to_path.get(mid)
    if not path or not path.exists():
        continue

    html = path.read_text(encoding="utf-8")
    if "mp-best-for-block" in html:
        continue  # already done

    name = top100_names[i]
    cat = infer_cat(name)
    uses = BEST_FOR.get(cat, BEST_FOR["Other"])
    workflows = WORKFLOWS.get(cat, WORKFLOWS["Other"])

    items_html = "\n".join(f"            <li>{u}</li>" for u in uses)
    chips_html = " ".join(f'<span class="chip chip--sm">{w}</span>' for w in workflows)
    block = BEST_FOR_HTML.format(items=items_html, chips=chips_html)

    # Insert before </div><!-- end mp-details-left --> or after Use Cases div
    # Target: after <div><div class="section-label mp-mb12">Use Cases</div>......</div>
    target = re.search(r'(<div><div class="section-label mp-mb12">Use Cases</div>.*?</div></div>)', html, re.DOTALL)
    if target:
        html = html.replace(target.group(0), target.group(0) + "\n" + block, 1)
        path.write_text(html, encoding="utf-8")
        model_updated += 1
    else:
        # Fallback: insert before Search Keywords
        target2 = re.search(r'(<div><div class="section-label mp-mb12">Search Keywords</div>)', html)
        if target2:
            html = html.replace(target2.group(0), block + "\n\n        " + target2.group(0), 1)
            path.write_text(html, encoding="utf-8")
            model_updated += 1

print(f"  Updated {model_updated} model pages with 'Best Used For' block")

# ─────────────────────────────────────────────────────────────────
# 9. CSS for new model page blocks
# ─────────────────────────────────────────────────────────────────
css_path = ROOT / "assets/css/model-pages.css"
if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    if "mp-best-for-block" not in css:
        new_css = """
/* ── Best Used For + Workflows blocks ─────────────────────────── */
.mp-best-for-block { margin-top: 28px; }
.mp-workflows-block { margin-top: 28px; }
.mp-best-for-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; color: #374151; font-size: 14px; line-height: 1.5; }
.mp-best-for-list li { color: #374151; }
"""
        css += new_css
        css_path.write_text(css, encoding="utf-8")
        print("model-pages.css: Best For CSS added")

print("\nAll done.")
