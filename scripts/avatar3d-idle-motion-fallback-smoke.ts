import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAnimatedAvatar3DRuntimeInstance } from '../src/pet-runtime/avatar3d/avatar3dAnimatedRuntimeInstance';
import { resolveAvatar3DMotionState } from '../src/pet-runtime/avatar3d/avatar3dMotionStateController';
import { resolvePetActionStateMachineSnapshot } from '../src/pet-runtime/core/petActionStateMachine';

function createVerticalMotionClip(name: string) {
  return new THREE.AnimationClip(name, 1, [
    new THREE.NumberKeyframeTrack(
      'hips.position[y]',
      [0, 0.5, 1],
      [0, 1, 0],
    ),
  ]);
}

function createRig() {
  const model = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'hips';
  model.add(hips);

  return {
    hips,
    model,
  };
}

function advanceFrames(
  update: NonNullable<ReturnType<typeof createAnimatedAvatar3DRuntimeInstance>['update']>,
  motionState: ReturnType<typeof resolveAvatar3DMotionState>,
  frames = 30,
) {
  for (let index = 0; index < frames; index += 1) {
    update(1 / 60, {
      motionState,
    });
  }
}

function createMotionState(
  options: {
    action?: Parameters<typeof resolvePetActionStateMachineSnapshot>[0]['action'];
    manualMotionSelection?: Parameters<typeof resolveAvatar3DMotionState>[0]['manualMotionSelection'];
    visualMode?: Parameters<typeof resolveAvatar3DMotionState>[0]['visualMode'];
  } = {},
) {
  return resolveAvatar3DMotionState({
    contentManifest: null,
    manualMotionSelection: options.manualMotionSelection,
    snapshot: resolvePetActionStateMachineSnapshot({
      action: options.action ?? 'IDLE',
      isMoving: options.action === 'WALKING',
    }),
    visualMode: options.visualMode ?? 'idle',
  });
}

const idleMotionState = createMotionState();

const idleRig = createRig();
const idleRuntime = createAnimatedAvatar3DRuntimeInstance({
  clips: [createVerticalMotionClip('jump_loop')],
  object: idleRig.model,
  sourceLabel: 'idle-fallback-probe',
});

advanceFrames(idleRuntime.update!, idleMotionState);

assert.equal(
  idleRig.hips.position.y,
  0,
  'idle state-machine motion should stay still when no idle/stand/wait clip matches instead of playing the first arbitrary clip',
);

const walkingRig = createRig();
const walkingRuntime = createAnimatedAvatar3DRuntimeInstance({
  clips: [createVerticalMotionClip('jump_loop')],
  object: walkingRig.model,
  sourceLabel: 'walking-fallback-probe',
});

advanceFrames(walkingRuntime.update!, createMotionState({
  action: 'WALKING',
  visualMode: 'walking',
}));

assert.equal(
  walkingRig.hips.position.y,
  0,
  'state-machine locomotion should not play the first arbitrary clip when walking/moving candidates do not match',
);

const namedIdleRig = createRig();
const namedIdleRuntime = createAnimatedAvatar3DRuntimeInstance({
  clips: [createVerticalMotionClip('idle')],
  object: namedIdleRig.model,
  sourceLabel: 'named-idle-probe',
});

advanceFrames(namedIdleRuntime.update!, idleMotionState);

assert.ok(
  namedIdleRig.hips.position.y > 0.8,
  `a real idle clip should still play when it matches the idle candidates, got y=${namedIdleRig.hips.position.y}`,
);

const manualNativeRig = createRig();
const manualNativeRuntime = createAnimatedAvatar3DRuntimeInstance({
  clips: [createVerticalMotionClip('jump_loop')],
  object: manualNativeRig.model,
  sourceLabel: 'manual-native-fallback-probe',
});

advanceFrames(manualNativeRuntime.update!, createMotionState({
  manualMotionSelection: {
    candidateClipNames: ['custom imported motion'],
    motionKey: 'happy',
    playbackMode: 'native',
  },
  visualMode: 'idle',
}));

assert.ok(
  manualNativeRig.hips.position.y > 0.8,
  `explicit native manual motion should still be allowed to play a single imported clip fallback, got y=${manualNativeRig.hips.position.y}`,
);

console.log('avatar3d idle motion fallback smoke ok');
