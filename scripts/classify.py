"""
Classifies 3D model titles into categories, industries, use cases and SEO keywords.
Rules are data-only — no ML, no API calls. Edit keyword lists to tune results.

Category priority order (most specific first):
  1. Military Vehicles   — wins over Aircraft, Vehicles, Ships
  2. Aircraft
  3. Ships
  4. Medical
  5. Industrial Equipment
  6. Vehicles            — BEFORE Architecture so "Truck Interior" → Vehicles
  7. Architecture Landmarks
  8. Characters & People
  9. Animals & Creatures
 10. Nature & Plants
 11. Furniture & Interior
 12. Weapons & Tools     — non-military melee / historical / props
 13. Electronics & Gadgets
 14. Clothing & Accessories
 15. Food & Beverages
"""

import re
from typing import TypedDict


class Classification(TypedDict):
    category: str
    subcategory: str
    industries: list[str]
    use_cases: list[str]
    seo_keywords: list[str]


def _match(title_lower: str, keywords: list[str]) -> str | None:
    """Return first matching keyword phrase, or None."""
    for kw in keywords:
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(kw.lower()) + r"(?![a-zA-Z0-9])"
        if re.search(pattern, title_lower):
            return kw
    return None


# ── Category rules ─────────────────────────────────────────────────────────────

_CATEGORY_RULES: list[tuple[str, list[str]]] = [

    # 1 ── Military Vehicles (beats Aircraft, Ships, Vehicles)
    ("Military Vehicles", [
        "tank", "humvee", "hmmwv", "patriot missile", "howitzer", "artillery",
        "bradley", "abrams", "leopard 2", "panzer", "stryker",
        "btr", "bmp", "ifv", "self-propelled gun",
        "military truck", "army truck", "army jeep", "military car",
        "military vehicle", "combat vehicle", "armored vehicle", "armored car",
        "military helicopter", "attack helicopter", "apache helicopter",
        "black hawk", "blackhawk", "chinook", "osprey",
        "fighter jet", "fighter aircraft", "stealth bomber", "warplane",
        "b-2 bomber", "b-52", "f-16", "f-35", "f/a-18", "su-57", "mig-29",
        "military drone", "combat drone",
        "missile launcher", "rocket launcher", "anti-aircraft",
        "warship", "destroyer", "frigate", "aircraft carrier", "submarine",
        "naval vessel", "gunboat", "military ship",
    ]),

    # 2 ── Aircraft
    ("Aircraft", [
        "aircraft", "airplane", "aeroplane", "airbus", "boeing",
        "helicopter", "biplane", "uav", "drone",
        "a320", "a380", "a350", "b737", "b747", "b777", "b787",
        "passenger plane", "cargo plane", "private jet", "business jet",
        "turbofan", "aviation", "cockpit", "propeller plane",
    ]),

    # 3 ── Ships
    ("Ships", [
        "ship", "boat", "vessel", "yacht", "cruise ship", "cruise liner",
        "container ship", "cargo ship", "oil tanker",
        "tugboat", "sailboat", "motorboat", "speedboat",
        "ferry", "barge", "catamaran", "canoe", "kayak",
        "lifeboat", "patrol boat", "fishing boat", "sailing vessel",
    ]),

    # 4 ── Medical
    ("Medical", [
        "medical", "anatomy", "skeleton", "human organ",
        "heart model", "brain model", "lung", "kidney", "liver",
        "spine", "vertebra", "skull", "ribcage", "pelvis",
        "dental", "tooth", "teeth", "jaw",
        "hospital", "surgery", "surgical", "syringe", "stethoscope",
        "healthcare", "mri", "ct scanner", "x-ray",
        "wheelchair", "stretcher", "ambulance",
        "operating room", "microscope", "dna", "bacteria", "virus model",
    ]),

    # 5 ── Industrial Equipment
    ("Industrial Equipment", [
        "industrial", "factory", "machinery",
        "robot arm", "robotic arm", "robotic hand",
        "pump", "valve", "compressor",
        "generator", "pipeline", "conveyor belt", "forklift",
        "hvac", "ventilation", "ductwork", "duct system",
        "reactor", "boiler", "drill rig", "oil rig", "refinery",
        "power plant", "transformer", "gearbox", "lathe",
        "cnc machine", "welding machine",
        "container unit", "iso container", "shipping container",
    ]),

    # 6 ── Vehicles (before Architecture — fixes "Truck Interior" misclassification)
    ("Vehicles", [
        "car", "truck", "bus", "van", "suv", "sedan", "pickup",
        "coupe", "convertible", "wagon", "automobile",
        "motorcycle", "scooter", "bicycle", "bike", "quad",
        "trailer", "tractor", "excavator", "bulldozer", "road roller",
        "vehicle",
        "tesla", "ford", "toyota", "bmw", "mercedes", "audi",
        "porsche", "lamborghini", "ferrari", "mustang", "camaro",
        "transit van", "sprinter van", "f-150",
        "hatchback", "minivan", "racing car", "race car",
        "monster truck", "fire truck", "police car",
    ]),

    # 7 ── Architecture Landmarks
    # Removed: "interior", "building", "architecture" (too broad → use specific terms)
    ("Architecture Landmarks", [
        # Landmark types
        "tower", "skyscraper", "stadium", "monument", "landmark",
        "castle", "cathedral", "palace", "fortress", "citadel",
        "opera house", "museum", "mosque", "temple", "church",
        "chapel", "synagogue", "pyramid", "ruins", "lighthouse",
        "windmill", "manor", "villa architecture",
        # Famous landmarks
        "eiffel", "colosseum", "big ben", "empire state",
        "notre dame", "parthenon", "acropolis", "angkor",
        "taj mahal", "sagrada familia", "burj", "hagia sophia",
        # Building types
        "office building", "apartment building", "shopping mall",
        "hotel building", "warehouse", "hangar",
        # Interior spaces (architecture)
        "living room", "bedroom", "kitchen", "bathroom",
        "lobby interior", "office interior", "room interior",
        "hallway", "corridor", "staircase",
    ]),

    # 8 ── Characters & People
    ("Characters & People", [
        "human body", "full body", "body anatomy", "male body", "female body",
        "human figure", "character rig", "character rigged",
        "human hand", "man hand", "man hands", "female hand", "female hands",
        "hand model", "hand rigged", "hands rigged",
        "human head", "face model", "portrait", "bust",
        "man rigged", "woman rigged", "male rigged", "female rigged",
        "soldier character", "character base", "low poly character",
        "stylized character", "realistic character",
        "zombie", "vampire", "pirate character",
        "superhero", "knight character", "ninja",
    ]),

    # 9 ── Animals & Creatures
    ("Animals & Creatures", [
        "dog", "cat", "horse", "cow", "pig", "sheep", "goat",
        "lion", "tiger", "bear", "wolf", "fox", "deer", "elephant",
        "giraffe", "zebra", "gorilla", "monkey", "rabbit",
        "eagle", "hawk", "owl", "parrot", "penguin", "flamingo",
        "shark", "whale", "dolphin", "fish", "octopus", "crab",
        "snake", "lizard", "crocodile", "turtle", "frog",
        "dragon", "dinosaur", "creature", "monster creature",
        "insect", "butterfly", "bee", "spider",
    ]),

    # 10 ── Nature & Plants
    ("Nature & Plants", [
        "flower", "rose", "orchid", "tulip", "sunflower",
        "tree", "oak", "pine", "palm tree", "birch", "maple",
        "plant", "grass", "bush", "shrub", "fern",
        "mushroom", "cactus", "bamboo",
        "landscape", "terrain", "mountain", "rock formation",
        "forest", "jungle", "coral reef", "seaweed",
        "leaf", "branch", "fruit tree",
    ]),

    # 11 ── Furniture & Interior Design
    ("Furniture & Interior", [
        "chair", "armchair", "sofa", "couch", "bench", "stool",
        "table", "desk", "dining table", "coffee table",
        "bed", "bunk bed", "mattress",
        "shelf", "bookshelf", "cabinet", "wardrobe", "dresser",
        "lamp", "chandelier", "ceiling light",
        "door", "window frame", "stairs", "railing",
        "bathtub", "sink", "toilet", "shower",
        "fireplace", "curtain", "pillow", "rug",
        "samovar", "vase", "candle holder", "picture frame",
    ]),

    # 12 ── Weapons & Tools (non-military: melee, historical, props)
    ("Weapons & Tools", [
        "sword", "axe", "spear", "bow and arrow", "crossbow",
        "dagger", "knife", "blade", "scythe", "mace", "shield",
        "gun prop", "pistol prop", "revolver",
        "cannon prop", "money gun", "cash cannon",
        "hammer", "wrench", "screwdriver", "drill", "saw",
        "shovel", "pickaxe", "crowbar",
        "lighter", "candle lighter",
    ]),

    # 13 ── Electronics & Gadgets
    ("Electronics & Gadgets", [
        "smartphone", "phone", "mobile phone", "iphone", "android phone",
        "laptop", "notebook computer", "macbook",
        "tablet", "ipad",
        "desktop computer", "monitor", "keyboard", "mouse",
        "headphone", "earphone", "airpod",
        "camera", "dslr", "video camera",
        "smartwatch", "watch",
        "television", "smart tv", "remote control",
        "speaker", "microphone", "headset gaming",
        "game console", "joystick", "gamepad",
        "router", "server rack",
        "vr headset", "oculus",
    ]),

    # 14 ── Clothing & Accessories
    ("Clothing & Accessories", [
        "hat", "cap", "baseball cap", "beanie", "helmet fashion",
        "shoe", "sneaker", "boot", "heel",
        "bag", "backpack", "handbag", "briefcase", "purse",
        "jacket", "coat", "shirt", "dress", "pants", "suit",
        "glasses", "sunglasses", "ring", "necklace", "watch fashion",
        "belt", "tie", "scarf", "glove",
    ]),

    # 15 ── Food & Beverages
    ("Food & Beverages", [
        "food", "fruit", "apple", "orange", "banana", "strawberry",
        "vegetable", "tomato", "bread", "cake", "pizza", "burger",
        "coffee cup", "wine glass", "bottle drink", "beer can",
        "ice cream", "donut", "cookie", "candy",
        "breakfast", "meal", "dish",
    ]),
]


# ── Industry mapping ───────────────────────────────────────────────────────────

_INDUSTRY_MAP: dict[str, list[str]] = {
    "Vehicles":               ["Games", "Film & Video Production", "Advertising", "Architecture", "Simulation"],
    "Military Vehicles":      ["Military / Defense", "Games", "Film & Video Production", "Simulation"],
    "Aircraft":               ["Aerospace", "Film & Video Production", "Games", "Simulation", "Virtual Reality"],
    "Ships":                  ["Film & Video Production", "Games", "Simulation", "Event Management"],
    "Industrial Equipment":   ["Hardware", "Software Development", "Simulation", "Advertising"],
    "Medical":                ["Medical", "Software Development", "Virtual Reality", "Film & Video Production"],
    "Architecture Landmarks": ["Architecture", "Event Management", "Advertising", "Virtual Reality", "Games"],
    "Characters & People":    ["Film & Video Production", "Games", "Virtual Reality", "Advertising"],
    "Animals & Creatures":    ["Film & Video Production", "Games", "Virtual Reality", "Advertising"],
    "Nature & Plants":        ["Architecture", "Film & Video Production", "Games", "Virtual Reality"],
    "Furniture & Interior":   ["Architecture", "Advertising", "Film & Video Production", "Games"],
    "Weapons & Tools":        ["Games", "Film & Video Production", "Military / Defense", "Advertising"],
    "Electronics & Gadgets":  ["Advertising", "Film & Video Production", "Hardware", "Software Development"],
    "Clothing & Accessories": ["Advertising", "Film & Video Production", "Games", "Virtual Reality"],
    "Food & Beverages":       ["Advertising", "Film & Video Production", "3D Printing", "Games"],
    "Other":                  ["Film & Video Production", "Advertising", "Graphics Multimedia and Web Design"],
}


# ── Use case mapping ───────────────────────────────────────────────────────────

_USE_CASE_MAP: dict[str, list[str]] = {
    "Vehicles":               ["visualization", "advertising", "game environments", "film production", "simulation"],
    "Military Vehicles":      ["military simulation", "game environments", "film production", "defense training"],
    "Aircraft":               ["aerospace visualization", "film production", "simulation", "VR experiences", "game environments"],
    "Ships":                  ["film production", "game environments", "simulation", "event visualization"],
    "Industrial Equipment":   ["hardware presentation", "software interface visualization", "simulation", "advertising"],
    "Medical":                ["medical education", "training simulation", "VR experiences", "healthcare presentation"],
    "Architecture Landmarks": ["architecture visualization", "event visualization", "VR experiences", "advertising", "game environments"],
    "Characters & People":    ["character animation", "game development", "film production", "VR avatars"],
    "Animals & Creatures":    ["film production", "game environments", "VR experiences", "advertising"],
    "Nature & Plants":        ["architecture visualization", "film production", "game environments", "VR experiences"],
    "Furniture & Interior":   ["interior design visualization", "advertising", "architecture presentation", "game environments"],
    "Weapons & Tools":        ["game environments", "film production", "historical visualization", "advertising"],
    "Electronics & Gadgets":  ["product advertising", "hardware presentation", "film production", "software visualization"],
    "Clothing & Accessories": ["product advertising", "fashion visualization", "game assets", "film production"],
    "Food & Beverages":       ["advertising", "product visualization", "film production", "3D printing"],
    "Other":                  ["visualization", "advertising", "3D printing", "film production"],
}


# ── SEO keyword templates ──────────────────────────────────────────────────────

_SEO_KW_MAP: dict[str, list[str]] = {
    "Vehicles":               ["{name} 3d model", "vehicle 3d model", "car 3d model", "{name} for games"],
    "Military Vehicles":      ["{name} 3d model", "military vehicle 3d model", "military 3d model", "tank 3d model"],
    "Aircraft":               ["{name} 3d model", "aircraft 3d model", "airplane 3d model", "aviation 3d model"],
    "Ships":                  ["{name} 3d model", "ship 3d model", "boat 3d model", "vessel 3d model"],
    "Industrial Equipment":   ["{name} 3d model", "industrial 3d model", "equipment 3d model", "machinery 3d model"],
    "Medical":                ["{name} 3d model", "medical 3d model", "anatomy 3d model", "healthcare 3d model"],
    "Architecture Landmarks": ["{name} 3d model", "architecture 3d model", "building 3d model", "landmark 3d model"],
    "Characters & People":    ["{name} 3d model", "character 3d model", "rigged character 3d model", "human 3d model"],
    "Animals & Creatures":    ["{name} 3d model", "animal 3d model", "creature 3d model", "{name} for games"],
    "Nature & Plants":        ["{name} 3d model", "plant 3d model", "nature 3d model", "tree 3d model"],
    "Furniture & Interior":   ["{name} 3d model", "furniture 3d model", "interior 3d model", "{name} for visualization"],
    "Weapons & Tools":        ["{name} 3d model", "weapon 3d model", "prop 3d model", "{name} for games"],
    "Electronics & Gadgets":  ["{name} 3d model", "electronics 3d model", "gadget 3d model", "{name} product visualization"],
    "Clothing & Accessories": ["{name} 3d model", "clothing 3d model", "accessory 3d model", "{name} for advertising"],
    "Food & Beverages":       ["{name} 3d model", "food 3d model", "product 3d model", "{name} for advertising"],
    "Other":                  ["{name} 3d model", "3d model download", "{name} turbosquid"],
}


# ── Main classifier ────────────────────────────────────────────────────────────

def classify_model(title: str) -> Classification:
    title_lower = title.lower()

    category = "Other"
    matched_kw = ""
    for cat, keywords in _CATEGORY_RULES:
        hit = _match(title_lower, keywords)
        if hit:
            category = cat
            matched_kw = hit
            break

    subcategory = matched_kw.title() if matched_kw else ""
    industries  = _INDUSTRY_MAP.get(category, _INDUSTRY_MAP["Other"])
    use_cases   = _USE_CASE_MAP.get(category, _USE_CASE_MAP["Other"])

    short_name = " ".join(title.split()[:4]).lower()
    seo_keywords = [
        kw.replace("{name}", short_name)
        for kw in _SEO_KW_MAP.get(category, _SEO_KW_MAP["Other"])
    ]

    return Classification(
        category=category,
        subcategory=subcategory,
        industries=industries,
        use_cases=use_cases,
        seo_keywords=seo_keywords,
    )
