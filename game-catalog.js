const GameCatalog = (() => {
  const platforms = {
    steam: 'Steam', ps4: 'PS4', ps5: 'PS5', 'xbox-one': 'Xbox One', 'xbox-series': 'Xbox Series X|S',
    switch: 'Switch', 'switch-2': 'Switch 2', 'epic-pc': 'Epic Games Store', 'pc-standalone': 'PC 官网', mobile: '移动端'
  };
  const families = {
    steam: { name: 'Steam', platforms: ['steam'] },
    xbox: { name: 'Xbox', platforms: ['xbox-one', 'xbox-series'] },
    nintendo: { name: 'Nintendo', platforms: ['switch', 'switch-2'] },
    playstation: { name: 'PlayStation', platforms: ['ps4', 'ps5'] },
    other: { name: '其他平台', platforms: ['epic-pc', 'pc-standalone', 'mobile'] }
  };
  const gameplay = {
    team: '团队竞技', tactical: '战术攻防', hero: '英雄射击', battlefield: '大战场',
    'battle-royale': '大逃杀', extraction: '搜打撤', survival: '生存建造', coop: '合作 PvE',
    loot: '刷装备', campaign: '剧情战役', adventure: '射击冒险',
    horror: '生存恐怖', vehicles: '载具射击', roguelite: '肉鸽闯关'
  };
  const number = new Intl.NumberFormat('zh-CN');
  const dateTime = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const steamCharts = {
    players: ['在线人数', 'Steam 全站按快照中的同时在线人数排序。'],
    sellers: ['全球畅销', 'Steam 全球营收排名，计入游戏购买、DLC 和游戏内消费。'],
    latest: ['最新发行', 'Steam 商店游戏列表，按发行日由近到远排列。'],
    trending: ['热门新品', '沿用 Steam 商店「热门新品」的排序，可能包含此前已发行的作品。']
  };
  const steamStore = 'https://store.steampowered.com';
  const chartPreview = 6;
  let chartBoards = {};
  let chartReleases = new Map();
  let releaseStore = {};
  let chart = 'players';
  let chartScope = 'all';
  let expandedChart = false;
  let detailTab = 'overview';
  let selectedGame = '';
  let stopHistory;
  let renderedChart = '';
  let gamesBySteamId = new Map();
  let shooterChartExclusions = new Set();
  let games = [];
  let media = {};
  let metrics = {};
  let series = {};
  let seriesForGame = new Map();
  let visibleSeries = new Map();
  let expandedSeriesId = '';
  let platform = 'all';
  let gameplayType = 'all';
  let sort = 'recommended';
  let direction = 'desc';
  let renderedHash = '';

  function setData(data, imageRecords = {}, metricRecords = {}, charts = {}) {
    if (!Array.isArray(data?.games)) throw new Error('游戏图鉴资料格式有误');
    games = data.games;
    media = imageRecords;
    metrics = metricRecords;
    chartBoards = charts?.schemaVersion === 1 ? charts.boards || {} : {};
    chartReleases = new Map();
    for (const key of ['latest', 'trending', 'sellers', 'players']) {
      for (const row of chartBoards[key]?.entries || []) {
        if (row.type === 'app' && (row.releaseDate || row.releaseUpcoming)) chartReleases.set(row.id, row);
      }
    }
    releaseStore = charts?.schemaVersion === 1 ? charts.releaseStore || charts.latestStore || {} : {};
    shooterChartExclusions = new Set(data.steamShooterChartExclusions);
    gamesBySteamId = new Map();
    for (const game of games) {
      const appId = catalogSteamAppId(game);
      if (!appId) continue;
      // A shared storefront should never lead to an arbitrary edition.
      gamesBySteamId.set(appId, gamesBySteamId.has(appId) ? null : game);
    }
    series = data.series || {};
    seriesForGame = new Map(Object.entries(series).flatMap(([id, group]) => group.games.map(game => [game, id])));
    renderedHash = '';
    renderedChart = '';
    $('#gameCatalogDate').textContent = '平台核查于 ' + data.checkedAt;
  }

  function familyFor(id) {
    return Object.keys(families).find(key => key === id || families[key].platforms.includes(id));
  }

  function readRoute(params) {
    const requestedPlatform = params.get('platform');
    const requestedGameplay = params.get('gameplay');
    platform = Object.hasOwn(platforms, requestedPlatform) || Object.hasOwn(families, requestedPlatform) ? requestedPlatform : 'all';
    gameplayType = Object.hasOwn(gameplay, requestedGameplay) ? requestedGameplay : 'all';
    const requestedChart = params.get('chart');
    const next = Object.hasOwn(steamCharts, requestedChart) ? requestedChart : 'players';
    const nextScope = params.get('scope') === 'shooters' ? 'shooters' : 'all';
    if (chart !== next || chartScope !== nextScope) expandedChart = false;
    chart = next;
    chartScope = nextScope;
    if (requestedChart || nextScope === 'shooters') $('#steamChartDisclosure').open = true;
    detailTab = params.get('tab') === 'data' ? 'data' : 'overview';
    const sortKey = params.get('sort');
    sort = ['online', 'approval'].includes(sortKey) ? sortKey : 'recommended';
    direction = sort !== 'recommended' && params.get('direction') === 'asc' ? 'asc' : 'desc';
  }

  function reset() {
    platform = 'all';
    gameplayType = 'all';
    sort = 'recommended';
    direction = 'desc';
    expandedSeriesId = '';
  }

  function hash(id, includeChart = true) {
    const params = new URLSearchParams();
    if (platform !== 'all') params.set('platform', platform);
    if (gameplayType !== 'all') params.set('gameplay', gameplayType);
    if (includeChart && chart !== 'players') params.set('chart', chart);
    if (includeChart && chartScope === 'shooters') params.set('scope', chartScope);
    if (sort !== 'recommended') params.set('sort', sort);
    if (sort !== 'recommended' && direction === 'asc') params.set('direction', direction);
    if (state.query) params.set('q', state.query);
    if (id) {
      params.set('entry', id);
      if (detailTab === 'data') params.set('tab', 'data');
    }
    return '#games' + (params.size ? '?' + params.toString() : '');
  }

  function external(label, url, className = '') {
    const href = safeUrl(url);
    if (!href.startsWith('https://')) return '';
    return '<a' + (className ? ' class="' + className + '"' : '') + ' href="' + escapeHtml(href) +
      '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + (className ? icon('external-link') : '') + '</a>';
  }

  function steamAppId(url) {
    return Number(/^https:\/\/store\.steampowered\.com\/app\/([1-9]\d{0,9})(?:[/?#]|$)/.exec(url)?.[1]);
  }

  function catalogSteamAppId(game) {
    if (!game.platforms.includes('steam')) return;
    return game.sources.map(({url}) => steamAppId(url)).find(Boolean) ||
      steamAppId(metrics[game.id]?.release?.source) || metrics[game.id]?.steamAppId;
  }

  function isChartShooter(game) {
    return game && !shooterChartExclusions.has(game.id);
  }

  function catalogSteamRelease(game, appId) {
    const release = metrics[game?.id]?.release;
    if (release && steamAppId(release.source) === appId) return release;
  }

  function shooterReleases() {
    const rows = [];
    for (const [id, game] of gamesBySteamId) {
      if (!isChartShooter(game)) continue;
      const release = catalogSteamRelease(game, id);
      if (release?.upcoming !== false || !/^\d{4}-\d{2}-\d{2}$/.test(release.date)) continue;
      rows.push({id, type: 'app', name: game.name, releaseDate: release.date, url: release.source});
    }
    return rows.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function steamClient(appId, label = '客户端', className = '') {
    if (!Number.isInteger(appId) || appId < 1 || appId >= 10 ** 10) return '';
    return '<a' + (className ? ' class="' + className + '"' : '') +
      ' href="steam://store/' + appId + '">' + escapeHtml(label) + '</a>';
  }

  function releaseStoreCells(store) {
    const review = store?.review;
    const checkedAt = Date.parse(store?.checkedAt);
    const title = Number.isFinite(checkedAt) ?
      ' title="' + escapeHtml('Steam 读取于 ' + dateTime.format(checkedAt) + '（北京时间）') + '"' : '';
    const cell = value => '<td class="steam-chart-value"' + title + '>' + value + '</td>';
    const approval = review?.total > 0 ? number.format(review.percent) + '%' +
      (review.label ? ' <small>' + escapeHtml(review.label) + '</small>' : '') : review ? '暂无评测' : '—';
    return cell(escapeHtml(store?.price || (store ? '暂无报价' : '—'))) +
      cell(review ? number.format(review.total) : '—') + cell(approval);
  }

  function chartReleaseDate(row, game) {
    const listed = row.releaseDate || row.releaseUpcoming ? row :
      row.type === 'app' ? chartReleases.get(row.id) : undefined;
    if (listed) return releaseDate({
      date: listed.releaseDate, upcoming: listed.releaseUpcoming, status: listed.releaseUpcoming ? '待公布' : ''
    });
    const release = catalogSteamRelease(game, row.id);
    if (/^\d{4}-\d{2}-\d{2}$/.test(release?.date)) return releaseDate(release);
    return release?.upcoming ? '待公布' : '—';
  }

  function renderCharts() {
    const board = chartBoards[chart];
    const [label, scope] = steamCharts[chart];
    const onlyShooters = chartScope === 'shooters';
    const online = chart === 'players';
    const catalogReleases = onlyShooters && chart === 'latest';
    const top = onlyShooters && online ? SteamActivity.top() : null;
    const date = board?.checkedAt;
    const initial = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const readTime = !Number.isFinite(Date.parse(date)) ? '' : initial ? '核对于 ' + date :
      '读取于 ' + dateTime.format(new Date(date)) + ' 北京时间';
    $('#steamChartOptions').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.steamChart === chart));
    });
    $('#steamChartScope').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.steamScope === chartScope));
    });
    const snapshotRows = (Array.isArray(board?.entries) ? board.entries : []).filter(row =>
      ['app', 'sub', 'bundle'].includes(row.type) && Number.isInteger(row.id) && row.id > 0 && row.id < 10 ** 10);
    let rows = snapshotRows;
    if (top) rows = top.entries.filter(row => isChartShooter(gamesBySteamId.get(row.id)))
      .map(row => ({ ...row, type: 'app' }));
    else if (catalogReleases) rows = shooterReleases();
    else if (onlyShooters) rows = snapshotRows.filter(row => row.type === 'app' && isChartShooter(gamesBySteamId.get(row.id)));
    const count = expandedChart || top ? rows.length : chartPreview;
    const sampleCoverage = onlyShooters && snapshotRows.length ?
      'Steam 快照 ' + snapshotRows.length + ' 条，匹配图鉴射击游戏 ' + rows.length + ' 款' : '';
    let meta;
    if (top) {
      meta = 'Steam 射击游戏前 ' + rows.length + ' · 同一小时内采样 ' +
        top.sampledGames + '/' + top.eligibleGames + ' 款图鉴游戏 · ' + dateTime.format(new Date(top.hour)) + '（北京时间）';
    } else {
      meta = catalogReleases ?
        '按图鉴已核实的 Steam 发行日期排序 · ' + rows.length + ' 款' :
        [scope, sampleCoverage, readTime].filter(Boolean).join(' · ');
    }
    $('#steamChartMeta').textContent = meta + ' · Steam 累计评测（全部语言）';
    $('#steamChartSource').innerHTML = top ? external('Steam Charts', top.source) :
      catalogReleases ? '' : external('Steam 原榜', board?.source);
    const source = $('#steamChartRows');
    source.classList.toggle('steam-chart-top-20', Boolean(top));
    if (rows.length) {
      source.tabIndex = 0;
      source.setAttribute('role', 'region');
      source.setAttribute('aria-label', top ? 'Steam 射击游戏在线人数前 20' : 'Steam ' + label + '榜单');
    } else {
      source.removeAttribute('tabindex');
      source.removeAttribute('role');
      source.removeAttribute('aria-label');
    }
    let empty = '暂无这张榜的快照。';
    if (catalogReleases) empty = '暂无已核实的射击游戏 Steam 发行日期。';
    else if (onlyShooters && snapshotRows.length) empty = '这份快照中没有匹配图鉴的射击游戏。';
    source.innerHTML = rows.length ? '<table><thead><tr><th scope="col">' + (onlyShooters ? '射击榜' : '排名') +
      '</th><th scope="col">名称</th>' +
      (online ? '<th scope="col">' + (top ? '同时在线' : '同时在线 / 当日峰值') + '</th>' : '') +
      '<th scope="col">发售日期</th><th scope="col">国区售价</th><th scope="col">评价数</th><th scope="col">好评率</th>' +
      '<th scope="col">打开</th></tr></thead><tbody>' +
      rows.slice(0, count).map((row, index) => {
        const app = row.type === 'app';
        const game = app && gamesBySteamId.get(row.id);
        const name = escapeHtml(game?.name || row.name);
        const title = game ? '<button type="button" data-game-catalog-entry="' + escapeHtml(game.id) +
          '">' + name + '</button>' : '<span>' + name + '</span>';
        let playersCell = '';
        if (online) {
          const sample = top ? ' title="' + escapeHtml(dateTime.format(new Date(row.sampledAt)) + ' 北京时间') + '"' : '';
          const peak = top ? '' : '<small> / ' + number.format(row.peak) + '</small>';
          playersCell = '<td class="steam-chart-value"><strong' + sample + '>' +
            number.format(row.players) + '</strong>' + peak + '</td>';
        }
        const rank = onlyShooters ? index + 1 : row.rank;
        const steamRank = onlyShooters && !catalogReleases && !top ?
          '<small class="steam-chart-original-rank">Steam #' + escapeHtml(row.rank) + '</small>' : '';
        return '<tr><td>' + escapeHtml(rank) + steamRank + '</td><th scope="row">' + title + '</th>' +
          playersCell + '<td class="steam-chart-value">' + escapeHtml(chartReleaseDate(row, game)) + '</td>' +
          releaseStoreCells(app ? releaseStore[row.id] : undefined) +
          '<td><span class="steam-chart-links">' + external('网页', row.url || steamStore + '/' + row.type + '/' + row.id + '/') +
          (app ? steamClient(row.id) : '') + '</span></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="steam-chart-empty">' + empty + '</p>';
    const toggle = $('#steamChartMore');
    toggle.hidden = Boolean(top) || rows.length <= chartPreview;
    toggle.setAttribute('aria-expanded', String(expandedChart));
    toggle.textContent = expandedChart ? '收起榜单' : '展开 ' + rows.length + ' 条';
    renderedChart = chart + ':' + chartScope;
    updateSelected(source);
  }

  function updateSelected(root) {
    for (const button of root.querySelectorAll('[data-game-catalog-entry]')) {
      const selected = button.dataset.gameCatalogEntry === selectedGame;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', String(selected));
      button.closest('article, tr')?.classList.toggle('is-selected', selected);
    }
  }

  function selectGame(id = '') {
    selectedGame = id;
    updateSelected($('#gamesSection'));
  }

  function platformTags(game, showNotes = false) {
    return game.platforms.map((id) => {
      const note = showNotes && game.platformNotes?.[id];
      return '<span class="tag">' + escapeHtml(platforms[id] + (note ? '（' + note + '）' : '')) + '</span>';
    }).join('');
  }

  function gameplayTags(game) {
    return game.gameplayTypes.map((id) => '<span class="gameplay-chip">' + escapeHtml(gameplay[id]) + '</span>').join('');
  }

  function onlineSnapshot(game) {
    const entry = metrics[game.id] || {};
    const shared = series[seriesForGame.get(game.id)]?.sharedOnline;
    const sharedSample = shared?.games.includes(game.id) ? metrics[shared.recordGame]?.sharedOnline : null;
    return entry.online || entry.steamOnline || sharedSample;
  }

  function onlineCount(online) {
    return online ? (online.approximate ? '约 ' : '') + number.format(online.players) : '—';
  }

  function releaseDate(release) {
    if (!release?.date) return release?.status || '—';
    return (release.upcoming ? '预计 ' : '') + release.date;
  }

  function cardFacts(game) {
    const entry = metrics[game.id] || {};
    const online = onlineSnapshot(game);
    const rating = entry.storeRating || entry.ign;
    const score = entry.steamReview ? entry.steamReview.percent + '%' : rating ? rating.score + '/' + rating.outOf : '—';
    const scoreLabel = entry.steamReview ? 'Steam 好评率' : entry.storeRating?.label || (entry.ign ? 'IGN 评分' : '游戏评分');
    const sample = online ? ' title="' + escapeHtml(onlineNote(online, entry.steamEdition)) + '"' : '';
    const release = entry.release;
    const update = entry.updates?.[0];
    const fact = (label, value, attributes = '') => '<span><span class="game-catalog-fact-label">' + escapeHtml(label) +
      '</span><strong' + attributes + '>' + escapeHtml(value) + '</strong></span>';
    return '<span class="game-catalog-facts">' +
      fact(scoreLabel, score) +
      fact(online ? (online.label || 'Steam') + ' 在线' : '同时在线', onlineCount(online), sample) +
      fact(release?.label || '发行日期', releaseDate(release)) +
      fact('最近更新', update?.date || '—') + '</span>';
  }

  function cover(game) {
    const source = safeUrl(media[game.id]?.cover);
    return source ? '<img class="game-catalog-cover" src="' + escapeHtml(source) + '" alt="" loading="lazy" decoding="async">' : '';
  }

  function gameIntro(game) {
    return '<dl class="game-catalog-intro">' +
      '<div><dt>世界观与故事</dt><dd>' + escapeHtml(game.story || game.setting) + '</dd></div>' +
      '<div><dt>核心玩法</dt><dd>' + escapeHtml(game.gameplay) + '</dd></div></dl>';
  }

  function gameplaySummary(game) {
    return game.gameplay ? '<p class="game-catalog-summary">' + escapeHtml(game.gameplay) + '</p>' : '';
  }

  function card(game) {
    return '<article class="game-catalog-card">' + cover(game) + '<div class="game-catalog-card-body">' +
      '<div class="game-catalog-card-copy"><div><h3><button type="button" data-game-catalog-entry="' + escapeHtml(game.id) + '">' +
      '<span>' + escapeHtml(game.name) + '</span>' + icon('arrow-up-right') + '</button></h3>' +
      (game.originalName ? '<p class="game-catalog-original">' + escapeHtml(game.originalName) + '</p>' : '') + '</div>' +
      '<div class="game-catalog-tags">' + gameplayTags(game) + '</div>' +
      gameplaySummary(game) + '</div>' + cardFacts(game) +
      '<div class="game-catalog-card-footer"><div class="tag-row">' + platformTags(game) + '</div></div></div></article>';
  }

  function seriesRepresentative(id, entries) {
    const coverId = series[id].coverGame;
    return entries.find(game => game.id === coverId) ||
      [...entries].reverse().find(game => media[game.id]?.cover) || entries[0];
  }

  function seriesCard(id, entries, representative) {
    const group = series[id];
    const expanded = expandedSeriesId === id;
    const others = entries.filter(game => game.id !== representative.id);
    const previewNames = others.slice(0, 3).map(game => game.name);
    const remaining = others.length - previewNames.length;
    const names = previewNames.length ? escapeHtml(previewNames.join(' · ')) +
      (remaining ? ' · 另 ' + remaining + ' 款' : '') : '';
    return '<article class="game-catalog-series" data-catalog-series="' + escapeHtml(id) + '">' + cover(representative) +
      '<div class="game-catalog-card-body"><div class="game-catalog-card-copy">' +
      '<button class="game-catalog-series-caption" type="button" data-catalog-series-toggle="' + escapeHtml(id) +
      '" aria-expanded="' + expanded + '"' + (expanded ? ' aria-controls="gameCatalogSeries-' + escapeHtml(id) + '"' : '') + '>' +
      '<strong>' + escapeHtml(group.name) + '</strong><small>' + entries.length + ' 款</small></button>' +
      '<span class="game-catalog-series-feature">' + escapeHtml(representative.name) + '</span>' +
      gameplaySummary(representative) + '</div>' + cardFacts(representative) +
      (names ? '<div class="game-catalog-card-footer game-catalog-series-names">' + names + '</div>' : '') + '</div></article>';
  }

  function seriesRow(id, entries) {
    const row = document.createElement('section');
    row.className = 'game-catalog-series-row';
    row.dataset.catalogSeriesRow = id;
    row.id = 'gameCatalogSeries-' + id;
    row.setAttribute('aria-label', series[id].name + '作品');
    row.innerHTML = '<h3>' + escapeHtml(series[id].name) + '作品</h3>' +
      '<div class="game-catalog-series-entries">' + entries.map(game => {
        const label = game.edition ? '<span class="game-catalog-edition">' + escapeHtml(game.edition) + '</span>' : '';
        return '<article class="game-catalog-edition-card">' + cover(game) +
          '<div class="game-catalog-card-body"><div class="game-catalog-card-copy">' + label +
          '<h3><button type="button" data-game-catalog-entry="' + escapeHtml(game.id) + '">' +
          escapeHtml(game.name) + icon('arrow-up-right') + '</button></h3>' +
          gameplaySummary(game) + '</div>' + cardFacts(game) +
          '<div class="game-catalog-card-footer"><div class="tag-row">' + platformTags(game) + '</div></div></div></article>';
      }).join('') + '</div>';
    return row;
  }

  function placeSeriesRow() {
    const grid = $('#gameCatalogGrid');
    const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    const cards = [...grid.querySelectorAll(':scope > .game-catalog-card, :scope > .game-catalog-series')];
    const index = cards.findIndex(card => card.dataset.catalogSeries === expandedSeriesId);
    if (index < 0) return;
    const rowEnd = Math.min(cards.length - 1, Math.ceil((index + 1) / columns) * columns - 1);
    const anchor = cards[rowEnd];
    const currentRow = grid.querySelector(':scope > .game-catalog-series-row');
    const row = currentRow || seriesRow(expandedSeriesId, visibleSeries.get(expandedSeriesId));
    if (anchor.nextElementSibling !== row) anchor.after(row);
    if (!currentRow) updateSelected(row);
  }

  function toggleSeries(id, open) {
    const grid = $('#gameCatalogGrid');
    const toggle = grid.querySelector('[data-catalog-series-toggle="' + id + '"]');
    if (!toggle || open === (expandedSeriesId === id)) return;
    if (expandedSeriesId) {
      const previous = grid.querySelector('[data-catalog-series-toggle="' + expandedSeriesId + '"]');
      previous?.setAttribute('aria-expanded', 'false');
      previous?.removeAttribute('aria-controls');
      grid.querySelector(':scope > .game-catalog-series-row')?.remove();
    }
    expandedSeriesId = open ? id : '';
    if (open) {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-controls', 'gameCatalogSeries-' + id);
      placeSeriesRow();
    }
  }

  function renderEntries(matches) {
    const grid = $('#gameCatalogGrid');
    const byId = new Map(matches.map(game => [game.id, game]));
    visibleSeries = new Map();
    const cards = [];
    for (const game of matches) {
      const id = seriesForGame.get(game.id);
      if (!id) {
        cards.push({game});
      } else if (!visibleSeries.has(id)) {
        const entries = series[id].games.map(gameId => byId.get(gameId)).filter(Boolean);
        visibleSeries.set(id, entries);
        cards.push({id, game: seriesRepresentative(id, entries)});
      }
    }
    if (sort !== 'recommended') {
      const read = sort === 'online'
        ? game => onlineSnapshot(game)?.players
        : game => metrics[game.id]?.steamReview?.percent;
      const sign = direction === 'asc' ? 1 : -1;
      cards.sort((a, b) => {
        const left = read(a.game), right = read(b.game);
        if (left == null) return right == null ? 0 : 1;
        if (right == null) return -1;
        return (left - right) * sign;
      });
    }
    if (!visibleSeries.has(expandedSeriesId)) expandedSeriesId = '';
    grid.innerHTML = cards.length ? cards.map(({id, game}) => id ? seriesCard(id, visibleSeries.get(id), game) : card(game)).join('') :
      '<div class="empty-state">' + icon('search') + '<h3>没有符合条件的游戏</h3><p>可切换平台、玩法，或修改搜索词。</p></div>';
    if (expandedSeriesId) placeSeriesRow();
    updateSelected(grid);
  }

  function metricCell(label, value, subtext, details = {}) {
    const source = external(details.sourceText || '来源', details.source);
    return '<div class="game-catalog-metric"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd>' +
      '<div class="game-catalog-metric-note"' + (details.online ? ' data-catalog-online-note' : '') + '>' +
      escapeHtml(subtext) + (source ? ' · ' + source : '') + '</div></div>';
  }

  function onlineNote(data, edition) {
    const scope = data.coverage || {chart:'Steam 榜单', app:'Steam 公开接口', tracker:'Steam Charts 采样'}[data.scope];
    const time = dateTime.format(new Date(data.checkedAt));
    return scope + ' · ' + time + ' 北京时间' + (edition && !data.coverage ? ' · ' + edition : '');
  }

  function detailMetrics(game) {
    const entry = metrics[game.id] || {};
    const {steamEdition, steamReview, sales, ign, release, storeRating} = entry;
    const online = onlineSnapshot(game);
    const reviewScope = steamReview?.scope === 'English Reviews' ? '英文评测' :
      steamReview?.scope === 'All Reviews' ? '全部评测' : steamReview?.scope || '公开评测';
    const salesValue = sales ? (sales.qualifier || '') + number.format(sales.units) + ' 份' : '—';
    const modes = '<dl class="game-catalog-metrics" data-game-metrics="' + escapeHtml(game.id) + '">' +
      metricCell(online ? (online.label || 'Steam') + ' 同时在线' : '同时在线', onlineCount(online),
        online ? onlineNote(online, steamEdition) : '暂无可核实的在线数据',
        {online:true,source:online?.source}) +
      metricCell(release?.label || '发行日期', releaseDate(release),
        release ? (release.upcoming ? '公布的发行计划' : '官方发行信息') : '暂无可核实的发行日期',
        {source:release?.source}) +
      metricCell(sales?.kind === 'shipments' ? '官方累计出货' : '官方累计销量', salesValue,
        sales ? sales.scope + ' · ' + sales.date : '暂无可核实的单作销量', {source:sales?.source}) +
      metricCell('Steam 好评率', steamReview ? steamReview.percent + '%' : '—',
        steamReview ? reviewScope + ' ' + number.format(steamReview.total) + ' 条 · ' + dateTime.format(new Date(steamReview.checkedAt)) +
          ' 北京时间' + (steamEdition ? ' · ' + steamEdition : '') :
          game.platforms.includes('steam') ? '暂无可核实评分' : '无 Steam 版本', {source:steamReview?.source}) +
      metricCell('IGN 编辑评分', ign ? ign.score + ' / ' + ign.outOf : '—',
        ign ? (ign.edition || '媒体评测') : '暂无可核实的 IGN 评测', {source:ign?.source,sourceText:'原文'}) +
      (storeRating ? metricCell(storeRating.label, storeRating.score + ' / ' + storeRating.outOf,
        storeRating.scope, {source:storeRating.source}) : '') + '</dl>';
    return '<section class="detail-section"><h3>玩家数据与评分</h3>' + modes + '</section>';
  }

  function recentUpdates(game) {
    const updates = metrics[game.id]?.updates || [];
    const list = updates.map(update => '<li><time datetime="' + escapeHtml(update.date) + '">' + escapeHtml(update.date) +
      '</time>' + SteamActivity.announcementCard(update, media[game.id]) + '</li>').join('');
    return '<section class="detail-section"><h3>近期更新</h3>' +
      (list ? '<ol class="game-catalog-updates">' + list + '</ol>' : '<p>暂无已核实的更新公告。</p>') + '</section>';
  }

  function gallery(game) {
    const record = media[game.id];
    if (!record) return '';
    const images = record.images.map((image, i) => {
      const original = safeUrl(image.url);
      const thumb = safeUrl(image.thumb || image.url);
      if (!original.startsWith('https://') || !thumb.startsWith('https://')) return '';
      const alt = game.name + '官方宣传图 ' + (i + 1);
      return '<a href="' + escapeHtml(original) + '" target="_blank" rel="noopener noreferrer"><img src="' +
        escapeHtml(thumb) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async"></a>';
    }).join('');
    return '<section class="detail-section"><h3>官方宣传图</h3><p class="game-catalog-image-credit">' +
      external('图片来源',record.source) + ' · ' + external('查看封面原图',record.coverOriginal) +
      '</p>' + (images ? '<div class="game-catalog-gallery">' + images + '</div>' : '') + '</section>';
  }

  function detail(game) {
    const seriesId = seriesForGame.get(game.id);
    if (seriesId) toggleSeries(seriesId, true);
    const sourceLinks = game.sources.map(({label,url}) => external(label,url,'button')).join('');
    const appId = catalogSteamAppId(game);
    const clientLink = steamClient(appId, '在 Steam 客户端打开', 'button');
    const edition = [series[seriesId]?.name, game.edition].filter(Boolean).join(' · ');
    return '<div class="detail-inner game-catalog-detail">' +
      (edition ? '<p class="game-catalog-edition">' + escapeHtml(edition) + '</p>' : '') +
      '<h2 id="detailTitle">' + escapeHtml(game.name) + '</h2>' +
      (game.originalName ? '<p class="game-catalog-original">' + escapeHtml(game.originalName) + '</p>' : '') +
      '<div class="gameplay-filters game-detail-tabs" role="tablist" aria-label="游戏详情">' +
      '<button class="gameplay-filter" type="button" id="gameOverviewTab" data-game-detail-tab="overview" role="tab" aria-controls="gameOverviewPanel" aria-selected="true">概览</button>' +
      '<button class="gameplay-filter" type="button" id="gameDataTab" data-game-detail-tab="data" role="tab" aria-controls="gameDataPanel" aria-selected="false" tabindex="-1">数据</button></div>' +
      '<div id="gameOverviewPanel" role="tabpanel" aria-labelledby="gameOverviewTab">' +
      gameIntro(game) +
      '<div class="detail-taxonomy"><span>玩法类型</span>' + gameplayTags(game) + '</div>' + cover(game) +
      (game.editionNote ? '<section class="detail-section"><h3>这一作的特点</h3><p>' + escapeHtml(game.editionNote) + '</p></section>' : '') +
      '<section class="detail-section"><h3>支持平台</h3><div class="tag-row">' + platformTags(game, true) + '</div></section>' +
      detailMetrics(game) + recentUpdates(game) + gallery(game) +
      '<section class="detail-section"><h3>官方介绍与来源</h3><div class="detail-actions">' + sourceLinks + clientLink + '</div></section></div>' +
      '<div id="gameDataPanel" role="tabpanel" aria-labelledby="gameDataTab" hidden></div></div>';
  }

  function mountDetail(game) {
    stopHistory?.();
    stopHistory = undefined;
    selectGame(game.id);
    const root = $('#detailContent');
    const tabs = [...root.querySelectorAll('[data-game-detail-tab]')];
    const overview = $('#gameOverviewPanel');
    const data = $('#gameDataPanel');
    let historyMounted = false;

    function activate(tab, focus = false) {
      detailTab = tab;
      for (const button of tabs) {
        const selected = button.dataset.gameDetailTab === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
      }
      overview.hidden = tab !== 'overview';
      data.hidden = tab !== 'data';
      if (tab === 'data' && !historyMounted) {
        const shared = series[seriesForGame.get(game.id)]?.sharedOnline;
        const sharedAppId = shared?.games.includes(game.id) ? 1938090 : undefined;
        stopHistory = SteamActivity.mount(data, catalogSteamAppId(game),
          metrics[game.id]?.updates || [], sharedAppId, metrics[game.id]?.steamEdition, media[game.id]);
        historyMounted = true;
      }
      if (focus) history.replaceState(null, '', hash(game.id));
    }
    for (const button of tabs) {
      button.addEventListener('click', () => activate(button.dataset.gameDetailTab, true));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const target = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'data' :
          button.dataset.gameDetailTab === 'overview' ? 'data' : 'overview';
        activate(target, true);
      });
    }
    activate(detailTab);
  }

  function clearDetail() {
    stopHistory?.();
    stopHistory = undefined;
    detailTab = 'overview';
    selectGame();
  }

  async function refreshOnline(game) {
    const entry = metrics[game.id];
    const host = $('[data-game-metrics]');
    if (!entry?.steamAppId || entry.online || onlineSnapshot(game)?.scope === 'shared-launcher' ||
        !host || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
    try {
      const response = await fetch('api/shooter-games/steam/' + entry.steamAppId, {cache:'no-store'});
      if (!response.ok || response.status === 204) return;
      const data = await response.json();
      if (!Number.isInteger(data.players) || !host.isConnected ||
          Date.parse(data.checkedAt) < Date.parse(entry.steamOnline?.checkedAt)) return;
      host.querySelector('[data-catalog-online-note]').parentElement.querySelector('dd').textContent = number.format(data.players);
      host.querySelector('[data-catalog-online-note]').innerHTML = escapeHtml(onlineNote(data, entry.steamEdition)) + ' · ' + external('来源',data.source);
    } catch { /* Static hosting continues to show the dated snapshot. */ }
  }

  function render() {
    if (renderedChart !== chart + ':' + chartScope) renderCharts();
    // Preserve the focused card when the route only opens or closes a detail.
    const listHash = hash(undefined, false);
    if (renderedHash === listHash) return;
    const platformIds = families[platform]?.platforms || [platform];
    const words = state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = games.filter(game => {
      if (platform !== 'all' && !game.platforms.some(id => platformIds.includes(id))) return false;
      if (gameplayType !== 'all' && !game.gameplayTypes.includes(gameplayType)) return false;
      if (!words.length) return true;
      const searchable = [game.name, game.originalName, game.gameplay, game.setting, game.editionNote, game.story,
        series[seriesForGame.get(game.id)]?.name, ...game.platforms.map(id => platforms[id]),
        ...game.gameplayTypes.map(id => gameplay[id])].join(' ').toLocaleLowerCase();
      return words.every(word => searchable.includes(word));
    });
    const familyId = familyFor(platform) || 'all';
    $('#gameCatalogPlatforms').querySelectorAll('button').forEach(button => {
      const active = button.dataset.catalogPlatform === familyId;
      button.setAttribute('aria-pressed', String(active));
      if (button.hasAttribute('aria-controls')) button.setAttribute('aria-expanded', String(active));
    });
    const subfamily = families[familyId];
    const showSubplatforms = subfamily?.platforms.length > 1;
    const subplatforms = $('#gameCatalogSubplatforms');
    if (subplatforms.dataset.family !== familyId) {
      subplatforms.innerHTML = showSubplatforms ? [familyId, ...subfamily.platforms].map(id => {
        const label = id === familyId ? '全部 ' + subfamily.name : platforms[id];
        return '<button type="button" class="gameplay-filter" data-catalog-platform="' + id + '">' + escapeHtml(label) + '</button>';
      }).join('') : '';
      subplatforms.dataset.family = familyId;
    }
    $('#gameCatalogSubplatformRow').hidden = !showSubplatforms;
    subplatforms.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.catalogPlatform === platform));
    });
    $('#gameCatalogGameplay').value = gameplayType;
    $('#gameCatalogCount').textContent = '显示 ' + matches.length + ' / ' + games.length + ' 款';
    $('#gameCatalogSort').value = sort;
    $('#gameCatalogDirection').value = direction;
    $('#gameCatalogDirection').hidden = sort === 'recommended';
    $('#gameCatalogDirection').disabled = sort === 'recommended';
    $('#gameCatalogReset').disabled = platform === 'all' && gameplayType === 'all' && sort === 'recommended' && !state.query;
    renderEntries(matches);
    renderedHash = listHash;
  }

  function bind() {
    const chartOptions = $('#steamChartOptions');
    chartOptions.innerHTML = Object.entries(steamCharts).map(([key, [label]]) =>
      '<button class="gameplay-filter" type="button" data-steam-chart="' + key +
      '" aria-pressed="' + (key === chart) + '" aria-controls="steamChartRows">' + escapeHtml(label) + '</button>').join('');
    chartOptions.addEventListener('click', event => {
      const option = event.target.closest('[data-steam-chart]');
      if (!option || option.dataset.steamChart === chart) return;
      chart = option.dataset.steamChart;
      expandedChart = false;
      syncFilterRoute();
      renderCharts();
    });
    $('#steamChartScope').addEventListener('click', event => {
      const option = event.target.closest('[data-steam-scope]');
      if (!option || option.dataset.steamScope === chartScope) return;
      chartScope = option.dataset.steamScope;
      expandedChart = false;
      syncFilterRoute();
      renderCharts();
    });
    $('#steamChartMore').addEventListener('click', () => {
      expandedChart = !expandedChart;
      renderCharts();
    });
    $('#steamChartRows').addEventListener('click', event => {
      const button = event.target.closest('[data-game-catalog-entry]');
      if (button) {
        detailTab = chart === 'players' ? 'data' : 'overview';
        openDetail(button.dataset.gameCatalogEntry);
      }
    });
    const platformGroup = $('#gameCatalogPlatforms');
    platformGroup.innerHTML = Object.entries({all:{name:'全部平台',platforms:[]}, ...families}).map(([id, family]) =>
      '<button type="button" class="gameplay-filter" data-catalog-platform="' + id + '" aria-pressed="' + (id === 'all') + '"' +
      (family.platforms.length > 1 ? ' aria-controls="gameCatalogSubplatformRow" aria-expanded="false"' : '') +
      '>' + escapeHtml(family.name) + '</button>').join('');
    const gameplayGroup = $('#gameCatalogGameplay');
    gameplayGroup.innerHTML = Object.entries({all: '全部玩法', ...gameplay}).map(([id, label]) =>
      '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + '</option>').join('');

    function applyFilters() {
      syncFilterRoute();
      render();
    }

    function selectPlatform(event) {
      const button = event.target.closest('[data-catalog-platform]');
      if (!button) return;
      platform = button.dataset.catalogPlatform;
      applyFilters();
    }

    platformGroup.addEventListener('click',selectPlatform);
    $('#gameCatalogSubplatforms').addEventListener('click',selectPlatform);
    gameplayGroup.addEventListener('change', event => {
      gameplayType = event.target.value;
      applyFilters();
    });
    $('#gameCatalogReset').addEventListener('click', () => {
      resetFilters();
      applyFilters();
      gameplayGroup.focus({ preventScroll: true });
    });
    $('#gameCatalogSort').addEventListener('change', event => {
      sort = event.target.value;
      if (sort === 'recommended') direction = 'desc';
      applyFilters();
    });
    $('#gameCatalogDirection').addEventListener('change', event => {
      direction = event.target.value;
      applyFilters();
    });
    const grid = $('#gameCatalogGrid');
    new ResizeObserver(() => {
      if (expandedSeriesId && grid.clientWidth) placeSeriesRow();
    }).observe(grid);
    grid.addEventListener('click', event => {
      const button = event.target.closest('[data-game-catalog-entry]');
      if (button) {
        detailTab = 'overview';
        openDetail(button.dataset.gameCatalogEntry);
      }
      const toggle = event.target.closest('[data-catalog-series-toggle]');
      if (toggle) toggleSeries(toggle.dataset.catalogSeriesToggle, toggle.getAttribute('aria-expanded') !== 'true');
    });
  }

  return {setData, readRoute, reset, hash, render, detail, mountDetail, clearDetail, refreshOnline, bind,
    count: () => games.length, find: id => games.find(game => game.id === id)};
})();

