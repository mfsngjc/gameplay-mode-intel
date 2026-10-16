/* Foundation updates share the mode library while retaining their own evidence and dates. */
const coreUpdateCategories = {
  map_poi: '地图与 POI', map_interactable: '地图交互物', equipment: '道具与装备',
  traversal: '移动与转点', economy_loot: '资源与经济', revive_teamplay: '救援与返场',
  combat_rules: '战斗规则', in_match_usability: '局内操作与信息'
};
const contentTypeLabels = { all: '全部资料', mode: '模式案例', core_update: '基础更新', item: '主题道具' };
function isCoreUpdate(entry) { return entry.contentKind === 'core_update'; }
function getContentTypeLabel(entry) { return isCoreUpdate(entry) ? '基础更新' : entry.kind === 'modes' ? '模式案例' : kindLabels[entry.kind]; }
function getCoreUpdateTiming(entry) {
  const status = entry.effectiveDateStatus;
  const explicit = ['confirmed', 'scheduled'].includes(status) && entry.effectiveDate;
  return { date: explicit ? entry.effectiveDate : entry.publishedDate,
    label: explicit ? (status === 'scheduled' ? '预定' : '生效') : '公告' };
}
function coreUpdateDateLabel(entry) {
  const timing = getCoreUpdateTiming(entry);
  return (timing.date || '时间待确认') + ' · ' + timing.label;
}
function normalizeCoreUpdate(entry) {
  const date = getCoreUpdateTiming(entry).date || '';
  return { ...entry, kind: 'modes', isLtm: false, tags: [], modeName: entry.title,
    type: entry.categories.map((id) => coreUpdateCategories[id]), year: date.slice(0, 4), date,
    launchDate: entry.effectiveDateStatus === 'confirmed' ? entry.effectiveDate : null,
    launchLabel: coreUpdateDateLabel(entry), oneLineRule: entry.after,
    mechanicChange: entry.after, tempoImpact: entry.playerImpact,
    launchNote: [entry.timingNote, entry.scopeNote].filter(Boolean).join('\n\n'),
    aiCommentator: '设计分析，不代表官方结论' };
}
function coreUpdateActivityState(entry) {
  if (entry.effectiveDateStatus === 'scheduled') {
    return getDayDelta(entry) > 0 ? { className: 'is-upcoming', label: '预告' }
      : { className: 'is-unknown', label: '预定日期已过 · 待核实' };
  }
  return { className: entry.effectiveDateStatus === 'confirmed' ? 'is-archive' : 'is-unknown',
    label: entry.effectiveDateStatus === 'confirmed' ? '已生效' : '公告 · 生效日待核实' };
}
function summarizeLibrary(entries) {
  const updates = entries.filter(isCoreUpdate).length;
  return entries.length + ' 份资料 · ' + (entries.length - updates) + ' 个模式案例 · ' + updates + ' 条基础更新';
}
function updateMatchesContentFilters(entry) {
  if (state.contentFilter === 'item' && !isTacticalItem(entry)) return false;
  if (state.contentFilter === 'core_update' && !isCoreUpdate(entry)) return false;
  if (state.contentFilter === 'mode' && (isCoreUpdate(entry) || entry.kind !== 'modes')) return false;
  if (state.updateCategory !== 'all' && !entry.categories?.includes(state.updateCategory)) return false;
  return true;
}
function renderSharedFilters() {
  const modeView = state.view === 'modes';
  document.querySelector('#sharedFilters').hidden = ['maps', 'items'].includes(state.view) || (state.view === 'modes' && state.modeView === 'patches');
  document.querySelector('#itemContentOption').hidden = state.view !== 'collection';
  document.querySelector('#contentTypeField').hidden = !modeView && state.view !== 'collection';
  document.querySelector('#updateCategoryField').hidden = state.contentFilter !== 'core_update';
  document.querySelector('#contentTypeSelect').value = state.contentFilter;
  document.querySelector('#updateCategorySelect').value = state.updateCategory;
  document.querySelector('#libraryViewControls').hidden = modeView && state.modeView !== 'library';
  document.querySelector('#typeField').hidden = state.view === 'mechanics' || state.contentFilter === 'core_update';
  document.querySelectorAll('[data-feed]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.feed === state.feedFilter)));
  renderGameplayFilters();
  renderGameFilters();
  const filters = [state.query ? '搜索：' + state.query : '', state.gameFilter !== 'all' ? state.gameFilter : '',
    state.gameplayFilter !== 'all' ? currentGameplayDefinitions().find((d) => d.id === state.gameplayFilter)?.label : '',
    state.contentFilter !== 'all' ? contentTypeLabels[state.contentFilter] : '',
    state.updateCategory !== 'all' ? coreUpdateCategories[state.updateCategory] : '',
    state.topic !== 'all' ? topicDefs.find((d) => d.id === state.topic)?.label : '', state.filter === 'ltm' ? 'LTM' : ''].filter(Boolean);
  document.querySelector('#filterSummary').hidden = !filters.length;
  document.querySelector('#filterSummaryText').textContent = filters.join(' · ');
}
function tacticalProfileDetail(entry) {
  const p = entry.tacticalProfile;
  if (!p) return '';
  const row = (label, value) => '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
  return '<section class="detail-section tactical-profile"><h3>战术道具机制</h3><p class="tactical-role">' + escapeHtml(p.role) + '</p><dl>' +
    row('英文原名', p.englishName) + row('操作方式', p.operation) + row('作用效果', p.effect) + row('获取方式', p.acquisition) + row('限制与版本差异', p.limits) +
    '</dl><div class="tactical-parameters">' + p.parameters.map((r) => '<div><span>' + escapeHtml(r.label) + '</span><strong>' + escapeHtml(r.value) + '</strong></div>').join('') + '</div></section>';
}
function coreUpdateMediaDetail(entry) {
  const videos = (entry.videos || []).filter((v) => safeUrl(v.url));
  const shots = (entry.screenshots || []).filter((s) => safeUrl(s.path));
  return (videos.length ? '<section class="detail-section"><h3>YouTube 视频演示</h3><div class="tactical-videos">' + videos.map((v) =>
    '<a class="tactical-video" href="' + escapeHtml(safeUrl(v.url)) + '" target="_blank" rel="noopener noreferrer"><span class="tactical-video-label">' +
    (v.sourceType === 'official' ? '官方演示' : '第三方实机演示') + ' · ' + escapeHtml(v.publishedDate) + '</span><strong>' + escapeHtml(v.title) + ' ↗</strong><span>' + escapeHtml(v.channel) + ' · ' + escapeHtml(v.versionLabel) + '</span><p>' + escapeHtml(v.watchFor) + '</p></a>'
  ).join('') + '</div><p class="tactical-note">视频用于观察操作和表现；数值与适用范围以本条官方来源为准。</p></section>' : '') +
    (shots.length ? '<section class="detail-section"><h3>视频截图</h3><div class="tactical-screenshots">' + shots.map((s) => '<figure><a href="' + escapeHtml(safeUrl(s.path)) + '" target="_blank" rel="noopener noreferrer"><img src="' + escapeHtml(safeUrl(s.path)) + '" alt="' + escapeHtml(s.caption) + '" loading="lazy"></a><figcaption>' + escapeHtml(s.caption) + ' <a href="' + escapeHtml(safeUrl(s.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">查看视频时间点 ↗</a></figcaption></figure>').join('') + '</div></section>' : '') +
    (entry.mediaNote ? '<p class="tactical-note">' + escapeHtml(entry.mediaNote) + '</p>' : '');
}
function coreUpdateEvidenceDetail(entry) {
  return entry.evidenceLinks?.length ? '<section class="detail-section"><h3>机制与日期依据</h3><ul class="tactical-evidence">' + entry.evidenceLinks.map((s) => '<li><a href="' + escapeHtml(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s.label) + ' ↗</a></li>').join('') + '</ul></section>' : '';
}
function tacticalProfileMarkdown(entry) {
  const p = entry.tacticalProfile;
  if (!p) return [];
  return ['## 战术道具机制', '', '- 英文原名：' + p.englishName, '- 定位：' + p.role, '', '### 操作方式', '', p.operation, '', '### 作用效果', '', p.effect, '', '### 获取方式', '', p.acquisition, '', '### 限制与版本差异', '', p.limits, '', ...p.parameters.map((r) => '- ' + r.label + '：' + r.value), '',
    '## YouTube 视频演示', '', ...(entry.videos || []).flatMap((v) => ['- [' + v.title + '](' + v.url + ')', '  - ' + v.channel + ' · ' + v.publishedDate + ' · ' + (v.sourceType === 'official' ? '官方演示' : '第三方演示'), '  - ' + v.versionLabel + '；' + v.watchFor]), '',
    ...((entry.screenshots || []).length ? ['## 视频截图', '', ...entry.screenshots.flatMap((s) => ['![' + s.caption + '](' + new URL(s.path, document.baseURI).href + ')', '', '[' + s.caption + '](' + s.sourceUrl + ')', ''])] : []),
    ...(entry.mediaNote ? [entry.mediaNote, ''] : []),
    '## 机制与日期依据', '', ...(entry.evidenceLinks || []).map((s) => '- [' + s.label + '](' + s.url + ')'), ''];
}
function coreUpdateDetail(entry) {
  const section = (title, text) => text ? '<div class="detail-section"><h3>' + title + '</h3><p>' + escapeHtml(text) + '</p></div>' : '';
  const related = (entry.sourceModeIds || []).map((id) => state.entries.find((r) => r.id === id)).filter(Boolean);
  const imageUrl = safeUrl(entry.imageUrl);
  return (imageUrl ? '<figure class="update-detail-figure"><img class="detail-cover" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(entry.imageSource) + '"><figcaption>' + escapeHtml(entry.imageSource) + (entry.imageSourcePageUrl ? ' · <a href="' + escapeHtml(safeUrl(entry.imageSourcePageUrl)) + '" target="_blank" rel="noopener noreferrer">图片出处</a>' : '') + '</figcaption></figure>' : '') +
    '<div class="detail-inner"><div class="detail-kicker">基础更新 / ' + escapeHtml(entry.game) + '</div><h2 id="detailTitle">' + escapeHtml(entry.modeName) + '</h2>' +
    '<div class="detail-meta"><span>' + escapeHtml(coreUpdateDateLabel(entry)) + '</span><span>' + escapeHtml(entry.versionLabel) + '</span></div>' +
    '<div class="detail-taxonomy">' + entryGameplayDefinitions(entry).map((d) => '<span class="gameplay-chip">' + escapeHtml(d.label) + '</span>').join('') + '</div>' +
    section('适用模式与地图', [...entry.affectedModes, ...entry.mapNames].join(' · ')) +
    section('改动前', entry.before || '该来源未明确说明改动前的完整状态。') + section('具体变化', entry.after) +
    tacticalProfileDetail(entry) + coreUpdateMediaDetail(entry) +
    section('玩家行为变化 · 分析', entry.playerImpact) + section('设计观察 · 分析', entry.designObservation.replace(/^设计推断：/, '')) +
    section('时间与来源备注', entry.launchNote) +
    coreUpdateEvidenceDetail(entry) +
    (related.length ? '<div class="detail-section"><h3>关联模式</h3><div class="related-cases">' + related.map((r) => '<button data-action="open-mode" data-id="' + escapeHtml(r.id) + '">' + escapeHtml(r.modeName) + icon('arrow-up-right') + '</button>').join('') + '</div></div>' : '') +
    '<div class="detail-actions">' + ffRelatedPatchLink(entry) + detailButton(entry) + '<button class="button" data-action="copy" data-id="' + escapeHtml(entry.id) + '">复制 Markdown</button><button class="button" data-action="share" data-id="' + escapeHtml(entry.id) + '">分享图片</button><a class="button" href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">查看官方来源</a></div></div>';
}
function coreUpdateMarkdown(entry) {
  return ['# ' + entry.modeName, '', '- 资料类型：基础更新', '- 游戏：' + entry.game,
    '- 核心玩法：' + getGameplayLabel(entry), '- 日期：' + coreUpdateDateLabel(entry), '- 版本：' + entry.versionLabel,
    '- 类别：' + entry.type.join(' / '), '- 适用模式：' + entry.affectedModes.join(' / '),
    ...(entry.mapNames.length ? ['- 地图与点位：' + entry.mapNames.join(' / ')] : []),
    '- 来源：' + entry.sourceUrl, ...(entry.patchId ? ['- 完整版本详录：docs/free-fire-patches/' + entry.patchId.replace('ff-patch-', '') + '.md'] : []), '- 图片来源：' + entry.imageSource,
    '- 图片原始地址：' + (entry.imageAssetSourceUrl || ''), '',
    '## 改动前', '', entry.before || '该来源未明确说明改动前的完整状态。', '', '## 具体变化', '', entry.after, '',
    ...tacticalProfileMarkdown(entry),
    '## 玩家行为变化（分析）', '', entry.playerImpact, '', '## 设计观察（分析）', '', entry.designObservation, '',
    '## 时间与来源备注', '', entry.launchNote, ''].join('\n');
}
function groupUpdateEntries(entries, byLane = false) {
  const groups = [], lookup = new Map();
  for (const entry of entries) {
    if (!isCoreUpdate(entry)) { groups.push({ entries: [entry], representative: entry, isUpdateGroup: false }); continue; }
    const timing = getCoreUpdateTiming(entry);
    const key = [entry.game, entry.versionLabel, timing.date, timing.label, byLane ? (entry.timelineLane || getGameplayTypes(entry)[0]) : ''].join('|');
    let group = lookup.get(key);
    if (!group) { group = { entries: [], representative: entry, isUpdateGroup: true }; lookup.set(key, group); groups.push(group); }
    group.entries.push(entry);
  }
  return groups;
}
function groupTitle(group) {
  return group.entries.length > 1 ? group.representative.versionLabel + ' · ' + group.entries.length + ' 条基础更新' : group.representative.modeName;
}
function renderUpdateGroupItems(group) {
  return '<div class="update-group-items">' + group.entries.map((r) => '<button type="button" class="update-group-item" data-action="open-mode" data-id="' + escapeHtml(r.id) + '"><img src="' + escapeHtml(safeUrl(r.imageUrl)) + '" loading="lazy" alt=""><span><strong>' + escapeHtml(r.modeName) + '</strong><small>' + escapeHtml(r.type.join(' / ') + ' · ' + r.imageScopeLabel) + '</small></span>' + icon('arrow-up-right') + '</button>').join('') + '</div>';
}
function renderRecordActivity(entry) {
  const status = getActivityState(entry);
  return '<article class="activity-card ' + status.className + '"><div class="activity-date"><time datetime="' + escapeHtml(getModeDateValue(entry)) + '">' + escapeHtml(formatActivityDate(entry)) + '</time><span>' + escapeHtml(status.label) + '</span></div><div class="activity-main"><div class="activity-title-row"><span class="activity-game">' + escapeHtml(entry.game) + '</span><h3>' + escapeHtml(entry.modeName) + '</h3></div><p>' + escapeHtml(entry.oneLineRule) + '</p><div class="activity-tags">' + escapeHtml(getContentTypeLabel(entry) + ' · ' + getGameplayLabel(entry) + (isLtmMode(entry) ? ' · LTM' : '')) + '</div></div><div class="activity-actions"><button data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">查看详情</button><a href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">来源</a></div></article>';
}
function renderUnifiedActivityFeed() {
  let entries = getSortedModesDescending(state.modes.filter((r) => matchesLibraryEntry(r)));
  if (state.feedFilter === 'recent') entries = entries.filter((r) => {
    const date = isCoreUpdate(r) ? parseModeDate({ launchDate: r.publishedDate }) : parseModeDate(r);
    const days = date ? (date - getTodayStart()) / 86400000 : NaN;
    return days <= 0 && days >= -30;
  });
  if (state.feedFilter === 'upcoming') entries = entries.filter((r) => getDayDelta(r) > 0).reverse();
  if (state.feedFilter === 'ltm') entries = entries.filter(isLtmMode);
  const groups = groupUpdateEntries(entries);
  const shown = groups.slice(0, state.activityLimit || 24);
  document.querySelector('#activityStats').textContent = entries.length + ' 份资料 · ' + groups.length + ' 组动态';
  activityFeed.innerHTML = shown.length ? shown.map((group) => {
    if (!group.isUpdateGroup || group.entries.length === 1) return renderRecordActivity(group.representative);
    const entry = group.representative;
    return '<article class="activity-card update-activity-group"><div class="activity-date"><time>' + escapeHtml(coreUpdateDateLabel(entry)) + '</time><span>基础更新</span></div><div class="activity-main"><div class="activity-title-row"><span class="activity-game">' + escapeHtml(entry.game) + '</span><h3>' + escapeHtml(groupTitle(group)) + '</h3></div>' + renderUpdateGroupItems(group) + '</div></article>';
  }).join('') : '<div class="empty-state"><h3>这个范围内暂无动态</h3><p>可切换全部动态，或清除筛选。</p></div>';
  if (groups.length > shown.length) activityFeed.insertAdjacentHTML('beforeend', '<button class="button" type="button" data-load-activity>加载更多动态</button>');
}
function renderTimelineGroup(group, index) {
  const entry = group.representative, meta = getTimelineMeta(entry);
  const label = getTimelineDateLabel(entry);
  const summary = '<span class="timeline-date-row"><time datetime="' + escapeHtml(getModeDateValue(entry)) + '">' + escapeHtml(label) + '</time><span>' + escapeHtml(meta.label) + '</span></span><span class="timeline-event"><strong>' + escapeHtml(groupTitle(group)) + '</strong></span>';
  return '<li id="timeline-group-' + index + '" class="timeline-node ' + meta.className + '"><span class="timeline-dot" aria-hidden="true"></span>' +
    (group.entries.length > 1 ? '<details><summary>' + summary + '</summary>' + renderUpdateGroupItems(group) + '</details>' : '<button class="timeline-entry-button" type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">' + summary + '</button>') + '</li>';
}
