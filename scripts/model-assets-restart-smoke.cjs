const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { resolveModelAssetRoot } = require('../electron/modelAssetRoot.cjs');
const { createSequenceAssetStore } = require('../electron/sequenceAssetStore.cjs');
const { createPersistedConfigStore } = require('../electron/persistedConfigStore.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-media-restart-'));
const filePath = (url) => decodeURIComponent(new URL(url).pathname).replace(/^\/(?=[A-Za-z]:)/, '');
async function test() {
  const portable = path.join(root, 'portable');
  const extraction = path.join(root, 'launch-one'); fs.mkdirSync(extraction);
  const options = { isPackaged: true, execPath: path.join(extraction, 'pet.exe'), projectRoot: root,
    env: { PORTABLE_EXECUTABLE_DIR: portable } };
  // Use the same root expression as main.cjs to cover production wiring.
  const main = fs.readFileSync('electron/main.cjs', 'utf8');
  const expression = main.match(/createSequenceAssetStore\(\{\s*assetRootPath: ([^\n]+),/)[1];
  const assetRoot = vm.runInNewContext(expression, {
    importedModelAssetRoot: resolveModelAssetRoot(options), path, app: { isPackaged: true },
    process: { execPath: options.execPath }, __dirname: path.join(root, 'electron'),
  });
  assert.equal(assetRoot, portable, 'portable imports must not be written into the extraction directory');
  const sourcePng = path.join(root, 'sample.png'); fs.writeFileSync(sourcePng, Buffer.from('image fixture'));
  const sourceVideo = path.join(root, 'sample.webm'); fs.writeFileSync(sourceVideo, Buffer.from('video fixture'));
  const assets = createSequenceAssetStore({ assetRootPath: assetRoot });
  assert.equal(assets.getRootPath(), path.join(portable, '2d模型'));
  const png = assets.stage2DSequence({ sourcePaths: [sourcePng] });
  const video = await assets.stage2DVideo({ sourcePath: sourceVideo });
  assert.equal(png.ok, true); assert.equal(video.ok, true);
  const storeOptions = { userDataPath: path.join(root, 'profile'), assetRootPath: assetRoot };
  const config = { modelUrl: video.videoUrl, customModelPresets: [
    { id: 'png', type: '2d', url: png.frameUrls[0], sequenceFrames: png.frameUrls },
    { id: 'video', type: '2d', url: video.videoUrl, renderKind: 'video' },
  ] };
  // Existing d1 URLs stay valid; directory renaming must not delete legacy assets.
  const legacyPath = path.join(portable, 'd1', 'legacy.png');
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  fs.writeFileSync(legacyPath, 'legacy image');
  const legacyUrl = new URL('desktop-pet-file://local/');
  legacyUrl.pathname = '/' + legacyPath.replace(/\\/g, '/').replace(/^\/+/, '');
  config.customModelPresets.push({ id: 'legacy', type: '2d', url: legacyUrl.toString() });
  assert.equal(createPersistedConfigStore(storeOptions).save(config).ok, true);
  fs.renameSync(extraction, path.join(root, 'retired-launch'));
  fs.unlinkSync(sourcePng); fs.unlinkSync(sourceVideo);
  const restartedRoot = resolveModelAssetRoot({ ...options, execPath: path.join(root, 'launch-two/pet.exe') });
  const restored = createPersistedConfigStore({ ...storeOptions, assetRootPath: restartedRoot }).load();
  assert.equal(restored.ok, true);
  assert.equal(restored.config.customModelPresets.length, 3);
  assert.equal(restored.config.customModelPresets[2].url, legacyUrl.toString());
  for (const preset of restored.config.customModelPresets) assert.ok(fs.existsSync(filePath(preset.url)));
  assert.equal(restored.config.customModelPresets[1].renderKind, 'video');
  assert.equal(resolveModelAssetRoot({ ...options, env: { PORTABLE_EXECUTABLE_FILE: path.join(portable, 'app.exe') } }), portable);
  assert.equal(resolveModelAssetRoot({ ...options, env: {} }), extraction);
  assert.equal(resolveModelAssetRoot({ ...options, isPackaged: false }), root);
  console.log('model assets restart smoke: PASS (PNG/video, deleted originals, changed extraction directory, config reload)');
}
test().finally(() => {
  const target = path.resolve(root);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('pet-media-restart-')) throw new Error('Unsafe test cleanup');
  fs.rmSync(target, { recursive: true, force: true });
}).catch((error) => { console.error(error); process.exitCode = 1; });
