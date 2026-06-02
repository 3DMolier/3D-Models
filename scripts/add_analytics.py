#!/usr/bin/env python3
"""Insert Google Analytics 4 tag into all HTML files."""
import glob
from pathlib import Path

ROOT = Path(__file__).parent.parent

GA_TAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GDY5KTLBP1"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-GDY5KTLBP1');
</script>"""

MARKER = 'googletagmanager.com/gtag'

html_files = glob.glob(str(ROOT / '**' / '*.html'), recursive=True)
print(f'Processing {len(html_files)} HTML files...')

changed = 0
skipped = 0
for path in html_files:
    try:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        if MARKER in orig:
            skipped += 1
            continue
        # Insert before </head>
        if '</head>' not in orig:
            continue
        updated = orig.replace('</head>', GA_TAG + '\n</head>', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)
        changed += 1
    except Exception as e:
        print(f'ERROR {path}: {e}')

print(f'Updated: {changed}')
print(f'Already had GA: {skipped}')
print('Done.')
