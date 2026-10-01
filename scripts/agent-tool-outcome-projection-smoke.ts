import assert from 'node:assert/strict';
import {
  runAgentToolTransaction,
} from '../src/agent/runtime/agentToolTransactionExecutor.ts';
import type {
  AgentChatCommand,
  AgentChatCommandResult,
} from '../src/agent/agentChatCommand.ts';

const command: AgentChatCommand = {
  instruction: 'Outcome projection smoke',
  kind: 'tool-call',
  sourceText: '/agent outcome projection smoke',
  toolCall: {
    input: {},
    name: 'execute_desktop_action',
  },
};

function run(result: AgentChatCommandResult) {
  return runAgentToolTransaction({
    appendTraceEvent: () => undefined,
    command,
    executeCommand: async () => result,
    getTimingDetail: () => 'smoke',
    resolveTimingStatus: (value) => value.ok === false ? 'failed' : 'success',
    stepIndex: 1,
    timingTracker: {
      beginEntry: () => ({ id: 'timing', kind: 'tool', label: 'smoke', startedAt: 1, status: 'running', stepIndex: 1 }),
      finishEntry: (entry, status) => ({ ...entry, status }),
    },
  });
}

const uncertain = await run({ ok: true, responseText: 'Action dispatched.' });
assert.equal(uncertain.outcome?.classification, 'failure');
assert.equal(uncertain.outcome?.uncertainEffects, true);
assert.equal(uncertain.outcome?.retryPolicy, 'halt');

const verified = await run({
  ok: true,
  receipt: { status: 'success', summaryLines: [], title: 'Action complete' },
  responseText: 'Action complete.',
});
assert.equal(verified.outcome?.classification, 'success');
assert.equal(verified.outcome?.retryPolicy, 'safe');

const blocked = await run({
  ok: false,
  receipt: { status: 'blocked', summaryLines: [], title: 'Action blocked' },
  responseText: '',
});
assert.equal(blocked.outcome?.execution, 'blocked');
assert.equal(blocked.outcome?.classification, 'failure');
assert.equal(blocked.outcome?.uncertainEffects, false);

console.log('agent tool outcome projection smoke ok');
