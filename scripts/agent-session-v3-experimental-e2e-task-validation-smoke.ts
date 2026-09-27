import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  runAgentSessionV3ExperimentalFeatureFlagRoute,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  runnerSource,
  adapterSource,
  routeSource,
  constantsSource,
  containerSource,
  controllerSource,
} = readProjectSources({
  runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  adapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
  routeSource: 'src/agent/agentSessionV3ExperimentalFeatureFlag.ts',
  constantsSource: 'src/constants.ts',
  containerSource: 'src/components/pet/usePetContainerPanelChatState.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
});

assert.match(routeSource, /route: 'v2-default'/u);
assert.match(routeSource, /route: 'v3-experimental'/u);
assert.match(constantsSource, /agentRuntimeMode: 'v3-experimental'/u);
assert.match(containerSource, /config\.settings\.agentRuntimeMode === 'v3-experimental'/u);
assert.match(
  controllerSource,
  /mode: agentRuntimeMode \?\? preparedRequest\.currentConfig\.settings\.agentRuntimeMode \?\? 'v2-default'/u,
);
assert.match(controllerSource, /runAgentSessionV3ExperimentalFeatureFlagRoute/u);
assert.match(runnerSource, /approvedToolResult/u);
assert.match(runnerSource, /parallelToolResults/u);
assert.match(runnerSource, /createAgentSessionV3ExperimentalChatFinalAnswer/u);
assert.match(adapterSource, /kind: 'parallel-tool-transaction'/u);

let v2RunCount = 0;
let v3RunCount = 0;
const defaultRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-default' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3-experimental' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(defaultRoute.decision.route, 'v2-default');
assert.deepEqual(defaultRoute.result, { runtime: 'v2-default' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 0);

const explicitRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3-experimental' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(explicitRoute.decision.route, 'v3-experimental');
assert.deepEqual(explicitRoute.result, { runtime: 'v3-experimental' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 1);

const singleCommands: AgentChatCommand[] = [];
const singleResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_cursor_position',
    },
    reason: 'Need one read-only observation.',
    tool: 'execute_desktop_observation',
  }),
  settings: {},
  sourceText: '/agent v3 e2e single',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    singleCommands.push(command);
    return {
      ok: true,
      responseText: 'Cursor position observed.',
      verification: 'Single read-only observation verified.',
    };
  },
  userGoal: 'Observe cursor position',
});
assert.equal(singleResult.status, 'completed');
assert.equal(singleResult.pendingApproval, null);
assert.equal(singleResult.toolResults.length, 1);
assert.equal(singleCommands.length, 1);
assert.equal(singleResult.continuation.toolResults.length, 1);

const parallelCommands: AgentChatCommand[] = [];
const parallelResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Need independent read-only observations.',
    tools: [
      {
        args: {
          action: 'get_cursor_position',
        },
        reason: 'Cursor position is independent.',
        tool: 'execute_desktop_observation',
      },
      {
        args: {
          action: 'get_display_info',
        },
        reason: 'Display info is independent.',
        tool: 'execute_desktop_observation',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 e2e parallel',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    parallelCommands.push(command);
    return {
      ok: true,
      responseText: `Observed ${command.toolCall?.input?.action ?? command.toolCall?.name ?? command.kind}.`,
      verification: 'Parallel read-only observation verified.',
    };
  },
  userGoal: 'Run two read-only observations',
});
assert.equal(parallelResult.status, 'needs-user');
assert.equal(parallelResult.toolResults.length, 2);
assert.equal(parallelCommands.length, 2);
assert.equal(parallelResult.steps.filter((step) => step.action === 'tool_result').length, 2);
assert.match(parallelResult.finalAnswer, /Switch back to v2 fallback|v2 fallback should continue the task/u);

let approvalExecutorCalledBeforeApproval = false;
const approvalRequest = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      x: 11,
      y: 12,
    },
    reason: 'Click requires approval.',
    tool: 'execute_desktop_input',
  }),
  settings: {},
  sourceText: '/agent v3 e2e approval',
  toolExecutor: async () => {
    approvalExecutorCalledBeforeApproval = true;
    throw new Error('approval-required command must not execute before approval');
  },
  userGoal: 'Click after approval',
});
assert.equal(approvalRequest.status, 'needs-approval');
assert.equal(approvalRequest.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');
assert.equal(approvalRequest.toolResults.length, 0);
assert.equal(approvalExecutorCalledBeforeApproval, false);

let approvalContinuationModelCalled = false;
let approvalContinuationExecutorCalled = false;
const approvedResult = await runAgentSessionV3ExperimentalChatRunner({
  approvedToolResult: {
    command: approvalRequest.pendingApproval!.command,
    result: {
      ok: true,
      responseText: 'Approved click completed.',
      verification: 'Approved click verified.',
    },
  },
  continuation: approvalRequest.continuation,
  modelCaller: async () => {
    approvalContinuationModelCalled = true;
    throw new Error('approved continuation should not request a new model decision first');
  },
  settings: {},
  sourceText: approvalRequest.sourceText,
  toolExecutor: async () => {
    approvalContinuationExecutorCalled = true;
    throw new Error('approved continuation should not execute the approved result twice');
  },
  userGoal: approvalRequest.continuation.userGoal,
});
assert.equal(approvedResult.status, 'completed');
assert.equal(approvedResult.toolResults.length, 1);
assert.equal(approvedResult.toolResults[0]?.result.responseText, 'Approved click completed.');
assert.equal(approvalContinuationModelCalled, false);
assert.equal(approvalContinuationExecutorCalled, false);

let unavailableExecutorCalled = false;
const unavailableResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Unsafe mixed batch should be rejected cleanly.',
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
          x: 21,
          y: 22,
        },
        reason: 'not silent read-only',
        tool: 'execute_desktop_input',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 e2e unavailable',
  toolExecutor: async () => {
    unavailableExecutorCalled = true;
    throw new Error('unavailable mixed batch should not execute tools');
  },
  userGoal: 'Reject unsafe mixed parallel batch',
});
assert.equal(unavailableResult.status, 'needs-user');
assert.equal(unavailableResult.toolResults.length, 0);
assert.equal(unavailableExecutorCalled, false);
assert.match(unavailableResult.finalAnswer, /Agent v3 runtime could not safely prepare that command/u);
assert.doesNotMatch(unavailableResult.finalAnswer, /No experimental v3 adapter is configured for phase recover/u);

for (const [label, source] of [
  ['v3 chat runner', runnerSource],
  ['v3 v2 adapter', adapterSource],
  ['feature flag route', routeSource],
  ['chat container', containerSource],
  ['agent run controller', controllerSource],
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

console.log('agent session v3 experimental e2e task validation smoke ok');
