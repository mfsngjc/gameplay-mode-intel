const state = {
  modes: [],
  filter: "all",
  gameFilter: "all",
  collected: new Set(JSON.parse(localStorage.getItem("br-mode-collected") || "[]"))
};

const modeGrid = document.querySelector("#modeGrid");
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
  "br-core": "BR常驻",
  "br-ltm": "BR限时",
  casual: "娱乐玩法",
  collected: "已采集"
};

function getAvailableTags() {
  const modes = state.gameFilter === "all"
    ? state.modes
    : state.modes.filter((m) => m.game === state.gameFilter);
  const tags = new Set();
  modes.forEach((m) => m.tags.forEach((t) => tags.add(t)));
  return [...tags].sort();
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

function modeToMarkdown(mode) {
  return `# ${mode.modeName}

- 游戏：${mode.game}
- 上线时间：${mode.launchLabel || mode.date || mode.year}
- 类型：${mode.type.join(" / ")}
- 来源：${mode.sourceUrl}
- 图片来源：${mode.imageSource || "待确认"}

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
          <div class="tag-row">${mode.type.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
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
        <div class="card-foot">设计观察：${escapeHtml(mode.designObservation)}</div>
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
