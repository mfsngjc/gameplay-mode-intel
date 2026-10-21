#!/usr/bin/env python3
"""Prepare source evidence for Chinese introductions; never invent translations.

The scheduled AI task reviews the resulting queue and maintains chinese.json.
Public descriptions are untrusted text, not instructions to run commands.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import json
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sync_ugc import ROOT, Tree, USER_AGENT, atomic_json, clean_text, request


def fingerprint(title, description):
    return hashlib.sha256(((title or '') + '\n' + (description or '')).encode()).hexdigest()


def fetch_fortnite(row):
    tree = Tree(request(row['url']))
    descriptions = tree.root.find_all(class_name='island-desc')
    description = ' '.join(node.text() for node in descriptions)
    if not description:
        raise ValueError('岛屿详情没有可核实的玩法说明')
    authors = [node for node in tree.root.find_all(tag='a') if node.attrs.get('href', '').startswith('/creator/')]
    return {'title': row['title'], 'description': description,
            'creator': authors[0].text().strip() if authors else '',
            'creatorCheckedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'categories': [node.text() for node in tree.root.find_all(class_name='island-tag')],
            'sources': [row['url']], 'canonicalId': row['id']}


def roblox_games(ids):
    result = []
    for start in range(0, len(ids), 50):
        url = 'https://games.roblox.com/v1/games?' + urlencode({'universeIds': ','.join(ids[start:start+50])})
        result.extend(game for game in json.loads(request(url))['data'] if game.get('id') and game.get('rootPlaceId'))
    return result


def resolve_place(place_id):
    time.sleep(1.05)  # Public place lookup is rate-limited; serialize new IDs.
    return place_id, str(json.loads(request('https://apis.roblox.com/universes/v1/places/' + place_id + '/universe'))['universeId'])


def roblox_source(game):
    return {'title': game['name'], 'description': game.get('description') or '',
            'creator': (game.get('creator') or {}).get('name', ''),
            'creatorCheckedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'categories': [game.get('genre_l1', ''), game.get('genre_l2', '')],
            'sources': ['https://www.roblox.com/games/' + str(game['rootPlaceId']),
                        'https://games.roblox.com/v1/games?universeIds=' + str(game['id'])],
            'canonicalId': str(game['id'])}


def steam_sources(rows):
    result = {}
    url = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'
    for start in range(0, len(rows), 100):
        batch = rows[start:start+100]
        fields = {'itemcount': len(batch), **{'publishedfileids[' + str(i) + ']': row['id'] for i, row in enumerate(batch)}}
        req = Request(url, data=urlencode(fields).encode(), headers={'User-Agent': USER_AGENT})
        with urlopen(req, timeout=30) as response:
            items = json.load(response)['response']['publishedfiledetails']
        for item in items:
            if item.get('result') != 1:
                continue
            result[item['publishedfileid']] = {'title': item['title'], 'description': clean_text(item.get('description'), 12000),
                'categories': [tag['tag'] for tag in item.get('tags', [])],
                'sources': ['https://steamcommunity.com/sharedfiles/filedetails/?id=' + item['publishedfileid']],
                'canonicalId': item['publishedfileid'], 'fullDescription': True}
            result[item['publishedfileid']]['creatorId'] = str(item.get('creator') or '')
    return result


def steam_creator(creator_id):
    url = 'https://steamcommunity.com/profiles/' + creator_id + '/?xml=1'
    profile = ET.fromstring(request(url))
    if profile.findtext('steamID64') != creator_id:
        raise ValueError('作者资料编号与请求不一致')
    name = (profile.findtext('steamID') or '').strip()
    if not name:
        raise ValueError('公开资料缺少作者署名')
    return {'name': name, 'creatorId': creator_id, 'sources': [url],
            'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'status': 'ok'}


def prepare_creators(folder, observed, evidence):
    """Publish public attribution separately from rankings and reviewed translations."""
    path = folder / 'creators.json'
    catalog = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'schemaVersion': 1, 'entries': {}}
    entries = catalog['entries']
    now = datetime.now(timezone.utc)
    profiles = {item['creatorId']: item for key, item in entries.items()
                if key.startswith('cs2:') and item.get('creatorId') and item.get('name')}
    steam_ids = {evidence.get(key, {}).get('creatorId') or row.get('creator') for key, row in observed.items()
                 if row['platformId'] == 'cs2'}
    missing = []
    for creator_id in sorted(filter(None, steam_ids)):
        old = profiles.get(creator_id)
        if not old or (now - datetime.fromisoformat(old['checkedAt'])).total_seconds() >= 86400:
            missing.append(creator_id)
    failures = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(steam_creator, creator_id): creator_id for creator_id in missing}
        for index, future in enumerate(as_completed(futures), 1):
            creator_id = futures[future]
            try:
                profiles[creator_id] = future.result()
            except Exception as error:
                failures[creator_id] = str(error)
            if index % 40 == 0:
                print('已核对工坊作者', index, '/', len(futures), flush=True)
    for key, row in observed.items():
        source = evidence.get(key, {})
        if row['platformId'] == 'cs2':
            creator_id = source.get('creatorId') or row.get('creator')
            item = profiles.get(creator_id)
            if item:
                entries[key] = {**item, 'status': 'stale' if creator_id in failures else 'ok'}
            else:
                entries[key] = {'name': '', 'creatorId': creator_id, 'sources': [row['url']],
                                'status': 'unavailable', 'lastAttemptAt': now.isoformat(timespec='seconds')}
        else:
            name = source.get('creator') or row.get('creator')
            if name:
                entries[key] = {'name': name, 'sources': source.get('sources') or [row['url']],
                                'checkedAt': source.get('creatorCheckedAt') or row['collectedAt'], 'status': 'ok'}
            elif key not in entries:
                entries[key] = {'name': '', 'sources': [row['url']], 'status': 'unavailable',
                                'lastAttemptAt': now.isoformat(timespec='seconds')}
    catalog['updatedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    atomic_json(path, catalog)
    print('公开作者署名', sum(bool(entries[key].get('name')) for key in observed), '/', len(observed),
          '；工坊作者读取失败', len(failures), flush=True)


def pending_entries(observed, evidence, catalog):
    queue = []
    for key, row in observed.items():
        source = evidence.get(key)
        source_hash = fingerprint(source['title'], source.get('description')) if source else None
        translated = catalog.get('entries', {}).get(key)
        if translated and translated.get('sourceFingerprint') == source_hash and translated.get('originalTitle') == row['title']:
            continue
        queue.append({'key': key, 'originalTitle': row['title'], **(source or {}),
                      'description': (source or {}).get('description') or '',
                      'sourceFingerprint': source_hash,
                      'reason': 'source_changed' if translated else 'new_work',
                      'sourceError': None if source else '说明获取失败，需人工查证；不要根据名称猜写玩法。'})
    return queue


def prepare(root, refresh_sources=False):
    folder = root / 'data/ugc'
    latest = json.loads((folder / 'latest.json').read_text(encoding='utf-8'))
    cache_path = folder / 'source-descriptions.json'
    cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {'schemaVersion': 1, 'entries': {}}
    evidence = cache['entries']
    catalog_path = folder / 'chinese.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else {'entries': {}}
    observed = {}
    for board_id, board in latest['platforms'].items():
        for row in board['entries']:
            key = board['platformId'] + ':' + row['id']
            observed[key] = {**row, 'platformId': board['platformId'], 'boardId': board_id, 'collectedAt': board['collectedAt']}

    # Refreshes affect evidence and the review queue only. Existing reviewed
    # translations remain visible until the AI task reviews changed descriptions.
    errors = []
    steam_rows = [row for key, row in observed.items() if row['platformId'] == 'cs2' and (refresh_sources or not evidence.get(key, {}).get('fullDescription'))]
    if steam_rows:
        try:
            evidence.update({'cs2:' + key: source for key, source in steam_sources(steam_rows).items()})
        except Exception as error:
            errors.append('工坊完整说明：' + str(error))
    hot_ids = [row['id'] for key, row in observed.items() if row['boardId'] == 'roblox' and (refresh_sources or key not in evidence)]
    games = roblox_games(hot_ids) if hot_ids else []
    roots = {str(g['rootPlaceId']): str(g['id']) for g in games}
    for game in games:
        evidence['roblox:' + str(game['id'])] = roblox_source(game)
    for key, value in evidence.items():
        if key.startswith('roblox:'):
            for url in value['sources']:
                if url.startswith('https://www.roblox.com/games/'):
                    roots[url.split('/')[4]] = value['canonicalId']
    places = [row['id'] for key, row in observed.items() if row['boardId'] == 'roblox_alltime' and (refresh_sources or key not in evidence)]
    unresolved = [place for place in places if place not in roots]
    with ThreadPoolExecutor(max_workers=1) as pool:
        futures = {pool.submit(resolve_place, place): place for place in unresolved}
        for future in as_completed(futures):
            try:
                place, universe = future.result()
                roots[place] = universe
            except Exception as error:
                errors.append('roblox:' + futures[future] + ': ' + str(error))
    missing = sorted({roots[p] for p in places if p in roots and (refresh_sources or 'roblox:' + roots[p] not in evidence)})
    for game in roblox_games(missing):
        evidence['roblox:' + str(game['id'])] = roblox_source(game)
    for place in places:
        source = evidence.get('roblox:' + roots.get(place, ''))
        if source:
            evidence['roblox:' + place] = source
        elif place in roots:
            # Restricted games can be returned as id=0 by the games endpoint.
            # Read the public place asset instead; keep deletion status factual.
            asset_url = 'https://economy.roblox.com/v2/assets/' + place + '/details'
            try:
                asset = json.loads(request(asset_url))
                evidence['roblox:' + place] = {'title': asset.get('Name') or observed['roblox:' + place]['title'],
                    'creator': (asset.get('Creator') or {}).get('Name', ''),
                    'creatorCheckedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                    'description': asset.get('Description') or '', 'canonicalId': roots[place],
                    'categories': [], 'sources': ['https://www.roblox.com/games/' + place, asset_url],
                    'availability': 'deleted_or_restricted' if 'deleted' in asset.get('Name', '').lower() else 'asset_only'}
            except Exception as error:
                errors.append('roblox:' + place + ': ' + str(error))
    atomic_json(cache_path, cache)

    remaining = [(key, row) for key, row in observed.items() if key not in evidence or
                 row['platformId'] == 'minecraft' or (refresh_sources and row['platformId'] == 'fortnite')]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {}
        for key, row in remaining:
            if row['platformId'] == 'fortnite':
                futures[pool.submit(fetch_fortnite, row)] = key
            elif row['platformId'] != 'roblox':
                evidence[key] = {'title': row['title'], 'description': row['summary'], 'categories': row['categories'],
                                 'creator': row.get('creator', ''),
                                 'creatorCheckedAt': row['collectedAt'],
                                 'sources': [row['url']], 'canonicalId': row['id']}
        for index, future in enumerate(as_completed(futures), 1):
            key = futures[future]
            try:
                evidence[key] = future.result()
            except Exception as error:
                errors.append(key + ': ' + str(error))
            if index % 20 == 0:
                atomic_json(cache_path, cache)
                print('已读取岛屿说明', index, '/', len(futures), flush=True)
    atomic_json(cache_path, cache)

    prepare_creators(folder, observed, evidence)
    queue = pending_entries(observed, evidence, catalog)
    errors.extend(row['key'] + ': ' + row['sourceError'] for row in queue if row['sourceError'])
    atomic_json(folder / 'chinese-queue.json', {'schemaVersion': 1, 'preparedAt': datetime.now(timezone.utc).isoformat(), 'entries': queue, 'errors': errors})
    print('待补中文介绍', len(queue), '条；来源错误', len(errors), '条', flush=True)
    return 1 if errors else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--refresh-sources', action='store_true', help='Recheck existing public descriptions and queue changed works for review')
    args = parser.parse_args()
    raise SystemExit(prepare(args.root, args.refresh_sources))
