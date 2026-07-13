#!/usr/bin/env python3
"""
Generate HTML pages for all 86,865 models from fc-chunk data.
Skips models that already have a page (top-1000 catalog).
Output: models/{slug}/index.html

Usage:
  python scripts/generate_model_pages_full.py
  python scripts/generate_model_pages_full.py --limit 5000   # generate first N new pages
  python scripts/generate_model_pages_full.py --dry-run      # count only, no write
"""
import json, re, sys, html as html_mod
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
MODELS_DIR = ROOT / "models"

VERSION = "33"
BASE_URL = "https://3dmolierstudio.com"
PLACEHOLDER = "/assets/og/3d-molier-og.jpg"

CERT_LABELS = {0: '', 1: 'StemCell', 2: 'CheckMate'}

LINK_ICON_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
LINK_ICON_MD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


def make_slug(name: str, pid: str) -> str:
    s = name.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return f"{s.strip('-')}-{pid}"


def nav_html() -> str:
    return """<header id="site-header">
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
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" class="nav-cta" target="_blank" rel="noopener">TurboSquid &#8599;</a>
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
  <a href="/contact/">Contact</a>
  <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="mobile-cta">TurboSquid Store &#8599;</a>
</div>
</header>"""


def model_page_html(pid: str, slug: str, name: str, price: float, cert: str, img: str) -> str:
    esc_name = html_mod.escape(name)
    price_str = f"${price:.0f}" if price == int(price) else f"${price:.2f}"
    ref_url = f"https://www.turbosquid.com/3d-models/{slug}?referral=3d_molier-studio"
    page_url = f"{BASE_URL}/models/{slug}/"

    # Certification
    cert_badge = ''
    cert_card = ''
    cert_val_class = 'mp-cert-none'
    cert_val_text = 'None'
    if cert == 'CheckMate':
        cert_badge = '<span class="cert-badge">&#10003;&nbsp;CheckMate Certified</span>'
        cert_card = ('<div class="mp-cert-card">'
                     '<div class="mp-cert-card-label">Quality Certified</div>'
                     '<p class="mp-cert-card-text">CheckMate Lite/Pro — passed TurboSquid\'s topology, scale and UV quality audit.</p>'
                     '</div>')
        cert_val_class = 'mp-cert-gold'
        cert_val_text = 'CheckMate'
    elif cert == 'StemCell':
        cert_badge = '<span class="cert-badge cert-badge-sc">&#11088;&nbsp;StemCell Certified</span>'
        cert_card = ('<div class="mp-cert-card">'
                     '<div class="mp-cert-card-label">Quality Certified</div>'
                     '<p class="mp-cert-card-text">StemCell — clean edge loops, consistent scale and universal rigging compatibility.</p>'
                     '</div>')
        cert_val_class = 'mp-cert-purple'
        cert_val_text = 'StemCell'

    # Description
    cert_clause = ''
    if cert == 'CheckMate':
        cert_clause = ' This model has passed TurboSquid\'s rigorous CheckMate quality certification, guaranteeing clean topology, correct scale and production-ready geometry.'
    elif cert == 'StemCell':
        cert_clause = ' Certified StemCell by TurboSquid — ensuring universal rigging compatibility, clean edge flow and consistent real-world scale.'
    description = (f"The {name} is a professional 3D model available at {price_str} on TurboSquid.{cert_clause} "
                   f"This asset is sold by 3D Molier and suitable for professional visualization, game development, film production and other applications.")
    esc_desc = html_mod.escape(description)

    # Meta description — avoid "3D Model 3D model" when name already has it
    has_3d_model = bool(re.search(r'3d\s*model', name, re.I))
    desc_suffix = '' if has_3d_model else ' 3D model'
    meta_desc = f"Buy {name}{desc_suffix} by 3D Molier on TurboSquid. {cert + ' certified. ' if cert else ''}{price_str}."
    meta_desc = html_mod.escape(meta_desc[:158])

    # Image HTML
    if img:
        img_content = (
            f'<img src="{img}" alt="{esc_name} 3D model preview" '
            f'width="1200" height="675" decoding="async" loading="eager" fetchpriority="high" '
            f'class="mp-hero-img" data-fallback="{img}" data-placeholder="{PLACEHOLDER}" onerror="imgErr(this)">'
            f'<div class="img-placeholder mp-placeholder">'
            f'<span class="mp-placeholder-icon">&#128247;</span>'
            f'<span class="mp-placeholder-cat">3D Model</span>'
            f'</div>'
        )
    else:
        img_content = (
            f'<div class="img-placeholder mp-placeholder" style="display:flex;">'
            f'<span class="mp-placeholder-icon">&#128247;</span>'
            f'<span class="mp-placeholder-cat">3D Model</span>'
            f'</div>'
        )

    # JSON-LD
    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "url": page_url,
        "image": img or "",
        "description": description,
        "brand": {"@type": "Brand", "name": "3D Molier"},
        "offers": {
            "@type": "Offer",
            "price": f"{price:.2f}",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "url": ref_url,
            "seller": {"@type": "Organization", "name": "TurboSquid"}
        }
    }, ensure_ascii=False, separators=(',', ':'))

    breadcrumb = json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": "Full Catalog", "item": f"{BASE_URL}/full-catalog/"},
            {"@type": "ListItem", "position": 3, "name": name, "item": page_url},
        ]
    }, ensure_ascii=False, separators=(',', ':'))

    # Avoid "... 3D Model 3D Model" when name already ends with that phrase
    title_suffix = '' if re.search(r'3d\s*model', name, re.I) else ' 3D Model'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc_name}{title_suffix} &#8212; {price_str} | 3D Molier on TurboSquid</title>
<meta name="description" content="{meta_desc}">
<meta property="og:type" content="product">
<meta property="og:title" content="{esc_name}{title_suffix} | 3D Molier">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{page_url}">
<meta property="og:site_name" content="3D Molier Models">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc_name}{title_suffix} | 3D Molier">
<meta name="twitter:description" content="{meta_desc}">
<meta name="twitter:image" content="{img}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="{page_url}">
<link rel="preload" href="/assets/fonts/font-13.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v={VERSION}">
<link rel="stylesheet" href="/assets/css/styles.min.css?v={VERSION}">
<link rel="stylesheet" href="/assets/css/model-pages.min.css?v={VERSION}">
<link rel="stylesheet" href="/assets/css/fonts.css?v={VERSION}">
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
<div class="mp-bc-bar">
  <div class="max-w-7xl mx-auto px-6 py-3 mp-bc-inner">
    <a href="/" class="mp-bc-link">Home</a>
    <span class="mp-bc-sep">&#8250;</span>
    <a href="/full-catalog/" class="mp-bc-link">Full Catalog</a>
    <span class="mp-bc-sep">&#8250;</span>
    <span class="mp-bc-current">{esc_name}</span>
  </div>
</div>
<section class="mp-hero-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-hero-grid">
      <div class="hero-img-frame mp-hero-frame">
        {img_content}
      </div>
      <div class="mp-info-col">
        <div class="mp-badge-row">
          <a href="/full-catalog/" class="chip chip-teal chip--sm">3D Models</a>
          {cert_badge}
        </div>
        <h1 class="mp-h1">{esc_name}</h1>
        <div class="mp-price-row">
          <span class="mp-price">{price_str}</span>
          <span class="mp-price-label">USD on TurboSquid</span>
        </div>
        <div class="mp-ctas">
          <a href="{ref_url}" target="_blank" rel="noopener" class="btn-primary mp-btn-center">
            {LINK_ICON_MD}
            View on TurboSquid
          </a>
          <a href="/full-catalog/" class="btn-ghost mp-btn-browse">
            Browse Full Catalog
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
<section class="mp-details-section">
  <div class="max-w-7xl mx-auto">
    <div class="mp-details-grid">
      <div class="mp-details-left">
        <div>
          <div class="section-label mp-mb12">About This Model</div>
          <p class="mp-desc-text">{esc_desc}</p>
        </div>
      </div>
      <div class="mp-sidebar-col">
        <div class="mp-info-card">
          <div class="section-label mp-mb14">Quick Info</div>
          <div class="mp-info-rows">
            <div class="mp-info-row">
              <span class="mp-info-row-label">Price</span>
              <span class="mp-info-row-val">{price_str}</span>
            </div>
            <div class="mp-info-row-last">
              <span class="mp-info-row-label">Certification</span>
              <span class="{cert_val_class}">{cert_val_text}</span>
            </div>
          </div>
        </div>
        {cert_card}
        <a href="{ref_url}" target="_blank" rel="noopener" class="btn-ts-lg mp-btn-full">
          {LINK_ICON_SM}
          Buy on TurboSquid
        </a>
      </div>
    </div>
  </div>
</section>
<section class="mp-cta-section" aria-label="Custom order">
  <div class="mp-cta-inner">
    <div class="mp-cta-card">
      <div class="mp-cta-text">
        <div class="section-label mp-mb8">Custom Order</div>
        <h2 class="mp-cta-heading">Need a similar custom 3D model?</h2>
        <p class="mp-cta-desc">Get a model built to your exact specifications — dimensions, file format, topology, rigging or any technical requirement. Professional delivery within agreed timelines.</p>
      </div>
      <a href="/custom-order/" class="btn-primary mp-cta-btn">Request Custom Model &#8594;</a>
    </div>
  </div>
</section>
</main>
<footer class="mp-footer">
  <div class="max-w-7xl mx-auto">
    <div class="mp-footer-bottom">
      <p class="mp-footer-copy">&#169; 2026 3D Molier. All 3D models sold via <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener">TurboSquid</a>.</p>
      <a href="/full-catalog/" class="nav-link mp-back-link">&#8592; Full Catalog</a>
    </div>
  </div>
</footer>
<script src="/assets/js/site.min.js?v={VERSION}" defer></script>
</body>
</html>'''


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0, help='Max new pages to generate (0=all)')
    parser.add_argument('--dry-run', action='store_true', help='Count without writing')
    args = parser.parse_args()

    # Load existing slugs to skip
    MODELS_DIR.mkdir(exist_ok=True)
    existing = {d.name for d in MODELS_DIR.iterdir() if d.is_dir()}
    print(f"Existing model pages: {len(existing)}")

    # Load fc-img map (chunks 0-5 have real data)
    print("Loading image map...", end=' ', flush=True)
    fc_img: dict[str, str] = {}
    for i in range(6):
        p = DATA / f"fc-img-chunk-{i}.json"
        if p.exists():
            with open(p, encoding='utf-8') as f:
                fc_img.update(json.load(f))
    print(f"{len(fc_img)} entries")

    total = generated = skipped = errors = 0

    for chunk_i in range(9):
        chunk_path = DATA / f"fc-chunk-{chunk_i}.json"
        if not chunk_path.exists():
            print(f"  WARNING: {chunk_path.name} not found, skipping")
            continue

        with open(chunk_path, encoding='utf-8') as f:
            chunk = json.load(f)

        ids    = chunk['i']
        names  = chunk['n']
        prices = chunk['p']
        certs  = chunk['c']

        for j in range(len(ids)):
            pid  = str(ids[j])
            name = names[j]
            try:
                price = float(prices[j] or 0)
            except (ValueError, TypeError):
                price = 0.0
            cert = CERT_LABELS.get(certs[j], '')
            img  = fc_img.get(pid, '')
            slug = make_slug(name, pid)
            total += 1

            if slug in existing:
                skipped += 1
                continue

            if not args.dry_run:
                try:
                    out_dir = MODELS_DIR / slug
                    out_dir.mkdir(exist_ok=True)
                    html = model_page_html(pid, slug, name, price, cert, img)
                    (out_dir / 'index.html').write_text(html, encoding='utf-8')
                except Exception as e:
                    errors += 1
                    print(f"\n  ERROR {slug}: {e}")
                    continue

            generated += 1

            if args.limit and generated >= args.limit:
                print(f"\nLimit {args.limit} reached — stopping early.")
                print(f"Total processed: {total} | Generated: {generated} | Skipped (exist): {skipped} | Errors: {errors}")
                return

        print(f"  Chunk {chunk_i}: {generated} generated so far, {skipped} skipped")

    print(f"\nDone: {generated} new pages, {skipped} skipped (already exist), {errors} errors")
    if args.dry_run:
        print("(dry-run mode — no files written)")


if __name__ == '__main__':
    main()
