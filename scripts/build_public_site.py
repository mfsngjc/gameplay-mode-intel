#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
from pathlib import Path
import gzip
import json
import shutil
import time

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '_site'


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
             'workspace.css', 'tactical-items.css', 'tactical-items.js', 'data/tactical-items.json',
             'ff-patches.js', 'data/free-fire-patches.json', 'core-updates.js', 'data/core-updates.json', 'data/modes.json', 'data/maps.json',
             'assets/favicon.svg', 'assets/lucide-LICENSE']
    for name in files:
        destination = OUTPUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    for name in ['ugc-catalog.js', 'ugc-catalog-worker.js']:
        if (ROOT / name).exists():
            shutil.copy2(ROOT / name, OUTPUT / name)
    for name in ['latest.json', 'index.json', 'briefing.json', 'chinese.json', 'creators.json']:
        source = ROOT / 'data/ugc' / name
        if source.exists():
            destination = OUTPUT / 'data/ugc' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    for source in sorted((ROOT / 'data/ugc/history').glob('????-??-??.json')):
        destination = OUTPUT / 'data/ugc/history' / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    catalog_root = (ROOT / 'data/ugc/catalog').resolve()
    catalog_manifest = catalog_root / 'manifest.json'
    if catalog_manifest.exists():
        catalog = json.loads(catalog_manifest.read_text(encoding='utf-8'))
        public_catalog_files = set()
        if catalog.get('boardCoversUrl'):
            public_catalog_files.add(catalog['boardCoversUrl'])
        for platform in catalog.get('platforms', {}).values():
            for group in ('shards', 'searchShards'):
                for shard in platform.get(group, []):
                    public_catalog_files.add(shard['url'])
                    shard['url'] += '.gz'
        for name in sorted(public_catalog_files):
            relative = Path(name)
            source = (ROOT / relative).resolve()
            if (relative.is_absolute() or '..' in relative.parts or '\\' in name or
                    source.suffix != '.json' or not source.is_relative_to(catalog_root) or not source.is_file()):
                raise RuntimeError('Invalid public catalog reference: ' + name)
            payload = json.loads(source.read_text(encoding='utf-8'))
            entries = payload.get('entries', [])
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
    shutil.copytree(ROOT / 'assets/maps', OUTPUT / 'assets/maps')
    if (ROOT / 'assets/modes').exists():
        shutil.copytree(ROOT / 'assets/modes', OUTPUT / 'assets/modes')
    if (ROOT / 'assets/mode-official').exists():
        shutil.copytree(ROOT / 'assets/mode-official', OUTPUT / 'assets/mode-official')
    shutil.copytree(ROOT / 'assets/core-updates', OUTPUT / 'assets/core-updates')
    shutil.copytree(ROOT / 'assets/tactical-items', OUTPUT / 'assets/tactical-items')
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
