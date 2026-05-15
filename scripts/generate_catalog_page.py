"""Generate /catalog/index.html — full browse with client-side filtering."""

import csv, json, os, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data" / "top_models.csv"
OUT  = ROOT / "catalog" / "index.html"

CAT_STYLE = {
    "Vehicles":                {"color": "#4F9EFF", "icon": "🚗"},
    "Aircraft":                {"color": "#9F7AEA", "icon": "✈️"},
    "Military Vehicles":       {"color": "#4ADE80", "icon": "🪖"},
    "Ships":                   {"color": "#38BDF8", "icon": "⚓"},
    "Medical":                 {"color": "#00E5C4", "icon": "🧬"},
    "Industrial Equipment":    {"color": "#10B981", "icon": "⚙️"},
    "Architecture Landmarks":  {"color": "#F59E0B", "icon": "🏛️"},
    "Characters & People":     {"color": "#8B5CF6", "icon": "👤"},
    "Animals & Creatures":     {"color": "#F97316", "icon": "🐾"},
    "Nature & Plants":         {"color": "#34D399", "icon": "🌿"},
    "Furniture & Interior":    {"color": "#A78BFA", "icon": "🪑"},
    "Weapons & Tools":         {"color": "#EF4444", "icon": "⚔️"},
    "Electronics & Gadgets":   {"color": "#60A5FA", "icon": "💻"},
    "Clothing & Accessories":  {"color": "#F472B6", "icon": "👗"},
    "Food & Beverages":        {"color": "#FBBF24", "icon": "🍕"},
    "Other":                   {"color": "#00E5C4", "icon": "📦"},
}

CAT_SLUG = {
    "Vehicles":               "vehicles",
    "Aircraft":               "aircraft",
    "Military Vehicles":      "military-vehicles",
    "Ships":                  "ships",
    "Medical":                "medical-3d-models",
    "Industrial Equipment":   "industrial-equipment",
    "Architecture Landmarks": "architecture-landmarks",
    "Characters & People":    "characters-people",
    "Animals & Creatures":    "animals-creatures",
    "Nature & Plants":        "nature-plants",
    "Furniture & Interior":   "furniture-interior",
    "Weapons & Tools":        "weapons-tools",
    "Electronics & Gadgets":  "electronics-gadgets",
    "Clothing & Accessories": "clothing-accessories",
    "Food & Beverages":       "food-beverages",
    "Other":                  "other",
}

def read_models():
    rows = list(csv.DictReader(open(DATA, encoding="utf-8")))
    rows.sort(key=lambda r: float(r["priority_score"]), reverse=True)
    return rows

def build_json(rows):
    out = []
    for r in rows:
        cat = r["category"]
        style = CAT_STYLE.get(cat, {"color": "#00E5C4", "icon": "📦"})
        out.append({
            "s":    r["slug"],
            "n":    r["product_name"],
            "p":    float(r["price"]),
            "c":    cat,
            "col":  style["color"],
            "cert": r["certification"],
            "img":  r["image_url"],
            "sales": int(float(r["sales_qty"])) if r["sales_qty"] else 0,
        })
    return json.dumps(out, ensure_ascii=False, separators=(",", ":"))

def cat_counts(rows):
    counts = {}
    for r in rows:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    return counts

def generate():
    rows = read_models()
    models_json = build_json(rows)
    counts = cat_counts(rows)
    total = len(rows)

    cats_ordered = sorted(CAT_STYLE.keys(), key=lambda c: counts.get(c, 0), reverse=True)

    # Build category filter pills HTML
    cat_pills_html = ""
    for cat in cats_ordered:
        n = counts.get(cat, 0)
        if n == 0:
            continue
        col = CAT_STYLE[cat]["color"]
        icon = CAT_STYLE[cat]["icon"]
        cat_pills_html += f"""
          <label class="cat-pill" data-cat="{cat}" style="--cat-col:{col}">
            <input type="checkbox" name="cat" value="{cat}" class="sr-only">
            <span class="pill-icon">{icon}</span>
            <span class="pill-name">{cat}</span>
            <span class="pill-count">{n}</span>
          </label>"""

    OUT.parent.mkdir(parents=True, exist_ok=True)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Browse 3D Models Catalog — 88,000+ Assets | 3D Molier on TurboSquid</title>
<meta name="description" content="Browse 88,000+ professional 3D models by 3D Molier on TurboSquid. Filter by category, price, and certification. Vehicles, Aircraft, Medical, Architecture and more.">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {{
    --teal: #00E5C4;
    --bg: #07090F;
    --surface: #0D1117;
    --surface2: #131A22;
    --border: rgba(255,255,255,0.07);
    --text: #E8EAF0;
    --muted: #6B7280;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html {{ scroll-behavior: smooth; }}
  body {{ background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; }}
  .syne {{ font-family: 'Syne', sans-serif; }}

  /* Noise grain */
  body::before {{
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.5;
  }}

  /* NAV */
  nav {{ position: sticky; top: 0; z-index: 50; background: rgba(7,9,15,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }}
  .nav-inner {{ max-width: 1400px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; gap: 32px; }}
  .nav-logo {{ font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; text-decoration: none; letter-spacing: -0.03em; }}
  .nav-logo span {{ color: var(--teal); }}
  .nav-links {{ display: flex; gap: 24px; margin-left: auto; }}
  .nav-links a {{ color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }}
  .nav-links a:hover {{ color: #fff; }}
  .btn-ts {{ background: var(--teal); color: #07090F; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 8px; text-decoration: none; white-space: nowrap; transition: opacity 0.2s, transform 0.15s; }}
  .btn-ts:hover {{ opacity: 0.88; transform: translateY(-1px); }}
  .sr-only {{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }}

  /* HERO */
  .hero {{ max-width: 1400px; margin: 0 auto; padding: 48px 24px 32px; }}
  .hero h1 {{ font-family: 'Syne', sans-serif; font-weight: 800; font-size: clamp(28px, 4vw, 48px); letter-spacing: -0.03em; line-height: 1.15; color: #fff; }}
  .hero h1 span {{ color: var(--teal); }}
  .hero-sub {{ color: var(--muted); margin-top: 10px; font-size: 16px; }}
  .hero-stats {{ display: flex; gap: 24px; margin-top: 24px; flex-wrap: wrap; }}
  .hero-stat {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; }}
  .hero-stat .val {{ font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--teal); }}
  .hero-stat .lbl {{ font-size: 12px; color: var(--muted); margin-top: 2px; }}

  /* SEARCH BAR */
  .search-wrap {{ position: relative; margin-top: 28px; max-width: 600px; }}
  .search-icon {{ position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); width: 18px; }}
  #search-input {{ width: 100%; background: var(--surface); border: 1px solid var(--border); color: #fff; font-family: 'Inter', sans-serif; font-size: 15px; padding: 14px 16px 14px 46px; border-radius: 12px; outline: none; transition: border-color 0.2s; }}
  #search-input:focus {{ border-color: var(--teal); }}
  #search-input::placeholder {{ color: var(--muted); }}

  /* LAYOUT */
  .catalog-layout {{ max-width: 1400px; margin: 0 auto; padding: 0 24px 80px; display: grid; grid-template-columns: 260px 1fr; gap: 32px; }}
  @media (max-width: 900px) {{ .catalog-layout {{ grid-template-columns: 1fr; }} .sidebar {{ display: none; }} }}

  /* SIDEBAR */
  .sidebar {{ position: sticky; top: 76px; height: fit-content; max-height: calc(100vh - 100px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }}
  .filter-section {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px; }}
  .filter-section h3 {{ font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 14px; }}

  /* Category pills */
  .cat-pills {{ display: flex; flex-direction: column; gap: 6px; }}
  .cat-pill {{ display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; user-select: none; }}
  .cat-pill:hover {{ background: rgba(255,255,255,0.04); }}
  .cat-pill.active {{ background: color-mix(in srgb, var(--cat-col) 12%, transparent); border-color: color-mix(in srgb, var(--cat-col) 30%, transparent); }}
  .pill-icon {{ font-size: 14px; width: 20px; text-align: center; }}
  .pill-name {{ font-size: 13px; color: var(--text); flex: 1; }}
  .cat-pill.active .pill-name {{ color: var(--cat-col); font-weight: 600; }}
  .pill-count {{ font-size: 11px; color: var(--muted); background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 20px; }}

  /* Price brackets */
  .price-btns {{ display: flex; flex-direction: column; gap: 6px; }}
  .price-btn {{ display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; background: transparent; color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; text-align: left; width: 100%; }}
  .price-btn:hover {{ background: rgba(255,255,255,0.04); }}
  .price-btn.active {{ background: rgba(0,229,196,0.1); border-color: rgba(0,229,196,0.25); color: var(--teal); }}
  .price-btn .price-count {{ font-size: 11px; color: var(--muted); }}

  /* Cert filter */
  .cert-options {{ display: flex; flex-direction: column; gap: 6px; }}
  .cert-opt {{ display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; user-select: none; }}
  .cert-opt:hover {{ background: rgba(255,255,255,0.04); }}
  .cert-opt.active {{ background: rgba(0,229,196,0.08); border-color: rgba(0,229,196,0.2); }}
  .cert-label {{ font-size: 13px; flex: 1; }}
  .cert-badge {{ font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }}
  .cert-badge.cm {{ background: rgba(79,158,255,0.15); color: #4F9EFF; }}
  .cert-badge.sc {{ background: rgba(139,92,246,0.15); color: #8B5CF6; }}
  .cert-badge.none {{ background: rgba(107,114,128,0.15); color: var(--muted); }}

  /* Clear filters */
  #clear-btn {{ width: 100%; padding: 10px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; display: none; }}
  #clear-btn:hover {{ background: rgba(239,68,68,0.18); }}
  #clear-btn.visible {{ display: block; }}

  /* RESULTS AREA */
  .results-bar {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }}
  .results-count {{ font-size: 14px; color: var(--muted); }}
  .results-count strong {{ color: #fff; font-weight: 600; }}

  /* Active filter chips */
  #active-filters {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; min-height: 0; }}
  .active-chip {{ display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(0,229,196,0.1); border: 1px solid rgba(0,229,196,0.25); border-radius: 20px; font-size: 12px; color: var(--teal); }}
  .active-chip button {{ background: none; border: none; color: var(--teal); cursor: pointer; line-height: 1; padding: 0; font-size: 14px; opacity: 0.7; }}
  .active-chip button:hover {{ opacity: 1; }}

  /* Sort */
  .sort-wrap {{ display: flex; align-items: center; gap: 10px; }}
  .sort-wrap label {{ font-size: 13px; color: var(--muted); }}
  #sort-select {{ background: var(--surface); border: 1px solid var(--border); color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; padding: 7px 12px; border-radius: 8px; outline: none; cursor: pointer; }}
  #sort-select:focus {{ border-color: var(--teal); }}

  /* MODEL GRID */
  #model-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }}

  .model-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; text-decoration: none; display: block; }}
  .model-card:hover {{ transform: translateY(-4px); border-color: rgba(255,255,255,0.14); box-shadow: 0 12px 40px rgba(0,0,0,0.5); }}

  .card-img {{ position: relative; padding-top: 75%; overflow: hidden; background: var(--surface2); }}
  .card-img img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
  .card-img .img-fallback {{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 36px; }}
  .card-overlay {{ position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.7) 0%, transparent 60%); }}
  .card-cert {{ position: absolute; top: 8px; right: 8px; font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }}
  .cert-cm-badge {{ background: rgba(79,158,255,0.2); color: #4F9EFF; backdrop-filter: blur(4px); }}
  .cert-sc-badge {{ background: rgba(139,92,246,0.2); color: #8B5CF6; backdrop-filter: blur(4px); }}

  .card-body {{ padding: 12px; }}
  .card-cat {{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }}
  .card-name {{ font-size: 13px; font-weight: 600; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
  .card-footer {{ display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }}
  .card-price {{ font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; color: #fff; }}
  .card-sales {{ font-size: 11px; color: var(--muted); }}

  /* LOAD MORE */
  .load-more-wrap {{ text-align: center; margin-top: 40px; }}
  #load-more-btn {{ background: transparent; border: 1px solid var(--border); color: #fff; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; padding: 14px 40px; border-radius: 12px; cursor: pointer; transition: border-color 0.2s, background 0.2s; }}
  #load-more-btn:hover {{ border-color: var(--teal); background: rgba(0,229,196,0.06); }}
  #load-more-btn:disabled {{ opacity: 0.4; cursor: default; }}

  /* EMPTY STATE */
  #empty-state {{ display: none; text-align: center; padding: 80px 20px; }}
  #empty-state .empty-icon {{ font-size: 64px; margin-bottom: 20px; opacity: 0.5; }}
  #empty-state h3 {{ font-family: 'Syne', sans-serif; font-size: 24px; color: #fff; margin-bottom: 10px; }}
  #empty-state p {{ color: var(--muted); }}

  /* FOOTER */
  footer {{ background: var(--surface); border-top: 1px solid var(--border); padding: 48px 0 24px; }}
  .footer-inner {{ max-width: 1400px; margin: 0 auto; padding: 0 24px; }}
  .footer-grid {{ display: grid; grid-template-columns: 2fr repeat(3, 1fr); gap: 40px; margin-bottom: 40px; }}
  .footer-brand p {{ color: var(--muted); font-size: 13px; line-height: 1.7; margin-top: 10px; max-width: 280px; }}
  .footer-col h4 {{ font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 14px; }}
  .footer-col a {{ display: block; color: #9CA3AF; font-size: 13px; text-decoration: none; margin-bottom: 8px; transition: color 0.2s; }}
  .footer-col a:hover {{ color: #fff; }}
  .footer-bottom {{ border-top: 1px solid var(--border); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; }}
  .footer-bottom p {{ color: var(--muted); font-size: 12px; }}
  .back-top {{ color: var(--muted); font-size: 12px; text-decoration: none; transition: color 0.2s; }}
  .back-top:hover {{ color: var(--teal); }}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">3D <span>Molier</span></a>
    <div class="nav-links">
      <a href="/catalog/">Catalog</a>
      <a href="/categories/vehicles/">Vehicles</a>
      <a href="/categories/aircraft/">Aircraft</a>
      <a href="/categories/military-vehicles/">Military</a>
      <a href="/categories/medical-3d-models/">Medical</a>
      <a href="/collections/">Collections</a>
      <a href="/search/" style="display:flex;align-items:center;gap:4px;color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6B7280'">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/></svg>
        Search
      </a>
    </div>
    <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" class="btn-ts" target="_blank" rel="noopener">TurboSquid ↗</a>
  </div>
</nav>

<!-- HERO -->
<div class="hero">
  <h1 class="syne">Browse <span>{total:,}</span> Top 3D Models</h1>
  <p class="hero-sub">Professional assets from 88,000+ 3D models by 3D Molier on TurboSquid</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="val">88K+</div><div class="lbl">Total Models</div></div>
    <div class="hero-stat"><div class="val">1,000</div><div class="lbl">Top Featured</div></div>
    <div class="hero-stat"><div class="val">15</div><div class="lbl">Categories</div></div>
    <div class="hero-stat"><div class="val">CheckMate</div><div class="lbl">Quality Certified</div></div>
  </div>
  <div class="search-wrap">
    <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/>
    </svg>
    <input id="search-input" type="search" placeholder="Search models by name…" autocomplete="off">
  </div>
</div>

<!-- CATALOG LAYOUT -->
<div class="catalog-layout">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <!-- Categories -->
    <div class="filter-section">
      <h3>Category</h3>
      <div class="cat-pills">{cat_pills_html}
      </div>
    </div>

    <!-- Price -->
    <div class="filter-section">
      <h3>Price</h3>
      <div class="price-btns">
        <button class="price-btn active" data-min="0" data-max="999999">Any price</button>
        <button class="price-btn" data-min="0" data-max="49">Under $50</button>
        <button class="price-btn" data-min="50" data-max="99">$50 – $99</button>
        <button class="price-btn" data-min="100" data-max="199">$100 – $199</button>
        <button class="price-btn" data-min="200" data-max="499">$200 – $499</button>
        <button class="price-btn" data-min="500" data-max="999999">$500+</button>
      </div>
    </div>

    <!-- Certification -->
    <div class="filter-section">
      <h3>Certification</h3>
      <div class="cert-options">
        <label class="cert-opt" data-cert="CheckMate Lite/Pro">
          <input type="checkbox" class="sr-only" value="CheckMate Lite/Pro">
          <span class="cert-label">CheckMate</span>
          <span class="cert-badge cm">CM</span>
        </label>
        <label class="cert-opt" data-cert="StemCell">
          <input type="checkbox" class="sr-only" value="StemCell">
          <span class="cert-label">StemCell</span>
          <span class="cert-badge sc">SC</span>
        </label>
        <label class="cert-opt" data-cert="no certification">
          <input type="checkbox" class="sr-only" value="no certification">
          <span class="cert-label">No Certification</span>
          <span class="cert-badge none">–</span>
        </label>
      </div>
    </div>

    <button id="clear-btn" onclick="clearAll()">Clear All Filters</button>
  </aside>

  <!-- RESULTS -->
  <main>
    <div class="results-bar">
      <p class="results-count"><strong id="count-display">{total}</strong> models found</p>
      <div class="sort-wrap">
        <label for="sort-select">Sort by</label>
        <select id="sort-select">
          <option value="priority">Best Match</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="sales">Most Sales</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
    </div>

    <div id="active-filters"></div>

    <div id="model-grid"></div>

    <div id="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No models found</h3>
      <p>Try adjusting your filters or search terms.</p>
    </div>

    <div class="load-more-wrap">
      <button id="load-more-btn" onclick="loadMore()">Load More Models</button>
    </div>
  </main>
</div>

<!-- FOOTER -->
<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="nav-logo" style="font-size:20px">3D <span style="color:var(--teal)">Molier</span></div>
        <p>Professional 3D models for Film, Games, Architecture and Medical visualization. All models on TurboSquid.</p>
      </div>
      <div class="footer-col">
        <h4>Categories</h4>
        <a href="/categories/vehicles/">Vehicles</a>
        <a href="/categories/aircraft/">Aircraft</a>
        <a href="/categories/military-vehicles/">Military Vehicles</a>
        <a href="/categories/ships/">Ships</a>
      </div>
      <div class="footer-col">
        <h4>Collections</h4>
        <a href="/collections/best-vehicle-3d-models/">Best Vehicles</a>
        <a href="/collections/best-aircraft-3d-models/">Best Aircraft</a>
        <a href="/collections/best-medical-3d-models/">Best Medical</a>
        <a href="/collections/">All Collections</a>
      </div>
      <div class="footer-col">
        <h4>TurboSquid</h4>
        <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" target="_blank" rel="noopener">Artist Store</a>
        <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&search_type=1&referral=3d_molier-studio" target="_blank" rel="noopener">Vehicle Models</a>
        <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&search_type=2&referral=3d_molier-studio" target="_blank" rel="noopener">Aircraft Models</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2025 3D Molier. All models available on TurboSquid.</p>
      <a href="#" class="back-top">Back to top ↑</a>
    </div>
  </div>
</footer>

<script>
const ALL = {models_json};

// State
let selCats  = new Set();
let selCerts = new Set();
let priceMin = 0;
let priceMax = 999999;
let searchQ  = '';
let sortMode = 'priority';
let page     = 1;
const PER    = 24;

// Filtered result cache
let filtered = ALL.slice();

function applyFilters() {{
  const q = searchQ.toLowerCase();
  filtered = ALL.filter(m => {{
    if (q && !m.n.toLowerCase().includes(q)) return false;
    if (selCats.size  && !selCats.has(m.c))    return false;
    if (selCerts.size && !selCerts.has(m.cert)) return false;
    if (m.p < priceMin || m.p > priceMax)       return false;
    return true;
  }});

  if (sortMode === 'price-asc')  filtered.sort((a,b) => a.p - b.p);
  else if (sortMode === 'price-desc') filtered.sort((a,b) => b.p - a.p);
  else if (sortMode === 'sales') filtered.sort((a,b) => b.sales - a.sales);
  else if (sortMode === 'name')  filtered.sort((a,b) => a.n.localeCompare(b.n));
  // else keep priority order (already sorted)

  page = 1;
  renderGrid();
  updateActiveFilters();
  updateClearBtn();
}}

function certBadgeHtml(cert) {{
  if (cert === 'CheckMate Lite/Pro') return '<span class="card-cert cert-cm-badge">CM</span>';
  if (cert === 'StemCell')           return '<span class="card-cert cert-sc-badge">SC</span>';
  return '';
}}

function cardHtml(m) {{
  const price = Number.isInteger(m.p) ? m.p : m.p.toFixed(0);
  const salesFmt = m.sales >= 1000 ? (m.sales/1000).toFixed(1)+'k' : m.sales;
  return `<a href="/models/${{m.s}}/" class="model-card">
    <div class="card-img">
      <img src="${{m.img}}" alt="${{m.n}}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="img-fallback" style="display:none;background:linear-gradient(135deg,${{m.col}}22,${{m.col}}08)">
        <span style="font-size:40px;opacity:.5">🎨</span>
      </div>
      <div class="card-overlay"></div>
      ${{certBadgeHtml(m.cert)}}
    </div>
    <div class="card-body">
      <div class="card-cat" style="color:${{m.col}}">${{m.c}}</div>
      <div class="card-name">${{m.n}}</div>
      <div class="card-footer">
        <div class="card-price">$${{price}}</div>
        <div class="card-sales">${{salesFmt}} sales</div>
      </div>
    </div>
  </a>`;
}}

function renderGrid() {{
  const grid      = document.getElementById('model-grid');
  const emptyEl   = document.getElementById('empty-state');
  const loadBtn   = document.getElementById('load-more-btn');
  const countEl   = document.getElementById('count-display');
  const visible   = filtered.slice(0, page * PER);

  countEl.textContent = filtered.length.toLocaleString();

  if (filtered.length === 0) {{
    grid.innerHTML = '';
    emptyEl.style.display = 'block';
    loadBtn.style.display = 'none';
    return;
  }}

  emptyEl.style.display = 'none';
  grid.innerHTML = visible.map(cardHtml).join('');

  const hasMore = visible.length < filtered.length;
  loadBtn.style.display = hasMore ? 'inline-block' : 'none';
  if (hasMore) {{
    const rem = filtered.length - visible.length;
    loadBtn.textContent = `Load More (${{rem}} remaining)`;
  }}
}}

function loadMore() {{
  page++;
  renderGrid();
}}

// Active filter chips
function updateActiveFilters() {{
  const wrap = document.getElementById('active-filters');
  const chips = [];

  selCats.forEach(c => {{
    chips.push(`<div class="active-chip">${{c}} <button onclick="removecat('${{c}}')" title="Remove">×</button></div>`);
  }});

  if (priceMin > 0 || priceMax < 999999) {{
    const label = priceMax >= 999999 ? `$${{priceMin}}+` : `$${{priceMin}} – $${{priceMax}}`;
    chips.push(`<div class="active-chip">${{label}} <button onclick="removeprice()" title="Remove">×</button></div>`);
  }}

  selCerts.forEach(c => {{
    const label = c === 'no certification' ? 'No Cert' : c;
    chips.push(`<div class="active-chip">${{label}} <button onclick="removecert('${{c}}')" title="Remove">×</button></div>`);
  }});

  if (searchQ) {{
    chips.push(`<div class="active-chip">Search: "${{searchQ}}" <button onclick="clearsearch()" title="Remove">×</button></div>`);
  }}

  wrap.innerHTML = chips.join('');
}}

function removecat(c)  {{ selCats.delete(c);  document.querySelector(`.cat-pill[data-cat="${{c}}"]`).classList.remove('active'); applyFilters(); }}
function removeprice() {{ priceMin=0; priceMax=999999; document.querySelectorAll('.price-btn').forEach((b,i)=>b.classList.toggle('active',i===0)); applyFilters(); }}
function removecert(c) {{ selCerts.delete(c); document.querySelector(`.cert-opt[data-cert="${{c}}"]`).classList.remove('active'); applyFilters(); }}
function clearsearch() {{ searchQ=''; document.getElementById('search-input').value=''; applyFilters(); }}

function clearAll() {{
  selCats.clear(); selCerts.clear();
  priceMin=0; priceMax=999999; searchQ='';
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.price-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('.cert-opt').forEach(o => o.classList.remove('active'));
  applyFilters();
}}

function updateClearBtn() {{
  const hasFilter = selCats.size || selCerts.size || priceMin > 0 || priceMax < 999999 || searchQ;
  document.getElementById('clear-btn').classList.toggle('visible', !!hasFilter);
}}

// Event listeners
document.querySelectorAll('.cat-pill').forEach(pill => {{
  pill.addEventListener('click', () => {{
    const cat = pill.dataset.cat;
    if (selCats.has(cat)) {{ selCats.delete(cat); pill.classList.remove('active'); }}
    else {{ selCats.add(cat); pill.classList.add('active'); }}
    applyFilters();
  }});
}});

document.querySelectorAll('.price-btn').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    priceMin = +btn.dataset.min;
    priceMax = +btn.dataset.max;
    applyFilters();
  }});
}});

document.querySelectorAll('.cert-opt').forEach(opt => {{
  opt.addEventListener('click', () => {{
    const cert = opt.dataset.cert;
    if (selCerts.has(cert)) {{ selCerts.delete(cert); opt.classList.remove('active'); }}
    else {{ selCerts.add(cert); opt.classList.add('active'); }}
    applyFilters();
  }});
}});

let searchTimer;
document.getElementById('search-input').addEventListener('input', e => {{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {{ searchQ = e.target.value.trim(); applyFilters(); }}, 250);
}});

document.getElementById('sort-select').addEventListener('change', e => {{
  sortMode = e.target.value;
  applyFilters();
}});

// Initial render
renderGrid();
</script>
</body>
</html>"""

    OUT.write_text(html, encoding="utf-8")
    print(f"Done: catalog/index.html written ({total} models embedded)")

if __name__ == "__main__":
    generate()
