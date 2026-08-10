#!/usr/bin/env python3
"""
3DMolier catalog-specific SEO drift checks.

Captures and compares page elements that the generic claude-seo drift skill
does NOT track: specification table structural integrity, title format/
duplication, breadcrumbs (visible + JSON-LD), "Related 3D Models" link count,
and the "All Versions of This Model" block (merged cards).

Written specifically to catch two real incidents that slipped through with
no automated detection:
  1) A literal "$1" replaced the opening <table> tag of the specs block on
     196 pages (broken table, orphaned <tbody>).
  2) A price-substitution bug duplicated "3D Model" inside <title> on 4,442
     pages (e.g. "... 3D Model - 3D Model - ... $159 | 3D Molier</title>59|...").

Usage:
    python custom_checks.py baseline <url1> [<url2> ...] --out baseline.json
    python custom_checks.py compare <url1> [<url2> ...] --baseline baseline.json
    python custom_checks.py compare-file <old.html> <new.html>   (offline / test mode)
    python custom_checks.py selftest    (runs the two synthetic-corruption regression checks)

Fetching (for baseline/compare) goes through the existing SSRF-protected
scripts/fetch_page.py from the seo skill. No raw requests/curl are used.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

SEO_SCRIPTS_DIR = os.path.expanduser("~/.claude/skills/seo/scripts")
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BASELINE_PATH = os.path.join(THIS_DIR, "baseline.json")


# ---------------------------------------------------------------------------
# Fetch (reuses the skill's SSRF-protected fetcher; no raw HTTP here)
# ---------------------------------------------------------------------------

def fetch_html(url: str) -> str:
    fetch_script = os.path.join(SEO_SCRIPTS_DIR, "fetch_page.py")
    with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False, encoding="utf-8") as tmp:
        tmp_path = tmp.name
    try:
        proc = subprocess.run(
            [sys.executable, fetch_script, url, "--output", tmp_path],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"fetch failed for {url}: {proc.stderr.strip()}")
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Extraction (regex on raw HTML source - deliberately NOT BeautifulSoup,
# because BS4 silently repairs broken tags, which is exactly what would hide
# the "$1 destroyed the opening <table> tag" incident).
# ---------------------------------------------------------------------------

_DUP_PHRASE_RE = re.compile(r"([\w][\w &/-]{2,40}?)\s*-\s*\1", re.IGNORECASE)


def extract_custom_elements(html: str) -> dict:
    out = {}

    # --- Title (raw, as-served, not entity-decoded) ---
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title_raw = m.group(1).strip() if m else None
    out["title_raw"] = title_raw
    out["title_tag_open_count"] = len(re.findall(r"<title\b", html, re.IGNORECASE))
    out["title_tag_close_count"] = len(re.findall(r"</title>", html, re.IGNORECASE))
    if title_raw:
        out["title_3dmodel_token_count"] = title_raw.lower().count("3d model")
        out["title_has_duplicate_phrase"] = bool(_DUP_PHRASE_RE.search(title_raw))
        out["title_has_html_artifact"] = bool(re.search(r"[<>]|</?title", title_raw, re.IGNORECASE))
        out["title_length"] = len(title_raw)
    else:
        out["title_3dmodel_token_count"] = 0
        out["title_has_duplicate_phrase"] = False
        out["title_has_html_artifact"] = False
        out["title_length"] = 0

    # --- Specifications table ---
    spec_heading_present = bool(re.search(r">Specifications</h2>", html))
    out["spec_heading_present"] = spec_heading_present
    table_m = re.search(
        r'<table[^>]*class="[^"]*mp-spec-table[^"]*"[^>]*>(.*?)</table>',
        html, re.IGNORECASE | re.DOTALL,
    )
    out["spec_table_present"] = bool(table_m)
    out["spec_table_row_count"] = table_m.group(1).count("<tr") if table_m else 0
    # Orphaned <tbody> after the heading with no opening <table> nearby -> classic
    # "$1 ate the opening tag" signature.
    orphan = False
    if spec_heading_present and not table_m:
        after = html.split(">Specifications</h2>", 1)[1][:600]
        if re.search(r"<tbody", after, re.IGNORECASE):
            orphan = True
    out["spec_table_orphan_tbody"] = orphan

    # --- Breadcrumbs (visible bar) ---
    out["breadcrumb_visible_link_count"] = len(re.findall(r'class="mp-bc-link"', html))
    out["breadcrumb_visible_current_present"] = bool(re.search(r'class="mp-bc-current"', html))

    # --- Breadcrumbs (JSON-LD) ---
    bc_items = 0
    for block_m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
        raw = block_m.group(1)
        if "BreadcrumbList" not in raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        items = data.get("itemListElement", [])
        if isinstance(items, list):
            bc_items = max(bc_items, len(items))
    out["breadcrumb_jsonld_item_count"] = bc_items

    # --- Related / similar models block ---
    out["related_block_present"] = bool(re.search(r"mp-related-grid", html))
    out["related_link_count"] = len(re.findall(r"mp-rc-link", html))

    # --- "All Versions of This Model" block (merged cards) ---
    out["all_versions_present"] = bool(re.search(r"mp-variants", html))
    out["all_versions_count"] = len(re.findall(r'<li class="mp-var', html))

    return out


# ---------------------------------------------------------------------------
# Comparison rules (same CRITICAL/WARNING/INFO vocabulary as the seo-drift skill)
# ---------------------------------------------------------------------------

def compare_custom_elements(old: dict, new: dict) -> list:
    findings = []

    def add(rule, severity, triggered, old_v, new_v, message):
        findings.append({"rule": rule, "severity": severity, "triggered": triggered,
                          "old_value": old_v, "new_value": new_v, "message": message})

    # 1. Spec table structurally broken
    was_ok = old.get("spec_table_present") and old.get("spec_table_row_count", 0) > 0
    now_broken = (not new.get("spec_table_present")) or new.get("spec_table_row_count", 0) == 0
    triggered = was_ok and now_broken and new.get("spec_heading_present", True)
    add("custom_spec_table_broken", "CRITICAL", triggered,
        f"present, {old.get('spec_table_row_count')} rows",
        f"present={new.get('spec_table_present')}, rows={new.get('spec_table_row_count')}, orphan_tbody={new.get('spec_table_orphan_tbody')}",
        "Specifications table is missing or empty while the heading is still there. "
        "Classic signature of a broken/eaten opening <table> tag from a batch text replacement."
        if triggered else "Specifications table intact.")

    # 2. Title malformed (duplication / html leak / broken tag balance)
    title_bad = (
        new.get("title_has_duplicate_phrase")
        or new.get("title_has_html_artifact")
        or new.get("title_tag_close_count", 1) != 1
        or new.get("title_3dmodel_token_count", 0) > 1
    )
    was_title_ok = not (
        old.get("title_has_duplicate_phrase")
        or old.get("title_has_html_artifact")
        or old.get("title_3dmodel_token_count", 0) > 1
    )
    triggered = title_bad and was_title_ok
    add("custom_title_malformed", "CRITICAL", triggered,
        old.get("title_raw"), new.get("title_raw"),
        "Title tag is malformed: duplicated phrase, stray HTML/tag artifact, or repeated "
        "\"3D Model\" token. Classic signature of a botched find/replace or price-substitution script."
        if triggered else "Title format looks clean.")

    # 3. Breadcrumbs disappeared
    old_bc = old.get("breadcrumb_visible_link_count", 0) + old.get("breadcrumb_jsonld_item_count", 0)
    new_bc = new.get("breadcrumb_visible_link_count", 0) + new.get("breadcrumb_jsonld_item_count", 0)
    triggered = old_bc > 0 and new_bc == 0
    add("custom_breadcrumb_removed", "CRITICAL", triggered, old_bc, new_bc,
        "Breadcrumbs (visible and/or JSON-LD) disappeared." if triggered else "Breadcrumbs present.")

    # 4. Related/similar links dropped sharply
    old_rel = old.get("related_link_count", 0)
    new_rel = new.get("related_link_count", 0)
    triggered = old_rel >= 3 and new_rel < old_rel * 0.5
    add("custom_related_links_dropped", "WARNING", triggered, old_rel, new_rel,
        f"Related-models link count dropped from {old_rel} to {new_rel}." if triggered else "Related links count stable.")

    # 5. "All Versions" block lost on a merged card
    if old.get("all_versions_present"):
        triggered = (not new.get("all_versions_present")) or new.get("all_versions_count", 0) < old.get("all_versions_count", 0)
        add("custom_all_versions_changed", "WARNING", triggered,
            old.get("all_versions_count"), new.get("all_versions_count"),
            "\"All Versions of This Model\" block lost items or disappeared." if triggered else "Variant block unchanged.")

    return findings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_baseline(args):
    result = {}
    for url in args.urls:
        html = fetch_html(url)
        result[url] = {"timestamp": datetime.now(timezone.utc).isoformat(),
                        "elements": extract_custom_elements(html)}
        print(f"captured: {url}", file=sys.stderr)
    out_path = args.out or DEFAULT_BASELINE_PATH
    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing.update(result)
        result = existing
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(json.dumps({"status": "ok", "baseline_file": out_path, "urls_captured": len(args.urls)}, indent=2))


def cmd_compare(args):
    baseline_path = args.baseline or DEFAULT_BASELINE_PATH
    with open(baseline_path, "r", encoding="utf-8") as f:
        baseline = json.load(f)
    overall = {"critical": 0, "warning": 0, "info": 0}
    all_results = {}
    for url in args.urls:
        if url not in baseline:
            print(f"no baseline for {url}, skipping", file=sys.stderr)
            continue
        html = fetch_html(url)
        current = extract_custom_elements(html)
        findings = compare_custom_elements(baseline[url]["elements"], current)
        triggered = [f for f in findings if f["triggered"]]
        for f in triggered:
            overall[f["severity"].lower()] += 1
        all_results[url] = {"triggered": triggered}
        print(f"=== {url} ===")
        if not triggered:
            print("  no custom drift detected")
        for f in triggered:
            print(f"  [{f['severity']}] {f['rule']}: {f['message']}")
    print(json.dumps({"summary": overall}, indent=2))


def cmd_compare_file(args):
    with open(args.old, "r", encoding="utf-8", errors="replace") as f:
        old_html = f.read()
    with open(args.new, "r", encoding="utf-8", errors="replace") as f:
        new_html = f.read()
    old = extract_custom_elements(old_html)
    new = extract_custom_elements(new_html)
    findings = compare_custom_elements(old, new)
    triggered = [f for f in findings if f["triggered"]]
    print(json.dumps({"triggered": triggered, "all": findings}, indent=2, ensure_ascii=False))
    return triggered


def cmd_selftest(args):
    """Synthetic corruption regression test using a real local model page."""
    sample = args.sample
    with open(sample, "r", encoding="utf-8") as f:
        good_html = f.read()

    results = {}

    # Incident 1: literal "$1" destroys the opening <table> tag.
    corrupt_table = re.sub(
        r'<table class="mp-spec-table"><tbody>',
        '$1<tbody>',
        good_html, count=1,
    )
    assert corrupt_table != good_html, "table corruption regex did not match sample"
    old_e = extract_custom_elements(good_html)
    new_e = extract_custom_elements(corrupt_table)
    findings = compare_custom_elements(old_e, new_e)
    triggered = [f for f in findings if f["triggered"]]
    results["incident_1_broken_table"] = {
        "caught": any(f["rule"] == "custom_spec_table_broken" for f in triggered),
        "triggered_rules": [f["rule"] for f in triggered],
    }

    # Incident 2: title duplication from a bad price-substitution script.
    title_m = re.search(r"<title[^>]*>(.*?)</title>", good_html, re.DOTALL)
    old_title = title_m.group(1)
    # Simulate: "<Name> 3D Model - 3D Model - ... $159 | 3D Molier"
    name_part = old_title.split(" 3D Model")[0]
    broken_title = f"{name_part} 3D Model - 3D Model - {name_part} $159 | 3D Molier"
    corrupt_title = good_html.replace(old_title, broken_title, 1)
    assert corrupt_title != good_html, "title corruption did not apply"
    old_e2 = extract_custom_elements(good_html)
    new_e2 = extract_custom_elements(corrupt_title)
    findings2 = compare_custom_elements(old_e2, new_e2)
    triggered2 = [f for f in findings2 if f["triggered"]]
    results["incident_2_duplicated_title"] = {
        "caught": any(f["rule"] == "custom_title_malformed" for f in triggered2),
        "triggered_rules": [f["rule"] for f in triggered2],
        "broken_title_sample": broken_title,
    }

    print(json.dumps(results, indent=2, ensure_ascii=False))
    ok = results["incident_1_broken_table"]["caught"] and results["incident_2_duplicated_title"]["caught"]
    sys.exit(0 if ok else 1)


def main():
    parser = argparse.ArgumentParser(description="3DMolier catalog-specific SEO drift checks")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_base = sub.add_parser("baseline")
    p_base.add_argument("urls", nargs="+")
    p_base.add_argument("--out")
    p_base.set_defaults(func=cmd_baseline)

    p_cmp = sub.add_parser("compare")
    p_cmp.add_argument("urls", nargs="+")
    p_cmp.add_argument("--baseline")
    p_cmp.set_defaults(func=cmd_compare)

    p_cmpf = sub.add_parser("compare-file")
    p_cmpf.add_argument("old")
    p_cmpf.add_argument("new")
    p_cmpf.set_defaults(func=cmd_compare_file)

    p_self = sub.add_parser("selftest")
    p_self.add_argument("--sample", default=os.path.join(
        THIS_DIR, "..", "..", "models", "k9-thunder-self-propelled-howitzer-2219454", "index.html"))
    p_self.set_defaults(func=cmd_selftest)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
