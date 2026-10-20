const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'data', 'ugc');
const read = name => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const latest = read('latest.json');
const chinese = read('chinese.json');
assert.equal(chinese.schemaVersion, 1);
assert.equal(chinese.language, 'zh-CN');
assert.ok(Number.isFinite(Date.parse(chinese.updatedAt)));
const chineseKeys = new Set();
function assertChinese(board, row) {
  const key = board.platformId + ':' + row.id;
  const item = chinese.entries[key];
  assert.ok(item, key + ' missing Chinese introduction');
  assert.match(item.title, /[\u3400-\u9fff]/, key + ' title must be Chinese');
  assert.ok(item.intro.length >= 16 && /[\u3400-\u9fff]/.test(item.intro), key + ' introduction too short');
  assert.ok(!/[A-Za-z]{3,}/.test(item.title + item.intro), key + ' unexplained English in introduction');
  assert.ok(item.canonicalId && item.originalTitle && item.translationKind === 'descriptive');
  assert.match(item.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(item.reviewedAt)));
  assert.ok(Array.isArray(item.sources) && item.sources.length > 0);
  item.sources.forEach(source => assert.ok(source.startsWith('https://')));
  chineseKeys.add(key);
}
assert.equal(latest.schemaVersion, 1);
assert.equal(Object.keys(latest.platforms).length, 8, 'Four platforms, two boards each');
let total = 0;
for (const [key, board] of Object.entries(latest.platforms)) {
  assert.equal(board.id, key);
  assert.ok(['hot', 'alltime'].includes(board.boardType));
  assert.ok(['ok', 'stale', 'unavailable'].includes(board.status));
  if (board.status === 'unavailable') { assert.equal(board.entries.length, 0); continue; }
  const expected = board.boardType === 'alltime' ? 200 : 100;
  // An explicitly stale snapshot may retain its previous 100-row scope.
  const retained = board.status === 'stale' ? (board.rankingLimit || 100) : expected;
  assert.equal(board.entries.length, retained, key + ' incomplete');
  assert.equal(new Set(board.entries.map(row => row.id)).size, retained, key + ' duplicates');
  if (board.status === 'ok' && board.boardType === 'alltime') {
    assert.equal(board.rankingLimit, 200);
    assert.match(board.rankingKey, /top200-v2$/);
  }
  assert.ok(board.rankingKey && board.methodology && board.sourceUrl.startsWith('https://'));
  assert.ok(Number.isFinite(Date.parse(board.collectedAt)));
  board.entries.forEach((row, index) => {
    assertChinese(board, row);
    assert.equal(row.rank, index + 1);
    assert.ok(row.title && row.url.startsWith('https://'));
    assert.ok(row.metricValue == null || (Number.isFinite(row.metricValue) && row.metricValue >= 0));
    if (board.isBaseline) { assert.equal(row.isNewEntry, false); assert.equal(row.rankDelta, null); }
    if (row.isNewEntry) { assert.equal(row.previousRank, null); assert.equal(row.rankDelta, null); }
    if (row.isStrongNewEntry) assert.ok(row.strongReasons.length > 0);
    assert.equal(row.rankHistory.length, 8);
  });
  total += board.entries.length;
}
const index = read('index.json');
for (const item of index.dates) {
  assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
  const history = read('history/' + item.date + '.json');
  assert.equal(history.date, item.date);
  for (const [key, board] of Object.entries(history.platforms)) {
    assert.equal(board.date, item.date);
    const expected = board.rankingLimit || 100; // Retain genuine legacy snapshots.
    assert.ok([100, 200].includes(expected));
    if (board.boardType === 'hot') assert.equal(expected, 100);
    assert.equal(board.entries.length, expected);
    assert.equal(new Set(board.entries.map(row => row.id)).size, expected);
    assert.equal(item.counts[key], expected);
    assert.equal(board.complete, true);
    assert.ok(item.platforms.includes(key));
    board.entries.forEach(row => assertChinese(board, row));
  }
}
if (fs.existsSync(path.join(folder, 'briefing.json'))) {
  const briefing = read('briefing.json');
  assert.equal(briefing.schemaVersion, 1);
  for (const entry of briefing.entries || []) {
    const board = latest.platforms[entry.boardId];
    assert.ok(board && board.entries.some(row => row.id === entry.id), 'AI briefing must reference an observed ranked work');
    assert.ok(entry.observation && Array.isArray(entry.sources) && entry.sources.length > 0);
    for (const source of entry.sources) assert.ok(source.startsWith('https://'));
  }
}
console.log(`UGC validation passed: ${total} entries across 8 boards; ${chineseKeys.size} work IDs have Chinese names and introductions; ${index.dates.length} dated snapshots.`);
