/* Public mode library and map archive; unpublished research remains local. */
const viewMeta = {
  modes: ['玩法模式', '玩法模式', '发现射击游戏的核心模式与限时变体，按玩法、游戏和设计主题查找案例。', '01 / GAME MODES'],
  maps: ['地图', '地图', '收集射击游戏的地图资料，查看空间布局，保存底图并追溯官方来源。', '02 / MAP LIBRARY'],
  collection: ['我的收藏', '我的研究收藏', '收藏值得继续研究的玩法案例。', 'YOUR FIELDNOTES'],

};
const modeViewMeta = {
  library: viewMeta.modes,
  activity: ['玩法模式', '玩法动态', '追踪资料库中的上线节点，回到来源查看每一次规则变化。', '01 / GAME MODES · DYNAMIC'],
  timeline: ['玩法模式', '时间画板', '按游戏与核心玩法分轨，沿着时间查看 BR、大战场、爆破、搜打撤、PVE 和其他玩法的演变。', '01 / GAME MODES · TIMELINE']
};
const kindLabels = { modes: '玩法模式', mechanics: '玩法机制', levels: '关卡机制' };
const gameplayDefinitions = [
  { id: 'br', label: 'BR（大逃杀）', shortLabel: 'BR', timelineClass: 'is-core' },
  { id: 'warfare', label: '大战场', shortLabel: '大战场', timelineClass: 'is-warfare' },
  { id: 'bomb', label: '爆破模式', shortLabel: '爆破', timelineClass: 'is-variant' },
  { id: 'extraction', label: '搜打撤', shortLabel: '搜打撤', timelineClass: 'is-operations' },
  { id: 'pve', label: 'PVE', shortLabel: 'PVE', timelineClass: 'is-hybrid' },
  { id: 'casual', label: '其他（休闲）', shortLabel: '其他', timelineClass: 'is-special' }
];
function getGameplayTypes(entry) {
  const valid = (entry.gameplayTypes || []).filter((id) => gameplayDefinitions.some((item) => item.id === id));
  return valid.length ? [...new Set(valid)] : ['casual'];
}
function getGameplayLabel(entry) {
  return getGameplayTypes(entry).map((id) => gameplayDefinitions.find((item) => item.id === id).label).join(' / ');
}
function isLtmMode(entry) { return entry.kind === 'modes' && entry.isLtm === true; }
function getEntryTags(entry) {
  return [...new Set([...getGameplayTypes(entry).map((id) => gameplayDefinitions.find((item) => item.id === id).label),
    ...(isLtmMode(entry) ? ['LTM · 限时模式'] : []), ...entry.type])];
}

const gameColors = { Fortnite: '#9683b4', PUBG: '#b7a06b', 'PUBG Mobile': '#6c8db4', 'Free Fire': '#d46d52', 'Apex Legends': '#b87770', '三角洲行动': '#7d9a7a', '和平精英': '#81a2b1' };
const topicDefs = [
  { id: 'respawn', label: '复活与容错', pattern: /复活|重生|返场|召回|reboot/i },
  { id: 'objective', label: '目标与胜负', pattern: /目标|占点|护送|撤离|胜利|计分|推车|夺旗/ },
  { id: 'power', label: '能力与成长', pattern: /能力|成长|强化|构筑|技能|升级|干员/ },
  { id: 'space', label: '空间与路线', pattern: /地图|空间|高地|路线|区域|地形|关卡|水路/ },
  { id: 'economy', label: '资源与风险', pattern: /收益|经济|搜刮|资源|战利品|暴露|装备损耗/ },
  { id: 'pve', label: 'PVE 与协作', pattern: /PvE|Boss|首领|怪物|怪潮|合作|NPC|电脑敌人|电脑角色/i },
  { id: 'tempo', label: '节奏与压力', pattern: /短局|节奏|阶段|倒计时|分钟|时间|缩圈/ }
];
const preferredIds = [
  'fortnite-reload-2024', 'apex-ascended-hunt-2026', 'pubg-intense-br-2023',
  'mechanic-team-respawn', 'level-river-network', 'delta-force-ace-hunt-2026',
  'fortnite-floor-is-lava-2019', 'mechanic-evo-build', 'level-moving-front'
];
const $ = (selector) => document.querySelector(selector);
const icon = (name) => '<svg aria-hidden="true"><use href="#ui-' + name + '"></use></svg>';
const detailDialog = $('#detailDialog');
let detailId = null;
let detailTrigger = null;

function safeUrl(value) {
  try {
    const url = new URL(value, document.baseURI);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function topicIds(entry) {
  if (entry.topics) return entry.topics;
  const text = [entry.modeName, entry.oneLineRule, entry.mechanicChange, ...(entry.type || [])].join(' ');
  return topicDefs.filter((topic) => topic.pattern.test(text)).map((topic) => topic.id);
}

function entryMatchesQuery(entry) {
  const text = [entry.modeName, entry.game, entry.oneLineRule, entry.mechanicChange,
    entry.tempoImpact, entry.designObservation, ...(entry.type || []),
    kindLabels[entry.kind], getGameplayLabel(entry), isLtmMode(entry) ? 'LTM 限时模式' : '', ...topicIds(entry).map((id) => topicDefs.find((item) => item.id === id)?.label || '')
  ].join(' ').toLocaleLowerCase();
  return state.query.toLocaleLowerCase().trim().split(/\s+/).every((word) => text.includes(word));
}

function matchesLibraryEntry(entry, { ignoreGameplay = false, ignoreGame = false } = {}) {
  if (kindLabels[state.view] && entry.kind !== state.view) return false;
  if (state.view === 'timeline' && entry.kind !== 'modes') return false;
  if (state.view === 'collection' && !state.collected.has(entry.id)) return false;
  if (!ignoreGame && state.gameFilter !== 'all' && entry.game !== state.gameFilter) return false;
  if (!ignoreGameplay && state.gameplayFilter !== 'all' && !getGameplayTypes(entry).includes(state.gameplayFilter)) return false;
  if (state.filter === 'ltm' && !isLtmMode(entry)) return false;
  if (state.topic !== 'all' && !topicIds(entry).includes(state.topic)) return false;
  return entryMatchesQuery(entry);
}

function getFilteredEntries() {
  let entries = state.entries.filter((entry) => matchesLibraryEntry(entry));
  if (state.sort === 'name') return entries.sort((a, b) => a.modeName.localeCompare(b.modeName, 'zh-CN'));
  if (state.sort === 'newest') return getSortedModesDescending(entries);
  if (state.sort === 'oldest') return entries.sort((a, b) => getDateSortValue(a) - getDateSortValue(b));
  return entries.sort((a, b) => {
    const ai = preferredIds.indexOf(a.id), bi = preferredIds.indexOf(b.id);
    if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
    // Unreleased cases remain available, after the initial research selection.
    return getDateSortValue(b) - getDateSortValue(a) || a.modeName.localeCompare(b.modeName, 'zh-CN');
  });
}

function getGames() { return [...new Set(state.modes.map((mode) => mode.game))]; }

function renderGameFilters() {
  const renderButton = (game, includeCount) => {
    const count = state.entries.filter((entry) => entry.game === game &&
      matchesLibraryEntry(entry, { ignoreGame: true })).length;
    return '<button class="game-filter" type="button" data-game="' + escapeHtml(game) + '" aria-pressed="' + (state.gameFilter === game) + '">' +
      (game === 'all' ? '' : '<span class="game-dot" style="--game-color:' + (gameColors[game] || '#879873') + '"></span>') +
      escapeHtml(game === 'all' ? '全部游戏' : game) + (includeCount && game !== 'all' ? '<small>' + count + '</small>' : '') + '</button>';
  };
  $('#gameFilters').innerHTML = ['all', ...getGames()].map((game) => renderButton(game, true)).join('');
  $('#timelineGameFilters').innerHTML = getGames().map((game) => renderButton(game, false)).join('');
}

function renderGameplayFilters() {
  const scoped = state.entries.filter((entry) => matchesLibraryEntry(entry, { ignoreGameplay: true }));
  $('#gameplayFilters').innerHTML = [{ id: 'all', label: '全部' }, ...gameplayDefinitions].map((definition) => {
    const count = definition.id === 'all' ? scoped.length : scoped.filter((entry) => getGameplayTypes(entry).includes(definition.id)).length;
    return '<button type="button" class="gameplay-filter" data-gameplay="' + definition.id + '" aria-pressed="' + (state.gameplayFilter === definition.id) + '">' +
      escapeHtml(definition.label) + '<small>' + count + '</small></button>';
  }).join('');
}

function workspaceHash(entryId) {
  const params = new URLSearchParams();
  if (state.view === 'modes' && state.modeView !== 'library') params.set('view', state.modeView);
  if (state.gameplayFilter !== 'all') params.set('gameplay', state.gameplayFilter);
  if (state.filter === 'ltm') params.set('tag', 'ltm');
  if (entryId) params.set('entry', entryId);
  return '#' + state.view + (params.size ? '?' + params.toString() : '');
}

function syncFilterRoute() { history.replaceState(null, '', workspaceHash()); }

function updateCounts() {
  const counts = Object.fromEntries(Object.keys(kindLabels).map((kind) => [kind, state.entries.filter((entry) => entry.kind === kind).length]));
  $('#navModeCount').textContent = counts.modes;
  $('#navMapCount').textContent = mapArchive.entries.length || '—';
  $('#navCollectedCount').textContent = state.entries.filter((entry) => state.collected.has(entry.id)).length + (mapArchive.mapCollected?.size || 0);
  $('#librarySummary').textContent = state.view === 'maps' ? new Set(mapArchive.entries.map((entry) => entry.game)).size + ' 款游戏 · ' + mapArchive.entries.length + ' 张地图' : getGames().length + ' 款游戏 · ' + state.entries.length + ' 个模式';
}

function fallbackCover(entry) {
  return '<span class="cover-fallback"><small>' + (entry.kind === 'modes' ? 'GAMEPLAY ARCHIVE' : entry.kind === 'levels' ? 'SPACE & ENCOUNTERS' : 'RULES & DECISIONS') +
    '</small><strong>' + escapeHtml(entry.coverHeadline || entry.game).replaceAll('\n', '<br>') +
    '</strong><span>' + (entry.kind === 'modes' ? '暂无案例封面' : '提炼自 ' + escapeHtml(entry.game)) + '</span></span>';
}

function renderCard(entry) {
  const collected = state.collected.has(entry.id);
  const isMode = entry.kind === 'modes';
  const imageUrl = isMode || entry.kind === 'levels' ? safeUrl(entry.imageUrl) : '';
  const upcoming = isMode && getDayDelta(entry) > 0;
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(entry.launchDate || '') ? formatActivityDate(entry) : (entry.launchLabel || entry.year || '时间待确认');
  return '<article class="mode-card ' + entry.kind + '-card" data-id="' + escapeHtml(entry.id) + '">' +
    '<button class="card-cover ' + (isMode ? '' : 'knowledge-cover') + '" type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '" aria-label="查看 ' + escapeHtml(entry.modeName) + '">' +
    (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(entry.imageSource || entry.modeName + ' 案例配图') + '" loading="lazy" width="640" height="346"><span class="cover-shade"></span><span class="cover-game">' + escapeHtml(entry.game) + '</span>' : fallbackCover(entry)) +
    '<span class="cover-badge ' + (upcoming ? 'upcoming' : '') + '">' + (upcoming ? '即将上线' : isMode ? '模式案例' : '设计提炼') + '</span>' +
    (isLtmMode(entry) ? '<span class="cover-ltm" title="限时模式（LTM）">LTM</span>' : '') + '</button>' +
    '<div class="card-body"><div class="card-eyebrow"><span class="category-name">' + (isMode ? getGameplayLabel(entry) : kindLabels[entry.kind]) + '</span><span class="eyebrow-sep">/</span><span>' + escapeHtml(entry.game) + '</span></div>' +
    '<h3 class="card-title"><button type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.modeName) + '</button></h3>' +
    '<p class="card-summary">' + escapeHtml(entry.oneLineRule) + '</p><div class="tag-row">' + entry.type.slice(0, 3).map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join('') + '</div></div>' +
    '<div class="card-bottom"><span>' + icon(isMode ? 'clock-3' : 'book-open') + '<span>' + (isMode ? escapeHtml(dateLabel) : entry.sourceModeIds.length + ' 个关联案例') + '</span></span>' +
    '<div class="card-bottom-actions"><button class="icon-button ' + (collected ? 'is-collected' : '') + '" type="button" data-action="collect" data-id="' + escapeHtml(entry.id) + '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + escapeHtml(entry.modeName) + '" aria-pressed="' + collected + '">' + icon('bookmark') + '</button>' +
    '<button class="card-open" type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">看拆解' + icon('arrow-up-right') + '</button></div></div></article>';
}

function renderLibrary() {
  renderGameplayFilters();
  renderGameFilters();
  const entries = getFilteredEntries();
  const collectedMaps = state.view === 'collection' ? mapArchive.entries.filter((entry) => mapArchive.mapCollected?.has(entry.id) && mapEntryMatchesQuery(entry)) : [];
  $('#resultsTitle').textContent = state.view === 'collection' ? '已收藏资料' : kindLabels[state.view] + '资料';
  $('#resultCount').textContent = entries.length + collectedMaps.length + ' 份';
  $('#sectionAside').textContent = ['mechanics', 'levels'].includes(state.view)
    ? '按关联案例的核心玩法，查找可复用的设计'
    : state.gameplayFilter === 'all' ? 'LTM 是独立标签，可与任意核心玩法组合筛选' : '核心模式与限时模式，按同一核心玩法归档';
  $('#typeField').hidden = state.view === 'mechanics' || state.view === 'levels';
  $('#contextNote').hidden = !['mechanics', 'levels'].includes(state.view);
  $('#contextNote').textContent = '以下卡片提炼自已有模式案例，属于设计分析。打开详情可查看原案例与来源。';
  const visible = entries.slice(0, state.limit);
  modeGrid.classList.toggle('list-view', state.layout === 'list');
  modeGrid.setAttribute('aria-busy', 'false');
  const emptyMessage = state.view === 'collection' && !state.entries.some((entry) => state.collected.has(entry.id)) && !collectedMaps.length
    ? ['还没有收藏', '点选卡片上的书签，留下你想继续研究的玩法和地图。', '<a class="button" href="#modes">浏览玩法模式</a>']
    : ['没有找到匹配的资料', '试试更短的关键词，或放宽核心玩法、游戏和标签筛选。', '<button class="button" data-reset-filters>清除筛选</button>'];
  const visibleMaps = collectedMaps.slice(0, Math.max(0, state.limit - visible.length));
  modeGrid.innerHTML = (visible.length || visibleMaps.length) ? visible.map(renderCard).join('') + visibleMaps.map(renderMapCollectionCard).join('') :
    '<div class="empty-state">' + icon('search') + '<h3>' + emptyMessage[0] + '</h3><p>' + emptyMessage[1] + '</p>' + emptyMessage[2] + '</div>';
  const totalVisible = visible.length + visibleMaps.length;
  const totalEntries = entries.length + collectedMaps.length;
  statusLine.textContent = '已展示 ' + totalVisible + ' / ' + totalEntries + ' 份资料';
  $('#loadMore').hidden = totalVisible >= totalEntries;
  const activeFilters = [
    state.query ? '搜索：' + state.query : '',
    state.gameFilter !== 'all' ? state.gameFilter : '',
    state.gameplayFilter !== 'all' ? gameplayDefinitions.find((item) => item.id === state.gameplayFilter)?.label : '',
    state.topic !== 'all' ? topicDefs.find((item) => item.id === state.topic)?.label : '',
    state.filter !== 'all' ? tagLabels[state.filter] : ''
  ].filter(Boolean);
  $('#filterSummary').hidden = !activeFilters.length;
  $('#filterSummaryText').textContent = activeFilters.join(' · ');
}

function mapEntryMatchesQuery(entry) {
  const text = [entry.name, entry.originalName, entry.game, entry.variant, entry.description, mapCategoryLabels?.[entry.category], mapGameLabels?.[mapGameKey(entry)]].filter(Boolean).join(' ').toLocaleLowerCase();
  return state.query.toLocaleLowerCase().trim().split(/\s+/).every((word) => text.includes(word));
}

function renderMapCollectionCard(entry) {
  const collected = mapArchive.mapCollected.has(entry.id);
  const coverHint = ['pubg', 'apex'].includes(mapGameKey(entry)) ? '查看 2D 平面图' : '查看地图';
  return '<article class="mode-card map-collection-card" data-map-id="' + escapeHtml(entry.id) + '">' +
    '<button class="card-cover" type="button" data-map-interactive="' + escapeHtml(entry.id) + '" aria-label="查看 ' + escapeHtml(entry.name) + '地图">' +
    '<img src="' + escapeHtml(entry.thumbnailUrl) + '" alt="' + escapeHtml(entry.name + ' 地图') + '" loading="lazy" width="640" height="346"><span class="cover-shade"></span><span class="cover-game">' + escapeHtml(entry.game) + '</span><span class="cover-badge">' + escapeHtml(coverHint) + '</span></button>' +
    '<div class="card-body"><div class="card-eyebrow"><span class="category-name">地图</span><span class="eyebrow-sep">/</span><span>' + escapeHtml(entry.game) + '</span></div>' +
    '<h3 class="card-title"><button type="button" data-map-interactive="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.name) + '</button></h3>' +
    '<p class="card-summary">' + escapeHtml(entry.description || entry.variant || '地图资料') + '</p>' + (entry.mapSize || entry.supportedModes ? '<p class="map-collection-facts">' + escapeHtml([entry.mapSize ? '规模：' + entry.mapSize : '', entry.supportedModes ? '支持：' + entry.supportedModes : ''].filter(Boolean).join(' · ')) + '</p>' : '') + '<div class="tag-row"><span class="tag">' + escapeHtml(entry.variant || '地图资料') + '</span></div></div>' +
    '<div class="card-bottom"><span>' + icon('map') + '<span>地图资料</span></span><div class="card-bottom-actions"><button class="icon-button ' + (collected ? 'is-collected' : '') + '" type="button" data-action="collect-map" data-map-id="' + escapeHtml(entry.id) + '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + escapeHtml(entry.name) + '" aria-pressed="' + collected + '">' + icon('bookmark') + '</button><button class="card-open" type="button" data-map-interactive="' + escapeHtml(entry.id) + '">查看地图' + icon('arrow-up-right') + '</button></div></div></article>';
}

function renderActivityFeed() {
  const baseModes = state.modes.filter((mode) => matchesLibraryEntry(mode));
  let modes = getSortedModesDescending(baseModes);
  if (state.feedFilter === 'upcoming') modes = modes.filter((mode) => getDayDelta(mode) > 0).reverse();
  if (state.feedFilter === 'recent') modes = modes.filter((mode) => getDayDelta(mode) !== null && getDayDelta(mode) <= 0 && getDayDelta(mode) >= -30);
  if (state.feedFilter === 'ltm') modes = modes.filter((mode) => isLtmMode(mode));
  $('#activityStats').textContent = '匹配 ' + modes.length + ' 条 · 按案例上线日期';
  const shown = modes.slice(0, 24);
  activityFeed.innerHTML = shown.length ? shown.map((mode) => {
    const status = getActivityState(mode);
    return '<article class="activity-card ' + status.className + '"><div class="activity-date"><time datetime="' + escapeHtml(getModeDateValue(mode)) + '">' + escapeHtml(formatActivityDate(mode)) + '</time><span>' + status.label + '</span></div>' +
      '<div class="activity-main"><div class="activity-title-row"><span class="activity-game">' + escapeHtml(mode.game) + '</span><h3>' + escapeHtml(mode.modeName) + '</h3></div><p>' + escapeHtml(mode.oneLineRule) + '</p><div class="activity-tags">' + escapeHtml(getGameplayLabel(mode) + (isLtmMode(mode) ? ' · LTM' : '') + ' · ' + mode.type.slice(0, 2).join(' / ')) + '</div></div>' +
      '<div class="activity-actions"><button data-action="open-mode" data-id="' + escapeHtml(mode.id) + '">查看拆解</button><a href="' + escapeHtml(safeUrl(mode.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + '来源</a></div></article>';
  }).join('') : '<div class="empty-state">' + icon('radio') + '<h3>这个范围内暂无动态</h3><p>可切换「全部动态」，或清除搜索关键词。</p></div>';
  if (modes.length > shown.length) activityFeed.insertAdjacentHTML('beforeend', '<p class="context-note">显示最新 ' + shown.length + ' 条；全部案例可在玩法模式库检索。</p>');
}

function renderWorkspace() {
  if (!state.ready) return;
  updateCounts();
  renderGameFilters();
  const meta = state.view === 'modes' ? (modeViewMeta[state.modeView] || modeViewMeta.library) : (viewMeta[state.view] || viewMeta.modes);
  $('#currentViewLabel').textContent = meta[0];
  $('#pageTitle').innerHTML = escapeHtml(meta[1]);
  $('#pageDescription').textContent = meta[2];
  $('#pageEyeline').textContent = meta[3];
  document.title = '集成农业 · ' + meta[0];
  document.querySelectorAll('[data-view]').forEach((link) => {
    const active = link.dataset.view === state.view;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  const library = ['mechanics', 'levels', 'collection'].includes(state.view) || (state.view === 'modes' && state.modeView === 'library');
  const showActivity = state.view === 'modes' && state.modeView === 'activity';
  const showTimeline = state.view === 'modes' && state.modeView === 'timeline';
  $('#modeViewSwitcher').hidden = state.view !== 'modes';
  document.querySelectorAll('[data-mode-view]').forEach((button) => {
    const active = state.view === 'modes' && button.dataset.modeView === state.modeView;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $('#librarySection').hidden = !library;
  $('#activitySection').hidden = !showActivity;
  $('#timelineSection').hidden = !showTimeline;
  $('#mapsSection').hidden = state.view !== 'maps';
  $('.export-menu').hidden = state.view === 'maps';
  if (library) renderLibrary();
  if (showActivity) renderActivityFeed();
  if (showTimeline) renderTimeline();
  if (state.view === 'maps') renderMapArchive();
}

function resetFilters() {
  state.query = ''; state.topic = 'all'; state.filter = 'all'; state.gameFilter = 'all'; state.gameplayFilter = 'all'; state.limit = 12;
  $('#searchInput').value = ''; $('#topicSelect').value = 'all'; $('#typeSelect').value = 'all';
}

function setNavOpen(open) {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const wasOpen = document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  $('#sidebarOverlay').hidden = !open;
  $('#sidebar').inert = mobile && !open;
  $('.workspace-main').inert = mobile && open;
  $('#menuToggle').setAttribute('aria-expanded', String(open));
  $('#menuToggle').setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  if (open && mobile) $('#sidebar a').focus();
  if (!open && wasOpen && mobile) $('#menuToggle').focus();
}

function readRoute() {
  if (!state.ready) return;
  const [route, query] = location.hash.slice(1).split('?');
  const routeParams = new URLSearchParams(query);
  // Former discovery, activity and timeline links now share the mode library.
  const legacyModeView = route === 'activity' ? 'activity' : route === 'timeline' ? 'timeline' : null;
  const canonicalRoute = route === 'explore' || legacyModeView ? 'modes' : route;
  const view = Object.hasOwn(viewMeta, canonicalRoute) ? canonicalRoute : 'modes';
  const requestedModeView = legacyModeView || routeParams.get('view');
  const modeView = view === 'modes' && ['activity', 'timeline'].includes(requestedModeView) ? requestedModeView : 'library';
  if (route !== canonicalRoute || (view === 'modes' && routeParams.get('view') !== (modeView === 'library' ? null : modeView))) {
    const nextParams = new URLSearchParams(routeParams);
    if (view === 'modes' && modeView !== 'library') nextParams.set('view', modeView); else nextParams.delete('view');
    history.replaceState(null, '', '#' + canonicalRoute + (nextParams.size ? '?' + nextParams.toString() : ''));
  }
  const viewChanged = state.view !== view;
  if (viewChanged) {
    resetFilters();
    state.view = view;
    if (view === 'modes') state.modeView = modeView;
  } else if (view === 'modes') {
    state.modeView = modeView;
  }
  if (view === 'modes' && modeView === 'timeline' && state.gameFilter === 'all') state.gameFilter = getGames()[0] || 'all';
  state.gameplayFilter = gameplayDefinitions.some((item) => item.id === routeParams.get('gameplay')) ? routeParams.get('gameplay') : 'all';
  state.filter = routeParams.get('tag') === 'ltm' && view === 'modes' ? 'ltm' : 'all';
  $('#typeSelect').value = state.filter;
  setNavOpen(false);
  renderWorkspace();
  if (viewChanged) window.scrollTo({ top: 0, behavior: 'instant' });
  const requestedId = new URLSearchParams(query).get('entry');
  if (requestedId && state.entries.some((entry) => entry.id === requestedId)) showDetail(requestedId);
  else if (detailDialog.open) closeDetail(false);
}

function detailButton(entry) {
  const collected = state.collected.has(entry.id);
  return '<button class="button primary" type="button" data-action="collect" data-detail-collect data-id="' + escapeHtml(entry.id) + '" aria-pressed="' + collected + '">' + icon('bookmark') + (collected ? '已收藏' : '收藏资料') + '</button>';
}

function showDetail(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  detailId = id;
  const sourceIds = entry.sourceModeIds || [];
  const related = entry.kind === 'modes'
    ? state.entries.filter((item) => item.sourceModeIds?.includes(id))
    : sourceIds.map((sourceId) => state.entries.find((item) => item.id === sourceId)).filter(Boolean);
  const imageUrl = safeUrl(entry.imageUrl);
  const derived = entry.kind !== 'modes';
  $('#detailContent').innerHTML =
    (imageUrl ? '<img class="detail-cover" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(entry.imageSource || '原案例配图') + '">' : '') +
    '<div class="detail-inner"><div class="detail-kicker">' + kindLabels[entry.kind] + ' / ' + escapeHtml(entry.game) + '</div>' +
    '<h2 id="detailTitle">' + escapeHtml(entry.modeName) + '</h2>' +
    '<div class="detail-meta"><span>' + (derived ? '提炼日期：' + entry.createdAt : '上线：' + (entry.launchLabel || entry.date || entry.year)) + '</span><span>' + (derived ? '基于库内案例 · 分析提炼' : '保留来源与时间备注') + '</span></div>' +
    '<div class="detail-taxonomy"><span>' + (derived ? '关联玩法' : '核心玩法') + '</span>' +
    getGameplayTypes(entry).map((id) => '<span class="gameplay-chip">' + escapeHtml(gameplayDefinitions.find((item) => item.id === id).label) + '</span>').join('') +
    (isLtmMode(entry) ? '<span class="ltm-chip">LTM · 限时模式</span>' : '') + '</div>' +
    '<p class="detail-summary">' + escapeHtml(entry.oneLineRule) + '</p><div class="tag-row">' + entry.type.map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join('') + '</div>' +
    '<div class="detail-insight"><h3>设计观察</h3><p>' + escapeHtml(entry.designObservation) + '</p><small>' + (derived ? '分析提炼，不代表官方结论' : escapeHtml(getAiCommentator(entry))) + '</small></div>' +
    '<div class="detail-section"><h3>' + (derived ? '原案例的机制依据' : '机制变化') + '</h3><p>' + escapeHtml(entry.mechanicChange) + '</p></div>' +
    '<div class="detail-section"><h3>' + (derived ? '原案例的节奏影响' : '节奏影响') + '</h3><p>' + escapeHtml(entry.tempoImpact) + '</p></div>' +
    (related.length ? '<div class="detail-section"><h3>' + (derived ? '关联原案例' : '从这个模式提炼的设计') + '</h3><div class="related-cases">' + related.map((item) =>
      '<button type="button" data-action="open-mode" data-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.modeName) + icon('arrow-up-right') + '</button>').join('') + '</div></div>' : '') +
    '<div class="detail-section"><h3>时间与来源备注</h3><p>' + escapeHtml(entry.launchNote || '时间信息待确认') + '</p>' + (imageUrl ? '<p>配图：' + escapeHtml(entry.imageSource || '原案例配图') + '</p>' : '') + '</div>' +
    '<div class="detail-actions">' + detailButton(entry) +
    '<button class="button" data-action="copy" data-id="' + escapeHtml(entry.id) + '">' + icon('book-open') + '复制 Markdown</button>' +
    '<button class="button" data-action="share" data-id="' + escapeHtml(entry.id) + '">' + icon('arrow-up-right') + '分享图片</button>' +
    (safeUrl(entry.sourceUrl) ? '<a class="button" href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + '查看来源</a>' : '') + '</div></div>';
  if (!detailDialog.open) {
    detailTrigger = document.activeElement;
    detailDialog.showModal();
    document.body.classList.add('modal-open');
  }
  detailDialog.scrollTop = 0;
}

function openDetail(id) {
  const url = workspaceHash(id);
  if (detailDialog.open) history.replaceState(null, '', url); else history.pushState(null, '', url);
  showDetail(id);
}

function closeDetail(updateUrl = true) {
  detailDialog.close(); detailId = null;
  document.body.classList.remove('modal-open');
  if (updateUrl) history.replaceState(null, '', workspaceHash());
  if (detailTrigger?.isConnected) detailTrigger.focus();
}

function updateDetailCollection() {
  if (!detailId) return;
  const entry = state.entries.find((item) => item.id === detailId);
  const button = $('[data-detail-collect]');
  if (button && entry) {
    button.innerHTML = icon('bookmark') + (state.collected.has(entry.id) ? '已收藏' : '收藏资料');
    button.setAttribute('aria-pressed', String(state.collected.has(entry.id)));
  }
}

function bindWorkspaceEvents() {
  $('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    $('#mainContent').focus();
    $('#mainContent').scrollIntoView({ block: 'start' });
  });
  document.querySelectorAll('a[data-view], .brand').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.getAttribute('href') === '#' + state.view && !detailDialog.open) {
        setNavOpen(false);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
  });
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], [data-game], [data-gameplay], [data-layout], [data-mode-view], [data-reset-filters]');
    if (!target) return;
    if (target.hasAttribute('data-reset-filters')) { resetFilters(); syncFilterRoute(); renderWorkspace(); return; }
    if (target.dataset.modeView) {
      state.modeView = target.dataset.modeView;
      state.limit = 12;
      syncFilterRoute();
      renderWorkspace();
      target.focus({ preventScroll: true });
      return;
    }
    if (target.dataset.gameplay) {
      state.gameplayFilter = target.dataset.gameplay; state.limit = 12; syncFilterRoute(); renderLibrary();
      $('#gameplayFilters [aria-pressed="true"]')?.focus({ preventScroll: true }); return;
    }
    if (target.dataset.game) {
      state.gameFilter = target.dataset.game; state.limit = 12; renderWorkspace(); return;
    }
    if (target.dataset.layout) {
      state.layout = target.dataset.layout;
      document.querySelectorAll('[data-layout]').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.layout === state.layout);
        button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout));
      });
      renderLibrary(); return;
    }
    if (target.dataset.action === 'collect-map') {
      toggleMapCollect(target.dataset.mapId);
      return;
    }
    const entry = state.entries.find((item) => item.id === target.dataset.id);
    if (!entry) return;
    if (target.dataset.action === 'open-mode') openDetail(entry.id);
    if (target.dataset.action === 'collect') {
      const restoreId = entry.id;
      const fromDetail = detailDialog.open;
      toggleCollect(entry.id);
      if (!fromDetail) {
        const button = [...document.querySelectorAll('#modeGrid [data-action="collect"]')].find((item) => item.dataset.id === restoreId);
        button?.focus({ preventScroll: true });
      }
    }
    if (target.dataset.action === 'copy') copyModeMarkdown(entry);
    if (target.dataset.action === 'share') {
      if (detailDialog.open) closeDetail();
      openShareModal(entry);
    }
  });
  $('#searchInput').addEventListener('input', (event) => {
    state.query = event.target.value; state.limit = 12;
    if (!['modes', 'mechanics', 'levels', 'collection', 'maps'].includes(state.view)) {
      state.view = 'modes'; state.gameFilter = 'all';
      history.replaceState(null, '', '#modes');
    }
    renderWorkspace();
  });
  $('#topicSelect').addEventListener('change', (event) => { state.topic = event.target.value; state.limit = 12; renderLibrary(); });
  $('#typeSelect').addEventListener('change', (event) => { state.filter = event.target.value; state.limit = 12; syncFilterRoute(); renderLibrary(); });
  $('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; state.limit = 12; renderLibrary(); });
  $('#loadMore').addEventListener('click', () => {
    const previousLimit = state.limit;
    state.limit += 12; renderLibrary();
    const nextButton = modeGrid.querySelectorAll('.card-cover')[previousLimit];
    nextButton?.focus({ preventScroll: true });
  });
  $('#activityTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-feed]');
    if (!button) return;
    state.feedFilter = button.dataset.feed;
    document.querySelectorAll('[data-feed]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    renderActivityFeed();
  });
  $('#menuToggle').addEventListener('click', () => setNavOpen(!document.body.classList.contains('nav-open')));
  $('#sidebarOverlay').addEventListener('click', () => setNavOpen(false));
  $('#exportToggle').addEventListener('click', () => {
    const open = $('#exportOptions').hidden;
    $('#exportOptions').hidden = !open;
    $('#exportToggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#exportToggle')) {
      $('#exportOptions').hidden = true;
      $('#exportToggle').setAttribute('aria-expanded', 'false');
    }
  });
  $('#exportCanvas').addEventListener('click', exportCurrentCanvas);
  $('#exportCollected').addEventListener('click', exportCollectedMarkdown);
  $('#detailClose').addEventListener('click', () => closeDetail());
  detailDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDetail(); });
  detailDialog.addEventListener('click', (event) => { if (event.target === detailDialog) closeDetail(); });
  $('#downloadShareImage').addEventListener('click', downloadActiveShareImage);
  $('#copyShareMarkdown').addEventListener('click', copyActiveShareMarkdown);
  $('#downloadShareMarkdown').addEventListener('click', downloadActiveShareMarkdown);
  document.querySelectorAll('[data-share-close]').forEach((button) => button.addEventListener('click', closeShareModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setNavOpen(false);
      $('#exportOptions').hidden = true;
      $('#exportToggle').setAttribute('aria-expanded', 'false');
      if (!shareModal.hidden) closeShareModal();
    }
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !detailDialog.open && !$('#mapDialog').open && !$('#interactiveMapDialog').open && shareModal.hidden) {
      event.preventDefault(); $('#searchInput').focus();
    }
    if (event.key === 'Tab' && !shareModal.hidden) {
      const nodes = [...shareModal.querySelectorAll('button, a[href]')].filter((node) => !node.closest('[hidden]') && !node.disabled);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !shareModal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !shareModal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });
  modeGrid.addEventListener('error', (event) => {
    if (event.target.tagName !== 'IMG') return;
    const entry = state.entries.find((item) => item.id === event.target.closest('[data-id]')?.dataset.id);
    if (!entry) return;
    const cover = event.target.parentElement;
    cover.querySelector('.cover-shade')?.remove();
    cover.querySelector('.cover-game')?.remove();
    event.target.outerHTML = fallbackCover(entry);
  }, true);
  $('#detailContent').addEventListener('error', (event) => { if (event.target.tagName === 'IMG') event.target.hidden = true; }, true);
  window.addEventListener('hashchange', readRoute);
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => setNavOpen(false));
}

async function initWorkspace() {
  bindWorkspaceEvents();
  initMapArchive();
  try {
    const response = await fetch('data/modes.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('模式资料暂时无法读取');
    const modes = await response.json();
    if (!Array.isArray(modes)) throw new Error('模式资料格式有误');
    state.modes = modes.map((mode) => ({ ...mode, kind: 'modes', type: Array.isArray(mode.type) ? mode.type : [], tags: Array.isArray(mode.tags) ? mode.tags : [] }));
    // Unpublished research stays in local-only and is never fetched by the public app.
    state.entries = [...state.modes];
    state.ready = true;
    $('#topicSelect').insertAdjacentHTML('beforeend', topicDefs.map((topic) => '<option value="' + topic.id + '">' + topic.label + '</option>').join(''));
    $('#typeSelect').insertAdjacentHTML('beforeend', ['ltm'].map((tag) => '<option value="' + tag + '">' + tagLabels[tag] + '</option>').join(''));
    readRoute();
  } catch (error) {
    modeGrid.setAttribute('aria-busy', 'false');
    modeGrid.innerHTML = '<div class="empty-state">' + icon('radio') + '<h3>资料暂时没有加载成功</h3><p>请通过本地服务器访问，或稍后重新加载。</p><button class="button" id="retryLoad">重新加载</button></div>';
    statusLine.textContent = error.message;
    $('#retryLoad').addEventListener('click', () => location.reload());
  }
}
initWorkspace();
