#!/usr/bin/env python3
"""Replace 3dmolierstudio.com with 3dmolierstudio.com across all files."""
import os, glob
from pathlib import Path

ROOT = Path(__file__).parent.parent
OLD = '3dmolierstudio.com'
NEW = '3dmolierstudio.com'

def fix(path):
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        if OLD not in orig:
            return 0
        with open(path, 'w', encoding='utf-8') as f:
            f.write(orig.replace(OLD, NEW))
        return 1
    except Exception as e:
        print(f'ERROR {path}: {e}')
        return 0

# HTML
html_files = glob.glob(str(ROOT / '**' / '*.html'), recursive=True)
print(f'Processing {len(html_files)} HTML files...')
changed = sum(fix(p) for p in html_files)
print(f'HTML updated: {changed}')

# JS
js_files = glob.glob(str(ROOT / 'assets' / 'js' / '*.js'))
changed = sum(fix(p) for p in js_files)
print(f'JS updated: {changed}')

# JSON data
json_files = (
    glob.glob(str(ROOT / 'data' / '*.json')) +
    glob.glob(str(ROOT / 'data' / 'categories' / '*.json'))
)
changed = sum(fix(p) for p in json_files)
print(f'JSON updated: {changed}')

# robots.txt, sitemap.xml, scripts
for p in [ROOT/'robots.txt', ROOT/'sitemap.xml'] + list((ROOT/'scripts').glob('*.py')):
    if p.exists():
        fix(str(p))

print('\nDone.')
