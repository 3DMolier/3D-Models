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




LINK_ICON_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
LINK_ICON_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


def nav_html():
    return """<header id="site-header">
<nav id="main-nav">
  <div class="nav-inner">
    <a href="/3D-Models/" class="nav-logo">3D Molier</a>
    <div class="nav-links" id="nav-links">
      <a href="/3D-Models/catalog/" class="nav-link">Top 1000</a>
      <a href="/3D-Models/full-catalog/" class="nav-link">Full 86K Catalog</a>
      <span class="nav-sep" aria-hidden="true"></span>
      <div class="nav-has-dropdown nav-has-mega" id="nav-cat-wrap">
        <button class="nav-link" id="nav-cat-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-categories-menu">Categories <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" id="nav-categories-menu" role="menu">
          <a href="/3D-Models/categories/vehicles/" role="menuitem" class="mega-item"><span class="mega-name">Vehicles</span><span class="mega-desc">cars, trucks, motorcycles</span></a>
          <a href="/3D-Models/categories/aircraft/" role="menuitem" class="mega-item"><span class="mega-name">Aircraft</span><span class="mega-desc">airplanes, helicopters, drones</span></a>
          <a href="/3D-Models/categories/military-vehicles/" role="menuitem" class="mega-item"><span class="mega-name">Military</span><span class="mega-desc">defense, tanks, equipment</span></a>
          <a href="/3D-Models/categories/ships/" role="menuitem" class="mega-item"><span class="mega-name">Ships</span><span class="mega-desc">naval, cargo, yachts</span></a>
          <a href="/3D-Models/categories/medical-3d-models/" role="menuitem" class="mega-item"><span class="mega-name">Medical</span><span class="mega-desc">anatomy, surgery, pharma</span></a>
          <a href="/3D-Models/categories/industrial-equipment/" role="menuitem" class="mega-item"><span class="mega-name">Industrial</span><span class="mega-desc">machinery, HVAC, cranes</span></a>
          <a href="/3D-Models/categories/architecture-landmarks/" role="menuitem" class="mega-item"><span class="mega-name">Architecture</span><span class="mega-desc">buildings, monuments</span></a>
          <a href="/3D-Models/categories/other/" role="menuitem" class="mega-item"><span class="mega-name">Other</span><span class="mega-desc">characters, animals, props</span></a>
        </div>
      </div>
      <div class="nav-has-dropdown nav-has-mega" id="nav-ind-wrap">
        <button class="nav-link" id="nav-ind-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-industries-menu">Industries <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" id="nav-industries-menu" role="menu">
          <a href="/3D-Models/industries/aerospace/" role="menuitem" class="mega-item"><span class="mega-name">Aerospace</span><span class="mega-desc">aviation, rockets, satellites</span></a>
          <a href="/3D-Models/industries/military-defense/" role="menuitem" class="mega-item"><span class="mega-name">Military &amp; Defense</span><span class="mega-desc">defense, simulation, training</span></a>
          <a href="/3D-Models/industries/medical/" role="menuitem" class="mega-item"><span class="mega-name">Medical</span><span class="mega-desc">anatomy, surgery, education</span></a>
          <a href="/3D-Models/industries/game-development/" role="menuitem" class="mega-item"><span class="mega-name">Game Development</span><span class="mega-desc">Unity, Unreal, real-time</span></a>
          <a href="/3D-Models/industries/film-video-production/" role="menuitem" class="mega-item"><span class="mega-name">Film Production</span><span class="mega-desc">VFX, animation, commercials</span></a>
          <a href="/3D-Models/industries/architecture/" role="menuitem" class="mega-item"><span class="mega-name">Architecture</span><span class="mega-desc">buildings, landmarks, viz</span></a>
          <a href="/3D-Models/industries/virtual-reality/" role="menuitem" class="mega-item"><span class="mega-name">Virtual Reality</span><span class="mega-desc">VR, AR, immersive scenes</span></a>
          <a href="/3D-Models/industries/advertising/" role="menuitem" class="mega-item"><span class="mega-name">Advertising</span><span class="mega-desc">product rendering, campaigns</span></a>
          <a href="/3D-Models/industries/software-development/" role="menuitem" class="mega-item"><span class="mega-name">Software Dev</span><span class="mega-desc">apps, demos, UI assets</span></a>
          <a href="/3D-Models/industries/event-management/" role="menuitem" class="mega-item"><span class="mega-name">Event Management</span><span class="mega-desc">exhibitions, staging, shows</span></a>
          <a href="/3D-Models/industries/hardware/" role="menuitem" class="mega-item"><span class="mega-name">Hardware</span><span class="mega-desc">devices, components, tech</span></a>
          <a href="/3D-Models/industries/3d-printing/" role="menuitem" class="mega-item"><span class="mega-name">3D Printing</span><span class="mega-desc">printing, prototyping, fab</span></a>
        </div>
      </div>
      <a href="/3D-Models/collections/" class="nav-link">Collections</a>
      <a href="/3D-Models/search/" class="nav-link">Search</a>
      <a href="/3D-Models/custom-order/" class="nav-link">Custom Order</a>
      <a href="/3D-Models/about/" class="nav-link">About</a>
    </div>
    <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" class="nav-cta" target="_blank" rel="noopener">TurboSquid &#8599;</a>
    <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="nav-mobile" id="nav-mobile" aria-hidden="true">
  <a href="/3D-Models/catalog/">Top 1000 Models</a>
  <a href="/3D-Models/full-catalog/">Full 86K Catalog</a>
  <button class="nav-mobile-toggle" id="mob-cat-toggle" aria-expanded="false">Categories <span class="nav-caret">&#9662;</span></button>
  <div class="nav-mobile-sub" id="mob-cat-sub">
    <a href="/3D-Models/categories/vehicles/">Vehicles</a>
    <a href="/3D-Models/categories/aircraft/">Aircraft</a>
    <a href="/3D-Models/categories/military-vehicles/">Military</a>
    <a href="/3D-Models/categories/ships/">Ships</a>
    <a href="/3D-Models/categories/medical-3d-models/">Medical</a>
    <a href="/3D-Models/categories/industrial-equipment/">Industrial</a>
    <a href="/3D-Models/categories/architecture-landmarks/">Architecture</a>
    <a href="/3D-Models/categories/other/">Other</a>
  </div>
  <button class="nav-mobile-toggle" id="mob-ind-toggle" aria-expanded="false">Industries <span class="nav-caret">&#9662;</span></button>
  <div class="nav-mobile-sub" id="mob-ind-sub">
    <a href="/3D-Models/industries/aerospace/">Aerospace</a>
    <a href="/3D-Models/industries/military-defense/">Military &amp; Defense</a>
    <a href="/3D-Models/industries/medical/">Medical</a>
    <a href="/3D-Models/industries/game-development/">Game Development</a>
    <a href="/3D-Models/industries/film-video-production/">Film Production</a>
    <a href="/3D-Models/industries/architecture/">Architecture</a>
    <a href="/3D-Models/industries/virtual-reality/">Virtual Reality</a>
    <a href="/3D-Models/industries/advertising/">Advertising</a>
    <a href="/3D-Models/industries/software-development/">Software Development</a>
    <a href="/3D-Models/industries/event-management/">Event Management</a>
    <a href="/3D-Models/industries/hardware/">Hardware</a>
    <a href="/3D-Models/industries/3d-printing/">3D Printing</a>
  </div>
  <a href="/3D-Models/collections/">Collections</a>
  <a href="/3D-Models/search/">Search</a>
  <a href="/3D-Models/custom-order/">Custom Order</a>
  <a href="/3D-Models/about/">About</a>
  <a href="/3D-Models/contact/">Contact</a>
  <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" target="_blank" rel="noopener" class="mobile-cta">TurboSquid Store &#8599;</a>
</div>
</header>"""


def footer_html(cat='', cat_slug=''):
    back_label = f'All {cat}' if cat else 'Back to home'
    back_href  = f'/3D-Models/categories/{cat_slug}/' if cat_slug else '/3D-Models/'
    return f"""<footer class="mp-footer">
  <div class="max-w-7xl mx-auto">
    <div class="mp-footer-grid">
      <div>
        <div class="mp-footer-brand-row">
          <div class="mp-footer-logo-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
          <span class="mp-footer-brand-name">3D Molier</span>
        </div>
        <p class="mp-footer-desc">Searchable catalog of 88,000+ professional 3D models. All models sold on TurboSquid.</p>
      </div>
      <div>
        <div class="mp-footer-col-hd">Categories</div>
        <div class="mp-footer-links">
          <a href="/3D-Models/categories/vehicles/" class="nav-link mp-footer-link">Vehicles</a>
          <a href="/3D-Models/categories/aircraft/" class="nav-link mp-footer-link">Aircraft</a>
          <a href="/3D-Models/categories/military-vehicles/" class="nav-link mp-footer-link">Military</a>
          <a href="/3D-Models/categories/medical-3d-models/" class="nav-link mp-footer-link">Medical</a>
          <a href="/3D-Models/categories/ships/" class="nav-link mp-footer-link">Ships</a>
        </div>
      </div>
      <div>
        <div class="mp-footer-col-hd">Collections</div>
        <div class="mp-footer-links">
          <a href="/3D-Models/collections/best-vehicle-3d-models/" class="nav-link mp-footer-link">Best Vehicles</a>
          <a href="/3D-Models/collections/best-aircraft-3d-models/" class="nav-link mp-footer-link">Best Aircraft</a>
          <a href="/3D-Models/collections/best-medical-3d-models/" class="nav-link mp-footer-link">Best Medical</a>
          <a href="/3D-Models/collections/" class="nav-link mp-footer-link">All Collections</a>
        </div>
      </div>
      <div>
        <div class="mp-footer-col-hd">TurboSquid</div>
        <div class="mp-footer-links">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link mp-footer-link">Artist Store</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/vehicle?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link mp-footer-link">Vehicle Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/aircraft?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link mp-footer-link">Aircraft Models</a>
          <a href="https://www.turbosquid.com/Search/3D-Models/medical?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link mp-footer-link">Medical Models</a>
        </div>
      </div>
    </div>
    <div class="mp-footer-bottom">
      <p class="mp-footer-copy">&#169; 2025 3D Molier. All 3D models sold via TurboSquid.</p>
      <a href="{back_href}" class="nav-link mp-back-link">&#8592; {back_label}</a>
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
        cert_html = '<span class="cert-badge mp-cert-sm">&#10003; CM</span>'
    elif 'Stem' in cert:
        cert_html = '<span class="cert-badge cert-badge-sc mp-cert-sm">SC</span>'

    PROXY = "https://images.weserv.nl/?url="
    img_src = (PROXY + img.replace("https://", "") + "&w=600&q=85&output=webp"
               if img and img.startswith("https://static.turbosquid") else img)
    if img:
        img_html = (
            f'<img src="{img_src}" alt="{title}" width="800" height="450" decoding="async" loading="lazy" onerror="imgErr(this)">'
            f'<div class="img-placeholder">'
            f'<span class="mp-rc-placeholder-icon">&#128247;</span></div>'
        )
    else:
        img_html = (
            f'<div class="img-placeholder" style="display:flex;">'
            f'<span class="mp-rc-placeholder-icon">&#128247;</span></div>'
        )

    return f'''<a href="/3D-Models/models/{slug}/" class="model-card card-glow mp-rc-link">
        <div class="img-wrap mp-rc-img-wrap">
          {img_html}
        </div>
        <div class="mp-rc-body">
          <div class="mp-rc-head">
            <div class="mp-rc-title">{title}</div>
            {cert_html}
          </div>
          <div class="mp-rc-foot">
            <span class="chip chip-teal mp-rc-chip">{cat}</span>
            <span class="mp-rc-price">{price_str}</span>
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
    cat_chip = f'<a href="/3D-Models/categories/{cat_slug}/" class="chip chip-teal chip--sm">{cat}</a>'
    if subcat:
        cat_chip += f' <span class="chip chip--sm">{subcat}</span>'

    # Chip rows
    ind_chips = ' '.join(f'<span class="chip chip--sm">{i}</span>' for i in industries)
    uc_chips  = ' '.join(f'<span class="chip chip--sm">{u}</span>' for u in use_cases)
    kw_chips  = ' '.join(f'<span class="chip chip--kw">{k}</span>' for k in seo_kws[:6])

    # Cert color class
    cert_val_class = 'mp-cert-gold' if 'CheckMate' in cert else ('mp-cert-purple' if 'Stem' in cert else 'mp-cert-none')
    cert_val_text = cert if cert and cert != 'no certification' else 'None'

    # Hero image
    PROXY = "https://images.weserv.nl/?url="
    img_proxied = (PROXY + img.replace("https://", "") + "&w=600&q=85&output=webp"
                   if img and img.startswith("https://static.turbosquid") else img)
    if img:
        img_content = (
            f'<img src="{img_proxied}" alt="{title} 3D model preview" '
            f'width="1200" height="675" decoding="async" loading="eager" fetchpriority="high" '
            f'onerror="imgErr(this)" class="mp-hero-img">'
            f'<div class="img-placeholder mp-placeholder">'
            f'<span class="mp-placeholder-icon">&#128247;</span>'
            f'<span class="mp-placeholder-cat">{cat}</span>'
            f'</div>'
        )
    else:
        img_content = (
            f'<div class="img-placeholder mp-placeholder" style="display:flex;">'
            f'<span class="mp-placeholder-icon">&#128247;</span>'
            f'<span class="mp-placeholder-cat">{cat}</span>'
            f'</div>'
        )

    # Pre-computed conditional HTML blocks
    industries_html = ''
    if industries:
        industries_html = (
            f'<div class="mp-industries">'
            f'<div class="mp-field-label">Used In</div>'
            f'<div class="mp-chip-row">{ind_chips}</div>'
            f'</div>'
        )

    use_cases_html = ''
    if use_cases:
        use_cases_html = (
            f'<div>'
            f'<div class="section-label mp-mb12">Use Cases</div>'
            f'<div class="mp-chip-row-8">{uc_chips}</div>'
            f'</div>'
        )

    keywords_html = ''
    if seo_kws:
        keywords_html = (
            f'<div>'
            f'<div class="section-label mp-mb12">Search Keywords</div>'
            f'<div class="mp-chip-row">{kw_chips}</div>'
            f'</div>'
        )

    subcat_row_html = ''
    if subcat:
        subcat_row_html = (
            f'<div class="mp-info-row">'
            f'<span class="mp-info-row-label">Subcategory</span>'
            f'<span class="mp-info-row-val-sm">{subcat}</span>'
            f'</div>'
        )

    cert_card_html = ''
    if cert_detail:
        cert_card_html = (
            f'<div class="mp-cert-card">'
            f'<div class="mp-cert-card-label">Quality Certified</div>'
            f'<p class="mp-cert-card-text">{cert_detail}</p>'
            f'</div>'
        )

    related_section_html = ''
    if related:
        related_cards = '\n        '.join(related_card_html(r) for r in related[:4])
        related_section_html = (
            f'<section class="mp-related-section">'
            f'<div class="max-w-7xl mx-auto">'
            f'<div class="section-label mp-mb8">More in {cat}</div>'
            f'<h2 class="mp-related-h2">Related 3D Models</h2>'
            f'<div class="mp-related-grid">'
            f'\n        {related_cards}'
            f'\n    </div></div></section>'
        )

    # Schema.org JSON-LD
    page_url = f"https://3dmolier.github.io/3D-Models/models/{slug}/"
    base = "https://3dmolier.github.io/3D-Models"
    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": title,
        "url": page_url,
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
    breadcrumb = json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Categories", "item": f"{base}/catalog/"},
            {"@type": "ListItem", "position": 3, "name": cat, "item": f"{base}/categories/{cat_slug}/"},
            {"@type": "ListItem", "position": 4, "name": title, "item": page_url},
        ]
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
<meta property="og:type" content="product">
<meta property="og:title" content="{title} 3D Model | 3D Molier">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{page_url}">
<meta property="og:site_name" content="3D Molier Models">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} 3D Model | 3D Molier">
<meta name="twitter:description" content="{meta_desc}">
<meta name="twitter:image" content="{img}">
<link rel="icon" href="/3D-Models/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="{page_url}">
<link rel="alternate" hreflang="en" href="{page_url}">
<link rel="alternate" hreflang="x-default" href="{page_url}">
<link rel="preload" href="/3D-Models/assets/fonts/font-13.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/3D-Models/assets/css/critical-fonts.css?v=32">
<link rel="stylesheet" href="/3D-Models/assets/css/styles.min.css?v=32">
<link rel="stylesheet" href="/3D-Models/assets/css/model-pages.min.css?v=32">
<link rel="stylesheet" href="/3D-Models/assets/css/fonts.css?v=32">
<script type="application/ld+json">
{schema}
</script>
<script type="application/ld+json">
{breadcrumb}
</script>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to main content</a>

{nav_html()}

<main id="main-content" class="mp-main">

<!-- Breadcrumb -->
<div class="mp-bc-bar">
  <div class="max-w-7xl mx-auto px-6 py-3 mp-bc-inner">
    <a href="/3D-Models/" class="mp-bc-link">Home</a>
    <span class="mp-bc-sep">&#8250;</span>
    <a href="/3D-Models/categories/{cat_slug}/" class="mp-bc-link">{cat}</a>
    <span class="mp-bc-sep">&#8250;</span>
    <span class="mp-bc-current">{title}</span>
  </div>
</div>

<!-- Model Hero -->
<section class="mp-hero-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-hero-grid">

      <!-- Image -->
      <div class="hero-img-frame mp-hero-frame">
        {img_content}
      </div>

      <!-- Info -->
      <div class="mp-info-col">

        <div class="mp-badge-row">
          {cat_chip}
          {cert_html_hero}
        </div>

        <h1 class="mp-h1">
          {title}
        </h1>

        <!-- Price -->
        <div class="mp-price-row">
          <span class="mp-price">{price_str}</span>
          <span class="mp-price-label">USD on TurboSquid</span>
        </div>

        <!-- CTAs -->
        <div class="mp-ctas">
          <a href="{ref_url}" target="_blank" rel="noopener" class="btn-primary mp-btn-center">
            {LINK_ICON_MD}
            View on TurboSquid
          </a>
          <a href="/3D-Models/categories/{cat_slug}/" class="btn-ghost mp-btn-browse">
            Browse {cat} Models
          </a>
        </div>

        {industries_html}

      </div>
    </div>
  </div>
</section>

<!-- Details -->
<section class="mp-details-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-details-grid">

      <!-- Description + Use Cases -->
      <div class="mp-details-left">

        <div>
          <div class="section-label mp-mb12">About This Model</div>
          <p class="mp-desc-text">
            {description}
          </p>
        </div>

        {use_cases_html}

        {keywords_html}

      </div>

      <!-- Cert + Quick Info -->
      <div class="mp-sidebar-col">
        <div class="mp-info-card">
          <div class="section-label mp-mb14">Quick Info</div>
          <div class="mp-info-rows">
            <div class="mp-info-row">
              <span class="mp-info-row-label">Price</span>
              <span class="mp-info-row-val">{price_str}</span>
            </div>
            <div class="mp-info-row">
              <span class="mp-info-row-label">Category</span>
              <a href="/3D-Models/categories/{cat_slug}/" class="mp-cat-link">{cat}</a>
            </div>
            {subcat_row_html}
            <div class="mp-info-row-last">
              <span class="mp-info-row-label">Certification</span>
              <span class="{cert_val_class}">{cert_val_text}</span>
            </div>
          </div>
        </div>

        {cert_card_html}

        <a href="{ref_url}" target="_blank" rel="noopener" class="btn-ts-lg mp-btn-full">
          {LINK_ICON_SM}
          Buy on TurboSquid
        </a>
      </div>

    </div>
  </div>
</section>

{related_section_html}

<section class="mp-cta-section" aria-label="Custom order">
  <div class="mp-cta-inner">
    <div class="mp-cta-card">
      <div class="mp-cta-text">
        <div class="section-label mp-mb8">Custom Order</div>
        <h2 class="mp-cta-heading">Need a similar custom 3D model?</h2>
        <p class="mp-cta-desc">Get a model built to your exact specifications — dimensions, file format, topology, rigging or any technical requirement. Professional delivery within agreed timelines.</p>
      </div>
      <a href="/3D-Models/custom-order/" class="btn-primary mp-cta-btn">Request Custom Model &#8594;</a>
    </div>
  </div>
</section>

</main>

{footer_html(cat, cat_slug)}
<script src="/3D-Models/assets/js/site.min.js?v=32" defer></script>
</body>
</html>'''


# ── Main ─────────────────────────────────────────────────────────────────────

def resolve_image(product_id: str, external_url: str, local_index: dict) -> str:
    """Return image URL: local WebP if available, else external (proxied) URL."""
    entry = local_index.get(product_id)
    if entry and entry.get('image_status') == 'local' and entry.get('image_preview'):
        return entry['image_preview']
    return external_url


def main():
    # Load local image override index (empty by default, used for future localization)
    _img_local_path = BASE_DIR / 'data' / 'img-local-index.json'
    local_img_index: dict = {}
    if _img_local_path.exists():
        with open(_img_local_path, encoding='utf-8') as f:
            local_img_index = json.load(f).get('models', {})

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
        pid  = m.get('product_id', '')

        # Apply local image override if available
        if pid in local_img_index:
            resolved = resolve_image(pid, m.get('image_url', ''), local_img_index)
            if resolved != m.get('image_url', ''):
                m = {**m, 'image_url': resolved}

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
