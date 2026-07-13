"""
3D Molier Data Pipeline
=======================
Input:  Models_and_Sales.xlsm  +  models.csv
Output: data/models_master.csv
        data/top_models.csv
        data/search_index.json
        data/collections.json

Run from project root:
    python scripts/process_data.py
"""

import sys
import csv
import json
import re
import time
from pathlib import Path

import openpyxl
import yaml

# Make classify.py importable when running from project root
sys.path.insert(0, str(Path(__file__).parent))
from classify import classify_model

BASE_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


# ── Image URL (Option A — TurboSquid static CDN attempt) ─────────────────────

def build_image_url(product_id: int, slug: str) -> str:
    """
    Constructs a TurboSquid static CDN thumbnail URL.
    Pattern: https://static.turbosquid.com/Preview/{000000}/{000}/{Name}_D_Main.jpg
    Astro templates include onerror fallback to placehold.co.
    """
    id_str = str(product_id).zfill(9)
    prefix, suffix = id_str[:6], id_str[6:]
    # Strip the numeric ID from the end of slug: "money-gun-1496500" → "money-gun"
    clean = re.sub(r"-?\d+$", "", slug).strip("-") or slug
    name = "-".join(w.capitalize() for w in clean.split("-") if w)
    return f"https://static.turbosquid.com/Preview/{prefix}/{suffix}/{name}_D_Main.jpg"


# ── URL helpers ────────────────────────────────────────────────────────────────

def extract_slug(url: str) -> str:
    m = re.search(r"/3d-models/([^?&#/]+)", url)
    return m.group(1) if m else ""


def ensure_referral(url: str) -> str:
    if "referral=3d_molier-studio" in url:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}referral=3d_molier-studio"


# ── Loaders ────────────────────────────────────────────────────────────────────

def load_xlsm() -> list[dict]:
    path = BASE_DIR / "Models_and_Sales.xlsm"
    print(f"  Loading {path.name} …", end=" ", flush=True)
    t0 = time.time()
    wb = openpyxl.load_workbook(path, read_only=True, keep_vba=False, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(h) for h in next(rows_iter)]
    records = [dict(zip(headers, row)) for row in rows_iter]
    wb.close()
    print(f"{len(records):,} rows  ({time.time()-t0:.1f}s)")
    return records


def load_models_csv() -> dict[int, str]:
    """Returns {product_id: product_url} mapping."""
    path = BASE_DIR / "models.csv"
    print(f"  Loading {path.name} …", end=" ", flush=True)
    result: dict[int, str] = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            result[int(row["product_id"])] = row["product_url"]
    print(f"{len(result):,} rows")
    return result


def load_weights() -> dict:
    with open(SCRIPTS_DIR / "scoring_weights.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ── Scoring ────────────────────────────────────────────────────────────────────

def _normalize(values: list[float]) -> list[float]:
    mn, mx = min(values), max(values)
    span = mx - mn
    if span == 0:
        return [0.0] * len(values)
    return [(v - mn) / span for v in values]


def compute_scores(records: list[dict], weights: dict) -> list[float]:
    w = weights["weights"]
    cert_map = weights.get("certification_scores", {})
    priority_cats = set(weights.get("priority_categories", []))

    n_sales   = _normalize([float(r.get("sales_qty")          or 0) for r in records])
    n_rev     = _normalize([float(r.get("estimated_revenue")   or 0) for r in records])
    n_recent  = _normalize([float(r.get("recent_sales")        or 0) for r in records])
    n_fp      = _normalize([float(r.get("full_previews")       or 0) for r in records])
    n_sc      = _normalize([float(r.get("shopping_carts")      or 0) for r in records])
    cat_s     = [1.0 if r.get("category") in priority_cats else 0.3 for r in records]
    cert_s    = [cert_map.get(str(r.get("certification") or ""), 0.0) for r in records]

    return [
        n_sales[i]  * w["sales_qty"] +
        n_rev[i]    * w["estimated_revenue"] +
        n_recent[i] * w["recent_sales"] +
        n_fp[i]     * w["full_previews"] +
        n_sc[i]     * w["shopping_carts"] +
        cat_s[i]    * w["category_priority"] +
        cert_s[i]   * w["certification"]
        for i in range(len(records))
    ]


# ── Collections ────────────────────────────────────────────────────────────────

COLLECTION_DEFS = [
    # Category-based
    {"slug": "best-vehicle-3d-models",
     "title": "Best Vehicle 3D Models",
     "type": "category", "fk": "category", "fv": "Vehicles",
     "seo_title": "Best Vehicle 3D Models for Film, Games & Advertising | 3D Molier",
     "meta_desc": "Browse the best vehicle 3D models by 3D Molier — cars, trucks, motorcycles and more. Selected for film, advertising, games and simulation.",
     "intro": "Explore selected vehicle 3D models for film production, advertising campaigns, game environments and simulation projects. Open each model directly on TurboSquid.",
     "ts_url": "https://www.turbosquid.com/Search/vehicle?referral=3d_molier-studio"},

    {"slug": "best-military-vehicle-3d-models",
     "title": "Best Military Vehicle 3D Models",
     "type": "category", "fk": "category", "fv": "Military Vehicles",
     "seo_title": "Best Military Vehicle 3D Models for Games, Film & Simulation | 3D Molier",
     "meta_desc": "Browse military vehicle 3D models by 3D Molier — tanks, APCs, warplanes, warships and more. For defense simulation, game development and film production.",
     "intro": "Selected military vehicle 3D models for defense simulation, game environments, film production and training visualization. View each model on TurboSquid.",
     "ts_url": "https://www.turbosquid.com/Search/military?referral=3d_molier-studio"},

    {"slug": "best-aircraft-3d-models",
     "title": "Best Aircraft 3D Models",
     "type": "category", "fk": "category", "fv": "Aircraft",
     "seo_title": "Best Aircraft 3D Models for Aerospace, Film, Games & Simulation | 3D Molier",
     "meta_desc": "Browse selected aircraft 3D models by 3D Molier — planes, helicopters, drones, jets and more. For aerospace visualization, film, simulation and VR.",
     "intro": "Selected aircraft and aviation 3D models for aerospace visualization, film production, simulation, VR experiences and game development. View on TurboSquid.",
     "ts_url": "https://www.turbosquid.com/Search/aircraft?referral=3d_molier-studio"},

    {"slug": "best-ship-3d-models",
     "title": "Best Ship 3D Models",
     "type": "category", "fk": "category", "fv": "Ships",
     "seo_title": "Best Ship & Boat 3D Models for Film, Games & Simulation | 3D Molier",
     "meta_desc": "Browse ship and boat 3D models by 3D Molier — yachts, cruise liners, cargo ships and more. For film production, game environments and simulation.",
     "intro": "Selected ship and maritime 3D models for film production, game environments, simulation and event visualization. View each model on TurboSquid.",
     "ts_url": "https://www.turbosquid.com/Search/ship?referral=3d_molier-studio"},

    {"slug": "best-industrial-equipment-3d-models",
     "title": "Best Industrial Equipment 3D Models",
     "type": "category", "fk": "category", "fv": "Industrial Equipment",
     "seo_title": "Best Industrial Equipment 3D Models for Hardware, Simulation & Advertising | 3D Molier",
     "meta_desc": "Browse industrial equipment 3D models by 3D Molier — machinery, robot arms, HVAC, pipelines and more. For hardware presentations and simulation.",
     "intro": "Selected industrial equipment and machinery 3D models for hardware presentations, simulation, software visualization and advertising campaigns.",
     "ts_url": "https://www.turbosquid.com/Search/industrial?referral=3d_molier-studio"},

    {"slug": "best-medical-3d-models",
     "title": "Best Medical 3D Models",
     "type": "category", "fk": "category", "fv": "Medical",
     "seo_title": "Best Medical 3D Models for Visualization, Training & VR | 3D Molier",
     "meta_desc": "Browse medical and anatomy 3D models by 3D Molier — human organs, skeletons, surgical tools and more. For medical education and healthcare visualization.",
     "intro": "Selected medical and anatomy 3D models for healthcare visualization, medical education, training simulation and VR experiences.",
     "ts_url": "https://www.turbosquid.com/Search/medical?referral=3d_molier-studio"},

    {"slug": "best-architecture-landmark-3d-models",
     "title": "Best Architecture & Landmark 3D Models",
     "type": "category", "fk": "category", "fv": "Architecture Landmarks",
     "seo_title": "Best Architecture & Landmark 3D Models for Visualization & Games | 3D Molier",
     "meta_desc": "Browse architecture and landmark 3D models by 3D Molier — buildings, towers, monuments, interiors and more. For architecture visualization and game environments.",
     "intro": "Selected architecture and landmark 3D models for architecture visualization, event staging, VR experiences, advertising and game environments.",
     "ts_url": "https://www.turbosquid.com/Search/architecture?referral=3d_molier-studio"},

    # Industry-based
    {"slug": "3d-models-for-aerospace-visualization",
     "title": "3D Models for Aerospace Visualization",
     "type": "industry", "fk": "industries", "fv": "Aerospace",
     "seo_title": "3D Models for Aerospace Visualization | 3D Molier",
     "meta_desc": "Selected 3D models for aerospace visualization projects — aircraft, spacecraft, aviation equipment and more by 3D Molier.",
     "intro": "3D models selected for aerospace visualization, flight simulation, engineering presentations and aviation film production.",
     "ts_url": "https://www.turbosquid.com/Search/aerospace?referral=3d_molier-studio"},

    {"slug": "3d-models-for-medical-visualization",
     "title": "3D Models for Medical Visualization",
     "type": "industry", "fk": "industries", "fv": "Medical",
     "seo_title": "3D Models for Medical Visualization & Training | 3D Molier",
     "meta_desc": "Selected medical 3D models for healthcare visualization, training simulations and patient education by 3D Molier.",
     "intro": "3D models for medical visualization, anatomy education, surgical training and healthcare VR applications.",
     "ts_url": "https://www.turbosquid.com/Search/medical?referral=3d_molier-studio"},

    {"slug": "3d-models-for-defense-simulation",
     "title": "3D Models for Defense & Simulation",
     "type": "industry", "fk": "industries", "fv": "Military / Defense",
     "seo_title": "3D Models for Defense & Military Simulation | 3D Molier",
     "meta_desc": "Selected military 3D models for defense simulation, training applications and tactical visualization by 3D Molier.",
     "intro": "3D models for defense simulation, military training, tactical visualization and game development in the defense sector.",
     "ts_url": "https://www.turbosquid.com/Search/military?referral=3d_molier-studio"},

    {"slug": "3d-models-for-film-production",
     "title": "3D Models for Film Production",
     "type": "industry", "fk": "industries", "fv": "Film & Video Production",
     "seo_title": "3D Models for Film & Video Production | 3D Molier",
     "meta_desc": "Selected 3D models for film and video production by 3D Molier — vehicles, props, environments and more for visual effects and animation.",
     "intro": "3D models for film production, visual effects, animation, commercials and video content creation.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?referral=3d_molier-studio"},

    {"slug": "3d-models-for-vr-projects",
     "title": "3D Models for VR Projects",
     "type": "industry", "fk": "industries", "fv": "Virtual Reality",
     "seo_title": "3D Models for VR & Virtual Reality Projects | 3D Molier",
     "meta_desc": "Selected 3D models for VR and virtual reality projects by 3D Molier. Optimized for interactive experiences.",
     "intro": "3D models for virtual reality experiences, interactive simulations, VR training and immersive environments.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?referral=3d_molier-studio"},

    {"slug": "3d-models-for-game-development",
     "title": "3D Models for Game Development",
     "type": "industry", "fk": "industries", "fv": "Games",
     "seo_title": "3D Models for Game Development | 3D Molier",
     "meta_desc": "Selected 3D models for game development by 3D Molier — vehicles, characters, environments, props and more.",
     "intro": "3D models for game environments, props, vehicles and characters — selected for game development projects.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?referral=3d_molier-studio"},

    {"slug": "3d-models-for-advertising",
     "title": "3D Models for Advertising",
     "type": "industry", "fk": "industries", "fv": "Advertising",
     "seo_title": "3D Models for Advertising & Commercial Visualization | 3D Molier",
     "meta_desc": "Selected 3D models for advertising and commercial visualization by 3D Molier. High-quality assets for campaigns.",
     "intro": "3D models for advertising campaigns, product visualization, commercial animation and marketing content.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?referral=3d_molier-studio"},

    {"slug": "3d-models-for-architecture-visualization",
     "title": "3D Models for Architecture Visualization",
     "type": "industry", "fk": "industries", "fv": "Architecture",
     "seo_title": "3D Models for Architecture Visualization | 3D Molier",
     "meta_desc": "Selected 3D models for architecture visualization by 3D Molier — buildings, interiors, landmarks and environments.",
     "intro": "3D models for architectural visualization, interior design presentations, urban planning and real estate marketing.",
     "ts_url": "https://www.turbosquid.com/Search/architecture?referral=3d_molier-studio"},

    {"slug": "3d-models-for-event-management",
     "title": "3D Models for Event Management",
     "type": "industry", "fk": "industries", "fv": "Event Management",
     "seo_title": "3D Models for Event Management & Staging | 3D Molier",
     "meta_desc": "Selected 3D models for event management, staging visualization and event design by 3D Molier.",
     "intro": "3D models for event staging, venue visualization, trade show design and event management presentations.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?referral=3d_molier-studio"},

    {"slug": "3d-models-for-hardware-presentation",
     "title": "3D Models for Hardware Presentation",
     "type": "industry", "fk": "industries", "fv": "Hardware",
     "seo_title": "3D Models for Hardware & Product Presentation | 3D Molier",
     "meta_desc": "Selected industrial and equipment 3D models for hardware presentations and product visualization by 3D Molier.",
     "intro": "3D models for hardware product presentations, technical visualization and industrial equipment demonstrations.",
     "ts_url": "https://www.turbosquid.com/Search/industrial?referral=3d_molier-studio"},

    # Certification-based
    {"slug": "checkmate-certified-3d-models",
     "title": "CheckMate Certified 3D Models",
     "type": "certification", "fk": "certification", "fv": "CheckMate Lite/Pro",
     "seo_title": "CheckMate Certified 3D Models | 3D Molier",
     "meta_desc": "Browse CheckMate certified 3D models by 3D Molier — highest quality standard on TurboSquid.",
     "intro": "CheckMate certified 3D models meet TurboSquid's highest quality standard. Verified topology, clean geometry.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?certification=CheckMate+Lite%2FPro&referral=3d_molier-studio"},

    {"slug": "stemcell-certified-3d-models",
     "title": "StemCell Certified 3D Models",
     "type": "certification", "fk": "certification", "fv": "StemCell",
     "seo_title": "StemCell Certified 3D Models | 3D Molier",
     "meta_desc": "Browse StemCell certified 3D models by 3D Molier — real-time ready assets with multiple format support.",
     "intro": "StemCell certified 3D models are real-time ready with PBR textures and multi-format compatibility.",
     "ts_url": "https://www.turbosquid.com/Search/3D-Models?certification=StemCell&referral=3d_molier-studio"},
]

MODELS_PER_COLLECTION = 24


def build_collections(records: list[dict]) -> list[dict]:
    collections = []
    for cdef in COLLECTION_DEFS:
        fk, fv = cdef["fk"], cdef["fv"]

        if fk in ("category", "certification"):
            matching = [r for r in records if r.get(fk) == fv]
        else:  # industries (pipe-separated)
            matching = [r for r in records if fv in (r.get(fk) or "").split("|")]

        matching_sorted = sorted(matching, key=lambda r: r.get("priority_score") or 0, reverse=True)
        top_ids = [str(r["product_id"]) for r in matching_sorted[:MODELS_PER_COLLECTION]]

        collections.append({
            "collection_slug":          cdef["slug"],
            "collection_title":         cdef["title"],
            "collection_type":          cdef["type"],
            "filter_key":               fk,
            "filter_value":             fv,
            "model_ids":                top_ids,
            "total_matching_models":    len(matching),
            "seo_title":                cdef.get("seo_title", f"{cdef['title']} | 3D Molier"),
            "meta_description":         cdef.get("meta_desc", ""),
            "intro_text":               cdef.get("intro", ""),
            "turbosquid_collection_url": cdef.get("ts_url", ""),
        })
    return collections


# ── Main ───────────────────────────────────────────────────────────────────────

MASTER_COLS = [
    "product_id", "product_name", "slug",
    "turbosquid_url", "referral_url",
    "price", "sales_qty", "estimated_revenue", "recent_sales",
    "downloads", "full_previews", "shopping_carts", "days_in_sales",
    "certification",
    "category", "subcategory", "industries", "use_cases", "seo_keywords",
    "priority_score", "is_top_model", "image_url",
]

_CERT_NORM = {
    "stemcell": "StemCell",
    "stemcell lite/pro": "StemCell",
    "checkmate lite/pro": "CheckMate Lite/Pro",
    "checkmate": "CheckMate Lite/Pro",
    "no certification": "no certification",
    "none": "no certification",
}


def main() -> None:
    print("\n=== 3D Molier Data Pipeline ===\n")

    weights = load_weights()
    xlsm_rows = load_xlsm()
    csv_map = load_models_csv()
    recent_years: list[int] = weights.get("recent_years", [2024, 2025, 2026])

    print(f"  Classifying & building {len(xlsm_rows):,} records …", end=" ", flush=True)
    t0 = time.time()

    records: list[dict] = []
    for row in xlsm_rows:
        pid = int(row.get("Product_ID") or 0)
        product_url = csv_map.get(pid, "")

        slug = extract_slug(product_url) if product_url else ""
        if not slug:
            name_slug = re.sub(r"[^a-z0-9]+", "-", (row.get("Product_Name") or "").lower()).strip("-")
            slug = f"{name_slug}-{pid}"

        turbosquid_url  = product_url.split("?")[0] if product_url else f"https://www.turbosquid.com/3d-models/{slug}"
        referral_url    = ensure_referral(product_url) if product_url else f"{turbosquid_url}?referral=3d_molier-studio"
        image_url       = build_image_url(pid, slug)

        recent_sales = sum(float(row.get(f"Sales qty in {y}") or 0) for y in recent_years)
        price        = float(row.get("Last Price, $") or 0)
        sales_qty    = float(row.get("Sales, qty") or 0)
        est_revenue  = price * sales_qty

        name = str(row.get("Product_Name") or "")
        cl   = classify_model(name)

        cert_raw  = str(row.get("Certification") or "no certification").strip()
        cert_norm = _CERT_NORM.get(cert_raw.lower(), cert_raw)

        records.append({
            "product_id":        pid,
            "product_name":      name,
            "slug":              slug,
            "turbosquid_url":    turbosquid_url,
            "referral_url":      referral_url,
            "price":             price,
            "sales_qty":         sales_qty,
            "estimated_revenue": est_revenue,
            "recent_sales":      recent_sales,
            "downloads":         float(row.get("Downloads") or 0),
            "full_previews":     float(row.get("Full Previews") or 0),
            "shopping_carts":    float(row.get("Shopping Carts") or 0),
            "days_in_sales":     float(row.get("Days in sales") or 0),
            "certification":     cert_norm,
            "category":          cl["category"],
            "subcategory":       cl["subcategory"],
            "industries":        "|".join(cl["industries"]),
            "use_cases":         "|".join(cl["use_cases"]),
            "seo_keywords":      "|".join(cl["seo_keywords"]),
            "image_url":         image_url,
        })

    print(f"{time.time()-t0:.1f}s")

    # Scores
    print("  Computing priority scores …", end=" ", flush=True)
    t0 = time.time()
    scores = compute_scores(records, weights)
    for rec, score in zip(records, scores):
        rec["priority_score"] = round(score, 6)
    print(f"{time.time()-t0:.1f}s")

    # Top models
    top_n = weights["top_models"]["max_count"]
    sorted_recs = sorted(records, key=lambda r: r["priority_score"], reverse=True)
    top_ids = {r["product_id"] for r in sorted_recs[:top_n]}
    for rec in records:
        rec["is_top_model"] = rec["product_id"] in top_ids

    # ── Write models_master.csv ───────────────────────────────────────────────
    out = DATA_DIR / "models_master.csv"
    print(f"  Writing {out.name} …", end=" ", flush=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MASTER_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(records)
    print(f"{len(records):,} rows  ({out.stat().st_size/1e6:.1f} MB)")

    # ── Write top_models.csv ──────────────────────────────────────────────────
    top_records = [r for r in records if r["is_top_model"]]
    out = DATA_DIR / "top_models.csv"
    print(f"  Writing {out.name} …", end=" ", flush=True)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MASTER_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(top_records)
    print(f"{len(top_records):,} rows")

    # ── Write search_index.json ───────────────────────────────────────────────
    out = DATA_DIR / "search_index.json"
    print(f"  Writing {out.name} …", end=" ", flush=True)
    search_data = [
        {
            "id":    str(r["product_id"]),
            "t":     r["product_name"],          # title
            "s":     r["slug"],                  # slug
            "c":     r["category"],              # category
            "i":     r["industries"].split("|") if r["industries"] else [],
            "img":   r["image_url"],
            "p":     r["price"],                 # price
            "url":   r["referral_url"],
            "page":  f"/models/{r['slug']}/" if r["is_top_model"] else None,
            "score": r["priority_score"],
            "top":   r["is_top_model"],
        }
        for r in records
    ]
    with open(out, "w", encoding="utf-8") as f:
        json.dump(search_data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(search_data):,} records  ({out.stat().st_size/1e6:.1f} MB)")

    # ── Write collections.json ────────────────────────────────────────────────
    out = DATA_DIR / "collections.json"
    print(f"  Writing {out.name} …", end=" ", flush=True)
    collections = build_collections(records)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(collections, f, ensure_ascii=False, indent=2)
    print(f"{len(collections)} collections")

    # ── Stats ─────────────────────────────────────────────────────────────────
    from collections import Counter
    all_cat  = Counter(r["category"] for r in records)
    top_cat  = Counter(r["category"] for r in top_records)

    print("\n=== RESULTS ===")
    print(f"  Total models      : {len(records):,}")
    print(f"  Top models        : {len(top_records):,}")
    print(f"  With sales > 0    : {sum(1 for r in records if r['sales_qty'] > 0):,}")
    print(f"\n  All models by category:")
    for cat, cnt in all_cat.most_common():
        bar = "#" * (cnt * 30 // max(all_cat.values()))
        print(f"    {cat:<28} {cnt:>6,}  {bar}")
    print(f"\n  Top {top_n} models by category:")
    for cat, cnt in top_cat.most_common():
        print(f"    {cat:<28} {cnt:>4}")

    print(f"\n  Collection sizes:")
    for col in collections:
        print(f"    {col['collection_slug']:<45}  {col['total_matching_models']:>5,} total  ->  {len(col['model_ids'])} featured")

    print("\n✓  Pipeline complete. Outputs in data/\n")


if __name__ == "__main__":
    main()
