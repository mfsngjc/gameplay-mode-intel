#!/usr/bin/env node
// Validate collected records and the library's core-gameplay/LTM behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const modes = JSON.parse(read('data/modes.json'));
const research = fs.existsSync(path.join(root, 'local-only/research.json')) ? JSON.parse(read('local-only/research.json')) : [];
const allowed = new Set(['br', 'warfare', 'bomb', 'extraction', 'pve', 'casual']);
const ids = new Set(modes.map((mode) => mode.id));
assert.equal(ids.size, modes.length, 'Mode IDs must be unique');
for (const mode of modes) {
  assert.ok(Array.isArray(mode.gameplayTypes) && mode.gameplayTypes.length, mode.id + ': missing core gameplay');
  assert.equal(new Set(mode.gameplayTypes).size, mode.gameplayTypes.length, mode.id + ': duplicate categories');
  assert.ok(mode.gameplayTypes.every((type) => allowed.has(type)), mode.id + ': unknown category');
  assert.equal(typeof mode.isLtm, 'boolean', mode.id + ': LTM must be an explicit boolean');
  assert.ok(typeof mode.imageUrl === 'string' && mode.imageUrl.trim(), mode.id + ': missing cover image');
  assert.ok(typeof mode.imageSource === 'string' && mode.imageSource.trim(), mode.id + ': missing cover source label');
}
for (const entry of research) {
  assert.ok(entry.sourceModeIds.length && entry.sourceModeIds.every((id) => ids.has(id)), entry.id + ': missing source case');
}
const context = vm.createContext({
  assert, modes,
  document: { querySelector: () => ({}), baseURI: 'http://127.0.0.1:4173/' },
  localStorage: { getItem: () => '[]' },
  URL, URLSearchParams
});
vm.runInContext(read('app.js') + '\n' + read('workspace.js').replace(/initWorkspace\(\);\s*$/, ''), context);
vm.runInContext(`
  state.modes = modes.map((mode) => ({ ...mode, kind: 'modes' }));
  state.entries = [...state.modes];
  state.view = 'modes';
  const byId = (id) => state.modes.find((mode) => mode.id === id);
  const filteredIds = () => new Set(getFilteredEntries().map((mode) => mode.id));
  const reload = 'fortnite-reload-2024';
  const lava = 'fortnite-floor-is-lava-2019';
  state.gameplayFilter = 'br';
  assert.ok(filteredIds().has(reload) && filteredIds().has(lava), 'Core BR and BR LTM belong together');
  assert.equal(getTimelineMeta(byId(reload)).laneKey, getTimelineMeta(byId(lava)).laneKey, 'BR LTM shares the BR timeline lane');
  state.filter = 'ltm';
  assert.ok(filteredIds().has(lava) && !filteredIds().has(reload), 'LTM narrows BR independently');
  assert.ok(getFilteredEntries().every((entry) => entry.isLtm), 'Only explicitly marked LTM cases match');
  assert.equal(workspaceHash(), '#modes?gameplay=br&tag=ltm');
  assert.equal(new URLSearchParams(workspaceHash(lava).split('?')[1]).get('entry'), lava);
  assert.match(renderCard(byId(lava)), /class="cover-ltm"/);
  assert.doesNotMatch(renderCard(byId(reload)), /class="cover-ltm"/);
  assert.match(modeToMarkdown(byId(lava)), /核心玩法：BR（大逃杀）/);
  assert.match(modeToMarkdown(byId(lava)), /模式标签：LTM/);
  assert.doesNotMatch(modeToMarkdown(byId(reload)), /模式标签：LTM/);
  assert.match(buildCanvas([byId(lava)]).nodes[0].text, /BR（大逃杀） · LTM/);
  assert.ok(getEntryTags(byId(lava)).includes('LTM · 限时模式'), 'PNG export includes the independent label');
  state.filter = 'all';
  state.gameFilter = '三角洲行动';
  assert.equal(getFilteredEntries().length, 0, 'The legacy br-core tag does not make Delta Force BR');
  state.gameplayFilter = 'extraction';
  assert.ok(filteredIds().has('delta-force-operations-2024'), 'Operations belongs to extraction');
  assert.ok(filteredIds().has('delta-force-night-battle-2025'), 'Shared night variant is searchable under extraction');
  state.gameplayFilter = 'warfare';
  assert.ok(filteredIds().has('delta-force-night-battle-2025'), 'Shared night variant is searchable under warfare');
  state.gameplayFilter = 'all';
  state.gameFilter = 'all';
  assert.equal(getFilteredEntries().length, modes.length, 'Multi-category records are never duplicated');
  state.gameplayFilter = 'bomb';
  assert.ok(filteredIds().has('pubg-bluebomb-rush-2023'));
  assert.ok(filteredIds().has('delta-force-black-tide-bomb-2026'));
  state.gameplayFilter = 'pve';
  assert.ok(filteredIds().has('fortnite-horde-rush-2019'));
  assert.ok(!filteredIds().has('apex-shadowfall-2019'), 'PvE elements alone do not move BR into PVE');
  state.filter = 'ltm';
  assert.ok(filteredIds().has('fortnite-horde-rush-2019'), 'PVE can also have an LTM label');
  state.gameplayFilter = 'all';
  state.filter = 'all';
  state.query = 'LTM';
  assert.ok(filteredIds().has(lava) && !filteredIds().has(reload), 'LTM is searchable');
  state.query = '';
  const analysisCard = { ...byId(lava), id: 'test-analysis', kind: 'mechanics', isLtm: false, sourceModeIds: [lava] };
  state.entries.push(analysisCard);
  state.view = 'mechanics';
  state.gameplayFilter = 'br';
  assert.ok(filteredIds().has(analysisCard.id));
  assert.doesNotMatch(renderCard(analysisCard), /class="cover-ltm"/, 'Analysis is not itself an LTM');
  state.view = 'timeline';
  state.gameplayFilter = 'all';
  for (const game of getGames()) {
    state.gameFilter = game;
    const gameModes = getTimelineModes();
    const lanes = new Set(getTimelineLaneDefinitions().map((lane) => lane.key));
    assert.ok(gameModes.every((mode) => lanes.has(getTimelineMeta(mode).laneKey)), game + ': missing timeline lane');
    const chart = renderTimelineCanvas(gameModes, new Set(gameModes.map((mode) => mode.id)));
    assert.doesNotMatch(chart, /NaN|undefined/, game + ': invalid chart position');
    assert.equal((chart.match(/<g class="canvas-node /g) || []).length, gameModes.length, game + ': duplicated timeline nodes');
  }
`, context);
console.log('Taxonomy validation passed: ' + modes.length + ' mode records, ' + research.length + ' linked research cards; BR/LTM filtering, category boundaries, exports and timeline lanes.');
