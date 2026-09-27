import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  runAgentSessionV3ExperimentalFeatureFlagRoute,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  constantsSource,
  controllerSource,
  containerSource,
  settingsSource,
  runnerSource,
  adapterSource,
} = readProjectSources({
  constantsSource: 'src/constants.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  containerSource: 'src/components/pet/usePetContainerPanelChatState.ts',
  settingsSource: 'src/components/settings/SettingsSystemTab.tsx',
  runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  adapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
});

assert.doesNotMatch(constantsSource, /agentRuntimeMode/u);
assert.doesNotMatch(controllerSource, /agentRuntimeMode|createAgentRuntimeLegacyVersionAdapter/u);
assert.match(controllerSource, /createAgentRuntimeProductionAdapter/u);
assert.doesNotMatch(containerSource, /agentRuntimeMode|runAgentSessionV3Experimental/u);
assert.doesNotMatch(settingsSource, /v3 staged default|v2 fallback|agentRuntimeMode/u);
assert.match(runnerSource, /Agent v3 runtime could not safely prepare that command/u);

let routeV2Count = 0;
let routeV3Count = 0;
const configuredDefaultRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    routeV2Count += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: async () => {
    routeV3Count += 1;
    return { runtime: 'v3-staged-default' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(configuredDefaultRoute.decision.route, 'v3-experimental');
assert.deepEqual(configuredDefaultRoute.result, { runtime: 'v3-staged-default' });
assert.equal(routeV2Count, 0);
assert.equal(routeV3Count, 1);

const explicitV2Route = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v2-default',
  runV2: async () => {
    routeV2Count += 1;
    return { runtime: 'v2-explicit' as const };
  },
  runV3Experimental: async () => {
    routeV3Count += 1;
    return { runtime: 'v3-should-not-run' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(explicitV2Route.decision.route, 'v2-default');
assert.deepEqual(explicitV2Route.result, { runtime: 'v2-explicit' });
assert.equal(routeV2Count, 1);
assert.equal(routeV3Count, 1);

const missingRunnerFallback = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    routeV2Count += 1;
    return { runtime: 'v2-missing-runner-fallback' as const };
  },
  runV3Experimental: null,
  v3ExperimentalAvailable: true,
  v3UnavailableReason: 'staged v3 runner not injected',
});
assert.equal(missingRunnerFallback.decision.route, 'v2-fallback');
assert.deepEqual(missingRunnerFallback.result, { runtime: 'v2-missing-runner-fallback' });
assert.equal(routeV2Count, 2);
assert.equal(routeV3Count, 1);

const defaultReadOnlyCommands: AgentChatCommand[] = [];
const defaultReadOnlyResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_cursor_position',
    },
    reason: 'Staged default should run a simple read-only observation.',
    tool: 'execute_desktop_observation',
  }),
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: '/agent staged default read-only soak',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    defaultReadOnlyCommands.push(command);
    return {
      ok: true,
      responseText: 'Staged default read-only observation completed.',
      verification: 'Staged default read-only observation verified.',
    };
  },
  userGoal: 'Observe cursor position through staged default v3',
});
assert.equal(defaultReadOnlyResult.status, 'completed');
assert.equal(defaultReadOnlyResult.pendingApproval, null);
assert.equal(defaultReadOnlyResult.toolResults.length, 1);
assert.equal(defaultReadOnlyCommands.length, 1);

let approvalPreExecutionCalled = false;
const approvalRequest = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      x: 31,
      y: 32,
    },
    reason: 'Staged default should pause mutating desktop input for approval.',
    tool: 'execute_desktop_input',
  }),
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: '/agent staged default approval soak',
  toolExecutor: async () => {
    approvalPreExecutionCalled = true;
    throw new Error('mutating approval command must not execute before approval');
  },
  userGoal: 'Click only after approval through staged default v3',
});
assert.equal(approvalRequest.status, 'needs-approval');
assert.equal(approvalRequest.toolResults.length, 0);
assert.equal(approvalPreExecutionCalled, false);
assert.equal(approvalRequest.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');

let approvalResumeModelCalled = false;
let approvalResumeExecutorCalled = false;
const approvalResume = await runAgentSessionV3ExperimentalChatRunner({
  approvedToolResult: {
    command: approvalRequest.pendingApproval!.command,
    result: {
      ok: true,
      responseText: 'Approved staged default click completed.',
      verification: 'Approved staged default click verified.',
    },
  },
  continuation: approvalRequest.continuation,
  modelCaller: async () => {
    approvalResumeModelCalled = true;
    throw new Error('approval resume should not request a new model decision before evaluation');
  },
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: approvalRequest.sourceText,
  toolExecutor: async () => {
    approvalResumeExecutorCalled = true;
    throw new Error('approval resume should not execute the approved result twice');
  },
  userGoal: approvalRequest.continuation.userGoal,
});
assert.equal(approvalResume.status, 'completed');
assert.equal(approvalResume.toolResults.length, 1);
assert.equal(approvalResume.toolResults[0]?.result.responseText, 'Approved staged default click completed.');
assert.equal(approvalResumeModelCalled, false);
assert.equal(approvalResumeExecutorCalled, false);

let mixedBatchExecutorCalled = false;
const mixedBatchResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Staged default should reject mixed read/write parallel batches.',
    tools: [
      {
        args: {
          action: 'get_cursor_position',
        },
        reason: 'read-only observation',
        tool: 'execute_desktop_observation',
      },
      {
        args: {
          action: 'click',
          x: 41,
          y: 42,
        },
        reason: 'mutating desktop input',
        tool: 'execute_desktop_input',
      },
    ],
  }),
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: '/agent staged default mixed batch soak',
  toolExecutor: async () => {
    mixedBatchExecutorCalled = true;
    throw new Error('mixed read/write parallel batch should not execute tools');
  },
  userGoal: 'Reject mixed read/write batch through staged default v3',
});
assert.equal(mixedBatchResult.status, 'needs-user');
assert.equal(mixedBatchResult.toolResults.length, 0);
assert.equal(mixedBatchExecutorCalled, false);
assert.match(mixedBatchResult.finalAnswer, /Agent v3 runtime could not safely prepare that command/u);
assert.doesNotMatch(mixedBatchResult.finalAnswer, /No experimental v3 adapter is configured for phase recover/u);

for (const [label, source] of [
  ['v3 chat runner', runnerSource],
  ['v3 v2 adapter', adapterSource],
  ['chat controller', controllerSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow for staged-default soak.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed queues, report order, or recovery actions for staged-default soak.`,
  );
}

console.log('agent session v3 staged default soak smoke ok');
