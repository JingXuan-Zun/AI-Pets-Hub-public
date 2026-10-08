import { strict as assert } from 'node:assert';
import { resolveVideo2DVisualBounds } from '../src/components/pet/video2dVisualBounds.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  playbackQueueSource,
  importSource,
  ipcSource,
  rendererSource,
  settingsSource,
  settingsShellSource,
  storeSource,
  visualRouterSource,
  visualRendererSurfaceSource,
  normalizationSource,
} = readProjectSources({
  playbackQueueSource: 'src/pet-runtime/video2d/useVideo2DPlaybackQueue.ts',
  importSource: 'src/components/settings/useSettingsPanelModelAssetsState.ts',
  ipcSource: 'electron/ipcHandlers.cjs',
  rendererSource: 'src/components/pet/PetVideo2DRenderer.tsx',
  settingsSource: 'src/components/settings/SettingsModelTab.tsx',
  settingsShellSource: 'src/components/settings/SettingsPanelStandaloneShell.tsx',
  storeSource: 'electron/sequenceAssetStore.cjs',
  visualRouterSource: 'src/components/pet/PetVisualRenderer.tsx',
  visualRendererSurfaceSource: 'src/components/pet/petVisualRendererSurface.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
});

assert.match(settingsSource, /\.webm/u);
assert.match(settingsSource, /透明 WebM/u);
assert.match(importSource, /stage2DVideo/u);
assert.match(importSource, /renderKind: .*'video'/u);
assert.match(importSource, /需要在桌面版导入/u);
assert.match(storeSource, /stage2DVideo/u);
assert.match(storeSource, /sha256/u);
assert.match(ipcSource, /stage-2d-video/u);
assert.match(visualRouterSource, /resolvedRenderKind === 'video'/u);
assert.match(normalizationSource, /VIDEO_MODEL_URL_PATTERN/u);
assert.match(normalizationSource, /VIDEO_MODEL_URL_PATTERN\.test\(normalizedUrl\)/u);
assert.match(rendererSource, /<video/u);
assert.match(visualRouterSource, /resolvedRenderKind/u);
assert.match(playbackQueueSource, /video pet playback failed/u);
assert.match(rendererSource, /useVideo2DPlaybackQueue/u);
assert.match(visualRouterSource, /<img/u);
assert.match(rendererSource, /muted/u);
assert.match(rendererSource, /loop/u);
assert.match(rendererSource, /faceDirection/u);
assert.match(rendererSource, /modelUrl/u);
assert.match(settingsShellSource, /renderKind=\{selectedModelPreset\?\.renderKind\}/u);
assert.match(rendererSource, /pointer-events-none/u);
assert.match(rendererSource, /resolveVideo2DVisualBounds/u);
assert.match(rendererSource, /loadedmetadata/u);
assert.match(rendererSource, /ResizeObserver/u);
assert.match(visualRendererSurfaceSource, /videoHalfExtent/u);
assert.match(visualRouterSource, /resolvedRenderKind === 'video'/u);

assert.deepEqual(resolveVideo2DVisualBounds({
  containerRect: { height: 256, left: 0, top: 0, width: 256 },
  sourceHeight: 640,
  sourceWidth: 360,
  videoRect: { height: 256, left: 0, top: 0, width: 256 },
}), {
  bottom: 128,
  left: 72,
  right: 72,
  top: 128,
});

assert.deepEqual(resolveVideo2DVisualBounds({
  containerRect: { height: 256, left: 0, top: 0, width: 256 },
  sourceHeight: 360,
  sourceWidth: 640,
  videoRect: { height: 256, left: 0, top: 0, width: 256 },
}), {
  bottom: 72,
  left: 128,
  right: 128,
  top: 72,
});

console.log('video 2d rendering wiring smoke passed');
