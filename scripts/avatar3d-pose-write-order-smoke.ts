import assert from 'node:assert/strict';
import * as THREE from 'three';
import { type VRM } from '@pixiv/three-vrm';
import { createAnimatedAvatar3DRuntimeInstance } from '../src/pet-runtime/avatar3d/avatar3dAnimatedRuntimeInstance';
import { createGenericAvatar3DLookAtFrameUpdater } from '../src/pet-runtime/avatar3d/avatar3dGenericLookAtController';
import { createVRMRuntimeFrameUpdater } from '../src/pet-runtime/avatar3d/avatar3dVRMReactionRuntime';

const BASE_ANIMATION_YAW = -0.8;
const POINTER_LOOK_TARGET = { x: 28, y: -42 };

function createHeadRig() {
  const model = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'head';
  model.add(head);

  return {
    head,
    model,
  };
}

function setHeadYaw(head: THREE.Object3D, yaw: number) {
  head.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'XYZ'));
}

function readHeadYaw(head: THREE.Object3D) {
  return new THREE.Euler().setFromQuaternion(head.quaternion, 'XYZ').y;
}

function createConstantHeadYawClip() {
  const headQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, BASE_ANIMATION_YAW, 0, 'XYZ'),
  );

  return new THREE.AnimationClip('idle', 1, [
    new THREE.QuaternionKeyframeTrack(
      'head.quaternion',
      [0, 1],
      [
        headQuaternion.x,
        headQuaternion.y,
        headQuaternion.z,
        headQuaternion.w,
        headQuaternion.x,
        headQuaternion.y,
        headQuaternion.z,
        headQuaternion.w,
      ],
    ),
  ]);
}

function advanceFrames(
  update: (delta: number, frameState?: { pointerLookTarget?: { x: number; y: number } | null }) => void,
  frames: number,
  pointerLookTarget: { x: number; y: number } | null,
) {
  for (let index = 0; index < frames; index += 1) {
    update(1 / 60, {
      pointerLookTarget,
    });
  }
}

const animatedRig = createHeadRig();
const animatedRuntime = createAnimatedAvatar3DRuntimeInstance({
  clips: [createConstantHeadYawClip()],
  object: animatedRig.model,
  sourceLabel: 'animated-order-probe',
  update: createGenericAvatar3DLookAtFrameUpdater(animatedRig.model),
});

advanceFrames(animatedRuntime.update!, 80, POINTER_LOOK_TARGET);
const animatedYawWithLookAt = readHeadYaw(animatedRig.head);

assert.ok(
  animatedYawWithLookAt > BASE_ANIMATION_YAW + 0.18,
  `animated runtime look-at should be applied after mixer pose, got yaw=${animatedYawWithLookAt}`,
);
assert.ok(
  animatedYawWithLookAt < -0.05,
  `animated runtime look-at should remain an overlay on top of the motion pose, got yaw=${animatedYawWithLookAt}`,
);

advanceFrames(animatedRuntime.update!, 120, null);
const animatedYawAfterReturn = readHeadYaw(animatedRig.head);

assert.ok(
  Math.abs(animatedYawAfterReturn - BASE_ANIMATION_YAW) < 0.04,
  `animated runtime look-at should return to the active motion pose, got yaw=${animatedYawAfterReturn}`,
);

const vrmRig = createHeadRig();
const fakeVrm = {
  scene: vrmRig.model,
  update: () => {
    setHeadYaw(vrmRig.head, BASE_ANIMATION_YAW);
  },
} as unknown as VRM;
const vrmUpdate = createVRMRuntimeFrameUpdater(fakeVrm);

advanceFrames(vrmUpdate, 80, POINTER_LOOK_TARGET);
const vrmYawWithLookAt = readHeadYaw(vrmRig.head);

assert.ok(
  vrmYawWithLookAt > BASE_ANIMATION_YAW + 0.18,
  `VRM runtime generic look-at overlay should be applied after vrm.update, got yaw=${vrmYawWithLookAt}`,
);
assert.ok(
  vrmYawWithLookAt < -0.05,
  `VRM runtime look-at should remain an overlay on top of the VRM pose, got yaw=${vrmYawWithLookAt}`,
);

advanceFrames(vrmUpdate, 120, null);
const vrmYawAfterReturn = readHeadYaw(vrmRig.head);

assert.ok(
  Math.abs(vrmYawAfterReturn - BASE_ANIMATION_YAW) < 0.04,
  `VRM runtime look-at should return to the current VRM pose, got yaw=${vrmYawAfterReturn}`,
);

console.log('avatar3d pose write order smoke ok');
