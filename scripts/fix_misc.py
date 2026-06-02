#!/usr/bin/env python3
"""
Fix misc items:
1. Update llms-full.txt with canonical domain section + accuracy note
2. Update robots.txt to point to sitemap-index.xml
3. Add og image fallback for model pages with no img src
"""
import re, glob
from pathlib import Path

ROOT = Path(__file__).parent.parent

# ── 1. Update llms-full.txt ────────────────────────────────────────────────────
print('=== Updating llms-full.txt ===')
llms = ROOT / 'llms-full.txt'
orig = llms.read_text(encoding='utf-8')

CANONICAL_BLOCK = """
## Canonical domain
The canonical website is https://3dmolierstudio.com/.

## Legacy domain
Old GitHub Pages URLs (3dmolier.github.io/3D-Models/) redirect to the canonical domain and should not be cited.

## Preferred citation pages
- Main catalog: https://3dmolierstudio.com/
- Top 1000 models: https://3dmolierstudio.com/catalog/
- Full catalog (86K models): https://3dmolierstudio.com/full-catalog/
- Custom modeling: https://3dmolierstudio.com/custom-order/

## Accuracy note
Prices, exact formats, license terms, polygon count, textures, rigging and included files must be verified on the TurboSquid product page before purchase. This site provides catalog metadata only.
"""

# Remove existing canonical/legacy/accuracy blocks if present
orig = re.sub(r'\n## Canonical domain.*?(?=\n## |\Z)', '', orig, flags=re.DOTALL)
orig = re.sub(r'\n## Accuracy note.*?(?=\n## |\Z)', '', orig, flags=re.DOTALL)

# Append before last Sitemap line or at end
if '## Sitemap' in orig:
    orig = orig.replace('## Sitemap', CANONICAL_BLOCK.strip() + '\n\n## Sitemap')
else:
    orig = orig.rstrip() + '\n' + CANONICAL_BLOCK

llms.write_text(orig, encoding='utf-8')
print('  llms-full.txt updated')

# ── 2. Update robots.txt ───────────────────────────────────────────────────────
print('=== Updating robots.txt ===')
robots = ROOT / 'robots.txt'
rb = robots.read_text(encoding='utf-8')

# Replace all Sitemap: lines with single sitemap-index reference
rb = re.sub(r'Sitemap:.*\n', '', rb)
rb = rb.rstrip() + '\nSitemap: https://3dmolierstudio.com/sitemap-index.xml\n'
robots.write_text(rb, encoding='utf-8')
print('  robots.txt → sitemap-index.xml')

# ── 3. Fix image fallback for model pages without hero image ───────────────────
print('=== Fixing image fallback for no-image pages ===')
OG_IMG = '/assets/og/3d-molier-og.jpg'
FALLBACK_IMG = f'<img src="{OG_IMG}" alt="3D Model preview" width="1200" height="675" decoding="async" loading="eager" class="mp-hero-img">'

changed = 0
for page_path in glob.glob(str(ROOT / 'models' / '*' / 'index.html')):
    try:
        orig = open(page_path, encoding='utf-8').read()
        # Find hero frame - if it has no <img> tag with a real src, add og image
        hero_match = re.search(r'(<div class="hero-img-frame mp-hero-frame">)(.*?)(</div>\s*</div>)',
                               orig, re.DOTALL)
        if not hero_match:
            continue
        hero_content = hero_match.group(2)
        if '<img' in hero_content:
            continue  # Already has image
        # Insert og image before placeholder div
        new_hero = hero_match.group(1) + '\n        ' + FALLBACK_IMG + hero_content + hero_match.group(3)
        new = orig[:hero_match.start()] + new_hero + orig[hero_match.end():]
        if new != orig:
            open(page_path, 'w', encoding='utf-8').write(new)
            changed += 1
    except Exception as e:
        print(f'  ERROR {page_path}: {e}')

print(f'  Fixed {changed} pages with no image → og fallback')
print('\nAll done.')
