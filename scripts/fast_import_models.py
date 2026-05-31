#!/usr/bin/env python3
"""
Use git fast-import to commit all staged model pages in a single packfile write.
This avoids the Windows NTFS bottleneck of creating 85K loose tree objects.

Usage:
  python scripts/fast_import_models.py | git fast-import --force
"""
import subprocess, sys, os, time
from pathlib import Path

ROOT = Path(__file__).parent.parent
GIT = str(ROOT)

AUTHOR = '3D Molier <andrey.3dmolier@gmail.com>'
# Use current time
TIMESTAMP = str(int(time.time())) + ' +0000'

COMMIT_MSG = """feat: generate 85,869 lean HTML pages for all fc-chunk models

Individual model pages for all 86K models in the full catalog, matching
the top-1000 page structure. Pages include: full nav, hero section with
TurboSquid image (30K models have images), price, cert badge, JSON-LD
Product + BreadcrumbList schema, and canonical URL. Skips existing
top-1000 model pages. Adds generate_model_pages_full.py generator script.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"""


def get_staged_blobs():
    """Return dict of path -> blob_sha1 for all staged files in models/."""
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '-s', 'models/', 'scripts/generate_model_pages_full.py'],
        capture_output=True, text=True, cwd=GIT, encoding='utf-8', errors='replace'
    )
    blobs = {}
    for line in result.stdout.splitlines():
        parts = line.split('\t', 1)
        if len(parts) != 2:
            continue
        meta, path = parts
        meta_parts = meta.split()
        if len(meta_parts) >= 3:
            mode, sha1, stage = meta_parts[0], meta_parts[1], meta_parts[2]
            if stage == '0':
                blobs[path] = (mode, sha1)
    return blobs


def get_current_head():
    """Get current HEAD commit SHA."""
    result = subprocess.run(
        ['git', 'rev-parse', 'HEAD'],
        capture_output=True, text=True, cwd=GIT, encoding='utf-8'
    )
    return result.stdout.strip()


def generate_fast_import_stream(out):
    """Write fast-import stream to out (file-like object in binary mode)."""
    def w(s):
        out.write(s.encode('utf-8') if isinstance(s, str) else s)

    blobs = get_staged_blobs()
    head = get_current_head()

    total_blobs = len(blobs)
    sys.stderr.write(f"Staged blobs to import: {total_blobs}\n")
    sys.stderr.write(f"Parent commit: {head}\n")

    # Write commit header
    msg_bytes = COMMIT_MSG.encode('utf-8')
    w('commit refs/heads/main\n')
    w(f'author {AUTHOR} {TIMESTAMP}\n')
    w(f'committer {AUTHOR} {TIMESTAMP}\n')
    w(f'data {len(msg_bytes)}\n')
    out.write(msg_bytes)
    w('\n')
    w(f'from {head}\n')

    # Write each staged file using existing blob SHA
    for i, (path, (mode, sha1)) in enumerate(sorted(blobs.items())):
        w(f'M {mode} {sha1} {path}\n')
        if i % 5000 == 0 and i > 0:
            sys.stderr.write(f'  {i}/{total_blobs} files written...\n')

    w('\n')
    sys.stderr.write(f"Done: {total_blobs} files\n")


if __name__ == '__main__':
    # Pipe to git fast-import
    proc = subprocess.Popen(
        ['git', 'fast-import', '--force', '--quiet'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=GIT
    )

    generate_fast_import_stream(proc.stdin)
    proc.stdin.close()

    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        print(f"fast-import failed (exit {proc.returncode}):", file=sys.stderr)
        print(stderr.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(1)

    if stdout:
        print(stdout.decode('utf-8', errors='replace'))
    if stderr:
        print(stderr.decode('utf-8', errors='replace'), file=sys.stderr)

    # Update the index to match new HEAD (marks staged files as committed)
    print("Updating index...", file=sys.stderr)
    r = subprocess.run(['git', 'reset', 'HEAD'], capture_output=True, text=True, cwd=GIT)
    print("Done! New HEAD:", file=sys.stderr)
    r2 = subprocess.run(['git', 'log', '--oneline', '-1'], capture_output=True, text=True,
                       cwd=GIT, encoding='utf-8')
    print(r2.stdout.strip())
