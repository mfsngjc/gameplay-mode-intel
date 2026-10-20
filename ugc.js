/* Public UGC ranking snapshots. No analytics or third-party script runs here. */
window.UGCMonitor = (() => {
  'use strict';
  const root = document.querySelector('#ugcSection');
  const platforms = [['cs2', 'CS2 创意工坊'], ['roblox', '罗布乐思'], ['fortnite', '堡垒之夜社区'], ['minecraft', '我的世界模组']];
  const ui = { platform: 'cs2', board: 'hot', date: '', filter: 'all', sort: 'rank', limit: 25, query: '', loading: false, error: '', latest: null, historical: null, index: null, briefing: null, chinese: null };
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
  const categoryLabels = row => [...new Set((row.categories || []).map(c => categories[c]).filter(Boolean))];
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
  const timeLabel = value => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '尚未采集';
  const rankChange = value => value == null ? '<span class="ugc-neutral">—</span>' : value > 0 ? '<span class="ugc-up">↑ ' + value + '</span>' : value < 0 ? '<span class="ugc-down">↓ ' + Math.abs(value) + '</span>' : '<span class="ugc-neutral">持平</span>';

  function hash(query = ui.query) {
    const params = new URLSearchParams({ platform: ui.platform, board: ui.board });
    if (ui.date) params.set('date', ui.date);
    if (ui.filter !== 'all') params.set('signal', ui.filter);
    if (query) params.set('q', query);
    return '#ugc?' + params.toString();
  }

  function syncRoute() { history.replaceState(null, '', hash()); }

  function readRoute(params) {
    ui.platform = platforms.some(([id]) => id === params.get('platform')) ? params.get('platform') : 'cs2';
    ui.board = params.get('board') === 'alltime' ? 'alltime' : 'hot';
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : '';
    if (ui.date !== requestedDate) { ui.date = requestedDate; ui.historical = null; }
    ui.filter = ['risers', 'new', 'strong'].includes(params.get('signal')) ? params.get('signal') : 'all';
    ui.query = params.get('q') || '';
    ui.limit = 25;
  }

  async function getJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('榜单文件暂时无法读取（' + response.status + '）');
    const data = await response.json();
    if (data.schemaVersion !== 1) throw new Error('榜单格式暂不受支持');
    return data;
  }

  async function load(force = false) {
    if (ui.loading) return;
    ui.loading = true;
    if (!ui.latest) paint();
    try {
      const [latest, catalog] = await Promise.all([getJSON('data/ugc/latest.json'), getJSON('data/ugc/chinese.json')]);
      if (!latest.platforms || typeof latest.platforms !== 'object') throw new Error('榜单内容不完整');
      const changed = !ui.latest || latest.generatedAt !== ui.latest.generatedAt || catalog.updatedAt !== ui.chinese?.updatedAt;
      ui.chinese = catalog;
      ui.latest = latest;
      if (changed || !ui.index || force) {
        ui.index = await getJSON('data/ugc/index.json');
        try { ui.briefing = await getJSON('data/ugc/briefing.json'); } catch { ui.briefing = null; }
      }
      if (ui.date && (!ui.historical || force)) ui.historical = await getJSON('data/ugc/history/' + ui.date + '.json');
      ui.error = '';
      ui.loading = false;
      if (changed || force || ui.date || !root.querySelector('.ugc-table')) paint();
    } catch (error) {
      ui.loading = false;
      ui.error = error.message;
      paint();
    }
  }

  function filteredRows(board) {
    const words = ui.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const rows = (board?.entries || []).filter(row => {
      if (ui.filter === 'risers' && !(row.rankDelta > 0)) return false;
      if (ui.filter === 'new' && !row.isNewEntry) return false;
      if (ui.filter === 'strong' && !row.isStrongNewEntry) return false;
      const translated = chinese(row, board);
      const text = [translated.title, translated.intro, row.title, row.creator, row.id, row.summary, ...categoryLabels(row)].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
    return rows.sort((a, b) => {
      if (ui.sort === 'rise') return (b.rankDelta ?? -1000) - (a.rankDelta ?? -1000) || a.rank - b.rank;
      if (ui.sort === 'growth') return (b.metricGrowthPct ?? -1000) - (a.metricGrowthPct ?? -1000) || a.rank - b.rank;
      return a.rank - b.rank;
    });
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
    if (board.isBaseline) return '<span class="ugc-tag">基线</span>';
    if (row.isStrongNewEntry) return '<span class="ugc-tag ugc-tag-strong" title="' + esc(row.strongReasons.join('；')) + '">强势新进榜</span>';
    if (row.isNewEntry) return '<span class="ugc-tag ugc-tag-new">' + (row.isReturning ? '重新入榜' : '新入榜') + '</span>';
    return '';
  }

  function renderHighlights(board) {
    if (board.isBaseline) return '<div class="ugc-baseline"><strong>本次榜单基线已建立</strong><p>已保存本榜 ' + board.entries.length + ' 条真实记录。下一次同口径跨日采集后显示名次升降与新入榜；7 日对比按真实历史逐日积累。</p></div>';
    const ids = [...new Set([...(board.highlights?.strongNewEntries || []), ...(board.highlights?.risers || []), ...(board.highlights?.newEntries || [])])].slice(0, 3);
    const lookup = new Map(board.entries.map(row => [row.id, row]));
    if (!ids.length) return '<p class="ugc-baseline">本次没有显著上涨或新入榜内容，可切换完整榜单查看。</p>';
    return '<div class="ugc-highlights">' + ids.map(id => {
      const row = lookup.get(id);
      if (!row) return '';
      const reason = (row.strongReasons?.join('；') || (row.isNewEntry ? '上次完整前 ' + boardSize(board) + ' 名中未出现' : '较对比日上升 ' + row.rankDelta + ' 名')).replace(/Top\s*(100|200)/gi, '前 $1 名');
      return '<a class="ugc-highlight" href="' + esc(safe(row.url)) + '" target="_blank" rel="noopener noreferrer"><small>' + (row.isStrongNewEntry ? '强势新进榜' : row.isNewEntry ? '新入榜' : '排名上涨') + ' <span>#' + row.rank + '</span></small><strong>' + esc(chinese(row, board).title) + '</strong><p>' + esc(reason) + '</p></a>';
    }).join('') + '</div>';
  }

  function renderBriefing(board) {
    const briefing = ui.briefing;
    if (!briefing || briefing.date !== board.date || ui.date) return '';
    const entries = (briefing.entries || []).filter(item => item.boardId === key() && board.entries.some(row => row.id === item.id));
    if (!entries.length) return '';
    return '<section class="ugc-briefing" aria-label="每日观察"><h2>每日观察</h2>' + entries.map(item => '<article><strong>' + esc(chinese({ id: item.id }, board).title) + '</strong><p>' + esc(item.observation) + '</p><span>设计推断：' + esc(item.designInference || '暂无') + '</span>' + (item.sources || []).filter(url => safe(url)).slice(0, 3).map((url, index) => '<a href="' + esc(safe(url)) + '" target="_blank" rel="noopener noreferrer">来源 ' + (index + 1) + ' ↗</a>').join('') + '</article>').join('') + '</section>';
  }

  function paint() {
    if (!root) return;
    const board = current();
    const datasets = ui.latest?.platforms || {};
    const total = Object.values(datasets).reduce((sum, data) => sum + (data.entries?.length || 0), 0);
    const navCount = document.querySelector('#navUgcCount');
    if (navCount) navCount.textContent = total || '—';
    if (document.body.classList.contains('ugc-view')) document.querySelector('#librarySummary').textContent = '4 个平台 · 热榜 100 / 历史榜 200';
    const selectedDates = (ui.index?.dates || []).filter(item => item.platforms.includes(key())).slice(0, 90);
    const stale = board && (board.status === 'stale' || (!ui.date && Date.now() - Date.parse(board.collectedAt) > 36 * 3600000));
    let html = '<div class="ugc-heading-line"><span class="ugc-schedule">' + esc(ui.latest?.scheduleLabel || '每天 09:00 · 北京时间') + '</span><span>每日采集 · 页面每分钟检查新数据</span><button type="button" class="button" data-ugc-refresh' + (ui.loading ? ' disabled' : '') + '>重新读取</button></div>';
    html += '<div class="ugc-platforms" role="group" aria-label="UGC 平台">' + platforms.map(([id, label]) => '<button type="button" data-ugc-platform="' + id + '" aria-pressed="' + (ui.platform === id) + '"><span>' + esc(label) + '</span><small>' + ((datasets[id]?.entries?.length || 0) + (datasets[id + '_alltime']?.entries?.length || 0)) + ' 条</small></button>').join('') + '</div>';
    html += '<div class="ugc-board-line"><div class="ugc-board-switch" role="group" aria-label="榜单口径"><button type="button" data-ugc-board="hot" aria-pressed="' + (ui.board === 'hot') + '">每日热榜</button><button type="button" data-ugc-board="alltime" aria-pressed="' + (ui.board === 'alltime') + '">历史最热门</button></div><label class="ugc-date-label">历史快照 <select id="ugcDate"><option value="">最新榜单</option>' + selectedDates.map(item => '<option value="' + item.date + '"' + (ui.date === item.date ? ' selected' : '') + '>' + item.date + '</option>').join('') + '</select></label></div>';
    if (ui.error) html += '<div class="ugc-warning" role="status">' + esc(ui.error) + '。已载入的数据会继续保留。<button type="button" data-ugc-refresh>重试</button></div>';
    if (!board) {
      html += '<div class="ugc-empty" role="status"><h2>' + (ui.loading ? '正在读取 UGC 榜单…' : '本快照尚无这份榜单') + '</h2><p>' + (ui.loading ? '四个平台的热榜与历史最热门分别加载。' : '请选择最新榜单或其他日期。') + '</p></div>';
      root.innerHTML = html;
      return;
    }
    html += '<div class="ugc-source-line"><strong>' + esc(board.rankingLabel) + ' · 前 ' + (board.entries?.length || 0) + ' 名</strong><span>' + esc(board.date || '') + ' ' + timeLabel(board.collectedAt) + '（北京时间）</span><a href="' + esc(safe(board.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">查看榜单来源 ↗</a></div>';
    html += '<p class="ugc-methodology">' + esc(methodology(board)) + '</p>';
    if (stale || board.status === 'unavailable') html += '<div class="ugc-warning" role="status"><strong>' + (board.status === 'unavailable' ? '来源暂不可用' : '当前显示上次成功快照') + '</strong> ' + esc(board.error ? '本次未能采集到完整榜单' : '超过 36 小时未采集到新数据') + '。更新时间保持为实际采集时间。</div>';
    if (!board.entries?.length) { root.innerHTML = html; return; }
    const count = board.counts || {};
    html += '<div class="ugc-stats"><div><strong>' + count.total + '</strong><span>榜单内容</span></div><div><strong>' + (board.isBaseline ? '—' : count.risers) + '</strong><span>排名上涨</span></div><div><strong>' + (board.isBaseline ? '—' : count.newEntries) + '</strong><span>新进前 ' + boardSize(board) + ' 名</span></div><div><strong>' + (board.isBaseline ? '—' : count.strongNewEntries) + '</strong><span>近期强势新进榜</span></div></div>';
    html += renderHighlights(board) + renderBriefing(board);
    const rows = filteredRows(board), visible = rows.slice(0, ui.limit);
    const comparison = board.comparisonDays === 1 ? '较昨日' : '较上次';
    html += '<div class="ugc-table-tools"><div class="ugc-signal-filters" role="group" aria-label="筛选变化">' + [['all', '完整榜单'], ['risers', '上涨'], ['new', '新入榜'], ['strong', '强势新进榜']].map(([id, label]) => '<button type="button" data-ugc-filter="' + id + '" aria-pressed="' + (ui.filter === id) + '">' + label + '</button>').join('') + '</div><label class="sr-only" for="ugcSort">榜单排序</label><select id="ugcSort"><option value="rank"' + (ui.sort === 'rank' ? ' selected' : '') + '>按当前排名</option><option value="rise"' + (ui.sort === 'rise' ? ' selected' : '') + '>按上涨名次</option><option value="growth"' + (ui.sort === 'growth' ? ' selected' : '') + '>按指标增幅</option></select><button class="button" type="button" data-ugc-export>导出表格</button></div>';
    html += '<p class="ugc-table-hint">左右滑动表格可查看升降与走势。</p><div class="ugc-table-wrap"><table class="ugc-table"><caption class="sr-only">' + esc(platformLabel(board) + ' ' + board.boardLabel + '，按所选条件显示 ' + rows.length + ' 条') + '</caption><thead><tr><th scope="col">排名</th><th scope="col">作品 / 内容</th><th scope="col">' + esc(board.metricLabel) + '</th><th scope="col">' + comparison + '</th><th scope="col">7 日变化</th><th scope="col">走势</th></tr></thead><tbody>';
    html += visible.map(row => {
      const translated = chinese(row, board);
      const labels = categoryLabels(row).slice(0, 3).join(' / ') || (ui.platform === 'fortnite' ? '岛屿代码 ' + row.id : '社区作品');
      return '<tr><td class="ugc-rank">' + row.rank + '</td><td class="ugc-work"><a href="' + esc(safe(row.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(translated.title) + ' ↗</a>' + signal(row, board) + '<small>' + esc(labels) + '</small><p>' + esc(translated.intro) + '</p><details class="ugc-original"><summary>原名与作者</summary><span>原名：' + esc(row.title) + (row.creator && !/^\d{10,}$/.test(row.creator) ? '<br>作者：' + esc(row.creator) : '') + '</span></details></td><td class="ugc-metric" title="' + esc(row.metricValue) + '">' + number(row.metricValue) + (row.metricGrowthPct == null ? '' : '<small class="' + (row.metricGrowthPct >= 0 ? 'ugc-up' : 'ugc-down') + '">' + (row.metricGrowthPct >= 0 ? '+' : '') + row.metricGrowthPct + '%</small>') + '</td><td>' + (row.isNewEntry ? '<span class="ugc-up">' + (row.isReturning ? '重返' : '新入') + '</span>' : rankChange(row.rankDelta)) + '</td><td>' + rankChange(row.rankDelta7d) + '</td><td>' + sparkline(row, board) + '</td></tr>';
    }).join('');
    if (!visible.length) html += '<tr><td colspan="6" class="ugc-empty">' + (board.isBaseline && ui.filter !== 'all' ? '首日尚无跨日对比数据。' : '没有匹配内容，试试其他筛选或关键词。') + '</td></tr>';
    html += '</tbody></table></div><div class="ugc-footer"><span>已展示 ' + visible.length + ' / ' + rows.length + ' 条' + (board.comparisonDate ? ' · 对比 ' + board.comparisonDate : ' · 首日基线') + '</span>' + (visible.length < rows.length ? '<button class="button" type="button" data-ugc-more>' + (board.boardType === 'alltime' ? '显示全部 ' + rows.length + ' 条' : '继续显示 25 条') + '</button>' : '') + '</div>';
    html += '<p class="ugc-translation-note">中文名称采用便于理解的说明性译法，玩法介绍按公开来源整理。展开“原名与作者”可核对作品原名。</p>';
    html += '<details class="ugc-rules"><summary>如何判断上涨与强势新进榜</summary><p>排名上涨 = 对比日名次 − 当前名次。新入榜表示上次完整前 ' + boardSize(board) + ' 名中没有该作品，不代表刚发布；榜外名次不会按第 ' + (boardSize(board) + 1) + ' 名估算。</p><p>近 7 天新入榜的作品，若新入即进前 20，或一天上升至少 10 名、7 天上升至少 20 名、主要指标一天增长至少 25%，标记为强势新进榜。缺少历史、口径变更、采集失败均不制造变化；日期不连续时明确改用“较上次”。</p></details>';
    root.innerHTML = html;
  }

  function render(query = '') {
    ui.query = query;
    paint();
    if (!ui.latest || (ui.date && !ui.historical)) load();
  }

  function exportCSV() {
    const board = current();
    if (!board) return;
    const quote = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
    const rows = [['日期', '平台', '榜单', '排名', '中文名称', '中文介绍', '原名', '指标', '指标值', '对比日期', '排名变化', '7日变化', '新入榜', '强势新入榜', '来源'], ...filteredRows(board).map(row => [board.date, platformLabel(board), board.boardLabel, row.rank, chinese(row, board).title, chinese(row, board).intro, row.title, board.metricLabel, row.metricValue, board.comparisonDate, row.rankDelta, row.rankDelta7d, row.isNewEntry ? '是' : '', row.isStrongNewEntry ? '是' : '', row.url])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'ugc-' + key() + '-' + board.date + '.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-ugc-refresh')) { load(true); return; }
    if (target.hasAttribute('data-ugc-more')) { ui.limit = current()?.boardType === 'alltime' ? current().entries.length : ui.limit + 25; paint(); root.querySelector('[data-ugc-more]')?.focus({ preventScroll: true }); return; }
    if (target.hasAttribute('data-ugc-export')) { exportCSV(); return; }
    if (target.dataset.ugcPlatform) { ui.platform = target.dataset.ugcPlatform; ui.limit = 25; }
    if (target.dataset.ugcBoard) { ui.board = target.dataset.ugcBoard; ui.limit = 25; }
    if (target.dataset.ugcFilter) { ui.filter = target.dataset.ugcFilter; ui.limit = 25; }
    const focusSelector = target.dataset.ugcPlatform ? '[data-ugc-platform="' + ui.platform + '"]' : target.dataset.ugcBoard ? '[data-ugc-board="' + ui.board + '"]' : '[data-ugc-filter="' + ui.filter + '"]';
    const keyboardFocus = event.detail === 0;
    syncRoute(); paint(); if (keyboardFocus) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'ugcDate') { ui.date = event.target.value; ui.historical = null; ui.limit = 25; syncRoute(); if (ui.date) load(true); else paint(); }
    if (event.target.id === 'ugcSort') { ui.sort = event.target.value; paint(); root.querySelector('#ugcSort')?.focus({ preventScroll: true }); }
  });
  setInterval(() => { if (!document.hidden && document.body.classList.contains('ugc-view') && !ui.date) load(); }, 60000);
  return { render, readRoute, hash, refresh: () => load(true) };
})();
