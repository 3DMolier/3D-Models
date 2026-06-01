"""Generate sitemap.xml and robots.txt in the project root.

Update DOMAIN before deploying to GitHub Pages.
"""

import csv, json
from datetime import date
from pathlib import Path

ROOT   = Path(__file__).parent.parent
TODAY  = date.today().isoformat()          # 2026-05-15

# ── UPDATE THIS before deploying ──────────────────────────────────────────────
DOMAIN = "https://3dmolierstudio.com"    # no trailing slash
# ──────────────────────────────────────────────────────────────────────────────

CAT_SLUGS = [
    "vehicles", "aircraft", "military-vehicles", "ships",
    "medical-3d-models", "industrial-equipment", "architecture-landmarks",
    "characters-people", "animals-creatures", "nature-plants",
    "furniture-interior", "weapons-tools", "electronics-gadgets",
    "clothing-accessories", "food-beverages", "other",
]

def url(path, priority, changefreq):
    return (
        f"  <url>\n"
        f"    <loc>{DOMAIN}{path}</loc>\n"
        f"    <lastmod>{TODAY}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )

def build_sitemap():
    entries = []

    # Static pages
    entries.append(url("/",              "1.0", "weekly"))
    entries.append(url("/catalog/",      "0.9", "weekly"))
    entries.append(url("/search/",       "0.8", "weekly"))
    entries.append(url("/collections/",  "0.8", "weekly"))
    entries.append(url("/about/",        "0.6", "monthly"))
    entries.append(url("/contact/",      "0.6", "monthly"))
    entries.append(url("/custom-order/", "0.7", "monthly"))

    # 15 category pages
    for slug in CAT_SLUGS:
        entries.append(url(f"/categories/{slug}/", "0.8", "weekly"))

    # 19 collection pages
    collections = json.load(open(ROOT / "data" / "collections.json", encoding="utf-8"))
    for col in collections:
        entries.append(url(f"/collections/{col['collection_slug']}/", "0.7", "monthly"))

    # 1,000 model pages (sorted by priority_score for crawl ordering)
    rows = list(csv.DictReader(open(ROOT / "data" / "top_models.csv", encoding="utf-8")))
    rows.sort(key=lambda r: float(r["priority_score"]), reverse=True)
    for r in rows:
        entries.append(url(f"/models/{r['slug']}/", "0.6", "monthly"))

    total = len(entries)
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return xml, total

def build_robots():
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {DOMAIN}/sitemap.xml\n"
    )

def generate():
    sitemap_xml, total = build_sitemap()
    (ROOT / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")
    print(f"Done: sitemap.xml ({total} URLs)")

    robots = build_robots()
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")
    print(f"Done: robots.txt (domain: {DOMAIN})")

if __name__ == "__main__":
    generate()
