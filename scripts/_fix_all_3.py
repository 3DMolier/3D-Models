"""
Fix script 3 — applies three changes across model/category pages:
1. Use Cases chips link to industry pages instead of search
2. Search Keywords phrases split into individual word chips
3. Category .cat-tags chips use singular search query
Run from repo root: python scripts/_fix_all_3.py
"""
import os, re, glob, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEARCH_BASE = "/search/?q="
IND_BASE    = "/industries/"

# ── 1. Use Cases → Industry page URLs ────────────────────────────────────────
# Exact match first (longer phrases take priority), then keyword fallback.
USE_CASE_INDUSTRY = {
    "film production":                   "film-video-production",
    "character animation":               "film-video-production",
    "vfx":                               "film-video-production",
    "game environments":                 "game-development",
    "game environment":                  "game-development",
    "game assets":                       "game-development",
    "game asset":                        "game-development",
    "game development":                  "game-development",
    "game engine":                       "game-development",
    "advertising":                       "advertising",
    "product advertising":               "advertising",
    "product visualization":             "advertising",
    "fashion visualization":             "advertising",
    "e-commerce":                        "advertising",
    "vr experiences":                    "virtual-reality",
    "vr avatars":                        "virtual-reality",
    "vr avatar":                         "virtual-reality",
    "virtual reality":                   "virtual-reality",
    "aerospace visualization":           "aerospace",
    "flight simulation":                 "aerospace",
    "3d printing":                       "3d-printing",
    "event visualization":               "event-management",
    "event management":                  "event-management",
    "medical education":                 "medical",
    "healthcare presentation":           "medical",
    "healthcare":                        "medical",
    "medical visualization":             "medical",
    "training simulation":               "military-defense",
    "military simulation":               "military-defense",
    "defense training":                  "military-defense",
    "military training":                 "military-defense",
    "architecture visualization":        "architecture",
    "architecture presentation":         "architecture",
    "architectural visualization":       "architecture",
    "interior design visualization":     "architecture",
    "interior design":                   "architecture",
    "hardware presentation":             "hardware",
    "software interface visualization":  "software-development",
    "software visualization":            "software-development",
    "software interface":                "software-development",
}

def use_case_url(text):
    """Return industry URL for a use-case text, or search URL as fallback."""
    lower = text.lower().strip()
    # Exact or substring match (longest first)
    for key in sorted(USE_CASE_INDUSTRY, key=len, reverse=True):
        if lower == key or lower.startswith(key) or key in lower:
            return IND_BASE + USE_CASE_INDUSTRY[key] + "/"
    return SEARCH_BASE + urllib.parse.quote_plus(text)

def fix_use_case_links(content):
    """Replace search links in Use Cases section with industry page links."""
    def repl(m):
        prefix, chips, suffix = m.group(1), m.group(2), m.group(3)
        def replace_chip(cm):
            text = cm.group(1)
            url  = use_case_url(text)
            return f'<a href="{url}" class="chip chip--sm">{text}</a>'
        chips = re.sub(
            r'<a href="[^"]*" class="chip chip--sm">(.*?)</a>',
            replace_chip, chips
        )
        return prefix + chips + suffix
    return re.sub(
        r'(Use Cases</div><div class="mp-chip-row-8">)(.*?)(</div></div>)',
        repl, content, flags=re.DOTALL
    )

# ── 2. Search Keywords → split into individual word chips ─────────────────────
STOP_WORDS = {"3d", "model", "models", "and", "the", "for", "with", "in", "of", "a"}

def split_keyword_chips(content):
    """Replace multi-word keyword chips with per-word chips (skip pure digits)."""
    def repl(m):
        prefix, chips_html, suffix = m.group(1), m.group(2), m.group(3)
        # Extract all chip texts
        phrases = re.findall(r'<a href="[^"]*" class="chip chip--kw">(.*?)</a>', chips_html)
        new_chips = []
        seen = set()
        for phrase in phrases:
            words = phrase.split()
            for w in words:
                # Skip pure integers; keep alphanumeric tokens incl "3d"
                if re.match(r'^\d+$', w):
                    continue
                w_lower = w.lower()
                if w_lower in seen:
                    continue
                seen.add(w_lower)
                q = urllib.parse.quote_plus(w)
                new_chips.append(
                    f'<a href="{SEARCH_BASE}{q}" class="chip chip--kw">{w}</a>'
                )
        return prefix + ' '.join(new_chips) + suffix
    return re.sub(
        r'(Search Keywords</div><div class="mp-chip-row">)(.*?)(</div></div>)',
        repl, content, flags=re.DOTALL
    )

# ── 3. Category .cat-tags chips → singular search query ───────────────────────
# Maps chip display text → singular search keyword
SINGULAR = {
    "Cars": "Car",
    "Trucks": "Truck",
    "Motorcycles": "Motorcycle",
    "Buses": "Bus",
    "SUVs": "SUV",
    "Construction Vehicles": "Construction Vehicle",
    "Airliners": "Airliner",
    "Helicopters": "Helicopter",
    "Drones": "Drone",
    "Military Jets": "Military Jet",
    "Private Jets": "Private Jet",
    "Cargo Planes": "Cargo Plane",
    "Tanks": "Tank",
    "APCs": "APC",
    "Fighter Jets": "Fighter Jet",
    "Warships": "Warship",
    "Artillery": "Artillery",
    "Combat Drones": "Combat Drone",
    "Cruise Ships": "Cruise Ship",
    "Cargo Ships": "Cargo Ship",
    "Yachts": "Yacht",
    "Sailboats": "Sailboat",
    "Historical Vessels": "Historical Vessel",
    "Organs": "Organ",
    "Surgical Tools": "Surgical Tool",
    "Robot Arms": "Robot Arm",
    "Oil Rigs": "Oil Rig",
    "Conveyors": "Conveyor",
    "Forklifts": "Forklift",
    "Skyscrapers": "Skyscraper",
    "Landmarks": "Landmark",
    "Castles": "Castle",
    "Interiors": "Interior",
    "Churches": "Church",
    "Modern Buildings": "Modern Building",
    "Rigged Characters": "Rigged Character",
    "Human Bodies": "Human Body",
    "Hands": "Hand",
    "Game Characters": "Game Character",
    "Animation Rigs": "Animation Rig",
    "Mammals": "Mammal",
    "Birds": "Bird",
    "Reptiles": "Reptile",
    "Dragons": "Dragon",
    "Fantasy Creatures": "Fantasy Creature",
    "Trees": "Tree",
    "Flowers": "Flower",
    "Rocks": "Rock",
    "Plants": "Plant",
    "Landscapes": "Landscape",
    "Chairs": "Chair",
    "Sofas": "Sofa",
    "Tables": "Table",
    "Beds": "Bed",
    "Bathroom Fixtures": "Bathroom Fixture",
    "Swords": "Sword",
    "Firearm Props": "Firearm Prop",
    "Hand Tools": "Hand Tool",
    "Props": "Prop",
    "Smartphones": "Smartphone",
    "Laptops": "Laptop",
    "Cameras": "Camera",
    "Headphones": "Headphone",
    "Wearables": "Wearable",
    "Shoes": "Shoe",
    "Bags": "Bag",
    "Hats": "Hat",
    "Jackets": "Jacket",
    "Fruits": "Fruit",
    "Vegetables": "Vegetable",
    "Meals": "Meal",
    "Drinks": "Drink",
    "Desserts": "Dessert",
}

def fix_cat_tags_singular(content):
    """Make .cat-tags chip search queries use the singular form of the word."""
    def repl(m):
        prefix, inner, suffix = m.group(1), m.group(2), m.group(3)
        def replace_chip(cm):
            text = cm.group(1)
            singular = SINGULAR.get(text, text)
            q = urllib.parse.quote_plus(singular)
            return f'<a href="{SEARCH_BASE}{q}" class="chip">{text}</a>'
        inner = re.sub(
            r'<a href="[^"]*" class="chip">(.*?)</a>',
            replace_chip, inner
        )
        return prefix + inner + suffix
    return re.sub(
        r'(<div class="cat-tags">)(.*?)(</div>)',
        repl, content, flags=re.DOTALL
    )

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    model_changed = cat_changed = 0

    # Model pages
    model_dir = os.path.join(ROOT, 'models')
    for slug in os.listdir(model_dir):
        path = os.path.join(model_dir, slug, 'index.html')
        if not os.path.exists(path): continue
        with open(path, encoding='utf-8') as f: content = f.read()
        original = content
        content = fix_use_case_links(content)
        content = split_keyword_chips(content)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f: f.write(content)
            model_changed += 1

    # Category pages
    cat_dir = os.path.join(ROOT, 'categories')
    for cat in os.listdir(cat_dir):
        path = os.path.join(cat_dir, cat, 'index.html')
        if not os.path.exists(path): continue
        with open(path, encoding='utf-8') as f: content = f.read()
        original = content
        content = fix_cat_tags_singular(content)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f: f.write(content)
            cat_changed += 1

    print(f"Model pages changed: {model_changed}")
    print(f"Category pages changed: {cat_changed}")

if __name__ == '__main__':
    main()
