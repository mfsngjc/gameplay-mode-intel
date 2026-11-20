/* Public mode library and map archive; unpublished research remains local. */
const siteName = document.title;
const localMechanicsPreview = new URLSearchParams(location.search).get('preview') === 'mechanics';
const viewMeta = {
  home: ['首页', siteName, '', ''],
  ugc: ['UGC 榜单', 'UGC 创作榜单', '查看四个社区的作品榜单、分类统计和收录目录。', '04 / 社区创作榜单'],
  modes: ['玩法模式', '玩法模式', '收录模式案例与基础局内体验更新，按核心玩法、游戏和更新类别查找资料。', '01 / GAME MODES'],
  games: ['游戏图鉴', '游戏图鉴', '按平台和玩法查找射击游戏，查看玩法、世界观和官方介绍。', 'GAME CATALOG'],
  maps: ['地图', '地图', '收集射击游戏的地图资料，查看空间布局，保存底图并追溯官方来源。', '02 / MAP LIBRARY'],
  items: ['主题道具', '主题与战术道具', '收集游戏内改变行动方式的道具、装备和场景交互物，按功能查找机制、视频与图片资料。', '03 / TACTICAL ITEMS'],
  guns: ['枪械图鉴', '枪械图鉴', '浏览游戏枪械、外观和 3D 模型。', 'WEAPON CATALOG'],
  skins: ['武器外观', '武器外观与检视', '收集枪械与近战皮肤的外观、炫彩和动作视频，保留原始来源，按游戏与武器查找。', '05 / WEAPON COSMETICS'],
  mechanics: ['机制库预览', '地图机制与交互物', '本地预览区：先把局内交互、空间作用和设计观察放在一起试排，尚未发布到公开站点。', 'LOCAL PREVIEW · MECHANICS'],
  collection: ['我的收藏', '我的研究收藏', '收藏值得继续研究的玩法、地图、主题道具与武器外观。', 'YOUR FIELDNOTES']
};
const modeViewMeta = {
  library: viewMeta.modes,
  patches: ['玩法模式', '版本详录', '按公告整理 BR、CS 及通用局内调整，保留具体数值、分期日期和官方配图。', '01 / GAME MODES · PATCH NOTES'],
  activity: ['玩法模式', '玩法动态', '按日期查看模式与基础更新；同一版本的基础更新集中展示，并保留官方来源。', '01 / GAME MODES · DYNAMIC'],
  timeline: ['玩法模式', '时间画板', '按游戏与核心玩法分轨，查看模式案例及基础更新的日期、版本和具体变化。', '01 / GAME MODES · TIMELINE']
};
const kindLabels = { modes: '玩法模式', items: '主题道具', skins: '武器外观', mechanics: '玩法机制', levels: '关卡机制' };
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
  return entryGameplayDefinitions(entry).map(d=>d.label).join(' / ');
}
function isLtmMode(entry) { return entry.kind === 'modes' && !isCoreUpdate(entry) && entry.isLtm === true; }
function getEntryTags(entry) {
  return [...new Set([...entryGameplayDefinitions(entry).map(d=>d.label),
    ...(isCoreUpdate(entry) ? ['基础更新'] : []), ...(isLtmMode(entry) ? ['LTM · 限时模式'] : []), ...entry.type])];
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
function getCardSize() {
  const size = window.CardView?.get?.() || document.body.dataset.cardSize || 'small';
  return size === 'large' ? 'large' : 'small';
}
function syncCardSizeSurfaces() {
  const small = getCardSize() === 'small';
  modeGrid?.classList.toggle('small-view', small && !ModeLibrary.isLibrary());
  document.querySelector('#mapArchiveGrid')?.classList.toggle('small-view', small);
  document.querySelector('#itemGrid')?.classList.toggle('small-view', small);
  window.CardView?.syncControls?.();
}
const detailDialog = $('#detailDialog');
let detailId = null;
let detailTrigger = null;
let entryTitle = '';

function syncDocumentTitle() {
  if (entryTitle) {
    document.title = `${entryTitle} · ${siteName}`;
    return;
  }
  const viewLabel = viewMeta[state.view]?.[0];
  document.title = viewLabel && state.view !== 'modes' ? `${siteName} · ${viewLabel}` : siteName;
}

function setEntryTitle(title = '') {
  entryTitle = title;
  syncDocumentTitle();
}

function entryHash(view, id, extra = {}) {
  return '#' + view + '?' + new URLSearchParams({ ...extra, entry: id }).toString();
}

function shareLinkButton(title, hash, label = '复制分享链接', glyph = 'external-link') {
  return '<button class="button" type="button" data-share-hash="' + escapeHtml(hash) +
    '" data-share-name="' + escapeHtml(title) + '" aria-label="复制 ' + escapeHtml(title) + ' 的分享链接">' +
    icon(glyph) + escapeHtml(label) + '</button>';
}

async function copyEntryLink(title, hash) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = hash;
  const plain = title + '\n' + url.href;
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error();
    const link = '<a href="' + escapeHtml(url.href) + '">' + escapeHtml(title) + '</a>';
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([link], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    })]);
  } catch {
    try { await navigator.clipboard.writeText(plain); }
    catch { window.prompt('复制分享链接', title + ' · ' + url.href); return; }
  }
  showToast('已复制「' + title + '」的分享链接');
}

function safeUrl(value) {
  if (!value) return '';
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
  if (isWeaponSkin(entry)) return WeaponSkins.matchesQuery(entry);
  if (isTacticalItem(entry)) return itemMatchesQuery(entry);
  const text = [entry.modeName, entry.game, entry.oneLineRule, entry.mechanicChange,
    ...globalRuleRows(entry.globalRules).map(rule => [rule.name, rule.english, rule.effect, rule.version, rule.released,
      rule.announced, ...rule.updates.map(update => update.date + ' ' + update.detail)].join(' ')),
    entry.tempoImpact, entry.designObservation, entry.versionLabel, ...(entry.searchAliases || []), entry.tacticalProfile?.role, ...(entry.affectedModes || []), ...(entry.mapNames || []), getContentTypeLabel(entry), ...(entry.type || []),
    kindLabels[entry.kind], getGameplayLabel(entry), isLtmMode(entry) ? 'LTM 限时模式' : '', ...topicIds(entry).map((id) => topicDefs.find((item) => item.id === id)?.label || '')
  ].join(' ').toLocaleLowerCase();
  return state.query.toLocaleLowerCase().trim().split(/\s+/).every((word) => text.includes(word));
}

function matchesLibraryEntry(entry, { ignoreGameplay = false, ignoreGame = false } = {}) {
  if (state.view === 'collection' && state.contentFilter === 'map') return false;
  if (isWeaponSkin(entry)) return state.view === 'collection' && state.collected.has(entry.id) &&
    (ignoreGame || state.gameFilter === 'all' || entry.game === state.gameFilter) &&
    (ignoreGameplay || state.gameplayFilter === 'all') && state.filter === 'all' &&
    ['all', 'skin'].includes(state.contentFilter) && state.updateCategory === 'all' &&
    state.topic === 'all' && WeaponSkins.matchesQuery(entry);
  if (isTacticalItem(entry)) return state.view === 'collection' && state.collected.has(entry.id) &&
    (ignoreGame || state.gameFilter === 'all' || entry.game === state.gameFilter) &&
    (ignoreGameplay || state.gameplayFilter === 'all') && state.filter === 'all' &&
    ['all', 'item'].includes(state.contentFilter) && state.updateCategory === 'all' &&
    (state.topic === 'all' || topicIds(entry).includes(state.topic)) && itemMatchesQuery(entry);
  if (kindLabels[state.view] && entry.kind !== state.view) return false;
  if (state.view === 'timeline' && entry.kind !== 'modes') return false;
  if (state.view === 'collection' && !state.collected.has(entry.id)) return false;
  if (!ignoreGame && state.gameFilter !== 'all' && entry.game !== state.gameFilter) return false;
  if (!ignoreGameplay && !matchesGameplayFilter(entry)) return false;
  if (state.filter === 'ltm' && !isLtmMode(entry)) return false;
  if (state.topic !== 'all' && !topicIds(entry).includes(state.topic)) return false;
  if (!updateMatchesContentFilters(entry)) return false;
  return entryMatchesQuery(entry);
}

function getFilteredEntries() {
  if (state.view === 'skins') return WeaponSkins.filtered();
  if (state.view === 'items') return getFilteredTacticalItems();
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

function getGames() {
  if (state.view === 'collection') return [...new Set(state.entries.map(entry => entry.game))];
  if (state.view === 'items') return [...new Set(itemArchive.entries.map((entry) => entry.game))];
  const source = localMechanicsPreview && state.view === 'mechanics'
    ? state.entries.filter((entry) => entry.kind === 'mechanics')
    : state.modes;
  return [...new Set(source.map((entry) => entry.game))];
}

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
  const scoped = state.entries.filter((entry) => entry.kind === 'modes' && matchesLibraryEntry(entry, { ignoreGameplay: true }));
  $('#gameplayFilters').innerHTML = [{ id: 'all', label: '全部' }, ...currentGameplayDefinitions()].map((definition) => {
    const count = definition.id === 'all' ? scoped.length : scoped.filter((entry) => (state.gameFilter === 'Free Fire' ? getFFPlaylists(entry) : getGameplayTypes(entry)).includes(definition.id)).length;
    return '<button type="button" class="gameplay-filter" data-gameplay="' + definition.id + '" aria-pressed="' + (state.gameplayFilter === definition.id) + '">' +
      escapeHtml(definition.label) + '<small>' + count + '</small></button>';
  }).join('');
}

function workspaceHash(entryId) {
  if (state.view === 'games') return GameCatalog.hash(entryId);
  if (state.view === 'guns') return GunCatalog.hash(entryId);
  if (state.view === 'skins') return WeaponSkins.hash(entryId);
  if (state.view === 'ugc') return UGCMonitor.hash(state.query);
  if (state.view === 'items') return itemHash(entryId);
  const params = new URLSearchParams();
  if (state.view === 'maps' && mapArchive.game !== 'all') params.set('mapGame', mapArchive.game);
  if (state.view === 'maps' && mapArchive.format !== 'all') params.set('mapFormat', mapArchive.format);
  if (state.view === 'modes' && state.modeView !== 'library') params.set('view', state.modeView);
  if (state.gameplayFilter !== 'all') params.set('gameplay', state.gameplayFilter);
  if (state.filter === 'ltm') params.set('tag', 'ltm');
  if (state.gameFilter !== 'all') params.set('game', state.gameFilter);
  if (state.contentFilter !== 'all') params.set('content', state.contentFilter);
  if (state.updateCategory !== 'all') params.set('category', state.updateCategory);
  if (state.query) params.set('q', state.query);
  if (state.topic !== 'all') params.set('topic', state.topic);
  if (state.modeView === 'patches') {
    if (state.patchId) params.set('patch', state.patchId);
    if (state.patchLane && state.patchLane !== 'all') params.set('lane', state.patchLane);
    if (state.patchCategory && state.patchCategory !== 'all') params.set('pcategory', state.patchCategory);
  }
  if (entryId) params.set('entry', entryId);
  return '#' + state.view + (params.size ? '?' + params.toString() : '');
}

function syncFilterRoute() { history.replaceState(null, '', workspaceHash()); }

function updateCounts() {
  const counts = Object.fromEntries(Object.keys(kindLabels).map((kind) => [kind, state.entries.filter((entry) => entry.kind === kind).length]));
  $('#navModeCount').textContent = workspaceDataReady.has('modes') ? counts.modes : '—';
  $('#navGameCatalogCount').textContent = workspaceDataReady.has('games') ? GameCatalog.count() : '—';
  $('#navMapCount').textContent = mapArchive.entries.length || '—';
  $('#navItemCount').textContent = workspaceDataReady.has('items') ? itemArchive.entries.length : '—';
  $('#navGunCount').textContent = workspaceDataReady.has('guns') ? GunCatalog.totalCount() : '—';
  $('#navSkinCount').textContent = WeaponSkins.count() || '—';
  $('#navMechanicsCount').textContent = counts.mechanics || '—';
  $('#navCollectedCount').textContent = state.entries.filter((entry) => state.collected.has(entry.id)).length + (mapArchive.mapCollected?.size || 0);
  if (state.view === 'ugc') {
    $('#librarySummary').textContent = UGCMonitor.hasEntry() ? '作品资料' : UGCMonitor.isCatalog() ? '正在读取目录收录数' : '4 个平台 · 热榜 100 / 历史榜 200';
  } else if (state.view === 'games') {
    $('#librarySummary').textContent = workspaceDataReady.has('games') ? '收录 ' + GameCatalog.count() + ' 款游戏' : '正在读取图鉴';
  } else if (state.view === 'maps') {
    $('#librarySummary').textContent = new Set(mapArchive.entries.map((entry) => entry.game)).size + ' 款游戏 · ' + mapArchive.entries.length + ' 张地图';
  } else if (state.view === 'items') {
    $('#librarySummary').textContent = itemArchive.entries.length + ' 项对象 · ' + itemArchive.categories.length + ' 个分类';
  } else if (state.view === 'guns') {
    $('#librarySummary').textContent = workspaceDataReady.has('guns') ? '收录 ' + GunCatalog.countLabel() : '正在读取枪械图鉴';
  } else if (state.view === 'skins') {
    $('#librarySummary').textContent = WeaponSkins.games.length + ' 款游戏 · ' + WeaponSkins.count().toLocaleString('zh-CN') + ' 款武器外观';
  } else if (state.view === 'collection') {
    $('#librarySummary').textContent = '已收藏 ' + (state.entries.filter(entry => state.collected.has(entry.id)).length +
      (mapArchive.mapCollected?.size || 0)) + ' 份资料';
  } else if (state.view === 'mechanics') {
    $('#librarySummary').textContent = getGames().length + ' 款游戏 · ' + state.entries.filter((entry) => entry.kind === 'mechanics').length + ' 张机制卡';
  } else {
    $('#librarySummary').textContent = getGames().length + ' 款游戏 · ' + summarizeLibrary(state.modes);
  }
}

function fallbackCover(entry) {
  const previewFallback = localMechanicsPreview && entry.kind === 'mechanics';
  return '<span class="cover-fallback"><small>' + (entry.kind === 'modes' ? 'GAMEPLAY ARCHIVE' : entry.kind === 'levels' ? 'SPACE & ENCOUNTERS' : localMechanicsPreview && entry.kind === 'mechanics' ? 'LOCAL MECHANICS PREVIEW' : 'RULES & DECISIONS') +
    '</small><strong>' + escapeHtml(entry.coverHeadline || entry.game).replaceAll('\n', '<br>') +
    '</strong><span>' + (entry.kind === 'modes' ? '暂无案例封面' : previewFallback ? '实机图待补 · 先看机制拆解' : '提炼自 ' + escapeHtml(entry.game)) + '</span></span>';
}

function renderCard(entry) {
  if (isWeaponSkin(entry)) return WeaponSkins.card(entry);
  if (isTacticalItem(entry)) return tacticalCard(entry);
  const collected = state.collected.has(entry.id);
  const isMode = entry.kind === 'modes';
  const imageUrl = isMode || entry.kind === 'levels' || (localMechanicsPreview && entry.kind === 'mechanics') ? safeUrl(entry.imageUrl) : '';
  const upcoming = isMode && entry.launchDateStatus !== 'unverified' && getDayDelta(entry) > 0;
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(entry.launchDate || '') ? formatActivityDate(entry) : (entry.launchLabel || entry.year || '时间待确认');
  return '<article class="mode-card ' + entry.kind + '-card' + (isCoreUpdate(entry) ? ' core-update-card' : '') + '" data-id="' + escapeHtml(entry.id) + '">' +
    '<button class="card-cover ' + (isMode ? '' : 'knowledge-cover') + '" type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '" aria-label="查看 ' + escapeHtml(entry.modeName) + '">' +
    (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(entry.imageSource || entry.modeName + ' 案例配图') + '" loading="lazy" width="640" height="346"><span class="cover-shade"></span><span class="cover-game">' + escapeHtml(entry.game) + '</span>' : fallbackCover(entry)) +
    '<span class="cover-badge ' + (upcoming ? 'upcoming' : '') + '">' + (isCoreUpdate(entry) ? '基础更新' + (entry.effectiveDateStatus === 'scheduled' ? ' · 预告' : '') : upcoming ? '即将上线' : isMode ? '模式案例' : localMechanicsPreview && entry.kind === 'mechanics' ? '本地预览' : '设计提炼') + '</span>' +
    (isLtmMode(entry) ? '<span class="cover-ltm" title="限时模式（LTM）">LTM</span>' : '') + '</button>' +
    '<div class="card-body"><div class="card-eyebrow"><span class="category-name">' + (isMode ? getGameplayLabel(entry) : kindLabels[entry.kind]) + '</span><span class="eyebrow-sep">/</span><span>' + escapeHtml(entry.game) + '</span></div>' +
    '<h3 class="card-title"><button type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.modeName) + '</button></h3>' +
    (isCoreUpdate(entry) ? '<p class="card-image-source">' + escapeHtml(entry.imageScopeLabel || '官方配图') + '</p>' : '') + '<p class="card-summary">' + escapeHtml(entry.oneLineRule) + '</p><div class="tag-row">' + entry.type.slice(0, 3).map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join('') + '</div></div>' +
    '<div class="card-bottom"><span>' + icon(isMode ? 'clock-3' : 'book-open') + '<span>' + (isMode ? escapeHtml(dateLabel) : entry.sourceModeIds.length ? entry.sourceModeIds.length + ' 个关联案例' : '局内交互卡') + '</span></span>' +
    '<div class="card-bottom-actions"><button class="icon-button ' + (collected ? 'is-collected' : '') + '" type="button" data-action="collect" data-id="' + escapeHtml(entry.id) + '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + escapeHtml(entry.modeName) + '" aria-pressed="' + collected + '">' + icon('bookmark') + '</button>' +
    '<button class="card-open" type="button" data-action="open-mode" data-id="' + escapeHtml(entry.id) + '">看拆解' + icon('arrow-up-right') + '</button></div></div></article>';
}

function renderLibrary() {
  if (ModeLibrary.isLibrary()) {
    ModeLibrary.render(getFilteredEntries());
    return;
  }
  const entries = getFilteredEntries();
  const collectedMaps = state.view === 'collection' && ['all', 'map'].includes(state.contentFilter) && state.updateCategory === 'all'
    ? mapArchive.entries.filter(entry => mapArchive.mapCollected.has(entry.id) && mapEntryMatchesQuery(entry)) : [];
  $('#resultsTitle').textContent = state.view === 'collection' ? '已收藏资料' : state.view === 'mechanics' ? '机制卡片预览' : kindLabels[state.view] + '资料';
  $('#resultCount').textContent = entries.length + collectedMaps.length + ' 份';
  $('#sectionAside').textContent = ['mechanics', 'levels'].includes(state.view)
    ? '按关联案例的核心玩法，查找可复用的设计'
    : state.view === 'collection' ? '玩法、地图、道具与武器外观的个人资料夹'
    : state.gameplayFilter === 'all' ? '模式案例与基础更新共同归档，LTM 可独立筛选' : '按核心玩法归档模式案例与基础更新';
  $('#typeField').hidden = state.view === 'mechanics' || state.view === 'levels';
  $('#contextNote').hidden = !['mechanics', 'levels'].includes(state.view);
  $('#contextNote').textContent = localMechanicsPreview && state.view === 'mechanics'
    ? '本地预览区 · 战地六 REDSEC 局内交互物。内容暂不进入公开站点，也不参与定期更新；用于先验证机制库的信息结构和浏览体验。'
    : '以下卡片提炼自已有模式案例，属于设计分析。打开详情可查看原案例与来源。';
  const visible = entries.slice(0, state.limit);
  modeGrid.classList.toggle('small-view', getCardSize() === 'small');
  modeGrid.classList.remove('list-view');
  modeGrid.setAttribute('aria-busy', 'false');
  const emptyMessage = state.view === 'collection' && !state.collected.size && !mapArchive.mapCollected.size
    ? ['还没有收藏', '点选卡片上的书签，留下你想继续研究的玩法、地图和道具。', '<a class="button" href="#modes">浏览玩法模式</a>']
    : ['没有找到匹配的资料', '试试更短的关键词，或清除筛选。', '<button class="button" data-reset-filters>清除筛选</button>'];
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
  renderSharedFilters();
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
    (isCoreUpdate(entry) ? '<p class="card-image-source">' + escapeHtml(entry.imageScopeLabel || '官方配图') + '</p>' : '') + '<p class="card-summary">' + escapeHtml(entry.description || entry.variant || '地图资料') + '</p>' + (entry.mapSize || entry.supportedModes ? '<p class="map-collection-facts">' + escapeHtml([entry.mapSize ? '规模：' + entry.mapSize : '', entry.supportedModes ? '支持：' + entry.supportedModes : ''].filter(Boolean).join(' · ')) + '</p>' : '') + '<div class="tag-row"><span class="tag">' + escapeHtml(entry.variant || '地图资料') + '</span></div></div>' +
    '<div class="card-bottom"><span>' + icon('map') + '<span>地图资料</span></span><div class="card-bottom-actions"><button class="icon-button ' + (collected ? 'is-collected' : '') + '" type="button" data-action="collect-map" data-map-id="' + escapeHtml(entry.id) + '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + escapeHtml(entry.name) + '" aria-pressed="' + collected + '">' + icon('bookmark') + '</button><button class="card-open" type="button" data-map-interactive="' + escapeHtml(entry.id) + '">查看地图' + icon('arrow-up-right') + '</button></div></div></article>';
}

function renderActivityFeed() { renderUnifiedActivityFeed(); }

function currentMetricsRouteKey() {
  return state.view === 'modes' ? 'modes:' + state.modeView : state.view;
}

let workspaceRoutePending = false;
function renderWorkspace({ pending = workspaceRoutePending, entryOnly = false } = {}) {
  if (!state.ready) return;
  ModeLibrary.syncChrome(pending);
  syncCardSizeSurfaces();
  recordPageView(currentMetricsRouteKey());
  document.body.classList.toggle('items-view', state.view === 'items');
  document.body.classList.toggle('skins-view', state.view === 'skins');
  document.body.classList.toggle('ugc-view', state.view === 'ugc');
  document.body.classList.toggle('collection-view', state.view === 'collection');
  document.body.classList.toggle('home-view', state.view === 'home');
  updateCounts();
  const meta = state.view === 'modes' ? (modeViewMeta[state.modeView] || modeViewMeta.library) : (viewMeta[state.view] || viewMeta.modes);
  $('#currentViewLabel').textContent = meta[0];
  $('#pageTitle').innerHTML = escapeHtml(meta[1]);
  $('#pageDescription').textContent = meta[2];
  $('#pageEyeline').textContent = meta[3];
  syncDocumentTitle();
  document.querySelectorAll('[data-view]').forEach((link) => {
    if (pending && link.closest('#siteNavigation')) return;
    const active = link.dataset.view === state.view;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  const library = ['mechanics', 'levels', 'collection'].includes(state.view) || (state.view === 'modes' && state.modeView === 'library');
  const showActivity = state.view === 'modes' && state.modeView === 'activity';
  const showTimeline = state.view === 'modes' && state.modeView === 'timeline';
  if (!pending) document.querySelectorAll('[data-mode-view]').forEach((button) => {
    const active = state.view === 'modes' && button.dataset.modeView === state.modeView;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $('#librarySection').hidden = pending || !library;
  $('#homeSection').hidden = pending || state.view !== 'home';
  $('#collectionDirectory').hidden = pending || state.view !== 'collection';
  $('#activitySection').hidden = pending || !showActivity;
  $('#timelineSection').hidden = pending || !showTimeline;
  $('#gamesSection').hidden = pending || state.view !== 'games';
  $('#mapsSection').hidden = pending || entryOnly || state.view !== 'maps';
  $('#itemsSection').hidden = pending || entryOnly || state.view !== 'items';
  $('#gunsSection').hidden = pending || state.view !== 'guns';
  if (state.view !== 'guns') GunCatalog.closeViewer();
  $('#skinsSection').hidden = pending || state.view !== 'skins';
  $('#ugcSection').hidden = pending || state.view !== 'ugc';
  $('#exportItemsMarkdown').hidden = state.view !== 'items';
  $('#exportSkinsMarkdown').hidden = state.view !== 'skins';
  $('#searchInput').placeholder = ({
    games: '搜索游戏、英文名、玩法…', maps: '搜索地图名、游戏…',
    guns: '搜索枪名、配件、外观…', skins: '搜索外观、武器名…', ugc: '搜索作品、作者、岛屿代码…',
    items: '搜索道具名称或作用…', collection: '搜索我的收藏…', home: '搜索玩法、游戏，按 Enter 查看结果'
  })[state.view] || '搜索玩法、游戏…';
  $('#patchesSection').hidden = pending || !(state.view === 'modes' && state.modeView === 'patches');
  $('.export-menu').hidden = ['home', 'games', 'guns', 'maps', 'ugc'].includes(state.view) || (state.view === 'modes' && state.modeView === 'patches');
  $('#routeStatus').hidden = !pending;
  if (pending) { $('#sharedFilters').hidden = true; return; }
  if (library) renderLibrary();
  if (showActivity) renderActivityFeed();
  if (showTimeline) renderTimeline();
  if (state.view === 'modes' && state.modeView === 'patches') renderFFPatches();
  renderFFPatchLibrary();
  if (state.view === 'games') GameCatalog.render();
  if (state.view === 'guns') GunCatalog.render();
  if (state.view === 'maps' && !entryOnly) renderMapArchive();
  if (state.view === 'items' && !entryOnly) renderTacticalItems();
  if (state.view === 'skins') WeaponSkins.render();
  if (['home', 'games', 'guns', 'maps', 'items', 'skins', 'ugc'].includes(state.view)) $('#sharedFilters').hidden = true;
  else renderSharedFilters();
  if (state.view === 'ugc') UGCMonitor.render(state.query);
}

function resetFilters() {
  GameCatalog.reset();
  resetItemFilters();
  WeaponSkins.reset();
  state.patchId = ''; state.patchLane = 'all'; state.patchCategory = 'all'; state.query = ''; state.topic = 'all'; state.filter = 'all'; state.gameFilter = 'all'; state.gameplayFilter = 'all'; state.contentFilter = 'all'; state.updateCategory = 'all'; state.activityLimit = 24; state.limit = 12;
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

function applyRoute() {
  if (!state.ready) return;
  let [route, query] = location.hash.slice(1).split('?');
  route ||= 'home';
  const routeParams = new URLSearchParams(query);
  const legacyItem = resolveTacticalItem(routeParams.get('entry'));
  const legacyTopic = route === 'modes' && routeParams.get('game') === 'Fortnite' &&
    routeParams.get('content') === 'core_update' && routeParams.get('q') === '战术道具';
  if (legacyTopic || (route === 'modes' && routeParams.get('entry')?.startsWith('fortnite-item-')) ||
      (legacyItem && (route === 'modes' || legacyItem.id !== routeParams.get('entry')))) {
    route = 'items';
    ['view', 'content', 'category', 'gameplay', 'topic', 'tag'].forEach((key) => routeParams.delete(key));
    if (legacyTopic) routeParams.delete('q');
    if (legacyItem) routeParams.set('entry', legacyItem.id);
    query = routeParams.toString();
    history.replaceState(null, '', '#items' + (query ? '?' + query : ''));
  }
  // Former discovery, activity and timeline links now share the mode library.
  const legacyModeView = route === 'activity' ? 'activity' : route === 'timeline' ? 'timeline' : null;
  const requestedRoute = route === 'explore' || legacyModeView ? 'modes' : route;
  const view = Object.hasOwn(viewMeta, requestedRoute) ? requestedRoute : 'modes';
  const canonicalRoute = view;
  const requestedModeView = legacyModeView || routeParams.get('view');
  const modeView = view === 'modes' && ['activity', 'timeline', 'patches'].includes(requestedModeView) ? requestedModeView : 'library';
  if (route !== canonicalRoute || (view === 'modes' && routeParams.get('view') !== (modeView === 'library' ? null : modeView))) {
    const nextParams = new URLSearchParams(routeParams);
    if (view === 'modes' && modeView !== 'library') nextParams.set('view', modeView); else nextParams.delete('view');
    history.replaceState(null, '', '#' + canonicalRoute + (nextParams.size ? '?' + nextParams.toString() : ''));
  }
  const contentChanged = state.view !== view || state.modeView !== modeView || state.patchId !== (routeParams.get('patch') || '');
  const viewChanged = state.view !== view;
  if (viewChanged) {
    resetFilters();
    state.view = view;
    if (view === 'modes') state.modeView = modeView;
  } else if (view === 'modes') {
    state.modeView = modeView;
  }
  state.gameFilter = getGames().includes(routeParams.get('game')) ? routeParams.get('game') : 'all';
  state.contentFilter = Object.hasOwn(contentTypeLabels, routeParams.get('content')) ? routeParams.get('content') : 'all';
  if (view !== 'collection' && ['item', 'skin', 'map'].includes(state.contentFilter)) state.contentFilter = 'all';
  if (view === 'maps') {
    mapArchive.game = Object.hasOwn(mapGameLabels, routeParams.get('mapGame')) ? routeParams.get('mapGame') : 'all';
    mapArchive.format = Object.hasOwn(mapFormatLabels, routeParams.get('mapFormat')) ? routeParams.get('mapFormat') : 'all';
  }
  state.updateCategory = state.contentFilter === 'core_update' && Object.hasOwn(coreUpdateCategories, routeParams.get('category')) ? routeParams.get('category') : 'all';
  state.query = routeParams.get('q') || '';
  state.topic = topicDefs.some((t) => t.id === routeParams.get('topic')) ? routeParams.get('topic') : 'all';
  $('#searchInput').value = state.query; $('#topicSelect').value = state.topic;
  if (view === 'modes' && modeView === 'timeline' && !routeParams.has('game') && state.gameFilter === 'all') state.gameFilter = getGames()[0] || 'all';
  state.gameplayFilter = currentGameplayDefinitions().some((item) => item.id === routeParams.get('gameplay')) ? routeParams.get('gameplay') : 'all';
  state.patchId = routeParams.get('patch') || '';
  state.patchLane = Object.hasOwn(ffPatchLanes, routeParams.get('lane')) ? routeParams.get('lane') : 'all';
  state.patchCategory = Object.hasOwn(ffPatchCategories, routeParams.get('pcategory')) ? routeParams.get('pcategory') : 'all';
  state.filter = routeParams.get('tag') === 'ltm' && view === 'modes' ? 'ltm' : 'all';
  if (view === 'games') GameCatalog.readRoute(routeParams);
  if (view === 'guns') GunCatalog.readRoute(routeParams);
  if (view === 'items') readItemRoute(routeParams);
  if (view === 'skins') WeaponSkins.readRoute(routeParams);
  if (view === 'ugc') UGCMonitor.readRoute(routeParams);
  $('#typeSelect').value = state.filter;
  setNavOpen(false);
  const requestedId = routeParams.get('entry');
  const hasItem = view === 'items' && itemArchive.entries.some(entry => entry.id === requestedId);
  const hasMap = view === 'maps' && mapArchive.entries.some(entry => entry.id === requestedId);
  const detail = requestedId && (view === 'games' ? GameCatalog.find(requestedId) :
    state.entries.find(entry => entry.id === requestedId && (entry.kind === view || view === 'collection')));
  renderWorkspace({ entryOnly: hasItem || hasMap });
  if (['skins', 'collection'].includes(view)) WeaponSkins.ensure();
  if (contentChanged) window.scrollTo({ top: 0, behavior: 'instant' });
  if (view === 'guns') GunCatalog.focusRoute();
  if (detail) showDetail(detail.id);
  else if (detailDialog.open) closeDetail(false);
  if (view === 'items') prepareItemList();
  const mapId = view === 'maps' ? requestedId : view === 'collection' ? routeParams.get('map') : null;
  if (mapId) showMapDetail(mapId, routeParams.get('mapView'));
  if ((view === 'games' && requestedId && !detail) || (view === 'items' && requestedId && !hasItem) ||
      (view === 'maps' && requestedId && !hasMap && !mapArchive.error)) showToast('没有找到该条目');
}

function detailButton(entry) {
  const collected = state.collected.has(entry.id);
  return '<button class="button primary" type="button" data-action="collect" data-detail-collect data-id="' + escapeHtml(entry.id) + '" aria-pressed="' + collected + '">' + icon('bookmark') + (collected ? '已收藏' : '收藏资料') + '</button>';
}

function showWorkspaceDetailDialog(trigger = document.activeElement) {
  if (!detailDialog.open) {
    detailTrigger = trigger;
    detailDialog.showModal();
    document.body.classList.add('modal-open');
  }
  detailDialog.scrollTop = 0;
}

function renderGlobalRules(book) {
  if (!book) return '';
  const link = (label, url) => {
    const href = safeUrl(url);
    return href ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label) + '</a>' : escapeHtml(label);
  };
  const date = (value, url) => '<time datetime="' + escapeHtml(value) + '">' + link(value, url) + '</time>';
  const rules = globalRuleRows(book);
  const rows = rules.map(rule => {
    const changes = rule.updates.map(update =>
      '<li>' + date(update.date, update.url) + ' ' + escapeHtml(update.detail) + '</li>').join('');
    return '<tr><th scope="row" class="rule-name">' + escapeHtml(rule.name) +
      '<span lang="en">' + escapeHtml(rule.english) + '</span></th>' +
      '<td class="rule-effect"><span class="rule-mobile-label" aria-hidden="true">全场效果</span>' + escapeHtml(rule.effect) + '</td>' +
      '<td class="rule-release">' + (rule.released ? date(rule.released) : '') +
      link(rule.version, rule.versionUrl) + (rule.announced ? '<small>' + date(rule.announced) + ' 预告</small>' : '') + '</td>' +
      '<td class="rule-updates' + (changes ? '' : ' rule-updates-empty') + '">' + (changes
        ? '<span class="rule-mobile-label" aria-hidden="true">后续更新</span><ul>' + changes + '</ul>'
        : '—') + '</td></tr>';
  }).join('');
  return '<section class="detail-section global-rules" aria-labelledby="globalRulesTitle">' +
    '<h3 id="globalRulesTitle">玩家可修改的全局规则 <small>' + rules.length + ' 项</small></h3>' +
    '<p class="rule-table-key">热修按美东日期记录。「—」表示暂无单项更新记录。</p>' +
    '<table class="global-rule-table" aria-labelledby="globalRulesTitle"><thead><tr>' +
    '<th scope="col">规则名称</th><th scope="col">全场效果</th><th scope="col">首次开放</th><th scope="col">后续更新</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h4>赛季备注与来源</h4><p>' + escapeHtml(book.intro) + '</p><p>' + escapeHtml(book.note) +
    '</p><p>' + escapeHtml(book.evidenceNote) + '</p><ul class="global-rule-sources">' + book.sources.map(source =>
      '<li>' + link(source.label, source.url) + '</li>').join('') + '</ul></section>';
}

function renderModeIntro(entry, derived, cover) {
  const timing = entry.globalRules?.endDate && entry.launchDate
    ? '赛季时间　' + entry.launchDate + ' 至 ' + entry.globalRules.endDate
    : derived ? '提炼日期：' + entry.createdAt : getModeTimingLabel(entry) + '：' + (entry.launchLabel || entry.date || entry.year);
  const heading = '<div class="detail-kicker">' + kindLabels[entry.kind] + ' / ' + escapeHtml(entry.game) + '</div>' +
    '<h2 id="detailTitle">' + escapeHtml(entry.modeName) + '</h2>' +
    '<div class="detail-meta"><span>' + escapeHtml(timing) + '</span>' +
    (entry.globalRules ? '' : '<span>' + (derived ? (entry.sourceModeIds?.length ? '基于库内案例 · 分析提炼' : '本地预览 · 尚未关联模式卡') : '保留来源与时间备注') + '</span>') + '</div>' +
    '<div class="detail-taxonomy"><span>' + (derived ? '关联玩法' : '核心玩法') + '</span>' +
    entryGameplayDefinitions(entry).map((d) => '<span class="gameplay-chip">' + escapeHtml(d.label) + '</span>').join('') +
    (isLtmMode(entry) ? '<span class="ltm-chip">LTM · 限时模式</span>' : '') + '</div>' +
    '<p class="detail-summary">' + escapeHtml(entry.oneLineRule) + '</p><div class="tag-row">' + entry.type.map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join('') + '</div>';
  return entry.globalRules ? '<div class="rulebook-overview">' + cover + heading + '</div>' : heading;
}

function showDetail(id, trigger) {
  const gameDetail = state.view === 'games';
  const entry = gameDetail ? GameCatalog.find(id) : state.entries.find((item) => item.id === id);
  if (!entry) return;
  if (entry.kind === 'modes') recordModeView(entry.id);
  detailId = id;
  setEntryTitle(gameDetail ? entry.name : entry.modeName);
  const closeLabel = state.view === 'items' ? '返回道具清单' : '关闭详情';
  $('#detailClose').setAttribute('aria-label', closeLabel);
  $('#detailClose').title = closeLabel;
  const sourceIds = entry.sourceModeIds || [];
  const related = entry.kind === 'modes'
    ? state.entries.filter((item) => item.sourceModeIds?.includes(id))
    : sourceIds.map((sourceId) => state.entries.find((item) => item.id === sourceId)).filter(Boolean);
  const imageUrl = safeUrl(entry.imageUrl);
  const cover = imageUrl ? '<img class="detail-cover" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(entry.imageSource || '原案例配图') + '">' : '';
  const derived = entry.kind !== 'modes';
  if (typeof ItemDemos !== 'undefined') ItemDemos.stop(detailDialog);
  WeaponSkins.stop(detailDialog);
  $('#detailContent').innerHTML = gameDetail ? GameCatalog.detail(entry) :
    isWeaponSkin(entry) ? WeaponSkins.detail(entry) : isTacticalItem(entry) ? tacticalItemDetail(entry) : isCoreUpdate(entry) ? coreUpdateDetail(entry) :
    (entry.globalRules ? '' : cover) + '<div class="detail-inner">' + renderModeIntro(entry, derived, cover) +
    renderGlobalRules(entry.globalRules) +
    '<div class="detail-insight"><h3>设计观察</h3><p>' + escapeHtml(entry.designObservation) + '</p><small>' + (derived ? '分析提炼，不代表官方结论' : escapeHtml(getAiCommentator(entry))) + '</small></div>' +
    '<div class="detail-section"><h3>' + (derived ? (entry.sourceModeIds?.length ? '原案例的机制依据' : '交互流程') : '机制变化') + '</h3><p>' + escapeHtml(entry.mechanicChange) + '</p></div>' +
    '<div class="detail-section"><h3>' + (derived ? '原案例的节奏影响' : '节奏影响') + '</h3><p>' + escapeHtml(entry.tempoImpact) + '</p></div>' +
    (related.length ? '<div class="detail-section"><h3>' + (derived ? '关联原案例' : '关联基础更新与设计资料') + '</h3><div class="related-cases">' + related.map((item) =>
      '<button type="button" data-action="open-mode" data-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.modeName) + icon('arrow-up-right') + '</button>').join('') + '</div></div>' : '') +
    '<div class="detail-section"><h3>时间与来源备注</h3><p>' + escapeHtml(entry.launchNote || '时间信息待确认') + '</p>' + (imageUrl ? '<p>配图：' + escapeHtml(entry.imageSource || '原案例配图') + '</p>' : '') + '</div>' +
    '<div class="detail-actions">' + ffRelatedPatchLink(entry) + detailButton(entry) +
    '<button class="button" data-action="copy" data-id="' + escapeHtml(entry.id) + '">' + icon('book-open') + '复制 Markdown</button>' +
    '<button class="button" data-action="share" data-id="' + escapeHtml(entry.id) + '">' + icon('arrow-up-right') + '分享图片</button>' +
    (safeUrl(entry.sourceUrl) ? '<a class="button" href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + '查看来源</a>' : '') + '</div></div>';
  if (['modes', 'items', 'skins'].includes(entry.kind)) {
    $('#detailContent .detail-actions')?.insertAdjacentHTML('beforeend', shareLinkButton(entry.modeName, entryHash(entry.kind, entry.id)));
  }
  ModeLibrary.addGroupBack();
  showWorkspaceDetailDialog(trigger);
  if (gameDetail) {
    GameCatalog.mountDetail(entry);
    GameCatalog.refreshOnline(entry);
  }
  if (isTacticalItem(entry) && entry.coreUpdateIds.length && !workspaceDataReady.has('coreUpdates')) loadItemDetailVersions(entry);
}

function openDetail(id, trigger) {
  const url = workspaceHash(id);
  const fromDetail = detailDialog.open && detailDialog.contains(trigger || document.activeElement);
  if (detailDialog.open && detailId) history.replaceState(null, '', url); else history.pushState(null, '', url);
  showDetail(id, trigger);
  if (fromDetail) $('#detailClose').focus({ preventScroll: true });
}

function closeDetail(updateUrl = true) {
  if (typeof ItemDemos !== 'undefined') ItemDemos.stop(detailDialog);
  WeaponSkins.stop(detailDialog);
  if (state.view === 'games') GameCatalog.clearDetail();
  detailDialog.close(); detailId = null;
  ModeLibrary.clearGroup();
  document.body.classList.remove('modal-open');
  if (updateUrl) {
    setEntryTitle();
    history.replaceState(null, '', workspaceHash());
    if (state.view === 'items') revealItemList();
  }
  if (detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true });
  detailTrigger = null;
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
  activityFeed.addEventListener('error', event => {
    if (event.target.matches('img')) (event.target.closest('.activity-media') || event.target).remove();
  }, true);
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
    if (event.defaultPrevented) return;
    const share = event.target.closest('[data-share-hash]');
    if (share) { copyEntryLink(share.dataset.shareName, share.dataset.shareHash); return; }
    const target = event.target.closest(
      '[data-action], [data-game], [data-gameplay], [data-mode-view], [data-reset-filters], [data-timeline-group], [data-load-activity], ' +
      'button:is([data-mode-theme], [data-mode-layout], [data-mode-kind], [data-mode-update-group], [data-mode-group-back], [data-mode-recent-index])'
    ) || ModeLibrary.clickTarget(event);
    if (!target) return;
    if (ModeLibrary.handleClick(target)) return;
    if (target.hasAttribute('data-load-activity')) { state.activityLimit += 24; renderActivityFeed(); return; }
    if (target.hasAttribute('data-timeline-group')) {
      const row = document.getElementById('timeline-group-' + target.dataset.timelineGroup);
      const details = row?.querySelector('details'); if (details) details.open = true;
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' }); row?.querySelector('summary')?.focus({ preventScroll: true }); return;
    }
    if (target.hasAttribute('data-reset-filters')) {
      resetFilters(); syncFilterRoute(); renderWorkspace();
      if (ModeLibrary.isLibrary()) $('#modeGameSelect').focus({ preventScroll: true });
      if (state.view === 'collection') $('#searchInput').focus({ preventScroll: true });
      return;
    }
    if (target.dataset.modeView) {
      state.modeView = target.dataset.modeView;
      state.limit = 12;
      syncFilterRoute();
      renderWorkspace();
      target.focus({ preventScroll: true });
      return;
    }
    if (target.dataset.gameplay) {
      state.gameplayFilter = target.dataset.gameplay; state.limit = 12; syncFilterRoute(); renderWorkspace();
      $('#gameplayFilters [aria-pressed="true"]')?.focus({ preventScroll: true }); return;
    }
    if (target.dataset.game) {
      state.gameFilter = target.dataset.game; if (!currentGameplayDefinitions().some(d=>d.id===state.gameplayFilter)) state.gameplayFilter='all'; state.limit = 12; syncFilterRoute(); renderWorkspace(); return;
    }
    if (target.dataset.action === 'collect-map') {
      toggleMapCollect(target.dataset.mapId);
      return;
    }
    const entry = state.entries.find((item) => item.id === target.dataset.id);
    if (!entry) return;
    if (['open-mode', 'open-item', 'open-skin'].includes(target.dataset.action)) openDetail(entry.id, target);
    if (target.dataset.action === 'collect') {
      const restoreId = entry.id;
      const fromDetail = detailDialog.open;
      toggleCollect(entry.id);
      if (!fromDetail) {
        const button = [...document.querySelectorAll('#modeGrid [data-action="collect"], #itemGrid [data-action="collect"], #skinGrid [data-action="collect"]')].find((item) => item.dataset.id === restoreId);
        button?.focus({ preventScroll: true });
      }
    }
    if (target.dataset.action === 'copy') copyDetailMarkdown(entry);
    if (target.dataset.action === 'share') {
      if (detailDialog.open) closeDetail();
      openShareModal(entry);
    }
  });
  function searchWorkspace(event) {
    if (event.isComposing || state.view === 'home') return;
    if ($('#searchInput').value !== event.target.value) $('#searchInput').value = event.target.value;
    if (state.view === 'guns') GunCatalog.clearEntry();
    state.query = event.target.value; state.limit = 12; itemArchive.limit = 24; WeaponSkins.archive.limit = 24; syncFilterRoute();
    if (!['modes', 'mechanics', 'levels', 'collection', 'games', 'guns', 'maps', 'items', 'skins', 'ugc'].includes(state.view)) {
      state.view = 'modes'; state.gameFilter = 'all';
      history.replaceState(null, '', '#modes');
    }
    renderWorkspace();
  }
  for (const input of [$('#searchInput'), $('#modeSearchInput')]) {
    input.addEventListener('input', searchWorkspace);
    input.addEventListener('compositionend', searchWorkspace);
  }
  $('#searchInput').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || state.view !== 'home') return;
    const query = event.currentTarget.value.trim();
    if (query) location.hash = '#modes?' + new URLSearchParams({ q: query });
  });
  function chooseContentType(value) {
    state.contentFilter = value; state.updateCategory = 'all';
    if (state.view === 'collection' || state.contentFilter === 'core_update') {
      state.filter = 'all'; state.feedFilter = 'all'; $('#typeSelect').value = 'all';
    }
    if (state.view === 'collection') {
      state.gameFilter = 'all'; state.gameplayFilter = 'all'; state.topic = 'all'; $('#topicSelect').value = 'all';
    }
    state.limit = 12; syncFilterRoute(); renderWorkspace();
  }
  $('#contentTypeSelect').addEventListener('change', event => chooseContentType(event.target.value));
  $('#collectionDirectoryFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-collection-kind]');
    if (!button) return;
    chooseContentType(button.dataset.collectionKind);
    $('#collectionDirectoryFilters [aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  $('#updateCategorySelect').addEventListener('change', (event) => { state.updateCategory = event.target.value; state.limit = 12; syncFilterRoute(); renderWorkspace(); });
  $('#topicSelect').addEventListener('change', (event) => { state.topic = event.target.value; state.limit = 12; syncFilterRoute(); renderWorkspace(); });
  $('#typeSelect').addEventListener('change', (event) => { state.filter = event.target.value; state.limit = 12; syncFilterRoute(); renderWorkspace(); });
  $('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; state.limit = 12; renderLibrary(); });
  $('#loadMore').addEventListener('click', () => {
    const previousLimit = state.limit;
    state.limit += 12; renderLibrary();
    const nextButton = modeGrid.querySelectorAll(ModeLibrary.isLibrary() ? '.mode-card-detail' : '.card-cover')[previousLimit];
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
  let pressedOnBackdrop = false;
  function hitsBackdrop(event) {
    if (event.target !== detailDialog) return false;
    const { left, right, top, bottom } = detailDialog.getBoundingClientRect();
    return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
  }
  detailDialog.addEventListener('pointerdown', event => {
    pressedOnBackdrop = event.isPrimary && event.button === 0 && hitsBackdrop(event);
  });
  for (const type of ['pointercancel', 'close']) {
    detailDialog.addEventListener(type, () => { pressedOnBackdrop = false; });
  }
  detailDialog.addEventListener('click', event => {
    const dismiss = pressedOnBackdrop && hitsBackdrop(event);
    pressedOnBackdrop = false;
    if (dismiss) closeDetail();
  });
  $('#downloadShareImage').addEventListener('click', downloadActiveShareImage);
  $('#copyShareMarkdown').addEventListener('click', copyActiveShareMarkdown);
  $('#downloadShareMarkdown').addEventListener('click', downloadActiveShareMarkdown);
  document.querySelectorAll('[data-share-close]').forEach((button) => button.addEventListener('click', closeShareModal));
  document.addEventListener('keydown', (event) => {
    if (['Enter', ' '].includes(event.key) && event.target.matches('.canvas-node[role="button"]')) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    if (event.key === 'Escape') {
      setNavOpen(false);
      $('#exportOptions').hidden = true;
      $('#exportToggle').setAttribute('aria-expanded', 'false');
      if (!shareModal.hidden) closeShareModal();
    }
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !detailDialog.open && !$('#mapDialog').open && !$('#interactiveMapDialog').open && shareModal.hidden) {
      event.preventDefault(); (ModeLibrary.isLibrary() ? $('#modeSearchInput') : $('#searchInput')).focus();
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
    if (handleTacticalImageError(event)) return;
    if (event.target.tagName !== 'IMG') return;
    const modeCover = event.target.closest('.mode-library-cover');
    if (modeCover) {
      modeCover.classList.remove('has-image');
      event.target.hidden = true;
      return;
    }
    const entry = state.entries.find((item) => item.id === event.target.closest('[data-id]')?.dataset.id);
    if (!entry) return;
    const cover = event.target.parentElement;
    cover.querySelector('.cover-shade')?.remove();
    cover.querySelector('.cover-game')?.remove();
    event.target.outerHTML = fallbackCover(entry);
  }, true);
  $('#detailContent').addEventListener('error', (event) => {
    if (!handleTacticalImageError(event) && event.target.tagName === 'IMG' && !event.target.closest('.weapon-detail-art')) event.target.hidden = true;
  }, true);
  window.addEventListener('hashchange', readRoute);
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => setNavOpen(false));
}

const workspaceData = new Map();
const workspaceDataReady = new Set();
let routeSequence = 0;

function loadWorkspaceData(key, load) {
  if (!workspaceData.has(key)) {
    const request = Promise.resolve().then(load).then(() => { workspaceDataReady.add(key); })
      .catch(error => { workspaceData.delete(key); throw error; });
    workspaceData.set(key, request);
  }
  return workspaceData.get(key);
}

async function workspaceJSON(path, label, array = true, priority = 'auto') {
  const response = await fetch(path, { cache: 'no-cache', priority });
  if (!response.ok) throw new Error(label + '暂时无法读取');
  const data = await response.json();
  if (array && !Array.isArray(data)) throw new Error(label + '格式有误');
  return data;
}

async function gameCatalogSnapshot(path, label) {
  if (document.documentElement.dataset.gameCatalogEncoding !== 'gzip') {
    return workspaceJSON(path, label, false);
  }
  const response = await fetch(path + '.gz', { cache: 'no-cache' });
  if (!response.ok) throw new Error(label + '暂时无法读取');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

let steamPlayerHistoryRequest;
function loadSteamPlayerHistory() {
  steamPlayerHistoryRequest ??= gameCatalogSnapshot('data/steam-player-history.json', 'Steam 在线历史').catch(error => {
    steamPlayerHistoryRequest = undefined;
    throw error;
  });
  return steamPlayerHistoryRequest;
}

function ensureItems() {
  return loadWorkspaceData('items', async () => {
    loadTacticalCatalogue(await workspaceJSON('data/tactical-items.json', '主题道具资料', false));
    state.entries.push(...itemArchive.entries);
  });
}

let modeRecordsRequest;
function loadModeRecords(priority) {
  modeRecordsRequest ||= workspaceJSON('data/modes.json', '模式资料', true, priority).catch(error => {
    modeRecordsRequest = undefined;
    throw error;
  });
  return modeRecordsRequest;
}

async function loadHomeFeatured(modes) {
  const carousel = $('#homeFeatured');
  if (!carousel.hidden) return;
  await ensureCoreUpdates('low').catch(() => {});
  if (!carousel.hidden) return;
  const changes = modeCoreUpdates().filter(entry => ['addition', 'rework'].includes(entry.changeType) &&
    entry.imageStatus === 'verified_official' && ['specific', 'section'].includes(entry.imageScope));
  const candidates = [...modes, ...changes].filter(entry => {
    const days = getDayDelta(entry);
    return entry.publicationStatus === 'ready' &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.launchDate || '') && !['scheduled', 'unverified'].includes(entry.launchDateStatus) &&
      days >= -45 && days <= 0 && safeUrl(entry.imageUrl) &&
      !/通用配图|未展示主题/.test(entry.imageSource || '') &&
      !entry.imageUrl.includes('/generated/') && !entry.imageUrl.toLowerCase().endsWith('.svg');
  }).sort((a, b) => b.launchDate.localeCompare(a.launchDate));
  const slides = [...new Set(candidates.map(entry => entry.game))].slice(0, 4)
    .map(game => candidates.find(entry => entry.game === game));
  if (!slides.length) return;
  const slide = $('#homeFeaturedSlide');
  const home = $('#homeSection');
  const controls = carousel.querySelector('.home-featured-controls');
  const position = $('#homeFeaturedPosition');
  const progress = carousel.querySelector('.home-featured-progress');
  const toggle = $('#homeFeaturedToggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const interval = 7000;
  let selected = 0;
  let autoplay = !reducedMotion.matches;
  let inView = false;
  let hovered = false;
  let reading = false;
  let countdown;

  function renderSlide(step = 0) {
    const entry = slides[selected];
    const href = '#modes?entry=' + encodeURIComponent(entry.id);
    slide.dataset.direction = step < 0 ? 'previous' : step > 0 ? 'next' : '';
    slide.innerHTML = '<a class="home-featured-media" href="' + href + '" aria-label="' + escapeHtml(entry.modeName) + '">' +
      '<img src="' + escapeHtml(safeUrl(entry.thumbnailUrl || entry.imageUrl)) + '" alt="" decoding="async"></a>' +
      '<div class="home-featured-copy"><div class="home-featured-meta"><span>' + escapeHtml(entry.game) + '</span><time datetime="' +
      entry.launchDate + '">' + entry.launchDate + '</time></div><h4><a href="' + href + '">' + escapeHtml(entry.modeName) +
      '</a></h4><p>' + escapeHtml(entry.summary || entry.oneLineRule || '') + '</p><a class="home-featured-link" href="' + href + '">查看玩法详情 <span aria-hidden="true">→</span></a></div>';
    slide.querySelector('img').addEventListener('error', event => event.target.remove(), { once: true });
    position.textContent = (selected + 1) + ' / ' + slides.length;
  }

  function canPlay() {
    return autoplay && inView && !hovered && !reading && !document.hidden && !home.hidden;
  }

  function syncPlayback() {
    if (!canPlay()) {
      countdown?.pause();
      return;
    }
    if (!countdown) {
      countdown = progress.firstElementChild.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: interval, fill: 'forwards' },
      );
      countdown.onfinish = () => {
        if (canPlay()) advance(1);
      };
    }
    countdown.play();
  }

  function advance(step, announce = false) {
    countdown?.cancel();
    countdown = undefined;
    selected = (selected + step + slides.length) % slides.length;
    renderSlide(step);
    if (announce) $('#homeFeaturedStatus').textContent = '第 ' + (selected + 1) + ' 条，共 ' + slides.length + ' 条。' + slides[selected].modeName;
    syncPlayback();
  }

  function updateToggle() {
    const label = autoplay ? '暂停自动轮播' : '开启自动轮播';
    toggle.dataset.playing = String(autoplay);
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    syncPlayback();
  }

  controls.hidden = slides.length < 2;
  progress.hidden = controls.hidden;
  renderSlide();
  carousel.hidden = false;
  if (controls.hidden) return;

  controls.querySelectorAll('[data-feature-step]').forEach(button => button.addEventListener('click', () => {
    advance(Number(button.dataset.featureStep), true);
  }));
  toggle.addEventListener('click', () => {
    autoplay = !autoplay;
    updateToggle();
  });
  carousel.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    syncPlayback();
  });
  carousel.addEventListener('pointerleave', () => {
    hovered = false;
    syncPlayback();
  });
  carousel.addEventListener('focusin', event => {
    reading = event.target !== toggle;
    syncPlayback();
  });
  carousel.addEventListener('focusout', event => {
    if (carousel.contains(event.relatedTarget)) return;
    reading = false;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', event => {
    autoplay = !event.matches;
    updateToggle();
  });
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.intersectionRatio >= 0.25;
    if (!inView) hovered = false;
    syncPlayback();
  }, { threshold: 0.25 });
  observer.observe(carousel);
  updateToggle();
}

async function loadHomeGameUpdates() {
  const list = $('#homeGameUpdates');
  if (!list.hidden) return;
  const status = $('#homeGameUpdatesStatus');
  status.textContent = '正在读取近期玩法…';
  try {
    const modes = await loadModeRecords('low');
    loadHomeFeatured(modes);
    const recent = modes.filter(mode => {
      if ((mode.publicationStatus && mode.publicationStatus !== 'ready') || mode.launchDateStatus === 'unverified') return false;
      const date = mode.launchDateStatus === 'scheduled' ? mode.scheduledLaunchDate : mode.launchDate;
      return /^\d{4}-\d{2}-\d{2}$/.test(date || '');
    }).sort((a, b) => getDateSortValue(b) - getDateSortValue(a)).slice(0, 4);
    list.innerHTML = recent.map(mode => {
      const date = getModeDateValue(mode);
      const schedule = mode.launchDateStatus === 'scheduled';
      const upcoming = getDayDelta(mode) > 0;
      const timing = upcoming ? '预定开放' : schedule ? '开放待核实' : '上线';
      const dateLabel = (schedule && !upcoming ? '原定 ' : '') + date.replaceAll('-', '.');
      const href = '#modes?entry=' + encodeURIComponent(mode.id);
      return `<li class="home-game-update">
        <a href="${href}">${escapeHtml(mode.game)} · ${escapeHtml(mode.modeName)}</a>
        <span class="home-update-timing"><time datetime="${date}">${dateLabel}</time> ${timing}</span>
      </li>`;
    }).join('');
    status.textContent = recent.length ? '' : '暂无可展示的近期玩法。';
    list.hidden = false;
  } catch {
    status.textContent = '近期玩法暂时无法读取。';
  }
}

function ensureCoreUpdates(priority) {
  return loadWorkspaceData('coreUpdates', async () => {
    const updates = await workspaceJSON('data/core-updates.json', '基础更新资料', true, priority);
    state.coreUpdates = updates.map(normalizeCoreUpdate);
  });
}

function revealItemList() {
  const section = $('#itemsSection');
  if (!section.hidden) return;
  renderTacticalItems();
  section.hidden = false;
}

function prepareItemList() {
  const request = routeSequence;
  const isCurrent = () => request === routeSequence && state.view === 'items' && !workspaceRoutePending;
  // Let the detail paint first. Its modal keeps the prepared list inert underneath.
  requestAnimationFrame(() => setTimeout(async () => {
    if (!isCurrent()) return;
    revealItemList();
    if (workspaceDataReady.has('coreUpdates')) return;
    try { await ensureCoreUpdates('low'); } catch { return; }
    const active = document.activeElement;
    if (isCurrent() && (state.query || $('#itemGrid .has-dossier')) &&
        !active?.closest('#itemGrid, .items-filter-panel')) renderTacticalItems();
  }, 0));
}

async function loadItemDetailVersions(entry) {
  const host = $('#itemVersionDetails');
  if (!host) return;
  host.innerHTML = tacticalItemVersionDetail(entry);
  try {
    await ensureCoreUpdates();
    if (host.isConnected && detailDialog.open) host.innerHTML = tacticalItemVersionDetail(entry);
  } catch {
    if (!host.isConnected || !detailDialog.open) return;
    host.innerHTML = '<p class="item-detail-note" role="status">历史版本详录暂时无法读取。</p><button type="button" class="button">重试</button>';
    host.querySelector('button').addEventListener('click', () => loadItemDetailVersions(entry));
  }
}

async function copyDetailMarkdown(entry) {
  if (isTacticalItem(entry) && entry.coreUpdateIds.length) {
    try { await ensureCoreUpdates(); }
    catch { showToast('版本详录暂时无法读取，请重试复制'); return; }
  }
  copyModeMarkdown(entry);
}

function ensureModes() {
  return loadWorkspaceData('modes', async () => {
    const [modes, patches] = await Promise.all([
      loadModeRecords(),
      workspaceJSON('data/free-fire-patches.json', '版本详录'),
      ensureItems(), ensureCoreUpdates()
    ]);
    state.modes = modes.map(mode => ({ ...mode, kind: 'modes', type: Array.isArray(mode.type) ? mode.type : [], tags: Array.isArray(mode.tags) ? mode.tags : [] }));
    state.modes.push(...modeCoreUpdates());
    state.entries.unshift(...state.modes);
    state.ffPatches = patches.filter(patch => patch.publicationStatus === 'ready');
  });
}

function ensureMechanics() {
  return loadWorkspaceData('mechanics', async () => {
    const [mechanics] = await Promise.all([workspaceJSON('local-only/mechanics-preview.json', '本地机制预览资料'), ensureModes()]);
    state.entries.push(...mechanics.map(entry => ({
      ...entry, kind: 'mechanics', type: Array.isArray(entry.type) ? entry.type : [],
      tags: Array.isArray(entry.tags) ? entry.tags : [], sourceModeIds: Array.isArray(entry.sourceModeIds) ? entry.sourceModeIds : []
    })));
  });
}

async function readRoute() {
  const request = ++routeSequence;
  const [route, query] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const id = params.get('entry') || '';
  if (route === 'items' && !id && state.view === 'items' && !workspaceRoutePending && detailDialog.open && location.hash === itemHash()) {
    setEntryTitle();
    closeDetail(false);
    revealItemList();
    prepareItemList();
    return;
  }
  const oldItemRoute = route === 'modes' && (id.startsWith('fortnite-item-') ||
    (params.get('game') === 'Fortnite' && params.get('content') === 'core_update' && params.get('q') === '战术道具'));
  const requestedView = oldItemRoute ? 'items' : route || 'home';
  const view = Object.hasOwn(viewMeta, requestedView) && (requestedView !== 'mechanics' || localMechanicsPreview) ? requestedView : 'modes';
  if (route === 'mechanics' && !localMechanicsPreview) history.replaceState(null, '', '#modes');
  const requestedModeView = ['activity', 'timeline'].includes(route) ? route : params.get('view');
  const modeView = view === 'modes' && ['activity', 'timeline', 'patches'].includes(requestedModeView) ? requestedModeView : 'library';
  setEntryTitle();
  closeOpenMap(false);
  if (detailDialog.open && (!id || id !== detailId)) closeDetail(false);
  if (state.view === 'ugc' && view !== 'ugc') UGCMonitor.cancel();
  const loaded = view === 'maps' ? !mapArchive.loading : ['home', 'ugc', 'skins'].includes(view) || workspaceDataReady.has(view);
  if (!loaded) {
    if (state.view !== view || state.modeView !== modeView) {
      resetFilters();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    state.view = view;
    state.modeView = modeView;
    setNavOpen(false);
    workspaceRoutePending = true;
    $('#routeStatus').textContent = '正在读取' + viewMeta[view][0] + '…';
    renderWorkspace();
  }
  try {
    if (view === 'games') await loadWorkspaceData('games', async () => {
      const [games, media, metrics, charts, activity, updatesZh] = await Promise.all([
        workspaceJSON('data/shooter-games.json', '游戏图鉴资料', false),
        gameCatalogSnapshot('data/shooter-game-media.json', '游戏宣传图').catch(() => ({})),
        gameCatalogSnapshot('data/shooter-game-metrics.json', '游戏指标').catch(() => ({})),
        workspaceJSON('data/steam-charts.json', 'Steam 榜单', false).catch(() => ({})),
        loadSteamPlayerHistory().catch(() => ({})),
        workspaceJSON('data/shooter-game-updates-zh.json', '中文更新公告', false).catch(() => ({}))
      ]);
      SteamActivity.setData(activity, updatesZh);
      GameCatalog.setData(games, media.games, metrics.games, charts);
    });
    if (view === 'guns') await loadWorkspaceData('guns', async () => {
      const catalogues = await Promise.all([
        workspaceJSON('data/gun-catalog.json', '战地风云 6 枪械资料', false),
        workspaceJSON('data/gun-catalog-valorant.json', '瓦洛兰特枪械资料', false),
        workspaceJSON('data/gun-catalog-cod-mw4.json', '现代战争 4 武器资料', false)
      ]);
      GunCatalog.setData(catalogues);
    });
    if (view === 'items') await ensureItems();
    if (view === 'modes') await ensureModes();
    if (view === 'mechanics') await ensureMechanics();
    if (view === 'maps') await loadMapArchive();
    if (view === 'collection') await loadWorkspaceData('collection', () => Promise.all([ensureModes(), loadMapArchive()]));
    if (request !== routeSequence) return;
    workspaceRoutePending = false;
    applyRoute();
    if (view === 'home') loadHomeGameUpdates();
  } catch (error) {
    if (request !== routeSequence) return;
    const status = $('#routeStatus');
    status.textContent = error.message + '。';
    const retry = document.createElement('button');
    retry.className = 'button'; retry.type = 'button'; retry.textContent = '重试';
    retry.addEventListener('click', readRoute);
    status.append(' ', retry);
  }
}

function initWorkspace() {
  window.CardView?.subscribe?.(() => syncCardSizeSurfaces());
  syncCardSizeSurfaces();
  bindWorkspaceEvents();
  CatalogueNavigation.bind();
  ModeLibrary.bind();
  GameCatalog.bind();
  GunCatalog.bind();
  bindFFPatchEvents();
  bindTacticalItemEvents();
  WeaponSkins.bind();
  if (typeof ItemDemos !== 'undefined') ItemDemos.bind(detailDialog);
  initMapArchive();
  if (localMechanicsPreview) $('.local-preview-nav').hidden = false;
  seedCollectedAnalytics();
  state.ready = true;
  $('#topicSelect').insertAdjacentHTML('beforeend', topicDefs.map((topic) => '<option value="' + topic.id + '">' + topic.label + '</option>').join(''));
  $('#typeSelect').insertAdjacentHTML('beforeend', ['ltm'].map((tag) => '<option value="' + tag + '">' + tagLabels[tag] + '</option>').join(''));
  $('#updateCategorySelect').insertAdjacentHTML('beforeend', Object.entries(coreUpdateCategories).map(([id, label]) => '<option value="' + id + '">' + label + '</option>').join(''));
  readRoute();
}
initWorkspace();
