#!/usr/bin/env python3
"""Publish verified Bilibili inspect references separately from skin identities.

An author-titled video is useful even when its English blueprint is unresolved.
Only reviewed associations enter a blueprint's media list. No video is copied.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/weapon-skins/call-of-duty.json'
CANDIDATES = ROOT / 'local-only/weapon-skins/cod-pc/bilibili-inspect-candidates.json'
REVIEW = ROOT / 'data/weapon-skins/cod-inspect-review.json'


def atomic(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def build_library(candidates, skins, review):
    records = candidates['candidates']
    if (candidates['coverage']['individuallyVerifiedCount'] != len(records)
            or not candidates['coverage']['seriesIndexComplete']):
        raise ValueError('Only an individually verified, complete collection can replace the successful library')
    if len({row['bvid'] for row in records}) != len(records):
        raise ValueError('Duplicate Bilibili identity')
    by_id = {skin['id']: skin for skin in skins}
    reviewed = {item['bvid']: item for item in review['reviews']}
    library = []
    for row in records:
        if row['metadataVerification'] != 'individual_view_api' or not row['inspect']['titleExplicit']:
            raise ValueError('Unverified inspect reference: ' + row['bvid'])
        pages = row['pages']
        sources = [{key: source[key] for key in ['url', 'retrievedAt', 'sha256', 'jsonPath'] if key in source}
                   for source in row['sourceEvidence']]
        item = {'id': 'cod-inspect-' + row['bvid'], 'provider': 'bilibili', 'kind': 'inspect',
            'publicationStatus': 'ready', 'videoId': row['bvid'], 'url': row['url'], 'title': row['title'],
            'name': row['blueprint']['nameZh'], 'nameStatus': 'uploader_title_not_verified_official_localization',
            'thumbnailUrl': row['cover']['url'], 'thumbnailKind': 'video_poster',
            'sourcePageUrl': row['url'], 'sourceName': row['owner']['name'], 'sourceType': 'community',
            'creatorId': str(row['owner']['mid']), 'publishedDate': row['publishedAt'][:10],
            'duration': row['duration'], 'cid': pages[0]['cid'],
            'pages': [{'page': page['page'], 'cid': page['cid'], 'title': page['part']} for page in pages],
            'gameTitle': row['game']['name'] + ' / ' + row['game']['codLabel'], 'gameEdition': row['game']['id'],
            'reviewStatus': 'source_confirmed', 'reviewedAt': max(source['retrievedAt'] for source in sources),
            'reviewNote': '原作者标题明确为特殊检视；已核实投稿身份及所属作品，未宣称全部逐帧核验。',
            'sourceEvidence': sources, 'associatedSkinIds': [],
            'rightsNote': '保留作者、真实封面和原站链接，通过原站观看；未下载或转存平台视频。'}
        visual = reviewed.get(row['bvid'], {})
        if visual and (visual['cid'] != pages[0]['cid'] or visual['coverEvidence']['url'] != row['cover']['url']):
            raise ValueError('Creator video or reviewed cover changed; identity review required: ' + row['bvid'])
        if visual.get('weaponType') in ['gun', 'melee']:
            item.update(weaponType=visual['weaponType'], classificationEvidence=visual['classificationEvidence'])
        if visual.get('recommendedSkinId'):
            association = dict(visual, reviewedAt=review['reviewedAt'])
            skin = by_id.get(visual['recommendedSkinId'])
            key = lambda value: re.sub(r'[^a-z0-9]', '', value.casefold())
            if not skin or key(skin['weaponEnglishName']) != key(visual['baseWeapon']) or skin['weaponType'] != visual['weaponType']:
                raise ValueError('Reviewed blueprint identity is missing or changed: ' + row['bvid'])
            if skin['publicationStatus'] == 'ready':
                item.update(associatedSkinIds=[skin['id']], weaponId=skin['weaponId'], weaponType=skin['weaponType'],
                            searchAliases=[skin['name'], skin['englishName'], skin['weaponName']])
                media = {key: item[key] for key in ['provider', 'kind', 'url', 'title', 'thumbnailUrl', 'sourcePageUrl',
                         'sourceName', 'sourceType', 'reviewStatus', 'reviewedAt', 'publishedDate', 'cid', 'sourceEvidence', 'rightsNote']}
                media.update(id='bilibili-' + row['bvid'], videoId=row['bvid'],
                    reviewNote='原作者标题明确为特殊检视。蓝图对应关系已按封面、首帧、单件图和官方商城交叉核对；未逐帧核验全部动作。',
                    associationEvidence=association)
                skin['media'] = [old for old in skin['media'] if old['id'] != media['id']] + [media]
                skin['searchAliases'] = list(dict.fromkeys(skin.get('searchAliases', []) + [row['blueprint']['nameZh'], row['title'], 'COD21']))
                skin['mediaAssociationNote'] = '视频中文名“' + row['blueprint']['nameZh'] + '”沿用原作者标题，未宣称是官方本地化名称。'
        library.append(item)
    return library


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    command = [sys.executable, str(ROOT / 'scripts/research_weapon_cod_bilibili.py')]
    if args.offline:
        command.append('--offline')
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError('Bilibili evidence unavailable; previous catalogue preserved: ' + result.stderr[-500:])
    document = json.loads(OUT.read_text(encoding='utf-8'))
    candidates = json.loads(CANDIDATES.read_text(encoding='utf-8'))
    review = json.loads(REVIEW.read_text(encoding='utf-8'))
    library = build_library(candidates, document['skins'], review)
    document['inspectionLibrary'] = library
    document['source']['bilibiliInspectionCollection'] = {
        'name': '光辉者UNS-08 · COD21特殊检视合集', 'url': candidates['seedUrl'],
        'seriesId': candidates['coverage']['seriesId'], 'count': len(library),
        'retrievedAt': candidates['generatedFromRetrievedAt'],
        'scope': '原作者单件标题合集，不是全COD端游动作库；中文名未全部核实官方本地化。'}
    ready = [skin for skin in document['skins'] if skin['publicationStatus'] == 'ready']
    document['coverage'].update(inspectionLibraryCount=len(library),
        inspectionLinkedVideoCount=sum(bool(item['associatedSkinIds']) for item in library),
        withVideoCount=sum(any(media['provider'] in ['mp4', 'bilibili', 'youtube'] for media in skin['media']) for skin in ready),
        withInspectCount=sum(any(media['kind'] == 'inspect' for media in skin['media']) for skin in ready),
        mediaScope='原作者特殊检视合集单独展示；只有交叉核实对应蓝图者关联至详情，未匹配的视频不重复计入皮肤数量。')
    document['updatedAt'] = max(document['updatedAt'], candidates['generatedFromRetrievedAt'])
    atomic(OUT, document)
    print(json.dumps({'library': len(library), 'linked': document['coverage']['inspectionLinkedVideoCount'],
                      'skins': len(ready), 'offline': args.offline}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
