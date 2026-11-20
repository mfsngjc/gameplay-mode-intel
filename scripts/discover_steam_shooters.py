"""Find recent Steam listings absent from the shooter catalogue for editorial review."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.parse import urlencode

from refresh_shooter_games import DATA, ROOT, STEAM_STORE, STEAM_STORE_MIRROR, fetch, steam_app
from refresh_steam_charts import SteamList, product


TAGS = {'第一人称射击': 1663, '第三人称射击': 3814, '射击': 1774}
BEIJING = timezone(timedelta(hours=8))


def search_page(tag, page):
    query = urlencode({'category1': 998, 'tags': tag, 'sort_by': 'Released_DESC',
                       'l': 'english', 'cc': 'us', 'ndl': 1, 'page': page})
    path = '/search/?' + query
    try:
        raw, _, _ = fetch(STEAM_STORE_MIRROR + path, accept='text/html')
    except OSError:
        raw, _, _ = fetch(STEAM_STORE + path, accept='text/html')
    parser = SteamList('latest')
    parser.feed(raw.decode('utf-8').replace(STEAM_STORE_MIRROR, STEAM_STORE))
    parser.close()
    if not parser.rows:
        raise ValueError('Steam did not return a dated search list')
    return STEAM_STORE + path, parser.rows


def scan(tag, start, today, max_pages):
    results = {}
    pages = []
    completed = False
    error = None
    for page in range(1, max_pages + 1):
        try:
            source, entries = search_page(tag, page)
        except (OSError, ValueError) as exc:
            error = str(exc)
            break
        if pages and not any(entry['id'] not in results for entry in entries):
            error = 'Steam repeated the same search results'
            break
        dates = [entry['releaseDate'] for entry in entries]
        pages.append({'source': source, 'entries': len(entries), 'earliest': min(dates)})
        for entry in entries:
            results.setdefault(entry['id'], entry)
        if min(dates) < start:
            completed = True
            break
    coverage = {'pages': pages, 'reachedStart': completed}
    if error:
        coverage['error'] = error
    return coverage, [row for row in results.values() if start <= row['releaseDate'] <= today]


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--days', type=int, default=14)
    cli.add_argument('--max-pages', type=int, default=12)
    cli.add_argument('--output', type=Path, default=ROOT / 'local-only/steam-shooter-candidates.json')
    args = cli.parse_args()
    if args.days < 1 or args.max_pages < 1:
        cli.error('Days and max pages must be positive')
    now = datetime.now(BEIJING)
    today = now.date().isoformat()
    start = (now.date() - timedelta(days=args.days - 1)).isoformat()
    games = json.loads((DATA / 'shooter-games.json').read_text('utf-8'))['games']
    known = {steam_app(game) for game in games}
    for game in games:
        for source in game['sources']:
            app = product(source['url'])
            if app and app['type'] == 'app':
                known.add(app['id'])
    candidates = {}
    coverage = {}
    with ThreadPoolExecutor(max_workers=len(TAGS)) as pool:
        scans = pool.map(lambda tag: scan(tag, start, today, args.max_pages), TAGS.values())
        for title, (checked, rows) in zip(TAGS, scans):
            coverage[title] = checked
            for row in rows:
                app_id = row['id']
                if app_id in known:
                    continue
                item = candidates.setdefault(app_id, {
                    'appId': app_id, 'name': row['name'], 'listedReleaseDate': row['releaseDate'],
                    'source': f'{STEAM_STORE}/app/{app_id}/', 'matchedTags': [],
                })
                item['matchedTags'].append(title)
    output = {
        'checkedAt': now.isoformat(timespec='seconds'), 'start': start, 'end': today, 'coverage': coverage,
        'candidates': sorted(candidates.values(), key=lambda row: (-int(row['listedReleaseDate'].replace('-', '')), row['appId'])),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    reached = sum(section['reachedStart'] for section in coverage.values())
    print(f'{len(candidates)} candidates for review; {reached}/{len(TAGS)} tag lists reached {start}.')
    print(args.output)
    return 0 if any(section['pages'] for section in coverage.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
