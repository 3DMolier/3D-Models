#!/usr/bin/env python3
"""
Generate complete sitemap structure:
  sitemap-index.xml
  sitemaps/sitemap-main.xml
  sitemaps/sitemap-categories.xml
  sitemaps/sitemap-industries.xml
  sitemaps/sitemap-collections.xml
  sitemaps/sitemap-models-1.xml
  sitemaps/sitemap-models-2.xml
  sitemaps/image-sitemap-1.xml  (move from root)
  sitemaps/image-sitemap-2.xml  (move from root)
Convert root image-sitemap.xml → sitemap index for image sitemaps.
"""
import json, re, glob, shutil
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).parent.parent
BASE = 'https://3dmolierstudio.com'
SITEMAPS_DIR = ROOT / 'sitemaps'
SITEMAPS_DIR.mkdir(exist_ok=True)

def url_entry(loc, lastmod='2026-05-15', changefreq='monthly', priority='0.8'):
    return f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>{changefreq}</changefreq>\n    <priority>{priority}</priority>\n  </url>'

def write_sitemap(path, entries, ns=''):
    ns_attr = f'\n        {ns}' if ns else ''
    header = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"{ns_attr}>\n'
    path.write_text(header + '\n'.join(entries) + '\n</urlset>\n', encoding='utf-8')

def make_slug(name, pid):
    s = name.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-') + '-' + str(pid)

# ── Parse existing sitemap.xml ────────────────────────────────────────────────
print('Reading existing sitemap.xml...')
tree = ET.parse(ROOT / 'sitemap.xml')
ns_map = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
all_urls = [(el.find('sm:loc', ns_map).text,
             el.findtext('sm:lastmod', '2026-05-15', ns_map),
             el.findtext('sm:changefreq', 'monthly', ns_map),
             el.findtext('sm:priority', '0.8', ns_map))
            for el in tree.findall('sm:url', ns_map)]

main_urls, cat_urls, coll_urls, ind_urls, old_model_urls = [], [], [], [], []
for loc, lm, cf, pr in all_urls:
    if '/categories/' in loc:   cat_urls.append((loc,lm,cf,pr))
    elif '/collections/' in loc: coll_urls.append((loc,lm,cf,pr))
    elif '/industries/' in loc:  ind_urls.append((loc,lm,cf,pr))
    elif '/models/' in loc:      old_model_urls.append((loc,lm,cf,pr))
    else:                         main_urls.append((loc,lm,cf,pr))

print(f'  main:{len(main_urls)} cats:{len(cat_urls)} coll:{len(coll_urls)} ind:{len(ind_urls)} models:{len(old_model_urls)}')

def entries_from(url_list):
    return [url_entry(loc, lm, cf, pr) for loc, lm, cf, pr in url_list]

# ── 1. sitemap-main.xml ───────────────────────────────────────────────────────
write_sitemap(SITEMAPS_DIR / 'sitemap-main.xml', entries_from(main_urls))
print(f'Wrote sitemaps/sitemap-main.xml ({len(main_urls)} URLs)')

# ── 2. sitemap-categories.xml ─────────────────────────────────────────────────
write_sitemap(SITEMAPS_DIR / 'sitemap-categories.xml', entries_from(cat_urls))
print(f'Wrote sitemaps/sitemap-categories.xml ({len(cat_urls)} URLs)')

# ── 3. sitemap-collections.xml ────────────────────────────────────────────────
write_sitemap(SITEMAPS_DIR / 'sitemap-collections.xml', entries_from(coll_urls))
print(f'Wrote sitemaps/sitemap-collections.xml ({len(coll_urls)} URLs)')

# ── 4. sitemap-industries.xml ─────────────────────────────────────────────────
write_sitemap(SITEMAPS_DIR / 'sitemap-industries.xml', entries_from(ind_urls))
print(f'Wrote sitemaps/sitemap-industries.xml ({len(ind_urls)} URLs)')

# ── 5. Generate all model URLs from fc-chunks ─────────────────────────────────
print('Loading fc-chunks for model URLs...')
ids, names = [], []
for i in range(20):
    p = ROOT / 'data' / f'fc-chunk-{i}.json'
    if not p.exists(): break
    c = json.loads(p.read_text(encoding='utf-8'))
    ids.extend(c.get('i', []))
    names.extend(c.get('n', []))
print(f'  {len(ids)} models loaded')

model_entries = []
for pid, name in zip(ids, names):
    slug = make_slug(name, pid)
    model_entries.append(url_entry(f'{BASE}/models/{slug}/', '2026-05-15', 'monthly', '0.7'))

LIMIT = 50000
write_sitemap(SITEMAPS_DIR / 'sitemap-models-1.xml', model_entries[:LIMIT])
print(f'Wrote sitemaps/sitemap-models-1.xml ({len(model_entries[:LIMIT])} URLs)')
write_sitemap(SITEMAPS_DIR / 'sitemap-models-2.xml', model_entries[LIMIT:])
print(f'Wrote sitemaps/sitemap-models-2.xml ({len(model_entries[LIMIT:])} URLs)')

# ── 6. Move image sitemaps to sitemaps/ ───────────────────────────────────────
for fname in ['image-sitemap-1.xml', 'image-sitemap-2.xml']:
    src = ROOT / fname
    if src.exists():
        shutil.copy2(src, SITEMAPS_DIR / fname)
        print(f'Copied {fname} → sitemaps/{fname}')

# ── 7. Convert root image-sitemap.xml to sitemap index ───────────────────────
img_index = f'''<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>{BASE}/sitemaps/image-sitemap-1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>{BASE}/sitemaps/image-sitemap-2.xml</loc>
  </sitemap>
</sitemapindex>
'''
(ROOT / 'image-sitemap.xml').write_text(img_index, encoding='utf-8')
print('Converted image-sitemap.xml → sitemap index')

# ── 8. Write sitemap-index.xml ────────────────────────────────────────────────
sitemap_files = [
    'sitemaps/sitemap-main.xml',
    'sitemaps/sitemap-categories.xml',
    'sitemaps/sitemap-collections.xml',
    'sitemaps/sitemap-industries.xml',
    'sitemaps/sitemap-models-1.xml',
    'sitemaps/sitemap-models-2.xml',
    'sitemaps/image-sitemap-1.xml',
    'sitemaps/image-sitemap-2.xml',
]
sm_entries = '\n'.join(f'  <sitemap>\n    <loc>{BASE}/{f}</loc>\n  </sitemap>' for f in sitemap_files)
(ROOT / 'sitemap-index.xml').write_text(
    f'<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sm_entries}\n</sitemapindex>\n',
    encoding='utf-8'
)
print('Wrote sitemap-index.xml')

print('\nDone.')
