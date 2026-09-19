#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const patches=JSON.parse(read('data/free-fire-patches.json'));
const modes=JSON.parse(read('data/modes.json'));
const updates=JSON.parse(read('data/core-updates.json'));
const coverage=JSON.parse(read('data/core-update-source-coverage.json')).games['Free Fire'];
const baselineArticles=['1213','1266','1306','1473','1511','1595','1712'];
const ids=new Set();let tables=0, images=0, baselineTables=0;
for(const id of baselineArticles) assert.ok(patches.some(p=>p.articleId===id), 'Requested announcement '+id);
for(const p of patches){
  assert.ok(!ids.has(p.id));ids.add(p.id);
  assert.equal(p.publicationStatus,'ready',p.id+' not reviewed for presentation');
  assert.equal(new URL(p.sourceUrl).hostname,'ff.garena.com');
  assert.match(p.publishedDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.sections.length,p.sectionCount);
  assert.equal(p.itemCount,p.sections.reduce((sum,s)=>sum+s.items.length+(s.tables||[]).reduce((n,t)=>n+t.rows.length,0),0));
  if(baselineArticles.includes(p.articleId))for(const lane of ['br','cs','shared']) assert.ok(p.sections.some(s=>s.lane===lane),p.id+' missing '+lane);
  assert.ok(Array.isArray(p.outside)&&p.sourceOutline.length);
  assert.ok(p.sections.length,p.id+' has no reviewed core content');
  const imageIds=new Set(p.images.map(img=>img.id));
  assert.equal(imageIds.size,p.images.length,p.id+' duplicate image IDs');
  for(const s of p.sections){
    assert.ok(!ids.has(s.id));ids.add(s.id);
    assert.ok(['br','cs','shared'].includes(s.lane));
    assert.ok(['event','map','equipment','rules','economy','traversal','revive','zone','character','weapon','interface'].includes(s.category),s.id+' category');
    assert.ok(s.sourceHeading&&s.items.length&&s.timingNote);
    assert.ok(Array.isArray(s.imageIds),s.id+' image associations missing');
    for(const imageId of s.imageIds)assert.ok(imageIds.has(imageId),s.id+' unknown image '+imageId);
    for(const modeId of s.sourceModeIds||[])assert.ok(modes.some(m=>m.id===modeId),s.id+' unknown related mode');
    for(const t of s.tables||[]){
      tables++;if(baselineArticles.includes(p.articleId))baselineTables++;assert.equal(t.headers.length,t.sourceHeaders.length);
      for(const row of t.rows) assert.equal(row.length,t.headers.length,p.id+' table has missing cells');
    }
  }
  for(const o of p.outside) for(const modeId of o.sourceModeIds||[])assert.ok(modes.some(m=>m.id===modeId),p.id+' outside unknown related mode');
  for(const o of p.outside)for(const t of o.tables||[]){
    tables++;assert.equal(t.headers.length,t.sourceHeaders.length);
    for(const row of t.rows)assert.equal(row.length,t.headers.length,p.id+' appendix table missing cells');
  }
  for(const img of p.images){
    images++;assert.equal(img.sourcePageUrl,p.sourceUrl);
    assert.ok(img.caption&&img.sourceHeading);
    assert.ok(['section','overview','outside'].includes(img.displayRole),img.id+' display role');
    if(img.displayRole==='section')assert.ok(p.sections.some(s=>s.imageIds.includes(img.id)),img.id+' not associated with a section');
    assert.ok(img.width>10&&img.height>10);
    const bytes=fs.readFileSync(path.join(root,img.imageUrl));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),img.sha256);
  }
  const md=read('docs/free-fire-patches/'+p.articleId+'.md');
  const supplemental=(p.relatedSources||[]).flatMap(s=>s.images||[]);
  assert.equal((md.match(/!\[/g)||[]).length,p.images.length+supplemental.length,p.id+' Markdown embedded images');
  for(const source of p.relatedSources||[]){
    for(const img of source.unavailableImages||[]){assert.equal(img.sourcePageUrl,source.url);assert.ok(img.reason&&img.checkedAt&&md.includes(img.originalUrl));}
    for(const item of source.items||[])assert.ok(md.includes(item),p.id+' stale related source text');
    const seen=new Set();
    for(const img of source.images||[]){
      assert.equal(img.sourcePageUrl,source.url);
      assert.ok(!seen.has(img.id));seen.add(img.id);
      assert.ok(img.width>10&&img.height>10&&img.caption&&img.sourceHeading);
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,img.imageUrl))).digest('hex'),img.sha256);
      assert.ok(md.includes('](../../'+img.imageUrl+')'),img.id+' absent from Markdown');
    }
    if(source.imageCoverage)assert.equal(source.imageCoverage.officialBodyImageCount,(source.images||[]).length+(source.unavailableImages||[]).length);
  }
  for(const img of p.images)assert.ok(md.includes('](../../'+img.imageUrl+')'),img.id+' absent from Markdown');
  const unavailable=p.unavailableBodyImages||[];
  for(const img of unavailable){
    assert.equal(img.sourcePageUrl,p.sourceUrl);
    assert.equal(img.downloadStatus,'confirmed_http_404');
    assert.ok(img.originalUrl&&img.retrievalNote&&img.checkedAt);
    assert.ok(!p.images.some(saved=>saved.originalUrl===img.originalUrl));
    assert.ok(md.includes(img.originalUrl)&&md.includes('原文图片待补'));
  }
  if(unavailable.length)assert.equal(p.imageCoverage.status,'reviewed_with_unavailable_assets');
  assert.equal(p.imageCoverage.officialBodyImageCount,p.images.length+unavailable.length);
  assert.equal(p.imageCoverage.inlineImageCount,p.images.length);
  for(const s of p.sections) assert.ok(md.includes(s.title)&&s.items.every(item=>md.includes(item)),p.id+' stale Markdown');
  for(const o of p.outside)for(const t of o.tables||[])for(const row of t.rows)assert.ok(md.includes('| '+row.join(' | ')+' |'),p.id+' appendix table absent from Markdown');
  assert.ok(coverage.checkedSources.some(c=>c.dossierId===p.id&&c.coreSectionsComplete===true));
}
assert.equal(baselineTables,8,'Seven baseline announcements contain eight numeric tables');
for(const r of [...modes,...updates].filter(r=>r.game==='Free Fire')){
  assert.ok(r.ffPlaylists?.length&&r.ffPlaylists.every(l=>['br','cs','other'].includes(l)),r.id+' playlist missing');
  assert.ok(!r.ffPlaylists.includes('other')||r.ffPlaylists.length===1);
}
assert.deepEqual(modes.find(r=>r.id==='free-fire-clash-squad-2019').ffPlaylists,['cs']);
assert.deepEqual(modes.find(r=>r.id==='free-fire-bomb-squad-2019').ffPlaylists,['other']);
assert.deepEqual(modes.find(r=>r.id==='free-fire-lone-wolf-2021').ffPlaylists,['other']);
const context=vm.createContext({assert,modes,updates,patches,document:{querySelector:()=>({}),baseURI:'http://127.0.0.1:4173/'},localStorage:{getItem:()=>'[]'},location:{search:''},URL,URLSearchParams});
vm.runInContext(['core-updates.js','app.js','ff-patches.js'].map(read).join('\n')+'\n'+read('workspace.js').replace(/initWorkspace\(\);\s*$/,''),context);
vm.runInContext(`
 state.ffPatches=patches; state.modes=[...modes.map(r=>({...r,kind:'modes'})),...updates.map(normalizeCoreUpdate)];state.entries=state.modes;state.gameFilter='Free Fire';state.gameplayFilter='cs';
 const cs=getFilteredEntries();assert.ok(cs.length&&cs.every(r=>r.ffPlaylists.includes('cs')));assert.ok(cs.some(r=>r.id==='free-fire-clash-squad-2019'));assert.ok(cs.every(r=>!r.id.startsWith('free-fire-bomb-squad')));
 assert.match(getGameplayLabel(cs[0]),/CS/);assert.doesNotMatch(getGameplayLabel(cs[0]),/休闲/);
 state.gameplayFilter='all';const unique=getFilteredEntries();const expanded=expandFFTimelineEntries(unique);assert.equal(new Set(expanded.map(r=>r.id)).size,unique.length);assert.ok(expanded.length>unique.length);
 const peak=expanded.filter(r=>r.id==='free-fire-update-peak-rework-2023-08-08');assert.deepEqual(peak.map(r=>getTimelineMeta(r).laneKey),['br','cs']);
 const groups=groupUpdateEntries(expanded,true);for(const group of groups)assert.ok(group.entries.every(r=>r.timelineLane===group.representative.timelineLane));
 const chart=renderTimelineCanvas(groups);assert.doesNotMatch(chart,/NaN|undefined/);assert.match(chart,/CS（枪王对决）/);
 const board=renderFFPatchTimeline();assert.equal((board.match(/class="ff-version-node/g)||[]).length,patches.reduce((n,p)=>n+['br','cs','shared'].filter(lane=>p.sections.some(s=>s.lane===lane)).length,0));assert.match(board,/lane=cs/);assert.match(board,/lane=br/);
 state.modeView='patches';state.patchId='ff-patch-1712';state.patchLane='br';state.patchCategory='economy';
 const params=new URLSearchParams(workspaceHash().split('?')[1]);assert.equal(params.get('lane'),'br');assert.equal(params.get('patch'),state.patchId);assert.equal(params.get('pcategory'),'economy');
 const selected=patches.find(p=>p.id===state.patchId).sections.filter(patchSectionMatches);assert.ok(selected.length&&selected.every(s=>s.lane==='br'&&s.category==='economy'));
 const planned=patches.find(p=>p.articleId==='1712').sections.filter(s=>s.timingNote.includes('2026-10-01'));assert.ok(planned.length>=4);assert.ok(planned.every(s=>renderPatchSection(s).includes('预定')));
 assert.ok(samePatchSource('https://ff.garena.com/en/article/114','https://ff.garena.com/en/article/114/'));
 const coldSteel=modes.find(m=>m.id==='free-fire-cold-steel-2019');assert.equal(coldSteel.launchDate,null);assert.match(coldSteel.launchLabel,/预告/);
 assert.ok(ffRelatedPatchLink(coldSteel).includes('ff-patch-114'));
 assert.equal(getModeTimingLabel(coldSteel),'时间说明');assert.match(modeToMarkdown(coldSteel),/时间说明：2019年10月14日预告/);
 const rushHour=modes.find(m=>m.id==='free-fire-rush-hour-2018');assert.ok(ffRelatedPatchLink(rushHour).includes('ff-patch-122'));
 const steffie=patches.find(p=>p.articleId==='122').sections.find(s=>s.title.includes('Steffie'));assert.ok(steffie.items.some(item=>item.includes('5%')));
 for(const patch of patches){
  for(const lane of ['all','br','cs','shared']){
   for(const category of ['all',...Object.keys(ffPatchCategories),'empty']){
    state.patchLane=lane;state.patchCategory=category;
    const visible=patch.sections.filter(patchSectionMatches),layout=assignPatchImages(patch,visible);
    const displayed=[...layout.overview,...layout.bySection.values()].flat().concat(layout.remaining);
    assert.equal(displayed.length,patch.images.length,patch.id+' missing or duplicate displayed images');
    assert.equal(new Set(displayed.map(img=>img.id)).size,patch.images.length);
    for(const section of visible){
     const images=layout.bySection.get(section.id);
     assert.ok(images.every(img=>section.imageIds.includes(img.id)));
     const html=renderPatchSection(section,images);
     assert.equal((html.match(/data-patch-image-id=/g)||[]).length,images.length);
    }
    const appendix=renderPatchAppendix(patch,layout.remaining);
    for(const source of patch.relatedSources||[]){
      for(const item of source.items||[])assert.ok(appendix.includes(escapeHtml(item)));
      for(const img of source.images||[])assert.equal(appendix.split('data-patch-image-id="'+img.id+'"').length-1,1,patch.id+' related image display');
    }
    for(const img of patch.unavailableBodyImages||[])assert.ok(appendix.includes(escapeHtml(img.originalUrl))&&appendix.includes('原文图片待补'));
    for(const o of patch.outside)for(const t of o.tables||[])for(const row of t.rows)for(const cell of row)assert.ok(appendix.includes(escapeHtml(cell)),patch.id+' missing appendix table cell');
    assert.doesNotMatch(appendix,/<details[^>]*><summary>[^<]*图库/);
   }
  }
 }
`,context);
console.log(`FF dossier validation passed: ${patches.length} announcements, ${patches.reduce((n,p)=>n+p.sectionCount,0)} sections, ${tables} tables, ${images} verified images; BR/CS filters, shared-ID timeline grouping and Markdown.`);
