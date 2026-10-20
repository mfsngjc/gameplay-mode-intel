#!/usr/bin/env python3
"""Collect daily Top 100 and all-time Top 200 UGC boards with dated snapshots.

Python standard library only. A failed/incomplete source never replaces a valid
snapshot. First observations are a baseline, not fabricated new entries.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CST = timezone(timedelta(hours=8))
USER_AGENT = 'GameplayModeIntel/1.0 (public UGC daily ranking research)'
STEAM_URL = 'https://steamcommunity.com/workshop/browse/'
ROBLOX_URL = 'https://statroblox.com/leaderboards/playing'
FORTNITE_URL = 'https://fortnite.gg/creative'
MODRINTH_URL = 'https://api.modrinth.com/v2/search'
PLATFORMS = {
    'cs2': {
        'label': 'CS2 创意工坊', 'sourceName': 'Steam 创意工坊',
        'sourceUrl': STEAM_URL + '?' + urlencode({'appid': 730, 'section': 'readytouseitems', 'browsesort': 'trend', 'days': 7, 'requiredtags[]': 'CS2'}),
        'rankingKey': 'steam-cs2-map-trend-7d-v1', 'rankingLabel': '近 7 天热门',
        'metricKey': 'subscribers', 'metricLabel': '当前订阅',
        'methodology': 'Steam 近 7 天热门顺序，限定 CS2 地图，排除皮肤和 CS:GO 旧版。订阅量是辅助指标，不是该热门榜的排序分数。',
    },
    'roblox': {
        'label': 'Roblox', 'sourceName': 'Statroblox', 'sourceUrl': ROBLOX_URL,
        'rankingKey': 'statroblox-concurrent-playing-v1', 'rankingLabel': '同时在线人数',
        'metricKey': 'players', 'metricLabel': '同时在线',
        'methodology': 'Statroblox 公开在线人数榜的同次页面快照；第三方覆盖范围内的 Top 100，并非全天均值或官方全球完整榜。',
    },
    'fortnite': {
        'label': '堡垒之夜社区', 'sourceName': 'Fortnite.GG', 'sourceUrl': FORTNITE_URL,
        'rankingKey': 'fortnitegg-creator-ccu-v1', 'rankingLabel': '同时在线人数',
        'metricKey': 'players', 'metricLabel': '同时在线',
        'methodology': 'Fortnite.GG Players Now 排序，保留数字岛屿代码的社区作品，排除官方模式。翻页采样存在短暂时间差。',
    },
    'minecraft': {
        'label': 'Minecraft 模组', 'sourceName': 'Modrinth',
        'sourceUrl': 'https://modrinth.com/mods?g=categories:%21library&sort=downloads',
        'rankingKey': 'modrinth-mod-created30-downloads-no-library-v1', 'rankingLabel': '近 30 天新作下载量',
        'metricKey': 'downloads', 'metricLabel': '累计下载',
        'methodology': 'Modrinth 近 30 天创建的 Java 单体模组按累计下载排序，排除 library 标签，包含工具和优化模组。滚动窗口会影响进出榜；历史最热门另看全量累计下载，不与 CurseForge 合并。',
    },
}
for _key, _config in list(PLATFORMS.items()):
    _config.update({'platformId': _key, 'boardType': 'hot', 'boardLabel': '每日热榜'})
    PLATFORMS[_key + '_alltime'] = {**_config, 'boardType': 'alltime', 'boardLabel': '历史最热门'}
PLATFORMS['cs2_alltime'].update({
    'rankingKey': 'steam-cs2-map-lifetime-subscriptions-v1', 'rankingLabel': '历史总订阅量',
    'metricKey': 'lifetime_subscribers', 'metricLabel': '历史总订阅',
    'sourceUrl': STEAM_URL + '?' + urlencode({'appid': 730, 'section': 'readytouseitems', 'browsesort': 'totaluniquesubscribers', 'requiredtags[]': 'CS2'}),
    'methodology': 'Steam 历史总订阅顺序，限定 CS2 地图；使用 lifetime_subscriptions，不把当前订阅人数当作历史总订阅。CS:GO 旧版另有历史，不混入本榜。',
})
PLATFORMS['roblox_alltime'].update({
    'sourceName': "Rolimon's", 'sourceUrl': 'https://www.rolimons.com/games',
    'rankingKey': 'rolimons-total-visits-v1', 'rankingLabel': '历史累计访问',
    'metricKey': 'visits', 'metricLabel': '累计访问',
    'methodology': "对 Rolimon's 公开收录作品按累计访问次数排序取前 200。访问次数包含重复游玩，不等于独立玩家人数，也不代表平台全部作品覆盖。",
})
PLATFORMS['fortnite_alltime'].update({
    'sourceUrl': FORTNITE_URL + '?sort=minutes',
    'rankingKey': 'fortnitegg-creator-total-minutes-v1', 'rankingLabel': '累计游玩时长',
    'metricKey': 'minutes_played', 'metricLabel': '累计游玩分钟',
    'methodology': 'Fortnite.GG Minutes Played 顺序，排除官方模式；累计范围为来源站可追踪的历史，不声称覆盖创意模式上线以来的全部游玩。',
})
PLATFORMS['minecraft_alltime'].update({
    'rankingKey': 'modrinth-mod-downloads-no-library-v1', 'rankingLabel': '累计下载量',
    'methodology': 'Modrinth Java 单体模组累计下载前 200，排除 library 标签；包含工具和优化模组，不与 CurseForge 合并。下载次数包含更新和整合包分发，不等于独立玩家数。',
})
for _config in PLATFORMS.values():
    _config['rankingLimit'] = 200 if _config['boardType'] == 'alltime' else 100
    if _config['boardType'] == 'alltime':
        _config['rankingKey'] = _config['rankingKey'].removesuffix('-v1') + '-top200-v2'


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return ' '.join(''.join(child.text() if isinstance(child, Node) else child for child in self.children).split())

    def find_all(self, tag=None, class_name=None):
        result = []
        for child in self.children:
            if not isinstance(child, Node):
                continue
            if (tag is None or child.tag == tag) and (class_name is None or class_name in child.attrs.get('class', '').split()):
                result.append(child)
            result.extend(child.find_all(tag, class_name))
        return result


class Tree(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def numeric(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value if math.isfinite(value) and value >= 0 else None
    match = re.fullmatch(r'\s*([\d,]+(?:\.\d+)?)\s*([KMB]?)\s*', str(value), re.I)
    if not match:
        return None
    return round(float(match[1].replace(',', '')) * {'': 1, 'K': 1000, 'M': 1000000, 'B': 1000000000}[match[2].upper()])


def clean_text(value, limit=300):
    text = re.sub(r'\[/?[^\]]+\]', '', str(value or ''))
    text = re.sub(r'https?://\S+', '', text)
    return ' '.join(unescape(re.sub(r'<[^>]*>', '', text)).split())[:limit]


def request(url, headers=None):
    for attempt in range(3):
        try:
            req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html', **(headers or {})})
            with urlopen(req, timeout=30) as response:
                return response.read().decode('utf-8')
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except OSError:
            if attempt == 2:
                raise
        time.sleep(1 + attempt * 2)
    raise RuntimeError('Source did not respond')


def walk_json(value):
    if isinstance(value, str) and value.lstrip().startswith(('{', '[')):
        try:
            yield from walk_json(json.loads(value))
        except (ValueError, RecursionError):
            pass
    elif isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def parse_steam(source, alltime=False):
    match = re.search(r'<script[^>]*id=[\"\']valve-ssr-data[\"\'][^>]*>(.*?)</script>', source, re.S)
    if not match:
        raise ValueError('Steam SSR data unavailable; do not treat an HTML error page as a ranking')
    payload = json.loads(match[1])
    expected_sort = 'totaluniquesubscribers' if alltime else 'trend'
    query = next((item for item in walk_json(payload)
                  if isinstance(item.get('queryKey'), list) and item['queryKey'][0:1] == ['workshop_browse']
                  and len(item['queryKey']) > 1 and isinstance(item['queryKey'][1], dict)
                  and item['queryKey'][1].get('appid') == 730
                  and item['queryKey'][1].get('browse_sort') == expected_sort
                  and 'cs2' in {str(tag).lower() for tag in item['queryKey'][1].get('required_tags', [])}), None)
    if query is None:
        raise ValueError('Steam did not return the requested CS2 board and sort order')
    results = query.get('state', {}).get('data', {}).get('results')
    if not isinstance(results, list):
        raise ValueError('Steam ranking results are missing')
    entries, seen = [], set()
    for item in results:
        if 'publishedfileid' not in item or 'title' not in item:
            continue
        identifier = str(item['publishedfileid'])
        tags = [str(tag.get('display_name') or tag.get('tag', '')) for tag in item.get('tags', [])]
        normalized = {tag.lower() for tag in tags}
        if identifier in seen or int(item.get('consumer_appid', 0)) != 730 or not {'cs2', 'map'}.issubset(normalized):
            continue
        seen.add(identifier)
        entries.append({
            'id': identifier, 'title': clean_text(item['title'], 180),
            'url': 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + identifier,
            'creator': str(item.get('creator', '')), 'categories': [tag for tag in tags if tag.lower() not in ('cs2', 'map')],
            'summary': clean_text(item.get('short_description')), 'metricValue': numeric(item.get('lifetime_subscriptions' if alltime else 'subscriptions')),
            'publishedAt': datetime.fromtimestamp(item['time_created'], timezone.utc).isoformat() if item.get('time_created') else None,
        })
    return entries


def collect_steam(alltime=False):
    limit = 200 if alltime else 100
    params = {'appid': 730, 'section': 'readytouseitems', 'browsesort': 'totaluniquesubscribers' if alltime else 'trend', 'days': 7, 'requiredtags[]': 'CS2', 'numperpage': 30}
    entries, seen = [], set()
    for page in range(1, max(8, limit // 20 + 2)):
        rows = parse_steam(request(STEAM_URL + '?' + urlencode({**params, 'p': page})), alltime)
        if not rows:
            break
        for row in rows:
            if row['id'] not in seen:
                seen.add(row['id'])
                entries.append(row)
        if len(entries) >= limit:
            return entries[:limit]
    raise ValueError(f'Steam returned only {len(entries)} eligible unique maps')


def parse_roblox(source):
    tree = Tree(source).root
    entries, seen = [], set()
    for row in tree.find_all('tr'):
        cells = [child for child in row.children if isinstance(child, Node) and child.tag == 'td']
        if len(cells) < 3:
            continue
        link = next((link for link in cells[1].find_all('a') if re.match(r'/games/\d+/', link.attrs.get('href', ''))), None)
        if link is None:
            continue
        match = re.match(r'/games/(\d+)/', link.attrs['href'])
        identifier = match[1]
        if identifier in seen:
            continue
        spans = link.find_all('span', 'line-clamp-1')
        metric = numeric(cells[2].text())
        if not spans or metric is None:
            raise ValueError('Roblox leaderboard layout changed')
        seen.add(identifier)
        entries.append({'id': identifier, 'title': spans[0].text(), 'creator': spans[1].text() if len(spans) > 1 else '',
                        'url': urljoin(ROBLOX_URL, link.attrs['href']), 'categories': [], 'summary': '',
                        'metricValue': metric, 'publishedAt': None})
    if any(entries[i]['metricValue'] < entries[i + 1]['metricValue'] for i in range(len(entries) - 1)):
        raise ValueError('Roblox board is not sorted by players; retain previous snapshot')
    return entries[:100]


def collect_roblox():
    return parse_roblox(request(ROBLOX_URL))


def parse_rolimons(source, limit=200):
    match = re.search(r'\bvar\s+games\s*=\s*', source)
    if not match:
        raise ValueError("Rolimon's public games dataset unavailable")
    games, _ = json.JSONDecoder().raw_decode(source[match.end():])
    entries = []
    for identifier, item in games.items():
        metric = numeric(item.get('visits'))
        if metric is None:
            continue
        entries.append({'id': str(identifier), 'title': item['name'], 'creator': '',
                        'url': 'https://www.roblox.com/games/' + str(identifier),
                        'categories': [item['genre']] if item.get('genre') else [], 'summary': '',
                        'metricValue': metric, 'publishedAt': None})
    return sorted(entries, key=lambda row: (-row['metricValue'], row['id']))[:limit]


def collect_roblox_alltime():
    return parse_rolimons(request('https://www.rolimons.com/games'))


def parse_fortnite(source, alltime=False):
    entries = []
    for link in Tree(source).root.find_all('a', 'island'):
        match = re.fullmatch(r'/island/(\d{4}-\d{4}-\d{4})', link.attrs.get('href', ''))
        if not match:
            continue
        titles = link.find_all('h3', 'island-title')
        counts = [node for node in link.find_all(class_name='table-stat') if node.text().startswith('Minutes Played')] if alltime else link.find_all(class_name='ccu')
        if not titles or not counts:
            raise ValueError('Fortnite.GG island layout changed')
        metric = numeric(counts[0].text().replace('Minutes Played' if alltime else 'Players Now', '').strip())
        if metric is None:
            raise ValueError('Fortnite.GG player count unavailable')
        entries.append({'id': match[1], 'title': titles[0].text(), 'url': urljoin(FORTNITE_URL, link.attrs['href']),
                        'creator': '', 'categories': [], 'summary': '', 'metricValue': metric, 'publishedAt': None})
    return entries


def collect_fortnite(alltime=False):
    limit = 200 if alltime else 100
    entries, seen = [], set()
    for page in range(1, max(10, limit // 12 + 2)):
        rows = parse_fortnite(request(FORTNITE_URL + '?' + urlencode({'page': page, 'hideepic': 1, **({'sort': 'minutes'} if alltime else {})}),
                                      headers={'Cookie': 'fngg_hideepic=1'}), alltime)
        if not rows:
            break
        for row in rows:
            if row['id'] not in seen:
                seen.add(row['id'])
                entries.append(row)
        if len(entries) >= limit:
            # Pages are sampled sequentially: sort their observed CCU, keep stable IDs.
            return entries[:limit] if alltime else sorted(entries, key=lambda row: (-row['metricValue'], row['id']))[:limit]
    raise ValueError(f'Fortnite.GG returned only {len(entries)} community islands')


def modrinth_search_url(alltime=False, day=None, offset=0):
    facets = [['project_type:mod'], ['categories!=library']]
    if not alltime:
        target_day = date.fromisoformat(day) if day else datetime.now(CST).date()
        threshold = datetime.combine(target_day - timedelta(days=30), datetime.min.time(), CST)
        facets.append(['created_timestamp>=' + str(int(threshold.timestamp()))])
    query = urlencode({'index': 'downloads', 'limit': 100, 'offset': offset, 'facets': json.dumps(facets)})
    return MODRINTH_URL + '?' + query


def collect_minecraft(alltime=False):
    limit = 200 if alltime else 100
    hits = []
    # The official search API caps each response at 100 results.
    for offset in range(0, limit, 100):
        payload = json.loads(request(modrinth_search_url(alltime, offset=offset)))
        hits.extend(payload.get('hits', []))
    entries = []
    for item in hits:
        if item.get('project_type') != 'mod' or 'library' in item.get('categories', []):
            raise ValueError('Modrinth source scope changed')
        entries.append({'id': item['project_id'], 'title': item['title'], 'url': 'https://modrinth.com/mod/' + item['slug'],
                        'creator': item.get('organization') or item.get('author', ''),
                        'categories': [tag for tag in item.get('display_categories', []) if tag not in ('fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'rift')],
                        'summary': clean_text(item.get('description')), 'metricValue': numeric(item.get('downloads')),
                        'publishedAt': item.get('date_created')})
    return entries


def validate_entries(entries, expected=100):
    if not isinstance(entries, list) or len(entries) != expected:
        raise ValueError(f'Expected {expected} entries, received {len(entries) if isinstance(entries, list) else "invalid data"}')
    ids = set()
    for entry in entries:
        identifier = entry.get('id')
        if not isinstance(identifier, str) or not identifier or identifier in ids or not isinstance(entry.get('title'), str) or not entry['title'].strip():
            raise ValueError('Duplicate IDs or missing title/ID')
        parsed = urlparse(entry.get('url', ''))
        if parsed.scheme != 'https' or not parsed.hostname:
            raise ValueError('Source URL must use HTTPS')
        if entry.get('metricValue') is not None and numeric(entry['metricValue']) is None:
            raise ValueError('Invalid metric')
        ids.add(identifier)


def is_comparable(snapshot, ranking_key, expected=100):
    if not snapshot or snapshot.get('rankingKey') != ranking_key or len(snapshot.get('entries', [])) != expected:
        return False
    return snapshot.get('complete') is True


def enrich_snapshot(platform_id, entries, day, collected_at, history):
    """Pure daily comparison; never infer ranks beyond the observed board."""
    config = dict(PLATFORMS[platform_id])
    validate_entries(entries, config['rankingLimit'])
    if config['platformId'] == 'minecraft':
        config['sourceName'] = 'Modrinth 官方 API'
        config['sourceUrl'] = modrinth_search_url(config['boardType'] == 'alltime', day)
    day_value = date.fromisoformat(day)
    prior = sorted([(key, value['platforms'].get(platform_id)) for key, value in history.items() if key < day
                    and is_comparable(value.get('platforms', {}).get(platform_id), config['rankingKey'], config['rankingLimit'])])
    baseline_date, baseline = prior[-1] if prior else (None, None)
    baseline_days = (day_value - date.fromisoformat(baseline_date)).days if baseline_date else None
    previous = {entry['id']: entry for entry in baseline['entries']} if baseline else {}
    week_day = (day_value - timedelta(days=7)).isoformat()
    week_snapshot = history.get(week_day, {}).get('platforms', {}).get(platform_id)
    week = {entry['id']: entry for entry in week_snapshot['entries']} if is_comparable(week_snapshot, config['rankingKey'], config['rankingLimit']) else {}
    seen_before = {}
    for historic_day, snapshot in prior:
        for entry in snapshot['entries']:
            seen_before[entry['id']] = entry
    trend_days = [(day_value - timedelta(days=offset)).isoformat() for offset in range(7, -1, -1)]
    trend_lookups = {}
    for key in trend_days[:-1]:
        snapshot = history.get(key, {}).get('platforms', {}).get(platform_id)
        trend_lookups[key] = {entry['id']: entry['rank'] for entry in snapshot['entries']} if is_comparable(snapshot, config['rankingKey'], config['rankingLimit']) else {}
    enriched = []
    for rank, raw in enumerate(entries, 1):
        item = dict(raw)
        before, older = previous.get(item['id']), seen_before.get(item['id'])
        new_entry = bool(baseline and before is None)
        rank_delta = before['rank'] - rank if before else None
        week_entry = week.get(item['id'])
        week_delta = week_entry['rank'] - rank if week_entry else None
        old_metric = before.get('metricValue') if before else None
        value = item.get('metricValue')
        metric_delta = value - old_metric if isinstance(value, (int, float)) and isinstance(old_metric, (int, float)) else None
        growth = round(metric_delta / old_metric * 100, 2) if metric_delta is not None and old_metric > 0 else None
        entered_at = day if new_entry else older.get('enteredAt') if older else None
        recent = bool(entered_at and 0 <= (day_value - date.fromisoformat(entered_at)).days <= 6)
        strong_reasons = []
        if new_entry and rank <= 20 and baseline_days == 1:
            strong_reasons.append('新入榜即进入前 20')
        if recent and rank_delta is not None and rank_delta >= 10 and baseline_days == 1:
            strong_reasons.append(f'一天上升 {rank_delta} 名')
        if recent and week_delta is not None and week_delta >= 20:
            strong_reasons.append(f'7 天上升 {week_delta} 名')
        if recent and growth is not None and growth >= 25 and baseline_days == 1:
            strong_reasons.append(f'{config["metricLabel"]}日增 {growth:g}%')
        item.update({'rank': rank, 'previousRank': before['rank'] if before else None, 'rankDelta': rank_delta,
                     'rankDelta7d': week_delta, 'metricDelta': metric_delta, 'metricGrowthPct': growth,
                     'firstSeenAt': older.get('firstSeenAt', day) if older else day, 'enteredAt': entered_at,
                     'isNewEntry': new_entry, 'isReturning': new_entry and older is not None,
                     'isStrongNewEntry': bool(strong_reasons), 'strongReasons': strong_reasons,
                     'rankHistory': [{'date': key, 'rank': rank if key == day else trend_lookups[key].get(item['id'])} for key in trend_days]})
        enriched.append(item)
    risers = sorted([row for row in enriched if (row['rankDelta'] or 0) > 0], key=lambda row: (-row['rankDelta'], row['rank']))
    strong = sorted([row for row in enriched if row['isStrongNewEntry']], key=lambda row: row['rank'])
    newcomers = [row for row in enriched if row['isNewEntry']]
    return {**config, 'id': platform_id, 'date': day, 'collectedAt': collected_at, 'complete': True, 'status': 'ok',
            'comparisonDate': baseline_date, 'comparisonDays': baseline_days, 'isBaseline': baseline is None,
            'entries': enriched, 'highlights': {'risers': [row['id'] for row in risers[:6]],
                                             'newEntries': [row['id'] for row in newcomers[:6]],
                                             'strongNewEntries': [row['id'] for row in strong[:6]]},
            'counts': {'total': len(enriched), 'risers': len(risers), 'newEntries': len(newcomers), 'strongNewEntries': len(strong)}}


def read_json(path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8-sig'))


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


@contextmanager
def sync_lock(folder):
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder / '.sync.lock'
    if lock.exists() and time.time() - lock.stat().st_mtime > 3600:
        lock.unlink()
    try:
        handle = lock.open('x', encoding='utf-8')
    except FileExistsError:
        raise RuntimeError('Another UGC sync is running; try again after it finishes') from None
    with handle:
        handle.write(str(os.getpid()))
    try:
        yield
    finally:
        lock.unlink(missing_ok=True)


def publish(root, fetched, errors, day, collected_at, selected=None):
    folder = root / 'data' / 'ugc'
    history = {}
    for path in sorted((folder / 'history').glob('????-??-??.json')):
        history[path.stem] = read_json(path)
    previous_latest = read_json(folder / 'latest.json', {'platforms': {}})
    today = history.get(day, {'schemaVersion': 1, 'date': day, 'platforms': {}})
    platforms = {}
    for key, config in PLATFORMS.items():
        old = previous_latest.get('platforms', {}).get(key)
        if selected is not None and key not in selected and old:
            platforms[key] = old
            continue
        if key in fetched:
            snapshot = enrich_snapshot(key, fetched[key], day, collected_at, history)
            platforms[key] = snapshot
            today['platforms'][key] = snapshot
        else:
            platforms[key] = {**(old or config), 'id': key, 'status': 'stale' if old and old.get('complete') else 'unavailable',
                              'error': errors.get(key, '未执行本来源采集'), 'lastAttemptAt': collected_at,
                              'entries': old.get('entries', []) if old else []}
    if fetched:
        today['generatedAt'] = collected_at
        atomic_json(folder / 'history' / (day + '.json'), today)
        history[day] = today
    latest = {'schemaVersion': 1, 'generatedAt': collected_at, 'timezone': 'Asia/Shanghai',
              'scheduleLabel': '每天 09:00 · 北京时间', 'platforms': platforms,
              'runStatus': 'ok' if all(p['status'] == 'ok' for p in platforms.values()) else
                           'partial' if any(p['status'] == 'ok' for p in platforms.values()) else 'failed'}
    atomic_json(folder / 'latest.json', latest)
    index = {'schemaVersion': 1, 'generatedAt': collected_at, 'dates': [
        {'date': key, 'platforms': list(value['platforms']), 'counts': {p: len(s['entries']) for p, s in value['platforms'].items()}}
        for key, value in sorted(history.items(), reverse=True)]}
    atomic_json(folder / 'index.json', index)
    chinese = read_json(folder / 'chinese.json', {'entries': {}}).get('entries', {})
    platform_labels = {'cs2': 'CS2 创意工坊', 'roblox': '罗布乐思', 'fortnite': '堡垒之夜社区', 'minecraft': '我的世界模组'}
    report = ['# UGC 每日榜单 · ' + day, '', '采集时间：' + collected_at, '',
              '各平台独立比较。首日建立基线；新入榜不代表作品刚发布。', '']
    for key, snapshot in platforms.items():
        label = platform_labels[snapshot['platformId']] + ' · ' + snapshot['boardLabel']
        status = {'ok': '正常', 'stale': '沿用上次成功数据', 'unavailable': '来源不可用'}[snapshot['status']]
        report.extend(['## ' + label, '', f'状态：{status}；来源：{snapshot["sourceUrl"]}', ''])
        if key in errors or not snapshot.get('complete'):
            report.extend(['采集失败：' + errors.get(key, '尚无完整快照'), ''])
            continue
        report.extend(['对比日期：' + (snapshot.get('comparisonDate') or '首日基线'), ''])
        lookup = {row['id']: row for row in snapshot['entries']}
        for title, ids in [('上涨', snapshot['highlights']['risers']), ('近期强势新进榜', snapshot['highlights']['strongNewEntries'])]:
            report.append('### ' + title)
            report.append('')
            for identifier in ids[:5]:
                row = lookup[identifier]
                reason = '；'.join(row['strongReasons']) or f'上升 {row["rankDelta"]} 名'
                translated = chinese.get(snapshot['platformId'] + ':' + identifier, {})
                title = translated.get('title', '待整理新作品')
                report.append(f'- #{row["rank"]} [{title}]({row["url"]})：{reason}')
            if not ids:
                report.append('首日尚无对比数据。' if snapshot['isBaseline'] else '本次没有符合条件的条目。')
            report.append('')
    report_path = root / 'docs' / 'ugc-daily' / (day + '.md')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text('\n'.join(report).rstrip() + '\n', encoding='utf-8')
    return latest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--import-json', type=Path, help='Import a verified source payload when a connector was needed; same schema and validation apply')
    parser.add_argument('--boards', nargs='+', choices=list(PLATFORMS), help='Refresh only these boards; preserve all other snapshots and timestamps')
    args = parser.parse_args(argv)
    now = datetime.now(timezone.utc)
    day, collected_at = now.astimezone(CST).date().isoformat(), now.isoformat(timespec='seconds')
    fetched, errors = {}, {}
    selected = set(args.boards or PLATFORMS)
    collectors = {'cs2': collect_steam, 'roblox': collect_roblox, 'fortnite': collect_fortnite, 'minecraft': collect_minecraft,
                  'cs2_alltime': lambda: collect_steam(True), 'roblox_alltime': collect_roblox_alltime,
                  'fortnite_alltime': lambda: collect_fortnite(True), 'minecraft_alltime': lambda: collect_minecraft(True)}
    with sync_lock(args.root / 'data' / 'ugc'):
        if args.import_json:
            imported = read_json(args.import_json)
            if imported.get('date') != day:
                raise ValueError('Imported data must be from today; cached history cannot be relabeled as current')
            for key, payload in imported.get('platforms', {}).items():
                if key not in selected or payload.get('rankingKey') != PLATFORMS[key]['rankingKey'] or not payload.get('sourceUrl'):
                    raise ValueError('Imported source/ranking scope does not match')
                validate_entries(payload['entries'], PLATFORMS[key]['rankingLimit'])
                fetched[key] = payload['entries']
        else:
            with ThreadPoolExecutor(max_workers=4) as pool:
                jobs = {pool.submit(collector): key for key, collector in collectors.items() if key in selected}
                for job in as_completed(jobs):
                    key = jobs[job]
                    try:
                        entries = job.result()
                        validate_entries(entries, PLATFORMS[key]['rankingLimit'])
                        fetched[key] = entries
                        print(f'{key}: {len(entries)} verified entries', flush=True)
                    except Exception as error:
                        errors[key] = f'{type(error).__name__}: {error}'
                        print(f'{key}: {errors[key]}', file=sys.stderr, flush=True)
        result = publish(args.root, fetched, errors, day, collected_at, selected)
    print(json.dumps({'date': day, 'status': result['runStatus'], 'counts': {key: len(value['entries']) for key, value in result['platforms'].items()}}, ensure_ascii=True))
    return 0 if len(fetched) == len(selected) else 2


if __name__ == '__main__':
    raise SystemExit(main())
