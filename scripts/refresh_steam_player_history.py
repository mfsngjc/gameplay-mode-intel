"""Collect daily sampled Steam peaks, patch dates and a comparable shooter top 20."""

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import sys
from urllib.error import HTTPError

from refresh_shooter_activity import steam_updates
from refresh_shooter_games import DATA, fetch, read_snapshot, steam_app


TRACKER = 'https://steamcharts.com'
SNAPSHOT = DATA / 'steam-player-history.json'
BEIJING = timezone(timedelta(hours=8))
WINDOW_DAYS = 90
TIMELINE_APPS = {578080, 1172470, 2507950}
SHARED_APP = 1938090  # Call of Duty desktop launcher; never a game rank.


def history_samples(app_id):
    source = f'{TRACKER}/app/{app_id}/chart-data.json'
    raw, _, final = fetch(source, accept='application/json')
    if final != source:
        raise ValueError('unexpected Steam Charts redirect')
    points = json.loads(raw)
    if not isinstance(points, list):
        raise ValueError('invalid Steam Charts data')
    samples = {}
    for point in points:
        if (isinstance(point, list) and len(point) == 2 and type(point[0]) is int
                and type(point[1]) is int and 0 < point[0] < 4_200_000_000_000 and point[1] >= 0):
            samples[point[0]] = point[1]
    return samples


def summarize(samples, cutoff, now):
    days = {}
    for ms, players in samples.items():
        moment = datetime.fromtimestamp(ms / 1000, BEIJING)
        day = moment.date().isoformat()
        if day < cutoff or moment > now:
            continue
        peak, count = days.get(day, (0, 0))
        days[day] = (max(peak, players), count + 1)
    return days


def merge_days(record, incoming, cutoff):
    saved = {day: (peak, count) for day, peak, count in record.get('days', []) if day >= cutoff}
    for day, (peak, count) in incoming.items():
        old_peak, old_count = saved.get(day, (0, 0))
        # The source downsamples older days. Retain a higher peak already observed.
        saved[day] = (max(peak, old_peak), max(count, old_count))
    return [[day, *saved[day]] for day in sorted(saved)]


def top_shooters(samples_by_app, eligible, now):
    hours = defaultdict(dict)
    now_ms = int(now.timestamp() * 1000)
    for app_id in eligible & samples_by_app.keys():
        for ms, players in samples_by_app[app_id].items():
            if 0 <= now_ms - ms < 24 * 3_600_000:
                bucket = hours[ms // 3_600_000]
                if app_id not in bucket or ms > bucket[app_id][0]:
                    bucket[app_id] = (ms, players)
    if not hours:
        return None
    best_coverage = max(map(len, hours.values()))
    viable = [hour for hour, apps in hours.items()
              if len(apps) >= max(20, 0.8 * best_coverage)]
    if not viable:
        return None
    hour = max(viable)
    candidates = hours[hour]
    ordered = sorted(candidates, key=lambda app_id: (-candidates[app_id][1], app_id))[:20]
    return {
        'hour': datetime.fromtimestamp(hour * 3600, timezone.utc).isoformat(),
        'sampledGames': len(candidates),
        'eligibleGames': len(eligible),
        'source': TRACKER,
        'entries': [{'id': app_id, 'players': candidates[app_id][1],
                     'sampledAt': datetime.fromtimestamp(candidates[app_id][0] / 1000, timezone.utc).isoformat(timespec='seconds')}
                    for app_id in ordered],
    }


def load_history(path):
    if not path.exists():
        return {'schemaVersion': 1, 'apps': {}}
    payload = json.loads(path.read_text(encoding='utf-8'))
    if payload.get('schemaVersion') != 1 or not isinstance(payload.get('apps'), dict):
        raise ValueError('invalid Steam player history file')
    return payload


def check(payload):
    for app_id, record in payload['apps'].items():
        if not app_id.isdecimal():
            raise ValueError('invalid App ID')
        previous = ''
        for day, peak, samples in record['days']:
            if (date.fromisoformat(day).isoformat() != day or day <= previous
                    or type(peak) is not int or peak < 0 or type(samples) is not int or samples < 1):
                raise ValueError(f'invalid daily sample for {app_id}')
            previous = day
    board = payload.get('shooterTop')
    if board:
        scores = [row['players'] for row in board['entries']]
        ids = [row['id'] for row in board['entries']]
        if (len(scores) != 20 or len(set(ids)) != 20 or scores != sorted(scores, reverse=True)
                or not 20 <= board['sampledGames'] <= board['eligibleGames']):
            raise ValueError('invalid shooter top 20')
        hour = datetime.fromisoformat(board['hour'])
        if any(not timedelta(0) <= datetime.fromisoformat(row['sampledAt']) - hour < timedelta(hours=1)
               for row in board['entries']):
            raise ValueError('shooter ranking mixes different hours')


def collect(app_id, refresh_updates):
    try:
        samples = history_samples(app_id)
    except HTTPError as error:
        if error.code not in {404, 410}:
            print(f'{app_id}: Steam Charts returned HTTP {error.code}', file=sys.stderr)
        samples = {}
    except (OSError, ValueError) as error:
        print(f'{app_id}: {error}', file=sys.stderr)
        samples = {}
    updates = None
    if refresh_updates and samples:
        try:
            updates = steam_updates(app_id)
        except (OSError, ValueError, KeyError) as error:
            if app_id in {730, 578080, 1172470}:
                print(f'{app_id} update announcements: {error}', file=sys.stderr)
    return samples, updates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=SNAPSHOT)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--updates', action='store_true', help='Also refresh developer patch announcements')
    args = parser.parse_args()
    if args.check:
        if not args.output.is_file():
            parser.error(f'missing history file: {args.output}')
        data = load_history(args.output)
        check(data)
        print(f"Daily Steam history: {len(data['apps'])} apps, {len(data.get('shooterTop', {}).get('entries', []))} ranked")
        return 0
    data = load_history(args.output if args.output.exists() else SNAPSHOT)
    catalog = json.loads((DATA / 'shooter-games.json').read_text(encoding='utf-8'))
    metric_records = read_snapshot(DATA / 'shooter-game-metrics.json')
    exclusions = set(catalog.get('steamShooterChartExclusions', []))
    games = [(game['id'], steam_app(game)) for game in catalog['games'] if 'steam' in game['platforms']]
    ids = Counter(app for _, app in games if app)
    eligible = {app for game, app in games if game not in exclusions and ids[app] == 1 and app != SHARED_APP}
    targets = sorted(set(ids) | {SHARED_APP})
    curated = {app: metric_records.get(game, {}).get('updates', []) for game, app in games if ids[app] == 1}
    now = datetime.now(BEIJING)
    cutoff = (now.date() - timedelta(days=WINDOW_DAYS - 1)).isoformat()
    samples_by_app = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for app_id, (samples, updates) in zip(targets, pool.map(
                lambda app: collect(app, args.updates and app != SHARED_APP), targets)):
            key = str(app_id)
            record = data['apps'].get(key, {})
            # Keep past daily observations for the timeline. Ingest the rolling window
            # so the source's older monthly points never enter the daily archive.
            retention_cutoff = '' if app_id in TIMELINE_APPS else cutoff
            days = merge_days(record, summarize(samples, cutoff, now), retention_cutoff)
            if not days:
                continue
            if samples:
                samples_by_app[app_id] = samples
            by_source = {row['source']: row for row in (updates or [])}
            by_source.update({row['source']: row for row in record.get('updates', [])})
            by_source.update({row['source']: row for row in curated.get(app_id, [])})
            events = [{key: row[key] for key in ('date', 'title', 'source', 'publishedAt') if key in row}
                      for row in by_source.values() if row['date'] >= cutoff and row['source'].startswith('https://')]
            data['apps'][key] = {'days': days, 'updates': sorted(events, key=lambda row: row['date'])}
    # Keep the last verified board through outages and never replace it with an older sample.
    top = top_shooters(samples_by_app, eligible, now)
    if top and top['hour'] >= data.get('shooterTop', {}).get('hour', ''):
        data['shooterTop'] = top
    check(data)
    if not samples_by_app:
        print('Steam Charts is unavailable. Kept saved history.', file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(args.output)
    print(f"Steam Charts: {len(samples_by_app)} apps read; {len(data['apps'])} games with daily data; rank "
          + (f"{top['hour']} ({top['sampledGames']}/{top['eligibleGames']})" if top else 'retained'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
