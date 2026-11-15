#!/usr/bin/env python3
"""Sync and archive CFHD weapon skins and chromas from public source catalogues.

The source inventory is separate from publication readiness. Only decoded,
attributed images make an entry ready. Original official pictures and media are
preserved. No authenticated inventory or video-platform download is used.

Live runs use a single verified requests.Session at one request per second.
Dependencies: requests, Pillow; Windows additionally uses truststore with the
system certificate store. Install truststore globally or under
local-only/weapon-skins/cfhd/runtime-deps. Offline runs need only Pillow.

"""
from __future__ import annotations
import argparse
import concurrent.futures
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import urlencode, urljoin, urlparse
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'local-only/weapon-skins/cfhd'
CACHE=LOCAL/'cache'
DATA=ROOT/'data/weapon-skins/cfhd.json'
ASSETS=Path('assets/weapon-skins/cfhd')
BASE='https://www.crossfirehd.com/'
PAGE=BASE+'weapons.html'
GRADES={0:'普通',1:'高级',2:'稀有',3:'英雄',4:'传奇',5:'神话'}
COLORS={0:'#7b858d',1:'#46845c',2:'#528bcb',3:'#8a63b8',4:'#c48247',5:'#a55750'}

REVIEWED_MEDIA = {'cfhd-613114618': {'name': '81式步枪 机械纪元',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_4119e20ea37db1169e1174c1c1584c11_1768305846/0b53q4apoaaadqamhplgcju6pb6d66dqb5ya.f0.mp4',
                    'duration': 37.916667,
                    'sha256': '63178210e1c5ca3d2745b4bdb16f6c9c1a656bcf816bb164a3df34c8d64a195c',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-603006859': {'name': 'RPK机枪 盘龙',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_4f8294097082e3604408b309b1ba2c14_1789354270/0b532ucmiaaefaakiznddnvohvodytkqjraa.f0.mp4',
                    'duration': 14.070998,
                    'sha256': '999cb5b95c1d389927d04c4b58b0746ee6371c1aa5deac652ad66ce5070c9c3d',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-538672440': {'name': '汤姆逊冲锋枪 烈龙',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_afbd5cf1a1baf6877edc20f5d13a1f8e_1789356398/0b53jaafkaaaayadzunhirvoosgdkveaavia.f0.mp4',
                    'duration': 28.607007,
                    'sha256': '1e75ca890f390512c428bd8a6b0c8628f78856dff16293cca0efcbbf4999a6ed',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-634605171': {'name': 'AWM 天龙',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_06d40f15bd6b947a8c8919c471cc97f1_1779940645/0b53y4ax6aabheamhtqwuvvonr6dp7dqc7ya.f0.mp4',
                    'duration': 19.017007,
                    'sha256': '19b873bc1f48c66b338423a829be920a9d24ee4fd94dc24dfd81433400ca42e3',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-569742142': {'name': 'SCAR LIGHT 白虎',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_71d573dd602188dd0ff878e6e3a56933_1772265755/0b53amblgaac6aabgtna6ju6ka6dwmbqfmya.f0.mp4',
                    'duration': 17.083333,
                    'sha256': '07b5d4aef04454dd217836e43d53ab6d6e0c2c6b5b27f6ebeb00ef785b02adac',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-551902844': {'name': '沙漠之鹰 天神',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_0767e05180e8241ded9a8101d24c6507_1779934666/0b53maataaab2majlfiwejvomygdgbqacmaa.f0.mp4',
                    'duration': 20.549002,
                    'sha256': '2358afe626a97a7fb1110efa0b228b3f52942fc5777a47ca33aa9733c5df0a13',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-627431446': {'name': '轻型军用手斧 龙啸',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_b101af4f56fc1b29bf998ca5596d0340_1784625676/0b53uma5yaabnqaokqc6cvvoni6d3srqdxaa.f0.mp4',
                    'duration': 25.588005,
                    'sha256': '934794a7fe322bfa9f44ee9b3c57444ab649351ea26b84493e47d9cffcf8b361',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-573399910': {'name': '尼泊尔军刀 机械纪元',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/jxjymp4.mp4',
                    'duration': 10.284026,
                    'sha256': 'e66eff0795a26d76f0f1231efba4bf955d9a64630ace6ac6300fa770b67d33fe',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-542636341': {'name': '尼泊尔军刀 雷霆',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_90ae74ebc00b2276ecfb1246ec39d6e3_1769397815/0b53gyad4aaayyaog43whzu6onwdhy3aapqa.f0.mp4',
                    'duration': 16.625,
                    'sha256': 'dbeb9f4d55e1dd364911739def8c18a4fbe2b6edfed74986f975fff2c1eddd5f',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-553214533': {'name': 'USP 虹儿',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/v6.mp4',
                    'duration': 7.208333,
                    'sha256': 'd13994d2c5b291a6241f6db5e130cce315befe665464ed19daf499f9fea6c372',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-619627854': {'name': '军用铁锹 擎天',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/qtjsyl.mp4',
                    'duration': 20.544,
                    'sha256': 'a5fc0cc2165fe1530c2f7e83acd76e72138a5fa47e9482081f598ff78a913e75',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-641144744': {'name': '尼泊尔军刀 屠龙',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_c4a2016535283ac6026a6038b2738c57_1784625674/0b535ibayaaceuadkzc5mfvol2wdbtvaedaa.f0.mp4',
                    'duration': 24.288005,
                    'sha256': 'a53e632d7f62856af76e3c19d7d2c0899bba679635146a768d0cf72fc99ef4b0',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-670055236': {'name': 'QBZ-192 湾区之光',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_766b49a52c0633d4136d0e836b4c6080_1770195306/0b534iawsaabxmagbrecevu6nywdnhrac2ia.f0.mp4',
                    'duration': 15.583333,
                    'sha256': 'cd0c56fe3e494ed1a4c3eebfec0c7be3a7fd1bf83832df0626cc2135307dd070',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True},
 'cfhd-607203696': {'name': 'QBZ-191 湾区之光',
                    'url': 'https://cfhd.lv.game.qq.com/dis_kt_d4fc7483c193d0712019f404d06d26e1_1770195276/0b536qa2uaabzqakhamcsju6n5gdvl2adkqa.f0.mp4',
                    'duration': 14.416667,
                    'sha256': '2fea4125055866d3b92d4f46a529a1ee5cb8a10b1e0cd27929cb76c91e28bcad',
                    'reviewedAt': '2026-11-02',
                    'baseOnly': True}}
REVIEWED_GIFS = {'cfhd-670055236': {'id': 'cfhd-670055236',
                    'name': 'QBZ-192 湾区之光',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-qbz192wqzg.gif',
                    'frames': 115,
                    'duration': 9.2,
                    'sha256': '0e198bddca305e566bed3320b090f00a16bcad263f14e29b2984f14fbcf5d036',
                    'bytes': 3520788,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-607203696': {'id': 'cfhd-607203696',
                    'name': 'QBZ-191 湾区之光',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-qbz191wqzg.gif',
                    'frames': 117,
                    'duration': 9.36,
                    'sha256': '72cf0c7baba92592e7db1a3c26853f4cca1c2b065c2e93eeb534b8e4aa05b237',
                    'bytes': 4067489,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-599577763': {'id': 'cfhd-599577763',
                    'name': 'QBZ-191 武韵秦影',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-wyqy.gif',
                    'frames': 213,
                    'duration': 17.04,
                    'sha256': '3c94a07d8c34259aa960114ebf15f647a615adcfe2730f82dd4452908ecfdb99',
                    'bytes': 4794817,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-544436995': {'id': 'cfhd-544436995',
                    'name': 'AK-47 火麒麟',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-hql.gif',
                    'frames': 147,
                    'duration': 11.76,
                    'sha256': 'a90702d8b849c9470435549c7c27551fd781d6758518f53a80be60575fb106d9',
                    'bytes': 4264355,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-572687120': {'id': 'cfhd-572687120',
                    'name': '加特林机枪 炼狱',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-ly.gif',
                    'frames': 141,
                    'duration': 11.28,
                    'sha256': 'fccaa3febfd01efd30c843664392285339b254fe64299922c2aed70d52ebc656',
                    'bytes': 4417146,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-628109726': {'id': 'cfhd-628109726',
                    'name': 'AK-47 贵族',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-ak47gz.gif',
                    'frames': 163,
                    'duration': 13.04,
                    'sha256': '85a4c27bbdf459ff6ac2ea8dce3d2a02dfd7b52c2f6294393259f33eb828f192',
                    'bytes': 5136565,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-605251360': {'id': 'cfhd-605251360',
                    'name': 'AWM 贵族',
                    'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-awmgz.gif',
                    'frames': 166,
                    'duration': 13.28,
                    'sha256': '24449f86915f7fa9d9bffed7b1b6159226e8d6b8e09ae7104a6293e819937649',
                    'bytes': 4222399,
                    'width': 400,
                    'height': 225,
                    'reviewedAt': '2026-11-02'},
 'cfhd-chroma-649102622': {'id': 'cfhd-chroma-649102622',
                           'name': 'M4A1 雷神 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-lswzlf.gif',
                           'frames': 198,
                           'duration': 15.84,
                           'sha256': 'afeadedd44c36ec0ab55257edd9d6fe70a28dd1903bb51c75f4264a500fbf796',
                           'bytes': 4498620,
                           'width': 400,
                           'height': 225,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-667300530',
                           'chromaId': 'cfhd-chroma-649102622'},
 'cfhd-chroma-670924180': {'id': 'cfhd-chroma-670924180',
                           'name': '尼泊尔军刀 屠龙 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-nbrjdtlwzff.gif',
                           'frames': 107,
                           'duration': 10.7,
                           'sha256': '383bfb5e413be0609a572768e30b558519e99fdb4e8eb1dec66e2d4d1b8e01a1',
                           'bytes': 4503616,
                           'width': 400,
                           'height': 226,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-641144744',
                           'chromaId': 'cfhd-chroma-670924180'},
 'cfhd-chroma-584651612': {'id': 'cfhd-chroma-584651612',
                           'name': 'AWM 天龙 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-awmtlwzff.gif',
                           'frames': 107,
                           'duration': 15.29,
                           'sha256': 'ccb0f6e6af8bc445f45e5c61836aa6c45963c3ba2a4076ad2e91727b5be9dce7',
                           'bytes': 4652298,
                           'width': 400,
                           'height': 226,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-634605171',
                           'chromaId': 'cfhd-chroma-584651612'},
 'cfhd-chroma-630388483': {'id': 'cfhd-chroma-630388483',
                           'name': '军用铁锹 擎天 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-jytqqtwzff.gif',
                           'frames': 108,
                           'duration': 12.0,
                           'sha256': 'f700646affb2b8c22f234d45b416bf8d31a98e2378775ef85cdd01ab0d3efb18',
                           'bytes': 5015123,
                           'width': 400,
                           'height': 226,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-619627854',
                           'chromaId': 'cfhd-chroma-630388483'},
 'cfhd-chroma-633704214': {'id': 'cfhd-chroma-633704214',
                           'name': 'SCAR LIGHT 白虎 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-scarbh.gif',
                           'frames': 157,
                           'duration': 12.56,
                           'sha256': 'db211d8c81828cbe8d06b9c65b66f6527b23af418f8ce078a8947d0321fbed9d',
                           'bytes': 4581963,
                           'width': 400,
                           'height': 225,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-569742142',
                           'chromaId': 'cfhd-chroma-633704214'},
 'cfhd-chroma-607733308': {'id': 'cfhd-chroma-607733308',
                           'name': '尼泊尔军刀 雷霆 王者风范',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-nbegdltwz.gif',
                           'frames': 351,
                           'duration': 14.04,
                           'sha256': 'a8c228479165edf6e1835f4d3af4a8519e52601eceb53bd69c2daf7cd82e7707',
                           'bytes': 4855395,
                           'width': 400,
                           'height': 225,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-542636341',
                           'chromaId': 'cfhd-chroma-607733308'},
 'cfhd-chroma-642260976': {'id': 'cfhd-chroma-642260976',
                           'name': '81式步枪 机械纪元 王者之纪',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-jxjy-81swz.gif',
                           'frames': 500,
                           'duration': 28.8,
                           'sha256': '850f917a61b8895a1d5960fdbe143e383d9cf7998bb964872e6c786a1740acae',
                           'bytes': 5118522,
                           'width': 400,
                           'height': 225,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-613114618',
                           'chromaId': 'cfhd-chroma-642260976'},
 'cfhd-chroma-566633808': {'id': 'cfhd-chroma-566633808',
                           'name': '尼泊尔军刀 机械纪元 极光棱晶',
                           'url': 'https://game.gtimg.cn/images/cfhd/cp/a20250712slmb/h-jxjy-jglj.gif',
                           'frames': 168,
                           'duration': 13.44,
                           'sha256': '74008314284cb0ac13b5c29565d9c00191b65d21e24c24ce02735020759e89e9',
                           'bytes': 4916811,
                           'width': 400,
                           'height': 224,
                           'reviewedAt': '2026-11-02',
                           'parentId': 'cfhd-573399910',
                           'chromaId': 'cfhd-chroma-566633808'},
 'cfhd-628367317': {'url': 'https://game.gtimg.cn/images/cfhd/cp/a20261101mact/tab1/m30gif1.gif?v=2',
                    'frames': 59,
                    'width': 604,
                    'height': 332,
                    'bytes': 4154532,
                    'sha256': '3bff8efdc28e843a382022429850461843844e0b21ae79b74d0b1e822783111f',
                    'id': 'cfhd-628367317',
                    'name': '汤姆逊冲锋枪 魔藤南瓜',
                    'reviewedAt': '2026-11-02',
                    'duration': 13.11},
 'cfhd-600677750': {'url': 'https://game.gtimg.cn/images/cfhd/cp/a20261101mact/tab1/m30gif2.gif?v=2',
                    'frames': 59,
                    'width': 604,
                    'height': 332,
                    'bytes': 4036915,
                    'sha256': '200d789b3e7c060c53ac830f4cde58bbec3df06e5e4114de5fe8c2dbbf23e33a',
                    'id': 'cfhd-600677750',
                    'name': 'P90 汪汪汪',
                    'reviewedAt': '2026-11-02',
                    'duration': 14.75}}
# Upstream maps these distinct names to an unrelated existing skin icon.
# Keep the directory identities while withholding their unconfirmed pictures.
IMAGE_MAPPING_HOLDS = {
    'cfhd-587221137': {'name':'MK12 七彩气球','reason':'上游与 MK12 涂鸦 SMOKE35 共用蓝白涂鸦原图，七彩气球的独立彩图尚未核定。'},
    'cfhd-639029055': {'name':'GALIL 猛虎','reason':'上游与 GALIL 热带雨林共用 TAIGA 原图，猛虎的独立彩图尚未核定。'},
    'cfhd-592278899': {'name':'汤姆逊冲锋枪 金乌','reason':'上游与汤姆逊冲锋枪黑曜共用银黑 STEALTH 原图，金乌的独立彩图尚未核定。'},
    'cfhd-570165034': {'name':'AK-47 玫瑰','reason':'上游使用 AK47.png 原型占位图，玫瑰涂装的独立彩图尚未核定。'},
    'cfhd-627846820': {'name':'AK-47 星河','reason':'上游使用 AK47.png 原型占位图，星河涂装的独立彩图尚未核定。'},
    'cfhd-663306673': {'name':'AK-47 遗迹','reason':'上游使用 AK47.png 原型占位图，遗迹涂装的独立彩图尚未核定。'},
    'cfhd-663306674': {'name':'AK-47 非洲部落','reason':'上游使用 AK47.png 原型占位图，非洲部落涂装的独立彩图尚未核定。'},
    'cfhd-647565562': {'name':'M4A1 星河','reason':'上游使用 M4A1.png 原型占位图，星河涂装的独立彩图尚未核定。'},
    'cfhd-647565563': {'name':'M4A1 荧光','reason':'上游使用 M4A1.png 原型占位图，荧光涂装的独立彩图尚未核定。'},
}

OFFICIAL_PAGE = "https://cfhd.cf.qq.com/cp/a20261101mact/index.html"

def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')

def atomic_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(temporary,path)

def safe_url(url):
    parsed=urlparse(url)
    if parsed.scheme!='https' or parsed.username or parsed.password:
        raise ValueError('Unsafe public resource URL: '+url)
    return url

class Fetcher:
    def __init__(self,offline=False,refresh=False,rate=1.0):
        self.offline,self.refresh=offline,refresh
        CACHE.mkdir(parents=True,exist_ok=True)
        self.interval=1/max(.2,rate)
        self.next_request=0.0
        self.lock=threading.Lock()
        self.breaker=False
        self.session=None
        if not offline:
            if sys.platform=='win32':
                local_dependencies=LOCAL/'runtime-deps'
                if local_dependencies.is_dir():
                    sys.path.insert(0,str(local_dependencies))
                try:
                    import truststore
                except ImportError as error:
                    raise RuntimeError('Verified Windows HTTPS needs truststore: python -m pip install truststore') from error
                truststore.inject_into_ssl()
            import requests
            self.requests=requests
            self.session=requests.Session()
            self.session.verify=True
            self.session.headers.update({'User-Agent':'CFHD-Weapon-Catalogue/1.0 (+public-source-research)'})

    def fetch(self,url,referer=None,refresh=None):
        safe_url(url)
        key=hashlib.sha256(url.encode()).hexdigest()
        blob,metadata=CACHE/(key+'.bin'),CACHE/(key+'.json')
        use_refresh=self.refresh if refresh is None else refresh
        if blob.exists() and metadata.exists() and (self.offline or not use_refresh):
            meta=json.loads(metadata.read_text(encoding='utf-8'))
            body=blob.read_bytes()
            if meta.get('sha256')!=hashlib.sha256(body).hexdigest():
                raise RuntimeError('Cached source hash mismatch: '+url)
            return body,meta
        if self.offline:raise RuntimeError('No successful offline snapshot: '+url)
        # Serialize new requests so every image reuses the same HTTPS pool.
        # A 429, certificate/TLS or connection failure stops the run immediately.
        with self.lock:
            if self.breaker:raise RuntimeError('Community source circuit breaker is open')
            time.sleep(max(0,self.next_request-time.monotonic()))
            self.next_request=time.monotonic()+self.interval
            try:
                headers={'Referer':referer} if referer else None
                with self.session.get(url,headers=headers,timeout=(8,25)) as response:
                    if response.status_code==429:
                        self.breaker=True
                    response.raise_for_status()
                    safe_url(response.url)
                    body=response.content
                    response_type=response.headers.get('Content-Type','')
            except self.requests.RequestException as error:
                if isinstance(error,(self.requests.exceptions.SSLError,
                                     self.requests.exceptions.ConnectionError,
                                     self.requests.exceptions.Timeout)):
                    self.breaker=True
                raise RuntimeError(url+': '+str(error)[:300]) from error
            if not body:raise RuntimeError('Empty source: '+url)
            meta={'url':url,'retrievedAt':stamp(),'bytes':len(body),
                  'sha256':hashlib.sha256(body).hexdigest()}
            if referer:meta['referer']=referer
            if response_type:meta['contentType']=response_type
            temporary=blob.with_suffix('.download')
            temporary.write_bytes(body)
            os.replace(temporary,blob)
            atomic_json(metadata,meta)
            return body,meta

    def json(self,url):
        body,meta=self.fetch(url)
        return json.loads(body.decode('utf-8-sig')),meta


def old_data():
    if not DATA.exists():
        return {'schemaVersion':1,'game':'cfhd','source':{},'coverage':{},'skins':[]}
    data=json.loads(DATA.read_text(encoding='utf-8'))
    if data.get('game')!='cfhd':raise RuntimeError('Wrong game seed')
    return data

def verify_local_image(image):
    path=image.get('url','')
    if not path.startswith('assets/weapon-skins/'):return False
    absolute=ROOT/path
    if not absolute.is_file():return False
    body=absolute.read_bytes()
    if hashlib.sha256(body).hexdigest()!=image.get('sha256'):return False
    with Image.open(BytesIO(body)) as decoded:
        decoded.load()
        if decoded.width<60 or decoded.height<30:return False
    return True

def source_catalogue(fetcher,old):
    requests=[]
    weapons=[]
    for category in (0,1,2):
        offset=0
        group=[]
        while True:
            url=BASE+'api/weapons.php?'+urlencode({'category':category,'offset':offset,'limit':200,'sort':'id_desc'})
            obj,meta=fetcher.json(url);requests.append(meta)
            if not obj.get('ok') or not isinstance(obj.get('items'),list):
                raise RuntimeError('Invalid CFHD category response')
            group.extend(obj['items'])
            if len(group)>=int(obj['total']):break
            if not obj['items']:raise RuntimeError('CFHD pagination ended early')
            offset+=len(obj['items'])
        if len(group)!=int(obj['total']):raise RuntimeError('CFHD total changed during catalogue scan')
        weapons.extend((category,item) for item in group)
    if len(weapons)<70 or len({item['itemid'] for _,item in weapons})!=len(weapons):
        raise RuntimeError('CFHD weapon catalogue unexpectedly shrank or duplicated')

    def collect(pair):
        category,weapon=pair
        url=BASE+'api/weapons.php?'+urlencode({'skins':1,'itemid':weapon['itemid']})
        obj,meta=fetcher.json(url)
        if not obj.get('ok') or not isinstance(obj.get('skins'),list):
            raise RuntimeError('Invalid CFHD skin response')
        return category,weapon,obj['skins'],meta
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        groups=list(pool.map(collect,weapons))
    prior={item['id']:item for item in old.get('skins',[])+old.get('historicalSkins',[])}
    skins=[]
    all_source_ids=set()
    source_count=chroma_count=0
    for category,weapon,rows,meta in groups:
        requests.append(meta)
        source_count+=len(rows)
        source_ids={str(row['typeid']) for row in rows}
        if len(source_ids)!=len(rows) or all_source_ids & source_ids:
            raise RuntimeError('Duplicate CFHD source identity')
        all_source_ids.update(source_ids)
        parents={}
        for row in rows:
            parent=str(row.get('skin_model_typeid') or '')
            if parent and parent in source_ids:continue
            ident='cfhd-'+str(row['typeid'])
            previous=prior.get(ident,{})
            url=safe_url(urljoin(BASE,row['icon'].replace('\\','/')))
            candidate={'url':url,'sourcePageUrl':PAGE,'assetSourceUrl':url,'sourceType':'game_asset',
                'provider':'CFHD 数据中心 · 玩家整理的游戏资源','kind':'render',
                'caption':'游戏武器资源图，由社区资料站按武器与皮肤 ID 提供。','retrievedAt':meta['retrievedAt']}
            item=deepcopy(previous)
            grade=row.get('grade')
            item.update({
                'id':ident,'game':'cfhd','name':row['name'],'englishName':'',
                'weaponId':'cfhd-weapon-'+str(weapon['itemid']),'weaponName':weapon['namechn'],
                'weaponEnglishName':'','weaponType':'melee' if category==2 else 'gun',
                'category':'近战武器' if category==2 else ('副武器' if category==1 else '主武器'),
                'rarity':{'id':str(grade),'name':GRADES.get(grade,'未核品质'),'color':COLORS.get(grade,'#728782')},
                'description':weapon['namechn']+' 的 CFHD 国服武器外观。目录来自玩家维护的数据中心，保留独立皮肤与炫彩 ID；不据此推断当前在售或精确首发日期。',
                'sourceId':str(row['typeid']),'sourceUrl':PAGE,'sourceName':'CFHD 数据中心（非官方）',
                'sourceApiUrl':meta['url'],'sourceWeaponId':weapon['itemid'],'sourceResourceId':row.get('pid'),
                'region':'国服','gameTitle':'穿越火线高清竞技大区',
                'firstSeenAt':previous.get('firstSeenAt',stamp()[:10]),
                'releaseDate':previous.get('releaseDate'),
                'releaseDateStatus':previous.get('releaseDateStatus','unverified'),
                'timingNote':'目录采集和原稿发表时间均不作为武器外观首发日期；未据此判断当前可获取状态。',
                'image':deepcopy(previous.get('image',candidate)),
                'communityImageCandidate':candidate,'publicationStatus':'pending_image',
                'chromas':[],'levels':previous.get('levels',[]),'media':previous.get('media',[]),
                'tags':previous.get('tags',[]),
            })
            item.pop('pendingChromas',None)
            if parent:item['variantOfSourceId']=parent
            parents[str(row['typeid'])]=item
            skins.append(item)
        for row in rows:
            parent=str(row.get('skin_model_typeid') or '')
            if not parent or parent not in parents:continue
            url=safe_url(urljoin(BASE,row['icon'].replace('\\','/')))
            previous=prior.get(parents[parent]['id'],{})
            previous_chromas=previous.get('chromas',[])+previous.get('pendingChromas',[])
            chroma_id='cfhd-chroma-'+str(row['typeid'])
            chroma=deepcopy(next((c for c in previous_chromas if c['id']==chroma_id),{}))
            chroma.update({
                'id':chroma_id,'name':row['name'],
                'displayIcon':url,'fullRender':url,'sourceId':str(row['typeid']),
                'sourceUrl':PAGE,'sourceApiUrl':meta['url'],'sourceType':'game_asset',
                'assetSourceUrl':url,
            })
            parents[parent]['chromas'].append(chroma)
            chroma_count+=1
    if len(skins)<1400:raise RuntimeError('CFHD parent skin catalogue unexpectedly small')
    return skins,requests,{'sourceWeaponCount':len(weapons),'sourceResourceCount':source_count,
                            'chromaCount':chroma_count}

def archive_image(fetcher,ident,url,page,provider,source_type,kind='render'):
    body,meta=fetcher.fetch(url,page)
    with Image.open(BytesIO(body)) as decoded:
        decoded.load()
        width,height=decoded.size
        if width<60 or height<30:raise RuntimeError('Unexpectedly small image: '+ident)
        extension={'PNG':'.png','JPEG':'.jpg','GIF':'.gif','WEBP':'.webp'}[decoded.format]
    relative=ASSETS/(ident+extension)
    target=ROOT/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=meta['sha256']:
        temporary=target.with_name(target.name+'.tmp')
        temporary.write_bytes(body)
        os.replace(temporary,target)
    image={'url':relative.as_posix(),'assetSourceUrl':url,'sourcePageUrl':page,
        'sourceType':source_type,'provider':provider,'kind':kind,
        'caption':'原始武器资源图，按上游皮肤 ID 与名称一一对应，未裁切、缩放或改绘。',
        'width':width,'height':height,'sha256':hashlib.sha256(body).hexdigest(),
        'retrievedAt':meta['retrievedAt']}
    return image,meta

def restore_images(fetcher,skins,workers=2):
    image_requests=[]
    failures=[]
    checked=0
    lock=threading.Lock()
    def collect(item):
        nonlocal checked
        local_requests=[]
        if fetcher.breaker:return item
        candidate=item['communityImageCandidate']
        try:
            if item.get('image',{}).get('sourceType')=='official' and verify_local_image(item['image']):
                item['publicationStatus']='ready'
            else:
                image,meta=archive_image(fetcher,item['id'],candidate['assetSourceUrl'],PAGE,
                    candidate['provider'],'game_asset')
                item['image']=image
                local_requests.append(meta)
                item['publicationStatus']='ready'
            item.pop('publicationNote',None)
        except Exception as error:
            # A transient live failure never removes an already valid local picture.
            if verify_local_image(item.get('image',{})):
                item['publicationStatus']='ready'
            else:
                item['publicationStatus']='pending_image'
                item['publicationNote']='对应原图获取或解码失败，保留目录身份，暂不公开。'
            with lock:failures.append({'id':item['id'],'kind':'skin','error':str(error)})
        successful=[]
        pending=[]
        for chroma in item['chromas']:
            try:
                image,meta=archive_image(fetcher,chroma['id'],chroma['assetSourceUrl'],PAGE,
                    'CFHD 数据中心 · 玩家整理的游戏资源','game_asset')
                chroma.update({'displayIcon':image['url'],'fullRender':image['url'],'imageUrl':image['url'],'image':image})
                successful.append(chroma);local_requests.append(meta)
            except Exception as error:
                if verify_local_image(chroma.get('image',{})):
                    local_url=chroma['image']['url']
                    chroma.update({'displayIcon':local_url,'fullRender':local_url,'imageUrl':local_url})
                    successful.append(chroma)
                else:
                    pending.append(chroma)
                with lock:failures.append({'id':chroma['id'],'kind':'chroma','error':str(error)})
        item['chromas']=successful
        if successful and item['publicationStatus']=='ready':
            item['chromas'].insert(0,{'id':'cfhd-base-'+item['sourceId'],'name':'基础外观 · '+item['name'],
                'isBase':True,'sourceId':item['sourceId'],'displayIcon':item['image']['url'],
                'fullRender':item['image']['url'],'imageUrl':item['image']['url'],'sourceUrl':item['image']['sourcePageUrl'],
                'sourceType':item['image']['sourceType'],'image':deepcopy(item['image'])})
        if pending:item['pendingChromas']=pending
        else:item.pop('pendingChromas',None)
        with lock:
            image_requests.extend(local_requests)
            checked+=1
            if checked%100==0:print(json.dumps({'processedSkins':checked,'totalSkins':len(skins),'failedResources':len(failures)}),flush=True)
        return item
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        # Obtain knives first; keep the canonical catalogue ordering unchanged.
        ordered=sorted(skins,key=lambda item:(item['weaponType']!='melee',item['id'] not in REVIEWED_MEDIA))
        list(pool.map(collect,ordered))
        result=skins
    if fetcher.breaker:
        atomic_json(LOCAL/'source-outage.json',{'at':stamp(),'failures':failures[:6]})
        raise RuntimeError('Community source returned a TLS/connection error or HTTP 429; stopped new requests and preserved prior dataset')
    image_requests.sort(key=lambda x:x['url'])
    return result,image_requests,failures


def add_reviewed_media(fetcher,skins,requests):
    raw,meta=fetcher.fetch(OFFICIAL_PAGE,refresh=False)
    source=raw.decode('gb18030','replace')
    text=' '.join(re.sub('<[^>]+>',' ',source).split())
    requests.append(meta)
    for item in skins:
        review=REVIEWED_MEDIA.get(item['id'])
        if not review:continue
        if item['name']!=review['name'] or review['name'] not in text:
            raise RuntimeError('Reviewed media identity no longer matches official panel')
        if review['url'] not in source and review['url'].replace('https:','') not in source:
            raise RuntimeError('Reviewed media URL no longer present in official source snapshot')
        media=next((m for m in item['media'] if m['url']==review['url']),None)
        if not media:
            media={'id':'cfhd-official-video-'+item['sourceId'],'kind':'showcase','provider':'mp4',
                'url':review['url'],'title':item['name']+' · 官网检视与实战展示',
                'sourcePageUrl':OFFICIAL_PAGE,'sourceName':'CFHD 官方网站','sourceType':'official'}
            item['media'].append(media)
        media.update({'contains':sorted(set(media.get('contains',[])+['inspect'])),
            'duration':review['duration'],'reviewStatus':'sample_reviewed',
            'reviewedAt':review['reviewedAt'],'assetSha256':review['sha256'],
            'reviewNote':'已抽帧核对官网原片，武器外观与原稿面板对应，实际含第一人称检视；原片部分另有射击、换弹或实战，未标注精确片段起止。'})

def add_reviewed_gifs(fetcher,skins,requests):
    raw,_=fetcher.fetch(OFFICIAL_PAGE,refresh=False)
    source=raw.decode('gb18030','replace')
    text=' '.join(re.sub('<[^>]+>',' ',source).split())
    lookup={item['id']:item for item in skins}
    for ident,review in REVIEWED_GIFS.items():
        item=lookup.get(review.get('parentId',ident))
        if item is None:raise RuntimeError('Reviewed GIF parent skin missing')
        if review.get('chromaId'):
            chroma=next((c for c in item['chromas'] if c['id']==review['chromaId']),None)
            if chroma is None or chroma['name']!=review['name']:
                raise RuntimeError('Reviewed chroma GIF identity no longer matches source catalogue')
        elif item['name']!=review['name']:
            raise RuntimeError('Reviewed GIF identity no longer matches source catalogue')
        if item['name'] not in text:
            raise RuntimeError('Reviewed GIF parent name no longer matches official panel')
        if review['url'] not in source and review['url'].replace('https:','') not in source:
            raise RuntimeError('Reviewed GIF URL no longer present in official panel')
        body,meta=fetcher.fetch(review['url'],OFFICIAL_PAGE,refresh=False)
        if hashlib.sha256(body).hexdigest()!=review['sha256']:
            raise RuntimeError('Official animation changed after frame review')
        with Image.open(BytesIO(body)) as decoded:
            if decoded.format!='GIF' or decoded.n_frames!=review['frames']:
                raise RuntimeError('Invalid reviewed official animation')
        requests.append(meta)
        media=next((m for m in item['media'] if m['url']==review['url']),None)
        if media is None:
            media={'id':'cfhd-official-gif-'+ident.removeprefix('cfhd-'),'kind':'showcase',
                'provider':'gif','url':review['url'],'title':review['name']+' · 官网检视与实战动图',
                'sourcePageUrl':OFFICIAL_PAGE,'sourceName':'CFHD 官方网站','sourceType':'official'}
            item['media'].append(media)
        if review.get('chromaId'):
            media.update({'chromaId':review['chromaId'],'chromaName':review['name']})
        media.update({'contains':['inspect'],'reviewStatus':'sample_reviewed',
            'reviewedAt':review['reviewedAt'],'duration':review['duration'],
            'assetSha256':review['sha256'],'width':review['width'],'height':review['height'],
            'reviewNote':'已抽帧核对官网原始动图，画面具名且实际包含本外观的第一人称检视及实战；动作是否为该外观独有尚未核定。'})

def bind_reviewed_base_videos(skins):
    for item in skins:
        review=REVIEWED_MEDIA.get(item['id'])
        if not review or not review.get('baseOnly'):continue
        base=next((chroma for chroma in item['chromas'] if chroma.get('isBase')),None)
        for media in item['media']:
            if media['provider']!='mp4' or media['url']!=review['url']:continue
            media['chromaScope']='base'
            if base:
                media.update({'chromaId':base['id'],'chromaName':base['name'],
                              'chromaReviewNote':'已按每0.5秒抽帧核对：画面对应基础配色，绑定基础外观，不作为其他炫彩的通用动作。'})
            else:
                media.pop('chromaId',None)
                media.pop('chromaName',None)

def apply_image_mapping_reviews(skins):
    shared={}
    for item in skins:
        item.pop('imageMappingStatus',None)
        item.pop('imageMappingNote',None)
        hold=IMAGE_MAPPING_HOLDS.get(item['id'])
        if hold:
            if item['name']!=hold['name']:
                raise RuntimeError('Image mapping hold no longer matches source identity')
            item.update({'publicationStatus':'pending_image','publicationNote':hold['reason']+' 暂不公开。',
                         'imageMappingStatus':'needs_review','imageMappingNote':hold['reason']})
        image=item.get('image',{})
        image.pop('sharedSourceImageIds',None)
        image.pop('sharedSourceImageNote',None)
        if image.get('sha256'):
            shared.setdefault(image['sha256'],[]).append((item['id'],item['name'],image))
        for chroma in item['chromas']:
            if chroma.get('isBase'):continue
            image=chroma.get('image',{})
            image.pop('sharedSourceImageIds',None)
            image.pop('sharedSourceImageNote',None)
            if image.get('sha256'):
                shared.setdefault(image['sha256'],[]).append((chroma['id'],chroma['name'],image))
    for entries in shared.values():
        if len(entries)<2:continue
        for ident,name,image in entries:
            image['sharedSourceImageIds']=[other for other,_,_ in entries if other!=ident]
            image['sharedSourceImageNote']='上游这些目录身份共用同一张原图：'+'、'.join(label for _,label,_ in entries)+'。不据缩略图认定铭刻或别名记录之间存在可见差异。'

def validate_result(data):
    identities=set()
    for item in data['skins']:
        assert item['id'] not in identities
        identities.add(item['id'])
        if item['publicationStatus']=='ready':
            assert verify_local_image(item['image'])
            for chroma in item['chromas']:
                assert verify_local_image(chroma['image'])
                assert chroma['fullRender']==chroma['image']['url']
    assert len(data['skins'])==data['coverage']['cataloguedCount']

def sync(args):
    old=old_data()
    fetcher=Fetcher(args.offline,args.refresh,args.rate)
    skins,requests,source_counts=source_catalogue(fetcher,old)
    add_reviewed_media(fetcher,skins,requests)
    add_reviewed_gifs(fetcher,skins,requests)
    skins,image_requests,failures=restore_images(fetcher,skins,args.workers)
    requests.extend(image_requests)
    bind_reviewed_base_videos(skins)
    apply_image_mapping_reviews(skins)
    ready=[item for item in skins if item['publicationStatus']=='ready']
    ready_chromas=sum(sum(not x.get('isBase') for x in item['chromas']) for item in ready)
    old_ids={item['id'] for item in skins}
    historical=[dict(item,publicationStatus='historical') for item in old.get('skins',[])+old.get('historicalSkins',[]) if item['id'] not in old_ids]
    coverage={
        'status':'catalogued' if len(ready)==len(skins) and not failures else 'partial',
        'complete':False,'catalogScope':'community_catalogue_snapshot',**source_counts,
        'cataloguedCount':len(skins),'readyCount':len(ready),
        'pendingImageCount':len(skins)-len(ready),
        'imageMappingReviewCount':sum(item.get('imageMappingStatus')=='needs_review' for item in skins),
        'readyChromaCount':ready_chromas,
        'pendingChromaImageCount':sum(len(item.get('pendingChromas',[])) for item in skins),
        'gunCount':sum(item['weaponType']=='gun' for item in ready),
        'meleeCount':sum(item['weaponType']=='melee' for item in ready),
        'withVideoCount':sum(any(m['provider'] in {'mp4','bilibili','youtube'} for m in item['media']) for item in ready),
        'withAnimationCount':sum(any(m['provider']=='gif' for m in item['media']) for item in ready),
        'withMediaCount':sum(bool(item['media']) for item in ready),
        'retainedHistoricalCount':len(historical),
        'scope':'已逐武器遍历本次 CFHD 数据中心公开主武器、副武器和近战列表，按皮肤 ID 归档实际彩图；炫彩归入母皮肤，排除投掷、C4、角色和配件。',
        'mediaScope':'仅经原稿或画面对应的展示、检视媒体关联到具体皮肤；完整静态目录不等于每款均有动作视频。',
        'note':'目录身份覆盖本次可枚举上游快照，公开彩图按 ready 计数；未声称官方全历史无遗漏或动作视频齐全。firstSeenAt 与首发日分开，未推断当前可获取状态。',
        'remaining':([str(len(skins)-len(ready))+'款原图缺失或映射冲突'] if len(ready)<len(skins) else [])+['官方全历史目录对账','多数皮肤第一人称动作视频','精确首发日期'],
    }
    retrieved=max([meta['retrievedAt'] for meta in requests]+[old.get('updatedAt','')])
    data={'schemaVersion':1,'game':'cfhd','updatedAt':retrieved,
        'source':{'name':'CFHD 数据中心（非官方）与 CFHD 官网展示','url':PAGE,
                  'type':'community_catalogue','retrievedAt':retrieved,'requests':requests},
        'coverage':coverage,'skins':skins,'historicalSkins':historical}
    validate_result(data)
    if args.require_complete and (coverage['pendingImageCount'] or coverage['pendingChromaImageCount']):
        atomic_json(LOCAL/'resource-failures.json',{'failures':failures,'coverage':coverage})
        raise RuntimeError('Incomplete resource run; prior successful dataset preserved')
    atomic_json(DATA,data)
    if failures:atomic_json(LOCAL/'resource-failures.json',{'failures':failures,'coverage':coverage})
    raw_bytes=sum((ROOT/item['image']['url']).stat().st_size for item in ready
                  if item['image']['url'].startswith(ASSETS.as_posix()+'/'))
    raw_bytes+=sum((ROOT/chroma['image']['url']).stat().st_size for item in ready for chroma in item['chromas'] if not chroma.get('isBase'))
    summary={'coverage':coverage,'newArchiveBytes':raw_bytes,'failedResources':len(failures)}
    atomic_json(LOCAL/'last-success.json',summary)
    print(json.dumps(summary,ensure_ascii=False),flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--refresh',action='store_true',help='Refetch source metadata and image URLs instead of reusing successful cache')
    parser.add_argument('--rate',type=float,default=1.0,help='Maximum new public requests per second')
    parser.add_argument('--workers',type=int,choices=[1,2,3],default=1)
    parser.add_argument('--require-complete',action='store_true')
    args=parser.parse_args()
    if args.offline and args.refresh:parser.error('--offline and --refresh are mutually exclusive')
    try:sync(args)
    except Exception as error:
        print('CFHD sync failed; prior dataset preserved: '+str(error),file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
