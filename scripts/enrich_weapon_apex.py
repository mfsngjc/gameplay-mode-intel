#!/usr/bin/env python3
"""Find exact missing Apex artwork using source file metadata and ItemStore galleries.

This supplements, rather than replaces, the dated game/Wiki catalogue. Missing
or ambiguous material stays pending. Source image bytes are cached only for QA.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
from urllib.parse import urlencode, urlsplit, unquote
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('apex_sync', ROOT/'scripts/sync_weapon_apex.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
WORK=ROOT/'local-only/weapon-skins/apex/expansion'
ALIASES={
 '30-30 Repeater':['30-30 Repeater','30-30'], 'R-301 Carbine':['R-301','R301'], 'R-99 SMG':['R-99','R99'],
 'VK-47 Flatline':['Flatline'], 'M600 Spitfire':['Spitfire'], 'Bocek Compound Bow':['Bocek'], 'Kraber .50-Cal Sniper':['Kraber'],
 'HAVOC Rifle':['Havoc'], 'Hemlok Burst AR':['Hemlok'], 'Prowler Burst PDW':['Prowler'], 'C.A.R. SMG':['CAR'],
 'L-STAR EMG':['L-STAR'], 'Devotion LMG':['Devotion'], 'Rampage LMG':['Rampage'], 'G7 Scout':['G7 Scout'],
 'Longbow DMR':['Longbow'], 'Mastiff Shotgun':['Mastiff'], 'Mozambique Shotgun':['Mozambique'], 'RE-45 Auto':['RE-45'],
 'EVA-8 Auto':['EVA-8'], 'Alternator SMG':['Alternator SMG','Alternator'], 'Volt SMG':['Volt'], 'Nemesis Burst AR':['Nemesis'],
}


def art_key(value):
 # Possessive punctuation is omitted in several real Wiki filenames.
 return base.key(str(value).replace("'", "").replace("’", ""))

def load(path,fallback=None):
 return json.loads(path.read_text(encoding='utf8')) if path.exists() else fallback

def clock():return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')

def request(url,label,offline=False):
 path=WORK/'itemstore'/(label+'.html');meta_path=WORK/'itemstore'/(label+'.source.json')
 if path.exists() and meta_path.exists():
  metadata=load(meta_path)
  if metadata.get('url')==url:return path.read_text(encoding='utf8'),metadata
 if offline:raise RuntimeError('Missing ItemStore cache '+label)
 path.parent.mkdir(parents=True,exist_ok=True)
 for attempt in range(3):
  r=subprocess.run([shutil.which('curl.exe') or 'curl','--silent','--show-error','--fail','--location','--compressed','--proto','=https','--proto-redir','=https','--max-time','40','--max-filesize','10000000',url],capture_output=True,timeout=45)
  if r.returncode and b'429' in r.stderr and attempt<2:time.sleep(20);continue
  break
 if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace'))
 text=r.stdout.decode('utf8')
 if '<title>Page not found' in text or len(text)<1000:raise RuntimeError('Not a valid ItemStore page '+url)
 metadata={'url':url,'retrievedAt':clock(),'bytes':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest()}
 path.write_text(text,encoding='utf8');base.atomic(meta_path,metadata);time.sleep(1)
 return text,metadata

def owner_in(text,owner):
 text=' '+art_key(text)+' '
 return any(' '+art_key(alias)+' ' in text for alias in ALIASES.get(owner,[owner]))

def file_lookup():
 index=load(WORK/'wiki-file-index/index.json')
 if not index or len(index.get('files',[]))<10000:raise RuntimeError('Complete Wiki file index required')
 out=defaultdict(list)
 for item in index['files']:
  if not item.get('imageinfo'):continue
  info=item['imageinfo'][0]
  if not info.get('url','').startswith(base.WIKI+'/images/') or int(info.get('width',0))<300 or int(info.get('height',0))<100:continue
  if not re.search(r'\.(png|jpe?g|webp)$',urlsplit(info['url']).path,re.I):continue
  name=re.sub(r'\.[^.]+$','',item['title'].removeprefix('File:'))
  out[art_key(name)].append((item,info))
 return out,index

def wiki_candidates(pending,all_entries):
 lookup,index=file_lookup();out={};ambiguous=[]
 counts=Counter((s['weaponEnglishName'],art_key(s['englishName'].split(' — ')[-1])) for s in all_entries)
 retrieved=max(m['retrievedAt'] for m in index['requests'])
 for record in pending:
  if counts[(record['weaponEnglishName'],art_key(record['englishName'].split(' — ')[-1]))]>1:
   ambiguous.append(record['id']);continue
  name=record['englishName'].split(' — ')[-1];matches=[]
  variants=ALIASES.get(record['weaponEnglishName'],[record['weaponEnglishName']]) if record['weaponType']=='gun' else ['']
  for variant in variants:matches.extend(lookup.get(art_key(name+' '+variant),[]))
  matches={info['url']:(item,info) for item,info in matches}
  if len(matches)!=1:continue
  item,info=next(iter(matches.values()))
  out[record['id']]={'image':{'url':info['url'],'assetSourceUrl':info['url'],'sourcePageUrl':info['descriptionurl'],
     'sourceType':'game_asset','provider':'Apex Legends Wiki','kind':'render','width':info['width'],'height':info['height'],
     'caption':'游戏皮肤原图，来自 Wiki 文件库；按文件名、武器和原图元数据核对。','retrievedAt':retrieved},
     'evidence':{'channel':'wiki_file_metadata','fileTitle':item['title'],'pageId':item['pageid'],'match':'exact_name_and_weapon','retrievedAt':retrieved}}
 return out,ambiguous

def gallery_images(raw,metadata):
 out=[]
 for node in base.Tree(raw).root.all('img'):
  a=node.attrs
  if not a.get('src','').startswith('https://apexitemstore.com/wp-content/uploads/') or not a.get('alt'):continue
  parent=node.parent
  while parent and parent.tag!='a':parent=parent.parent
  page=a.get('data-custom-link') or a.get('data-link') or (parent.attrs.get('href') if parent else None) or metadata['url']
  if not page.startswith('https://apexitemstore.com/'):page=metadata['url']
  image=a.get('data-full-image') or a.get('data-light-image')
  if not image and a.get('srcset'):
   candidates=[]
   for entry in a['srcset'].split(','):
    pair=entry.strip().rsplit(' ',1)
    if len(pair)==2 and pair[1].endswith('w'):candidates.append((int(pair[1][:-1]),pair[0]))
   if candidates:image=max(candidates)[1]
  if not image and parent and parent.attrs.get('href','').startswith('https://apexitemstore.com/wp-content/uploads/'):image=parent.attrs['href']
  image=image or a['src']
  out.append({'alt':a['alt'],'url':image,'page':page,'metadata':metadata})
 return out

def itemstore_candidates(pending,offline):
 docs=[];categories=load(WORK/'itemstore/categories.json',[])
 if not categories:raise RuntimeError('ItemStore category inventory required')
 seeds={}
 for i,cat in enumerate(categories):
  raw=(WORK/'itemstore'/('category-'+str(i)+'.html')).read_text(encoding='utf8');docs.append((raw,cat['source']))
  for img in base.Tree(raw).root.all('img'):
   ancestor=img.parent
   while ancestor and ancestor.tag!='a':ancestor=ancestor.parent
   href=ancestor.attrs.get('href','') if ancestor else ''
   if not href.startswith('https://apexitemstore.com/guns/') or len(urlsplit(href).path.strip('/').split('/'))<3:continue
   for record in pending:
    if record['weaponType']=='gun' and owner_in(img.attrs.get('alt',''),record['weaponEnglishName']):seeds.setdefault(record['weaponEnglishName'],href)
 for owner,url in seeds.items():
  raw,meta=request(url,'weapon-gallery-'+base.slug(owner),offline);docs.append((raw,meta))
 images=[image for raw,meta in docs for image in gallery_images(raw,meta)]
 out={};ambiguous=[]
 counts=Counter((s['weaponEnglishName'],art_key(s['englishName'].split(' — ')[-1])) for s in load(base.OUT)['skins'])
 for record in pending:
  name=record['englishName'].split(' — ')[-1];candidates={}
  if counts[(record['weaponEnglishName'],art_key(record['englishName'].split(' — ')[-1]))]>1:ambiguous.append(record['id']);continue
  for image in images:
   if art_key(image['alt']).startswith(art_key(name)+' ') and owner_in(image['alt'],record['weaponEnglishName']):candidates[image['url']]=image
  # Same object can appear at several observed resolutions. Prefer originals.
  normalized=defaultdict(list)
  for url,image in candidates.items():normalized[re.sub(r'-\d+x\d+(?=\.)','',url)].append(image)
  if len(normalized)!=1:continue
  group=next(iter(normalized.values()));image=sorted(group,key=lambda x:bool(re.search(r'-\d+x\d+(?=\.)',x['url'])))[0]
  out[record['id']]={'image':{'url':image['url'],'assetSourceUrl':image['url'],'sourcePageUrl':image['page'],'sourceType':'game_asset',
    'provider':'Apex Legends Item Store','kind':'render','caption':'游戏外观资料图，由社区皮肤档案提供；图片标题和武器身份已核对。','retrievedAt':image['metadata']['retrievedAt']},
    'evidence':{'channel':'itemstore_gallery','alt':image['alt'],'gallerySourceUrl':image['metadata']['url'],'match':'exact_name_prefix_and_weapon','retrievedAt':image['metadata']['retrievedAt']}}
 return out,ambiguous


def attachment_candidates(pending,all_entries):
 index=load(WORK/'itemstore-media/index.json',{})
 if not index:return {}
 counts=Counter((r['weaponEnglishName'],art_key(r['englishName'].split(' — ')[-1])) for r in all_entries)
 retrieved=max(r['retrievedAt'] for r in index['requests']);out={}
 for record in pending:
  if counts[(record['weaponEnglishName'],art_key(record['englishName'].split(' — ')[-1]))]>1:continue
  name=record['englishName'].split(' — ')[-1];found=[]
  for item in index['items']:
   alt=item.get('alt_text','');normalized=art_key(alt)
   if not normalized.startswith(art_key(name)+' '):continue
   correct_owner=owner_in(alt,record['weaponEnglishName']) if record['weaponType']=='gun' else any(word in normalized for word in ['heirloom','universal','mythic'])
   if correct_owner and item.get('source_url','').startswith('https://apexitemstore.com/wp-content/uploads/'):
    found.append(item)
  if len(found)!=1:continue
  item=found[0];details=item.get('media_details',{});image={'url':item['source_url'],'assetSourceUrl':item['source_url'],'sourcePageUrl':item.get('link') or 'https://apexitemstore.com/skins/',
    'sourceType':'game_asset','provider':'Apex Legends Item Store','kind':'render','caption':'社区档案保存的游戏皮肤资料图；保留图片内原有文字及原比例。','retrievedAt':retrieved}
  out[record['id']]={'image':image,'evidence':{'channel':'itemstore_attachment_metadata','attachmentId':item['id'],'alt':item['alt_text'],'sourcePageUrl':image['sourcePageUrl'],'retrievedAt':retrieved,'match':'exact_name_prefix_and_weapon'}}
 return out

def check_image(identifier,candidate,offline):
 path=WORK/'qa'/('art-'+identifier+'.image');meta_path=path.with_suffix('.source.json');path.parent.mkdir(parents=True,exist_ok=True)
 source=candidate['image']['url'];metadata=load(meta_path)
 if not path.exists() or not metadata or metadata.get('url')!=source:
  if offline:return {'status':'unavailable_cache','reason':'No successful exact-byte image cache'}
  r=subprocess.run([shutil.which('curl.exe') or 'curl','--silent','--show-error','--fail','--location','--proto','=https','--proto-redir','=https','--max-time','35','--max-filesize','10000000','--output',str(path),source],capture_output=True,timeout=40)
  if source.startswith(base.WIKI):time.sleep(5)
  if r.returncode:return {'status':'unavailable','reason':r.stderr.decode(errors='replace')}
  metadata={'url':source,'retrievedAt':clock(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size};base.atomic(meta_path,metadata)
 with Image.open(path) as im:
  rgba=im.convert('RGBA');pixels=[p for p in rgba.get_flattened_data() if p[3]>100];chromatic=sum(max(p[:3])-min(p[:3])>20 for p in pixels)/max(1,len(pixels));white=sum(min(p[:3])>225 for p in pixels)/max(1,len(pixels))
  if im.width<250 or im.height<100 or (chromatic<.02 and white>.6):return {'status':'rejected_silhouette_or_small','width':im.width,'height':im.height}
  return {'status':'colored_resource','width':im.width,'height':im.height,'imageSource':metadata,'localProof':str(path.relative_to(ROOT))}

def main(offline,apply):
 doc=load(base.OUT);all_entries=doc['skins'];pending=[r for r in all_entries if r['publicationStatus']=='pending' and not r.get('artSupplement')]
 wiki,wiki_ambiguous=wiki_candidates(pending,all_entries);itemstore,store_ambiguous=itemstore_candidates(pending,offline);attachments=attachment_candidates(pending,all_entries);candidates={**attachments,**itemstore,**wiki};results=[]
 all_counts=Counter((r['weaponEnglishName'],art_key(r['englishName'].split(' — ')[-1])) for r in all_entries)
 ambiguous_ids={r['id'] for r in pending if all_counts[(r['weaponEnglishName'],art_key(r['englishName'].split(' — ')[-1]))]>1}
 candidates={identifier:candidate for identifier,candidate in candidates.items() if identifier not in ambiguous_ids and identifier != 'apex-wiki-volt-smg-high-energy-elegance-volt'}
 for record in pending:
  if record['id'] not in candidates:continue
  candidate=candidates[record['id']];candidate['id']=record['id'];candidate['name']=record['englishName'];quality=check_image(record['id'],candidate,offline)
  if quality['status'] not in ['colored_resource'] and record['id'] in wiki and record['id'] in itemstore:
   candidate=itemstore[record['id']];candidate['id']=record['id'];candidate['name']=record['englishName'];candidate['primarySourceFailure']=quality;quality=check_image(record['id'],candidate,offline)
  candidate['quality']=quality
  print(record['id'],quality['status'],flush=True)
  if quality['status']=='colored_resource':
   candidate['image'].update(width=quality['width'],height=quality['height'],retrievedAt=quality['imageSource']['retrievedAt'])
   if apply:
    record['artSupplement']={'image':candidate['image'],'evidence':candidate['evidence'],'quality':{k:v for k,v in quality.items() if k!='localProof'},'reviewStatus':'source_confirmed','reviewedAt':clock()}
  results.append(candidate)
 base.atomic(WORK/'art-candidates.json',results)
 accepted=[r for r in results if r['quality']['status']=='colored_resource']
 width=1200;tile_w=150;tile_h=135;contact=Image.new('RGB',(width,max(1,((len(accepted)+7)//8))*tile_h),(38,38,38));draw=ImageDraw.Draw(contact)
 for i,r in enumerate(accepted):
  im=Image.open(ROOT/r['quality']['localProof']).convert('RGBA');im.thumbnail((142,105));x=(i%8)*tile_w;y=(i//8)*tile_h;contact.paste(im,(x,y),im);draw.text((x,y+106),r['name'].split(' — ')[-1][:20],fill='white')
 contact.save(WORK/'qa'/'art-contact.jpg')
 if apply:base.atomic(base.OUT,doc)
 print(json.dumps({'wikiCandidates':len(wiki),'itemstoreCandidates':len(itemstore),'attachmentCandidates':len(attachments),'accepted':len(accepted),'rejected':len(results)-len(accepted),'ambiguousIds':len(set(wiki_ambiguous+store_ambiguous)),'applied':apply}))

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--offline',action='store_true');parser.add_argument('--apply',action='store_true');args=parser.parse_args();main(args.offline,args.apply)
