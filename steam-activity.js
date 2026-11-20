const SteamActivity = (() => {
  const dayMs = 86400000;
  const number = new Intl.NumberFormat('zh-CN');
  const compact = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
  let records = {};
  let shooterTop;
  let updateNotes = {};
  const announcementImageLabels = { cover: '公告头图', body: '公告正文配图', version: '同版本官方配图' };

  function setData(data, translated) {
    records = data?.schemaVersion === 1 ? data.apps || {} : {};
    shooterTop = data?.schemaVersion === 1 ? data.shooterTop : undefined;
    updateNotes = translated?.schemaVersion === 1 ? translated.updates || {} : {};
  }

  function chineseText(value) {
    return typeof value === 'string' && /\p{Script=Han}/u.test(value) && !/[A-Za-z]/.test(value);
  }

  function announcement(update) {
    const note = updateNotes[update.source];
    if (note) return note;
    let title = chineseText(update.title) ? update.title : '版本更新公告';
    if (/\b(?:preview|reveal|devlog)\b/i.test(update.title)) title = '版本预告';
    if (/\bhotfix\b/i.test(update.title)) title = '热修复公告';
    const version = /^(?:(?:patch(?: notes)?|update|hotfix|v)\s*)?(\d+(?:\.\d+){1,4})(?![\d.A-Za-z])/i.exec(update.title)?.[1];
    if (version && !chineseText(update.title)) title = version + ' · ' + title;
    return { title, brief: '中文摘要待整理。' };
  }

  function announcementLink(url, label, className = '') {
    const source = safeUrl(url);
    return source.startsWith('https://') ? '<a' + (className ? ' class="' + className + '"' : '') + ' href="' + escapeHtml(source) +
      '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>' : '';
  }

  function announcementCard(update, gameMedia) {
    const note = announcement(update);
    const image = note.image;
    const imageUrl = safeUrl(image?.path || gameMedia?.cover);
    const caption = announcementImageLabels[image?.kind] || '游戏官方宣传图';
    const picture = imageUrl ? '<span class="game-update-picture"><img src="' + escapeHtml(imageUrl) +
      '" alt="" loading="lazy" decoding="async"><span>' + caption + '</span></span>' : '';
    const title = '<strong>' + escapeHtml(note.title) + '</strong>';
    const brief = '<span class="game-update-brief">' + escapeHtml(note.brief) + '</span>';
    const source = note.reference || update.source;
    const imagePage = image?.source || gameMedia?.source;
    const links = '<div class="game-update-links">' + announcementLink(source, '官方公告', 'game-update-source') +
      announcementLink(image?.assetSource || (imageUrl && gameMedia?.coverOriginal), '配图原图') +
      (imageUrl && imagePage !== source ? announcementLink(imagePage, '配图出处') : '') + '</div>';
    const expandable = Boolean(note.details?.length);
    const toggle = expandable ? '<span class="game-update-toggle"><span>展开详情</span><span>收起详情</span></span>' : '';
    const intro = '<span class="game-update-intro">' + picture + '<span>' + title + brief + toggle + '</span></span>';
    if (!expandable) return '<div class="game-update-card">' + intro + links + '</div>';
    return '<details class="game-update-card"><summary>' + intro + '</summary>' +
      '<ul class="game-update-details">' + note.details.map(line => '<li>' + escapeHtml(line) + '</li>').join('') +
      '</ul>' + links + '</details>';
  }

  function dayKey(moment) {
    return new Date(moment + 8 * 3600000).toISOString().slice(0, 10);
  }

  function eventDay(event) {
    const time = Date.parse(event.publishedAt);
    return Number.isFinite(time) ? dayKey(time) : event.date;
  }

  function updateList(tracked, curated) {
    const updates = new Map(tracked.map(event => [event.source, event]));
    for (const event of curated) {
      updates.set(event.source, { ...updates.get(event.source), ...event });
    }
    return [...updates.values()].map(event => ({ ...event, day: eventDay(event) }))
      .filter(event => /^\d{4}-\d{2}-\d{2}$/.test(event.day) && /^https:\/\//.test(event.source))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  function niceStep(peak) {
    const unit = 10 ** Math.floor(Math.log10(Math.max(1, peak / 3)));
    return ([1, 2, 2.5, 5, 10].find(factor => unit * factor >= peak / 3) || 10) * unit;
  }

  function draw(canvas, rows, eventsByDay, firstDay, lastDay, activeDay, markedDays) {
    const style = getComputedStyle(canvas);
    const colors = {
      grid: style.getPropertyValue('--line').trim(),
      text: style.getPropertyValue('--muted').trim(),
      line: style.getPropertyValue('--catalogue-positive').trim(),
      event: style.getPropertyValue('--catalogue-warm').trim(),
      highlight: style.getPropertyValue('--line-strong').trim(),
      background: style.backgroundColor,
    };
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const start = Date.parse(firstDay);
    const days = Math.round((Date.parse(lastDay) - start) / dayMs);
    const peak = Math.max(1, ...rows.map(row => row[1]));
    const step = niceStep(peak);
    const max = Math.ceil(peak / step) * step;
    const left = width < 400 ? 41 : 50;
    const top = 15, right = width - 18, bottom = height - 29;
    const x = day => days ? left + (right - left) * ((Date.parse(day) - start) / dayMs) / days : (left + right) / 2;
    const y = value => bottom - (bottom - top) * value / max;

    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let value = 0; value <= max; value += step) {
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(left, y(value));
      ctx.lineTo(right, y(value));
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.fillText(compact.format(value), left - 7, y(value));
    }
    ctx.textAlign = days ? 'left' : 'center';
    ctx.fillText(firstDay.slice(5), x(firstDay), bottom + 17);
    if (days) {
      ctx.textAlign = 'right';
      ctx.fillText(lastDay.slice(5), right, bottom + 17);
    }
    if (activeDay) {
      ctx.strokeStyle = colors.highlight;
      ctx.beginPath();
      ctx.moveTo(x(activeDay), top);
      ctx.lineTo(x(activeDay), bottom);
      ctx.stroke();
    }
    for (const day of eventsByDay.keys()) {
      ctx.lineWidth = day === activeDay ? 2 : 1;
      ctx.strokeStyle = colors.event;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x(day), top);
      ctx.lineTo(x(day), bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(x(day), top, day === activeDay ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let previous = -Infinity;
    for (const [day, value] of rows) {
      const date = Date.parse(day);
      if (date - previous === dayMs) ctx.lineTo(x(day), y(value));
      else ctx.moveTo(x(day), y(value));
      previous = date;
    }
    ctx.stroke();
    ctx.fillStyle = colors.line;
    const datesWithoutValues = new Set(markedDays);
    for (const [index, [day, value]] of rows.entries()) {
      datesWithoutValues.delete(day);
      const date = Date.parse(day);
      const joined = date - Date.parse(rows[index - 1]?.[0]) === dayMs ||
        Date.parse(rows[index + 1]?.[0]) - date === dayMs;
      const marked = markedDays.has(day);
      if (joined && day !== activeDay && !marked) continue;
      ctx.beginPath();
      ctx.arc(x(day), y(value), marked ? 5 : day === activeDay ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
      if (marked) {
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = colors.background;
        ctx.stroke();
      }
    }
    for (const day of datesWithoutValues) {
      // Mark the date on the axis when there is no observed value to plot.
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colors.line;
      ctx.beginPath();
      ctx.arc(x(day), bottom + 7, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    return {left, right, top, bottom, x};
  }

  function mount(root, appId, curated, sharedAppId, edition, gameMedia) {
    const direct = records[appId];
    const shared = !direct?.days?.length && records[sharedAppId]?.days?.length;
    const id = shared ? sharedAppId : appId;
    const record = records[id];
    if (!record?.days?.length) {
      root.innerHTML = '<p class="steam-history-meta" role="status">' +
        (appId || sharedAppId ? '暂无可核实的 Steam 每日在线采样。' : '这款游戏暂无独立的 Steam 在线数据。') + '</p>';
      return;
    }
    const rows = record.days;
    const lastAvailable = rows.at(-1)[0];
    const firstAvailable = rows[0][0];
    const updates = updateList(shared ? [] : (record.updates || []), curated);
    const trackerUrl = 'https://steamcharts.com/app/' + id;
    const sampleScope = shared ? '《使命召唤》共用客户端' : edition;
    root.innerHTML = '<section class="detail-section steam-history">' +
      '<div class="steam-history-heading"><h3>Steam 每日在线趋势</h3>' +
      '<a href="' + trackerUrl + '" target="_blank" rel="noopener noreferrer">Steam Charts</a></div>' +
      '<p class="steam-history-meta">' + (sampleScope ? escapeHtml(sampleScope) + ' · ' : '') +
      '取北京时间每天记录到的最高在线人数。</p>' +
      '<div class="gameplay-filters" role="group" aria-label="趋势时间范围">' +
      [7, 30, 90].map(days => '<button class="gameplay-filter" type="button" data-steam-period="' + days +
        '" aria-pressed="' + (days === 30) + '">' + days + ' 天</button>').join('') + '</div>' +
      '<form class="steam-history-dates" aria-label="自选日期范围" novalidate>' +
      '<label>开始日期<input type="date" name="start" min="' + firstAvailable + '" max="' + lastAvailable +
      '" aria-describedby="steamHistoryDateError" required></label>' +
      '<label>结束日期<input type="date" name="end" min="' + firstAvailable + '" max="' + lastAvailable +
      '" aria-describedby="steamHistoryDateError" required></label>' +
      '<button class="button" type="submit">应用</button></form>' +
      '<p id="steamHistoryDateError" class="steam-history-date-error" role="alert" hidden></p>' +
      '<p class="steam-history-range" role="status"></p>' +
      '<div class="steam-history-plot">' +
      '<canvas class="steam-history-chart" tabindex="0" role="slider" aria-label="查看每日在线详情" aria-describedby="steamHistoryChartHint"></canvas>' +
      '<div class="steam-history-tooltip" aria-hidden="true" hidden></div></div>' +
      '<p id="steamHistoryChartHint" class="steam-history-hint">点击标记日期，按住 Alt 点击可保留已有标记。虚线标记更新公告。</p>' +
      '<div class="steam-history-selection" hidden></div></section>';
    const canvas = root.querySelector('canvas');
    const range = root.querySelector('.steam-history-range');
    const dates = root.querySelector('.steam-history-dates');
    const startInput = dates.elements.start;
    const endInput = dates.elements.end;
    const dateError = root.querySelector('.steam-history-date-error');
    const tooltip = root.querySelector('.steam-history-tooltip');
    const selection = root.querySelector('.steam-history-selection');
    const today = dayKey(Date.now());
    const dateOffset = (date, offset) => new Date(Date.parse(date) + offset * dayMs).toISOString().slice(0, 10);
    let period = 30;
    let firstDay, lastDay, visibleRows, eventsByDay, playersByDay, dayCount, plot;
    let hoveredDay = '', selectedDay = '';
    const markedDays = new Set();

    function sampleLabel(day) {
      return playersByDay.has(day) ? number.format(playersByDay.get(day)) + ' 人' : '暂无在线记录';
    }

    function drawVisible() {
      plot = draw(canvas, visibleRows, eventsByDay, firstDay, lastDay, hoveredDay || selectedDay, markedDays);
      tooltip.hidden = !hoveredDay || !plot;
      if (tooltip.hidden) return;
      const eventCount = eventsByDay.get(hoveredDay)?.length || 0;
      tooltip.innerHTML = '<time datetime="' + hoveredDay + '">' + hoveredDay + '</time>' +
        '<strong>' + sampleLabel(hoveredDay) + '</strong>' +
        (eventCount ? '<span>' + eventCount + ' 条更新公告</span>' : '');
      const right = canvas.clientWidth - tooltip.offsetWidth - 8;
      tooltip.style.left = Math.max(8, Math.min(right, plot.x(hoveredDay) + 12)) + 'px';
    }

    function select(day, keepMarks = false) {
      if (!keepMarks) markedDays.clear();
      if (day) markedDays.add(day);
      selectedDay = day;
      const sliderDay = day || lastDay;
      canvas.setAttribute('aria-valuenow', String((Date.parse(sliderDay) - Date.parse(firstDay)) / dayMs));
      canvas.setAttribute('aria-valuetext', sliderDay + '，' + sampleLabel(sliderDay));
      selection.hidden = !day;
      if (day) {
        const events = eventsByDay.get(day);
        selection.innerHTML = '<div class="steam-history-selection-heading"><div role="status"><time datetime="' +
          day + '">' + day + '</time><strong>' + sampleLabel(day) + '</strong>' +
          (playersByDay.has(day) ? '<span>最高在线</span>' : '') +
          (day === today ? '<span>今日数据仍在更新</span>' : '') +
          '</div><button class="button subtle" type="button" data-steam-clear-day>清除标记</button></div>' +
          (events ? '<h4>当天更新公告</h4>' + events.map(event => announcementCard(event, gameMedia)).join('') : '');
      } else {
        selection.replaceChildren();
      }
      drawVisible();
    }

    function clearDateError() {
      dateError.hidden = true;
      dateError.textContent = '';
      startInput.removeAttribute('aria-invalid');
      endInput.removeAttribute('aria-invalid');
    }

    function render() {
      if (period) {
        lastDay = lastAvailable;
        firstDay = dateOffset(lastDay, 1 - period);
        if (firstDay < firstAvailable) firstDay = firstAvailable;
      }
      dayCount = (Date.parse(lastDay) - Date.parse(firstDay)) / dayMs;
      visibleRows = rows.filter(([day]) => day >= firstDay && day <= lastDay);
      playersByDay = new Map(visibleRows.map(([day, players]) => [day, players]));
      eventsByDay = Map.groupBy(updates.filter(event => event.day >= firstDay && event.day <= lastDay), event => event.day);
      range.textContent = firstDay + ' 至 ' + lastDay +
        (visibleRows.length ? ' · ' + visibleRows.length + ' 天有在线记录' : ' · 此区间暂无在线记录') +
        (lastDay === today ? ' · 今日数据仍在更新' : '');
      startInput.value = firstDay;
      endInput.value = lastDay;
      clearDateError();
      for (const button of root.querySelectorAll('[data-steam-period]')) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.steamPeriod) === period));
      }
      canvas.setAttribute('aria-valuemin', '0');
      canvas.setAttribute('aria-valuemax', String(dayCount));
      hoveredDay = '';
      select('');
    }

    function dayAtPointer(event) {
      if (!plot) return '';
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left - canvas.clientLeft;
      const y = event.clientY - bounds.top - canvas.clientTop;
      if (x < plot.left - 6 || x > plot.right + 6 || y < plot.top - 6 || y > plot.bottom + 7) return '';
      const position = Math.max(0, Math.min(1, (x - plot.left) / (plot.right - plot.left)));
      return dateOffset(firstDay, Math.round(position * dayCount));
    }

    dates.addEventListener('input', clearDateError);
    dates.addEventListener('submit', event => {
      event.preventDefault();
      const invalid = [startInput, endInput].find(input => !input.validity.valid);
      if (invalid || startInput.value > endInput.value) {
        const target = invalid || endInput;
        dateError.textContent = invalid ? '请选择 ' + firstAvailable + ' 至 ' + lastAvailable + ' 之间的日期。' :
          '结束日期不能早于开始日期。';
        dateError.hidden = false;
        target.setAttribute('aria-invalid', 'true');
        target.focus();
        return;
      }
      firstDay = startInput.value;
      lastDay = endInput.value;
      period = 0;
      render();
    });

    canvas.addEventListener('pointermove', event => {
      const day = event.pointerType === 'touch' ? '' : dayAtPointer(event);
      if (day === hoveredDay) return;
      hoveredDay = day;
      drawVisible();
    });
    canvas.addEventListener('pointerleave', () => {
      hoveredDay = '';
      drawVisible();
    });
    canvas.addEventListener('click', event => {
      const day = dayAtPointer(event);
      if (!day) return;
      hoveredDay = '';
      select(day, event.altKey);
    });
    canvas.addEventListener('keydown', event => {
      const step = {ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1}[event.key];
      if (step === undefined && !['Home', 'End', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      let day = selectedDay || lastDay;
      if (event.key === 'Home') day = firstDay;
      else if (event.key === 'End') day = lastDay;
      else if (step) {
        day = dateOffset(day, step);
        if (day < firstDay) day = firstDay;
        if (day > lastDay) day = lastDay;
      }
      hoveredDay = '';
      select(day);
    });
    root.addEventListener('click', event => {
      const periodButton = event.target.closest('[data-steam-period]');
      if (periodButton) {
        period = Number(periodButton.dataset.steamPeriod);
        render();
      }
      if (event.target.closest('[data-steam-clear-day]')) {
        hoveredDay = '';
        select('');
        canvas.focus();
      }
    });
    render();
    const chartObserver = new ResizeObserver(drawVisible);
    chartObserver.observe(canvas);
    return () => chartObserver.disconnect();
  }

  return {setData, top: () => shooterTop, mount, announcementCard};
})();
