#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const catalogue = JSON.parse(read('data/tactical-items.json'));
const updates = JSON.parse(read('data/core-updates.json'));
const modes = JSON.parse(read('data/modes.json'));
const categories = new Set(catalogue.categories.map((entry) => entry.id));
assert.equal(catalogue.items.length, 136);
assert.equal(categories.size, 14);
const ids = new Set(modes.map((entry) => entry.id));
const linked = new Set();
const communityImageIds = new Set(['prop-o-matic', 'decoy', 'shadow-stone', 'nimbus-cloud-kintoun',
  'crash-pad-jr', 'shadow-tracker', 'chug-cannon', 'flowberry-fizz', 'hunters-cloak',
  'geyser', 'volcanic-vent', 'disguise-booth'].map((slug) => 'fortnite-item-' + slug));
const communityHosts = new Set(['www.everyeye.it', 'fortnite.gs', 'www.pcgamer.com', 'www.eurogamer.de',
  'www.sportskeeda.com', 'www.invenglobal.com', 'www.gamesradar.com', 'us.millenium.gg']);
const communityAssetHosts = new Set(['images.everyeye.it', 'cdn.source.gs', 'cdn.mos.cms.futurecdn.net',
  'assets.reedpopcdn.com', 'staticg.sportskeeda.com', 'static.invenglobal.com', 'static1-us.millenium.gg']);
assert.equal(catalogue.imagePolicy.officialFirst, true);
assert.equal(catalogue.imagePolicy.communityFallback.authorizedAt, '2026-10-12');
for (const entry of catalogue.items) {
  assert.ok(!ids.has(entry.id), 'Unique object ID: ' + entry.id); ids.add(entry.id);
  for (const key of ['name', 'englishName', 'game', 'mechanic', 'objectType', 'sourceUrl']) assert.ok(entry[key]?.trim(), entry.id + ': ' + key);
  assert.ok(categories.has(entry.category));
  assert.ok(['equipment', 'vehicle', 'world', 'creative'].includes(entry.objectGroup));
  assert.equal(entry.publicationStatus, 'ready', 'Ready means catalogue inclusion, not completed research');
  assert.ok(['documented', 'catalogued'].includes(entry.researchStatus));
  const source = new URL(entry.sourceUrl);
  assert.equal(source.protocol, 'https:');
  if (entry.sourceStatus === 'official_reference') assert.ok(['www.fortnite.com', 'dev.epicgames.com'].includes(source.hostname));
  else assert.equal(entry.sourceStatus, 'community_reference');
  const picture = entry.image;
  assert.ok(picture, entry.id + ': has a recognizable image');
  for (const key of ['caption', 'alt', 'sourceName', 'retrievedAt']) assert.ok(picture[key]?.trim(), entry.id + ': image.' + key);
  assert.match(picture.path, /^assets\/tactical-items\/[a-z0-9-]+\.(png|jpg|webp)$/);
  assert.match(picture.background, /^#[0-9a-f]{6}$/i);
  assert.ok(picture.width >= 200 && picture.height >= 200, entry.id + ': usable source resolution');
  assert.ok(['icon', 'art', 'scene', 'group'].includes(picture.kind));
  const imageSource = new URL(picture.sourcePageUrl), asset = new URL(picture.assetSourceUrl);
  assert.equal(imageSource.protocol, 'https:'); assert.equal(asset.protocol, 'https:');
  if (picture.sourceType === 'official') {
    assert.ok(['www.fortnite.com', 'dev.epicgames.com'].includes(imageSource.hostname));
    assert.ok(['cdn2.unrealengine.com', 'd1iv7db44yhgxn.cloudfront.net'].includes(asset.hostname));
    assert.ok(!communityImageIds.has(entry.id));
  } else {
    assert.equal(picture.sourceType, 'community');
    assert.ok(communityImageIds.has(entry.id), 'Community image exception is limited to reviewed official gaps');
    assert.ok(communityHosts.has(imageSource.hostname)); assert.ok(communityAssetHosts.has(asset.hostname));
    assert.ok(picture.officialImageGap?.trim()); assert.ok(picture.officialSourcesChecked.length);
    for (const checked of picture.officialSourcesChecked) assert.ok(['www.fortnite.com', 'dev.epicgames.com'].includes(new URL(checked).hostname));
  }
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, picture.path))).digest('hex'), picture.sha256,
    entry.id + ': original image file integrity');
  assert.equal(entry.researchStatus === 'documented', entry.coreUpdateIds.length > 0);
  assert.deepEqual(entry.legacyIds, entry.coreUpdateIds);
  for (const id of entry.coreUpdateIds) {
    assert.ok(!linked.has(id), 'No duplicate objects for one dossier'); linked.add(id);
    const version = updates.find((version) => version.id === id);
    assert.ok(version?.tacticalProfile && version.publicationStatus === 'ready');
  }
}
assert.equal(linked.size, 8);
assert.equal(catalogue.items.filter((entry) => entry.image.sourceType === 'community').length, communityImageIds.size);
assert.equal(catalogue.items.filter((entry) => entry.sourceStatus === 'community_reference').length, 3);
assert.equal(new Set(catalogue.items.map((entry) => entry.catalogOrder)).size, 136);
const dom = new Map();
function element(selector) {
  if (!dom.has(selector)) dom.set(selector, { innerHTML: '', value: '', hidden: false, textContent: '',
    classList: { toggle() {} }, setAttribute() {}, insertAdjacentHTML() {} });
  return dom.get(selector);
}
const context = vm.createContext({ assert, catalogue, updates, modes, URL, URLSearchParams,
  document: { querySelector: element, querySelectorAll: () => [], baseURI: 'http://127.0.0.1:4173/index.html' },
  localStorage: { getItem: () => '[]', setItem() {} }, location: { search: '' } });
vm.runInContext(['core-updates.js', 'tactical-items.js', 'app.js', 'ff-patches.js'].map(read).join('\n') +
  '\n' + read('workspace.js').replace(/initWorkspace\(\);\s*$/, ''), context);
vm.runInContext(String.raw`
  const legacy = catalogue.items.find((entry) => entry.legacyIds.length);
  state.collected.add(legacy.legacyIds[0]);
  const remaining = loadTacticalCatalogue(catalogue, updates);
  state.modes = [...modes.map((entry) => ({ ...entry, kind: 'modes' })), ...remaining];
  state.entries = [...state.modes, ...itemArchive.entries];
  assert.equal(remaining.length, updates.length - 8);
  assert.equal(state.modes.filter((entry) => !isCoreUpdate(entry)).length, modes.length);
  assert.ok(state.collected.has(legacy.id));
  assert.ok(!state.collected.has(legacy.legacyIds[0]), 'Legacy favorites migrate to the object');
  assert.equal(resolveTacticalItem(legacy.legacyIds[0]).id, legacy.id);
  assert.equal(new Set(state.entries.map((entry) => entry.id)).size, state.entries.length);
  assert.ok(!state.modes.some(isTacticalItem));
  assert.ok(!state.modes.some((entry) => entry.tacticalProfile));
  state.view = 'modes'; state.query = '战术道具';
  assert.equal(getFilteredEntries().length, 0);
  state.view = 'items'; state.query = '';
  assert.equal(getFilteredEntries().length, 136);
  for (const category of itemArchive.categories) {
    itemArchive.category = category.id;
    assert.equal(getFilteredEntries().length, catalogue.items.filter((entry) => entry.category === category.id).length);
  }
  resetItemFilters();
  for (const group of Object.keys(itemGroupLabels)) {
    itemArchive.objectGroup = group;
    assert.equal(getFilteredEntries().length, catalogue.items.filter((entry) => entry.objectGroup === group).length);
  }
  resetItemFilters(); itemArchive.researchStatus = 'documented';
  assert.equal(getFilteredEntries().length, 8);
  itemArchive.researchStatus = 'catalogued';
  assert.equal(getFilteredEntries().length, 128);
  resetItemFilters();
  for (const query of ['Driftboard', 'dashboard', '漂移滑板']) {
    state.query = query; assert.equal(getFilteredEntries().length, 1); assert.equal(getFilteredEntries()[0].name, '漂移滑板');
  }
  state.query = '躲猫猫'; assert.equal(getFilteredEntries().length, 12);
  state.query = 'propomatic'; assert.equal(getFilteredEntries().length, 1);
  state.query = '位移'; assert.ok(getFilteredEntries().length > 30);
  state.query = '完全不存在的对象'; assert.equal(getFilteredEntries().length, 0);
  renderTacticalItems(); assert.match(document.querySelector('#itemGrid').innerHTML, /没有找到匹配的道具/);
  state.query = ''; renderTacticalItems();
  assert.equal((document.querySelector('#itemGrid').innerHTML.match(/<article /g) || []).length, 24);
  itemArchive.limit = 144; renderTacticalItems();
  assert.equal((document.querySelector('#itemGrid').innerHTML.match(/<article /g) || []).length, 136);
  assert.equal(document.querySelector('#loadMoreItems').hidden, true);
  state.gameFilter = 'Fortnite'; state.query = '冲击波';
  itemArchive.category = 'launch'; itemArchive.objectGroup = 'equipment'; itemArchive.researchStatus = 'documented';
  itemArchive.layout = 'list'; itemArchive.sort = 'name';
  const route = workspaceHash(legacy.id);
  const params = new URLSearchParams(route.split('?')[1]);
  assert.equal(params.get('entry'), legacy.id); assert.equal(params.get('q'), '冲击波');
  assert.ok(route.startsWith('#items?'));
  resetItemFilters(); readItemRoute(params);
  assert.equal(itemArchive.category, 'launch'); assert.equal(itemArchive.objectGroup, 'equipment');
  assert.equal(itemArchive.researchStatus, 'documented'); assert.equal(itemArchive.layout, 'list'); assert.equal(itemArchive.sort, 'name');
  readItemRoute(new URLSearchParams('category=bad&status=bad&object=bad&sort=bad'));
  assert.equal(itemArchive.category, 'all'); assert.equal(itemArchive.researchStatus, 'all'); assert.equal(itemArchive.objectGroup, 'all');
  resetItemFilters(); state.query = ''; state.gameFilter = 'all';
  for (const entry of itemArchive.entries) {
    const md = modeToMarkdown(entry), html = tacticalItemDetail(entry), card = tacticalCard(entry);
    assert.ok(md.includes(entry.sourceUrl) && md.includes(entry.englishName));
    assert.match(md, /资料类型：主题道具/);
    assert.doesNotMatch(html + card + md, /undefined|NaN/);
    assert.equal(buildCanvas([entry]).nodes[0].text, md);
    assert.ok(html.includes(entry.image.path) && card.includes(entry.image.path));
    assert.ok(html.includes(entry.image.sourcePageUrl.replace(/&/g, '&amp;')));
    assert.ok(md.includes(entry.image.assetSourceUrl) && md.includes(entry.image.caption));
    assert.match(card, /loading="lazy"/);
    if (entry.image.sourceType === 'community') assert.match(html, /官方缺图补充 · 社区来源/);
    if (entry.researchStatus === 'catalogued') {
      assert.match(html, /详录待补/); assert.match(md, /待补资料/);
      assert.doesNotMatch(html + md, /官方图片与实机截图.*待/);
    } else {
      const version = itemVersions(entry)[0];
      assert.ok(html.includes(version.videos[0].url.replace(/&/g, '&amp;')));
      assert.ok(md.includes(version.tacticalProfile.limits));
      for (const shot of version.screenshots || []) assert.ok(html.includes(shot.path));
    }
  }
  const unsafe = {...itemArchive.entries[0], name:'<img src=x onerror=alert(1)>'};
  assert.doesNotMatch(tacticalCard(unsafe), /<img src=x/);
  state.view = 'collection'; state.contentFilter = 'item';
  assert.deepEqual(getFilteredEntries().map((entry) => entry.id), [legacy.id]);
  state.contentFilter = 'mode'; assert.equal(getFilteredEntries().length, 0);
  state.contentFilter = 'core_update'; assert.equal(getFilteredEntries().length, 0);
  state.contentFilter = 'all'; assert.equal(getFilteredEntries().length, 1);
`, context);
for (const file of ['tactical-items.js', 'tactical-items.css', 'data/tactical-items.json']) assert.ok(read('scripts/build_public_site.py').includes("'" + file + "'"));
assert.ok(read('scripts/build_public_site.py').includes("'assets/tactical-items'"));
assert.ok(read('index.html').includes('data-view="items"'));
assert.ok(!read('index.html').includes('tactical-shortcut'));
console.log('Tactical catalogue passed: 136 illustrated objects (124 official / 12 community), 14 categories, 8 linked dossiers; image integrity, attribution, separation, search, filters, favorites, and exports.');
