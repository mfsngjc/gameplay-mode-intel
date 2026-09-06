/* Local presentation adapter. The official map coordinate/point logic stays in js/lib/main.js. */
(function () {
  window.addEventListener('error', event => {
    if (!event.message) return;
    let error = document.getElementById('localMapError');
    if (!error) { error=document.createElement('div'); error.id='localMapError'; error.setAttribute('role','alert'); document.body.append(error); }
    error.textContent = '地图交互加载异常：' + event.message;
  });
  const originalTileUrl = L.TileLayer.prototype.getTileUrl;
  const available = Object.fromEntries(Object.entries(window.DELTA_TILES).map(([layer, tiles]) => [layer, new Set(tiles)]));
  L.TileLayer.prototype.getTileUrl = function (coords) {
    const url = originalTileUrl.call(this, coords);
    const match = url.match(/\/img\/([^/]+)\/(-?\d+_-?\d+_-?\d+)\.jpg/);
    return match && !available[match[1]]?.has(match[2]) ? window.DELTA_ASSET_ROOT + 'blank.jpg' : url;
  };
  document.addEventListener('DOMContentLoaded', function () {
    const embedded = window.parent !== window;
    if (!embedded) {
      const back = document.createElement('a');
      back.className = 'local-map-back';
      back.href = new URL('../../../index.html#maps', window.DELTA_ASSET_ROOT).href;
      back.textContent = '← 返回地图';
      document.body.append(back);
    }
    // Social SDKs and the upstream unfinished tutorial do not belong to a local map archive.
    document.querySelectorAll('.btn-share,.btn-feedback,.btn-tutorial,.bottom-bar,.share-tips').forEach(el => el.remove());
    // A few fish icons return 404 upstream. Keep the point usable with an explicit text label.
    const unavailable = new Set(['mullet', 'grouper']);
    const missingIcon = image => {
      if (!(image instanceof HTMLImageElement) || !image.getAttribute('src')) return;
      const name = image.closest('.nav-list-item')?.querySelector('.wz-name')?.textContent || '点位';
      const label = document.createElement('span');
      label.className = 'local-missing-icon'; label.textContent = name;
      label.title = '官方暂缺此图标，仍可点击查看点位';
      image.replaceWith(label);
    };
    document.addEventListener('error', event => missingIcon(event.target), true);
    const search = document.querySelector('.select-iput');
    if (search) search.setAttribute('aria-label', '搜索地图点位');
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && embedded) window.parent.postMessage({type:'delta-map-close'}, location.origin);
    });
    // Upstream desktop switches maps on hover; also support click and keyboard.
    document.addEventListener('click', event => {
      const toggle = event.target.closest('.btn-change-map');
      const menu = document.querySelector('.btn-change-map-ctn');
      if (toggle && !location.pathname.includes('/m/')) {
        menu.classList.toggle('local-menu-open');
        if (menu.classList.contains('local-menu-open')) $(menu).trigger('mouseenter');
      } else if (!event.target.closest('.btn-change-map-ctn') || event.target.closest('.type-option-item,.map-lv-item')) {
        menu?.classList.remove('local-menu-open');
      }
      const item = event.target.closest('.map-item');
      if (item && !location.pathname.includes('/m/')) $(item).trigger('mouseover');
    });
    document.addEventListener('focusin', event => {
      if (event.target.matches('.map-item,.map-lv-item') && !location.pathname.includes('/m/')) $(event.target).trigger('mouseover');
    });
    const selectors = '.choose-all,.btn-nav-state,.btn-check-marker,.btn-nav-state-top,.type-option-item,.view-change1,.view-change2,.nav-list-item,.reset-choose,.btn-floor,.btn-select-region,.btn-change-map,.map-item,.map-lv-item,.region-item,.floor-item,.war-lv-item,.btn-log,.btn-close-pop,.btn-close-select';
    const update = () => {
      document.querySelectorAll('img').forEach(image => { if (unavailable.has(image.getAttribute('src')?.split('/').pop()?.replace('.png',''))) missingIcon(image); });
      document.querySelectorAll(selectors).forEach(el => {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        if (!el.textContent.trim() && !el.getAttribute('aria-label')) el.setAttribute('aria-label', el.classList.contains('war-lv-item') ? '战场区域 ' + String.fromCharCode(65+Number(el.dataset.index)) : el.classList.contains('choose-all') ? '全选点位' : el.classList.contains('btn-nav-state') ? '筛选标点' : el.classList.contains('btn-check-marker') ? '查看标点' : el.classList.contains('btn-nav-state-top') ? '收起筛选' : el.classList.contains('reset-choose') ? '重置点位筛选' : el.classList.contains('btn-change-map') ? '切换地图与难度' : el.classList.contains('btn-log') ? '查看官方更新记录' : '关闭');
      });
    };
    update();
    new MutationObserver(update).observe(document.querySelector('.content'), {childList:true,subtree:true});
    document.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches(selectors)) {event.preventDefault();event.target.click();}
    });
  });
})();
