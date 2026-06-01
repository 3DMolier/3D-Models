#!/usr/bin/env python3
"""
Generates 15 static category pages from top_models.csv.
Output: categories/{slug}/index.html
"""
import csv
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

# ── Industry name → slug mapping ────────────────────────────────────────────────
INDUSTRY_SLUGS = {
    "Film & Video Production": "film-video-production",
    "Games":                   "game-development",
    "Advertising":             "advertising",
    "Simulation":              None,  # no page — links to full-catalog
    "Architecture":            "architecture",
    "Aerospace":               "aerospace",
    "Virtual Reality":         "virtual-reality",
    "Medical":                 "medical",
    "Military / Defense":      "military-defense",
    "Software Development":    "software-development",
    "Event Management":        "event-management",
    "3D Printing":             "3d-printing",
    "Hardware":                "hardware",
}

def industry_href(ind: str) -> str:
    slug = INDUSTRY_SLUGS.get(ind)
    if slug is None:
        return "/full-catalog/"
    return f"/industries/{slug}/"

# ── Per-category metadata ───────────────────────────────────────────────────────

CATEGORIES = {
    "Vehicles": {
        "slug": "vehicles",
        "icon": "🚗",
        "total_models": 7518,
        "seo_title": "Vehicle 3D Models — 7,500+ Cars, Trucks & More",
        "meta_desc": "7,500+ professional vehicle 3D models: cars, trucks, motorcycles, buses, SUVs and construction vehicles. CheckMate certified, game-ready and film-quality assets on TurboSquid.",
        "h1": "Vehicle 3D Models",
        "description": "The most comprehensive vehicle 3D model library covers the full spectrum of road transportation: passenger cars, commercial trucks, motorcycles, buses, construction vehicles and specialty rigs. Available in all major 3D formats, used by film studios, game developers, automotive advertisers and simulation engineers worldwide.",
        "industries": ["Film & Video Production", "Games", "Advertising", "Simulation", "Architecture"],
        "tags": ["Cars", "Trucks", "Motorcycles", "Buses", "SUVs", "Construction Vehicles"],
        "related": [("Military Vehicles", "military-vehicles"), ("Aircraft", "aircraft"), ("Ships", "ships")],
        "color": "#4F9EFF",
        "fallback_gradient": "135deg,#0D1A28 0%,#0D2030 50%,#0A1520 100%",
    },
    "Aircraft": {
        "slug": "aircraft",
        "icon": "✈️",
        "total_models": 3871,
        "seo_title": "Aircraft 3D Models — 3,800+ Planes, Jets & Helicopters",
        "meta_desc": "3,800+ professional aircraft 3D models: airliners, military jets, helicopters, drones and private jets. CheckMate certified for aerospace, simulation and film production.",
        "h1": "Aircraft 3D Models",
        "description": "Comprehensive aviation 3D models from commercial airliners to military jets, helicopters, UAVs and private aircraft. Used by aerospace engineers, flight simulators, film productions and game studios. Includes accurate cockpits, detailed engines and realistic materials for high-fidelity renders.",
        "industries": ["Aerospace", "Film & Video Production", "Games", "Simulation", "Virtual Reality"],
        "tags": ["Airliners", "Helicopters", "Drones", "Military Jets", "Private Jets", "Cargo Planes"],
        "related": [("Military Vehicles", "military-vehicles"), ("Vehicles", "vehicles"), ("Ships", "ships")],
        "color": "#9F7AEA",
        "fallback_gradient": "135deg,#0D1525 0%,#101A35 50%,#0A1228 100%",
    },
    "Military Vehicles": {
        "slug": "military-vehicles",
        "icon": "🪖",
        "total_models": 1733,
        "seo_title": "Military Vehicle 3D Models — 1,700+ Tanks, Jets & Warships",
        "meta_desc": "1,700+ military vehicle 3D models: tanks, APCs, fighter jets, warships, drones and artillery. CheckMate certified for defense simulations, games and film production.",
        "h1": "Military Vehicle 3D Models",
        "description": "The definitive military and defense vehicle 3D model collection spanning all branches and eras. Includes main battle tanks, infantry fighting vehicles, self-propelled artillery, attack helicopters, fighter jets and naval vessels. Used by defense contractors, simulation engineers, game studios and film productions.",
        "industries": ["Military / Defense", "Games", "Film & Video Production", "Simulation"],
        "tags": ["Tanks", "APCs", "Fighter Jets", "Warships", "Artillery", "Combat Drones"],
        "related": [("Aircraft", "aircraft"), ("Ships", "ships"), ("Vehicles", "vehicles")],
        "color": "#4ADE80",
        "fallback_gradient": "135deg,#0A1A0A 0%,#0F2010 50%,#081508 100%",
    },
    "Ships": {
        "slug": "ships",
        "icon": "🚢",
        "total_models": 961,
        "seo_title": "Ship & Boat 3D Models — 900+ Vessels",
        "meta_desc": "900+ ship and boat 3D models: cruise liners, cargo ships, yachts, sailboats and historical vessels. CheckMate certified for film, games and naval simulation.",
        "h1": "Ship & Boat 3D Models",
        "description": "Maritime 3D models spanning modern cruise liners and container ships to historical sailing vessels, military warships and recreational boats. Ideal for naval architecture visualization, maritime simulation, film production and game environments. Includes detailed hull geometry and realistic weathering.",
        "industries": ["Film & Video Production", "Games", "Simulation", "Event Management"],
        "tags": ["Cruise Ships", "Cargo Ships", "Yachts", "Sailboats", "Warships", "Historical Vessels"],
        "related": [("Military Vehicles", "military-vehicles"), ("Vehicles", "vehicles"), ("Aircraft", "aircraft")],
        "color": "#38BDF8",
        "fallback_gradient": "135deg,#081520 0%,#0A1C28 50%,#061018 100%",
    },
    "Medical": {
        "slug": "medical-3d-models",
        "icon": "🏥",
        "total_models": 1938,
        "seo_title": "Medical 3D Models — 1,900+ Anatomy & Healthcare Assets",
        "meta_desc": "1,900+ medical and anatomy 3D models: human organs, skeletal systems, surgical equipment and medical devices. CheckMate certified for medical education and visualization.",
        "h1": "Medical 3D Models",
        "description": "Professional medical and anatomical 3D models for healthcare education, surgical training, pharmaceutical visualization and medical device presentations. Includes complete skeletal systems, individual organs, dental models, surgical instruments and hospital equipment. Trusted by medical schools, training centers and healthcare companies worldwide.",
        "industries": ["Medical", "Software Development", "Virtual Reality", "Film & Video Production"],
        "tags": ["Anatomy", "Skeleton", "Organs", "Surgical Tools", "Dental", "Hospital Equipment"],
        "related": [("Industrial Equipment", "industrial-equipment"), ("Characters & People", "characters-people"), ("Architecture Landmarks", "architecture-landmarks")],
        "color": "#00E5C4",
        "fallback_gradient": "135deg,#0D2020 0%,#0D2A20 50%,#0A1F1A 100%",
    },
    "Industrial Equipment": {
        "slug": "industrial-equipment",
        "icon": "⚙️",
        "total_models": 1308,
        "seo_title": "Industrial Equipment 3D Models — 1,300+ Machinery Assets",
        "meta_desc": "1,300+ industrial equipment 3D models: machinery, robot arms, HVAC systems, conveyors and oil rigs. CheckMate certified for engineering visualization and simulation.",
        "h1": "Industrial Equipment 3D Models",
        "description": "Technical 3D models of industrial machinery and equipment for manufacturing, oil & gas, construction and automation industries. Includes robot arms, CNC machines, conveyor systems, HVAC equipment, oil rigs and power plant components. Ideal for engineering presentations, technical documentation and industrial simulation.",
        "industries": ["Hardware", "Software Development", "Simulation", "Advertising"],
        "tags": ["Machinery", "Robot Arms", "HVAC", "Oil Rigs", "Conveyors", "Forklifts"],
        "related": [("Vehicles", "vehicles"), ("Architecture Landmarks", "architecture-landmarks"), ("Medical", "medical-3d-models")],
        "color": "#10B981",
        "fallback_gradient": "135deg,#081A10 0%,#0A2015 50%,#061410 100%",
    },
    "Architecture Landmarks": {
        "slug": "architecture-landmarks",
        "icon": "🏛️",
        "total_models": 1165,
        "seo_title": "Architecture & Landmark 3D Models — 1,100+ Buildings",
        "meta_desc": "1,100+ architecture and landmark 3D models: skyscrapers, castles, famous landmarks and building interiors. CheckMate certified for visualization, VR and film production.",
        "h1": "Architecture & Landmark 3D Models",
        "description": "Architectural 3D models spanning famous world landmarks, modern skyscrapers, historic buildings, interior spaces and urban environments. Includes iconic structures, office towers, residential interiors and shopping centers. Used by architects, event designers, VR developers and film productions.",
        "industries": ["Architecture", "Event Management", "Advertising", "Virtual Reality", "Games"],
        "tags": ["Skyscrapers", "Landmarks", "Castles", "Interiors", "Churches", "Modern Buildings"],
        "related": [("Industrial Equipment", "industrial-equipment"), ("Furniture & Interior", "furniture-interior"), ("Nature & Plants", "nature-plants")],
        "color": "#F59E0B",
        "fallback_gradient": "135deg,#1A1008 0%,#201500 50%,#150F05 100%",
    },
    "Characters & People": {
        "slug": "characters-people",
        "icon": "👤",
        "total_models": 887,
        "seo_title": "Character & People 3D Models — 880+ Rigged Humans",
        "meta_desc": "880+ character and people 3D models: rigged humans, game characters, anatomy models and hand models. CheckMate certified for animation, games and VR development.",
        "h1": "Character & People 3D Models",
        "description": "Rigged and non-rigged 3D character models for animation, game development and virtual reality. Includes anatomically accurate human body models, stylized game characters, hand models optimized for first-person views and specialized character types. Rigged characters include full skeleton hierarchies for major 3D software.",
        "industries": ["Film & Video Production", "Games", "Virtual Reality", "Advertising"],
        "tags": ["Rigged Characters", "Human Bodies", "Hands", "Game Characters", "Animation Rigs"],
        "related": [("Medical", "medical-3d-models"), ("Clothing & Accessories", "clothing-accessories"), ("Animals & Creatures", "animals-creatures")],
        "color": "#8B5CF6",
        "fallback_gradient": "135deg,#100A20 0%,#160D28 50%,#0D0818 100%",
    },
    "Animals & Creatures": {
        "slug": "animals-creatures",
        "icon": "🦁",
        "total_models": 4274,
        "seo_title": "Animal & Creature 3D Models — 4,200+ Assets",
        "meta_desc": "4,200+ animal and creature 3D models: mammals, birds, marine life, reptiles, insects and fantasy creatures. CheckMate certified for film, games and VR production.",
        "h1": "Animal & Creature 3D Models",
        "description": "One of the broadest animal 3D model libraries available, covering domestic pets, wild mammals, birds, marine life, reptiles, insects and mythical creatures. From realistic anatomical studies to game-ready low-poly assets and fully rigged animated creatures — there are models for every production need.",
        "industries": ["Film & Video Production", "Games", "Virtual Reality", "Advertising"],
        "tags": ["Mammals", "Birds", "Marine Life", "Reptiles", "Dragons", "Fantasy Creatures"],
        "related": [("Characters & People", "characters-people"), ("Nature & Plants", "nature-plants"), ("Weapons & Tools", "weapons-tools")],
        "color": "#F97316",
        "fallback_gradient": "135deg,#1A0A00 0%,#201500 50%,#150A00 100%",
    },
    "Nature & Plants": {
        "slug": "nature-plants",
        "icon": "🌿",
        "total_models": 1668,
        "seo_title": "Nature & Plant 3D Models — 1,600+ Environment Assets",
        "meta_desc": "1,600+ nature and plant 3D models: trees, flowers, terrain, rocks and natural environments. CheckMate certified for architecture, games and film production.",
        "h1": "Nature & Plant 3D Models",
        "description": "Natural environment 3D models including trees, plants, flowers, rocks, terrain and landscape elements. Used by architects for site visualization, game designers for environment art and film productions for natural settings. Includes both photorealistic high-poly and optimized game-ready variants.",
        "industries": ["Architecture", "Film & Video Production", "Games", "Virtual Reality"],
        "tags": ["Trees", "Flowers", "Rocks", "Terrain", "Plants", "Landscapes"],
        "related": [("Architecture Landmarks", "architecture-landmarks"), ("Animals & Creatures", "animals-creatures"), ("Food & Beverages", "food-beverages")],
        "color": "#34D399",
        "fallback_gradient": "135deg,#081A08 0%,#0C2010 50%,#061508 100%",
    },
    "Furniture & Interior": {
        "slug": "furniture-interior",
        "icon": "🛋️",
        "total_models": 2515,
        "seo_title": "Furniture & Interior 3D Models — 2,500+ Design Assets",
        "meta_desc": "2,500+ furniture and interior 3D models: chairs, sofas, tables, beds, lighting and bathroom fixtures. CheckMate certified for interior design visualization and advertising.",
        "h1": "Furniture & Interior 3D Models",
        "description": "Professional furniture and interior design 3D models for architectural visualization, product design and advertising. Includes seating, tables, storage furniture, beds, lighting fixtures and decorative items. Models are detailed enough for product marketing while remaining optimized for real-time rendering in virtual showrooms.",
        "industries": ["Architecture", "Advertising", "Film & Video Production", "Games"],
        "tags": ["Chairs", "Sofas", "Tables", "Beds", "Lighting", "Bathroom Fixtures"],
        "related": [("Architecture Landmarks", "architecture-landmarks"), ("Electronics & Gadgets", "electronics-gadgets"), ("Food & Beverages", "food-beverages")],
        "color": "#A78BFA",
        "fallback_gradient": "135deg,#120A20 0%,#180F28 50%,#0D0818 100%",
    },
    "Weapons & Tools": {
        "slug": "weapons-tools",
        "icon": "⚔️",
        "total_models": 911,
        "seo_title": "Weapon & Tool 3D Models — 900+ Props & Assets",
        "meta_desc": "900+ weapon and tool 3D models: swords, firearms, medieval weapons, hand tools and props. CheckMate certified for games, film production and historical visualization.",
        "h1": "Weapon & Tool 3D Models",
        "description": "Props and game assets covering historical weapons, modern firearm props, hand tools and construction equipment. Includes melee weapons, ranged props, hand tools for industrial visualization and construction equipment. Suitable for historical visualization, game props and film production.",
        "industries": ["Games", "Film & Video Production", "Military / Defense", "Advertising"],
        "tags": ["Swords", "Firearm Props", "Medieval", "Hand Tools", "Props", "Historical"],
        "related": [("Military Vehicles", "military-vehicles"), ("Industrial Equipment", "industrial-equipment"), ("Characters & People", "characters-people")],
        "color": "#EF4444",
        "fallback_gradient": "135deg,#200808 0%,#280A0A 50%,#180606 100%",
    },
    "Electronics & Gadgets": {
        "slug": "electronics-gadgets",
        "icon": "📱",
        "total_models": 2281,
        "seo_title": "Electronics & Gadget 3D Models — 2,200+ Tech Assets",
        "meta_desc": "2,200+ electronics and gadget 3D models: smartphones, laptops, cameras, headphones and gaming consoles. CheckMate certified for product advertising and visualization.",
        "h1": "Electronics & Gadget 3D Models",
        "description": "Photorealistic consumer electronics and technology product 3D models for advertising, product visualization and digital marketing. Includes current-generation smartphones, laptops, tablets, wearables, gaming hardware and audio equipment. Models include accurate materials for high-quality product renders.",
        "industries": ["Advertising", "Film & Video Production", "Hardware", "Software Development"],
        "tags": ["Smartphones", "Laptops", "Cameras", "Headphones", "Gaming", "Wearables"],
        "related": [("Furniture & Interior", "furniture-interior"), ("Clothing & Accessories", "clothing-accessories"), ("Industrial Equipment", "industrial-equipment")],
        "color": "#60A5FA",
        "fallback_gradient": "135deg,#0A1525 0%,#0D1C30 50%,#081018 100%",
    },
    "Clothing & Accessories": {
        "slug": "clothing-accessories",
        "icon": "👗",
        "total_models": 3146,
        "seo_title": "Clothing & Accessory 3D Models — 3,100+ Fashion Assets",
        "meta_desc": "3,100+ clothing and accessory 3D models: shoes, bags, hats, jewelry and fashion items. CheckMate certified for fashion visualization, games and advertising.",
        "h1": "Clothing & Accessory 3D Models",
        "description": "Fashion and accessories 3D models for product visualization, e-commerce, game character customization and advertising. Includes footwear, bags, headwear, eyewear, jewelry and complete outfit models. Suitable for virtual try-on applications, fashion lookbooks and game asset libraries.",
        "industries": ["Advertising", "Film & Video Production", "Games", "Virtual Reality"],
        "tags": ["Shoes", "Bags", "Hats", "Jewelry", "Jackets", "Sunglasses"],
        "related": [("Characters & People", "characters-people"), ("Electronics & Gadgets", "electronics-gadgets"), ("Food & Beverages", "food-beverages")],
        "color": "#F472B6",
        "fallback_gradient": "135deg,#200A18 0%,#280C20 50%,#180815 100%",
    },
    "Food & Beverages": {
        "slug": "food-beverages",
        "icon": "🍔",
        "total_models": 1911,
        "seo_title": "Food & Beverage 3D Models — 1,900+ Product Assets",
        "meta_desc": "1,900+ food and beverage 3D models: fruits, vegetables, prepared meals, drinks and packaging. CheckMate certified for advertising, 3D printing and product visualization.",
        "h1": "Food & Beverage 3D Models",
        "description": "Detailed food and beverage 3D models for advertising, restaurant menus, packaging visualization and 3D printing. Includes fresh produce, prepared dishes, beverages, confectionery and branded packaging. High-resolution textures and accurate proportions make these ideal for food marketing and digital campaigns.",
        "industries": ["Advertising", "Film & Video Production", "3D Printing", "Games"],
        "tags": ["Fruits", "Vegetables", "Meals", "Drinks", "Desserts", "Packaging"],
        "related": [("Nature & Plants", "nature-plants"), ("Furniture & Interior", "furniture-interior"), ("Animals & Creatures", "animals-creatures")],
        "color": "#FBBF24",
        "fallback_gradient": "135deg,#1A1000 0%,#201500 50%,#150D00 100%",
    },
}


# ── Nav HTML (shared) ───────────────────────────────────────────────────────────

def nav_html():
    return """<header id="site-header">
<nav id="main-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">3D Molier</a>
    <div class="nav-links" id="nav-links">
      <a href="/catalog/" class="nav-link">Top 1000</a>
      <a href="/full-catalog/" class="nav-link">Full 86K Catalog</a>
      <span class="nav-sep" aria-hidden="true"></span>
      <div class="nav-has-dropdown nav-has-mega" id="nav-cat-wrap">
        <button class="nav-link" id="nav-cat-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-categories-menu">Categories <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" id="nav-categories-menu" role="menu">
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
        <button class="nav-link" id="nav-ind-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-industries-menu">Industries <span class="nav-caret" aria-hidden="true">&#9662;</span></button>
        <div class="nav-dropdown nav-mega" id="nav-industries-menu" role="menu">
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
      <a href="/about/" class="nav-link">About</a>
    </div>
    <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" class="nav-cta" target="_blank" rel="noopener">TurboSquid &#8599;</a>
    <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="nav-mobile" id="nav-mobile" aria-hidden="true">
  <a href="/catalog/">Top 1000 Models</a>
  <a href="/full-catalog/">Full 86K Catalog</a>
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
  <a href="/about/">About</a>
  <a href="/contact/">Contact</a>
  <a href="https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio" target="_blank" rel="noopener" class="mobile-cta">TurboSquid Store &#8599;</a>
</div>
</header>"""


# ── Footer HTML (shared) ────────────────────────────────────────────────────────

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
          <a href="/categories/vehicles/" class="nav-link">Vehicles</a>
          <a href="/categories/aircraft/" class="nav-link">Aircraft</a>
          <a href="/categories/military-vehicles/" class="nav-link">Military</a>
          <a href="/categories/medical-3d-models/" class="nav-link">Medical</a>
          <a href="/categories/ships/" class="nav-link">Ships</a>
        </div>
      </div>
      <div>
        <div class="cat-footer-col-hd">Collections</div>
        <div class="cat-footer-links">
          <a href="/collections/best-vehicle-3d-models/" class="nav-link">Best Vehicles</a>
          <a href="/collections/best-aircraft-3d-models/" class="nav-link">Best Aircraft</a>
          <a href="/collections/best-medical-3d-models/" class="nav-link">Best Medical</a>
          <a href="/collections/best-military-vehicle-3d-models/" class="nav-link">Best Military</a>
          <a href="/collections/" class="nav-link">View all →</a>
        </div>
      </div>
      <div>
        <div class="cat-footer-col-hd">TurboSquid</div>
        <div class="cat-footer-links">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Artist Store</a>
          <a href="https://www.turbosquid.com/Search/vehicle?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Vehicle Models</a>
          <a href="https://www.turbosquid.com/Search/aircraft?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Aircraft Models</a>
          <a href="https://www.turbosquid.com/Search/medical?referral=3d_molier-studio" target="_blank" rel="noopener" class="nav-link">Medical Models</a>
        </div>
      </div>
    </div>
    <div class="cat-footer-bottom">
      <p class="cat-footer-copy">© 2025 3D Molier. All 3D models sold via TurboSquid.</p>
      <a href="/" class="nav-link">← Back to home</a>
    </div>
  </div>
</footer>"""


# ── Single model card HTML ──────────────────────────────────────────────────────

LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


from urllib.parse import quote as _url_quote
_PLACEHOLDER = "/assets/og/3d-molier-og.jpg"

def model_card_html(m, color, gradient):
    title = m['product_name']
    price = m['price']
    slug  = m.get('slug', '')
    try:
        price_str = f"${float(price):.0f}"
    except (ValueError, TypeError):
        price_str = f"${price}"
    cert = m.get('certification', '')
    cat  = m.get('category', '')
    orig_img = m.get('image_url', '')
    url  = m.get('referral_url', '#')
    is_cm = 'CheckMate' in cert

    if orig_img and orig_img.startswith("https://static.turbosquid"):
        _clean = orig_img.replace("https://", "")
        img = "https://images.weserv.nl/?url=ssl:" + _url_quote(_clean) + "&amp;w=600&amp;q=85&amp;output=webp"
    else:
        img = orig_img

    cert_html = '<span class="cert-badge">&#10003; CM</span>' if is_cm else \
                '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>' \
                if 'Stem' in cert else ''

    if orig_img:
        img_html = (f'<img src="{img}" data-fallback="{orig_img}" data-placeholder="{_PLACEHOLDER}"'
                    f' alt="{title} 3D model preview" width="800" height="450" decoding="async" loading="lazy"'
                    f' onerror="handleImageError(this)">'
                    f'<div class="img-placeholder"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">{cat}</span></div>')
    else:
        img_html = f'<div class="img-placeholder" style="display:flex;"><span class="mc-ph-icon">&#128247;</span><span class="mc-ph-label">{cat}</span></div>'

    internal_link = f"/models/{slug}/" if slug else url

    return f'''<a href="{internal_link}" class="model-card card-glow">
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
        </div>
      </a>'''


# ── Full page HTML ──────────────────────────────────────────────────────────────

def page_html(cat_name, meta, models):
    slug     = meta['slug']
    icon     = meta['icon']
    total    = meta['total_models']
    color    = meta['color']
    gradient = meta['fallback_gradient']
    tags     = meta['tags']
    industries = meta['industries']
    related  = meta['related']
    top_n    = len(models)

    # First 24 models rendered in HTML for SEO
    INITIAL = 24
    initial_models = models[:INITIAL]
    extra_models   = models[INITIAL:]

    initial_cards = '\n      '.join(model_card_html(m, color, gradient) for m in initial_models)

    # Extra models as JSON embedded in script for "Load More"
    extra_json = '[]'
    if extra_models:
        extra_list = []
        for m in extra_models:
            try:
                price_f = float(m['price'])
                price_str = f"${price_f:.0f}"
            except (ValueError, TypeError):
                price_str = f"${m['price']}"
            is_cm = 'CheckMate' in m.get('certification', '')
            extra_list.append({
                'title': m['product_name'],
                'price': price_str,
                'cert':  'CM' if is_cm else ('SC' if 'Stem' in m.get('certification','') else ''),
                'cat':   m.get('category', ''),
                'img':   m.get('image_url', ''),
                'url':   m.get('referral_url', '#'),
            })
        extra_json = json.dumps(extra_list, ensure_ascii=False)

    # Save extra models as external JSON (avoids large inline script)
    cat_data_dir = BASE_DIR / 'data' / 'categories'
    cat_data_dir.mkdir(parents=True, exist_ok=True)
    (cat_data_dir / f'{slug}.json').write_text(extra_json, encoding='utf-8')

    load_more_btn = ''
    body_data_attrs = ''
    if extra_models:
        load_more_btn = f'''<div id="load-more-wrap" class="mc-load-more">
        <button id="load-more-btn" class="btn-ghost btn-ghost--md" onclick="loadMore()">
          Load more models ({len(extra_models)} remaining)
        </button>
      </div>'''
        body_data_attrs = f' data-extra-models-url="/data/categories/{slug}.json" data-color="{color}"'

    # Related category cards
    related_cards = ''
    for rel_name, rel_slug in related:
        rel_meta = CATEGORIES.get(rel_name, {})
        rel_icon  = rel_meta.get('icon', '📦')
        rel_total = rel_meta.get('total_models', 0)
        related_cards += f'''<a href="/categories/{rel_slug}/" class="related-card">
          <span class="mc-ph-icon">{rel_icon}</span>
          <div>
            <div class="cat-rel-name">{rel_name}</div>
            <div class="cat-rel-count">{rel_total:,} models</div>
          </div>
          <span class="cat-rel-arrow">→</span>
        </a>\n'''

    # Tags
    tag_chips = ' '.join(
        f'<span class="chip">{t}</span>' for t in tags
    )

    # Industries
    industry_chips = ' '.join(
        f'<a href="{industry_href(ind)}" class="chip">{ind}</a>'
        for ind in industries
    )

    no_models_note = ''
    if top_n == 0:
        no_models_note = '''<div class="cat-desc" style="text-align:center;padding:60px 24px;">
        <p>No top-ranked models in this category yet.</p>
        <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-ts" style="margin-top:16px;display:inline-flex;">Browse all models on TurboSquid</a>
      </div>'''

    canonical = f"https://3dmolierstudio.com/categories/{slug}/"
    base = "https://3dmolierstudio.com"
    breadcrumb_ld = f'''{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"Home","item":"https://3dmolierstudio.com/"}},{{"@type":"ListItem","position":2,"name":"Categories","item":"https://3dmolierstudio.com/catalog/"}},{{"@type":"ListItem","position":3,"name":"{meta["h1"]}","item":"{canonical}"}}]}}'''
    item_list_elements = [
        {"@type": "ListItem", "position": i + 1, "name": m['product_name'], "url": f"{base}/models/{m.get('slug', '')}/"}
        for i, m in enumerate(models[:50]) if m.get('slug')
    ]
    item_list_ld = json.dumps({
        "@context": "https://schema.org", "@type": "ItemList",
        "name": meta["h1"], "url": canonical,
        "numberOfItems": len(item_list_elements),
        "itemListElement": item_list_elements,
    }, ensure_ascii=False)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{meta["seo_title"]} | 3D Molier</title>
<meta name="description" content="{meta["meta_desc"]}">
<meta property="og:type" content="website">
<meta property="og:title" content="{meta["seo_title"]} | 3D Molier">
<meta property="og:description" content="{meta["meta_desc"]}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="3D Molier Models">
<meta property="og:image" content="https://3dmolierstudio.com/assets/og/3d-molier-og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{meta["seo_title"]} | 3D Molier">
<meta name="twitter:description" content="{meta["meta_desc"]}">
<meta name="twitter:image" content="https://3dmolierstudio.com/assets/og/3d-molier-og.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{canonical}">
<link rel="alternate" hreflang="x-default" href="{canonical}">
<script type="application/ld+json">{breadcrumb_ld}</script>
<script type="application/ld+json">{item_list_ld}</script>
<link rel="preload" href="/assets/fonts/font-13.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/critical-fonts.css?v=32">
<link rel="stylesheet" href="/assets/css/fonts.css?v=32">
<link rel="stylesheet" href="/assets/css/styles.min.css?v=32">
</head>
<body class="relative min-h-screen"{body_data_attrs}>

{nav_html()}

<main class="cat-main">

<!-- Breadcrumb -->
<div class="cat-bc">
  <div class="max-w-7xl mx-auto px-6 py-3 cat-bc-inner">
    <a href="/" class="bc-link">Home</a>
    <span class="bc-sep">›</span>
    <a href="/catalog/" class="bc-link">Categories</a>
    <span class="bc-sep">›</span>
    <span class="bc-current">{cat_name}</span>
  </div>
</div>

<!-- Category Hero -->
<section class="page-section page-section--border-bottom">
  <div class="max-w-7xl mx-auto">
    <div class="cat-hero">

      <div class="cat-hero-left">
        <div class="cat-hero-top">
          <div class="cat-hero-icon">{icon}</div>
          <div>
            <div class="section-label">3D Model Category</div>
            <h1 class="cat-page-h1">{meta["h1"]}</h1>
          </div>
        </div>
        <p class="cat-desc">{meta["description"]}</p>
        <div class="cat-tags">{tag_chips}</div>
        <div class="cat-actions">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Browse on TurboSquid
          </a>
          <a href="/" class="btn-ghost">← All Categories</a>
        </div>
      </div>

      <!-- Stats panel -->
      <div class="cat-stats">
        <div class="cat-stat-cell">
          <div class="cat-stat-num">{total:,}</div>
          <div class="cat-stat-label">Total Models</div>
        </div>
        <div class="cat-stat-cell">
          <div class="cat-stat-num">{top_n}</div>
          <div class="cat-stat-label">Top Ranked</div>
        </div>
        <div class="cat-stat-cell cat-stat-cell--wide">
          <div class="cat-ind-label">Used in Industries</div>
          <div class="cat-ind-chips">{industry_chips}</div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- Model Grid -->
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="section-header">
      <div>
        <div class="section-label">Top Ranked</div>
        <h2 class="section-h2">Best {cat_name} 3D Models</h2>
      </div>
      <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-ghost btn-ghost--md">
        View all on TurboSquid
      </a>
    </div>

    {no_models_note}

    <div id="model-grid" class="model-grid">
      {initial_cards}
    </div>

    {load_more_btn}
  </div>
</section>

<!-- Related Categories -->
<section class="page-section">
  <div class="max-w-7xl mx-auto">
    <div class="cat-rel-wrap">
      <div class="section-label">Explore More</div>
      <h2 class="section-h2 section-h2--mb24">Related Categories</h2>
      <div class="rel-grid">
        {related_cards}
      </div>
    </div>
  </div>
</section>

</main>

{footer_html()}
<script src="/assets/js/site.min.js?v=32" defer></script>
<script src="/assets/js/category-pages.min.js?v=32" defer></script>
</body>
</html>'''


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    # Read top models grouped by category
    models_by_cat: dict[str, list[dict]] = {}
    csv_path = BASE_DIR / 'data' / 'top_models.csv'
    with open(csv_path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            cat = row['category']
            models_by_cat.setdefault(cat, []).append(row)

    # Sort each category's models by priority_score desc
    for cat_models in models_by_cat.values():
        cat_models.sort(key=lambda r: float(r.get('priority_score', 0) or 0), reverse=True)

    generated = 0
    for cat_name, meta in CATEGORIES.items():
        slug    = meta['slug']
        models  = models_by_cat.get(cat_name, [])
        out_dir = BASE_DIR / 'categories' / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        html = page_html(cat_name, meta, models)
        (out_dir / 'index.html').write_text(html, encoding='utf-8')
        print(f"  {slug:<35} {len(models):>3} top models  ->  categories/{slug}/index.html")
        generated += 1

    print(f"\nDone: {generated} category pages generated in categories/\n")


if __name__ == '__main__':
    main()
