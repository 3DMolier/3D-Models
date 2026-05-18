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


# ── Shared CSS (same design system as homepage) ────────────────────────────────

SHARED_CSS = """
  * { box-sizing: border-box; }
  body { background: #07090F; font-family: 'Inter', sans-serif; color: #EDF2FF; }

  body::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
    opacity: 0.4;
  }

  html { scroll-behavior: smooth; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #07090F; }
  ::-webkit-scrollbar-thumb { background: #1E2B44; border-radius: 3px; }

  .nav-link {
    color: #7A8DB0; font-size: 14px; font-weight: 500; text-decoration: none;
    padding: 6px 2px; position: relative;
    transition: color 0.2s;
  }
  .nav-link::after {
    content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 1px;
    background: #00E5C4;
    transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
  }
  .nav-link:hover { color: #EDF2FF; }
  .nav-link:hover::after { width: 100%; }
  .nav-link:focus-visible { outline: none; color: #00E5C4; }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    background: #00E5C4; color: #07090F;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
    padding: 11px 24px; border-radius: 8px;
    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    border: none; cursor: pointer; text-decoration: none;
    box-shadow: 0 2px 12px rgba(0,229,196,0.3);
  }
  .btn-primary:hover  { background: #00CCB0; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,229,196,0.4); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.4); }

  .btn-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: #EDF2FF;
    font-family: 'Inter', sans-serif; font-weight: 500; font-size: 14px;
    padding: 10px 24px; border-radius: 8px;
    border: 1px solid #1E2B44; cursor: pointer; text-decoration: none;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .btn-ghost:hover  { border-color: rgba(0,229,196,0.4); background: rgba(0,229,196,0.05); transform: translateY(-1px); }
  .btn-ghost:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.25); }

  .btn-ts {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,229,196,0.1); color: #00E5C4;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px;
    padding: 9px 18px; border-radius: 7px;
    border: 1px solid rgba(0,229,196,0.25); cursor: pointer; text-decoration: none;
    transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
    white-space: nowrap;
  }
  .btn-ts:hover  { background: rgba(0,229,196,0.18); border-color: rgba(0,229,196,0.5); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,229,196,0.15); }
  .btn-ts:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(0,229,196,0.3); }

  .chip {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(255,255,255,0.04); border: 1px solid #1E2B44;
    color: #7A8DB0; font-size: 12px; font-weight: 500;
    padding: 5px 12px; border-radius: 100px; cursor: default;
    white-space: nowrap;
  }

  .section-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: #00E5C4;
  }

  .cert-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(255,198,0,0.1); border: 1px solid rgba(255,198,0,0.25);
    color: #FFC600; font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
    padding: 2px 7px; border-radius: 4px; text-transform: uppercase;
    white-space: nowrap; flex-shrink: 0;
  }

  .model-card {
    background: #0E1220; border: 1px solid #1E2B44; border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(0.4,0,0.2,1);
  }
  .model-card:hover {
    border-color: rgba(0,229,196,0.3);
    box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,229,196,0.08);
    transform: translateY(-2px);
  }
  .model-card:focus-within { box-shadow: 0 0 0 2px rgba(0,229,196,0.4); }

  .card-glow { position: relative; }
  .card-glow::before {
    content: '';
    position: absolute; inset: -1px; border-radius: inherit;
    background: linear-gradient(135deg, rgba(0,229,196,0.15) 0%, transparent 50%, rgba(79,107,255,0.08) 100%);
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1);
    z-index: -1;
  }
  .card-glow:hover::before { opacity: 1; }

  .img-wrap { position: relative; overflow: hidden; }
  .img-wrap::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(7,9,15,0.8) 0%, transparent 55%);
  }
  .img-wrap img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.5s cubic-bezier(0.4,0,0.2,1);
    filter: saturate(0.9) brightness(0.95);
  }
  .model-card:hover .img-wrap img { transform: scale(1.05); filter: saturate(1.1) brightness(1); }
  .img-placeholder {
    width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; font-family: 'Inter', sans-serif;
  }
  .img-placeholder span { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; opacity: 0.7; }

  .related-card {
    background: #0E1220; border: 1px solid #1E2B44; border-radius: 12px; padding: 20px;
    text-decoration: none; display: flex; align-items: center; gap: 14px;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .related-card:hover {
    border-color: rgba(0,229,196,0.35); transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .related-card:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(0,229,196,0.5); }
"""


# ── Nav HTML (shared) ───────────────────────────────────────────────────────────

def nav_html():
    return """<header class="sticky top-0 z-50 border-b border-[#1E2B44]" style="background:rgba(7,9,15,0.85);backdrop-filter:blur(16px);">
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


# ── Footer HTML (shared) ────────────────────────────────────────────────────────

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
          <a href="/collections/" class="nav-link" style="font-size:13px;">View all →</a>
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
      <p style="font-size:12px;color:#4A5C7A;">© 2025 3D Molier. All 3D models sold via TurboSquid.</p>
      <a href="/" class="nav-link" style="font-size:12px;">← Back to home</a>
    </div>
  </div>
</footer>"""


# ── Single model card HTML ──────────────────────────────────────────────────────

LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'


PROXY_BASE = "https://images.weserv.nl/?url="

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
    img  = m.get('image_url', '')
    url  = m.get('referral_url', '#')
    is_cm = 'CheckMate' in cert

    # Proxy TurboSquid images through weserv.nl
    if img and img.startswith("https://static.turbosquid"):
        img = PROXY_BASE + img.replace("https://", "") + "&w=600&q=85&output=webp"

    cert_html = '<span class="cert-badge">&#10003; CM</span>' if is_cm else \
                '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>' \
                if 'Stem' in cert else ''

    img_html = ''
    if img:
        img_html = f'''<img src="{img}" alt="{title} 3D model preview" loading="lazy"
            onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">
          <div class="img-placeholder" style="color:{color};display:none;">
            <span style="font-size:28px;opacity:0.5;">&#128247;</span>
            <span style="color:{color};">{cat}</span>
          </div>'''
    else:
        img_html = f'''<div class="img-placeholder" style="color:{color};">
            <span style="font-size:28px;opacity:0.5;">&#128247;</span>
            <span style="color:{color};">{cat}</span>
          </div>'''

    internal_link = f"/3D-Models/models/{slug}/" if slug else url

    return f'''<a href="{internal_link}" class="model-card card-glow" style="text-decoration:none;display:block;">
        <div class="img-wrap" style="height:180px;background:linear-gradient({gradient});">
          {img_html}
        </div>
        <div style="padding:16px;">
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:10px;">
            <h3 style="font-family:\'Playfair Display\',serif;font-size:14px;font-weight:700;color:#EDF2FF;line-height:1.3;letter-spacing:-0.01em;">{title}</h3>
            {cert_html}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="chip" style="font-size:11px;padding:3px 8px;color:{color};border-color:{color}44;">{cat}</span>
            <span style="font-size:13px;font-weight:700;color:#EDF2FF;margin-left:auto;">{price_str}</span>
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

    load_more_btn = ''
    load_more_script = ''
    if extra_models:
        load_more_btn = f'''<div id="load-more-wrap" style="text-align:center;margin-top:40px;">
        <button id="load-more-btn" class="btn-ghost" style="font-size:14px;padding:12px 32px;" onclick="loadMore()">
          Load more models ({len(extra_models)} remaining)
        </button>
      </div>'''
        load_more_script = f'''<script>
const EXTRA_MODELS = {extra_json};
const COLOR = "{color}";
const GRADIENT = "{gradient}";
let loaded = false;

function loadMore() {{
  if (loaded) return;
  loaded = true;
  const grid = document.getElementById('model-grid');
  const btn = document.getElementById('load-more-wrap');
  const LINK_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  for (const m of EXTRA_MODELS) {{
    const certHtml = m.cert === 'CM'
      ? '<span class="cert-badge">&#10003; CM</span>'
      : m.cert === 'SC'
        ? '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>'
        : '';
    const imgHtml = m.img
      ? `<img src="${{m.img}}" alt="${{m.title}}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
         <div class="img-placeholder" style="color:${{COLOR}};display:none;"><span style="font-size:28px;opacity:0.5;">&#128247;</span><span style="color:${{COLOR}};">${{m.cat}}</span></div>`
      : `<div class="img-placeholder" style="color:${{COLOR}};"><span style="font-size:28px;opacity:0.5;">&#128247;</span><span style="color:${{COLOR}};">${{m.cat}}</span></div>`;
    const card = document.createElement('div');
    card.className = 'model-card card-glow';
    card.innerHTML = `
      <div class="img-wrap" style="height:180px;background:linear-gradient(${{GRADIENT}});">${{imgHtml}}</div>
      <div style="padding:16px;">
        <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <h3 style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#EDF2FF;line-height:1.3;letter-spacing:-0.01em;">${{m.title}}</h3>
          ${{certHtml}}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span class="chip" style="font-size:11px;padding:3px 8px;color:#00E5C4;border-color:rgba(0,229,196,0.25);">${{m.cat}}</span>
          <span style="font-size:13px;font-weight:600;color:#EDF2FF;margin-left:auto;">${{m.price}}</span>
        </div>
        <a href="${{m.url}}" target="_blank" rel="noopener" class="btn-ts" style="width:100%;justify-content:center;">
          ${{LINK_ICON}} View on TurboSquid
        </a>
      </div>`;
    grid.appendChild(card);
  }}
  btn.remove();
}}
</script>'''

    # Related category cards
    related_cards = ''
    for rel_name, rel_slug in related:
        rel_meta = CATEGORIES.get(rel_name, {})
        rel_icon  = rel_meta.get('icon', '📦')
        rel_total = rel_meta.get('total_models', 0)
        related_cards += f'''<a href="/categories/{rel_slug}/" class="related-card">
          <span style="font-size:28px;">{rel_icon}</span>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;color:#EDF2FF;">{rel_name}</div>
            <div style="font-size:12px;color:#7A8DB0;margin-top:2px;">{rel_total:,} models</div>
          </div>
          <span style="margin-left:auto;color:#00E5C4;font-size:18px;">→</span>
        </a>\n'''

    # Tags
    tag_chips = ' '.join(
        f'<span class="chip">{t}</span>' for t in tags
    )

    # Industries
    industry_chips = ' '.join(
        f'<a href="/industries/{ind.lower().replace(" ","").replace("/","-").replace("&","")}/" class="chip" style="color:#EDF2FF;text-decoration:none;">{ind}</a>'
        for ind in industries
    )

    no_models_note = ''
    if top_n == 0:
        no_models_note = '''<div style="text-align:center;padding:60px 24px;color:#7A8DB0;">
        <p style="font-size:16px;">No top-ranked models in this category yet.</p>
        <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-ts" style="margin-top:16px;display:inline-flex;">Browse all models on TurboSquid</a>
      </div>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{meta["seo_title"]} | 3D Molier</title>
<meta name="description" content="{meta["meta_desc"]}">
<link rel="canonical" href="https://3dmolier.com/categories/{slug}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {{
  theme: {{
    extend: {{
      colors: {{
        base:'#07090F', surface:'#0E1220', raised:'#151A2E',
        border:'#1E2B44', teal:'#00E5C4',
      }},
      fontFamily: {{ display:['Syne','sans-serif'], body:['Inter','sans-serif'] }},
    }}
  }}
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
    <a href="/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Home</a>
    <span style="color:#1E2B44;">›</span>
    <a href="/catalog/" style="color:#7A8DB0;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='#EDF2FF'" onmouseout="this.style.color='#7A8DB0'">Categories</a>
    <span style="color:#1E2B44;">›</span>
    <span style="color:#EDF2FF;">{cat_name}</span>
  </div>
</div>

<!-- Category Hero -->
<section style="padding:56px 24px 40px;border-bottom:1px solid #1E2B44;">
  <div class="max-w-7xl mx-auto">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:32px;flex-wrap:wrap;">

      <div style="flex:1;min-width:280px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div style="width:56px;height:56px;border-radius:14px;background:rgba(0,229,196,0.08);border:1px solid rgba(0,229,196,0.2);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">
            {icon}
          </div>
          <div>
            <div class="section-label" style="margin-bottom:4px;">3D Model Category</div>
            <h1 style="font-family:'Syne',sans-serif;font-size:clamp(24px,3.5vw,38px);font-weight:800;letter-spacing:-0.035em;color:#EDF2FF;line-height:1.1;">
              {meta["h1"]}
            </h1>
          </div>
        </div>

        <p style="font-size:15px;color:#7A8DB0;line-height:1.75;max-width:640px;margin-bottom:24px;">
          {meta["description"]}
        </p>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">
          {tag_chips}
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Browse on TurboSquid
          </a>
          <a href="/" class="btn-ghost">← All Categories</a>
        </div>
      </div>

      <!-- Stats panel -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#1E2B44;border:1px solid #1E2B44;border-radius:16px;overflow:hidden;min-width:260px;">
        <div style="background:#0E1220;padding:24px 20px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#EDF2FF;letter-spacing:-0.04em;line-height:1;">{total:,}</div>
          <div style="font-size:12px;color:#7A8DB0;margin-top:4px;font-weight:500;">Total Models</div>
        </div>
        <div style="background:#0E1220;padding:24px 20px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#EDF2FF;letter-spacing:-0.04em;line-height:1;">{top_n}</div>
          <div style="font-size:12px;color:#7A8DB0;margin-top:4px;font-weight:500;">Top Ranked</div>
        </div>
        <div style="background:#0E1220;padding:24px 20px;grid-column:1/-1;border-top:1px solid #1E2B44;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#4A5C7A;text-transform:uppercase;margin-bottom:12px;">Used in Industries</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">{industry_chips}</div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- Model Grid -->
<section style="padding:56px 24px;">
  <div class="max-w-7xl mx-auto">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px;">
      <div>
        <div class="section-label" style="margin-bottom:6px;">Top Ranked</div>
        <h2 style="font-family:'Syne',sans-serif;font-size:clamp(18px,2.5vw,26px);font-weight:700;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.1;">
          Best {cat_name} 3D Models
        </h2>
      </div>
      <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener" class="btn-ghost" style="font-size:13px;padding:9px 18px;">
        View all on TurboSquid
      </a>
    </div>

    {no_models_note}

    <div id="model-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;">
      {initial_cards}
    </div>

    {load_more_btn}
  </div>
</section>

<!-- Related Categories -->
<section style="padding:0 24px 72px;">
  <div class="max-w-7xl mx-auto">
    <div style="border-top:1px solid #1E2B44;padding-top:48px;">
      <div class="section-label" style="margin-bottom:8px;">Explore More</div>
      <h2 style="font-family:'Syne',sans-serif;font-size:clamp(18px,2.5vw,26px);font-weight:700;letter-spacing:-0.03em;color:#EDF2FF;line-height:1.1;margin-bottom:24px;">
        Related Categories
      </h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
        {related_cards}
      </div>
    </div>
  </div>
</section>

</main>

{footer_html()}
{load_more_script}
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
