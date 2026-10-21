/* Sharded UGC catalog: manifest paging first, full index only for search or filters. */
window.UGCCatalog = (() => {
  'use strict';
  const root = document.querySelector('#ugcSection');
  const labels = { cs2: 'CS2 创意工坊', roblox: '罗布乐思', fortnite: '堡垒之夜社区岛', minecraft: '我的世界模组' };
  const catalogBase = 'data/ugc/catalog/';
  const PAGE_SIZE = 24, MAX_CONCURRENT = 4;
  const cache = { manifest: null, generation: '', manifestFetchedAt: 0, indexPromises: new Map(), detailPromises: new Map() };
  const MANIFEST_TTL_MS = 60000;
  let queryTimer = 0, renderToken = 0, focusCardView = false;
  const state = { platform: 'all', query: '', page: 0 };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = value => { if (typeof value !== 'string' || !value.trim()) return ''; try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
  const cleanQuery = value => String(value || '').trim();
  const validPath = value => typeof value === 'string' && /^data\/ugc\/catalog\//.test(value) && !value.includes('..') && /\.json(?:\.gz)?$/.test(value) ? value : '';
  const versioned = url => url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(cache.generation);
  function errorText(error) {
    if (error?.message === 'gzip-unsupported') return '浏览器不支持目录文件的解压格式，请更新浏览器后重试。';
    if (error?.message === 'gzip-decode') return '压缩目录分片无法解压，请刷新后重试。';
    const status = error?.status;
    if (status === 403) return '来源拒绝访问（403），当前目录数据可能不完整。';
    if (status === 404) return '目录分片暂时不存在（404）。';
    if (status === 429) return '来源请求过多（429），请稍后重试。';
    if (status >= 500) return '目录来源暂时发生服务错误，请稍后重试。';
    return '目录文件暂时无法读取，请重试。';
  }
  async function fetchJSON(url, noStore = false) {
    const response = await fetch(url, { cache: noStore ? 'no-store' : 'force-cache' });
    if (!response.ok) { const e = new Error('fetch'); e.status = response.status; throw e; }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let text;
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream !== 'function') { const e = new Error('gzip-unsupported'); e.status = 0; throw e; }
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        text = await new Response(stream).text();
      } catch { const e = new Error('gzip-decode'); e.status = 0; throw e; }
    } else text = new TextDecoder('utf-8').decode(bytes);
    try { return JSON.parse(text); } catch { const e = new Error('json'); e.status = 0; throw e; }
  }
  function clearDataCache() { cache.indexPromises.clear(); cache.detailPromises.clear(); }
  async function readManifest(force = false) {
    if (!force && cache.manifest && Date.now() - cache.manifestFetchedAt < MANIFEST_TTL_MS) { updateSummary(cache.manifest); return cache.manifest; }
    if (force) { cache.manifest = null; cache.generation = ''; clearDataCache(); }
    const doc = await fetchJSON(catalogBase + 'manifest.json', true);
    if (doc.schemaVersion !== 1 || !doc.platforms || typeof doc.platforms !== 'object') throw new Error('schema');
    const generation = String(doc.generatedAt || '');
    if (generation !== cache.generation) { clearDataCache(); cache.generation = generation; }
    cache.manifest = doc;
    cache.manifestFetchedAt = Date.now();
    updateSummary(doc);
    return doc;
  }
  function updateSummary(doc) {
    if (!document.body.classList.contains('ugc-view')) return;
    const totals = Object.values(doc.platforms).reduce((sum, meta) => sum + Number(meta.observedCount || 0), 0);
    const el = document.querySelector('#librarySummary');
    if (el) el.textContent = totals.toLocaleString() + ' 条已收录';
    const nav = document.querySelector('#navUgcCount');
    if (nav) nav.textContent = totals.toLocaleString();
  }
  async function sharedJSON(url, type) {
    const map = type === 'detail' ? cache.detailPromises : cache.indexPromises;
    const key = versioned(url);
    if (!map.has(key)) {
      const promise = fetchJSON(key).catch(error => { map.delete(key); throw error; });
      map.set(key, promise);
    }
    return map.get(key);
  }
  async function pooled(items, worker, concurrency = MAX_CONCURRENT) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) { const i = cursor++; await worker(items[i], i); }
    });
    await Promise.all(runners);
  }
  function activePlatforms(doc) { return Object.entries(doc.platforms).filter(([id]) => state.platform === 'all' || id === state.platform); }
  function totalCount(platforms) { return platforms.reduce((n, [, meta]) => n + Number(meta.observedCount || 0), 0); }
  function errorSummary(meta) {
    const errors = Array.isArray(meta.errors) ? meta.errors : meta.errors ? [meta.errors] : [];
    if (!errors.length) return '';
    const text = errors.map(item => typeof item === 'string' ? item : [item?.message, item?.error, item?.status].filter(Boolean).join(' ')).join(' ').toLowerCase();
    if (text.includes('not attempted')) return '暂无可用来源数据。';
    if (text.includes('403') || text.includes('forbidden')) return '来源拒绝访问，当前记录可能不完整。';
    if (text.includes('429') || text.includes('rate limit')) return '来源访问受限，当前记录可能不完整。';
    if (text.includes('timeout')) return '来源更新失败，当前记录可能不完整。';
    return '来源更新失败，当前记录可能不完整。';
  }
  function recordLookup(records) { return new Map(records.map(record => [record.key, record])); }
  async function detailRecords(platforms, entries, token, progress) {
    const groups = new Map();
    const direct = [];
    for (const [platformId, entry] of entries) {
      if (!entry || typeof entry.key !== 'string' || !entry.key || entry.platformId !== platformId) throw new Error('schema');
      if (entry.image && !entry.detailShard) { direct.push(entry); continue; }
      const url = validPath(entry.detailShard);
      if (!url) throw new Error('schema');
      const key = platformId + '|' + url;
      if (!groups.has(key)) groups.set(key, { platformId, url, entries: [] });
      groups.get(key).entries.push(entry);
    }
    const records = direct.slice();
    let done = 0;
    await pooled([...groups.values()], async group => {
      if (token !== renderToken) return;
      const doc = await sharedJSON(group.url, 'detail');
      if (token !== renderToken) return;
      if (doc.schemaVersion !== 1 || doc.platformId !== group.platformId || !Array.isArray(doc.entries)) throw new Error('schema');
      const wanted = new Set(group.entries.map(entry => entry.key));
      const got = new Set();
      for (const record of doc.entries) {
        if (!record || typeof record.key !== 'string' || !record.key || record.platformId !== group.platformId) throw new Error('schema');
        if (wanted.has(record.key)) { records.push(record); got.add(record.key); }
      }
      if (got.size !== wanted.size) throw new Error('missing');
      progress?.(++done, groups.size);
    });
    if (token !== renderToken) return null;
    return recordLookup(records);
  }
  function queryMatches(entry, queryWords) {
    if (!queryWords.length) return true;
    const rawCategories = entry.categories || [];
    const translatedCategories = rawCategories.map(name => categoryNames[normalize(name)] || '').filter(Boolean);
    const haystack = [entry.originalTitle, entry.titleZh, entry.creator, entry.id, entry.key, entry.introZh, entry.descriptionSearch, ...rawCategories, ...translatedCategories].map(normalize).join(' ');
    return queryWords.every(word => haystack.includes(word));
  }
  async function searchIndex(platforms, token, loadingEl) {
    const tasks = [];
    for (const [platformId, meta] of platforms) for (const shard of (meta.searchShards?.length ? meta.searchShards : meta.shards || [])) tasks.push({ platformId, shard });
    const result = new Array(tasks.length);
    let done = 0;
    await pooled(tasks, async (task, i) => {
      if (token !== renderToken) return;
      const url = validPath(task.shard.url);
      if (!url) throw new Error('schema');
      const doc = await sharedJSON(url, 'index');
      if (token !== renderToken) return;
      if (doc.schemaVersion !== 1 || doc.platformId !== task.platformId || !Array.isArray(doc.entries)) throw new Error('schema');
      const shardEntries = [];
      for (const entry of doc.entries) {
        if (!entry || typeof entry.key !== 'string' || !entry.key) throw new Error('schema');
        shardEntries.push({ ...entry, platformId: task.platformId });
      }
      result[i] = shardEntries;
      done++;
      if (loadingEl && token === renderToken) loadingEl.textContent = '正在搜索已收录作品（' + Math.round(done / tasks.length * 100) + '%）…';
    });
    return token === renderToken ? result.flat() : null;
  }
  async function pageFromManifest(platforms, token, loadingEl) {
    const start = state.page * PAGE_SIZE, end = start + PAGE_SIZE, total = totalCount(platforms);
    const ranges = [];
    let offset = 0;
    for (const [platformId, meta] of platforms) {
      for (const shard of meta.shards || []) {
        const count = Number(shard.count || 0), next = offset + count;
        if (next > start && offset < end) ranges.push({ platformId, shard, from: Math.max(0, start - offset), to: Math.min(count, end - offset) });
        offset = next;
        if (offset >= end) break;
      }
      if (offset >= end) break;
    }
    const result = new Array(ranges.length);
    await pooled(ranges, async (range, i) => {
      if (token !== renderToken) return;
      const url = validPath(range.shard.url);
      if (!url) throw new Error('schema');
      const doc = await sharedJSON(url, 'index');
      if (token !== renderToken) return;
      if (doc.schemaVersion !== 1 || doc.platformId !== range.platformId || !Array.isArray(doc.entries)) throw new Error('schema');
      if (doc.entries.some(entry => !entry || typeof entry.key !== 'string' || !entry.key)) throw new Error('schema');
      result[i] = doc.entries.slice(range.from, range.to).map(entry => ({ ...entry, platformId: range.platformId }));
      loadingEl.textContent = '正在读取作品列表…';
    });
    if (token !== renderToken) return null;
    const expected = Math.max(0, Math.min(PAGE_SIZE, total - start));
    const entries = result.flat();
    if (entries.length !== expected) throw new Error('missing');
    return { entries, total };
  }
  const categoryNames = { all:'综合', adventure:'冒险', building:'建造', horror:'恐怖', roleplay:'角色扮演', rpg:'角色扮演', fighting:'格斗', simulator:'模拟', tycoon:'经营', pvp:'玩家对战', pve:'合作对战', minigame:'小游戏', parkour:'跑酷', survival:'生存', social:'社交', technology:'科技', magic:'魔法', utility:'实用工具', optimization:'性能优化', worldgen:'世界生成', decoration:'装饰', equipment:'装备', storage:'存储', food:'食物', transportation:'交通', mobs:'生物', game_mechanics:'游戏机制', library:'基础组件', mod:'模组', classic:'经典对战', wingman:'搭档模式', deathmatch:'死斗', armsrace:'军备竞赛', training:'训练', town:'城市', 'town and city':'城市生活', fps:'射击', sports:'体育', comedy:'休闲', cartoon:'卡通', cursed:'趣味整活', fantasy:'奇幻', 'semi-realistic':'半写实', themed:'主题内容', economy:'经济经营', 'game-mechanics':'游戏机制' };
  function categories(entry) {
    const raw = entry.categories || [];
    const known = raw.map(name => categoryNames[normalize(name)]).filter(Boolean);
    const unknown = raw.filter(name => !categoryNames[normalize(name)]);
    return { known, unknown };
  }
  function sourceObjects(sources) { return (sources || []).map(source => typeof source === 'string' ? { url: source } : source && typeof source === 'object' ? source : null).filter(Boolean); }
  function card(platformId, entry, record) {
    const image = record.image || {}, imageUrl = image.status === 'available' ? safe(image.url) : '';
    const titleZh = record.translationStatus === 'reviewed' ? record.titleZh : '';
    const originalTitle = record.titleStatus === 'missing' || !String(record.originalTitle || entry.originalTitle || '').trim() ? '来源未提供名称' : (record.originalTitle || entry.originalTitle);
    const title = esc(originalTitle) + (titleZh ? '<span class="ugc-title-translation">（' + esc(titleZh) + '）</span>' : '');
    const officialUrl = safe(record.url), host = (() => { try { return new URL(officialUrl).hostname.toLowerCase(); } catch { return ''; } })();
    const isRobloxOfficial = platformId === 'roblox' && (host === 'roblox.com' || host.endsWith('.roblox.com'));
    const statsUrl = platformId === 'roblox' ? safe(record.statsUrl) || sourceObjects(record.sources).map(item => safe(item.url)).find(url => { try { const host = new URL(url).hostname.toLowerCase(); return host === 'rolimons.com' || host.endsWith('.rolimons.com'); } catch { return false; } }) : '';
    const originalSources = sourceObjects(record.sources).map(item => safe(item.url)).filter(Boolean);
    const sourceLinks = originalSources.map((url, index) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">来源 ' + (index + 1) + ' ↗</a>').join(' ');
    const rawDescription = record.descriptionOriginal ? '<details class="ugc-catalog-original"><summary>查看来源原文</summary><p>' + esc(record.descriptionOriginal) + '</p>' + sourceLinks + '</details>' : '';
    const { known: knownCategories, unknown: unknownCategories } = categories(record);
    const isReviewed = record.translationStatus === 'reviewed';
    const imageFallback = image.status === 'unavailable' ? '作品图暂不可用' : '暂缺作品图';
    const knownMetric = { downloads: '下载次数', 'total downloads': '下载次数', visits: '访问次数', 'total visits': '访问次数', 'playing now': '当前在线人数', 'concurrent players': '当前在线人数', 'playtime minutes': '累计游玩分钟', subscribers: '订阅人数', '历史总订阅': '历史总订阅', '当前在线人数': '当前在线人数', '累计访问次数': '累计访问次数', '累计游玩分钟': '累计游玩分钟', '累计下载次数': '累计下载次数' };
    const metricName = knownMetric[normalize(record.metricLabel)] || '来源指标';
    const metric = record.metricValue == null ? '' : '<span>' + metricName + '：' + esc(record.metricValue) + '</span>';
    const creator = record.creator || entry.creator || '';
    const creatorLabel = platformId === 'cs2' && /^\d{17}$/.test(creator) ? '作者编号：' : '作者：';
    const imageMarkup = imageUrl ? '<img loading="lazy" decoding="async" src="' + esc(imageUrl) + '" alt="' + esc(originalTitle) + ' 作品图" data-cover-fallback>' : '<span class="ugc-catalog-cover-fallback">' + imageFallback + '</span>';
    const links = '<div class="ugc-catalog-links">' + (statsUrl ? '<a href="' + esc(statsUrl) + '" target="_blank" rel="noopener noreferrer">统计详情 ↗</a>' : '') + (isRobloxOfficial ? '<a href="' + esc(officialUrl) + '" target="_blank" rel="noopener noreferrer">作品官网 ↗</a>' : officialUrl ? '<a href="' + esc(officialUrl) + '" target="_blank" rel="noopener noreferrer">作品页面 ↗</a>' : '') + (safe(image.sourceUrl) ? '<a href="' + esc(safe(image.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">作品图来源 ↗</a>' : '') + '</div>';
    const intro = '<p class="ugc-catalog-intro">' + (isReviewed && record.introZh ? esc(record.introZh) : '<span>中文介绍待补充。</span>') + '</p>';
    const meta = '<div class="ugc-catalog-meta">' + esc(knownCategories.join(' · ') || (unknownCategories.length ? '来源分类' : '分类暂缺')) + (unknownCategories.length ? ' <details class="ugc-catalog-raw-tags"><summary>查看来源分类</summary>' + esc(unknownCategories.join('、')) + '</details>' : '') + (metric ? ' · ' + metric : '') + '</div>';
    const compact = window.CardView.get() === 'small';
    const heading = '<div class="ugc-catalog-kicker">' + esc(labels[platformId]) + ' · ' + esc(record.id || entry.key || '') + '</div><h3>' + (isRobloxOfficial ? '<a href="' + esc(officialUrl) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' : title) + '</h3><p class="ugc-author">' + creatorLabel + esc(creator || '来源暂未提供') + '</p>';
    if (compact) return '<article class="ugc-catalog-card ugc-catalog-card-compact ' + platformId + '"><div class="ugc-catalog-compact-head"><div class="ugc-catalog-image">' + imageMarkup + '</div><div class="ugc-catalog-compact-heading">' + heading + '</div></div><div class="ugc-catalog-body">' + intro + meta + links + rawDescription + '</div></article>';
    return '<article class="ugc-catalog-card"><div class="ugc-catalog-image">' + imageMarkup + '</div><div class="ugc-catalog-body"><div class="ugc-catalog-kicker">' + esc(labels[platformId]) + ' · ' + esc(record.id || entry.key || '') + '</div><h3>' + (isRobloxOfficial ? '<a href="' + esc(officialUrl) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' : title) + '</h3><p class="ugc-author">' + creatorLabel + esc(creator || '来源暂未提供') + '</p>' + intro + meta + links + rawDescription + '</div></article>';
  }
  function routeParams(query = state.query, page = state.page) {
    const params = new URLSearchParams({ platform: state.platform, board: 'catalog' });
    query = cleanQuery(query);
    if (query !== cleanQuery(state.query)) page = 0;
    if (query) params.set('q', query);
    if (page > 0) params.set('catalogPage', String(page + 1));
    return params;
  }
  function readRoute(params) {
    const platform = params.get('platform');
    state.platform = platform === 'all' || Object.hasOwn(labels, platform) ? platform : 'all';
    state.query = params.get('q') || '';
    const page = Number(params.get('catalogPage'));
    state.page = Number.isSafeInteger(page) && page > 0 ? page - 1 : 0;
    if (params.has('catalogStatus') || params.has('catalogCover')) {
      const clean = routeParams();
      history.replaceState(null, '', '#ugc?' + clean.toString());
    }
  }
  function setRoute(push = false, query = state.query) {
    const params = routeParams(query, state.page);
    const url = '#ugc?' + params.toString();
    history[push ? 'pushState' : 'replaceState'](null, '', url);
    UGCMonitor.readRoute(params);
  }
  function refreshDirectory() {
    clearTimeout(queryTimer);
    const token = ++renderToken;
    root.innerHTML = '<div class="ugc-catalog-loading" role="status">正在刷新作品列表…</div>';
    readManifest(true).then(() => { if (token === renderToken) render(state); }).catch(() => { if (token === renderToken) render(state); });
  }
  async function run(token) {
    const requestedPage = state.page;
    root.innerHTML = '<div class="ugc-catalog-loading" role="status">正在读取作品列表…</div>';
    const loadingEl = root.querySelector('.ugc-catalog-loading');
    try {
      const doc = await readManifest();
      if (token !== renderToken) return;
      const platforms = activePlatforms(doc), total = totalCount(platforms);
      const words = normalize(state.query).split(/\s+/).filter(Boolean);
      const filtering = words.length > 0;
      let entries, pageTotal;
      if (filtering) {
        const index = await searchIndex(platforms, token, loadingEl);
        if (!index || token !== renderToken) return;
        loadingEl.textContent = '正在匹配搜索结果…';
        const matches = [];
        for (let start = 0; start < index.length; start += 2000) {
          if (token !== renderToken) return;
          const end = Math.min(start + 2000, index.length);
          for (let i = start; i < end; i++) if (queryMatches(index[i], words)) matches.push(index[i]);
          loadingEl.textContent = '正在匹配搜索结果…';
          if (end < index.length) await new Promise(resolve => setTimeout(resolve, 0));
        }
        pageTotal = matches.length;
        const pageCount = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
        state.page = Math.min(state.page, pageCount - 1);
        entries = matches.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
      } else {
        state.page = Math.min(state.page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
        const paged = await pageFromManifest(platforms, token, loadingEl);
        if (!paged || token !== renderToken) return;
        entries = paged.entries; pageTotal = paged.total;
      }
      loadingEl.textContent = '正在读取当前页作品资料…';
      const records = await detailRecords(platforms, entries.map(entry => [entry.platformId, entry]), token, () => { loadingEl.textContent = '正在读取作品资料…'; });
      if (!records || token !== renderToken) return;
      const pageCount = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
      const statusLabels = { partial: '部分收录', limited: '来源访问受限', unavailable: '来源暂不可用' };
      const stats = platforms.map(([id, meta]) => {
        const sourceUpdatedAt = meta.lastSuccessfulAt;
        const updatedAt = sourceUpdatedAt || meta.updatedAt;
        const updateLabel = sourceUpdatedAt ? '来源更新 ' : '目录更新 ';
        const updatedText = updatedAt ? updateLabel + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(updatedAt)) : '更新时间暂缺';
        const statusText = statusLabels[meta.status] || '';
        const statusDetails = statusText ? ' · ' + statusText + (errorSummary(meta) ? ' · ' + errorSummary(meta) : '') : '';
        return '<span><strong>' + esc(labels[id] || id) + '</strong> ' + Number(meta.observedCount || 0).toLocaleString() + ' 条已收录 · ' + esc(updatedText) + statusDetails + '</span>';
      }).join('');
      const scopes = platforms.map(([id, meta]) => '<span>' + esc(labels[id] || id) + '：' + esc(typeof meta.sourceScope === 'string' ? meta.sourceScope : '来源范围说明暂缺') + (safe(meta.sourceUrl) ? ' <a href="' + esc(safe(meta.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">来源页面 ↗</a>' : '') + '</span>').join('');
      const errors = platforms.some(([, meta]) => ['partial', 'limited', 'unavailable'].includes(meta.status)) ? '<p class="ugc-catalog-partial">部分来源受限或尚未更新，当前仅展示已收录作品。</p>' : '';
      const empty = platforms.some(([, meta]) => meta.status === 'unavailable') ? '来源暂不可用，无法据此判断没有匹配内容。' : filtering ? '没有匹配内容，请调整搜索词或筛选。' : '当前来源范围内尚无已收录记录。';
      root.innerHTML = '<div class="ugc-heading-line"><span>来源公开范围内的全部收录 · 目录独立于每日榜单</span><button type="button" class="button" data-catalog-refresh>刷新目录</button></div><div class="ugc-board-line"><div class="ugc-board-switch" role="group" aria-label="UGC 视图"><button type="button" data-ugc-board="hot" aria-pressed="false">每日热榜</button><button type="button" data-ugc-board="alltime" aria-pressed="false">历史最热门</button><button type="button" data-ugc-board="catalog" aria-pressed="true">全部收录</button></div></div><div class="ugc-catalog-toolbar"><label>平台<select id="catalogPlatform"><option value="all"' + (state.platform === 'all' ? ' selected' : '') + '>全部平台</option>' + Object.entries(labels).map(([id, label]) => '<option value="' + id + '"' + (state.platform === id ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select></label><div class="card-size-switch" role="group" aria-label="卡片大小"><button type="button" class="card-size-button" data-card-size="large">大图</button><button type="button" class="card-size-button" data-card-size="small">小图</button></div><span>支持原名、中文参考名、作者、编号、玩法和分类；空格分隔词须同时匹配</span></div><div class="ugc-catalog-status">' + stats + '<details><summary>来源范围与来源链接</summary>' + scopes + '</details>' + errors + '</div><div class="ugc-catalog-count">' + (filtering ? '匹配 ' : '已收录 ') + pageTotal.toLocaleString() + ' 条 · 第 ' + (state.page + 1) + ' / ' + pageCount + ' 页</div><div class="ugc-catalog-grid' + (window.CardView.get() === 'small' ? ' ugc-catalog-grid-small' : '') + '">' + (entries.length ? entries.map(entry => { const rec = records.get(entry.key); return rec ? card(entry.platformId, entry, rec) : ''; }).join('') : '<div class="ugc-empty">' + empty + '</div>') + '</div><div class="ugc-footer"><span>每页最多 ' + PAGE_SIZE + ' 条</span><div><button class="button" type="button" data-catalog-page="prev"' + (state.page <= 0 ? ' disabled' : '') + '>上一页</button> <button class="button" type="button" data-catalog-page="next"' + (state.page >= pageCount - 1 ? ' disabled' : '') + '>下一页</button></div></div>';
      window.CardView.syncControls(root);
      root.querySelectorAll('[data-cover-fallback]').forEach(img => img.addEventListener('error', () => {
        img.replaceWith(Object.assign(document.createElement('span'), { className: 'ugc-catalog-cover-fallback', textContent: '作品图暂不可用' }));
      }, { once: true }));
      if (focusCardView) {
        root.querySelector('[data-card-size="' + window.CardView.get() + '"]')?.focus({ preventScroll: true });
        focusCardView = false;
      }
      if (state.page !== requestedPage) { const params = routeParams(); history.replaceState(null, '', '#ugc?' + params.toString()); }
    } catch (error) {
      if (token !== renderToken) return;
      root.innerHTML = '<div class="ugc-warning" role="alert"><strong>目录无法完整读取</strong><p>' + esc(error?.message === 'schema' ? '目录分片格式暂不受支持，请刷新重试。' : error?.message === 'missing' ? '当前页作品记录缺失，请刷新重试。' : error?.status === 404 ? '目录清单或分片尚未发布（404），目前没有可展示的真实目录数据。' : errorText(error)) + '</p><button type="button" class="button" data-catalog-refresh>重试</button></div>';
      if (focusCardView) {
        root.querySelector('[data-catalog-refresh]')?.focus({ preventScroll: true });
        focusCardView = false;
      }
    }
  }
  function render({ platform = state.platform, query = state.query } = {}) {
    if (state.platform !== platform || cleanQuery(state.query) !== cleanQuery(query)) state.page = 0;
    state.platform = platform; state.query = cleanQuery(query);
    clearTimeout(queryTimer);
    const token = ++renderToken;
    queryTimer = setTimeout(() => run(token), 100);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-ugc-board')) return;
    if (button.hasAttribute('data-catalog-page')) {
      const nextPage = state.page + (button.dataset.catalogPage === 'next' ? 1 : -1);
      if (nextPage < 0) return;
      state.page = nextPage; setRoute(true); render(state); return;
    }
    if (button.hasAttribute('data-catalog-refresh')) { refreshDirectory(); return; }
  });
  root.addEventListener('change', event => {
    const id = event.target.id;
    if (id !== 'catalogPlatform') return;
    if (id === 'catalogPlatform') state.platform = event.target.value;
    state.page = 0; setRoute(true); render(state);
  });
  window.CardView.subscribe(() => {
    if (!document.body.classList.contains('ugc-view') || !window.UGCMonitor.isCatalog()) return;
    focusCardView = document.activeElement?.matches('[data-card-size]') || false;
    render(state);
  });
  return {
    render,
    readRoute,
    routeParams,
    refresh: refreshDirectory
  };
})();
