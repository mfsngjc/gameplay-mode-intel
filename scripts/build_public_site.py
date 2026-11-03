#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
from pathlib import Path
import gzip
import json
import re
import shutil
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '_site'


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


def main():
    remove_output_with_retry()
    OUTPUT.mkdir()
    files = ['index.html', 'card-view.js', 'card-view.css', 'app.js', 'workspace.js', 'maps.js', 'styles.css', 'ugc.js', 'ugc.css',
             'workspace.css', 'tactical-items.css', 'tactical-items.js', 'item-demos.js', 'data/tactical-items.json',
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
                            and (ROOT / local_image).stat().st_size > 8_000_000):
                        record['imageUrl'] = original
                        record['imageSource'] = record.get('imageSource', '').replace('（本地归档）', '')
                    # Large existing cover PNGs can use their recorded official CDN.
                    # Keep originals in the checkout and retain complete FF body archives.
                    if (local_image.startswith(('assets/mode-official/', 'assets/core-updates/'))
                            and original_url.scheme == 'https'
                            and original_url.hostname in {'media.contentapi.ea.com', 'cms-assets.unrealengine.com', 'clan.fastly.steamstatic.com'}
                            and (ROOT / local_image).is_file()
                            and (ROOT / local_image).stat().st_size > 4_000_000):
                        record['imageUrl'] = original
                        record['imageSource'] = record.get('imageSource', '').replace('（本地归档）', '')
            destination.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        else:
            shutil.copy2(source, destination)
    for name in ['ugc-catalog.js', 'ugc-catalog-worker.js']:
        if (ROOT / name).exists():
            shutil.copy2(ROOT / name, OUTPUT / name)
    for name in ['latest.json', 'index.json', 'briefing.json', 'chinese.json', 'creators.json']:
        source = ROOT / 'data/ugc' / name
        if source.exists():
            destination = OUTPUT / 'data/ugc' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps(json.loads(source.read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for source in sorted((ROOT / 'data/ugc/history').glob('????-??-??.json')):
        destination = OUTPUT / 'data/ugc/history' / source.name
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
    shutil.copytree(ROOT / 'assets/maps', OUTPUT / 'assets/maps')
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
    shutil.copytree(ROOT / 'assets/tactical-items', OUTPUT / 'assets/tactical-items')
    if (ROOT / 'assets/weapon-skins').exists():
        shutil.copytree(ROOT / 'assets/weapon-skins', OUTPUT / 'assets/weapon-skins', ignore=unused_covers)
    if (ROOT / 'assets/tactical-demos').exists():
        shutil.copytree(ROOT / 'assets/tactical-demos', OUTPUT / 'assets/tactical-demos')
    shutil.copytree(ROOT / 'assets/ff-patches', OUTPUT / 'assets/ff-patches')
    shutil.copytree(ROOT / 'docs/free-fire-patches', OUTPUT / 'docs/free-fire-patches')
    (OUTPUT / '.nojekyll').touch()
    assert not (OUTPUT / 'data/research.json').exists()
    assert not (OUTPUT / 'local-only').exists()
    assert not (OUTPUT / 'data/ugc/catalog-cache').exists()
    total_bytes = sum(path.stat().st_size for path in OUTPUT.rglob('*') if path.is_file())
    if total_bytes > 1_000_000_000:
        raise RuntimeError(f'Public site exceeds GitHub Pages 1 GB limit: {total_bytes} bytes')
    print(f'Public site ready: {OUTPUT} ({total_bytes:,} bytes; catalog shards gzip-compressed)')


if __name__ == '__main__':
    main()
