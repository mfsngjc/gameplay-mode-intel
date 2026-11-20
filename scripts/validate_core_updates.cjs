#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const updates = JSON.parse(read('data/core-updates.json'));
const modes = JSON.parse(read('data/modes.json'));
const catalogue = JSON.parse(read('data/tactical-items.json'));
const evidence = JSON.parse(read('data/core-update-image-sources.json'));
const coverageGames = JSON.parse(read('data/core-update-source-coverage.json')).games;
const sourceHostsByGame = {
  'Fortnite': ['www.fortnite.com', 'www.epicgames.com', 'communities.epicgames.com'],
  'PUBG': ['pubg.com', 'www.pubg.com', 'store.steampowered.com', 'steamcommunity.com'],
  'PUBG Mobile': ['www.pubgmobile.com', 'pubgmobile.jp', 'www.pubgmobile.jp'],
  'Free Fire': ['ff.garena.com'],
  '和平精英': ['gp.qq.com', 'apps.apple.com', 'www.taptap.cn'],
  'Apex Legends': ['www.ea.com', 'forums.ea.com', 'store.steampowered.com'],
  '三角洲行动': ['df.qq.com', 'www.playdeltaforce.com', 'playdeltaforce.com', 'deltaforce.garena.com', 'store.steampowered.com', 'steamcommunity.com', 'steamstore-a.akamaihd.net']
};
const categories = new Set(['map_poi', 'map_interactable', 'equipment', 'traversal',
  'economy_loot', 'revive_teamplay', 'combat_rules', 'in_match_usability']);
const imageHosts = new Set(['cdn.wildflamestudio.com', 'drop-assets.ea.com', 'cdn2.unrealengine.com', 'cms-assets.unrealengine.com', 'web.df.garena.com', 'i.ytimg.com',
  'wstatic-prod-boc.krafton.com', 'shared.akamai.steamstatic.com', 'clan.akamai.steamstatic.com',
  'clan.fastly.steamstatic.com', 'steamstore-a.akamaihd.net', 'game.gtimg.cn', 'static.gametalk.qq.com', 'gp.qq.com',
  'freefiremobile-a.akamaihd.net', 'overseas-img.qq.com',
  'www.pubgmobile.com', 'pubgmobile.jp', 'www.pubgmobile.jp']);
const brakkeshPublisherGuide = 'https://news.17173.com/content/11162026/001205869.shtml';
const brakkeshPublisherImage = 'https://i.17173cdn.com/2fhnvk/YWxqaGBf/cms3/IcIJaBbuhpFvsxl.png';
const ids = new Set(modes.map((r) => r.id));
for (const record of updates) {
  assert.ok(!ids.has(record.id), 'Unique ID: ' + record.id); ids.add(record.id);
  assert.equal(record.contentKind, 'core_update');
  assert.equal(record.publicationStatus, 'ready');
  assert.ok(record.sourceModeIds.every((id) => modes.some((m) => m.id === id)), 'Related modes exist');
  const isBrakkeshPublisherGuide = record.game === '三角洲行动' && record.sourceUrl === brakkeshPublisherGuide;
  assert.ok(sourceHostsByGame[record.game]?.includes(new URL(record.sourceUrl).hostname) ||
    isBrakkeshPublisherGuide, record.id + ': approved official source host for game');
  const asset = evidence.images.find((r) => r.recordId === record.id);
  assert.ok(asset, 'Image provenance for ' + record.id);
  assert.equal(asset.path, record.imageUrl);
  assert.equal(asset.assetSourceUrl, record.imageAssetSourceUrl);
  const bytes = fs.readFileSync(path.join(root, asset.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, 'Unmodified official image');
  assert.ok(asset.dimensions[0] >= 600 && asset.dimensions[1] >= 300);
  const imageHost = new URL(asset.assetSourceUrl).hostname;
  const sourcePage = new URL(asset.sourcePageUrl);
  const epicPublisherPage = sourcePage.hostname === 'www.fortnite.com' &&
    /^\/(?:@|%40)epic\//i.test(sourcePage.pathname);
  const epicCommunityImage = record.game === 'Fortnite' &&
    (sourcePage.hostname === 'communities.epicgames.com' || epicPublisherPage) &&
    imageHost === 'fn-creator-community-cdn.qstv.on.epicgames.com';
  const peacekeeperStoreImage = record.game === '和平精英' && sourcePage.hostname === 'apps.apple.com' &&
    sourcePage.pathname === '/cn/app/id1321803705' && sourcePage.searchParams.has('eventid') &&
    imageHost === 'is1-ssl.mzstatic.com';
  const iceboundTrainGuideImage = record.game === '和平精英' && sourcePage.hostname === 'www.bilibili.com' &&
    sourcePage.pathname === '/video/BV1riW66VEC7/' && imageHost === 'i2.hdslb.com' &&
    new URL(asset.assetSourceUrl).pathname === '/bfs/archive/253397558caab507434e14d067bee5ef849a75c4.jpg';
  const isBrakkeshPublisherImage = isBrakkeshPublisherGuide &&
    asset.sourcePageUrl === brakkeshPublisherGuide && asset.assetSourceUrl === brakkeshPublisherImage;
  assert.ok(imageHosts.has(imageHost) || /^lh[\w-]*\.googleusercontent\.com$/.test(imageHost) ||
    epicCommunityImage || peacekeeperStoreImage || iceboundTrainGuideImage ||
    isBrakkeshPublisherImage, record.id + ': approved official image host');
  if (new URL(asset.assetSourceUrl).hostname === 'i.ytimg.com') {
    const id = new URL(asset.assetSourceUrl).pathname.split('/')[2];
    assert.ok(record.videos?.some(v => v.sourceType === 'official' && v.channel === 'Fortnite' && new URL(v.url).searchParams.get('v') === id), 'Video cover must belong to a verified official video');
  }
  if (record.tacticalProfile) {
    for (const field of ['englishName', 'role', 'operation', 'effect', 'acquisition', 'limits']) assert.ok(record.tacticalProfile[field], record.id + ': ' + field);
    assert.ok(record.tacticalProfile.parameters.length);
    assert.ok(record.videos?.length);
    for (const video of record.videos) {
      const media = new URL(video.url);
      assert.equal(media.protocol, 'https:');
      if (media.hostname === 'epicgames.ent.box.com') {
        assert.equal(record.game, 'Fortnite');
        assert.equal(video.sourceType, 'official');
        assert.equal(video.channel, 'Epic Games');
        assert.match(media.pathname, /^\/s\/[a-z0-9]+\/file\/\d+$/);
      } else {
        assert.equal(media.hostname, 'www.youtube.com');
        assert.match(media.searchParams.get('v'), /^[\w-]{11}$/);
      }
      assert.ok(video.title && video.channel && video.publishedDate && video.versionLabel && video.watchFor);
    }
    for (const shot of record.screenshots || []) {
      assert.ok(fs.existsSync(path.join(root, shot.path)));
      assert.equal(shot.sourceType, 'official');
      assert.ok(record.videos.some(v => v.sourceType === 'official' && new URL(v.url).searchParams.get('v') === new URL(shot.sourceUrl).searchParams.get('v')));
      assert.ok(shot.timestampSeconds >= 0 && shot.caption && shot.capturedAt);
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, shot.path))).digest('hex'), shot.sha256);
    }
  }
  if (record.imageScope === 'version') assert.match(record.imageSource, /版本配图，未展示本条/);
}
assert.equal(Object.values(coverageGames).reduce((sum, game) => sum + (game.recordCount || 0), 0), updates.length);
assert.equal(evidence.recordCount, updates.length);
const context = vm.createContext({ assert, updates, modes, catalogue,
  document: { querySelector: () => ({}), baseURI: 'http://127.0.0.1:4173/' },
  localStorage: { getItem: () => '[]' }, location: { search: '' }, URL, URLSearchParams });
vm.runInContext(read('weapon-skins.js') + '\n' + read('core-updates.js') + '\n' + read('tactical-items.js') + '\n' + read('app.js') + '\n' + read('ff-patches.js') + '\n' + read('workspace.js').replace(/initWorkspace\(\);\s*$/, ''), context);
vm.runInContext(`
  loadTacticalCatalogue(catalogue);
  state.coreUpdates = updates.map(normalizeCoreUpdate);
  state.modes = [...modes.map((m) => ({...m, kind: 'modes'})), ...modeCoreUpdates()];
  state.entries = [...state.modes];
  state.gameFilter = 'Free Fire';
  assert.equal(getFilteredEntries().length, modes.filter(m => m.game === 'Free Fire').length + updates.filter(r => r.game === 'Free Fire').length);
  state.contentFilter = 'core_update';
  assert.equal(getFilteredEntries().length, updates.filter(r => r.game === 'Free Fire').length);
  state.contentFilter = 'mode';
  assert.equal(getFilteredEntries().length, modes.filter(m => m.game === 'Free Fire').length);
  state.contentFilter = 'core_update';
  state.filter = 'ltm';
  assert.equal(getFilteredEntries().length, 0, 'Core changes never count as new LTM modes');
  state.filter = 'all';
  for (const category of Object.keys(coreUpdateCategories)) {
    state.updateCategory = category;
    assert.equal(getFilteredEntries().length, updates.filter(r => r.game === 'Free Fire' && r.categories.includes(category)).length);
  }
  state.updateCategory = 'all';
  state.query = 'OB52';
  assert.equal(getFilteredEntries().length, 3, 'Versions are searchable');
  state.query = '';
  const records = getFilteredEntries();
  const announced = records.find(r => r.effectiveDateStatus === 'unverified');
  assert.equal(getModeDateValue(announced), announced.publishedDate);
  assert.equal(announced.launchDate, null);
  assert.match(formatActivityDate(announced), /公告/);
  assert.match(getActivityState(announced).label, /待核实/);
  const planned = records.find(r => r.effectiveDateStatus === 'scheduled');
  assert.equal(getModeDateValue(planned), planned.effectiveDate);
  assert.match(renderCard(planned), /基础更新 · 预告/);
  assert.match(getTimelineDateLabel(planned), /预定/);
  assert.match(getActivityState({...planned, effectiveDate:'2000-01-01'}).label, /待核实/, 'Passing the planned date does not confirm launch');
  const groups = groupUpdateEntries(records, true);
  assert.equal(groups.flatMap(g => g.entries).length, records.length);
  assert.equal(new Set(groups.flatMap(g => g.entries).map(r => r.id)).size, records.length);
  for (const g of groups) assert.ok(g.entries.every(r => getTimelineMeta(r).laneKey === getTimelineMeta(g.representative).laneKey));
  assert.ok(groups.some(g => g.representative.versionLabel === 'OB52' && g.entries.length === 3));
  const chart = renderTimelineCanvas(groups);
  assert.doesNotMatch(chart, /NaN|undefined/);
  assert.match(chart, /data-timeline-group=/);
  assert.match(chart, /role="button" tabindex="0"/);
  assert.equal((chart.match(/<g class="canvas-node /g) || []).length, groups.length);
  for (const r of records) {
    const markdown = modeToMarkdown(r);
    assert.match(markdown, /资料类型：基础更新/);
    assert.ok(markdown.includes(r.sourceUrl));
    assert.ok(markdown.includes(r.imageAssetSourceUrl));
    assert.ok(buildCanvas([r]).nodes[0].text.includes(coreUpdateDateLabel(r)));
    assert.ok(getEntryTags(r).includes('基础更新'));
    assert.ok(renderCard(r).includes(r.imageScopeLabel));
  }
  state.modeView = 'timeline'; state.updateCategory = 'equipment';
  const params = new URLSearchParams(workspaceHash(planned.id).split('?')[1]);
  assert.equal(params.get('game'), 'Free Fire');
  assert.equal(params.get('content'), 'core_update');
  assert.equal(params.get('category'), 'equipment');
  assert.equal(params.get('entry'), planned.id);
  state.view = 'collection'; state.updateCategory = 'all'; state.collected.add(planned.id);
  assert.deepEqual(getFilteredEntries().map(r => r.id), [planned.id], 'Collection retains core records');
  state.view = 'modes'; state.gameFilter = 'Fortnite'; state.query = '战术道具'; state.contentFilter = 'core_update';
  assert.equal(getFilteredEntries().length, 0, 'Object dossiers are excluded from the mode library');
  for (const r of state.coreUpdates.filter(r => r.tacticalProfile)) {
    assert.ok(coreUpdateDetail(r).includes('战术道具机制'));
    assert.ok(coreUpdateDetail(r).includes(r.videos[0].url.replace(/&/g, '&amp;')));
    assert.ok(modeToMarkdown(r).includes(r.videos[0].url));
    assert.ok(buildCanvas([r]).nodes[0].text.includes(r.tacticalProfile.limits));
  }
`, context);
console.log(`Core update validation passed: ${updates.length} records, ${evidence.assetCount} verified original assets; filters, dates, timeline grouping, collection and exports.`);
