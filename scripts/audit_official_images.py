#!/usr/bin/env python3
"""Collect source-page image evidence; never automatically approve a cover."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
import warnings
warnings.filterwarnings('ignore', message='urllib3 v2')
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'local-only/image-audit-2026-09-08'

class EvidenceParser(HTMLParser):
    def __init__(self, url):
        super().__init__()
        self.url, self.images, self.texts, self.links = url, [], [], []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'): self.skip += 1
        if tag == 'a' and a.get('href'):
            self.links.append(urljoin(self.url, a['href']))
        src = None
        if tag == 'img': src = a.get('data-src') or a.get('src')
        if tag == 'meta' and a.get('property', a.get('name')) in ('og:image', 'twitter:image'):
            src = a.get('content')
        if src and not src.startswith('data:'):
            self.images.append({'url': urljoin(self.url, src), 'kind': tag,
                                'alt': a.get('alt', ''), 'before': ' '.join(self.texts)[-650:],
                                'position': len(self.texts)})
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, value):
        if not self.skip and value.strip(): self.texts.append(value.strip())
    def result(self):
        for i in self.images:
            i['after'] = ' '.join(self.texts[i.pop('position'):])[:650]
        return {'images': self.images, 'text': ' '.join(self.texts), 'links': sorted(set(self.links))}

def collect(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    path = CACHE / (key + '.json')
    if path.exists(): return json.loads(path.read_text())
    result = {'url': url, 'cacheKey': key}
    try:
        r = requests.get(url, timeout=25, headers={'User-Agent': 'Mozilla/5.0'})
        result.update(status=r.status_code, finalUrl=r.url)
        if r.encoding == 'ISO-8859-1': r.encoding = r.apparent_encoding
        (CACHE / (key + '.html')).write_text(r.text)
        p = EvidenceParser(r.url)
        p.feed(r.text)
        result.update(p.result())
    except Exception as e:
        result['error'] = str(e)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result

def is_target(m):
    s = m.get('imageSource', '')
    return not m.get('imageUrl') or ('本地归档' not in s and any(v in s for v in
        ('本地', '通用', '暂用', '待补充', '待确认', 'Ginx', 'Steam 库')))

if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    modes = json.loads((ROOT / 'data/modes.json').read_text())
    targets = [m for m in modes if is_target(m)]
    (CACHE / 'targets.json').write_text(json.dumps(targets, ensure_ascii=False, indent=2))
    urls = sorted(set(m['sourceUrl'] for m in targets))
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for n, result in enumerate(pool.map(collect, urls), 1):
            print(n, len(urls), result.get('status', 'ERROR'), len(result.get('images', [])), result['url'], flush=True)
