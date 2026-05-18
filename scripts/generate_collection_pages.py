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

# ── Category → accent color + gradient (reused from category pages) ─────────

CAT_STYLE: dict[str, tuple[str, str]] = {
    "Vehicles":               ("#4F9EFF", "135deg,#0D1A28 0%,#0D2030 50%,#0A1520 100%"),
    "Aircraft":               ("#9F7AEA", "135deg,#0D1525 0%,#101A35 50%,#0A1228 100%"),
    "Military Vehicles":      ("#4ADE80", "135deg,#0A1A0A 0%,#0F2010 50%,#081508 100%"),
    "Ships":                  ("#38BDF8", "135deg,#081520 0%,#0A1C28 50%,#061018 100%"),
    "Medical":                ("#00E5C4", "135deg,#0D2020 0%,#0D2A20 50%,#0A1F1A 100%"),
    "Industrial Equipment":   ("#10B981", "135deg,#081A10 0%,#0A2015 50%,#061410 100%"),
    "Architecture Landmarks": ("#F59E0B", "135deg,#1A1008 0%,#201500 50%,#150F05 100%"),
    "Characters & People":    ("#8B5CF6", "135deg,#100A20 0%,#160D28 50%,#0D0818 100%"),
    "Animals & Creatures":    ("#F97316", "135deg,#1A0A00 0%,#201500 50%,#150A00 100%"),
    "Nature & Plants":        ("#34D399", "135deg,#081A08 0%,#0C2010 50%,#061508 100%"),
    "Furniture & Interior":   ("#A78BFA", "135deg,#120A20 0%,#180F28 50%,#0D0818 100%"),
    "Weapons & Tools":        ("#EF4444", "135deg,#200808 0%,#280A0A 50%,#180606 100%"),
    "Electronics & Gadgets":  ("#60A5FA", "135deg,#0A1525 0%,#0D1C30 50%,#081018 100%"),
    "Clothing & Accessories": ("#F472B6", "135deg,#200A18 0%,#280C20 50%,#180815 100%"),
    "Food & Beverages":       ("#FBBF24", "135deg,#1A1000 0%,#201500 50%,#150D00 100%"),
    "Other":                  ("#00E5C4", "135deg,#0D1820 0%,#0D2030 50%,#0A1520 100%"),
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

# ── Shared CSS (same as category pages) ──────────────────────────────────────

SHARED_CSS = """
  * { box-sizing: border-box; }
  body { background: #07090F; font-family: 'Inter', sans-serif; color: #EDF2FF; }
  body::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
    opacity: 0.4;
  }
  html { scroll-behavior: smooth; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #07090F; }
  ::-webkit-scrollbar-thumb { background: #1E2B44; border-radius: 3px; }

  .nav-link { color: #7A8DB0; font-size: 14px; font-weight: 500; text-decoration: none; padding: 6px 2px; position: relative; transition: color 0.2s; }
  .nav-link::after { content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1px; background: #00E5C4; transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }
  .nav-link:hover { color: #EDF2FF; }
  .nav-link:hover::after { width: 100%; }
  .nav-link:focus-visible { outline: none; color: #00E5C4; }

  .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #00E5C4; color: #07090F; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 24px; border-radius: 8px; transition: background 0.2s, transform 0.15s, box-shadow 0.2s; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 2px 12px rgba(0,229,196,0.3); }
  .btn-primary:hover { background: #00CCB0; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.4); }
  .btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.4); }

  .btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #EDF2FF; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 8px; border: 1px solid #1E2B44; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }
  .btn-ghost:hover { border-color: rgba(0,229,196,0.4); background: rgba(0,229,196,0.05); transform: translateY(-1px); }
  .btn-ghost:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.25); }

  .btn-ts { display: inline-flex; align-items: center; gap: 8px; background: rgba(0,229,196,0.1); color: #00E5C4; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 7px; border: 1px solid rgba(0,229,196,0.25); cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s; white-space: nowrap; }
  .btn-ts:hover { background: rgba(0,229,196,0.18); border-color: rgba(0,229,196,0.5); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,229,196,0.15); }
  .btn-ts:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.3); }

  .chip { display: inline-flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid #1E2B44; color: #7A8DB0; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 100px; white-space: nowrap; }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #00E5C4; }

  .cert-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,198,0,0.1); border: 1px solid rgba(255,198,0,0.25); color: #FFC600; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }

  .model-card { background: #0E1220; border: 1px solid #1E2B44; border-radius: 12px; overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.4,0,0.2,1); }
  .model-card:hover { border-color: rgba(0,229,196,0.3); box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,229,196,0.08); transform: translateY(-2px); }
  .model-card:focus-within { box-shadow: 0 0 0 2px rgba(0,229,196,0.4); }

  .card-glow { position: relative; }
  .card-glow::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; background: linear-gradient(135deg, rgba(0,229,196,0.15) 0%, transparent 50%, rgba(79,107,255,0.08) 100%); opacity: 0; transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); z-index: -1; }
  .card-glow:hover::before { opacity: 1; }

  .img-wrap { position: relative; overflow: hidden; }
  .img-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.8) 0%, transparent 55%); }
  .img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1); filter: saturate(0.9) brightness(0.95); }
  .model-card:hover .img-wrap img { transform: scale(1.05); filter: saturate(1.1) brightness(1); }
  .img-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
  .img-placeholder span { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; opacity: 0.7; }

  .coll-card { background: #0E1220; border: 1px solid #1E2B44; border-radius: 14px; padding: 20px; text-decoration: none; display: flex; align-items: center; gap: 14px; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
  .coll-card:hover { border-color: rgba(0,229,196,0.35); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .coll-card:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(0,229,196,0.5); }
"""

LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


# ── Nav + Footer ──────────────────────────────────────────────────────────────

def nav_html():
    return """<header class="sticky top-0 z-50" style="border-bottom:1px solid #1E2B44;background:rgba(7,9,15,0.85);backdrop-filter:blur(16px);">
  <nav class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
    <a href="/" class="flex items-center gap-2.5 shrink-0" style="text-decoration:none;">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#00E5C4,#0099FF);display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07090F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.02em;color:#EDF2FF;">3D Molier</span>
    </a>
    <div class="hidden md:flex items-center gap-6">
      <a href="/catalog/" class="nav-link">Catalog</a>
      <a href="/categories/vehicles/" class="nav-link">Vehicles</a>
      <a href="/categories/aircraft/" class="nav-link">Aircraft</a>
      <a href="/categories/military-vehicles/" class="nav-link">Military</a>
      <a href="/categories/medical-3d-models/" class="nav-link">Medical</a>
      <a href="/collections/" class="nav-link">Collections</a>
      <a href="/search/" class="nav-link" title="Search" style="display:flex;align-items:center;gap:4px;">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/></svg>
        Search
      </a>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-primary" style="padding:8px 16px;font-size:13px;">
        TurboSquid Store
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  </nav>
</header>"""


def footer_html():
    return """<footer style="border-top:1px solid #1E2B44;padding:48px 24px 32px;background:#0A0D16;">
  <div class="max-w-7xl mx-auto">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#00E5C4,#0099FF);display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#07090F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:#EDF2FF;">3D Molier</span>
        </div>
        <p style="font-size:13px;color:#7A8DB0;line-height:1.7;max-width:280px;">Searchable catalog of 88,000+ professional 3D models. All models available on TurboSquid.</p>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#4A5C7A;text-transform:uppercase;margin-bottom:16px;">Categories</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="/categories/vehicles/" class="nav-link" style="font-size:13px;">Vehicles</a>
          <a href="/categories/aircraft/" class="nav-link" style="font-size:13px;">Aircraft</a>
          <a href="/categories/military-vehicles/" class="nav-link" style="font-size:13px;">Military</a>
          <a href="/categories/medical-3d-models/" class="nav-link" style="font-size:13px;">Medical</a>
          <a href="/categories/ships/" class="nav-link" style="font-size:13px;">Ships</a>
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#4A5C7A;text-transform:uppercase;margin-bottom:16px;">Collections</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="/collections/best-vehicle-3d-models/" class="nav-link" style="font-size:13px;">Best Vehicles</a>
          <a href="/collections/best-aircraft-3d-models/" class="nav-link" style="font-size:13px;">Best Aircraft</a>
          <a href="/collections/best-medical-3d-models/" class="nav-link" style="font-size:13px;">Best Medical</a>
          <a href="/collections/best-military-vehicle-3d-models/" class="nav-link" style="font-size:13px;">Best Military</a>
          <a href="/collections/" class="nav-link" style="font-size:13px;">View all</a>
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#4A5C7A;text-transform:uppercase;margin-bottom:16px;">TurboSquid</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link" style="font-size:13px;">Artist Store</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/vehicle?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link" style="font-size:13px;">Vehicle Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/aircraft?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link" style="font-size:13px;">Aircraft Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/medical?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link" style="font-size:13px;">Medical Models</a>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid #1E2B44;padding-top:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <p style="font-size:12px;color:#4A5C7A;">&#169; 2025 3D Molier. All 3D models sold via TurboSquid.</p>
      <a href="/" class="nav-link" style="font-size:12px;">&#8592; Back to home</a>
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

    cert_html = ''
    if 'CheckMate' in cert:
        cert_html = '<span class="cert-badge">&#10003; CM</span>'
    elif 'Stem' in cert:
        cert_html = '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>'

    img_html = ''
    if img:
        img_html = (
            f'<img src="{img}" alt="{title}" loading="lazy" '
            f'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
            f'<div class="img-placeholder" style="color:{color};display:none;">'
            f'<span style="font-size:28px;opacity:0.5;">&#128247;</span>'
            f'<span style="color:{color};">{cat}</span></div>'
        )
    else:
        img_html = (
            f'<div class="img-placeholder" style="color:{color};">'
            f'<span style="font-size:28px;opacity:0.5;">&#128247;</span>'
            f'<span style="color:{color};">{cat}</span></div>'
        )

    return f'''<div class="model-card card-glow">
        <div class="img-wrap" style="height:180px;background:linear-gradient({gradient});">
          {img_html}
        </div>
        <div style="padding:16px;">
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:10px;">
            <h3 style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#EDF2FF;line-height:1.3;letter-spacing:-0.01em;">{title}</h3>
            {cert_html}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span class="chip" style="font-size:11px;padding:3px 8px;color:#00E5C4;border-color:rgba(0,229,196,0.25);">{cat}</span>
            <span style="font-size:13px;font-weight:600;color:#EDF2FF;margin-left:auto;">{price_str}</span>
          </div>
          <a href="{url}" target="_blank" rel="noopener" class="btn-ts" style="width:100%;justify-content:center;">
            {LINK_ICON}
            View on TurboSquid
          </a>
        </div>
      </div>'''


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
    color  = meta.get('color', '#00E5C4')
    short_desc = meta.get('short_desc', intro)

    # Type badge text
    type_label = {'category': 'Best-of Category', 'industry': 'Industry Collection', 'certification': 'Quality Certified'}.get(ctype, 'Collection')

    # Model cards HTML
    cards_html = '\n      '.join(model_card_html(m) for m in models)

    # Related collections
    related_slugs = meta.get('related', [])
    related_html  = ''
    slug_to_col   = {c['collection_slug']: c for c in all_cols}
    for rel_slug in related_slugs[:3]:
        rc   = slug_to_col.get(rel_slug)
        if not rc:
            continue
        rc_meta  = COLLECTION_META.get(rel_slug, {})
        rc_icon  = rc_meta.get('icon', '📦')
        rc_color = rc_meta.get('color', '#00E5C4')
        rc_desc  = rc_meta.get('short_desc', '')[:60] + '…' if rc_meta.get('short_desc', '') else ''
        related_html += f'''<a href="/collections/{rel_slug}/" class="coll-card">
          <div style="width:48px;height:48px;border-radius:12px;background:rgba(0,229,196,0.06);border:1px solid rgba(0,229,196,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">{rc_icon}</div>
          <div style="min-width:0;">
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:#EDF2FF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{rc['collection_title']}</div>
            <div style="font-size:12px;color:#7A8DB0;margin-top:2px;">{rc_desc}</div>
          </div>
          <span style="margin-left:auto;color:#00E5C4;font-size:18px;flex-shrink:0;">&#8594;</span>
        </a>\n'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{seo_t}</title>
<meta name="description" content="{meta_d}">
<link rel="canonical" href="https://3dmolier.com/collections/{slug}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {{
  theme: {{ extend: {{ colors: {{ base:'#07090F',surface:'#0E1220',raised:'#151A2E',border:'#1E2B44',teal:'#00E5C4' }}, fontFamily: {{ display:['Syne','sans-serif'],body:['Inter','sans-serif'] }} }} }}
}}
</script>
<style>
{SHARED_CSS}
</style>
</head>
<body class="relative min-h-screen">

{nav_html()}

<main style="position:relative;z-index:1;">

<!-- Breadcrumb -->
<div style="border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">
  <div class="max-w-7xl mx-auto px-6 py-3" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#7A8DB0;">
    <a href="/3D-Models/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Home</a>
    <span style="color:#1E2B44;">&#8250;</span>
    <a href="/3D-Models/collections/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Collections</a>
    <span style="color:#1E2B44;">&#8250;</span>
    <span style="color:#EDF2FF;">{title}</span>
  </div>
</div>

<!-- Collection Hero -->
<section style="padding:56px 24px 40px;border-bottom:1px solid #1E2B44;">
  <div class="max-w-7xl mx-auto">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:32px;flex-wrap:wrap;">

      <div style="flex:1;min-width:280px;">
        <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,229,196,0.06);border:1px solid rgba(0,229,196,0.15);padding:5px 12px;border-radius:100px;margin-bottom:20px;">
          <span style="font-size:11px;font-weight:600;color:#00E5C4;letter-spacing:0.08em;text-transform:uppercase;">{type_label}</span>
        </div>

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div style="width:56px;height:56px;border-radius:14px;background:rgba(0,229,196,0.08);border:1px solid rgba(0,229,196,0.2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">
            {icon}
          </div>
          <h1 style="font-family:'Syne',sans-serif;font-size:clamp(22px,3.2vw,36px);font-weight:800;letter-spacing:-0.035em;color:#EDF2FF;line-height:1.1;">
            {title}
          </h1>
        </div>

        <p style="font-size:15px;color:#7A8DB0;line-height:1.75;max-width:620px;margin-bottom:28px;">
          {intro}
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="{ts_url}" target="_blank" rel="noopener" class="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Browse on TurboSquid
          </a>
          <a href="/collections/" class="btn-ghost">&#8592; All Collections</a>
        </div>
      </div>

      <!-- Stats panel -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#1E2B44;border:1px solid #1E2B44;border-radius:16px;overflow:hidden;min-width:240px;">
        <div style="background:#0E1220;padding:24px 20px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#EDF2FF;letter-spacing:-0.04em;line-height:1;">{total:,}</div>
          <div style="font-size:12px;color:#7A8DB0;margin-top:4px;font-weight:500;">Total Models</div>
        </div>
        <div style="background:#0E1220;padding:24px 20px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#EDF2FF;letter-spacing:-0.04em;line-height:1;">{len(models)}</div>
          <div style="font-size:12px;color:#7A8DB0;margin-top:4px;font-weight:500;">Featured</div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- Model Grid — all 24 in HTML for SEO -->
<section style="padding:56px 24px;">
  <div class="max-w-7xl mx-auto">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px;">
      <div>
        <div class="section-label" style="margin-bottom:6px;">Hand-picked</div>
        <h2 style="font-family:'Syne',sans-serif;font-size:clamp(18px,2.5vw,26px);font-weight:700;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.1;">
          Featured Models
        </h2>
      </div>
      <a href="{ts_url}" target="_blank" rel="noopener" class="btn-ghost" style="font-size:13px;padding:9px 18px;">
        View all on TurboSquid
      </a>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;">
      {cards_html}
    </div>
  </div>
</section>

<!-- Related Collections -->
<section style="padding:0 24px 72px;">
  <div class="max-w-7xl mx-auto">
    <div style="border-top:1px solid #1E2B44;padding-top:48px;">
      <div class="section-label" style="margin-bottom:8px;">Explore More</div>
      <h2 style="font-family:'Syne',sans-serif;font-size:clamp(18px,2.5vw,26px);font-weight:700;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.1;margin-bottom:24px;">
        Related Collections
      </h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        {related_html}
      </div>
    </div>
  </div>
</section>

</main>

{footer_html()}
</body>
</html>'''


# ── Collections index page (/collections/) ───────────────────────────────────

def collections_index_html(all_cols: list[dict]) -> str:
    # Group by type
    by_type: dict[str, list[dict]] = {'category': [], 'industry': [], 'certification': []}
    for c in all_cols:
        by_type.setdefault(c['collection_type'], []).append(c)

    type_labels = {
        'category':    ('Best-of Category',   'Top-ranked 3D models within each product category.'),
        'industry':    ('By Industry',         'Curated sets for specific production industries.'),
        'certification': ('Certified Quality', 'Only models that passed rigorous quality certification.'),
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
            color = meta.get('color', '#00E5C4')
            desc  = meta.get('short_desc', c['intro_text'])[:80] + '…'

            cards_html += f'''<a href="/collections/{slug}/" style="text-decoration:none;background:#0E1220;border:1px solid #1E2B44;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:14px;transition:border-color 0.25s,transform 0.25s,box-shadow 0.25s;" onmouseover="this.style.borderColor='rgba(0,229,196,0.35)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,0,0,0.4)'" onmouseout="this.style.borderColor='#1E2B44';this.style.transform='';this.style.boxShadow=''">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:44px;height:44px;border-radius:11px;background:rgba(0,229,196,0.07);border:1px solid rgba(0,229,196,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">{icon}</div>
                <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;color:#EDF2FF;letter-spacing:-0.01em;line-height:1.3;">{title}</div>
              </div>
              <p style="font-size:13px;color:#7A8DB0;line-height:1.6;margin:0;">{desc}</p>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;">
                <span style="font-size:12px;color:#4A5C7A;">{feat} featured &middot; {total:,} total</span>
                <span style="font-size:13px;font-weight:600;color:#00E5C4;">Explore &#8594;</span>
              </div>
            </a>\n'''

        sections_html += f'''
    <div style="margin-bottom:64px;">
      <div style="margin-bottom:32px;">
        <div class="section-label" style="margin-bottom:6px;">{label}</div>
        <p style="font-size:14px;color:#7A8DB0;margin-top:4px;">{sub}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        {cards_html}
      </div>
    </div>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>3D Model Collections &#8212; Curated Sets by 3D Molier | TurboSquid</title>
<meta name="description" content="19 curated 3D model collections by 3D Molier: best vehicles, aircraft, medical, military and more. Organized by category, industry and certification level.">
<link rel="canonical" href="https://3dmolier.com/collections/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {{
  theme: {{ extend: {{ colors: {{ base:'#07090F',surface:'#0E1220',border:'#1E2B44',teal:'#00E5C4' }}, fontFamily: {{ display:['Syne','sans-serif'],body:['Inter','sans-serif'] }} }} }}
}}
</script>
<style>
{SHARED_CSS}
</style>
</head>
<body class="relative min-h-screen">

{nav_html()}

<main style="position:relative;z-index:1;">

<!-- Breadcrumb -->
<div style="border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">
  <div class="max-w-7xl mx-auto px-6 py-3" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#7A8DB0;">
    <a href="/3D-Models/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Home</a>
    <span style="color:#1E2B44;">&#8250;</span>
    <span style="color:#EDF2FF;">Collections</span>
  </div>
</div>

<!-- Page Hero -->
<section style="padding:56px 24px 48px;border-bottom:1px solid #1E2B44;">
  <div class="max-w-7xl mx-auto">
    <div class="section-label" style="margin-bottom:10px;">Hand-Picked Sets</div>
    <h1 style="font-family:'Syne',sans-serif;font-size:clamp(26px,4vw,44px);font-weight:800;letter-spacing:-0.035em;color:#EDF2FF;line-height:1.1;margin-bottom:16px;">
      3D Model Collections
    </h1>
    <p style="font-size:16px;color:#7A8DB0;line-height:1.75;max-width:600px;">
      19 curated collections organized by product category, production industry and certification level. Each collection links directly to TurboSquid for purchase.
    </p>
  </div>
</section>

<!-- Collections Grid -->
<section style="padding:56px 24px 80px;">
  <div class="max-w-7xl mx-auto">
    {sections_html}
  </div>
</section>

</main>

{footer_html()}
</body>
</html>'''


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load collections
    with open(BASE_DIR / 'data' / 'collections.json', encoding='utf-8') as f:
        all_cols: list[dict] = json.load(f)

    # Build product_id -> model row lookup from top_models.csv
    id_to_model: dict[str, dict] = {}
    with open(BASE_DIR / 'data' / 'top_models.csv', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            id_to_model[row['product_id']] = row

    # Generate each collection page
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

    # Generate collections index page
    idx_dir = BASE_DIR / 'collections'
    idx_dir.mkdir(exist_ok=True)
    idx_html = collections_index_html(all_cols)
    (idx_dir / 'index.html').write_text(idx_html, encoding='utf-8')
    print(f"  {'collections/index.html':<52}  {len(all_cols)} collections listed")

    print(f"\nDone: {len(all_cols)} collection pages + index generated in collections/\n")


if __name__ == '__main__':
    main()
