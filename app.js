function readCollected() {
  try {
    const value = JSON.parse(localStorage.getItem("br-mode-collected") || "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch { return new Set(); }
}

const globalAnalyticsClientKey = "gameplay-mode-intel-client-v2";
const globalAnalyticsEndpoint = "https://gameplay-intel-metrics.mode-signal-7f3c.workers.dev/event";

function getGlobalAnalyticsClientId() {
  try {
    const saved = localStorage.getItem(globalAnalyticsClientKey);
    if (/^[a-zA-Z0-9_-]{16,80}$/.test(saved || "")) return saved;
    const value = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "")
      : Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(globalAnalyticsClientKey, value);
    return value;
  } catch { return ""; }
}

function sendGlobalAnalytics(type, details = {}) {
  if (window.location.hostname !== "mfsngjc.github.io") return;
  const clientId = getGlobalAnalyticsClientId();
  if (!clientId) return;
  fetch(globalAnalyticsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, clientId, ...details }),
    keepalive: true
  }).catch(() => {});
}

const analyticsGuard = { routeKey: "", modeId: "", modeTime: 0 };

const state = {
  modes: [],
  entries: [],
  view: "modes",
  modeView: "library",
  query: "",
  topic: "all",
  sort: "recommended",
  layout: "grid",
  limit: 12,
  ready: false,
  filter: "all",
  feedFilter: "all",
  contentFilter: "all",
  updateCategory: "all",
  activityLimit: 24,
  gameFilter: "all",
  gameplayFilter: "all",
  collected: readCollected()
};

const modeGrid = document.querySelector("#modeGrid");
const activityFeed = document.querySelector("#activityFeed");
const activityStats = document.querySelector("#activityStats");
const latestCount = document.querySelector("#latestCount");
const gameCount = document.querySelector("#gameCount");
const gameTimeline = document.querySelector("#gameTimeline");
const statusLine = document.querySelector("#statusLine");
const caseCount = document.querySelector("#caseCount");
const toast = document.querySelector("#toast");
const shareModal = document.querySelector("#shareModal");
const sharePreviewImage = document.querySelector("#sharePreviewImage");
const shareTitle = document.querySelector("#shareTitle");
const shareSkeleton = document.querySelector("#shareSkeleton");
const shareSource = document.querySelector("#shareSource");
const shareSourceLink = document.querySelector("#shareSourceLink");
const shareSourceName = document.querySelector("#shareSourceName");

let activeShare = {
  mode: null,
  blob: null,
  objectUrl: null
};

const tagLabels = {
  all: "全部",
  ltm: "LTM（限时模式）",
  collected: "已采集"
};

const feedLabels = {
  all: "全部动态",
  recent: "最近更新",
  upcoming: "即将上线",
  ltm: "LTM 限时模式"
};

const defaultAiCommentator = "集成农业 AI · DeepSeek-V4-Pro（深度求索）";
function getAiCommentator(mode) {
  return mode.aiCommentator || defaultAiCommentator;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function saveCollected() {
  try { localStorage.setItem("br-mode-collected", JSON.stringify([...state.collected])); }
  catch { showToast("当前浏览器无法保存收藏；请导出以保留本次研究。"); }
}

function recordPageView(routeKey) {
  if (!routeKey || analyticsGuard.routeKey === routeKey) return;
  analyticsGuard.routeKey = routeKey;
  sendGlobalAnalytics("page_view", { route: routeKey });
}

function recordModeView(modeId) {
  const now = Date.now();
  if (analyticsGuard.modeId === modeId && now - analyticsGuard.modeTime < 800) return;
  analyticsGuard.modeId = modeId;
  analyticsGuard.modeTime = now;
  sendGlobalAnalytics("mode_view", { modeId });
}

function recordFavoriteAdd(modeId) {
  sendGlobalAnalytics("favorite_add", { modeId });
}

function seedCollectedAnalytics() {
  state.collected.forEach((id) => {
    sendGlobalAnalytics("favorite_add", { modeId: id });
  });
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getModeDateValue(mode) {
  const value = isCoreUpdate(mode) ? getCoreUpdateTiming(mode).date : mode.launchDate || mode.date || mode.year || "";
  const match = String(value).match(/\d{4}(?:-\d{2}-\d{2})?/);
  return match ? match[0] : "";
}

function parseModeDate(mode) {
  const value = getModeDateValue(mode);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{4}$/.test(value)) return new Date(Number(value), 0, 1);
  return null;
}

function getDateSortValue(mode) {
  const date = parseModeDate(mode);
  return date ? date.getTime() : 0;
}

function getDayDelta(mode) {
  const date = parseModeDate(mode);
  if (!date) return null;
  return Math.round((date.getTime() - getTodayStart().getTime()) / 86400000);
}

function getActivityState(mode) {
  if (isCoreUpdate(mode)) return coreUpdateActivityState(mode);
  const delta = getDayDelta(mode);
  if (delta === null) return { className: "is-unknown", label: "待确认" };
  if (delta > 0) return { className: "is-upcoming", label: "即将上线" };
  if (delta === 0) return { className: "is-today", label: "今天更新" };
  if (delta >= -30) return { className: "is-recent", label: "最近更新" };
  return { className: "is-archive", label: "历史收录" };
}

function formatActivityDate(mode) {
  if (isCoreUpdate(mode)) return coreUpdateDateLabel(mode);
  const date = parseModeDate(mode);
  if (!date) return mode.launchLabel || mode.date || mode.year || "待确认";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function getSortedModesDescending(modes = state.modes) {
  return [...modes].sort((a, b) => (
    getDateSortValue(b) - getDateSortValue(a)
    || String(b.modeName).localeCompare(String(a.modeName), "zh-CN")
  ));
}

function getActivityModes() {
  const today = getTodayStart().getTime();
  const modes = getSortedModesDescending();

  if (state.feedFilter === "upcoming") {
    return modes
      .filter((mode) => getDateSortValue(mode) > today)
      .sort((a, b) => getDateSortValue(a) - getDateSortValue(b))
      .slice(0, 8);
  }

  if (state.feedFilter === "recent") {
    return modes
      .filter((mode) => {
        const delta = getDayDelta(mode);
        return delta !== null && delta <= 0;
      })
      .slice(0, 10);
  }

  if (state.feedFilter === "ltm") {
    return modes
      .filter((mode) => mode.isLtm === true)
      .slice(0, 10);
  }

  return modes.slice(0, 10);
}

function getActivitySummary() {
  const today = getTodayStart().getTime();
  const recentCount = state.modes.filter((mode) => {
    const delta = getDayDelta(mode);
    return delta !== null && delta <= 0 && delta >= -30;
  }).length;
  const upcomingCount = state.modes.filter((mode) => getDateSortValue(mode) > today).length;
  const gameTotal = new Set(state.modes.map((mode) => mode.game)).size;
  const newestPast = getSortedModesDescending().find((mode) => getDateSortValue(mode) <= today);

  return { recentCount, upcomingCount, gameTotal, newestPast };
}

function renderActivityFeed() {
  if (!activityFeed || !activityStats) return;

  const modes = getActivityModes();
  const summary = getActivitySummary();
  const feedLabel = feedLabels[state.feedFilter] || "全部动态";

  if (latestCount) {
    latestCount.textContent = summary.newestPast
      ? `最新收录 ${formatActivityDate(summary.newestPast)}`
      : "最新收录待确认";
  }
  if (gameCount) gameCount.textContent = `${summary.gameTotal} 个游戏信号`;

  activityStats.textContent = `${feedLabel} · 近 30 天 ${summary.recentCount} 条 · 即将上线 ${summary.upcomingCount} 条`;

  if (!modes.length) {
    activityFeed.innerHTML = `<p class="note">这个筛选下暂时没有动态。切回「全部动态」可以查看当前库内最近收录。</p>`;
    return;
  }

  activityFeed.innerHTML = modes.map((mode) => {
    const status = getActivityState(mode);
    const tagText = mode.type.slice(0, 3).join(" / ");
    return `
      <article class="activity-card ${escapeHtml(status.className)}">
        <div class="activity-date">
          <time datetime="${escapeHtml(getModeDateValue(mode))}">${escapeHtml(formatActivityDate(mode))}</time>
          <span>${escapeHtml(status.label)}</span>
        </div>
        <div class="activity-main">
          <div class="activity-title-row">
            <span class="activity-game">${escapeHtml(mode.game)}</span>
            <h3>${escapeHtml(mode.modeName)}</h3>
          </div>
          <p>${escapeHtml(mode.oneLineRule)}</p>
          <div class="activity-tags">${escapeHtml(tagText)}</div>
        </div>
        <div class="activity-actions">
          <button type="button" data-action="open-mode" data-id="${escapeHtml(mode.id)}">查看拆解</button>
          <a href="${escapeHtml(mode.sourceUrl)}" target="_blank" rel="noreferrer" aria-label="打开 ${escapeHtml(mode.modeName)} 来源">${iconSvg("source")}<span>来源</span></a>
        </div>
      </article>
    `;
  }).join("");
}

function getFilteredModes() {
  return getFilteredEntries();
}

function getTimelineModes() {
  if (state.gameFilter === "all") return [];
  return state.modes
    .map((mode, index) => ({ mode, index }))
    .filter((item) => item.mode.game === state.gameFilter)
    .sort((a, b) => {
      const dateA = a.mode.launchDate || a.mode.date || a.mode.year || "";
      const dateB = b.mode.launchDate || b.mode.date || b.mode.year || "";
      return dateA.localeCompare(dateB, "zh-CN") || a.index - b.index;
    })
    .map((item) => item.mode);
}

function getTimelineLaneDefinitions(game = state.gameFilter, entries = state.modes) {
  if (game === 'Free Fire') return ffPlaylistDefinitions.filter(d => entries.some(e => e.game === game && (e.timelineLane ? e.timelineLane === d.id : getFFPlaylists(e).includes(d.id)))).map(d => ({key:d.id,label:d.label,statLabel:d.shortLabel,dotClass:d.timelineClass}));
  const primaryTypes = new Set(entries.filter((mode) => mode.game === game).map((mode) => getGameplayTypes(mode)[0]));
  return gameplayDefinitions.filter((definition) => primaryTypes.has(definition.id)).map((definition) => ({
    key: definition.id, label: definition.label, statLabel: definition.shortLabel, dotClass: definition.timelineClass
  }));
}

function getTimelineLaneLayout(game = state.gameFilter, entries = state.modes) {
  const definitions = getTimelineLaneDefinitions(game, entries);
  const laneGap = 78;
  const firstY = 64;
  const lanes = definitions.reduce((acc, lane, index) => {
    acc[lane.key] = { ...lane, y: firstY + index * laneGap };
    return acc;
  }, {});
  const lastY = firstY + Math.max(0, definitions.length - 1) * laneGap;
  return {
    definitions,
    lanes,
    height: lastY + 94
  };
}

function getModeTimingLabel(mode) {
  return mode.launchDate ? "上线时间" : "时间说明";
}

function getTimelineDateLabel(mode) {
  if (isCoreUpdate(mode)) return coreUpdateDateLabel(mode);
  if (mode.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(mode.launchDate)) {
    const [year, month, day] = mode.launchDate.split("-");
    return `${Number(year)}年${Number(month)}月${Number(day)}日`;
  }
  return mode.launchLabel || mode.date || mode.year || "待确认";
}

function getTimelineMeta(mode) {
  const definition = mode.game === 'Free Fire' ? ffPlaylistDefinitions.find(d=>d.id===(mode.timelineLane||getFFPlaylists(mode)[0])) : gameplayDefinitions.find((item) => item.id === getGameplayTypes(mode)[0]);
  return {
    className: definition.timelineClass,
    label: (mode.timelineLane ? definition.label : getGameplayLabel(mode)) + (isCoreUpdate(mode) ? " · 基础更新" : "") + (isLtmMode(mode) ? " · LTM" : ""),
    shortLabel: isLtmMode(mode) ? "LTM" : definition.shortLabel,
    laneKey: definition.id
  };
}

function getTimelineShortDate(mode) {
  if (isCoreUpdate(mode)) { const timing = getCoreUpdateTiming(mode); return timing.date.slice(2).replaceAll("-", ".") + " · " + timing.label; }
  if (mode.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(mode.launchDate)) {
    const [year, month, day] = mode.launchDate.split("-");
    return `${year.slice(2)}.${Number(month)}.${Number(day)}`;
  }
  return String(mode.year || mode.date || "待定");
}

function getTimelineNodeLabel(mode) {
  const [name] = mode.modeName.split(/[\/（(]/);
  const normalized = name
    .replace("玩家票选模式：", "票选")
    .replace("夜战：", "")
    .trim();
  const chars = [...normalized];
  return chars.length > 7 ? `${chars.slice(0, 7).join("")}…` : normalized;
}

function renderTimelineCanvas(groups) {
  const firstX = 168;
  const width = Math.max(1040, firstX + 50 + Math.max(0, groups.length - 1) * 110);
  const { definitions, lanes, height } = getTimelineLaneLayout(state.gameFilter, groups.map((g) => g.representative));
  const points = groups.map((group, index) => ({ group, index, meta: getTimelineMeta(group.representative),
    x: firstX + index * 110, y: lanes[getTimelineMeta(group.representative).laneKey].y }));
  return `<div class="timeline-canvas-wrap" tabindex="0" aria-label="可横向滚动的玩法时间画板">
    <svg class="timeline-canvas-svg" viewBox="0 0 ${width} ${height}" style="width:${width}px;min-width:${width}px" role="group" aria-label="${escapeHtml(state.gameFilter)}玩法更新时间画板">
      <g class="canvas-lanes" aria-hidden="true">${definitions.map((d) => `<line x1="138" y1="${lanes[d.key].y}" x2="${width - 34}" y2="${lanes[d.key].y}"></line><text x="18" y="${lanes[d.key].y + 5}">${escapeHtml(d.label)}</text>`).join('')}</g>
      ${points.map(({group, index, meta, x, y}) => {
        const entry = group.representative;
        const title = getTimelineDateLabel(entry) + ' · ' + groupTitle(group);
        const action = group.entries.length > 1 ? `data-timeline-group="${index}"` : `data-action="open-mode" data-id="${escapeHtml(entry.id)}"`;
        const label = group.entries.length > 1 ? entry.versionLabel.replace(/ 补丁$/, '') : getTimelineNodeLabel(entry);
        return `<g class="canvas-node ${meta.className} ${group.isUpdateGroup ? 'is-core-update' : ''}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="${escapeHtml(title + (entry.timelineLane ? ' · ' + meta.label : ''))}" ${action}>
          <title>${escapeHtml(title)}</title>${group.isUpdateGroup ? '<rect x="-13" y="-13" width="26" height="26" rx="5"></rect>' : '<circle r="14"></circle>'}
          <text class="canvas-node-date" y="-24">${escapeHtml(getTimelineShortDate(entry))}</text>
          <text class="canvas-node-label" y="36">${escapeHtml(label)}</text>
          <text class="canvas-node-family" y="53">${group.isUpdateGroup ? (group.entries.length > 1 ? group.entries.length + ' 条基础更新' : '基础更新') : escapeHtml(meta.shortLabel)}</text></g>`;
      }).join('')}
    </svg></div>`;
}

function renderTimeline() {
  if (!gameTimeline) return;
  gameTimeline.hidden = false;
  if (state.gameFilter === "all") {
    gameTimeline.innerHTML = '<div class="empty-state"><h3>选择一个游戏查看时间画板</h3><p>使用上方游戏筛选，查看该游戏的模式案例与基础更新。</p></div>';
    return;
  }
  const entries = getTimelineModes().filter((entry) => matchesLibraryEntry(entry));
  if (!entries.length) {
    gameTimeline.innerHTML = renderFFPatchTimeline() + '<div class="empty-state"><h3>当前筛选没有时间节点</h3><button class="button" data-reset-filters>清除筛选</button></div>';
    return;
  }
  const groups = groupUpdateEntries(expandFFTimelineEntries(entries), true);
  gameTimeline.innerHTML = `${renderFFPatchTimeline()}<div class="timeline-head"><div><span class="timeline-kicker">玩法时间画板</span><h3>${escapeHtml(state.gameFilter)}</h3></div><div class="timeline-stats"><span>${escapeHtml(summarizeLibrary(entries))}</span><span><b>${groups.length}</b> 个节点</span></div></div>
    <div class="timeline-board"><div class="timeline-board-head"><p>按记录日期排列，节点间距不代表实际时间跨度。公告与预定日期单独标注。</p><div class="timeline-legend"><span>○ 模式案例</span><span>▢ 基础更新</span></div></div>
    ${renderTimelineCanvas(groups)}<ol class="timeline-list">${groups.map(renderTimelineGroup).join('')}</ol></div>`;
}

function modeToMarkdown(mode) {
  if (isCoreUpdate(mode)) return coreUpdateMarkdown(mode);
  const derived = mode.kind && mode.kind !== "modes";
  const sourceModes = (mode.sourceModeIds || []).map((id) => state.modes.find((entry) => entry.id === id)).filter(Boolean);
  const lines = [
    "# " + mode.modeName, "",
    "- 资料类型：" + (kindLabels[mode.kind] || "玩法模式"),
    "- 游戏：" + mode.game,
    "- " + (derived ? "关联核心玩法：" : "核心玩法：") + getGameplayLabel(mode),
    ...(isLtmMode(mode) ? ["- 模式标签：LTM（限时模式）"] : []),
    "- " + (derived ? "关联案例时间：" : getModeTimingLabel(mode) + "：") + (mode.launchLabel || mode.date || mode.year),
    "- 类型：" + mode.type.join(" / "),
    "- 来源：" + mode.sourceUrl,
    "- 图片来源：" + (mode.imageSource || "待确认"),
    "- 设计观察署名：" + getAiCommentator(mode)
  ];
  if (derived) lines.push("- 提炼日期：" + mode.createdAt, "- 资料性质：基于已有案例的设计提炼，不代表官方结论");
  lines.push("", "## 一句话规则", "", mode.oneLineRule, "",
    "## " + (derived ? "原案例的机制依据" : "机制变化"), "", mode.mechanicChange, "",
    "## " + (derived ? "原案例的节奏影响" : "节奏影响"), "", mode.tempoImpact, "",
    "## 设计观察", "", mode.designObservation, "", "## 时间备注", "", mode.launchNote || "待确认");
  if (sourceModes.length) {
    lines.push("", "## 关联原案例", "", ...sourceModes.map((entry) => "- [" + entry.modeName + "](" + entry.sourceUrl + ")"));
  }
  return lines.join("\n") + "\n";
}

function mapToMarkdown(map) {
  const lines = [
    '# ' + map.name, '',
    '- 资料类型：地图',
    '- 游戏：' + map.game,
    '- 地图类型：' + (map.variant || '地图资料'),
    ...(map.description ? ['- 官方地图介绍：' + map.description] : []),
    '- 来源：' + (map.sourceUrl || ''),
    ...(map.planSourceUrl ? ['- 2D 平面图来源：' + map.planSourceUrl] : []),
    ...(map.wikiUrl ? ['- Wiki：' + map.wikiUrl] : []),
    '', '## 地图说明', '', map.description || map.variant || '待补充', ''
  ];
  return lines.join('\n') + '\n';
}

function iconSvg(name) {
  const icons = {
    collect: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h4"/></svg>',
    collected: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/><path d="m9 11 2 2 4-5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="m14 14 2-2 5 5"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4.4"/><path d="m8.6 13.3 6.8 4.4"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
    source: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="m10 14 10-10"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>'
  };
  return icons[name] || "";
}

function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyModeMarkdown(mode) {
  const text = modeToMarkdown(mode);
  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制 ${mode.modeName} 的 Markdown`);
  } catch {
    downloadFile(`${mode.id}.md`, text);
    showToast("浏览器不允许复制，已改为下载 Markdown");
  }
}

function downloadModeMarkdown(mode) {
  downloadFile(`${mode.id}.md`, modeToMarkdown(mode));
  showToast(`已下载 ${mode.modeName} 的 Markdown`);
}

async function copyModeBlockImage(mode) {
  try {
    const blob = await renderModeBlockPng(mode);
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob })
    ]);
    showToast(`已复制 ${mode.modeName} 玩法块图片`);
  } catch {
    const blob = await renderModeBlockPng(mode);
    downloadBlob(`${mode.id}-card.png`, blob);
    showToast("浏览器不允许写入剪贴板，已下载玩法块 PNG");
  }
}

async function openShareModal(mode) {
  const generation = (activeShare.generation || 0) + 1;
  activeShare.generation = generation;
  activeShare.trigger = document.activeElement;
  activeShare.mode = mode;
  activeShare.blob = null;
  if (activeShare.objectUrl) URL.revokeObjectURL(activeShare.objectUrl);
  activeShare.objectUrl = null;
  shareTitle.textContent = mode.modeName;
  shareModal.querySelector(".share-tag").textContent = getContentTypeLabel(mode);
  sharePreviewImage.removeAttribute("src");
  sharePreviewImage.hidden = true;
  sharePreviewImage.alt = mode.modeName + " 资料分享预览图";
  shareSkeleton.hidden = false;
  shareSource.hidden = true;
  shareModal.hidden = false;
  document.body.classList.add("modal-open");
  document.querySelector("#downloadShareImage").disabled = true;
  document.querySelector(".workspace-main").inert = true;
  document.querySelector("#sidebar").inert = true;
  shareModal.querySelector("button[data-share-close]").focus();
  try {
    const blob = await renderModeBlockPng(mode);
    if (generation !== activeShare.generation || shareModal.hidden) return;
    activeShare.blob = blob;
    activeShare.objectUrl = URL.createObjectURL(blob);
    shareSkeleton.hidden = true;
    sharePreviewImage.src = activeShare.objectUrl;
    sharePreviewImage.hidden = false;
    document.querySelector("#downloadShareImage").disabled = false;
    if (safeUrl(mode.sourceUrl)) {
      shareSourceLink.href = safeUrl(mode.sourceUrl);
      shareSourceName.textContent = mode.modeName;
      shareSource.hidden = false;
    }
  } catch {
    if (generation !== activeShare.generation) return;
    shareSkeleton.hidden = true;
    showToast("图片暂时生成失败，仍可复制或下载 Markdown。");
  }
}

function closeShareModal() {
  activeShare.generation = (activeShare.generation || 0) + 1;
  if (activeShare.objectUrl) URL.revokeObjectURL(activeShare.objectUrl);
  activeShare.objectUrl = null;
  activeShare.blob = null;
  shareModal.hidden = true;
  shareSkeleton.hidden = true;
  shareSource.hidden = true;
  document.body.classList.remove("modal-open");
  document.querySelector(".workspace-main").inert = false;
  setNavOpen(false);
  if (activeShare.trigger?.isConnected) activeShare.trigger.focus();
}

function downloadActiveShareImage() {
  if (!activeShare.blob || !activeShare.mode) return;
  downloadBlob(`${activeShare.mode.id}-card.png`, activeShare.blob);
  showToast("已下载玩法块 PNG");
}

function copyActiveShareMarkdown() {
  if (activeShare.mode) copyModeMarkdown(activeShare.mode);
}

function downloadActiveShareMarkdown() {
  if (activeShare.mode) downloadModeMarkdown(activeShare.mode);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function renderModeBlockPng(mode) {
  const scale = 2;
  const width = 900;
  const layout = await buildShareLayout(mode, width);
  const canvas = document.createElement("canvas");
  const height = layout.height;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  drawCardBackground(ctx, width, height);

  let y = layout.contentY;

  /* ── Banner image (inset, rounded) ── */
  if (layout.image) {
    drawCoverImageRounded(ctx, layout.image, layout.imageMargin, layout.imageMargin, layout.imageWidth, layout.imageHeight, 18);
  }

  /* ── Badge row: game + date ── */
  ctx.fillStyle = "#edf3e5";
  roundRect(ctx, layout.margin, y, 116, 32, 16);
  ctx.fill();
  ctx.strokeStyle = "#d5e1c9";
  ctx.stroke();
  ctx.fillStyle = "#426034";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  ctx.fillText(mode.game, layout.margin + 20, y + 22);

  ctx.fillStyle = "#788178";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  const dateText = isCoreUpdate(mode) ? coreUpdateDateLabel(mode) : mode.date || mode.year;
  ctx.fillText(dateText, width - layout.margin - ctx.measureText(dateText).width, y + 22);

  /* ── Title: badge bottom + 10px visual gap ── */
  ctx.fillStyle = "#24382f";
  ctx.font = "800 50px Inter, PingFang SC, sans-serif";
  y = drawWrappedLines(ctx, layout.lines.title, layout.margin, y + 88, 58);

  /* ── Tags: title bottom + 14px gap ── */
  y = y - 32;
  y = drawTagRow(ctx, getEntryTags(mode), layout.margin, y, layout.contentWidth);

  /* ── Launch time: tags bottom + 20px ── */
  y += 20;
  ctx.fillStyle = "#f1f4ef";
  roundRect(ctx, layout.margin, y, layout.contentWidth, 46, 14);
  ctx.fill();
  ctx.strokeStyle = "#dce5d2";
  ctx.stroke();
  ctx.fillStyle = "#4b6936";
  ctx.font = "800 18px Inter, PingFang SC, sans-serif";
  ctx.fillText(isCoreUpdate(mode) ? "记录日期" : mode.kind === "modes" ? getModeTimingLabel(mode) : "案例时间", layout.margin + 18, y + 30);
  ctx.fillStyle = "#516346";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  ctx.fillText(mode.launchLabel || mode.date || mode.year, layout.margin + 108, y + 30);

  /* ── Sections: launch bottom + 24px ── */
  y += 70;
  y = drawShareSection(ctx, isCoreUpdate(mode) ? "具体变化" : "一句话规则", layout.lines.rule, layout.margin, y, layout.contentWidth, "#424245");
  y = drawShareSection(ctx, isCoreUpdate(mode) ? "改动前" : "机制变化", layout.lines.mechanic, layout.margin, y + 12, layout.contentWidth, "#667463");
  y = drawShareSection(ctx, isCoreUpdate(mode) ? "玩家行为变化（分析）" : "节奏影响", layout.lines.tempo, layout.margin, y + 12, layout.contentWidth, "#667463");
  y = drawShareSection(ctx, isCoreUpdate(mode) ? "设计观察（分析）" : "设计观察", layout.lines.observation, layout.margin, y + 12, layout.contentWidth, "#286446");

  if (isCoreUpdate(mode)) {
    ctx.font = "400 17px Inter, PingFang SC, sans-serif";
    ctx.fillStyle = "#687367";
    y = drawWrappedLines(ctx, measureCanvasLines(ctx, '配图：' + mode.imageSource, layout.contentWidth, 3), layout.margin, y + 24, 24);
    y = drawWrappedLines(ctx, measureCanvasLines(ctx, '来源：' + mode.sourceUrl, layout.contentWidth, 2), layout.margin, y + 8, 24);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas export failed")), "image/png");
  });
}

async function buildShareLayout(mode, width) {
  const measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  const margin = 48;
  const contentWidth = width - margin * 2;
  const imageMargin = 24;
  const imageWidth = width - imageMargin * 2;
  const image = mode.imageUrl ? await loadImageForCanvas(mode.imageUrl).catch(() => null) : null;
  let imageHeight = 0;
  if (image) {
    const naturalRatio = image.naturalWidth / image.naturalHeight;
    const rawHeight = imageWidth / naturalRatio;
    imageHeight = Math.round(Math.max(180, Math.min(350, rawHeight)));
  }
  const contentY = image ? imageMargin + imageHeight + 34 : margin;

  ctx.font = "800 50px Inter, PingFang SC, sans-serif";
  const title = isCoreUpdate(mode) && ctx.measureText(mode.modeName).width > contentWidth && mode.modeName.includes('（')
    ? mode.modeName.replace('（', '\n（').split('\n').flatMap((part) => measureCanvasLines(ctx, part, contentWidth, 3))
    : measureCanvasLines(ctx, mode.modeName, contentWidth, 3);
  ctx.font = "400 25px Inter, PingFang SC, sans-serif";
  const rule = measureCanvasLines(ctx, mode.oneLineRule, contentWidth - 40, 4);
  ctx.font = "400 23px Inter, PingFang SC, sans-serif";
  const mechanic = measureCanvasLines(ctx, isCoreUpdate(mode) ? (mode.before || "该来源未明确说明改动前的完整状态。") : mode.mechanicChange, contentWidth - 40, 6);
  const tempo = measureCanvasLines(ctx, mode.tempoImpact, contentWidth - 40, 6);
  const observation = measureCanvasLines(ctx, mode.designObservation, contentWidth - 40, 5);

  const tagRows = countTagRows(ctx, getEntryTags(mode), contentWidth);
  const sectionsHeight =
    shareSectionHeight(rule.length, 36) +
    shareSectionHeight(mechanic.length, 32) +
    shareSectionHeight(tempo.length, 32) +
    shareSectionHeight(observation.length, 32) +
    12 * 3;
  const height =
    contentY +
    32 + 56 +
    title.length * 58 - 32 +
    tagRows * 24 +
    20 + 46 + 24 +
    sectionsHeight + (isCoreUpdate(mode) ? 170 : 40);

  return {
    margin,
    contentWidth,
    imageMargin,
    imageWidth,
    image,
    imageHeight,
    contentY,
    height: Math.ceil(height),
    lines: { title, rule, mechanic, tempo, observation }
  };
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = window.setTimeout(() => {
      img.onload = img.onerror = null;
      reject(new Error("Image request timed out"));
    }, 7000);
    img.crossOrigin = "anonymous";
    img.onload = () => { window.clearTimeout(timeout); resolve(img); };
    img.onerror = () => { window.clearTimeout(timeout); reject(new Error("Image unavailable")); };
    img.src = src;
  });
}

function drawCardBackground(ctx, width, height) {
  ctx.fillStyle = "#f7f8f5";
  ctx.fillRect(0, 0, width, height);
}

function drawCoverImageRounded(ctx, image, x, y, width, height, radius) {
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (imageRatio > boxRatio) {
    sourceWidth = image.naturalHeight * boxRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / boxRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

function drawShareSection(ctx, title, lines, x, y, width, color = "#b9b0a4") {
  const height = shareSectionHeight(lines.length, title === "一句话规则" ? 36 : 32);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = "#e3e8df";
  ctx.stroke();

  ctx.fillStyle = "#4b6936";
  ctx.font = "800 19px Inter, PingFang SC, sans-serif";
  ctx.fillText(title, x + 20, y + 34);
  ctx.fillStyle = color === "#424245" ? "#516346" : color;
  ctx.font = title === "一句话规则" ? "400 25px Inter, PingFang SC, sans-serif" : "400 23px Inter, PingFang SC, sans-serif";
  drawWrappedLines(ctx, lines, x + 20, y + 76, title === "一句话规则" ? 36 : 32);
  return y + height;
}

function shareSectionHeight(lineCount, lineHeight) {
  return 96 + lineCount * lineHeight;
}

function drawTagRow(ctx, tags, x, y, maxWidth) {
  let cursorX = x;
  let cursorY = y;
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  tags.forEach((tag) => {
    const tagWidth = ctx.measureText(tag).width + 30;
    if (cursorX + tagWidth > x + maxWidth) {
      cursorX = x;
      cursorY += 42;
    }
    ctx.fillStyle = "#edf3e5";
    roundRect(ctx, cursorX, cursorY, tagWidth, 32, 16);
    ctx.fill();
    ctx.strokeStyle = "#d5e1c9";
    ctx.stroke();
    ctx.fillStyle = "#426034";
    ctx.fillText(tag, cursorX + 15, cursorY + 22);
    cursorX += tagWidth + 10;
  });
  return cursorY + 32;
}

function measureCanvasLines(ctx, text, maxWidth, maxLines = Infinity) {
  const chars = [...String(text)];
  const lines = [];
  let line = "";
  chars.forEach((char) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[kept.length - 1];
  while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[kept.length - 1] = `${last}…`;
  return kept;
}

function drawWrappedLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line) => {
    ctx.fillText(line, x, y);
    y += lineHeight;
  });
  return y;
}

function countTagRows(ctx, tags, maxWidth) {
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  let rows = 1;
  let cursorX = 0;
  tags.forEach((tag) => {
    const tagWidth = ctx.measureText(tag).width + 30;
    if (cursorX + tagWidth > maxWidth && cursorX > 0) {
      rows += 1;
      cursorX = 0;
    }
    cursorX += tagWidth + 10;
  });
  return rows;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function toggleCollect(modeId) {
  if (state.collected.has(modeId)) {
    state.collected.delete(modeId);
    sendGlobalAnalytics("favorite_remove", { modeId });
    showToast("已取消收藏");
  } else {
    state.collected.add(modeId);
    recordFavoriteAdd(modeId);
    showToast("已收藏到当前浏览器");
  }
  saveCollected();
  renderModes();
  updateDetailCollection();
}

function updateGameTabs() {
  document.querySelectorAll("[data-game]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.game === state.gameFilter));
  });
}

function showModeInCases(modeId) { openDetail(modeId); }

function buildCanvas(modes) {
  const nodes = modes.map((mode, index) => ({
    id: mode.id,
    type: "text",
    x: (index % 3) * 520,
    y: Math.floor(index / 3) * 620,
    width: 460,
    height: 560,
    color: "4",
    text: isCoreUpdate(mode) ? coreUpdateMarkdown(mode) : [mode.modeName, (kindLabels[mode.kind] || "玩法模式") + " · " + mode.game, "核心玩法：" + getGameplayLabel(mode) + (isLtmMode(mode) ? " · LTM" : ""), "", "一句话规则：" + mode.oneLineRule, "", "设计观察：" + mode.designObservation, "", ...(mode.sourceModeIds ? ["基于已有案例的设计提炼", ""] : []), "来源：" + mode.sourceUrl].join("\n")
  }));

  return {
    nodes,
    edges: []
  };
}

function exportCurrentCanvas() {
  const modes = getFilteredModes();
  if (!modes.length) {
    showToast("当前筛选没有可导出的卡片");
    return;
  }
  downloadFile(
    `br-mode-intel-${state.filter}.canvas`,
    JSON.stringify(buildCanvas(modes), null, 2),
    "application/json;charset=utf-8"
  );
  showToast(`已导出 ${modes.length} 份资料为 Canvas`);
}

function exportCollectedMarkdown() {
  const modes = state.entries.filter((mode) => state.collected.has(mode.id));
  const maps = typeof mapArchive !== 'undefined' ? mapArchive.entries.filter((map) => mapArchive.mapCollected?.has(map.id)) : [];
  if (!modes.length && !maps.length) {
    showToast("还没有收藏资料");
    return;
  }
  downloadFile(
    "br-mode-collected.md",
    [...modes.map(modeToMarkdown), ...maps.map(mapToMarkdown)].join("\n\n---\n\n")
  );
  showToast(`已导出 ${modes.length + maps.length} 份收藏资料`);
}

// The research workspace owns navigation and rendering; existing export, share,
// date, collection and game-specific timeline helpers above remain reusable.
function renderModes() { renderWorkspace(); }
