import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeVideoEmotionFolderAliases,
  resolveVideoEmotionFolderNames,
} from '../src/pet-runtime/video2d/videoLibraryEmotionFolders.ts';
import {
  resolveVideo2DNextStep,
  shouldLoopVideo2DBase,
  shouldQueueVideo2DEmotion,
} from '../src/pet-runtime/video2d/video2dPlaybackPlan.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const require = createRequire(import.meta.url);
const { createSequenceAssetStore } = require('../electron/sequenceAssetStore.cjs');

// Emotion folder names: defaults, user override replaces defaults, normalization.
assert.ok(resolveVideoEmotionFolderNames('HAPPY').includes('开心'));
assert.ok(resolveVideoEmotionFolderNames('SAD').includes('伤心'));
assert.deepEqual(resolveVideoEmotionFolderNames('HAPPY', { HAPPY: ['笑'] }), ['笑']);
assert.ok(resolveVideoEmotionFolderNames('SAD', { HAPPY: ['笑'] }).includes('伤心'));
assert.deepEqual(
  normalizeVideoEmotionFolderAliases({ HAPPY: [' 笑 ', '笑', '', 3], ANGRY: ['生气'], SAD: [] }),
  { HAPPY: ['笑'] },
);
assert.equal(normalizeVideoEmotionFolderAliases('bad'), undefined);

// Playback plan: queued emotion first, then idle rotation, else looping base.
assert.deepEqual(
  resolveVideo2DNextStep({ idleRotationActive: true, pendingEmotion: 'SAD' }),
  { kind: 'emotion', action: 'SAD' },
);
assert.deepEqual(resolveVideo2DNextStep({ idleRotationActive: true, pendingEmotion: null }), { kind: 'idle' });
assert.deepEqual(resolveVideo2DNextStep({ idleRotationActive: false, pendingEmotion: null }), { kind: 'base' });
assert.equal(shouldQueueVideo2DEmotion('emotion'), true);
assert.equal(shouldQueueVideo2DEmotion('idle'), false);
assert.equal(shouldQueueVideo2DEmotion(null), false);
// Regression: the looping default video never fires `ended`, which kept idle
// rotation from ever starting.
assert.equal(shouldLoopVideo2DBase(false, true), false);
assert.equal(shouldLoopVideo2DBase(false, false), true);
assert.equal(shouldLoopVideo2DBase(true, false), false);

// Wiring: the primary pet must receive the library (it previously did not).
const { avatarLayerSource, importSource, visualRouterSource, companionLayerSource } = readProjectSources({
  avatarLayerSource: 'src/components/pet/PetAvatarLayer.tsx',
  companionLayerSource: 'src/components/pet/PetCompanionLayer.tsx',
  importSource: 'src/components/settings/useSettingsPanelModelAssetsState.ts',
  visualRouterSource: 'src/components/pet/PetVisualRenderer.tsx',
});
assert.match(avatarLayerSource, /videoLibraryRootPath: matchedModelPreset\?\.videoLibraryRootPath/u);
assert.match(avatarLayerSource, /randomVideoPlaybackEnabled: matchedModelPreset\?\.randomVideoPlaybackEnabled/u);
assert.match(companionLayerSource, /videoLibraryRootPath: matchedModelPreset\?\.videoLibraryRootPath/u);
assert.doesNotMatch(companionLayerSource, /videoItemBindings\?\.\[0\]/u);
assert.match(visualRouterSource, /emotionAction=\{expressionAction\}/u);
assert.match(importSource, /resolve2DVideoLibraryRoot/u);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-video-library-'));
(async () => {
  try {
    const libraryRoot = path.join(tempRoot, '角色A');
    const writeClip = (folder: string, name: string) => {
      fs.mkdirSync(path.join(libraryRoot, folder), { recursive: true });
      fs.writeFileSync(path.join(libraryRoot, folder, name), Buffer.from(`${folder}-${name}`));
    };
    writeClip('待机', 'a.webm');
    writeClip('待机', 'b.webm');
    writeClip('开心', 'c.webm');
    fs.mkdirSync(path.join(libraryRoot, '空文件夹'));
    const store = createSequenceAssetStore({ assetRootPath: tempRoot });

    const inspected = store.inspect2DVideoLibrary({ rootPath: libraryRoot });
    assert.equal(inspected.ok, true);
    assert.deepEqual(inspected.folders.map((folder: { name: string }) => folder.name).sort(), ['开心', '待机'].sort());

    const resolved = store.resolve2DVideoLibraryRootFromSource({
      sourcePath: path.join(libraryRoot, '待机', 'a.webm'),
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.rootPath, path.resolve(libraryRoot));

    const happy = await store.pick2DVideoFromLibrary({ folderNames: ['HAPPY-unused', '开心'], rootPath: libraryRoot });
    assert.equal(happy.ok, true);
    assert.equal(happy.folderName, '开心');
    assert.equal((await store.pick2DVideoFromLibrary({ folderNames: ['伤心'], rootPath: libraryRoot })).ok, false);

    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999;
      const idle = await store.pick2DVideoFromLibrary({ rootPath: libraryRoot });
      assert.equal(idle.ok, true);
      assert.ok(['开心', '待机'].includes(idle.folderName));
    } finally {
      Math.random = originalRandom;
    }
    assert.equal(store.inspect2DVideoLibrary({ rootPath: path.join(libraryRoot, '空文件夹') }).ok, false);
    console.log('video 2d library playback smoke passed');
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
