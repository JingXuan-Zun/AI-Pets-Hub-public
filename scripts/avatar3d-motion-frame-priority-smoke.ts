import assert from 'node:assert/strict';
import {
  shouldPrioritizeAvatar3DMotionPlayback,
  type Avatar3DMotionState,
} from '../src/pet-runtime/avatar3d/avatar3dMotionStateController';

const createMotionState = (
  overrides: Partial<Pick<Avatar3DMotionState, 'mode' | 'motionKey' | 'source'>> = {},
) => ({
  mode: overrides.mode ?? 'preserve',
  motionKey: overrides.motionKey ?? 'idle',
  source: overrides.source ?? 'state-machine',
});

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: true,
    motionState: createMotionState(),
    runtimeSleeping: false,
  }),
  true,
  'manual 3D motion playback should temporarily receive full-rate bone updates',
);

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: false,
    motionState: createMotionState({ mode: 'replace', motionKey: 'happy' }),
    runtimeSleeping: false,
  }),
  true,
  'replace-mode motion overrides should temporarily receive full-rate bone updates',
);

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: false,
    motionState: createMotionState({ source: 'message', motionKey: 'happy' }),
    runtimeSleeping: false,
  }),
  true,
  'message and Agent motion sources should temporarily receive full-rate bone updates',
);

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: false,
    motionState: createMotionState({ motionKey: 'happy' }),
    runtimeSleeping: false,
  }),
  true,
  'non-idle state-machine motions should receive full-rate bone updates while playing',
);

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: false,
    motionState: createMotionState(),
    runtimeSleeping: false,
  }),
  false,
  'idle state-machine playback should retain the existing complexity throttling policy',
);

assert.equal(
  shouldPrioritizeAvatar3DMotionPlayback({
    manualMotionActive: true,
    motionState: createMotionState({ mode: 'replace', source: 'manual', motionKey: 'happy' }),
    runtimeSleeping: true,
  }),
  false,
  'sleeping runtimes must not be woken solely to prioritize motion playback',
);

console.log('avatar3d motion frame priority smoke passed');
