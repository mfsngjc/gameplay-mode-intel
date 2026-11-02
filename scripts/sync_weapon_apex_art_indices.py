#!/usr/bin/env python3
"""Rebuild the bounded, public source indices used by enrich_weapon_apex.py.

Writes only ignored local-only/weapon-skins/apex/expansion caches. It never
changes the published catalogue, skin images, dates, or publication status.
Each source index is replaced atomically only after its complete traversal.

Fresh checkout:
    python scripts/sync_weapon_apex_art_indices.py
Read existing receipts without making a new source-verification claim:
    python scripts/sync_weapon_apex_art_indices.py --offline --dry-run
Refresh every selected response (otherwise successful exact-URL caches resume):
    python scripts/sync_weapon_apex_art_indices.py --refresh
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('apex_art_enrichment', ROOT / 'scripts/enrich_weapon_apex.py')
enrich = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(enrich)
base = enrich.base
WORK = ROOT / 'local-only/weapon-skins/apex/expansion'
WIKI_QUERY = {'action': 'query', 'generator': 'allimages', 'gailimit': 500,
              'prop': 'imageinfo', 'iiprop': 'url|size', 'format': 'json'}
MEDIA_QUERY = {'per_page': 100, '_fields': 'id,date,slug,source_url,alt_text,media_details.width,media_details.height,post,link'}
# Observed public categories, in the existing category-N cache order.
CATEGORY_URLS = [
    'https://apexitemstore.com/guns/assault-rifles/',
    'https://apexitemstore.com/guns/',
    'https://apexitemstore.com/guns/smgs/',
    'https://apexitemstore.com/guns/lmgs/',
    'https://apexitemstore.com/guns/snipers/',
    'https://apexitemstore.com/guns/marksman/',
    'https://apexitemstore.com/guns/shotguns/',
    'https://apexitemstore.com/guns/pistols/',
]


def load(path, fallback=None):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else fallback


def final_headers(raw):
    """Keep final response headers, excluding redirect/interim response blocks."""
    headers = {}
    for line in raw.replace('\r\n', '\n').split('\n'):
        if line.startswith('HTTP/'):
            headers = {}
        elif ':' in line:
            key, value = line.split(':', 1)
            headers[key.lower().strip()] = value.strip()
    return headers


class Collector:
    def __init__(self, args):
        self.args = args

    def request(self, path, url, kind):
        receipt_path = path.with_suffix('.source.json')
        receipt = load(receipt_path)
        if path.exists() and receipt and receipt.get('url') == url and not self.args.refresh:
            raw = path.read_bytes()
            def matches(candidate):
                return ((receipt.get('bytes') is None or receipt['bytes'] == len(candidate))
                        and (not receipt.get('sha256') or receipt['sha256'] == hashlib.sha256(candidate).hexdigest()))
            if not matches(raw):
                # Legacy gallery caches used text-mode writes on Windows: the
                # receipt hashes the original LF bytes, but disk holds CRLF.
                # Accept only when newline-normalized bytes match the receipt.
                normalized = raw.replace(b'\r\n', b'\n')
                if 'responseHeaders' not in receipt and matches(normalized):
                    raw = normalized
                else:
                    raise RuntimeError('Cache byte count/hash differs: ' + str(path))
            self.validate(raw, kind, url)
            return raw.decode('utf-8'), receipt
        if self.args.offline:
            raise RuntimeError('Missing exact offline cache: ' + str(path))
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptors = [tempfile.mkstemp(prefix=path.name + '.', suffix=s, dir=path.parent)
                       for s in ('.body.tmp', '.headers.tmp')]
        for fd, _ in descriptors:
            os.close(fd)
        body, header = [Path(name) for _, name in descriptors]
        try:
            command = [shutil.which('curl.exe') or 'curl', '--silent', '--show-error', '--fail',
                       '--location', '--compressed', '--proto', '=https', '--proto-redir', '=https',
                       '--max-time', '45', '--max-filesize', '12000000', '--dump-header', str(header),
                       '--output', str(body), url]
            for attempt in range(3):
                result = subprocess.run(command, capture_output=True, timeout=50)
                if result.returncode and b'429' in result.stderr and attempt < 2:
                    time.sleep(10)
                    continue
                break
            if result.returncode:
                raise RuntimeError(url + ': ' + result.stderr.decode('utf-8', errors='replace').strip())
            raw = body.read_bytes()
            self.validate(raw, kind, url)
            headers = final_headers(header.read_text(encoding='iso-8859-1'))
            receipt = {'url': url, 'retrievedAt': base.now(), 'bytes': len(raw),
                       'sha256': hashlib.sha256(raw).hexdigest(),
                       'responseHeaders': {key: headers[key] for key in
                                           ('content-type', 'x-wp-total', 'x-wp-totalpages') if key in headers}}
            os.replace(body, path)
            base.atomic(receipt_path, receipt)
            # Sequential and paced; no image/video downloads and no broad crawl.
            time.sleep(5 if url.startswith(base.WIKI) else 1)
            return raw.decode('utf-8'), receipt
        finally:
            body.unlink(missing_ok=True)
            header.unlink(missing_ok=True)

    @staticmethod
    def validate(raw, kind, url):
        text = raw.decode('utf-8')
        if kind == 'wiki':
            payload = json.loads(text)
            if not isinstance(payload, dict) or payload.get('error') or not isinstance(payload.get('query', {}).get('pages'), dict):
                raise RuntimeError('Not a Wiki allimages response: ' + url)
        elif kind == 'media':
            payload = json.loads(text)
            if not isinstance(payload, list) or any(not isinstance(row, dict) or 'id' not in row for row in payload):
                raise RuntimeError('Not a WordPress media response: ' + url)
        elif len(raw) < 1000 or '<title>Page not found' in text or '<title>Just a moment' in text:
            raise RuntimeError('Not a usable ItemStore HTML page: ' + url)

    def save(self, path, document):
        if not self.args.dry_run:
            base.atomic(path, document)

    def wiki(self):
        query = dict(WIKI_QUERY)
        files, requests, seen = [], [], set()
        for page in range(self.args.max_wiki_pages):
            url = base.WIKI + '/api.php?' + urlencode(query)
            raw, receipt = self.request(WORK / 'wiki-file-index' / f'{page:03d}.json', url, 'wiki')
            payload = json.loads(raw)
            for row in payload['query']['pages'].values():
                if row['pageid'] in seen:
                    raise RuntimeError('Duplicate Wiki file ID during pagination; previous index preserved')
                seen.add(row['pageid'])
                files.append(row)
            requests.append(receipt)
            continuation = payload.get('continue')
            if not continuation:
                document = {'files': files, 'requests': requests}
                self.save(WORK / 'wiki-file-index/index.json', document)
                return {'source': 'wiki', 'pages': len(requests), 'files': len(files),
                        'scope': 'public_file_metadata_traversal_only', 'offline': self.args.offline}
            if not isinstance(continuation.get('gaicontinue'), str):
                raise RuntimeError('Unknown Wiki continuation; previous index preserved')
            query = {**WIKI_QUERY, **continuation}
        raise RuntimeError('Wiki page bound reached before continuation ended; previous index preserved')

    def media(self):
        previous = load(WORK / 'itemstore-media/index.json', {})
        first_url = 'https://apexitemstore.com/wp-json/wp/v2/media?' + urlencode({**MEDIA_QUERY, 'page': 1})
        raw, first_receipt = self.request(WORK / 'itemstore-media/001.json', first_url, 'media')
        headers = first_receipt.get('responseHeaders', {})
        declared = headers.get('x-wp-total')
        pages = headers.get('x-wp-totalpages')
        denominator_source = 'response_headers'
        # Original research receipts predate header capture. Their previous
        # completed index is evidence for bounds, not a newly observed header.
        if pages is None or declared is None:
            if not previous.get('requests') or previous['requests'][0].get('url') != first_url:
                raise RuntimeError('WP page-count headers missing and no completed prior index; previous index preserved')
            pages, declared = previous['traversedPages'], previous['declaredTotal']
            denominator_source = 'previous_completed_index'
        pages, declared = int(pages), int(declared)
        if not 1 <= pages <= self.args.max_media_pages:
            raise RuntimeError('WP declared pages exceed configured bound; previous index preserved')
        items, requests, seen = [], [], set()
        duplicate_ids, counts_changed = [], False
        for page in range(1, pages + 1):
            if page != 1:
                url = 'https://apexitemstore.com/wp-json/wp/v2/media?' + urlencode({**MEDIA_QUERY, 'page': page})
                raw, receipt = self.request(WORK / 'itemstore-media' / f'{page:03d}.json', url, 'media')
            else:
                receipt = first_receipt
            current_headers = receipt.get('responseHeaders', {})
            if current_headers.get('x-wp-total') and int(current_headers['x-wp-total']) != declared:
                counts_changed = True
            if current_headers.get('x-wp-totalpages') and int(current_headers['x-wp-totalpages']) != pages:
                counts_changed = True
            # A short page is not an end marker: the observed source returned
            # several 88/99-item intermediate pages in the original traversal.
            for row in json.loads(raw):
                if row['id'] in seen:
                    duplicate_ids.append(row['id'])
                    continue
                seen.add(row['id'])
                items.append(row)
            requests.append(receipt)
        status = 'matched' if len(items) == declared else 'declared_total_differs_from_visible_items'
        if counts_changed or duplicate_ids:
            status = 'source_changed_or_duplicate_ids_during_traversal'
        document = {'items': items, 'requests': requests, 'declaredTotal': declared,
                    'actualCount': len(items), 'traversedPages': len(requests), 'denominatorStatus': status,
                    'denominatorSource': denominator_source, 'duplicateAttachmentIds': duplicate_ids}
        self.save(WORK / 'itemstore-media/index.json', document)
        return {'source': 'itemstore-media', 'pages': len(requests), 'visibleAttachments': len(items),
                'declaredAttachments': declared, 'denominatorStatus': status, 'offline': self.args.offline}

    def galleries(self):
        records = load(base.OUT)['skins']
        owners = sorted({row['weaponEnglishName'] for row in records if row['weaponType'] == 'gun'})
        categories, seeds = [], {}
        for page, url in enumerate(CATEGORY_URLS):
            raw, receipt = self.request(WORK / 'itemstore' / f'category-{page}.html', url, 'html')
            tree = base.Tree(raw)
            images = [node.attrs for node in tree.root.all('img')]
            links = list(dict.fromkeys(node.attrs['href'] for node in tree.root.all('a') if node.attrs.get('href')))
            categories.append({'source': receipt, 'images': images, 'links': links})
            for node in tree.root.all('img'):
                ancestor = node.parent
                while ancestor and ancestor.tag != 'a':
                    ancestor = ancestor.parent
                href = ancestor.attrs.get('href', '') if ancestor else ''
                if not href.startswith('https://apexitemstore.com/guns/') or len(urlsplit(href).path.strip('/').split('/')) < 3:
                    continue
                for owner in owners:
                    if enrich.owner_in(node.attrs.get('alt', ''), owner):
                        seeds.setdefault(owner, href)
        if len(seeds) > self.args.max_galleries:
            raise RuntimeError('Weapon gallery bound exceeded; previous category index preserved')
        galleries = []
        for owner, url in sorted(seeds.items()):
            _, receipt = self.request(WORK / 'itemstore' / ('weapon-gallery-' + base.slug(owner) + '.html'), url, 'html')
            galleries.append({'weapon': owner, 'source': receipt})
        self.save(WORK / 'itemstore/categories.json', categories)
        self.save(WORK / 'itemstore/galleries.json', {'galleries': galleries,
                  'unresolvedWeaponFamilies': sorted(set(owners) - set(seeds))})
        return {'source': 'itemstore-galleries', 'categories': len(categories), 'weaponGalleries': len(galleries),
                'unresolvedWeaponFamilies': sorted(set(owners) - set(seeds)), 'offline': self.args.offline}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=['all', 'wiki', 'itemstore-media', 'itemstore-galleries'], default='all')
    parser.add_argument('--offline', action='store_true', help='Use exact successful caches; retain original retrieval dates')
    parser.add_argument('--refresh', action='store_true', help='Fetch all selected pages again, rather than resume successful caches')
    parser.add_argument('--dry-run', action='store_true', help='Validate existing caches and traversal without changing any index; requires --offline')
    parser.add_argument('--max-wiki-pages', type=int, default=128, help='Hard cap; current research used 31')
    parser.add_argument('--max-media-pages', type=int, default=256, help='Hard cap; current research used 92')
    parser.add_argument('--max-galleries', type=int, default=40, help='Hard cap; current research used 29')
    args = parser.parse_args()
    if args.offline and args.refresh:
        parser.error('--offline and --refresh are mutually exclusive')
    if args.dry_run and not args.offline:
        parser.error('--dry-run requires --offline (no network or cache mutations)')
    if min(args.max_wiki_pages, args.max_media_pages, args.max_galleries) < 1:
        parser.error('Every bound must be positive')
    collector = Collector(args)
    selected = [('wiki', collector.wiki), ('itemstore-media', collector.media), ('itemstore-galleries', collector.galleries)]
    for name, collect in selected:
        if args.source in ['all', name]:
            print(json.dumps(collect(), ensure_ascii=False), flush=True)
    print(json.dumps({'catalogueChanged': False, 'skinImagesChanged': False, 'dryRun': args.dry_run}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Apex art index collection failed; incomplete source index not published: ' + str(error))
        raise SystemExit(1)
