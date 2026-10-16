/* Object catalogue, separate from modes and dated core-update records. */
const itemArchive = {
  entries: [], categories: [], category: 'all', objectGroup: 'all',
  researchStatus: 'all', sort: 'catalogue', layout: 'grid', limit: 24
};
const itemGroupLabels = { equipment: '道具与功能装备', vehicle: '载具与炮台', world: '场景交互物', creative: '创意模式道具' };
const itemStatusLabels = { documented: '含机制详录', catalogued: '目录已收录' };
function isTacticalItem(entry) { return entry.contentKind === 'tactical_item'; }
function itemCategory(id) { return itemArchive.categories.find((category) => category.id === id); }
function normalizeTacticalItem(entry) {
  return { ...entry, kind: 'items', contentKind: 'tactical_item', modeName: entry.name,
    imageUrl: entry.image?.path || '', imageSource: entry.image?.caption || '',
    oneLineRule: entry.mechanic, type: [itemCategory(entry.category)?.label || entry.category, entry.objectType],
    tags: [], sourceModeIds: [] };
}
function itemVersions(entry) {
  return (entry.coreUpdateIds || []).map((id) => (state.coreUpdates || []).find((version) => version.id === id))
    .filter((version) => version?.publicationStatus === 'ready');
}
function resolveTacticalItem(id) {
  return itemArchive.entries.find((entry) => entry.id === id || entry.legacyIds.includes(id));
}
function loadTacticalCatalogue(data, updates) {
  if (!Array.isArray(data.items) || !Array.isArray(data.categories)) throw new Error('主题道具资料格式有误');
  itemArchive.categories = data.categories;
  state.coreUpdates = updates.map(normalizeCoreUpdate);
  itemArchive.entries = data.items.filter((entry) => entry.publicationStatus === 'ready').map(normalizeTacticalItem);
  // Keep source dossiers for evidence; their object cards live only in this catalogue.
  const linkedIds = new Set(itemArchive.entries.flatMap((entry) => entry.coreUpdateIds));
  let migrated = false;
  for (const entry of itemArchive.entries) {
    for (const id of entry.legacyIds) {
      if (state.collected.delete(id)) { state.collected.add(entry.id); migrated = true; }
    }
  }
  if (migrated) saveCollected();
  return state.coreUpdates.filter((entry) => entry.publicationStatus === 'ready' && !linkedIds.has(entry.id));
}
function normalizedItemText(text) {
  return String(text || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function itemMatchesQuery(entry, query = state.query) {
  const text = normalizedItemText([entry.name, entry.englishName, entry.game, entry.mechanic, entry.objectType,
    itemCategory(entry.category)?.label, itemCategory(entry.category)?.description, ...entry.searchAliases,
    ...itemVersions(entry).map((version) => [version.versionLabel, version.tacticalProfile?.role].join(' '))].join(' '));
  const compact = text.replaceAll(' ', '');
  return normalizedItemText(query).split(/\s+/).every((word) => text.includes(word) || compact.includes(word));
}
function matchesTacticalItem(entry, { ignoreCategory = false } = {}) {
  return (ignoreCategory || itemArchive.category === 'all' || entry.category === itemArchive.category) &&
    (state.gameFilter === 'all' || entry.game === state.gameFilter) &&
    (itemArchive.objectGroup === 'all' || entry.objectGroup === itemArchive.objectGroup) &&
    (itemArchive.researchStatus === 'all' || entry.researchStatus === itemArchive.researchStatus) &&
    itemMatchesQuery(entry);
}
function getFilteredTacticalItems() {
  return itemArchive.entries.filter((entry) => matchesTacticalItem(entry)).sort((a, b) => {
    if (itemArchive.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
    if (itemArchive.sort === 'documented' && a.researchStatus !== b.researchStatus) return a.researchStatus === 'documented' ? -1 : 1;
    return a.catalogOrder - b.catalogOrder;
  });
}
function resetItemFilters() {
  itemArchive.category = 'all'; itemArchive.objectGroup = 'all'; itemArchive.researchStatus = 'all';
  itemArchive.sort = 'catalogue'; itemArchive.limit = 24;
}
function readItemRoute(params) {
  itemArchive.category = itemCategory(params.get('category')) ? params.get('category') : 'all';
  itemArchive.objectGroup = Object.hasOwn(itemGroupLabels, params.get('object')) ? params.get('object') : 'all';
  itemArchive.researchStatus = Object.hasOwn(itemStatusLabels, params.get('status')) ? params.get('status') : 'all';
  itemArchive.sort = ['name', 'documented'].includes(params.get('sort')) ? params.get('sort') : 'catalogue';
  itemArchive.layout = params.get('layout') === 'list' ? 'list' : 'grid';
  itemArchive.limit = 24;
}
function itemHash(entryId) {
  const params = new URLSearchParams();
  if (state.gameFilter !== 'all') params.set('game', state.gameFilter);
  if (itemArchive.category !== 'all') params.set('category', itemArchive.category);
  if (itemArchive.objectGroup !== 'all') params.set('object', itemArchive.objectGroup);
  if (itemArchive.researchStatus !== 'all') params.set('status', itemArchive.researchStatus);
  if (itemArchive.sort !== 'catalogue') params.set('sort', itemArchive.sort);
  if (itemArchive.layout !== 'grid') params.set('layout', itemArchive.layout);
  if (state.query) params.set('q', state.query);
  if (entryId) params.set('entry', entryId);
  return '#items' + (params.size ? '?' + params.toString() : '');
}
function tacticalImageLabel(entry) {
  const picture = entry.image;
  if (!picture) return '';
  const origin = picture.sourceType === 'official' ? '官方' : '社区';
  return origin + ({ icon: '道具图', art: '配图', scene: '场景图', group: '合照' }[picture.kind] || '配图');
}
function tacticalImage(entry, { detail = false } = {}) {
  const picture = entry.image;
  if (!picture || !safeUrl(picture.path)) return '';
  const background = /^#[0-9a-f]{6}$/i.test(picture.background) ? picture.background : '#edf1e8';
  const label = tacticalImageLabel(entry);
  const media = '<span class="item-image-surface" style="--item-image-bg:' + background + '">' +
    '<img data-item-image src="' + escapeHtml(safeUrl(picture.path)) + '" alt="' + escapeHtml(picture.alt) + '" width="' + picture.width + '" height="' + picture.height + '" loading="' + (detail ? 'eager' : 'lazy') + '" decoding="async">' +
    '<span class="item-image-unavailable" hidden>图片暂不可用</span></span>';
  if (!detail) return '<button type="button" class="item-card-image" data-action="open-item" data-id="' + escapeHtml(entry.id) + '" aria-label="查看 ' + escapeHtml(entry.name) + ' 的图片与资料">' +
    media + '<span class="item-image-label ' + (picture.sourceType === 'community' ? 'is-community' : '') + '">' + label + '</span>' +
    (picture.kind === 'group' ? '<span class="item-image-hint">' + escapeHtml(picture.caption) + '</span>' : '') + '</button>';
  return '<figure class="item-detail-figure"><a class="item-original-image" href="' + escapeHtml(safeUrl(picture.path)) + '" target="_blank" rel="noopener noreferrer" aria-label="打开 ' + escapeHtml(entry.name) + ' 原图">' + media + '</a>' +
    '<figcaption><span class="item-image-label ' + (picture.sourceType === 'community' ? 'is-community' : '') + '">' + label + '</span><span>' + escapeHtml(picture.caption) + '</span>' +
    '<span class="item-image-credit">' + escapeHtml(picture.sourceName) + ' · <a href="' + escapeHtml(safeUrl(picture.sourcePageUrl)) + '" target="_blank" rel="noopener noreferrer">图片出处 ↗</a> · ' +
    '<a href="' + escapeHtml(safeUrl(picture.path)) + '" target="_blank" rel="noopener noreferrer">打开原图 ↗</a></span>' +
    (picture.sourceType === 'community' ? '<span class="item-image-community-note">官方缺图补充 · 社区来源</span>' : '') + '</figcaption></figure>';
}
function handleTacticalImageError(event) {
  if (!event.target.matches?.('img[data-item-image]')) return false;
  event.target.hidden = true;
  const surface = event.target.closest('.item-image-surface');
  surface?.classList.add('has-image-error');
  const fallback = surface?.querySelector('.item-image-unavailable');
  if (fallback) fallback.hidden = false;
  return true;
}
function tacticalCard(entry) {
  const collected = state.collected.has(entry.id);
  const category = itemCategory(entry.category);
  const versions = itemVersions(entry);
  const videos = versions.reduce((count, version) => count + (version.videos?.length || 0), 0);
  const shots = versions.reduce((count, version) => count + (version.screenshots?.length || 0), 0);
  return '<article class="item-card" data-id="' + escapeHtml(entry.id) + '">' +
    tacticalImage(entry) +
    '<div class="item-card-top"><span class="item-category-label">' + icon(category.icon) + escapeHtml(category.label) + '</span>' +
    '<span class="item-status ' + (versions.length ? 'has-dossier' : '') + '">' + itemStatusLabels[entry.researchStatus] + '</span></div>' +
    '<div class="item-card-content"><span class="item-index">' + String(entry.catalogOrder).padStart(3, '0') + '</span>' +
    '<div><h3><button type="button" data-action="open-item" data-id="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.name) + '</button></h3>' +
    '<p class="item-english" lang="en">' + escapeHtml(entry.englishName) + '</p></div></div>' +
    '<p class="item-mechanic">' + escapeHtml(entry.mechanic) + '</p>' +
    '<div class="item-card-tags"><span>' + escapeHtml(entry.objectType) + '</span>' +
    (entry.sourceStatus === 'community_reference' ? '<span class="item-source-pending">社区来源 · 待复核</span>' : '') +
    (videos ? '<span>' + videos + ' 视频' + (shots ? ' · ' + shots + ' 截图' : '') + '</span>' : '') + '</div>' +
    '<div class="item-card-footer"><span>' + escapeHtml(entry.game) + '</span><div>' +
    '<button type="button" class="icon-button ' + (collected ? 'is-collected' : '') + '" data-action="collect" data-id="' + escapeHtml(entry.id) + '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + escapeHtml(entry.name) + '" aria-pressed="' + collected + '">' + icon('bookmark') + '</button>' +
    '<button type="button" class="item-open" data-action="open-item" data-id="' + escapeHtml(entry.id) + '">' + (versions.length ? '看机制详录' : '查看条目') + icon('arrow-up-right') + '</button></div></div></article>';
}
function renderTacticalItems() {
  const entries = getFilteredTacticalItems();
  const scoped = itemArchive.entries.filter((entry) => matchesTacticalItem(entry, { ignoreCategory: true }));
  $('#itemStats').innerHTML = [[itemArchive.entries.length, '收录对象'], [itemArchive.categories.length, '功能分类'],
    [itemArchive.entries.filter((entry) => entry.researchStatus === 'documented').length, '机制详录']]
    .map(([count, label]) => '<div><dt>' + label + '</dt><dd>' + count + '</dd></div>').join('');
  $('#itemCategoryFilters').innerHTML = [{ id: 'all', label: '全部道具', icon: 'grid-2x2' }, ...itemArchive.categories].map((category) => {
    const count = category.id === 'all' ? scoped.length : scoped.filter((entry) => entry.category === category.id).length;
    return '<button type="button" data-item-category="' + category.id + '" aria-pressed="' + (itemArchive.category === category.id) + '">' +
      icon(category.icon) + '<span>' + escapeHtml(category.label) + '</span><small>' + count + '</small></button>';
  }).join('');
  $('#itemGameSelect').innerHTML = '<option value="all">全部游戏</option>' + [...new Set(itemArchive.entries.map((entry) => entry.game))].map((game) => '<option value="' + escapeHtml(game) + '">' + escapeHtml(game === 'Fortnite' ? 'Fortnite · 堡垒之夜' : game) + '</option>').join('');
  $('#itemGameSelect').value = state.gameFilter;
  $('#itemObjectSelect').value = itemArchive.objectGroup;
  $('#itemStatusSelect').value = itemArchive.researchStatus;
  $('#itemSortSelect').value = itemArchive.sort;
  document.querySelectorAll('[data-item-layout]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.itemLayout === itemArchive.layout)));
  $('#itemGrid').classList.toggle('item-list', itemArchive.layout === 'list');
  const visible = entries.slice(0, itemArchive.limit);
  $('#itemGrid').innerHTML = visible.length ? visible.map(tacticalCard).join('') :
    '<div class="empty-state">' + icon('search') + '<h3>没有找到匹配的道具</h3><p>可以搜索中英文名、作用或关键词，例如“躲猫猫”“位移”。</p><button class="button" type="button" data-reset-items>清除筛选</button></div>';
  $('#itemResultsTitle').textContent = itemArchive.category === 'all' ? '全部道具' : itemCategory(itemArchive.category).label;
  $('#itemResultCount').textContent = entries.length + ' 项 · ' + entries.filter((entry) => entry.image?.path).length + ' 项已配图';
  $('#itemShownCount').textContent = '已展示 ' + visible.length + ' / ' + entries.length + ' 项';
  $('#loadMoreItems').hidden = visible.length >= entries.length;
  const filters = [state.query ? '搜索：' + state.query : '', state.gameFilter !== 'all' ? state.gameFilter : '',
    itemGroupLabels[itemArchive.objectGroup], itemStatusLabels[itemArchive.researchStatus]].filter(Boolean);
  $('#itemFilterSummary').textContent = filters.join(' · ');
  $('#itemFilterSummary').hidden = !filters.length;
}
function tacticalItemDetail(entry) {
  const versions = itemVersions(entry);
  const category = itemCategory(entry.category);
  const section = (title, text) => text ? '<section class="detail-section"><h3>' + title + '</h3><p>' + escapeHtml(text) + '</p></section>' : '';
  const versionHtml = versions.map((version) => '<section class="item-version"><div class="item-version-heading"><h3>' + escapeHtml(version.versionLabel) + '</h3><span>' + escapeHtml(coreUpdateDateLabel(version)) + '</span></div>' +
    section('适用范围', [...version.affectedModes, ...version.mapNames].join(' · ')) + tacticalProfileDetail(version) +
    coreUpdateMediaDetail(version) + section('玩家行为变化 · 分析', version.playerImpact) + section('设计观察 · 分析', version.designObservation.replace(/^设计推断：/, '')) +
    section('版本与时间依据', version.launchNote) + coreUpdateEvidenceDetail(version) + '</section>').join('');
  return tacticalImage(entry, { detail: true }) +
    '<div class="detail-inner"><div class="detail-kicker">主题道具 / ' + escapeHtml(entry.game) + '</div>' +
    '<h2 id="detailTitle">' + escapeHtml(entry.name) + '</h2><p class="item-detail-english" lang="en">' + escapeHtml(entry.englishName) + '</p>' +
    '<div class="detail-meta"><span>' + escapeHtml(category.label) + '</span><span>' + escapeHtml(entry.objectType) + '</span><span class="item-status ' + (versions.length ? 'has-dossier' : '') + '">' + itemStatusLabels[entry.researchStatus] + '</span></div>' +
    '<p class="detail-summary">' + escapeHtml(entry.mechanic) + '</p>' +
    (entry.objectGroup === 'creative' ? '<p class="item-detail-note">创意模式道具：本条描述创意模式中的伪装工具；不据此推定大逃杀中的获取方式或数值。</p>' : '') +
    (entry.englishName.includes(' / ') ? '<p class="item-detail-note">此条按道具族收录，英文名列出相关变体；各版本的参数和使用限制需分别核对。</p>' : '') +
    (versions.length ? versionHtml : '<section class="item-pending"><h3>已收录目录，详录待补</h3><p>已收录外观配图、机制摘要与资料入口。具体数值、适用版本及生效日期仍待核对。</p><ul><li>操作、获取方式与限制：待逐版本整理</li><li>YouTube 演示：待核验</li><li>操作过程截图：待补</li></ul></section>') +
    '<section class="detail-section"><h3>资料入口</h3><p>' + (entry.sourceStatus === 'official_reference' ? '官方资料入口。目录条目的逐项参数与适用版本仍以详录中的依据为准。' : '社区资料入口，尚待官方来源交叉核对。') + '</p><a class="item-source-link" href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(new URL(entry.sourceUrl).hostname) + ' ' + icon('external-link') + '</a></section>' +
    '<p class="item-detail-note">目录收录：' + escapeHtml(entry.cataloguedAt) + '。历史记录不代表当前赛季可用；中文名含说明性译法。</p>' +
    '<div class="detail-actions">' + detailButton(entry) + '<button type="button" class="button" data-action="copy" data-id="' + escapeHtml(entry.id) + '">' + icon('book-open') + '复制 Markdown</button><a class="button" href="' + escapeHtml(safeUrl(entry.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + '打开资料来源</a></div></div>';
}
function tacticalItemMarkdown(entry) {
  const versions = itemVersions(entry);
  const picture = entry.image;
  return ['# ' + entry.name + ' · ' + entry.englishName, '', '- 资料类型：主题道具', '- 游戏：' + entry.game,
    '- 功能分类：' + itemCategory(entry.category).label, '- 对象类型：' + entry.objectType,
    '- 资料进度：' + itemStatusLabels[entry.researchStatus], '- 目录收录：' + entry.cataloguedAt,
    '- 资料入口：' + entry.sourceUrl, '- 来源性质：' + (entry.sourceStatus === 'official_reference' ? '官方资料入口' : '社区资料，待官方复核'), '',
    ...(picture ? ['## 道具图片', '', '![' + picture.alt.replace(/[\[\]]/g, '') + '](' + picture.assetSourceUrl + ')', '',
      picture.caption, '', '- 图片性质：' + tacticalImageLabel(entry) + (picture.sourceType === 'community' ? '（官方缺图补充）' : ''),
      '- 图片出处：[' + picture.sourceName + '](' + picture.sourcePageUrl + ')', '- 图片归档日期：' + picture.retrievedAt, ''] : []),
    '## 机制摘要', '', entry.mechanic, '', '历史对象目录，不代表当前赛季可用；中文名含说明性译法。',
    ...(entry.objectGroup === 'creative' ? ['', '范围：创意模式道具，不据此推定大逃杀中的获取方式或数值。'] : []),
    ...(entry.englishName.includes(' / ') ? ['', '按道具族收录，相关变体的参数及限制需分别核对。'] : []), '',
    ...(versions.length ? versions.flatMap((version) => ['## 历史版本：' + version.versionLabel, '',
      '- 日期：' + coreUpdateDateLabel(version), '- 适用范围：' + [...version.affectedModes, ...version.mapNames].join(' / '),
      '- 官方图片来源：' + version.imageSource, '- 图片原始地址：' + version.imageAssetSourceUrl, '',
      ...tacticalProfileMarkdown(version), '### 玩家行为变化（分析）', '', version.playerImpact, '',
      '### 设计观察（分析）', '', version.designObservation, '', '### 版本与时间依据', '', version.launchNote, ''])
      : ['## 待补资料', '', '操作、获取方式、限制、逐版本参数、生效日期、YouTube 演示与操作过程截图仍待整理。', ''])].join('\n');
}
function exportTacticalList() {
  const entries = getFilteredTacticalItems();
  if (!entries.length) { showToast('当前筛选没有可导出的道具'); return; }
  const header = ['# 主题与战术道具清单', '', entries.length + ' 项；历史目录，包含道具族，不代表当前赛季可用物资。', ''].join('\n');
  const md = header + '\n' + entries.map(tacticalItemMarkdown).join('\n\n---\n\n');
  downloadFile('tactical-items.md', md);
  showToast('已导出 ' + entries.length + ' 项道具资料');
}
function bindTacticalItemEvents() {
  $('#itemGrid').addEventListener('error', handleTacticalImageError, true);
  $('#itemsSection').addEventListener('click', (event) => {
    const target = event.target.closest('[data-item-category], [data-item-layout], [data-reset-items]');
    if (!target) return;
    if (target.hasAttribute('data-reset-items')) { resetItemFilters(); state.query = ''; state.gameFilter = 'all'; $('#searchInput').value = ''; }
    if (target.dataset.itemCategory) itemArchive.category = target.dataset.itemCategory;
    if (target.dataset.itemLayout) itemArchive.layout = target.dataset.itemLayout;
    itemArchive.limit = 24;
    syncFilterRoute(); renderTacticalItems();
    if (target.dataset.itemCategory) $('#itemCategoryFilters [aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  [['#itemGameSelect', 'game'], ['#itemObjectSelect', 'objectGroup'], ['#itemStatusSelect', 'researchStatus'], ['#itemSortSelect', 'sort']].forEach(([selector, key]) => {
    $(selector).addEventListener('change', (event) => {
      if (key === 'game') state.gameFilter = event.target.value; else itemArchive[key] = event.target.value;
      itemArchive.limit = 24; syncFilterRoute(); renderTacticalItems();
    });
  });
  $('#loadMoreItems').addEventListener('click', () => {
    const previous = itemArchive.limit;
    itemArchive.limit += 24; renderTacticalItems();
    $('#itemGrid').querySelectorAll('h3 button')[previous]?.focus({ preventScroll: true });
  });
  $('#downloadItemsList').addEventListener('click', exportTacticalList);
  $('#exportItemsMarkdown').addEventListener('click', exportTacticalList);
}
