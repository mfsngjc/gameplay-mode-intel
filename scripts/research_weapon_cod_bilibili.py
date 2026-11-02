#!/usr/bin/env python3
"""Collect public COD PC Bilibili inspect metadata; never request video streams.

The seed view response contains its real 63-item UGC collection. Each item is
then checked through its public view endpoint. No cookies, WBI signatures,
login, proxy rotation, player/playurl request, or platform-video downloads.
--offline rebuilds retained evidence. HTTP 412/429 stops that API route.
"""
from __future__ import annotations
import argparse,hashlib,json,os,re,time,urllib.request,urllib.error
from datetime import datetime,timezone,timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'local-only/weapon-skins/cod-pc'
RESPONSES=CACHE/'responses'
OUT=CACHE/'bilibili-inspect-candidates.json'
API='https://api.bilibili.com/'
SEED='BV1cTWNz4Ey8'
EXTRA_SEEDS={
 'BV1Ny411q773':'https://www.bilibili.com/video/BV1Ny411q773/',
 'BV1Hr421F7qi':'https://www.bilibili.com/video/BV1Hr421F7qi/',
 'BV1ce7WzFEjw':'https://www.bilibili.com/video/BV1ce7WzFEjw/',
}

def atomic(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 temp=path.with_suffix(path.suffix+'.tmp')
 temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 os.replace(temp,path)

def now():return datetime.now(timezone.utc).isoformat()
def view_url(bvid):return API+'x/web-interface/view?bvid='+bvid
def video_url(bvid):return 'https://www.bilibili.com/video/'+bvid+'/'

class PublicMetadata:
 def __init__(self,offline=False):
  self.offline=offline;self.previous_request=0;self.requests={};self.stopped_routes=set()
 def fetch(self,url,referer=None):
  key=hashlib.sha256(url.encode()).hexdigest();p=RESPONSES/(key+'.json');meta_path=RESPONSES/(key+'.meta.json')
  route=url.split('?',1)[0]
  if p.exists() and meta_path.exists():
   raw=p.read_bytes();meta=json.loads(meta_path.read_text(encoding='utf-8'))
  else:
   if self.offline:raise RuntimeError('Missing offline public metadata: '+url)
   if route in self.stopped_routes:raise RuntimeError('Rate/security response stopped route: '+route)
   delay=1.1-(time.monotonic()-self.previous_request)
   if delay>0:time.sleep(delay)
   self.previous_request=time.monotonic()
   request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':referer or video_url(SEED)})
   try:
    with urllib.request.urlopen(request,timeout=30) as response:raw=response.read(8_000_000);status=response.status;mime=response.headers.get('Content-Type')
   except urllib.error.HTTPError as error:raw=error.read(2_000_000);status=error.code;mime=error.headers.get('Content-Type')
   meta={'url':url,'status':status,'retrievedAt':now(),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'contentType':mime}
   RESPONSES.mkdir(parents=True,exist_ok=True);p.write_bytes(raw);atomic(meta_path,meta)
  assert hashlib.sha256(raw).hexdigest()==meta['sha256'],'Changed raw response'
  self.requests[url]=meta
  if meta['status'] in (412,429):self.stopped_routes.add(route)
  if meta['status']!=200:raise RuntimeError('HTTP '+str(meta['status'])+' '+url)
  value=json.loads(raw)
  if value.get('code') in (-412,-352,-509,-799):self.stopped_routes.add(route)
  if value.get('code')!=0:raise RuntimeError('Bilibili code '+str(value.get('code'))+' '+str(value.get('message'))+' '+url)
  return value['data'],meta
 def view(self,bvid):
  data,meta=self.fetch(view_url(bvid),video_url(bvid))
  if data.get('bvid')!=bvid:raise RuntimeError('Wrong video identity '+bvid)
  return data,meta

def evidence(url,meta,path):
 key=hashlib.sha256(url.encode()).hexdigest()
 return {'url':url,'responseFile':(Path('local-only/weapon-skins/cod-pc/responses')/(key+'.json')).as_posix(),'retrievedAt':meta['retrievedAt'],'sha256':meta['sha256'],'jsonPath':path}

def game_claim(title,collection=False):
 if re.search(r'COD21|cod21|使命召唤21|黑色行动\s*6|BO6',title):
  return {'id':'black-ops-6','name':'Call of Duty: Black Ops 6','codLabel':'COD21','status':'uploader_metadata_confirmed','evidence':'COD21 collection; seed tags explicitly include 黑色行动6/cod21'}
 if re.search(r'COD20|cod20|使命召唤20|MWIII',title):
  return {'id':'modern-warfare-iii','name':'Call of Duty: Modern Warfare III (2023)','codLabel':'COD20','status':'uploader_title_claim','evidence':title}
 if re.search(r'COD19|cod19|使命召唤19|MWII(?!I)',title):
  return {'id':'modern-warfare-ii','name':'Call of Duty: Modern Warfare II (2022)','codLabel':'COD19','status':'uploader_title_claim','evidence':title}
 return {'id':None,'name':None,'codLabel':None,'status':'unverified','evidence':title}

def record(data,meta,episode=None,seed_meta=None,index=None,season=None,discovery=None):
 bvid=data['bvid'];owner=data.get('owner') or data.get('author');title=data['title'];ts=int(data['pubdate']);rawpic=data['pic']
 match=re.search(r'特殊检视[—\-－：:]+\s*(.+)$',title)
 named=bool(match);pages=data.get('pages') or (episode or {}).get('pages',[])
 source=evidence(view_url(bvid),meta,'$.data') if not episode else evidence(view_url(SEED),seed_meta,'$.data.ugc_season.sections[0].episodes['+str(index-1)+']')
 r={'id':'bilibili-'+bvid,'bvid':bvid,'aid':int(data['aid']),'url':video_url(bvid),'title':title,'owner':{'mid':int(owner['mid']),'name':owner['name']},'publishedAtUnix':ts,'publishedAt':datetime.fromtimestamp(ts,timezone(timedelta(hours=8))).isoformat(),'description':data.get('desc'),'platformCopyrightClaim':data.get('copyright') if not episode else None,'cover':{'url':re.sub('^http:','https:',rawpic),'originalUrl':rawpic,'kind':'video_thumbnail','sourceType':'community','imageContentReviewed':False},'duration':int(data['duration']),'pages':[{k:p[k] for k in ('cid','page','part','duration','dimension','first_frame') if k in p} for p in pages],'game':game_claim(title,bool(season)),'blueprint':{'nameZh':match[1] if named else None,'nameZhStatus':'uploader_title_name_not_verified_official_localization' if named else 'not_single_blueprint_title','nameEn':None,'baseWeapon':None,'associationStatus':'title_named_candidate' if named else 'bundle_or_compilation_requires_item_mapping'},'inspect':{'titleExplicit':bool(re.search(r'检视',title)),'titlePhrase':'特殊检视' if '特殊检视' in title else '检视' if '检视' in title else None,'reviewStatus':'source_confirmed' if '检视' in title else 'metadata_only','videoContentReviewed':False,'scope':'uploader_titled_inspect_not_frame_verified'},'metadataVerification':'seed_view_embedded_ugc_episode' if episode else 'individual_view_api','sourceEvidence':[source]}
 if season:r['series']={'id':season['id'],'title':season['title'],'ownerMid':season['mid'],'episodeIndex':index,'episodeCount':season['ep_count']}
 if discovery:r['discoveryEvidence']=discovery
 return r

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--offline',action='store_true');parser.add_argument('--index-only',action='store_true');args=parser.parse_args();fetch=PublicMetadata(args.offline)
 seed,seed_meta=fetch.view(SEED);season=seed['ugc_season'];episodes=[e for section in season['sections'] for e in section['episodes']]
 if season['id']!=5674799 or len({e['bvid'] for e in episodes})!=season['ep_count']:raise RuntimeError('Seed collection is not closed')
 records=[];errors=[];additional={};discoveries=[]
 for i,episode in enumerate(episodes,1):
  embedded=dict(episode['arc'],bvid=episode['bvid']);embedded['pages']=episode['pages']
  r=record(embedded,seed_meta,episode,seed_meta,i,season)
  if not args.index_only:
   try:
    full,meta=fetch.view(episode['bvid'])
    if full.get('state')!=0:raise RuntimeError('Video is not public state0')
    r=record(full,meta,index=i,season=season);r['sourceEvidence'].append(evidence(view_url(SEED),seed_meta,'$.data.ugc_season.sections[0].episodes['+str(i-1)+']'))
   except Exception as error:errors.append({'bvid':episode['bvid'],'url':view_url(episode['bvid']),'error':str(error)});r['individualViewUnavailable']=True
  records.append(r)
  if i%10==0:print(json.dumps({'phase':'seed-collection','processed':i,'total':len(episodes),'errors':len(errors)}),flush=True)
 if not args.index_only:
  # Actual public search discoveries; bundle/compilation scope stays separate
  # from exact titled-blueprint candidates.
  for bvid,source in EXTRA_SEEDS.items():
   try:
    full,meta=fetch.view(bvid);r=record(full,meta,discovery=[{'url':source,'kind':'public_index_discovery'}]);additional[bvid]=r
    discovered=[e for section in full.get('ugc_season',{}).get('sections',[]) for e in section.get('episodes',[])]
    related,related_meta=fetch.fetch(API+'x/web-interface/archive/related?bvid='+bvid,source)
    for item,path,url,imeta in [(e,'$.data.ugc_season.sections[*].episodes',view_url(bvid),meta) for e in discovered]+[(e,'$.data[*]',API+'x/web-interface/archive/related?bvid='+bvid,related_meta) for e in related]:
     title=item.get('title','');vid=item.get('bvid')
     if vid and re.search(r'COD20|cod20|使命召唤20|MWIII|COD19|使命召唤19|MWII(?!I)',title) and '检视' in title and not re.search(r'CODM|手游',title):
      discoveries.append({'bvid':vid,'title':title,'evidence':evidence(url,imeta,path)})
   except Exception as error:errors.append({'bvid':bvid,'error':str(error)})
  for item in list({r['bvid']:r for r in discoveries}.values())[:20]:
   if item['bvid'] in additional:continue
   try:
    full,meta=fetch.view(item['bvid']);additional[item['bvid']]=record(full,meta,discovery=[item['evidence']])
   except Exception as error:errors.append({'bvid':item['bvid'],'error':str(error)})
 all_requests={json.loads(path.read_text(encoding='utf-8'))['url']:json.loads(path.read_text(encoding='utf-8')) for path in sorted(RESPONSES.glob('*.meta.json'))}
 all_requests.update(fetch.requests);requests=[all_requests[url] for url in sorted(all_requests)]
 result={'schemaVersion':1,'purpose':'COD PC Bilibili special-inspect research candidates; not public skin catalog','seedUrl':video_url(SEED),'generatedFromRetrievedAt':max(x['retrievedAt'] for x in requests),'coverage':{'seriesId':season['id'],'advertisedEpisodes':season['ep_count'],'enumeratedEpisodes':len(records),'seriesIndexComplete':True,'individuallyVerifiedCount':sum(r['metadataVerification']=='individual_view_api' for r in records),'candidateCount':len(records),'additionalVideoCount':len(additional),'gameCoverage':'BO6 seed collection plus separately scoped MWIII bundle/compilation references; no verified MWII candidate found in this bounded pass','notClaimed':['All COD PC blueprints','all special inspect animations','official Chinese localization','English blueprint/base-weapon association','frame-by-frame video review']},'limitations':[{'url':r['url'],'httpStatus':r['status'],'note':'HTTP412/429 route stopped; no login, signing, or retry.'} for r in requests if r['status'] in (412,429)],'requestErrors':errors,'requests':requests,'candidates':records,'additionalVideos':list(additional.values()),'additionalDiscoveryIndex':discoveries}
 if args.offline and errors:raise RuntimeError('Incomplete offline metadata; prior candidate snapshot retained')
 atomic(OUT,result);print(json.dumps(result['coverage'],ensure_ascii=False));return 0

if __name__=='__main__':raise SystemExit(main())
