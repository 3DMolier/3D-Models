"""Update catalog.json img field to use local /previews/{slug}.webp where downloaded."""
import json, os, pathlib

ROOT = pathlib.Path(__file__).parent.parent
PREV_DIR = ROOT / 'previews'
CATALOG = ROOT / 'data' / 'catalog.json'

with open(CATALOG, encoding='utf-8') as f:
    models = json.load(f)

updated = 0
for m in models:
    slug = m.get('s', '')
    local = PREV_DIR / f'{slug}.webp'
    if local.exists():
        m['img'] = f'/previews/{slug}.webp'
        updated += 1

with open(CATALOG, 'w', encoding='utf-8') as f:
    json.dump(models, f, ensure_ascii=False, separators=(',', ':'))

print(f'Updated {updated}/{len(models)} catalog entries to local previews')
