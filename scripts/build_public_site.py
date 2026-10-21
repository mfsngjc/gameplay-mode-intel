#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
from pathlib import Path
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
    files = ['index.html', 'app.js', 'workspace.js', 'maps.js', 'styles.css', 'ugc.js', 'ugc.css',
             'workspace.css', 'tactical-items.css', 'tactical-items.js', 'data/tactical-items.json',
             'ff-patches.js', 'data/free-fire-patches.json', 'core-updates.js', 'data/core-updates.json', 'data/modes.json', 'data/maps.json',
             'assets/favicon.svg', 'assets/lucide-LICENSE']
    for name in files:
        destination = OUTPUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
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
    print(f'Public site ready: {OUTPUT} (research drafts excluded)')


if __name__ == '__main__':
    main()
