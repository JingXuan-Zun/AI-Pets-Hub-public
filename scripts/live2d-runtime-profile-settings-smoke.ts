import assert from 'node:assert/strict';
import {
  resolveLive2DRuntimeProfileEditorState,
  updateLive2DRuntimeProfileCapability,
  updateLive2DRuntimeProfileLayout,
  updateLive2DRuntimeProfileParameter,
} from '../src/components/settings/settingsLive2DRuntimeProfile';

const defaultState = resolveLive2DRuntimeProfileEditorState(null);
assert.equal(defaultState.fitMode, 'visible-overflow');
assert.equal(defaultState.scale, 1);
assert.equal(defaultState.offsetX, 0);
assert.equal(defaultState.offsetY, 0);
assert.equal(defaultState.canvasAnchorX, 0.5);
assert.equal(defaultState.canvasAnchorY, 0.52);
assert.equal(defaultState.visibleBoundsAnchorX, 0.5);
assert.equal(defaultState.visibleBoundsAnchorY, 0.5);
assert.equal(defaultState.capabilities.pointerLook, 'auto');
assert.deepEqual(defaultState.parameters.lookX, {
  enabled: true,
  id: '',
  invert: false,
  sensitivity: 1,
});

const layoutProfile = updateLive2DRuntimeProfileLayout(null, {
  canvasAnchorX: 0.44,
  canvasAnchorY: 0.61,
  fitMode: 'visible',
  offsetX: -0.12,
  offsetY: 0.18,
  scale: 1.35,
  visibleBoundsAnchorX: 0.46,
  visibleBoundsAnchorY: 0.72,
});
const parameterProfile = updateLive2DRuntimeProfileParameter(layoutProfile, 'lookX', {
  enabled: true,
  id: 'CustomLookX',
  invert: true,
  sensitivity: 0.72,
});
const configuredProfile = updateLive2DRuntimeProfileCapability(parameterProfile, 'bodySway', 'disabled');

assert.deepEqual(configuredProfile.layout, {
  canvasAnchorX: 0.44,
  canvasAnchorY: 0.61,
  fitMode: 'visible',
  offsetX: -0.12,
  offsetY: 0.18,
  scale: 1.35,
  visibleBoundsAnchorX: 0.46,
  visibleBoundsAnchorY: 0.72,
});
assert.equal(configuredProfile.parameters?.lookX?.sensitivity, 0.72);
assert.equal(configuredProfile.parameters?.lookX?.id, 'CustomLookX');
assert.equal(configuredProfile.parameters?.lookX?.invert, true);
assert.equal(configuredProfile.capabilities?.bodySway, false);

const restoredAutomaticProfile = updateLive2DRuntimeProfileCapability(
  configuredProfile,
  'bodySway',
  'auto',
);
assert.equal(restoredAutomaticProfile.capabilities?.bodySway, undefined);
assert.equal(restoredAutomaticProfile.layout?.scale, 1.35);
assert.equal(restoredAutomaticProfile.parameters?.lookX?.sensitivity, 0.72);

const normalizedState = resolveLive2DRuntimeProfileEditorState({
  layout: {
    offsetX: 99,
    scale: 0,
  },
  parameters: {
    lookY: {
      sensitivity: 99,
    },
  },
  profileVersion: 1,
});
assert.equal(normalizedState.offsetX, 2);
assert.equal(normalizedState.scale, 0.1);
assert.equal(normalizedState.parameters.lookY.sensitivity, 4);

console.log('live2d runtime profile settings smoke passed');
