const mapArchive = { entries: [], category: 'all', loading: true, error: false, zoom: 1 };
const mapCategoryLabels = { operations: '烽火地带', warfare: '全面战场', campaign: '黑鹰坠落' };
let mapTrigger = null;

function renderMapArchive() {
  const grid = document.querySelector('#mapArchiveGrid');
  const words = state.query.toLocaleLowerCase().trim().split(/\s+/);
  const entries = mapArchive.entries.filter((entry) =>
    (mapArchive.category === 'all' || entry.category === mapArchive.category) &&
    words.every((word) => [entry.name, entry.id, entry.variant, entry.game, mapCategoryLabels[entry.category]].join(' ').toLocaleLowerCase().includes(word)));
  document.querySelector('#mapResultCount').textContent = mapArchive.loading ? '正在读取地图…' : `已显示 ${entries.length} / ${mapArchive.entries.length} 张地图`;
  if (mapArchive.loading) { grid.innerHTML = '<p class="context-note">正在读取地图资料…</p>'; return; }
  if (mapArchive.error) {
    grid.innerHTML = '<div class="empty-state"><h3>地图资料暂时无法读取</h3><button class="button" data-map-retry>重新加载</button></div>'; return;
  }
  if (!entries.length) {
    grid.innerHTML = '<div class="empty-state">' + icon('map') + '<h3>' + (mapArchive.category === 'campaign' ? '黑鹰坠落底图待补充' : '没有找到匹配的地图') + '</h3><p>' +
      (mapArchive.category === 'campaign' ? '已核查的官方地图工具暂未提供战役底图，找到可靠资源后再收录。' : '试试地图中文名，或清除搜索条件。') + '</p></div>'; return;
  }
  grid.innerHTML = entries.map((entry) => '<article class="map-archive-card">' +
    '<button class="map-preview-button" type="button" data-map-interactive="' + escapeHtml(entry.id) + '" aria-label="查看' + escapeHtml(entry.name) + '地图">' +
    '<img src="' + escapeHtml(entry.thumbnailUrl) + '" alt="' + escapeHtml(entry.name) + '官方俯视底图" width="512" height="512" loading="lazy">' +
    '<span class="map-cover-label">' + mapCategoryLabels[entry.category] + '</span><span class="map-preview-hint">' + icon('search') + '打开互动地图</span></button>' +
    '<div class="map-card-info"><p class="map-card-game">' + escapeHtml(entry.game) + '</p><h2>' + escapeHtml(entry.name) + '</h2><p>' + escapeHtml(entry.variant) + ' · 2048 × 2048</p>' +
    '<div class="map-card-actions"><a href="' + escapeHtml(entry.imageUrl) + '" download="' + escapeHtml(entry.name) + '.jpg">' + icon('download') + '下载底图</a>' +
    '<button type="button" data-map-open="' + escapeHtml(entry.id) + '">查看静态底图</button></div></div></article>').join('');
}

function resizeMapPreview(reset = false) {
  const viewport = document.querySelector('#mapViewport');
  const image = document.querySelector('#mapDetailImage');
  const previousWidth = image.clientWidth;
  const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / (previousWidth || 1);
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / (previousWidth || 1);
  const width = Math.min(viewport.clientWidth, viewport.clientHeight) * mapArchive.zoom;
  image.style.width = width + 'px';
  image.style.height = width + 'px';
  viewport.scrollLeft = reset ? 0 : centerX * width - viewport.clientWidth / 2;
  viewport.scrollTop = reset ? 0 : centerY * width - viewport.clientHeight / 2;
  document.querySelector('#mapZoomValue').textContent = Math.round(mapArchive.zoom * 100) + '%';
  document.querySelector('[data-map-zoom="out"]').disabled = mapArchive.zoom <= 1;
  document.querySelector('[data-map-zoom="in"]').disabled = mapArchive.zoom >= 4;
}

function openMapPreview(id) {
  const entry = mapArchive.entries.find((item) => item.id === id);
  if (!entry) return;
  mapTrigger = document.activeElement;
  document.querySelector('#mapDetailTitle').textContent = entry.name;
  document.querySelector('#mapDetailSubtitle').textContent = entry.variant + ' · 官方底图 · 2048 × 2048';
  const image = document.querySelector('#mapDetailImage');
  image.src = entry.imageUrl;
  image.alt = entry.name + '官方俯视底图';
  image.hidden = false;
  document.querySelector('#mapImageError').hidden = true;
  document.querySelector('#mapDetailSource').href = entry.sourceUrl;
  const download = document.querySelector('#mapDetailDownload');
  download.href = entry.imageUrl;
  download.download = entry.name + '.jpg';
  document.querySelector('#mapDialog').showModal();
  document.body.classList.add('modal-open');
  mapArchive.zoom = 1;
  resizeMapPreview(true);
}

function closeMapPreview() {
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
    const open = event.target.closest('[data-map-open]');
    if (open) openMapPreview(open.dataset.mapOpen);
    const category = event.target.closest('[data-map-category]');
    if (category) {
      mapArchive.category = category.dataset.mapCategory;
      document.querySelectorAll('[data-map-category]').forEach((button) => button.setAttribute('aria-pressed', String(button === category)));
      renderMapArchive();
    }
    if (event.target.closest('[data-map-retry]')) loadMapArchive();
    const zoom = event.target.closest('[data-map-zoom]');
    if (zoom) {
      mapArchive.zoom = zoom.dataset.mapZoom === 'reset' ? 1 : Math.max(1, Math.min(4, mapArchive.zoom + (zoom.dataset.mapZoom === 'in' ? .5 : -.5)));
      resizeMapPreview(zoom.dataset.mapZoom === 'reset');
    }
  });
  const dialog = document.querySelector('#mapDialog');
  document.querySelector('#mapDetailClose').addEventListener('click', closeMapPreview);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeMapPreview(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeMapPreview(); });
  document.querySelector('#mapDetailImage').addEventListener('error', (event) => {
    event.target.hidden = true;
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
