"""
Comprehensive HTML fix script — applies all link/chip/badge fixes across site.
Run from repo root: python scripts/_fix_all_2.py
"""
import os, re, glob, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD_CTA = "https://www.turbosquid.com/Search/3D-Models?include=true&media_typeid=2&artist_screenname=3d_molier-studio&referral=3d_molier-studio"
NEW_CTA = "https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"

OLD_VEH = "https://www.turbosquid.com/Search/vehicle?referral=3d_molier-studio"
NEW_VEH = "https://www.turbosquid.com/Search/Index.cfm?keyword=Vehicle&media_typeid=2&include_artist=3d_molier-International"

OLD_AIR = "https://www.turbosquid.com/Search/aircraft?referral=3d_molier-studio"
NEW_AIR = "https://www.turbosquid.com/Search/Index.cfm?keyword=aircraft&media_typeid=2&include_artist=3d_molier-International"

OLD_MED = "https://www.turbosquid.com/Search/medical?referral=3d_molier-studio"
NEW_MED = "https://www.turbosquid.com/Search/Index.cfm?keyword=medical&media_typeid=2&include_artist=3d_molier-International"

SEARCH_BASE = "/search/?q="

def encode_q(text):
    return urllib.parse.quote_plus(text)

def chip_span_to_link(text, css_class):
    q = encode_q(text)
    return f'<a href="{SEARCH_BASE}{q}" class="{css_class}">{text}</a>'

def replace_use_case_chips(content):
    """Replace spans in the Use Cases mp-chip-row-8 with search links."""
    def repl(m):
        prefix = m.group(1)
        chips  = m.group(2)
        suffix = m.group(3)
        chips = re.sub(
            r'<span class="chip chip--sm">(.*?)</span>',
            lambda sm: chip_span_to_link(sm.group(1), "chip chip--sm"),
            chips
        )
        return prefix + chips + suffix
    return re.sub(
        r'(Use Cases</div><div class="mp-chip-row-8">)(.*?)(</div></div>)',
        repl, content, flags=re.DOTALL
    )

def replace_keyword_chips(content):
    """Replace spans in the Search Keywords mp-chip-row with search links."""
    def repl(m):
        prefix = m.group(1)
        chips  = m.group(2)
        suffix = m.group(3)
        chips = re.sub(
            r'<span class="chip chip--kw">(.*?)</span>',
            lambda sm: chip_span_to_link(sm.group(1), "chip chip--kw"),
            chips
        )
        return prefix + chips + suffix
    return re.sub(
        r'(Search Keywords</div><div class="mp-chip-row">)(.*?)(</div></div>)',
        repl, content, flags=re.DOTALL
    )

def replace_cat_tags(content):
    """Replace plain span chips in .cat-tags with search links."""
    def repl(m):
        prefix = m.group(1)
        inner  = m.group(2)
        suffix = m.group(3)
        inner = re.sub(
            r'<span class="chip">(.*?)</span>',
            lambda sm: chip_span_to_link(sm.group(1), "chip"),
            inner
        )
        return prefix + inner + suffix
    return re.sub(
        r'(<div class="cat-tags">)(.*?)(</div>)',
        repl, content, flags=re.DOTALL
    )

def fix_homepage(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    original = content

    # Remove hero-badge div
    content = re.sub(
        r'\s*<div class="hero-badge">\s*<span class="hero-badge-dot"></span>\s*<span class="hero-badge-text">88,000\+ Professional 3D Models</span>\s*</div>\n?',
        '\n', content
    )

    # Fix footer Vehicle / Aircraft / Medical links
    content = content.replace(OLD_VEH, NEW_VEH)
    content = content.replace(OLD_AIR, NEW_AIR)
    content = content.replace(OLD_MED, NEW_MED)

    # Fix nav-cta
    content = content.replace(OLD_CTA, NEW_CTA)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed homepage: {path}")

def process_html(path, is_model=False, is_category=False):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    original = content

    # 1. nav-cta URL fix (all pages)
    content = content.replace(OLD_CTA, NEW_CTA)

    # 2. Vehicle / Aircraft / Medical footer links (all pages that have them)
    content = content.replace(OLD_VEH, NEW_VEH)
    content = content.replace(OLD_AIR, NEW_AIR)
    content = content.replace(OLD_MED, NEW_MED)

    # 3. Model pages: use-case chips + keyword chips
    if is_model:
        content = replace_use_case_chips(content)
        content = replace_keyword_chips(content)

    # 4. Category pages: cat-tags chips
    if is_category:
        content = replace_cat_tags(content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    changed = 0

    # Homepage
    idx = os.path.join(ROOT, 'index.html')
    fix_homepage(idx)

    # All html files — nav-cta + footer link fixes
    patterns = ['**/*.html']
    all_html = []
    for pat in patterns:
        all_html.extend(glob.glob(os.path.join(ROOT, pat), recursive=True))

    for path in all_html:
        norm = path.replace('\\', '/')
        is_model    = '/models/' in norm and norm.endswith('/index.html')
        is_category = '/categories/' in norm and norm.endswith('/index.html')
        if process_html(path, is_model=is_model, is_category=is_category):
            changed += 1

    print(f"Done. {changed} files changed.")

if __name__ == '__main__':
    main()
