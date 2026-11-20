"""Collect official promotional assets and dated review and Steam activity snapshots."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
MEDIA = ROOT / 'assets' / 'game-catalog'
STEAM_STORE = 'https://store.steampowered.com'
STEAM_STORE_MIRROR = 'https://store.fastly.steamstatic.com'
STEAM_PLAYERS = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/'
STEAM_CHART = 'https://store.steampowered.com/stats/stats/'
STEAM_OVERRIDES = {
    'overwatch': 2357570, 'battlefield-1': 1238840, 'arc-raiders': 1808500,
    'warframe': 230410, 'call-of-duty-modern-warfare-4': 4435490, 'halo-campaign-evolved': 2806050,
    'call-of-duty-black-ops-6': 4384550,
}
SHARED_STEAM = {'call-of-duty-black-ops-7', 'call-of-duty-warzone', 'battlefield-redsec'}
OFFICIAL_MEDIA_PAGES = {
    'valorant': 'https://www.playstation.com/en-us/games/valorant/',
    'fortnite-battle-royale': 'https://www.nintendo.com/us/store/products/fortnite-switch-2/',
    'pubg-mobile': 'https://play.google.com/store/apps/details?id=com.tencent.ig&hl=en_US',
    'garena-free-fire': 'https://play.google.com/store/apps/details?id=com.dts.freefireth&hl=en_US',
    'call-of-duty-mobile': 'https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter&hl=en_US',
    'arena-breakout-mobile': 'https://play.google.com/store/apps/details?id=com.proximabeta.mf.uamo&hl=en_US',
}
IGN_SLUGS = {
    'fortnite-battle-royale': 'fortnite-battle-royale', 'pubg-battlegrounds': 'playerunknowns-battlegrounds',
    'garena-free-fire': 'free-fire', 'arena-breakout-mobile': 'arena-breakout',
    'borderlands-1': 'borderlands', 'doom-2016': 'doom', 'quake-2': 'quake-ii',
    'call-of-duty-black-ops-3': 'call-of-duty-black-ops-iii',
    'resident-evil-2-remake': 'resident-evil-2', 'resident-evil-3-remake': 'resident-evil-3',
    'resident-evil-4-remake': 'resident-evil-4', 'star-fox-2026': 'star-fox-switch-2',
    'plants-vs-zombies-battle-for-neighborville': 'plants-vs-zombies-battle-for-neighborville',
    'space-marine-2': 'warhammer-40000-space-marine-2', 'stalker-2-heart-of-chornobyl': 'stalker-2',
}
IGN_EDITIONS = {
    'battlefield-6': '多人模式', 'borderlands-1': '2009 年原版',
    'call-of-duty-black-ops-6': '单人战役', 'call-of-duty-black-ops-7': '战役',
    'halo-infinite': '单人战役', 'hunt-showdown-1896': '1896 更新前评测',
    'overwatch': '《守望先锋 2》时期评测', 'splatoon-3': '单人战役',
}


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def fetch(url, *, accept='*/*'):
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': accept})
    with urlopen(request, timeout=16) as response:
        return response.read(), response.headers.get_content_type(), response.geturl()


def json_url(url):
    return json.loads(fetch(url, accept='application/json')[0])


def steam_app(game):
    if game['id'] in SHARED_STEAM:
        return None
    if game['id'] in STEAM_OVERRIDES:
        return STEAM_OVERRIDES[game['id']]
    for source in game['sources']:
        match = re.match(r'https://store\.steampowered\.com/app/(\d+)(?:/|$)', source['url'])
        if match:
            return int(match[1])
    return None


def current_online(app_id):
    result = json_url(STEAM_PLAYERS + '?' + urlencode({'appid': app_id}))['response']
    if result.get('result') != 1 or not isinstance(result.get('player_count'), int):
        raise ValueError('Steam did not return a current player count')
    return {'players': result['player_count'], 'checkedAt': timestamp(),
            'source': STEAM_PLAYERS + '?' + urlencode({'appid': app_id}), 'scope': 'app'}


def steam_chart():
    try:
        raw = fetch(STEAM_CHART, accept='text/html')[0].decode('utf-8', 'replace')
    except OSError:
        raw = fetch(STEAM_STORE_MIRROR + '/stats/stats/', accept='text/html')[0].decode('utf-8', 'replace')
    records = {}
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', raw, re.S | re.I):
        app = re.search(r'store\.(?:steampowered\.com|(?:fastly|cloudflare)\.steamstatic\.com)/app/(\d+)', row)
        counts = re.findall(r'<span\b[^>]*class="currentServers"[^>]*>\s*([\d,]+)\s*</span>', row)
        if app and counts:
            records[int(app[1])] = {'players': int(counts[0].replace(',', '')), 'checkedAt': timestamp(),
                                    'source': STEAM_CHART, 'scope': 'chart'}
    if not records:
        raise ValueError('Steam did not return the current chart')
    return records


def tracked_online(app_id):
    source = f'https://steamcharts.com/app/{app_id}'
    content, _, final_url = fetch(source, accept='text/html')
    if final_url.rstrip('/') != source:
        raise ValueError('Steam Charts did not return the expected application')
    raw = content.decode('utf-8', 'replace')
    match = re.search(r'<div class="app-stat">\s*<span class="num">([\d,]+)</span>\s*<br>\s*playing\s*'
                      r'<abbr class="timeago" title="([^"]+)"', raw)
    if not match:
        raise ValueError('Steam Charts did not report a timestamped sample')
    checked_at = datetime.fromisoformat(match[2].replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - checked_at).total_seconds()
    if not -300 <= age < 72 * 3600:
        raise ValueError('Steam Charts sample is outside the current window')
    return {'players': int(match[1].replace(',', '')), 'checkedAt': match[2],
            'source': source, 'scope': 'tracker'}


class ProductHTML(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.images = []
        self.feed(raw)

    def handle_starttag(self, tag, raw_attrs):
        attrs = dict(raw_attrs)
        if tag == 'meta':
            field = attrs.get('property') or attrs.get('name')
            if field and attrs.get('content'):
                self.meta.setdefault(field, attrs['content'])
        elif tag == 'img':
            src = attrs.get('data-src') or attrs.get('src')
            if src:
                self.images.append((src, attrs.get('alt') or ''))


def steam_review(raw, source):
    # Steam exposes language-specific scores. Match the long-term summary,
    # preserving its language and denominator, and skip "Recent Reviews".
    for block in re.split(r'<(?:a|div)\s+class="user_reviews_summary_row[^"]*"[^>]*>', raw)[1:]:
        block = block.split('user_reviews_summary_row')[0]
        title = re.search(r'class="subtitle[^"]*"[^>]*>\s*([^<]+)', block)
        if not title:
            continue
        label = unescape(title.group(1)).strip().strip(':')
        if 'Recent' in label:
            continue
        summary = re.search(r'([\d,]+)% of (?:the )?([\d,]+) user reviews(?: for this game)? are positive', unescape(block), re.I)
        if summary:
            return {'percent': int(summary[1].replace(',', '')), 'total': int(summary[2].replace(',', '')),
                    'scope': label, 'checkedAt': timestamp(), 'source': source}
    return None


def steam_data(app_id):
    path = f'/api/appdetails?appids={app_id}&cc=us&l=english'
    try:
        response = json_url(STEAM_STORE + path)
    except OSError:
        response = json_url(STEAM_STORE_MIRROR + path)
    result = response[str(app_id)]
    if not result['success'] or result['data'].get('steam_appid') != app_id:
        raise ValueError('Steam store did not return the expected application')
    return result['data']


def nintendo_images(raw):
    match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)
    if not match:
        return []
    apollo = json.loads(match[1])['props']['pageProps'].get('initialApolloState', {})
    product = next((value for key, value in apollo.items()
                    if key.startswith('Product:') and value.get('productGallery')), {})
    result = []
    for item in product.get('productGallery', []):
        asset = item.get('publicId', '').lstrip('/')
        if asset and item.get('resourceType') == 'image':
            base = 'https://assets.nintendo.com/image/upload/'
            result.append({'url': base + asset, 'thumb': base + 'f_auto/q_auto/w_640/' + asset})
    return result


def publisher_images(raw, source):
    page = ProductHTML(raw)
    cover = page.meta.get('og:image') or page.meta.get('twitter:image')
    domain = urlsplit(source).hostname
    if domain == 'www.nintendo.com':
        return cover, nintendo_images(raw)
    images = []
    for url, alt in page.images:
        url = urljoin(source, url)
        host = urlsplit(url).hostname
        if domain == 'play.google.com':
            use = 'screenshot' in alt.lower() and host in {'play-lh.googleusercontent.com', 'lh3.googleusercontent.com'}
        elif domain == 'www.callofduty.com':
            use = host in {'www.callofduty.com', 'imgs.callofduty.com'} and 'cod-touchui/' in url and bool(
                re.search(r'\.(?:jpg|jpeg|png|webp)(?:\?|$)', url, re.I)) and not re.search(
                r'(logo|icon|badge|callout|esrb|preorder|platform)', url, re.I)
        elif domain == 'www.playstation.com':
            use = host in {'gmedia.playstation.com', 'image.api.playstation.com'} and bool(
                re.search(r'(screenshot|key.?art|gameplay)', alt, re.I))
        elif domain == 'www.ea.com':
            use = host in {'media.contentapi.ea.com', 'drop-assets.ea.com'} and bool(
                re.search(r'(redsec|screenshot|key.?art|gameplay)', alt + url, re.I))
        else:
            use = False
        if use:
            images.append({'url': url})
    if domain == 'play.google.com':
        cover = images[0]['url'] if images else None
    return cover, images


def archive_cover(game_id, cover):
    content, mime, _ = fetch(cover)
    extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(mime)
    if mime == 'application/octet-stream':
        if content.startswith(b'\xff\xd8\xff'):
            extension = 'jpg'
        elif content.startswith(b'\x89PNG\r\n\x1a\n'):
            extension = 'png'
        elif content[:4] == b'RIFF' and content[8:12] == b'WEBP':
            extension = 'webp'
    if not extension or not (1000 < len(content) <= 12_000_000):
        raise ValueError(f'Invalid cover response ({mime}, {len(content)} bytes)')
    folder = MEDIA / game_id
    folder.mkdir(parents=True, exist_ok=True)
    filename = folder / f'cover.{extension}'
    if not filename.exists() or filename.read_bytes() != content:
        filename.write_bytes(content)
    return filename.relative_to(ROOT).as_posix()


def collect_media(game, app_id, steam, steam_source):
    game_id = game['id']
    if steam and steam.get('header_image'):
        source = steam_source
        hero = steam['header_image']
        images = [{'url': item['path_full'], 'thumb': item.get('path_thumbnail', item['path_full'])}
                  for item in steam.get('screenshots', [])]
    else:
        source = OFFICIAL_MEDIA_PAGES.get(game_id, game['sources'][0]['url'])
        raw = fetch(source, accept='text/html')[0].decode('utf-8', 'replace')
        hero, images = publisher_images(raw, source)
    if not hero or not hero.startswith('https://'):
        raise ValueError('No official cover found')
    cover = archive_cover(game_id, hero)
    unique = {image['url']: image for image in images if image['url'].startswith('https://') and image['url'] != hero}
    return {'cover': cover, 'coverOriginal': hero, 'source': source, 'images': list(unique.values())}


def ign_review(game):
    slug = IGN_SLUGS.get(game['id'], game['id'])
    source = f'https://www.ign.com/games/{slug}'
    content, _, final_url = fetch(source, accept='text/html')
    if urlsplit(final_url).path.rstrip('/') != '/games/' + slug:
        return None
    raw = content.decode('utf-8', 'replace')
    match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)
    if not match:
        return None
    page = json.loads(match[1])['props']['pageProps'].get('page') or {}
    result = page.get('primaryReview') or {}
    score, review_url = result.get('score'), result.get('articleUrl')
    if not isinstance(score, (int, float)) or not 0 <= score <= 10:
        return None
    if not review_url or urlsplit(review_url).hostname != 'www.ign.com':
        return None
    review = {'score': score, 'outOf': 10, 'source': review_url, 'gamePage': source}
    edition = IGN_EDITIONS.get(game['id'])
    if not edition and 'early-access' in review_url:
        edition = '抢先体验评测'
    if edition:
        review['edition'] = edition
    return review


def read_snapshot(path):
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))['games']
    return {}


def write_snapshot(path, records):
    payload = {'games': dict(sorted(records.items()))}
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def collect(game, wanted, chart):
    game_id, app_id = game['id'], steam_app(game)
    steam_source = next((source['url'] for source in game['sources']
                         if app_id and source['url'].startswith(f'{STEAM_STORE}/app/{app_id}/')),
                        f'{STEAM_STORE}/app/{app_id}/' if app_id else '')
    media, metrics, steam = None, {}, None
    failures = []
    if 'media' in wanted:
        try:
            if app_id:
                steam = steam_data(app_id)
                if steam.get('type') != 'game':
                    raise ValueError('Steam app is not a standalone game')
            media = collect_media(game, app_id, steam, steam_source)
        except Exception as error:
            failures.append(f'media: {error}')
    if 'steam' in wanted and app_id:
        metrics['steamAppId'] = app_id
        if app_id in chart:
            metrics['steamOnline'] = chart[app_id]
        else:
            try:
                metrics['steamOnline'] = tracked_online(app_id)
            except Exception as error:
                failures.append(f'online: {error}')
        if game['id'] == 'borderlands-1':
            metrics['steamEdition'] = '年度版加强版'
        try:
            store_content, _, _ = fetch(steam_source, accept='text/html')
            score = steam_review(store_content.decode('utf-8', 'replace'), steam_source)
            if score:
                metrics['steamReview'] = score
            else:
                failures.append('reviews: no verified long-term score')
        except Exception as error:
            failures.append(f'reviews: {error}')
    if 'ign' in wanted:
        try:
            score = ign_review(game)
            if score:
                metrics['ign'] = score
        except Exception as error:
            failures.append(f'IGN: {error}')
    return game_id, media, metrics, failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--media', action='store_true')
    parser.add_argument('--steam', action='store_true')
    parser.add_argument('--ign', action='store_true')
    parser.add_argument('--only', nargs='+', metavar='GAME')
    args = parser.parse_args()
    wanted = {field for field in ('media', 'steam', 'ign') if getattr(args, field)} or {'media', 'steam', 'ign'}
    games = json.loads((DATA / 'shooter-games.json').read_text(encoding='utf-8'))['games']
    if args.only:
        unknown = set(args.only).difference(game['id'] for game in games)
        if unknown:
            parser.error('Unknown games: ' + ', '.join(sorted(unknown)))
        games = [game for game in games if game['id'] in args.only]
    media_file, metrics_file = DATA / 'shooter-game-media.json', DATA / 'shooter-game-metrics.json'
    media_records, metric_records = read_snapshot(media_file), read_snapshot(metrics_file)
    chart = {}
    if 'steam' in wanted:
        try:
            chart = steam_chart()
        except Exception as error:
            print(f'Steam chart: {error}', flush=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        for game_id, media, metrics, errors in pool.map(lambda game: collect(game, wanted, chart), games):
            if media:
                media_records[game_id] = media
            if metrics:
                metric_records.setdefault(game_id, {}).update(metrics)
            if errors:
                print(f'{game_id}: ' + '; '.join(errors), flush=True)
    if 'media' in wanted:
        write_snapshot(media_file, media_records)
        print('Covers:', len(media_records), 'gallery images:', sum(len(item['images']) for item in media_records.values()), flush=True)
    if wanted.intersection({'steam', 'ign'}):
        write_snapshot(metrics_file, metric_records)
        for field in ('steamOnline', 'steamReview', 'ign'):
            print(field + ':', sum(field in item for item in metric_records.values()), flush=True)


if __name__ == '__main__':
    main()
