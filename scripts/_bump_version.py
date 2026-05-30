"""Bump asset version query string from v=32 to v=33 across all HTML files."""
import os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
changed = 0

for path in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    updated = content.replace('?v=32', '?v=33')
    if updated != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)
        changed += 1

print(f"Version bumped in {changed} files")
