import assert from 'node:assert/strict';

import {
  createAgentTaskRuntimeModelLoopState,
  decideAgentTaskRuntimeLoopContinuation,
  selectAgentTaskRuntimeNextTransition,
  transitionAgentTaskRuntimeModelLoop,
  type AgentTaskRuntimeNextSubgoalAction,
} from '../src/agent/index.ts';

function select(nextSubgoalAction: AgentTaskRuntimeNextSubgoalAction | null) {
  return selectAgentTaskRuntimeNextTransition({
    taskState: nextSubgoalAction ? { nextSubgoalAction } : null,
  });
}

assert.deepEqual(select('execute'), {
  kind: 'target-resolution',
  reason: 'Task Runtime selected target resolution for the next pending subgoal.',
});
assert.deepEqual(select('verify'), {
  kind: 'verification',
  reason: 'Task Runtime selected post-dispatch verification.',
});
assert.equal(select('await_approval').kind, 'approval');
assert.equal(select('blocked').kind, 'blocked');
assert.equal(select('complete').kind, 'complete');
assert.equal(select('resume').kind, 'resume');
assert.equal(select(null).kind, 'compatibility');

assert.equal(decideAgentTaskRuntimeLoopContinuation({
  dispatch: {
    adapterKind: 'terminal',
    executed: true,
    finalResult: 'done',
  },
}).action, 'return-final');
assert.equal(decideAgentTaskRuntimeLoopContinuation({
  dispatch: {
    adapterKind: 'recovery',
    executed: true,
    finalResult: null,
  },
}).action, 'continue-runtime');
assert.equal(decideAgentTaskRuntimeLoopContinuation({
  dispatch: {
    adapterKind: 'planning',
    executed: false,
    finalResult: null,
  },
}).action, 'request-planning');

let modelLoop = createAgentTaskRuntimeModelLoopState({ maxIterations: 2 });
let modelLoopDecision = transitionAgentTaskRuntimeModelLoop(modelLoop, {
  cancellationRequested: false,
  type: 'iteration-check',
});
assert.equal(modelLoopDecision.action, 'run-iteration');
assert.equal(modelLoopDecision.iteration, 1);
modelLoop = modelLoopDecision.state;
modelLoopDecision = transitionAgentTaskRuntimeModelLoop(modelLoop, {
  cancellationRequested: false,
  type: 'iteration-check',
});
assert.equal(modelLoopDecision.action, 'run-iteration');
assert.equal(modelLoopDecision.iteration, 2);
modelLoop = modelLoopDecision.state;
assert.equal(transitionAgentTaskRuntimeModelLoop(modelLoop, {
  cancellationRequested: false,
  type: 'iteration-check',
}).action, 'stop-limit');
assert.equal(transitionAgentTaskRuntimeModelLoop(
  createAgentTaskRuntimeModelLoopState({ maxIterations: 2 }),
  { cancellationRequested: true, type: 'iteration-check' },
).action, 'stop-cancelled');

console.log('agent task runtime transition selection smoke ok');
