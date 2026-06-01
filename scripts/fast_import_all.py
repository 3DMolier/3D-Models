#!/usr/bin/env python3
"""
Commit ALL staged files via git fast-import (avoids Windows NTFS bottleneck).
Use after 'git add' to commit large numbers of modified files.
"""
import subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).parent.parent

AUTHOR = '3D Molier <andrey.3dmolier@gmail.com>'
TIMESTAMP = str(int(time.time())) + ' +0000'
COMMIT_MSG = """feat: migrate all pages to 3dmolierstudio.com custom domain

Replace /3D-Models/ path prefix and github.io URLs with 3dmolierstudio.com
across all 86,931 HTML pages, JS files, data JSON, sitemap and robots.txt.
Add CNAME file for GitHub Pages custom domain activation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"""


def get_staged_blobs():
    """Return dict of path -> (mode, sha1) for ALL staged files."""
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '-s'],
        capture_output=True, text=True, cwd=ROOT, encoding='utf-8', errors='replace'
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


def get_head():
    r = subprocess.run(['git', 'rev-parse', 'HEAD'],
                       capture_output=True, text=True, cwd=ROOT)
    return r.stdout.strip()


def run():
    blobs = get_staged_blobs()
    head = get_head()
    total = len(blobs)
    sys.stderr.write(f"Staged blobs to import: {total}\n")
    sys.stderr.write(f"Parent commit: {head}\n")

    proc = subprocess.Popen(
        ['git', 'fast-import', '--force', '--quiet'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=ROOT
    )

    def w(s):
        proc.stdin.write(s.encode('utf-8') if isinstance(s, str) else s)

    msg_bytes = COMMIT_MSG.encode('utf-8')
    w('commit refs/heads/main\n')
    w(f'author {AUTHOR} {TIMESTAMP}\n')
    w(f'committer {AUTHOR} {TIMESTAMP}\n')
    w(f'data {len(msg_bytes)}\n')
    proc.stdin.write(msg_bytes)
    w('\n')
    w(f'from {head}\n')

    for i, (path, (mode, sha1)) in enumerate(sorted(blobs.items())):
        w(f'M {mode} {sha1} {path}\n')
        if (i + 1) % 5000 == 0:
            sys.stderr.write(f'  {i+1}/{total} files written...\n')

    w('\n')
    proc.stdin.close()

    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        sys.stderr.write(f"fast-import failed:\n{stderr.decode('utf-8', errors='replace')}\n")
        sys.exit(1)

    sys.stderr.write(f"Done: {total} files\n")
    sys.stderr.write("Syncing index...\n")
    subprocess.run(['git', 'reset', 'HEAD'], capture_output=True, cwd=ROOT)
    r = subprocess.run(['git', 'log', '--oneline', '-1'],
                       capture_output=True, text=True, cwd=ROOT, encoding='utf-8')
    print("New HEAD:", r.stdout.strip())


if __name__ == '__main__':
    run()
