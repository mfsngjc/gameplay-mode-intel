/* The mode library presents the workspace's real records and filters. */
const ModeLibrary = (() => {
  const themeKey = 'gameplay-mode-library-theme';
  const layoutKey = 'gameplay-mode-library-layout';
  const modes = [['all', '全部资料'], ['mode', '模式案例'], ['core_update', '基础更新'], ['ltm', '限时模式']];
  const themedViews = ['home', 'modes', 'games', 'guns', 'maps', 'items', 'skins', 'ugc', 'collection'];
  const groupsByButton = new Map();
  let activeGroup = null;
  let theme = readPreference(themeKey, ['day', 'night']);
  let layout = readPreference(layoutKey, ['text', 'large', 'small']);

  function readPreference(key, values) {
    try {
      const preference = localStorage.getItem(key);
      if (values.includes(preference)) return preference;
    } catch { /* Use the default when storage is unavailable. */ }
    return values[0];
  }

  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Keep the session preference. */ }
  }

  function isLibrary() {
    return state.view === 'modes' && state.modeView === 'library';
  }

  function syncTheme() {
    document.body.dataset.modeTheme = theme;
    $('#modeThemeSwitch').querySelectorAll('[data-mode-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.modeTheme === theme));
    });
  }

  function syncChrome(pending) {
    const themed = themedViews.includes(state.view);
    const library = isLibrary();
    document.body.classList.toggle('archive-view', themed);
    document.body.classList.toggle('modes-view', state.view === 'modes');
    document.body.classList.toggle('mode-library-view', library);
    $('#modeThemeSwitch').hidden = !themed;
    CatalogueNavigation.sync();
    $('#modeDirectory').hidden = pending || state.view !== 'modes';
    $('#modeCaseDirectory').hidden = pending || !library;
    syncTheme();
    for (const id of ['modeRecent', 'modeGameField', 'modeGameplayField', 'modeSearchField', 'modeResetFilters', 'modeLayoutSwitch', 'modeResultControls']) {
      document.getElementById(id).hidden = !library || pending;
    }
    const slot = library ? $('#modeResultControls') : $('#libraryControlsSlot');
    const controls = $('#libraryViewControls');
    if (controls.parentElement !== slot) slot.append(controls);
  }

  function renderOptions(select, pairs, value) {
    const markup = pairs.map(([id, label]) => '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + '</option>').join('');
    if (select._modeOptions !== markup) {
      select.innerHTML = markup;
      select._modeOptions = markup;
    }
    select.value = value;
  }

  function choiceButton(attribute, id, label, count, active) {
    return '<button type="button" ' + attribute + '="' + escapeHtml(id) + '" aria-pressed="' + active +
      '"><span>' + escapeHtml(label) + '</span><small>' + count + '</small></button>';
  }

  function renderDirectory() {
    const games = [['all', '全部游戏'], ...getGames().map(game => [game, game])];
    const definitions = [{ id: 'all', label: '全部玩法' }, ...currentGameplayDefinitions()];
    renderOptions($('#modeGameSelect'), games, state.gameFilter);
    if ($('#modeSearchInput').value !== state.query) $('#modeSearchInput').value = state.query;
    const scoped = state.modes.filter(entry => state.gameFilter === 'all' || entry.game === state.gameFilter);
    const updateCount = scoped.filter(isCoreUpdate).length;
    const counts = [scoped.length, scoped.length - updateCount, updateCount, scoped.filter(isLtmMode).length];
    const kind = state.filter === 'ltm' ? 'ltm' : state.contentFilter;
    $('#modeLibraryKinds').innerHTML = modes.map(([id, label], index) =>
      choiceButton('data-mode-kind', id, label, counts[index], id === kind)).join('');
    const scopedByFilters = scoped.filter(entry => matchesLibraryEntry(entry, { ignoreGameplay: true }));
    const choices = definitions.map(({ id, label }) => {
      const count = id === 'all' ? scopedByFilters.length : scopedByFilters.filter(entry =>
        (state.gameFilter === 'Free Fire' ? getFFPlaylists(entry) : getGameplayTypes(entry)).includes(id)).length;
      return [id, label + '（' + count + '）'];
    });
    renderOptions($('#modeGameplaySelect'), choices, state.gameplayFilter);
  }

  // Use the announcement day for grouping, and keep the individual effective dates on the records.
  function groupByAnnouncement(entries) {
    const groups = [], lookup = new Map();
    for (const entry of entries) {
      const date = entry.publishedDate;
      if (!isCoreUpdate(entry) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        groups.push({ entries: [entry] });
        continue;
      }
      const key = date + '|' + entry.game;
      if (!lookup.has(key)) {
        const group = { key, date, entries: [] };
        lookup.set(key, group);
        groups.push(group);
      }
      lookup.get(key).entries.push(entry);
    }
    return groups;
  }

  function groupTitle(group) {
    const first = group.entries[0];
    return group.entries.length > 1 ? first.game + ' · ' + group.entries.length + ' 项基础更新' : first.modeName;
  }

  function detailAttributes(group, area) {
    if (group.entries.length === 1) {
      return ' data-action="open-mode" data-id="' + escapeHtml(group.entries[0].id) + '"';
    }
    const id = area + '|' + group.key;
    groupsByButton.set(id, group);
    return ' data-mode-update-group="' + escapeHtml(id) + '"';
  }

  function dateLabel(group, announcement = false) {
    const entry = group.entries[0];
    if ((announcement || group.entries.length > 1) && group.date) return group.date.replaceAll('-', '.') + ' · 公告';
    if (isCoreUpdate(entry)) return coreUpdateDateLabel(entry).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1.$2.$3');
    const label = /^\d{4}-\d{2}-\d{2}$/.test(entry.launchDate || '') ? formatActivityDate(entry) : (entry.launchLabel || entry.year);
    return label || '时间待确认';
  }

  function card(group) {
    const entry = group.entries[0];
    const multiple = group.entries.length > 1;
    const title = escapeHtml(groupTitle(group));
    const action = detailAttributes(group, 'list');
    const cover = group.entries.every(item => item.imageUrl === entry.imageUrl) ? safeUrl(entry.imageUrl) : '';
    const summary = multiple ? group.entries.slice(0, 2).map(item => item.modeName).join('；') : entry.oneLineRule;
    const gameplay = [...new Set(group.entries.flatMap(entryGameplayDefinitions).map(def => def.label))].join(' / ');
    const collected = state.collected.has(entry.id);
    const bookmark = multiple ? '' : '<button class="icon-button mode-card-bookmark' + (collected ? ' is-collected' : '') +
      '" type="button" data-action="collect" data-id="' + escapeHtml(entry.id) + '" aria-pressed="' + collected +
      '" aria-label="' + (collected ? '取消收藏 ' : '收藏 ') + title + '">' + icon('bookmark') + '</button>';
    const eyebrow = [multiple ? '' : entry.game, gameplay,
      !multiple && isCoreUpdate(entry) ? '基础更新' : '',
      layout !== 'large' && isLtmMode(entry) ? '限时模式' : ''
    ].filter(Boolean);
    const open = layout === 'text'
      ? '<h3><button class="mode-card-detail" type="button"' + action + '>' + title + '</button></h3>'
      : '<h3>' + title + '</h3>';
    const footer = layout === 'text' ? '' : '<div class="mode-card-footer"><span>' + escapeHtml(dateLabel(group)) +
      '</span><div>' + bookmark + '<button class="mode-card-detail" type="button"' + action +
      ' aria-label="查看详情：' + title + '">查看详情 <span aria-hidden="true">↗</span></button></div></div>';
    return '<article class="mode-library-card" data-mode-detail-surface>' +
      '<div class="mode-library-cover' + (cover ? ' has-image' : '') + '"><span>' + escapeHtml(entry.game) +
      '<small>' + (multiple ? '同日公告' : '暂无案例封面') + '</small></span>' +
      (cover ? '<img src="' + escapeHtml(cover) + '" loading="lazy" width="640" height="360" alt="">' : '') +
      (isLtmMode(entry) ? '<small class="mode-card-ltm" aria-label="限时模式">LTM</small>' : '') + '</div>' +
      '<div class="mode-card-copy"><div class="mode-card-meta">' + eyebrow.map(label => '<span>' + escapeHtml(label) + '</span>').join('') + '</div>' +
      open + '<p>' + escapeHtml(summary) + '</p>' + footer + '</div>' +
      (layout === 'text' ? '<div class="mode-card-timing"><span>' + escapeHtml(dateLabel(group)) + '</span>' + bookmark + '</div>' : '') +
      '</article>';
  }

  function renderRecent() {
    const latest = state.modes.filter(entry => isCoreUpdate(entry) && entry.publishedDate)
      .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
    $('#modeRecentEntries').innerHTML = groupByAnnouncement(latest).slice(0, 4).map(group => {
      const first = group.entries[0];
      return '<article data-mode-detail-surface><time datetime="' + escapeHtml(first.publishedDate) + '">' +
        escapeHtml(dateLabel(group, true)) + '</time><button type="button" class="mode-card-detail"' +
        detailAttributes(group, 'recent') + '>' +
        escapeHtml(group.entries.length > 1 ? groupTitle(group) : first.game + ' · ' + first.modeName) + '</button></article>';
    }).join('');
  }

  function render(entries) {
    renderDirectory();
    $('#modeResetFilters').disabled = !(state.query || state.gameFilter !== 'all' || state.gameplayFilter !== 'all' ||
      state.contentFilter !== 'all' || state.updateCategory !== 'all' || state.topic !== 'all' || state.filter !== 'all');
    groupsByButton.clear();
    renderRecent();
    const groups = groupByAnnouncement(entries);
    if (['newest', 'oldest'].includes(state.sort)) {
      const date = group => group.entries.length > 1 ? Date.parse(group.date + 'T00:00:00') : getDateSortValue(group.entries[0]);
      groups.sort((a, b) => state.sort === 'newest' ? date(b) - date(a) : date(a) - date(b));
    }
    const shown = groups.slice(0, state.limit);
    $('#resultsTitle').textContent = '资料索引';
    $('#resultCount').textContent = groups.length + ' 条' + (groups.length === entries.length ? '' : ' · 含 ' + entries.length + ' 项资料');
    $('#contextNote').hidden = true;
    modeGrid.classList.remove('small-view', 'list-view');
    modeGrid.dataset.modeLayout = layout;
    modeGrid.setAttribute('aria-busy', 'false');
    modeGrid.innerHTML = shown.length ? shown.map(card).join('') :
      '<div class="empty-state"><h3>没有找到匹配的资料</h3><p>试试更短的关键词，或清除筛选。</p><button type="button" class="button" data-reset-filters>清除筛选</button></div>';
    statusLine.textContent = '已展示 ' + shown.length + ' / ' + groups.length + ' 条';
    $('#loadMore').hidden = shown.length === groups.length;
    $('#modeLayoutSwitch').querySelectorAll('[data-mode-layout]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.modeLayout === layout));
    });
  }

  function showGroup(group, trigger) {
    if (!group) return;
    const fromDetail = detailDialog.contains(trigger);
    activeGroup = group;
    detailId = null;
    const title = groupTitle(group);
    setEntryTitle(title);
    $('#detailClose').setAttribute('aria-label', '关闭详情');
    $('#detailClose').title = '关闭详情';
    $('#detailContent').innerHTML = '<div class="detail-inner mode-group-detail"><h2 id="detailTitle">' + escapeHtml(title) +
      '</h2><p class="detail-meta">' + escapeHtml(dateLabel(group)) + '</p>' + group.entries.map(entry => {
        const source = safeUrl(entry.sourceUrl);
        return '<section class="mode-group-change"><h3>' + escapeHtml(entry.modeName) + '</h3><div class="detail-meta">' +
          escapeHtml(coreUpdateDateLabel(entry)) + '</div><p>' + escapeHtml(entry.oneLineRule) +
          '</p><div class="mode-group-actions"><button type="button" class="mode-card-detail" data-action="open-mode" data-id="' +
          escapeHtml(entry.id) + '">查看完整详情 ↗</button>' +
          (source ? '<a href="' + escapeHtml(source) + '" target="_blank" rel="noopener noreferrer">官方来源 ↗</a>' : '') + '</div></section>';
      }).join('') + '</div>';
    showWorkspaceDetailDialog(trigger);
    if (fromDetail) $('#detailClose').focus({ preventScroll: true });
  }

  function refreshFilters() {
    state.limit = 12;
    syncFilterRoute();
    renderWorkspace();
  }

  function changeGame(game) {
    state.gameFilter = game;
    if (!currentGameplayDefinitions().some(def => def.id === state.gameplayFilter)) state.gameplayFilter = 'all';
    refreshFilters();
  }

  function changeGameplay(value) {
    state.gameplayFilter = value;
    refreshFilters();
  }

  function handleClick(target) {
    if (!target) return false;
    if (target.dataset.modeTheme && themedViews.includes(state.view)) {
      theme = target.dataset.modeTheme;
      savePreference(themeKey, theme);
      syncTheme();
      return true;
    }
    if (!isLibrary()) return false;
    if (target.dataset.modeLayout) {
      layout = target.dataset.modeLayout;
      savePreference(layoutKey, layout);
      renderLibrary();
    } else if (target.dataset.modeKind) {
      state.filter = target.dataset.modeKind === 'ltm' ? 'ltm' : 'all';
      state.contentFilter = state.filter === 'ltm' ? 'mode' : target.dataset.modeKind;
      state.updateCategory = 'all';
      $('#typeSelect').value = state.filter;
      refreshFilters();
      $('#modeLibraryKinds [aria-pressed="true"]')?.focus({ preventScroll: true });
    } else if (target.dataset.modeUpdateGroup) {
      showGroup(groupsByButton.get(target.dataset.modeUpdateGroup), target);
    } else if (target.hasAttribute('data-mode-group-back')) {
      history.replaceState(null, '', workspaceHash());
      showGroup(activeGroup, target);
    } else if (target.hasAttribute('data-mode-recent-index')) {
      resetFilters();
      state.contentFilter = 'core_update';
      state.sort = 'newest';
      $('#sortSelect').value = state.sort;
      refreshFilters();
      $('#resultsTitle').focus();
    } else return false;
    return true;
  }

  function clickTarget(event) {
    if (!isLibrary() || event.target.closest('a, button, input, select, textarea, [contenteditable]')) return null;
    const surface = event.target.closest('[data-mode-detail-surface]');
    if (!surface) return null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.containsNode(surface, true)) return null;
    return surface.querySelector('.mode-card-detail');
  }

  function addGroupBack() {
    if (!activeGroup || !isLibrary()) return;
    $('#detailContent .detail-inner')?.insertAdjacentHTML('afterbegin',
      '<button type="button" class="mode-group-back mode-card-detail" data-mode-group-back>← 返回同日更新</button>');
  }

  return {
    isLibrary, syncChrome, render, handleClick, clickTarget, addGroupBack,
    clearGroup: () => { activeGroup = null; },
    bind() {
      $('#modeGameSelect').addEventListener('change', event => changeGame(event.target.value));
      $('#modeGameplaySelect').addEventListener('change', event => changeGameplay(event.target.value));
      $('#modeViewSwitcher').addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
        const current = tabs.indexOf(event.target);
        if (current < 0) return;
        event.preventDefault();
        const offset = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (current + offset + tabs.length) % tabs.length;
        tabs[index].click();
        tabs[index].focus();
      });
    }
  };
})();
