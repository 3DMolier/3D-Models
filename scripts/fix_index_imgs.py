#!/usr/bin/env python3
"""Add width/height to best-seller img tags in index.html."""
import re

with open("index.html", "r", encoding="utf-8") as f:
    content = f.read()

def add_dims(m):
    s = m.group(0)
    if "width=" not in s:
        s = s.replace('loading="lazy"', 'width="300" height="200" loading="lazy"', 1)
    return s

# Match best-seller img tags (p.turbosquid.com URLs, not static.turbosquid category cards)
pattern = r'<img src="https://p\.turbosquid\.com[^>]*loading="lazy"'
content2 = re.sub(pattern, add_dims, content)

changed = content2 != content
with open("index.html", "w", encoding="utf-8") as f:
    f.write(content2)
print("changed" if changed else "no change")
