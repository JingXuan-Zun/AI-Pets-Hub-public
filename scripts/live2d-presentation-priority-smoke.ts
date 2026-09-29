import assert from 'node:assert/strict';
import {
  resolveLive2DExpressionPresentationTarget,
  resolveLive2DExpressionTransitionDelayMs,
} from '../src/pet-runtime/live2d/live2dPresentationPriority';
import { stopLive2DMotions } from '../src/components/pet/live2dModelRuntime';

const idle = resolveLive2DExpressionPresentationTarget({
  chatCandidates: [],
  chatExpressionKey: null,
  isDragging: false,
});
assert.equal(idle.source, 'idle');

const chat = resolveLive2DExpressionPresentationTarget({
  chatCandidates: ['happy'],
  chatExpressionKey: 'happy',
  isDragging: false,
});
assert.equal(chat.source, 'chat');
assert.deepEqual(chat.candidates, ['happy']);

const dragging = resolveLive2DExpressionPresentationTarget({
  chatCandidates: ['happy'],
  chatExpressionKey: 'happy',
  isDragging: true,
});
assert.equal(dragging.source, 'dragging');
assert.equal(resolveLive2DExpressionTransitionDelayMs({
  appliedAtMs: 0,
  nextSource: 'dragging',
  nowMs: 100,
  previousSource: 'chat',
}), 0);
assert.equal(resolveLive2DExpressionTransitionDelayMs({
  appliedAtMs: 100,
  nextSource: 'chat',
  nowMs: 200,
  previousSource: 'dragging',
}), 140);
assert.equal(resolveLive2DExpressionTransitionDelayMs({
  appliedAtMs: 100,
  nextSource: 'idle',
  nowMs: 300,
  previousSource: 'chat',
}), 400);

let stoppedMotionCount = 0;
stopLive2DMotions({
  internalModel: {
    motionManager: { stopAllMotions: () => { stoppedMotionCount += 1; } },
  },
} as never);
assert.equal(stoppedMotionCount, 1, 'dragging should be able to stop lower-priority motions');

console.log('live2d presentation priority smoke passed');
