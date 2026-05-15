"""Generate /search/index.html — Fuse.js global search over top models + categories + collections."""

import csv, json, os
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT  = ROOT / "search" / "index.html"

CAT_STYLE = {
    "Vehicles":               {"color": "#4F9EFF", "icon": "🚗", "slug": "vehicles"},
    "Aircraft":               {"color": "#9F7AEA", "icon": "✈️", "slug": "aircraft"},
    "Military Vehicles":      {"color": "#4ADE80", "icon": "🪖", "slug": "military-vehicles"},
    "Ships":                  {"color": "#38BDF8", "icon": "⚓", "slug": "ships"},
    "Medical":                {"color": "#00E5C4", "icon": "🧬", "slug": "medical-3d-models"},
    "Industrial Equipment":   {"color": "#10B981", "icon": "⚙️", "slug": "industrial-equipment"},
    "Architecture Landmarks": {"color": "#F59E0B", "icon": "🏛️", "slug": "architecture-landmarks"},
    "Characters & People":    {"color": "#8B5CF6", "icon": "👤", "slug": "characters-people"},
    "Animals & Creatures":    {"color": "#F97316", "icon": "🐾", "slug": "animals-creatures"},
    "Nature & Plants":        {"color": "#34D399", "icon": "🌿", "slug": "nature-plants"},
    "Furniture & Interior":   {"color": "#A78BFA", "icon": "🪑", "slug": "furniture-interior"},
    "Weapons & Tools":        {"color": "#EF4444", "icon": "⚔️", "slug": "weapons-tools"},
    "Electronics & Gadgets":  {"color": "#60A5FA", "icon": "💻", "slug": "electronics-gadgets"},
    "Clothing & Accessories": {"color": "#F472B6", "icon": "👗", "slug": "clothing-accessories"},
    "Food & Beverages":       {"color": "#FBBF24", "icon": "🍕", "slug": "food-beverages"},
    "Other":                  {"color": "#00E5C4", "icon": "📦", "slug": "other"},
}

COLLECTION_ICONS = {
    "best-vehicle-3d-models":        "🚗",
    "best-aircraft-3d-models":       "✈️",
    "best-military-3d-models":       "🪖",
    "best-ship-3d-models":           "⚓",
    "best-medical-3d-models":        "🧬",
    "best-architecture-3d-models":   "🏛️",
    "best-character-3d-models":      "👤",
    "game-ready-3d-models":          "🎮",
    "film-production-3d-models":     "🎬",
    "architecture-visualization":    "🏢",
    "medical-visualization":         "🏥",
    "military-defense-3d-models":    "⚔️",
    "advertising-3d-models":         "📢",
    "vr-ar-3d-models":               "🥽",
    "science-education-3d-models":   "🔬",
    "3d-printing-models":            "🖨️",
    "engineering-3d-models":         "⚙️",
    "checkmate-certified-3d-models": "✅",
    "stemcell-certified-3d-models":  "🔬",
}

def build_search_data():
    items = []

    # 1) Top 1,000 models from search_index.json
    raw = json.load(open(ROOT / "data" / "search_index.json", encoding="utf-8"))
    top_models = [r for r in raw if r.get("top")]
    for m in top_models:
        cat    = m.get("c", "Other")
        style  = CAT_STYLE.get(cat, {"color": "#00E5C4", "icon": "📦"})
        cert   = ""
        # Cert info not in search_index; read from CSV below
        items.append({
            "type":  "model",
            "title": m["t"],
            "slug":  m["s"],
            "page":  m.get("page") or f"/models/{m['s']}/",
            "cat":   cat,
            "col":   style["color"],
            "price": m.get("p", 0),
            "img":   m.get("img", ""),
            "industries": m.get("i", []),
        })

    # Enrich with cert info from CSV
    cert_map = {}
    for row in csv.DictReader(open(ROOT / "data" / "top_models.csv", encoding="utf-8")):
        cert_map[row["slug"]] = row.get("certification", "")
    for item in items:
        if item["type"] == "model":
            item["cert"] = cert_map.get(item["slug"], "")

    # 2) 15 categories
    cat_counts = {}
    for m in top_models:
        cat_counts[m.get("c", "Other")] = cat_counts.get(m.get("c", "Other"), 0) + 1

    for cat, style in CAT_STYLE.items():
        items.append({
            "type":  "category",
            "title": cat,
            "slug":  style["slug"],
            "page":  f"/categories/{style['slug']}/",
            "col":   style["color"],
            "icon":  style["icon"],
            "count": cat_counts.get(cat, 0),
        })

    # 3) 19 collections
    collections = json.load(open(ROOT / "data" / "collections.json", encoding="utf-8"))
    for col in collections:
        slug  = col["collection_slug"]
        icon  = COLLECTION_ICONS.get(slug, "📦")
        items.append({
            "type":  "collection",
            "title": col["collection_title"],
            "slug":  slug,
            "page":  f"/collections/{slug}/",
            "col":   "#00E5C4",
            "icon":  icon,
            "total": col.get("total_matching_models", 0),
            "intro": col.get("intro_text", "")[:100],
        })

    return items

def generate():
    items = build_search_data()
    data_json = json.dumps(items, ensure_ascii=False, separators=(",", ":"))

    OUT.parent.mkdir(parents=True, exist_ok=True)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Search 3D Models — 3D Molier on TurboSquid</title>
<meta name="description" content="Search 88,000+ professional 3D models by 3D Molier on TurboSquid. Find vehicles, aircraft, medical, architecture, characters and more.">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"></script>
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
  body {{ background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; min-height: 100vh; }}
  .syne {{ font-family: 'Syne', sans-serif; }}

  body::before {{
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.5;
  }}

  nav {{ position: sticky; top: 0; z-index: 50; background: rgba(7,9,15,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }}
  .nav-inner {{ max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; gap: 32px; }}
  .nav-logo {{ font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; text-decoration: none; letter-spacing: -0.03em; }}
  .nav-logo span {{ color: var(--teal); }}
  .nav-links {{ display: flex; gap: 24px; margin-left: auto; }}
  .nav-links a {{ color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }}
  .nav-links a:hover {{ color: #fff; }}
  .btn-ts {{ background: var(--teal); color: #07090F; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 8px; text-decoration: none; transition: opacity 0.2s, transform 0.15s; }}
  .btn-ts:hover {{ opacity: 0.88; transform: translateY(-1px); }}

  /* HERO */
  .hero {{ max-width: 760px; margin: 0 auto; padding: 64px 24px 40px; text-align: center; }}
  .hero h1 {{ font-family: 'Syne', sans-serif; font-weight: 800; font-size: clamp(32px, 5vw, 56px); letter-spacing: -0.03em; line-height: 1.1; color: #fff; }}
  .hero h1 span {{ color: var(--teal); }}
  .hero p {{ color: var(--muted); margin-top: 12px; font-size: 16px; }}

  /* SEARCH BOX */
  .search-box {{ position: relative; margin: 32px auto 0; max-width: 640px; }}
  .search-icon {{ position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: var(--muted); width: 20px; pointer-events: none; }}
  #q {{ width: 100%; background: var(--surface); border: 1.5px solid var(--border); color: #fff; font-family: 'Inter', sans-serif; font-size: 17px; padding: 18px 54px 18px 54px; border-radius: 16px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }}
  #q:focus {{ border-color: var(--teal); box-shadow: 0 0 0 3px rgba(0,229,196,0.1); }}
  #q::placeholder {{ color: var(--muted); }}
  #clear-q {{ position: absolute; right: 18px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: none; color: var(--muted); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; display: none; align-items: center; justify-content: center; transition: background 0.15s; }}
  #clear-q.show {{ display: flex; }}
  #clear-q:hover {{ background: rgba(255,255,255,0.14); color: #fff; }}

  /* FILTER TABS */
  .filter-tabs {{ display: flex; gap: 8px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }}
  .tab {{ background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 20px; cursor: pointer; transition: all 0.15s; }}
  .tab:hover {{ border-color: rgba(255,255,255,0.14); color: #fff; }}
  .tab.active {{ background: rgba(0,229,196,0.12); border-color: rgba(0,229,196,0.3); color: var(--teal); }}

  /* RESULTS AREA */
  .results-wrap {{ max-width: 1200px; margin: 0 auto; padding: 16px 24px 80px; }}

  /* EMPTY / HINT STATE */
  #hint-state {{ text-align: center; padding: 48px 20px; }}
  .hint-cats {{ display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 28px; }}
  .hint-cat {{ display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--text); font-size: 13px; font-weight: 500; transition: transform 0.15s, border-color 0.15s; }}
  .hint-cat:hover {{ transform: translateY(-2px); border-color: rgba(255,255,255,0.14); }}
  .hint-cat .icon {{ font-size: 18px; }}
  .hint-label {{ font-family: 'Syne', sans-serif; font-size: 13px; color: var(--muted); text-align: center; margin-bottom: 16px; }}

  #empty-state {{ display: none; text-align: center; padding: 80px 20px; }}
  #empty-state .ei {{ font-size: 56px; margin-bottom: 16px; opacity: 0.4; }}
  #empty-state h3 {{ font-family: 'Syne', sans-serif; font-size: 22px; color: #fff; margin-bottom: 8px; }}
  #empty-state p {{ color: var(--muted); margin-bottom: 24px; }}
  .btn-ts-ghost {{ display: inline-block; border: 1px solid var(--teal); color: var(--teal); font-weight: 600; font-size: 14px; padding: 11px 24px; border-radius: 10px; text-decoration: none; transition: background 0.15s; }}
  .btn-ts-ghost:hover {{ background: rgba(0,229,196,0.08); }}

  /* RESULT SECTIONS */
  .result-section {{ margin-bottom: 40px; }}
  .section-header {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }}
  .section-title {{ font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }}
  .section-count {{ font-size: 12px; color: var(--muted); }}

  /* MODEL RESULT CARDS */
  .model-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }}
  .model-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; text-decoration: none; display: block; transition: transform 0.18s, border-color 0.18s; }}
  .model-card:hover {{ transform: translateY(-3px); border-color: rgba(255,255,255,0.13); }}
  .mc-img {{ position: relative; padding-top: 72%; background: var(--surface2); overflow: hidden; }}
  .mc-img img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
  .mc-img .fallback {{ position: absolute; inset: 0; display: none; align-items: center; justify-content: center; font-size: 32px; }}
  .mc-overlay {{ position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.65) 0%, transparent 55%); }}
  .mc-cert {{ position: absolute; top: 7px; right: 7px; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; backdrop-filter: blur(4px); }}
  .cm-b {{ background: rgba(79,158,255,0.2); color: #4F9EFF; }}
  .sc-b {{ background: rgba(139,92,246,0.2); color: #8B5CF6; }}
  .mc-body {{ padding: 10px 12px 12px; }}
  .mc-cat {{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
  .mc-name {{ font-size: 13px; font-weight: 600; color: #fff; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
  .mc-price {{ font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: #fff; margin-top: 8px; }}

  /* CATEGORY / COLLECTION CARDS */
  .meta-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }}
  .meta-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-decoration: none; display: flex; gap: 14px; align-items: flex-start; transition: transform 0.18s, border-color 0.18s; }}
  .meta-card:hover {{ transform: translateY(-2px); border-color: rgba(255,255,255,0.13); }}
  .meta-icon {{ width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }}
  .meta-body {{ flex: 1; min-width: 0; }}
  .meta-type {{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 4px; }}
  .meta-title {{ font-size: 14px; font-weight: 600; color: #fff; line-height: 1.3; }}
  .meta-count {{ font-size: 12px; color: var(--muted); margin-top: 4px; }}

  /* TURBOSQUID FALLBACK CARD */
  .ts-card {{ display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(0,229,196,0.06), rgba(0,153,255,0.06)); border: 1px solid rgba(0,229,196,0.15); border-radius: 14px; padding: 20px 24px; margin-top: 8px; gap: 16px; flex-wrap: wrap; }}
  .ts-card-text h4 {{ font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }}
  .ts-card-text p {{ font-size: 13px; color: var(--muted); }}
  .ts-card a {{ background: var(--teal); color: #07090F; font-weight: 700; font-size: 13px; padding: 10px 22px; border-radius: 8px; text-decoration: none; white-space: nowrap; flex-shrink: 0; transition: opacity 0.2s; }}
  .ts-card a:hover {{ opacity: 0.88; }}

  /* FOOTER */
  footer {{ background: var(--surface); border-top: 1px solid var(--border); padding: 32px 0; }}
  .footer-inner {{ max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }}
  .footer-inner p {{ color: var(--muted); font-size: 13px; }}
  .footer-inner a {{ color: var(--muted); font-size: 13px; text-decoration: none; transition: color 0.2s; }}
  .footer-inner a:hover {{ color: var(--teal); }}
</style>
</head>
<body>

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
    </div>
    <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" class="btn-ts" target="_blank" rel="noopener">TurboSquid ↗</a>
  </div>
</nav>

<div class="hero">
  <h1 class="syne">Search <span>88,000+</span><br>3D Models</h1>
  <p>Browse 1,000 featured models instantly — or search the full catalog on TurboSquid</p>
  <div class="search-box">
    <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/>
    </svg>
    <input id="q" type="search" placeholder="Try &quot;Tesla&quot;, &quot;helicopter&quot;, &quot;anatomy&quot;…" autocomplete="off" autofocus>
    <button id="clear-q" aria-label="Clear search">×</button>
  </div>
  <div class="filter-tabs">
    <button class="tab active" data-filter="all">All</button>
    <button class="tab" data-filter="model">Models</button>
    <button class="tab" data-filter="category">Categories</button>
    <button class="tab" data-filter="collection">Collections</button>
  </div>
</div>

<div class="results-wrap">
  <!-- Hint: show categories when empty -->
  <div id="hint-state">
    <p class="hint-label">Browse by category</p>
    <div class="hint-cats" id="hint-cats"></div>
  </div>

  <!-- Empty search results -->
  <div id="empty-state">
    <div class="ei">🔍</div>
    <h3>No local results found</h3>
    <p>Try the full TurboSquid catalog — 88,000+ models available.</p>
    <a id="ts-search-link" href="#" class="btn-ts-ghost" target="_blank" rel="noopener">Search on TurboSquid ↗</a>
  </div>

  <!-- Results sections -->
  <div id="results"></div>
</div>

<footer>
  <div class="footer-inner">
    <p>© 2025 3D Molier. All models on TurboSquid.</p>
    <div style="display:flex;gap:24px;">
      <a href="/">Home</a>
      <a href="/catalog/">Catalog</a>
      <a href="/collections/">Collections</a>
    </div>
  </div>
</footer>

<script>
const DATA = {data_json};

// Build Fuse indexes per type
const fuseOpts = {{
  includeScore: true,
  threshold: 0.35,
  keys: [
    {{ name: 'title', weight: 2.0 }},
    {{ name: 'cat',   weight: 1.0 }},
    {{ name: 'industries', weight: 0.5 }},
    {{ name: 'intro', weight: 0.4 }},
  ]
}};

const allFuse  = new Fuse(DATA, fuseOpts);
const modFuse  = new Fuse(DATA.filter(d=>d.type==='model'),      fuseOpts);
const catFuse  = new Fuse(DATA.filter(d=>d.type==='category'),   fuseOpts);
const colFuse  = new Fuse(DATA.filter(d=>d.type==='collection'), fuseOpts);

let activeFilter = 'all';

// Build hint categories
(function buildHint() {{
  const cats = DATA.filter(d => d.type === 'category');
  const wrap = document.getElementById('hint-cats');
  wrap.innerHTML = cats.map(c => `
    <a href="${{c.page}}" class="hint-cat">
      <span class="icon">${{c.icon}}</span>
      <span>${{c.title}}</span>
    </a>`).join('');
}})();

function certBadge(cert) {{
  if (cert === 'CheckMate Lite/Pro') return '<span class="mc-cert cm-b">CM</span>';
  if (cert === 'StemCell')           return '<span class="mc-cert sc-b">SC</span>';
  return '';
}}

function modelCardHtml(m) {{
  const price = Number.isInteger(m.price) ? m.price : Math.round(m.price);
  return `<a href="${{m.page}}" class="model-card">
    <div class="mc-img">
      <img src="${{m.img}}" alt="${{m.title}}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="fallback" style="background:linear-gradient(135deg,${{m.col}}22,${{m.col}}08)">
        <span style="opacity:.5">🎨</span>
      </div>
      <div class="mc-overlay"></div>
      ${{certBadge(m.cert || '')}}
    </div>
    <div class="mc-body">
      <div class="mc-cat" style="color:${{m.col}}">${{m.cat}}</div>
      <div class="mc-name">${{m.title}}</div>
      <div class="mc-price">$${{price}}</div>
    </div>
  </a>`;
}}

function metaCardHtml(item) {{
  const typeLabel = item.type === 'category' ? 'Category' : 'Collection';
  const count     = item.type === 'category'
    ? `${{item.count}} featured models`
    : `${{item.total?.toLocaleString() || ''}} models`;
  return `<a href="${{item.page}}" class="meta-card">
    <div class="meta-icon" style="background:${{item.col}}18">${{item.icon}}</div>
    <div class="meta-body">
      <div class="meta-type">${{typeLabel}}</div>
      <div class="meta-title">${{item.title}}</div>
      <div class="meta-count">${{count}}</div>
    </div>
  </a>`;
}}

function sectionHtml(title, count, innerHtml) {{
  return `<div class="result-section">
    <div class="section-header">
      <span class="section-title">${{title}}</span>
      <span class="section-count">${{count}} result${{count !== 1 ? 's' : ''}}</span>
    </div>
    ${{innerHtml}}
  </div>`;
}}

function tsFallbackHtml(q) {{
  const url = `https://www.turbosquid.com/Search/3D-Models?keywords=${{encodeURIComponent(q)}}&include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio`;
  return `<div class="ts-card">
    <div class="ts-card-text">
      <h4>Search all 88,000+ models on TurboSquid</h4>
      <p>Can't find what you need? The full catalog has many more options.</p>
    </div>
    <a href="${{url}}" target="_blank" rel="noopener">Search TurboSquid ↗</a>
  </div>`;
}}

function search(q) {{
  const fuse = activeFilter === 'all'        ? allFuse
             : activeFilter === 'model'      ? modFuse
             : activeFilter === 'category'   ? catFuse
             : colFuse;

  const raw = fuse.search(q, {{ limit: 60 }});
  const hits = raw.map(r => r.item);

  const models  = hits.filter(h => h.type === 'model');
  const cats    = hits.filter(h => h.type === 'category');
  const cols    = hits.filter(h => h.type === 'collection');

  const total = hits.length;
  document.getElementById('hint-state').style.display  = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('results').innerHTML          = '';

  if (total === 0) {{
    const link = document.getElementById('ts-search-link');
    link.href = `https://www.turbosquid.com/Search/3D-Models?keywords=${{encodeURIComponent(q)}}&include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio`;
    document.getElementById('empty-state').style.display = 'block';
    return;
  }}

  let html = '';

  if (models.length && (activeFilter === 'all' || activeFilter === 'model')) {{
    const shown = models.slice(0, 24);
    html += sectionHtml('3D Models', models.length,
      `<div class="model-grid">${{shown.map(modelCardHtml).join('')}}</div>`
    );
  }}

  if (cats.length && (activeFilter === 'all' || activeFilter === 'category')) {{
    html += sectionHtml('Categories', cats.length,
      `<div class="meta-grid">${{cats.map(metaCardHtml).join('')}}</div>`
    );
  }}

  if (cols.length && (activeFilter === 'all' || activeFilter === 'collection')) {{
    html += sectionHtml('Collections', cols.length,
      `<div class="meta-grid">${{cols.map(metaCardHtml).join('')}}</div>`
    );
  }}

  // Always show TurboSquid fallback
  html += tsFallbackHtml(q);

  document.getElementById('results').innerHTML = html;
}}

// Input handler with debounce
let timer;
const input = document.getElementById('q');
const clearBtn = document.getElementById('clear-q');

input.addEventListener('input', () => {{
  clearTimeout(timer);
  const q = input.value.trim();
  clearBtn.classList.toggle('show', q.length > 0);
  if (!q) {{
    document.getElementById('hint-state').style.display = 'block';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('results').innerHTML = '';
    return;
  }}
  timer = setTimeout(() => search(q), 180);
}});

clearBtn.addEventListener('click', () => {{
  input.value = '';
  clearBtn.classList.remove('show');
  document.getElementById('hint-state').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('results').innerHTML = '';
  input.focus();
}});

// Filter tabs
document.querySelectorAll('.tab').forEach(tab => {{
  tab.addEventListener('click', () => {{
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    const q = input.value.trim();
    if (q) search(q);
  }});
}});

// Handle ?q= URL param
const urlQ = new URLSearchParams(location.search).get('q');
if (urlQ) {{
  input.value = urlQ;
  clearBtn.classList.add('show');
  search(urlQ);
}} else {{
  document.getElementById('hint-state').style.display = 'block';
}}
</script>
</body>
</html>"""

    OUT.write_text(html, encoding="utf-8")
    items_total = len([i for i in items if i["type"] == "model"])
    print(f"Done: search/index.html written ({items_total} models + 15 categories + 19 collections indexed)")

if __name__ == "__main__":
    generate()
