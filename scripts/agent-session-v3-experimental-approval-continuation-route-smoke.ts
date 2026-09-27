import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function extractBetween(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

const { runnerSource, controllerSource, senderSource, containerSource } =
  readProjectSources({
    runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
    controllerSource: 'src/components/chat/agentRunController.ts',
    senderSource: 'src/components/chat/usePetChatMessageSender.ts',
    containerSource: 'src/components/pet/usePetContainerPanelChatState.ts',
  });

assert.match(runnerSource, /approvedToolResult\?: AgentSessionV2ToolResultEntry/u);
assert.match(runnerSource, /authorizeModelIteration\?: AgentTaskRuntimeModelIterationAuthorizer/u);
assert.match(runnerSource, /continuation\?: AgentSessionV2ContinuationState/u);
assert.match(runnerSource, /phase: 'execute_transaction'/u);
assert.match(runnerSource, /lastEvent: 'approval-granted'/u);
assert.match(runnerSource, /approvedToolResult: options\.approvedToolResult \?\? null/u);
assert.match(runnerSource, /\.\.\.\(options\.continuation\?\.steps \?\? \[\]\)/u);

const approvalContinuationSource = extractBetween(
  controllerSource,
  'export async function resolveAgentApprovalRequest',
  '\n\nexport const agentRunController',
);
assert.match(
  approvalContinuationSource,
  /runAgentRuntime\(\{/u,
  'approval continuation should use the version-neutral AgentRuntime entry.',
);
assert.match(
  approvalContinuationSource,
  /adapter: createAgentRuntimeProductionAdapter\(\{/u,
  'approval continuation should use the single production Runtime adapter.',
);
assert.doesNotMatch(
  approvalContinuationSource,
  /createAgentRuntimeLegacyVersionAdapter|compatibilityMode:|runCandidate:|candidateAvailable:/u,
  'approval continuation should not select or fall back between legacy Runtime versions.',
);
assert.match(
  approvalContinuationSource,
  /run: \(runtimeContext\) => runAgentProductionSession\(\{[\s\S]*onProgress: runtimeContext\?\.onProgress/u,
  'approval continuation should use the current production compatibility Session adapter.',
);
assert.match(
  approvalContinuationSource,
  /runAgentRuntime\(\{[\s\S]*onProgress,[\s\S]*adapter: createAgentRuntimeProductionAdapter/u,
  'approval continuation progress should pass through AgentRuntime before reaching the UI.',
);
assert.match(
  approvalContinuationSource,
  /approvedToolResult,[\s\S]*authorizeModelIteration: runtimeContext\?\.authorizeModelIteration[\s\S]*authorizeRecovery: runtimeContext\?\.authorizeRecovery[\s\S]*continuation: approvedContinuation/u,
  'approval continuation should pass the approved result and prior continuation to the production Session adapter.',
);
assert.match(
  approvalContinuationSource,
  /toolExecutor: AgentRuntimeToolExecutor = async \(command\) => \{/u,
  'approval continuation should keep the guarded version-neutral tool executor for later commands.',
);
assert.match(
  approvalContinuationSource,
  /runtimeRoute: routedResult\.implementation/u,
  'approval continuation should log the actual runtime route.',
);

assert.match(senderSource, /configRef,[\s\S]*decision: pendingApprovalDecision/u);
assert.match(senderSource, /runPreparedAgentProductionSession\(\{/u);
assert.doesNotMatch(senderSource, /agentRuntimeMode|runAgentSessionV3Experimental/u);
assert.doesNotMatch(containerSource, /agentRuntimeMode|runAgentSessionV3Experimental/u);

const approvedCommand: AgentChatCommand = {
  instruction: 'approval route smoke',
  kind: 'tool-call',
  sourceText: '/agent approval route smoke',
  toolCall: {
    input: {
      action: 'click',
      x: 7,
      y: 9,
    },
    name: 'execute_desktop_input',
  },
};
const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['waiting for approval'],
  sourceText: '/agent approval route smoke',
  steps: [{
    action: 'tool_call',
    index: 1,
    summary: 'Need approved click.',
    tool: 'execute_desktop_input',
  }],
  traceEvents: [],
  toolResults: [],
  userGoal: 'Resume approved click',
};
const approvedToolResult: AgentSessionV2ToolResultEntry = {
  command: approvedCommand,
  result: {
    ok: true,
    responseText: 'Approved click completed.',
    verification: 'Approved click verified.',
  },
};

let modelCalled = false;
let executorCalled = false;
const resumed = await runAgentSessionV3ExperimentalChatRunner({
  approvedToolResult,
  continuation,
  modelCaller: async () => {
    modelCalled = true;
    throw new Error('approval continuation should not request a new model decision before evaluation');
  },
  settings: {},
  sourceText: continuation.sourceText,
  toolExecutor: async () => {
    executorCalled = true;
    throw new Error('approval continuation should not execute the approved tool result twice');
  },
  userGoal: continuation.userGoal,
});

assert.equal(resumed.status, 'completed');
assert.equal(modelCalled, false);
assert.equal(executorCalled, false);
assert.equal(resumed.toolResults.length, 1);
assert.equal(resumed.toolResults[0]?.result.responseText, 'Approved click completed.');
assert.equal(resumed.steps.some((step) => step.action === 'tool_result'), true);
assert.equal(resumed.continuation.toolResults.length, 1);

for (const [label, source] of [
  ['v3 chat runner', runnerSource],
  ['agent approval controller', controllerSource],
  ['message sender', senderSource],
  ['chat container', containerSource],
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

console.log('agent session v3 experimental approval continuation route smoke ok');
