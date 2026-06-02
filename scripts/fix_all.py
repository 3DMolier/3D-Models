#!/usr/bin/env python3
"""
Fix all issues:
1. LLM files: replace old domain with new
2. HTML files: add referral to TurboSquid artist links
3. Regenerate image-sitemap.xml for all 86K models
"""
import glob, json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = 'https://3dmolierstudio.com'

# ── 1. Fix LLM files ──────────────────────────────────────────────────────────
print('=== Fixing LLM files ===')
OLD_DOMAIN = 'https://3dmolier.github.io/3D-Models'
for fname in ['llms.txt', 'llms-full.txt']:
    p = ROOT / fname
    if not p.exists():
        continue
    orig = p.read_text(encoding='utf-8')
    updated = orig.replace(OLD_DOMAIN + '/', BASE + '/').replace(OLD_DOMAIN, BASE)
    if updated != orig:
        p.write_text(updated, encoding='utf-8')
        print(f'  Updated: {fname}')
    else:
        print(f'  Already OK: {fname}')

# ── 2. Add referral to TurboSquid artist links in HTML/txt files ──────────────
print('\n=== Adding referral to artist links ===')
ARTIST_OLD = 'turbosquid.com/Search/Artists/3d_molier-International'
ARTIST_NEW = 'turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio'

html_files = glob.glob(str(ROOT / '**' / '*.html'), recursive=True)
txt_files = [str(ROOT / 'llms.txt'), str(ROOT / 'llms-full.txt')]
all_files = html_files + txt_files

changed = 0
for path in all_files:
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        if ARTIST_OLD not in orig:
            continue
        # Only replace links that don't already have ?referral
        updated = re.sub(
            r'(turbosquid\.com/Search/Artists/3d_molier-International)(?!\?referral)',
            r'\1?referral=3d_molier-studio',
            orig
        )
        if updated != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated)
            changed += 1
    except Exception as e:
        print(f'  ERROR {path}: {e}')
print(f'  Updated {changed} files with referral links')

# ── 3. Generate image-sitemap from all fc-chunks ──────────────────────────────
print('\n=== Building image sitemap ===')

def make_slug(name, pid):
    s = name.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-') + '-' + str(pid)

# Load all fc-chunks
print('  Loading model data...')
ids, names = [], []
for i in range(20):
    p = ROOT / 'data' / f'fc-chunk-{i}.json'
    if not p.exists():
        break
    chunk = json.loads(p.read_text(encoding='utf-8'))
    ids.extend(chunk.get('i', []))
    names.extend(chunk.get('n', []))
print(f'  Loaded {len(ids)} models')

# Load all fc-img-chunks
print('  Loading image data...')
imgs = {}
for p in sorted(ROOT.glob('data/fc-img-chunk-*.json')):
    chunk = json.loads(p.read_text(encoding='utf-8'))
    imgs.update({str(k): v for k, v in chunk.items()})
print(f'  Loaded {len(imgs)} images')

# Build sitemap entries
entries = []
for pid, name in zip(ids, names):
    img_url = imgs.get(str(pid))
    if not img_url:
        continue
    slug = make_slug(name, pid)
    page_url = f'{BASE}/models/{slug}/'
    title = name + ('' if re.search(r'3d\s*model', name, re.I) else ' 3D Model')
    title = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    img_url_esc = img_url.replace('&', '&amp;')
    entries.append(f'''  <url>
    <loc>{page_url}</loc>
    <image:image>
      <image:loc>{img_url_esc}</image:loc>
      <image:title>{title}</image:title>
      <image:caption>3D model by 3D Molier. Available on TurboSquid.</image:caption>
    </image:image>
  </url>''')

print(f'  {len(entries)} entries with images')

# Google limit: 50,000 URLs per sitemap file
LIMIT = 50000
chunks = [entries[i:i+LIMIT] for i in range(0, len(entries), LIMIT)]

HEADER = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
'''
FOOTER = '</urlset>\n'

sitemap_files = []
if len(chunks) == 1:
    out = ROOT / 'image-sitemap.xml'
    out.write_text(HEADER + '\n'.join(chunks[0]) + '\n' + FOOTER, encoding='utf-8')
    sitemap_files.append('image-sitemap.xml')
    print(f'  Wrote image-sitemap.xml ({len(chunks[0])} entries)')
else:
    for n, chunk in enumerate(chunks, 1):
        fname = f'image-sitemap-{n}.xml'
        out = ROOT / fname
        out.write_text(HEADER + '\n'.join(chunk) + '\n' + FOOTER, encoding='utf-8')
        sitemap_files.append(fname)
        print(f'  Wrote {fname} ({len(chunk)} entries)')

# ── 4. Update image-sitemap reference in sitemap.xml ─────────────────────────
print('\n=== Updating sitemap.xml ===')
sm = ROOT / 'sitemap.xml'
sm_text = sm.read_text(encoding='utf-8')

# Remove old image-sitemap references
sm_text = re.sub(r'\s*<sitemap>\s*<loc>[^<]*image-sitemap[^<]*</loc>\s*</sitemap>', '', sm_text)

# Add new references before </sitemapindex> or append to <urlset>
new_refs = '\n'.join(
    f'  <sitemap><loc>{BASE}/{f}</loc></sitemap>'
    for f in sitemap_files
)
if '</sitemapindex>' in sm_text:
    sm_text = sm_text.replace('</sitemapindex>', new_refs + '\n</sitemapindex>')
else:
    # Regular sitemap, just leave as-is (image sitemaps submitted separately)
    print('  sitemap.xml is not a sitemap index, image sitemaps to be submitted manually')

sm.write_text(sm_text, encoding='utf-8')
print('  sitemap.xml updated')

print('\nAll done.')
