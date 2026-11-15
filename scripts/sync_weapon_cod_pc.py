#!/usr/bin/env python3
"""Build a bounded COD PC blueprint catalogue from GamesAtlas' public index.

The source is a community directory, not an official full-history/game API.
Images remain at their observed GamesAtlas URLs. No platform video is read.
Successful source/image receipts live in ignored local-only/weapon-skins/cod-pc.
A failed required index leaves the last catalogue untouched. Existing identities,
firstSeenAt, media, searchAliases, and the independent inspectionLibrary survive.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urljoin, urlsplit
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/weapon-skins/call-of-duty.json'
CACHE = ROOT / 'local-only/weapon-skins/cod-pc'
ORIGIN = 'https://www.gamesatlas.com'
SOURCE_PAGE = ORIGIN + '/cod-warzone-2-blueprints/'
EDITIONS = {
    'modern-warfare-2': ('mwii', 'Modern Warfare II', 'Modern Warfare II / Warzone 2'),
    'modern-warfare-3': ('mwiii', 'Modern Warfare III', 'Modern Warfare III / Warzone'),
    'black-ops-6': ('bo6', 'Black Ops 6', 'Black Ops 6 / Warzone'),
    'black-ops-7': ('bo7', 'Black Ops 7', 'Black Ops 7 / Warzone'),
    'modern-warfare-4': ('mwiv', 'Modern Warfare IV', 'Modern Warfare IV / Warzone'),
}
CATEGORIES = {'Assault Rifles': '突击步枪', 'SMGs': '冲锋枪', 'Battle Rifles': '战斗步枪',
              'Shotguns': '霰弹枪', 'LMGs': '轻机枪', 'Marksman Rifles': '射手步枪',
              'Sniper Rifles': '狙击步枪', 'Handguns': '手枪', 'Melee Weapons': '近战武器',
              'Launchers': '发射器', 'Special Weapons': '特殊武器'}

# Reviewed exceptions to missing source fields; exact image bytes are pinned.
VERIFIED_WEAPON_IDENTITIES = {11796: {'weapon': 'Jotunn Star', 'weaponSlug': 'jotunn-star', 'class': 'Melee Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-7/blueprints/Decomposition-Collection.jpg', 'imageSha256': 'e2786cee51b3b92c4f6338f3afc0275d47b4a575c254e26eab3331a01d902fc0', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11719: {'weapon': 'Jotunn Star', 'weaponSlug': 'jotunn-star', 'class': 'Melee Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-7/blueprints/Fiery-Guidance.jpg', 'imageSha256': '59722d48a10f73f5cff53b150014c59eb62a43728e66d30acd688924a4d67ed8', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11716: {'weapon': 'Jotunn Star', 'weaponSlug': 'jotunn-star', 'class': 'Melee Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-7/blueprints/Lamp-Essence.jpg', 'imageSha256': '004cde0f2e45b7f16075bfcc0f9ff5b92d812f37f5717e1065e9162f79ed6f1d', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11619: {'weapon': 'LGM-1', 'weaponSlug': 'lgm-1', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-7/blueprints/Barbarian.jpg', 'imageSha256': '43ee56d0a47c90dbb4879139b5176009aa398ef6d0dc03c6a5aef0100e0de32b', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10813: {'weapon': 'DRI-11 Beamsmasher', 'weaponSlug': 'dri-11-beamsmasher', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Fire-Eater.jpg', 'imageSha256': '691c589f481a0ff559d2028d1e28d0ec0c8fb323e3f01cb664278d1b1cf0c356', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10774: {'weapon': 'Ray Gun', 'weaponSlug': 'ray-gun', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Ultraviolet.jpg', 'imageSha256': '0bdebb4d75f8f41ccdd05dbcbe0891d83bdf6539a9757af1f4c512c40e60f595', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10752: {'weapon': 'Ray Gun', 'weaponSlug': 'ray-gun', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Hell-Chord.jpg', 'imageSha256': '1740474b4796c154a3872e68bb4fc1257afe2dbc24e43388e64087a8b4f6df33', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10735: {'weapon': 'Staff of Ice', 'weaponSlug': 'staff-of-ice', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Cosmic-Blade.jpg', 'imageSha256': '75522049e9cfb1185cd3778ef520d1af24eab34811923eda68f59c9196dfd4e5', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10698: {'weapon': 'Thrustodyne M23', 'weaponSlug': 'thrustodyne-m23', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Propulsion.jpg', 'imageSha256': 'c1b3ee179741c8b14cc03d13a10b683ca2d8d143b2d5b86f646df4042e72c2dd', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10637: {'weapon': 'Ray Gun', 'weaponSlug': 'ray-gun', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Glyphside.jpg', 'imageSha256': '655ce8fc639a90b990b3a46515ee48f910adc55e95fc752843dd7fe991ff5197', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10609: {'weapon': 'DRI-11 Beamsmasher', 'weaponSlug': 'dri-11-beamsmasher', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Mistletoe.jpg', 'imageSha256': '0e17fed500347396f42be9f22254b2a3eeae1b94c5e902bce328503fc444e3cd', 'reviewedAt': '2026-11-02T18:57:05Z'}, 10574: {'weapon': 'Ray Gun', 'weaponSlug': 'ray-gun', 'class': 'Special Weapons', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Zaptastic.jpg', 'imageSha256': '40b3970f93aee2e9327fa5d0e795731986d4f1a403e4fcf97f3a83652bb6fb3d', 'reviewedAt': '2026-11-02T18:57:05Z'}, 8363: {'weapon': 'FJX Imperium', 'weaponSlug': 'fjx-imperium', 'class': 'Sniper Rifles', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-modern-warfare-2/blueprints/Easy-Money.jpg', 'imageSha256': '36ef1d1d5b912a0c63197feec65df5bb7a298e2923a5ad478792ade15d80b363', 'reviewedAt': '2026-11-02T18:57:05Z'}, 8362: {'weapon': 'Kastov-74u', 'weaponSlug': 'kastov-74u', 'class': 'Assault Rifles', 'basis': 'embedded_game_label', 'imageUrl': 'https://www.gamesatlas.com/images/cod-modern-warfare-2/blueprints/Reap-This.jpg', 'imageSha256': '725d6dc0e3bd481438d572d714f93a761bb6489f7cad1e9d0b6f2e5102b9defa', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11340: {'weapon': 'Ray Gun', 'weaponSlug': 'ray-gun', 'class': 'Special Weapons', 'basis': 'https://www.callofduty.com/ja/store/bundles/5856', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/No-Refunds.jpg', 'imageSha256': 'f23bd7d07108714d9595aacde4fb0fd15b6381f5b63a57257dc48b546560c16b', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11160: {'weapon': 'DRI-11 Beamsmasher', 'weaponSlug': 'dri-11-beamsmasher', 'class': 'Special Weapons', 'basis': 'https://www.callofduty.com/no/store/bundles/5768', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Affliction.jpg', 'imageSha256': '854a160dde954616d8c204867f6ded255503747071f7eab492cc352c4a0e7905', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11142: {'weapon': 'Wunderwaffe DG-2', 'weaponSlug': 'wunderwaffe-dg-2', 'class': 'Special Weapons', 'basis': 'https://www.callofduty.com/ca/en/blog/2025/08/black-ops-6-warzone-battle-pass-blackcell-store-bundles-season-five', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Reclamator.jpg', 'imageSha256': '24f865e8775e950c6cf4894e84dcfada09a5bb94fc3bd1dd8d63b6b134651712', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11082: {'weapon': 'Thrustodyne M23', 'weaponSlug': 'thrustodyne-m23', 'class': 'Special Weapons', 'basis': 'https://www.callofduty.com/nl/store/bundles/5412', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Search-Engine.jpg', 'imageSha256': 'bf6437de8ff795a7fb0fff7512f387e9c3d35e45927c5667b330cff25929121f', 'reviewedAt': '2026-11-02T18:57:05Z'}, 11073: {'weapon': 'Wunderwaffe DG-2', 'weaponSlug': 'wunderwaffe-dg-2', 'class': 'Special Weapons', 'basis': 'https://callofduty.fandom.com/wiki/Wunderwaffe_DG-2', 'imageUrl': 'https://www.gamesatlas.com/images/cod-black-ops-6/blueprints/Wundersaw.jpg', 'imageSha256': 'cd2c0341ada8b4bd2852a301d65ebb912929e199adebc7158806c07417b7811c', 'reviewedAt': '2026-11-02T18:57:05Z'}}
JOTUNN_CLASS_SOURCE = 'https://www.callofduty.com/blog/2026/04/call-of-duty-black-ops-7-warzone-season-03-reloaded-announcement?pubDate=20260423'

# Actual base-weapon pages override blueprint-page copy/paste category errors.
CANONICAL_WEAPON_SOURCES = {'cod-bo6-aek-973': {'url': 'https://www.gamesatlas.com/cod-black-ops-6/weapons/aek-973', 'cacheLabel': 'weapon-297091fe07dfd702.html'}, 'cod-bo6-essex-model-07': {'url': 'https://www.gamesatlas.com/cod-black-ops-6/weapons/essex-model-07', 'cacheLabel': 'weapon-42c760668349a08a.html'}, 'cod-bo6-swat-5-56': {'url': 'https://www.gamesatlas.com/cod-black-ops-6/weapons/swat-5-56', 'cacheLabel': 'weapon-2eca9bdb0bb81289.html'}, 'cod-bo6-sirin-9mm': {'url': 'https://www.gamesatlas.com/cod-black-ops-6/weapons/sirin-9mm', 'cacheLabel': 'weapon-9976142e110e0328.html', 'overrideClass': 'Special Weapons', 'overrideSourceUrl': 'https://www.callofduty.com/blog/2024/11/call-of-duty-black-ops-6-season-one-mp-zombies-maps-modes-announcement/'}, 'cod-bo7-m15-mod-0': {'url': 'https://www.gamesatlas.com/cod-black-ops-7/weapons/m15-mod-0', 'cacheLabel': 'weapon-2a9efc2f0c37547c.html'}, 'cod-bo7-sokol-545': {'url': 'https://www.gamesatlas.com/cod-black-ops-7/weapons/sokol-545', 'cacheLabel': 'weapon-fe681c0e739a39b1.html'}, 'cod-bo7-vs-recon': {'url': 'https://www.gamesatlas.com/cod-black-ops-7/weapons/vs-recon', 'cacheLabel': 'weapon-19773abe3c091655.html'}, 'cod-bo7-warden-308': {'url': 'https://www.gamesatlas.com/cod-black-ops-7/weapons/warden-308', 'cacheLabel': 'weapon-23f7a47646a71e01.html'}, 'cod-mwii-lachmann-762': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-2/weapons/lachmann-762', 'cacheLabel': 'weapon-2aeb9e47e83f59bf.html'}, 'cod-mwii-rpk': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-2/weapons/rpk', 'cacheLabel': 'weapon-94e20a8a621dac4c.html'}, 'cod-mwii-vaznev-9k': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-2/weapons/vaznev-9k', 'cacheLabel': 'weapon-a069bfc951e72e5a.html'}, 'cod-mwiii-dg-58': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/dg-58', 'cacheLabel': 'weapon-4e558a76c1932ac5.html'}, 'cod-mwiii-gutter-knife': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/gutter-knife', 'cacheLabel': 'weapon-ce0cc80a09dda292.html'}, 'cod-mwiii-lockwood-680': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/lockwood-680', 'cacheLabel': 'weapon-2d1d1722d4f7fbd6.html'}, 'cod-mwiii-mcw': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/mcw', 'cacheLabel': 'weapon-36a30aff6f80a7ae.html'}, 'cod-mwiii-soulrender': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/soulrender', 'cacheLabel': 'weapon-da31ea550768fa19.html'}, 'cod-mwiii-wsp-swarm': {'url': 'https://www.gamesatlas.com/cod-modern-warfare-3/weapons/wsp-swarm', 'cacheLabel': 'weapon-e354dc443f70d232.html'}}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def load(path, fallback=None):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else fallback


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(',', ':'))
            stream.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', html.unescape(str(value)).lower()).strip('-')


def allowed(url, images=False):
    parsed = urlsplit(url)
    return (parsed.scheme == 'https' and parsed.netloc == 'www.gamesatlas.com'
            and not parsed.username and not parsed.password
            and (not images or parsed.path.startswith('/images/')))


class Node:
    def __init__(self, tag='', attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    def all(self, tag=None, cls=None):
        result = []
        for child in self.children:
            if isinstance(child, Node):
                if (not tag or child.tag == tag) and (not cls or cls in child.attrs.get('class', '').split()):
                    result.append(child)
                result.extend(child.all(tag, cls))
        return result

    def text(self):
        return ' '.join(''.join(child.text() if isinstance(child, Node) else child for child in self.children).split())


class Tree(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
        self.feed(raw)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.current = node

    def handle_endtag(self, tag):
        current = self.current
        while current.parent:
            if current.tag == tag:
                self.current = current.parent
                break
            current = current.parent

    def handle_data(self, data):
        self.current.children.append(data)


def source_fields(row, title):
    return [value for value in row.get('attr', {}).values()
            if any(title in name for name in value.get('title', []))]


def single_field(row, title, key='frontend_value'):
    values = source_fields(row, title)
    if len(values) != 1 or len(values[0].get(key, [])) != 1:
        return None
    return values[0][key][0]


class Sync:
    def __init__(self, args):
        self.args = args
        self.detail_results = {}

    def request(self, label, url, kind):
        if not allowed(url):
            raise RuntimeError('Unexpected source host: ' + url)
        path = CACHE / label
        receipt_path = path.with_suffix('.source.json')
        receipt = load(receipt_path)
        reusable = receipt and receipt.get('url') == url and path.exists()
        recent = reusable and (datetime.now(timezone.utc) - datetime.fromisoformat(receipt['retrievedAt'].replace('Z', '+00:00'))).total_seconds() < 43200
        if self.args.offline or (self.args.resume and recent):
            if not reusable:
                raise RuntimeError('Missing exact offline source: ' + label)
            raw = path.read_bytes()
            if receipt.get('sha256') and hashlib.sha256(raw).hexdigest() != receipt['sha256']:
                raise RuntimeError('Source cache hash mismatch: ' + label)
        else:
            result = subprocess.run([shutil.which('curl.exe') or 'curl', '--silent', '--show-error', '--fail',
                                     '--location', '--compressed', '--proto', '=https', '--proto-redir', '=https',
                                     '--connect-timeout', '10', '--max-time', '40', '--max-filesize', '12000000', url],
                                    capture_output=True, timeout=45)
            if result.returncode:
                raise RuntimeError(label + ': ' + result.stderr.decode('utf-8', errors='replace').strip())
            raw = result.stdout
            self.validate_source(raw, kind, label)
            receipt = {'url': url, 'retrievedAt': now(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + '.download')
            temporary.write_bytes(raw)
            os.replace(temporary, path)
            atomic(receipt_path, receipt)
            time.sleep(.25)
        self.validate_source(raw, kind, label)
        return raw.decode('utf-8'), receipt

    @staticmethod
    def validate_source(raw, kind, label):
        text = raw.decode('utf-8')
        if kind == 'index':
            payload = json.loads(text)
            if not isinstance(payload, dict) or sum(isinstance(r, dict) and bool(r.get('url')) for r in payload.values()) < 100:
                raise RuntimeError('Not a usable blueprint index: ' + label)
        elif len(raw) < 100 or '<title>403 Forbidden' in text or '<title>Just a moment' in text:
            raise RuntimeError('Not a usable public source: ' + label)

    def index(self):
        raw, page_receipt = self.request('all.html', SOURCE_PAGE, 'html')
        scripts = []
        for node in Tree(raw).root.all('script'):
            attributes = node.attrs
            link = attributes.get('src') or attributes.get('data-src')
            if attributes.get('data-file') == 'script' and link and link.startswith('/media/com_jchoptimize/cache/js/'):
                scripts.append(urljoin(ORIGIN, link))
        if not 1 <= len(scripts) <= 16:
            raise RuntimeError('Unexpected bounded blueprint configuration script inventory')
        data_url, config_receipt = None, None
        for url in scripts:
            script, receipt = self.request('js-' + urlsplit(url).path.rsplit('/', 1)[-1], url, 'js')
            match = re.search(r'UBLNConfig\.dataUrl\s*=\s*["\']([^"\']+)["\']', script)
            if match:
                candidate = urljoin(ORIGIN, match[1])
                if not allowed(candidate) or not urlsplit(candidate).path.startswith('/media/com_jamegafilter/') or not urlsplit(candidate).path.endswith('.json'):
                    raise RuntimeError('Unexpected blueprint index URL')
                data_url, config_receipt = candidate, receipt
                break
        if not data_url:
            raise RuntimeError('Public page no longer references a recognizable index')
        index, receipt = self.request('all-index.json', data_url, 'index')
        payload = json.loads(index)
        rows = [row for row in payload.values() if isinstance(row, dict) and row.get('url')]
        if len(rows) > self.args.max_records:
            raise RuntimeError('Blueprint record bound exceeded; catalogue preserved')
        if len({row['id'] for row in rows}) != len(rows):
            raise RuntimeError('Duplicate source article IDs in index')
        return rows, {'page': page_receipt, 'configuration': config_receipt, 'index': receipt,
                      'rawObjectCount': len(payload), 'blueprintRows': len(rows),
                      'nonBlueprintObjectsExcluded': len(payload) - len(rows)}

    def detail(self, row):
        identifier = row['id']
        if identifier in self.detail_results:
            return self.detail_results[identifier]
        if len(self.detail_results) >= self.args.max_detail_pages:
            raise RuntimeError('Detail-page bound reached')
        url = urljoin(ORIGIN, row['url'])
        try:
            raw, receipt = self.request('detail-' + str(identifier) + '.html', url, 'html')
            tree = Tree(raw)
            headings = tree.root.all('h1')
            if not headings or slug(headings[0].text()) != slug(row['name']):
                raise RuntimeError('Detail title differs from blueprint identity')
            fields = {}
            for node in tree.root.all('li', 'field-entry'):
                labels, values = node.all(cls='field-label'), node.all(cls='field-value')
                if labels and values:
                    fields[labels[0].text()] = {'value': values[0].text(),
                                              'links': [a.attrs.get('href') for a in values[0].all('a') if a.attrs.get('href')]}
            image = next((node.attrs.get('content') for node in tree.root.all('meta')
                          if node.attrs.get('property') == 'og:image'), None)
            result = {'fields': fields, 'imageUrl': image if image and allowed(image, True) else None,
                      'source': receipt, 'status': 'source_confirmed'}
        except Exception as error:
            result = {'status': 'unavailable', 'reason': str(error), 'sourceUrl': url}
        self.detail_results[identifier] = result
        return result

    def image(self, url):
        if not allowed(url, True):
            return {'status': 'rejected_source_url', 'url': url}
        label = 'image-' + hashlib.sha256(url.encode()).hexdigest()[:20]
        path, receipt_path = CACHE / 'images' / (label + '.image'), CACHE / 'images' / (label + '.source.json')
        receipt = load(receipt_path)
        if path.exists() and receipt and receipt.get('url') == url:
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != receipt['sha256']:
                return {'status': 'cache_hash_mismatch', 'url': url}
        elif self.args.offline:
            return {'status': 'unavailable_offline', 'url': url}
        else:
            result = subprocess.run([shutil.which('curl.exe') or 'curl', '--silent', '--show-error', '--fail',
                                     '--location', '--compressed', '--proto', '=https', '--proto-redir', '=https',
                                     '--connect-timeout', '8', '--max-time', '25', '--max-filesize', '5000000',
                                     '--referer', SOURCE_PAGE, url], capture_output=True, timeout=30)
            time.sleep(.15)
            if result.returncode:
                return {'status': 'unavailable', 'url': url, 'reason': result.stderr.decode('utf-8', errors='replace').strip()}
            raw = result.stdout
            receipt = {'url': url, 'retrievedAt': now(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        try:
            with Image.open(io.BytesIO(raw)) as picture:
                width, height, image_format = picture.width, picture.height, picture.format
                picture.load()
            if width < 200 or height < 100:
                return {'status': 'too_small', 'url': url, 'width': width, 'height': height}
        except Exception as error:
            return {'status': 'not_decodable_image', 'url': url, 'reason': str(error)}
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix('.download')
            temporary.write_bytes(raw)
            os.replace(temporary, path)
            atomic(receipt_path, receipt)
        return {'status': 'image_confirmed', 'url': url, 'width': width, 'height': height,
                'format': image_format, 'source': receipt}

    def weapon_classes(self):
        result = {}
        for key, reference in CANONICAL_WEAPON_SOURCES.items():
            raw, receipt = self.request(reference['cacheLabel'], reference['url'], 'html')
            weapon_class = None
            for node in Tree(raw).root.all('li', 'field-entry'):
                labels, values = node.all(cls='field-label'), node.all(cls='field-value')
                if labels and values and labels[0].text() == 'Weapon Class':
                    weapon_class = values[0].text()
            if weapon_class not in CATEGORIES:
                raise RuntimeError('Unrecognized actual base-weapon class: ' + key)
            result[key] = {'class': reference.get('overrideClass', weapon_class), 'weaponPageClass': weapon_class,
                           'sourceUrl': reference.get('overrideSourceUrl', reference['url']), 'source': receipt}
            if reference.get('overrideClass'):
                result[key]['note'] = 'Publisher explicitly places Sirin 9mm in the Special secondary category; the community weapon page says Handguns.'
        return result

    def run(self):
        previous_doc = load(OUT, {'skins': []})
        previous = {record['id']: record for record in previous_doc['skins']}
        by_source = {str(record.get('sourceId')): record for record in previous.values()}
        rows, sources = self.index()
        weapon_classes = self.weapon_classes()
        thumbnail_counts = Counter(row['thumbnail'] for row in rows)
        details = [row for row in rows if len(source_fields(row, 'Base Weapon')) != 1
                   or not single_field(row, 'Weapon Class') or thumbnail_counts[row['thumbnail']] > 1
                   or single_field(row, 'Weapon Class') == 'Melee Weapons' or row['name'] in ['Printed End', 'Plague Doctor']]
        if len(details) > self.args.max_detail_pages:
            raise RuntimeError('Detail inventory exceeds configured bound')
        # Detail pages are few, scoped to uncertain identities, reused pictures,
        # melee and the user example. Required index retrieval stays sequential.
        with ThreadPoolExecutor(max_workers=self.args.workers) as pool:
            list(pool.map(self.detail, details))
        image_urls = {urljoin(ORIGIN + '/', row['thumbnail']) for row in rows}
        image_urls.update(detail['imageUrl'] for detail in self.detail_results.values() if detail.get('imageUrl'))
        quality = {}
        with ThreadPoolExecutor(max_workers=self.args.workers) as pool:
            for number, (url, proof) in enumerate(pool.map(lambda url: (url, self.image(url)), sorted(image_urls)), 1):
                quality[url] = proof
                if number % 200 == 0:
                    print(json.dumps({'imageChecks': number, 'of': len(image_urls)}, ensure_ascii=False), flush=True)
        records, identities, unresolved, reused_images = [], {}, [], []
        for row in rows:
            source_id = 'gamesatlas-' + str(row['id'])
            edition = single_field(row, 'COD Game', 'value') or row['url'].split('/')[2]
            if edition not in EDITIONS:
                unresolved.append({'sourceId': source_id, 'reason': 'unsupported_game_edition', 'row': row})
                continue
            short, title, game_title = EDITIONS[edition]
            detail = self.detail_results.get(row['id'], {})
            owner = single_field(row, 'Base Weapon')
            owner_slug = single_field(row, 'Base Weapon', 'value')
            class_name = single_field(row, 'Weapon Class')
            base_detail = detail.get('fields', {}).get('Base Weapon', {})
            if base_detail.get('value') and len(base_detail.get('links', [])) == 1:
                owner = base_detail['value']
                owner_slug = urlsplit(base_detail['links'][0]).path.rsplit('/', 1)[-1]
            if detail.get('fields', {}).get('Weapon Class', {}).get('value'):
                class_name = detail['fields']['Weapon Class']['value']
            verified_identity = VERIFIED_WEAPON_IDENTITIES.get(row['id'])
            if verified_identity:
                proof = quality.get(verified_identity['imageUrl'], {})
                if proof.get('source', {}).get('sha256') == verified_identity['imageSha256']:
                    owner, owner_slug, class_name = verified_identity['weapon'], verified_identity['weaponSlug'], verified_identity['class']
                else:
                    verified_identity = None
            blueprint_class = class_name
            weapon_classification = weapon_classes.get('cod-' + short + '-' + str(owner_slug))
            if weapon_classification:
                class_name = weapon_classification['class']
            blueprint_slug = row['url'].rstrip('/').rsplit('/', 1)[-1]
            identity = (edition, owner_slug, slug(row['name'])) if owner_slug else None
            prior = by_source.get(source_id, {})
            if edition == 'modern-warfare-2' and owner_slug == 'combat-knife' and blueprint_slug == 'slaughter-king':
                prior = previous.get('cod-mwii-slaughter-king', prior)
            identifier = prior.get('id') or ('cod-' + short + '-' + (owner_slug or 'unresolved-ga-' + str(row['id'])) + '-' + blueprint_slug)
            if identity and identity in identities:
                kept = identities[identity]
                kept.setdefault('sourceAliases', []).append({'sourceId': source_id, 'url': urljoin(ORIGIN, row['url'])})
                continue
            prior = previous.get(identifier, prior)
            image_url = urljoin(ORIGIN + '/', row['thumbnail'])
            image_kind = 'thumbnail'
            if detail.get('imageUrl') and quality.get(detail['imageUrl'], {}).get('status') == 'image_confirmed':
                image_url, image_kind = detail['imageUrl'], 'screenshot'
            proof = quality.get(image_url, {})
            reason = None
            if not owner or not owner_slug or not class_name:
                reason = 'base_weapon_or_class_unresolved'
            if thumbnail_counts[row['thumbnail']] > 1 and image_kind == 'thumbnail':
                reason = 'source_thumbnail_reused_for_multiple_blueprints'
                reused_images.append(source_id)
            if proof.get('status') != 'image_confirmed':
                reason = 'image_unavailable_or_unverified'
            # The source explicitly uses tba.jpg as a generic game-logo card.
            # A detail-page OG tag does not turn that placeholder into skin art.
            if re.search(r'(?:/tba\.|_tba__)', image_url, re.I):
                reason = 'generic_game_logo_placeholder'
            if thumbnail_counts[row['thumbnail']] > 1 and image_kind != 'thumbnail' and reason != 'generic_game_logo_placeholder':
                filename = Path(urlsplit(image_url).path).stem
                if slug(filename) != slug(row['name']) and not slug(filename).startswith(slug(row['name']) + '-'):
                    reason = 'source_picture_belongs_to_different_blueprint'
            record = {**prior, 'id': identifier, 'game': 'call-of-duty', 'name': (owner or '待核基础武器') + ' · ' + row['name'],
                      'englishName': (owner + ' — ' if owner else '') + row['name'],
                      'weaponId': 'cod-' + short + '-' + (owner_slug or 'unresolved-' + str(row['id'])),
                      'weaponName': owner or '待核基础武器', 'weaponEnglishName': owner or 'Unresolved',
                      'weaponType': 'melee' if class_name == 'Melee Weapons' else 'gun',
                      'category': CATEGORIES.get(class_name, '待核武器类别'),
                      'rarity': prior.get('rarity') or {'id': '', 'name': '', 'color': '#a24a40'},
                      'description': game_title + ' 端游武器蓝图；社区目录静态外观，未据此声称专属检视或当前可获取。',
                      'sourceId': source_id, 'sourceUrl': urljoin(ORIGIN, row['url']), 'sourceName': 'GamesAtlas 社区蓝图目录',
                      'region': '国际服', 'gameTitle': game_title, 'gameEdition': edition, 'editionTitle': title,
                      'firstSeenAt': prior.get('firstSeenAt', sources['index']['retrievedAt']),
                      'releaseDate': prior.get('releaseDate'), 'releaseDateStatus': prior.get('releaseDateStatus', 'unverified'),
                      'timingNote': prior.get('timingNote') or '社区目录文章日期、作品发售日和本次采集时间均不等于蓝图首发日；未知日期保持未核实。',
                      'publicationStatus': 'pending' if reason else 'ready',
                      'chromas': prior.get('chromas', []), 'levels': prior.get('levels', []), 'media': prior.get('media', []),
                      'tags': list(dict.fromkeys(prior.get('tags', []) + ['使命召唤端游', '蓝图', title, short.upper(), owner or '待核武器'])),
                      'catalogueEvidence': {'indexUrl': sources['index']['url'], 'sourceArticleId': row['id'],
                                            'gameFromSource': single_field(row, 'COD Game'),
                                            'baseWeaponFields': source_fields(row, 'Base Weapon'),
                                            'retrievedAt': sources['index']['retrievedAt']}}
            if weapon_classification:
                record['catalogueEvidence']['baseWeaponClassification'] = weapon_classification
                record['catalogueEvidence']['blueprintClassBeforeCanonicalization'] = blueprint_class
            if verified_identity:
                record['catalogueEvidence']['reviewedWeaponIdentity'] = verified_identity
                if owner_slug == 'jotunn-star':
                    record['catalogueEvidence']['meleeClassificationSource'] = JOTUNN_CLASS_SOURCE
                if class_name == 'Special Weapons':
                    record['tags'].append('Wonder Weapon')
            if row.get('published_date'):
                record['sourceArticleTimestamp'] = row['published_date'][0]
            if single_field(row, 'Title Update'):
                record['sourceSeason'] = single_field(row, 'Title Update')
            if detail.get('status') == 'source_confirmed':
                record['catalogueEvidence']['detailSource'] = detail['source']
            if not reason:
                record['image'] = {'url': image_url, 'sourcePageUrl': record['sourceUrl'], 'assetSourceUrl': image_url,
                                   'sourceType': 'game_asset', 'provider': 'GamesAtlas', 'kind': image_kind,
                                   'caption': '单件蓝图' + ('目录缩略图' if image_kind == 'thumbnail' else '外观图') + '，由社区资料站 GamesAtlas 提供。',
                                   'width': proof['width'], 'height': proof['height'], 'retrievedAt': proof['source']['retrievedAt']}
                record['imageEvidence'] = {'reviewStatus': 'source_confirmed', 'basis': 'named_index_record_and_decoded_image',
                                           'sha256': proof['source']['sha256'], 'format': proof['format']}
                record.pop('pendingReason', None)
            else:
                record['pendingReason'] = {'code': reason, 'sourceUrl': record['sourceUrl'], 'note': '源字段或单件配图尚未确认；不进入公开目录。'}
                unresolved.append({'id': identifier, 'sourceId': source_id, 'name': row['name'], 'reason': reason, 'url': record['sourceUrl']})
            rejected_same_art = (reason in ['generic_game_logo_placeholder', 'source_picture_belongs_to_different_blueprint']
                                 and prior.get('image', {}).get('assetSourceUrl') == image_url)
            if prior.get('publicationStatus') == 'ready' and prior.get('image') and not rejected_same_art:
                # Existing genuine art/media remain available even if a later
                # community index temporarily loses a field or thumbnail.
                record['publicationStatus'] = 'ready'
                prior_image = prior['image']
                if prior_image.get('assetSourceUrl') == image_url and not reason:
                    record['image'] = {**prior_image, **record['image']}
                else:
                    record['image'] = prior_image
                    record['imageEvidence'] = prior.get('imageEvidence') or {'reviewStatus': 'source_confirmed', 'basis': 'retained_previous_genuine_art', 'sha256': prior_image.get('sha256')}
                record.pop('pendingReason', None)
            if identifier == 'cod-mwii-slaughter-king':
                for key in ['sourceId', 'sourceUrl', 'sourceName', 'description', 'publishedDate', 'name']:
                    if key in prior:
                        record[key] = prior[key]
            records.append(record)
            if identity:
                identities[identity] = record
        current_ids = {record['id'] for record in records}
        for identifier, prior in previous.items():
            if identifier not in current_ids:
                records.append({**prior, 'historical': True, 'sourceStatus': 'retained_from_previous_successful_snapshot'})
        groups = defaultdict(list)
        for record in records:
            groups[(record['game'], record['weaponId'])].append(record)
        for key, group in groups.items():
            if len({record['weaponType'] for record in group}) != 1 or len({record['category'] for record in group}) != 1:
                raise RuntimeError('Unreviewed base-weapon taxonomy disagreement; catalogue preserved: ' + str(key))
        ready = [record for record in records if record['publicationStatus'] == 'ready']
        inspection_library = previous_doc.get('inspectionLibrary', [])
        video_count = sum(any(media.get('provider') in ['mp4', 'youtube', 'bilibili'] for media in record['media']) for record in ready)
        inspect_count = sum(any((media.get('kind') == 'inspect' or 'inspect' in media.get('contains', []))
                                and media.get('reviewStatus') in ['source_confirmed', 'sample_reviewed']
                                for media in record['media']) for record in ready)
        per_edition = []
        for edition, (_, title, _) in EDITIONS.items():
            part = [record for record in records if record.get('gameEdition') == edition]
            part_ready = [record for record in part if record['publicationStatus'] == 'ready']
            per_edition.append({'edition': edition, 'title': title, 'sourceRows': sum(single_field(row, 'COD Game', 'value') == edition for row in rows),
                                'catalogued': len(part), 'ready': len(part_ready), 'guns': sum(r['weaponType'] == 'gun' for r in part_ready),
                                'melee': sum(r['weaponType'] == 'melee' for r in part_ready), 'pending': len(part) - len(part_ready)})
        coverage = {**previous_doc.get('coverage', {}), 'status': 'partial', 'complete': False,
                    'catalogScope': 'observed_gamesatlas_cod_pc_blueprint_index', 'entryCount': len(ready),
                    'withVideoCount': video_count, 'withInspectCount': inspect_count,
                    'inspectionLibraryCount': len(inspection_library),
                    'inspectionLinkedVideoCount': sum(bool(item.get('associatedSkinIds')) for item in inspection_library),
                    'weaponClassificationAudit': {'baseGroupsChecked': len(groups), 'authoritativeBasePages': len(weapon_classes),
                        'unresolvedTypeConflicts': 0, 'unresolvedCategoryConflicts': 0},
                    'cataloguedCount': len(records), 'sourceBlueprintRows': len(rows), 'sourceConfigObjectsExcluded': sources['nonBlueprintObjectsExcluded'],
                    'gunCount': sum(r['weaponType'] == 'gun' for r in ready), 'meleeCount': sum(r['weaponType'] == 'melee' for r in ready),
                    'pendingCount': len(records) - len(ready), 'entriesWithVideo': sum(any(m.get('provider') in ['mp4', 'youtube', 'bilibili'] for m in r['media']) for r in ready),
                    'uniqueRemoteImagesChecked': len(quality), 'decodedRemoteImages': sum(q['status'] == 'image_confirmed' for q in quality.values()),
                    'imageVerificationNote': '格式解码成功不等于单件身份通过；Logo占位和错用其他蓝图的图片继续pending。',
                    'detailPagesChecked': sum(d['status'] == 'source_confirmed' for d in self.detail_results.values()),
                    'perEdition': per_edition, 'note': '逐件读取GamesAtlas公开端游蓝图目录；未混入CODM。作品和基础武器分开，不重复计入Warzone继承使用。该站内容和图像仍有缺漏，不代表COD全历史或官方完整资源。',
                    'remaining': ['源缺失的基础武器字段与复用图片', '2019及更早作品、Cold War/Vanguard等其他独立历史目录',
                                  '全部专属检视与触发条件', '蓝图准确首发日、国服与地区差异']}
        coverage.pop('liveMetadataRefreshed', None)
        coverage.pop('successfulRemoteImages', None)
        coverage['pendingReasonCounts'] = dict(Counter(r.get('pendingReason', {}).get('code') for r in records if r['publicationStatus'] != 'ready'))
        timestamp = max([sources['index']['retrievedAt']] + [q['source']['retrievedAt'] for q in quality.values() if q.get('source')] + [v['source']['retrievedAt'] for v in weapon_classes.values()])
        output = {**previous_doc, 'schemaVersion': 1, 'game': 'call-of-duty', 'updatedAt': timestamp,
                  'source': {**previous_doc.get('source', {}), 'name': 'GamesAtlas public PC blueprint catalogue', 'url': SOURCE_PAGE, 'indexUrl': sources['index']['url'],
                             'retrievedAt': sources['index']['retrievedAt'], 'type': 'community', 'configuration': sources['configuration']},
                  'coverage': coverage, 'skins': sorted(records, key=lambda r: (r.get('gameEdition', ''), r['weaponType'], r['weaponEnglishName'], r['englishName'], r['id']))}
        report = {'sources': sources, 'coverage': coverage, 'unresolved': unresolved, 'reusedThumbnailsWithoutUniqueDetailArt': reused_images,
                  'detailResults': self.detail_results, 'imageResults': quality}
        atomic(CACHE / 'reconciliation.json', report)
        atomic(OUT, output)
        print(json.dumps({'ready': len(ready), 'guns': coverage['gunCount'], 'melee': coverage['meleeCount'],
                          'pending': coverage['pendingCount'], 'catalogued': len(records), 'offline': self.args.offline}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--resume', action='store_true', help='Reuse exact successful source pages from the last 12 hours')
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 9))
    parser.add_argument('--max-records', type=int, default=10000)
    parser.add_argument('--max-detail-pages', type=int, default=400)
    args = parser.parse_args()
    if min(args.max_records, args.max_detail_pages) < 1:
        parser.error('Source bounds must be positive')
    Sync(args).run()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('COD PC sync failed; previous catalogue preserved: ' + str(error))
        raise SystemExit(1)
