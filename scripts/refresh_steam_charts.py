"""Read Valve's public chart pages and update the game catalog's saved snapshots."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

from refresh_shooter_games import steam_app


STORE = 'https://store.steampowered.com'
STORE_ITEMS = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/'
SOURCES = {
    'players': STORE + '/charts/mostplayed',
    'sellers': STORE + '/charts/topselling/global',
    'latest': STORE + '/search/?category1=998&sort_by=Released_DESC',
    'trending': STORE + '/search/?filter=popularnew',
}
RELEASE_BOARDS = ('latest', 'trending')
RANKED_BOARDS = ('players', 'sellers')
DATA = Path(__file__).resolve().parents[1] / 'data'
SNAPSHOT = DATA / 'steam-charts.json'
PRODUCT = re.compile(r'/(app|sub|bundle)/([1-9][0-9]{0,9})(?:/|$)')
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()
LIMIT = 50
MIN_FETCH = 20
STORE_BATCH = 40
YUAN_PRICE = re.compile(r'[¥￥]\s*(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{2})?')


def clean(parts):
    return ' '.join(''.join(parts).split())


def product(href):
    url = urlsplit(urljoin(STORE, href))
    match = PRODUCT.match(url.path)
    if url.netloc == 'store.steampowered.com' and url.scheme == 'https' and match:
        return {'type': match[1], 'id': int(match[2])}
    return None


def integer(text):
    if re.fullmatch(r'[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+', text):
        return int(text.replace(',', ''))
    return None


def release_date(text):
    match = re.fullmatch(r'([A-Za-z]{3}) ([0-9]{1,2}), ([0-9]{4})', text)
    if not match or match[1] not in MONTHS:
        return None
    try:
        return date(int(match[3]), MONTHS.index(match[1]) + 1, int(match[2])).isoformat()
    except ValueError:
        return None


class SteamList(HTMLParser):
    def __init__(self, board):
        super().__init__(convert_charrefs=True)
        self.board = board
        self.search = board in RELEASE_BOARDS
        self.rows = []
        self.cells = None
        self.cell = None
        self.links = []
        self.link = None
        self.position = 0
        self.field = None

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        classes = (attrs.get('class') or '').split()
        if not self.search:
            if tag == 'tr':
                self.cells, self.links, self.cell, self.link = [], [], None, None
            elif tag == 'td' and self.cells is not None:
                self.cell = []
        if tag == 'a':
            if self.search and 'search_result_row' in classes:
                self.position += 1
            elif self.search or self.cell is None:
                return
            target = product(attrs.get('href') or '')
            self.link = {'target': target, 'title': [], 'date': [], 'alt': ''} if target else None
        if self.link is not None:
            if tag == 'img' and not self.search:
                self.link['alt'] = attrs.get('alt') or self.link['alt']
            if tag in {'div', 'span'} and self.search:
                if 'title' in classes:
                    self.field = (tag, 'title')
                elif 'search_released' in classes:
                    self.field = (tag, 'date')

    def handle_data(self, value):
        if self.cell is not None:
            self.cell.append(value)
        if self.link is not None:
            if self.field:
                self.link[self.field[1]].append(value)
            elif not self.search:
                self.link['title'].append(value)

    def handle_endtag(self, tag):
        if self.field and tag == self.field[0]:
            self.field = None
        if tag == 'a' and self.link is not None:
            link, self.link, self.field = self.link, None, None
            title = clean(link['title'])
            target = link['target']
            if self.search:
                released = release_date(clean(link['date']))
                if target['type'] == 'app' and title and (self.board != 'latest' or released):
                    row = {'rank': self.position, **target, 'name': title}
                    if released:
                        row['releaseDate'] = released
                    self.rows.append(row)
            elif title or link['alt']:
                self.links.append((target, title or link['alt'], bool(title)))
        if tag == 'td' and self.cell is not None:
            self.cells.append(clean(self.cell))
            self.cell = None
        if tag == 'tr' and self.cells is not None:
            self.finish_chart_row()
            self.cells, self.cell, self.link = None, None, None

    def finish_chart_row(self):
        if not self.cells or not self.links:
            return
        # The current chart tables put an empty selection cell before the rank.
        rank_cell = next((cell for cell in self.cells if cell), '')
        rank = integer(rank_cell.lstrip('# '))
        if not rank or rank > 100:
            return
        target, title, _ = max(self.links, key=lambda link: link[2])
        row = {'rank': rank, **target, 'name': title}
        if self.board == 'players':
            if len(self.cells) < 4 or target['type'] != 'app':
                return
            online, peak = map(integer, self.cells[-2:])
            if online is None or peak is None:
                return
            row.update(players=online, peak=peak)
        self.rows.append(row)


def checked_time(board):
    value = datetime.fromisoformat(board['checkedAt'].replace('Z', '+00:00'))
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def validate_board(key, board, minimum=1):
    if board['source'] != SOURCES[key]:
        raise ValueError('unexpected source URL')
    checked_time(board)
    rows = board['entries']
    if not minimum <= len(rows) <= LIMIT:
        raise ValueError(f'unexpected number of entries: {len(rows)}')
    products, previous_rank = set(), 0
    for row in rows:
        identifier = (row['type'], row['id'])
        if (identifier in products or row['type'] not in {'app', 'sub', 'bundle'}
                or type(row['id']) is not int or not 0 < row['id'] < 10**10
                or type(row['rank']) is not int or row['rank'] <= previous_rank
                or not isinstance(row['name'], str) or not row['name'].strip()):
            raise ValueError('invalid product or rank')
        products.add(identifier)
        previous_rank = row['rank']
        if key == 'players':
            if row['type'] != 'app' or any(type(row.get(field)) is not int or row[field] < 0
                                            for field in ('players', 'peak')):
                raise ValueError('invalid player counts')
        if key == 'latest' or 'releaseDate' in row:
            date.fromisoformat(row['releaseDate'])
        if 'releaseUpcoming' in row and type(row['releaseUpcoming']) is not bool:
            raise ValueError('invalid upcoming release flag')


def fetch_board(key):
    source = SOURCES[key]
    request = Request(source, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html',
                                       'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'Steam_Language=english'})
    with urlopen(request, timeout=20) as response:
        expected, actual = urlsplit(source), urlsplit(response.geturl())
        if (actual.scheme, actual.netloc, actual.path.rstrip('/')) != (
                'https', expected.netloc, expected.path.rstrip('/')):
            raise ValueError('Steam redirected away from the chart')
        if response.headers.get_content_type() != 'text/html':
            raise ValueError('Steam did not return chart HTML')
        raw = response.read(8_000_001)
        if len(raw) > 8_000_000:
            raise ValueError('Steam response exceeds size limit')
    parser = SteamList(key)
    parser.feed(raw.decode('utf-8'))
    parser.close()
    entries, seen = [], set()
    for row in parser.rows:
        identifier = (row['type'], row['id'])
        if identifier not in seen:
            entries.append(row)
            seen.add(identifier)
        if len(entries) == LIMIT:
            break
    board = {'source': source, 'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
             'entries': entries}
    validate_board(key, board, MIN_FETCH)
    if entries[0]['rank'] != 1:
        raise ValueError('Steam response is missing the first result')
    return board


def read_snapshot(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    if data['schemaVersion'] != 1 or set(data['boards']) != set(SOURCES):
        raise ValueError('invalid Steam charts snapshot schema')
    for key, board in data['boards'].items():
        validate_board(key, board)
    store = data.setdefault('releaseStore', data.pop('latestStore', {}))
    for app_id, item in store.items():
        if not re.fullmatch(r'[1-9][0-9]{0,9}', app_id):
            raise ValueError('invalid store app ID')
        checked_time(item)
        price = item.get('price')
        if price is not None and price != '免费' and not YUAN_PRICE.fullmatch(price):
            raise ValueError('invalid CNY store price')
        review = item.get('review')
        if review is not None and (
                type(review['total']) is not int or review['total'] < 0
                or type(review['percent']) is not int or not 0 <= review['percent'] <= 100
                or not isinstance(review.get('label', ''), str)):
            raise ValueError('invalid store review summary')
    return data


def release_app_ids(data):
    catalog = json.loads((DATA / 'shooter-games.json').read_text(encoding='utf-8'))
    metrics = json.loads((DATA / 'shooter-game-metrics.json').read_text(encoding='utf-8'))['games']
    exclusions = set(catalog.get('steamShooterChartExclusions', []))
    app_ids = {row['id'] for board in data['boards'].values()
               for row in board['entries'] if row['type'] == 'app'}
    for game in catalog['games']:
        if 'steam' not in game['platforms'] or game['id'] in exclusions:
            continue
        if app_id := steam_app(game):
            app_ids.add(app_id)
        release = metrics.get(game['id'], {}).get('release', {})
        if release.get('upcoming') is not False or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', release.get('date') or ''):
            continue
        target = product(release.get('source') or '')
        if target and target['type'] == 'app':
            app_ids.add(target['id'])
    return sorted(app_ids)


def fetch_app_release(app_id):
    url = STORE + '/api/appdetails?' + urlencode({
        'appids': app_id, 'cc': 'us', 'l': 'english', 'filters': 'release_date',
    })
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
    with urlopen(request, timeout=16) as response:
        app = json.load(response)[str(app_id)]
    if app['success'] is not True:
        raise ValueError('Steam did not return the requested release date')
    released = app['data']['release_date']
    day = release_date(released['date'])
    result = {'releaseDate': day} if day else {}
    if released.get('coming_soon') is True:
        result['releaseUpcoming'] = True
    return result


def refresh_ranked_dates(boards, previous):
    fields = ('releaseDate', 'releaseUpcoming')
    rows = [row for board in boards.values() for row in board['entries'] if row['type'] == 'app']
    fallback = {row['id']: row for board in previous.values() for row in board['entries']
                if row['type'] == 'app' and any(field in row for field in fields)}
    app_ids = sorted({row['id'] for row in rows})
    releases = {}
    checked = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        requests = {app_id: pool.submit(fetch_app_release, app_id) for app_id in app_ids}
        for app_id, response in requests.items():
            try:
                releases[app_id] = response.result()
                checked += 1
            except (OSError, ValueError, KeyError, TypeError):
                releases[app_id] = fallback.get(app_id, {})
    for row in rows:
        release = releases[row['id']]
        for field in fields:
            row.pop(field, None)
            if field in release:
                row[field] = release[field]
    print(f'ranked charts: checked {checked}/{len(app_ids)} store release dates')
    return checked


def fetch_store_records(app_ids, country):
    payload = {
        'ids': [{'appid': app_id} for app_id in app_ids],
        'context': {'country_code': country, 'language': 'schinese'},
        'data_request': {'include_reviews': True},
    }
    url = STORE_ITEMS + '?' + urlencode({'input_json': json.dumps(payload, separators=(',', ':'))})
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
    with urlopen(request, timeout=20) as response:
        items = json.load(response)['response']['store_items']
    checked_at = datetime.now(timezone.utc).isoformat(timespec='seconds')
    records = {}
    for item in items:
        app_id = item.get('appid')
        if app_id not in app_ids or item.get('success') != 1:
            continue
        record = {'checkedAt': checked_at}
        if country == 'CN':
            price = item.get('best_purchase_option', {}).get('formatted_final_price') or ''
            if item.get('is_free') is True:
                record['price'] = '免费'
            elif YUAN_PRICE.fullmatch(price):
                record['price'] = price
        summary = item.get('reviews', {}).get('summary_filtered', {})
        total, percent = summary.get('review_count'), summary.get('percent_positive')
        if type(total) is int and total >= 0 and type(percent) is int and 0 <= percent <= 100:
            record['review'] = {'total': total, 'percent': percent}
            if summary.get('review_score') and summary.get('review_score_label'):
                record['review']['label'] = summary['review_score_label']
        records[str(app_id)] = record
    return records


def fetch_store_batch(app_ids):
    records = fetch_store_records(app_ids, 'CN')
    missing = [app_id for app_id in app_ids if str(app_id) not in records]
    if missing:
        # Some apps have a global review summary but no listing in the CN store.
        try:
            reviews = fetch_store_records(missing, 'US')
            records.update((app_id, item) for app_id, item in reviews.items() if 'review' in item)
        except (OSError, ValueError, KeyError, TypeError) as error:
            print(f'release store: fallback review data unavailable ({error})', file=sys.stderr)
    return records


def refresh_store(data):
    app_ids = release_app_ids(data)
    previous = data['releaseStore']
    records = {str(app_id): previous[str(app_id)] for app_id in app_ids if str(app_id) in previous}
    updated = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        requests = [pool.submit(fetch_store_batch, app_ids[start:start + STORE_BATCH])
                    for start in range(0, len(app_ids), STORE_BATCH)]
        for result in requests:
            try:
                batch = result.result()
                records.update(batch)
                updated += len(batch)
            except (OSError, ValueError, KeyError, TypeError) as error:
                print(f'release store: kept previous data for a batch ({error})', file=sys.stderr)
    data['releaseStore'] = dict(sorted(records.items(), key=lambda item: int(item[0])))
    print(f'release store: refreshed {updated}/{len(app_ids)} Steam apps')
    return updated


def write_snapshot(output, data):
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(output)


def refresh(output):
    data = read_snapshot(SNAPSHOT)
    if output.exists() and output.resolve() != SNAPSHOT.resolve():
        try:
            cached = read_snapshot(output)
            for key, board in cached['boards'].items():
                if checked_time(board) > checked_time(data['boards'][key]):
                    data['boards'][key] = board
            records = data['releaseStore']
            for app_id, item in cached['releaseStore'].items():
                if app_id not in records or checked_time(item) > checked_time(records[app_id]):
                    records[app_id] = item
        except (OSError, ValueError, KeyError, TypeError) as error:
            print(f'Ignoring unreadable Steam cache: {error}', file=sys.stderr)
    previous_ranked = {key: data['boards'][key] for key in RANKED_BOARDS}
    updated = 0
    with ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        requests = {key: pool.submit(fetch_board, key) for key in SOURCES}
        for key, result in requests.items():
            try:
                board = result.result()
                data['boards'][key] = board
                updated += 1
                print(f'{key}: saved {len(board["entries"])} Steam entries')
            except (OSError, ValueError, KeyError) as error:
                print(f'{key}: kept previous snapshot ({error})', file=sys.stderr)
    updated += refresh_ranked_dates({key: data['boards'][key] for key in RANKED_BOARDS}, previous_ranked)
    updated += refresh_store(data)
    write_snapshot(output, data)
    return updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=SNAPSHOT)
    parser.add_argument('--check', action='store_true', help='Validate the snapshot without querying Steam')
    parser.add_argument('--keep-on-error', action='store_true', help='Permit a build using only saved snapshots')
    args = parser.parse_args()
    if args.check:
        data = read_snapshot(args.output)
        print('Steam charts: ' + ', '.join(f'{key} {len(board["entries"])}'
                                           for key, board in data['boards'].items()) +
              f'; release store {len(data["releaseStore"])}')
    elif not refresh(args.output) and not args.keep_on_error:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
