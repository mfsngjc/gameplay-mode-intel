/* Weapon cosmetics are an independent catalogue; they never enter mode statistics. */
function isWeaponSkin(entry) { return entry?.contentKind === 'weapon_skin'; }
const WeaponSkins = (() => {
  'use strict';
  const games = [
    { id: 'valorant', name: '无畏契约', aliases: '瓦洛兰特 valorant', file: 'valorant.json' },
    { id: 'delta-force', name: '三角洲行动', aliases: 'delta force 三角洲', file: 'delta-force.json' },
    { id: 'call-of-duty', name: '使命召唤', aliases: 'call of duty cod 战区 mwii', file: 'call-of-duty.json' },
    { id: 'cod-mobile', name: '使命召唤手游', aliases: 'call of duty mobile codm cod mobile 使命召唤手游', file: 'cod-mobile.json' },
    { id: 'cf-mobile', name: '穿越火线手游', aliases: 'cfm cf mobile 穿越火线 枪战王者', file: 'cf-mobile.json' },
    { id: 'cfhd', name: 'CFHD', aliases: 'cfhd 穿越火线 高清竞技大区', file: 'cfhd.json' },
    { id: 'cs2', name: 'CS2', aliases: '反恐精英 counter strike csgo', file: 'cs2.json' },
    { id: 'apex', name: 'Apex Legends', aliases: 'apex 英雄 传家宝', file: 'apex.json' }
  ];
  const archive = { entries: [], snapshots: new Map(), manifest: null, manifestPromise: null, promise: null, status: 'idle',
    failures: [], game: 'all', type: 'all', edition: 'all', weapon: 'all', rarity: 'all', media: 'all', sort: 'featured', limit: 24, inspectionOpen: false };
  const editionNames = { 'modern-warfare-2': '现代战争 II / MWII', 'modern-warfare-3': '现代战争 III / MWIII',
    'black-ops-6': '黑色行动 6 / BO6', 'black-ops-7': '黑色行动 7 / BO7', 'modern-warfare-4': '现代战争 4 / MW4' };
  const mediaKinds = { preview: '动作预览', showcase: '外观展示', inspect: '检视',
    equip: '切出 / 收起', reload: '换弹', fire: '开火效果', ads: '瞄准展示', finisher: '终结 / 消灭特效' };
  let detailState = null;
  function gameInfo(id) { return games.find(game => game.id === id) || games[0]; }
  function link(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
      const url = new URL(value, document.baseURI);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function esc(value) { return escapeHtml(String(value ?? '')); }
  function cleanText(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/\\n/g, ' ').trim(); }
  function imageUrl(entry) { return link(entry.image?.url || entry.image?.path || entry.image?.assetSourceUrl); }
  function imageCredit(entry) {
    return entry.image?.sourceType === 'official' ? (['video_poster', 'poster'].includes(entry.image?.kind) ? '官方展示封面' :
      entry.image?.kind === 'bundle' ? '官方套装配图' : entry.image?.kind === 'collection' ? '官方系列配图' : '官方素材') :
      entry.image?.sourceType === 'game_asset' ? '游戏资源图 · 社区渠道提供' : '社区配图';
  }
  function containsInspect(media) {
    return media.kind === 'inspect' || (media.contains || media.containsActions || []).includes('inspect');
  }
  function isVideo(media) { return ['mp4', 'youtube', 'bilibili'].includes(media.provider); }
  function chromaCount(entry) { return (entry.chromas || []).filter(chroma => !chroma.isBase).length; }
  function chromaImage(entry, chroma) {
    if (chroma?.image) return chroma.image;
    const url = link(chroma?.imageUrl || chroma?.fullRender);
    return url ? { ...entry.image, url, assetSourceUrl: url } : entry.image;
  }
  function providerId(media) {
    try {
      const url = new URL(media.url);
      if (media.provider === 'youtube' && /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) {
        const id = media.videoId || (url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v'));
        return /^[\w-]{11}$/.test(id || '') ? id : '';
      }
      if (media.provider === 'bilibili' && /(^|\.)bilibili\.com$/.test(url.hostname)) {
        const id = media.videoId || url.pathname.match(/BV[0-9A-Za-z]{10}/)?.[0];
        return /^BV[0-9A-Za-z]{10}$/.test(id || '') ? id : '';
      }
    } catch { /* Invalid media remains excluded. */ }
    return '';
  }
  function mediaList(entry) {
    const seen = new Set();
    return (entry.media || []).filter(media => {
      const url = link(media.url);
      if (!url || seen.has(url)) return false;
      if (media.provider === 'mp4') {
        if (!/\.mp4(?:[?#]|$)/i.test(url)) return false;
      } else if (media.provider === 'gif') {
        if (!/\.gif(?:[?#]|$)/i.test(url) && !(media.mimeType === 'image/gif' && Number(media.frameCount) > 1)) return false;
      } else if (!providerId(media)) return false;
      seen.add(url);
      return true;
    });
  }
  function normalise(raw, game) {
    const info = gameInfo(game);
    const entry = { ...raw, skinGame: game, game: info.name, kind: 'skins', contentKind: 'weapon_skin',
      modeName: raw.name, imageUrl: imageUrl(raw), imageSource: imageCredit(raw),
      type: [raw.weaponType === 'melee' ? '近战武器' : '枪械', raw.category, raw.rarity?.name].filter(Boolean),
      sourceModeIds: [], tags: raw.tags || [], oneLineRule: cleanText(raw.description) || '查看外观、变体及对应动作资料。',
      mechanicChange: '', tempoImpact: '', designObservation: '',
      launchDate: raw.releaseDateStatus === 'confirmed' ? raw.releaseDate : null,
      date: raw.firstSeenAt || '', createdAt: raw.firstSeenAt || '' };
    entry._search = [raw.name, raw.englishName, info.name, info.aliases, raw.weaponName,
      raw.weaponEnglishName, raw.category, raw.rarity?.name, raw.family, raw.gameTitle, raw.region,
      ...(raw.tags || []), ...(raw.searchAliases || []), ...(raw.chromas || []).map(chroma => chroma.name),
      raw.weaponType === 'melee' ? '刀 刀皮 近战 melee knife' : '枪 枪皮 gun'
    ].join(' ').toLocaleLowerCase();
    return entry;
  }
  function matchesQuery(entry, query = state.query) {
    return String(query || '').toLocaleLowerCase().trim().split(/\s+/).every(word => entry._search.includes(word));
  }
  function filterEntries(entries = archive.entries, filters = archive, query = state.query) {
    return entries.filter(entry => matchesQuery(entry, query) &&
      (filters.game === 'all' || entry.skinGame === filters.game) &&
      (!filters.edition || filters.edition === 'all' || entry.gameEdition === filters.edition) &&
      (filters.type === 'all' || entry.weaponType === filters.type) &&
      (filters.weapon === 'all' || entry.weaponId === filters.weapon) &&
      (filters.rarity === 'all' || (entry.rarity?.id || entry.rarity?.name) === filters.rarity) &&
      (filters.media === 'all' || (filters.media === 'video' ? mediaList(entry).some(isVideo) :
        filters.media === 'inspect' ? mediaList(entry).some(containsInspect) : mediaList(entry).length === 0)));
  }
  function filtered() {
    const entries = filterEntries();
    if (archive.sort === 'name') return entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    if (archive.sort === 'weapon') return entries.sort((a, b) => a.weaponName.localeCompare(b.weaponName, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'));
    if (archive.sort === 'collected') return entries.sort((a, b) => Number(state.collected.has(b.id)) - Number(state.collected.has(a.id)) || a.name.localeCompare(b.name, 'zh-CN'));
    const score = entry => (entry.featured ? 50 : 0) + (mediaList(entry).some(containsInspect) ? 20 : 0) +
      (mediaList(entry).length ? 5 : 0) + (entry.skinGame === 'valorant' ? 3 : 0);
    return entries.sort((a, b) => score(b) - score(a) || games.findIndex(game => game.id === a.skinGame) -
      games.findIndex(game => game.id === b.skinGame) || a.name.localeCompare(b.name, 'zh-CN'));
  }
  function hash(id) {
    const params = new URLSearchParams();
    for (const key of ['game', 'type', 'edition', 'weapon', 'rarity', 'media']) if (archive[key] !== 'all') params.set(key, archive[key]);
    if (archive.sort !== 'featured') params.set('sort', archive.sort);
    if (state.query) params.set('q', state.query);
    if (id) params.set('entry', id);
    return '#skins' + (params.size ? '?' + params.toString() : '');
  }
  function reset() {
    Object.assign(archive, { game: 'all', type: 'all', edition: 'all', weapon: 'all', rarity: 'all', media: 'all', sort: 'featured', limit: 24 });
  }
  function readRoute(params) {
    archive.game = games.some(game => game.id === params.get('game')) ? params.get('game') : 'all';
    archive.type = ['gun', 'melee'].includes(params.get('type')) ? params.get('type') : 'all';
    archive.edition = archive.game === 'call-of-duty' && editionNames[params.get('edition')] ? params.get('edition') : 'all';
    archive.weapon = params.get('weapon') || 'all';
    archive.rarity = params.get('rarity') || 'all';
    archive.media = ['video', 'inspect', 'image'].includes(params.get('media')) ? params.get('media') : 'all';
    archive.sort = ['name', 'weapon', 'collected'].includes(params.get('sort')) ? params.get('sort') : 'featured';
    archive.limit = 24;
  }
  function syncEntries() {
    archive.entries = games.flatMap(game => (archive.snapshots.get(game.id)?.skins || [])
      .filter(raw => raw.publicationStatus === 'ready' && raw.id && raw.name && imageUrl(raw))
      .map(raw => normalise(raw, game.id)));
    state.entries = [...state.entries.filter(entry => !isWeaponSkin(entry)), ...archive.entries];
  }
  async function ensure(retry = false) {
    if (archive.promise && !retry) return archive.promise;
    archive.manifestPromise ||= loadManifest();
    archive.status = 'loading';
    archive.promise = (async () => {
      if (archive.manifestPromise) await archive.manifestPromise;
      const results = await Promise.allSettled(games.map(async game => {
        const base = 'data/weapon-skins/' + game.file;
        const configured = archive.manifest?.games.find(item => item.id === game.id)?.url;
        const url = [base, base + '.gz'].includes(configured) ? configured : base;
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(game.name);
        let data;
        if (url.endsWith('.gz')) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          data = bytes[0] === 0x1f && bytes[1] === 0x8b
            ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json()
            : JSON.parse(new TextDecoder().decode(bytes));
        } else data = await response.json();
        if (data.schemaVersion !== 1 || data.game !== game.id || !Array.isArray(data.skins)) throw new Error(game.name);
        archive.snapshots.set(game.id, data);
      }));
      archive.failures = results.flatMap((result, index) => result.status === 'rejected' ? [games[index].name] : []);
      syncEntries();
      archive.status = archive.failures.length ? 'partial' : 'ready';
      if (state.ready) {
        renderWorkspace();
        const id = new URLSearchParams(location.hash.split('?')[1]).get('entry');
        if (id && archive.entries.some(entry => entry.id === id) && ['skins', 'collection'].includes(state.view)) showDetail(id);
      }
    })().catch(() => { archive.status = 'partial'; archive.promise = null; if (state.ready) renderWorkspace(); });
    return archive.promise;
  }
  async function loadManifest() {
    try {
      const response = await fetch('data/weapon-skins/manifest.json', { cache: 'no-cache' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.schemaVersion === 1 && Array.isArray(data.games)) archive.manifest = data;
      if (state.ready) updateCounts();
    } catch { /* The catalogue itself can still load independently. */ }
  }
  function count() { return archive.entries.length || Number(archive.manifest?.total || 0); }
  function selectOptions(id, options, selected) {
    const select = document.getElementById(id);
    select.innerHTML = options.map(([value, label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>').join('');
    select.value = selected;
  }
  function render() {
    const grid = document.getElementById('skinGrid');
    if (!grid) return;
    if (archive.status === 'idle') ensure();
    const loading = archive.status === 'loading' && !archive.entries.length;
    const scoped = archive.entries.filter(entry => archive.game === 'all' || entry.skinGame === archive.game);
    document.getElementById('skinGameFilters').innerHTML = [{ id: 'all', name: '全部游戏' }, ...games].map(game =>
      '<button type="button" data-skin-game="' + game.id + '" aria-pressed="' + (archive.game === game.id) + '">' +
      esc(game.name) + '<span>' + archive.entries.filter(entry => game.id === 'all' || entry.skinGame === game.id).length + '</span></button>').join('');
    const editionScoped = scoped.filter(entry => archive.edition === 'all' || entry.gameEdition === archive.edition);
    const weaponScope = editionScoped.filter(entry => archive.type === 'all' || entry.weaponType === archive.type);
    const weapons = [...new Map(weaponScope.map(entry => [entry.weaponId, entry.weaponName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
    const rarities = [...new Map(scoped.filter(entry => entry.rarity?.name).map(entry => [entry.rarity.id || entry.rarity.name, entry.rarity.name])).entries()];
    selectOptions('skinTypeSelect', [['all', '枪械与近战'], ['gun', '枪械皮肤'], ['melee', '刀与近战']], archive.type);
    document.getElementById('skinEditionField').hidden = archive.game !== 'call-of-duty';
    selectOptions('skinEditionSelect', [['all', '全部作品'], ...Object.entries(editionNames)], archive.edition);
    selectOptions('skinWeaponSelect', [['all', '全部武器'], ...weapons], archive.weapon);
    selectOptions('skinRaritySelect', [['all', '全部品质'], ...rarities], archive.rarity);
    document.getElementById('skinMediaSelect').value = archive.media;
    document.getElementById('skinSortSelect').value = archive.sort;
    const entries = filtered(), visible = entries.slice(0, archive.limit);
    const hasCreatorResults = (archive.game === 'call-of-duty' || archive.game === 'all') && archive.media !== 'image' &&
      inspectionEntries(archive.snapshots.get('call-of-duty')?.inspectionLibrary).length > 0;
    grid.innerHTML = loading ? '<div class="loading-state">正在读取武器外观与动作资料…</div>' : visible.length ? visible.map(card).join('') :
      '<div class="empty-state">' + icon('search') + '<h3>没有找到匹配的武器外观</h3><p>' +
      (hasCreatorResults ? '上方的检视视频资料中可查看对应原作者投稿。' : '可搜索皮肤、英文名、枪型或刀，例如“RGX”“狂徒”“蝴蝶”。') +
      '</p><button type="button" class="button" data-skin-reset>清除筛选</button></div>';
    grid.setAttribute('aria-busy', String(loading));
    const videos = entries.filter(entry => mediaList(entry).some(isVideo)).length;
    const animations = entries.filter(entry => mediaList(entry).some(media => media.provider === 'gif')).length;
    const inspections = entries.filter(entry => mediaList(entry).some(containsInspect)).length;
    document.getElementById('skinResultCount').textContent = loading ? '加载中' : entries.length.toLocaleString('zh-CN') + ' 款 · ' + videos + ' 款含视频' +
      (animations ? ' · ' + animations + ' 款含动图' : '') + ' · ' + inspections + ' 款含检视资料';
    document.getElementById('skinShownCount').textContent = '已展示 ' + visible.length + ' / ' + entries.length + ' 款';
    document.getElementById('loadMoreSkins').hidden = visible.length >= entries.length;
    document.getElementById('skinStats').innerHTML = [[scoped.length, '皮肤目录'], [scoped.filter(entry => entry.weaponType === 'melee').length, '刀与近战'],
      [scoped.filter(entry => mediaList(entry).length).length, '含动作资料']].map(([number, label]) => '<div><dd>' + number.toLocaleString('zh-CN') + '</dd><dt>' + label + '</dt></div>').join('');
    const note = document.getElementById('skinLoadStatus');
    note.hidden = !archive.failures.length;
    note.innerHTML = archive.failures.length ? esc(archive.failures.join('、') + '资料暂时无法读取，已保留其余目录。') + ' <button type="button" data-skin-retry>重新加载</button>' : '';
    const chosen = archive.game === 'all' ? null : archive.snapshots.get(archive.game);
    const coverageNote = chosen?.coverage?.scope || chosen?.coverage?.note ||
      '各游戏按已核对的公开目录收录，选择游戏可查看覆盖范围。动作视频与静态图分别统计；历史收录不代表当前在售。';
    const pendingImages = Number(chosen?.coverage?.pendingImageCount || 0);
    document.getElementById('skinScopeNote').textContent = coverageNote + (pendingImages > 0 ?
      ' 已对账 ' + Number(chosen.coverage.cataloguedCount).toLocaleString('zh-CN') + ' 款，其中 ' + scoped.length.toLocaleString('zh-CN') +
      ' 款有图可浏览，' + pendingImages.toLocaleString('zh-CN') + ' 款缺图待补。' : '');
    renderInspectionLibrary();
    document.getElementById('skinFilterSummary').textContent = [state.query ? '搜索：' + state.query : '',
      archive.game !== 'all' ? gameInfo(archive.game).name : '',
      archive.edition !== 'all' ? editionNames[archive.edition] : '',
      archive.type === 'melee' ? '刀与近战' : archive.type === 'gun' ? '枪械皮肤' : '',
      archive.media === 'inspect' ? '含检视资料' : archive.media === 'video' ? '含视频' : archive.media === 'image' ? '外观图目录' : ''
    ].filter(Boolean).join(' · ');
  }
  function inspectionEntries(items, filters = archive, query = state.query) {
    const words = String(query || '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return (items || []).filter(item => item.provider === 'bilibili' && providerId(item) && item.kind === 'inspect' &&
      ['source_confirmed', 'sample_reviewed'].includes(item.reviewStatus) &&
      item.publicationStatus === 'ready' && words.every(word => [item.title, item.name, item.gameTitle, item.sourceName,
        ...(item.searchAliases || [])].join(' ').toLocaleLowerCase().includes(word)) &&
      (!filters.edition || filters.edition === 'all' || item.gameEdition === filters.edition) &&
      (filters.type === 'all' || item.weaponType === filters.type) &&
      (filters.weapon === 'all' || item.weaponId === filters.weapon) &&
      (filters.rarity === 'all' || archive.entries.some(skin => (item.associatedSkinIds || []).includes(skin.id) &&
        (skin.rarity?.id || skin.rarity?.name) === filters.rarity)));
  }
  function inspectionCard(item) {
    const original = link(item.url), thumbnail = link(item.thumbnailUrl);
    const associated = (item.associatedSkinIds || []).map(id => archive.entries.find(skin => skin.id === id)).filter(Boolean);
    return '<article class="weapon-inspection-card">' + (thumbnail ? '<a href="' + esc(original) +
      '" target="_blank" rel="noopener noreferrer"><img src="' + esc(thumbnail) + '" alt="' + esc(item.title) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="320" height="180"></a>' : '') +
      '<div><h3><a href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">' + esc(item.title) +
      '</a></h3><p>' + esc(item.gameTitle || '') + ' · ' + esc(item.sourceName || '原作者投稿') + '</p>' +
      '<a href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">在 B 站观看 ↗</a>' +
      associated.map(skin => ' <button type="button" class="button subtle" data-action="open-skin" data-id="' + esc(skin.id) +
        '">对应蓝图</button>').join('') + '</div></article>';
  }
  function renderInspectionLibrary() {
    const target = document.getElementById('skinInspectionLibrary');
    if (!target) return;
    const items = inspectionEntries(archive.snapshots.get('call-of-duty')?.inspectionLibrary);
    target.hidden = archive.media === 'image' || !items.length || !(archive.game === 'call-of-duty' ||
      (archive.game === 'all' && String(state.query || '').trim()));
    if (target.hidden) { target.innerHTML = ''; return; }
    target.innerHTML = '<details id="skinInspectionDetails" class="weapon-inspection-library"' +
      (archive.inspectionOpen || String(state.query || '').trim() ? ' open' : '') +
      '><summary><strong>端游特殊检视视频</strong><span>' + items.length + ' 条 · B 站原作者投稿</span></summary>' +
      '<p>按原作者的蓝图名称和所属作品查找。已核对对应关系的视频也可从蓝图详情观看；其余保留原片，视频数量不计为新增皮肤。</p>' +
      '<div class="weapon-inspection-grid">' + items.map(inspectionCard).join('') + '</div></details>';
  }
  function card(entry) {
    const videos = mediaList(entry), inspection = videos.some(containsInspect), collected = state.collected.has(entry.id);
    const color = /^#[0-9a-f]{6}$/i.test(entry.rarity?.color || '') ? entry.rarity.color : '#8fa58c';
    return '<article class="weapon-card" data-id="' + esc(entry.id) + '" style="--skin-rarity:' + color + '">' +
      '<button class="weapon-card-art" type="button" data-action="open-skin" data-id="' + esc(entry.id) + '" aria-label="查看 ' + esc(entry.name) + '">' +
      '<img src="' + esc(imageUrl(entry)) + '" alt="' + esc(entry.name + ' · ' + imageCredit(entry)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="640" height="320">' +
      '<span class="weapon-art-fallback" hidden>图片暂时无法读取 · 可打开详情查看来源</span>' +
      '<span class="weapon-art-kind">' + (entry.weaponType === 'melee' ? '近战' : esc(entry.weaponName)) + '</span></button>' +
      '<div class="weapon-card-body"><p class="weapon-card-eyebrow">' + esc(entry.game) + '<span>' + esc(entry.rarity?.name || entry.category) + '</span></p>' +
      '<h3><button type="button" data-action="open-skin" data-id="' + esc(entry.id) + '">' + esc(entry.name) + '</button></h3>' +
      '<p class="weapon-card-english" lang="en">' + esc(entry.englishName && entry.englishName !== entry.name ? entry.englishName : entry.weaponEnglishName || entry.weaponName) + '</p>' +
      '<div class="weapon-card-tags"><span>' + esc(entry.category || (entry.weaponType === 'melee' ? '近战武器' : '枪械')) + '</span>' +
      (entry.skinGame === 'call-of-duty' && editionNames[entry.gameEdition] ? '<span>' + esc(editionNames[entry.gameEdition]) + '</span>' : '') +
      (videos.length ? '<span class="has-media">' + (inspection ? '含检视资料' : '动作预览') + '</span>' : '<span>外观图</span>') +
      ((entry.chromas || []).length > 1 && chromaCount(entry) ? '<span>' + chromaCount(entry) + ' 款炫彩</span>' : '') + '</div>' +
      '<div class="weapon-card-bottom"><span>' + esc(imageCredit(entry)) + '</span><div><button type="button" class="icon-button ' +
      (collected ? 'is-collected' : '') + '" data-action="collect" data-id="' + esc(entry.id) + '" aria-pressed="' + collected + '" aria-label="' +
      (collected ? '取消收藏 ' : '收藏 ') + esc(entry.name) + '">' + icon('bookmark') + '</button>' +
      '<button type="button" class="weapon-card-open" data-action="open-skin" data-id="' + esc(entry.id) + '">查看' + icon('arrow-up-right') + '</button></div></div></div></article>';
  }
  function mediaLabel(media) { return (mediaKinds[media.kind] || '外观展示') + (containsInspect(media) && media.kind !== 'inspect' ? ' · 含检视' : '') +
    (media.provider === 'gif' ? ' · GIF 动图' : ''); }
  function playerHtml(entry, media, activated = false) {
    if (!media) return '<div class="weapon-media-empty"><p>已收录外观图，动作视频待补。</p></div>';
    if (media.provider === 'gif') return '<figure class="weapon-animation"><img id="skinAnimation" src="' + esc(link(media.url)) +
      '" alt="' + esc(media.title || entry.name + '检视动图') + '" referrerpolicy="no-referrer"><figcaption>GIF 动图 · 由原始图片循环展示</figcaption></figure>' +
      '<p class="weapon-animation-error" hidden>动图暂时无法读取，可通过下方原片链接打开。</p>';
    if (media.provider === 'mp4') return '<video id="skinVideo" controls playsinline preload="none" poster="' + esc(imageUrl(entry)) +
      '" src="' + esc(link(media.url)) + '" aria-label="' + esc(media.title || entry.name + '动作预览') + '"></video>' +
      '<div class="weapon-video-tools"><button type="button" data-skin-speed="0.5">0.5×</button><button type="button" data-skin-speed="1" aria-pressed="true">1×</button>' +
      '<button type="button" data-skin-replay>重播</button><button type="button" data-skin-loop aria-pressed="false">循环</button></div>' +
      '<p class="weapon-video-error" hidden>视频暂时无法播放，可通过下方原片链接打开。</p>';
    if (!activated) return '<div class="weapon-embed-cover"><img src="' + esc(link(media.thumbnailUrl) || imageUrl(entry)) + '" alt="' +
      esc(media.title || entry.name + '视频封面') + '" loading="lazy" referrerpolicy="no-referrer"><button type="button" class="button primary" data-skin-activate>在此播放 ' +
      (media.provider === 'bilibili' ? '哔哩哔哩' : 'YouTube') + ' 视频</button></div>';
    const id = providerId(media);
    const url = media.provider === 'bilibili' ? 'https://player.bilibili.com/player.html?isOutside=true&bvid=' + id + '&p=1&autoplay=0&danmaku=0' :
      'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=0&rel=0';
    return '<iframe src="' + esc(url) + '" title="' + esc(media.title || entry.name + '外观展示') +
      '" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
      '<p class="weapon-embed-note">由原站播放器提供，清晰度与播放设置以原站支持为准。</p>';
  }
  function mediaCaption(media) {
    if (!media) return '';
    return '<strong>' + esc(media.title || mediaLabel(media)) + '</strong><p>' +
      esc((media.sourceType === 'official' ? '官方素材' : media.provider === 'gif' ? '社区动图' : '社区录像') + ' · ' + (media.sourceName || '') + ' · ' + mediaLabel(media)) +
      '</p><p>' + esc(media.note || media.reviewNote || (media.reviewStatus === 'metadata_only' ? '按来源提供的动作预览收录，具体动作以视频内容为准。' : '')) + '</p>' +
      '<a href="' + esc(link(media.url)) + '" target="_blank" rel="noopener noreferrer">打开原片 ↗</a>' +
      (link(media.sourcePageUrl) && media.sourcePageUrl !== media.url ? ' · <a href="' + esc(link(media.sourcePageUrl)) +
        '" target="_blank" rel="noopener noreferrer">资料出处 ↗</a>' : '');
  }
  function detail(entry) {
    const media = mediaList(entry), chromas = (entry.chromas || []).filter(chroma => link(chroma.imageUrl || chroma.fullRender));
    const firstMedia = Math.max(0, media.findIndex(item => containsInspect(item)));
    const firstChroma = Math.max(0, chromas.findIndex(chroma => chroma.id === media[firstMedia]?.chromaId));
    const picture = chromaImage(entry, chromas[firstChroma]);
    const initialImage = link(chromas[firstChroma]?.imageUrl || chromas[firstChroma]?.fullRender) || imageUrl(entry);
    detailState = { id: entry.id, media: firstMedia, chroma: firstChroma };
    const release = entry.releaseDateStatus === 'confirmed' && entry.releaseDate ? '首发：' + entry.releaseDate :
      entry.releaseDateStatus === 'scheduled' && entry.releaseDate ? '预告日期：' + entry.releaseDate : '首发日期待核实';
    const fact = (label, value) => value ? '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>' : '';
    const source = link(entry.sourceUrl), pictureSource = link(picture?.sourcePageUrl), original = link(picture?.assetSourceUrl) || initialImage;
    return '<div class="weapon-detail-art"><a id="skinOriginalImage" href="' + esc(initialImage) + '" target="_blank" rel="noopener noreferrer"><img id="skinDetailImage" src="' +
      esc(initialImage) + '" alt="' + esc(entry.name) +
      '" referrerpolicy="no-referrer"><span class="weapon-art-fallback" hidden>图片暂时无法读取</span></a><span id="skinImageCredit">' +
      esc(imageCredit({ image: picture })) + (picture?.caption ? ' · ' + esc(picture.caption) : '') + '</span></div>' +
      '<div class="detail-inner weapon-detail"><div class="detail-kicker">武器外观 / ' + esc(entry.game) + '</div><h2 id="detailTitle">' + esc(entry.name) +
      '</h2><p class="weapon-detail-english" lang="en">' + esc(entry.englishName || entry.weaponEnglishName || '') + '</p>' +
      '<div class="detail-meta"><span>' + esc(entry.weaponName) + '</span><span>' + esc(entry.rarity?.name || entry.category) +
      '</span><span>' + esc(entry.region || '适用地区待核实') + '</span></div>' +
      (entry.description ? '<p class="detail-summary">' + esc(cleanText(entry.description)) + '</p>' : '') +
      (entry.mediaAssociationNote ? '<p class="weapon-source-note">' + esc(entry.mediaAssociationNote) + '</p>' : '') +
      (chromas.length > 1 ? '<section class="weapon-chromas"><h3>外观与炫彩</h3><div class="weapon-chroma-list">' + chromas.map((chroma, index) =>
        '<button type="button" data-skin-chroma="' + index + '" aria-pressed="' + (index === firstChroma) + '" title="' + esc(chroma.name) + '">' +
        '<img src="' + esc(link(chroma.swatchUrl) || link(chroma.imageUrl || chroma.fullRender)) + '" alt="" loading="lazy"><span>' +
        esc(cleanText(chroma.name || '默认外观')) + '</span></button>').join('') + '</div></section>' : '') +
      '<section class="detail-section weapon-media-section"><h3>展示与动作</h3>' +
      (media.length ? '<label class="sr-only" for="skinVideoSelect">选择等级、炫彩或动作资料</label><select id="skinVideoSelect">' + media.map((item, index) =>
        '<option value="' + index + '"' + (index === firstMedia ? ' selected' : '') + '>' + esc(item.title || mediaLabel(item) + ' ' + (index + 1)) + '</option>').join('') + '</select>' : '') +
      '<div id="skinPlayer" class="weapon-player">' + playerHtml(entry, media[firstMedia]) + '</div>' +
      '<div id="skinMediaCaption" class="weapon-media-caption">' + mediaCaption(media[firstMedia]) + '</div></section>' +
      ((entry.levels || []).length > 1 ? '<section class="detail-section"><h3>皮肤等级</h3><div class="weapon-level-list">' +
        entry.levels.map((level, index) => '<span>' + esc(cleanText(level.name || '等级 ' + (index + 1))) + '</span>').join('') + '</div></section>' : '') +
      '<section class="detail-section"><h3>资料与出处</h3><dl class="weapon-facts">' + fact('武器分类', entry.category) +
      fact('收录日期', String(entry.firstSeenAt || '').slice(0, 10)) + fact('上线信息', release) +
      fact('原稿发布日期', entry.publishedDate) +
      fact('版本 / 系列', entry.gameTitle || entry.family || '') +
      fact('磨损范围', entry.floatRange && (Array.isArray(entry.floatRange) || (entry.floatRange.min != null && entry.floatRange.max != null)) ? (Array.isArray(entry.floatRange) ? entry.floatRange.join(' → ') : entry.floatRange.min + ' → ' + entry.floatRange.max) : '') +
      fact('图案编号', entry.paintIndex) + '</dl>' +
      (entry.timingNote ? '<p class="weapon-source-note">' + esc(entry.timingNote) + '</p>' : '') +
      '<p class="weapon-source-note">历史外观目录不代表当前在售；收录日期与首发日期分别记录。</p><div class="weapon-source-links">' +
      (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">' + esc(entry.sourceName || '目录来源') + ' ↗</a>' : '') +
      (pictureSource ? '<a id="skinImageSource" href="' + esc(pictureSource) + '" target="_blank" rel="noopener noreferrer">图片出处 ↗</a>' : '') +
      '<a id="skinAssetOriginal" href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">素材原址 ↗</a></div>' +
      '<p id="skinImageProvider" class="weapon-source-note">' + esc(imageCredit({ image: picture })) + (picture?.provider ? ' · ' + esc(picture.provider) : '') + '</p></section>' +
      '<div class="detail-actions">' + detailButton(entry) + '<button type="button" class="button" data-action="copy" data-id="' + esc(entry.id) +
      '">' + icon('book-open') + '复制 Markdown</button><button type="button" class="button" data-skin-copy-link>复制详情链接</button></div></div>';
  }
  function stop(root = document) {
    root.querySelectorAll('#skinPlayer video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    root.querySelectorAll('#skinPlayer iframe').forEach(frame => frame.remove());
    root.querySelectorAll('#skinAnimation').forEach(picture => picture.removeAttribute('src'));
  }
  function showPlayer(index, activated = false) {
    const entry = archive.entries.find(item => item.id === detailState?.id);
    const media = entry && mediaList(entry)[index];
    if (!entry || !media) return;
    if (media.chromaId) {
      const chromas = (entry.chromas || []).filter(chroma => link(chroma.imageUrl || chroma.fullRender));
      const chromaIndex = chromas.findIndex(chroma => chroma.id === media.chromaId);
      if (chromaIndex >= 0) selectChroma(entry, chromaIndex);
    }
    stop(detailDialog);
    detailState.media = index;
    document.getElementById('skinPlayer').innerHTML = playerHtml(entry, media, activated);
    document.getElementById('skinMediaCaption').innerHTML = mediaCaption(media);
    const select = document.getElementById('skinVideoSelect');
    if (select) select.value = index;
  }
  function selectChroma(entry, index) {
    const chromas = (entry.chromas || []).filter(chroma => link(chroma.imageUrl || chroma.fullRender));
    const chroma = chromas[index];
    if (!chroma) return false;
    detailState.chroma = index;
    const url = link(chroma.imageUrl || chroma.fullRender), metadata = chromaImage(entry, chroma);
    const picture = document.getElementById('skinDetailImage');
    picture.hidden = false; picture.src = url; picture.alt = chroma.name || entry.name;
    document.getElementById('skinOriginalImage').href = url;
    document.getElementById('skinImageCredit').textContent = imageCredit({ image: metadata }) + (metadata?.caption ? ' · ' + metadata.caption : '');
    document.getElementById('skinImageProvider').textContent = imageCredit({ image: metadata }) + (metadata?.provider ? ' · ' + metadata.provider : '');
    document.getElementById('skinAssetOriginal').href = link(metadata?.assetSourceUrl) || url;
    const source = document.getElementById('skinImageSource');
    if (source) source.href = link(metadata?.sourcePageUrl) || link(entry.sourceUrl);
    document.querySelectorAll('[data-skin-chroma]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.skinChroma) === index)));
    return true;
  }
  function markdown(entry) {
    const picture = entry.image?.derivedFromVideoUrl ? imageUrl(entry) : (link(entry.image?.assetSourceUrl) || imageUrl(entry));
    return ['# ' + entry.name, '', '- 资料类型：武器外观', '- 游戏：' + entry.game,
      '- 英文名：' + (entry.englishName || ''), '- 基础武器：' + entry.weaponName,
      '- 分类：' + entry.category, '- 品质：' + (entry.rarity?.name || '未标注'),
      '- 地区 / 版本：' + (entry.region || '待核实') + (entry.gameTitle ? ' / ' + entry.gameTitle : ''),
      '- 上线信息：' + (entry.releaseDateStatus === 'confirmed' ? entry.releaseDate : '待核实；收录日期不作为首发日期'),
      '- 收录日期：' + (entry.firstSeenAt || ''), '- 来源：' + (entry.sourceUrl || ''),
      ...(entry.publishedDate ? ['- 原稿发布日期：' + entry.publishedDate] : []),
      '', '## 外观图', '', '![' + entry.name.replace(/[\[\]]/g, '') + '](' + picture + ')',
      '', imageCredit(entry), '', '- 图片出处：' + (entry.image?.sourcePageUrl || entry.sourceUrl || ''),
      '- 素材原址：' + (entry.image?.assetSourceUrl || imageUrl(entry)),
      '', '## 介绍', '', cleanText(entry.description),
      '', '## 展示与动作', '', ...mediaList(entry).flatMap(media => ['- [' + (media.title || mediaLabel(media)).replace(/[\[\]]/g, '') + '](' + media.url + ')',
        '  - ' + mediaLabel(media) + ' · ' + (media.sourceType === 'official' ? '官方素材' : media.provider === 'gif' ? '社区动图' : '社区录像') + ' · ' + (media.sourceName || ''),
        '  - 原片出处：' + (media.sourcePageUrl || media.url)]),
      '', '历史外观目录不代表当前在售；动作预览可能包含多种动作。', ''
    ].join('\n');
  }
  function exportList() {
    const entries = filtered();
    if (!entries.length) { showToast('当前筛选没有可导出的武器外观'); return; }
    downloadFile('weapon-skins.md', '# 武器外观资料\n\n' + entries.length + ' 款；资料来自各游戏的独立目录。\n\n' + entries.map(markdown).join('\n---\n\n'));
    showToast('已导出 ' + entries.length + ' 款武器外观');
  }
  function bind() {
    document.getElementById('skinsSection').addEventListener('toggle', event => {
      if (event.target.id === 'skinInspectionDetails') archive.inspectionOpen = event.target.open;
    }, true);
    document.getElementById('skinsSection').addEventListener('click', event => {
      const target = event.target.closest('[data-skin-game], [data-skin-reset], [data-skin-retry]');
      if (!target) return;
      if (target.hasAttribute('data-skin-retry')) { ensure(true); render(); return; }
      if (target.hasAttribute('data-skin-reset')) { reset(); state.query = ''; document.getElementById('searchInput').value = ''; }
      if (target.dataset.skinGame) { archive.game = target.dataset.skinGame; archive.edition = archive.weapon = archive.rarity = 'all'; }
      archive.limit = 24; syncFilterRoute(); render();
    });
    for (const [id, key] of [['skinTypeSelect', 'type'], ['skinEditionSelect', 'edition'], ['skinWeaponSelect', 'weapon'], ['skinRaritySelect', 'rarity'], ['skinMediaSelect', 'media'], ['skinSortSelect', 'sort']]) {
      document.getElementById(id).addEventListener('change', event => {
        archive[key] = event.target.value;
        if (key === 'type' || key === 'edition') archive.weapon = 'all';
        archive.limit = 24; syncFilterRoute(); render();
      });
    }
    document.getElementById('loadMoreSkins').addEventListener('click', () => {
      const previous = archive.limit; archive.limit += 24; render();
      document.querySelectorAll('#skinGrid h3 button')[previous]?.focus({ preventScroll: true });
    });
    for (const id of ['downloadSkinsList', 'exportSkinsMarkdown']) document.getElementById(id).addEventListener('click', exportList);
    document.getElementById('detailContent').addEventListener('change', event => {
      if (event.target.id === 'skinVideoSelect') showPlayer(Number(event.target.value));
    });
    document.getElementById('detailContent').addEventListener('click', event => {
      const target = event.target.closest('[data-skin-chroma], [data-skin-activate], [data-skin-speed], [data-skin-replay], [data-skin-loop], [data-skin-copy-link]');
      if (!target || !detailState) return;
      const entry = archive.entries.find(item => item.id === detailState.id);
      if (!entry) return;
      if (target.dataset.skinChroma !== undefined) {
        const chromas = (entry.chromas || []).filter(chroma => link(chroma.imageUrl || chroma.fullRender));
        const index = Number(target.dataset.skinChroma), chroma = chromas[index];
        if (!chroma || !selectChroma(entry, index)) return;
        const matching = mediaList(entry).findIndex(media => media.chromaId === chroma.id || (chroma.videoUrl && media.url === chroma.videoUrl));
        const generic = mediaList(entry).findIndex(media => !media.chromaId);
        if (matching >= 0 || generic >= 0) showPlayer(matching >= 0 ? matching : generic);
        else if (mediaList(entry).length) {
          stop(detailDialog);
          document.getElementById('skinPlayer').innerHTML = '<div class="weapon-media-empty"><p>当前外观暂无对应动作资料，可从上方选择其他外观的动作。</p></div>';
          document.getElementById('skinMediaCaption').textContent = '';
          const select = document.getElementById('skinVideoSelect');
          if (select) select.value = '';
        }
      }
      if (target.hasAttribute('data-skin-activate')) showPlayer(detailState.media, true);
      if (target.hasAttribute('data-skin-copy-link')) {
        navigator.clipboard.writeText(new URL(hash(entry.id), location.href).href).then(() => showToast('已复制武器外观链接')).catch(() => showToast('复制失败，可复制地址栏链接'));
      }
      const video = document.getElementById('skinVideo');
      if (!video) return;
      if (target.dataset.skinSpeed) {
        video.playbackRate = Number(target.dataset.skinSpeed);
        document.querySelectorAll('[data-skin-speed]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
      }
      if (target.hasAttribute('data-skin-loop')) { video.loop = !video.loop; target.setAttribute('aria-pressed', String(video.loop)); }
      if (target.hasAttribute('data-skin-replay')) { video.currentTime = 0; video.play().catch(() => showToast('请使用播放器的播放按钮')); }
    });
    document.addEventListener('error', event => {
      const target = event.target;
      if (target.tagName === 'IMG' && target.closest('.weapon-inspection-card')) { target.hidden = true; return; }
      if (target.id === 'skinVideo') { document.querySelector('.weapon-video-error')?.removeAttribute('hidden'); return; }
      if (target.id === 'skinAnimation') { target.hidden = true; document.querySelector('.weapon-animation-error')?.removeAttribute('hidden'); return; }
      if (target.tagName === 'IMG' && target.closest('.weapon-card-art, .weapon-detail-art')) {
        target.hidden = true;
        target.parentElement.querySelector('.weapon-art-fallback')?.removeAttribute('hidden');
      }
    }, true);
  }
  return { archive, games, count, ensure, bind, render, reset, readRoute, hash, filtered, card, detail, stop, markdown,
    matchesQuery, normalise, filterEntries, mediaList, containsInspect, isVideo, chromaCount, chromaImage, link, providerId,
    inspectionEntries, inspectionCard, exportList };
})();
