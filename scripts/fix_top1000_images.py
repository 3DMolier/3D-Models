#!/usr/bin/env python3
"""Replace TurboSquid image URLs with local WebP in top-1000 model pages."""
import re, glob
from pathlib import Path

ROOT = Path(__file__).parent.parent
LOCAL_IMGS = ROOT / 'large_images'

# Build map: slug → local path
local = {}
for f in LOCAL_IMGS.glob('*.webp'):
    slug = f.stem  # e.g. "2-iron-golf-club-generic-924303"
    local[slug] = f'/large_images/{f.name}'

print(f'Found {len(local)} local WebP images')

changed = 0
for slug, local_path in local.items():
    page = ROOT / 'models' / slug / 'index.html'
    if not page.exists():
        continue
    orig = page.read_text(encoding='utf-8')

    # Replace hero img src (TurboSquid URL) with local WebP
    # Pattern: <img src="https://p.turbosquid.com/..." ... class="mp-hero-img"
    new = re.sub(
        r'(<img\s[^>]*class="mp-hero-img"[^>]*)\bsrc="https?://[^"]*"',
        lambda m: m.group(1) + f'src="{local_path}"',
        orig
    )
    # Also try: src="..." before class (order varies)
    new = re.sub(
        r'<img\s+src="https?://[^"]*"([^>]*class="mp-hero-img")',
        lambda m: f'<img src="{local_path}"' + m.group(1),
        new
    )
    # Update og:image meta tag
    new = re.sub(
        r'(<meta property="og:image" content=")[^"]*(")',
        lambda m: m.group(1) + f'https://3dmolierstudio.com{local_path}' + m.group(2),
        new
    )
    # Update twitter:image
    new = re.sub(
        r'(<meta name="twitter:image" content=")[^"]*(")',
        lambda m: m.group(1) + f'https://3dmolierstudio.com{local_path}' + m.group(2),
        new
    )

    if new != orig:
        page.write_text(new, encoding='utf-8')
        changed += 1

print(f'Updated {changed} model pages with local images')
print('Done.')
