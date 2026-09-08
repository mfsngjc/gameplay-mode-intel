#!/usr/bin/env python3
"""Validate discovered images and cache originals for visual review."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from audit_official_images import CACHE
import requests

def candidate(url):
    return not any(s in url.lower() for s in ('logo', 'pubgmobile.com/common/', 'footer', 'nav_', 'icon_', 'btn_', 'button', 'qrcode', 'banner.854', 'moblie_banner', 'flag', 'facebook', 'twitter', 'discord', 'youtube', '.svg'))

def verify(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    meta = CACHE / 'images' / (key + '.json')
    if meta.exists(): return json.loads(meta.read_text())
    result = {'url': url, 'key': key}
    try:
        r = requests.get(url, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        result.update(status=r.status_code, finalUrl=r.url)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content))
        im.load()
        result.update(width=im.width, height=im.height, format=im.format,
                      usable=im.width >= 480 and im.height >= 240)
        if result['usable']:
            (CACHE / 'images' / (key + '.bin')).write_bytes(r.content)
            im.thumbnail((360, 220))
            im.convert('RGB').save(CACHE / 'images' / (key + '.jpg'))
    except Exception as e:
        result.update(usable=False, error=str(e))
    meta.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result

if __name__ == '__main__':
    (CACHE / 'images').mkdir(exist_ok=True)
    urls = set()
    for p in CACHE.glob('*.json'):
        page = json.loads(p.read_text())
        if isinstance(page, dict) and page.get('status') == 200:
            urls.update(i['url'] for i in page.get('images', []) if candidate(i['url']))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for n, r in enumerate(pool.map(verify, sorted(urls)), 1):
            print(n, len(urls), r.get('usable'), r['url'], flush=True)
