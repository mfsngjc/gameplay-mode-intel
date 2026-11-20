const GunCatalog = (() => {
  let data;
  const defaultGame = 'battlefield-6';
  const games = new Map();
  let category = '';
  let entry = '';
  let watchPart = null;
  let focusEntry = null;
  let byId = new Map();
  let categories = new Map();
  let extras = new Map();
  let unmountViewer;

  function setData(catalogues) {
    catalogues.forEach(catalogue => games.set(catalogue.gameId, catalogue));
    $('#gunGames').innerHTML = catalogues.map(catalogue =>
      '<a data-gun-game="' + escapeHtml(catalogue.gameId) + '" href="' +
      (catalogue.gameId === defaultGame ? '#guns' : '#guns?' + new URLSearchParams({ game: catalogue.gameId })) +
      '">' + escapeHtml(catalogue.game) + '</a>').join('');
    selectGame(defaultGame);
  }

  function selectGame(game) {
    const payload = games.get(game) || games.get(defaultGame);
    if (data === payload) return;
    data = payload;
    byId = new Map(data.weapons.map(weapon => [weapon.id, weapon]));
    categories = new Map(data.categories.map(({ id, label }) => [id, label]));
    extras = new Map(data.weapons.map(weapon => [weapon.id, {
      attachments: data.attachments.filter(item => item.category === weapon.category || item.weapons?.includes(weapon.id)),
      packages: data.packages.filter(item => item.weapon === weapon.id)
    }]));
    $('#gunCategory').innerHTML = [['', '全部枪械'], ...categories].map(([id, label]) =>
      '<button type="button" data-gun-category="' + escapeHtml(id) + '" aria-pressed="false">' +
      escapeHtml(label) + '</button>').join('');
    $('#gunListTitle').textContent = data.game;
    const credits = $('#gunAttribution');
    credits.textContent = {
      'battlefield-6': '3D 与图卡素材由 BF6 Tracker 托管。本站与 EA 或其许可方无关联，亦未获其认可。',
      valorant: '3D 素材由 Kingdom Archives 提供，游戏素材归 Riot Games。本站未获 Riot Games 认可或赞助。',
      'cod-mw4': '图卡来自 Call of Duty 官方公告。3D 查看器可读本地 GLB，选中的文件只在浏览器中打开。'
    }[data.gameId];
    $('#gunGames').querySelectorAll('a').forEach(link => {
      if (link.dataset.gunGame === data.gameId) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function hash(id = entry, part = id === entry ? watchPart : null) {
    const query = new URLSearchParams();
    if (data?.gameId && data.gameId !== defaultGame) query.set('game', data.gameId);
    if (category) query.set('category', category);
    if (state.query) query.set('q', state.query);
    if (id) query.set('entry', id);
    if (id && part) query.set('motion', part);
    return '#guns' + (query.size ? '?' + query : '');
  }

  function readRoute(params) {
    selectGame(params.get('game'));
    category = categories.has(params.get('category')) ? params.get('category') : '';
    const next = byId.has(params.get('entry')) ? params.get('entry') : '';
    const weapon = byId.get(next);
    const part = Number(params.get('motion'));
    const nextPart = Number.isInteger(part) && part > 0 && part <= weapon?.motionNotes?.length ? part : null;
    const changedView = entry !== next || Boolean(watchPart) !== Boolean(nextPart);
    focusEntry = changedView ? (next ? '' : entry) : null;
    entry = next;
    watchPart = nextPart;
    setEntryTitle(weapon ? weapon.name + (watchPart ? ' · 展示与动作' : '') : '');
    if ((params.has('entry') && !next) || (params.has('motion') && !nextPart)) {
      history.replaceState(null, '', hash());
      if (params.has('entry') && !next) showToast('没有找到该枪械');
    }
  }

  function focusRoute() {
    if (focusEntry === null) return;
    if (entry) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#gunDetailTitle')?.focus({ preventScroll: true });
    }
    else (document.getElementById('gun-row-' + focusEntry) || $('#gunListTitle')).focus();
    focusEntry = null;
  }

  function sourceLink(id, label) {
    const source = data.sources[id];
    return externalLink(source.url, label || source.label);
  }

  function externalLink(url, label) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + ' ↗</a>';
  }

  function figure(image, label, source) {
    return '<figure class="gun-figure"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' +
      escapeHtml(image) + '" alt="' + escapeHtml(label) + '"><figcaption>' + sourceLink(source, label) + '</figcaption></figure>';
  }

  function renderViewer(weapon) {
    if (data.gameId === 'cod-mw4') {
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      return '<section class="gun-viewer" aria-label="武器模型与动画">' +
        '<div id="gunViewerHost"></div><div class="gun-viewer-tools gun-local-tools">' +
        '<label>选择本地 GLB <input type="file" class="gun-local-file" accept=".glb,model/gltf-binary" disabled></label>' +
        (local ? '<button class="button subtle gun-local-read" type="button" disabled>读取本地模型库</button>' : '') +
        sourceLink(weapon.source, weapon.cardLabel || '武器资料来源') + '</div></section>';
    }
    const key = weapon.tracker?.match(/^https:\/\/battlefield6tracker\.com\/zh\/weapons\/([a-z0-9-]+)\/$/)?.[1];
    const models = weapon.models || [];
    if (!key && !models.length) {
      return '<section class="gun-viewer" aria-label="武器图片"><div class="gun-model-stage">' +
        '<img class="gun-model-poster gun-model-still" src="' + escapeHtml(weapon.cardImage) + '" alt="' +
        escapeHtml(weapon.name) + '"><span class="gun-model-status">图片预览</span></div></section>';
    }
    return '<section class="gun-viewer" id="gunViewer" aria-label="3D 武器预览">' +
      '<div id="gunViewerHost"' + (key ? ' data-weapon-key="' + escapeHtml(key) + '"' : '') + '></div>' +
      '<div class="gun-viewer-tools"><span>' + (key ? '模型与贴图由 BF6 Tracker 托管' : '模型由 Kingdom Archives 提供') +
      '</span>' + externalLink(weapon.tracker || models[0].url, '素材来源') + '</div></section>';
  }

  function mountValorantViewer(host, weapon) {
    const viewport = document.createElement('div');
    viewport.className = 'gun-valorant-viewport';
    viewport.classList.toggle('has-default-only', weapon.models.length === 1);
    const options = document.createElement('select');
    options.className = 'gun-skin-select';
    for (const [index, model] of weapon.models.entries()) {
      options.add(new Option(model.name, String(index)));
    }
    const setSkin = () => {
      const { name, url } = weapon.models[Number(options.value)];
      if (!/^https:\/\/kingdomarchives\.com\/modelviewer\/[a-z0-9-]+$/.test(url)) return;
      viewport.classList.toggle('has-skin-selected', options.selectedIndex > 0);
      const frame = document.createElement('iframe');
      frame.className = 'gun-valorant-frame';
      frame.title = weapon.name + ' 3D 预览 · ' + name;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.referrerPolicy = 'no-referrer';
      frame.src = url;
      viewport.replaceChildren(frame);
    };
    const fields = document.createElement('div');
    fields.className = 'gun-model-controls gun-model-appearance';
    if (options.length > 1) {
      const label = document.createElement('label');
      label.append('3D 皮肤', options);
      fields.append(label);
      options.addEventListener('change', setSkin);
    } else {
      fields.textContent = '默认外观';
    }
    setSkin();
    host.append(viewport, fields);
  }

  async function syncViewer() {
    const host = $('#gunViewerHost');
    if (!host || host.firstChild) return;
    const weapon = byId.get(entry);
    const local = data.gameId === 'cod-mw4';
    if (!local && !host.dataset.weaponKey) {
      mountValorantViewer(host, weapon);
      return;
    }
    host.innerHTML = '<div class="gun-model-stage" role="group" aria-label="' + escapeHtml(weapon.name) + ' 模型预览">' +
      (weapon.cardImage ? '<img src="' + escapeHtml(weapon.cardImage) + '" alt="" class="gun-model-poster">' : '') +
      '<div class="gun-model-status" role="status">' + (local ? '选择 GLB 查看模型与动画' : '正在加载 3D 查看器…') + '</div>' +
      '<div class="gun-model-stage-actions"><button type="button" class="button subtle gun-model-retry" hidden>重试</button>' +
      (local ? '<button type="button" class="button subtle gun-model-view" hidden>自由旋转</button>' : '') +
      '<button type="button" class="button subtle gun-model-recenter" hidden>重置视角</button></div></div>' +
      '<div class="gun-model-controls" hidden><div class="gun-model-appearance">' +
      (local ? '<label hidden>蓝图<select class="gun-blueprint-select"></select></label>' : '') +
      '<label' + (local ? ' hidden' : '') + '>' + (local ? '迷彩与材质' : '皮肤') + '<select class="gun-skin-select"></select></label>' +
      '<button type="button" class="button subtle gun-model-reset">恢复出厂配置</button></div>' +
      '<div class="gun-attachment-fields" role="group" aria-label="配件"></div></div>' +
      (local ? '<section class="gun-model-controls gun-motion" aria-label="武器动画" hidden>' +
        '<label>动画片段<select class="gun-motion-clip"></select></label>' +
        '<div class="gun-motion-actions"><button class="button subtle gun-motion-play" type="button">播放</button>' +
        '<label><input class="gun-motion-loop" type="checkbox">循环</label>' +
        '<label class="gun-motion-sound-field" hidden><input class="gun-motion-sound" type="checkbox" checked>音效</label>' +
        '<label>速度<select class="gun-motion-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label></div>' +
        '<div class="gun-motion-timeline"><input class="gun-motion-seek" type="range" min="0" step="any" aria-label="动画进度">' +
        '<output class="gun-motion-time"></output></div></section><p class="gun-model-footnote gun-note" hidden></p>' : '');
    const stage = host.firstChild;
    host.classList.remove('has-model');
    try {
      if (local) {
        const { mountGunGlbViewer } = await import('./gun-glb-viewer.js?v=20261116-mw4-viewhands');
        if (stage.isConnected) unmountViewer = mountGunGlbViewer(host, weapon.id);
      } else {
        const { mountGunViewer } = await import('./gun-viewer.js?v=20261116-cod');
        if (stage.isConnected) unmountViewer = mountGunViewer(host, host.dataset.weaponKey);
      }
    } catch {
      if (!stage.isConnected) return;
      stage.querySelector('[role="status"]').textContent = '3D 查看器加载失败。';
      const retry = stage.querySelector('.gun-model-retry');
      retry.hidden = false;
      retry.addEventListener('click', () => {
        closeViewer();
        syncViewer();
      }, { once: true });
    }
  }

  function closeViewer() {
    unmountViewer?.();
    unmountViewer = undefined;
    const host = $('#gunViewerHost');
    if (host?.firstChild) host.replaceChildren();
    const motion = $('#gunMotionResult');
    if (motion) clearMotion(motion);
  }

  function motionTime(seconds) {
    return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  }

  function motionRange(item) {
    if (!Number.isInteger(item.start) || item.start < 0) return '';
    return motionTime(item.start) + (Number.isInteger(item.end) && item.end > item.start ? '–' + motionTime(item.end) : ' 起');
  }

  function renderMotionReference(item, weapon) {
    const source = data.sources[item.source];
    const video = item.video || source.video;
    const bvid = source.url.match(/^https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]{10})\/$/)?.[1];
    const hasStart = Number.isInteger(item.start) && item.start >= 0;
    const end = Number.isInteger(item.end) && item.end > item.start ? item.end : null;
    const playbackNote = item.playToEnd ? '播至原片结尾自动停止。' :
      item.embedFromStart ? '从标注时间起播，区间结束后继续播放原片。' : '';
    const note = [item.note, playbackNote].filter(Boolean).join(' ');
    let links = externalLink(source.url, source.label);
    let content = '';
    const kind = bvid ? '社区实录' : video ? '官方演示' : '官方说明';
    if (bvid && hasStart) {
      const url = source.url + '?t=' + item.start;
      links = externalLink(url, source.label);
      if (item.playToEnd || item.embedFromStart) {
        const params = new URLSearchParams({ bvid, t: item.start, autoplay: 0, danmaku: 0 });
        content = '<div class="gun-motion-player"><iframe src="https://player.bilibili.com/player.html?' +
          escapeHtml(params.toString()) + '" title="' + escapeHtml(weapon.name + ' · ' + item.name) +
          '" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>';
      } else {
        content = '<div class="gun-motion-open">' + externalLink(url, '在 B 站从 ' + motionTime(item.start) + ' 播放') + '</div>';
      }
    } else if (video) {
      const fragment = hasStart ? '#t=' + item.start + (end === null ? '' : ',' + end) : '';
      content = '<div class="gun-motion-open">' + externalLink(video + fragment, '观看官方原片') + '</div>';
    }
    const credit = [kind, motionRange(item), source.publishedDate].filter(Boolean).join(' · ');
    return content + (note ? '<p class="gun-note">' + escapeHtml(note) + '</p>' : '') +
      '<p class="gun-motion-credit"><span>' + escapeHtml(credit) + '</span>' + links + '</p>';
  }

  function renderMotionSection(weapon) {
    if (!weapon.motionNotes?.length) return '';
    return '<section class="gun-detail-block gun-motion-section" aria-labelledby="gunMotionHeading">' +
      '<div class="gun-motion-heading"><h3 id="gunMotionHeading">展示与动作</h3>' +
      (watchPart ? '' : '<a id="gunMotionPage" href="' + escapeHtml(hash(weapon.id, 1)) + '">打开播放页</a>') + '</div>' +
      '<label class="sr-only" for="gunMotionSelect">选择动作片段</label><select id="gunMotionSelect">' +
      weapon.motionNotes.map((item, index) => '<option value="' + (index + 1) + '">' +
        escapeHtml('P' + (index + 1) + ' · ' + [item.name, motionRange(item)].filter(Boolean).join(' · ')) + '</option>').join('') +
      '</select><div id="gunMotionResult">' + weapon.motionNotes.map((item, index) =>
        '<section class="gun-motion-result" id="gunMotionPart' + (index + 1) + '" aria-label="' +
        escapeHtml(item.name) + '" hidden></section>').join('') + '</div></section>';
  }

  function clearMotion(result) {
    const active = result.querySelector('.gun-motion-result:not([hidden])');
    if (active) {
      active.hidden = true;
      active.replaceChildren();
    }
    delete result.dataset.part;
  }

  function syncMotion(weapon) {
    const select = $('#gunMotionSelect');
    if (!select) return;
    const result = $('#gunMotionResult');
    const part = watchPart ?? Number(select.value);
    select.value = String(part);
    const pageLink = $('#gunMotionPage');
    if (pageLink) pageLink.href = hash(weapon.id, part);
    if (result.dataset.part === select.value) return;
    clearMotion(result);
    const panel = $('#gunMotionPart' + part);
    panel.innerHTML = renderMotionReference(weapon.motionNotes[part - 1], weapon);
    panel.hidden = false;
    result.dataset.part = select.value;
  }

  function renderDetail(weapon) {
    closeViewer();
    const host = $('#gunDetail');
    const heading = '<div class="gun-detail-heading"><h2 id="gunDetailTitle" tabindex="-1">' + escapeHtml(weapon.name) + '</h2>' +
      '<p>' + escapeHtml([weapon.aliases?.[0], categories.get(weapon.category)].filter(Boolean).join(' · ')) + '</p></div>';
    if (watchPart) {
      host.innerHTML = '<a class="gun-back" href="' + escapeHtml(hash(weapon.id, null)) + '">← 返回枪械详情</a>' +
        heading + renderMotionSection(weapon);
      return;
    }
    const { attachments, packages } = extras.get(weapon.id);
    const details = [
      ['枪械分类', categories.get(weapon.category)],
      ...(weapon.unlock ? [['解锁方式', weapon.unlock]] : []),
      ...(Number.isInteger(weapon.price) ? [['对局价格', weapon.price === 0 ? '免费' : weapon.price + ' 信用点']] : []),
      ...(weapon.releasedAt ? [['上线时间（北京时间）', weapon.releasedAt.slice(0, 16).replace('T', ' ')]] : [])
    ];
    host.innerHTML = '<a class="gun-back" href="' + escapeHtml(hash('')) + '">← 返回枪械列表</a>' + heading +
      renderViewer(weapon) +
      '<dl class="gun-facts gun-detail-facts">' + details.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + escapeHtml(value) + '</dd></div>').join('') + '</dl>' +
      (weapon.note ? '<p class="gun-note">' + escapeHtml(weapon.note) + '</p>' : '') +
      '<div class="gun-links">' + sourceLink(weapon.source) +
        (weapon.unlockSource ? sourceLink(weapon.unlockSource, '解锁资料') : '') +
        (weapon.releaseSource ? sourceLink(weapon.releaseSource, '上线时间依据') : '') +
        '</div>' +
      (weapon.image ? figure(weapon.image.url, weapon.image.label, weapon.image.source || weapon.source) : '') +
      renderMotionSection(weapon) +
      (attachments.length ? '<section class="gun-detail-block"><h3>配件资料 <span>' + attachments.length + '</span></h3><ul class="gun-accessories">' +
        attachments.map(item => '<li><strong>' + escapeHtml(item.name) + '</strong>' +
          (item.note ? '<span>' + escapeHtml(item.note) + '</span>' : '') +
          sourceLink(item.source) + (item.demo ? externalLink(data.sources[item.demo.source].video +
            '#t=' + item.demo.start + ',' + item.demo.end, 'Call of Duty 官方配件演示') : '') + '</li>').join('') + '</ul></section>' : '') +
      (packages.length ? '<section class="gun-detail-block"><h3>外观与武器套装 <span>' + packages.length + '</span></h3>' +
        '<ul class="gun-packages">' + packages.map(item => '<li>' +
        (item.image ? figure(item.image, item.name + ' · ' + (item.imageLabel || '官方外观图'), item.source) : '') +
        '<strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.origin) + '</span>' +
        sourceLink(item.source, '官方出处') + '</li>').join('') + '</ul></section>' : '');
  }

  function render() {
    const weapon = byId.get(entry);
    const host = $('#gunDetail');
    host.hidden = !weapon;
    $('#gunList').hidden = Boolean(weapon);
    if (weapon) {
      const detailKey = data.gameId + ':' + weapon.id + (watchPart ? ':motion' : '');
      if (host.dataset.entry !== detailKey) renderDetail(weapon);
      $('#gunDetail .gun-back').href = watchPart ? hash(weapon.id, null) : hash('');
      host.dataset.entry = detailKey;
      syncMotion(weapon);
      if (!watchPart) syncViewer();
      return;
    }
    $('#gunDetail').dataset.entry = '';
    closeViewer();
    $('#gunDetail').replaceChildren();
    $('#gunCategory').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.gunCategory === category));
    });
    $('#gunReset').hidden = !category && !state.query;
    const normalize = value => value.toLowerCase().replace(/[\s./_-]+/g, '');
    const query = normalize(state.query);
    const shown = data.weapons.filter(weapon => {
      if (category && weapon.category !== category) return false;
      if (!query) return true;
      const { attachments, packages } = extras.get(weapon.id);
      return [weapon.name, categories.get(weapon.category), ...(weapon.aliases || []),
        ...(weapon.models || []).flatMap(model => model.alias ? [model.name, model.alias] : [model.name]),
        ...attachments.map(item => item.name), ...packages.map(item => item.name)]
        .some(value => normalize(value).includes(query));
    });
    $('#gunCount').textContent = '显示 ' + shown.length + ' / ' + count() + ' ' + (data.countUnit || '把');
    $('#gunEmpty').hidden = shown.length > 0;
    $('#gunRows').innerHTML = shown.map((weapon, index) =>
      '<li><a class="gun-card" id="gun-row-' + escapeHtml(weapon.id) + '" href="' + escapeHtml(hash(weapon.id)) + '">' +
      '<div class="gun-card-art">' + (weapon.cardImage ? '<img src="' + escapeHtml(weapon.cardImage) + '" alt="" ' +
        (index >= 16 ? 'loading="lazy" ' : '') + 'decoding="async">' : '<span>暂无预览</span>') + '</div>' +
      '<div class="gun-card-caption"><div><strong>' + escapeHtml(weapon.name) + '</strong><span>' +
      escapeHtml([data.gameId === 'valorant' ? weapon.aliases?.[0] : '', categories.get(weapon.category)].filter(Boolean).join(' · ')) +
      '</span></div>' + icon('arrow-right') + '</div></a></li>').join('');
  }

  function count() { return byId.size; }
  function countLabel() { return count() + ' ' + (data.countUnit || '把'); }
  function totalCount() { return [...games.values()].reduce((total, catalogue) => total + catalogue.weapons.length, 0); }

  function bind() {
    $('#gunCategory').addEventListener('click', event => {
      const button = event.target.closest('[data-gun-category]');
      if (!button || button.dataset.gunCategory === category) return;
      category = button.dataset.gunCategory;
      syncFilterRoute();
      render();
    });
    $('#gunReset').addEventListener('click', () => {
      category = '';
      state.query = '';
      $('#searchInput').value = '';
      syncFilterRoute();
      render();
      $('#gunCategory button').focus();
    });
    $('#gunRows').addEventListener('error', event => {
      if (event.target.tagName !== 'IMG') return;
      const label = document.createElement('span');
      label.textContent = '预览暂不可用';
      event.target.replaceWith(label);
    }, true);
    $('#gunDetail').addEventListener('error', event => {
      if (event.target.tagName === 'IMG') event.target.hidden = true;
    }, true);
    $('#gunDetail').addEventListener('change', event => {
      if (event.target.id !== 'gunMotionSelect') return;
      if (watchPart) {
        watchPart = Number(event.target.value);
        history.replaceState(null, '', hash());
      }
      syncMotion(byId.get(entry));
    });
  }

  return { setData, hash, readRoute, focusRoute, render, countLabel, totalCount, bind, closeViewer, clearEntry() { entry = ''; watchPart = null; } };
})();
