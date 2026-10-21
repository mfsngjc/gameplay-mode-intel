#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const catalog = path.join(root, 'data/ugc/catalog');
const manifestPath = path.join(catalog, 'manifest.json');
const errors = [];
const platformIds = ['cs2', 'roblox', 'fortnite', 'minecraft'];
const fail = message => errors.push(message);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const validTime = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const https = value => typeof value === 'string' && /^https:\/\//.test(value);

const exclusionsPath = path.join(root, 'data/ugc/catalog-exclusions.json');
if (fs.existsSync(exclusionsPath)) {
  let exclusions;
  try { exclusions = read(exclusionsPath); }
  catch (error) { fail(`Invalid catalog exclusion configuration JSON: ${error.message}`); }
  if (exclusions) {
    if (exclusions.schemaVersion !== 1 || !exclusions.entries || typeof exclusions.entries !== 'object' || Array.isArray(exclusions.entries)) {
      fail('Catalog exclusion configuration must use schemaVersion 1 and an entries object.');
    } else {
      for (const [key, rule] of Object.entries(exclusions.entries)) {
        const approval = rule?.approval;
        const expected = crypto.createHash('sha256').update(`${rule?.originalTitle || ''}\n${rule?.descriptionOriginal || ''}`, 'utf8').digest('hex');
        if (!/^(cs2|roblox|fortnite|minecraft):.+$/.test(key) || !rule || typeof rule !== 'object' ||
            typeof rule.originalTitle !== 'string' || typeof rule.descriptionOriginal !== 'string' ||
            !/^[0-9a-f]{64}$/.test(rule.sourceFingerprint || '') || rule.sourceFingerprint !== expected ||
            typeof rule.reason !== 'string' || !rule.reason.trim() || typeof rule.reviewer !== 'string' || !rule.reviewer.trim() ||
            !validTime(rule.reviewedAt) || !Array.isArray(rule.sources) || !rule.sources.length || rule.sources.some(x => !https(x)) ||
            !approval || typeof approval.approvedBy !== 'string' || !approval.approvedBy.trim() || !validTime(approval.approvedAt)) {
          fail(`Catalog exclusion is missing exact source evidence or primary approval: ${key}`);
        }
      }
    }
  }
}

if (!fs.existsSync(manifestPath)) { console.error('UGC catalog manifest is missing.'); process.exit(2); }
const manifest = read(manifestPath);
if (manifest.schemaVersion !== 1 || !validTime(manifest.generatedAt) || !manifest.platforms) fail('Invalid manifest schema/generatedAt.');
const allKeys = {};
for (const id of platformIds) {
  const item = manifest.platforms[id];
  if (!item) { fail(`Missing platform ${id}.`); continue; }
  if (!['complete', 'partial', 'limited', 'unavailable'].includes(item.status)) fail(`${id}: invalid status.`);
  if (!Number.isInteger(item.observedCount) || item.observedCount < 0) fail(`${id}: invalid observedCount.`);
  if (!validTime(item.startedAt) && item.startedAt != null) fail(`${id}: invalid startedAt.`);
  if (!validTime(item.updatedAt) && item.updatedAt != null) fail(`${id}: invalid updatedAt.`);
  if (typeof item.enumerationComplete !== 'boolean') fail(`${id}: enumerationComplete must be boolean.`);
  if (item.status === 'complete' && !item.enumerationComplete) fail(`${id}: complete without enumerationComplete.`);
  if (item.enumerationComplete && item.status !== 'complete') fail(`${id}: enumerationComplete requires complete status.`);
  if (typeof item.sourceScope !== 'string' || !item.sourceScope.trim()) fail(`${id}: missing user-facing sourceScope.`);
  if (!https(item.sourceUrl) || !item.sourceQuery) fail(`${id}: sourceUrl/sourceQuery provenance is missing.`);

  const detailByKey = new Map(), searchByKey = new Map(), detailKeysByPath = new Map();
  let details = 0, searches = 0, covers = 0, pendingIdentity = 0, reviewed = 0;
  const detailPaths = new Set();
  const readShards = (shards, kind, target) => {
    for (const shard of shards || []) {
      if (typeof shard.url !== 'string' || !shard.url.startsWith(`data/ugc/catalog/${id}/`)) { fail(`${id}: unsafe ${kind} URL ${shard.url}`); continue; }
      const file = path.resolve(root, shard.url);
      if (!file.startsWith(catalog + path.sep) || !fs.existsSync(file)) { fail(`${id}: missing/unsafe shard ${shard.url}`); continue; }
      if (fs.statSync(file).size > 5 * 1024 * 1024) fail(`${id}: shard exceeds 5 MiB ${shard.url}`);
      const data = read(file);
      if (data.schemaVersion !== 1 || data.platformId !== id || !Array.isArray(data.entries)) { fail(`${id}: malformed ${kind} shard ${shard.url}`); continue; }
      if (data.entries.length !== shard.count) fail(`${id}: ${kind} count mismatch ${shard.url}`);
      if (kind === 'details') { details += data.entries.length; detailPaths.add(shard.url); detailKeysByPath.set(shard.url, new Set(data.entries.map(e => e.key))); }
      else searches += data.entries.length;
      for (const record of data.entries) {
        if (!record.key || target.has(record.key)) fail(`${id}: duplicate or missing ${kind} key ${record.key}`);
        target.set(record.key, record);
      }
    }
  };
  readShards(item.shards, 'details', detailByKey);
  readShards(item.searchShards, 'search', searchByKey);
  if (details !== item.observedCount || searches !== item.observedCount) fail(`${id}: shard totals detail=${details} search=${searches} observed=${item.observedCount}`);
  if (detailByKey.size !== searchByKey.size) fail(`${id}: search/detail key counts differ.`);

  const canonical = new Set();
  for (const [key, e] of detailByKey) {
    allKeys[key] = e;
    if (e.platformId !== id || !e.id || (!e.originalTitle && e.titleStatus !== 'missing') || !/^\w{64}$/.test(e.sourceFingerprint || '')) fail(`${id}: required title/id/fingerprint invalid on ${key}`);
    const expectedFingerprint = crypto.createHash('sha256').update(`${e.originalTitle || ''}\n${e.descriptionOriginal || ''}`, 'utf8').digest('hex');
    if (!/^[0-9a-f]{64}$/.test(e.sourceFingerprint || '') || e.sourceFingerprint !== expectedFingerprint) fail(`${id}: sourceFingerprint does not match original title/description ${key}`);
    if (!['available', 'missing'].includes(e.descriptionStatus)) fail(`${id}: invalid description status ${key}`);
    if (!['verified', 'pending'].includes(e.identityStatus)) fail(`${id}: invalid identityStatus on ${key}`);
    if (e.identityStatus === 'verified') {
      if (!e.canonicalId) fail(`${id}: verified identity lacks canonicalId ${key}`);
      const canonicalKey = `${id}:${e.canonicalId}`;
      if (canonical.has(canonicalKey)) fail(`${id}: duplicate verified canonicalId ${e.canonicalId}`);
      canonical.add(canonicalKey);
    } else if (id === 'roblox' && !key.startsWith('roblox:place:')) fail(`${id}: unresolved place must use an explicit place identity key ${key}`);
    if (!https(e.url) || !Array.isArray(e.sources) || !e.sources.length || e.sources.some(x => !https(x))) fail(`${id}: URL provenance missing or invalid ${key}`);
    if (id === 'roblox' && !https(e.statsUrl)) fail(`${id}: missing Rolimon's statistics URL ${key}`);
    if (!['reviewed', 'pending', 'needs_review'].includes(e.translationStatus)) fail(`${id}: invalid translationStatus ${key}`);
    if (e.translationStatus === 'reviewed') {
      reviewed++;
      if (!e.titleZh?.trim() || !e.introZh?.trim() || !e.reviewer?.trim() || !validTime(e.reviewedAt) || !Array.isArray(e.reviewSources) || !e.reviewSources.length || e.reviewSources.some(x => !https(x))) fail(`${id}: reviewed Chinese record lacks text/reviewer/time/sources ${key}`);
      if (e.reviewer !== 'legacy-reviewed' && (e.reviewApproval?.status !== 'accepted' || !e.reviewApproval.approvedBy?.trim() || !validTime(e.reviewApproval.approvedAt))) fail(`${id}: nonlegacy Chinese review lacks primary approval receipt ${key}`);
    }
    if (!e.image || !['available', 'missing', 'unavailable'].includes(e.image.status)) fail(`${id}: invalid image state ${key}`);
    if (e.image?.status === 'available') {
      covers++;
      if (!https(e.image.url) || !https(e.image.sourceUrl) || !validTime(e.image.checkedAt)) fail(`${id}: invalid image provenance ${key}`);
    } else if (e.image?.url) fail(`${id}: nonavailable image has URL ${key}`);
    for (const field of ['collectedAt', 'firstObservedAt', 'lastObservedAt']) if (!validTime(e[field])) fail(`${id}: invalid ${field} ${key}`);
    if (e.createdAt != null && !validTime(e.createdAt)) fail(`${id}: invalid createdAt ${key}`);

    const s = searchByKey.get(key);
    if (!s) { fail(`${id}: missing search record ${key}`); continue; }
    if (s.originalTitle !== e.originalTitle || s.titleZh !== e.titleZh || s.creator !== e.creator || s.introZh !== e.introZh || s.translationStatus !== e.translationStatus || s.imageStatus !== e.image.status || s.descriptionStatus !== e.descriptionStatus || !detailPaths.has(s.detailShard) || !detailKeysByPath.get(s.detailShard)?.has(key)) fail(`${id}: search/detail values or shard reference differ ${key}`);
  }
  for (const key of searchByKey.keys()) if (!detailByKey.has(key)) fail(`${id}: orphan search record ${key}`);
  if (covers !== item.withCoverCount || reviewed !== item.reviewedCount) fail(`${id}: manifest cover/review totals mismatch.`);
  pendingIdentity = [...detailByKey.values()].filter(e => e.identityStatus === 'pending').length;
  if (item.identityPendingCount !== pendingIdentity) fail(`${id}: identity pending total mismatch.`);

  // Private pending/accepted review queues are optional in clean CI checkouts.
  const pendingDir = path.join(root, 'data/ugc/catalog-cache/reviews/pending', id);
  if (fs.existsSync(pendingDir)) {
    const queued = new Set();
    for (const file of fs.readdirSync(pendingDir).filter(x => x.endsWith('.json'))) {
      const batch = read(path.join(pendingDir, file));
      for (const r of batch.entries || []) {
        if (!detailByKey.has(r.key) || queued.has(r.key) || r.sourceFingerprint !== detailByKey.get(r.key).sourceFingerprint) fail(`${id}: invalid/duplicate pending review ${r.key}`);
        queued.add(r.key);
      }
    }
    if (queued.size !== item.observedCount - item.reviewedCount) fail(`${id}: private review queue count mismatch.`);
  }
}

const coversPath = path.join(catalog, 'board-covers.json');
if (manifest.boardCoversUrl !== 'data/ugc/catalog/board-covers.json' || !fs.existsSync(coversPath)) fail('Missing board cover index/manifest URL.');
else {
  const covers = read(coversPath);
  if (covers.schemaVersion !== 1 || !validTime(covers.updatedAt) || !covers.entries) fail('Invalid board cover index.');
  for (const [key, image] of Object.entries(covers.entries || {})) {
    if (!/^(cs2|roblox|fortnite|minecraft):.+$/.test(key) || !['available', 'missing', 'unavailable'].includes(image.status)) fail(`Invalid board cover record ${key}`);
    if (image.status === 'available' && (!https(image.url) || !https(image.sourceUrl) || !validTime(image.checkedAt))) fail(`Invalid board cover provenance ${key}`);
    if (image.status !== 'available' && image.url) fail(`Nonavailable board cover contains URL ${key}`);
  }
  const latestPath = path.join(root, 'data/ugc/latest.json');
  if (fs.existsSync(latestPath)) {
    const latest = read(latestPath), expected = new Set();
    for (const [boardId, data] of Object.entries(latest.platforms || {})) {
      const platform = data.platformId || boardId.replace(/_alltime$/, '');
      for (const row of data.entries || []) expected.add(`${platform}:${row.id}`);
    }
    for (const key of expected) if (!covers.entries[key]) fail(`Missing board cover state ${key}`);
    for (const key of Object.keys(covers.entries)) if (!expected.has(key)) fail(`Unexpected board cover state ${key}`);
  }
}

if (errors.length) { console.error(errors.map(e => `- ${e}`).join('\n')); process.exit(1); }
console.log('UGC catalog schema, coverage, immutable shards, provenance, identity, review and board-cover indexes are valid.');
