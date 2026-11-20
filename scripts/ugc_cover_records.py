"""Join public UGC covers by source work ID and preserve their provenance."""

from datetime import datetime
from urllib.parse import urlparse

from sync_ugc import read_json


def cover_url(value):
    if not isinstance(value, str):
        return ''
    try:
        parsed = urlparse(value)
        if parsed.scheme != 'https' or not parsed.hostname:
            return ''
    except ValueError:
        return ''
    if parsed.hostname == 'fortnite.gg' and parsed.path.startswith('/img/creative_placeholder'):
        return ''
    return value


def modrinth_cover(item):
    icon = cover_url(item.get('icon_url'))
    if icon:
        return icon, 'icon'
    for field in ('featured_gallery', 'gallery'):
        values = item.get(field)
        values = [values] if isinstance(values, str) else values if isinstance(values, list) else []
        for value in values:
            candidate = value if isinstance(value, str) else (
                value.get('url') or value.get('raw_url') or value.get('src') if isinstance(value, dict) else None)
            cover = cover_url(candidate)
            if cover:
                return cover, 'cover'
    return None, None


def available(image):
    if not isinstance(image, dict) or image.get('status') != 'available' or not cover_url(image.get('url')):
        return False
    if not cover_url(image.get('sourceUrl')):
        return False
    try:
        return datetime.fromisoformat(image['checkedAt']).tzinfo is not None
    except (KeyError, TypeError, ValueError):
        return False


def repairs(folder, platform):
    prefix = platform + ':'
    doc = read_json(folder / 'cover-repairs.json', {}).get('entries', {})
    return {key: image for key, image in doc.items() if key.startswith(prefix) and available(image)}


def source_board_covers(folder, platform):
    doc = read_json(folder / 'source-boards' / (platform + '.json'), {})
    output = {}
    for board in doc.get('boards', []):
        for row in board.get('rows', []):
            image = {'url': cover_url(row.get('cover')), 'sourceUrl': row.get('coverSourceUrl') or row.get('url'),
                     'kind': row.get('coverKind') or ('icon' if platform in ('roblox', 'minecraft') else 'cover'),
                     'status': 'available', 'checkedAt': row.get('coverCheckedAt') or board.get('capturedAt')}
            if available(image):
                key = platform + ':' + row['id']
                previous = output.get(key)
                if not previous or datetime.fromisoformat(image['checkedAt']) > datetime.fromisoformat(previous['checkedAt']):
                    output[key] = image
    return output


def apply_catalog_covers(entries, evidence):
    for key, entry in entries.items():
        image = entry.get('image', {})
        if available(image):
            continue
        if key in evidence:
            entry['image'] = evidence[key]
        elif image.get('url') and not cover_url(image['url']):
            entry['image'] = {**image, 'url': None, 'kind': None, 'status': 'missing'}


def apply_source_covers(folder, platform, boards):
    evidence = {**source_board_covers(folder, platform), **repairs(folder, platform)}
    for board in boards:
        for row in board.get('rows', []):
            if cover_url(row.get('cover')):
                continue
            alternate = evidence.get(platform + ':' + row['id'])
            if alternate:
                row.update(cover=alternate['url'], coverSourceUrl=alternate['sourceUrl'],
                           coverKind=alternate['kind'], coverCheckedAt=alternate['checkedAt'])
            else:
                row['cover'] = ''
