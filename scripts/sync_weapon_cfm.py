#!/usr/bin/env python3
"""Expand CFM from fully traversed public category pages and the official CMS.

This script owns CFM only. It retains the previous 252 identities/media and
keeps source index scans separate from item/image/action verification.
--index-only refreshes the source inventory without changing public data.
--offline rebuilds retained responses without inventing a new check time.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
import hashlib,html,importlib.util,json,os,re,shutil,subprocess,sys,time
from pathlib import Path
from urllib.parse import urljoin,urlparse,urlencode
from io import BytesIO
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'local-only/weapon-skins/cf-mobile'
OUT=ROOT/'data/weapon-skins/cf-mobile.json'
spec=importlib.util.spec_from_file_location('cfm_common',ROOT/'scripts/sync_weapon_crossfire.py')
common=importlib.util.module_from_spec(spec);spec.loader.exec_module(common)
common.CACHE=CACHE/'responses'
SPEC2=importlib.util.spec_from_file_location('cfm_tree',ROOT/'scripts/sync_weapon_codm.py')
tree=importlib.util.module_from_spec(SPEC2);SPEC2.loader.exec_module(tree)
CMS='https://apps.game.qq.com/cmc/'
CFM='https://cfm.qq.com/web201801/'
INDEX='https://news.4399.com/cfsy/'
CATEGORIES=('bq','jjq','jq','cfq','sdq','sq','jzwq')
BARE=common.CFM_PROTOTYPES|{'AK47','M4A1','M16','M60','M249','SPAS12','RPK','AWM','巴雷特','MP5','XM1014','气锤','打击者','沙漠之鹰','USP','小刀','军用手斧','尼泊尔','军用铁锹','铁锹','P90','MG4','09式','蜂鸟','VSK-94','VSK94'}
THROW=re.compile(r'手雷|烟雾|闪光|魔术弹|变羊|双生雷|燃烧弹|投掷|高爆|C4|挂饰|玩偶|角色|人物|音效卡|击杀图标|光效|印花')
# Type is a property of the base weapon. Never infer it from skin words such
# as 剑/刃/盾, or another weapon/character discussed elsewhere in an article.
GUN_BASES=set("""09式狙 09式狙击枪 56式 97-2式防暴枪 9A91 AA12 ACR AK103 AK117 AK12 AK47 AK74 AN94 AR15 AUG AWM CBJ COP357 CZ75 CZS2 DDM4 FAMAS FNF2000 G11 G36 G3A3 GLOCK GLOCK18 GM6 Groza HK416 HK417 JNG KAC KSG Lancaster M1216 M12S M14EBR M16 M1887 M200 M240B M249 M37 M4 M4A1 M4A1-XS M60 MAC MAC10 MG3 MG36 MK23 MK47 MK5 MP5 MR1 Origin P365 P90 QBB95 QBU88 QBZ03 QBZ191 QBZ95 QBZ97 QCW05 QSZ92 RPK SCAR SCARLight SKS SPAS12 SR25 SW500X TAC USP UZI VEPR12 VEPR2 VSK XM1014 公测纪念AK47 冰龙火炮 剑齿虎 加特林 双持斯太尔 双持斯泰尔 双持柯尔特 双管猎枪 司登 嗜血金鲨 寒霜烈龙 左轮 巴雷特 征服者 打击者 掠夺者P365 斯泰尔 暗杀神 柯尔特 毛瑟 汤姆逊 汽锤 气锤 沙漠之鹰 沙鹰 玉兔枪 王者之光 王者之兽 王者之力 王者之势 王者之启 王者之圣 王者之城 王者之威 王者之尊 王者之影 王者之心 王者之怒 王者之戮 王者之技 王者之掣 王者之武 王者之电 王者之神 王者之翎 王者之翼 王者之腾 王者之轮 王者之辉 王者之迹 王者之隐 王者之霆 王者之魄 王者幻神 王者新星 王者白虎 玩具弹弓 萌犬枪 纪念版AK47 赛事黄金AK47 赤龙火炮 银月气锤 阿波罗之弓 风之子 黄金AWM 黄金气锤 黑龙魂 狂杀战弓 狂沙战弓""".split())
MELEE_BASES=set("""CF火炬 丛林匕首 像素大锤 充气大锤 光棍 军用铁铲 军铲 凝霜 凤舞 劳动铁锤 十冷神杖 三叉戟 叉戟 双截棍 双刃 唐刀 圣诞拐杖 圣诞马来剑 墨刃 天使智杖 女王利刃 女皇利刃 小刀 尼泊尔 尼泊尔军刀 屠龙 弑魔者 御火手斧 惨叫鸡 战斧 战锤 战队基石 手斧 军用手斧 擎天 擎天觉醒 教学米尺 斩魔剑 斩魔刀 无影法杖 星芒 春节鸡毛掸 末日裁决 极光剑 楼兰杖刀 海螯 激光剑 火尖枪 狂杀战剑 狂沙战剑 王者之仞 王者之击 王者之刺 王者之痕 王者之破 王者之锋 王者之啸 王者蝶刃 玩具苍蝇拍 甜筒匕首 甩棍 疾光双刃 破邪蛇棍觉醒 神罚战斧 耀金雷刃 苍龙拳套 蜂王刃鞭 蝴蝶刀 金刚 金刚伞 铁锹 军用铁锹 雷刃 马来剑 高能雷鞭 麒麟刺 黄金凤舞 黄金拖鞋 黄金拳套 黄金砖 黄金锅 黄金雷刃 龙啸 龙爪 龙舟船桨 龙鳞 金箍棒 棒球棒 大刀 墨青觉醒 军刃 终极绯刃 阔刀""".split())
TYPE_BY_BASE={**{w.casefold():'gun' for w in GUN_BASES},**{w.casefold():'melee' for w in MELEE_BASES}}
SNIPER_BASES=set('09式狙 09式狙击枪 AWM M200 QBU88 巴雷特 GM6 MR1 JNG TAC SR25 VSK 王者之光 王者之力 王者之怒 王者之掣 王者之神 王者之辉 王者幻神 暗杀神'.casefold().split())
SIDEARM_BASES=set('沙鹰 沙漠之鹰 COP357 柯尔特 双持柯尔特 CZS2 USP 左轮 GLOCK GLOCK18 P365 掠夺者P365 QSZ92 CZ75 MK23 SW500X 毛瑟 风之子 狂杀战弓 狂沙战弓 阿波罗之弓 玩具弹弓 王者之电 王者之轮 王者之迹 王者之隐'.casefold().split())
BASES=sorted(set(common.CFM_BASES)|GUN_BASES|MELEE_BASES|{'QBZ191','QBZ03','QBZ95','CZS2','USP','HK417','HK416','SKS','GLOCK','P365','G3A3','VEPR12','VEPR2','M200','M1216','QBU88','Lancaster','P90','M240B','M82A1','KSG','AA12','SPAS12','双持柯尔特','双管猎枪','双持斯泰尔','掠夺者P365','AK117','AK47','M4A1','COP357','COLT1911','唐刀','墨刃','阔刀','麒麟刺','丛林匕首','蝴蝶刀','尼泊尔军刀','小刀','斩魔刀','沙鹰','王者之','M4A1-XS','SCAR Light','COP 357'},key=lambda value:(-len(value),value.casefold(),value))
BASE_PATTERN='(?:'+ '|'.join(re.escape(x) for x in BASES if x!='王者之') +'|[A-Za-z][A-Za-z0-9.]{1,16})'
NAMED=re.compile(BASE_PATTERN+r'(?:[-－—][A-Za-z0-9\u4e00-\u9fff·.]+){1,5}',re.I)
END_WORDS=re.compile(r'(?:实战强度测评|武器评测|武器测评|深度评测|评测|测评|赏析|实测|解析|鉴赏|介绍|性能详解|返场了|再次返场|重磅返场|限时返场|返场|登场|来袭|即将上线|正式上线|上线|怎么样|怎么得|实战|性能|真是|到底|如何|究竟).*$',re.I)
META_END=re.compile(r'(?:奖励免费领|免费领|竞技生化|对比|大$|抢先了解|词条|重返战场|重磅|降临|即将|吧$|吗$|值得|再迎|趣味|满伤|局内|仓库|第一人称|第三人称|开火|切枪|换弹|动作|展示|表现|排位|首发|绚丽|迅猛|闪亮|多样|横空出世|邀$|炫酷|多角度|崭新|引领时代|威震千古|PVP|PVE|赏金令|获得|获取|来啦|永远|全民|重出江湖|告诉|惊艳|火爆|怎样|特色玩法|生成词条|兵行奇招|多方位|挑战|正式上架|五行晶石|高质量|堪称|助$|能成为|新$|带$|等来|等你|等$|限定$|霸气|畅游|强势|首次|惊喜|科幻|有多强|再度|详解|分享|速看|生化词条|万化|武器|好感度|简单|深度|试玩|可爱至极|颠覆|全新|简要|霸气回归|曝光|到来|综合实力|回归|上手|的|版本答案|削弱|九重强化|战力全开|大放光彩|所向披靡|全$|强势|抢先看|抢先展示|综合表现|全方位|详细|全面|外观|震撼|你值得拥有|你见过吗|真的香|真|与|和|携|羁绊|的经典时刻|你|强度|数据|属性|技能|效果|皮肤).*$')
HERO_BASES=set()
BAD_NAME=re.compile(r'BOSS|加强计划|ID[0-9]|活动|礼包|宝箱|夺宝|爆料|公告|评测|测评|解析|赏析|介绍|体验|新增|套装|系列|玩家|平衡|伤害|属性|技巧|攻略|数据|背包|皮肤$|武器$|地图|模式|角色|称号|消灭|专精|音效')

def normalize(s):
 s=html.unescape(s).strip().replace('—','-').replace('－','-').replace('–','-')
 s=re.sub(r'AK-?47','AK47',s,flags=re.I)
 s=re.sub(r'\s+','',s)
 return s.strip('-：:【】[]()（）一二三四五六七八九十、.。')
def clean_name(s):
 for repeat in range(4):
  updated=normalize(META_END.sub('',END_WORDS.sub('',s)))
  if updated==s:break
  s=updated
 s=re.sub(r'^COP-', 'COP357-',s,flags=re.I).replace('变形金刚-','变形金刚·')
 s=re.sub(r'(-[^-]+)\1$',r'\1',s)
 return {'AK47-秦佣':'AK47-秦俑','TAC-晴TAC-晴舞':'TAC-晴舞','M4A1-雷霆王者竞技':'M4A1-雷霆王者','COP357-堕天神来了':'COP357-堕天神','COP357-雷霆王者竞技':'COP357-雷霆王者','王者之势-HeartShot美艳':'王者之势-HeartShot','SCAR-守护者也能觉醒':'SCAR-守护者觉醒','M4A1-雷神荣耀墨白':'M4A1-雷神-荣耀墨白','M4A1-游骑兵荣耀大梦':'M4A1-游骑兵-荣耀大梦'}.get(s,s)
def key(s):return normalize(s).casefold()
def names(s):
 result=[]
 for match in NAMED.finditer(html.unescape(s)):
  prefix=re.search(r'(?:炫闪|源)[·・]$',html.unescape(s)[:match.start()])
  name=clean_name((prefix[0] if prefix else '')+match.group(0))
  if 3<len(name)<56 and not BAD_NAME.search(name) and not THROW.search(name) and all(key(name).replace('-','')!=key(v).replace('-','') for v in BARE):result.append(name)
 # Non-prefix named hero variants are admitted only when the source states an
 # exact short weapon title; not inferred from a promotional collection name.
 for hero in sorted(HERO_BASES,key=lambda value:(-len(value),value.casefold(),value)):
  pos=s.find(hero)
  if pos>=0 and not THROW.search(s[pos+len(hero):pos+len(hero)+8]):
   suffix=re.match(r'[-－—][A-Za-z0-9\u4e00-\u9fff·.]+',s[pos+len(hero):])
   candidate=hero+(suffix[0] if suffix else '')
   candidate=clean_name(candidate)
   if not BAD_NAME.search(candidate):result.append(candidate)
 return list(dict.fromkeys(result))

def atom(path,obj):common.atomically(path,obj)
def stamp():return common.stamp()
class Fetcher(common.Fetcher):
 def fetch(self,url,referer=None,request_url=None):
  if request_url is None:return super().fetch(url,referer)
  k=hashlib.sha256(url.encode()).hexdigest();p=common.CACHE/(k+'.bin');m=common.CACHE/(k+'.json')
  if p.exists() and m.exists() and(self.offline or not self.refresh):return p.read_bytes(),json.loads(m.read_text(encoding='utf-8'))
  if self.offline:raise RuntimeError('No successful offline snapshot: '+url)
  target=p.with_suffix('.download')
  proc=subprocess.run([self.curl,'--silent','--show-error','--location','--fail','--compressed','--retry','1','--max-time','40','--output',str(target),request_url],capture_output=True)
  if proc.returncode:target.unlink(missing_ok=True);raise RuntimeError(url+': '+proc.stderr.decode(errors='replace')[:240])
  raw=target.read_bytes()
  if not raw:target.unlink(missing_ok=True);raise RuntimeError('Empty response')
  os.replace(target,p);meta={'url':url,'retrievedAt':stamp(),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)};atom(m,meta)
  return raw,meta
 def detail(self,docid):
  logical=CMS+'complexDetail?'+urlencode({'source':'client_circle_list','ibiz':34,'detailFlag':1,'id':docid})
  t=str(int(time.time()*1000));sign=hashlib.md5(('client_circle_listclient_circle_list34'+t).encode()).hexdigest()
  url=logical+'&'+urlencode({'t':t,'sign':sign})
  raw,meta=self.fetch(logical,request_url=url);obj=json.loads(raw)
  if obj.get('status')!=0 or not obj.get('data'):raise RuntimeError('Unavailable official article '+docid)
  value=obj['data'][0]
  if str(value.get('iDocID'))!=str(docid) or int(value.get('iBiz',0))!=34:raise RuntimeError('Wrong CFM article identity')
  return value,meta

def html_links(s,base):
 p=tree.Tree(s)
 return [(urljoin(base,n.attrs['href']),tree.clean(tree.text(n))) for n in p.root.walk() if n.tag=='a' and n.attrs.get('href')]

def source_indices(fetcher):
 # The public official client supports stime/etime. Time windows are ordinary
 # documented filters, not identity/rate-limit bypasses; keep the same 5 workers.
 first_url=CMS+'cross?serviceId=34&source=web_pc&chanid=3462&typeids=1,2&filter=channel&start=0&limit=50'
 first,meta=fetcher.json(first_url);total=int(first['data']['total']);requests=[meta]
 latest=max(r.get('sIdxTime','') for r in first['data']['items']);latest_year=int(latest[:4])
 from calendar import monthrange
 def read_window(window,start=0):
  since,until,label=window
  params={'serviceId':34,'source':'web_pc','chanid':3462,'typeids':'1,2','filter':'channel','start':start,'limit':50,'stime':since,'etime':until}
  url=CMS+'cross?'+urlencode(params);obj,m=fetcher.json(url)
  empty=obj.get('status')==-1 and obj.get('msg')=='no data' and obj.get('data',{}).get('total')==0 and obj.get('data',{}).get('items')==[]
  if (obj.get('status')!=0 and not empty) or not isinstance(obj.get('data',{}).get('items'),list):raise RuntimeError('Bad CMS date-window response: '+label)
  rows=obj['data']['items'];count=int(obj['data']['total'])
  if any(not(since<=r.get('sIdxTime','')<=until) for r in rows):raise RuntimeError('CMS did not apply date filter: '+label)
  return window,start,rows,count,m
 annual=[(str(year)+'-01-01 00:00:00',str(year)+'-12-31 23:59:59',str(year)) for year in range(2010,latest_year+1)]
 with ThreadPoolExecutor(max_workers=5) as pool:heads=list(pool.map(read_window,annual))
 windows=[];annual_totals=[];year_heads=[]
 for window,start,rows,count,m in heads:
  requests.append(m);annual_totals.append({'window':window[2],'claimedTotal':count,'firstPageCount':len(rows),'retrievedAt':m['retrievedAt']})
  if count<=3000:windows.append(window);year_heads.append((window,start,rows,count,m))
  else:
   year=int(window[2]);months=[(f'{year}-{month:02d}-01 00:00:00',f'{year}-{month:02d}-{monthrange(year,month)[1]:02d} 23:59:59',f'{year}-{month:02d}') for month in range(1,13)]
   with ThreadPoolExecutor(max_workers=5) as pool:subheads=list(pool.map(read_window,months))
   if sum(v[3] for v in subheads)!=count:raise RuntimeError('CMS monthly split total mismatch: '+str(year))
   for sub in subheads:
    if sub[3]>3000:raise RuntimeError('CMS month requires narrower public date window: '+sub[0][2])
    windows.append(sub[0]);year_heads.append(sub);requests.append(sub[4])
 page_jobs=[(window,start) for window,zero,rows,count,m in year_heads for start in range(50,count,50)]
 with ThreadPoolExecutor(max_workers=5) as pool:rest=list(pool.map(lambda pair:read_window(pair[0],pair[1]),page_jobs))
 all_pages=sorted(year_heads+rest,key=lambda p:(p[0][0],p[1]));seen={};page_audit=[];window_ids={w[2]:set() for w in windows}
 window_claims={w[2]:count for w,start,rows,count,m in year_heads}
 for window,start,rows,count,m in all_pages:
  requests.append(m);new=0
  if count!=window_claims[window[2]]:raise RuntimeError('CMS total changed during window sync: '+window[2])
  if len(rows)!=min(50,max(0,count-start)):raise RuntimeError('CMS date-window pagination incomplete: '+window[2]+'/'+str(start))
  ids=[str(r['iDocID']) for r in rows]
  if len(set(ids))!=len(ids) or window_ids[window[2]]&set(ids):raise RuntimeError('Repeated CMS window page: '+window[2]+'/'+str(start))
  window_ids[window[2]].update(ids)
  for r in rows:
   ident=str(r['iDocID'])
   if ident not in seen:seen[ident]=r;new+=1
  page_audit.append({'window':window[2],'offset':start,'returned':len(rows),'newIds':new,'firstId':ids[0] if ids else None,'retrievedAt':m['retrievedAt']})
 for label,ids in window_ids.items():
  if len(ids)!=window_claims[label]:raise RuntimeError('CMS window source count mismatch: '+label)
 cms_rows=sorted(seen.values(),key=lambda x:(x.get('sIdxTime',''),str(x['iDocID'])),reverse=True)
 category_audit=[];catalog={};processed=set();queue=[('https://news.4399.com/gonglue/cfsy/wuqi/'+c+'/',c) for c in CATEGORIES]
 while queue:
  batch=queue;queue=[]
  def load(pair):
   url,cat=pair;raw,m=fetcher.fetch(url);return url,cat,raw.decode('gb18030','replace'),m
  with ThreadPoolExecutor(max_workers=4) as pool:loaded=list(pool.map(load,batch))
  for url,cat,s,m in loaded:
   if url in processed:continue
   processed.add(url);requests.append(m);n=0
   for dest,label in html_links(s,url):
    dest=dest.replace('http://','https://')
    if re.search(r'/cfsy/wuqi/[^/]+/m/\d+\.html$',dest):
     if label and label!='阅读全文>>':catalog.setdefault(dest,{'sourceUrl':dest,'title':label,'category':cat});n+=1
    elif urlparse(dest).path.startswith('/gonglue/cfsy/wuqi/'+cat+'/') and re.fullmatch(r'\d+-\d+\.html',urlparse(dest).path.rsplit('/',1)[-1]):
     if dest not in processed and all(v[0]!=dest for v in queue):queue.append((dest,cat))
   category_audit.append({'url':url,'category':cat,'linkedRows':n,'retrievedAt':m['retrievedAt']})
 if len(catalog)<300:raise RuntimeError('Full 4399 category catalogue unexpectedly small')

 audit={'cms':{'claimedTotal':total,'pagesRequested':len(all_pages),'uniqueArticleCount':len(cms_rows),'indexComplete':len(cms_rows)==total,'windowClaimedTotal':sum(v['claimedTotal'] for v in annual_totals),'dateFilterVerified':True,'annualWindows':annual_totals,'oldestDate':min(x.get('sIdxTime','') for x in cms_rows),'newestDate':max(x.get('sIdxTime','') for x in cms_rows),'pages':page_audit},'4399':{'categoryCount':7,'pagesScanned':len(processed),'uniqueArticleCount':len(catalog),'pages':category_audit}}
 return cms_rows,list(catalog.values()),requests,audit

def candidate_articles(rows):
 selected=[]
 for r in rows:
  title=r.get('sTitle','')
  if int(r.get('iInfoType',0))!=1:continue
  if re.search(r'大神评测|武器解析|枪械解析|武器属性|武器评测|武器测评|万化赏析|皮肤赏析|外观赏析|体验服快车|新武器|武器赏析|武器鉴赏|道具爆料|新皮肤|近战评测|枪械评测|全方位评测',title) or (names(title) and not re.search(r'活动|福利|夺宝|礼包|赏金令|赛事|攻略|教学|玩法|回顾',title)):
   selected.append(r)
 return selected

HERO_EXACT=re.compile(r'^(?:王者之[\u4e00-\u9fff]{1,2}|王者新星|王者纪元|王者幻神|王者白虎|王者不凡|王者蝶刃|王者蔷薇|擎天觉醒|火尖枪|终极绯刃|墨青觉醒|军刃|金刚伞|破邪蛇棍觉醒|雷神之怒-觉醒|阿波罗之弓)(?:-[A-Za-z0-9\u4e00-\u9fff·.]{1,30})?$')
DISPLAY=re.compile(r'外观|枪身|造型|配色|刀身|枪体|建模|动态|主体|色调|涂装|质感|贴图|全貌|握持|展示|检视|检枪|切枪|换弹|射击|开镜|持刀|持枪')
STAT_SECTION=re.compile(r'伤害|数据|对比|弹道|性能|获得|获取|活动|时间|福利|价格|抽奖|套装属性|技能解读|技能介绍|属性介绍|弹匣|攻速|破甲|数值|上手|实战')

def source_text(article):
 s=article.get('sContent','')
 return html.unescape(s) if '&lt;' in s and '<p' not in s else s

def body_context(parsed):
 captions={};after_caption=set();effects=set();last=None;blocks=[]
 for node in parsed.root.walk():
  if node.tag=='img':last=('image',node);continue
  if node.tag not in ('p','h1','h2','h3','h4'):continue
  t=tree.clean(tree.text(node))
  if not t:continue
  blocks.append((node,t))
  image_children=[n for n in node.walk() if n.tag=='img']
  is_caption=len(t)<90 and bool(re.fullmatch(r'[（(].*(?:检视|检枪|切枪|换弹|开火|射击|开镜|展示).*[）)]',t))
  if is_caption and image_children:
   for image in image_children:captions[id(image)]=t
   after_caption.add(id(node));continue
  if is_caption and last and last[0]=='image':
   captions[id(last[1])]=t;after_caption.add(id(node))
  last=('text',node)
 for idx,(node,t) in enumerate(blocks):
  if len(t)>70:continue
  for name in names(normalize(t)):
   if normalize(t)!=name or '-' not in name or not re.search(r'之(?:印|殇|触|光)$',name):continue
   following=' '.join(text for n,text in blocks[idx+1:idx+4])
   if re.search(r'命中(?:特效|数字|万化)|伤害数字|数字样式|按键|按钮|装配.{0,45}光效|光效后',following) or (re.search(r'该万化|专属.{0,10}万化',following) and re.search(r'命中|数字|图标',following)):effects.add(name)
 return captions,after_caption,effects

def image_action(caption,adjacent,section):
 marker=re.compile(r'检视|检枪|切枪|切换动作|换弹|开镜|开火|射击')
 text=caption or (adjacent if marker.search(adjacent) else section)
 if re.search(r'(?:不支持|无法|不能|不具备|没有|暂无|无).{0,4}(?:检视|检枪)',text):return 'showcase',text
 if re.search(r'检视|检枪',text):
  focused=re.sub(r'切枪检视','检视',text)
  other=bool(re.search(r'切枪|切换动作|换弹|开镜|开火|射击',focused))
  # A paragraph listing several actions does not identify which the GIF shows.
  # A scripted shot within an explicitly labelled inspect can still be inspect.
  scripted_inspect=bool(re.match(r'^[【\[(（]?(?:武器)?(?:检视|检枪)',focused)) and not re.search(r'切枪|切换动作|换弹|开镜|开火',focused)
  explicit_next=bool(re.search(r'以下[^。]*即为[^。]*(?:检枪|检视)(?:动作|效果|展示)',focused))
  return ('inspect' if not other or scripted_inspect or explicit_next else 'showcase'),text
 actions=[]
 for kind,pattern in [('equip',r'切枪|切换动作'),('reload',r'换弹'),('ads',r'开镜'),('fire',r'开火|射击')]:
  if re.search(pattern,text):actions.append(kind)
 return (actions[0] if len(actions)==1 else 'showcase'),text

def official_objects(article):
 """Select exact named body sections; a title-only collection is not an item."""
 title=article.get('sTitle','');raw=source_text(article);parsed=tree.Tree(raw)
 if THROW.search(title) or re.search(r'加强计划|BOSS',title,re.I):return {},{'reason':'Non-weapon/throwable article title','title':title}
 captions,post_caption,effect_names=body_context(parsed)
 # This source article explicitly consists of hit-number/hit-effect cosmetics.
 # Keep the source names intact, but do not publish components as gun skins.
 if re.search(r'命中数字与特效',title):
  effect_names.update(name for node in parsed.root.walk() if node.tag in ('p','h1','h2','h3','h4','strong','b') for name in names(normalize(tree.clean(tree.text(node)))) if re.search(r'-.*之(?:印|殇|触)$',name))
 short=[]
 for n in parsed.root.walk():
  if n.tag in ('h1','h2','h3','h4','strong','b'):
   t=normalize(META_END.sub('',END_WORDS.sub('',tree.clean(tree.text(n)))))
   if len(t)<60:
    nms=names(t)
    for name in nms:
     if t==name:short.append(name)
    if HERO_EXACT.fullmatch(t) and not THROW.search(t):short.append(t)
 title_names=names(title)
 # Body-confirmed hero names provide an exact match, without guessing prefixes.
 for n in short:
  if n in normalize(title) and not any(n!=value and n in value for value in title_names):title_names.append(n)
 short=list(dict.fromkeys(short));title_names=list(dict.fromkeys(title_names))
 safe_single=len(title_names)==1 and not re.search(r'礼包|活动介绍|活动爆料|套装|合集|盘点|回顾|汇总|大全|多款',title)
 short=[n for n in short if n not in effect_names];title_names=[n for n in title_names if n not in effect_names]
 available=list(dict.fromkeys(short+title_names))
 safe_single=safe_single and len(title_names)==1
 if short and not any(key(t)==key(v) for t in title_names for v in short):safe_single=False
 if not available:return {},{'reason':'No exact weapon identity','title':title}
 data={name:{'name':name,'pictures':[],'media':[]} for name in available}
 active=title_names[0] if safe_single else None
 recent=[];section='';blocked=False
 for n in parsed.root.walk():
  if n.tag in ('h1','h2','h3','h4','p'):
   t=tree.clean(tree.text(n))
   if not t or id(n) in post_caption:continue
   norm=normalize(t)
   if any(key(norm)==key(v) for v in effect_names):active=None;section=t;blocked=True;recent=[t];continue
   matched=[v for v in available if key(norm)==key(v)]
   if matched:
    active=matched[0];section=active;blocked=False;recent=[t];continue
   if len(t)<48 and (n.tag!='p' or any(c.tag in ('strong','b') for c in n.walk()) or (len(t)<28 and not re.search(r'[。！？!?，,]',t) and re.search(r'特效|动作|外观|展示|技能|角色|人物',t))):
    section=t
    same_action=active and active in norm and re.search(r'外观|枪身|特效|检视|检枪|动作|展示|换弹|切枪|开镜',t)
    if THROW.search(t) or (names(t) and not same_action):active=None;blocked=True;recent=[t];continue
    if STAT_SECTION.search(t):blocked=True
    elif DISPLAY.search(t):blocked=False
    else:active=None;blocked=True
   recent.append(t);recent=recent[-3:]
  elif n.tag=='img' and active:
   src=html.unescape(n.attrs.get('src') or n.attrs.get('data-src') or '')
   src=urljoin('https://cfm.qq.com/',src)
   host=urlparse(src).hostname
   if host not in {'static.gametalk.qq.com','game.gtimg.cn','shp.qpic.cn','inews.gtimg.com','qqadapt.qpic.cn','itea-cdn.qq.com'}:continue
   if not re.search(r'\.(?:png|jpg|jpeg|webp|gif)(?:\?|$)',src,re.I) and not (host=='shp.qpic.cn' and urlparse(src).path.startswith('/cfwebcap/')):continue
   width=n.attrs.get('width');height=n.attrs.get('height')
   if width and width.isdigit() and int(width)<250:continue
   context=' '.join(recent)
   # A section explicitly naming another weapon, a comparison or a reward grid
   # never supplies this item's thumbnail or dedicated action.
   intro=safe_single and not data[active]['pictures'] and not re.search(r'数据|对比|伤害测试|性能对比|射速|弹匣',section+' '+context)
   if blocked or re.search(r'^[【\[][^】\]]*(?:数据|对比|伤害|性能|实战|技能)[^】\]]*[】\]]',context) or not (DISPLAY.search(context+' '+section) or intro):recent=[];continue
   own_names=[name for name in available if name in normalize(context)]
   if len(own_names)==1 and own_names[0]!=active:recent=[];continue
   is_gif=urlparse(src).path.lower().endswith('.gif')
   kind,evidence=image_action(captions.get(id(n),''),recent[-1] if recent else '',section)
   inspect=kind=='inspect'
   evidence=evidence[:140]
   score=100 if key(section)==key(active) else 85 if re.search(r'外观|建模|造型|配色|枪身|刀身|枪体',section) else 65 if DISPLAY.search(context) else 40
   data[active]['pictures'].append({'url':src,'width':width,'height':height,'context':evidence or context[:100],'score':score,'gif':is_gif,'actionKind':kind,'actionContext':evidence or section or ('单款武器原稿首图' if intro else context[:100])})
   if is_gif:
    data[active]['media'].append({'url':src,'kind':kind,'context':evidence or section or context[:100]})
   recent=[]
 return {k:v for k,v in data.items() if v['pictures']},None

def check_image(fetcher,url,referer):
 logical='image-head:'+url;k=hashlib.sha256(logical.encode()).hexdigest();path=common.CACHE/(k+'.head.json')
 if path.exists() and(fetcher.offline or not fetcher.refresh):
  cached=json.loads(path.read_text(encoding='utf-8'))
  if cached.get('ok') and 'image/gif' in cached.get('contentType','').lower() and 'frameCount' not in cached:return decode_animation(fetcher,cached,referer,path)
  return cached
 if fetcher.offline:raise RuntimeError('Missing offline picture check '+url)
 proc=subprocess.run([fetcher.curl,'--silent','--show-error','--head','--location','--fail','--retry','1','--max-time','25','--referer',referer,url],capture_output=True)
 header=proc.stdout.decode(errors='replace');types=re.findall(r'^content-type:\s*([^\r\n]+)',header,re.I|re.M)
 if proc.returncode or not types or not types[-1].lower().startswith('image/'):
  result={'url':url,'ok':False,'error':proc.stderr.decode(errors='replace')[:200],'retrievedAt':stamp()};atom(path,result);return result
 result={'url':url,'ok':True,'contentType':types[-1],'retrievedAt':stamp()}
 if 'image/gif' in types[-1].lower():return decode_animation(fetcher,result,referer,path)
 atom(path,result);return result

def decode_animation(fetcher,result,referer,path):
 try:
  raw,meta=fetcher.fetch(result['url'],referer)
  with Image.open(BytesIO(raw)) as animation:
   if animation.format!='GIF':raise RuntimeError('GIF MIME does not match decoded image')
   frames=animation.n_frames
   result.update({'frameCount':frames,'mimeType':'image/gif','sha256':hashlib.sha256(raw).hexdigest(),'width':animation.width,'height':animation.height,'animated':frames>1,'decodedAt':meta['retrievedAt']})
  atom(path,result);return result
 except Exception as error:
  if fetcher.offline:raise
  failure={'url':result['url'],'ok':False,'error':'Animation decode/check failed: '+str(error),'retrievedAt':stamp()};atom(path,failure);return failure

def infer_weapon(name,context=''):
 base_name=re.sub(r'^(?:炫闪|源)[·・]','',name)
 alias=next((target for alias,target in sorted(common.CFM_ALIASES.items(),key=lambda x:(-len(x[0]),x[0].casefold(),x[0])) if base_name==alias or base_name.startswith(alias+'-')),None)
 weapon=alias or next((v for v in BASES if base_name.casefold().startswith(v.casefold()) and v!='王者之' and not (v[-1].isascii() and v[-1].isalnum() and len(base_name)>len(v) and base_name[len(v)].isascii() and base_name[len(v)].isalnum())),None) or re.split('[-—]',base_name)[0]
 kind=TYPE_BY_BASE.get(weapon.casefold())
 if kind is None:raise RuntimeError('Unverified base weapon type: '+name+' -> '+weapon)
 cat='近战武器' if kind=='melee' else '狙击枪' if weapon.casefold() in SNIPER_BASES else '副武器' if weapon.casefold() in SIDEARM_BASES else '枪械'
 return weapon,kind,cat

def legacy_details(fetcher,rows,known_urls,previous):
 requests=[];excluded=[];entries=[]
 selected=[]
 for row in rows:
  if row['sourceUrl'] in known_urls:continue
  title=row['title'];match=re.search(r'CF手游(.+?)(?:怎么得|怎么样|好不好|武器介绍|武器属性|属性|获取方法|介绍|图鉴|评测|步枪|机枪|狙击枪|手枪)',title)
  name=normalize(match[1]) if match else ''
  name={'圣诞版M4A1':'M4A1圣诞版','盘龙RPK':'RPK-盘龙'}.get(name,name)
  if not name or any(key(name)==key(v) for v in BARE) or THROW.search(name):excluded.append({'url':row['sourceUrl'],'title':title,'reason':'prototype/throwable/unresolved'});continue
  row=dict(row,name=name);selected.append(row)
 def detail(row):
  raw,m=fetcher.fetch(row['sourceUrl']);s=raw.decode('gb18030','replace')
  article=re.search(r'<div class="content">(.*?)<div class="pd20">',s,re.S)
  title=re.search(r'<h1\b[^>]*class="contit"[^>]*>(.*?)</h1>',s,re.S)
  if not article or not title or 'CF' not in common.plain(title[1]):raise RuntimeError('Legacy article selector/identity changed: '+row['sourceUrl'])
  pics=[urljoin(row['sourceUrl'],html.unescape(x)) for x in re.findall(r'<img\b[^>]*\bsrc="([^"]+)"',article[1],re.S)]
  pics=[p for p in pics if urlparse(p).hostname=='newsimg.5054399.com']
  if not pics:raise RuntimeError('Missing independent weapon image: '+row['sourceUrl'])
  body,im=fetcher.fetch(pics[0],row['sourceUrl'])
  with Image.open(BytesIO(body)) as image:
   image.load();width,height=image.size;ext={'PNG':'.png','JPEG':'.jpg','GIF':'.gif','WEBP':'.webp'}[image.format]
   if width<80 or height<40:raise RuntimeError('Tiny legacy weapon picture')
  ident='cfm-'+re.search(r'/(\d+)\.html',row['sourceUrl'])[1]
  name=row['name'];weapon,kind,cat=infer_weapon(name)
  # Category pages can misfile ranged bows under melee; verified base type wins.
  cat=common.CFM_CATEGORY.get(row['category'],cat) if kind=='gun' and row['category']!='jzwq' else cat
  item=common.base_record('cf-mobile',ident,name,weapon,'cfm-weapon-'+hashlib.sha256(weapon.encode()).hexdigest()[:12],kind,row['sourceUrl'],'4399 CF手游独立武器图鉴',ident[4:],pics[0],m['retrievedAt'],previous)
  path=Path('assets/weapon-skins/cf-mobile')/(ident+ext);target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
  item['category']=cat;item['description']='CFM国服早期独立武器图鉴中的外观或武器变体；部分变体同时有数值或功能差异，不等于只更换涂装。'
  item['image'].update({'url':path.as_posix(),'width':width,'height':height,'sha256':hashlib.sha256(body).hexdigest(),'caption':'对应武器图鉴正文原图，按真实来源页Referer归档；保留原始画面和来源。','provider':'4399 CFM 武器图鉴'})
  item['tags']=['历史图鉴','武器变体'];item['cosmeticType']='weapon_variant_or_skin'
  return item,[m,im]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for item,meta in pool.map(detail,selected):entries.append(item);requests+=meta
 return entries,requests,excluded

def build_catalogue(fetcher,baseline,old,cms,legacy,requests,audit):
 previous={x['id']:x for x in old.get('skins',[])+old.get('historicalSkins',[])}
 validated_before=json.loads((CACHE/'before-time-windows-508.json').read_text(encoding='utf-8'))['skins'] if (CACHE/'before-time-windows-508.json').exists() else old.get('skins',[])
 previous_by_name={key(clean_name(x['name'])):x for x in validated_before}
 entries=[json.loads(json.dumps(x)) for x in baseline.get('skins',[])];by_name={key(x['name']).replace('-',''):x for x in entries}
 new_legacy,meta,excluded=legacy_details(fetcher,legacy,{x['sourceUrl'] for x in entries},previous);requests+=meta
 legacy_duplicates=[]
 for item in new_legacy:
  if key(item['name']).replace('-','') in by_name:
   by_name[key(item['name']).replace('-','')].setdefault('additionalSourceUrls',[]).append(item['sourceUrl']);legacy_duplicates.append(item['name']);continue
  entries.append(item);by_name[key(item['name']).replace('-','')]=item
 chosen=candidate_articles(cms)
 articles=[];errors=[]
 def get(r):
  for attempt in range(3):
   try:
    article,meta=fetcher.detail(str(r['iDocID']));return article,meta,None
   except Exception as exc:
    if fetcher.offline:raise
    last=str(exc)
  return None,None,{'docid':str(r['iDocID']),'title':r['sTitle'],'error':last}
 with ThreadPoolExecutor(max_workers=5) as pool:
  for article,meta,error in pool.map(get,chosen):
   if error:errors.append(error)
   else:articles.append(article);requests.append(meta)
 if len(articles)<len(chosen)*0.95:raise RuntimeError('Too many unavailable official articles; prior snapshot retained')
 for a in articles:
  for node in tree.Tree(source_text(a)).root.walk():
   if node.tag in ('h1','h2','h3','h4','strong','b'):
    raw_name=normalize(META_END.sub('',END_WORDS.sub('',tree.clean(tree.text(node)))))
    if HERO_EXACT.fullmatch(raw_name) and not THROW.search(raw_name):HERO_BASES.add(raw_name.split('-')[0])
 candidates={};article_audit=[]
 for article in sorted(articles,key=lambda a:(a.get('sIdxTime',''),str(a['iDocID'])),reverse=True):
  found,issue=official_objects(article);article_audit.append({'docid':str(article['iDocID']),'title':article['sTitle'],'date':article.get('sIdxTime'),'objects':list(found),'issue':issue})
  for name,value in found.items():candidates.setdefault(key(name),[]).append((article,value))
 checks={}
 all_images={pic['url']:CFM+'detail.shtml?docid='+str(article['iDocID']) for items in candidates.values() for article,value in items for pic in value['pictures']}
 for prior_item in validated_before:
  for media in prior_item.get('media',[]):
   if media.get('provider')=='gif':all_images.setdefault(media['url'],media['sourcePageUrl'])
 def head(pair):
  url,referer=pair;return url,check_image(fetcher,url,referer)
 with ThreadPoolExecutor(max_workers=6) as pool:
  for url,result in pool.map(head,sorted(all_images.items())):checks[url]=result
 corrected_static=[]
 for existing_item in entries:
  kept=[]
  for media in existing_item.get('media',[]):
   info=checks.get(media['url'],{})
   if media.get('provider')=='gif' and not info.get('animated'):
    corrected_static.append({'skinId':existing_item['id'],'mediaId':media['id'],'url':media['url'],'reason':'Actual MIME/decoded image is not multi-frame GIF'});continue
   if media.get('provider')=='gif':media.update({k:info[k] for k in ('mimeType','frameCount','sha256')})
   kept.append(media)
  existing_item['media']=kept
 for choices in candidates.values():
  for a,v in choices:
   v['media']=[{'url':pic['url'],'kind':pic['actionKind'],'context':pic['actionContext'],'articlePublishedDate':a.get('sIdxTime','')[:10]} for pic in v['pictures'] if checks.get(pic['url'],{}).get('animated')]
   for pic in v['pictures']:pic['gif']=checks.get(pic['url'],{}).get('animated',False)
 official_added=0;media_added=0;source_merges=0;missing=[];association=[]
 for canonical,items in sorted(candidates.items()):
  options=[]
  for article,value in items:
   for pic in value['pictures']:
    if checks[pic['url']]['ok']:options.append((pic['score']+(0 if pic['gif'] else 12),article,value,pic))
  if not options:missing.append({'name':items[0][1]['name'],'docids':[str(a['iDocID']) for a,v in items]});continue
  score,article,value,pic=max(options,key=lambda x:(x[0],x[1].get('sIdxTime','')))
  name=value['name'];source=CFM+'detail.shtml?docid='+str(article['iDocID']);author=article.get('sAuthor') or '未署名';origin='official' if author in ('穿越火线官方FPS手游','穿越火线手游','CF手游') else 'community'
  plain=common.plain(source_text(article));weapon,kind,cat=infer_weapon(name,plain)
  if canonical.replace('-','') in by_name:item=by_name[canonical.replace('-','')];source_merges+=1
  else:
   prior=previous_by_name.get(canonical)
   ident=prior['id'] if prior else 'cfm-cmc-'+hashlib.sha256(canonical.encode()).hexdigest()[:16]
   item=common.base_record('cf-mobile',ident,name,weapon,'cfm-weapon-'+hashlib.sha256(weapon.encode()).hexdigest()[:12],kind,source,'CFM官网枪械道具栏目 · '+author,str(article['iDocID']),pic['url'],checks[pic['url']]['retrievedAt'],previous)
   item['sourceAliases']=list(previous.get(ident,{}).get('sourceAliases',[]))
   item['media']=[dict(m) for m in (prior or {}).get('media',[]) if m.get('provider')!='gif' or m['url'] not in checks or checks[m['url']].get('animated')]
   item['category']=cat;item['publishedDate']=article.get('sIdxTime','')[:10];item['cosmeticType']='weapon_variant_or_skin'
   item['description']='CFM官网枪械道具栏目刊载的外观资料。保留原作者与来源小节；英雄级、觉醒等武器变体可能同时有数值或功能变化。'
   if '体验服' in plain or '测试服' in plain:item['description']+='原稿包含体验服素材，不能据此推定正式服当前效果或上线时间。'
   item['image'].update({'sourceType':origin,'provider':'CFM官网刊载 · '+author,'kind':'in_game','caption':'正文对应武器外观/展示小节原图；保留原比例与作者署名，不使用礼包封面代替单件。','retrievedAt':checks[pic['url']]['retrievedAt']})
   for dim in ('width','height'):
    if pic.get(dim) and str(pic[dim]).isdigit():item['image'][dim]=int(pic[dim])
   item['sourceEvidence']={'pageTitle':article['sTitle'],'section':pic['context'],'articleId':str(article['iDocID']),'author':author,'kind':'named_weapon_body_section'}
   item['tags']=['官网刊载','武器变体','体验服素材' if '体验服' in plain else '外观资料'];entries.append(item);by_name[canonical.replace('-','')]=item;official_added+=1
  item.setdefault('additionalSourceUrls',[])
  if source not in item['additionalSourceUrls'] and source!=item['sourceUrl']:item['additionalSourceUrls'].append(source)
  verified_media={media['url']:media for a,v in items for media in v['media']}
  filtered=[]
  for media in item['media']:
   if media.get('provider')=='gif' and '?docid=' in media.get('sourcePageUrl',''):
    target=verified_media.get(media['url'])
    if target is None:continue
    media['kind']=target['kind'];media['reviewStatus']='source_confirmed' if target['kind']=='inspect' else 'metadata_only';media['title']=item['name']+' · '+('检视动作' if target['kind']=='inspect' else '原稿动作展示')
    media.setdefault('sourceEvidence',{}).update({'section':target['context'],'articlePublishedDate':target['articlePublishedDate']})
    media['reviewedAt']=(checks[media['url']].get('decodedAt') or checks[media['url']]['retrievedAt'])[:10]
   filtered.append(media)
  item['media']=filtered
  existing={m['url'] for m in item['media']}
  for a,v in items:
   a_source=CFM+'detail.shtml?docid='+str(a['iDocID']);a_author=a.get('sAuthor') or '未署名';a_origin='official' if a_author in ('穿越火线官方FPS手游','穿越火线手游','CF手游') else 'community'
   for media in v['media']:
    if media['url'] in existing or not checks.get(media['url'],{}).get('ok'):continue
    item['media'].append({'id':'cfm-cmc-gif-'+hashlib.sha256(media['url'].encode()).hexdigest()[:16],'provider':'gif','mimeType':'image/gif','frameCount':checks[media['url']]['frameCount'],'sha256':checks[media['url']]['sha256'],'kind':media['kind'],'url':media['url'],'title':item['name']+' · '+('检视动作' if media['kind']=='inspect' else '原稿动作展示'),'sourcePageUrl':a_source,'sourceName':'CFM官网刊载 · '+a_author,'sourceType':a_origin,'reviewStatus':'source_confirmed' if media['kind']=='inspect' else 'metadata_only','reviewedAt':(checks[media['url']].get('decodedAt') or checks[media['url']]['retrievedAt'])[:10],'reviewNote':'原稿对应武器小节紧邻动图；检视仅在原文明确说明时标注，未逐帧核验。','sourceEvidence':{'articleTitle':a['sTitle'],'articlePublishedDate':a.get('sIdxTime','')[:10],'section':media['context'],'author':a_author},'versionScope':'体验服/原稿所示版本，当前效果未逐项核实'})
    existing.add(media['url']);media_added+=1
  association.append({'id':item['id'],'name':item['name'],'image':item['image']['url'],'article':source,'section':pic['context'],'gifCount':len([m for m in item['media'] if m['provider']=='gif'])})
 # Audit every final family, including retained baseline records, independently
 # of the source article and the skin suffix. IDs and firstSeen are unchanged.
 type_audit=[]
 for item in entries:
  family=item['weaponName'];kind=TYPE_BY_BASE.get(family.casefold())
  if kind is None:raise RuntimeError('Unverified retained base weapon type: '+family)
  for media in item['media']:
   if media.get('provider')=='gif':
    evidence=checks[media['url']]
    if not evidence.get('animated'):raise RuntimeError('Unverified retained GIF: '+media['url'])
    media.update({field:evidence[field] for field in ('mimeType','frameCount','sha256')})
  before_kind=item['weaponType'];item['weaponType']=kind
  if kind=='melee':item['category']='近战武器'
  elif item.get('category')=='近战武器' or family.casefold() in SIDEARM_BASES:item['category']='副武器' if family.casefold() in SIDEARM_BASES else '枪械'
  type_audit.append({'id':item['id'],'name':item['name'],'baseWeapon':family,'weaponType':kind,'previousType':before_kind,'sourceUrl':item['sourceUrl']})
 atom(CACHE/'base-weapon-type-audit.json',type_audit)
 entries.sort(key=lambda x:(-int(bool(x['media'])),x['name']))
 coverage={'status':'partial','complete':False,'catalogScope':'full_historical_categories_and_official_cms_body_sections','sourceRecordCount':len(legacy),'historicalCataloguedCount':len(baseline['skins'])-4+len(new_legacy)-len(legacy_duplicates),'baselineCount':len(baseline['skins']),'newLegacyCount':len(new_legacy)-len(legacy_duplicates),'newOfficialCount':official_added,'officialSourceMergeCount':source_merges,'newMediaCount':media_added,'officialArticleCount':len(articles),'officialCandidateArticleCount':len(chosen),'officialArticleUnavailableCount':len(errors),'officialUniqueArticleIndexCount':len(cms),'officialClaimedArticleTotal':audit['cms']['claimedTotal'],'officialIndexComplete':audit['cms']['indexComplete'],'officialWindowClaimedTotal':audit['cms']['windowClaimedTotal'],'officialYearWindows':audit['cms']['annualWindows'],'officialOldestIndexedDate':audit['cms']['oldestDate'],'officialNewestIndexedDate':audit['cms']['newestDate'],'categoryPageCount':audit['4399']['pagesScanned'],'cataloguedCount':len(entries),'excluded':{'legacyPrototypeThrowableOrUnresolved':len(excluded),'legacyNameDuplicate':len(legacy_duplicates)},'scope':'4399七类武器目录全部实际分页；官网枪械道具栏目用公开stime/etime按年份分窗，逐页校验时间范围、ID与total，完整枚举本轮'+str(len(cms))+'篇栏目文章。该索引不等于全游戏皮肤目录，仅正文单件外观和动作关联通过者收录。','mediaScope':'保留原官方视频与GIF，新增原稿明确对应武器的GIF；检视需紧邻原文明确说明。来源作者可能为社区创作者，腾讯CDN托管不等于官方作者。GIF不计为视频。','remaining':['该官网栏目之外的历史武器/皮肤及后续新增','掌火全量公开图鉴尚未取得','正文无法明确单件外观或动作的对象','精确首发日期与当前版本效果'],'note':'CFM国服目录；不与CF端游或CFHD混用，武器变体与纯皮肤差异保留。'}
 history_previous=previous if old.get('source',{}).get('parserRevision')==8 else {x['id']:x for x in baseline['skins']}
 result=common.document('cf-mobile',entries,history_previous,requests,coverage,'CFM官网枪械道具栏目与4399全分类图鉴',CFM+'strategy.shtml?type=1')
 result['source']['parserRevision']=8
 canonical_entries={key(clean_name(x['name'])):x for x in entries};retained=[]
 for retired in result['historicalSkins']:
  target=canonical_entries.get(key(clean_name(retired['name'])))
  if target is not None:
   aliases=target.setdefault('sourceAliases',[])
   if retired['id'] not in aliases:aliases.append(retired['id'])
  else:retained.append(retired)
 result['historicalSkins']=retained;result['coverage']['retainedHistoricalCount']=len(retained)
 atom(CACHE/'content-association-audit.json',{'articles':article_audit,'unavailableArticles':errors,'imageHealth':checks,'unresolvedImages':missing,'excludedLegacy':excluded,'legacyDuplicateNames':legacy_duplicates,'correctedNonAnimationReferences':corrected_static,'objects':association,'coverage':result['coverage']})
 return result


def main():
 HERO_BASES.clear()
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--offline',action='store_true');parser.add_argument('--refresh',action='store_true');parser.add_argument('--index-only',action='store_true');args=parser.parse_args()
 if args.offline and args.refresh:parser.error('--offline and --refresh are mutually exclusive')
 CACHE.mkdir(parents=True,exist_ok=True)
 fetcher=Fetcher(args.offline,args.refresh)
 before=OUT.read_bytes() if OUT.exists() else None
 try:
  old=json.loads(before) if before else {};seed=CACHE/'baseline-252.json'
  if not seed.exists():
   retained=[x for x in old.get('skins',[]) if not x['id'].startswith('cfm-cmc-') and not x.get('image',{}).get('url','').startswith('assets/weapon-skins/cf-mobile/')]
   if len(retained)<252:raise RuntimeError('Original CFM baseline is incomplete; prior snapshot retained')
   atom(seed,{'schemaVersion':1,'game':'cf-mobile','skins':retained})
  baseline=json.loads(seed.read_text(encoding='utf-8'))
  cms,legacy,requests,audit=source_indices(fetcher)
  chosen=candidate_articles(cms);audit['cms']['candidateArticleCount']=len(chosen)
  audit['sourceNameOverlap']={'4399KnownRows':len(legacy),'officialTitleCandidates':len({key(n) for r in chosen for n in names(r['sTitle'])})}
  atom(CACHE/'source-inventory.json',{'at':max(m['retrievedAt'] for m in requests),'audit':audit,'cmsArticles':cms,'legacyArticles':legacy})
  print(json.dumps({'phase':'source-index','audit':{k:({a:b for a,b in v.items() if a!='pages'} if isinstance(v,dict) else v) for k,v in audit.items()}},ensure_ascii=False),flush=True)
  if args.index_only:return 0
  result=build_catalogue(fetcher,baseline,old,cms,legacy,requests,audit)
  atom(OUT,result);atom(CACHE/'last-run.json',{'at':stamp(),'offline':args.offline,'success':True,'coverage':result['coverage']});print(json.dumps(result['coverage'],ensure_ascii=False));return 0
 except Exception as error:
  if before is not None and OUT.read_bytes()!=before:raise RuntimeError('Failed sync modified prior snapshot') from error
  atom(CACHE/'last-run.json',{'at':stamp(),'success':False,'error':str(error),'previousSnapshotPreserved':before is not None});print(str(error),file=sys.stderr);return 1

if __name__=='__main__':raise SystemExit(main())
