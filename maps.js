const MAP_ZOOM_MAX = 8;
const mapArchive = { entries: [], game: 'all', loading: true, error: false, zoom: 1 };
const mapCategoryLabels = { operations: '烽火地带', warfare: '全面战场', campaign: '黑鹰坠落', 'battle-royale': '大逃杀' };
const mapGameLabels = { all: '全部地图', delta: '三角洲行动', battlefield6: '战地风云 6', valorant: '无畏契约', pubg: 'PUBG', apex: 'Apex Legends' };
let mapTrigger = null;
let mapPan = null;

function mapGameKey(entry) {
  return entry.gameKey || ({ '三角洲行动': 'delta', '战地风云 6': 'battlefield6', '无畏契约': 'valorant', PUBG: 'pubg', 'Apex Legends': 'apex' }[entry.game] || '');
}

function renderMapArchive() {
  const grid = document.querySelector('#mapArchiveGrid');
  const words = state.query.toLocaleLowerCase().trim().split(/\s+/);
  const entries = mapArchive.entries.filter((entry) =>
    (mapArchive.game === 'all' || mapGameKey(entry) === mapArchive.game) &&
    words.every((word) => [entry.name, entry.id, entry.variant, entry.game, mapCategoryLabels[entry.category], mapGameLabels[mapGameKey(entry)]].join(' ').toLocaleLowerCase().includes(word)));
  document.querySelector('#mapResultCount').textContent = mapArchive.loading ? '正在读取地图…' : `已显示 ${entries.length} / ${mapArchive.entries.length} 张地图`;
  if (mapArchive.loading) { grid.innerHTML = '<p class="context-note">正在读取地图资料…</p>'; return; }
  if (mapArchive.error) {
    grid.innerHTML = '<div class="empty-state"><h3>地图资料暂时无法读取</h3><button class="button" data-map-retry>重新加载</button></div>'; return;
  }
  if (!entries.length) {
    grid.innerHTML = '<div class="empty-state">' + icon('map') + '<h3>没有找到匹配的地图</h3><p>试试地图中文名，或清除搜索条件。</p></div>'; return;
  }
  grid.innerHTML = entries.map((entry) => {
    const isDelta = mapGameKey(entry) === 'delta';
    const isPlanCover = ['pubg', 'apex'].includes(mapGameKey(entry));
    const coverLabel = mapCategoryLabels[entry.category] || mapGameLabels[mapGameKey(entry)] || '官方地图';
    const coverHint = isDelta ? '打开互动地图' : (isPlanCover ? '查看 2D 平面图' : '查看官方地图视觉');
    const downloadLabel = isDelta ? '下载底图' : '下载图片';
    const imageAlt = isPlanCover ? '2D 游戏内平面图' : '官方地图视觉图';
    const wikiLink = entry.wikiUrl ? '<a href="' + escapeHtml(entry.wikiUrl) + '" target="_blank" rel="noopener noreferrer">Wiki ↗</a>' : '';
    return '<article class="map-archive-card">' +
    '<button class="map-preview-button" type="button" data-map-interactive="' + escapeHtml(entry.id) + '" aria-label="查看' + escapeHtml(entry.name) + '地图">' +
    '<img src="' + escapeHtml(entry.thumbnailUrl) + '" alt="' + escapeHtml(entry.name) + escapeHtml(imageAlt) + '" width="512" height="288" loading="lazy">' +
    '<span class="map-cover-label">' + escapeHtml(coverLabel) + '</span><span class="map-preview-hint">' + icon('search') + escapeHtml(coverHint) + '</span></button>' +
    '<div class="map-card-info"><p class="map-card-game">' + escapeHtml(entry.game) + '</p><h2>' + escapeHtml(entry.name) + '</h2><p>' + escapeHtml(entry.variant) + '</p>' +
    '<div class="map-card-actions"><a href="' + escapeHtml(entry.imageUrl) + '" download="' + escapeHtml(entry.name) + '.jpg">' + icon('download') + downloadLabel + '</a>' +
    (entry.planImageUrl ? '<button type="button" data-map-plan="' + escapeHtml(entry.id) + '">查看 2D 平面图</button>' : '') +
    ((!entry.planImageUrl || entry.planImageUrl !== entry.imageUrl) ? '<button type="button" data-map-open="' + escapeHtml(entry.id) + '">查看静态底图</button>' : '') + wikiLink + '</div></div></article>';
  }).join('');
}

function resizeMapPreview(reset = false) {
  const viewport = document.querySelector('#mapViewport');
  const stage = document.querySelector('#mapImageStage');
  const image = document.querySelector('#mapDetailImage');
  const previousWidth = image.clientWidth;
  const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / (previousWidth || 1);
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / (previousWidth || 1);
  const width = Math.min(viewport.clientWidth, viewport.clientHeight) * mapArchive.zoom;
  stage.style.width = width + 'px';
  stage.style.height = width + 'px';
  image.style.width = '100%';
  image.style.height = '100%';
  viewport.scrollLeft = reset ? 0 : centerX * width - viewport.clientWidth / 2;
  viewport.scrollTop = reset ? 0 : centerY * width - viewport.clientHeight / 2;
  document.querySelector('#mapZoomValue').textContent = Math.round(mapArchive.zoom * 100) + '%';
  document.querySelector('[data-map-zoom="out"]').disabled = mapArchive.zoom <= 1;
  document.querySelector('[data-map-zoom="in"]').disabled = mapArchive.zoom >= MAP_ZOOM_MAX;
  viewport.classList.toggle('is-pannable', mapArchive.zoom > 1);
}

function openMapPreview(id, kind = 'cover') {
  const entry = mapArchive.entries.find((item) => item.id === id);
  if (!entry) return;
  const isPlan = kind === 'plan' && entry.planImageUrl;
  const imageUrl = isPlan ? entry.planImageUrl : entry.imageUrl;
  const sourceUrl = isPlan ? (entry.planCalloutSourceUrl || entry.planSourceUrl) : entry.sourceUrl;
  const wiki = document.querySelector('#mapDetailWiki');
  mapTrigger = document.activeElement;
  document.querySelector('#mapDetailTitle').textContent = entry.name;
  document.querySelector('#mapDetailSubtitle').textContent = isPlan
    ? entry.variant + ' · ' + entry.planType
    : entry.variant + ' · ' + (entry.gameKey === 'delta' ? '官方底图' : '官方地图视觉图');
  const image = document.querySelector('#mapDetailImage');
  image.src = imageUrl;
  image.alt = entry.name + (isPlan ? '2D 游戏内平面图' : (entry.gameKey === 'delta' ? '官方俯视底图' : '官方地图视觉图'));
  image.hidden = false;
  document.querySelector('#mapImageError').hidden = true;
  document.querySelector('#mapDetailSource').href = sourceUrl;
  wiki.href = entry.wikiUrl || '#';
  wiki.hidden = !entry.wikiUrl;
  document.querySelector('#mapDetailCredit').textContent = entry.gameKey === 'delta'
    ? '底图 © 腾讯 · 点位、楼层与版本信息以官方工具为准'
    : isPlan
      ? '平面图来源：' + entry.planSource + ' · 地图版本和点位名称以来源页面为准'
      : '图片来源：' + entry.game + '官方地图页 · 版本信息以官方页面为准';
  const callouts = document.querySelector('#mapDetailCallouts');
  const calloutLayer = document.querySelector('#mapCalloutLayer');
  calloutLayer.innerHTML = isPlan && entry.planCalloutPoints?.length
    ? entry.planCalloutPoints.map((point) => '<span class="map-callout-point" style="left:' + point.left + '%;top:' + point.top + '%" title="' + escapeHtml(point.name) + '">' + escapeHtml(point.name) + '</span>').join('')
    : '';
  calloutLayer.hidden = !(isPlan && entry.planCalloutPoints?.length);
  if (isPlan && entry.planCallouts?.length) {
    callouts.textContent = '游戏内点位命名（' + entry.planCallouts.length + '）：' + entry.planCallouts.join(' · ');
    callouts.hidden = false;
  } else {
    callouts.hidden = true;
    callouts.textContent = '';
  }
  const download = document.querySelector('#mapDetailDownload');
  download.href = imageUrl;
  download.download = entry.name + (isPlan ? '-2d-plan' : '') + (isPlan && imageUrl.endsWith('.png') ? '.png' : '.jpg');
  document.querySelector('#mapDialog').showModal();
  document.body.classList.add('modal-open');
  mapArchive.zoom = 1;
  resizeMapPreview(true);
}

function closeMapPreview() {
  mapPan = null;
  document.querySelector('#mapViewport').classList.remove('is-panning');
  document.querySelector('#mapDialog').close();
  document.body.classList.remove('modal-open');
  if (mapTrigger?.isConnected) mapTrigger.focus();
}

async function loadMapArchive() {
  mapArchive.loading = true;
  mapArchive.error = false;
  if (state.view === 'maps') renderMapArchive();
  try {
    const response = await fetch('data/maps.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Map archive unavailable');
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error('Invalid map archive');
    mapArchive.entries = entries;
  } catch { mapArchive.error = true; }
  mapArchive.loading = false;
  document.querySelector('#navMapCount').textContent = mapArchive.entries.length || '—';
  if (state.ready) updateCounts();
  if (state.view === 'maps') renderMapArchive();
}

function initMapArchive() {
  document.addEventListener('click', (event) => {
    const interactive = event.target.closest('[data-map-interactive]');
    if (interactive) openInteractiveMap(interactive.dataset.mapInteractive);
    const plan = event.target.closest('[data-map-plan]');
    if (plan) openMapPreview(plan.dataset.mapPlan, 'plan');
    const open = event.target.closest('[data-map-open]');
    if (open) openMapPreview(open.dataset.mapOpen);
    const game = event.target.closest('[data-map-game]');
    if (game) {
      mapArchive.game = game.dataset.mapGame;
      document.querySelectorAll('[data-map-game]').forEach((button) => button.setAttribute('aria-pressed', String(button === game)));
      renderMapArchive();
    }
    if (event.target.closest('[data-map-retry]')) loadMapArchive();
    const zoom = event.target.closest('[data-map-zoom]');
    if (zoom) {
      mapArchive.zoom = zoom.dataset.mapZoom === 'reset' ? 1 : Math.max(1, Math.min(MAP_ZOOM_MAX, mapArchive.zoom + (zoom.dataset.mapZoom === 'in' ? .5 : -.5)));
      resizeMapPreview(zoom.dataset.mapZoom === 'reset');
    }
  });
  const dialog = document.querySelector('#mapDialog');
  const viewport = document.querySelector('#mapViewport');
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || (viewport.scrollWidth <= viewport.clientWidth && viewport.scrollHeight <= viewport.clientHeight)) return;
    mapPan = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    viewport.classList.add('is-panning');
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!mapPan || event.pointerId !== mapPan.pointerId) return;
    event.preventDefault();
    viewport.scrollLeft = mapPan.scrollLeft - (event.clientX - mapPan.startX);
    viewport.scrollTop = mapPan.scrollTop - (event.clientY - mapPan.startY);
  });
  const stopMapPan = (event) => {
    if (!mapPan || (event?.pointerId !== undefined && event.pointerId !== mapPan.pointerId)) return;
    if (event && viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    mapPan = null;
    viewport.classList.remove('is-panning');
  };
  viewport.addEventListener('pointerup', stopMapPan);
  viewport.addEventListener('pointercancel', stopMapPan);
  viewport.addEventListener('lostpointercapture', stopMapPan);
  document.querySelector('#mapDetailClose').addEventListener('click', closeMapPreview);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeMapPreview(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeMapPreview(); });
  document.querySelector('#mapDetailImage').addEventListener('error', (event) => {
    event.target.hidden = true;
    document.querySelector('#mapCalloutLayer').hidden = true;
    document.querySelector('#mapImageError').hidden = false;
  });
  document.querySelector('#mapArchiveGrid').addEventListener('error', (event) => {
    if (event.target.tagName !== 'IMG') return;
    const fallback = document.createElement('span');
    fallback.className = 'map-image-fallback';
    fallback.textContent = '预览暂时不可用 · 点击查看底图';
    event.target.replaceWith(fallback);
  }, true);
  window.addEventListener('resize', () => { if (dialog.open) resizeMapPreview(); });
  window.addEventListener('hashchange', () => { if (dialog.open) closeMapPreview(); });
  const interactiveDialog = document.querySelector('#interactiveMapDialog');
  document.querySelector('#interactiveMapClose').addEventListener('click', closeInteractiveMap);
  interactiveDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeInteractiveMap(); });
  window.addEventListener('message', (event) => {
    if (event.origin === location.origin && event.source === document.querySelector('#interactiveMapFrame').contentWindow && event.data?.type === 'delta-map-close') closeInteractiveMap();
  });
  window.addEventListener('hashchange', () => { if (interactiveDialog.open) closeInteractiveMap(); });
  loadMapArchive();
}


function openInteractiveMap(id) {
  const entry = mapArchive.entries.find(item => item.id === id);
  if (!entry) return;
  if (mapGameKey(entry) !== 'delta') {
    openMapPreview(id, ['pubg', 'apex'].includes(mapGameKey(entry)) ? 'plan' : 'cover');
    return;
  }
  mapTrigger = document.activeElement;
  const query = new URL(entry.sourceUrl).search;
  const base = 'assets/maps/delta-interactive/';
  const url = base + (window.innerWidth < 760 ? 'm/index.html' : 'index.html') + query;
  const frame = document.querySelector('#interactiveMapFrame');
  frame.title = entry.game + ' · ' + entry.name + '互动地图';
  document.querySelector('#interactiveMapTitle').textContent = entry.game + ' · 互动地图';
  document.querySelector('#interactiveMapSource').href = entry.sourceUrl;
  document.querySelector('#interactiveMapStandalone').href = url;
  document.querySelector('#interactiveMapDialog').showModal();
  document.body.classList.add('modal-open');
  frame.src = url;
}

function closeInteractiveMap() {
  document.querySelector('#interactiveMapDialog').close();
  document.querySelector('#interactiveMapFrame').src = 'about:blank';
  document.body.classList.remove('modal-open');
  if (mapTrigger?.isConnected) mapTrigger.focus();
}
