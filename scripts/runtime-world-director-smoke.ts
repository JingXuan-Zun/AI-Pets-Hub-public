import assert from 'node:assert/strict';
import {
  createRuntimeWorldDirector,
  createRuntimeWorldState,
  type RuntimeWorldBehaviorRequest,
} from '../src/runtime-world/index.ts';

function request(
  id: string,
  kind: RuntimeWorldBehaviorRequest['kind'],
  priority: number,
  timestampMs: number,
): RuntimeWorldBehaviorRequest {
  return {
    id,
    kind,
    priority,
    reasonEventId: `event:${id}`,
    timestampMs,
  };
}

const director = createRuntimeWorldDirector();
const thinkingState = { ...createRuntimeWorldState(), mainState: 'thinking' as const };
const listeningState = { ...createRuntimeWorldState(), mainState: 'listening' as const };
const idleState = { ...createRuntimeWorldState(), mainState: 'idle' as const };

const started = director.direct({
  behaviorRequests: [request('start', 'idle-think', 6, 100)],
  state: thinkingState,
  timestampMs: 100,
});
assert.equal(started.intent?.attention, 'task');
assert.equal(started.intent?.emotion, 'neutral');
assert.equal(started.intent?.behaviorKind, 'idle-think');

const repeatedThinking = director.direct({
  behaviorRequests: [request('progress', 'idle-think', 5, 900)],
  state: thinkingState,
  timestampMs: 900,
});
assert.equal(repeatedThinking.intent, null);
assert.deepEqual(repeatedThinking.suppressedBehaviorRequestIds, ['progress']);

const approval = director.direct({
  behaviorRequests: [request('approval', 'look-at-user', 8, 1_100)],
  state: listeningState,
  timestampMs: 1_100,
});
assert.equal(approval.intent?.attention, 'user');
assert.equal(approval.intent?.behaviorKind, 'look-at-user');

const completed = director.direct({
  behaviorRequests: [request('completed', 'express-emotion', 7, 1_300)],
  state: idleState,
  timestampMs: 1_300,
});
assert.equal(completed.intent?.behaviorKind, 'express-emotion');
assert.equal(completed.intent?.emotion, 'positive');

const failed = director.direct({
  behaviorRequests: [request('failed', 'react', 7, 1_500)],
  state: idleState,
  timestampMs: 1_500,
});
assert.equal(failed.intent?.behaviorKind, 'react');
assert.equal(failed.intent?.emotion, 'concerned');

const repeatedFailure = director.direct({
  behaviorRequests: [request('failed-again', 'react', 7, 1_700)],
  state: idleState,
  timestampMs: 1_700,
});
assert.equal(repeatedFailure.intent, null);
assert.deepEqual(repeatedFailure.suppressedBehaviorRequestIds, ['failed-again']);

console.log('runtime world director smoke passed');
