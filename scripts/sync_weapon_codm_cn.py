#!/usr/bin/env python3
"""Reconcile published CODM China blueprint articles with the existing global catalogue.

Follow the official site's actual next-page links. Only standalone weapon-name
sections with decoded images become records; characters, throwables and base
weapon guides do not. Anonymous public articles are read without game login.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import urljoin, urlsplit

from sync_weapon_codm import Tree, Node, text, clean, slug, atomic

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'local-only/weapon-skins/cod-mobile-cn'
OUT = ROOT / 'data/weapon-skins/cod-mobile.json'
INDEX = 'https://codm.qq.com/gicp/news/886/2/19485/1.html'
HOME = 'https://codm.qq.com/main.shtml'
PARSER_VERSION = 6
RARITY = {'神话': ('mythic', '#bf403d'), '传说': ('legendary', '#c18426'), '史诗': ('epic', '#9563c9'),
          '典藏': ('legacy', '#b94d31'), '稀有': ('rare', '#4386bc'), '精良': ('uncommon', '#438f5c')}
MELEE = {'战术刀', '折叠刀', '蝴蝶刀', '突击刀', '武士刀', '双截棍', '棒球棍', '铲子', '拳套', '扳手',
         '双持短剑', '斧头', '镰刀', '唐刀', '钗', '双刃剑', '军用铲', '马来剑',
         '爪刀', '军用斧', '战术近战', '荧光棒', '龙泉剑', '扇', '蛇刃'}
EXCLUDED = re.compile('角色|挂饰|载具|投掷|手雷|烟雾|绊雷|背包|名片|头像|降落伞|卡车|表情|军犬|终极技能')
ACTION = [('inspect', '检视'), ('reload', '换弹|装填'), ('fire', '枪焰|开火|枪口'),
          ('finisher', '消灭特效|击杀特效|死亡特效'), ('equip', '切枪|切出|收起'), ('ads', '开镜|瞄准|机瞄')]


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def key(value):
    return re.sub(r'[\s\W_]+', '', value).casefold()


def https(value, base=HOME):
    url = urljoin(base, value)
    p = urlsplit(url)
    if p.scheme != 'https' or p.username or p.password:
        raise ValueError('Unsafe public source URL')
    return url


class Fetcher:
    def __init__(self, offline=False, refresh=False):
        self.offline, self.refresh = offline, refresh
        self.curl = shutil.which('curl.exe') or 'curl'

    def request(self, url, limit=35000000):
        result = subprocess.run([self.curl, '--fail', '--location', '--silent', '--show-error', '--compressed',
            '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '10', '--max-time', '40',
            '--max-filesize', str(limit), '--referer', HOME, url], capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.decode('utf-8', 'replace').strip()[:240])
        return result.stdout

    def article(self, url):
        if urlsplit(url).hostname != 'codm.qq.com':
            raise ValueError('Unlisted official article host')
        ident = hashlib.sha256(url.encode()).hexdigest()[:24]
        destination = CACHE / 'pages' / (ident + '.json')
        if destination.exists() and (self.offline or not self.refresh):
            cached = json.loads(destination.read_text(encoding='utf-8'))
            if cached['url'] != url:
                raise ValueError('Source cache identity mismatch')
            return cached
        if self.offline:
            raise RuntimeError('No successful offline article cache: ' + url)
        raw = self.request(url)
        encoding = re.search(br'charset\s*=\s*[\x22\x27]?([\w-]+)', raw[:4096], re.I)
        source = raw.decode(encoding.group(1).decode() if encoding else 'utf-8', 'replace')
        if '<title>' not in source or len(raw) < 2000:
            raise RuntimeError('No usable official article')
        cached = {'url': url, 'retrievedAt': now(), 'sha256': hashlib.sha256(raw).hexdigest(),
                  'bytes': len(raw), 'html': source}
        atomic(destination, cached)
        return cached

    def image(self, url):
        from PIL import Image
        host = urlsplit(url).hostname or ''
        if not any(host == domain or host.endswith('.' + domain) for domain in ['qpic.cn', 'gtimg.cn', 'qq.com']):
            raise ValueError('Unlisted image source host: ' + host)
        destination = CACHE / 'image-checks' / (hashlib.sha256(url.encode()).hexdigest()[:24] + '.json')
        if destination.exists() and (self.offline or not self.refresh):
            return json.loads(destination.read_text(encoding='utf-8'))
        if self.offline:
            raise RuntimeError('No offline decoded image check: ' + url)
        raw = self.request(url)
        with Image.open(BytesIO(raw)) as image:
            width, height, fmt, frames = image.width, image.height, image.format, getattr(image, 'n_frames', 1)
            image.seek(0)
            image.load()
        if width < 120 or height < 65:
            raise ValueError('Small decorative image')
        meta = {'url': url, 'retrievedAt': now(), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                'width': width, 'height': height, 'format': fmt, 'frameCount': frames,
                'mimeType': Image.MIME.get(fmt, 'image/' + fmt.lower())}
        atomic(destination, meta)
        return meta


def discover(fetcher, max_pages):
    url, seen, pages, articles = INDEX, set(), [], {}
    complete = False
    while url:
        if url in seen:
            raise RuntimeError('Official pagination cycle')
        if len(pages) >= max_pages:
            break
        seen.add(url)
        page = fetcher.article(url)
        tree = Tree(page['html'])
        scope = next((node for node in tree.root.walk() if node.attrs.get('id') == 'news-list'), None)
        if scope is None:
            raise RuntimeError('Official list lost its news container')
        found = []
        for node in scope.walk():
            href = node.attrs.get('href', '')
            if node.tag == 'a' and re.fullmatch(r'/gicp/news/\d+/\d+\.html', href):
                link = https(href)
                articles[link] = {'url': link, 'title': clean(text(node)), 'indexUrl': url}
                found.append(link)
        if not found:
            raise RuntimeError('Empty official list page')
        if any(page_item['articleIds'] == found for page_item in pages):
            raise RuntimeError('Official pagination repeated earlier records')
        pages.append({'url': url, 'retrievedAt': page['retrievedAt'], 'sha256': page['sha256'], 'articleIds': found})
        next_links = [https(node.attrs['href']) for node in tree.root.walk() if node.tag == 'a' and node.attrs.get('href')
                      and ('laypage_next' in node.attrs.get('class', '') or clean(text(node)) == '下一页')]
        if not next_links:
            complete = True
            break
        url = next_links[0]
        if not re.fullmatch(r'/gicp/news/886/2/19485/\d+\.html', urlsplit(url).path):
            raise RuntimeError('Unlisted next-page route')
        if len(pages) % 25 == 0:
            atomic(CACHE / 'discovery-progress.json', {'pages': pages, 'articles': list(articles.values()), 'complete': False})
            print(json.dumps({'phase': 'official_index', 'pages': len(pages), 'articles': len(articles)}), flush=True)
        if not fetcher.offline:
            time.sleep(.12)
    report = {'pages': pages, 'articles': list(articles.values()), 'complete': complete}
    atomic(CACHE / 'index.json', report)
    return report


def weapons(previous):
    aliases = {}
    for item in previous.get('skins', []):
        if item['id'].startswith('codm-cn-'):
            continue
        for label in [item['weaponName'], item.get('weaponEnglishName', '')]:
            if label:
                aliases[key(label)] = {'id': item['weaponId'], 'name': item['weaponName'], 'type': item['weaponType'], 'category': item['category']}
    # Preserve China-local weapon names rather than guessing cross-region aliases.
    for label in ['DR MK2', 'SMG5', 'AKS 74U', 'FHJ18毒刺', 'SA80']:
        aliases.setdefault(key(label), {'id': 'codm-cn-base-' + slug(label), 'name': label,
            'type': 'gun', 'category': '枪械'})
    for label in MELEE:
        aliases[key(label)] = {'id': 'codm-cn-melee-' + hashlib.sha256(label.encode()).hexdigest()[:8],
            'name': label, 'type': 'melee', 'category': '近战武器'}
    return aliases


def named_weapon(value, aliases, allow_local=False, melee=False):
    value = clean(value).strip('【】[]：:')
    value = re.sub(r'^(?:神话|传说|史诗|典藏|稀有|精良)(?:级|品质)?(?:武器)?(?:蓝图)?[：: ]*', '', value)
    if len(value) > 50 or re.search(r'即将|返场|活动|攻略|实测|评测|前瞻|如何|升级|奖励', value):
        return None
    match = re.fullmatch(r'(.{1,24}?)\s*[-—－·]\s*(.{1,28})', value)
    if (not match or EXCLUDED.search(match[1])
            or re.search(r'[，。、！!？?：:—－-]|\s(?:与|和|以及)\s|降临战场|再度降临|现已登场|碎片上新|破浪归来|强势登场|即将来袭', match[2])):
        return None
    base = aliases.get(key(match[1]))
    if base is None and allow_local:
        label = clean(match[1])
        if re.search('地图|模式|活动|玩法|福利|任务|赛季|联赛|属性|对比', label):
            return None
        base = {'id': 'codm-cn-base-' + hashlib.sha256(key(label).encode()).hexdigest()[:12],
                'name': label, 'type': 'melee' if melee else 'gun', 'category': '近战武器' if melee else '枪械'}
    if base is None:
        return None
    skin_name = re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '', clean(match[2]))
    return base, skin_name, value


def parse_article(source, aliases):
    tree = Tree(source['html'])
    scope = next((node for node in tree.root.walk() if 'art-main' in node.attrs.get('class', '').split()), None)
    info = next((node for node in tree.root.walk() if 'art-info' in node.attrs.get('class', '').split()), None)
    if scope is None or info is None:
        return [], 'no_blueprint_article_body'
    scope_text = clean(text(scope))
    # This original article spells KRM262 correctly in its introduction and
    # explanatory body, but its standalone heading drops the R. Keep the raw
    # sourceLabel and use that same article's explicit spelling for the weapon.
    if source['url'].endswith('/18594472.html') and 'KRM262-电玩高手' in scope_text:
        aliases = dict(aliases)
        aliases[key('KM262')] = aliases[key('KRM262')]
    info_text = clean(text(info))
    published = re.search(r'20\d\d-\d\d-\d\d', info_text)
    author = '使命召唤手游' if re.search(r'使命召唤手游\s+20\d\d-', info_text) else '官网刊载作者（身份待核）'
    official = author == '使命召唤手游'
    records, current, rarity, action, recent, excluded = [], None, None, 'showcase', [], False
    unresolved = []
    paragraph, weapon_label_at, melee_label = 0, -100, False
    for node in scope.walk():
        if node.tag in ['p', 'h2', 'h3', 'h4'] and not any(inner is not node and inner.tag == 'p' for inner in node.walk()):
            value = clean(text(node))
            if not value:
                continue
            paragraph += 1
            if len(value) < 35 and re.search('角色|投掷物|载具|挂饰|降落伞|名片|背包', value):
                current, excluded = None, True
            if len(value) < 40 and re.search('武器|蓝图|近战', value) and not EXCLUDED.search(value):
                excluded = False
                rarity = next((name for name in RARITY if name in value), None)
                if re.fullmatch(r'(?:全新)?(?:神话|传说|史诗|典藏|稀有|精良)(?:级|品质)?(?:近战)?(?:武器(?:蓝图|皮肤)?|蓝图)', value):
                    weapon_label_at, melee_label = paragraph, '近战' in value
            heading = node.tag.startswith('h') or node.attrs.get('align') == 'center' or 'text-align: center' in node.attrs.get('style', '') or any(
                child.tag in ['strong', 'b'] and clean(text(child)) == value for child in node.walk())
            named = named_weapon(value, aliases, paragraph - weapon_label_at <= 2, melee_label) if heading else None
            if named and re.search(r'(?:角色皮肤|角色)\s*[:：]\s*' + re.escape(named[2]), scope_text):
                named = None
            if heading and not named and not excluded and len(value) < 40 and re.fullmatch(r'.{1,20}[-—－·].{1,24}', value):
                unresolved.append(value)
                current = None
            if heading and not named and re.search('返利|福利|任务|奖池|抽奖|充值|累充|活动时间', value):
                current = None
            if named and not excluded:
                base, skin_name, raw_name = named
                current = {'name': base['name'] + ' · ' + skin_name, 'base': base, 'skinName': skin_name, 'sourceLabel': raw_name,
                    'rarity': rarity, 'images': [], 'sourceUrl': source['url'], 'retrievedAt': source['retrievedAt'],
                    'publishedDate': published[0] if published else None, 'author': author, 'official': official}
                records.append(current)
                action, recent = 'showcase', []
            if current:
                if heading or len(value) < 36:
                    action = next((kind for kind, pattern in ACTION if re.search(pattern, value)), 'showcase' if heading else action)
                recent = (recent + [value])[-2:]
        elif node.tag == 'img' and current and not excluded:
            raw = node.attrs.get('data-src') or node.attrs.get('src', '')
            if raw and not raw.startswith('data:'):
                try:
                    url = https(raw, source['url'])
                except ValueError:
                    continue
                current['images'].append({'url': url, 'action': action, 'context': ' '.join(recent), 'title': node.attrs.get('alt', '')})
    return records, {'kind': 'blueprint_sections' if records else 'other_or_unresolved_content', 'unresolvedWeaponLabels': unresolved}


def build(raw, checks, previous):
    base, skin_name = raw['base'], raw['skinName']
    ident = 'codm-cn-' + hashlib.sha256((base['id'] + ':' + key(skin_name)).encode()).hexdigest()[:16]
    pictures = [image for image in raw['images'] if image['url'] in checks]
    if not pictures:
        return None
    picture = next((image for image in pictures if checks[image['url']]['format'] != 'GIF'), pictures[0])
    check = checks[picture['url']]
    tier, color = RARITY.get(raw['rarity'], ('unknown', '#728782'))
    entry = {'id': ident, 'game': 'cod-mobile', 'name': raw['name'], 'englishName': '', 'weaponId': base['id'],
        'weaponName': base['name'], 'weaponEnglishName': base['name'], 'weaponType': base['type'], 'category': base['category'],
        'rarity': {'id': tier, 'name': raw['rarity'] or '未核品质', 'color': color},
        'region': '国服', 'gameTitle': '使命召唤手游（国服）', 'sourceId': raw['sourceUrl'].rsplit('/', 1)[-1].split('.')[0],
        'sourceLabel': raw['sourceLabel'],
        'sourceName': '使命召唤手游国服官网 · ' + raw['author'], 'sourceUrl': raw['sourceUrl'],
        'firstSeenAt': previous.get(ident, {}).get('firstSeenAt', now()), 'releaseDate': None, 'releaseDateStatus': 'unverified',
        'publishedDate': raw['publishedDate'], 'timingNote': '原稿发布日期单列，不将返场日、预告日或首次采集日当作皮肤首发日。',
        'description': '国服原稿中独立命名的武器蓝图。图片与动作按对应小节收录，保留原稿范围；跨服同款与英文名称尚未自动合并。',
        'publicationStatus': 'ready', 'chromas': [], 'levels': [], 'media': [],
        'tags': ['国服', '武器蓝图', raw['skinName'], raw['rarity'] or '未核品质'],
        'image': {'url': picture['url'], 'assetSourceUrl': picture['url'], 'sourcePageUrl': raw['sourceUrl'],
                  'sourceType': 'official' if raw['official'] else 'community', 'provider': '使命召唤手游官网原稿',
                  'kind': 'section', 'caption': '对应蓝图小节原图；可能展示实战、特效或升级效果，未改绘为单件渲染。',
                  'width': check['width'], 'height': check['height'], 'sha256': check['sha256'], 'retrievedAt': check['retrievedAt']}}
    for picture in pictures:
        check = checks[picture['url']]
        if check['format'] != 'GIF' or check['frameCount'] < 2:
            continue
        kind = picture['action']
        entry['media'].append({'id': 'codm-cn-gif-' + hashlib.sha256(picture['url'].encode()).hexdigest()[:20],
            'provider': 'gif', 'kind': kind, 'url': picture['url'], 'mimeType': 'image/gif',
            'title': entry['name'] + ' · ' + ({'inspect': '检视', 'finisher': '消灭特效', 'reload': '换弹', 'fire': '开火效果', 'equip': '切出', 'ads': '瞄准'}.get(kind, '外观展示')),
            'sourcePageUrl': raw['sourceUrl'], 'sourceName': entry['sourceName'], 'sourceType': 'official' if raw['official'] else 'community',
            'reviewStatus': 'source_confirmed' if kind != 'showcase' else 'metadata_only',
            'reviewNote': '动作说明来自原稿对应蓝图的邻近小节，已解码确认是多帧 GIF；未宣称逐帧复核全部动作。',
            'frameCount': check['frameCount'], 'width': check['width'], 'height': check['height'], 'sha256': check['sha256']})
    entry['media'] = list({media['id']: media for media in entry['media']}.values())
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--discover-only', action='store_true')
    parser.add_argument('--max-pages', type=int, default=1000)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    fetcher = Fetcher(args.offline, args.refresh)
    previous_doc = json.loads(OUT.read_text(encoding='utf-8'))
    previous = {entry['id']: entry for entry in previous_doc['skins']}
    before = OUT.read_bytes()
    try:
        index = discover(fetcher, args.max_pages)
        if args.discover_only:
            print(json.dumps({'indexPages': len(index['pages']), 'articles': len(index['articles']), 'complete': index['complete']}))
            return 0
        if not index['complete']:
            raise RuntimeError('Partial article index; previous snapshot preserved (use --discover-only for a bounded index probe)')
        aliases, raw_records, failures, dispositions, sources = weapons(previous_doc), [], [], {}, []
        with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 3))) as pool:
            futures = {pool.submit(fetcher.article, item['url']): item for item in index['articles']}
            for future in as_completed(futures):
                item = futures[future]
                try:
                    source = future.result()
                    records, disposition = parse_article(source, aliases)
                    raw_records.extend(records)
                    dispositions[item['url']] = {'blueprintSections': len(records), 'disposition': disposition or ('blueprint_sections' if records else 'other_content')}
                    sources.append({key: source[key] for key in ['url', 'retrievedAt', 'sha256', 'bytes']})
                except Exception as exc:
                    failures.append({'url': item['url'], 'reason': str(exc)})
        if not sources or failures:
            raise RuntimeError('Unavailable source articles; previous snapshot preserved')
        sources.sort(key=lambda source: source['url'])
        image_urls = sorted({image['url'] for record in raw_records for image in record['images']})
        checks, image_failures = {}, []
        with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 3))) as pool:
            futures = {pool.submit(fetcher.image, url): url for url in image_urls}
            for future in as_completed(futures):
                url = futures[future]
                try:
                    checks[url] = future.result()
                except Exception as exc:
                    image_failures.append({'url': url, 'reason': str(exc)})
        if image_failures:
            raise RuntimeError('Incomplete decoded image checks; previous snapshot preserved')
        collected = {}
        for raw in sorted(raw_records, key=lambda item: (item['publishedDate'] or '', item['sourceUrl']), reverse=True):
            entry = build(raw, checks, previous)
            if not entry:
                continue
            if entry['id'] in collected:
                existing = collected[entry['id']]
                existing.setdefault('additionalSourceUrls', []).append(entry['sourceUrl'])
                existing['media'] = list({media['id']: media for media in existing['media'] + entry['media']}.values())
            else:
                collected[entry['id']] = entry
        if not collected:
            raise RuntimeError('No decoded blueprint sections; previous snapshot preserved')
        for identifier, entry in previous.items():
            if (previous_doc.get('source', {}).get('chinaCatalogue', {}).get('parserVersion') == PARSER_VERSION
                    and identifier.startswith('codm-cn-') and identifier not in collected):
                collected[identifier] = entry
        entries = [entry for entry in previous_doc['skins'] if not entry['id'].startswith('codm-cn-')] + sorted(collected.values(), key=lambda item: item['id'])
        coverage = dict(previous_doc['coverage'])
        coverage.update(chinaArticleIndexComplete=index['complete'], chinaArticleIndexPages=len(index['pages']),
            chinaArticleCount=len(sources), chinaBlueprintSectionCount=len(raw_records), chinaBlueprintCount=len(collected),
            chinaWithInspectCount=sum(any(media['kind'] == 'inspect' for media in entry['media']) for entry in collected.values()),
            chinaWithAnimationCount=sum(bool(entry['media']) for entry in collected.values()), chinaUnavailableArticleCount=len(failures),
            cataloguedCount=len(entries), weaponCount=len({entry['weaponId'] for entry in entries}),
            gunCount=sum(entry['weaponType'] == 'gun' for entry in entries), meleeCount=sum(entry['weaponType'] == 'melee' for entry in entries),
            withVideoCount=sum(any(media['provider'] in ['mp4', 'youtube', 'bilibili'] for media in entry['media']) for entry in entries),
            videoCount=sum(sum(media['provider'] in ['mp4', 'youtube', 'bilibili'] for media in entry['media']) for entry in entries),
            withAnimationCount=sum(any(media['provider'] == 'gif' for media in entry['media']) for entry in entries), complete=False,
            scope='国际服社区图鉴与国服官网蓝图原稿分别收录；国服按独立命名小节、实际配图与多帧动图核验，跨服同款不凭译名猜测合并。',
            mediaScope='国际服保留原官方视频；国服补充经解码确认的原稿 GIF，检视仅按相邻明确说明标注，未宣称全量独立检视。')
        payload = dict(previous_doc)
        payload.update(skins=entries, coverage=coverage)
        payload['source'] = dict(previous_doc['source'])
        payload['source']['chinaCatalogue'] = {'name': '使命召唤手游国服官网原稿', 'url': INDEX, 'parserVersion': PARSER_VERSION, 'requests': sources,
            'indexRequests': index['pages'], 'retrievedAt': max(source['retrievedAt'] for source in sources)}
        payload['updatedAt'] = max(previous_doc['updatedAt'], payload['source']['chinaCatalogue']['retrievedAt'])
        atomic(CACHE / 'reconciliation.json', {'coverage': coverage, 'dispositions': dispositions, 'articleFailures': failures,
            'imageFailures': image_failures, 'imageCheckCount': len(checks), 'imageCandidateCount': len(image_urls)})
        atomic(OUT, payload)
        print(json.dumps({'chinaBlueprints': len(collected), 'total': len(entries), 'indexPages': len(index['pages']),
            'articles': len(sources), 'indexComplete': index['complete'], 'imageChecks': len(checks), 'imageFailures': len(image_failures)}, ensure_ascii=False))
        return 0
    except Exception as exc:
        if OUT.read_bytes() != before:
            raise RuntimeError('Failed sync changed the previous successful snapshot') from exc
        atomic(CACHE / 'last-failure.json', {'attemptedAt': now(), 'error': str(exc), 'previousSnapshotPreserved': True})
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
