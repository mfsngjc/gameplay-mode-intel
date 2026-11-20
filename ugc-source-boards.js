/* Source-specific UGC rankings. Collections are read from local snapshots. */
window.UGCSourceBoards = (() => {
  'use strict';
  const root = document.querySelector('#ugcContent');
  const cache = new Map();
  const loadRequests = new Map();
  const locality = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' });
  const snapshotDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short' });
  const timestampFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' });
  const momentum = { rising: '上升', falling: '下降', stable: '平稳', breakout: '爆发', new: '新作' };
  const environment = { client_only: '仅客户端', server_only: '仅服务端', client_and_server: '客户端和服务端', singleplayer_only: '仅单人',
    client_or_server: '客户端或服务端', client_only_server_optional: '客户端为主', server_only_client_optional: '服务端为主', unknown: '来源未注明' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const state = { options: null, document: null, board: null, translations: null, limit: 25, category: '', tag: '', field: '', min: '', max: '', tagTarget: '', showAllCategories: false };
  const unknownCategory = '待分类';
  const categoryId = row => row.category && row.category !== unknownCategory ? row.category : 'unclassified';
  let requestId = 0;
  let previousView = null;

  function read(platform, refresh) {
    if (!refresh && cache.has(platform)) return Promise.resolve(cache.get(platform));
    if (loadRequests.has(platform)) return loadRequests.get(platform);
    const load = fetch('data/ugc/source-boards/' + encodeURIComponent(platform) + '.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('榜单文件暂时无法读取');
        return response.json();
      }).then(doc => {
        if (doc.schemaVersion !== 1 || doc.platformId !== platform || !Array.isArray(doc.boards)) throw new Error('榜单数据格式不完整');
        cache.set(platform, doc);
        return doc;
      }).finally(() => loadRequests.delete(platform));
    loadRequests.set(platform, load);
    return load;
  }

  function format(value, column, exact = false) {
    if (value == null || value === '') return exact ? '' : '—';
    if (column.kind === 'percent') return locality.format(value) + '%';
    if (column.kind === 'date') return dateFormat.format(new Date(value));
    if (column.kind === 'rank') return '#' + locality.format(value);
    if (column.kind === 'score') return locality.format(value);
    if (column.id === 'momentum') return momentum[value] || value;
    if (column.id === 'environment') return environment[value] || value;
    if (typeof value === 'number') return (exact ? locality : compact).format(value);
    return value;
  }

  function selectedBoard(doc, dimension) {
    return doc.boards.find(item => item.id === dimension) || doc.boards.find(item => item.rows.length) || doc.boards[0];
  }

  async function findEntry(platform, dimension, id) {
    const board = selectedBoard(await read(platform, false), dimension);
    const row = board?.rows.find(item => item.id === id);
    if (!row) return null;
    const metric = board.columns.find(column => column.id === board.metric && column.kind !== 'rank');
    return { row, listing: { label: board.label, dimension: board.id, rank: row.rank,
      date: board.capturedAt ? snapshotDate.format(new Date(board.capturedAt)) : '',
      metricLabel: metric?.label, metric: metric ? format(row.values[metric.id], metric, true) : '' } };
  }

  function boardPicker(doc, selected) {
    const groups = new Map();
    for (const item of doc.boards) {
      if (!groups.has(item.source)) groups.set(item.source, []);
      groups.get(item.source).push(item);
    }
    const options = [...groups].map(([source, items]) => '<optgroup label="' + esc(source) + '">' + items.map(item =>
      '<option value="' + esc(item.id) + '"' + (item.id === selected ? ' selected' : '') + '>' + esc(item.label + (item.status === 'unavailable' ? ' · 暂无快照' : '')) + '</option>'
    ).join('') + '</optgroup>').join('');
    return '<label for="ugcSourceDimension">榜单维度 <select id="ugcSourceDimension">' + options +
      '</select></label><button class="button" type="button" data-ugc-source-refresh>重新读取</button>';
  }

  function categoryStats(board) {
    const metrics = board.metric === 'lifetime' ? ['lifetime', 'current'] : ['current', 'lifetime'];
    const metricId = metrics.find(id => board.rows.some(row => Number.isFinite(row.values[id]) && row.values[id] >= 0));
    if (!metricId) return '';
    const metric = board.columns.find(column => column.id === metricId)?.label || (metricId === 'current' ? '当前订阅' : '历史总订阅');
    const summary = UGCMonitor.categorySummary(board.rows, categoryId, row => row.values[metricId]);
    return UGCMonitor.renderCategoryStats(summary, {
      label: id => id === 'unclassified' ? unknownCategory : id,
      selected: state.category === unknownCategory ? 'unclassified' : state.category,
      expanded: state.showAllCategories, metric, source: true, showLeader: true,
      note: '占比使用本榜单的全部有效订阅数据，包含待分类作品。各来源与时间范围分别统计。',
    });
  }

  function filteredRows(board, query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return board.rows.filter(row => {
      if (state.category && row.category !== state.category) return false;
      if (state.tag && !row.tags?.includes(state.tag)) return false;
      const metric = row.values[state.field];
      if ((state.min !== '' || state.max !== '') && (!Number.isFinite(metric) || (state.min !== '' && metric < Number(state.min)) || (state.max !== '' && metric > Number(state.max)))) return false;
      const labels = Object.values(row.values).filter(value => typeof value === 'string');
      const translation = translationFor(row);
      const text = [row.title, translation.title, translation.intro, row.creator, row.id, row.category, ...(row.tags || []), ...labels].join(' ').toLowerCase();
      return words.every(word => text.includes(word));
    });
  }

  function translationFor(row) {
    const reviewed = state.translations?.entries?.[state.options.platform + ':' + row.id];
    return { title: reviewed?.title || row.titleZh, intro: reviewed?.intro || row.introZh };
  }

  function options(values, selected) {
    return values.map(([id, label]) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  }

  function filters(board) {
    const categories = new Map();
    const tags = new Set();
    board.rows.forEach(row => {
      if (row.category) categories.set(row.category, (categories.get(row.category) || 0) + 1);
      row.tags?.forEach(tag => tags.add(tag));
    });
    const metricOptions = board.columns.filter(c => ['count', 'percent', 'score', 'rank'].includes(c.kind) && board.rows.some(row => Number.isFinite(row.values[c.id])));
    const labels = [...categories].sort((a, b) => b[1] - a[1]).map(([category, count]) => [category, category + '（' + count + '）']);
    const numberControl = metricOptions.length ? '<div class="ugc-source-range"><label for="ugcSourceField">数值筛选</label><select id="ugcSourceField">' +
      options([['', '不限指标'], ...metricOptions.map(c => [c.id, c.label])], state.field) + '</select><input type="number" step="any" id="ugcSourceMin" aria-label="最小值" placeholder="最小值" value="' + esc(state.min) +
      '"' + (state.field ? '' : ' disabled') + '><input type="number" step="any" id="ugcSourceMax" aria-label="最大值" placeholder="最大值" value="' + esc(state.max) +
      '"' + (state.field ? '' : ' disabled') + '></div>' : '';
    return '<div class="ugc-source-filters"><label>主分类 <select id="ugcSourceCategory">' + options([['', '全部类别'], ...labels], state.category) + '</select></label>' +
      (tags.size ? '<label>来源标签 <select id="ugcSourceTag">' + options([['', '全部标签'], ...[...tags].sort().map(tag => [tag, tag])], state.tag) + '</select></label>' : '') +
      numberControl + '<button type="button" class="button" data-ugc-source-export>导出表格</button></div>';
  }

  function sourceTags(doc, board) {
    const tags = Object.entries(doc.sourceTags || {});
    if (!tags.length) return '';
    const url = new URL(board.sourceUrl);
    if (state.tagTarget) url.searchParams.set('tag', state.tagTarget);
    return '<details class="ugc-source-tags"' + (state.tagTarget ? ' open' : '') + '><summary>Fortnite.GG 全部标签（' + tags.length +
      '）</summary><div><label for="ugcSourceTagTarget">源站标签</label><select id="ugcSourceTagTarget">' + options([['', '全部标签'], ...tags], state.tagTarget) +
      '</select><a href="' + esc(https(url)) + '" data-ugc-source-tag-link target="_blank" rel="noopener noreferrer">在源站查看此排序 ↗</a></div></details>';
  }

  function metricCell(item, column, metric) {
    const value = item.values[column.id];
    const primary = column.id === metric ? ' class="ugc-source-primary"' : '';
    if (column.id === 'versions' && value) {
      return '<td><button class="button ugc-versions-button" type="button" data-ugc-source-versions="' + esc(item.id) +
        '" aria-haspopup="dialog" aria-label="查看 ' + esc(item.title) + ' 的兼容版本">查看版本</button></td>';
    }
    return '<td' + primary + ' title="' + esc(format(value, column, true)) + '">' + esc(format(value, column)) + '</td>';
  }

  function table(board, rows, platform) {
    const visible = rows.slice(0, state.limit);
    const heads = board.columns.map(column => '<th scope="col"' + (column.id === board.metric ? ' class="ugc-source-primary"' : '') + '>' + esc(column.label) + '</th>').join('');
    const body = visible.map(item => {
      const image = UGCCovers.url(item.cover);
      const link = state.options.entryLink(item.id);
      const translation = translationFor(item);
      const title = esc(item.title) + (translation.title ? '<small>（' + esc(translation.title) + '）</small>' : '');
      const tags = item.tags?.slice(0, 4).join(' · ');
      const showIntro = Boolean(translation.intro) || platform === 'cs2';
      const author = platform !== 'cs2' && item.creator ? '<small>' + esc(item.creator) + '</small>' : '';
      const details = author + (showIntro ? '<p class="ugc-source-intro">' + esc(translation.intro || '玩法介绍待补充') + '</p>' : '');
      return '<tr><td class="ugc-rank">' + item.rank + '</td><th scope="row" class="ugc-source-work' + (showIntro ? ' ugc-source-work-with-intro' : '') + '"><div class="ugc-work-heading">' +
        (image ? '<img class="ugc-board-cover" loading="lazy" decoding="async" src="' + esc(image) + '" alt="" data-ugc-cover="' + esc(item.cover) + '">' :
          '<span class="ugc-board-cover-missing">暂缺封面</span>') + '<div class="ugc-work-info">' +
        '<a href="' + esc(link) + '" data-ugc-ranked-entry="' + esc(item.id) + '">' + title + '</a>' +
        details + '<small><span class="ugc-primary-category">' + esc(item.category) + '</span>' + esc(tags) +
        '</small></div></div></th>' + board.columns.map(column => metricCell(item, column, board.metric)).join('') + '</tr>';
    }).join('');
    return '<p class="ugc-source-table-hint">左右滑动查看全部指标。</p><div class="ugc-table-wrap"><table class="ugc-source-table"><caption class="sr-only">' +
      esc(board.source + ' · ' + board.label) + '</caption><thead><tr><th scope="col">名次</th><th scope="col">作品</th>' + heads + '</tr></thead><tbody>' +
      (body || '<tr><td colspan="' + (2 + board.columns.length) + '" class="ugc-empty">筛选范围内暂无作品。</td></tr>') +
      '</tbody></table></div><div class="ugc-footer"><span role="status">已展示 ' + visible.length + ' / ' + rows.length + ' 条</span>' +
      (visible.length < rows.length ? '<button type="button" class="button" data-ugc-source-more>继续显示 25 条</button>' : '') + '</div>';
  }

  function paint() {
    const { options: view, document: doc, board } = state;
    if (!view || !doc) return;
    if (!board) {
      root.innerHTML = view.navigation() + '<p class="ugc-empty" role="status">当前平台暂无可用的来源榜单。</p>';
      return;
    }
    const sourceLink = '<a href="' + esc(https(board.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">查看源站 ↗</a>';
    const time = board.capturedAt ? timestampFormat.format(new Date(board.capturedAt)) + '（北京时间）' : '';
    const statuses = {
      unavailable: '源站暂时无法采集，当前没有可展示的快照。',
      stale: '本次连接未成功，已保留上次成功的快照。',
      partial: '当前显示已核对的部分排名。',
    };
    const counts = board.rows.length ? board.rows.length + ' 条作品' : '';
    const warning = statuses[board.status] || '';
    const header = '<div class="ugc-source-title"><h2>' + esc(board.label) + '</h2><span>' + esc(board.source) + '</span></div><div class="ugc-source-line"><span>' +
      [time, counts].filter(Boolean).map(esc).join(' · ') + '</span>' + sourceLink + '</div><p class="ugc-methodology">' + esc(board.note) + '</p>';
    const chrome = view.navigation(boardPicker(doc, board.id)) + header + (warning ? '<p role="status" class="ugc-warning">' + esc(warning) + '</p>' : '');
    if (view.analysis) {
      const summary = view.platform === 'cs2' && board.rows.length ? categoryStats(board) :
        '<p class="ugc-empty">当前来源榜单暂无类别统计，可切换到近期热榜或历史最热门查看快照分析。</p>';
      root.innerHTML = chrome + '<div class="ugc-analysis">' + summary + '</div>';
      return;
    }
    const content = board.rows.length ? filters(board) + table(board, filteredRows(board, view.query), view.platform) : '';
    root.innerHTML = chrome + sourceTags(doc, board) + content;
  }

  function resetFilters() {
    Object.assign(state, { category: '', tag: '', field: '', min: '', max: '', tagTarget: '', limit: 25, showAllCategories: false });
  }

  async function render(view, refresh = false) {
    const request = ++requestId;
    state.options = view;
    if (previousView?.platform !== view.platform || previousView?.dimension !== view.dimension) resetFilters();
    if (previousView?.query !== view.query) state.limit = 25;
    previousView = view;
    if (!cache.has(view.platform)) root.innerHTML = view.navigation() + '<p class="ugc-empty" role="status">正在读取来源榜单…</p>';
    try {
      const [doc, translations] = await Promise.all([read(view.platform, refresh), view.loadTranslations()]);
      if (request !== requestId) return;
      state.document = doc;
      state.translations = translations;
      state.board = selectedBoard(doc, view.dimension);
      paint();
      view.afterRender();
      if (view.focusSelector) root.querySelector(view.focusSelector)?.focus({ preventScroll: true });
    } catch {
      if (request === requestId) root.innerHTML = view.navigation() + '<p class="ugc-warning" role="status">来源榜单暂时无法读取。<button type="button" data-ugc-source-refresh>重新读取</button></p>';
    }
  }

  function exportCSV() {
    const { board, options } = state;
    const quote = value => {
      const text = typeof value === 'number' ? String(value) : String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&");
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [['来源', '榜单', '采集时间', '名次', '作品', '作者', '作品介绍', '主分类', '来源标签', ...board.columns.map(col => col.label), '作品链接'],
      ...filteredRows(board, options.query).map(row => [board.source, board.label, board.capturedAt, row.rank, row.title, row.creator,
        translationFor(row).intro, row.category,
        row.tags?.join(' / '), ...board.columns.map(col => row.values[col.id]), row.url])];
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    link.href = url;
    link.download = board.id + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showVersions(trigger) {
    const item = state.board.rows.find(row => row.id === trigger.dataset.ugcSourceVersions);
    const versionList = item?.values.versions;
    if (!versionList) return;
    const versions = versionList.split(',').map(version => version.trim()).filter(Boolean);
    const dialog = document.createElement('dialog');
    dialog.className = 'ugc-versions-dialog';
    dialog.setAttribute('aria-labelledby', 'ugcVersionsTitle');
    dialog.innerHTML = '<div class="ugc-versions-header"><div><h3 id="ugcVersionsTitle">兼容游戏版本</h3><p>' +
      esc(item.title) + ' · ' + versions.length + ' 个版本</p></div><form method="dialog"><button type="submit" class="button" autofocus>关闭</button></form></div>' +
      '<ul class="ugc-versions-list">' + versions.map(version => '<li>' + esc(version) + '</li>').join('') + '</ul>';
    root.append(dialog);
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    }, { once: true });
    dialog.showModal();
  }

  root.addEventListener('change', event => {
    if (!state.options) return;
    const control = event.target;
    if (control.id === 'ugcSourceDimension') { state.options.choose(control.value); return; }
    if (control.id === 'ugcSourceTagTarget') {
      state.tagTarget = control.value;
      const url = new URL(state.board.sourceUrl);
      if (control.value) url.searchParams.set('tag', control.value);
      const link = root.querySelector('[data-ugc-source-tag-link]');
      if (link) link.href = https(url);
      return;
    }
    const fields = { ugcSourceCategory: 'category', ugcSourceTag: 'tag', ugcSourceField: 'field', ugcSourceMin: 'min', ugcSourceMax: 'max' };
    const key = fields[control.id];
    if (!key) return;
    state[key] = control.value;
    if (key === 'field') state.min = state.max = '';
    state.limit = 25;
    paint();
    root.querySelector('#' + control.id)?.focus({ preventScroll: true });
  });

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!state.options || !button) return;
    if (button.dataset.ugcSourceCategory) {
      const category = button.dataset.ugcSourceCategory === 'unclassified' ? unknownCategory : button.dataset.ugcSourceCategory;
      state.category = state.category === category ? '' : category;
      state.limit = 25;
      state.options.showRanking('#ugcSourceCategory');
      return;
    }
    if (button.hasAttribute('data-ugc-source-category-more')) {
      state.showAllCategories = !state.showAllCategories;
      paint();
      root.querySelector('[data-ugc-source-category-more]')?.focus({ preventScroll: true });
      return;
    }
    if (button.hasAttribute('data-ugc-source-versions')) { showVersions(button); return; }
    if (button.hasAttribute('data-ugc-source-refresh')) { render(state.options, true); return; }
    if (button.hasAttribute('data-ugc-source-export')) { exportCSV(); return; }
    if (button.hasAttribute('data-ugc-source-more')) {
      state.limit += 25;
      paint();
      root.querySelector('[data-ugc-source-more]')?.focus({ preventScroll: true });
    }
  });

  function cancel() {
    requestId++;
    state.options = null;
  }

  return { render, cancel, findEntry };
})();
