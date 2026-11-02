#!/usr/bin/env python3
"""Sync public CFHD skin resources and the bounded CFM 4399 historical catalogue.

No authenticated inventory, game account, or video-platform download is used.
Use --offline to rebuild from URL-keyed successful source snapshots. Each game
is validated in memory and replaced atomically; a failed source leaves its prior
successful public snapshot untouched.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from io import BytesIO
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'local-only/weapon-skins/crossfire/cache'
OUTPUT = ROOT / 'data/weapon-skins'
CFHD_BASE = 'https://www.crossfirehd.com/'
CFHD_PAGE = CFHD_BASE + 'weapons.html'
CFHD_OFFICIAL = 'https://cfhd.cf.qq.com/cp/a20261101mact/index.html'
CFM_INDEX = 'https://news.4399.com/cfsy/'
TODAY = datetime.now(timezone.utc).date().isoformat()

# CFM mixes special weapon variants and cosmetic skins. Exclude the unadorned
# prototype names explicitly rather than treating all names without '-' as base.
CFM_PROTOTYPES = {
    '98k', 'COP357', 'P228', '左轮', '愤怒的公牛', '汤姆逊', 'MP5KA4', 'PKP',
    '加特林', 'Ultimax100', 'MG3', '瓦尔特WA2000', '09式狙击枪', 'XM8',
    'M14EBR', 'AN94', 'AUG', 'QBZ95', 'AK12', 'AK74', '蜂鸟手枪', '蝴蝶刀',
    'FN FAL', 'DRAGUNOV', '毛瑟', '泰坦拳套',
}
CFM_THROWABLE = re.compile(r'手雷|烟雾|闪光|魔术弹|变羊|双生雷')
CFM_ALIASES = {
    '王者之影': 'AK47', '王者之灵': '沙鹰', '王者之啸': '手斧',
    '王者之魄': 'M4A1', '王者之心': 'AK47', '王者之魂': '沙鹰',
    '王者之锋': '尼泊尔', '枪神之魄': 'M4A1', '地狱烈炎': '汽锤',
    '喷水汽锤': '汽锤', 'KAC耀龙': 'KAC', 'AWM经典圣诞': 'AWM',
    'AK47应用宝': 'AK47', 'CF手游甩棍': '甩棍',
}
CFM_BASES = sorted({
    'M4A1-XS','M4A1','AK47','巴雷特','沙鹰','尼泊尔','手斧','军用手斧',
    'M14EBR','SCAR','9A91','AN94','AK12','AK74','AUG','QBZ95','AWM','MG3',
    'RPK','M249','加特林','汤姆逊','MK5','MP5','M37','汽锤','气锤','XM1014',
    '沙漠之鹰','USP','COP357','左轮','柯尔特','毛瑟','双持斯泰尔','斯泰尔',
    '铁锹','金箍棒','棒球棒','军用铁锹','大刀','战斧','龙啸','M16',
    'KAC','M60','FN FAL','狙击枪','赤龙火炮','风之子','双截棍','AA12','打击者','97-2式防暴枪',
}, key=len, reverse=True)
CFM_CATEGORY = {'bq':'步枪','jjq':'狙击枪','jq':'机枪','cfq':'冲锋枪','sq':'手枪','sdq':'霰弹枪',
                'sqq':'霰弹枪','sandan':'霰弹枪','jzwq':'近战武器'}
RARITIES = {0:'普通',1:'高级',2:'稀有',3:'英雄',4:'传奇',5:'神话'}
COLORS = {0:'#7b858d',1:'#46845c',2:'#528bcb',3:'#8a63b8',4:'#c48247',5:'#a55750'}


def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def atomically(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


class Fetcher:
    def __init__(self, offline=False, refresh=False):
        self.offline, self.refresh = offline, refresh
        self.curl = shutil.which('curl.exe') or shutil.which('curl')
        if not self.curl:
            raise RuntimeError('curl with operating-system certificate verification is required')
        CACHE.mkdir(parents=True, exist_ok=True)

    def fetch(self, url, referer=None):
        key = hashlib.sha256(url.encode()).hexdigest()
        path, meta_path = CACHE / (key + '.bin'), CACHE / (key + '.json')
        if path.exists() and meta_path.exists() and (self.offline or not self.refresh):
            return path.read_bytes(), json.loads(meta_path.read_text(encoding='utf-8'))
        if self.offline:
            raise RuntimeError('No successful offline snapshot: ' + url)
        temporary = path.with_suffix('.download')
        command = [self.curl, '--fail', '--location', '--silent', '--show-error', '--compressed',
            '--connect-timeout','10','--max-time','45','--retry','1',
            '--output', str(temporary)]
        if referer:command.extend(['--referer',referer])
        response = subprocess.run(command+[url], capture_output=True)
        if response.returncode:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(url + ': ' + response.stderr.decode('utf-8','replace')[:300])
        body = temporary.read_bytes()
        if not body:
            temporary.unlink(missing_ok=True)
            raise RuntimeError('Empty source: ' + url)
        os.replace(temporary, path)
        meta = {'url':url, 'retrievedAt':stamp(), 'bytes':len(body),
                'sha256':hashlib.sha256(body).hexdigest()}
        if referer:meta['referer']=referer
        atomically(meta_path, meta)
        return body, meta

    def json(self, url):
        body, meta = self.fetch(url)
        return json.loads(body.decode('utf-8-sig')), meta


def plain(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', value)).split())


def safe_image(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        raise ValueError('Unsafe image: ' + url)
    return url


def old_entries(game):
    path = OUTPUT / (game + '.json')
    if not path.exists():
        return {}
    old = json.loads(path.read_text(encoding='utf-8'))
    return {x['id']:x for x in old.get('skins',[]) + old.get('historicalSkins',[])}


def base_record(game, ident, name, weapon, weapon_id, weapon_type, source_url, source_name,
                source_id, image_url, retrieved_at, previous):
    return {
        'id':ident, 'game':game, 'name':name, 'englishName':'',
        'weaponId':weapon_id, 'weaponName':weapon, 'weaponEnglishName':'',
        'weaponType':weapon_type, 'category':'近战武器' if weapon_type == 'melee' else '枪械',
        'rarity':{'id':'unknown','name':'未核品质','color':'#728782'},
        'description':'', 'sourceId':str(source_id), 'sourceUrl':source_url,
        'sourceName':source_name, 'region':'国服',
        'gameTitle':'穿越火线：枪战王者' if game == 'cf-mobile' else '穿越火线高清竞技大区',
        'firstSeenAt':previous.get(ident,{}).get('firstSeenAt',TODAY),
        'releaseDate':None, 'releaseDateStatus':'unverified',
        'timingNote':'目录采集和原稿发表时间均不作为武器外观首发日期；未据此判断当前可获取状态。',
        'publicationStatus':'ready', 'chromas':[], 'levels':[], 'media':[], 'tags':[],
        'image':{'url':safe_image(image_url), 'sourcePageUrl':source_url,
            'assetSourceUrl':image_url, 'sourceType':'game_asset',
            'provider':source_name,'kind':'render',
            'caption':'游戏武器资源图，由社区资料站提供。', 'retrievedAt':retrieved_at},
    }


def get_cfhd(fetcher):
    categories, requests = [], []
    for category in (0,1,2):
        offset, group = 0, []
        while True:
            url = CFHD_BASE+'api/weapons.php?'+urlencode({'category':category,'offset':offset,'limit':200,'sort':'id_desc'})
            obj, meta = fetcher.json(url)
            requests.append(meta)
            if not obj.get('ok') or not isinstance(obj.get('items'),list):
                raise RuntimeError('Invalid CFHD category response')
            group.extend(obj['items'])
            if len(group) >= int(obj['total']): break
            if not obj['items']: raise RuntimeError('CFHD pagination ended early')
            offset += len(obj['items'])
        if len(group) != int(obj['total']): raise RuntimeError('CFHD total changed during sync')
        categories.extend((category,x) for x in group)
    if len(categories) < 70 or len({x['itemid'] for _,x in categories}) != len(categories):
        raise RuntimeError('CFHD base-weapon catalogue unexpectedly shrank or duplicated')

    def skins_for(pair):
        cat, weapon = pair
        url = CFHD_BASE+'api/weapons.php?'+urlencode({'skins':1,'itemid':weapon['itemid']})
        obj, meta = fetcher.json(url)
        if not obj.get('ok') or not isinstance(obj.get('skins'),list):
            raise RuntimeError('Invalid CFHD skins: '+url)
        return cat,weapon,obj['skins'],meta

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        collected = list(pool.map(skins_for,categories))
    previous, entries, source_ids = old_entries('cfhd'), [], set()
    resource_count = chroma_count = orphan_chromas = 0
    for cat,weapon,rows,meta in collected:
        requests.append(meta)
        resource_count += len(rows)
        row_ids = {str(x['typeid']) for x in rows}
        if len(row_ids) != len(rows) or source_ids & row_ids:
            raise RuntimeError('Duplicate CFHD source identity')
        source_ids.update(row_ids)
        weapon_name, weapon_id = weapon['namechn'], 'cfhd-weapon-'+str(weapon['itemid'])
        parents = {}
        for row in rows:
            parent_id = str(row.get('skin_model_typeid') or '')
            if parent_id and parent_id in row_ids:
                continue
            if parent_id:
                orphan_chromas += 1
            source_id = str(row['typeid'])
            picture = urljoin(CFHD_BASE, row['icon'].replace('\\','/'))
            item = base_record('cfhd','cfhd-'+source_id,row['name'],weapon_name,
                weapon_id,'melee' if cat == 2 else 'gun',CFHD_PAGE,
                'CFHD 数据中心（非官方）',source_id,picture,meta['retrievedAt'],previous)
            grade = row.get('grade')
            item['rarity']={'id':str(grade),'name':RARITIES.get(grade,'未核品质'),'color':COLORS.get(grade,'#728782')}
            item['category'] = '近战武器' if cat == 2 else ('副武器' if cat == 1 else '主武器')
            item['description'] = f'{weapon_name} 的 CFHD 国服武器外观。目录与资源图来自玩家维护的数据中心；不据此推断当前在售或精确首发日期。'
            item['sourceApiUrl'] = meta['url']
            item['sourceWeaponId'] = weapon['itemid']
            item['sourceResourceId'] = row.get('pid')
            item['image']['provider'] = 'CFHD 数据中心 · 玩家整理的游戏资源'
            if parent_id:
                item['variantOfSourceId'] = parent_id
                item['tags'].append('上游未列出母皮肤的炫彩')
            parents[source_id] = item
            entries.append(item)
        for row in rows:
            parent_id = str(row.get('skin_model_typeid') or '')
            if not parent_id or parent_id not in parents: continue
            url = urljoin(CFHD_BASE,row['icon'].replace('\\','/'))
            parents[parent_id]['chromas'].append({
                'id':'cfhd-chroma-'+str(row['typeid']), 'name':row['name'],
                'displayIcon':safe_image(url), 'fullRender':url,
                'sourceId':str(row['typeid']), 'sourceUrl':CFHD_PAGE,
                'sourceApiUrl':meta['url'], 'sourceType':'game_asset',
            })
            chroma_count += 1

    attach_cfhd_media(fetcher, entries, requests)
    restore_cfhd_images(fetcher, entries, requests)
    if len(entries) < 1400:
        raise RuntimeError('CFHD skin catalogue unexpectedly small')
    return document('cfhd',entries,previous,requests,{
        'status':'partial', 'complete':False,'catalogScope':'community_catalogue_snapshot',
        'sourceWeaponCount':len(categories), 'sourceResourceCount':resource_count,
        'cataloguedCount':len(entries),'chromaCount':chroma_count,
        'orphanChromaCount':orphan_chromas,
        'scope':'已遍历本次 CFHD 数据中心公开主武器、副武器、近战列表和各武器皮肤页；炫彩归入母皮肤，排除投掷、C4、角色和配件。社区源站图片当前不可访问，仅原图已核验的条目进入公开展示，其余留待补图。',
        'mediaScope':'部分皮肤关联官网直接公开的武器展示 MP4；未逐段核对的普通展示不标为检视。',
        'note':'全量指本次可枚举上游快照的枪械与近战资源，不包括未公开客户端资源与缺失历史皮肤。',
        'remaining':['官方全历史目录对账','多数皮肤第一人称视频','精确首发日期'],
    }, 'CFHD 数据中心（非官方）与 CFHD 官网展示',CFHD_PAGE)


def attach_cfhd_media(fetcher, entries, requests):
    body, meta = fetcher.fetch(CFHD_OFFICIAL)
    requests.append(meta)
    source = re.sub(r'<!--.*?-->', '', body.decode('gb18030','replace'),flags=re.S)
    # These labels and video links share the same official skin panel. No
    # inference from similar names, unrelated reward thumbnails or platform IDs.
    panels = {
        6:'USP 虹儿', 7:'尼泊尔军刀 机械纪元', 8:'军用铁锹 擎天',
        9:'81式步枪 机械纪元', 11:'SCAR LIGHT 白虎',12:'沙漠之鹰 天神',
        13:'AWM 天龙',15:'轻型军用手斧 龙啸',16:'尼泊尔军刀 屠龙',
        18:'RPK机枪 盘龙',19:'汤姆逊冲锋枪 烈龙',
    }
    by_name = {plain(x['name']):x for x in entries}
    for panel in re.split(r'<div class="slmb-mod ',source)[1:]:
        match = re.match(r'slmb-mod(\d+)"',panel)
        if not match or int(match[1]) not in panels: continue
        number, name = int(match[1]),panels[int(match[1])]
        videos = re.findall(r'href="javascript:playVideo\(\s*\x27([^\x27]+\.mp4)\x27\s*\)',panel)
        if not videos: continue
        item = by_name.get(name)
        if not item:
            raise RuntimeError('CFHD official media target missing: '+name)
        # 81式 is named 81式步枪 in this official reward panel.
        aliases = [name,name.replace('81式 ','81式步枪 ')]
        panel_text = plain(panel)
        if not any(x in panel_text for x in aliases):
            raise RuntimeError('Official panel lacks expected label: '+name)
        url = urljoin(CFHD_OFFICIAL,videos[0])
        if urlparse(url).hostname not in {'game.gtimg.cn','cfhd.lv.game.qq.com'}:
            raise RuntimeError('Unexpected official video host')
        item['media'].append({
            'id':'cfhd-official-panel-'+str(number), 'kind':'showcase','provider':'mp4',
            'url':url,'title':name+' · 官网武器展示',
            'sourcePageUrl':CFHD_OFFICIAL,'sourceName':'CFHD 官方网站',
            'sourceType':'official','reviewStatus':'source_confirmed',
            'reviewNote':'官网同一武器面板中的名称与展示链接已对应；尚未逐帧核对或标注检视片段。',
            'reviewedAt':meta['retrievedAt'][:10],
        })
        if name in {'USP 虹儿','军用铁锹 擎天','尼泊尔军刀 屠龙'}:
            item['media'][-1].update({
                'contains':['inspect'],'reviewStatus':'sample_reviewed',
                'duration':{'USP 虹儿':7.208333,'军用铁锹 擎天':20.544,'尼泊尔军刀 屠龙':24.288005}[name],
                'reviewNote':'已抽帧核对官网原片，片内标题明确标注该武器及“检视展示”，实际包含第一人称检视；部分原片另含实战，尚未标注精确片段起止。',
            })


def restore_cfhd_images(fetcher,entries,requests):
    """Publish only pictures that can actually be served to users.

    The community directory itself is enumerable but its image origin failed
    TLS handshakes in both browser QA and native GET, including with Referer.
    Do not ship hundreds of broken placeholders. Keep that full identity
    inventory pending, and match official fallback resources by exact labels.
    """
    body,meta=fetcher.fetch(CFHD_OFFICIAL)
    source=re.sub(r'<!--.*?-->','',body.decode('gb18030','replace'),flags=re.S)
    replacements={}
    for li in re.findall(r'<li\b[^>]*>(.*?)</li>',source,re.S):
        text=plain(li)
        pictures=re.findall(r'(?:data-src|src)="([^"]+)"',li)
        if not pictures: continue
        for item in entries:
            if text == item['name']+' 累抽100次' and item['media']:
                replacements[item['id']]={'url':urljoin(CFHD_OFFICIAL,pictures[0]),
                    'page':CFHD_OFFICIAL,'name':'CFHD 官方网站 · 对应武器奖励图'}
    # The official site's popup has a larger exact image for these entries.
    larger={'USP 虹儿':'slmbpop_prod15.png','尼泊尔军刀 机械纪元':'slmbpop_prod14.png',
        '军用铁锹 擎天':'slmbpop_prod16.png','81式步枪 机械纪元':'slmbpop_prod18.png',
        'SCAR LIGHT 白虎':'slmbpop_prod19.png','沙漠之鹰 天神':'slmbpop_prod21.png','AWM 天龙':'slmbpop_prod22.png'}
    for item in entries:
        if item['name'] in larger and item['id'] in replacements:
            url='https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/pop/'+larger[item['name']]
            if url.replace('https:','') in source or url in source:
                replacements[item['id']]['url']=url

    shop_url='https://djcapp.game.qq.com/daoju/igw/main/?'+urlencode({
        '_service':'app.goods.list.sort','_biz_code':'cfhd','_app_id':1003,
        'appSource':'pc','appVersion':140,'order_field':'time','sort_type':'desc',
        'page_num':1,'page':1,'page_size':16})
    shop,shop_meta=fetcher.json(shop_url)
    requests.append(shop_meta)
    if shop.get('ret')!=0 or not isinstance(shop.get('data',{}).get('list'),list):
        raise RuntimeError('Official CFHD fallback shop catalogue failed')
    if len(shop['data']['list'])!=shop['data']['totalCount']:
        raise RuntimeError('CFHD official shop fallback needs pagination')
    canonical=lambda s: re.sub(r'[-\s]','',s).upper()
    by_name={canonical(item['name']):item for item in entries}
    for row in shop['data']['list']:
        item=by_name.get(canonical(row['sGoodsName']))
        if not item: continue
        # This exact host rewrite is performed by the official shop template.
        url=row['sGoodsPic'].replace('http://ossweb-img.qq.com','https://game.gtimg.cn')
        if urlparse(url).hostname!='game.gtimg.cn':continue
        replacements[item['id']]={'url':url,'page':f'https://daoju.qq.com/cfhd/item/{row["iGoodsId"]}.shtml',
            'name':'腾讯道聚城 · CFHD 对应武器商品图'}

    from PIL import Image
    for item in entries:
        replacement=replacements.get(item['id'])
        item['communityImageCandidate']=item['image']
        if item['chromas']:
            item['pendingChromas']=item['chromas']
            item['chromas']=[]
        if not replacement:
            item['publicationStatus']='pending_image'
            item['publicationNote']='社区原图源站当前无法访问，待取得可核对图片后再公开。'
            continue
        url=replacement['url']
        picture,picture_meta=fetcher.fetch(url)
        requests.append(picture_meta)
        with Image.open(BytesIO(picture)) as image:
            image.load()
            width,height=image.size
            if width<60 or height<30:raise RuntimeError('CFHD fallback image too small')
            extension={'PNG':'.png','JPEG':'.jpg','WEBP':'.webp'}[image.format]
        path=Path('assets/weapon-skins/crossfire')/(item['id']+extension)
        target=ROOT/path
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(picture)
        item['image']={'url':path.as_posix(),'assetSourceUrl':url,
            'sourcePageUrl':replacement['page'],'sourceType':'official',
            'provider':replacement['name'],'kind':'render',
            'caption':'官方页面中与该武器名称一一对应的原始配图，未裁切或改绘。',
            'width':width,'height':height,'sha256':hashlib.sha256(picture).hexdigest(),
            'retrievedAt':picture_meta['retrievedAt']}


def get_cfm(fetcher):
    body, index_meta = fetcher.fetch(CFM_INDEX)
    text = body.decode('gb18030','replace')
    match = re.search(r'<ul\s+class="cf"\s+id="wq_list">(.*?)</ul>',text,re.S)
    if not match: raise RuntimeError('CFM historical catalogue selector changed')
    rows, excluded, requests = [], {'prototype':[],'throwable':[],'duplicate':[]},[index_meta]
    seen = set()
    raw_items = re.findall(r'<li\b[^>]*>(.*?)</li>',match[1],re.S)
    if len(raw_items) < 250: raise RuntimeError('CFM source catalogue unexpectedly small')
    for raw in raw_items:
        name_match = re.search(r'<p>(.*?)</p>',raw,re.S)
        page_match = re.search(r'href="([^"]+)"',raw)
        img_match = re.search(r'(?:lz_src|src)="([^"]+)"',raw)
        if not all([name_match,page_match,img_match]):
            raise RuntimeError('Incomplete CFM source catalogue row')
        name = plain(name_match[1])
        url = urljoin(CFM_INDEX,page_match[1])
        if name in CFM_PROTOTYPES:
            excluded['prototype'].append(name); continue
        if CFM_THROWABLE.search(name):
            excluded['throwable'].append(name); continue
        if name in seen:
            excluded['duplicate'].append(name); continue
        seen.add(name)
        if not re.search(r'/cfsy/(?:wuqi|gonglue/[^/]+/wuqi)/',url):
            # The verified index also uses /gonglue/cfsy/wuqi on older entries.
            if '/gonglue/cfsy/wuqi/' not in url:
                raise RuntimeError('Unexpected CFM detail source: '+url)
        category = re.search(r'/wuqi/([^/]+)/',url)[1]
        rows.append({'name':name,'sourceUrl':url,'categoryKey':category,
                     'catalogueIcon':urljoin(CFM_INDEX,img_match[1])})

    def detail(row):
        body, meta = fetcher.fetch(row['sourceUrl'])
        source = body.decode('gb18030','replace')
        title = re.search(r'<h1\b[^>]*class="contit"[^>]*>(.*?)</h1>',source,re.S)
        article = re.search(r'<div class="content">(.*?)<div class="pd20">',source,re.S)
        if not title or not article or 'CF' not in plain(title[1]):
            raise RuntimeError('CFM detail identity not verified: '+row['sourceUrl'])
        images = re.findall(r'<img\b[^>]*\bsrc="([^"]+)"',article[1],re.S)
        images = [urljoin(row['sourceUrl'],html.unescape(x)) for x in images
                  if urlparse(urljoin(row['sourceUrl'],x)).hostname == 'newsimg.5054399.com']
        if not images:
            raise RuntimeError('No article weapon picture: '+row['sourceUrl'])
        return row,images[0],meta

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        details = list(pool.map(detail,rows))
    previous, entries = old_entries('cf-mobile'), []
    for row,picture,meta in details:
        requests.append(meta)
        name, key = row['name'],row['categoryKey']
        article_id = re.search(r'/(\d+)\.html',row['sourceUrl'])[1]
        weapon = CFM_ALIASES.get(name)
        if not weapon:
            weapon = next((x for x in CFM_BASES if name.startswith(x) or name.startswith('黄金'+x)),None)
        if not weapon:
            weapon = re.split(r'[-—]',name)[0]
        weapon_id = 'cfm-weapon-'+hashlib.sha256(weapon.encode()).hexdigest()[:12]
        item = base_record('cf-mobile','cfm-'+article_id,name,weapon,weapon_id,
            'melee' if key == 'jzwq' else 'gun',row['sourceUrl'],
            '4399 CF手游历史武器图鉴',article_id,picture,meta['retrievedAt'],previous)
        item['category'] = CFM_CATEGORY.get(key,'枪械' if key != 'jzwq' else '近战武器')
        item['description'] = 'CFM 国服历史武器外观条目。CFM 的部分武器变体具有数值或功能差异，收录外观不表示只有涂装差异。此历史图鉴没有覆盖全部后续版本。'
        item['sourceCatalogueUrl'] = CFM_INDEX
        item['image']['provider'] = '4399 CF手游图鉴 · 游戏画面/资源图'
        item['image']['caption'] = '4399 对应武器独立图鉴正文首张原图；保留原始构图。'
        item['tags'] = ['历史图鉴','枪战王者','武器变体']
        entries.append(item)
    attach_cfm_featured(fetcher,entries,previous,requests)
    archive_cfm_images(fetcher,entries,requests)
    return document('cf-mobile',entries,previous,requests,{
        'status':'partial','complete':False,'catalogScope':'historical_community_catalogue',
        'sourceRecordCount':len(raw_items),'historicalCataloguedCount':len(details),
        'featuredRecordCount':4,'cataloguedCount':len(entries),
        'excluded':{k:len(v) for k,v in excluded.items()},'excludedNames':excluded,
        'scope':'4399 CFM 历史武器图鉴首页 300 条入口中的非原型枪械与近战变体，加上 4 款官方资料精选；排除投掷和重名入口。历史图鉴主要为早期版本，并非当前全量。',
        'mediaScope':'历史目录以静态图为主；精选补官方 B 站套装展示和原稿明确标注的检视 GIF。GIF 动图单独统计，不作为视频计数。',
        'note':'穿越火线：枪战王者（CFM）国服历史选集，不与 CF 端游或 CFHD 混用。',
        'remaining':['2019 年后大部分皮肤与新武器','大部分皮肤展示和检视视频','官方全历史目录对账','首发日期'],
    },'4399 CFM 历史图鉴与官方武器展示选集',CFM_INDEX)


def attach_cfm_featured(fetcher,entries,previous,requests):
    image_base='https://i.17173cdn.com/2fhnvk/YWxqaGBf/cms3/'
    rabbit_source='https://news.17173.com/content/11142025/111817866.shtml'
    imperial_source='https://news.17173.com/content/06182025/161201433.shtml'
    rabbit,rabbit_meta=fetcher.fetch(rabbit_source)
    imperial,imperial_meta=fetcher.fetch(imperial_source)
    requests.extend([rabbit_meta,imperial_meta])
    rabbit_text,imperial_text=rabbit.decode('utf-8'),imperial.decode('utf-8')
    if '穿越火线官方FPS手游' not in rabbit_text or '【检视动作】' not in rabbit_text:
        raise RuntimeError('CFM rabbit official author/action evidence missing')
    if '来源：官方' not in imperial_text or 'QBZ191-帝皇铠甲' not in imperial_text:
        raise RuntimeError('CFM imperial official attribution/identity missing')
    specs=[
        ('rabbit-warrior','手斧-兔兔战士','手斧','melee',rabbit_source,rabbit_meta,
         'uiGCSCbtkafDzqc.jpg',[('qNxwpgbtkafDAEq.gif','第一套检视'),('biaNLDbtkafDzqq.gif','第二套检视')]),
        ('qbz191-imperial-armor','QBZ191-帝皇铠甲','QBZ191','gun',imperial_source,imperial_meta,
         'LNyXNTbsEbbqvco.png',[('ITBpOCbsEbbqvri.gif','检视动作')]),
        ('double-barrel-aurora-shield','双管猎枪-极光盾','双管猎枪','gun',imperial_source,imperial_meta,
         'fDoCiwbsEbbqvcC.png',[('YxvTxnbsEbbqvfi.gif','专属展示动作')]),
        ('aurora-sword','极光剑','极光剑','melee',imperial_source,imperial_meta,
         'kHsgoFbsEbbqvew.gif',[('UAFqmHbsEbbqvrx.gif','检视动作')]),
    ]
    featured=[]
    for slug,name,weapon,typ,page,meta,picture,animations in specs:
        evidence=rabbit_text if page==rabbit_source else imperial_text
        if picture not in evidence or any(p not in evidence for p,_ in animations):
            raise RuntimeError('CFM curated image/action reference disappeared: '+name)
        source_name='穿越火线官方手游稿件 · 17173 转载'
        item=base_record('cf-mobile','cfm-'+slug,name,weapon,
            'cfm-weapon-'+hashlib.sha256(weapon.encode()).hexdigest()[:12],typ,
            page,source_name,slug,image_base+picture,meta['retrievedAt'],previous)
        item['description']='官方手游稿件提供的武器外观与动作资料。原稿为体验服/抢先展示，保留其版本范围；资料发布日期不等于正式服首发时间。武器变体可能具有数值或功能差异。'
        item['category']='近战武器' if typ=='melee' else ('步枪' if weapon=='QBZ191' else '副武器')
        item['image'].update({'sourceType':'official','kind':'in_game',
            'provider':'CFM 官方稿件（17173 转载托管）',
            'caption':'对应武器的官方体验服/抢先展示原图；保留原图与版本范围。'})
        item['tags']=['官方展示','体验服/抢先展示','武器变体']
        for picture,label in animations:
            inspect='检视' in label
            item['media'].append({'id':'cfm-gif-'+picture.split('.')[0],
                'kind':'inspect' if inspect else 'showcase','provider':'gif',
                'url':image_base+picture,'title':name+' · '+label,
                'sourcePageUrl':page,'sourceName':source_name,'sourceType':'official',
                'reviewStatus':'source_confirmed','reviewedAt':meta['retrievedAt'][:10],
                'reviewNote':'原文对应武器小节紧邻该动图，并明确说明检视或展示动作；未将普通截图称作视频。',
                'versionScope':'体验服/抢先展示',
                'authorEvidence':{'type':'publisher_attribution','pageUrl':page,
                    'pageAuthor':'穿越火线官方FPS手游' if page==rabbit_source else '穿越火线手游',
                    'note':'页面作者与来源署名可核；17173 托管，未冒充腾讯域名。'},
            })
        featured.append(item)

    # This dedicated official original names the three exact weapons in its
    # description. Its series showcase is shared without asserting that each
    # item has a separate video or that the series video is all inspect.
    bili_url='https://www.bilibili.com/video/BV1dJ8yzGE51/'
    video,video_meta=fetcher.json('https://api.bilibili.com/x/web-interface/view?bvid=BV1dJ8yzGE51')
    requests.append(video_meta)
    data=video.get('data',{})
    if video.get('code')!=0 or data.get('owner',{}).get('mid')!=315554376:
        raise RuntimeError('CFM original Bilibili author/metadata changed')
    identity_url='https://news.17173.com/content/01092026/202913705.shtml'
    identity,identity_meta=fetcher.fetch(identity_url)
    requests.append(identity_meta)
    if '315554376' not in identity.decode('utf-8'):
        raise RuntimeError('CFM official channel attribution disappeared')
    for item in featured[1:]:
        if item['name'] not in data.get('desc',''):
            raise RuntimeError('CFM official set lacks target weapon: '+item['name'])
        item['media'].append({'id':'bilibili-BV1dJ8yzGE51','kind':'showcase','provider':'bilibili',
            'url':bili_url,'videoId':'BV1dJ8yzGE51','title':data['title'],
            'sourcePageUrl':bili_url,'sourceName':'穿越火线官方账号','sourceType':'official',
            'authorId':'315554376','authorEvidenceUrl':identity_url,
            'reviewStatus':'source_confirmed','reviewedAt':video_meta['retrievedAt'][:10],
            'duration':data.get('duration'),'mediaScope':'帝皇铠甲套装三款武器的合辑展示',
            'reviewNote':'已核官方频道和原稿列出的三款武器；套装合辑不标为单款专属检视。'})
    entries[:0]=featured


def archive_cfm_images(fetcher,entries,requests):
    """The 4399 CDN permits normal source-page requests but blocks hotlinks."""
    from PIL import Image
    def archive(item):
        old=item['image']
        raw,meta=fetcher.fetch(old['assetSourceUrl'],old['sourcePageUrl'])
        with Image.open(BytesIO(raw)) as image:
            image.load()
            width,height=image.size
            if width<60 or height<30:raise RuntimeError('CFM picture is unexpectedly small')
            extension={'PNG':'.png','JPEG':'.jpg','WEBP':'.webp','GIF':'.gif'}[image.format]
        path=Path('assets/weapon-skins/crossfire')/(item['id']+extension)
        target=ROOT/path
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(raw)
        item['image']={**old,'url':path.as_posix(),'width':width,'height':height,
            'sha256':hashlib.sha256(raw).hexdigest(),'retrievedAt':meta['retrievedAt']}
        return meta
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        requests.extend(pool.map(archive,entries))


def document(game,entries,previous,requests,coverage,name,url):
    ids = [x['id'] for x in entries]
    if len(set(ids)) != len(ids): raise RuntimeError('Duplicate normalized identity')
    historical = [dict(x,publicationStatus='historical') for k,x in previous.items() if k not in set(ids)]
    ready=[x for x in entries if x['publicationStatus']=='ready']
    coverage.update({'readyCount':len(ready),'pendingImageCount':sum(x['publicationStatus']=='pending_image' for x in entries),
        'pendingChromaImageCount':sum(len(x.get('pendingChromas',[])) for x in entries),
        'gunCount':sum(x['weaponType']=='gun' for x in ready),
        'meleeCount':sum(x['weaponType']=='melee' for x in ready),
        'withVideoCount':sum(any(m['provider']!='gif' for m in x['media']) for x in ready),
        'withAnimationCount':sum(any(m['provider']=='gif' for m in x['media']) for x in ready),
        'withMediaCount':sum(bool(x['media']) for x in ready),
        'retainedHistoricalCount':len(historical)})
    retrieved = max(x['retrievedAt'] for x in requests)
    return {'schemaVersion':1,'game':game,'updatedAt':retrieved,
        'source':{'name':name,'url':url,'type':'community_catalogue',
                  'retrievedAt':retrieved,'requests':requests},
        'coverage':coverage,'skins':entries,'historicalSkins':historical}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game',choices=['all','cfhd','cf-mobile'],default='all')
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--refresh',action='store_true',help='Refresh successful cached source responses')
    args=parser.parse_args()
    if args.offline and args.refresh: parser.error('--offline cannot be combined with --refresh')
    fetcher=Fetcher(args.offline,args.refresh)
    failures=[]
    for game in (['cfhd','cf-mobile'] if args.game == 'all' else [args.game]):
        try:
            result = get_cfhd(fetcher) if game == 'cfhd' else get_cfm(fetcher)
            atomically(OUTPUT/(game+'.json'),result)
            print(json.dumps({'game':game,'count':len(result['skins']),'coverage':result['coverage']},ensure_ascii=False))
        except Exception as error:
            failures.append({'game':game,'error':str(error)})
            print(game+' failed; previous snapshot preserved: '+str(error),file=sys.stderr)
    if failures:
        atomically(CACHE.parent/'last-failures.json',{'at':stamp(),'failures':failures})
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
