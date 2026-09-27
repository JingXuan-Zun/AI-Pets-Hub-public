import assert from 'node:assert/strict';
import {
  resolveRuntimeWorldExpressionAction,
} from '../src/components/pet/useRuntimeWorldExpressionAction.ts';
import type { RuntimeWorldPresentationIntent } from '../src/runtime-world/index.ts';

function intent(
  emotion: RuntimeWorldPresentationIntent['emotion'],
): RuntimeWorldPresentationIntent {
  return {
    attention: 'user',
    behaviorKind: 'express-emotion',
    durationMs: 1_500,
    emotion,
    energy: 'normal',
    id: `intent:${emotion}`,
    mainState: 'idle',
    priority: 90,
    reasonEventId: 'event:1',
    sourceBehaviorRequestId: 'behavior:1',
    timestampMs: 100,
  };
}

assert.equal(resolveRuntimeWorldExpressionAction(intent('positive'), 800), 'HAPPY');
assert.equal(resolveRuntimeWorldExpressionAction(intent('concerned'), 800), 'SAD');
assert.equal(resolveRuntimeWorldExpressionAction(intent('neutral'), 800), null);
assert.equal(resolveRuntimeWorldExpressionAction(intent('positive'), 1_600), null);

console.log('runtime world expression action smoke passed');
