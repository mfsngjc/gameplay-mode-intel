#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
import argparse
from html import escape
from pathlib import Path
import gzip
from io import BytesIO
import json
import re
import shutil
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '_site'
PACKED_GAME_CATALOG = {
    'data/shooter-game-media.json',
    'data/shooter-game-metrics.json',
    'data/steam-player-history.json',
}


def ugc_entry_bucket(entry_id):
    # Keep this in sync with UGCCatalog.entryBucket(). IDs are ASCII.
    result = 0
    for character in entry_id:
        result = (31 * result + ord(character)) % 64
    return f'{result:02x}'


def write_ugc_entry_indexes(platforms):
    for platform, shards in platforms.items():
        if not re.fullmatch(r'[a-z0-9-]+', platform):
            raise RuntimeError('Invalid UGC platform: ' + platform)
        entries = {f'{number:02x}': {} for number in range(64)}
        for filename, entry_ids in shards.items():
            for entry_id in entry_ids:
                if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', entry_id):
                    raise RuntimeError('Invalid UGC entry ID: ' + entry_id)
                bucket = entries[ugc_entry_bucket(entry_id)]
                if entry_id in bucket:
                    raise RuntimeError('Duplicate UGC entry ID: ' + platform + ':' + entry_id)
                bucket[entry_id] = filename
        base = OUTPUT / 'data/ugc/catalog/entry-index' / platform
        base.mkdir(parents=True, exist_ok=True)
        for name, bucket in entries.items():
            encoded = json.dumps(bucket, separators=(',', ':')).encode('utf-8')
            (base / (name + '.json.gz')).write_bytes(gzip.compress(encoded, mtime=0))


def remove_output_with_retry():
    if OUTPUT.resolve().parent != ROOT.resolve() or OUTPUT.is_symlink():
        raise RuntimeError('Public output must remain directly inside the project')
    if not OUTPUT.exists():
        return
    last_error = None
    for attempt in range(6):
        try:
            shutil.rmtree(OUTPUT)
            return
        except OSError as error:
            last_error = error
            if attempt == 5:
                raise
            time.sleep(0.2 * (attempt + 1))
    if last_error:
        raise last_error


def prepare_game_catalog_covers(payload):
    from PIL import Image, ImageOps

    # Keep the official archive untouched and generate smaller public card images.
    for record in payload['games'].values():
        cover = Path(record['cover'])
        if cover.parts[:2] != ('assets', 'game-catalog') or '..' in cover.parts:
            raise RuntimeError('Unexpected game catalogue cover: ' + str(cover))
        source = ROOT / cover
        encoded = BytesIO()
        with Image.open(source) as original:
            if not getattr(original, 'is_animated', False):
                image = ImageOps.exif_transpose(original)
                image.thumbnail((800, 450), Image.Resampling.LANCZOS)
                image.save(encoded, format='WEBP', quality=77, icc_profile=image.info.get('icc_profile'))
        if 0 < encoded.tell() < source.stat().st_size:
            cover = cover.with_name('public-cover.webp')
            record['cover'] = cover.as_posix()
            destination = OUTPUT / cover
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(encoded.getvalue())
        else:
            destination = OUTPUT / cover
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def validate_game_update_notes(payload):
    if payload.get('schemaVersion') != 1 or not isinstance(payload.get('updates'), dict):
        raise RuntimeError('Invalid Chinese game announcement file')
    images = set()
    for source, note in payload['updates'].items():
        details = note.get('details')
        if urlsplit(source).scheme != 'https' or not isinstance(details, list) or not details:
            raise RuntimeError('Missing game announcement details or source: ' + source)
        for text in [note.get('title'), note.get('brief'), *details]:
            # Chinese notes can include official model names and identifiers.
            if not isinstance(text, str) or not re.search(r'[\u3400-\u9fff]', text):
                raise RuntimeError('Game announcement must be written in Chinese: ' + source)
        image = note.get('image')
        if image is None:
            continue
        if not isinstance(image, dict) or image.get('kind') not in {'cover', 'body', 'version'}:
            raise RuntimeError('Invalid announcement image type: ' + source)
        for key in ('source', 'assetSource'):
            url = urlsplit(image.get(key, ''))
            if url.scheme != 'https' or not url.hostname:
                raise RuntimeError('Missing official announcement image source: ' + source)
        path = image.get('path', '')
        if not re.fullmatch(r'assets/game-catalog/announcements/[a-f0-9]{24}\.webp', path) or not (ROOT / path).is_file():
            raise RuntimeError('Missing local announcement image: ' + source)
        images.add(path)
    return images


def optimize_published_update_covers():
    from PIL import Image

    for path in (OUTPUT / 'assets/core-updates').glob('*.png'):
        original_size = path.stat().st_size
        if original_size < 1_000_000:
            continue
        with Image.open(path) as image:
            if image.is_animated or image.info.keys() - {'icc_profile', 'transparency', 'dpi'}:
                continue
            result = BytesIO()
            image.save(result, format='PNG', optimize=True, **image.info)
        if result.tell() < original_size:
            path.write_bytes(result.getvalue())


def write_site_metadata(site_url):
    url = urlsplit(site_url)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.query or url.fragment or not re.fullmatch(r'(?:/[\w.-]+)*/', url.path)):
        raise ValueError('The public site URL must be an HTTPS directory URL ending in /')

    index = OUTPUT / 'index.html'
    html = index.read_text(encoding='utf-8')
    address = escape(site_url, quote=True)
    metadata = (
        f'  <link rel="canonical" href="{address}">\n'
        f'  <meta property="og:url" content="{address}">\n'
    )
    html = html.replace('</head>', metadata + '</head>', 1)
    html = html.replace(
        '<a href="https://mfsngjc.github.io/gameplay-mode-intel/">mfsngjc.github.io</a>',
        f'<a href="{address}">{escape(url.hostname)}</a>', 1)
    index.write_text(html, encoding='utf-8')
    (OUTPUT / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{address}</loc></url>\n'
        '</urlset>\n',
        encoding='utf-8',
    )


def main(site_url=None):
    remove_output_with_retry()
    OUTPUT.mkdir()
    files = ['index.html', 'card-view.js', 'card-view.css', 'app.js', 'workspace.js', 'maps.js', 'styles.css', 'ugc.js', 'ugc.css',
             'workspace.css', 'mode-library.css', 'catalogue-theme.css', 'catalogue-navigation.js', 'mode-library.js', 'game-catalog.js', 'steam-activity.js', 'data/shooter-games.json', 'data/shooter-game-media.json',
             'data/shooter-game-metrics.json', 'data/steam-charts.json', 'data/steam-player-history.json',
             'data/shooter-game-updates-zh.json', 'timeline-players.js', 'data/timeline-player-history.json',
             'tactical-items.css', 'tactical-items.js', 'item-demos.js', 'data/tactical-items.json',
             'gun-catalog.js', 'gun-viewer.js', 'gun-model-stage.js', 'gun-glb-viewer.js', 'gun-catalog.css',
             'data/gun-catalog.json', 'data/gun-catalog-valorant.json', 'data/gun-catalog-cod-mw4.json',
             'weapon-skins.js', 'weapon-skins.css', 'data/weapon-skins/manifest.json',
             'data/weapon-skins/valorant.json', 'data/weapon-skins/cs2.json', 'data/weapon-skins/delta-force.json',
             'data/weapon-skins/call-of-duty.json', 'data/weapon-skins/apex.json',
             'data/weapon-skins/cod-mobile.json', 'data/weapon-skins/cf-mobile.json', 'data/weapon-skins/cfhd.json',
             'ff-patches.js', 'data/free-fire-patches.json', 'core-updates.js', 'data/core-updates.json', 'data/modes.json', 'data/maps.json',
             'assets/favicon.svg', 'assets/lucide-LICENSE']
    public_weapon_references = []
    for name in files:
        destination = OUTPUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        source = ROOT / name
        if source.suffix == '.json':
            payload = json.loads(source.read_text(encoding='utf-8'))
            if name == 'data/shooter-game-media.json':
                prepare_game_catalog_covers(payload)
            if name == 'data/shooter-game-updates-zh.json':
                for image in validate_game_update_notes(payload):
                    picture = OUTPUT / image
                    picture.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ROOT / image, picture)
            if name == 'data/weapon-skins/manifest.json':
                for game in payload['games']:
                    expected = 'data/weapon-skins/' + game['id'] + '.json'
                    if game['url'] != expected or expected not in files:
                        raise RuntimeError('Unlisted weapon catalogue: ' + game['url'])
                    game['url'] += '.gz'
                    game['encoding'] = 'gzip'
            elif name.startswith('data/weapon-skins/'):
                payload['skins'] = [{key: value for key, value in skin.items() if key != 'pendingChromas'}
                    for skin in payload['skins'] if skin.get('publicationStatus') == 'ready']
                for local_field in ['historicalSkins', 'retainedHistorical', 'pendingSkins', 'pendingChromas']:
                    payload.pop(local_field, None)
                encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
                public_weapon_references.append(encoded)
                destination.with_suffix('.json.gz').write_bytes(gzip.compress(encoded.encode('utf-8'), mtime=0))
                continue
            if name == 'data/modes.json':
                other_references = '\n'.join((ROOT / file).read_text(encoding='utf-8')
                    for file in files if file != name and Path(file).suffix in {'.json', '.js', '.html', '.css'})
                for mode in payload:
                    local_image = mode.get('imageUrl', '')
                    original = mode.get('imageOriginalUrl', '')
                    original_url = urlsplit(original)
                    if (mode.get('game') == 'Fortnite' and local_image.startswith('assets/mode-official/')
                            and local_image.lower().endswith('.gif') and original_url.scheme == 'https'
                            and original_url.hostname == 'cdn2.unrealengine.com'
                            and original_url.path.lower().endswith('.gif')
                            and (ROOT / local_image).stat().st_size > 10_000_000
                            and local_image not in other_references
                            and sum(item.get('imageUrl') == local_image for item in payload) == 1):
                        # Keep the untouched local archive; public covers may use verified official CDNs.
                        mode['imageUrl'] = original
                        mode['imageSource'] = mode.get('imageSource', '').replace('（本地归档）', '')
            if name in {'data/modes.json', 'data/core-updates.json'}:
                for record in payload:
                    local_image = record.get('imageUrl', '')
                    original = record.get('imageAssetSourceUrl') or record.get('imageOriginalUrl', '')
                    original_url = urlsplit(original)
                    # Garena's large still covers remain archived unchanged locally.
                    # Public cards load the same original bytes from the official CDN.
                    if (record.get('game') == '三角洲行动'
                            and local_image.startswith(('assets/mode-official/', 'assets/core-updates/'))
                            and original_url.scheme == 'https'
                            and original_url.hostname == 'web.df.garena.com'
                            and (ROOT / local_image).is_file()
                            and (ROOT / local_image).stat().st_size > 6_000_000):
                        record['imageUrl'] = original
                        record['imageSource'] = record.get('imageSource', '').replace('（本地归档）', '')
                    # Large existing cover PNGs can use their recorded official CDN.
                    # Keep originals in the checkout and retain complete FF body archives.
                    official_cover_limits = {
                        'media.contentapi.ea.com': 4_000_000,
                        'cms-assets.unrealengine.com': 4_000_000,
                        'clan.fastly.steamstatic.com': 2_800_000,
                        'pubgmobile.jp': 4_000_000,
                    }
                    limit = official_cover_limits.get(original_url.hostname)
                    if (limit is not None
                            and local_image.startswith(('assets/mode-official/', 'assets/core-updates/'))
                            and original_url.scheme == 'https'
                            and (ROOT / local_image).is_file()
                            and (ROOT / local_image).stat().st_size > limit):
                        record['imageUrl'] = original
                        record['imageSource'] = record.get('imageSource', '').replace('（本地归档）', '')
            encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            if name in PACKED_GAME_CATALOG:
                destination.with_suffix('.json.gz').write_bytes(gzip.compress(encoded, mtime=0))
            else:
                destination.write_bytes(encoded)
        elif name == 'index.html':
            html = source.read_text(encoding='utf-8')
            destination.write_text(html.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-game-catalog-encoding="gzip">', 1),
                                   encoding='utf-8')
        else:
            shutil.copy2(source, destination)
    for name in ['ugc-catalog.js', 'ugc-catalog-worker.js', 'ugc-covers.js', 'ugc-source-boards.js']:
        if (ROOT / name).exists():
            shutil.copy2(ROOT / name, OUTPUT / name)
    for name in ['latest.json', 'index.json', 'briefing.json', 'chinese.json', 'creators.json', 'board-categories.json']:
        source = ROOT / 'data/ugc' / name
        if source.exists():
            destination = OUTPUT / 'data/ugc' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps(json.loads(source.read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for source in sorted((ROOT / 'data/ugc/history').glob('????-??-??.json')):
        destination = OUTPUT / 'data/ugc/history' / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(json.loads(source.read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for platform in ('cs2', 'roblox', 'fortnite', 'minecraft'):
        name = 'data/ugc/source-boards/' + platform + '.json'
        source = ROOT / name
        if source.is_file():
            destination = OUTPUT / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps(json.loads(source.read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    catalog_root = (ROOT / 'data/ugc/catalog').resolve()
    catalog_manifest = catalog_root / 'manifest.json'
    if catalog_manifest.exists():
        catalog = json.loads(catalog_manifest.read_text(encoding='utf-8'))
        public_catalog_files = set()
        detail_paths = {}
        lookup_shards = {platform: {} for platform in catalog.get('platforms', {})}
        if catalog.get('boardCoversUrl'):
            public_catalog_files.add(catalog['boardCoversUrl'])
        for platform_id, platform in catalog.get('platforms', {}).items():
            for group in ('shards', 'searchShards'):
                for shard in platform.get(group, []):
                    public_catalog_files.add(shard['url'])
                    if group == 'shards':
                        detail_paths[shard['url']] = platform_id
                    shard['url'] += '.gz'
        for name in sorted(public_catalog_files):
            relative = Path(name)
            source = (ROOT / relative).resolve()
            if (relative.is_absolute() or '..' in relative.parts or '\\' in name or
                    source.suffix != '.json' or not source.is_relative_to(catalog_root) or not source.is_file()):
                raise RuntimeError('Invalid public catalog reference: ' + name)
            payload = json.loads(source.read_text(encoding='utf-8'))
            entries = payload.get('entries', [])
            if name in detail_paths:
                lookup_shards[detail_paths[name]][relative.name + '.gz'] = [entry['id'] for entry in entries]
            if isinstance(entries, list):
                for entry in entries:
                    if entry.get('detailShard'):
                        if entry['detailShard'] not in public_catalog_files:
                            raise RuntimeError('Unlisted catalog detail reference: ' + entry['detailShard'])
                        entry['detailShard'] += '.gz'
            compressed = name != catalog.get('boardCoversUrl')
            destination = OUTPUT / (name + '.gz' if compressed else name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            destination.write_bytes(gzip.compress(encoded, mtime=0) if compressed else encoded)
        manifest_destination = OUTPUT / 'data/ugc/catalog/manifest.json'
        manifest_destination.parent.mkdir(parents=True, exist_ok=True)
        manifest_destination.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        write_ugc_entry_indexes(lookup_shards)
    map_plan_folder = 'assets/maps/2d-plans'
    public_maps = json.loads((OUTPUT / 'data/maps.json').read_text(encoding='utf-8'))
    published_map_plans = {
        value for entry in public_maps for value in entry.values()
        if isinstance(value, str) and value.startswith(map_plan_folder + '/')
    }

    def unused_map_plans(directory, names):
        if Path(directory) != ROOT / map_plan_folder:
            return []
        return [name for name in names if map_plan_folder + '/' + name not in published_map_plans]

    shutil.copytree(ROOT / 'assets/maps', OUTPUT / 'assets/maps', ignore=unused_map_plans)
    # Cover paths are explicit in data/code. Do not publish abandoned covers or draft SVGs.
    reference_files = [path for path in OUTPUT.rglob('*') if path.is_file() and path.suffix in {'.json', '.js', '.html', '.css'}]
    reference_files += list((ROOT / 'docs/free-fire-patches').glob('*.md'))
    cover_references = ('\n'.join(path.read_text(encoding='utf-8') for path in reference_files) +
                        '\n' + '\n'.join(public_weapon_references)).lower()
    def unused_covers(directory, names):
        return [name for name in names if (Path(directory) / name).is_file()
                and Path(name).suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'}
                and (Path(directory) / name).relative_to(ROOT).as_posix().lower() not in cover_references]
    for name in ['assets/modes', 'assets/mode-official', 'assets/core-updates']:
        if (ROOT / name).exists():
            shutil.copytree(ROOT / name, OUTPUT / name, ignore=unused_covers)
    optimize_published_update_covers()
    shutil.copytree(ROOT / 'assets/tactical-items', OUTPUT / 'assets/tactical-items')
    if (ROOT / 'assets/weapon-skins').exists():
        shutil.copytree(ROOT / 'assets/weapon-skins', OUTPUT / 'assets/weapon-skins', ignore=unused_covers)
    if (ROOT / 'assets/tactical-demos').exists():
        shutil.copytree(ROOT / 'assets/tactical-demos', OUTPUT / 'assets/tactical-demos')
    shutil.copytree(ROOT / 'assets/ff-patches', OUTPUT / 'assets/ff-patches')
    shutil.copytree(ROOT / 'docs/free-fire-patches', OUTPUT / 'docs/free-fire-patches')
    (OUTPUT / '.nojekyll').touch()
    if site_url:
        write_site_metadata(site_url)
    assert not (OUTPUT / 'data/research.json').exists()
    assert not (OUTPUT / 'local-only').exists()
    assert not (OUTPUT / 'data/ugc/catalog-cache').exists()
    total_bytes = sum(path.stat().st_size for path in OUTPUT.rglob('*') if path.is_file())
    if total_bytes > 1_000_000_000:
        raise RuntimeError(f'Public site exceeds GitHub Pages 1 GB limit: {total_bytes} bytes')
    print(f'Public site ready: {OUTPUT} ({total_bytes:,} bytes; catalog shards gzip-compressed)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-url', help='Canonical HTTPS directory URL for a custom deployment')
    main(parser.parse_args().site_url)
