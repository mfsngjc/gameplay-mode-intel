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
const evidence = JSON.parse(read('data/core-update-image-sources.json'));
const coverage = JSON.parse(read('data/core-update-source-coverage.json')).games['Free Fire'];
const ids = new Set(modes.map((r) => r.id));
for (const record of updates) {
  assert.ok(!ids.has(record.id), 'Unique ID: ' + record.id); ids.add(record.id);
  assert.equal(record.contentKind, 'core_update');
  assert.equal(record.publicationStatus, 'ready');
  assert.ok(record.sourceModeIds.every((id) => modes.some((m) => m.id === id)), 'Related modes exist');
  assert.equal(new URL(record.sourceUrl).hostname, 'ff.garena.com');
  const asset = evidence.images.find((r) => r.recordId === record.id);
  assert.ok(asset, 'Image provenance for ' + record.id);
  assert.equal(asset.path, record.imageUrl);
  assert.equal(asset.assetSourceUrl, record.imageAssetSourceUrl);
  const bytes = fs.readFileSync(path.join(root, asset.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, 'Unmodified official image');
  assert.ok(asset.dimensions[0] >= 600 && asset.dimensions[1] >= 300);
  assert.match(new URL(asset.assetSourceUrl).hostname, /^(cdn\.wildflamestudio\.com|lh[\w-]*\.googleusercontent\.com)$/);
  if (record.imageScope === 'version') assert.match(record.imageSource, /版本配图，未展示本条/);
}
assert.equal(coverage.coverCount, updates.length);
assert.equal(evidence.recordCount, updates.length);
const context = vm.createContext({ assert, updates, modes,
  document: { querySelector: () => ({}), baseURI: 'http://127.0.0.1:4173/' },
  localStorage: { getItem: () => '[]' }, location: { search: '' }, URL, URLSearchParams });
vm.runInContext(read('core-updates.js') + '\n' + read('app.js') + '\n' + read('ff-patches.js') + '\n' + read('workspace.js').replace(/initWorkspace\(\);\s*$/, ''), context);
vm.runInContext(`
  state.modes = [...modes.map((m) => ({...m, kind: 'modes'})), ...updates.map(normalizeCoreUpdate)];
  state.entries = [...state.modes];
  state.gameFilter = 'Free Fire';
  assert.equal(getFilteredEntries().length, modes.filter(m => m.game === 'Free Fire').length + updates.length);
  state.contentFilter = 'core_update';
  assert.equal(getFilteredEntries().length, updates.length);
  state.contentFilter = 'mode';
  assert.equal(getFilteredEntries().length, modes.filter(m => m.game === 'Free Fire').length);
  state.contentFilter = 'core_update';
  state.filter = 'ltm';
  assert.equal(getFilteredEntries().length, 0, 'Core changes never count as new LTM modes');
  state.filter = 'all';
  for (const category of Object.keys(coreUpdateCategories)) {
    state.updateCategory = category;
    assert.equal(getFilteredEntries().length, updates.filter(r => r.categories.includes(category)).length);
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
`, context);
console.log(`Core update validation passed: ${updates.length} records, ${evidence.assetCount} verified original assets; filters, dates, timeline grouping, collection and exports.`);
