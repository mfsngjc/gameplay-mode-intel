#!/usr/bin/env python3
"""Record a source-specific reason for every remaining unpublished Apex entry."""
from __future__ import annotations
from collections import Counter,defaultdict
from pathlib import Path
import importlib.util,json,re,difflib
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('apex_sync',ROOT/'scripts/sync_weapon_apex.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
WORK=ROOT/'local-only/weapon-skins/apex/expansion'
def normalize(value):return base.key(str(value).replace("'",'').replace('’',''))
def main():
 d=base.load(base.OUT);records=d['skins'];pending=[r for r in records if r['publicationStatus']!='ready'];ready=[r for r in records if r['publicationStatus']=='ready'];all_counts=Counter((r['weaponEnglishName'],normalize(r['englishName'].split(' — ')[-1])) for r in records)
 wiki=base.load(WORK/'wiki-file-index/index.json');store=base.load(WORK/'itemstore-media/index.json');times=[x['retrievedAt'] for x in wiki['requests']+store['requests']];checked=max(times)
 for record in pending:
  short=record['englishName'].split(' — ')[-1];identity=(record['weaponEnglishName'],normalize(short));near=[]
  for other in ready:
   if other['weaponEnglishName']!=record['weaponEnglishName']:continue
   other_short=other['englishName'].split(' — ')[-1];score=difflib.SequenceMatcher(None,normalize(short),normalize(other_short)).ratio()
   if score>=.9:near.append({'id':other['id'],'name':other['englishName'],'similarity':round(score,3)})
  if all_counts[identity]>1:
   code='same_name_variant_identity_unresolved';note='同一武器存在多个同名客户端/Wiki记录；公开图片不能唯一对应客户端变体，未复用同一配图充数。'
  elif near:
   code='caption_or_alias_identity_unresolved';note='发现近似名称的既有彩图记录，可能是拼写或别名；未在客户端资源ID层确认对应关系，保留待核。'
  elif record['weaponType']=='melee' and re.search(r'_(?:rt|rc)\d+$',record['sourceId']):
   code='melee_variant_material_missing';note='已知独立变体资源ID和名称，但只有轮廓或基础款资料；尚无可唯一识别本变体材质/颜色的原图，不以基础款画面代替。'
  elif record.get('sourceRenderQuality',{}).get('status')=='client_ui_silhouette':
   code='client_silhouette_without_color_art';note='客户端社区索引有纯白UI轮廓，不能展示真实材质；Wiki文件库、社区图库与附件索引未找到可核对的独立彩图。'
  elif record['weaponType']=='melee':
   code='melee_color_art_missing';note='原索引仅有轮廓或未渲染记录；已查Wiki文件、社区附件和相关官方活动，仍无可确认的独立彩图。'
  else:
   code='no_exact_color_art_in_checked_indices';note='已对Wiki完整文件元数据、ItemStore分类/逐武器图库及公开附件做名称与武器匹配，尚无可确认的彩图；不使用猜测资源地址或其他武器同名图。'
  reason={'code':code,'note':note,'checkedAt':checked,'checkedSources':['https://apexlegends.wiki.gg/api.php','https://apexitemstore.com/skins/','https://apexitemstore.com/wp-json/wp/v2/media']}
  if near:reason['unverifiedPossibleAliases']=sorted(near,key=lambda x:x['similarity'],reverse=True)[:3]
  if record['sourceId']=='melee_skin_agnostic_clockwild':
   reason['note']='官方已发布Twin Razors多配色合照，但画面同时展示多种变体；尚未确认本客户端基础资源ID具体对应哪一配色，未把合照当作独立变体图。'
   receipt=base.load(WORK/'ea/twin-razors-original.png.source.json',{})
   reason['unresolvedCandidate']={'sourceUrl':'https://www.ea.com/games/apex-legends/apex-legends/news/overclocked-patch-notes','assetSourceUrl':receipt.get('url'),'checkedAt':receipt.get('retrievedAt'),'basis':'官方alt明确为Twin Razors；画面显示三名角色各持不同配色。'}
  if record['sourceId']=='melee_skin_agnostic_whip':
   reason['note']='已记录Metallic Banshee独立客户端资源ID；它与Epyon Heat Rod为不同外观，未复用后者彩图或演示。已查的文件/附件索引无精确彩图；候选原作者视频页面暂未能取得可核对正文。'
   reason['unresolvedCandidate']={'sourceUrl':'https://www.youtube.com/watch?v=n_IFH5TKHkw','status':'metadata_unavailable','basis':'搜索索引提供题名，原始视频页读取失败；未下载或截取平台视频。'}
  record['remainingReason']=reason
 search={'wikiFilesIndexed':len(wiki['files']),'wikiIndexPages':len(wiki['requests']),'itemstoreVisibleAttachmentsIndexed':store['actualCount'],'itemstoreDeclaredAttachmentCount':store['declaredTotal'],'itemstoreAttachmentPages':store['traversedPages'],'itemstoreDenominatorNote':'原站声明9126，92页实际返回9110；差16项，未伪装为数量一致。','itemstoreCategoryPages':8,'itemstoreWeaponGalleryPages':29,'checkedAt':checked}
 d['coverage']['artSearchCoverage']=search;d['coverage']['remainingReasonCounts']=dict(Counter(r['remainingReason']['code'] for r in pending))
 d['source']['enrichmentSources']=[{'name':'Apex Wiki public file metadata','url':'https://apexlegends.wiki.gg/api.php','retrievedAt':max(x['retrievedAt'] for x in wiki['requests']),'fileCount':len(wiki['files']),'pages':len(wiki['requests'])},{'name':'Apex Legends ItemStore public media metadata','url':'https://apexitemstore.com/wp-json/wp/v2/media','retrievedAt':max(x['retrievedAt'] for x in store['requests']),'visibleAttachmentCount':store['actualCount'],'declaredAttachmentCount':store['declaredTotal'],'pages':store['traversedPages']},{'name':'EA / Respawn official original cosmetic clips and named image','url':'https://www.ea.com/games/apex-legends/apex-legends/news','scope':'Eight sampled original MP4 cosmetic showcases, two official cosplay guides cross-checked for Horizon/Fuse, one named Raptor\'s Claw image; exact URLs retained per skin.'}]
 report={'checkedAt':checked,'readyCount':len(ready),'pendingCount':len(pending),'sourceCoverage':search,'reasonCounts':d['coverage']['remainingReasonCounts'],'remaining':[{'id':r['id'],'sourceId':r['sourceId'],'name':r['englishName'],'type':r['weaponType'],'firstSeenAt':r['firstSeenAt'],'sourceUrl':r['sourceUrl'],'reason':r['remainingReason']} for r in pending]}
 base.atomic(base.OUT,d);base.atomic(ROOT/'local-only/weapon-skins/apex/remaining-2026-11-03.json',report);print(json.dumps({'pending':len(pending),'reasonCounts':d['coverage']['remainingReasonCounts']}))
if __name__=='__main__':main()
