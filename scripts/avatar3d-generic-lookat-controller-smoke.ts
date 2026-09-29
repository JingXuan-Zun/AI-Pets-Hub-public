import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createGenericAvatar3DLookAtDebugSummary,
  createGenericAvatar3DLookAtFrameUpdater,
  resolveGenericAvatar3DLookAtSmoothing,
} from '../src/pet-runtime/avatar3d/avatar3dGenericLookAtController';

function advanceFrames(
  update: ReturnType<typeof createGenericAvatar3DLookAtFrameUpdater>,
  frames: number,
  frameState: {
    focusTarget?: { x: number; y: number } | null;
    pointerLookTarget?: { x: number; y: number } | null;
  } = { pointerLookTarget: { x: 28, y: -42 } },
) {
  for (let index = 0; index < frames; index += 1) {
    update(1 / 60, frameState);
  }
}

const model = new THREE.Group();
const upperBody = new THREE.Bone();
upperBody.name = 'chest';
const neck = new THREE.Bone();
neck.name = 'neck';
const head = new THREE.Bone();
head.name = 'head';

upperBody.add(neck);
neck.add(head);
model.add(upperBody);

assert.deepEqual(
  createGenericAvatar3DLookAtDebugSummary(model),
  {
    targetCount: 3,
    targetNames: ['chest', 'neck', 'head'],
  },
  'generic 3D look-at should target MMD-style body, neck, and head bones',
);

const pointerSmoothing = resolveGenericAvatar3DLookAtSmoothing({
  pointerLookTarget: { x: 28, y: -42 },
});
const hoverFocusSmoothing = resolveGenericAvatar3DLookAtSmoothing({
  focusTarget: { x: -18, y: 22 },
  hoverState: {
    activeRegion: 'body',
    focusTarget: { x: -18, y: 22 },
    supportedRegions: ['head', 'body', 'handL', 'handR'],
  },
});
const focusFallbackSmoothing = resolveGenericAvatar3DLookAtSmoothing({
  focusTarget: { x: -18, y: 22 },
});
const returnSmoothing = resolveGenericAvatar3DLookAtSmoothing({});

assert.ok(
  pointerSmoothing > hoverFocusSmoothing && hoverFocusSmoothing > focusFallbackSmoothing,
  `generic 3D look-at should keep pointer fastest, hover next, focus fallback softest; got pointer=${pointerSmoothing} hover=${hoverFocusSmoothing} focus=${focusFallbackSmoothing}`,
);
assert.ok(
  returnSmoothing > focusFallbackSmoothing,
  `return smoothing should still settle faster than soft focus fallback, got return=${returnSmoothing} focus=${focusFallbackSmoothing}`,
);

const update = createGenericAvatar3DLookAtFrameUpdater(model);
advanceFrames(update, 80);

const modelAngle = model.quaternion.angleTo(new THREE.Quaternion());
const upperBodyAngle = upperBody.quaternion.angleTo(new THREE.Quaternion());
const neckAngle = neck.quaternion.angleTo(new THREE.Quaternion());
const headAngle = head.quaternion.angleTo(new THREE.Quaternion());
const upperBodyEuler = new THREE.Euler().setFromQuaternion(upperBody.quaternion, 'XYZ');
const neckEuler = new THREE.Euler().setFromQuaternion(neck.quaternion, 'XYZ');
const headEuler = new THREE.Euler().setFromQuaternion(head.quaternion, 'XYZ');

assert.equal(modelAngle, 0, 'skeletal look-at should not rotate the whole model root');
assert.ok(upperBodyAngle > 0.24, `upper body should visibly participate in pointer look-at, got ${upperBodyAngle}`);
assert.ok(neckAngle > upperBodyAngle, `neck should rotate more than upper body, got neck=${neckAngle} body=${upperBodyAngle}`);
assert.ok(headAngle > neckAngle, `head should rotate more than neck, got head=${headAngle} neck=${neckAngle}`);
assert.ok(headAngle > 0.36, `head look-at should stay visible after vertical comfort limiting, got ${headAngle}`);
assert.ok(headAngle < upperBodyAngle * 1.9, `head should not move alone without enough body follow, got head=${headAngle} body=${upperBodyAngle}`);
assert.ok(upperBodyEuler.y > 0, `right-side pointer should turn upper body toward positive local yaw, got ${upperBodyEuler.y}`);
assert.ok(neckEuler.y > upperBodyEuler.y, `neck yaw should follow farther than upper body, got neck=${neckEuler.y} body=${upperBodyEuler.y}`);
assert.ok(headEuler.y > neckEuler.y, `head yaw should follow farther than neck, got head=${headEuler.y} neck=${neckEuler.y}`);

const faceAreaModel = new THREE.Group();
const faceAreaUpperBody = new THREE.Bone();
faceAreaUpperBody.name = 'chest';
const faceAreaNeck = new THREE.Bone();
faceAreaNeck.name = 'neck';
const faceAreaHead = new THREE.Bone();
faceAreaHead.name = 'head';
faceAreaUpperBody.add(faceAreaNeck);
faceAreaNeck.add(faceAreaHead);
faceAreaModel.add(faceAreaUpperBody);

const faceAreaUpdate = createGenericAvatar3DLookAtFrameUpdater(faceAreaModel);
advanceFrames(faceAreaUpdate, 80, { pointerLookTarget: { x: 18, y: -24 } });
const faceAreaHeadEuler = new THREE.Euler().setFromQuaternion(faceAreaHead.quaternion, 'XYZ');

assert.ok(faceAreaHeadEuler.y > 0.2, `face-area pointer should still keep horizontal tracking, got ${faceAreaHeadEuler.y}`);
assert.ok(Math.abs(faceAreaHeadEuler.x) < 0.02, `head-horizon pointer should stay close to level pitch, got ${faceAreaHeadEuler.x}`);

const focusFallbackModel = new THREE.Group();
const focusFallbackUpperBody = new THREE.Bone();
focusFallbackUpperBody.name = 'chest';
const focusFallbackNeck = new THREE.Bone();
focusFallbackNeck.name = 'neck';
const focusFallbackHead = new THREE.Bone();
focusFallbackHead.name = 'head';
focusFallbackUpperBody.add(focusFallbackNeck);
focusFallbackNeck.add(focusFallbackHead);
focusFallbackModel.add(focusFallbackUpperBody);

const focusFallbackUpdate = createGenericAvatar3DLookAtFrameUpdater(focusFallbackModel);
advanceFrames(focusFallbackUpdate, 80, {
  focusTarget: { x: -18, y: 22 },
  pointerLookTarget: null,
});
const focusFallbackHeadEuler = new THREE.Euler().setFromQuaternion(focusFallbackHead.quaternion, 'XYZ');

assert.ok(focusFallbackHeadEuler.y < -0.2, `focus fallback should drive generic 3D horizontal look-at, got ${focusFallbackHeadEuler.y}`);
assert.ok(focusFallbackHeadEuler.x > 0.12, `focus fallback should drive generic 3D vertical look-at without head-horizon pointer normalization, got ${focusFallbackHeadEuler.x}`);

for (let index = 0; index < 120; index += 1) {
  update(1 / 60, {
    pointerLookTarget: null,
  });
}

assert.ok(head.quaternion.angleTo(new THREE.Quaternion()) < 0.02, 'head should settle close to rest after pointer leaves');
assert.ok(neck.quaternion.angleTo(new THREE.Quaternion()) < 0.02, 'neck should settle close to rest after pointer leaves');

console.log('avatar3d generic lookAt smoke ok');
