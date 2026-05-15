"""
Prepend /3D-Models to all internal absolute links in generated HTML files.
Run once before deploying to GitHub Pages at https://3dmolier.github.io/3D-Models/

This patches:
  - HTML href="/..." attributes
  - JSON page:"/" values embedded in catalog/search pages
  - JS template literals href="/models/${m.s}/" in catalog page
"""

import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = "/3D-Models"

# Ordered list of (old, new) string replacements.
# More-specific patterns first to avoid double-replacement.
REPLACEMENTS = [
    # HTML nav/breadcrumb — home link
    ('href="/"',                    f'href="{BASE}/"'),

    # HTML href attributes — internal sections
    ('href="/catalog/',             f'href="{BASE}/catalog/'),
    ('href="/search/',              f'href="{BASE}/search/'),
    ('href="/categories/',          f'href="{BASE}/categories/'),
    ('href="/collections/',         f'href="{BASE}/collections/'),
    ('href="/models/',              f'href="{BASE}/models/'),

    # JS template literals in catalog page: href="/models/${m.s}/"
    # Already covered above (href="/models/ catch-all).

    # JSON "page" field values embedded in search page DATA array
    ('"page":"/models/',            f'"page":"{BASE}/models/'),
    ('"page":"/categories/',        f'"page":"{BASE}/categories/'),
    ('"page":"/collections/',       f'"page":"{BASE}/collections/'),

    # JSON "page" values with space after colon (safety)
    ('"page": "/models/',           f'"page": "{BASE}/models/'),
    ('"page": "/categories/',       f'"page": "{BASE}/categories/'),
    ('"page": "/collections/',      f'"page": "{BASE}/collections/'),
]


def fix_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    content = original
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    html_files = list(ROOT.rglob("*.html"))
    # Skip files inside node_modules or .git
    html_files = [
        f for f in html_files
        if "node_modules" not in f.parts
        and ".git" not in f.parts
        and "temporary screenshots" not in str(f)
    ]

    changed = 0
    skipped = 0
    for f in html_files:
        if fix_file(f):
            changed += 1
        else:
            skipped += 1

    print(f"Done: {changed} files updated, {skipped} unchanged")
    print(f"Base path applied: {BASE}")


if __name__ == "__main__":
    main()
