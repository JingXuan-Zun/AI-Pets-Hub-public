import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { runnerSource, adapterSource } = readProjectSources({
  runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  adapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
});

assert.match(runnerSource, /createAgentSessionV3ExperimentalChatFinalAnswer/u);
assert.match(runnerSource, /runtime\.runtime\.state\.phase === 'recover'/u);
assert.match(runnerSource, /runtime\.runtime\.state\.lastEvent === 'command-unavailable'/u);
assert.match(runnerSource, /return 'needs-user';/u);
assert.match(runnerSource, /Agent v3 runtime could not safely prepare that command/u);
assert.match(adapterSource, /Experimental v3 parallel tool_calls can only run silent read-only tools/u);

let executorCalled = false;
const result = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Unsafe mixed batch should stop cleanly.',
    tools: [
      {
        args: {
          action: 'get_cursor_position',
        },
        reason: 'read-only',
        tool: 'execute_desktop_observation',
      },
      {
        args: {
          action: 'click',
          x: 3,
          y: 4,
        },
        reason: 'requires approval and must not run in parallel',
        tool: 'execute_desktop_input',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 recovery parity smoke',
  toolExecutor: async () => {
    executorCalled = true;
    throw new Error('unavailable v3 command should not execute tools');
  },
  userGoal: 'Reject unsafe mixed parallel batch cleanly',
});

assert.equal(result.status, 'needs-user');
assert.equal(result.toolResults.length, 0);
assert.equal(result.pendingApproval, null);
assert.equal(executorCalled, false);
assert.match(result.finalAnswer, /Agent v3 runtime could not safely prepare that command/u);
assert.match(result.finalAnswer, /not silent read-only|parallel tool_calls can only run silent read-only/u);
assert.doesNotMatch(result.finalAnswer, /No experimental v3 adapter is configured for phase recover/u);
assert.equal(result.continuation.steps.some((step) => step.action === 'tool_calls'), true);

for (const [label, source] of [
  ['v3 chat runner', runnerSource],
  ['v3 v2 adapter', adapterSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool queues, report order, or recovery actions.`,
  );
}

console.log('agent session v3 experimental recovery evaluation parity smoke ok');
