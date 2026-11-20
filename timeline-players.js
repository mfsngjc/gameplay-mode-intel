const TimelinePlayers = (() => {
  const trackedGames = new Set(['Fortnite', 'PUBG', 'Apex Legends', '三角洲行动']);
  const formatNumber = new Intl.NumberFormat('zh-CN');
  const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 });
  const delta = new Intl.NumberFormat('zh-CN', { signDisplay: 'exceptZero', maximumFractionDigits: 0 });
  const dayMs = 86400000;
  const selections = new Map();
  let historyRequest;

  function sourceLink(url, label) {
    return '<a href="' + escapeHtml(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>';
  }

  function seriesFor(record, steam) {
    const source = 'https://steamcharts.com/app/' + record.steamAppId;
    const daily = record.steamAppId ? steam?.apps?.[record.steamAppId]?.days : record.days;
    return [
      {
        label: '近况', unit: '日', rows: daily, monthly: false,
        metric: record.steamAppId ? 'Steam 每日采样最高' : 'Fortnite 客户端每日峰值',
        scope: record.steamAppId ? '北京时间 · 仅 Steam 版，每天取采样中的最高值' : 'UTC 日期 · 全 Fortnite 客户端',
        sources: record.steamAppId ? [[source, 'Steam Charts']] : record.daySources
      },
      {
        label: '月度总览', unit: '月', rows: record.months, monthly: true,
        metric: record.steamAppId ? 'Steam 月度峰值' : 'Fortnite 月度峰值',
        scope: record.steamAppId ? '仅 Steam 版 · 取来源公布的自然月峰值' : 'Tracker Network 收录的自然月峰值',
        sources: record.steamAppId ? [[source, 'Steam Charts']] : record.monthSources
      }
    ];
  }

  function bucketIndex(date, monthly) {
    if (!monthly) return Date.parse(date) / dayMs;
    const [year, month] = date.split('-').map(Number);
    return year * 12 + month;
  }

  function dayOffset(date, offset) {
    return new Date(Date.parse(date) + offset * dayMs).toISOString().slice(0, 10);
  }

  function calendarRows(first, last, samples) {
    const length = bucketIndex(last, false) - bucketIndex(first, false) + 1;
    return Array.from({ length }, (_, i) => {
      const date = dayOffset(first, i);
      return samples.get(date) || [date, null];
    });
  }

  function updateTiming(entry, eventsOnly) {
    if (!eventsOnly) {
      const confirmed = isCoreUpdate(entry) ? entry.effectiveDateStatus === 'confirmed' :
        !['scheduled', 'unverified'].includes(entry.launchDateStatus);
      return confirmed ? { date: entry.launchDate } : {};
    }
    if (isCoreUpdate(entry)) return getCoreUpdateTiming(entry);
    if (entry.launchDateStatus === 'scheduled') return { date: entry.scheduledLaunchDate, label: '预定' };
    if (entry.launchDateStatus !== 'unverified' && entry.launchDate) return { date: entry.launchDate, label: '上线' };
    return { date: entry.publishedDate || entry.date, label: entry.publishedDate || entry.launchDateStatus === 'unverified' ? '公告' : '记录日期' };
  }

  function bucketUpdates(entries, monthly, eventsOnly = false) {
    const grouped = new Map();
    const timings = new Map(entries.map(entry => [entry.id, updateTiming(entry, eventsOnly)]));
    const dateFor = entry => timings.get(entry.id).date;
    const dated = entries.filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(dateFor(entry) || '') && Number.isFinite(Date.parse(dateFor(entry))))
      .sort((a, b) => dateFor(a).localeCompare(dateFor(b)));
    for (const group of groupUpdateEntries(dated)) {
      const { date, label } = timings.get(group.representative.id);
      const key = monthly ? date.slice(0, 7) : date;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ ...group, date, label });
    }
    return grouped;
  }

  function renderUpdates(groups, monthly, expanded, eventsOnly) {
    if (!groups?.length) return '<p>所选筛选下，这' + (monthly ? '个月' : '一天') + '暂无' +
      (eventsOnly ? '玩法资料' : '已确认日期的玩法资料') + '。</p>';
    const firstDetails = expanded ? groups.find(group => group.entries.length > 1) : null;
    const itemButton = item => '<button type="button" data-action="open-mode" data-id="' + escapeHtml(item.id) +
      '">' + escapeHtml(item.modeName) + '</button>' + (expanded && item.oneLineRule ?
        '<p class="player-history-update-summary">' + escapeHtml(item.oneLineRule) + '</p>' : '');
    return '<ul>' + groups.map(group => {
      const date = monthly ? '<time datetime="' + group.date + '">' + group.date.slice(5) + '</time>' : '';
      const timing = group.label ? '<span class="player-history-timing">' + escapeHtml(group.label) + '</span>' : '';
      if (group.entries.length === 1) return '<li>' + date + timing + itemButton(group.representative) + '</li>';
      return '<li><details' + (group === firstDetails ? ' open' : '') + '><summary>' + date + timing + escapeHtml(groupTitle(group)) +
        '</summary><ul>' + group.entries.map(item => '<li>' + itemButton(item) + '</li>').join('') + '</ul></details></li>';
    }).join('') + '</ul>';
  }

  function renderComparison(title, before, after) {
    return '<div><dt>' + title + '</dt><dd>' + formatNumber.format(Math.round(before)) + ' → ' + formatNumber.format(Math.round(after)) +
      ' <strong>' + delta.format(after - before) + '（' + percent.format((after - before) / before) + '）</strong></dd></div>';
  }

  function comparable(rows) {
    const first = rows[0];
    return first?.[1] > 0 && (first[2] === undefined || first[2] > 1) &&
      rows.every(row => row?.[1] > 0 && row[2] === first[2]);
  }

  function renderDayComparison(date, samples) {
    const around = offset => samples.get(dayOffset(date, offset));
    const before = around(-1), after = around(1);
    const days = Array.from({ length: 7 }, (_, i) => i + 1);
    const previous = days.map(day => around(-day)), following = days.map(day => around(day));
    const average = rows => rows.reduce((sum, row) => sum + row[1], 0) / rows.length;
    const pairs = [
      comparable([before, after]) ? renderComparison('更新前一日 → 后一日', before[1], after[1]) : '',
      comparable([...previous, ...following]) ? renderComparison('更新前后各 7 日均值', average(previous), average(following)) : ''
    ].join('');
    return pairs ? '<dl class="player-history-comparison">' + pairs + '</dl>' :
      '<p class="player-history-no-comparison">前后日样本不足或采样口径不同，暂无法比较变化。</p>';
  }

  function renderEventMarker(groups, index, horizontal, vertical, bubbleSpacing, bucket, width) {
    const records = groups.flatMap(group => group.entries);
    const assets = records.filter(entry => entry.imageUrl && !entry.imageUrl.includes('/generated/') &&
      !entry.imageUrl.toLowerCase().endsWith('.svg') && safeUrl(entry.imageUrl));
    const cover = assets.find(entry => ['specific', 'section'].includes(entry.imageScope)) || assets[0];
    const alignment = horizontal < 0.08 ? ' is-left' : horizontal > 0.92 ? ' is-right' : '';
    const label = groups.length > 1 ? groupTitle(groups[0]) + '等 ' + records.length + ' 条资料' : groupTitle(groups[0]);
    const markerLabel = escapeHtml(bucket + ' · ' + label);
    return '<button class="player-history-event' + alignment + (vertical === null ? ' is-missing' : '') +
      '" type="button" data-chart-event="' + index + '" style="--x:' + horizontal * 100 + '%;--y:' + (vertical ?? 1) * 100 +
      '%' + (width ? ';--event-width:' + width * 100 + '%' : '') +
      '" aria-label="' + markerLabel + '" title="' + markerLabel + '" aria-controls="playerHistoryDetails" aria-pressed="false">' +
      '<span class="player-history-event-dot"></span>' + (cover ?
        '<span class="player-history-bubble' + bubbleSpacing + '"><img src="' +
        escapeHtml(safeUrl(cover.thumbnailUrl || cover.imageUrl)) + '" alt="" loading="lazy" decoding="async"></span>' : '') + '</button>';
  }

  function renderMilestones(milestones) {
    if (!milestones?.length) return '';
    return '<details class="player-history-milestones"><summary>早期公开人数记录</summary><ul>' +
      milestones.map(item => '<li><time datetime="' + escapeHtml(item.date) + '">' + escapeHtml(item.date) + '</time>' +
        '<div><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml(item.summary) + '</p>' +
        '<div class="player-history-sources">' + sourceLink(item.update, '玩法公告') + sourceLink(item.source, '人数出处') + '</div></div>' +
        '<div class="player-history-milestone-value"><strong>' + escapeHtml(item.value) + '</strong><span>' +
        escapeHtml(item.metric) + '</span></div></li>').join('') + '</ul></details>';
  }

  function renderSeries(root, game, series, entries, monthControl, drillDown) {
    const eventsOnly = Boolean(series.updates);
    const updates = series.updates || bucketUpdates(entries, series.monthly);
    const firstDate = series.firstDate || series.rows[0][0];
    const lastDate = series.lastDate || series.rows.at(-1)[0];
    const start = bucketIndex(firstDate, series.monthly);
    const span = bucketIndex(lastDate, series.monthly) - start;
    const x = date => span ? (bucketIndex(date, series.monthly) - start) / span : 0.5;
    const values = series.rows.filter(row => row[1] !== null);
    const max = Math.max(1, ...values.map(row => row[1]));
    const power = 10 ** Math.floor(Math.log10(Math.max(max / 4, 1)));
    const step = ([1, 2, 2.5, 5, 10].find(n => n * power >= max / 4) || 10) * power;
    const top = Math.ceil(max / step) * step || 1;
    const y = count => 1 - count / top;
    const axis = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => top - i * step);
    const path = eventsOnly ? 'M0 80 H1000' : series.rows.map(([date, value], index) => {
      if (value === null) return '';
      const previous = series.rows[index - 1];
      const operator = previous?.[1] != null && bucketIndex(date, series.monthly) - bucketIndex(previous[0], series.monthly) === 1 ? 'L' : 'M';
      return operator + (x(date) * 1000).toFixed(2) + ' ' + (y(value) * 160).toFixed(2);
    }).join(' ');
    const middle = series.monthly ? new Date(firstDate + '-01') : null;
    if (middle) middle.setUTCMonth(middle.getUTCMonth() + Math.round(span / 2));
    const ticks = [firstDate, middle ? middle.toISOString().slice(0, 7) : dayOffset(firstDate, Math.round(span / 2)), lastDate];
    const storeKey = game + '|' + series.label;
    const selected = series.rows.findIndex(row => row[0] === selections.get(storeKey));
    const preferred = series.rows.findLastIndex(row => row[1] !== null && updates.has(row[0]));
    const lastEvent = series.rows.findLastIndex(row => updates.has(row[0]));
    const lastSample = series.rows.findLastIndex(row => row[1] !== null);
    const initialEvent = series.rows.findIndex(row => row[0] === series.initialDate);
    const hasMissingEvents = series.rows.some(([date, value]) => value === null && updates.has(date));
    let previousBubbleX = -1;
    let previousCompactBubbleX = -1;
    const markers = series.rows.map(([date, value], index) => {
      if (!updates.has(date)) return '';
      const horizontal = x(date);
      const separated = horizontal - previousBubbleX > 0.14;
      const separatedOnSmallScreen = horizontal - previousCompactBubbleX > 0.3;
      if (separated) previousBubbleX = horizontal;
      if (separatedOnSmallScreen) previousCompactBubbleX = horizontal;
      const spacing = (separated ? ' is-spaced' : '') + (separatedOnSmallScreen ? ' is-spaced-compact' : '');
      // Update-only pins share one line. Keep each hit area clear of adjacent dates on narrow screens.
      const distance = neighbor => neighbor ? Math.abs(x(neighbor[0]) - horizontal) : 1;
      const width = eventsOnly ? Math.min(distance(series.rows[index - 1]), distance(series.rows[index + 1])) : null;
      return renderEventMarker(updates.get(date), index, horizontal, eventsOnly ? 0.5 : value === null ? null : y(value), spacing, date, width);
    }).join('');
    root.innerHTML = (monthControl || '') + '<div class="player-history-context"><span>' + escapeHtml(series.scope) + '</span>' +
      (series.sources?.length ? '<div class="player-history-sources">' + series.sources.map(([href, label]) => sourceLink(href, label)).join('') + '</div>' : '') + '</div>' +
      '<div class="player-history-chart' + (eventsOnly ? ' is-events-only' : '') + (markers ? ' has-events' : '') + '"><div class="player-history-axis" aria-hidden="true">' +
      (values.length ? axis.map(value => '<span>' + compact.format(value) + '</span>').join('') : '') + '</div>' +
      '<div class="player-history-plot"><svg viewBox="0 0 1000 160" preserveAspectRatio="none" role="img" aria-label="' + escapeHtml(series.metric) + '">' +
      (eventsOnly ? [] : values.length ? axis : [0]).map(value => '<line class="player-history-gridline" x1="0" x2="1000" y1="' + y(value) * 160 + '" y2="' + y(value) * 160 + '"/>').join('') +
      '<path class="player-history-line" d="' + path + '"/></svg>' +
      series.rows.map(([date, value], index) => {
        if (value === null) return '';
        const day = bucketIndex(date, series.monthly);
        const joined = [index - 1, index + 1].some(neighbor => series.rows[neighbor]?.[1] != null &&
          Math.abs(bucketIndex(series.rows[neighbor][0], series.monthly) - day) === 1);
        return joined ? '' : '<i class="player-history-point" style="--x:' + x(date) * 100 + '%;--y:' + y(value) * 100 + '%"></i>';
      }).join('') + markers + (!eventsOnly && !values.length ? '<p class="player-history-no-data">这个月暂无可核实的逐日人数</p>' : '') +
      '<i class="player-history-marker" aria-hidden="true"></i><i class="player-history-point is-selected" aria-hidden="true"></i></div>' +
      '<div class="player-history-ticks" aria-hidden="true">' + [...new Set(ticks)].map(date => '<span>' + date + '</span>').join('') + '</div></div>' +
      '<div class="player-history-tools"><label>' + (series.monthly ? '查看月份' : '查看日期') + ' <select class="player-history-date">' +
      series.rows.map(([date], index) => '<option value="' + index + '">' + date + (!eventsOnly && updates.has(date) ? ' · 有玩法更新' : '') + '</option>').join('') +
      '</select></label>' + (drillDown ? '<button class="player-history-drill" type="button">查看该月逐日</button>' : '') +
      (markers ? '<span class="player-history-legend">点击图钉查看玩法更新' +
        (!eventsOnly && hasMissingEvents ? ' · 空心点表示当天缺少人数' : '') + '</span>' : '') + '</div>' +
      '<div class="player-history-selection" id="playerHistoryDetails"><div class="player-history-count" aria-live="polite"></div>' +
      '<div class="player-history-updates"><h4>同' + series.unit + '玩法更新</h4><div></div><div class="player-history-comparison-wrap"></div></div></div>';

    const plot = root.querySelector('.player-history-plot');
    const selection = root.querySelector('#playerHistoryDetails');
    const select = root.querySelector('.player-history-date');
    const count = root.querySelector('.player-history-count');
    const updateList = root.querySelector('.player-history-updates > div');
    const comparisons = root.querySelector('.player-history-comparison-wrap');
    const eventMarkers = [...plot.querySelectorAll('.player-history-event')];
    plot.addEventListener('error', event => {
      if (event.target.matches('img')) event.target.closest('.player-history-bubble')?.remove();
    }, true);
    function pick(index, openedMarker = false) {
      const [date, players, samples] = series.rows[index];
      const [priorDate, priorValue, priorSamples] = series.rows[index - 1] || [];
      select.value = index;
      selections.set(storeKey, date);
      const horizontal = x(date);
      plot.style.setProperty('--marker-x', horizontal * 100 + '%');
      if (players !== null) plot.style.setProperty('--marker-y', y(players) * 100 + '%');
      plot.querySelector('.is-selected').hidden = players === null || updates.has(date);
      eventMarkers.forEach(marker => marker.setAttribute('aria-pressed', String(Number(marker.dataset.chartEvent) === index)));
      const canCompare = players > 0 && priorValue > 0 && bucketIndex(date, series.monthly) - bucketIndex(priorDate, series.monthly) === 1 &&
        (samples === undefined || (samples > 1 && samples === priorSamples));
      count.innerHTML = eventsOnly ? '<span>所选' + (series.monthly ? '月份' : '日期') + '</span><strong>' + date + '</strong>' :
        '<span>' + escapeHtml(series.metric) + '</span><strong>' + (players === null ? '暂无日数据' : formatNumber.format(players)) +
        '</strong>' + (canCompare ? '<span>较前一' + series.unit + ' ' + percent.format((players - priorValue) / priorValue) + '</span>' : '') +
        (samples ? '<span>当日 ' + samples + ' 个采样</span>' : '');
      updateList.innerHTML = renderUpdates(updates.get(date), series.monthly, openedMarker, eventsOnly);
      updateList.scrollTop = 0;
      comparisons.innerHTML = !eventsOnly && !series.monthly && updates.has(date) ? renderDayComparison(date, series.samples) : '';
      selection.classList.toggle('is-bubble', openedMarker);
      if (openedMarker) {
        const rect = plot.getBoundingClientRect();
        const offset = rect.left - selection.getBoundingClientRect().left;
        const inset = selection.clientWidth - rect.width;
        selection.style.setProperty('--bubble-x', 'calc(' + horizontal * 100 + '% + ' + (offset - inset * horizontal) + 'px)');
      }
    }
    select.addEventListener('change', () => pick(Number(select.value), eventsOnly));
    plot.addEventListener('click', event => {
      const marker = event.target.closest('.player-history-event');
      if (marker) {
        pick(Number(marker.dataset.chartEvent), true);
        selection.scrollIntoView({ block: 'nearest' });
        return;
      }
      const rect = plot.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const closest = series.rows.reduce((best, row, index) =>
        Math.abs(x(row[0]) - ratio) < Math.abs(x(series.rows[best][0]) - ratio) ? index : best, 0);
      pick(closest, eventsOnly);
      if (eventsOnly) selection.scrollIntoView({ block: 'nearest' });
    });
    if (drillDown) root.querySelector('.player-history-drill').addEventListener('click', () => drillDown(series.rows[Number(select.value)][0]));
    pick(selected >= 0 ? selected : preferred >= 0 ? preferred : initialEvent >= 0 ? initialEvent :
      Math.max(lastEvent >= 0 ? lastEvent : lastSample, 0));
  }

  function renderFrame(host, title, periods, periodLabel, note, milestones) {
    host.innerHTML = '<section class="player-history" aria-labelledby="playerHistoryHeading">' +
      '<div class="player-history-heading"><h4 id="playerHistoryHeading">' + title + '</h4>' +
      '<div class="player-history-periods" role="group" aria-label="' + periodLabel + '">' +
      periods.map(item => '<button type="button" data-period="' + item.id + '" aria-pressed="false">' + item.label + '</button>').join('') + '</div></div>' +
      '<div class="player-history-series"></div><p class="player-history-note">' + note + '</p>' +
      renderMilestones(milestones) + '</section>';
    return { buttons: [...host.querySelectorAll('.player-history-periods button')], root: host.querySelector('.player-history-series') };
  }

  function renderMonthSelect(months, selected) {
    return '<label>历史月份 <select class="player-history-month">' +
      months.map(month => '<option value="' + month + '"' + (month === selected ? ' selected' : '') + '>' + month + '</option>').join('') +
      '</select></label>';
  }

  function monthEnd(month) {
    const next = new Date(month + '-01');
    next.setUTCMonth(next.getUTCMonth() + 1);
    return dayOffset(next.toISOString().slice(0, 10), -1);
  }

  function mountEventTimeline(host, game, entries) {
    const days = bucketUpdates(entries, false, true);
    if (!days.size) return;
    const months = new Map();
    for (const [date, groups] of days) {
      const month = date.slice(0, 7);
      if (!months.has(month)) months.set(month, []);
      months.get(month).push(...groups);
    }
    const monthDates = [...months.keys()];
    const latest = [...days.keys()].findLast(date => days.get(date).some(group => group.label !== '预定')) || [...days.keys()].at(-1);
    const scope = '暂无可用的在线人数历史 · 节点按实际日期间隔排列';
    const base = { scope, metric: '玩法更新时间线' };
    const periods = [{ id: 'history', label: '历史逐日' }, { id: 'monthly', label: '月度总览' }];
    const { buttons, root } = renderFrame(host, '玩法更新时间线', periods, '更新查看周期',
      '节点区分上线、生效、公告和预定。公告和预定不代表已上线。');
    let historyMonth = latest.slice(0, 7);
    function showPeriod(period, month) {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === period)));
      if (period === 'monthly') {
        renderSeries(root, game, { ...base, label: '更新月度总览', unit: '月', monthly: true,
          updates: months, rows: monthDates.map(date => [date, null]), initialDate: historyMonth }, entries, '', pickedMonth => {
          showPeriod('history', pickedMonth);
          root.querySelector('.player-history-month').focus({ preventScroll: true });
        });
        return;
      }
      historyMonth = month || historyMonth;
      const rows = [...new Set(months.get(historyMonth).map(group => group.date))].map(date => [date, null]);
      const control = '<div class="player-history-history-controls">' + renderMonthSelect(monthDates, historyMonth) + '</div>';
      renderSeries(root, game, { ...base, label: '更新逐日 ' + historyMonth, unit: '日',
        updates: days, rows, firstDate: historyMonth + '-01', lastDate: monthEnd(historyMonth), initialDate: latest }, entries, control);
      root.querySelector('.player-history-month').addEventListener('change', event => {
        showPeriod('history', event.target.value);
        root.querySelector('.player-history-month').focus({ preventScroll: true });
      });
    }
    buttons.forEach(button => button.addEventListener('click', () => showPeriod(button.dataset.period)));
    showPeriod('history');
  }

  async function mount(host, game, entries) {
    if (!trackedGames.has(game)) return mountEventTimeline(host, game, entries);
    historyRequest ??= workspaceJSON('data/timeline-player-history.json', '时间画板在线历史', false)
      .catch(() => { historyRequest = undefined; });
    const [history, steam] = await Promise.all([
      historyRequest,
      game === 'Fortnite' ? null : loadSteamPlayerHistory().catch(() => null)
    ]);
    const record = history?.schemaVersion === 1 && history.games?.[game];
    if (!host.isConnected) return;
    if (!record) return mountEventTimeline(host, game, entries);
    const [daily, monthly] = seriesFor(record, steam);
    const daySeries = [daily, ...(record.dailyArchives || []).map(archive => ({ ...daily, ...archive, rows: archive.days }))]
      .map(series => ({ ...series, samples: new Map((series.rows || []).map(row => [row[0], row])) }));
    const samples = daySeries[0].samples;
    const sampledMonths = daySeries.flatMap(item => [...item.samples.keys()].map(date => date.slice(0, 7)));
    const months = [...new Set([...(monthly.rows || []).map(row => row[0]), ...sampledMonths])].sort();
    if (!months.length) return mountEventTimeline(host, game, entries);
    const periods = [
      ...(samples.size ? [{ id: 'recent', label: daily.label }] : []),
      { id: 'history', label: '历史逐日' },
      ...(monthly.rows?.length ? [{ id: 'monthly', label: monthly.label }] : [])
    ];
    const scopeNote = record.steamAppId ? '玩法条目的平台和地区范围见详情。' : '';
    const { buttons, root } = renderFrame(host, '在线趋势与玩法更新', periods, '人数统计周期',
      '按资料库确认的日期对齐。' + scopeNote + '人数也可能受活动、停机和时段影响。', record.milestones);
    const last = daily.rows?.at(-1)?.[0];
    let historyMonth = months.at(-1);
    function showPeriod(period, month, metricIndex) {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === period)));
      if (period === 'recent') {
        const first = [dayOffset(last, -29), daily.rows[0][0]].sort().at(-1);
        renderSeries(root, game, { ...daily, samples, rows: calendarRows(first, last, samples) }, entries);
        return;
      }
      if (period === 'monthly') {
        renderSeries(root, game, monthly, entries, '', pickedMonth => {
          showPeriod('history', pickedMonth);
          root.querySelector('.player-history-month').focus({ preventScroll: true });
        });
        return;
      }
      historyMonth = month || historyMonth;
      const start = historyMonth + '-01';
      const end = monthEnd(historyMonth);
      const available = daySeries.filter(series => [...series.samples.keys()].some(date => date.startsWith(historyMonth)));
      const metric = available[metricIndex || 0] || daySeries[0];
      const rows = calendarRows(start, end, metric.samples);
      const count = rows.filter(row => row[1] !== null).length;
      const control = '<div class="player-history-history-controls">' + renderMonthSelect(months, historyMonth) +
        (available.length > 1 ? '<label>统计指标 <select class="player-history-metric">' +
          available.map((series, index) => '<option value="' + index + '"' + (metric === series ? ' selected' : '') + '>' +
            series.metric + '</option>').join('') + '</select></label>' : '') +
        '<span>' + count + ' / ' + rows.length + ' 天有数据</span></div>';
      renderSeries(root, game, { ...metric, label: '历史逐日 ' + historyMonth + ' ' + metric.metric, rows }, entries, control);
      root.querySelector('.player-history-month').addEventListener('change', event => {
        showPeriod('history', event.target.value);
        root.querySelector('.player-history-month').focus({ preventScroll: true });
      });
      root.querySelector('.player-history-metric')?.addEventListener('change', event => {
        showPeriod('history', historyMonth, Number(event.target.value));
        root.querySelector('.player-history-metric').focus({ preventScroll: true });
      });
    }
    buttons.forEach(button => button.addEventListener('click', () => showPeriod(button.dataset.period)));
    showPeriod(periods[0].id);
  }

  return { mount };
})();
