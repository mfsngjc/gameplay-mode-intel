#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '_site'


def main():
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    files = ['index.html', 'app.js', 'workspace.js', 'maps.js', 'styles.css',
             'workspace.css', 'data/modes.json', 'data/maps.json',
             'assets/favicon.svg', 'assets/lucide-LICENSE']
    for name in files:
        destination = OUTPUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    shutil.copytree(ROOT / 'assets/maps', OUTPUT / 'assets/maps')
    (OUTPUT / '.nojekyll').touch()
    assert not (OUTPUT / 'data/research.json').exists()
    assert not (OUTPUT / 'local-only').exists()
    print(f'Public site ready: {OUTPUT} (research drafts excluded)')


if __name__ == '__main__':
    main()
