#!/usr/bin/env python3
"""
Generates 1,000 individual model pages from top_models.csv.
Output: models/{slug}/index.html
"""
import csv
import json
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent

# ── Category styles ──────────────────────────────────────────────────────────

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

CAT_SLUG: dict[str, str] = {
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

# ── Description generator ────────────────────────────────────────────────────

def generate_description(m: dict) -> str:
    title   = m['product_name']
    cat     = m['category']
    subcat  = m.get('subcategory', '').strip()
    cert    = m.get('certification', '')
    industries = [i.strip() for i in m.get('industries', '').split('|') if i.strip()][:3]
    use_cases  = [u.strip() for u in m.get('use_cases', '').split('|') if u.strip()][:3]

    try:
        price = float(m['price'])
        price_str = f"${price:.0f}"
    except (ValueError, TypeError):
        price_str = f"${m['price']}"

    subcat_clause = f" ({subcat})" if subcat and subcat.lower() not in title.lower() else ""
    ind_str  = ", ".join(industries) if industries else cat
    uc_str   = " and ".join(use_cases[:2]) if use_cases else "professional visualization"

    cert_clause = ""
    if "CheckMate" in cert:
        cert_clause = (
            " This model has passed TurboSquid's rigorous CheckMate quality certification, "
            "guaranteeing clean topology, correct scale and production-ready geometry."
        )
    elif "Stem" in cert:
        cert_clause = (
            " Certified StemCell by TurboSquid — ensuring universal rigging compatibility, "
            "clean edge flow and consistent real-world scale."
        )

    return (
        f"The {title} is a professional 3D model{subcat_clause} in the {cat} category, "
        f"available at {price_str} on TurboSquid.{cert_clause} "
        f"This asset is widely used in {ind_str} for {uc_str}."
    )


# ── Shared CSS ───────────────────────────────────────────────────────────────

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

  .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #00E5C4; color: #07090F; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 15px; padding: 13px 28px; border-radius: 8px; transition: background 0.2s, transform 0.15s, box-shadow 0.2s; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 2px 12px rgba(0,229,196,0.3); }
  .btn-primary:hover { background: #00CCB0; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.4); }
  .btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.4); }

  .btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #EDF2FF; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 14px; padding: 10px 24px; border-radius: 8px; border: 1px solid #1E2B44; cursor: pointer; text-decoration: none; transition: border-color 0.2s, background 0.2s, transform 0.15s; }
  .btn-ghost:hover { border-color: rgba(0,229,196,0.4); background: rgba(0,229,196,0.05); transform: translateY(-1px); }
  .btn-ghost:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.25); }

  .btn-ts-lg { display: inline-flex; align-items: center; gap: 10px; background: rgba(0,229,196,0.1); color: #00E5C4; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; padding: 11px 22px; border-radius: 8px; border: 1px solid rgba(0,229,196,0.3); cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s; }
  .btn-ts-lg:hover { background: rgba(0,229,196,0.18); border-color: rgba(0,229,196,0.55); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.15); }
  .btn-ts-lg:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.3); }

  .chip { display: inline-flex; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid #1E2B44; color: #7A8DB0; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 100px; white-space: nowrap; }
  .chip-teal { background: rgba(0,229,196,0.07); border-color: rgba(0,229,196,0.2); color: #00E5C4; }
  .chip-gold { background: rgba(255,198,0,0.07); border-color: rgba(255,198,0,0.2); color: #FFC600; }

  .cert-badge { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,198,0,0.1); border: 1px solid rgba(255,198,0,0.3); color: #FFC600; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
  .cert-badge-sc { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.3); color: #7C3AED; }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #00E5C4; }

  .model-card { background: #0E1220; border: 1px solid #1E2B44; border-radius: 12px; overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.4,0,0.2,1); }
  .model-card:hover { border-color: rgba(0,229,196,0.3); box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,229,196,0.08); transform: translateY(-2px); }
  .card-glow { position: relative; }
  .card-glow::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; background: linear-gradient(135deg, rgba(0,229,196,0.15) 0%, transparent 50%, rgba(79,107,255,0.08) 100%); opacity: 0; transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); z-index: -1; }
  .card-glow:hover::before { opacity: 1; }

  .img-wrap { position: relative; overflow: hidden; }
  .img-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.8) 0%, transparent 55%); }
  .img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1); filter: saturate(0.9) brightness(0.95); }
  .model-card:hover .img-wrap img { transform: scale(1.05); filter: saturate(1.1) brightness(1); }
  .img-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
  .img-placeholder span { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; opacity: 0.7; }

  .stat-box { background: #0E1220; border: 1px solid #1E2B44; border-radius: 10px; padding: 16px 20px; }
  .stat-box-num { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #EDF2FF; letter-spacing: -0.03em; line-height: 1; }
  .stat-box-label { font-size: 11px; color: #7A8DB0; margin-top: 4px; font-weight: 500; }

  .hero-img-frame { border-radius: 16px; overflow: hidden; position: relative; }
  .hero-img-frame img { width: 100%; height: 100%; object-fit: cover; display: block; filter: saturate(0.95) brightness(0.9); }
  .hero-img-frame::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(7,9,15,0.7) 0%, transparent 50%); pointer-events: none; }
"""

LINK_ICON_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
LINK_ICON_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


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
          <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#00E5C4,#0099FF);display:flex;align-items:center;justify-content:center;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#07090F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
          <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:#EDF2FF;">3D Molier</span>
        </div>
        <p style="font-size:13px;color:#7A8DB0;line-height:1.7;max-width:280px;">Searchable catalog of 88,000+ professional 3D models. All models sold on TurboSquid.</p>
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
          <a href="/collections/" class="nav-link" style="font-size:13px;">All Collections</a>
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


# ── Related model card (compact) ─────────────────────────────────────────────

def related_card_html(m: dict) -> str:
    cat    = m['category']
    color, gradient = CAT_STYLE.get(cat, CAT_STYLE['Other'])
    title  = m['product_name']
    img    = m.get('image_url', '')
    url    = m.get('referral_url', '#')
    slug   = m['slug']
    cert   = m.get('certification', '')
    try:
        price_str = f"${float(m['price']):.0f}"
    except (ValueError, TypeError):
        price_str = f"${m['price']}"

    cert_html = ''
    if 'CheckMate' in cert:
        cert_html = '<span class="cert-badge" style="font-size:9px;padding:2px 6px;">&#10003; CM</span>'
    elif 'Stem' in cert:
        cert_html = '<span class="cert-badge cert-badge-sc" style="font-size:9px;padding:2px 6px;">SC</span>'

    PROXY = "https://images.weserv.nl/?url="
    img_src = (PROXY + img.replace("https://", "") + "&w=600&q=85&output=webp"
               if img and img.startswith("https://static.turbosquid") else img)
    img_html = (
        f'<img src="{img_src}" alt="{title}" loading="lazy" '
        f'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
        f'<div class="img-placeholder" style="color:{color};display:none;">'
        f'<span style="font-size:22px;opacity:0.4;">&#128247;</span></div>'
    ) if img else (
        f'<div class="img-placeholder" style="color:{color};">'
        f'<span style="font-size:22px;opacity:0.4;">&#128247;</span></div>'
    )

    return f'''<a href="/models/{slug}/" style="text-decoration:none;" class="model-card card-glow">
        <div class="img-wrap" style="height:150px;background:linear-gradient({gradient});">
          {img_html}
        </div>
        <div style="padding:12px 14px;">
          <div style="display:flex;align-items:start;justify-content:space-between;gap:6px;margin-bottom:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#EDF2FF;line-height:1.3;letter-spacing:-0.01em;">{title}</div>
            {cert_html}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="chip chip-teal" style="font-size:10px;padding:2px 8px;">{cat}</span>
            <span style="font-size:13px;font-weight:600;color:#EDF2FF;">{price_str}</span>
          </div>
        </div>
      </a>'''


# ── Full model page ───────────────────────────────────────────────────────────

def model_page_html(m: dict, related: list[dict]) -> str:
    pid       = m['product_id']
    slug      = m['slug']
    title     = m['product_name']
    cat       = m['category']
    subcat    = m.get('subcategory', '').strip()
    cert      = m.get('certification', '')
    img       = m.get('image_url', '')
    ref_url   = m.get('referral_url', '#')
    cat_slug  = CAT_SLUG.get(cat, 'catalog')
    color, gradient = CAT_STYLE.get(cat, CAT_STYLE['Other'])

    try:
        price = float(m['price'])
        price_str = f"${price:.0f}"
    except (ValueError, TypeError):
        price = 0
        price_str = f"${m['price']}"

    try:
        sales = int(float(m.get('sales_qty', 0) or 0))
    except (ValueError, TypeError):
        sales = 0

    try:
        previews = int(float(m.get('full_previews', 0) or 0))
    except (ValueError, TypeError):
        previews = 0

    industries = [i.strip() for i in m.get('industries', '').split('|') if i.strip()]
    use_cases  = [u.strip() for u in m.get('use_cases', '').split('|') if u.strip()]
    seo_kws    = [k.strip() for k in m.get('seo_keywords', '').split('|') if k.strip()]

    description = generate_description(m)

    # Certification
    cert_html_hero = ''
    cert_detail    = ''
    if 'CheckMate' in cert:
        cert_html_hero = '<span class="cert-badge">&#10003;&nbsp;CheckMate Certified</span>'
        cert_detail    = 'CheckMate Lite/Pro — passed TurboSquid\'s topology, scale and UV quality audit.'
    elif 'Stem' in cert:
        cert_html_hero = '<span class="cert-badge cert-badge-sc">&#11088;&nbsp;StemCell Certified</span>'
        cert_detail    = 'StemCell — clean edge loops, consistent scale and universal rigging compatibility.'

    # Category chip
    cat_chip = f'<a href="/categories/{cat_slug}/" class="chip chip-teal" style="text-decoration:none;font-size:12px;">{cat}</a>'
    if subcat:
        cat_chip += f' <span class="chip" style="font-size:12px;">{subcat}</span>'

    # Stats (Units Sold and Previews removed per design)

    # Industries chips
    ind_chips = ' '.join(f'<span class="chip" style="font-size:12px;">{i}</span>' for i in industries)
    uc_chips  = ' '.join(f'<span class="chip" style="font-size:12px;">{u}</span>' for u in use_cases)
    kw_chips  = ' '.join(f'<span class="chip" style="font-size:11px;padding:3px 10px;color:#4A5C7A;">{k}</span>' for k in seo_kws[:6])

    # Hero image
    PROXY = "https://images.weserv.nl/?url="
    img_proxied = (PROXY + img.replace("https://", "") + "&w=600&q=85&output=webp"
                   if img and img.startswith("https://static.turbosquid") else img)
    img_content = ''
    if img:
        img_content = (
            f'<img src="{img_proxied}" alt="{title} 3D model preview" '
            f'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" '
            f'style="width:100%;height:100%;object-fit:cover;display:block;">'
            f'<div style="width:100%;height:100%;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:linear-gradient({gradient});">'
            f'<span style="font-size:48px;opacity:0.3;">&#128247;</span>'
            f'<span style="font-size:13px;color:{color};opacity:0.7;">{cat}</span>'
            f'</div>'
        )
    else:
        img_content = (
            f'<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:linear-gradient({gradient});">'
            f'<span style="font-size:48px;opacity:0.3;">&#128247;</span>'
            f'<span style="font-size:13px;color:{color};opacity:0.7;">{cat}</span>'
            f'</div>'
        )

    # Related cards
    related_cards = '\n        '.join(related_card_html(r) for r in related[:4])

    # Schema.org JSON-LD
    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": title,
        "image": img,
        "description": description,
        "brand": {"@type": "Brand", "name": "3D Molier"},
        "category": cat,
        "offers": {
            "@type": "Offer",
            "price": str(price),
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "url": ref_url,
            "seller": {"@type": "Organization", "name": "TurboSquid"}
        }
    }, ensure_ascii=False)

    # Meta description (clean, under 160 chars)
    meta_desc = f"Buy {title} 3D model by 3D Molier on TurboSquid. {cert.split('/')[0] + ' certified. ' if 'CheckMate' in cert or 'Stem' in cert else ''}{cat} asset, {price_str}."
    meta_desc = meta_desc[:158]

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} 3D Model &#8212; {price_str} | 3D Molier on TurboSquid</title>
<meta name="description" content="{meta_desc}">
<link rel="canonical" href="https://3dmolier.com/models/{slug}/">
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
<script type="application/ld+json">
{schema}
</script>
</head>
<body class="relative min-h-screen">

{nav_html()}

<main style="position:relative;z-index:1;">

<!-- Breadcrumb -->
<div style="border-bottom:1px solid #1E2B44;background:rgba(14,18,32,0.5);">
  <div class="max-w-7xl mx-auto px-6 py-3" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#7A8DB0;flex-wrap:wrap;">
    <a href="/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Home</a>
    <span style="color:#1E2B44;">&#8250;</span>
    <a href="/categories/{cat_slug}/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">{cat}</a>
    <span style="color:#1E2B44;">&#8250;</span>
    <span style="color:#EDF2FF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">{title}</span>
  </div>
</div>

<!-- Model Hero -->
<section style="padding:48px 24px;border-bottom:1px solid #1E2B44;">
  <div class="max-w-7xl mx-auto">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;" class="md:grid-cols-2">

      <!-- Image -->
      <div class="hero-img-frame" style="aspect-ratio:4/3;background:linear-gradient({gradient});">
        {img_content}
      </div>

      <!-- Info -->
      <div style="display:flex;flex-direction:column;gap:20px;">

        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          {cat_chip}
          {cert_html_hero}
        </div>

        <h1 style="font-family:'Syne',sans-serif;font-size:clamp(20px,3vw,32px);font-weight:800;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.15;margin:0;">
          {title}
        </h1>

        <!-- Price -->
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:#EDF2FF;letter-spacing:-0.04em;line-height:1;">{price_str}</span>
          <span style="font-size:14px;color:#7A8DB0;font-weight:500;">USD on TurboSquid</span>
        </div>

        <!-- CTAs -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="{ref_url}" target="_blank" rel="noopener" class="btn-primary" style="justify-content:center;">
            {LINK_ICON_MD}
            View on TurboSquid
          </a>
          <a href="/categories/{cat_slug}/" class="btn-ghost" style="justify-content:center;font-size:13px;">
            Browse {cat} Models
          </a>
        </div>



        <!-- Industries -->
        {'<div style="margin-top:4px;"><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#4A5C7A;text-transform:uppercase;margin-bottom:10px;">Used In</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + ind_chips + '</div></div>' if industries else ''}

      </div>
    </div>
  </div>
</section>

<!-- Details -->
<section style="padding:48px 24px;border-bottom:1px solid #1E2B44;">
  <div class="max-w-7xl mx-auto">
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:48px;align-items:start;">

      <!-- Description + Use Cases -->
      <div style="display:flex;flex-direction:column;gap:32px;">

        <div>
          <div class="section-label" style="margin-bottom:12px;">About This Model</div>
          <p style="font-size:15px;color:#C8D4EE;line-height:1.8;max-width:680px;">
            {description}
          </p>
        </div>

        {'<div><div class="section-label" style="margin-bottom:12px;">Use Cases</div><div style="display:flex;flex-wrap:wrap;gap:8px;">' + uc_chips + '</div></div>' if use_cases else ''}

        {'<div><div class="section-label" style="margin-bottom:12px;">Search Keywords</div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + kw_chips + '</div></div>' if seo_kws else ''}

      </div>

      <!-- Cert + Quick Info -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#0E1220;border:1px solid #1E2B44;border-radius:12px;padding:20px;">
          <div class="section-label" style="margin-bottom:14px;">Quick Info</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1E2B44;padding-bottom:10px;">
              <span style="font-size:13px;color:#7A8DB0;">Price</span>
              <span style="font-size:14px;font-weight:600;color:#EDF2FF;">{price_str}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1E2B44;padding-bottom:10px;">
              <span style="font-size:13px;color:#7A8DB0;">Category</span>
              <a href="/categories/{cat_slug}/" style="font-size:13px;font-weight:600;color:#00E5C4;text-decoration:none;">{cat}</a>
            </div>
            {'<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1E2B44;padding-bottom:10px;"><span style="font-size:13px;color:#7A8DB0;">Subcategory</span><span style="font-size:13px;font-weight:500;color:#EDF2FF;">' + subcat + '</span></div>' if subcat else ''}

            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;color:#7A8DB0;">Certification</span>
              <span style="font-size:13px;font-weight:500;color:{'#FFC600' if 'CheckMate' in cert else ('#7C3AED' if 'Stem' in cert else '#4A5C7A')};">{cert if cert and cert != 'no certification' else 'None'}</span>
            </div>
          </div>
        </div>

        {'<div style="background:rgba(255,198,0,0.05);border:1px solid rgba(255,198,0,0.2);border-radius:12px;padding:18px;"><div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#FFC600;text-transform:uppercase;margin-bottom:8px;">Quality Certified</div><p style="font-size:13px;color:#A89060;line-height:1.6;margin:0;">' + cert_detail + '</p></div>' if cert_detail else ''}

        <a href="{ref_url}" target="_blank" rel="noopener" class="btn-ts-lg" style="justify-content:center;width:100%;">
          {LINK_ICON_SM}
          Buy on TurboSquid
        </a>
      </div>

    </div>
  </div>
</section>

<!-- Related Models -->
{'<section style="padding:48px 24px 72px;"><div class="max-w-7xl mx-auto"><div class="section-label" style="margin-bottom:8px;">More in ' + cat + '</div><h2 style="font-family:\'Syne\',sans-serif;font-size:clamp(18px,2.5vw,24px);font-weight:700;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.1;margin-bottom:28px;">Related 3D Models</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">' + related_cards + '</div></div></section>' if related else ''}

</main>

{footer_html()}
</body>
</html>'''


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Read all top models
    rows: list[dict] = []
    with open(BASE_DIR / 'data' / 'top_models.csv', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    # Sort by priority_score for consistent related-model ordering
    rows.sort(key=lambda r: float(r.get('priority_score', 0) or 0), reverse=True)

    # Build category bucket → ordered list of models (for related section)
    cat_models: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        cat_models[r['category']].append(r)

    models_dir = BASE_DIR / 'models'
    models_dir.mkdir(exist_ok=True)

    generated = 0
    for m in rows:
        slug = m['slug']
        cat  = m['category']

        # Related: top 5 from same category, excluding self
        related = [r for r in cat_models[cat] if r['slug'] != slug][:4]

        out_dir = models_dir / slug
        out_dir.mkdir(exist_ok=True)
        (out_dir / 'index.html').write_text(
            model_page_html(m, related), encoding='utf-8'
        )
        generated += 1
        if generated % 100 == 0:
            print(f"  {generated}/1000 pages generated...")

    print(f"\nDone: {generated} model pages generated in models/\n")


if __name__ == '__main__':
    main()
