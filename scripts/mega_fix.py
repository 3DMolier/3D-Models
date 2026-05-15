"""
mega_fix.py — Applies all outstanding fixes in one pass:
  1. Image proxy: route TurboSquid CDN via images.weserv.nl
  2. Model generator: remove Units Sold from sidebar + stats row, fix cert overflow
  3. Catalog: replace label/checkbox pills with div buttons (fix double-click)
  4. Homepage: remove 88K+ stats block
  5. About / Contact / Custom-Order pages
  6. Regenerate 1000 model pages
  7. Apply global fixes (font, favicon)
  8. Apply base path
"""
import csv, json, os, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = "/3D-Models"
PROXY = "https://images.weserv.nl/?url="
TS_PREFIX = "https://static.turbosquid.com/"

# ── helpers ────────────────────────────────────────────────────────
def rw(path, fn):
    p = Path(path)
    txt = p.read_text(encoding="utf-8")
    new = fn(txt)
    if new != txt:
        p.write_text(new, encoding="utf-8")
        return True
    return False

# ══════════════════════════════════════════════════════════════════
# 1.  PROXY all TurboSquid preview images in every HTML file
# ══════════════════════════════════════════════════════════════════
IMG_RE = re.compile(
    r'https://static\.turbosquid\.com/(Preview/[^\s"\'<>]+\.jpg)',
    re.IGNORECASE
)

def proxify(txt):
    def repl(m):
        return f"{PROXY}static.turbosquid.com/{m.group(1)}&w=600&q=85&output=webp"
    return IMG_RE.sub(repl, txt)

def proxy_all_html():
    files = [f for f in ROOT.rglob("*.html")
             if ".git" not in f.parts
             and "temporary" not in str(f)
             and "node_modules" not in f.parts]
    changed = sum(1 for f in files if rw(f, proxify))
    print(f"  Image proxy: {changed}/{len(files)} files updated")

# ══════════════════════════════════════════════════════════════════
# 2.  MODEL GENERATOR — fix Units Sold + cert overflow + stat row
# ══════════════════════════════════════════════════════════════════
def fix_model_generator():
    path = ROOT / "scripts" / "generate_model_pages.py"
    txt  = path.read_text(encoding="utf-8")

    # 2a. Remove Units Sold row from Quick Info sidebar
    txt = re.sub(
        r"\s*\{'<div[^']*Units Sold[^']*' \+ str\(sales\) \+ '[^']*'\) if sales > 0 else ''\}",
        "",
        txt
    )

    # 2b. Remove entire stats row from hero (sales_html + prev_html + cert)
    old_stats_row = (
        "        <!-- Stats row -->\n"
        "        <div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;\">\n"
        "          {sales_html}\n"
        "          {prev_html}\n"
        "          {('<div class=\"stat-box\"><div class=\"stat-box-num\">'+cert.split(\"/\")[0]+'</div><div class=\"stat-box-label\">Certification</div></div>') if cert and cert != \"no certification\" else \"\"}\n"
        "        </div>"
    )
    if old_stats_row in txt:
        txt = txt.replace(old_stats_row, "")
        print("  Model generator: stats row removed")
    else:
        # Fallback regex
        txt = re.sub(
            r'\s*<!-- Stats row -->.*?</div>\s*\n\s*\n',
            '\n',
            txt, flags=re.DOTALL
        )
        print("  Model generator: stats row removed (regex)")

    # 2c. Remove sales_html / prev_html variable assignments
    txt = re.sub(r'\s*sales_html\s*=\s*.*?\n', '\n', txt)
    txt = re.sub(r'\s*prev_html\s*=\s*.*?\n',  '\n', txt)

    # 2d. Proxy images in generator string templates
    txt = txt.replace(
        'f\'<img src="{img}"',
        'f\'<img src="{img.replace(\\\"https://static.turbosquid.com/\\\", \\\"https://images.weserv.nl/?url=static.turbosquid.com/\\\") + \\\"&w=600&q=85&output=webp\\\" if img.startswith(\\\"https://static.turbosquid\\\") else img}"'
    )

    path.write_text(txt, encoding="utf-8")

# ══════════════════════════════════════════════════════════════════
# 3.  CATALOG FILTER — replace label/checkbox pills with div
# ══════════════════════════════════════════════════════════════════
def fix_catalog_filter():
    path = ROOT / "catalog" / "index.html"
    txt  = path.read_text(encoding="utf-8")

    # Replace <label class="cat-pill" ...><input ...></label>  ->  <div class="cat-pill" ...>
    def clean_pills(t):
        # Remove input tags inside cat-pill
        t = re.sub(
            r'(<(?:label|div)\s+class="cat-pill"[^>]*>)\s*<input[^>]*/?>',
            r'\1',
            t
        )
        # Replace opening label tags with div
        t = re.sub(
            r'<label(\s+class="cat-pill"[^>]*)>',
            r'<div\1>',
            t
        )
        # Replace closing </label> with </div> only inside cat-pill context
        # (safe because labels are self-contained blocks here)
        t = t.replace('</label>', '</div>')
        return t

    new = clean_pills(txt)

    # Fix the JS click handler — add e.preventDefault() to stop double-fire
    old_handler = "pill.addEventListener('click', () => {"
    new_handler  = "pill.addEventListener('click', (e) => { e.preventDefault();"
    new = new.replace(old_handler, new_handler)

    if new != txt:
        path.write_text(new, encoding="utf-8")
        print("  Catalog filter: label->div, e.preventDefault() added")
    else:
        print("  Catalog filter: no changes needed")

# ══════════════════════════════════════════════════════════════════
# 4.  HOMEPAGE — remove 88K+ stats block
# ══════════════════════════════════════════════════════════════════
def fix_homepage_stats():
    path = ROOT / "index.html"
    txt  = path.read_text(encoding="utf-8")

    removed = re.sub(
        r'\n?<!-- ═+\s*STATS\s*═+ -->\s*\n<section[^>]*>.*?</section>\s*\n?',
        '\n',
        txt, flags=re.DOTALL
    )
    if removed != txt:
        path.write_text(removed, encoding="utf-8")
        print("  Homepage: 88K+ stats block removed")
    else:
        # Try plain stat-num search
        m = re.search(r'<section[^>]*>.*?88K\+.*?</section>', txt, re.DOTALL)
        if m:
            removed = txt[:m.start()].rstrip() + '\n' + txt[m.end():].lstrip()
            path.write_text(removed, encoding="utf-8")
            print("  Homepage: stats block removed (fallback regex)")
        else:
            print("  Homepage: stats block not found — may already be removed")

# ══════════════════════════════════════════════════════════════════
# 5.  ABOUT / CONTACT / CUSTOM ORDER PAGES
# ══════════════════════════════════════════════════════════════════
NAV = f"""<nav style="background:rgba(7,9,15,0.95);border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;z-index:50;">
  <div style="max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:32px;">
    <a href="{BASE}/" style="font-family:'Playfair Display',serif;font-weight:800;font-size:18px;color:#fff;text-decoration:none;letter-spacing:-0.02em;">
      3D <span style="color:#00E5C4;">Molier</span></a>
    <div style="display:flex;gap:24px;margin-left:auto;flex-wrap:wrap;">
      <a href="{BASE}/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Home</a>
      <a href="{BASE}/catalog/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Catalog</a>
      <a href="{BASE}/search/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Search</a>
      <a href="{BASE}/about/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">About</a>
      <a href="{BASE}/contact/" style="color:#6B7280;text-decoration:none;font-size:14px;font-weight:500;">Contact</a>
    </div>
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"
       target="_blank" rel="noopener"
       style="background:#00E5C4;color:#07090F;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;">
      TurboSquid ↗</a>
  </div>
</nav>"""

FOOT = f"""<footer style="background:#0D1117;border-top:1px solid rgba(255,255,255,0.07);padding:32px 24px;margin-top:80px;">
  <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
    <p style="color:#6B7280;font-size:13px;">© 2025 3D Molier. All models on TurboSquid.</p>
    <div style="display:flex;gap:20px;">
      <a href="{BASE}/about/" style="color:#6B7280;font-size:13px;text-decoration:none;">About</a>
      <a href="{BASE}/contact/" style="color:#6B7280;font-size:13px;text-decoration:none;">Contact</a>
      <a href="{BASE}/custom-order/" style="color:#6B7280;font-size:13px;text-decoration:none;">Custom Order</a>
    </div>
  </div>
</footer>"""

def page_shell(title, meta_desc, body_html):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{meta_desc}">
<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{background:#07090F;color:#E8EAF0;font-family:'Open Sans',sans-serif;font-size:15px;line-height:1.7;}}
  h1,h2,h3{{font-family:'Playfair Display',serif;letter-spacing:-0.02em;color:#fff;}}
  .teal{{color:#00E5C4;}}
  .btn{{display:inline-block;background:#00E5C4;color:#07090F;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;transition:opacity .2s;}}
  .btn:hover{{opacity:.88;}}
  .btn-ghost{{display:inline-block;border:1px solid rgba(255,255,255,.15);color:#E8EAF0;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;transition:border-color .2s;}}
  .btn-ghost:hover{{border-color:rgba(255,255,255,.3);}}
  .card{{background:#0D1117;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:28px 32px;}}
  input,textarea,select{{width:100%;background:#0D1117;border:1px solid rgba(255,255,255,.1);color:#E8EAF0;font-family:'Open Sans',sans-serif;font-size:14px;padding:12px 16px;border-radius:8px;outline:none;transition:border-color .2s;}}
  input:focus,textarea:focus{{border-color:#00E5C4;}}
  label{{display:block;font-size:13px;font-weight:600;color:#9CA3AF;margin-bottom:6px;}}
</style>
</head>
<body>
{NAV}
{body_html}
{FOOT}
</body>
</html>"""

def write_about():
    body = f"""
<div style="max-width:860px;margin:0 auto;padding:64px 24px 80px;">

  <div style="margin-bottom:48px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00E5C4;margin-bottom:12px;">About</div>
    <h1 style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1.1;margin-bottom:20px;">
      Professional 3D Assets<br>by <span class="teal">3D Molier</span>
    </h1>
    <p style="font-size:17px;color:#9CA3AF;line-height:1.8;max-width:680px;">
      3D Molier is a professional 3D modeling studio founded by Andrey Simonenko —
      a 3D artist and visualization specialist with over 10 years of experience
      creating high-quality digital assets for global clients.
    </p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:48px;">
    <div class="card">
      <div style="font-size:36px;font-weight:800;color:#00E5C4;font-family:'Playfair Display',serif;">88,000+</div>
      <div style="color:#9CA3AF;font-size:14px;margin-top:6px;">3D models published on TurboSquid</div>
    </div>
    <div class="card">
      <div style="font-size:36px;font-weight:800;color:#00E5C4;font-family:'Playfair Display',serif;">917+</div>
      <div style="color:#9CA3AF;font-size:14px;margin-top:6px;">CheckMate certified models</div>
    </div>
    <div class="card">
      <div style="font-size:36px;font-weight:800;color:#00E5C4;font-family:'Playfair Display',serif;">15</div>
      <div style="color:#9CA3AF;font-size:14px;margin-top:6px;">Specialized categories</div>
    </div>
    <div class="card">
      <div style="font-size:36px;font-weight:800;color:#00E5C4;font-family:'Playfair Display',serif;">10+</div>
      <div style="color:#9CA3AF;font-size:14px;margin-top:6px;">Years of 3D production experience</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:32px;">
    <h2 style="font-size:22px;margin-bottom:16px;">Who We Are</h2>
    <p style="color:#9CA3AF;margin-bottom:14px;">
      Founded by Andrey Simonenko, 3D Molier specializes in creating production-ready
      3D models across vehicles, aircraft, military equipment, medical visualization,
      architecture, industrial machinery and more.
    </p>
    <p style="color:#9CA3AF;margin-bottom:14px;">
      Every model in our catalog is built to professional standards — clean topology,
      correct real-world scale, optimized UV maps and fully textured. The majority of
      our catalog carries TurboSquid's prestigious <strong style="color:#FFC600;">CheckMate certification</strong>,
      guaranteeing geometry that meets the highest industry quality standards.
    </p>
    <p style="color:#9CA3AF;">
      Our models are used by studios and professionals in film production, game development,
      advertising, architectural visualization, medical education, VR/AR and simulation worldwide.
    </p>
  </div>

  <div class="card" style="margin-bottom:32px;">
    <h2 style="font-size:22px;margin-bottom:16px;">What We Offer</h2>
    <ul style="color:#9CA3AF;display:flex;flex-direction:column;gap:10px;padding-left:20px;">
      <li><strong style="color:#E8EAF0;">Ready-made 3D models</strong> — instant download from TurboSquid with full commercial license</li>
      <li><strong style="color:#E8EAF0;">Custom 3D modeling</strong> — we build any model to your exact specifications</li>
      <li><strong style="color:#E8EAF0;">Model adaptation</strong> — modify existing models to fit your project needs</li>
      <li><strong style="color:#E8EAF0;">Multiple formats</strong> — FBX, OBJ, MAX, C4D, BLEND and more</li>
    </ul>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"
       target="_blank" rel="noopener" class="btn">View TurboSquid Store ↗</a>
    <a href="{BASE}/custom-order/" class="btn-ghost">Request Custom Model</a>
    <a href="{BASE}/contact/" class="btn-ghost">Contact Us</a>
  </div>
</div>"""
    (ROOT / "about").mkdir(exist_ok=True)
    (ROOT / "about" / "index.html").write_text(
        page_shell("About 3D Molier — Professional 3D Asset Studio",
                   "3D Molier by Andrey Simonenko — 88,000+ professional 3D models on TurboSquid. CheckMate certified, film and game ready.", body),
        encoding="utf-8")
    print("  about/index.html written")

def write_contact():
    body = f"""
<div style="max-width:700px;margin:0 auto;padding:64px 24px 80px;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00E5C4;margin-bottom:12px;">Get in Touch</div>
  <h1 style="font-size:clamp(32px,5vw,48px);font-weight:800;line-height:1.1;margin-bottom:16px;">Contact Us</h1>
  <p style="color:#9CA3AF;font-size:16px;margin-bottom:48px;">
    Questions about models, licensing, custom orders or collaboration?
    We respond within 24 hours.
  </p>

  <div class="card" style="margin-bottom:24px;">
    <h2 style="font-size:18px;margin-bottom:20px;">Send a Message</h2>
    <form action="mailto:dddmolier@gmail.com" method="get" enctype="text/plain"
          style="display:flex;flex-direction:column;gap:18px;">
      <div>
        <label>Your Name</label>
        <input type="text" name="name" placeholder="John Smith" required>
      </div>
      <div>
        <label>Your Email</label>
        <input type="email" name="email" placeholder="you@example.com" required>
      </div>
      <div>
        <label>Subject</label>
        <select name="subject">
          <option>Question about a model</option>
          <option>Custom 3D model request</option>
          <option>Licensing inquiry</option>
          <option>Collaboration proposal</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label>Message</label>
        <textarea name="body" rows="5" placeholder="Describe your request in detail..." required
                  style="resize:vertical;min-height:120px;"></textarea>
      </div>
      <button type="submit"
              style="background:#00E5C4;color:#07090F;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;border:none;cursor:pointer;transition:opacity .2s;align-self:flex-start;">
        Send Message ↗
      </button>
    </form>
  </div>

  <div class="card" style="display:flex;gap:32px;flex-wrap:wrap;">
    <div>
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">Email</div>
      <a href="mailto:dddmolier@gmail.com" style="color:#00E5C4;font-size:15px;text-decoration:none;font-weight:600;">dddmolier@gmail.com</a>
    </div>
    <div>
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">TurboSquid Store</div>
      <a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio"
         target="_blank" rel="noopener" style="color:#00E5C4;font-size:15px;text-decoration:none;font-weight:600;">3D Molier on TurboSquid ↗</a>
    </div>
    <div>
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">Response Time</div>
      <span style="color:#E8EAF0;font-size:15px;">Within 24 hours</span>
    </div>
  </div>
</div>"""
    (ROOT / "contact").mkdir(exist_ok=True)
    (ROOT / "contact" / "index.html").write_text(
        page_shell("Contact 3D Molier — Get in Touch",
                   "Contact 3D Molier for custom 3D model requests, licensing questions or collaboration. Email: dddmolier@gmail.com", body),
        encoding="utf-8")
    print("  contact/index.html written")

def write_custom_order():
    body = f"""
<div style="max-width:860px;margin:0 auto;padding:64px 24px 80px;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#00E5C4;margin-bottom:12px;">Custom Service</div>
  <h1 style="font-size:clamp(32px,5vw,52px);font-weight:800;line-height:1.1;margin-bottom:20px;">
    Custom 3D Model<br><span class="teal">Made to Order</span>
  </h1>
  <p style="color:#9CA3AF;font-size:17px;line-height:1.8;max-width:660px;margin-bottom:48px;">
    Need a 3D model that doesn't exist yet? Want to modify an existing model for your
    specific project? We deliver production-ready assets to your exact specifications.
  </p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:48px;">
    <div class="card">
      <div style="font-size:24px;margin-bottom:12px;">🎨</div>
      <h3 style="font-size:17px;margin-bottom:8px;">New Model Creation</h3>
      <p style="color:#9CA3AF;font-size:13px;line-height:1.7;">
        We build any 3D model from scratch — vehicles, characters, architecture,
        equipment, props and more. Send us references and we deliver.
      </p>
    </div>
    <div class="card">
      <div style="font-size:24px;margin-bottom:12px;">✏️</div>
      <h3 style="font-size:17px;margin-bottom:8px;">Model Adaptation</h3>
      <p style="color:#9CA3AF;font-size:13px;line-height:1.7;">
        We modify any existing model from our catalog — change colors, add details,
        adjust topology, apply custom textures or adapt for a specific engine.
      </p>
    </div>
    <div class="card">
      <div style="font-size:24px;margin-bottom:12px;">⚙️</div>
      <h3 style="font-size:17px;margin-bottom:8px;">Rigging & Animation</h3>
      <p style="color:#9CA3AF;font-size:13px;line-height:1.7;">
        Full rigging setup for characters or mechanical models. Animation cycles,
        morph targets and blend shapes on request.
      </p>
    </div>
    <div class="card">
      <div style="font-size:24px;margin-bottom:12px;">📦</div>
      <h3 style="font-size:17px;margin-bottom:8px;">Any Format</h3>
      <p style="color:#9CA3AF;font-size:13px;line-height:1.7;">
        FBX, OBJ, GLB/GLTF, MAX, BLEND, C4D, Unreal Engine, Unity — delivered
        in the format your pipeline requires.
      </p>
    </div>
  </div>

  <div class="card" style="margin-bottom:32px;">
    <h2 style="font-size:22px;margin-bottom:20px;">Submit a Custom Order</h2>
    <form action="mailto:dddmolier@gmail.com" method="get" enctype="text/plain"
          style="display:flex;flex-direction:column;gap:18px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <label>Your Name</label>
          <input type="text" name="name" placeholder="John Smith" required>
        </div>
        <div>
          <label>Your Email</label>
          <input type="email" name="email" placeholder="you@example.com" required>
        </div>
      </div>
      <div>
        <label>Type of Request</label>
        <select name="type">
          <option>New model from scratch</option>
          <option>Modify an existing model</option>
          <option>Rigging / Animation</option>
          <option>Texture / Material change</option>
          <option>Format conversion</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label>Describe Your Project</label>
        <textarea name="body" rows="6" required style="resize:vertical;min-height:140px;"
          placeholder="Describe the model you need: type, size, level of detail, polygon budget, reference images URL, delivery format, deadline..."></textarea>
      </div>
      <div>
        <label>Budget (USD, optional)</label>
        <input type="text" name="budget" placeholder="e.g. $200 – $500">
      </div>
      <button type="submit"
              style="background:#00E5C4;color:#07090F;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;border:none;cursor:pointer;align-self:flex-start;">
        Send Custom Order Request ↗
      </button>
    </form>
  </div>

  <div class="card" style="background:rgba(0,229,196,0.04);border-color:rgba(0,229,196,0.15);">
    <h3 style="font-size:17px;color:#00E5C4;margin-bottom:12px;">📬 Direct Email</h3>
    <p style="color:#9CA3AF;font-size:14px;">
      Prefer email? Write directly to
      <a href="mailto:dddmolier@gmail.com" style="color:#00E5C4;">dddmolier@gmail.com</a>
      with your project description and reference images.
    </p>
  </div>
</div>"""
    (ROOT / "custom-order").mkdir(exist_ok=True)
    (ROOT / "custom-order" / "index.html").write_text(
        page_shell("Custom 3D Model Order — 3D Molier",
                   "Order a custom 3D model from 3D Molier. New models from scratch, model adaptation, rigging and any file format. Contact: dddmolier@gmail.com", body),
        encoding="utf-8")
    print("  custom-order/index.html written")

# ══════════════════════════════════════════════════════════════════
# 6.  GLOBAL: font, favicon, proxy on all HTML
# ══════════════════════════════════════════════════════════════════
FONT_MAP = [
    ("family=Syne:wght@600;700;800&family=Inter:wght@400;500;600",
     "family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;500;600"),
    ("family=Syne",  "family=Playfair+Display"),
    ("family=Inter", "family=Open+Sans"),
    ("'Syne', sans-serif",  "'Playfair Display', serif"),
    ("'Syne',sans-serif",   "'Playfair Display',serif"),
    ("'Inter', sans-serif", "'Open Sans', sans-serif"),
    ("'Inter',sans-serif",  "'Open Sans',sans-serif"),
    ("font-family:'Syne'",  "font-family:'Playfair Display'"),
    ("font-family: 'Syne'", "font-family: 'Playfair Display'"),
    ("font-family:'Inter'", "font-family:'Open Sans'"),
    ("font-family: 'Inter'","font-family: 'Open Sans'"),
]
FAV_LINK = f'<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml">'

def global_pass(txt):
    for old, new in FONT_MAP:
        txt = txt.replace(old, new)
    if FAV_LINK not in txt and "</head>" in txt:
        txt = txt.replace("</head>", f"{FAV_LINK}\n</head>", 1)
    return txt

def apply_global():
    files = [f for f in ROOT.rglob("*.html")
             if ".git" not in f.parts and "temporary" not in str(f)]
    changed = sum(1 for f in files if rw(f, global_pass))
    print(f"  Global font+favicon: {changed}/{len(files)} files")

# ══════════════════════════════════════════════════════════════════
# 7.  BASE PATH
# ══════════════════════════════════════════════════════════════════
BASE_SUBS = [
    ('href="/"',             f'href="{BASE}/"'),
    ('href="/catalog/',      f'href="{BASE}/catalog/'),
    ('href="/search/',       f'href="{BASE}/search/'),
    ('href="/categories/',   f'href="{BASE}/categories/'),
    ('href="/collections/',  f'href="{BASE}/collections/'),
    ('href="/models/',       f'href="{BASE}/models/'),
    ('href="/about/',        f'href="{BASE}/about/'),
    ('href="/contact/',      f'href="{BASE}/contact/'),
    ('href="/custom-order/', f'href="{BASE}/custom-order/'),
    ('"page":"/models/',     f'"page":"{BASE}/models/'),
    ('"page":"/categories/', f'"page":"{BASE}/categories/'),
    ('"page":"/collections/',f'"page":"{BASE}/collections/'),
]

def fix_base(txt):
    for old, new in BASE_SUBS:
        txt = txt.replace(old, new)
    return txt

def apply_base():
    files = [f for f in ROOT.rglob("*.html")
             if ".git" not in f.parts and "temporary" not in str(f)
             and f"{BASE}/" not in str(f)]
    # Process all — double-apply is idempotent since BASE already in string
    changed = sum(1 for f in files if rw(f, fix_base))
    print(f"  Base path: {changed}/{len(files)} files")

# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════
def main():
    print("1. Writing new pages...")
    write_about()
    write_contact()
    write_custom_order()

    print("\n2. Fixing model generator...")
    fix_model_generator()

    print("\n3. Fixing catalog filter...")
    fix_catalog_filter()

    print("\n4. Removing 88K+ stats block from homepage...")
    fix_homepage_stats()

    print("\n5. Regenerating 1000 model pages...")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "generate_model_pages.py")],
        cwd=str(ROOT), capture_output=True, text=True
    )
    print(" ", r.stdout.strip().split('\n')[-1] if r.stdout else "done")
    if r.returncode != 0:
        print("  ERROR:", r.stderr[-300:])

    print("\n6. Proxying TurboSquid images in all HTML...")
    proxy_all_html()

    print("\n7. Global font + favicon pass...")
    apply_global()

    print("\n8. Applying base path to new pages...")
    apply_base()

    print("\nAll done!")

if __name__ == "__main__":
    main()
