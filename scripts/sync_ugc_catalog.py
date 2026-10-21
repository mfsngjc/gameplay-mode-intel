#!/usr/bin/env python3
"""Incrementally enumerate public UGC catalogs into resumable JSON shards."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import subprocess
import time
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import sync_ugc as board  # Reuse the established request/parser and source filters.

CATALOG = ROOT / 'data/ugc/catalog'
CACHE = ROOT / 'data/ugc/catalog-cache'
PLATFORMS = ('roblox', 'minecraft', 'cs2', 'fortnite')
SHARD_SIZE = 400
MAX_FILE_BYTES = 5 * 1024 * 1024
REQUEST_DELAY = 0.25
MAX_SOURCE_RETRIES = 2
LAST_REQUEST_AT = 0.0
TRANSLATIONS = None
SOURCE_EVIDENCE = None
CURRENT_DEADLINE = None
NEXT_ATTEMPT_AT = None
SOURCE = {
    'cs2': ('https://steamcommunity.com/workshop/browse/?appid=730&section=readytouseitems&browsesort=totaluniquesubscribers&requiredtags%5B%5D=CS2', 'Steam public CS2 Workshop SSR browse; appid=730, required CS2 tag, map tag, explicit non-map artifact exclusions, lifetime subscription sort.', 'Steam 创意工坊中标记为地图的 CS2 作品，排除明确的角色或武器模型、皮肤、准星与界面模组、资源包等非地图项目。统计仅覆盖此公开目录可枚举的作品。'),
    'roblox': ('https://www.rolimons.com/games', "Rolimon's published public games dataset; only works indexed by Rolimon's.", "Rolimon’s 公开作品目录中可枚举的 Roblox 作品；不代表 Roblox 全站目录。"),
    'fortnite': ('https://fortnite.gg/creative', 'Fortnite.GG public community-island pages; public page reach is subject to pagination availability.', 'Fortnite.GG 公开社区岛目录；受来源分页可访问范围限制。'),
    'minecraft': ('https://api.modrinth.com/v2/search?index=downloads&limit=100&facets=%5B%5B%22project_type%3Amod%22%5D%2C+%5B%22categories%21%3Dlibrary%22%5D%5D', 'Modrinth Search API project_type=mod, categories!=library; only Modrinth indexed Java single mods.', '仅收录 Modrinth 可检索的 Minecraft Java 单体模组，并排除开发依赖与程序库等前置组件；不代表其他站点或未被该目录收录的作品。'),
}
METRIC_LABELS = {'cs2': '历史总订阅', 'roblox': '累计访问次数',
                 'fortnite': '当前在线人数', 'minecraft': '累计下载次数'}
KNOWN_EXCLUSIONS = {
    'minecraft:ySnjMzLg': {
        'reason': 'Reviewed Modrinth source description identifies an accessory API compatibility layer, not a player-facing single mod.',
        'sourceUrl': 'https://modrinth.com/mod/accessories-compat-layer',
        'evidence': "Modifies commonly used Accessory API's to work with Accessories, unifying a modpack under one Accessory API",
    },
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def retry_time_is_future(value):
    if not value: return False
    try: return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp() > time.time()
    except (ValueError, TypeError): return False


def atomic_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    for attempt in range(6):
        try:
            os.replace(temp, path)
            return
        except PermissionError:
            if attempt == 5: raise
            time.sleep(0.1 * (attempt + 1))


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default


def fingerprint(title, description):
    return hashlib.sha256(((title or '') + '\n' + (description or '')).encode('utf-8')).hexdigest()


def page_id_fingerprint(ids):
    return hashlib.sha256(','.join(sorted(map(str, ids))).encode('utf-8')).hexdigest()


def catalog_order(entries):
    """Order by this platform's own metric, missing values last, then stable title/key."""
    return sorted(entries, key=lambda entry: (
        entry.get('metricValue') is None,
        -(entry.get('metricValue') or 0),
        (entry.get('originalTitle') or '').casefold(),
        entry.get('key') or ''))


def add_exclusion_events(state, count):
    state['excludedByTypeEventCount'] = int(state.get('excludedByTypeEventCount', state.get('excludedByTypeCount', 0))) + int(count)


def steam_page_has_more_candidates(raw_ids, page, total_pages):
    return bool(raw_ids) and (total_pages is None or page < total_pages)


def reset_for_refresh(state):
    state['progress'] = {'nextPage': 1, 'nextOffset': 0}
    state['enumerationComplete'] = False
    state['status'] = 'partial'
    state['reportedTotal'] = None
    state['candidateCount'] = None
    state['errors'] = []
    return state


def chunk_entries(platform, entries):
    chunks, current = [], []
    prefix_bytes = len(json.dumps({'schemaVersion': 1, 'platformId': platform, 'entries': []},
                                  ensure_ascii=False, separators=(',', ':')).encode('utf-8')) - 2
    current_bytes = prefix_bytes
    for entry in entries:
        entry_bytes = len(json.dumps(entry, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
        candidate_bytes = current_bytes + (1 if current else 0) + entry_bytes
        if current and (len(current) >= SHARD_SIZE or candidate_bytes > MAX_FILE_BYTES):
            chunks.append(current)
            current = []
            current_bytes = prefix_bytes
            candidate_bytes = current_bytes + entry_bytes
        if candidate_bytes > MAX_FILE_BYTES:
            raise ValueError(f'{platform} single record exceeds 5 MiB: {entry.get("key")}')
        current.append(entry)
        current_bytes = candidate_bytes
    if current: chunks.append(current)
    return chunks


def immutable_shard_paths(platform, name, detail_data, search_data):
    def digest(payload):
        return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    base = f'data/ugc/catalog/{platform}'
    return (f'{base}/detail-{name}-{digest(detail_data)}.json',
            f'{base}/search-{name}-{digest(search_data)}.json')


def public_request(url, headers=None):
    """Use the collector User-Agent with bounded retries and exact Retry-After waits."""
    global LAST_REQUEST_AT, NEXT_ATTEMPT_AT
    for attempt in range(MAX_SOURCE_RETRIES + 1):
        delay = REQUEST_DELAY - (time.monotonic() - LAST_REQUEST_AT)
        if delay > 0: time.sleep(delay)
        if CURRENT_DEADLINE is not None and time.monotonic() >= CURRENT_DEADLINE:
            raise TimeoutError('per-source time budget reached before request')
        try:
            req = Request(url, headers={'User-Agent': board.USER_AGENT, 'Accept': 'application/json,text/html', **(headers or {})})
            with urlopen(req, timeout=30) as response:
                body = response.read().decode('utf-8')
            LAST_REQUEST_AT = time.monotonic()
            NEXT_ATTEMPT_AT = None
            return body
        except HTTPError as error:
            LAST_REQUEST_AT = time.monotonic()
            if attempt >= MAX_SOURCE_RETRIES or error.code not in (429, 500, 502, 503, 504):
                raise
            retry_after = error.headers.get('Retry-After') if error.headers else None
            wait = None
            if retry_after:
                try: wait = max(0, float(retry_after))
                except ValueError:
                    try: wait = max(0, (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds())
                    except Exception: wait = None
            wait = wait if wait is not None else 2 ** (attempt + 1)
            if CURRENT_DEADLINE is not None and time.monotonic() + wait >= CURRENT_DEADLINE:
                NEXT_ATTEMPT_AT = datetime.now(timezone.utc).timestamp() + wait
                raise TimeoutError(f'Retry-After/backoff exceeds remaining source budget; retry after {datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat()}')
            time.sleep(wait)


def catalog_key(platform, identifier):
    return f'{platform}:{identifier}'


def https(value):
    return value if isinstance(value, str) and value.startswith('https://') else None


def normalize_cover_url(value, base_url):
    return https(urljoin(base_url, value)) if isinstance(value, str) and value else None


def modrinth_cover(item):
    icon = https(item.get('icon_url'))
    if icon: return icon, 'icon'
    featured = item.get('featured_gallery')
    featured_values = [featured] if isinstance(featured, str) else (featured if isinstance(featured, list) else [])
    gallery = item.get('gallery')
    gallery_values = [gallery] if isinstance(gallery, str) else (gallery if isinstance(gallery, list) else [])
    for value in [*featured_values, *gallery_values]:
        candidate = value if isinstance(value, str) else (value.get('url') or value.get('raw_url') or value.get('src') if isinstance(value, dict) else None)
        cover = https(candidate)
        if cover: return cover, 'cover'
    return None, None


def make_entry(platform, row, description='', image_url=None, image_kind='cover', canonical_id=None,
               identity_status='verified', metric_label='', source_url=None):
    identifier = str(row['id'])
    if identity_status == 'verified' and not canonical_id:
        canonical_id = identifier
    url = https(row.get('url'))
    source_url = https(source_url or url or SOURCE[platform][0])
    original = str(row.get('title') or '').strip()
    creator = str(row.get('creator') or '').strip()
    desc = str(description or row.get('summary') or '').strip()
    img = https(image_url)
    stats_url = f'https://www.rolimons.com/game/{identifier}' if platform == 'roblox' else None
    sources = [x for x in dict.fromkeys([source_url, url, stats_url, *(row.get('sourceUrls') or [])]) if https(x)]
    return {
        'key': catalog_key(platform, identifier), 'platformId': platform, 'id': identifier,
        'canonicalId': str(canonical_id) if canonical_id else None,
        'identityStatus': identity_status,
        'originalTitle': original, 'titleStatus': 'available' if original else 'missing', 'creator': creator,
        'titleZh': '', 'introZh': '', 'translationStatus': 'pending',
        'sourceFingerprint': fingerprint(original, desc),
        'descriptionOriginal': desc, 'categories': row.get('categories') or [],
        'url': url or source_url, 'statsUrl': stats_url, 'sources': sources,
        'image': {'url': img, 'sourceUrl': source_url if img else None, 'kind': image_kind if img else None,
                  'status': 'available' if img else 'missing', 'checkedAt': now()},
        'metricValue': row.get('metricValue'), 'metricLabel': metric_label,
        'createdAt': row.get('publishedAt'), 'collectedAt': now(),
        'firstObservedAt': now(), 'lastObservedAt': now(),
    }


def normalize_existing(old, new):
    if old:
        new['firstObservedAt'] = old.get('firstObservedAt') or new['firstObservedAt']
        if old.get('sourceFingerprint') == new['sourceFingerprint'] and old.get('translationStatus') == 'reviewed':
            for k in ('titleZh', 'introZh', 'translationStatus', 'reviewer', 'reviewedAt', 'reviewSources', 'reviewApproval'):
                if k in old: new[k] = old[k]
        elif old.get('sourceFingerprint') != new.get('sourceFingerprint'):
            new.update({'titleZh': '', 'introZh': '', 'translationStatus': 'pending'})
            for k in ('reviewer', 'reviewedAt', 'reviewSources', 'reviewApproval'):
                new.pop(k, None)
    return new


def apply_accepted_reviews(entries):
    accepted_dir = CACHE / 'reviews/accepted'
    if not accepted_dir.exists(): return
    index = {e['key']: e for e in entries.values()}
    for file in sorted(accepted_dir.glob('*.json')):
        payload = read_json(file, {})
        batch = payload.get('entries', []) if isinstance(payload, dict) else []
        acceptance = payload.get('acceptance', {}) if isinstance(payload, dict) else {}
        approved_by, approved_at = acceptance.get('approvedBy'), acceptance.get('approvedAt')
        try: datetime.fromisoformat(str(approved_at).replace('Z', '+00:00'))
        except ValueError: continue
        if not isinstance(approved_by, str) or not approved_by.strip(): continue
        if not isinstance(batch, list): continue
        for review in batch:
            if not isinstance(review, dict): continue
            entry = index.get(review.get('key'))
            title, intro, fp, reviewer = review.get('titleZh'), review.get('introZh'), review.get('sourceFingerprint'), review.get('reviewer')
            reviewed_at = review.get('reviewedAt')
            if not entry or fp != entry['sourceFingerprint'] or not isinstance(title, str) or not title.strip() or not isinstance(intro, str) or not intro.strip() or not isinstance(reviewer, str) or not reviewer.strip() or not reviewed_at:
                continue
            if not isinstance(review.get('sources'), list) or any(not https(url) for url in review['sources']): continue
            try: datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            except ValueError: continue
            entry.update({'titleZh': title.strip(), 'introZh': intro.strip(), 'translationStatus': 'reviewed',
                          'reviewedAt': reviewed_at, 'reviewer': reviewer.strip(),
                          'reviewSources': list(dict.fromkeys([*entry.get('sources', []), *review['sources']])),
                          'reviewApproval': {'status': 'accepted', 'approvedBy': approved_by.strip(), 'approvedAt': approved_at}})


def apply_reviewed(entry):
    """Reuse a translation only when its recorded source fingerprint matches."""
    global TRANSLATIONS
    if TRANSLATIONS is None:
        TRANSLATIONS = read_json(ROOT / 'data/ugc/chinese.json', {'entries': {}}).get('entries', {})
        # Recover accepted translations from immutable public shards if local review cache is lost.
        manifest = read_json(CATALOG / 'manifest.json', {})
        for platform_data in (manifest.get('platforms') or {}).values():
            for shard in platform_data.get('shards', []):
                data = read_json(ROOT / shard.get('url', ''), {})
                for reviewed in data.get('entries', []):
                    approved_review = reviewed.get('reviewApproval', {}).get('status') == 'accepted'
                    legacy_review = reviewed.get('reviewer') == 'legacy-reviewed'
                    if (reviewed.get('translationStatus') == 'reviewed' and reviewed.get('key') and
                            (approved_review or legacy_review)):
                        recovered = {'title': reviewed.get('titleZh'), 'intro': reviewed.get('introZh'),
                            'sourceFingerprint': reviewed.get('sourceFingerprint'), 'reviewedAt': reviewed.get('reviewedAt'),
                            'reviewer': reviewed.get('reviewer'), 'sources': reviewed.get('reviewSources') or reviewed.get('sources'),
                            'reviewApproval': reviewed.get('reviewApproval')}
                        previous = TRANSLATIONS.get(reviewed['key'])
                        recovered_approved = approved_review
                        previous_approved = isinstance(previous, dict) and previous.get('reviewApproval', {}).get('status') == 'accepted'
                        if (previous is None or (recovered_approved and not previous_approved) or
                            (recovered_approved and previous_approved and str(recovered['reviewApproval'].get('approvedAt','')) > str(previous.get('reviewApproval',{}).get('approvedAt','')))):
                            TRANSLATIONS[reviewed['key']] = recovered
    translations = TRANSLATIONS
    old = translations.get(entry['key'])
    if old and old.get('sourceFingerprint') == entry['sourceFingerprint']:
        if old.get('title') and old.get('intro') and old.get('reviewedAt'):
            entry['titleZh'] = old.get('title', '')
            entry['introZh'] = old.get('intro', '')
            entry['translationStatus'] = 'reviewed'
            entry['reviewedAt'] = old['reviewedAt']
            entry['reviewer'] = old.get('reviewer') or 'legacy-reviewed'
            entry['reviewSources'] = list(dict.fromkeys([*entry.get('sources', []), *(old.get('sources') or [])]))
            if old.get('reviewApproval'): entry['reviewApproval'] = old['reviewApproval']
    if entry['platformId'] == 'roblox' and entry.get('canonicalId'):
        old = translations.get(f"roblox:{entry['canonicalId']}")
        if old and old.get('sourceFingerprint') == entry['sourceFingerprint'] and old.get('title') and old.get('intro') and old.get('reviewedAt'):
            entry['titleZh'] = old.get('title', '')
            entry['introZh'] = old.get('intro', '')
            entry['translationStatus'] = 'reviewed'
            entry['reviewedAt'] = old['reviewedAt']
            entry['reviewer'] = old.get('reviewer') or 'legacy-reviewed'
            entry['reviewSources'] = list(dict.fromkeys([*entry.get('sources', []), *(old.get('sources') or [])]))
            if old.get('reviewApproval'): entry['reviewApproval'] = old['reviewApproval']
    return entry


def load_state(platform):
    return read_json(CACHE / f'{platform}.json', {'schemaVersion': 1, 'platformId': platform, 'entries': {},
        'progress': {'nextPage': 1, 'nextOffset': 0}, 'status': 'partial', 'reportedTotal': None,
        'startedAt': None, 'updatedAt': None, 'errors': []})


def save_state(state):
    state['updatedAt'] = now()
    atomic_json(CACHE / f"{state['platformId']}.json", state)


NON_MAP_TITLE = re.compile(r'\b(playermodel|player\s*model|character\s*model|weapon\s*skin|gun\s*skin|knife\s*skin|glove\s*skin|agent\s*skin|(?:hud|crosshair)\s+(?:mod|pack|replacement|overlay)|sound\s*mod)\b', re.I)
NON_MAP_ASSET_TEXT = re.compile(r'\b(resource\s*pack|asset\s*pack|bundle|collection|training\s+platform|\d+\s+(?:game\s+)?modes)\b', re.I)


def is_non_map_work(row):
    # Exclude explicit artifact types only; "model" alone is intentionally not a signal.
    title = str(row.get('title') or '')
    if '资源包' in title:
        return True
    if NON_MAP_TITLE.search(title) or re.search(r'\b(?:resource|asset)\s*pack\b', title, re.I):
        return True
    branded_asset_title = bool(re.search(r'\b(?:cybershoke|xplay\.gg)\b.*\bassets?\s*$', title, re.I))
    return branded_asset_title or bool(re.search(r'(?:\||[-:])\s*assets?\s*$', title, re.I) and
                NON_MAP_ASSET_TEXT.search(str(row.get('description') or '')))


def cs2_exclusion_reason(row):
    if '资源包' in str(row.get('title') or ''):
        return '原标题明确标注为资源包，属于服务器资产而非可游玩的地图。'
    return '原标题标明为非地图资产类型。'


def register_cs2_exclusion(state, key, row, existing_entry=None):
    exclusions = state.setdefault('excludedRecords', [])
    entry = existing_entry or {}
    prior = next((item for item in exclusions if item.get('key') == key), {})
    title = str(row.get('title') or entry.get('originalTitle') or prior.get('originalTitle') or '')
    description = str(row.get('description') or row.get('summary') or entry.get('descriptionOriginal') or prior.get('descriptionOriginal') or '')
    source_fp = fingerprint(title, description)
    if any(item.get('key') == key and item.get('sourceFingerprint') == source_fp for item in exclusions):
        state.setdefault('entries', {}).pop(key, None)
        return False
    source_url = row.get('url') or entry.get('url') or f'https://steamcommunity.com/sharedfiles/filedetails/?id={key.rsplit(":", 1)[-1]}'
    record = {'key': key, 'reason': cs2_exclusion_reason({'id': key, 'title': title, 'description': description}),
        'sourceUrl': source_url, 'originalTitle': title, 'descriptionOriginal': description,
        'sourceFingerprint': source_fp, 'excludedAt': now(),
        'evidence': {'creator': row.get('creator') or entry.get('creator'),
            'image': entry.get('image') or ({'url': row.get('imageUrl'), 'kind': 'cover'} if row.get('imageUrl') else None),
            'firstObservedAt': entry.get('firstObservedAt'), 'sources': entry.get('sources', [])}}
    exclusions.append(record)
    state.setdefault('entries', {}).pop(key, None)
    add_exclusion_events(state, 1)
    return True


def valid_iso_time(value):
    if not isinstance(value, str) or not value.strip(): return False
    try: datetime.fromisoformat(value.replace('Z', '+00:00')); return True
    except ValueError: return False


def load_approved_type_exclusions():
    """Load only approved schema-v1 exclusions whose review evidence is well formed."""
    path = ROOT / 'data/ugc/catalog-exclusions.json'
    if not path.exists(): return {}
    payload = read_json(path, None)
    if not isinstance(payload, dict) or payload.get('schemaVersion') != 1 or not isinstance(payload.get('entries'), dict):
        return {}
    accepted = {}
    for key, rule in payload['entries'].items():
        if not isinstance(key, str) or not re.match(r'^(cs2|roblox|fortnite|minecraft):.+$', key) or not isinstance(rule, dict): continue
        title, description = rule.get('originalTitle'), rule.get('descriptionOriginal')
        fp, reason, reviewer = rule.get('sourceFingerprint'), rule.get('reason'), rule.get('reviewer')
        sources, approval = rule.get('sources'), rule.get('approval')
        if not isinstance(title, str) or not isinstance(description, str): continue
        if not isinstance(fp, str) or not re.fullmatch(r'[0-9a-f]{64}', fp) or fingerprint(title, description) != fp: continue
        if not isinstance(reason, str) or not reason.strip() or not isinstance(reviewer, str) or not reviewer.strip(): continue
        if not valid_iso_time(rule.get('reviewedAt')): continue
        if not isinstance(sources, list) or not sources or any(not https(url) for url in sources): continue
        if not isinstance(approval, dict) or not isinstance(approval.get('approvedBy'), str) or not approval['approvedBy'].strip() or not valid_iso_time(approval.get('approvedAt')): continue
        accepted[key] = rule
    return accepted


def apply_approved_type_exclusions(platform, state):
    """Remove only exact key+fingerprint matches, retaining full source and review evidence."""
    rules = load_approved_type_exclusions()
    removed = 0
    for key, rule in rules.items():
        if not key.startswith(platform + ':'): continue
        entry = state.get('entries', {}).get(key)
        title = (entry.get('originalTitle') if entry else rule['originalTitle']) or ''
        description = (entry.get('descriptionOriginal') if entry else rule['descriptionOriginal']) or ''
        if ((entry and entry.get('sourceFingerprint') != rule['sourceFingerprint']) or title != rule['originalTitle'] or
                description != rule['descriptionOriginal'] or fingerprint(title, description) != rule['sourceFingerprint']):
            continue
        exclusions = state.setdefault('excludedRecords', [])
        existing = next((old for old in exclusions if old.get('key') == key and
                         old.get('sourceFingerprint') == rule['sourceFingerprint']), None)
        if existing:
            # Older heuristic exclusions predate the approved, fingerprint-bound ledger.
            # Upgrade their private recoverable evidence and approval provenance in place.
            preserved = existing.get('originalEntry') or existing.get('evidence')
            if entry:
                existing['originalEntry'] = entry
            elif isinstance(preserved, dict) and preserved.get('sourceFingerprint') == rule['sourceFingerprint']:
                existing['originalEntry'] = preserved
            existing.update({'originalTitle': title, 'descriptionOriginal': description,
                'reason': rule['reason'], 'sources': list(rule['sources']),
                'reviewedAt': rule['reviewedAt'], 'reviewer': rule['reviewer'],
                'approval': dict(rule['approval'])})
            state['entries'].pop(key, None)
            continue
        if not entry: continue
        exclusions.append({'key': key, 'sourceFingerprint': rule['sourceFingerprint'],
            'originalTitle': title, 'descriptionOriginal': description, 'reason': rule['reason'],
            'sources': list(rule['sources']), 'reviewedAt': rule['reviewedAt'], 'reviewer': rule['reviewer'],
            'approval': dict(rule['approval']), 'excludedAt': now(), 'originalEntry': entry})
        state['entries'].pop(key, None)
        add_exclusion_events(state, 1)
        removed += 1
    return removed


def steam_page(page):
    params = {'appid': 730, 'section': 'readytouseitems', 'browsesort': 'totaluniquesubscribers',
              'requiredtags[]': 'CS2', 'numperpage': 30, 'p': page}
    source = public_request(board.STEAM_URL + '?' + urlencode(params))
    match = re.search(r'<script[^>]*id=["\']valve-ssr-data["\'][^>]*>(.*?)</script>', source, re.S)
    if not match:
        raise ValueError('Steam SSR data unavailable')
    payload = json.loads(match[1])
    query = next((item for item in board.walk_json(payload)
        if isinstance(item.get('queryKey'), list) and item['queryKey'][:1] == ['workshop_browse']
        and len(item['queryKey']) > 1 and isinstance(item['queryKey'][1], dict)
        and item['queryKey'][1].get('appid') == 730
        and item['queryKey'][1].get('browse_sort') == 'totaluniquesubscribers'
        and 'cs2' in {str(t).lower() for t in item['queryKey'][1].get('required_tags', [])}), None)
    if not query:
        raise ValueError('Steam did not return the requested CS2 map scope')
    data = query.get('state', {}).get('data', {})
    rows = board.parse_steam(source, alltime=True)
    raw = data.get('results') or []
    by_id = {str(x.get('publishedfileid')): x for x in raw}
    for row in rows:
        item = by_id.get(row['id'], {})
        row['imageUrl'] = item.get('preview_url') or next((p.get('url') for p in item.get('previews', []) if p.get('url')), None)
        row['description'] = row.get('summary') or ''
    excluded = [row for row in rows if is_non_map_work(row)]
    rows = [row for row in rows if not is_non_map_work(row)]
    return rows, data.get('total_count'), data.get('total_pages'), len(raw), [str(x.get('publishedfileid')) for x in raw], excluded


def roblox_rows():
    source = public_request('https://www.rolimons.com/games')
    match = re.search(r'\bvar\s+games\s*=\s*', source)
    if not match:
        raise ValueError("Rolimon's public games dataset unavailable")
    games, _ = json.JSONDecoder().raw_decode(source[match.end():])
    # Reuse already verified placeId -> universeId links from the existing daily source evidence.
    evidence = read_json(ROOT / 'data/ugc/source-descriptions.json', {'entries': {}}).get('entries', {})
    identity_cache = read_json(CACHE / 'roblox-identities.json', {'entries': {}}).get('entries', {})
    place_to_universe = {str(place): str(item.get('universeId')) for place, item in identity_cache.items() if item.get('universeId')}
    for key, item in evidence.items():
        if not key.startswith('roblox:') or not item.get('canonicalId'):
            continue
        for source_url in item.get('sources', []):
            match_place = re.search(r'roblox\.com/games/(\d+)', source_url)
            if match_place:
                place_to_universe[match_place[1]] = str(item['canonicalId'])
    rows = []
    for identifier, item in games.items():
        universe = place_to_universe.get(str(identifier))
        detail = evidence.get('roblox:' + universe, {}) if universe else {}
        rows.append({'id': str(identifier), 'title': detail.get('title') or item.get('name') or '', 'creator': item.get('creator') or '',
            'url': 'https://www.roblox.com/games/' + str(identifier), 'categories': [item['genre']] if item.get('genre') else [],
            'summary': '', 'metricValue': board.numeric(item.get('visits')), 'imageUrl': item.get('icon_url'),
            'identityStatus': 'verified' if universe else 'pending', 'canonicalId': universe,
            'description': detail.get('description') or '',
            'sourceUrls': detail.get('sources', []) if universe else [],
            'statsUrl': 'https://www.rolimons.com/game/' + str(identifier)})
    return rows, len(games)


def fortnite_page(page):
    params = {'page': page, 'hideepic': 1}
    source = public_request(board.FORTNITE_URL + '?' + urlencode(params), headers={'Cookie': 'fngg_hideepic=1'})
    tree = board.Tree(source).root
    rows = board.parse_fortnite(source, alltime=False)
    cards = {n.attrs.get('href', ''): n for n in tree.find_all('a', 'island')}
    for row in rows:
        card = cards.get('/island/' + row['id'])
        raw_image = next((n.attrs.get('src') or n.attrs.get('data-src') or n.attrs.get('data-lazy-src')
                    for n in (card.find_all('img') if card else [])
                    if n.attrs.get('src') or n.attrs.get('data-src') or n.attrs.get('data-lazy-src')), None)
        img = normalize_cover_url(raw_image, SOURCE['fortnite'][0])
        row['imageUrl'] = img
        row['creator'] = ''
        row['description'] = row.get('summary') or ''
    next_pages = []
    for link in tree.find_all('a'):
        href = link.attrs.get('href', '')
        match = re.search(r'(?:\?|&)page=(\d+)', href)
        if match:
            next_pages.append(int(match[1]))
    return rows, source, min((value for value in next_pages if value > page), default=None)


def modrinth_page(offset):
    url = board.modrinth_search_url(alltime=True, offset=offset)
    payload = json.loads(public_request(url))
    rows = []
    known_excluded = []
    for item in payload.get('hits', []):
        if 'minecraft:' + str(item.get('project_id') or item.get('id') or '') in KNOWN_EXCLUSIONS:
            known_excluded.append('minecraft:' + str(item.get('project_id') or item.get('id')))
            continue
        # Facets should enforce these rules, but retain raw offsets and count any anomalies.
        if item.get('project_type') != 'mod' or 'library' in item.get('categories', []):
            continue
        cover_url, cover_kind = modrinth_cover(item)
        rows.append({'id': item['project_id'], 'title': item.get('title') or '', 'creator': item.get('organization') or item.get('author') or '',
            'url': 'https://modrinth.com/mod/' + item['slug'], 'categories': [t for t in item.get('display_categories', []) if t not in ('fabric','forge','neoforge','quilt','liteloader','rift')],
            'summary': item.get('description') or '', 'metricValue': board.numeric(item.get('downloads')),
            'publishedAt': item.get('date_created'), 'imageUrl': cover_url, 'imageKind': cover_kind or 'icon', 'description': item.get('description') or ''})
    raw_hits = payload.get('hits', [])
    return rows, payload.get('total_hits'), url, len(raw_hits), len(raw_hits) - len(rows) - len(known_excluded), known_excluded


def merge_page(state, rows, platform):
    global SOURCE_EVIDENCE
    old_entries = state['entries']
    if SOURCE_EVIDENCE is None:
        SOURCE_EVIDENCE = read_json(ROOT / 'data/ugc/source-descriptions.json', {'entries': {}}).get('entries', {})
    evidence = SOURCE_EVIDENCE
    for row in rows:
        identifier = str(row['id'])
        source_evidence = evidence.get(f'{platform}:{identifier}', {})
        description = row.get('description') or (source_evidence.get('description') if source_evidence.get('title') in (None, row.get('title')) else '')
        if source_evidence.get('fullDescription') and source_evidence.get('title') == row.get('title'):
            description = source_evidence.get('description') or description
        row['sourceUrls'] = list(dict.fromkeys([*(row.get('sourceUrls') or []), *(source_evidence.get('sources') or [])]))
        entry = make_entry(platform, row, description, row.get('imageUrl'),
            row.get('imageKind') or ('icon' if platform in ('roblox', 'minecraft') else 'cover'), row.get('canonicalId'),
            row.get('identityStatus', 'verified'),
            METRIC_LABELS[platform])
        old_entries[entry['key']] = apply_reviewed(normalize_existing(old_entries.get(entry['key']), entry))
        if platform == 'roblox' and row.get('statsUrl'):
            old_entries[entry['key']]['statsUrl'] = row['statsUrl']
            if row.get('statsUrl') not in old_entries[entry['key']]['sources']:
                old_entries[entry['key']]['sources'].append(row['statsUrl'])


def write_platform(platform, state):
    evidence = read_json(ROOT / 'data/ugc/source-descriptions.json', {'entries': {}}).get('entries', {})
    if platform == 'minecraft':
        for key, rule in KNOWN_EXCLUSIONS.items():
            register_known_exclusion(state, key)
    if platform == 'roblox':
        identity_cache = read_json(CACHE / 'roblox-identities.json', {'entries': {}}).get('entries', {})
        place_to_universe = {str(place): str(item.get('universeId')) for place, item in identity_cache.items() if item.get('universeId')}
        for key, item in evidence.items():
            if key.startswith('roblox:') and item.get('canonicalId'):
                for source_url in item.get('sources', []):
                    match = re.search(r'roblox\.com/games/(\d+)', source_url)
                    if match: place_to_universe[match[1]] = str(item['canonicalId'])
        creator_catalog = read_json(ROOT / 'data/ugc/creators.json', {'entries': {}}).get('entries', {})
        normalized = {}
        previous_by_place = {}
        for previous in state['entries'].values():
            for place in [previous.get('placeId'), previous.get('id'), *(previous.get('sourceIds') or [])]:
                if place is not None: previous_by_place.setdefault(str(place), previous)
        for old in list(state['entries'].values()):
            place_id = str(old.get('placeId') or old['id'])
            universe = place_to_universe.get(place_id)
            previous = previous_by_place.get(place_id)
            if previous and previous.get('firstObservedAt'):
                old['firstObservedAt'] = previous['firstObservedAt']
            old['statsUrl'] = f'https://www.rolimons.com/game/{place_id}'
            if old['statsUrl'] not in old['sources']: old['sources'].append(old['statsUrl'])
            old['placeId'] = place_id
            if universe:
                old['canonicalId'] = universe
                old['identityStatus'] = 'verified'
                detail = evidence.get('roblox:' + universe, {})
                creator_entry = creator_catalog.get('roblox:' + universe, {})
                official_title = str(detail.get('title') or old.get('originalTitle') or '').strip()
                official_description = str(detail.get('description') or old.get('descriptionOriginal') or '').strip()
                if official_title != old.get('originalTitle') or official_description != old.get('descriptionOriginal'):
                    old['originalTitle'] = official_title
                    old['titleStatus'] = 'available' if official_title else 'missing'
                    old['descriptionOriginal'] = official_description
                    old['sourceFingerprint'] = fingerprint(official_title, official_description)
                    old['translationStatus'], old['titleZh'], old['introZh'] = 'pending', '', ''
                    for field in ('reviewedAt', 'reviewer', 'reviewSources', 'reviewApproval'):
                        old.pop(field, None)
                    old['sources'] = list(dict.fromkeys([*old['sources'], *(detail.get('sources') or [])]))
                old['creator'] = old.get('creator') or detail.get('creator', '') or creator_entry.get('name', '')
                old['key'] = catalog_key('roblox', universe)
                old['id'] = universe
                old['sourceIds'] = list(dict.fromkeys([*(old.get('sourceIds') or []), place_id]))
            else:
                old['canonicalId'] = None
                old['identityStatus'] = 'pending'
                old['key'] = catalog_key('roblox', 'place:' + place_id)
                old['sourceIds'] = list(dict.fromkeys([*(old.get('sourceIds') or []), place_id]))
            old = apply_reviewed(old)
            duplicate = normalized.get(old['key'])
            if duplicate:
                first_times = [value for value in (duplicate.get('firstObservedAt'), old.get('firstObservedAt')) if value]
                if first_times: old['firstObservedAt'] = min(first_times)
                duplicate['sources'] = list(dict.fromkeys([*duplicate['sources'], *old['sources']]))
                duplicate['sourceIds'] = list(dict.fromkeys([*duplicate['sourceIds'], *old['sourceIds']]))
                duplicate['categories'] = list(dict.fromkeys([*duplicate['categories'], *old['categories']]))
                if str(old.get('lastObservedAt') or '') > str(duplicate.get('lastObservedAt') or ''):
                    old['sources'] = duplicate['sources']
                    old['sourceIds'] = duplicate['sourceIds']
                    old['categories'] = duplicate['categories']
                    normalized[old['key']] = old
                    duplicate = old
                if old['image']['status'] == 'available' and duplicate['image']['status'] != 'available': duplicate['image'] = old['image']
                if (old.get('metricValue') or 0) > (duplicate.get('metricValue') or 0):
                    duplicate['metricValue'] = old['metricValue']
                    duplicate['statsUrl'] = old['statsUrl']
            else:
                normalized[old['key']] = old
        state['entries'] = normalized
    creator_catalog = read_json(ROOT / 'data/ugc/creators.json', {'entries': {}}).get('entries', {})
    for entry in state['entries'].values():
        entry['metricLabel'] = METRIC_LABELS[platform]
        evidence_key = entry['key']
        evidence_item = evidence.get(evidence_key, {})
        if platform == 'roblox' and entry.get('canonicalId'):
            evidence_item = evidence.get('roblox:' + str(entry['canonicalId']), evidence_item)
        full = str(evidence_item.get('description') or '').strip()
        old_description = str(entry.get('descriptionOriginal') or '').strip()
        if evidence_item.get('title') == entry.get('originalTitle') and evidence_item.get('fullDescription') and full and (not old_description or full.startswith(old_description)):
            if full != old_description:
                entry['descriptionOriginal'] = full
                entry['sourceFingerprint'] = fingerprint(entry.get('originalTitle'), full)
                entry['sources'] = list(dict.fromkeys([*entry.get('sources', []), *(evidence_item.get('sources') or [])]))
                entry['translationStatus'], entry['titleZh'], entry['introZh'] = 'pending', '', ''
        known_creator = creator_catalog.get(entry['key'], {})
        if known_creator.get('name') and (not entry.get('creator') or str(entry['creator']).isdigit()):
            entry['creator'] = known_creator['name']
        if not entry.get('originalTitle'):
            entry['titleStatus'] = 'missing'
        entry['descriptionStatus'] = 'available' if entry.get('descriptionOriginal') else 'missing'
        apply_reviewed(entry)
    apply_accepted_reviews(state['entries'])
    apply_approved_type_exclusions(platform, state)
    if platform == 'cs2':
        for key, entry in list(state.get('entries', {}).items()):
            row = {'id': key.rsplit(':', 1)[-1], 'title': entry.get('originalTitle'),
                   'description': entry.get('descriptionOriginal'), 'url': entry.get('url')}
            if is_non_map_work(row):
                register_cs2_exclusion(state, key, row, entry)
    entries = catalog_order(state['entries'].values())
    platform_dir = CATALOG / platform
    platform_dir.mkdir(parents=True, exist_ok=True)
    detail_shards, search_shards, review_queue_shards = [], [], []
    pending_dir = CACHE / 'reviews/pending' / platform
    if pending_dir.exists():
        for old_file in pending_dir.glob('*.json'):
            old_file.unlink()
    for shard_index, part in enumerate(chunk_entries(platform, entries)):
        name = f'{shard_index:05d}'
        detail_data = {'schemaVersion': 1, 'platformId': platform, 'entries': part}
        detail_path = f'data/ugc/catalog/{platform}/detail-{name}-{hashlib.sha256(json.dumps(detail_data, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]}.json'
        atomic_json(ROOT / detail_path, detail_data)
        search_rows, queue = [], []
        for entry in part:
            search_rows.append({'key': entry['key'], 'originalTitle': entry['originalTitle'], 'titleZh': entry['titleZh'],
                'creator': entry['creator'], 'introZh': entry['introZh'],
                'imageStatus': entry['image']['status'], 'translationStatus': entry['translationStatus'],
                'descriptionStatus': entry.get('descriptionStatus', 'available' if entry.get('descriptionOriginal') else 'missing'),
                'descriptionSearch': entry['descriptionOriginal'][:500], 'categories': entry['categories'],
                'detailShard': detail_path, 'metricValue': entry['metricValue'], 'createdAt': entry['createdAt']})
            if entry['translationStatus'] != 'reviewed':
                queue.append({'key': entry['key'], 'originalTitle': entry['originalTitle'], 'creator': entry['creator'],
                    'titleZh': entry['titleZh'], 'introZh': entry['introZh'], 'descriptionOriginal': entry['descriptionOriginal'],
                    'sources': entry['sources'], 'sourceFingerprint': entry['sourceFingerprint'], 'reviewedAt': None,
                    'reviewer': None, 'reason': 'new_or_changed_source',
                    'sourceNote': '来源未提供可核实玩法简介时，应明确说明资料不足，不按名称猜测。'})
        search_data = {'schemaVersion': 1, 'platformId': platform, 'entries': search_rows}
        _, search_path = immutable_shard_paths(platform, name, detail_data, search_data)
        detail_hash = detail_path.rsplit('-', 1)[-1].removesuffix('.json')
        atomic_json(ROOT / search_path, search_data)
        detail_shards.append({'url': detail_path, 'count': len(part)})
        search_shards.append({'url': search_path, 'count': len(search_rows)})
        if queue:
            queue_path = pending_dir / f'{name}-{detail_hash}.json'
            atomic_json(queue_path, {'schemaVersion': 1, 'platformId': platform, 'generatedAt': now(), 'entries': queue})
            review_queue_shards.append({'path': str(queue_path.relative_to(CACHE)).replace('\\', '/'), 'count': len(queue)})
        if (ROOT / detail_path).stat().st_size > MAX_FILE_BYTES or (ROOT / search_path).stat().st_size > MAX_FILE_BYTES:
            raise ValueError(f'{platform} shard exceeds 5 MiB: {name}')
    state['shards'], state['searchShards'], state['reviewQueueShards'] = detail_shards, search_shards, review_queue_shards
    state['observedCount'] = len(entries)
    state['sourceRecordCount'] = state.get('reportedTotal') if platform == 'roblox' else len(entries)
    state['canonicalUniqueCount'] = sum(e['identityStatus'] == 'verified' for e in entries)
    state['withCoverCount'] = sum(e['image']['status'] == 'available' for e in entries)
    state['reviewedCount'] = sum(e['translationStatus'] == 'reviewed' for e in entries)
    state['identityPendingCount'] = sum(e['identityStatus'] == 'pending' for e in entries)
    if platform == 'roblox':
        pending = [{'key': e['key'], 'placeId': e['id'], 'status': 'pending', 'attempts': 0,
                    'sourceUrl': e['url'], 'lastError': None} for e in entries if e['identityStatus'] == 'pending']
        atomic_json(CACHE / 'roblox-identity-queue.json', {'schemaVersion': 1, 'updatedAt': now(), 'entries': pending})
    missing_details = [{'key': e['key'], 'sourceUrl': e['url'], 'status': e.get('detailStatus', 'pending'), 'attempts': e.get('detailAttempts', 0),
                        'lastError': e.get('detailLastError')} for e in entries if not e['descriptionOriginal']]
    atomic_json(CACHE / f'{platform}-detail-queue.json', {'schemaVersion': 1, 'platformId': platform, 'updatedAt': now(),
        'nextAfterKey': state.get('detailQueueNextKey'), 'entries': missing_details})
    queue_dir = CACHE / 'review-queue' / platform
    atomic_json(queue_dir / 'index.json', {'schemaVersion': 1, 'platformId': platform, 'generatedAt': now(), 'shards': review_queue_shards,
        'pendingCount': len(entries) - state['reviewedCount']})


def collect_one(platform, deadline, max_pages, refresh=False):
    global CURRENT_DEADLINE
    CURRENT_DEADLINE = deadline
    global NEXT_ATTEMPT_AT
    NEXT_ATTEMPT_AT = None
    state = load_state(platform)
    state['startedAt'] = state.get('startedAt') or now()
    if retry_time_is_future(state.get('nextAttemptAt')):
        state['status'] = 'limited'
        state['errors'] = [f"Deferred until nextAttemptAt={state['nextAttemptAt']}"]
        write_platform(platform, state)
        save_state(state)
        return state
    state.pop('nextAttemptAt', None)
    if refresh:
        reset_for_refresh(state)
    if not refresh and state.get('enumerationComplete') and state.get('status') == 'complete':
        write_platform(platform, state)
        save_state(state)
        return state
    state['lastAttemptAt'] = now()
    state['status'] = 'partial'
    state['errors'] = []
    pages = 0
    try:
        if platform == 'roblox':
            if state.get('progress', {}).get('done'):
                return state
            rows, total = roblox_rows()
            state.pop('nextAttemptAt', None)
            state['lastSuccessfulAt'] = now()
            merge_page(state, rows, platform)
            state['reportedTotal'] = total
            state['progress'] = {'nextPage': None, 'sourceRecords': total, 'done': True}
            state['enumerationComplete'] = True
            state['status'] = 'complete'
        elif platform == 'minecraft':
            offset = int(state.get('progress', {}).get('nextOffset') or 0)
            total = state.get('reportedTotal')
            while True:
                if time.monotonic() >= deadline or (max_pages and pages >= max_pages): break
                rows, page_total, url, raw_count, excluded, known_excluded = modrinth_page(offset)
                state.pop('nextAttemptAt', None)
                state['lastSuccessfulAt'] = now()
                if total is None: total = page_total
                merge_page(state, rows, platform)
                add_exclusion_events(state, excluded)
                for excluded_key in known_excluded:
                    register_known_exclusion(state, excluded_key)
                pages += 1
                offset += raw_count
                state['reportedTotal'] = total
                state['progress'] = {'nextOffset': offset, 'lastUrl': url}
                save_state(state)
                print(f'{platform}: {len(state["entries"])}/{total} offset={offset}', flush=True)
                if raw_count == 0 or (total is not None and offset >= total):
                    state['enumerationComplete'] = total is not None and offset >= total
                    if raw_count == 0 and total is not None and offset < total:
                        state['status'] = 'limited'
                        state['errors'].append(f'Modrinth returned an empty page at offset {offset} before total_hits={total}; progress retained')
                    break
                if pages < (max_pages or 10**9): time.sleep(REQUEST_DELAY)
            if state.get('enumerationComplete'): state['status'] = 'complete'
        elif platform == 'cs2':
            page = int(state.get('progress', {}).get('nextPage') or 1)
            total_pages = state.get('progress', {}).get('reportedPages')
            while True:
                if time.monotonic() >= deadline or (max_pages and pages >= max_pages): break
                rows, total, pages_total, raw_count, raw_ids, excluded = steam_page(page)
                state.pop('nextAttemptAt', None)
                state['lastSuccessfulAt'] = now()
                ids_digest = page_id_fingerprint(raw_ids)
                seen_pages = set(state.get('progress', {}).get('pageFingerprints', []))
                if raw_ids and ids_digest in seen_pages:
                    state['errors'].append(f'Repeated ID page at {page}; stopped without claiming completion')
                    state['status'] = 'limited'
                    break
                seen_pages.add(ids_digest)
                merge_page(state, rows, platform)
                for excluded_row in excluded:
                    register_cs2_exclusion(state, f'cs2:{excluded_row["id"]}', excluded_row)
                pages += 1
                state['reportedTotal'] = total
                state['candidateCount'] = total
                total_pages = pages_total or total_pages
                state['progress'] = {'nextPage': page + 1, 'reportedPages': total_pages, 'pageSize': raw_count, 'lastCompletedPage': page, 'pageFingerprints': sorted(seen_pages)}
                save_state(state)
                print(f'{platform}: {len(state["entries"])}/{total} page={page}/{total_pages}', flush=True)
                if not raw_ids or not steam_page_has_more_candidates(raw_ids, page, total_pages):
                    state['enumerationComplete'] = not raw_ids or (total_pages is not None and page >= total_pages)
                    break
                page += 1
                time.sleep(REQUEST_DELAY)
            if state.get('enumerationComplete'): state['status'] = 'complete'
        else:
            page = int(state.get('progress', {}).get('nextPage') or 1)
            seen = set(state.get('progress', {}).get('pageFingerprints') or [])
            while True:
                if time.monotonic() >= deadline or (max_pages and pages >= max_pages): break
                rows, source, next_page = fortnite_page(page)
                state.pop('nextAttemptAt', None)
                state['lastSuccessfulAt'] = now()
                digest = page_id_fingerprint(row['id'] for row in rows)
                if digest in seen:
                    state['errors'].append(f'Repeated page content at page {page}; stopped without claiming completion')
                    state['status'] = 'limited'
                    break
                seen.add(digest)
                if not rows:
                    state['enumerationComplete'] = True
                    state['status'] = 'complete'
                    state['progress'] = {'nextPage': None, 'lastCompletedPage': page - 1, 'pageFingerprints': sorted(seen)}
                    break
                merge_page(state, rows, platform)
                pages += 1
                next_page = next_page if next_page and next_page > page else page + 1
                state['progress'] = {'nextPage': next_page, 'lastCompletedPage': page, 'pageFingerprints': sorted(seen)}
                save_state(state)
                print(f'{platform}: {len(state["entries"])} records page={page} next={next_page}', flush=True)
                page = next_page
                time.sleep(REQUEST_DELAY)
        if state.get('status') not in ('complete', 'limited'):
            state['status'] = 'partial'
    except HTTPError as error:
        state['status'] = 'limited' if error.code in (403, 429) else 'partial'
        state['errors'].append(f'HTTP {error.code}: {error.reason}; progress retained')
    except Exception as error:
        state['status'] = 'partial'
        state['errors'].append(f'{type(error).__name__}: {error}; progress retained')
        if NEXT_ATTEMPT_AT:
            state['nextAttemptAt'] = datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat(timespec='seconds')
    state['enumerationComplete'] = bool(state.get('enumerationComplete'))
    if state['enumerationComplete'] and (not state.get('enumerationCompletedAt') or refresh):
        state['enumerationCompletedAt'] = now()
    write_platform(platform, state)
    save_state(state)
    return state


def write_board_covers():
    """Publish only verified image URLs for IDs already present in real board snapshots."""
    latest = read_json(ROOT / 'data/ugc/latest.json', {'platforms': {}})
    previous_index = read_json(CATALOG / 'board-covers.json', {'entries': {}}).get('entries', {})
    cache_entries = {}
    excluded_by_key = {}
    for platform in PLATFORMS:
        state = load_state(platform)
        for entry in state.get('entries', {}).values():
            cache_entries.setdefault(platform, []).append(entry)
        for exclusion in state.get('excludedRecords', []):
            key = exclusion.get('key')
            if isinstance(key, str): excluded_by_key[key] = exclusion
    by_key = {p: {e['key']: e for e in cache_entries.get(p, [])} for p in PLATFORMS}
    by_canonical = {p: {str(e.get('canonicalId')): e for e in cache_entries.get(p, [])
                        if e.get('canonicalId') and e.get('identityStatus') == 'verified'} for p in PLATFORMS}
    by_source_id = {p: {str(source_id): e for e in cache_entries.get(p, [])
                        for source_id in [*(e.get('sourceIds') or []), e.get('placeId'), e.get('id')] if source_id}
                    for p in PLATFORMS}
    output = {}
    for board_id, data in latest.get('platforms', {}).items():
        platform = data.get('platformId') or board_id.removesuffix('_alltime')
        if platform not in PLATFORMS:
            continue
        for row in data.get('entries', []):
            identifier = str(row.get('id', ''))
            entry = by_key[platform].get(catalog_key(platform, identifier))
            if entry is None and platform == 'roblox':
                entry = by_canonical[platform].get(identifier) or by_source_id[platform].get(identifier)
            image = entry.get('image') if entry else None
            if entry is None:
                key = catalog_key(platform, identifier)
                exclusion = excluded_by_key.get(key, {})
                source_entry = exclusion.get('originalEntry') or exclusion.get('evidence') or {}
                excluded_image = source_entry.get('image') if isinstance(source_entry, dict) else None
                if isinstance(excluded_image, dict) and excluded_image.get('status') == 'available' and https(excluded_image.get('url')):
                    image = excluded_image
                old_image = previous_index.get(key)
                if (not image and isinstance(old_image, dict) and old_image.get('status') == 'available' and
                        https(old_image.get('url')) and https(old_image.get('sourceUrl')) and valid_iso_time(old_image.get('checkedAt'))):
                    image = old_image
            image = image or {'url': None, 'sourceUrl': https(row.get('url')), 'kind': None, 'status': 'missing', 'checkedAt': now()}
            output[catalog_key(platform, identifier)] = image
    atomic_json(CATALOG / 'board-covers.json', {'schemaVersion': 1, 'updatedAt': now(), 'entries': output})


def process_roblox_identities(maximum, deadline):
    global CURRENT_DEADLINE, NEXT_ATTEMPT_AT
    CURRENT_DEADLINE = deadline
    NEXT_ATTEMPT_AT = None
    state = load_state('roblox')
    identities = read_json(CACHE / 'roblox-identities.json', {'schemaVersion': 1, 'entries': {}})
    queue = read_json(CACHE / 'roblox-identity-queue.json', {'entries': []})
    todo = []
    for item in queue.get('entries', []):
        cached = identities['entries'].get(str(item.get('placeId')), {})
        if cached.get('universeId'):
            continue
        try:
            if cached.get('nextAttemptAt') and datetime.fromisoformat(cached['nextAttemptAt'].replace('Z', '+00:00')).timestamp() > time.time():
                continue
        except ValueError: pass
        todo.append(item)
    completed = 0
    for item in todo[:maximum]:
        if time.monotonic() >= deadline: break
        place = str(item['placeId'])
        identity = identities['entries'].setdefault(place, {'placeId': place, 'attempts': 0, 'status': 'pending'})
        identity['attempts'] += 1
        stop_after_save = False
        try:
            data = json.loads(public_request('https://apis.roblox.com/universes/v1/places/' + place + '/universe'))
            universe = str(data.get('universeId') or '')
            if not universe: raise ValueError('Public place endpoint did not return universeId')
            identity.update({'universeId': universe, 'status': 'verified', 'checkedAt': now(), 'lastError': None})
            completed += 1
        except Exception as error:
            identity.update({'status': 'pending', 'lastError': f'{type(error).__name__}: {error}', 'lastAttemptAt': now()})
            if NEXT_ATTEMPT_AT: identity['nextAttemptAt'] = datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat(timespec='seconds')
            if isinstance(error, HTTPError) and error.code in (403, 429): stop_after_save = True
        atomic_json(CACHE / 'roblox-identities.json', identities)
        print(f'roblox identity: {completed}/{min(maximum,len(todo))} checked; place={place} status={identity["status"]}', flush=True)
        if stop_after_save: break
    # Reflect cached mappings immediately; source enumeration itself is never repeated.
    write_platform('roblox', state)
    save_state(state)
    return completed


def process_steam_creators(maximum, deadline):
    """Resolve cached numeric Steam author IDs through their public profile XML, at source rate."""
    global CURRENT_DEADLINE, NEXT_ATTEMPT_AT
    CURRENT_DEADLINE, NEXT_ATTEMPT_AT = deadline, None
    state = load_state('cs2')
    cache = read_json(CACHE / 'steam-creators.json', {'schemaVersion': 1, 'entries': {}})
    ids = sorted({str(e.get('creator')) for e in state.get('entries', {}).values()
                  if str(e.get('creator') or '').isdigit() and len(str(e.get('creator'))) >= 16})
    completed, attempted = 0, 0
    for creator_id in ids:
        if attempted >= maximum or time.monotonic() >= deadline: break
        item = cache['entries'].setdefault(creator_id, {'status': 'pending', 'attempts': 0})
        if item.get('name'): continue
        if item.get('nextAttemptAt'):
            try:
                if datetime.fromisoformat(item['nextAttemptAt'].replace('Z', '+00:00')).timestamp() > time.time(): continue
            except ValueError: pass
        item['attempts'] += 1
        attempted += 1
        url = f'https://steamcommunity.com/profiles/{creator_id}/?xml=1'
        stop_after_save = False
        try:
            source = public_request(url, headers={'Accept': 'application/xml,text/xml'})
            match = re.search(r'<steamID(?:><!\[CDATA\[|>)(.*?)(?:\]\]>)?</steamID>', source, re.S)
            name = html.unescape(re.sub(r'<[^>]+>', '', match.group(1))).strip() if match else ''
            if not name: raise ValueError('Public Steam profile did not expose a profile name')
            item.update({'name': name, 'status': 'verified', 'checkedAt': now(), 'sourceUrl': url, 'lastError': None})
            completed += 1
        except Exception as error:
            item.update({'status': 'limited' if isinstance(error, HTTPError) and error.code in (403, 429) else 'unavailable',
                         'checkedAt': now(), 'sourceUrl': url, 'lastError': f'{type(error).__name__}: {error}'})
            if NEXT_ATTEMPT_AT:
                item['nextAttemptAt'] = datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat(timespec='seconds')
            if isinstance(error, HTTPError) and error.code in (403, 429):
                stop_after_save = True
        atomic_json(CACHE / 'steam-creators.json', cache)
        print(f'cs2 creator lookup: {attempted}/{maximum} attempted, {completed} resolved; creator={creator_id} status={item["status"]}', flush=True)
        if stop_after_save: break
    name_by_id = {creator_id: item['name'] for creator_id, item in cache['entries'].items() if item.get('name')}
    for entry in state.get('entries', {}).values():
        creator_id = str(entry.get('creator') or '')
        if creator_id in name_by_id: entry['creator'] = name_by_id[creator_id]
    write_platform('cs2', state)
    save_state(state)
    return attempted


def fetch_detail(platform, entry):
    url = entry.get('url')
    if platform == 'fortnite':
        source = public_request(url)
        tree = board.Tree(source).root
        descriptions = tree.find_all(class_name='island-desc')
        creators = [n for n in tree.find_all(tag='a') if n.attrs.get('href', '').startswith('/creator/')]
        return {'description': ' '.join(n.text() for n in descriptions), 'creator': creators[0].text() if creators else '', 'sources': [url]}
    if platform == 'cs2':
        source = public_request(url)
        tree = board.Tree(source).root
        desc = next((n.text() for n in tree.find_all(class_name='workshopItemDescription')), '')
        return {'description': desc, 'sources': [url]}
    if platform == 'roblox' and entry.get('canonicalId'):
        url = 'https://games.roblox.com/v1/games?universeIds=' + str(entry['canonicalId'])
        payload = json.loads(public_request(url))
        game = next((x for x in payload.get('data', []) if str(x.get('id')) == str(entry['canonicalId'])), {})
        if not game: return {'description': '', 'sources': [url]}
        return {'description': game.get('description') or '', 'creator': (game.get('creator') or {}).get('name', ''),
                'categories': [x for x in (game.get('genre_l1'), game.get('genre_l2')) if x], 'sources': [url]}
    return {'description': '', 'sources': []}


def process_details(platforms, maximum, deadline):
    global CURRENT_DEADLINE, NEXT_ATTEMPT_AT
    CURRENT_DEADLINE, NEXT_ATTEMPT_AT = deadline, None
    processed, attempted = 0, 0
    for platform in platforms:
        state = load_state(platform)
        entries = sorted(state.get('entries', {}).values(), key=lambda e: e['key'])
        entries = [entry for entry in entries if not entry.get('descriptionOriginal') and
                   not (platform == 'roblox' and entry.get('identityStatus') != 'verified') and
                   (not entry.get('detailNextAttemptAt') or
                    datetime.fromisoformat(entry['detailNextAttemptAt'].replace('Z', '+00:00')).timestamp() <= time.time())]
        cursor = state.get('detailQueueNextKey')
        if cursor and entries:
            after = [e for e in entries if e['key'] > cursor]
            entries = after + [e for e in entries if e['key'] <= cursor]
        for entry in entries:
            if attempted >= maximum or time.monotonic() >= deadline: break
            attempted += 1
            try:
                detail = fetch_detail(platform, entry)
                entry.pop('detailNextAttemptAt', None)
                description = str(detail.get('description') or '').strip()
                entry['detailAttempts'] = entry.get('detailAttempts', 0) + 1
                entry['detailLastAttemptAt'] = now()
                if description:
                    entry['descriptionOriginal'] = description
                    entry['sourceFingerprint'] = fingerprint(entry['originalTitle'], description)
                    entry['creator'] = entry.get('creator') or detail.get('creator', '')
                    entry['categories'] = detail.get('categories') or entry.get('categories', [])
                    entry['sources'] = list(dict.fromkeys([*entry['sources'], *(detail.get('sources') or [])]))
                    entry['translationStatus'] = 'pending'
                    entry['titleZh'] = ''
                    entry['introZh'] = ''
                    entry['detailStatus'] = 'available'
                    entry['detailLastError'] = None
                else:
                    entry['detailStatus'] = 'unavailable'
                    entry['detailLastError'] = '公开详情页未提供可核实玩法说明'
                processed += 1
                print(f'{platform} detail: processed={processed}/{maximum} key={entry["key"]} description={bool(description)}', flush=True)
            except HTTPError as error:
                entry['detailAttempts'] = entry.get('detailAttempts', 0) + 1
                entry['detailLastAttemptAt'] = now()
                entry['detailStatus'] = 'limited' if error.code in (403, 429) else 'unavailable'
                entry['detailLastError'] = f'HTTP {error.code}'
                state['errors'] = [f'detail HTTP {error.code} at {entry["key"]}; cursor retained']
                if error.code in (403, 429): break
            except Exception as error:
                entry['detailAttempts'] = entry.get('detailAttempts', 0) + 1
                entry['detailLastAttemptAt'] = now()
                entry['detailStatus'] = 'unavailable'
                entry['detailLastError'] = f'{type(error).__name__}: {error}'
                state['errors'] = [f'detail {entry["key"]}: {type(error).__name__}: {error}']
                if NEXT_ATTEMPT_AT:
                    entry['detailNextAttemptAt'] = datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat(timespec='seconds')
            entry['lastObservedAt'] = now()
            state['detailQueueNextKey'] = entry['key']
            save_state(state)
            time.sleep(REQUEST_DELAY)
        write_platform(platform, state)
        save_state(state)
    return processed


def register_known_exclusion(state, key):
    rule = KNOWN_EXCLUSIONS[key]
    exclusions = state.setdefault('excludedRecords', [])
    if not any(item.get('key') == key for item in exclusions):
        exclusions.append({'key': key, **rule, 'excludedAt': now()})
        add_exclusion_events(state, 1)
    state.setdefault('entries', {}).pop(key, None)


def process_modrinth_covers(deadline):
    """Fetch missing Modrinth icons/gallery URLs from the public project multi-get API."""
    global CURRENT_DEADLINE, NEXT_ATTEMPT_AT
    CURRENT_DEADLINE, NEXT_ATTEMPT_AT = deadline, None
    state = load_state('minecraft')
    if retry_time_is_future(state.get('coverNextAttemptAt')):
        return 0
    state.pop('coverNextAttemptAt', None)
    pending = sorted((entry for entry in state.get('entries', {}).values()
                      if not entry.get('image', {}).get('url') and not entry.get('coverLookupAt')),
                     key=lambda entry: entry['key'])
    completed = 0
    for start in range(0, len(pending), 100):
        if time.monotonic() >= deadline: break
        batch = pending[start:start + 100]
        ids = [entry['id'] for entry in batch]
        url = 'https://api.modrinth.com/v2/projects?' + urlencode({'ids': json.dumps(ids, separators=(',', ':'))})
        try:
            payload = json.loads(public_request(url))
            state.pop('coverNextAttemptAt', None)
        except Exception as error:
            state['coverLookupError'] = f'{type(error).__name__}: {error}'
            if NEXT_ATTEMPT_AT:
                state['coverNextAttemptAt'] = datetime.fromtimestamp(NEXT_ATTEMPT_AT, timezone.utc).isoformat(timespec='seconds')
            state['coverLookupNextKey'] = batch[0]['key'] if batch else None
            save_state(state)
            break
        by_id = {str(item.get('id')): item for item in payload if isinstance(item, dict) and item.get('id')}
        for entry in batch:
            entry['coverLookupAt'] = now()
            item = by_id.get(str(entry['id']))
            if item:
                image_url, kind = modrinth_cover(item)
                if image_url:
                    entry['image'] = {'url': image_url, 'sourceUrl': entry.get('url'), 'kind': kind,
                                      'status': 'available', 'checkedAt': now()}
                    completed += 1
                else:
                    entry['image'].update({'status': 'missing', 'checkedAt': now()})
        state.pop('coverLookupError', None)
        state['coverLookupNextKey'] = pending[start + 100]['key'] if start + 100 < len(pending) else None
        save_state(state)
        print(f'minecraft covers: {min(start + len(batch),len(pending))}/{len(pending)} checked; {completed} found', flush=True)
    write_platform('minecraft', state)
    save_state(state)
    return completed


def acquire_lock(lock_path):
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        existing = read_json(lock_path, {})
        pid = existing.get('pid')
        alive, command = False, ''
        if isinstance(pid, int) and pid > 0:
            if os.name == 'nt':
                query = f'$p=Get-CimInstance Win32_Process -Filter "ProcessId = {pid}" -ErrorAction Stop; if ($p) {{ Write-Output "__PID_EXISTS__"; Write-Output $p.CommandLine }} else {{ Write-Output "__PID_MISSING__" }}'
                try:
                    result = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', query],
                        capture_output=True, text=True, timeout=10)
                except Exception as error:
                    raise SystemExit(f'Unable to verify lock pid {pid}; lock retained: {error}')
                if result.returncode != 0:
                    raise SystemExit(f'Unable to verify lock pid {pid}; lock retained: {result.stderr.strip()}')
                lines = result.stdout.splitlines()
                if not lines or lines[0].strip() not in ('__PID_EXISTS__', '__PID_MISSING__'):
                    raise SystemExit(f'Unable to verify lock pid {pid}; lock retained: unexpected CIM response')
                alive = lines[0].strip() == '__PID_EXISTS__'
                command = '\n'.join(lines[1:]).strip()
                if alive and not command:
                    raise SystemExit(f'Lock pid {pid} exists but its command could not be verified; lock retained.')
            else:
                try:
                    os.kill(pid, 0)
                    alive = True
                except OSError:
                    alive = False
            if alive and os.name != 'nt':
                try: command = Path(f'/proc/{pid}/cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
                except OSError: command = ''
        if alive:
            if 'sync_ugc_catalog.py' in command:
                raise SystemExit(f'Catalog sync is active (pid {pid}); lock retained.')
            raise SystemExit(f'Lock pid {pid} is still alive but its command could not be verified; lock retained.')
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, json.dumps({'pid': os.getpid(), 'startedAt': now(), 'command': 'sync_ugc_catalog.py'}).encode())
    os.close(fd)


def platform_manifest(platform, state):
    source_url, query, scope = SOURCE[platform]
    if platform == 'cs2':
        scope += ' 资料不足的类型按来源地图标签保留待核；完成遍历不等于逐项验证可玩性。'
    if platform == 'minecraft' and state.get('progress', {}).get('lastUrl'):
        source_url = state['progress']['lastUrl']
    observed = state.get('observedCount', len(state.get('entries', {})))
    public_exclusions = []
    for record in state.get('excludedRecords', []):
        approval = record.get('approval') or record.get('reviewApproval') or {}
        sources = record.get('sources') or ([record['sourceUrl']] if https(record.get('sourceUrl')) else [])
        public_exclusions.append({field: value for field, value in {
            'key': record.get('key'), 'sourceFingerprint': record.get('sourceFingerprint'),
            'originalTitle': record.get('originalTitle'), 'reason': record.get('reason'),
            'sources': sources, 'excludedAt': record.get('excludedAt'),
            'reviewedAt': record.get('reviewedAt'), 'reviewer': record.get('reviewer'),
            'approvedBy': approval.get('approvedBy'), 'approvedAt': approval.get('approvedAt')}.items()
            if value is not None})
    return {'label': {'cs2':'CS2 创意工坊地图','roblox':'Roblox 公开作品（Rolimon’s）','fortnite':'堡垒之夜社区岛','minecraft':'Minecraft Java 单体模组'}[platform],
        'sourceUrl': source_url, 'sourceScope': scope, 'sourceQuery': query,
        'status': state.get('status') or 'unavailable', 'reportedTotal': state.get('reportedTotal'),
        'candidateCount': state.get('candidateCount') if state.get('candidateCount') is not None else (state.get('reportedTotal') if platform == 'cs2' else None),
        'sourceRecordCount': state.get('sourceRecordCount', state.get('reportedTotal') if platform == 'roblox' else observed),
        'canonicalUniqueCount': state.get('canonicalUniqueCount', observed - state.get('identityPendingCount', 0)),
        'excludedByTypeEventCount': state.get('excludedByTypeEventCount', state.get('excludedByTypeCount', 0)),
        'exclusionRecords': public_exclusions,
        'candidateObservationDifference': ((state.get('candidateCount') if state.get('candidateCount') is not None else state.get('reportedTotal')) - observed
            if state.get('enumerationComplete') and (state.get('candidateCount') is not None or state.get('reportedTotal') is not None) else None),
        'excludedCount': None,
        'observedCount': observed, 'reviewedCount': state.get('reviewedCount', 0),
        'withCoverCount': state.get('withCoverCount', 0), 'identityPendingCount': state.get('identityPendingCount', 0),
        'enumerationComplete': bool(state.get('enumerationComplete')), 'progress': state.get('progress', {}),
        'errors': state.get('errors', []), 'nextAttemptAt': state.get('nextAttemptAt'),
        'startedAt': state.get('startedAt'), 'updatedAt': state.get('updatedAt'),
        'lastAttemptAt': state.get('lastAttemptAt'), 'lastSuccessfulAt': state.get('lastSuccessfulAt'),
        'enumerationCompletedAt': state.get('enumerationCompletedAt'),
        'shards': state.get('shards', []), 'searchShards': state.get('searchShards', [])}


def publish_all():
    platforms = {}
    for platform in ('cs2', 'roblox', 'fortnite', 'minecraft'):
        state = load_state(platform)
        if not state.get('startedAt') and not state.get('entries'):
            state['status'] = 'unavailable'
            state['errors'] = ['Not attempted yet; public source enumeration has not started.']
            state.setdefault('enumerationComplete', False)
        else:
            write_platform(platform, state)
            save_state(state)
        platforms[platform] = platform_manifest(platform, state)
    write_board_covers()
    result = {'schemaVersion': 1, 'generatedAt': now(), 'boardCoversUrl': 'data/ugc/catalog/board-covers.json', 'platforms': platforms}
    atomic_json(CATALOG / 'manifest.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platforms', nargs='*', choices=PLATFORMS, default=list(PLATFORMS))
    parser.add_argument('--time-budget-seconds', type=int, default=14400, help='Total wall-clock budget across selected sources')
    parser.add_argument('--platform-time-budget-seconds', type=int, default=3600, help='Per-source budget; unfinished sources resume from their saved checkpoint')
    parser.add_argument('--max-pages-per-platform', type=int, default=0, help='Diagnostic page cap; 0 means no artificial record/page cap')
    parser.add_argument('--publish-only', action='store_true', help='Publish current cache with explicit pending/unavailable states without network requests')
    parser.add_argument('--resolve-roblox-identities', action='store_true')
    parser.add_argument('--max-identities', type=int, default=50)
    parser.add_argument('--refresh-details', action='store_true')
    parser.add_argument('--max-details', type=int, default=50)
    parser.add_argument('--resolve-creators', action='store_true', help='Resolve cached numeric Steam creator IDs through public profile XML')
    parser.add_argument('--max-creators', type=int, default=50)
    parser.add_argument('--refresh-covers', action='store_true', help='Backfill missing Modrinth covers from the public project multi-get API')
    parser.add_argument('--refresh', action='store_true', help='Start a fresh full traversal from page/offset 0, retaining older records and translation history')
    args = parser.parse_args()
    CATALOG.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    lock = CACHE / '.sync.lock'
    acquire_lock(lock)
    try:
        if args.publish_only:
            publish_all()
            print('Published cached catalog state; no source requests made.', flush=True)
            return
        publish_all()
        started = time.monotonic()
        total_deadline = started + max(1, args.time_budget_seconds)
        if args.refresh_covers:
            process_modrinth_covers(total_deadline)
            publish_all()
            return
        for platform in args.platforms:
            if time.monotonic() >= total_deadline:
                print(f'{platform}: deferred due to total time budget', flush=True)
                continue
            source_deadline = min(total_deadline, time.monotonic() + max(1, args.platform_time_budget_seconds))
            if platform == 'roblox' and args.resolve_roblox_identities:
                process_roblox_identities(args.max_identities, source_deadline)
                publish_all()
            if platform == 'cs2' and args.resolve_creators:
                process_steam_creators(args.max_creators, source_deadline)
                publish_all()
            if args.refresh_details:
                process_details([platform], args.max_details, source_deadline)
            state = collect_one(platform, source_deadline, args.max_pages_per_platform, refresh=args.refresh)
            manifest = platform_manifest(platform, state)
            print(f'{platform} status={manifest["status"]} observed={manifest["observedCount"]} total={manifest["reportedTotal"]} covers={manifest["withCoverCount"]} reviewed={manifest["reviewedCount"]}', flush=True)
            publish_all()
    finally:
        try: lock.unlink()
        except FileNotFoundError: pass


if __name__ == '__main__':
    main()
