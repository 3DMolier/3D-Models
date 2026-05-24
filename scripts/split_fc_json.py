#!/usr/bin/env python3
"""Split fc.json (columnar) and fc-img.json (dict) into chunks for progressive loading."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def split_columnar(input_path, prefix, chunk_size=10000):
    """Split a dict-of-arrays {i:[], n:[], p:[], s:[], c:[]} into chunk files."""
    full_path = os.path.join(ROOT, input_path)
    if not os.path.exists(full_path):
        print(f'  SKIP (not found): {input_path}')
        return
    with open(full_path, encoding='utf-8') as f:
        data = json.load(f)

    keys = list(data.keys())
    total = len(data[keys[0]])
    n_chunks = (total + chunk_size - 1) // chunk_size

    for i in range(n_chunks):
        lo, hi = i * chunk_size, min((i + 1) * chunk_size, total)
        chunk = {k: data[k][lo:hi] for k in keys}
        out = os.path.join(ROOT, f'data/{prefix}-chunk-{i}.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, separators=(',', ':'), ensure_ascii=False)
        size_kb = os.path.getsize(out) // 1024
        print(f'  {prefix}-chunk-{i}.json: {hi-lo} items, {size_kb}KB')

    index = {'total': total, 'chunks': n_chunks, 'chunk_size': chunk_size, 'format': 'columnar', 'keys': keys}
    idx_path = os.path.join(ROOT, f'data/{prefix}-index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f'  {prefix}-index.json: {n_chunks} chunks, {total} total items')


def split_dict(input_path, prefix, chunk_size=5000):
    """Split a flat dict {id: url, ...} into chunk files."""
    full_path = os.path.join(ROOT, input_path)
    if not os.path.exists(full_path):
        print(f'  SKIP (not found): {input_path}')
        return
    with open(full_path, encoding='utf-8') as f:
        data = json.load(f)

    keys = list(data.keys())
    total = len(keys)
    n_chunks = (total + chunk_size - 1) // chunk_size

    for i in range(n_chunks):
        chunk_keys = keys[i*chunk_size:(i+1)*chunk_size]
        chunk = {k: data[k] for k in chunk_keys}
        out = os.path.join(ROOT, f'data/{prefix}-chunk-{i}.json')
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, separators=(',', ':'), ensure_ascii=False)
        size_kb = os.path.getsize(out) // 1024
        print(f'  {prefix}-chunk-{i}.json: {len(chunk)} entries, {size_kb}KB')

    index = {'total': total, 'chunks': n_chunks, 'chunk_size': chunk_size, 'format': 'dict'}
    idx_path = os.path.join(ROOT, f'data/{prefix}-index.json')
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f'  {prefix}-index.json: {n_chunks} chunks, {total} total items')


print('Splitting fc.json (columnar)...')
split_columnar('data/fc.json', 'fc', chunk_size=10000)

print('Splitting fc-img.json (dict)...')
split_dict('data/fc-img.json', 'fc-img', chunk_size=5000)

print('Done.')
