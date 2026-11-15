"""Count documented core-update units, not effort, importance or atomic mechanics."""
import collections
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
source = ROOT / 'data/free-fire-patches.json'
patches = json.loads(source.read_text())
rows = []
for patch in patches:
    year = patch['publishedDate'][:4]
    if year not in ('2024', '2025'):
        continue
    for section in patch['sections']:
        table_rows = sum(len(table['rows']) for table in section.get('tables', []))
        # Five sections have tables. Their prose merely summarizes/introduces
        # those same tables; use table rows instead of double-counting prose.
        units = table_rows if table_rows else len(section.get('items', []))
        rows.append({
            'year': year, 'articleId': str(patch['articleId']),
            'publishedDate': patch['publishedDate'],
            'sectionId': section['id'], 'lane': section['lane'],
            'scope': section['scope'], 'category': section['category'],
            'title': section['title'],
            'included': section['scope'] == 'core',
            'units': units,
            'unitKind': 'table_rows' if table_rows else 'documented_items',
            'sourceUrl': patch['sourceUrl'],
        })

def summarize(selected):
    unit_counts = collections.Counter()
    section_counts = collections.Counter()
    categories = {lane: collections.Counter() for lane in ('br', 'cs', 'shared')}
    for row in selected:
        if not row['included']:
            continue
        unit_counts[row['lane']] += row['units']
        section_counts[row['lane']] += 1
        categories[row['lane']][row['category']] += row['units']
    total = sum(unit_counts.values())
    lane_total = unit_counts['br'] + unit_counts['cs']
    section_lane_total = section_counts['br'] + section_counts['cs']
    return {
        'units': dict(unit_counts), 'total_units': total,
        'unit_shares_percent': {k: round(v / total * 100, 2) for k, v in unit_counts.items()},
        'br_cs_only_unit_shares_percent': {k: round(unit_counts[k] / lane_total * 100, 2) for k in ('br', 'cs')},
        'sections': dict(section_counts),
        'br_cs_only_section_shares_percent': {k: round(section_counts[k] / section_lane_total * 100, 2) for k in ('br', 'cs')},
        'categories': {k: dict(v) for k, v in categories.items()},
    }

result = {
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'method': 'Existing dossier core sections only. Count each documented item once; table rows replace duplicative summaries in the five table-bearing sections. Preserve section-level lanes. Shared includes explicitly cross-mode and unspecified scope. Not an atomic source recoding, effort estimate or benefit allocation.',
    '2024': summarize([r for r in rows if r['year'] == '2024']),
    '2025': summarize([r for r in rows if r['year'] == '2025']),
    'combined': summarize(rows),
    'patches': {article: summarize([r for r in rows if r['articleId'] == article]) for article in dict.fromkeys(r['articleId'] for r in rows)},
}
(OUT / 'counts.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
with (OUT / 'section-audit.csv').open('w', newline='', encoding='utf-8-sig') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(json.dumps({k: result[k] for k in ('2024', '2025', 'combined')}, ensure_ascii=False, indent=2))
