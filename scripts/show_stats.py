import csv, json
from pathlib import Path
from collections import Counter

DATA = Path(__file__).parent.parent / "data"

with open(DATA / "models_master.csv", encoding="utf-8") as f:
    master = list(csv.DictReader(f))
with open(DATA / "top_models.csv", encoding="utf-8") as f:
    top = list(csv.DictReader(f))
with open(DATA / "collections.json", encoding="utf-8") as f:
    cols = json.load(f)

all_cat  = Counter(r["category"] for r in master)
top_cat  = Counter(r["category"] for r in top)
top_cert = Counter(r["certification"] for r in top)

print("=== ALL MODELS BY CATEGORY ===")
for cat, cnt in all_cat.most_common():
    print(f"  {cat:<30} {cnt:>6,}")

print("\n=== TOP 1000 BY CATEGORY ===")
for cat, cnt in top_cat.most_common():
    print(f"  {cat:<30} {cnt:>4}")

print("\n=== TOP 1000 BY CERTIFICATION ===")
for cert, cnt in top_cert.most_common():
    print(f"  {cert:<30} {cnt:>4}")

print("\n=== TOP 10 MODELS (by score) ===")
top_sorted = sorted(top, key=lambda r: float(r["priority_score"]), reverse=True)[:10]
for r in top_sorted:
    score = r["priority_score"]
    sales = int(float(r["sales_qty"]))
    price = int(float(r["price"]))
    cat   = r["category"]
    name  = r["product_name"][:50]
    print(f"  score={score}  sales={sales:>3}  ${price:>5}  {cat:<22}  {name}")

print("\n=== COLLECTIONS ===")
for c in cols:
    slug  = c["collection_slug"]
    total = c["total_matching_models"]
    feat  = len(c["model_ids"])
    print(f"  {slug:<48}  {total:>5} total  -> {feat} featured")

print()
print(f"search_index.json : {(DATA / 'search_index.json').stat().st_size/1e6:.1f} MB")
print(f"models_master.csv : {(DATA / 'models_master.csv').stat().st_size/1e6:.1f} MB")
print(f"top_models.csv    : {(DATA / 'top_models.csv').stat().st_size/1e6:.1f} MB")
