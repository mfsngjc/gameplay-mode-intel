/* Validate catalogue identity, media claims, attribution, dates and public references. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const gameIds = ['valorant', 'delta-force', 'call-of-duty', 'cod-mobile', 'cf-mobile', 'cfhd', 'cs2', 'apex'];
const prefixes = { valorant: /^val-/, 'delta-force': /^delta-/, 'call-of-duty': /^cod-/, 'cod-mobile': /^codm-/, 'cf-mobile': /^cfm-/, cfhd: /^cfhd-/, cs2: /^cs2-/, apex: /^apex-/ };
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function http(value, message) {
  assert.equal(typeof value, 'string', message);
  const url = new URL(value);
  assert.ok(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, message);
  return url;
}
const manifest = read('data/weapon-skins/manifest.json');
assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(manifest.games.map(game => game.id), gameIds);
const ids = new Set(), all = [], weaponTypes = new Map(), inspectionLibraries = [];
for (const game of manifest.games) {
  assert.equal(game.url, 'data/weapon-skins/' + game.id + '.json');
  const data = read(game.url);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.game, game.id);
  assert.ok(!Number.isNaN(Date.parse(data.updatedAt)), game.id + ' source timestamp');
  const ready = data.skins.filter(skin => skin.publicationStatus === 'ready');
  assert.equal(ready.length, game.count, game.id + ' manifest count');
  if (game.id === 'call-of-duty') {
    const categories = new Map();
    for (const skin of ready) {
      if (categories.has(skin.weaponId)) assert.equal(skin.category, categories.get(skin.weaponId), skin.id + ' base weapon category conflict');
      else categories.set(skin.weaponId, skin.category);
    }
  }
  const libraryIds = new Set(), libraryVideos = new Set();
  for (const media of data.inspectionLibrary || []) {
    assert.equal(game.id, 'call-of-duty', 'Standalone creator inspect library belongs to COD PC');
    assert.ok(media.id && !libraryIds.has(media.id), 'Duplicate inspect-library identity'); libraryIds.add(media.id);
    assert.equal(media.publicationStatus, 'ready');
    assert.equal(media.provider, 'bilibili');
    assert.equal(media.kind, 'inspect');
    assert.ok(['source_confirmed', 'sample_reviewed'].includes(media.reviewStatus));
    const url = http(media.url, 'Original Bilibili inspect video');
    assert.equal(url.hostname, 'www.bilibili.com');
    assert.match(media.videoId, /^BV[0-9A-Za-z]{10}$/);
    assert.equal(url.pathname, '/video/' + media.videoId + '/');
    assert.ok(!libraryVideos.has(media.videoId), 'Duplicate source video'); libraryVideos.add(media.videoId);
    http(media.thumbnailUrl, 'Original creator video poster');
    assert.ok(media.title && media.sourceName && media.gameTitle);
    assert.match(media.publishedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number(media.cid) > 0 && Array.isArray(media.sourceEvidence) && media.sourceEvidence.length);
    for (const id of media.associatedSkinIds || []) {
      const skin = ready.find(item => item.id === id);
      assert.ok(skin, 'Inspect library may only link an existing ready blueprint');
      assert.equal(media.weaponId, skin.weaponId);
      assert.equal(media.weaponType, skin.weaponType);
      assert.ok(skin.media.some(item => item.url === media.url), 'Linked inspect is available in the blueprint detail');
    }
    inspectionLibraries.push(media);
  }
  if (data.inspectionLibrary) assert.equal(data.coverage.inspectionLibraryCount, data.inspectionLibrary.length);
  for (const skin of ready) {
    assert.match(skin.id, prefixes[game.id], skin.id + ' prefix');
    assert.ok(!ids.has(skin.id), skin.id + ' duplicate identity'); ids.add(skin.id);
    assert.equal(skin.game, game.id);
    for (const field of ['name', 'weaponId', 'weaponName', 'sourceName', 'sourceId', 'region', 'firstSeenAt']) {
      assert.ok(typeof skin[field] === 'string' && skin[field].trim(), skin.id + ' missing ' + field);
    }
    assert.ok(['gun', 'melee'].includes(skin.weaponType), skin.id + ' type');
    const baseWeapon = game.id + ':' + skin.weaponId;
    if (weaponTypes.has(baseWeapon)) assert.equal(skin.weaponType, weaponTypes.get(baseWeapon), skin.id + ' base weapon type conflict');
    else weaponTypes.set(baseWeapon, skin.weaponType);
    assert.ok(['unverified', 'confirmed', 'scheduled'].includes(skin.releaseDateStatus), skin.id + ' release status');
    if (skin.publishedDate) assert.match(skin.publishedDate, /^\d{4}-\d{2}-\d{2}$/, skin.id + ' original article publication date');
    if (skin.releaseDateStatus === 'unverified') assert.equal(skin.releaseDate, null, skin.id + ' unknown release must stay null');
    else {
      assert.match(skin.releaseDate, /^\d{4}-\d{2}-\d{2}$/, skin.id + ' release date');
      assert.ok(skin.timingNote || skin.dateEvidence || skin.releaseDateEvidence, skin.id + ' date evidence');
    }
    http(skin.sourceUrl, skin.id + ' source');
    const picture = skin.image?.url || skin.image?.path;
    if (picture?.startsWith('assets/weapon-skins/')) {
      assert.ok(!picture.includes('..') && !picture.includes('\\'), skin.id + ' image path');
      const file = path.resolve(root, picture);
      assert.ok(file.startsWith(path.join(root, 'assets', 'weapon-skins') + path.sep) && fs.statSync(file).isFile());
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), skin.image.sha256, skin.id + ' archived image hash');
    } else http(picture, skin.id + ' image');
    http(skin.image?.sourcePageUrl, skin.id + ' picture attribution');
    http(skin.image?.assetSourceUrl, skin.id + ' original image');
    assert.ok(['official', 'game_asset', 'community'].includes(skin.image.sourceType), skin.id + ' image source type');
    for (const field of ['chromas', 'levels', 'media']) assert.ok(Array.isArray(skin[field]), skin.id + ' ' + field);
    const levelIds = new Set(skin.levels.map(level => level.id)), chromaIds = new Set(skin.chromas.map(chroma => chroma.id));
    assert.equal(levelIds.size, skin.levels.length, skin.id + ' duplicate levels');
    assert.equal(chromaIds.size, skin.chromas.length, skin.id + ' duplicate chromas');
    for (const chroma of skin.chromas) {
      const picture = chroma.imageUrl || chroma.fullRender;
      if (!picture) continue;
      if (picture.startsWith('assets/weapon-skins/')) {
        assert.ok(!picture.includes('..') && !picture.includes('\\'), skin.id + ' chroma path');
        const file = path.resolve(root, picture);
        assert.ok(file.startsWith(path.join(root, 'assets', 'weapon-skins') + path.sep) && fs.statSync(file).isFile());
        assert.equal(chroma.image?.url, picture, skin.id + ' chroma image identity');
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), chroma.image.sha256, skin.id + ' chroma image hash');
        http(chroma.image.sourcePageUrl, skin.id + ' chroma attribution');
        http(chroma.image.assetSourceUrl, skin.id + ' chroma original');
      } else http(picture, skin.id + ' chroma image');
    }
    const mediaIds = new Set();
    for (const media of skin.media) {
      assert.ok(media.id && !mediaIds.has(media.id), skin.id + ' duplicate media'); mediaIds.add(media.id);
      const mediaUrl = http(media.url, skin.id + ' media');
      http(media.sourcePageUrl, skin.id + ' video attribution');
      assert.ok(media.sourceName && ['official', 'community'].includes(media.sourceType), skin.id + ' video origin');
      assert.ok(['mp4', 'youtube', 'bilibili', 'gif'].includes(media.provider), skin.id + ' provider');
      assert.ok(['preview', 'showcase', 'inspect', 'equip', 'reload', 'fire', 'ads', 'finisher'].includes(media.kind), skin.id + ' action');
      if (media.levelId) assert.ok(levelIds.has(media.levelId), skin.id + ' dangling level');
      if (media.chromaId) assert.ok(chromaIds.has(media.chromaId), skin.id + ' dangling chroma');
      if (media.provider === 'mp4') assert.match(mediaUrl.pathname, /\.mp4$/i, skin.id + ' playable MP4 reference');
      if (media.provider === 'gif' && !/\.gif$/i.test(mediaUrl.pathname)) {
        assert.equal(media.mimeType, 'image/gif', skin.id + ' extensionless GIF must have decoded MIME evidence');
        assert.ok(Number(media.frameCount) > 1, skin.id + ' GIF must contain multiple frames');
        assert.match(media.sha256, /^[a-f0-9]{64}$/, skin.id + ' decoded GIF hash');
      }
      if (media.kind === 'inspect' || (media.contains || media.containsActions || []).includes('inspect')) {
        assert.ok(['source_confirmed', 'sample_reviewed'].includes(media.reviewStatus), skin.id + ' unreviewed inspect claim');
      }
    }
    all.push(skin);
  }
  assert.equal(ready.filter(skin => skin.weaponType === 'melee').length, game.meleeCount);
  assert.equal(ready.filter(skin => skin.media.some(media => ['mp4', 'youtube', 'bilibili'].includes(media.provider))).length, game.withVideoCount);
  assert.equal(ready.filter(skin => skin.media.some(media => media.provider === 'gif')).length, game.withAnimationCount);
}
assert.equal(all.length, manifest.total);
const modes = read('data/modes.json'), updates = read('data/core-updates.json');
assert.ok(!modes.some(entry => ids.has(entry.id) || entry.contentKind === 'weapon_skin'));
assert.ok(!updates.some(entry => ids.has(entry.id) || entry.contentKind === 'weapon_skin'));

// Exercise real filters, escaping, provider validation and conservative inspection classification.
const context = vm.createContext({
  URL, URLSearchParams, document: { baseURI: 'http://127.0.0.1:4173/index.html' },
  state: { query: '', collected: new Set() },
  escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
  icon: () => '', detailButton: () => '',
});
vm.runInContext(fs.readFileSync(path.join(root, 'weapon-skins.js'), 'utf8') + '\nglobalThis.testSkins = WeaponSkins;', context);
const api = context.testSkins;
const normal = all.map(skin => api.normalise(skin, skin.game));
for (const [weapon, type] of [['9A91', 'gun'], ['柯尔特', 'gun'], ['麒麟刺', 'melee'], ['尼泊尔', 'melee'], ['阿波罗之弓', 'gun']]) {
  const variants = normal.filter(skin => skin.skinGame === 'cf-mobile' && skin.weaponName === weapon);
  assert.ok(variants.length && variants.every(skin => skin.weaponType === type), 'CFM base weapon classification: ' + weapon);
}
const filters = { game: 'valorant', type: 'melee', weapon: 'all', rarity: 'all', media: 'all' };
assert.equal(api.filterEntries(normal, filters, '').length, manifest.games[0].meleeCount);
assert.ok(api.filterEntries(normal, { ...filters, type: 'all' }, 'RGX 狂徒').length > 0, 'Chinese/English cross-field search');
for (const alias of ['希尔', '恶灵', '动力小子']) assert.ok(api.filterEntries(normal,
  { ...filters, game: 'apex' }, alias).length > 0, 'Apex heirloom Chinese search: ' + alias);
assert.ok(api.filterEntries(normal, { ...filters, media: 'inspect' }, '').length > 0, 'reviewed inspect sample discoverable');
assert.equal(api.containsInspect({ kind: 'preview', reviewStatus: 'metadata_only' }), false);
assert.equal(api.isVideo({ provider: 'gif' }), false, 'GIF animations must not inflate video coverage');
assert.equal(api.isVideo({ provider: 'mp4' }), true);
const gifSample = api.normalise({ ...all[0], id: 'gif-sample', media: [{ id: 'gif', provider: 'gif', kind: 'inspect',
  url: 'https://example.com/inspect.gif', sourcePageUrl: 'https://example.com/article', reviewStatus: 'source_confirmed' }] }, 'cf-mobile');
assert.equal(api.filterEntries([gifSample], { ...filters, game: 'cf-mobile', type: 'all', media: 'video' }, '').length, 0);
assert.equal(api.filterEntries([gifSample], { ...filters, game: 'cf-mobile', type: 'all', media: 'inspect' }, '').length, 1);
assert.ok(api.detail(gifSample).includes('id="skinAnimation"'), 'Inspection GIF is displayed without a video iframe');
assert.equal(api.mediaList({ media: [{ provider: 'gif', url: 'https://example.com/inspect.gif.js' }] }).length, 0);
assert.equal(api.mediaList({ media: [{ provider: 'gif', url: 'https://example.com/resource/0', mimeType: 'image/gif', frameCount: 8 }] }).length, 1);
assert.equal(api.mediaList({ media: [{ provider: 'gif', url: 'https://example.com/resource/0', mimeType: 'image/jpeg', frameCount: 8 }] }).length, 0);
const basePicture = { url: 'https://example.com/base.png', assetSourceUrl: 'https://example.com/base.png', sourcePageUrl: 'https://example.com/base', sourceType: 'official', caption: 'BASE CAPTION' };
const altPicture = { url: 'https://example.com/alt.png', assetSourceUrl: 'https://example.com/alt.png', sourcePageUrl: 'https://example.com/alt', sourceType: 'game_asset', caption: 'ALT CAPTION' };
const chromaSample = api.normalise({ ...all[0], image: basePicture,
  chromas: [{ id: 'base', name: '基础外观', isBase: true, imageUrl: basePicture.url, image: basePicture },
    { id: 'alt', name: '炫彩', imageUrl: altPicture.url, image: altPicture }],
  media: [{ id: 'alt-gif', provider: 'gif', kind: 'inspect', chromaId: 'alt', url: 'https://example.com/alt.gif' }] }, 'cfhd');
assert.equal(api.chromaCount(chromaSample), 1, 'Base appearance is not an extra chroma');
assert.ok(api.card(chromaSample).includes('1 款炫彩'));
const chromaDetail = api.detail(chromaSample);
assert.ok(chromaDetail.includes('src="https://example.com/alt.png"') && chromaDetail.includes('ALT CAPTION'), 'Chroma-specific media opens with its image and provenance');
const frameSample = api.normalise({ ...all[0], name: 'Beam Saber', image: {
  ...basePicture, url: 'https://example.com/frame.webp', assetSourceUrl: 'https://example.com/showcase.mp4',
  derivedFromVideoUrl: 'https://example.com/showcase.mp4' } }, 'apex');
assert.ok(api.markdown(frameSample).includes('![Beam Saber](https://example.com/frame.webp)'), 'Frame exports render an image and retain the original video as provenance');
const libraryExample = { id: 'cod-inspect-sample', provider: 'bilibili', kind: 'inspect', publicationStatus: 'ready',
  reviewStatus: 'source_confirmed', url: 'https://www.bilibili.com/video/BV1cTWNz4Ey8/', title: 'COD21 特殊检视——打印命运',
  gameTitle: 'Black Ops 6 / COD21', sourceName: '原作者', weaponType: 'gun' };
const libraryFilters = { ...filters, game: 'call-of-duty', type: 'all' };
assert.equal(api.inspectionEntries([libraryExample], libraryFilters, '打印命运').length, 1);
assert.equal(api.inspectionEntries([libraryExample], { ...libraryFilters, type: 'melee' }, '').length, 0);
assert.equal(api.inspectionEntries([{ ...libraryExample, gameEdition: 'black-ops-6' }], { ...libraryFilters, edition: 'modern-warfare-3' }, '').length, 0);
assert.equal(api.inspectionEntries([{ ...libraryExample, reviewStatus: 'metadata_only' }], libraryFilters, '').length, 0);
assert.ok(!api.inspectionCard(libraryExample).includes('<iframe'), 'Original creator videos are not loaded automatically');
assert.ok(!api.inspectionCard({ ...libraryExample, title: '<img src=x onerror=alert(1)>' }).includes('<img src=x'), 'Creator title escaping');
const bo6 = api.filterEntries(normal, { ...filters, game: 'call-of-duty', type: 'all', edition: 'black-ops-6' }, '');
assert.ok(bo6.length && bo6.every(skin => skin.gameEdition === 'black-ops-6'), 'COD blueprint editions filter independently');
assert.equal(api.filterEntries(normal, { ...filters, game: 'call-of-duty', type: 'all' }, '打印命运').length, 1, 'Reviewed Chinese creator title finds exactly the associated blueprint');
assert.equal(api.link('javascript:alert(1)'), '');
assert.equal(api.link('https://user:password@example.com/x'), '');
assert.equal(api.providerId({ provider: 'youtube', url: 'https://youtube.com.evil.example/watch?v=abcdefghijk' }), '');
assert.equal(api.providerId({ provider: 'bilibili', url: 'https://bilibili.com.evil.example/video/BV11jdbB8EsB/' }), '');
assert.ok(!api.card(api.normalise({ ...all[0], name: '<img src=x onerror=alert(1)>' }, 'valorant')).includes('<img src=x'));
for (const file of ['weapon-skins.js', 'workspace.js', 'app.js', 'core-updates.js']) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
const integration = vm.createContext({
  assert, rawModes: modes, rawUpdates: updates, catalogue: read('data/tactical-items.json'), allSkins: all,
  URL, URLSearchParams, document: { querySelector: () => ({}), baseURI: 'http://127.0.0.1:4173/index.html' },
  localStorage: { getItem: () => '[]' }, location: { search: '' },
});
vm.runInContext(['weapon-skins.js', 'core-updates.js', 'tactical-items.js', 'app.js', 'ff-patches.js'].map(file =>
  fs.readFileSync(path.join(root, file), 'utf8')).join('\n') + '\n' +
  fs.readFileSync(path.join(root, 'workspace.js'), 'utf8').replace(/initWorkspace\(\);\s*$/, ''), integration);
vm.runInContext([
  "loadTacticalCatalogue(catalogue); state.coreUpdates = rawUpdates.map(normalizeCoreUpdate);",
  "state.modes = [...rawModes.map(mode => ({...mode, kind:'modes'})), ...modeCoreUpdates()];",
  "const baseline = state.modes.length;",
  "WeaponSkins.archive.entries = allSkins.map(skin => WeaponSkins.normalise(skin, skin.game));",
  "state.entries = [...state.modes, ...itemArchive.entries, ...WeaponSkins.archive.entries];",
  "assert.equal(getFilteredEntries().length, baseline, 'Skin records must not enter the mode library');",
  "assert.equal(state.modes.length, baseline, 'Mode statistics remain independent');",
  "const chosen = WeaponSkins.archive.entries.find(skin => skin.skinGame === 'valorant');",
  "state.collected.add(chosen.id); state.view = 'collection'; state.contentFilter = 'skin';",
  "assert.equal(getFilteredEntries().length, 1, 'Skin-only collection filter');",
  "state.gameFilter = chosen.game;",
  "assert.equal(getFilteredEntries()[0].id, chosen.id, 'Collected skin game filter');",
  "const markdown = modeToMarkdown(chosen);",
  "assert.ok(markdown.includes('资料类型：武器外观') && markdown.includes(chosen.sourceUrl));",
  "assert.ok(!markdown.includes('核心玩法：'), 'Cosmetics export must not invent gameplay categories');",
  "const canvas = buildCanvas([chosen]);",
  "assert.equal(canvas.nodes[0].id, chosen.id);",
  "assert.equal(canvas.nodes[0].text, markdown, 'Canvas keeps cosmetic attribution and media');"
].join('\n'), integration);
console.log('Weapon cosmetics validated: ' + all.length + ' records across ' + gameIds.length + ' games; identity, dates, provenance, media, filters, URL safety, independent mode counts, favorites and exports passed.');
