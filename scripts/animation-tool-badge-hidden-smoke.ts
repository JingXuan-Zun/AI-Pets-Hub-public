import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const panelsLayerSource = readProjectFile('src/components/pet/PetPanelsLayer.tsx');

assert.ok(
  !/AnimationToolAudioPlaybackBadge/u.test(panelsLayerSource),
  'animation/audio playback status badge should not be mounted in the desktop pet panels layer',
);

assert.ok(
  !/audioPlaybackBadgePosition/u.test(panelsLayerSource),
  'desktop pet panels layer should not reserve position for the removed animation/audio playback badge',
);

console.log('animation tool badge hidden smoke ok');
