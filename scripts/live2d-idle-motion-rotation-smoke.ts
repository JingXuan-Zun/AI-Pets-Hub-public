import assert from 'node:assert/strict';
import {
  canRotateLive2DIdleMotion,
  resolveLive2DIdleMotionRotationDelayMs,
  rotateLive2DMotionCandidates,
} from '../src/components/pet/live2dIdleMotionRotation';
import { resolveLive2DAvailableMotionCandidateGroups } from '../src/components/pet/live2dMotionAvailability';

assert.deepEqual(
  rotateLive2DMotionCandidates(['idle-a', 'idle-b', 'idle-c'], 1),
  ['idle-b', 'idle-c', 'idle-a'],
);
assert.deepEqual(
  rotateLive2DMotionCandidates(['idle-a', 'idle-b', 'idle-c'], 2),
  ['idle-c', 'idle-a', 'idle-b'],
);
assert.deepEqual(
  rotateLive2DMotionCandidates(['idle-a', 'idle-b', 'idle-c'], -1),
  ['idle-c', 'idle-a', 'idle-b'],
);
assert.deepEqual(
  rotateLive2DMotionCandidates(['idle-a'], 3),
  ['idle-a'],
);

assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: 2,
  isMoving: false,
  manualMotionActive: false,
}), true);
assert.equal(canRotateLive2DIdleMotion({
  action: 'HAPPY',
  availableCandidateCount: 2,
  isMoving: false,
  manualMotionActive: false,
}), false);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: 2,
  isMoving: true,
  manualMotionActive: false,
}), false);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: 2,
  isMoving: false,
  manualMotionActive: true,
}), false);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: 1,
  isMoving: false,
  manualMotionActive: false,
}), false);

const aliasOnlyModel = {
  internalModel: {
    motionManager: {
      definitions: {
        Idle: [{ File: 'motions/Idle.motion3.json' }],
      },
    },
  },
};
const aliasOnlyCandidates = resolveLive2DAvailableMotionCandidateGroups(aliasOnlyModel, ['idle', 'Idle', 'IDLE']);
assert.deepEqual(aliasOnlyCandidates, ['Idle']);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: aliasOnlyCandidates.length,
  isMoving: false,
  manualMotionActive: false,
}), false);

const sameFileMultiGroupModel = {
  internalModel: {
    motionManager: {
      definitions: {
        'Idle Motion': [{ File: 'motions/Idle.motion3.json' }],
        Idle: [{ File: 'motions/Idle.motion3.json' }],
        idle: [{ File: 'motions/Idle.motion3.json' }],
      },
    },
  },
};
const sameFileCandidates = resolveLive2DAvailableMotionCandidateGroups(
  sameFileMultiGroupModel,
  ['Idle Motion', 'idle', 'Idle'],
);
assert.deepEqual(sameFileCandidates, ['Idle Motion']);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: sameFileCandidates.length,
  isMoving: false,
  manualMotionActive: false,
}), false);

const distinctFileModel = {
  internalModel: {
    motionManager: {
      definitions: {
        Idle: [{ File: 'motions/Idle.motion3.json' }],
        Idle2: [{ File: 'motions/Idle2.motion3.json' }],
      },
    },
  },
};
const distinctFileCandidates = resolveLive2DAvailableMotionCandidateGroups(distinctFileModel, ['idle', 'Idle', 'Idle2']);
assert.deepEqual(distinctFileCandidates, ['Idle', 'Idle2']);
assert.equal(canRotateLive2DIdleMotion({
  action: 'IDLE',
  availableCandidateCount: distinctFileCandidates.length,
  isMoving: false,
  manualMotionActive: false,
}), true);

const firstDelayMs = resolveLive2DIdleMotionRotationDelayMs('idle:Idle|Idle2|Idle3', 1);
const secondDelayMs = resolveLive2DIdleMotionRotationDelayMs('idle:Idle|Idle2|Idle3', 2);
assert.ok(firstDelayMs >= 8500 && firstDelayMs < 13000);
assert.ok(secondDelayMs >= 8500 && secondDelayMs < 13000);
assert.notEqual(firstDelayMs, secondDelayMs);

console.log('live2d idle motion rotation smoke passed');
