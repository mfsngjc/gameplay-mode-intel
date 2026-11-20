"""Refresh dated releases and publisher patch notes for the game catalogue."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
import json
import re
from urllib.parse import urlencode

from refresh_shooter_games import (
    DATA, STEAM_STORE_MIRROR, fetch, json_url, read_snapshot, steam_app, steam_chart, tracked_online, write_snapshot,
)


STEAM_DATA = STEAM_STORE_MIRROR
STEAM_NEWS = 'https://store.steampowered.com/news/app'
HELLDIVERS_COUNTS = 'https://www.helldiversstats.com/api/v1/player-count'
UPDATE_TYPES = {12, 13, 14}  # Patch notes, regular updates, major updates.
IGNORED_BLOCKS = re.compile(r'\[(img|previewyoutube|video|dynamiclink)(?:[^\]]*)\].*?\[/\1\]', re.I | re.S)
BB_TAG = re.compile(r'\[/?(?:[a-z][a-z\d_-]*(?:=[^\]]*)?|\*)\]', re.I)


def release_record(date, source, label, upcoming=False):
    return {'date': date, 'source': source, 'label': label, 'upcoming': upcoming}


def release_day(text):
    text = ' '.join(text.split())
    for template in ('%b %d, %Y', '%B %d, %Y', '%d %b, %Y', '%d %b %Y'):
        try:
            return datetime.strptime(text, template).date().isoformat()
        except ValueError:
            continue
    if re.fullmatch(r'(?:Q[1-4] )?20\d{2}|[A-Z][a-z]+ 20\d{2}', text):
        return text
    return None


def steam_release(app_id):
    params = urlencode({'appids': app_id, 'filters': 'release_date', 'cc': 'us', 'l': 'english'})
    data = json_url(f'{STEAM_DATA}/api/appdetails?{params}')[str(app_id)]['data']['release_date']
    date = release_day(data['date'])
    return release_record(date, f'https://store.steampowered.com/app/{app_id}/', 'Steam 发行', data['coming_soon']) if date else None


def nintendo_release(source):
    html = fetch(source, accept='text/html')[0].decode('utf-8', 'replace')
    match = re.search(r'>Release date</h3>(?:<[^>]+>\s*){1,8}([^<]+)', html)
    date = release_day(unescape(match[1])) if match else None
    return release_record(date, source, 'Nintendo 发行') if date else None


def patch_summary(body):
    body = IGNORED_BLOCKS.sub('', body)
    body = re.sub(r'\[/?(?:p|\*|h[1-6]|list|tr|hr)\]', '\n', body, flags=re.I)
    body = BB_TAG.sub('', body)
    lines = [' '.join(unescape(line).split()) for line in body.splitlines()]
    notes = [line for line in lines if len(line) >= 32 and not line.startswith(('http', '{STEAM_'))
             and not re.search(r'^(?:an update .* has been released|the update will be applied|below are the)', line, re.I)]
    summary = ' · '.join(notes[:2])
    return summary[:237].rstrip() + '…' if len(summary) > 240 else summary


def steam_updates(app_id):
    params = urlencode({'appid': app_id, 'count_before': 0, 'count_after': 30, 'l': 'english'})
    events = json_url(f'{STEAM_DATA}/events/ajaxgetadjacentpartnerevents/?{params}')['events']
    now = datetime.now(timezone.utc).timestamp()
    updates = []
    for event in events:
        title = event.get('event_name', '').strip()
        official_update = event.get('event_type') in UPDATE_TYPES or re.search(
            r'\b(?:patch notes|hotfix|latest update \d|update notes)\b', title, re.I)
        time = event.get('rtime32_start_time')
        gid = event.get('gid', '')
        if (not official_update or not title or event.get('appid') != app_id or
                not isinstance(time, int) or not 0 < time <= now or not gid.isdecimal()):
            continue
        updates.append({
            'date': datetime.fromtimestamp(time, timezone.utc).date().isoformat(),
            'publishedAt': datetime.fromtimestamp(time, timezone.utc).isoformat(timespec='seconds'),
            'title': title, 'summary': patch_summary(event.get('announcement_body', {}).get('body', '')),
            'source': f'{STEAM_NEWS}/{app_id}/view/{gid}',
        })
    return updates


def helldivers_online():
    snapshot = json_url(HELLDIVERS_COUNTS)
    players = snapshot['helldiversActive']
    captured_at = snapshot['capturedAt']
    sample_time = datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - sample_time).total_seconds()
    if (snapshot['sources'].get('helldiversActive') != 'arrowhead' or type(players) is not int
            or players < 0 or not -60 <= age < 3600):
        raise ValueError('No recent Arrowhead population sample')
    return {'players': players, 'checkedAt': captured_at, 'label': '跨平台·银河战争',
            'coverage': '跨平台银河战争部署人数，Helldivers Stats 转引 Arrowhead WarStatus',
            'source': HELLDIVERS_COUNTS}


def cod_launcher_online():
    app_id = 1938090
    try:
        sample = steam_chart().get(app_id)
    except (OSError, ValueError):
        sample = None
    sample = sample or tracked_online(app_id)
    return {
        **sample, 'scope': 'shared-launcher', 'label': 'Steam 共用入口',
        'coverage': '《使命召唤》Steam 共用客户端人数，覆盖《现代战争 4》《黑色行动 7》和《战争地带》等入口',
    }


def collect(game, record):
    app_id = steam_app(game)
    nintendo = next((s['url'] for s in game['sources'] if s['url'].startswith('https://www.nintendo.com/us/store/products/')), None)
    updated = dict(record)
    release = updated.get('release')
    if not release or release['label'] in {'Steam 发行', 'Nintendo 发行'}:
        try:
            found = steam_release(app_id) if app_id else nintendo_release(nintendo) if nintendo else None
            if found:
                updated['release'] = found
        except (OSError, KeyError, ValueError):
            pass
    if app_id:
        try:
            updates = {row['source']: row for row in steam_updates(app_id)}
            # Curated notes take precedence over imported excerpts from the same announcement.
            updates.update({row['source']: row for row in updated.get('updates', [])})
            if updates:
                updated['updates'] = sorted(updates.values(), key=lambda row: row['date'], reverse=True)[:4]
        except (OSError, KeyError, ValueError) as error:
            print(f"{game['id']}: {error}", flush=True)
    if game['id'] == 'helldivers-2':
        try:
            updated['online'] = helldivers_online()
        except (OSError, KeyError, ValueError) as error:
            print(f"helldivers-2 population: {error}", flush=True)
    if game['id'] == 'call-of-duty-modern-warfare-4':
        try:
            updated['sharedOnline'] = cod_launcher_online()
        except (OSError, KeyError, ValueError) as error:
            print(f"Call of Duty launcher population: {error}", flush=True)
    return game['id'], updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+')
    args = parser.parse_args()
    games = json.loads((DATA / 'shooter-games.json').read_text(encoding='utf-8'))['games']
    if args.only:
        games = [game for game in games if game['id'] in args.only]
    metrics_path = DATA / 'shooter-game-metrics.json'
    records = read_snapshot(metrics_path)
    with ThreadPoolExecutor(max_workers=9) as pool:
        for game_id, record in pool.map(lambda game: collect(game, records.get(game['id'], {})), games):
            if record:
                records[game_id] = record
    write_snapshot(metrics_path, records)
    print(f"{sum('release' in record for record in records.values())} releases, "
          f"{sum(bool(record.get('updates')) for record in records.values())} games with patch notes.")


if __name__ == '__main__':
    main()
