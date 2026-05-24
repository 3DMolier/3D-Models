#!/usr/bin/env python3
"""Apply .min CSS/JS refs and CSS class replacements to all Python generators."""
import re, os

ROOT = os.path.dirname(os.path.abspath(__file__))

def patch(path, fn):
    with open(path, 'r', encoding='utf-8') as f:
        orig = f.read()
    result = fn(orig)
    if result != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(result)
        return True
    return False

# ── generate_collection_pages.py ─────────────────────────────────────────────

def fix_collection(content):
    # 1. Add styles.min.css to head (after </style>)
    if '/3D-Models/assets/css/styles.min.css' not in content:
        content = content.replace(
            '</style>\n</head>',
            '</style>\n<link rel="stylesheet" href="/3D-Models/assets/css/styles.min.css">\n</head>'
        )

    # 2. Add site.min.js before </body> in individual collection page template
    if 'site.min.js' not in content:
        content = content.replace(
            '{footer_html()}\n{load_more_script}\n</body>\n</html>',
            '{footer_html()}\n{load_more_script}\n<script src="/3D-Models/assets/js/site.min.js" defer></script>\n<script src="/3D-Models/assets/js/category-pages.min.js" defer></script>\n</body>\n</html>'
        )
        # Also add to collections index page
        content = content.replace(
            '{footer_html()}\n</body>\n</html>',
            '{footer_html()}\n<script src="/3D-Models/assets/js/site.min.js" defer></script>\n</body>\n</html>'
        )

    # 3. Hero sections → page-section classes
    content = content.replace(
        '<section style="padding:56px 24px 40px;border-bottom:1px solid #1E2B44;">',
        '<section class="page-section page-section--border-bottom">'
    )
    content = content.replace(
        '<section style="padding:56px 24px 48px;border-bottom:1px solid #1E2B44;">',
        '<section class="page-section page-section--border-bottom">'
    )
    content = content.replace(
        '<section style="padding:56px 24px;">',
        '<section class="page-section">'
    )
    content = content.replace(
        '<section style="padding:56px 24px 80px;">',
        '<section class="page-section">'
    )
    content = content.replace(
        '<section style="padding:0 24px 72px;">',
        '<section class="page-section">'
    )

    # 4. H2 inline styles → section-h2 class
    # Pattern with no margin
    content = re.sub(
        r'<h2 style="font-family:\'Syne\',sans-serif;font-size:clamp\(18px,2\.5vw,26px\);font-weight:700;letter-spacing:-0\.03em;color:#EDF2FF;line-height:1\.1;">',
        '<h2 class="section-h2">',
        content
    )
    # Pattern with margin-bottom
    content = re.sub(
        r'<h2 style="font-family:\'Syne\',sans-serif;font-size:clamp\(18px,2\.5vw,26px\);font-weight:700;letter-spacing:-0\.03em;color:#EDF2FF;line-height:1\.1;margin-bottom:24px;">',
        '<h2 class="section-h2" style="margin-bottom:24px;">',
        content
    )

    # 5. Section header row → section-header class
    content = content.replace(
        '<div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px;">',
        '<div class="section-header">'
    )

    # 6. Model grid → model-grid class
    content = re.sub(
        r'<div id="model-grid" style="display:grid;grid-template-columns:repeat\(auto-fill,minmax\(\d+px,1fr\)\);gap:\d+px;">',
        '<div id="model-grid" class="model-grid">',
        content
    )
    content = re.sub(
        r'<div style="display:grid;grid-template-columns:repeat\(auto-fill,minmax\(260px,1fr\)\);gap:12px;">',
        '<div class="rel-grid">',
        content
    )

    # 7. section-label with margin-bottom → just class
    content = re.sub(
        r'<div class="section-label" style="margin-bottom:[0-9]+px;">',
        '<div class="section-label">',
        content
    )

    # 8. max-width:1280px containers → Tailwind class (if any exist)
    content = content.replace(
        '<div style="max-width:1280px;margin:0 auto;">',
        '<div class="max-w-7xl mx-auto">'
    )

    # 9. Remove inline loadMore script body — keep only EXTRA_MODELS/COLOR/GRADIENT vars
    # Find and simplify load_more_script pattern
    content = re.sub(
        r"(load_more_script\s*=\s*f''')<script>\n"
        r"const EXTRA_MODELS = \{extra_json\};\n"
        r"const COLOR = \"\{color\}\";\n"
        r"const GRADIENT = \"\{gradient\}\";\n"
        r"let loaded = false;\n\n"
        r"function loadMore\(\).*?btn\.remove\(\);\n\}}\n"
        r"</script>'''",
        r'\1<script>\nvar EXTRA_MODELS = {extra_json};\nvar COLOR = "{color}";\nvar GRADIENT = "{gradient}";\n</script>\'\'\'',
        content,
        flags=re.DOTALL
    )

    # 10. Fix onerror inline handlers in img tags (model_card_html function)
    # Change onerror="this.style.display=\'none\'..." to onerror="imgErr(this)"
    content = content.replace(
        "onerror=\"this.style.display=\\'none\\';this.nextElementSibling.style.display=\\'flex\\';\"",
        'onerror="imgErr(this)"'
    )
    # Also fix in template literals inside f-strings (with escaped braces)
    content = content.replace(
        "onerror=\"this.style.display='none';this.nextElementSibling.style.display='flex';\"",
        'onerror="imgErr(this)"'
    )

    return content


# ── generate_model_pages.py ──────────────────────────────────────────────────

def fix_model_pages(content):
    # 1. Change model-pages.css → model-pages.min.css
    content = content.replace(
        '<link rel="stylesheet" href="/3D-Models/assets/css/model-pages.css">',
        '<link rel="stylesheet" href="/3D-Models/assets/css/model-pages.min.css">'
    )
    # 2. Add site.min.js before </body> if not present
    if 'site.min.js' not in content:
        # Find the closing tags pattern
        content = content.replace(
            '\n</body>\n</html>\'\'\'',
            '\n<script src="/3D-Models/assets/js/site.min.js" defer></script>\n</body>\n</html>\'\'\''
        )
    return content


# ── create_industry_pages.py ─────────────────────────────────────────────────

def fix_industry_pages(content):
    # Industry pages use a different CSS approach but we can add styles.min.css
    if 'styles.min.css' in content:
        return content
    # Add after the fonts link
    content = re.sub(
        r'(<link href="https://fonts\.googleapis\.com[^>]+>)',
        r'\1\n<link rel="stylesheet" href="/3D-Models/assets/css/styles.min.css">',
        content, count=1
    )
    # Fix onerror handlers
    content = content.replace(
        "onerror=\"this.style.display='none';",
        'onerror="imgErr(this)"'
    )
    return content


# ── Run ───────────────────────────────────────────────────────────────────────

scripts = [
    ('scripts/generate_collection_pages.py', fix_collection),
    ('scripts/generate_model_pages.py', fix_model_pages),
    ('scripts/create_industry_pages.py', fix_industry_pages),
]

for rel_path, fn in scripts:
    full_path = os.path.join(ROOT, rel_path)
    if not os.path.exists(full_path):
        print(f'  SKIP (not found): {rel_path}')
        continue
    if patch(full_path, fn):
        print(f'  OK {rel_path}')
    else:
        print(f'  -- {rel_path} (no changes needed)')

print('Done.')
