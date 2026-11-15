"""Build a portable research page from the nine dossiers used by the analysis."""
import collections
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
source = ROOT / 'data/free-fire-patches.json'
IDS = {'1306', '1332', '1357', '1385', '1424', '1456', '1473', '1511', '1549'}
patches = [p for p in json.loads(source.read_text()) if str(p['articleId']) in IDS]
patches.sort(key=lambda p: p['publishedDate'])
assert len(patches) == 9 and all(p['publicationStatus'] == 'ready' for p in patches)
sections = []
for p in patches:
    for s in p['sections']:
        if s['scope'] != 'core':
            continue
        rows = sum(len(t['rows']) for t in s.get('tables', []))
        sections.append({**s, 'articleId': str(p['articleId']),
            'version': p['versionNumber'], 'date': p['publishedDate'],
            'year': p['publishedDate'][:4], 'sourceUrl': p['sourceUrl'],
            'patchTiming': p['timingNote'], 'units': rows or len(s['items']),
            'unitKind': '表格行' if rows else '资料条目'})
counts = collections.Counter()
for s in sections:
    counts[s['lane']] += s['units']
assert dict(counts) == {'br': 151, 'cs': 55, 'shared': 305}, counts
data = {'snapshotDate': '2026-09-19', 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'patches': [{k: p.get(k) for k in ['articleId', 'versionNumber', 'publishedDate', 'sourceUrl', 'timingNote', 'announcedPatchDate']} for p in patches],
    'sections': sections}
(OUT / 'research-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
template = (OUT / 'template.html').read_text()
payload = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
(OUT / 'index.html').write_text(template.replace('/*__DATA__*/', 'const DATA = ' + payload + ';'))
print(f'Built {len(sections)} sections / {sum(counts.values())} units; shared={counts["shared"]}')
