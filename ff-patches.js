/* Full patch records organize evidence; they are never counted as new modes. */
const ffPlaylistDefinitions = [
  {id:'br', label:'BR（大逃杀）', shortLabel:'BR', timelineClass:'is-core'},
  {id:'cs', label:'CS（枪王对决）', shortLabel:'CS', timelineClass:'is-variant'},
  {id:'other', label:'其他独立玩法', shortLabel:'其他', timelineClass:'is-special'}
];
const ffPatchCategories = {event:'活动覆盖',map:'地图与 POI',equipment:'道具与战备',rules:'战斗与对局规则',economy:'物资与经济',traversal:'移动与载具',revive:'救援与返场',zone:'安全区',character:'角色与宠物',weapon:'武器与防具',interface:'操作与信息'};
const ffPatchLanes = {all:'全部内容',br:'BR 大逃杀',cs:'CS 枪王对决',shared:'通用调整'};
function getFFPlaylists(entry) { return entry.ffPlaylists?.length ? entry.ffPlaylists : ['other']; }
function entryGameplayDefinitions(entry) {
  return entry.game === 'Free Fire' ? ffPlaylistDefinitions.filter(d=>getFFPlaylists(entry).includes(d.id))
    : gameplayDefinitions.filter(d=>getGameplayTypes(entry).includes(d.id));
}
function currentGameplayDefinitions() {return state.gameFilter === 'Free Fire' ? ffPlaylistDefinitions : gameplayDefinitions;}
function matchesGameplayFilter(entry) {
  return state.gameplayFilter === 'all' || (state.gameFilter === 'Free Fire' ? getFFPlaylists(entry) : getGameplayTypes(entry)).includes(state.gameplayFilter);
}
function expandFFTimelineEntries(entries) {
  return entries.flatMap(entry=> entry.game !== 'Free Fire' ? [entry] : getFFPlaylists(entry)
    .filter(lane=>state.gameplayFilter==='all'||state.gameplayFilter===lane)
    .map(lane=>({...entry,timelineLane:lane})));
}
function ffPatchLink(id, lane='all') {
  return '#modes?view=patches&game=Free+Fire&patch='+encodeURIComponent(id)+'&lane='+lane;
}
function samePatchSource(a,b) {return !!a&&!!b&&a.replace(/\/$/,'')===b.replace(/\/$/,'');}
function patchReferencesEntry(patch,entry) {
  return patch.id===entry.patchId || samePatchSource(patch.sourceUrl,entry.sourceUrl) ||
    [...patch.sections,...patch.outside].some(section=>(section.sourceModeIds||[]).includes(entry.id));
}
function findFFPatch(entry) {return (state.ffPatches||[]).find(p=>patchReferencesEntry(p,entry));}
function ffRelatedPatchLink(entry) {
  return (state.ffPatches||[]).filter(patch=>patchReferencesEntry(patch,entry)).map(patch=>'<a class="button" href="'+ffPatchLink(patch.id)+'">查看 '+escapeHtml(patch.versionLabel)+' 完整版本详录</a>').join('');
}
function renderFFPatchCard(patch) {
  const image=patch.images[0];
  const counts=['br','cs','shared'].map(lane=>ffPatchLanes[lane]+' '+patch.sections.filter(s=>s.lane===lane).length+' 节').join(' · ');
  return '<article class="ff-version-card"><a href="'+ffPatchLink(patch.id)+'">'+(image?'<img src="'+escapeHtml(image.imageUrl)+'" alt="'+escapeHtml(image.caption)+'" loading="lazy">':'')+'<div><small>'+patch.publishedDate+' · 公告</small><h3>'+escapeHtml(patch.versionLabel)+'</h3><p>'+counts+'</p><span>'+patch.itemCount+' 项说明及表格行 · '+patch.images.length+' 张公告插图</span></div></a></article>';
}
function renderFFPatchLibrary() {
  const host=document.querySelector('#ffPatchLibrary');
  const visible=state.view==='modes'&&state.modeView==='library'&&state.gameFilter==='Free Fire'&&state.contentFilter!=='mode'&&state.filter!=='ltm';
  host.hidden=!visible;
  if(!visible)return;
  const patches=(state.ffPatches||[]).filter(p=> !state.query || JSON.stringify(p.sections).toLowerCase().includes(state.query.toLowerCase()) || p.versionLabel.toLowerCase().includes(state.query.toLowerCase()));
  host.innerHTML='<div class="ff-section-heading"><div><h2>版本详录</h2><p>当前 '+(state.ffPatches||[]).length+' 篇公告的 BR、CS 和通用改动；每节保留具体数值、日期与来源。</p></div><a class="button" href="#modes?view=patches&game=Free+Fire">查看全部 '+(state.ffPatches||[]).length+' 篇</a></div><div class="ff-version-grid">'+patches.slice().reverse().slice(0,3).map(renderFFPatchCard).join('')+'</div>';
}
function renderFFVersionNode(patch,lane) {
  const count=patch.sections.filter(section=>section.lane===lane).length;
  if(!count)return '<div class="ff-version-empty">本篇未列<br>'+ffPatchLanes[lane]+' 专属内容</div>';
  return '<a class="ff-version-node is-'+lane+'" href="'+ffPatchLink(patch.id,lane)+'"><span class="ff-node-dot"></span><strong>'+count+' 个小节</strong><span>查看具体改动 →</span></a>';
}
function renderFFPatchTimeline() {
  if(state.gameFilter!=='Free Fire'||state.contentFilter==='mode'||state.filter==='ltm')return '';
  const patches=(state.ffPatches||[]).filter(p=>!state.query || JSON.stringify(p.sections).toLowerCase().includes(state.query.toLowerCase())||p.versionLabel.toLowerCase().includes(state.query.toLowerCase()));
  if(!patches.length)return '';
  const lanes=['br','cs','shared'].filter(lane=>state.gameplayFilter==='all'||state.gameplayFilter===lane);
  if(!lanes.length)return '';
  return '<section class="ff-patch-timeline"><div class="ff-section-heading"><div><h3>版本公告 · BR / CS / 通用</h3><p>当前收录 '+patches.length+' 篇。日期为公告日，间隔不代表实际时间跨度；通用改动单列，适用范围以原文说明为准。</p></div></div><div class="ff-timeline-scroll" tabindex="0" aria-label="可横向滚动的 BR、CS 和通用版本时间轴"><div class="ff-timeline-grid" style="--patch-count:'+patches.length+'"><span></span>'+patches.map(p=>'<div class="ff-timeline-date"><strong>'+escapeHtml(p.versionLabel)+'</strong><time>'+p.publishedDate+'</time></div>').join('')+lanes.map(lane=>'<strong class="ff-lane-label">'+ffPatchLanes[lane]+'</strong>'+patches.map(p=>renderFFVersionNode(p,lane)).join('')).join('')+'</div></div></section>';
}
function patchSectionMatches(section) {
  const lane=state.patchLane||'all',category=state.patchCategory||'all';
  if(lane!=='all'&&section.lane!==lane)return false;
  if(category!=='all'&&section.category!==category)return false;
  const text=[section.title,section.sourceHeading,...section.items,...(section.tables||[]).map(t=>JSON.stringify(t.rows))].join(' ').toLowerCase();
  return state.query.trim().toLowerCase().split(/\s+/).every(word=>text.includes(word));
}
function assignPatchImages(patch, sections) {
  const assigned=new Set();
  const overview=patch.images.filter(img=>img.displayRole==='overview');
  overview.forEach(img=>assigned.add(img.id));
  const bySection=new Map(sections.map(section=>{
    const images=patch.images.filter(img=>(section.imageIds||[]).includes(img.id)&&!assigned.has(img.id));
    images.forEach(img=>assigned.add(img.id));
    return [section.id,images];
  }));
  return {overview,bySection,remaining:patch.images.filter(img=>!assigned.has(img.id))};
}
function renderPatchImage(img) {
  return '<figure class="ff-patch-image" data-patch-image-id="'+escapeHtml(img.id)+'"><a href="'+escapeHtml(img.imageUrl)+'" target="_blank" rel="noopener noreferrer" aria-label="查看原尺寸：'+escapeHtml(img.caption)+'"><img src="'+escapeHtml(img.imageUrl)+'" alt="'+escapeHtml(img.caption)+'" loading="lazy" style="max-width:'+img.width+'px" width="'+img.width+'" height="'+img.height+'"></a><figcaption><strong>'+escapeHtml(img.caption)+'</strong><span>原文：'+escapeHtml(img.sourceHeading)+' · '+img.width+'×'+img.height+' · <a href="'+escapeHtml(img.originalUrl)+'" target="_blank" rel="noopener noreferrer">官方原图 ↗</a></span></figcaption></figure>';
}
function renderPatchTables(section) {
  return (section.tables||[]).map(t=>'<div class="ff-table-scroll" tabindex="0" role="region" aria-label="'+escapeHtml(section.title)+'数值表"><table>'+(t.caption?'<caption>'+escapeHtml(t.caption)+'</caption>':'')+'<thead><tr>'+t.headers.map(h=>'<th scope="col">'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(row=>'<tr>'+row.map((cell,i)=>i===0?'<th scope="row">'+escapeHtml(cell)+'</th>':'<td>'+escapeHtml(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>').join('');
}
function renderPatchSection(section, images=[]) {
  const table=renderPatchTables(section);
  return '<article class="ff-section-card" id="'+section.id+'"><details open><summary><div class="ff-card-meta"><span class="ff-lane-chip '+section.lane+'">'+ffPatchLanes[section.lane]+'</span><span>'+ffPatchCategories[section.category]+'</span>'+(['event_overlay','limited'].includes(section.scope)&&section.category!=='event'?'<span>活动覆盖</span>':'')+'</div><h3>'+escapeHtml(section.title)+'</h3><span class="ff-detail-hint">'+section.items.length+' 项说明'+(table?' · 含参数表':'')+(images.length?' · '+images.length+' 张原图':'')+'</span></summary><div class="ff-card-content">'+images.map(renderPatchImage).join('')+'<ul>'+section.items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>'+table+'<p class="ff-evidence">时间：'+escapeHtml(section.timingNote)+'</p>'+(section.scopeNote?'<p class="ff-evidence">范围：'+escapeHtml(section.scopeNote)+'</p>':'')+'<p class="ff-evidence">原文小节：'+escapeHtml(section.sourceHeading)+'</p></div></details></article>';
}
function renderFFPatches() {
  const host=document.querySelector('#patchesSection');
  const patches=state.ffPatches||[];
  const patch=patches.find(p=>p.id===state.patchId);
  host.innerHTML='<div class="ff-section-heading"><div><h2>Free Fire 版本详录</h2><p>当前收录 '+patches.length+' 篇公告，'+(patches[0]?.publishedDate||'')+' 至 '+(patches.at(-1)?.publishedDate||'')+'；历史缺口持续补齐中。</p></div><a class="button" href="#modes?view=timeline&game=Free+Fire">查看 BR / CS 时间轴</a></div>'+
    '<nav class="ff-version-nav" aria-label="选择 FF 版本"><a href="#modes?view=patches&game=Free+Fire" '+(!patch?'aria-current="page"':'')+'>全部版本</a>'+patches.slice().reverse().map(p=>'<a href="'+ffPatchLink(p.id,state.patchLane||'all')+'" '+(p===patch?'aria-current="page"':'')+'>'+escapeHtml(p.versionLabel)+'</a>').join('')+'</nav>';
  if(!patch){
    const filtered=patches.filter(p=>!state.query || [p.versionLabel,JSON.stringify(p.sections)].join(' ').toLowerCase().includes(state.query.toLowerCase()));
    host.insertAdjacentHTML('beforeend','<div class="ff-version-grid">'+filtered.slice().reverse().map(renderFFPatchCard).join('')+'</div>');return;
  }
  const sections=patch.sections.filter(patchSectionMatches);
  const imageLayout=assignPatchImages(patch,sections);
  const lanes=Object.entries(ffPatchLanes).map(([id,label])=>'<button type="button" data-patch-lane="'+id+'" aria-pressed="'+((state.patchLane||'all')===id)+'">'+label+' <small>'+patch.sections.filter(s=>id==='all'||s.lane===id).length+'</small></button>').join('');
  host.insertAdjacentHTML('beforeend','<header class="ff-patch-header"><div><small>'+patch.publishedDate+' · 公告日期</small><h2>'+escapeHtml(patch.versionLabel)+'</h2><p>'+patch.sectionCount+' 个分类小节 · '+patch.itemCount+' 项说明及表格行 · '+patch.images.length+' 张官方插图</p><p>'+escapeHtml(patch.timingNote)+'</p></div><div class="ff-patch-actions"><a class="button" href="'+escapeHtml(patch.sourceUrl)+'" target="_blank" rel="noopener noreferrer">官方原文 ↗</a><a class="button" href="docs/free-fire-patches/'+patch.articleId+'.md" download>下载完整 Markdown</a></div></header><div class="ff-patch-controls"><div class="ff-lane-tabs" role="group" aria-label="版本内容适用玩法">'+lanes+'</div><label>内容类别 <select id="ffPatchCategory"><option value="all">全部类别</option>'+Object.entries(ffPatchCategories).map(([id,label])=>'<option value="'+id+'" '+(state.patchCategory===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><button class="button" type="button" data-patch-expand="open">展开全部</button><button class="button" type="button" data-patch-expand="close">收起全部</button></div><p class="ff-result-count" role="status">当前 '+sections.length+' 个小节'+(state.patchLane==='br'||state.patchLane==='cs'?'；角色、武器等内容另见“通用调整”。':'')+'</p>'+(imageLayout.overview.length?'<div class="ff-patch-overview">'+imageLayout.overview.map(renderPatchImage).join('')+'</div>':'')+'<div class="ff-section-grid">'+(sections.length?sections.map(section=>renderPatchSection(section,imageLayout.bySection.get(section.id))).join(''):'<p class="empty-state">当前条件没有匹配内容。</p>')+'</div>'+renderPatchAppendix(patch,imageLayout.remaining));
}
function renderPatchAppendix(patch, remainingImages) {
  const related=state.modes.filter(r=>r.game==='Free Fire'&&patchReferencesEntry(patch,r));
  const missing=(patch.unavailableBodyImages||[]).map(img=>'<section class="ff-related"><h3>原文图片待补</h3><p>'+escapeHtml(img.caption)+'。'+escapeHtml(img.retrievalNote)+' <a href="'+escapeHtml(img.originalUrl)+'" target="_blank" rel="noopener noreferrer">原图链接 ↗</a></p></section>').join('');
  const sources=(patch.relatedSources||[]).length?'<section class="ff-related"><h3>版本关联来源</h3>'+patch.relatedSources.map(s=>'<article><h4><a href="'+escapeHtml(s.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(s.title||'官方关联公告')+' ↗</a></h4><p>'+(s.publishedDate?escapeHtml(s.publishedDate)+' · ':'')+escapeHtml(s.relationship)+'</p>'+((s.items||[]).length?'<ul>'+s.items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>':'')+(s.unavailableImages||[]).map(img=>'<p>关联原文图片待补：'+escapeHtml(img.reason)+' <a href="'+escapeHtml(img.originalUrl)+'" target="_blank" rel="noopener noreferrer">原图链接 ↗</a></p>').join('')+((s.images||[]).length?'<div class="ff-image-grid">'+s.images.map(renderPatchImage).join('')+'</div>':'')+'</article>').join('')+'</section>':'';
  const gallery=remainingImages.length?'<section class="ff-remaining-images"><h3>其余原文配图 · '+remainingImages.length+' 张</h3><p>包含原文其他章节的插图，以及当前筛选未展示的章节配图。所有图片保留原始比例，可点击放大。</p><div class="ff-image-grid">'+remainingImages.map(renderPatchImage).join('')+'</div></section>':'';
  return gallery+missing+sources+'<details class="ff-appendix"><summary>其他玩法与局外内容 · 范围说明</summary><p>'+escapeHtml(patch.coverageScope)+'</p>'+patch.outside.map(o=>'<h3>'+escapeHtml(o.title)+'</h3><p>'+escapeHtml(o.summary)+'</p>'+renderPatchTables(o)+'<small>原文目录：'+escapeHtml(o.sourceHeading)+'</small>').join('')+'</details><details class="ff-appendix"><summary>原文目录 · 对照检查</summary><ul>'+patch.sourceOutline.filter(s=>s.title).map(s=>'<li>'+escapeHtml(s.title)+'</li>').join('')+'</ul></details>'+(related.length?'<section class="ff-related"><h3>同版模式与基础更新卡片</h3><div class="related-cases">'+related.map(r=>'<button data-action="open-mode" data-id="'+escapeHtml(r.id)+'">'+escapeHtml(r.modeName)+'</button>').join('')+'</div></section>':'');
}
function bindFFPatchEvents() {
  document.addEventListener('click',event=>{
    const lane=event.target.closest('[data-patch-lane]');
    if(lane){state.patchLane=lane.dataset.patchLane;syncFilterRoute();renderFFPatches();document.querySelector('[data-patch-lane="'+state.patchLane+'"]')?.focus({preventScroll:true});}
    const expand=event.target.closest('[data-patch-expand]');
    if(expand)document.querySelectorAll('.ff-section-card details').forEach(d=>{d.open=expand.dataset.patchExpand==='open';});
  });
  document.addEventListener('change',event=>{if(event.target.id==='ffPatchCategory'){state.patchCategory=event.target.value;syncFilterRoute();renderFFPatches();document.querySelector('#ffPatchCategory')?.focus({preventScroll:true});}});
}
