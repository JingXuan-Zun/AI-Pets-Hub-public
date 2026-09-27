const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSequenceAssetStore } = require('../electron/sequenceAssetStore.cjs');

// Keep packaged ffmpeg resolution covered when the dependency export points
// inside app.asar but electron-builder placed the binary in app.asar.unpacked.
const sequenceStoreSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'sequenceAssetStore.cjs'), 'utf8');
assert.match(sequenceStoreSource, /app\.asar\.unpacked/u);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-video-asset-'));
(async () => { try {
  const sourcePath = path.join(tempRoot, '透明待机.webm');
  fs.writeFileSync(sourcePath, Buffer.from('webm-fixture'));
  const store = createSequenceAssetStore({ assetRootPath: tempRoot });

  const first = await store.stage2DVideo({ sourcePath, videoName: '透明待机' });
  assert.equal(first.ok, true);
  assert.match(first.videoUrl, /^desktop-pet-file:\/\/local\//u);
  assert.equal(fs.readdirSync(path.join(tempRoot, '2d模型', 'video')).length, 1);

  const second = await store.stage2DVideo({ sourcePath, videoName: '透明待机' });
  assert.equal(second.ok, true);
  assert.equal(second.videoUrl, first.videoUrl);
  assert.equal(fs.readdirSync(path.join(tempRoot, '2d模型', 'video')).length, 1);
  assert.equal((await store.stage2DVideo({ sourcePath: path.join(tempRoot, 'invalid.mp4') })).ok, false);

  const interactionFolder = path.join(tempRoot, 'eating');
  fs.mkdirSync(interactionFolder);
  fs.writeFileSync(path.join(interactionFolder, 'first.webm'), Buffer.from('first-video'));
  assert.equal(store.inspect2DVideoFolder({ folderPath: interactionFolder }).videoCount, 1);
  const firstPick = await store.pick2DVideoFromFolder({ folderPath: interactionFolder });
  assert.equal(firstPick.ok, true);
  fs.writeFileSync(path.join(interactionFolder, 'second.webm'), Buffer.from('second-video'));
  assert.equal(store.inspect2DVideoFolder({ folderPath: interactionFolder }).videoCount, 2);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const pickedFirst = await store.pick2DVideoFromFolder({ folderPath: interactionFolder });
    Math.random = () => 0.999;
    const pickedSecond = await store.pick2DVideoFromFolder({ folderPath: interactionFolder });
    assert.equal(pickedFirst.ok, true);
    assert.equal(pickedSecond.ok, true);
    assert.notEqual(pickedFirst.videoUrl, pickedSecond.videoUrl);
  } finally {
    Math.random = originalRandom;
  }
  fs.rmSync(interactionFolder, { recursive: true });
  assert.equal((await store.pick2DVideoFromFolder({ folderPath: interactionFolder })).ok, false);


  console.log('video 2d asset store smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
} })().catch((error) => { console.error(error); process.exitCode = 1; });
