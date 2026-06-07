const state = {
  modes: [],
  filter: "all",
  gameFilter: "all",
  collected: new Set(JSON.parse(localStorage.getItem("br-mode-collected") || "[]"))
};

const modeGrid = document.querySelector("#modeGrid");
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
  "br-core": "核心玩法",
  "br-ltm": "限时/变体",
  casual: "特殊玩法",
  collected: "已采集"
};

const defaultAiCommentator = "集成农业 AI · DeepSeek-V4-Pro（深度求索）";
const timelineEnabledGames = new Set(["三角洲行动"]);

const deltaFamilyMatchers = {
  warfare: /全面战场|大战场|Warfare|胜者|Victory|Vanguard|先遣|夺旗|攻城|Capture the Flag|Siege|King of the Hill|Hill of Iron|钢铁洪流|Air Superiority|空中优势|4v4|团队死斗|Overload|超载|载具|攻防|战壕|Trench Lines|A\/D/i,
  operations: /烽火地带|搜打撤|撤离|Operations|零号大坝|Zero Dam|红鼠窝|Hot Zone|MandelCell|曼德尔|金库|硬通货|Operation Gold|夺砖|破译|烽火挑战/i
};

function getAvailableTags() {
  const modes = state.gameFilter === "all"
    ? state.modes
    : state.modes.filter((m) => m.game === state.gameFilter);
  const tags = new Set();
  modes.forEach((m) => m.tags.forEach((t) => tags.add(t)));
  return [...tags].sort();
}

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
  localStorage.setItem("br-mode-collected", JSON.stringify([...state.collected]));
}

function getFilteredModes() {
  return state.modes.filter((mode) => {
    if (state.gameFilter !== "all" && mode.game !== state.gameFilter) return false;
    if (state.filter === "all") return true;
    if (state.filter === "collected") return state.collected.has(mode.id);
    return mode.tags.includes(state.filter);
  });
}

function getModeFamily(mode) {
  if (mode.game !== "三角洲行动" || !mode.tags.includes("br-ltm")) return null;

  const sourceText = [
    mode.modeName,
    ...(mode.type || []),
    mode.oneLineRule,
    mode.mechanicChange,
    mode.tempoImpact,
    mode.launchNote
  ].join(" ");
  const hasWarfare = deltaFamilyMatchers.warfare.test(sourceText);
  const hasOperations = deltaFamilyMatchers.operations.test(sourceText);

  if (hasWarfare && hasOperations) {
    return {
      className: "is-hybrid",
      label: "限时·双模式",
      shortLabel: "双模式",
      tagLabel: "限时·双模式类",
      laneKey: "限时·双模式"
    };
  }
  if (hasOperations) {
    return {
      className: "is-operations",
      label: "限时·搜打撤",
      shortLabel: "搜打撤",
      tagLabel: "限时·搜打撤类",
      laneKey: "限时·搜打撤"
    };
  }
  return {
    className: "is-warfare",
    label: "限时·大战场",
    shortLabel: "大战场",
    tagLabel: "限时·大战场类",
    laneKey: "限时·大战场"
  };
}

function getTimelineModes() {
  if (!timelineEnabledGames.has(state.gameFilter)) return [];
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

function getTimelineDateLabel(mode) {
  if (mode.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(mode.launchDate)) {
    const [year, month, day] = mode.launchDate.split("-");
    return `${Number(year)}年${Number(month)}月${Number(day)}日`;
  }
  return mode.launchLabel || mode.date || mode.year || "待确认";
}

function getTimelineMeta(mode) {
  if (mode.tags.includes("br-core")) {
    return { className: "is-core", label: "核心", shortLabel: "核心", laneKey: "核心" };
  }
  if (mode.tags.includes("br-ltm")) {
    const family = getModeFamily(mode);
    return {
      className: `is-variant ${family?.className || ""}`.trim(),
      label: family?.label || "限时/变体",
      shortLabel: family?.shortLabel || "变体",
      laneKey: family?.laneKey || "限时/变体"
    };
  }
  return { className: "is-special", label: "特殊", shortLabel: "特殊", laneKey: "特殊" };
}

function getTimelineShortDate(mode) {
  if (mode.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(mode.launchDate)) {
    const [year, month, day] = mode.launchDate.split("-");
    return `${year.slice(2)}.${Number(month)}.${Number(day)}`;
  }
  return String(mode.year || mode.date || "待定");
}

function getTimelineNodeLabel(mode) {
  const [name] = mode.modeName.split("/");
  const normalized = name
    .replace("玩家票选模式：", "票选")
    .replace("夜战：", "")
    .trim();
  const chars = [...normalized];
  return chars.length > 7 ? `${chars.slice(0, 7).join("")}…` : normalized;
}

function renderTimelineCanvas(modes, filteredIds) {
  const width = Math.max(1040, 96 + Math.max(0, modes.length - 1) * 86);
  const height = 470;
  const lanes = {
    "核心": { y: 64, label: "核心玩法" },
    "限时·大战场": { y: 142, label: "限时·大战场类" },
    "限时·搜打撤": { y: 220, label: "限时·搜打撤类" },
    "限时·双模式": { y: 298, label: "限时·双模式类" },
    "特殊": { y: 376, label: "特殊玩法" }
  };
  const points = modes.map((mode, index) => {
    const meta = getTimelineMeta(mode);
    return {
      mode,
      meta,
      x: 70 + index * 86,
      y: lanes[meta.laneKey].y
    };
  });
  const flowPath = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");

  return `
    <div class="timeline-canvas-wrap" tabindex="0" aria-label="${escapeHtml(state.gameFilter)}玩法更新时间画板">
      <svg class="timeline-canvas-svg" viewBox="0 0 ${width} ${height}" style="width:${width}px;min-width:${width}px" role="img" aria-label="${escapeHtml(state.gameFilter)}玩法更新时间画板">
        <g class="canvas-lanes" aria-hidden="true">
          ${Object.entries(lanes).map(([key, lane]) => `
            <line x1="48" y1="${lane.y}" x2="${width - 34}" y2="${lane.y}"></line>
            <text x="18" y="${lane.y + 5}">${escapeHtml(lane.label)}</text>
          `).join("")}
        </g>
        <path class="canvas-flow" d="${flowPath}"></path>
        ${points.map((point) => {
          const isDimmed = state.filter !== "all" && !filteredIds.has(point.mode.id);
          const typeText = point.mode.type.slice(0, 2).join(" / ");
          return `
            <g class="canvas-node ${point.meta.className} ${isDimmed ? "is-dimmed" : ""}" transform="translate(${point.x} ${point.y})">
              <title>${escapeHtml(getTimelineDateLabel(point.mode))} · ${escapeHtml(point.meta.label)} · ${escapeHtml(point.mode.modeName)} · ${escapeHtml(typeText)}</title>
              <circle r="14"></circle>
              <text class="canvas-node-date" y="-24">${escapeHtml(getTimelineShortDate(point.mode))}</text>
              <text class="canvas-node-label" y="36">${escapeHtml(getTimelineNodeLabel(point.mode))}</text>
              <text class="canvas-node-family" y="53">${escapeHtml(point.meta.shortLabel)}</text>
            </g>
          `;
        }).join("")}
      </svg>
    </div>
  `;
}

function renderTimeline() {
  if (!gameTimeline) return;

  const modes = getTimelineModes();
  if (!modes.length) {
    gameTimeline.hidden = true;
    gameTimeline.innerHTML = "";
    return;
  }

  const filteredIds = new Set(getFilteredModes().map((mode) => mode.id));
  const activeFilterLabel = state.filter === "all" ? "全部玩法" : (tagLabels[state.filter] || state.filter);
  const counts = modes.reduce((acc, mode) => {
    const key = getTimelineMeta(mode).laneKey;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const latestMode = modes[modes.length - 1];

  gameTimeline.hidden = false;
  gameTimeline.innerHTML = `
    <div class="timeline-head">
      <div>
        <span class="timeline-kicker">玩法时间画板</span>
        <h3>${escapeHtml(state.gameFilter)}</h3>
      </div>
      <div class="timeline-stats" aria-label="玩法时间线摘要">
        <span><b>${modes.length}</b> 节点</span>
        <span><b>${counts["核心"] || 0}</b> 核心</span>
        <span><b>${counts["限时·大战场"] || 0}</b> 大战场类</span>
        <span><b>${counts["限时·搜打撤"] || 0}</b> 搜打撤类</span>
        <span><b>${counts["限时·双模式"] || 0}</b> 双模式类</span>
        <span><b>${counts["特殊"] || 0}</b> 特殊</span>
      </div>
    </div>
    <div class="timeline-board">
      <div class="timeline-board-head">
        <p>${escapeHtml(activeFilterLabel)} · 最新节点：${escapeHtml(getTimelineDateLabel(latestMode))} ${escapeHtml(latestMode.modeName)}</p>
        <div class="timeline-legend" aria-label="节点类型图例">
          <span><i class="legend-dot is-core" aria-hidden="true"></i>核心玩法</span>
          <span><i class="legend-dot is-warfare" aria-hidden="true"></i>限时·大战场类</span>
          <span><i class="legend-dot is-operations" aria-hidden="true"></i>限时·搜打撤类</span>
          <span><i class="legend-dot is-hybrid" aria-hidden="true"></i>限时·双模式类</span>
          <span><i class="legend-dot is-special" aria-hidden="true"></i>特殊玩法</span>
        </div>
      </div>
      ${renderTimelineCanvas(modes, filteredIds)}
      <ol class="timeline-list">
        ${modes.map((mode) => {
          const isDimmed = state.filter !== "all" && !filteredIds.has(mode.id);
          const meta = getTimelineMeta(mode);
          const typeText = mode.type.slice(0, 3).join(" / ");
          return `
            <li class="timeline-node ${meta.className} ${isDimmed ? "is-dimmed" : ""}">
              <span class="timeline-dot" aria-hidden="true"></span>
              <div class="timeline-date-row">
                <time datetime="${escapeHtml(mode.launchDate || mode.date || mode.year)}">${escapeHtml(getTimelineDateLabel(mode))}</time>
                <span>${escapeHtml(meta.label)}</span>
              </div>
              <div class="timeline-event">
                <strong>${escapeHtml(mode.modeName)}</strong>
                <span>${escapeHtml(typeText)}</span>
              </div>
            </li>
          `;
        }).join("")}
      </ol>
    </div>
  `;
}

function modeToMarkdown(mode) {
  return `# ${mode.modeName}

- 游戏：${mode.game}
- 上线时间：${mode.launchLabel || mode.date || mode.year}
- 玩法线：${getModeFamily(mode)?.tagLabel || "未单独标注"}
- 类型：${mode.type.join(" / ")}
- 来源：${mode.sourceUrl}
- 图片来源：${mode.imageSource || "待确认"}
- AI评论：${getAiCommentator(mode)}

## 一句话规则

${mode.oneLineRule}

## 机制变化

${mode.mechanicChange}

## 节奏影响

${mode.tempoImpact}

## 设计观察

${mode.designObservation}

## 时间备注

${mode.launchNote || "待确认"}
`;
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
  activeShare.mode = mode;
  activeShare.blob = null;
  if (activeShare.objectUrl) {
    URL.revokeObjectURL(activeShare.objectUrl);
    activeShare.objectUrl = null;
  }

  shareTitle.textContent = mode.modeName;
  sharePreviewImage.removeAttribute("src");
  sharePreviewImage.hidden = true;
  sharePreviewImage.alt = `${mode.modeName} 玩法块分享预览图`;

  shareSkeleton.hidden = false;
  shareSource.hidden = true;

  shareModal.hidden = false;
  document.body.classList.add("modal-open");

  const blob = await renderModeBlockPng(mode);
  activeShare.blob = blob;
  activeShare.objectUrl = URL.createObjectURL(blob);

  shareSkeleton.hidden = true;
  sharePreviewImage.src = activeShare.objectUrl;
  sharePreviewImage.hidden = false;

  if (mode.sourceUrl) {
    shareSourceLink.href = mode.sourceUrl;
    shareSourceName.textContent = mode.modeName;
    shareSource.hidden = false;
  }
}

function closeShareModal() {
  shareModal.hidden = true;
  shareSkeleton.hidden = true;
  shareSource.hidden = true;
  document.body.classList.remove("modal-open");
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
  ctx.fillStyle = "#fff0db";
  roundRect(ctx, layout.margin, y, 116, 32, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 159, 10, .4)";
  ctx.stroke();
  ctx.fillStyle = "#7c4a00";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  ctx.fillText(mode.game, layout.margin + 20, y + 22);

  ctx.fillStyle = "#86868b";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  const dateText = mode.date || mode.year;
  ctx.fillText(dateText, width - layout.margin - ctx.measureText(dateText).width, y + 22);

  /* ── Title: badge bottom + 10px visual gap ── */
  ctx.fillStyle = "#1d1d1f";
  ctx.font = "800 50px Inter, PingFang SC, sans-serif";
  y = drawWrappedLines(ctx, layout.lines.title, layout.margin, y + 88, 58);

  /* ── Tags: title bottom + 14px gap ── */
  y = y - 32;
  y = drawTagRow(ctx, mode.type, layout.margin, y, layout.contentWidth);

  /* ── Launch time: tags bottom + 20px ── */
  y += 20;
  ctx.fillStyle = "#f5f5f7";
  roundRect(ctx, layout.margin, y, layout.contentWidth, 46, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, .06)";
  ctx.stroke();
  ctx.fillStyle = "#0071e3";
  ctx.font = "800 18px Inter, PingFang SC, sans-serif";
  ctx.fillText("上线时间", layout.margin + 18, y + 30);
  ctx.fillStyle = "#424245";
  ctx.font = "700 18px Inter, PingFang SC, sans-serif";
  ctx.fillText(mode.launchLabel || mode.date || mode.year, layout.margin + 108, y + 30);

  /* ── Sections: launch bottom + 24px ── */
  y += 70;
  y = drawShareSection(ctx, "一句话规则", layout.lines.rule, layout.margin, y, layout.contentWidth, "#424245");
  y = drawShareSection(ctx, "机制变化", layout.lines.mechanic, layout.margin, y + 12, layout.contentWidth, "#6e6e73");
  y = drawShareSection(ctx, "节奏影响", layout.lines.tempo, layout.margin, y + 12, layout.contentWidth, "#6e6e73");
  y = drawShareSection(ctx, "设计观察", layout.lines.observation, layout.margin, y + 12, layout.contentWidth, "#2b6d3c");

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
  const title = measureCanvasLines(ctx, mode.modeName, contentWidth, 3);
  ctx.font = "400 25px Inter, PingFang SC, sans-serif";
  const rule = measureCanvasLines(ctx, mode.oneLineRule, contentWidth - 40, 4);
  ctx.font = "400 23px Inter, PingFang SC, sans-serif";
  const mechanic = measureCanvasLines(ctx, mode.mechanicChange, contentWidth - 40, 6);
  const tempo = measureCanvasLines(ctx, mode.tempoImpact, contentWidth - 40, 6);
  const observation = measureCanvasLines(ctx, mode.designObservation, contentWidth - 40, 5);

  const tagRows = countTagRows(ctx, mode.type, contentWidth);
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
    sectionsHeight + 40;

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
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function drawCardBackground(ctx, width, height) {
  ctx.fillStyle = "#ffffff";
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
  ctx.fillStyle = "#f5f5f7";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, .06)";
  ctx.stroke();

  ctx.fillStyle = "#0071e3";
  ctx.font = "800 19px Inter, PingFang SC, sans-serif";
  ctx.fillText(title, x + 20, y + 34);
  ctx.fillStyle = color;
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
    ctx.fillStyle = "#f3efe7";
    roundRect(ctx, cursorX, cursorY, tagWidth, 32, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, .06)";
    ctx.stroke();
    ctx.fillStyle = "#515154";
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
    showToast("已从本地采集中移除");
  } else {
    state.collected.add(modeId);
    showToast("已采集到当前浏览器本地");
  }
  saveCollected();
  renderModes();
}

function buildCanvas(modes) {
  const nodes = modes.map((mode, index) => ({
    id: mode.id,
    type: "text",
    x: (index % 3) * 520,
    y: Math.floor(index / 3) * 360,
    width: 460,
    height: 270,
    color: "4",
    text: `${mode.modeName}\n${mode.game} · ${mode.type.join(" / ")}\n\n一句话规则：${mode.oneLineRule}\n\n设计观察：${mode.designObservation}\n\n来源：${mode.sourceUrl}`
  }));

  return {
    nodes,
    edges: []
  };
}

function getModeTypeChips(mode) {
  const family = getModeFamily(mode);
  const familyChip = family
    ? [{ label: family.tagLabel, className: `tag family-tag ${family.className}` }]
    : [];
  return [
    ...familyChip,
    ...mode.type.map((tag) => ({ label: tag, className: "tag" }))
  ];
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
  showToast(`已导出 ${modes.length} 个玩法为 Canvas`);
}

function exportCollectedMarkdown() {
  const modes = state.modes.filter((mode) => state.collected.has(mode.id));
  if (!modes.length) {
    showToast("还没有采集内容");
    return;
  }
  downloadFile(
    "br-mode-collected.md",
    modes.map(modeToMarkdown).join("\n\n---\n\n")
  );
  showToast(`已导出 ${modes.length} 个采集玩法`);
}

function renderModes() {
  const modes = getFilteredModes();
  modeGrid.innerHTML = modes.map((mode) => {
    const collected = state.collected.has(mode.id);
    const typeChips = getModeTypeChips(mode);
    const imageBlock = mode.imageUrl ? `
      <div class="card-image">
        <img src="${escapeHtml(mode.imageUrl)}" alt="${escapeHtml(mode.modeName)} 官方公告图" loading="lazy">
        <span class="image-source">${escapeHtml(mode.imageSource || "官方公告图")}</span>
      </div>
    ` : "";
    return `
      <article class="mode-card" data-id="${escapeHtml(mode.id)}" data-tags="${escapeHtml(mode.tags.join(" "))}">
        ${imageBlock}
        <div class="card-body">
          <div class="card-top">
            <h3>${escapeHtml(mode.modeName)}</h3>
            <span class="year">${escapeHtml(mode.year)}</span>
          </div>
          <div class="tag-row">${typeChips.map((chip) => `<span class="${escapeHtml(chip.className)}">${escapeHtml(chip.label)}</span>`).join("")}</div>
          <div class="launch-row">
            <span>上线时间</span>
            <strong>${escapeHtml(mode.launchLabel || mode.date || mode.year)}</strong>
          </div>
          <p class="summary">${escapeHtml(mode.oneLineRule)}</p>
          <dl>
            <div><dt>机制变化</dt><dd>${escapeHtml(mode.mechanicChange)}</dd></div>
            <div><dt>节奏影响</dt><dd>${escapeHtml(mode.tempoImpact)}</dd></div>
            <div><dt>时间备注</dt><dd>${escapeHtml(mode.launchNote || "待确认")}</dd></div>
          </dl>
        </div>
        <div class="card-foot">
          <h4>设计观察</h4>
          <blockquote>${escapeHtml(mode.designObservation)}</blockquote>
          <cite>&mdash; ${escapeHtml(getAiCommentator(mode))}</cite>
        </div>
        <div class="card-source">
          <span class="source-label">来源</span>
          <a href="${escapeHtml(mode.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(mode.sourceUrl)}</a>
        </div>
        <div class="card-actions compact-actions">
          <button type="button" class="${collected ? "collected" : "primary-action"}" data-action="collect" data-id="${escapeHtml(mode.id)}" aria-label="${collected ? "取消采集" : "采集"} ${escapeHtml(mode.modeName)}" title="${collected ? "已采集" : "采集"}">${iconSvg(collected ? "collected" : "collect")}<span>${collected ? "已采集" : "采集"}</span></button>
          <button type="button" data-action="share" data-id="${escapeHtml(mode.id)}" aria-label="分享 ${escapeHtml(mode.modeName)}" title="分享">${iconSvg("share")}<span>分享</span></button>
          <button type="button" data-action="copy" data-id="${escapeHtml(mode.id)}" aria-label="复制 ${escapeHtml(mode.modeName)} MD" title="复制 MD">${iconSvg("copy")}<span>复制 MD</span></button>
        </div>
      </article>
    `;
  }).join("");

  const collectedCount = state.collected.size;
  const gameLabel = state.gameFilter === "all" ? "" : ` · ${state.gameFilter}`;
  const currentLabel = tagLabels[state.filter] || state.filter;
  statusLine.textContent = `当前显示 ${modes.length} / ${state.modes.length} 个玩法${gameLabel}，已采集 ${collectedCount} 个。筛选：${currentLabel}`;
  caseCount.textContent = `${state.modes.length} 个玩法案例`;
  renderTimeline();
}

function renderFilters() {
  const filtersContainer = document.querySelector("#filterButtons");
  if (!filtersContainer) return;

  const availableTags = getAvailableTags();
  const tagsToShow = ["all", ...availableTags];

  filtersContainer.innerHTML = tagsToShow.map((tag) => {
    const label = tagLabels[tag] || tag;
    const pressed = state.filter === tag;
    return `<button type="button" data-filter="${tag}" aria-pressed="${pressed}">${label}</button>`;
  }).join("");

  // Always show collected button
  const collectedBtn = document.createElement("button");
  collectedBtn.type = "button";
  collectedBtn.dataset.filter = "collected";
  collectedBtn.setAttribute("aria-pressed", String(state.filter === "collected"));
  collectedBtn.textContent = tagLabels.collected;
  filtersContainer.insertAdjacentHTML("beforeend", collectedBtn.outerHTML);
}

function bindEvents() {
  document.querySelectorAll("[data-game]").forEach((button) => {
    button.addEventListener("click", () => {
      state.gameFilter = button.dataset.game;
      state.filter = "all"; // reset tag filter when switching games
      document.querySelectorAll("[data-game]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderFilters();
      renderModes();
    });
  });

  const filtersContainer = document.querySelector("#filterButtons");
  if (filtersContainer) {
    filtersContainer.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-filter]");
      if (!btn) return;
      state.filter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === btn));
      });
      renderModes();
    });
  }

  modeGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const mode = state.modes.find((item) => item.id === target.dataset.id);
    if (!mode) return;

    if (target.dataset.action === "collect") toggleCollect(mode.id);
    if (target.dataset.action === "share") openShareModal(mode);
    if (target.dataset.action === "copy") copyModeMarkdown(mode);
  });

  document.querySelector("#exportCanvas").addEventListener("click", exportCurrentCanvas);
  document.querySelector("#exportCollected").addEventListener("click", exportCollectedMarkdown);
  document.querySelector("#downloadShareImage").addEventListener("click", downloadActiveShareImage);
  document.querySelector("#copyShareMarkdown").addEventListener("click", copyActiveShareMarkdown);
  document.querySelector("#downloadShareMarkdown").addEventListener("click", downloadActiveShareMarkdown);
  document.querySelectorAll("[data-share-close]").forEach((item) => item.addEventListener("click", closeShareModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shareModal.hidden) closeShareModal();
  });
}

async function init() {
  try {
    const response = await fetch("data/modes.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.modes = await response.json();
    renderFilters();
    renderModes();
    bindEvents();
  } catch (error) {
    statusLine.textContent = `加载失败：${error.message}`;
    modeGrid.innerHTML = `<p class="note">没有加载到玩法数据。请确认通过本地服务器访问页面，而不是直接打开 file://。</p>`;
  }
}

init();
