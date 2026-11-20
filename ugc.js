/* Public UGC ranking snapshots. No analytics or third-party script runs here. */
window.UGCMonitor = (() => {
  'use strict';
  const root = document.querySelector('#ugcContent');
  const navigation = document.querySelector('#ugcNavigation');
  const tabs = [...navigation.querySelectorAll('[data-ugc-view]')];
  const communityChoices = document.querySelector('#ugcPlatformChoices');
  const platforms = [['cs2', 'CS2 创意工坊'], ['roblox', '罗布乐思'], ['fortnite', '堡垒之夜社区岛'], ['minecraft', '我的世界模组']];
  const rankingBoards = [['hot', '近期热榜'], ['alltime', '历史最热门'], ['source', '来源榜单']];
  const signals = [['all', '全部作品'], ['risers', '排名上涨'], ['new', '新入榜'], ['strong', '强势新进榜']];
  const ui = { platform: 'cs2', view: 'rank', catalogAll: false, board: 'hot', dimension: '', date: '', entry: '', filter: 'all', category: '', showAllCategories: false, sort: 'rank', limit: 25, query: '', loading: false, error: '', latest: null, historical: null, index: null, briefing: null, chinese: null, creators: null, boardCovers: null, boardCategories: null };
  let rankingQuery = '';
  const unclassified = 'unclassified';
  let entryRequest = 0;
  let rankedEntryOrigin = null;
  const entryResources = new Map();
  const exactNumber = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
  const categories = { Custom: '自定义', Classic: '经典对战', Wingman: '搭档模式', Deathmatch: '死斗', Armsrace: '军备竞赛', Training: '训练',
    optimization: '性能优化', utility: '实用工具', adventure: '冒险', technology: '科技', magic: '魔法', storage: '存储', worldgen: '世界生成',
    decoration: '装饰', equipment: '装备', food: '食物', transportation: '交通', management: '管理', social: '社交', mobs: '生物', game_mechanics: '游戏机制',
    All: '综合', RPG: '角色扮演', Fighting: '格斗', Horror: '恐怖', Adventure: '冒险', Town: '城市', 'Town and City': '城市生活', FPS: '射击', Sports: '体育', Building: '建造', Comedy: '休闲',
    'game-mechanics': '游戏机制', minigame: '小游戏', economy: '经济经营', cartoon: '卡通', cursed: '趣味整活', fantasy: '奇幻', 'semi-realistic': '半写实', themed: '主题内容' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safe = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const key = () => ui.platform + (ui.board === 'alltime' ? '_alltime' : '');
  const current = () => (ui.date ? ui.historical : ui.latest)?.platforms?.[key()];
  const chinese = (row, board = current()) => ui.chinese?.entries?.[board.platformId + ':' + row.id] || { title: '新收录作品', intro: '中文介绍正在整理。' };
  const creatorName = (row, board) => ui.creators?.entries?.[board.platformId + ':' + row.id]?.name || row.creator || '';
  const workTitle = (row, board) => esc(row.title) + '<span class="ugc-title-translation">（' + esc(chinese(row, board).title) + '）</span>';
  const workAuthor = (row, board) => {
    const name = creatorName(row, board);
    const label = board.platformId === 'cs2' && /^\d{17}$/.test(name) ? '作者编号：' : '作者：';
    return '<div class="ugc-author">' + label + esc(name || '来源暂未提供') + '</div>';
  };
  const categoryLabels = row => [...new Set((row.categories || []).map(c => categories[c]).filter(Boolean))];
  const boardCategoryLabels = platform => ui.boardCategories?.platforms?.[platform]?.labels || {};
  const primaryCategory = (platform, id) => ui.boardCategories?.platforms?.[platform]?.entries?.[id] || unclassified;
  const primaryLabel = (platform, id) => boardCategoryLabels(platform)[primaryCategory(platform, id)] || '';
  const selectedCategory = platform => Object.hasOwn(boardCategoryLabels(platform), ui.category) ? ui.category : '';
  const platformLabel = board => platforms.find(([id]) => id === board.platformId)?.[1] || '社区平台';
  const boardSize = board => board.rankingLimit || board.entries?.length || 100;
  const methodology = board => ({
    cs2: '按游戏平台近 7 天热门顺序收录，仅含 CS2 地图，排除皮肤和旧版反恐精英作品。订阅人数用于参考，不决定本热榜的排名。',
    cs2_alltime: '按游戏平台记录的历史累计订阅次数排序，仅含 CS2 地图。累计订阅与当前仍在订阅的人数不同，旧版反恐精英作品另计。',
    roblox: '采用公开统计站同一次采集的在线人数排名，收录其覆盖范围内的前 100 名。该数据不代表全天平均人数，也不是官方完整榜单。',
    roblox_alltime: '按公开统计站收录作品的累计访问次数排序，取前 ' + boardSize(board) + ' 名。重复游玩会重复计数，访问次数不等于玩家人数，来源也未覆盖平台全部作品。',
    fortnite: '按公开统计站记录的当前在线人数排序，只收录具有数字岛屿代码的社区作品，排除官方模式。翻页采集之间存在短暂时间差。',
    fortnite_alltime: '按公开统计站记录的累计游玩分钟数排序，排除官方模式。累计时段以该站实际追踪的历史为准，不代表创意模式上线以来的全部游玩。',
    minecraft: '收录近 30 天新建的单体模组，按累计下载次数排序，含工具与优化模组，排除供其他模组调用的基础组件。仅统计本来源，未合并其他下载站；滚动时间窗口会影响进出榜。',
    minecraft_alltime: '按本来源记录的单体模组累计下载次数排序，取前 ' + boardSize(board) + ' 名，含工具与优化模组，排除基础组件。未合并其他下载站；更新与整合包分发会重复计数，下载次数不等于玩家人数。'
  })[board.id] || '以来源公开统计的排名为准。';
  const number = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 }).format(value) : '—';
  const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
  const timeLabel = value => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '尚未采集';
  const rankChange = value => value == null ? '<span class="ugc-neutral">—</span>' : value > 0 ? '<span class="ugc-up">↑ ' + value + '</span>' : value < 0 ? '<span class="ugc-down">↓ ' + Math.abs(value) + '</span>' : '<span class="ugc-neutral">持平</span>';

  const isCatalog = () => ui.view === 'catalog';
  const catalogPlatform = () => ui.catalogAll ? 'all' : ui.platform;

  function selectCommunity(platform) {
    ui.catalogAll = platform === 'all';
    if (ui.catalogAll || ui.platform === platform) return;
    Object.assign(ui, { platform, category: '', dimension: '', limit: 25, showAllCategories: false });
    if (ui.date && ui.index && !ui.index.dates.some(item => item.date === ui.date && item.platforms.includes(key()))) {
      ui.date = '';
      ui.historical = null;
    }
  }

  function renderNavigation() {
    navigation.hidden = Boolean(ui.entry);
    root.toggleAttribute('data-ugc-entry', Boolean(ui.entry));
    root.removeAttribute('aria-labelledby');
    root.removeAttribute('role');
    if (ui.entry) return;
    const view = ui.view;
    const choices = isCatalog() ? [['all', '全部社区'], ...platforms] : platforms;
    const selected = isCatalog() ? catalogPlatform() : ui.platform;
    const markup = choices.map(([id, label]) =>
      '<button type="button" data-ugc-platform="' + id + '" aria-pressed="' + (id === selected) + '">' + esc(label) + '</button>'
    ).join('');
    if (communityChoices.innerHTML !== markup) communityChoices.innerHTML = markup;
    for (const tab of tabs) {
      const active = tab.dataset.ugcView === view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active) root.setAttribute('aria-labelledby', tab.id);
    }
    root.setAttribute('role', 'tabpanel');
    document.querySelector('#ugcViewDescription').textContent = ({
      rank: '按社区和榜单口径查看排名，以及作品的升降与新入榜情况。',
      analysis: '按当前社区和榜单口径查看作品类别、占比与排名变化。',
      catalog: '浏览公开来源已收录的作品，包含未上榜条目。'
    })[view];
  }

  function rankingNavigation(extra = '') {
    return '<div class="ugc-ranking-filters">' +
      '<label for="ugcBoard">榜单口径 <select id="ugcBoard">' + rankingBoards.map(([id, label]) =>
        '<option value="' + id + '"' + (ui.board === id ? ' selected' : '') + '>' + label + '</option>'
      ).join('') + '</select></label>' + extra + '</div>';
  }

  function hash(query = ui.query) {
    if (isCatalog()) return '#ugc?' + UGCCatalog.routeParams(query).toString();
    const params = new URLSearchParams({ platform: ui.platform, board: ui.board });
    if (ui.view === 'analysis') params.set('view', 'analysis');
    if (ui.board === 'source') {
      if (ui.dimension) params.set('dimension', ui.dimension);
      if (query) params.set('q', query);
      return '#ugc?' + params.toString();
    }
    if (ui.date) params.set('date', ui.date);
    if (ui.filter !== 'all') params.set('signal', ui.filter);
    if (ui.category) params.set('category', ui.category);
    if (ui.sort !== 'rank') params.set('sort', ui.sort);
    if (query) params.set('q', query);
    return '#ugc?' + params.toString();
  }

  function syncRoute() { history.replaceState(null, '', hash()); }

  function readRoute(params) {
    cancel();
    const platform = params.get('platform');
    const community = platforms.some(([id]) => id === platform) ? platform : '';
    ui.query = params.get('q') || '';
    if (params.get('board') === 'catalog') {
      ui.view = 'catalog';
      selectCommunity(community || 'all');
      ui.entry = params.get('entry') || '';
      UGCCatalog.readRoute(params);
      return;
    }
    ui.view = params.get('view') === 'analysis' ? 'analysis' : 'rank';
    ui.catalogAll = false;
    ui.platform = community || 'cs2';
    ui.board = ['alltime', 'source'].includes(params.get('board')) ? params.get('board') : 'hot';
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : '';
    if (ui.date !== requestedDate) { ui.date = requestedDate; ui.historical = null; }
    ui.filter = ['risers', 'new', 'strong'].includes(params.get('signal')) ? params.get('signal') : 'all';
    ui.sort = ['rise', 'growth'].includes(params.get('sort')) ? params.get('sort') : 'rank';
    const category = params.get('category') || '';
    const dimension = params.get('dimension') || '';
    ui.category = ['hot', 'alltime'].includes(ui.board) && /^[a-z-]+$/.test(category) ? category : '';
    ui.dimension = ui.board === 'source' && /^[a-z0-9-]+$/.test(dimension) ? dimension : '';
    ui.showAllCategories = false;
    rankingQuery = ui.query;
    ui.entry = params.get('entry') || '';
    if (ui.board === 'source') { ui.date = ''; ui.historical = null; ui.filter = 'all'; }
    ui.limit = !ui.entry && rankedEntryOrigin?.list === hash() ? rankedEntryOrigin.limit : 25;
  }

  async function getJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('榜单文件暂时无法读取（' + response.status + '）');
    const data = await response.json();
    if (data.schemaVersion !== 1) throw new Error('榜单格式暂不受支持');
    return data;
  }

  async function load(force = false) {
    if (ui.loading || ui.entry || isCatalog() || ui.board === 'source') return;
    ui.loading = true;
    if (!ui.latest) paint();
    try {
      const [latest, catalog, creators, boardCovers, boardCategories] = await Promise.all([getJSON('data/ugc/latest.json'), getJSON('data/ugc/chinese.json'), getJSON('data/ugc/creators.json').catch(() => null), getJSON('data/ugc/catalog/board-covers.json').catch(() => null), getJSON('data/ugc/board-categories.json').catch(() => null)]);
      if (!latest.platforms || typeof latest.platforms !== 'object') throw new Error('榜单内容不完整');
      const changed = !ui.latest || latest.generatedAt !== ui.latest.generatedAt || catalog.updatedAt !== ui.chinese?.updatedAt || (creators && creators.updatedAt !== ui.creators?.updatedAt) || (boardCovers?.updatedAt && boardCovers.updatedAt !== ui.boardCovers?.updatedAt) || (boardCategories && boardCategories.revision !== ui.boardCategories?.revision);
      ui.chinese = catalog;
      if (creators) ui.creators = creators;
      if (boardCovers?.schemaVersion === 1 && boardCovers.entries) ui.boardCovers = boardCovers;
      if (boardCategories?.platforms) ui.boardCategories = boardCategories;
      ui.latest = latest;
      if (changed || !ui.index || force) {
        ui.index = await getJSON('data/ugc/index.json');
        try { ui.briefing = await getJSON('data/ugc/briefing.json'); } catch { ui.briefing = null; }
      }
      const date = ui.date;
      if (date && (!ui.historical || force)) {
        const snapshot = await getJSON('data/ugc/history/' + date + '.json');
        if (ui.date === date) ui.historical = snapshot;
      }
      ui.error = '';
      ui.loading = false;
      if (isCatalog() || ui.board === 'source') return;
      if (date !== ui.date && ui.date && !ui.historical) { load(); return; }
      if (changed || force || ui.date || !root.querySelector('.ugc-table, .ugc-analysis')) paint();
    } catch (error) {
      ui.loading = false;
      ui.error = error.message;
      if (!isCatalog() && ui.board !== 'source') paint();
    }
  }

  function filteredRows(board) {
    const words = ui.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const category = selectedCategory(board.platformId);
    const rows = (board?.entries || []).filter(row => {
      if (ui.filter === 'risers' && !(row.rankDelta > 0)) return false;
      if (ui.filter === 'new' && !row.isNewEntry) return false;
      if (ui.filter === 'strong' && !row.isStrongNewEntry) return false;
      if (category && primaryCategory(board.platformId, row.id) !== category) return false;
      const translated = chinese(row, board);
      const text = [translated.title, translated.intro, row.title, creatorName(row, board), row.id, row.summary, primaryLabel(board.platformId, row.id), ...categoryLabels(row)].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
    return rows.sort((a, b) => {
      if (ui.sort === 'rise') return (b.rankDelta ?? -1000) - (a.rankDelta ?? -1000) || a.rank - b.rank;
      if (ui.sort === 'growth') return (b.metricGrowthPct ?? -1000) - (a.metricGrowthPct ?? -1000) || a.rank - b.rank;
      return a.rank - b.rank;
    });
  }

  function categorySummary(entries, categoryFor, valueFor) {
    const groups = new Map();
    let total = 0;
    let measured = 0;
    for (const row of entries) {
      const id = categoryFor(row);
      if (!groups.has(id)) groups.set(id, { id, count: 0, measured: 0, total: 0 });
      const group = groups.get(id);
      group.count++;
      const value = valueFor(row);
      if (!Number.isFinite(value) || value < 0) continue;
      measured++;
      total += value;
      group.measured++;
      group.total += value;
    }
    const ordered = [...groups.values()].sort((a, b) => Number(a.id === unclassified) - Number(b.id === unclassified) || b.total - a.total || b.count - a.count || a.id.localeCompare(b.id));
    return { groups: ordered, total, measured, count: entries.length, classified: entries.length - (groups.get(unclassified)?.count || 0) };
  }

  function renderCategoryStats(summary, { label, selected, expanded, metric, note, source = false, showLeader = false }) {
    const { groups, total, measured, count, classified } = summary;
    const known = groups.filter(group => group.id !== unclassified);
    const rows = expanded ? groups : groups.filter(group => group.id === unclassified || group.id === selected || known.indexOf(group) < 5);
    const toggle = rows.length < groups.length || (expanded && known.length > 5);
    const leader = showLeader && known.find(group => group.total > 0 && !['assets', '服务器与配套资源'].includes(group.id));
    const categoryAttr = source ? 'data-ugc-source-category' : 'data-ugc-category';
    return '<section class="ugc-category-stats" aria-labelledby="ugcCategoryHeading"><div class="ugc-category-heading"><h2 id="ugcCategoryHeading">类别人气</h2><span>已分类 ' + classified + ' / ' + count + ' 件' + (measured < count ? ' · ' + measured + ' 件有指标' : '') + '</span></div>' +
      (leader ? '<p class="ugc-category-leader"><strong>' + esc(label(leader.id)) + '</strong>的' + esc(metric) + '合计最高，占榜内 ' + percent.format(leader.total / total) + '。</p>' : '') +
      '<table class="ugc-category-table"><thead><tr><th scope="col">主分类</th><th scope="col">上榜作品</th><th scope="col">' + esc(metric) + '合计</th><th scope="col">榜内占比</th></tr></thead><tbody>' +
      rows.map(group => {
        const share = total > 0 && group.measured ? group.total / total : null;
        const value = group.measured ? group.total : null;
        return '<tr><th scope="row"><button type="button" ' + categoryAttr + '="' + esc(group.id) + '" aria-pressed="' + (group.id === selected) + '">' + esc(label(group.id)) + '</button></th><td>' + group.count + '</td><td title="' + (value == null ? '' : value.toLocaleString('zh-CN')) + '">' + number(value) + '</td><td><span class="ugc-category-share">' + (share == null ? '—' : percent.format(share)) + '</span><span class="ugc-category-bar" aria-hidden="true"><span style="width:' + (share ?? 0) * 100 + '%"></span></span></td></tr>';
      }).join('') + '</tbody></table><div class="ugc-category-footer"><p>' + esc(note) + '</p>' + (toggle ? '<button type="button" class="button" ' + categoryAttr + '-more aria-expanded="' + expanded + '">' + (expanded ? '收起类别' : '显示全部 ' + groups.length + ' 类') + '</button>' : '') + '</div></section>';
  }

  function categoryFilter(board, groups) {
    const labels = boardCategoryLabels(board.platformId);
    const selected = selectedCategory(board.platformId);
    const counts = new Map(groups.map(group => [group.id, group.count]));
    return '<label class="ugc-category-filter" for="ugcCategory">主分类 <select id="ugcCategory"><option value="">全部类别</option>' +
      Object.entries(labels).filter(([id]) => counts.has(id) || id === selected).map(([id, label]) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(label) + '（' + (counts.get(id) || 0) + '）</option>').join('') + '</select></label>';
  }

  function applyCategory(category) {
    ui.category = category;
    ui.limit = 25;
    showRanking('#ugcCategory');
  }

  function showRanking(focusSelector) {
    ui.view = 'rank';
    syncRoute();
    paint(focusSelector);
  }

  function sparkline(row, board) {
    const series = row.rankHistory || [];
    const available = series.filter(point => point.rank != null);
    if (available.length < 2) return '<span class="ugc-neutral">积累中</span>';
    let path = '', drawing = false;
    series.forEach((point, index) => {
      if (point.rank == null) { drawing = false; return; }
      const x = 3 + index * 10, y = 3 + (point.rank - 1) / Math.max(1, boardSize(board) - 1) * 25;
      path += (drawing ? ' L' : ' M') + x + ',' + y.toFixed(2);
      drawing = true;
    });
    const label = series.map(point => point.date + '：' + (point.rank == null ? '未观测或未入榜' : '第 ' + point.rank + ' 名')).join('；');
    return '<svg class="ugc-sparkline" viewBox="0 0 76 32" role="img" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title><path d="' + path + '"/></svg>';
  }

  function signal(row, board) {
    if (board.isBaseline) return '';
    if (row.isStrongNewEntry) return '<span class="ugc-tag ugc-tag-strong" title="' + esc(row.strongReasons.join('；')) + '">强势新进榜</span>';
    if (row.isNewEntry) return '<span class="ugc-tag ugc-tag-new">' + (row.isReturning ? '重新入榜' : '新入榜') + '</span>';
    return '';
  }

  function renderHighlights(board) {
    if (board.isBaseline) return '';
    const ids = [...new Set([...(board.highlights?.strongNewEntries || []), ...(board.highlights?.risers || []), ...(board.highlights?.newEntries || [])])].slice(0, 3);
    const lookup = new Map(board.entries.map(row => [row.id, row]));
    if (!ids.length) return '<p class="ugc-no-changes">本次没有显著上涨或新入榜内容，可切换完整榜单查看。</p>';
    return '<div class="ugc-highlights">' + ids.map(id => {
      const row = lookup.get(id);
      if (!row) return '';
      const reason = (row.strongReasons?.join('；') || (row.isNewEntry ? '上次完整前 ' + boardSize(board) + ' 名中未出现' : '较对比日上升 ' + row.rankDelta + ' 名')).replace(/Top\s*(100|200)/gi, '前 $1 名');
      return '<a class="ugc-highlight" href="' + esc(safe(row.url)) + '" target="_blank" rel="noopener noreferrer"><small>' + (row.isStrongNewEntry ? '强势新进榜' : row.isNewEntry ? '新入榜' : '排名上涨') + ' <span>#' + row.rank + '</span></small><strong>' + workTitle(row, board) + '</strong>' + workAuthor(row, board) + '<p>' + esc(reason) + '</p></a>';
    }).join('') + '</div>';
  }

  function renderBriefing(board) {
    const briefing = ui.briefing;
    if (!briefing || briefing.date !== board.date || ui.date) return '';
    const entries = (briefing.entries || []).filter(item => item.boardId === key() && board.entries.some(row => row.id === item.id));
    if (!entries.length) return '';
    const lookup = new Map(board.entries.map(row => [row.id, row]));
    return '<section class="ugc-briefing" aria-label="每日观察"><h2>每日观察</h2>' + entries.map(item => {
      const row = lookup.get(item.id);
      return '<article><strong>' + workTitle(row, board) + '</strong>' + workAuthor(row, board) + '<p>' + esc(item.observation) + '</p><span>设计推断：' + esc(item.designInference || '暂无') + '</span>' + (item.sources || []).filter(url => safe(url)).slice(0, 3).map((url, index) => '<a href="' + esc(safe(url)) + '" target="_blank" rel="noopener noreferrer">来源 ' + (index + 1) + ' ↗</a>').join('') + '</article>';
    }).join('') + '</section>';
  }

  function paint(focusSelector = '') {
    if (ui.entry || !document.body.classList.contains('ugc-view')) return;
    renderNavigation();
    if (isCatalog()) {
      window.UGCSourceBoards?.cancel();
      UGCCatalog.render({ platform: catalogPlatform(), query: ui.query, focusSelector });
      return;
    }
    window.UGCCatalog?.cancel();
    if (!root) return;
    if (ui.board === 'source') {
      document.querySelector('#librarySummary').textContent = '四个平台的公开榜单维度';
      UGCSourceBoards.render({ platform: ui.platform, dimension: ui.dimension, query: ui.query,
        analysis: ui.view === 'analysis', navigation: rankingNavigation, focusSelector, showRanking,
        entryLink: rankedEntryLink, afterRender: restoreRankedEntryFocus,
        loadTranslations: () => ui.chinese || entryResource('chinese.json'), choose(dimension) {
        ui.dimension = dimension;
        syncRoute();
        paint('#ugcSourceDimension');
      } });
      return;
    }
    window.UGCSourceBoards?.cancel();
    const board = current();
    const total = Object.values(ui.latest?.platforms || {}).reduce((sum, data) => sum + (data.entries?.length || 0), 0);
    const navCount = document.querySelector('#navUgcCount');
    if (navCount) navCount.textContent = total || '—';
    if (document.body.classList.contains('ugc-view')) document.querySelector('#librarySummary').textContent = '4 个平台 · 热榜 100 / 历史榜 200';
    const selectedDates = (ui.index?.dates || []).filter(item => item.platforms.includes(key())).slice(0, 90);
    const stale = board && (board.status === 'stale' || (!ui.date && Date.now() - Date.parse(board.collectedAt) > 8 * 86400000));
    const refresh = '<button type="button" class="button subtle" data-ugc-refresh' + (ui.loading ? ' disabled' : '') + '>刷新榜单</button>';
    let html = rankingNavigation('<label for="ugcDate">快照日期 <select id="ugcDate"><option value="">最新快照</option>' + selectedDates.map(item => '<option value="' + item.date + '"' + (ui.date === item.date ? ' selected' : '') + '>' + item.date + '</option>').join('') + '</select></label>' + refresh);
    if (ui.error) html += '<div class="ugc-warning" role="status">' + esc(ui.error) + '。已载入的数据会继续保留。<button type="button" data-ugc-refresh>重试</button></div>';
    if (!board) {
      html += '<div class="ugc-empty" role="status"><h2>' + (ui.loading ? '正在读取 UGC 榜单…' : '本快照尚无这份榜单') + '</h2><p>' + (ui.loading ? '四个平台的热榜与历史最热门分别加载。' : '请选择最新榜单或其他日期。') + '</p></div>';
      root.innerHTML = html;
      return;
    }
    html += '<div class="ugc-source-line"><strong>' + esc(board.rankingLabel) + ' · 前 ' + (board.entries?.length || 0) + ' 名</strong><span>' + esc(board.date || '') + ' ' + timeLabel(board.collectedAt) + '（北京时间）</span><a href="' + esc(safe(board.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">查看榜单来源 ↗</a></div>';
    const notes = '<p class="ugc-methodology">' + esc(methodology(board)) + '</p><p class="ugc-methodology">采集计划：' +
      esc(ui.latest?.scheduleLabel || '每周四 20:00 · 北京时间') + '。</p>' +
      (board.dataQualityNotes?.length ? '<p class="ugc-methodology" role="note">来源数据提示：' + board.dataQualityNotes.map(esc).join(' ') + '</p>' : '');
    if (stale || board.status === 'unavailable') html += '<div class="ugc-warning" role="status"><strong>' + (board.status === 'unavailable' ? '来源暂不可用' : '当前显示上次成功快照') + '</strong> ' + esc(board.error ? '本次未能采集到完整榜单' : '已超过每周更新周期，尚未采集到新数据') + '。更新时间保持为实际采集时间。</div>';
    if (!board.entries?.length) { root.innerHTML = html + notes; return; }
    const count = board.counts || {};
    const categoryStats = ui.boardCategories ? categorySummary(board.entries, row => primaryCategory(board.platformId, row.id), row => row.metricValue) : null;
    if (ui.view === 'analysis') {
      const labels = boardCategoryLabels(board.platformId);
      const summary = categoryStats ? renderCategoryStats(categoryStats, {
        label: id => labels[id], selected: selectedCategory(board.platformId), expanded: ui.showAllCategories,
        metric: board.metricLabel, showLeader: board.platformId === 'cs2',
        note: '占比使用本快照的全部有效指标，包含待分类作品。' + (board.id === 'cs2' ? '当前订阅用于比较类别，热榜名次沿用 Steam 热门排序。' : ''),
      }) : '<p class="ugc-methodology" role="status">分类资料暂时无法读取。</p>';
      const stats = '<div class="ugc-stats"><div><strong>' + count.total + '</strong><span>榜单内容</span></div><div><strong>' + (board.isBaseline ? '—' : count.risers) + '</strong><span>排名上涨</span></div><div><strong>' + (board.isBaseline ? '—' : count.newEntries) + '</strong><span>新进前 ' + boardSize(board) + ' 名</span></div><div><strong>' + (board.isBaseline ? '—' : count.strongNewEntries) + '</strong><span>近期强势新进榜</span></div></div>';
      root.innerHTML = html + '<div class="ugc-analysis">' + notes + stats + summary + renderHighlights(board) + renderBriefing(board) +
        '<section class="ugc-rules" aria-label="排名变化口径"><h3>排名变化口径</h3><p>排名上涨 = 对比日名次 − 当前名次。新入榜表示上次完整前 ' + boardSize(board) + ' 名中没有该作品。榜外名次不参与估算。</p><p>近 7 天的新入榜作品满足任一条件时标记为强势新进榜：新入即进前 20、一天上升至少 10 名、7 天上升至少 20 名，或主要指标一天增长至少 25%。缺少可比数据时不计算变化，日期不连续时标为“较上次”。</p></section></div>';
      if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
      return;
    }
    const rows = filteredRows(board), visible = rows.slice(0, ui.limit);
    const comparison = board.comparisonDays === 1 ? '较昨日' : '较上次';
    const signalFilter = '<label for="ugcSignal">榜单变化 <select id="ugcSignal">' + signals.map(([id, label]) =>
      '<option value="' + id + '"' + (ui.filter === id ? ' selected' : '') + '>' + label + '</option>'
    ).join('') + '</select></label>';
    const sortFilter = '<label for="ugcSort">排序 <select id="ugcSort">' +
      '<option value="rank"' + (ui.sort === 'rank' ? ' selected' : '') + '>按当前排名</option>' +
      '<option value="rise"' + (ui.sort === 'rise' ? ' selected' : '') + '>按上涨名次</option>' +
      '<option value="growth"' + (ui.sort === 'growth' ? ' selected' : '') + '>按指标增幅</option></select></label>';
    html += '<div class="ugc-table-tools">' + signalFilter + (categoryStats ? categoryFilter(board, categoryStats.groups) : '') +
      sortFilter + '<button class="button" type="button" data-ugc-export>导出表格</button></div>';
    html += '<p class="ugc-table-hint">左右滑动表格可查看升降与走势。</p><div class="ugc-table-wrap"><table class="ugc-table"><caption class="sr-only">' + esc(platformLabel(board) + ' ' + board.boardLabel + '，按所选条件显示 ' + rows.length + ' 条') + '</caption><thead><tr><th scope="col">排名</th><th scope="col">作品 / 内容</th><th scope="col">' + esc(board.metricLabel) + '</th><th scope="col">' + comparison + '</th><th scope="col">7 日变化</th><th scope="col">走势</th></tr></thead><tbody>';
    html += visible.map(row => {
      const translated = chinese(row, board);
      const labels = categoryLabels(row).slice(0, 3).join(' / ') || (ui.platform === 'fortnite' ? '岛屿代码 ' + row.id : '社区作品');
      const cover = ui.boardCovers?.entries?.[board.platformId + ':' + row.id];
      const imageUrl = cover?.status === 'available' ? UGCCovers.url(cover.url) : '';
      const thumbnail = imageUrl ? '<img class="ugc-board-cover" loading="lazy" decoding="async" src="' + esc(imageUrl) + '" alt="" data-ugc-cover="' + esc(cover.url) + '">' : '<span class="ugc-board-cover-missing">暂缺封面</span>';
      return '<tr><td class="ugc-rank">' + row.rank + '</td><td class="ugc-work"><div class="ugc-work-heading">' + thumbnail + '<div class="ugc-work-info"><div class="ugc-work-titleline"><a data-ugc-ranked-entry="' + esc(row.id) + '" href="' + esc(rankedEntryLink(row.id)) + '">' + workTitle(row, board) + '</a>' + signal(row, board) + '</div>' + workAuthor(row, board) + '</div></div><small>' + categoryBadge(board.platformId, row.id) + esc(labels) + '</small><p>' + esc(translated.intro) + '</p></td><td class="ugc-metric" title="' + esc(row.metricValue) + '">' + number(row.metricValue) + (row.metricGrowthPct == null ? '' : '<small class="' + (row.metricGrowthPct >= 0 ? 'ugc-up' : 'ugc-down') + '">' + (row.metricGrowthPct >= 0 ? '+' : '') + row.metricGrowthPct + '%</small>') + '</td><td>' + (row.isNewEntry ? '<span class="ugc-up">' + (row.isReturning ? '重返' : '新入') + '</span>' : rankChange(row.rankDelta)) + '</td><td>' + rankChange(row.rankDelta7d) + '</td><td>' + sparkline(row, board) + '</td></tr>';
    }).join('');
    if (!visible.length) html += '<tr><td colspan="6" class="ugc-empty">' + (board.isBaseline && ui.filter !== 'all' ? '首日尚无跨日对比数据。' : '没有匹配内容，试试其他筛选或关键词。') + '</td></tr>';
    html += '</tbody></table></div><div class="ugc-footer"><span>已展示 ' + visible.length + ' / ' + rows.length + ' 条' + (board.comparisonDate ? ' · 对比 ' + board.comparisonDate : '') + '</span>' + (visible.length < rows.length ? '<button class="button" type="button" data-ugc-more>' + (board.boardType === 'alltime' ? '显示全部 ' + rows.length + ' 条' : '继续显示 25 条') + '</button>' : '') + '</div>';
    html += '<p class="ugc-translation-note">作品以来源原名与作者署名展示，括号内中文名称为说明性译法，仅供参考；玩法介绍按公开来源整理。</p>';
    root.innerHTML = html;
    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
    restoreRankedEntryFocus();
  }

  function restoreRankedEntryFocus() {
    if (rankedEntryOrigin?.list === hash()) {
      const rowLink = root.querySelector('[data-ugc-ranked-entry="' + CSS.escape(rankedEntryOrigin.id) + '"]');
      rankedEntryOrigin = null;
      rowLink?.focus({ preventScroll: true });
      rowLink?.scrollIntoView({ block: 'nearest' });
    }
  }

  function rankedEntryLink(id) {
    const params = new URLSearchParams(hash().split('?')[1]);
    params.set('entry', id);
    return '#ugc?' + params.toString();
  }

  function categoryBadge(platform, id) {
    const label = primaryLabel(platform, id);
    return label ? '<span class="ugc-primary-category">' + esc(label) + '</span>' : '';
  }

  function cancel() {
    ++entryRequest;
    window.UGCCatalog?.cancel();
    window.UGCSourceBoards?.cancel();
  }

  function entryResource(path) {
    if (!entryResources.has(path)) {
      entryResources.set(path, getJSON('data/ugc/' + path).catch(() => {
        entryResources.delete(path);
        return null;
      }));
    }
    return entryResources.get(path);
  }

  function externalLink(url, label, style = '') {
    const href = safe(url);
    return href ? '<a class="' + style + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
      esc(label) + icon('external-link') + '</a>' : '';
  }

  function renderEntry(record, context) {
    const { platform, entry, cover, translation, creator, listing, shareHash } = context;
    const title = UGCCatalog.entryName(record) || '来源未提供名称';
    const titleZh = (record.translationStatus === 'reviewed' && record.titleZh) || translation?.title || context.titleZh;
    const intro = (record.translationStatus === 'reviewed' && record.introZh) || translation?.intro || context.intro;
    const image = [cover, record.image].find(item => item?.status === 'available' && UGCCovers.url(item.url)) || record.image || cover;
    const imageUrl = image?.status === 'available' ? UGCCovers.url(image.url) : '';
    const author = creator || record.creator;
    const category = primaryLabel(platform, entry) || context.category;
    const { known, unknown } = UGCCatalog.categories(record);
    const tags = [...new Set(known)].filter(tag => tag !== category);
    const sources = [...new Set([...(translation?.sources || []), ...(record.sources || [])]
      .map(source => safe(typeof source === 'string' ? source : source?.url)).filter(Boolean))];
    const url = safe(record.url);
    const robloxGame = platform === 'roblox' && [url, ...sources].find(source => /^https:\/\/(?:www\.)?roblox\.com\/games\/\d+(?:[/?#]|$)/.test(source));
    const robloxPlaceId = robloxGame ? new URL(robloxGame).pathname.split('/')[2] : '';
    const mainUrl = robloxGame || url;
    const statsUrl = safe(record.statsUrl) || (robloxGame && url !== robloxGame ? url : '');
    const artwork = imageUrl ? '<img decoding="async" src="' + esc(imageUrl) + '" alt="' + esc(title + ' 作品图') +
      '" data-ugc-cover="' + esc(image.url) + '">' : '<span class="ugc-catalog-cover-fallback">' +
      (image?.status === 'unavailable' ? '作品图暂不可用' : '暂缺作品图') + '</span>';
    const facts = listing ? [[listing.label, '第 ' + listing.rank + ' 名'], [listing.metricLabel, listing.metric]] :
      [[UGCCatalog.metricName(record.metricLabel), Number.isFinite(record.metricValue) ? exactNumber.format(record.metricValue) : '']];
    const factMarkup = facts.filter(([, value]) => value).map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>').join('');
    const ranking = (factMarkup ? '<dl class="ugc-entry-ranking">' + factMarkup + '</dl>' : '') + (listing?.date ?
      '<p class="ugc-entry-date">榜单快照 <time datetime="' + esc(listing.date) + '">' + esc(listing.date) + '</time></p>' : '');
    const original = record.descriptionOriginal ? '<details class="ugc-entry-original"><summary>查看作者原文</summary><p>' +
      esc(record.descriptionOriginal) + '</p>' + sources.filter(url => url !== mainUrl && url !== statsUrl)
        .map((url, i) => externalLink(url, '原文来源 ' + (i + 1))).join('') + '</details>' : '';
    setEntryTitle(title);
    return '<article class="ugc-entry-detail" aria-labelledby="ugcEntryTitle"><div class="ugc-entry-header">' +
      '<p class="ugc-entry-platform">' + esc(platformLabel({ platformId: platform })) + '</p><h1 id="ugcEntryTitle" tabindex="-1">' + esc(title) + '</h1>' +
      (titleZh && titleZh !== title ? '<p class="ugc-entry-translation">（' + esc(titleZh) + '）</p>' : '') +
      '<p class="ugc-entry-byline">' + (author ? esc(platform === 'cs2' && /^\d{17}$/.test(author) ? '作者编号 ' + author : '作者 ' + author) + '<span aria-hidden="true"> · </span>' : '') +
      esc((platform === 'fortnite' ? '岛屿代码 ' : '作品编号 ') + entry) + '</p></div>' +
      '<div class="ugc-entry-grid"><figure class="ugc-entry-figure"><div class="ugc-entry-image' + (image?.kind === 'icon' ? ' is-icon' : '') + '">' + artwork + '</div>' +
      (imageUrl && safe(image.sourceUrl) ? '<figcaption>' + externalLink(image.sourceUrl, '作品图来源') + '</figcaption>' : '') + '</figure>' +
      '<div class="ugc-entry-info"><div class="ugc-entry-introduction"><h2>作品介绍</h2><p' + (intro ? '' : ' class="ugc-entry-pending"') + '>' +
      esc(intro || '中文介绍待补充。') + '</p></div>' + (category || tags.length ? '<ul class="ugc-entry-tags" aria-label="作品分类">' +
        [category, ...tags].filter(Boolean).map((tag, i) => '<li' + (category && i === 0 ? ' class="ugc-entry-primary-category"' : '') + '>' + esc(tag) + '</li>').join('') + '</ul>' : '') +
      ranking + '<div class="ugc-entry-actions">' +
      (robloxPlaceId ? '<a class="button primary" href="roblox://placeId=' + robloxPlaceId + '">用 Roblox 打开</a>' : '') +
      externalLink(mainUrl, robloxGame ? '查看作品官网' : '查看作品页面', robloxPlaceId ? 'button' : 'button primary') +
      shareLinkButton(title, shareHash, '复制分享链接', 'link') + (statsUrl && statsUrl !== mainUrl ? externalLink(statsUrl, '查看统计详情') : '') +
      '</div>' + original + (!listing && unknown.length ? '<details class="ugc-entry-original"><summary>查看来源分类</summary><p>' +
        esc(unknown.join('、')) + '</p></details>' : '') + '</div></div></article>';
  }

  async function paintEntry() {
    const request = ++entryRequest;
    renderNavigation();
    const { board, date, entry, dimension } = ui;
    const catalog = isCatalog();
    const platform = catalog ? catalogPlatform() : ui.platform;
    const back = '<nav class="ugc-entry-back" aria-label="返回 UGC 列表"><a href="' + esc(hash()) + '"><span aria-hidden="true">←</span> ' + (catalog ? '返回收录目录' : '返回榜单') + '</a></nav>';
    const currentRequest = () => request === entryRequest && document.body.classList.contains('ugc-view');
    root.innerHTML = back + '<div class="ugc-catalog-loading" role="status">正在读取作品…</div>';
    window.scrollTo({ top: 0, behavior: 'instant' });
    function showEntry(markup) {
      const focusBack = root.querySelector('.ugc-entry-back a') === document.activeElement;
      const focusTitle = rankedEntryOrigin?.id === entry && document.activeElement === document.body;
      root.innerHTML = back + markup;
      if (focusBack || focusTitle) (root.querySelector(focusTitle ? '#ugcEntryTitle' : '.ugc-entry-back a') ||
        root.querySelector('.ugc-entry-back a'))?.focus({ preventScroll: true });
    }
    try {
      const id = platform + ':' + entry;
      const boardKey = platform + (board === 'alltime' ? '_alltime' : '');
      async function readRanked() {
        const snapshot = (date ? ui.historical : ui.latest) || await getJSON(date ? 'data/ugc/history/' + date + '.json' : 'data/ugc/latest.json');
        const board = snapshot.platforms?.[boardKey];
        const row = board?.entries?.find(item => item.id === entry);
        if (!row) return null;
        return { row, listing: { label: board.boardLabel, rank: row.rank, date: board.date, metricLabel: board.metricLabel,
          metric: Number.isFinite(row.metricValue) ? exactNumber.format(row.metricValue) : '' } };
      }
      const [ranked, boardCategories, boardCovers, translations, creators] = await Promise.all([
        catalog ? null : board === 'source' ? UGCSourceBoards.findEntry(platform, dimension, entry) : readRanked(),
        ui.boardCategories || entryResource('board-categories.json'),
        ui.boardCovers || entryResource('catalog/board-covers.json'),
        ui.chinese || entryResource('chinese.json'),
        ui.creators || entryResource('creators.json')
      ]);
      if (!currentRequest()) return;
      if (boardCategories?.platforms) ui.boardCategories = boardCategories;
      if (boardCovers?.entries) ui.boardCovers = boardCovers;
      const { row, listing } = ranked || {};
      const translation = translations?.entries?.[id];
      const record = row ? { originalTitle: row.title, creator: row.creator, url: row.url,
        categories: row.categories || row.tags, image: row.cover ? { url: row.cover,
          sourceUrl: row.url, status: 'available', kind: platform === 'roblox' || platform === 'minecraft' ? 'icon' : 'cover' } : null } :
        await UGCCatalog.findEntry(platform, entry);
      if (!currentRequest()) return;
      if (record) {
        const linked = platform !== 'roblox' || row || (record.identityStatus === 'verified' && record.canonicalId === entry);
        const shareParams = !listing ? { platform, board: 'catalog' } : board === 'source' ?
          { platform, board, dimension: listing.dimension } : { platform, board, date: listing.date };
        showEntry(renderEntry(record, { platform, entry, listing, translation: linked ? translation : null,
          creator: linked ? creators?.entries?.[id]?.name : '', cover: linked ? boardCovers?.entries?.[id] : null,
          category: row?.category, titleZh: row?.titleZh, intro: row?.introZh, shareHash: entryHash('ugc', entry, shareParams) }));
        return;
      }
      showEntry('<p class="ugc-empty" role="status">没有找到该作品。</p>');
    } catch {
      if (currentRequest()) showEntry('<div class="ugc-warning" role="alert">作品暂时无法读取。 <button class="button" type="button" data-ugc-entry-retry>重试</button></div>');
    }
  }

  function render(query = '') {
    ui.query = query;
    if (!isCatalog()) rankingQuery = query;
    if (ui.entry && !new URLSearchParams(location.hash.split('?')[1]).has('entry')) { ui.entry = ''; cancel(); setEntryTitle(); }
    if (ui.entry) { paintEntry(); return; }
    paint();
    if (!isCatalog() && ui.board !== 'source' && (!ui.latest || (ui.date && !ui.historical))) load();
  }

  function exportCSV() {
    const board = current();
    if (!board) return;
    const quote = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
    const rows = [['日期', '平台', '榜单', '排名', '原名', '作者', '中文名称（参考）', '中文介绍', '指标', '指标值', '对比日期', '排名变化', '7日变化', '新入榜', '强势新入榜', '来源', '主分类'], ...filteredRows(board).map(row => [board.date, platformLabel(board), board.boardLabel, row.rank, row.title, creatorName(row, board), chinese(row, board).title, chinese(row, board).intro, board.metricLabel, row.metricValue, board.comparisonDate, row.rankDelta, row.rankDelta7d, row.isNewEntry ? '是' : '', row.isStrongNewEntry ? '是' : '', row.url, primaryLabel(board.platformId, row.id)])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'ugc-' + key() + '-' + board.date + '.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleClick(event) {
    const entry = event.target.closest('[data-ugc-ranked-entry]');
    if (entry && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      rankedEntryOrigin = { id: entry.dataset.ugcRankedEntry, list: hash(), limit: ui.limit };
      return;
    }
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-ugc-entry-retry')) { paintEntry(); return; }
    if (target.hasAttribute('data-catalog-page') || target.hasAttribute('data-catalog-refresh')) return;
    if (target.dataset.ugcCategory) { applyCategory(ui.category === target.dataset.ugcCategory ? '' : target.dataset.ugcCategory); return; }
    if (target.hasAttribute('data-ugc-category-more')) {
      ui.showAllCategories = !ui.showAllCategories;
      paint();
      root.querySelector('[data-ugc-category-more]')?.focus({ preventScroll: true });
      return;
    }
    if (target.hasAttribute('data-ugc-refresh')) { load(true); return; }
    if (target.hasAttribute('data-ugc-more')) { ui.limit = current()?.boardType === 'alltime' ? current().entries.length : ui.limit + 25; paint(); root.querySelector('[data-ugc-more]')?.focus({ preventScroll: true }); return; }
    if (target.hasAttribute('data-ugc-export')) { exportCSV(); return; }
    const { ugcPlatform: platform, ugcView: view } = target.dataset;
    if (platform) {
      if ((isCatalog() ? catalogPlatform() : ui.platform) === platform) return;
      selectCommunity(platform);
    } else if (view) {
      if (view === ui.view) return;
      if (isCatalog()) {
        ui.catalogAll = false;
        ui.query = state.query = rankingQuery;
        document.querySelector('#searchInput').value = rankingQuery;
      }
      ui.view = view;
    } else return;
    if (isCatalog()) {
      const params = UGCCatalog.routeParams(ui.query);
      if (params.get('platform') !== catalogPlatform()) {
        params.set('platform', catalogPlatform());
        params.delete('catalogPage');
        UGCCatalog.readRoute(params);
      }
    }
    syncRoute(); render(ui.query);
    if (platform) communityChoices.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    else target.focus({ preventScroll: true });
  }
  root.addEventListener('click', handleClick);
  navigation.addEventListener('click', handleClick);
  document.querySelector('#ugcViewTabs').addEventListener('keydown', event => {
    const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (tabs.indexOf(event.target) + offset + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[index].click();
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'ugcBoard') {
      ui.board = event.target.value;
      ui.limit = 25;
      ui.showAllCategories = false;
      if (ui.board === 'source') { ui.date = ''; ui.historical = null; ui.filter = 'all'; ui.category = ''; }
      syncRoute();
      paint('#ugcBoard');
      if (ui.board !== 'source') {
        root.querySelector('#ugcBoard')?.focus({ preventScroll: true });
        if (!ui.latest) load();
      }
    }
    if (event.target.id === 'ugcSignal') {
      ui.filter = event.target.value;
      ui.limit = 25;
      syncRoute();
      paint();
      root.querySelector('#ugcSignal')?.focus({ preventScroll: true });
    }
    if (event.target.id === 'ugcDate') { ui.date = event.target.value; ui.historical = null; ui.limit = 25; syncRoute(); if (ui.date) load(true); else paint(); }
    if (event.target.id === 'ugcCategory') applyCategory(event.target.value);
    if (event.target.id === 'ugcSort') { ui.sort = event.target.value; syncRoute(); paint(); root.querySelector('#ugcSort')?.focus({ preventScroll: true }); }
  });
  setInterval(() => { if (!document.hidden && document.body.classList.contains('ugc-view') && !ui.date) load(); }, 60000);
  return { render, readRoute, hash, categorySummary, renderCategoryStats, cancel, refresh: () => load(true), isCatalog, hasEntry: () => Boolean(ui.entry) };
})();
