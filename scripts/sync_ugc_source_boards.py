"""Capture the public sorting dimensions of the UGC sources."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

from build_ugc_categories import CATEGORIES, classify
from sync_ugc import CST, FORTNITE_URL, MODRINTH_URL, ROOT, STEAM_URL, USER_AGENT, Node, Tree, atomic_json, clean_text, read_json, sync_lock, walk_json
from ugc_cover_records import apply_source_covers, cover_url, modrinth_cover


LIMIT = 100
STAT = 'https://statroblox.com/leaderboards/'
ROLIMONS = 'https://www.rolimons.com/games'
STEAM_CHINA = 'https://my.steamchina.com/workshop/browse/'
PLATFORMS = ('roblox', 'fortnite', 'cs2', 'minecraft')
STAT_COLUMNS = {
    'Earning chart': ('chart', '近 7 日 Robux 消费名次', 'rank'),
    'Playing': ('ccu', '同时在线', 'count'), '24h': ('change24h', '在线 24 小时变化', 'percent'),
    '7d': ('change7d', '周均在线环比', 'percent'), 'Likes': ('likes', '好评率', 'percent'),
    'Visits': ('visits', '累计访问', 'count'), 'Favorites': ('favorites', '累计收藏', 'count'),
    'Playtime 30d': ('hours', '30 日游玩小时（估算）', 'count'),
    'Momentum': ('momentum', '人气走势', 'text'), 'Breakout': ('breakout', '爆发分', 'score'),
}
STAT_OMITTED_COLUMNS = {'Revenue 30d'}
STAT_BOARDS = {
    'chart': ('Robux 消费榜', '沿用 Roblox 官方近 7 日 Robux 消费顺序。', 'chart'),
    'engagement': ('30 日游玩时长榜', 'StatRoblox 估算的最近 30 日游玩总小时数。', 'hours'),
    'playing': ('同时在线榜', '按最近一次源站快照的同时在线人数排列。', 'ccu'),
    'new-rising': ('新作上升榜', '过去 180 日内发布，符合源站增长条件的作品。', 'ccu'),
    'established': ('长青作品榜', '至少发布两年，稳定在线规模超过 1,000 人的作品。', 'ccu'),
    'trending': ('24 小时趋势榜', '在达到 500 人在线门槛的作品中，按源站 24 小时在线涨幅排列。', 'change24h'),
    'breakout': ('爆发分榜', '源站综合在线增长、访问速度、收藏率、作品年龄和作者历史的评分。', 'breakout'),
    'gainers': ('周涨幅榜', '本周平均在线至少 500 人，按相较上周的在线增长百分比排列。', 'change7d'),
    'losers': ('周跌幅榜', '上周平均在线至少 500 人，按相较上周的在线下跌百分比排列。', 'change7d'),
}
FORT_COLUMNS = {
    'Players Now': ('ccu', '同时在线', 'count'), 'All-Time Peak': ('peak', '历史在线峰值', 'count'),
    'Minutes Played': ('minutes', '累计游玩分钟', 'count'), 'Like Rate': ('likes', '好评率', 'percent'),
    '24h Plays': ('plays', '24 小时开局次数', 'count'), '24h Favorites': ('favorites', '24 小时收藏', 'count'),
    '24h Recommends': ('recommends', '24 小时推荐', 'count'), '24h Players': ('players', '24 小时玩家数', 'count'),
    '24h Avg Playtime': ('avgplaytime', '24 小时平均游玩分钟', 'score'),
    '24h Retention': ('retention', '24 小时留存率', 'percent'),
}
FORT_BOARDS = {
    'players-now': ('同时在线', 'ccu'), 'peak': ('历史在线峰值', 'peak'), 'minutes': ('累计游玩分钟', 'minutes'),
    'totalfavorites': ('累计收藏', None), 'likes': ('好评率', 'likes'), 'plays': ('24 小时开局', 'plays'),
    'favorites': ('24 小时收藏', 'favorites'), 'recommends': ('24 小时推荐', 'recommends'),
    'players': ('24 小时玩家数', 'players'), 'avgplaytime': ('24 小时平均游玩时长', 'avgplaytime'),
    'retention': ('24 小时留存率', 'retention'), 'newest': ('最新发布', None), 'oldest': ('最早发布', None),
}
ROLIMONS_COLUMNS = (
    ('ccu', '同时在线', 'count'), ('visits', '累计访问', 'count'), ('votes', '总投票', 'count'),
    ('likes', '好评率', 'percent'), ('upvotes', '点赞票数', 'count'), ('downvotes', '点踩票数', 'count'),
    ('favorites', '累计收藏', 'count'),
)
ROLIMONS_BOARDS = {
    'playing': ('同时在线', 'ccu', True), 'visits': ('累计访问', 'visits', True),
    'votes': ('总投票', 'votes', True), 'rating': ('最高好评率', 'likes', True),
    'favorites': ('累计收藏', 'favorites', True), 'upvotes': ('点赞票数', 'upvotes', True),
    'downvotes': ('点踩票数', 'downvotes', True), 'name-asc': ('名称升序', None, False),
    'name-desc': ('名称降序', None, True),
}
MOD_COLUMNS = (
    ('downloads', '累计下载', 'count'), ('follows', '关注人数', 'count'),
    ('created', '发布时间', 'date'), ('updated', '更新时间', 'date'),
    ('loaders', '加载器', 'text'), ('versions', '兼容游戏版本', 'text'),
    ('environment', '运行环境', 'text'), ('license', '许可证', 'text'),
)
MOD_BOARDS = {
    'downloads': ('累计下载', 'downloads'), 'follows': ('关注人数', 'follows'),
    'newest': ('最新发布', 'created'), 'updated': ('最近更新', 'updated'), 'relevance': ('默认发现顺序', None),
}
STEAM_COLUMNS = (
    ('current', '当前订阅', 'count'), ('lifetime', '历史总订阅', 'count'),
    ('favorites', '当前收藏', 'count'), ('lifetimeFavorites', '历史总收藏', 'count'),
    ('views', '浏览量', 'count'), ('stars', '工坊星级（0–5）', 'score'), ('votes', '总投票', 'count'), ('score', '投票分（0–1）', 'score'),
    ('upvotes', '点赞票数', 'count'), ('downvotes', '点踩票数', 'count'),
    ('created', '发布时间', 'date'), ('updated', '更新时间', 'date'),
)
STEAM_BOARDS = {
    'trend-day': ('当天热门', 'trend', 1, 'current'), 'trend-week': ('近 7 天热门', 'trend', 7, 'current'),
    'trend-month': ('近 30 天热门', 'trend', 30, 'current'), 'trend-90': ('近 90 天热门', 'trend', 90, 'current'),
    'trend-180': ('近 180 天热门', 'trend', 180, 'current'), 'trend-year': ('近一年热门', 'trend', 365, 'current'),
    'subscribed': ('历史总订阅', 'totaluniquesubscribers', None, 'lifetime'),
    'toprated': ('历史最高评分', 'toprated', None, 'stars'), 'recent': ('最新发布', 'mostrecent', None, 'created'),
    'updated': ('最近更新', 'lastupdated', None, 'updated'),
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def download(url):
    req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html, application/json'})
    with urlopen(req, timeout=15) as response:
        return response.read().decode('utf-8')


def public_value(value, kind):
    if value in (None, '', '—', '-', 'Pro'):
        return None
    if kind in ('text', 'date'):
        return str(value)
    match = re.fullmatch(r'([+−-]?[\d,]+(?:\.\d+)?)\s*([KMBT])?\s*(?:%|h)?', str(value).strip().lstrip('#'), re.I)
    if not match:
        return None
    raw, factor = match.groups()
    number = Decimal(raw.replace(',', '').replace('−', '-')) * {'': 1, 'K': 1000, 'M': 10**6, 'B': 10**9, 'T': 10**12}[(factor or '').upper()]
    return int(number) if number == number.to_integral_value() else float(number)


def image_url(value, base=''):
    return cover_url(urljoin(base, value)) if value else ''


def row(identifier, title, url, *, creator='', cover='', tags=(), values=None):
    return {'id': str(identifier), 'title': title.strip(), 'url': url, 'creator': creator, 'cover': cover,
            'tags': list(filter(None, tags)), 'values': values or {}}


def board(identifier, source, label, url, note, metric, columns, *, rows=None, captured=None, expected=LIMIT, status=None):
    rows = rows or []
    for rank, item in enumerate(rows, 1):
        item.setdefault('rank', rank)
    cols = sorted(columns, key=lambda col: col[0] != metric)
    state = status or ('ok' if len(rows) >= expected else 'partial' if rows else 'unavailable')
    return {'id': identifier, 'source': source, 'label': label, 'sourceUrl': url, 'note': note,
            'metric': metric, 'columns': [{'id': key, 'label': name, 'kind': kind} for key, name, kind in cols],
            'status': state, 'capturedAt': captured if rows else None, 'expectedCount': expected, 'rows': rows}


def parse_statroblox(payload):
    tree = Tree(payload).root
    table = next((t for t in tree.find_all('table') if t.find_all('thead')), None)
    if table is None:
        raise ValueError('Public leaderboard table is missing')
    headers = [n.text() for n in table.find_all('thead')[0].find_all('th')]
    if headers[:2] != ['#', 'Game'] or any(h not in STAT_COLUMNS and h not in STAT_OMITTED_COLUMNS for h in headers[2:]):
        raise ValueError(f'StatRoblox changed its table fields: {headers}')
    fields = [(index, STAT_COLUMNS[heading]) for index, heading in enumerate(headers) if heading in STAT_COLUMNS]
    rows = []
    for tr in table.find_all('tbody')[0].find_all('tr'):
        cells = [n for n in tr.children if isinstance(n, Node) and n.tag == 'td']
        if len(cells) != len(headers):
            raise ValueError('StatRoblox returned an unexpected row layout')
        link = next((a for a in cells[1].find_all('a') if re.fullmatch(r'/games/\d+/[^/]+', a.attrs.get('href', ''))), None)
        if not link or cells[0].text() != str(len(rows) + 1):
            raise ValueError('StatRoblox returned an unexpected work URL or rank')
        title, *authors = [s.text() for s in link.find_all('span', 'line-clamp-1')]
        value = {key: public_value(cells[index].text(), kind) for index, (key, _, kind) in fields}
        covers = link.find_all('img')
        href = link.attrs['href']
        rows.append(row(href.split('/')[2], title, urljoin(STAT, href), creator=authors[0] if authors else '',
                        cover=image_url(covers[0].attrs.get('src'), STAT) if covers else '', values=value))
    if len({r['id'] for r in rows}) != len(rows) or len(rows) != LIMIT:
        raise ValueError(f'StatRoblox returned {len(rows)} rows rather than a complete public Top {LIMIT}')
    return [column for _, column in fields], rows


def statroblox_board(key, config):
    name, note, metric = config
    url = STAT + key
    cols, rows = parse_statroblox(download(url))
    if metric not in {c[0] for c in cols}:
        raise ValueError('StatRoblox sorting dimension missing')
    return board('statroblox-' + key, 'StatRoblox', name, url, note, metric, cols, rows=rows, captured=now())


def rolimons_boards():
    source = download(ROLIMONS)
    match = re.search(r'\bvar\s+games\s*=\s*', source)
    if not match:
        raise ValueError("Rolimon's public experience catalog missing")
    games = json.JSONDecoder().raw_decode(source[match.end():])[0]
    if len(games) < LIMIT:
        raise ValueError("Rolimon’s public experience catalog is incomplete")
    rows = []
    for identifier, item in games.items():
        up, down = item['upvotes'], item['downvotes']
        votes = up + down
        values = {'ccu': item['players'], 'visits': item['visits'], 'votes': votes,
                  'likes': 100 * up / votes if votes else 0,
                  'upvotes': up, 'downvotes': down, 'favorites': item['favorites']}
        title = item['name'].strip()
        if title and re.fullmatch(r'\d+', identifier):
            rows.append(row(identifier, title, 'https://www.rolimons.com/game/' + identifier, cover=image_url(item['icon_url']),
                            tags=[item['genre']], values=values))
    captured = now()
    for key, (name, metric, desc) in ROLIMONS_BOARDS.items():
        ordered = sorted(rows, key=lambda r: (r['values'][metric] if metric else r['title'].encode('utf-16-be', 'surrogatepass'), int(r['id'])), reverse=desc)
        yield board('rolimons-' + key, 'Rolimon’s', name, ROLIMONS, f'从来源收录的 {len(rows):,} 款作品排序。好评率为点赞票数除以总投票，未设置最少票数门槛。',
                    metric, ROLIMONS_COLUMNS, rows=[dict(r) for r in ordered[:LIMIT]], captured=captured)


def fortnite_url(key, page=None):
    params = {'hideepic': 1}
    if key != 'players-now':
        params['sort'] = key
    if page:
        params['page'] = page
    return FORTNITE_URL + '?' + urlencode(params)


def fortnite_html(html, url):
    tree = Tree(html).root
    rows = []
    for link in tree.find_all('a', 'island'):
        title = link.find_all('h3', 'island-title')
        rank = link.find_all(class_name='rank')
        containers = link.find_all(class_name='column-2')
        if not title or not rank or not containers:
            raise ValueError('Fortnite.GG island table changed')
        values = {}
        for node in containers[0].children:
            if isinstance(node, Node) and node.find_all('span'):
                label = node.find_all('span')[0].text()
                values[label] = node.text().removeprefix(label).strip()
        images = link.find_all('img')
        cover = images[0].attrs.get('src') if images else None
        rows.append([link.attrs.get('href', '').rsplit('/', 1)[-1], rank[0].text(), title[0].text(), cover,
                     *(values.get(field) for field in FORT_COLUMNS)])
    return {'url': url, 'capturedAt': now(), 'rows': rows}


def fortnite_board(key, config, imported=None):
    label, metric = config
    fields = list(FORT_COLUMNS)
    url = fortnite_url(key)
    if imported:
        fields = imported['fields']
        pages = imported['boards'][key]
    else:
        pages = []
        for page in range(1, 6):
            page_url = fortnite_url(key, page)
            pages.append(fortnite_html(download(page_url), page_url))
            if sum(len(page['rows']) for page in pages) >= LIMIT + 12:
                break
    cols = list(FORT_COLUMNS.values())
    rows, ids = [], set()
    timestamps = [datetime.fromisoformat(page['capturedAt']) for page in pages]
    if any(t.tzinfo is None for t in timestamps) or timestamps != sorted(timestamps) or timestamps[-1] > datetime.now(timezone.utc):
        raise ValueError('Fortnite.GG capture timestamps are missing or out of order')
    start = timestamps[0].isoformat(timespec='seconds')
    for page_no, page in enumerate(pages, 1):
        page_url = urlparse(page['url'])
        query = parse_qs(page_url.query)
        if page_url.scheme != 'https' or page_url.netloc != 'fortnite.gg' or page_url.path != '/creative' or query.get('hideepic') != ['1'] or query.get('sort', ['players-now']) != [key] or query.get('page', ['1']) != [str(page_no)]:
            raise ValueError('Fortnite.GG source, page, or ranking differs from its requested scope')
        for identifier, rank, title, cover, *values in page['rows']:
            if not re.fullmatch(r'\d{4}-\d{4}-\d{4}', identifier) or identifier in ids or not str(rank).isdigit():
                continue
            stats = {column[0]: public_value(value, column[2]) for field, value in zip(fields, values) if (column := FORT_COLUMNS.get(field))}
            item = row(identifier, title, urljoin(url, '/island/' + identifier), cover=image_url(cover, url), values=stats)
            item['rank'] = int(rank)
            rows.append(item)
            ids.add(identifier)
    if len(rows) < LIMIT:
        raise ValueError(f'Only {len(rows)} eligible Fortnite.GG islands')
    note = 'Fortnite.GG 社区岛公开排序。数字岛屿代码用于排除 Epic 官方模式。翻页之间存在短暂时间差，缩写读数为近似值。'
    if metric is None:
        note += '源榜列表提供这一维度的排名，作品表仍展示源站公开统计列。'
    return board('fortnitegg-' + key, 'Fortnite.GG', label, url, note, metric, cols, rows=rows[:LIMIT], captured=start)


def modrinth_board(key, config):
    label, metric = config
    facets = json.dumps([['project_type:mod'], ['categories!=library']])
    url = MODRINTH_URL + '?' + urlencode({'index': key, 'limit': LIMIT, 'facets': facets})
    hits = json.loads(download(url))['hits']
    rows = []
    loaders = {'fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'rift', 'babric', 'ornithe', 'modloader', 'legacy-fabric'}
    for item in hits:
        if item['project_type'] != 'mod' or 'library' in item['categories']:
            raise ValueError('Modrinth changed the Java single-mod scope')
        tags = item['categories']
        values = {'downloads': item['downloads'], 'follows': item['follows'], 'created': item['date_created'],
                  'updated': item['date_modified'], 'loaders': ', '.join(sorted(loaders.intersection(tags))),
                  'versions': ', '.join(item.get('versions') or []), 'environment': item.get('environment'),
                  'license': item.get('license')}
        cover, cover_kind = modrinth_cover(item)
        entry = row(item['project_id'], item['title'], 'https://modrinth.com/mod/' + item['slug'],
                    creator=item.get('organization') or item['author'], cover=cover or '',
                    tags=[tag for tag in tags if tag not in loaders], values=values)
        if cover_kind:
            entry['coverKind'] = cover_kind
        rows.append(entry)
    if len(rows) != LIMIT or len({r['id'] for r in rows}) != LIMIT:
        raise ValueError('Modrinth response did not contain the complete unique Top 100')
    note = 'Modrinth 官方 Search API。收录 Java 单体模组并排除 library 前置库。'
    if key == 'relevance':
        note += '保留空关键词的默认发现顺序。'
    return board('modrinth-' + key, 'Modrinth', label, url, note, metric, MOD_COLUMNS, rows=rows, captured=now())


def steam_url(sort, days=None, page=None, *, base=STEAM_URL):
    params = {'appid': 730, 'section': 'readytouseitems', 'browsesort': sort, 'requiredtags[]': 'CS2', 'numperpage': 30}
    if days:
        params['days'] = days
    if page:
        params['p'] = page
    return base + '?' + urlencode(params)


def steam_timestamp(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if timestamp else None


def steam_rows(html, sort, days=None, *, page=None, base=STEAM_URL):
    script = re.search(r'<script[^>]*id=["\']valve-ssr-data["\'][^>]*>(.*?)</script>', html, re.S)
    if not script:
        raise ValueError('Steam public workshop payload unavailable')
    for data in walk_json(json.loads(script[1])):
        query = data.get('queryKey')
        if not isinstance(query, list) or len(query) < 2 or query[0] != 'workshop_browse' or not isinstance(query[1], dict):
            continue
        params = query[1]
        if (params.get('appid') != 730 or params.get('section') != 'readytouseitems' or params.get('browse_sort') != sort
                or 'cs2' not in {tag.lower() for tag in params.get('required_tags', [])}):
            continue
        if page is not None and params.get('page') != page:
            continue
        day_value = params.get('days') or params.get('days_to_trend') or params.get('trend_days')
        if days is not None and int(day_value or 0) != days:
            continue
        items = data['state']['data']['results']
        break
    else:
        raise ValueError('Steam did not return the requested CS2 ranking')
    for item in items:
        tags = [t.get('display_name') or t.get('tag', '') for t in item.get('tags', [])]
        if str(item.get('consumer_appid')) != '730' or not {'map', 'cs2'}.issubset({t.lower() for t in tags}):
            continue
        identifier = item['publishedfileid']
        vote = item.get('vote_data') or {}
        counts = {'current': 'subscriptions', 'lifetime': 'lifetime_subscriptions', 'favorites': 'favorited',
                  'lifetimeFavorites': 'lifetime_favorited', 'views': 'views', 'votes': 'total_votes', 'stars': 'star_rating'}
        values = {**{key: public_value(item.get(field), 'count') for key, field in counts.items()},
                  'score': public_value(vote.get('score'), 'score'), 'upvotes': public_value(vote.get('votes_up'), 'count'),
                  'downvotes': public_value(vote.get('votes_down'), 'count'),
                  'created': steam_timestamp(item.get('time_created')), 'updated': steam_timestamp(item.get('time_updated'))}
        yield row(identifier, clean_text(item['title'], 180), urljoin(base, '/sharedfiles/filedetails/?id=' + str(identifier)),
                  creator=str(item.get('creator') or ''), cover=image_url(item.get('preview_url') or next((p.get('url') for p in item.get('previews', []) if p.get('url')), None)),
                  tags=[t for t in tags if t.lower() not in ('map', 'cs2')], values=values)


def steam_board(key, config):
    title, sort, days, metric = config
    regional = key not in ('trend-week', 'subscribed')
    base = STEAM_CHINA if regional else STEAM_URL
    source = '蒸汽平台创意工坊' if regional else 'Steam 国际站创意工坊'
    url = steam_url(sort, days, base=base)
    rows = {}
    for page in range(1, 9):
        for item in steam_rows(download(steam_url(sort, days, page, base=base)), sort, days, page=page, base=base):
            rows.setdefault(item['id'], item)
        if len(rows) >= LIMIT:
            break
    if len(rows) < LIMIT:
        raise ValueError(f'Steam returned only {len(rows)} eligible unique maps')
    note = '来自' + source + '的公开排序，仅收录同时标记 CS2 与地图的作品。'
    if regional:
        note += '排名覆盖蒸汽平台可见的地图。'
    if sort == 'trend':
        note += '订阅量是辅助读数，Steam 热门排序分数由源站决定。'
    if sort == 'toprated':
        note += '表格列出源站公开星级和投票数，名次沿用源站。'
    items = list(rows.values())[:LIMIT]
    columns = [column for column in STEAM_COLUMNS if any(item['values'].get(column[0]) is not None for item in items)]
    return board('steam-' + key, source, title, url, note, metric, columns, rows=items, captured=now())


def saved_steam_boards(folder):
    existing = read_json(folder / 'latest.json', {}).get('platforms', {})
    covers = read_json(folder / 'catalog/board-covers.json', {}).get('entries', {})
    creators = read_json(folder / 'creators.json', {}).get('entries', {})
    for key, old_id in [('trend-week', 'cs2'), ('subscribed', 'cs2_alltime')]:
        old = existing.get(old_id, {})
        if not old.get('complete'):
            continue
        title, sort, days, metric = STEAM_BOARDS[key]
        rows = [row(r['id'], r['title'], r['url'], creator=creators.get('cs2:' + r['id'], {}).get('name') or r.get('creator', ''),
                    cover=image_url(covers.get('cs2:' + r['id'], {}).get('url')), tags=r.get('categories') or (),
                    values={metric: r['metricValue'], 'created': r.get('publishedAt')}) for r in old['entries'][:LIMIT]]
        yield board('steam-' + key, 'Steam 国际站创意工坊', title, steam_url(sort, days), '沿用本站已有的 Steam 国际站同口径快照。', metric,
                    [c for c in STEAM_COLUMNS if c[0] in (metric, 'created')], rows=rows, captured=old['collectedAt'], status=old['status'])


def catalog_steam_boards(folder):
    catalog = read_json(folder / 'catalog-cache/cs2.json', {})
    source = read_json(folder / 'catalog/manifest.json', {}).get('platforms', {}).get('cs2', {})
    rows = list(catalog.get('entries', {}).values())
    if not rows or not catalog.get('lastSuccessfulAt'):
        return
    for key, label, dimension in [('catalog-subscriptions', '已收录地图 · 订阅量', 'metricValue'), ('catalog-newest', '已收录地图 · 发布日期', 'createdAt')]:
        available = [r for r in rows if r.get(dimension) is not None]
        items = []
        for r in sorted(available, key=lambda record: (record[dimension], record['id']), reverse=True)[:LIMIT]:
            items.append(row(r['id'], r['originalTitle'], r['url'], creator=r.get('creator') or '', tags=r.get('categories') or (),
                             cover=image_url(r.get('image', {}).get('url')),
                             values={'lifetime': r.get('metricValue'), 'created': r.get('createdAt'), 'observed': r.get('lastObservedAt')}))
        metric = 'lifetime' if dimension == 'metricValue' else 'created'
        yield board('steam-' + key, 'Steam 地图目录快照', label, source.get('sourceUrl') or steam_url('totaluniquesubscribers'),
                    f'在本站已收录的 {len(rows):,} 张地图中排序。各作品分批采集，可按“记录核对日期”查看时间。', metric,
                    [('lifetime', '目录最后记录的历史总订阅', 'count'), ('created', '发布时间', 'date'), ('observed', '记录核对日期', 'date')],
                    rows=items, captured=catalog['lastSuccessfulAt'])


def enrich_cs2_intros(folder, boards, translations):
    supplemental = read_json(folder / 'cs2-source-board-intros.json', {}).get('entries', {})
    catalog = read_json(folder / 'catalog-cache/cs2.json', {}).get('entries', {})
    for board in boards:
        for record in board['rows']:
            key = 'cs2:' + record['id']
            intro = translations.get(key, {}).get('intro') or supplemental.get(record['id'])
            catalog_entry = catalog.get(key, {})
            if not intro and catalog_entry.get('translationStatus') == 'reviewed':
                intro = catalog_entry.get('introZh')
            if intro:
                record['introZh'] = intro


def enrich(folder, platform, boards):
    apply_source_covers(folder, platform, boards)
    evidence = read_json(folder / 'source-descriptions.json', {}).get('entries', {})
    translations = read_json(folder / 'chinese.json', {}).get('entries', {})
    known_categories = read_json(folder / 'board-categories.json', {}).get('platforms', {}).get(platform, {})
    labels = known_categories.get('labels', CATEGORIES[platform])
    id_categories = known_categories.get('entries', {})
    if platform == 'cs2':
        enrich_cs2_intros(folder, boards, translations)
    for item in boards:
        if item['source'] == 'StatRoblox':
            item['columns'] = [column for column in item['columns'] if column['id'] != 'revenue']
            item['note'] = STAT_BOARDS[item['id'].removeprefix('statroblox-')][1]
        for record in item['rows']:
            if item['source'] == 'StatRoblox':
                record['values'].pop('revenue', None)
            key = platform + ':' + record['id']
            source = evidence.get(key, {})
            if not record['tags'] and source.get('categories'):
                record['tags'] = [tag for tag in source['categories'] if tag]
            primary = id_categories.get(record['id'])
            if not primary or (platform == 'cs2' and primary == 'unclassified'):
                primary = classify(platform, {**record, 'categories': record['tags']}, source)
            record['category'] = labels.get(primary) or '待分类'
            zh = translations.get(key)
            if zh:
                record['titleZh'] = zh['title']
    return boards


def sync(root=ROOT, platforms=PLATFORMS, fortnite_capture=None):
    folder = root / 'data/ugc'
    dest = folder / 'source-boards'
    capture = read_json(fortnite_capture, {}) if fortnite_capture else None
    if capture and (capture.get('source') != 'fortnite' or set(capture['boards']) != set(FORT_BOARDS)):
        raise ValueError('Fortnite browser capture is missing ranking dimensions')
    jobs = {}
    if 'roblox' in platforms:
        jobs['roblox'] = {('statroblox-' + k): (statroblox_board, k, cfg) for k, cfg in STAT_BOARDS.items()}
        jobs['roblox']['rolimons'] = (lambda: list(rolimons_boards()),)
    if 'fortnite' in platforms:
        jobs['fortnite'] = {('fortnitegg-' + k): (fortnite_board, k, cfg, capture) for k, cfg in FORT_BOARDS.items()}
    if 'cs2' in platforms:
        jobs['cs2'] = {('steam-' + k): (steam_board, k, cfg) for k, cfg in STEAM_BOARDS.items()}
    if 'minecraft' in platforms:
        jobs['minecraft'] = {('modrinth-' + k): (modrinth_board, k, cfg) for k, cfg in MOD_BOARDS.items()}

    summary = {}
    with sync_lock(dest), ThreadPoolExecutor(max_workers=6) as pool:
        for platform, definitions in jobs.items():
            previous = read_json(dest / (platform + '.json'), {})
            past = {b['id']: b for b in previous.get('boards', [])}
            fallback = {b['id']: b for b in saved_steam_boards(folder)} if platform == 'cs2' else {}
            tasks = {pool.submit(task[0], *task[1:]): key for key, task in definitions.items()}
            results = {}
            for future in as_completed(tasks):
                key = tasks[future]
                try:
                    output = future.result()
                    collected = output if isinstance(output, list) else [output]
                    results[key] = [past[b['id']] if (b['capturedAt'] and past.get(b['id'], {}).get('capturedAt') and
                                    datetime.fromisoformat(past[b['id']]['capturedAt']) > datetime.fromisoformat(b['capturedAt'])) else b
                                    for b in collected]
                except (OSError, ValueError, KeyError, IndexError, TypeError) as error:
                    selected = ([b for b in past.values() if b['source'] == 'Rolimon’s'] if key == 'rolimons' else
                                [b for b in [fallback.get(key), past.get(key)] if b and b['rows']])
                    if selected:
                        if key != 'rolimons':
                            selected = [max(selected, key=lambda b: b['capturedAt'])]
                        results[key] = [{**b, 'status': 'stale'} for b in selected]
                    else:
                        results[key] = unavailable(platform, key)
                    print(f'{key}: {type(error).__name__}: {error}', flush=True)
            boards = [b for key in definitions for b in results[key]]
            if platform == 'cs2':
                boards.extend(catalog_steam_boards(folder))
                boards = [item for item in boards if item['rows']]
            tags = previous.get('sourceTags', {})
            if platform == 'fortnite' and capture:
                tags = {tag_id: re.sub(r'\s+[\d,]+$', '', label) for href, label in capture.get('tags', [])
                        if (tag_id := parse_qs(urlparse(href).query).get('tag', [''])[0]).isdigit()}
            output = {'schemaVersion': 1, 'platformId': platform, 'generatedAt': now(), 'sourceTags': tags,
                      'boards': enrich(folder, platform, boards)}
            atomic_json(dest / (platform + '.json'), output)
            summary[platform] = {b['id']: (b['status'], len(b['rows'])) for b in boards}
    return summary


def unavailable(platform, key):
    short = key.split('-', 1)[-1]
    if key == 'rolimons':
        return [board('rolimons-' + k, 'Rolimon’s', name, ROLIMONS, '按公开目录已收录的作品排序。', metric, ROLIMONS_COLUMNS)
                for k, (name, metric, _) in ROLIMONS_BOARDS.items()]
    if platform == 'cs2':
        return []
    if platform == 'fortnite':
        label, metric = FORT_BOARDS[short]
        return [board(key, 'Fortnite.GG', label, fortnite_url(short), '公开社区岛排序。', metric, FORT_COLUMNS.values())]
    if platform == 'minecraft':
        label, metric = MOD_BOARDS[short]
        return [board(key, 'Modrinth', label, 'https://modrinth.com/mods', 'Modrinth Java 单体模组。', metric, MOD_COLUMNS)]
    label, note, metric = STAT_BOARDS[short]
    return [board(key, 'StatRoblox', label, STAT + short, note, metric, ())]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--platforms', nargs='+', choices=PLATFORMS, default=PLATFORMS)
    parser.add_argument('--fortnite-capture', type=Path, help='Import verified on-site browser pages when direct requests are unavailable')
    args = parser.parse_args()
    print(json.dumps(sync(args.root, args.platforms, args.fortnite_capture), ensure_ascii=True))
