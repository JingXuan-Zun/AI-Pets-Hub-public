import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalSession,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { experimentalSource, controllerSource, adaptersSource, indexSource } =
  readProjectSources({
    experimentalSource: 'src/agent/agentSessionV3ExperimentalSession.ts',
    controllerSource: 'src/agent/agentSessionV3RuntimeController.ts',
    adaptersSource: 'src/agent/agentSessionV3RuntimeAdapters.ts',
    indexSource: 'src/agent/legacy/index.ts',
  });

assert.match(experimentalSource, /export async function runAgentSessionV3ExperimentalSession/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3ExperimentalSession';/u);
assert.match(experimentalSource, /runAgentSessionV3RuntimeController/u);

const baseTiming = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const finalAnswerOutcome: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'final_answer',
    message: 'Experimental v3 final answer.',
    reason: 'Experimental v3 final reason.',
    tool: null,
  },
  modelResponse: '{"action":"final_answer"}',
  step: {
    action: 'final_answer',
    index: 1,
    summary: 'Experimental v3 final answer.',
    tool: null,
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'accepted',
};

const finalAnswerResult = await runAgentSessionV3ExperimentalSession({
  adapters: {
    modelDecision: () => finalAnswerOutcome,
  },
});
assert.equal(finalAnswerResult.status, 'completed');
assert.equal(finalAnswerResult.finalAnswer, 'Experimental v3 final reason.');
assert.equal(finalAnswerResult.runtime.state.phase, 'done');
assert.equal(finalAnswerResult.runtime.transitions.length, 2);

const toolDecisionOutcome: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Experimental v3 needs a tool transaction.',
    tool: 'runtime_smoke_tool',
  },
  modelResponse: '{"action":"tool_call"}',
  step: {
    action: 'tool_call',
    index: 1,
    summary: 'Experimental v3 selected tool transaction.',
    tool: 'runtime_smoke_tool',
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'accepted',
};

const command: AgentChatCommand = {
  instruction: 'experimental v3 smoke',
  kind: 'tool-call',
  sourceText: '/agent experimental v3 smoke',
  toolCall: {
    input: {
      query: 'experimental v3 smoke',
    },
    name: 'execute_desktop_observation',
  },
};

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'Experimental v3 transaction completed.',
    verification: 'Experimental v3 transaction verified.',
  },
  timing: {
    ...baseTiming,
    kind: 'tool',
    label: 'execute_desktop_observation',
  },
};

const evaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'Experimental v3 evaluated completion.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Experimental v3 evaluation completed.',
};

const completedToolResult = await runAgentSessionV3ExperimentalSession({
  adapters: {
    evaluate: () => evaluation,
    executeTransaction: () => ({
      kind: 'tool-transaction',
      transaction,
    }),
    modelDecision: () => toolDecisionOutcome,
    prepareCommand: () => ({
      reason: 'Experimental v3 prepared execution.',
      route: 'execute',
    }),
  },
});
assert.equal(completedToolResult.status, 'completed');
assert.equal(completedToolResult.runtime.state.phase, 'done');
assert.equal(completedToolResult.runtime.state.terminal?.status, 'completed');
assert.deepEqual(
  completedToolResult.runtime.transitions.map((transition) => transition.event.type),
  [
    'start',
    'model-decision-accepted',
    'command-prepared',
    'transaction-finished',
    'evaluation-completed',
  ],
);

const missingEvaluationResult = await runAgentSessionV3ExperimentalSession({
  adapters: {
    executeTransaction: () => ({
      kind: 'tool-transaction',
      transaction,
    }),
    modelDecision: () => toolDecisionOutcome,
    prepareCommand: () => ({
      reason: 'Experimental v3 prepared execution.',
      route: 'execute',
    }),
  },
});
assert.equal(missingEvaluationResult.status, 'waiting');
assert.equal(missingEvaluationResult.runtime.state.phase, 'evaluate');
assert.equal(missingEvaluationResult.runtime.stopReason, 'waiting-for-phase-event');
assert.match(missingEvaluationResult.finalAnswer, /No experimental v3 adapter is configured for phase evaluate/u);

const approvalDecisionOutcome: AgentModelDecisionTurnOutcome = {
  ...toolDecisionOutcome,
  decision: {
    action: 'tool_call',
    reason: 'Experimental v3 needs approval.',
    tool: 'approval_smoke_tool',
  },
};

const missingApprovalResult = await runAgentSessionV3ExperimentalSession({
  adapters: {
    modelDecision: () => approvalDecisionOutcome,
    prepareCommand: () => ({
      reason: 'Experimental v3 prepared approval.',
      route: 'approval',
    }),
  },
});
assert.equal(missingApprovalResult.status, 'needs-approval');
assert.equal(missingApprovalResult.runtime.state.phase, 'needs_approval');
assert.equal(missingApprovalResult.runtime.stopReason, 'waiting-for-phase-event');
assert.match(missingApprovalResult.finalAnswer, /No experimental v3 adapter is configured for phase needs_approval/u);

const cancelledResult = await runAgentSessionV3ExperimentalSession({
  adapters: {
    modelDecision: () => finalAnswerOutcome,
  },
  isCancellationRequested: () => true,
});
assert.equal(cancelledResult.status, 'cancelled');
assert.equal(cancelledResult.runtime.state.terminal?.status, 'cancelled');

for (const [label, source] of [
  ['experimental session', experimentalSource],
  ['runtime adapters', adaptersSource],
  ['runtime controller', controllerSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /nextTool|nextArgs|implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool decisions, queues, report order, or recovery actions.`,
  );
}

assert.doesNotMatch(
  experimentalSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|toolExecutor/u,
  'Experimental session must not directly own v2 production calls or tool execution.',
);

console.log('agent session v3 experimental session smoke ok');
