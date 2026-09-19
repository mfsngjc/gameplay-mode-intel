#!/usr/bin/env python3
"""Render the curated FF dossier JSON into portable Chinese Markdown."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
PATCHES=json.loads((ROOT/'data/free-fire-patches.json').read_text())
OUT=ROOT/'docs/free-fire-patches';OUT.mkdir(exist_ok=True)
LANES={'br':'BR · 大逃杀','cs':'CS · 枪王对决','shared':'通用局内调整'}
def image_lines(img):
 return [f"![{img['caption']}](../../{img['imageUrl']})",'',f"{img['caption']}。原文：{img['sourceHeading']}。[官方原图]({img['originalUrl']}) · {img['width']}×{img['height']}。",'']
index=[f'# Free Fire：当前 {len(PATCHES)} 篇版本公告详录','',f"覆盖 {min(p['publishedDate'] for p in PATCHES)} 至 {max(p['publishedDate'] for p in PATCHES)} 的以下 {len(PATCHES)} 篇公告，不是连续历史版本。BR、CS 和通用局内变化详细整理；局外及其他独立玩法保留目录摘要。",'','每项区分公告日、明确的分期日及未公开日期。原文未量化的变化不补造数值；未确认的中文专名为说明性译法。','','图片嵌入对应小节，并保留官方原图链接；本地图片随资料包归档，单独下载本文时可通过官方原图链接查看。','','| 公告 | 版本 | BR 小节 | CS 小节 | 通用小节 | 说明及表格行 | 官方插图 |','|---|---|---:|---:|---:|---:|---:|']
for p in PATCHES:
 counts=[sum(s['lane']==lane for s in p['sections']) for lane in LANES]
 index.append(f"| {p['publishedDate']} | [{p['versionLabel']}]({p['articleId']}.md) | {' | '.join(map(str,counts))} | {p['itemCount']} | {len(p['images'])} |")
 lines=[f"# Free Fire · {p['versionLabel']}",'',f"- 公告日期：{p['publishedDate']}",f"- 官方来源：[{p['sourceTitle']}]({p['sourceUrl']})",f"- 审阅日期：{p['reviewedAt']}",f"- {p['sectionCount']} 个分类小节；{p['itemCount']} 项说明及表格行；{len(p['images'])} 张官方公告插图。",'',p['coverageScope'],'',p['timingNote'],'']
 shown=set()
 for img in p['images']:
  if img.get('displayRole')=='overview':
   lines += image_lines(img);shown.add(img['id'])
 for lane,label in LANES.items():
  lines += [f'## {label}','']
  for s in p['sections']:
   if s['lane']!=lane:continue
   lines += [f"### {s['title']}",'',f"- 归属：{label} / {'活动覆盖' if s['scope'] in ('event_overlay','limited') else '范围未明确' if s['scope']=='unknown' else '常规调整'}",f"- 原文小节：{s['sourceHeading']}",f"- 时间：{s['timingNote']}",'']
   if s.get('scopeNote'):lines += [s['scopeNote'],'']
   for img in p['images']:
    if img['id'] in s.get('imageIds',[]) and img['id'] not in shown:
     lines += image_lines(img);shown.add(img['id'])
   lines += ['- '+item for item in s['items']]+['']
   for t in s.get('tables',[]):
    if t.get('caption'):lines += [t['caption'],'']
    lines += ['| '+' | '.join(t['headers'])+' |','|'+'---|'*len(t['headers'])]+['| '+' | '.join(row)+' |' for row in t['rows']]+['']
 lines += ['## 其他玩法与局外内容（目录摘要）','']
 for o in p['outside']:
  lines += [f"### {o['title']}",'',o['summary'],'',f"原文目录：{o['sourceHeading']}",'']
  for t in o.get('tables',[]):
   if t.get('caption'):lines += [t['caption'],'']
   lines += ['| '+' | '.join(t['headers'])+' |','|'+'---|'*len(t['headers'])]+['| '+' | '.join(row)+' |' for row in t['rows']]+['']
 remaining=[img for img in p['images'] if img['id'] not in shown]
 if remaining:
  lines += ['## 其余原文配图','','以下为尚未在上述小节内展示的原文图片，包括局外章节配图。','']
  for img in remaining:lines += image_lines(img)
 lines += ['## 官方图片索引','','正文图片按相关小节展示，版本总览及其他章节插图另列；同一原图只嵌入一次。','']
 for img in p['images']:lines += [f"- [{img['caption']}]({img['originalUrl']}) · {img['width']}×{img['height']} · 本地 `{img['imageUrl']}`"]
 if p.get('relatedSources'):
  lines += ['','## 版本关联来源','']
  for source in p['relatedSources']:
   lines += [f"### [{source.get('title','官方关联公告')}]({source['url']})",'',source.get('publishedDate',''),source['relationship'],'']
   lines += ['- '+item for item in source.get('items',[])]+['']
   for img in source.get('images',[]):lines += image_lines(img)
   for img in source.get('unavailableImages',[]):lines += [f"- 关联原文图片待补：{img['reason']} [原图链接]({img['originalUrl']})",'']
 if p.get('unavailableBodyImages'):
  lines += ['','## 原文图片待补','']
  for img in p['unavailableBodyImages']:lines += [f"- [{img['caption']}]({img['originalUrl']})：{img['retrievalNote']}"]
 lines += ['','## 原文目录（对照用）','']+['- '+s['title'] for s in p['sourceOutline'] if s['title']]+['']
 (OUT/f"{p['articleId']}.md").write_text('\n'.join(lines))
table_count=sum(len(s.get('tables',[])) for p in PATCHES for s in p['sections']+p['outside'])
index += ['',f"合计：{sum(p['sectionCount'] for p in PATCHES)} 个小节，{sum(p['itemCount'] for p in PATCHES)} 项说明及表格行，{sum(len(p['images']) for p in PATCHES)} 张公告插图，{table_count} 张数值表。",'', '结构化数据：`data/free-fire-patches.json`；本地入口：`http://127.0.0.1:4173/index.html#modes?view=patches&game=Free+Fire`。','']
(OUT/'README.md').write_text('\n'.join(index))
print(f'Rendered {len(PATCHES)} FF dossiers to {OUT}')
