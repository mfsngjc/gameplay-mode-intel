#!/usr/bin/env python3
"""Refresh the independently scoped COD Mobile weapon cosmetic catalogue.

Source: linked Zilliongamer weapon/skin pages (international community index),
plus the source-reviewed official showcase selection retained on migration.
This indexes the upstream images; it does not download platform videos or
claim a complete China/global release list. A failed request preserves the
last successful game snapshot. Use --offline to rebuild cached source data.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'local-only/weapon-skins/cod-mobile'
OUT = ROOT / 'data/weapon-skins/cod-mobile.json'
BASE = 'https://zilliongamer.com'
ROOT_URLS = [
    BASE + '/call-of-duty-mobile/page/weapons',
    BASE + '/call-of-duty-mobile/page/call-of-duty-mobile-guns',
    BASE + '/call-of-duty-mobile/c/skins-list/call-of-duty-mobile-skins-list',
]
BARE_MELEE = {'knife', 'machete', 'nunchuks', 'nunchucks', 'kali-sticks', 'sickle', 'wrench', 'axe', 'katana', 'shovel',
              'baseball-bat', 'base-melee', 'sai', 'spear', 'ballistic-knife', 'butterfly-knife', 'karambit'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
RARITIES = {'mythic': ('神话 / Mythic', '#bf403d'), 'legendary': ('传说 / Legendary', '#c18426'),
            'epic': ('史诗 / Epic', '#8b52b7'), 'rare': ('稀有 / Rare', '#527bbd'),
            'uncommon': ('罕见 / Uncommon', '#4c9764'), 'common': ('普通 / Common', '#7f888b'),
            'legacy': ('典藏 / Legacy', '#b94d31')}


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def text(node):
    if isinstance(node, str):
        return node
    return ' '.join(text(child) for child in node.children)


def prefix_text(node, target):
    """Text preceding an image, excluding acquisition paragraphs after it."""
    values = []
    def visit(value):
        if value is target:
            return True
        if isinstance(value, str):
            values.append(value)
            return False
        for child in value.children:
            if visit(child):
                return True
        return False
    visit(node)
    return ' '.join(values)


def clean(value):
    return re.sub(r'\s+', ' ', value).strip()


class Node:
    def __init__(self, tag='', attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node('root')
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def body(tree):
    return next((n for n in tree.root.walk() if 'post' in n.attrs.get('class', '').split()), None)


def safe_source(value):
    p = urlparse(value)
    return p.scheme == 'https' and p.hostname == 'zilliongamer.com' and p.path.startswith('/call-of-duty-mobile/')


def fetch(url, offline=False):
    if not safe_source(url):
        raise ValueError('Unapproved catalogue URL: ' + url)
    path = CACHE / 'pages' / (hashlib.sha256(url.encode()).hexdigest()[:24] + '.json')
    if offline:
        source = json.loads(path.read_text(encoding='utf-8'))
        if source['url'] != url:
            raise ValueError('Source cache URL mismatch')
        return source
    curl = shutil.which('curl.exe') or shutil.which('curl')
    result = subprocess.run([curl, '--silent', '--show-error', '--location', '--fail', '--retry', '1',
                             '--connect-timeout', '10', '--max-time', '45', url], capture_output=True)
    if result.returncode:
        raise RuntimeError(url + ': ' + result.stderr.decode(errors='replace')[:300])
    html = result.stdout.decode('utf-8', errors='replace')
    parsed = Tree(html)
    if body(parsed) is None or not any(n.tag == 'h1' for n in parsed.root.walk()):
        raise ValueError('No article body in source: ' + url)
    source = {'url': url, 'retrievedAt': now(), 'sha256': hashlib.sha256(result.stdout).hexdigest(), 'html': html}
    atomic(path, source)
    return source


def links(source, all_page=False):
    parsed = Tree(source['html'])
    scope = parsed.root if all_page else body(parsed)
    return [(urljoin(source['url'], n.attrs['href']), clean(text(n))) for n in scope.walk()
            if n.tag == 'a' and n.attrs.get('href') and not n.attrs['href'].startswith('#')]


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def normal_weapon(value):
    value = clean(value)
    value = re.sub(r'^(?:The\s+)?(?:Best\s+)?', '', value, flags=re.I)
    value = re.split(r'\s+(?:Stats|Loadouts?|Skins?|Blueprints?|Weapon|Assault|Submachine|Sniper|Light Machine|Shotgun|Pistol|Attachment|Gunsmith|Best Builds)\b', value, flags=re.I)[0]
    value = re.sub(r'\s+(?:in|for|COD|Call of Duty).*$', '', value, flags=re.I).strip(' :|,-')
    value = re.sub(r'\s+Best$', '', value, flags=re.I)
    canonical = {'ak47': 'AK-47', 'ak-47': 'AK-47', 'ak117': 'AK117', 'hg40': 'HG 40', 'hg-40': 'HG 40',
                 'aks-74u': 'RUS-79U', 'rus-79u': 'RUS-79U', 'msms': 'MSMC', 'holger 26': 'Holger 26',
                 'qq9 or mp5': 'QQ9', 'type25': 'Type 25', 'arctic50': 'Arctic .50', 'arctic.50': 'Arctic .50',
                 'arctic .50': 'Arctic .50', 'arctic-50': 'Arctic .50', 'kilo bolt-action': 'Kilo Bolt-Action',
                 'krm 262': 'KRM-262', 'krm-262': 'KRM-262', 'baseball': 'Baseball Bat', 'baseball bat': 'Baseball Bat',
                 'butterfly': 'Butterfly Knife', 'butterfly knife': 'Butterfly Knife', 'foldking knife': 'Folding Knife',
                 'folding knife': 'Folding Knife', 'nunchuks': 'Nunchucks', 'nunchucks': 'Nunchucks',
                 'fhj18': 'FHJ-18', 'fhj 18': 'FHJ-18', 'fhj-18': 'FHJ-18', 'lag 53': 'LAG 53',
                 'ram-7': 'RAM-7', 'by15': 'BY15'}
    return canonical.get(value.lower(), value)


def category(weapon, url):
    weapon = weapon.lower()
    if any(x in weapon for x in ['knife', 'katana', 'karambit', 'nunchuck', 'boxing', 'baseball', 'sai', 'shovel', 'wrench', 'axe', 'spear', 'prizefighter', 'machete', 'assault knife', 'ballistic knife', 'butterfly']):
        return 'melee', '近战武器'
    groups = {'狙击步枪': ['locus', 'dl q33', 'arctic', 'rytec', 'outlaw', 'hdr', 'koshka', 'tundra', 'xpr', 'm21', 'na-45', 'zrg', '3-line'],
              '精确射手步枪': ['sks', 'swordfish-marksman', 'sp-r', 'kilo bolt', 'mk2', 'type 63', 'so-14'],
              '轻机枪': ['mg42', 'mg 82', 'holger', 'hades', 'rpd', 'm4lmg', 'ul736', 's36', 'chopper', 'dingo', 'pkm', 'bruen', 'dp27', 'raal'],
              '霰弹枪': ['by15', 'hs0405', 'hs2126', 'krm', 'r9-0', 'echo', 'striker', 'jak-12', 'argus', 'mx guardian', 'einhorn', 'vlk rogue'],
              '手枪': ['mw11', 'j358', '.50 gs', '50 gs', 'renetti', 'dobvra', 'shorty', 'crossbow', 'l-car', 'machine pistol', 'nail gun'],
              '冲锋枪': ['qq9', 'fennec', 'qxr', 'cbr4', 'mx9', 'pp19', 'ppsh', 'switchblade', 'gks', 'pharo', 'chicom', 'pdw', 'msmc', 'hg 40', 'rus-79', 'razorback', 'agr', 'ots', 'cx-9', 'striker 45', 'iso', 'uss 9', 'vmp', 'sten', 'lc10', 'fss hurricane', 'static hv'],
              '发射器': ['fhj', 'smrs', 'd13', 'thumper']}
    for name, members in groups.items():
        if any(x in weapon for x in members):
            return 'gun', name
    return 'gun', '枪械'


def catalogue_targets(roots):
    targets = {}
    exclude = re.compile(r'best-guns|best-weapons|weapon-tier|leaked-gun|comparison|vs-|top-\d|best-sniper|characters|charms|parachute|grenade|flashbang|wingsuit|backpack|calling-card|free-gun-skins|legendary-skins-list|call-of-duty-mobile-skins-list$')
    for source in roots:
        # Actual body links are authoritative; navigation contributes current individual guides.
        for url, label in links(source, all_page=True):
            if not safe_source(url) or exclude.search(urlparse(url).path):
                continue
            path = urlparse(url).path
            if ('/weapon-guide/' in path and re.search(r'stats|loadout', path)) or ('/skins-list/' in path and '-skins-list' in path) or path.endswith('/news/fennec-stats-attachment-skin'):
                weapon = normal_weapon(label)
                if not weapon or len(weapon) > 35:
                    weapon = ''
                targets.setdefault(url, weapon)
    return targets


def parse_skins(source, hint=''):
    parsed = Tree(source['html'])
    scope = body(parsed)
    title = clean(text(next(n for n in parsed.root.walk() if n.tag == 'h1')))
    weapon = normal_weapon(hint or title)
    if not weapon or len(weapon) > 36:
        return [], [{'url': source['url'], 'reason': 'Unresolved weapon identity', 'title': title}]
    nodes = list(scope.walk())
    events = []
    last_heading = ''
    last_label = ''
    image_rows = set()
    multi = source['url'].endswith('knife-weapon-list') or source['url'].endswith('launcher-skins-list')
    for node_index, n in enumerate(nodes):
        if n.tag in ('h2', 'h3', 'h4'):
            last_heading = clean(text(n))
        elif n.tag == 'tr':
            row_nodes = list(n.walk())
            cells = [a for a in n.children if isinstance(a, Node) and a.tag in ('td', 'th')]
            content = clean(text(n))
            if len(cells) == 1 and not any(a.tag == 'img' for a in row_nodes) and len(content) < 130:
                last_label = content
        elif n.tag == 'img':
            image = n.attrs
            src = image.get('data-src') or image.get('src', '')
            alt = image.get('title') or image.get('alt', '')
            if not src or 'featured' in src.lower() or 'loadout' in src.lower() or 'attachment' in src.lower():
                continue
            if not ('/skins/' in src.lower() or re.search(r'\bskin(?:s)?\s*:', alt, re.I)):
                continue
            # Bind images to the immediately preceding table title or named skin heading.
            row = n.parent
            while row is not None and row.tag != 'tr':
                row = row.parent
            cells = [a for a in row.children if isinstance(a, Node) and a.tag in ('td', 'th')] if row else []
            row_title = clean(prefix_text(cells[0], n)) if cells else ''
            candidate = row_title or last_label
            if not candidate or candidate.lower() in ('name', 'weapon', 'image') or re.search(r'^(?:rarity|unlock|effect|price)$', candidate, re.I):
                candidate = last_heading
            if re.search(r'skins? list|blueprint list|all skins|how to|loadout|attachments', candidate, re.I):
                candidate = ''
            alt_skin = re.split(r'\bskins?\s*:\s*', alt, flags=re.I)
            if not candidate and len(alt_skin) > 1:
                candidate = weapon + ' - ' + re.sub(r'\s*-\s*zilliongamer.*$', '', alt_skin[-1], flags=re.I)
            if not candidate:
                continue
            # A guide's class table may include other weapons; demand exact base-prefix
            # matching or an explicit Skin: title and retain the actual source label.
            skin_name = clean(candidate)
            item_weapon = weapon
            if multi:
                split = re.split(r'\s+-\s+', skin_name, maxsplit=1)
                if len(split) == 2:
                    item_weapon, skin_name = normal_weapon(split[0]), clean(split[1])
                elif len(alt_skin) > 1:
                    item_weapon = normal_weapon(re.sub(r'^COD Mobile\s+', '', alt_skin[0], flags=re.I).strip())
                    skin_name = clean(re.sub(r'\s*-\s*zilliongamer.*$', '', alt_skin[-1], flags=re.I))
                elif source['url'].endswith('knife-weapon-list'):
                    item_weapon = '近战武器'
                if source['url'].endswith('launcher-skins-list'):
                    if '/fhj18/' in src:
                        item_weapon = 'FHJ-18'
                    elif '/smrs/' in src:
                        item_weapon = 'SMRS'
            base_token = r'[ ._-]*'.join(re.escape(x) for x in re.findall(r'[a-z]+|\d+', item_weapon, re.I))
            if base_token:
                skin_name = re.sub(r'^' + base_token + r'(?:\s*[-:|]\s*|\s+)', '', skin_name, flags=re.I)
            if skin_name == candidate and len(alt_skin) > 1:
                skin_name = re.sub(r'\s*-\s*zilliongamer.*$', '', alt_skin[-1], flags=re.I).strip()
            if slug(skin_name) == slug(item_weapon) and ':' in alt:
                skin_name = clean(re.sub(r'\s*-\s*zilliongamer.*$', '', alt.rsplit(':', 1)[-1], flags=re.I))
            if source['url'].endswith('knife-weapon-list') and slug(candidate) in BARE_MELEE:
                continue
            if not skin_name or re.search(r'^(?:default|base|standard|normal|none)$|skins? list|blueprint list|weapon stats', skin_name, re.I):
                continue
            # Values only; no copied editorial paragraphs or unverified acquisition dates.
            following = []
            for f in nodes[node_index + 1:]:
                if f.tag == 'img':
                    break
                if f.tag == 'tr':
                    following.append(clean(text(f)))
            rarity_id = ''
            for row in following:
                match = re.match(r'Rarity\s+(Mythic|Legendary|Epic|Rare|Uncommon|Common|Legacy)\b', row, re.I)
                if match:
                    rarity_id = match.group(1).lower()
                    break
            img_url = urljoin(source['url'], src)
            if urlparse(img_url).hostname != 'zilliongamer.com':
                continue
            name = item_weapon + ' · ' + skin_name
            ident = 'codm-' + (slug(item_weapon) or 'melee') + '-' + slug(skin_name)
            events.append({'id': ident, 'name': name, 'englishName': item_weapon + ' — ' + skin_name,
                           'weapon': item_weapon, 'skinName': skin_name, 'rarity': rarity_id,
                           'image': img_url, 'width': image.get('width'), 'height': image.get('height'),
                           'sourceLabel': candidate, 'sourceImageTitle': alt,
                           'sourceUrl': source['url'], 'retrievedAt': source['retrievedAt']})
    return events, []


def make_entry(item, first_seen):
    weapon = item['weapon']
    kind, cat = category(weapon, item['sourceUrl'])
    if item['sourceUrl'].endswith('knife-weapon-list'):
        kind, cat = 'melee', '近战武器'
    if item['sourceUrl'].endswith('launcher-skins-list'):
        kind, cat = 'gun', '发射器'
    rarity = RARITIES.get(item['rarity'], ('', '#7f888b'))
    result = {
        'id': item['id'], 'game': 'cod-mobile', 'name': item['name'], 'englishName': item['englishName'],
        'weaponId': 'codm-' + (slug(weapon) or 'melee'), 'weaponName': weapon, 'weaponEnglishName': weapon,
        'weaponType': kind, 'category': cat,
        'rarity': {'id': item['rarity'], 'name': rarity[0], 'color': rarity[1]},
        'description': '国际服社区武器皮肤图鉴中的外观资料。保留上游英文名称与图片；国服名称、地区发行差异及专属检视录像尚未逐项核实。',
        'sourceId': item['id'], 'sourceUrl': item['sourceUrl'], 'sourceName': 'Zilliongamer COD Mobile 武器皮肤图鉴',
        'region': '国际服社区资料；国服发行情况未逐项核实', 'gameTitle': 'Call of Duty: Mobile',
        'firstSeenAt': first_seen, 'releaseDate': None, 'releaseDateStatus': 'unverified',
        'timingNote': '首次采集、来源页更新与皮肤首发日期分开记录；没有推定当前在售或可获取状态。',
        'publicationStatus': 'ready', 'chromas': [], 'levels': [], 'media': [],
        'tags': ['CODM', '使命召唤手游', weapon, item['rarity']],
        'image': {'url': item['image'], 'sourcePageUrl': item['sourceUrl'], 'assetSourceUrl': item['image'],
                  'sourceType': 'community', 'provider': 'Zilliongamer', 'kind': 'screenshot',
                  'caption': '国际服社区图鉴配图，保留原图比例和原站标识；不是官方素材网站。',
                  'retrievedAt': item['retrievedAt']},
        'sourceMetadata': {'label': item['sourceLabel'], 'imageTitle': item['sourceImageTitle']},
    }
    for dimension in ('width', 'height'):
        try:
            result['image'][dimension] = int(item[dimension])
        except (TypeError, ValueError):
            pass
    return result


def legacy_selection(previous):
    seed = CACHE / 'curated-seed.json'
    if seed.exists():
        items = json.loads(seed.read_text(encoding='utf-8'))
    else:
        items = [x for x in previous.get('skins', []) if x['id'] in ('codm-mg42-the-campaign', 'codm-holger-dark-frontier', 'codm-qq9-dual-kinetics', 'codm-fennec-ascended')]
        old = ROOT / 'data/weapon-skins/call-of-duty.json'
        if not items and old.exists():
            items = [x for x in json.loads(old.read_text(encoding='utf-8'))['skins'] if x['id'].startswith('codm-')]
        if not items:
            raise ValueError('Missing reviewed CODM media seed; preserve or restore previous snapshot')
        atomic(seed, items)
    for entry in items:
        entry['game'] = 'cod-mobile'
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    previous = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    try:
        seeds = legacy_selection(previous)
        roots = [fetch(url, args.offline) for url in ROOT_URLS]
        cat_urls = sorted({url for source in roots for url, label in links(source, all_page=True)
                           if safe_source(url) and '/weapon-list/call-of-duty-mobile-' in url and
                           any(x in url for x in ['assault-rifle', 'submachine-gun', 'light-machine-gun', 'sniper-rifle', 'shotgun', 'pistol', 'knife-weapon'])})
        roots += [fetch(url, args.offline) for url in cat_urls]
        targets = catalogue_targets(roots)
        # The linked historical Fennec news URL is a verified 404, not a new
        # usable record. Keep this gap visible instead of guessing a replacement.
        unavailable = [{'url': url, 'reason': 'Linked upstream historical page returns HTTP 404'} for url in targets
                       if url.endswith('/news/fennec-stats-attachment-skin')]
        targets = {url: hint for url, hint in targets.items() if not url.endswith('/news/fennec-stats-attachment-skin')}
        for source in roots:
            if source['url'].endswith('knife-weapon-list'):
                targets[source['url']] = '近战武器'
        pages, failures = [], []
        with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as pool:
            futures = {pool.submit(fetch, url, args.offline): (url, hint) for url, hint in targets.items()}
            for f in as_completed(futures):
                url, hint = futures[f]
                try:
                    pages.append((f.result(), hint))
                except Exception as exc:
                    failures.append({'url': url, 'error': str(exc)})
        if failures:
            raise RuntimeError('Catalogue source failures; prior snapshot preserved: ' + json.dumps(failures, ensure_ascii=False))
        first_seen = {x['id']: x['firstSeenAt'] for x in previous.get('skins', [])}
        collected, notes, per_page = {}, [], []
        source_records = 0
        for source, hint in sorted(pages, key=lambda value: value[0]['url']):
            parsed, issues = parse_skins(source, hint)
            source_records += len(parsed)
            per_page.append({'url': source['url'], 'retrievedAt': source['retrievedAt'], 'sha256': source['sha256'], 'skinImageCount': len(parsed)})
            notes += issues
            for raw in parsed:
                if raw['id'] not in collected:
                    collected[raw['id']] = make_entry(raw, first_seen.get(raw['id'], now()))
                else:
                    collected[raw['id']].setdefault('additionalSourceUrls', []).append(raw['sourceUrl'])
        # Overlapping guide and skin-list pages may use two spelling variants
        # for one asset. Same base weapon + exact source image identifies one
        # catalogue object; retain all source aliases instead of counting twice.
        assets, duplicate_assets = {}, []
        for ident, entry in sorted(collected.items(), key=lambda pair: (len(pair[1]['name']), pair[0])):
            key = (entry['weaponId'], entry['image']['assetSourceUrl'])
            if key not in assets:
                assets[key] = entry
                continue
            winner = assets[key]
            winner.setdefault('sourceAliases', []).append(ident)
            winner.setdefault('additionalSourceUrls', []).append(entry['sourceUrl'])
            duplicate_assets.append({'retainedId': winner['id'], 'aliasId': ident, 'url': key[1]})
            collected.pop(ident)
        aliases = {'codm-holger-26-dark-frontier': 'codm-holger-dark-frontier'}
        for seed in seeds:
            # Keep existing identity/media and prefer its precise official provenance.
            matching = [x for x in collected if x == seed['id'] or aliases.get(x) == seed['id']]
            for match in matching:
                new = collected.pop(match)
                seed.setdefault('additionalSourceUrls', []).append(new['sourceUrl'])
                seed.setdefault('sourceAliases', []).append(match)
            seed['firstSeenAt'] = first_seen.get(seed['id'], seed['firstSeenAt'])
            collected[seed['id']] = seed
        if len(collected) < 100:
            raise ValueError('Unexpectedly small upstream skin parse; prior snapshot preserved')
        # China official-article records are maintained by sync_weapon_codm_cn.py.
        # A community-index refresh must not erase that independently verified work.
        for item in previous.get('skins', []):
            if item['id'].startswith('codm-cn-'):
                collected[item['id']] = item
        present = set(collected)
        historical = {x['id']: x for x in previous.get('historicalSkins', [])} if previous.get('source', {}).get('parserVersion') == 3 else {}
        if previous.get('source', {}).get('parserVersion') == 3:
            historical.update({x['id']: x for x in previous.get('skins', []) if x['id'] not in present})
        historical = {ident: item for ident, item in historical.items()
                      if not (item.get('weaponName') == '近战武器' and slug(item.get('sourceMetadata', {}).get('label', '')) in BARE_MELEE)}
        entries = sorted(collected.values(), key=lambda entry: (not bool(entry['media']), entry['weaponName'].casefold(), entry['name'].casefold()))
        snapshot = {
            'schemaVersion': 1, 'game': 'cod-mobile',
            'updatedAt': max(x['retrievedAt'] for x in roots + [p[0] for p in pages]),
            'source': {'name': 'Zilliongamer COD Mobile 武器皮肤图鉴 / 官方动作选集',
                       'type': 'community_catalogue', 'url': ROOT_URLS[2], 'parserVersion': 3,
                       'retrievedAt': max(x['retrievedAt'] for x in roots + [p[0] for p in pages]),
                       'requests': [{k: source[k] for k in ('url', 'retrievedAt', 'sha256')} for source in roots] + per_page},
            'coverage': {'status': 'catalogued', 'complete': False, 'sourceRecordCount': source_records,
                         'cataloguedCount': len(entries), 'weaponCount': len({x['weaponId'] for x in entries}),
                         'gunCount': sum(x['weaponType'] == 'gun' for x in entries),
                         'meleeCount': sum(x['weaponType'] == 'melee' for x in entries),
                         'withVideoCount': sum(any(m['provider'] in {'mp4', 'youtube', 'bilibili'} for m in x['media']) for x in entries),
                         'videoCount': sum(sum(m['provider'] in {'mp4', 'youtube', 'bilibili'} for m in x['media']) for x in entries),
                         'withAnimationCount': sum(any(m['provider'] == 'gif' for m in x['media']) for x in entries),
                         'sourcePageCount': len(pages), 'pagesWithSkinImages': sum(x['skinImageCount'] > 0 for x in per_page),
                         'sameAssetAliasesMerged': len(duplicate_assets),
                         'unavailableSourcePages': unavailable,
                         'retainedHistoricalCount': len(historical),
                         'scope': '已遍历本次社区索引实际链接的逐武器外观页，保留国际服英文名；上游目录可能缺漏，不代表国服、全地区或全历史完整收录。',
                         'mediaScope': '批量目录提供静态配图；另保留 4 款官方动作展示，其中 QQ9 标题明确为检视。其他图鉴皮肤未伪造动作视频。',
                         'remaining': ['国服完整蓝图目录与核实中文名', '所有历史皮肤与地区专属外观', '逐皮肤专属检视录像与精确时间段', '首发日期和获取状态']},
            'skins': entries, 'historicalSkins': sorted(historical.values(), key=lambda x: x['id']),
        }
        if previous.get('source', {}).get('chinaCatalogue'):
            snapshot['source']['chinaCatalogue'] = previous['source']['chinaCatalogue']
            snapshot['updatedAt'] = max(snapshot['updatedAt'], previous['source']['chinaCatalogue']['retrievedAt'])
            snapshot['coverage'].update({key: value for key, value in previous['coverage'].items() if key.startswith('china')})
            for key in ['scope', 'mediaScope']:
                snapshot['coverage'][key] = previous['coverage'][key]
        atomic(CACHE / 'coverage.json', {'builtAt': now(), 'offline': args.offline, 'pages': per_page, 'issues': notes, 'sameAssetAliasesMerged': duplicate_assets, 'coverage': snapshot['coverage']})
        atomic(OUT, snapshot)
        atomic(CACHE / 'last-run.json', {'attemptedAt': now(), 'offline': args.offline, 'success': True, 'count': len(entries)})
        print(json.dumps(snapshot['coverage'], ensure_ascii=False))
        return 0
    except Exception as exc:
        atomic(CACHE / 'last-run.json', {'attemptedAt': now(), 'offline': args.offline, 'success': False, 'error': str(exc), 'previousSnapshotPreserved': OUT.exists()})
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
