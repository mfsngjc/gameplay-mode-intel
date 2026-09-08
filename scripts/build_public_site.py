#!/usr/bin/env python3
"""Create an explicit public-file allowlist; never publish local research drafts."""
from pathlib import Path
import shutil
import time

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / '_site'


def remove_output_with_retry():
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
    files = ['index.html', 'app.js', 'workspace.js', 'maps.js', 'styles.css',
             'workspace.css', 'data/modes.json', 'data/maps.json',
             'assets/favicon.svg', 'assets/lucide-LICENSE']
    for name in files:
        destination = OUTPUT / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    shutil.copytree(ROOT / 'assets/maps', OUTPUT / 'assets/maps')
    if (ROOT / 'assets/modes').exists():
        shutil.copytree(ROOT / 'assets/modes', OUTPUT / 'assets/modes')
    if (ROOT / 'assets/mode-official').exists():
        shutil.copytree(ROOT / 'assets/mode-official', OUTPUT / 'assets/mode-official')
    (OUTPUT / '.nojekyll').touch()
    assert not (OUTPUT / 'data/research.json').exists()
    assert not (OUTPUT / 'local-only').exists()
    print(f'Public site ready: {OUTPUT} (research drafts excluded)')


if __name__ == '__main__':
    main()
