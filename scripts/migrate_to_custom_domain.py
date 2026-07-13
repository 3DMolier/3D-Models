#!/usr/bin/env python3
"""
Migrate site from / base path to custom domain root.
Replaces all / → / and github.io absolute URLs → new domain.
"""
import os, re, glob, json
from pathlib import Path

ROOT = Path(__file__).parent.parent
OLD_PATH = '/'
NEW_PATH = '/'
OLD_URL  = 'https://3dmolierstudio.com'
NEW_URL  = 'https://3dmolierstudio.com'

def replace_content(content):
    content = content.replace(OLD_URL, NEW_URL)
    content = content.replace(OLD_PATH, NEW_PATH)
    return content

# ── HTML files ────────────────────────────────────────────────────────────────
html_changed = 0
html_files = glob.glob(str(ROOT / '**' / '*.html'), recursive=True)
print(f'Processing {len(html_files)} HTML files...')
for path in html_files:
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        updated = replace_content(orig)
        if updated != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated)
            html_changed += 1
    except Exception as e:
        print(f'  ERROR {path}: {e}')
print(f'HTML updated: {html_changed}')

# ── JS source files ───────────────────────────────────────────────────────────
js_changed = 0
for path in glob.glob(str(ROOT / 'assets' / 'js' / '*.js')):
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        updated = replace_content(orig)
        if updated != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated)
            js_changed += 1
    except Exception as e:
        print(f'  ERROR {path}: {e}')
print(f'JS files updated: {js_changed}')

# ── data JSON files (img paths like /previews/...) ─────────────────
json_changed = 0
json_patterns = [
    str(ROOT / 'data' / 'catalog.json'),
    str(ROOT / 'data' / 'collections.json'),
] + glob.glob(str(ROOT / 'data' / 'categories' / '*.json'))
for path in json_patterns:
    if not os.path.exists(path):
        continue
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        updated = orig.replace(OLD_PATH, NEW_PATH)
        if updated != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated)
            json_changed += 1
    except Exception as e:
        print(f'  ERROR {path}: {e}')
print(f'JSON files updated: {json_changed}')

# ── robots.txt ────────────────────────────────────────────────────────────────
robots = ROOT / 'robots.txt'
if robots.exists():
    orig = robots.read_text(encoding='utf-8')
    updated = replace_content(orig)
    updated = updated.replace('Disallow: /data/', 'Disallow: /data/')
    if updated != orig:
        robots.write_text(updated, encoding='utf-8')
        print('robots.txt updated')

# ── sitemap.xml ───────────────────────────────────────────────────────────────
sitemap = ROOT / 'sitemap.xml'
if sitemap.exists():
    orig = sitemap.read_text(encoding='utf-8')
    updated = replace_content(orig)
    if updated != orig:
        sitemap.write_text(updated, encoding='utf-8')
        print('sitemap.xml updated')

print('\nDone.')
