import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGenericAvatar3DLookAtFrameUpdater } from '../src/pet-runtime/avatar3d/avatar3dGenericLookAtController';
import { resolveNormalizedAvatar3DLookAtFocusTarget } from '../src/pet-runtime/avatar3d/avatar3dLookAtController';
import { resolvePetPointerLookStrength } from '../src/pet-runtime/interactions/petPointerLookPriority';

function createLookAtSkeleton() {
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

  return {
    head,
    model,
  };
}

function advanceLookAt(options: {
  frames?: number;
  pointerLookStrength?: number;
}) {
  const { head, model } = createLookAtSkeleton();
  const update = createGenericAvatar3DLookAtFrameUpdater(model);
  const frames = options.frames ?? 80;

  for (let index = 0; index < frames; index += 1) {
    update(1 / 60, {
      pointerLookStrength: options.pointerLookStrength,
      pointerLookTarget: { x: 28, y: -42 },
    });
  }

  return head.quaternion.angleTo(new THREE.Quaternion());
}

assert.equal(
  resolvePetPointerLookStrength({ action: 'IDLE', isMoving: false }),
  1,
  'idle pointer look should keep full strength',
);

assert.ok(
  resolvePetPointerLookStrength({ action: 'HAPPY' }) < 1,
  'non-idle emotion/action animation should damp pointer look without disabling it',
);

assert.equal(
  resolvePetPointerLookStrength({
    action: 'IDLE',
    manualMotionActive: true,
    manualMotionKey: 'idle',
    motionKey: 'idle',
  }),
  1,
  'manual or external idle motion is still the standby baseline and must not outrank pointer look',
);

assert.ok(
  resolvePetPointerLookStrength({ action: 'IDLE', manualMotionActive: true, manualMotionKey: 'happy' }) < 1,
  'non-idle manual motion should damp pointer look below standby tracking',
);

const fullStrengthHeadAngle = advanceLookAt({ pointerLookStrength: 1 });
const dampedHeadAngle = advanceLookAt({ pointerLookStrength: 0.25 });

assert.ok(fullStrengthHeadAngle > 0.36, `full-strength 3D pointer look should remain visible, got ${fullStrengthHeadAngle}`);
assert.ok(
  dampedHeadAngle > 0.08 && dampedHeadAngle < fullStrengthHeadAngle * 0.38,
  `damped 3D pointer look should become a weak additive overlay, got damped=${dampedHeadAngle} full=${fullStrengthHeadAngle}`,
);

const actionStrengthHeadAngle = advanceLookAt({
  pointerLookStrength: resolvePetPointerLookStrength({ action: 'HAPPY' }),
});

assert.ok(
  actionStrengthHeadAngle > fullStrengthHeadAngle * 0.5,
  `non-idle action damping should keep visible mouse tracking, got action=${actionStrengthHeadAngle} full=${fullStrengthHeadAngle}`,
);

const fullNormalizedTarget = resolveNormalizedAvatar3DLookAtFocusTarget({
  pointerLookStrength: 1,
  pointerLookTarget: { x: 0, y: -42 },
});
const dampedNormalizedTarget = resolveNormalizedAvatar3DLookAtFocusTarget({
  pointerLookStrength: 0.25,
  pointerLookTarget: { x: 0, y: -42 },
});

assert.ok(fullNormalizedTarget && dampedNormalizedTarget, 'VRM normalized pointer targets should exist');
assert.equal(fullNormalizedTarget.x, 0);
assert.equal(dampedNormalizedTarget.x, 0);
assert.ok(
  dampedNormalizedTarget.y > 0 && dampedNormalizedTarget.y < fullNormalizedTarget.y * 0.32,
  `VRM pointer look should damp after head-horizon normalization, got damped=${dampedNormalizedTarget.y} full=${fullNormalizedTarget.y}`,
);

console.log('pointer look priority smoke ok');
