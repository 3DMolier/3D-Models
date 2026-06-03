#!/usr/bin/env python3
"""
Comprehensive fix script:
1. sitemap.xml = sitemap-index.xml copy
2. robots.txt - allow /data/ files for Googlebot
3. Homepage: fix short category alt texts, unify handleImageError→imgErr
4. full-catalog + search: add SEO fallback block
5. Image sitemap: use local URLs for top-1000 models
6. Priority sitemaps: top1000, checkmate, high-price, longtail
7. sitemap-index.xml: include new priority sitemaps
8. Model pages: add "Additional preview renders" text (top-1000 only)
9. Unify handleImageError→imgErr across all HTML
"""
import json, re, glob, shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = 'https://3dmolierstudio.com'

# ── 1. sitemap.xml = copy of sitemap-index.xml ────────────────────────────────
print('=== 1. sitemap.xml → sitemap-index.xml ===')
shutil.copy2(ROOT / 'sitemap-index.xml', ROOT / 'sitemap.xml')
print('  Done')

# ── 2. robots.txt ─────────────────────────────────────────────────────────────
print('=== 2. robots.txt ===')
robots_content = """User-agent: *
Allow: /
Allow: /data/fc-index.json
Allow: /data/fc-img-index.json
Allow: /data/catalog.json
Allow: /data/fc-chunk-
Allow: /data/fc-img-chunk-
Disallow: /data/

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: https://3dmolierstudio.com/sitemap-index.xml
LLMs-txt: https://3dmolierstudio.com/llms.txt
LLMs-full: https://3dmolierstudio.com/llms-full.txt
"""
(ROOT / 'robots.txt').write_text(robots_content, encoding='utf-8')
print('  Done')

# ── 3. Homepage alt texts + imgErr ────────────────────────────────────────────
print('=== 3. Homepage alt texts ===')
ALT_MAP = {
    'alt="Vehicles"': 'alt="Vehicle 3D models — cars, trucks, buses and motorcycles"',
    'alt="Aircraft"': 'alt="Aircraft 3D models — airplanes, helicopters and drones"',
    'alt="Military Vehicles"': 'alt="Military Vehicle 3D models for defense and simulation"',
    'alt="Ships"': 'alt="Ship and boat 3D models — naval vessels and watercraft"',
    'alt="Medical"': 'alt="Medical 3D models — anatomy, surgery and healthcare visualization"',
    'alt="Architecture"': 'alt="Architecture 3D models — buildings and landmarks"',
    'alt="Characters & People"': 'alt="Character 3D models — people and human anatomy"',
    'alt="Animals"': 'alt="Animal 3D models — creatures and wildlife"',
    'alt="Nature"': 'alt="Nature 3D models — plants, trees and landscapes"',
    'alt="Furniture"': 'alt="Furniture 3D models — interior and home decor"',
    'alt="Electronics"': 'alt="Electronics 3D models — gadgets and devices"',
    'alt="Clothing"': 'alt="Clothing 3D models — fashion and accessories"',
    'alt="Food"': 'alt="Food and beverage 3D models"',
    'alt="Industrial"': 'alt="Industrial equipment 3D models"',
}
idx = ROOT / 'index.html'
txt = idx.read_text(encoding='utf-8')
for old, new in ALT_MAP.items():
    txt = txt.replace(old, new)
txt = txt.replace('onerror="handleImageError(this)"', 'onerror="imgErr(this)"')
idx.write_text(txt, encoding='utf-8')
print('  Done')

# ── 4. SEO fallback in full-catalog and search ────────────────────────────────
print('=== 4. SEO fallback blocks ===')
FC_FALLBACK = '''
<!-- Static SEO fallback for crawlers without JS -->
<section class="seo-fallback" aria-hidden="true" style="padding:2rem 1rem;max-width:900px;margin:0 auto;">
  <h2 style="font-size:1.1rem;margin-bottom:1rem;">Popular 3D model categories</h2>
  <ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:0.5rem 1.5rem;">
    <li><a href="/categories/vehicles/">Vehicle 3D Models</a></li>
    <li><a href="/categories/aircraft/">Aircraft 3D Models</a></li>
    <li><a href="/categories/military-vehicles/">Military Vehicle 3D Models</a></li>
    <li><a href="/categories/medical-3d-models/">Medical 3D Models</a></li>
    <li><a href="/categories/ships/">Ship 3D Models</a></li>
    <li><a href="/categories/architecture-landmarks/">Architecture 3D Models</a></li>
    <li><a href="/categories/characters-people/">Character 3D Models</a></li>
    <li><a href="/categories/nature-plants/">Nature 3D Models</a></li>
    <li><a href="/categories/industrial-equipment/">Industrial 3D Models</a></li>
    <li><a href="/categories/electronics-gadgets/">Electronics 3D Models</a></li>
  </ul>
  <h2 style="font-size:1.1rem;margin:1.5rem 0 1rem;">Featured models</h2>
  <ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:0.5rem 1.5rem;">
    <li><a href="/models/tesla-model-3-1214116/">Tesla Model 3 3D Model</a></li>
    <li><a href="/models/airbus-a320-generic-1230754/">Airbus A320 Generic 3D Model</a></li>
    <li><a href="/models/2024-tesla-cybertruck-2181273/">Tesla Cybertruck 3D Model</a></li>
    <li><a href="/models/male-full-body-anatomy-and-skin-1266820/">Male Full Body Anatomy 3D Model</a></li>
    <li><a href="/models/sikorsky-uh-60-black-hawk-us-military-utility-helicopter-1099882/">UH-60 Black Hawk Helicopter 3D Model</a></li>
    <li><a href="/models/eiffel-tower-1289178/">Eiffel Tower 3D Model</a></li>
  </ul>
  <p style="margin-top:1rem;font-size:0.9rem;">Browse all <a href="/full-catalog/">86,000+ 3D models</a> or <a href="/catalog/">top 1,000 best-sellers</a>.</p>
</section>
'''

SEARCH_FALLBACK = '''
<!-- Static SEO fallback for crawlers without JS -->
<section class="seo-fallback" aria-hidden="true" style="padding:2rem 1rem;max-width:900px;margin:0 auto;">
  <h2 style="font-size:1.1rem;margin-bottom:1rem;">Browse by category</h2>
  <ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:0.5rem 1.5rem;">
    <li><a href="/categories/vehicles/">Vehicle 3D Models</a></li>
    <li><a href="/categories/aircraft/">Aircraft 3D Models</a></li>
    <li><a href="/categories/military-vehicles/">Military 3D Models</a></li>
    <li><a href="/categories/medical-3d-models/">Medical 3D Models</a></li>
    <li><a href="/categories/ships/">Ship 3D Models</a></li>
    <li><a href="/categories/architecture-landmarks/">Architecture 3D Models</a></li>
    <li><a href="/categories/characters-people/">Character 3D Models</a></li>
    <li><a href="/categories/nature-plants/">Nature 3D Models</a></li>
    <li><a href="/categories/industrial-equipment/">Industrial 3D Models</a></li>
    <li><a href="/categories/electronics-gadgets/">Electronics 3D Models</a></li>
  </ul>
  <p style="margin-top:1rem;font-size:0.9rem;"><a href="/full-catalog/">Browse all 86,000+ models</a></p>
</section>
'''

for page, fallback in [('full-catalog/index.html', FC_FALLBACK), ('search/index.html', SEARCH_FALLBACK)]:
    p = ROOT / page
    txt = p.read_text(encoding='utf-8')
    if 'seo-fallback' not in txt:
        txt = txt.replace('<script src="/assets/js/site.min.js', fallback + '\n<script src="/assets/js/site.min.js', 1)
        p.write_text(txt, encoding='utf-8')
        print(f'  Added fallback to {page}')
    else:
        print(f'  {page} already has fallback')

# ── 5. Image sitemap: local URLs for top-1000 ─────────────────────────────────
print('=== 5. Image sitemap: local URLs for top-1000 ===')
local_slugs = {f.stem for f in (ROOT / 'large_images').glob('*.webp')}

def patch_image_sitemap(path):
    txt = path.read_text(encoding='utf-8')
    def replace_loc(m):
        page_loc = m.group(1)
        image_loc = m.group(2)
        # Extract slug from page URL
        slug_m = re.search(r'/models/([^/]+)/', page_loc)
        if slug_m and slug_m.group(1) in local_slugs:
            new_img = f'{BASE}/large_images/{slug_m.group(1)}.webp'
            return m.group(0).replace(image_loc, new_img)
        return m.group(0)
    new = re.sub(
        r'<loc>([^<]+/models/[^<]+)</loc>.*?<image:loc>([^<]+)</image:loc>',
        replace_loc, txt, flags=re.DOTALL
    )
    if new != txt:
        path.write_text(new, encoding='utf-8')
        return True
    return False

c1 = patch_image_sitemap(ROOT / 'sitemaps' / 'image-sitemap-1.xml')
c2 = patch_image_sitemap(ROOT / 'sitemaps' / 'image-sitemap-2.xml')
print(f'  image-sitemap-1: {"patched" if c1 else "no change"}, image-sitemap-2: {"patched" if c2 else "no change"}')

# ── 6. Priority sitemaps ───────────────────────────────────────────────────────
print('=== 6. Priority sitemaps ===')

def make_slug(name, pid):
    s = name.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-') + '-' + str(pid)

def url_entry(loc, prio='0.8'):
    return f'  <url>\n    <loc>{loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>{prio}</priority>\n  </url>'

def write_sm(path, entries):
    path.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '\n'.join(entries) + '\n</urlset>\n', encoding='utf-8')

ids, names, prices, certs = [], [], [], []
for i in range(20):
    p = ROOT / 'data' / f'fc-chunk-{i}.json'
    if not p.exists(): break
    c = json.loads(p.read_text(encoding='utf-8'))
    ids.extend(c.get('i',[])); names.extend(c.get('n',[])); prices.extend(c.get('p',[])); certs.extend(c.get('c',[]))

top1000_slugs = local_slugs  # same 996 slugs

top1000_entries, checkmate_entries, hiprice_entries, longtail = [], [], [], []
top1000_seen, checkmate_seen = set(), set()

for pid, name, price, cert in zip(ids, names, prices, certs):
    slug = make_slug(name, pid)
    url = f'{BASE}/models/{slug}/'
    if slug in top1000_slugs and slug not in top1000_seen:
        top1000_entries.append(url_entry(url, '0.9'))
        top1000_seen.add(slug)
    elif cert == 2 and slug not in checkmate_seen:
        checkmate_entries.append(url_entry(url, '0.8'))
        checkmate_seen.add(slug)
    elif price >= 100:
        hiprice_entries.append(url_entry(url, '0.7'))
    else:
        longtail.append(url_entry(url, '0.5'))

LIMIT = 50000
write_sm(ROOT / 'sitemaps' / 'sitemap-models-top1000.xml', top1000_entries)
write_sm(ROOT / 'sitemaps' / 'sitemap-models-checkmate.xml', checkmate_entries[:LIMIT])
write_sm(ROOT / 'sitemaps' / 'sitemap-models-high-price.xml', hiprice_entries[:LIMIT])
write_sm(ROOT / 'sitemaps' / 'sitemap-models-longtail-1.xml', longtail[:LIMIT])
write_sm(ROOT / 'sitemaps' / 'sitemap-models-longtail-2.xml', longtail[LIMIT:LIMIT*2])
print(f'  top1000:{len(top1000_entries)} checkmate:{len(checkmate_entries[:LIMIT])} high-price:{len(hiprice_entries[:LIMIT])} longtail:{len(longtail)}')

# ── 7. Update sitemap-index.xml ────────────────────────────────────────────────
print('=== 7. sitemap-index.xml ===')
all_sitemaps = [
    'sitemaps/sitemap-main.xml',
    'sitemaps/sitemap-categories.xml',
    'sitemaps/sitemap-collections.xml',
    'sitemaps/sitemap-industries.xml',
    'sitemaps/sitemap-models-top1000.xml',
    'sitemaps/sitemap-models-checkmate.xml',
    'sitemaps/sitemap-models-high-price.xml',
    'sitemaps/sitemap-models-longtail-1.xml',
    'sitemaps/sitemap-models-longtail-2.xml',
    'sitemaps/image-sitemap-1.xml',
    'sitemaps/image-sitemap-2.xml',
]
sm_entries = '\n'.join(f'  <sitemap>\n    <loc>{BASE}/{f}</loc>\n  </sitemap>' for f in all_sitemaps)
idx_content = f'<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sm_entries}\n</sitemapindex>\n'
(ROOT / 'sitemap-index.xml').write_text(idx_content, encoding='utf-8')
shutil.copy2(ROOT / 'sitemap-index.xml', ROOT / 'sitemap.xml')
print('  Done, sitemap.xml also updated')

# ── 8. Model pages: "Additional preview renders" text (top-1000 only) ──────────
print('=== 8. Additional preview renders text ===')
EXTRA_TEXT = '<p class="mp-about-extra">Additional preview renders, formats, file details and license information are available on the TurboSquid product page.</p>'
changed = 0
for slug in local_slugs:
    page = ROOT / 'models' / slug / 'index.html'
    if not page.exists(): continue
    txt = page.read_text(encoding='utf-8')
    if 'mp-about-extra' in txt: continue
    # Insert after </p> in the description section or before </section>
    if 'mp-desc' in txt:
        txt = re.sub(r'(</div>\s*</section>\s*<!-- Related)', EXTRA_TEXT + r'\n\1', txt, count=1)
    elif 'mp-info-col' in txt:
        txt = txt.replace('</div>\n      </div>\n    </div>\n  </div>\n</section>',
                          EXTRA_TEXT + '\n</div>\n      </div>\n    </div>\n  </div>\n</section>', 1)
    if 'mp-about-extra' in txt:
        page.write_text(txt, encoding='utf-8')
        changed += 1
print(f'  Updated {changed} top-1000 pages')

# ── 9. Unify handleImageError → imgErr in ALL html files ──────────────────────
print('=== 9. Unify handleImageError → imgErr ===')
changed = 0
for f in glob.glob(str(ROOT / '**' / '*.html'), recursive=True):
    try:
        orig = open(f, encoding='utf-8').read()
        if 'handleImageError' not in orig: continue
        new = orig.replace('onerror="handleImageError(this)"', 'onerror="imgErr(this)"')
        if new != orig:
            open(f, 'w', encoding='utf-8').write(new)
            changed += 1
    except: pass
print(f'  Fixed {changed} files')

print('\nAll done.')
