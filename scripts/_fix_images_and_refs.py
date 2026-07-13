"""
Fix script:
1. Update category JSON img fields → p.turbosquid.com or local previews
2. Add referral=3d_molier-studio to all TurboSquid Search/Index.cfm links in HTML
"""
import json, re, glob, os, pathlib

ROOT = pathlib.Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── 1. Build lookups ──────────────────────────────────────────────────────────
fc_img = {}
for i in range(6):
    p = ROOT / "data" / f"fc-img-chunk-{i}.json"
    if p.exists():
        with open(p, encoding="utf-8") as f:
            fc_img.update(json.load(f))

# id → slug for models with local previews
slug_map = {}
prev_dir = ROOT / "previews"
for slug in (ROOT / "models").iterdir():
    m = re.search(r"-(\d+)$", slug.name)
    if m and (prev_dir / f"{slug.name}.webp").exists():
        slug_map[m.group(1)] = slug.name

# ── 2. Fix category JSON image URLs ──────────────────────────────────────────
json_changed = 0
for jf in glob.glob(str(ROOT / "data" / "categories" / "*.json")):
    with open(jf, encoding="utf-8") as f:
        models = json.load(f)
    if not isinstance(models, list) or not models:
        continue
    changed = False
    for m in models:
        url = m.get("url", "")
        id_m = re.search(r"-(\d+)(?:\?|$)", url)
        if not id_m:
            continue
        pid = id_m.group(1)
        # Prefer local preview
        if pid in slug_map:
            new_img = f"/previews/{slug_map[pid]}.webp"
        elif pid in fc_img:
            new_img = fc_img[pid]
        else:
            continue
        if m.get("img") != new_img:
            m["img"] = new_img
            changed = True
    if changed:
        with open(jf, "w", encoding="utf-8") as f:
            json.dump(models, f, ensure_ascii=False, separators=(",", ":"))
        json_changed += 1
        print(f"JSON: {os.path.basename(jf)}")
print(f"Category JSONs updated: {json_changed}")

# ── 3. Fix referral in HTML files ─────────────────────────────────────────────
# Only targets the Search/Index.cfm pattern (the only one missing referral)
REF_SUFFIX = "&referral=3d_molier-studio"
PATTERN = re.compile(
    r'(href="https://www\.turbosquid\.com/Search/Index\.cfm[^"]+?)(")',
)
html_changed = 0
for path in glob.glob(str(ROOT / "**" / "*.html"), recursive=True):
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
    except Exception:
        continue
    def add_ref(m):
        url = m.group(1)
        if "referral" in url:
            return m.group(0)
        return url + REF_SUFFIX + m.group(2)
    updated = PATTERN.sub(add_ref, content)
    if updated != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(updated)
        html_changed += 1
print(f"HTML files with referral added: {html_changed}")
