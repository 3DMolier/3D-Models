#!/usr/bin/env python3
import re, sys
path = sys.argv[1] if len(sys.argv) > 1 else "categories/vehicles/index.html"
with open(path, encoding="utf-8") as f:
    txt = f.read()
count = len(re.findall(r' style="', txt))
print(f"style= count in {path}: {count}")
