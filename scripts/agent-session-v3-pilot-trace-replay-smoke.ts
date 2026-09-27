import assert from 'node:assert/strict';
import {
  runAgentSessionV3PilotHarness,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentParallelToolTransactionResult,
  type AgentRuntimePendingApprovalAssembly,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { harnessSource, replaySource } = readProjectSources({
  harnessSource: 'src/agent/agentSessionV3PilotHarness.ts',
  replaySource: 'scripts/agent-session-v3-pilot-trace-replay-smoke.ts',
});

assert.doesNotMatch(
  harnessSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence/u,
  'Harness should stay generic even when trace replay exercises tool-like outcomes.',
);
assert.doesNotMatch(
  replaySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Trace replay smoke should not assert a fixed tool chain.',
);

const timing = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const command: AgentChatCommand = {
  instruction: 'trace replay command',
  kind: 'tool-call',
  sourceText: '/agent trace replay',
  toolCall: {
    input: {
      capability: 'read-state',
    },
    name: 'get_active_window_info',
  },
};

const modelDecision: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need fresh evidence before answering.',
    tool: 'generic_runtime_tool',
  },
  modelResponse: '{}',
  step: {
    action: 'tool_call',
    index: 1,
    summary: 'tool call',
  },
  timing,
  traceEvents: [],
  type: 'accepted',
};

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'Runtime evidence observed.',
    verification: 'Evidence indicates the requested state is satisfied.',
  },
  timing: {
    ...timing,
    kind: 'tool',
    label: 'generic_runtime_tool',
  },
};

const terminalEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'The task is complete.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Post-action evidence satisfies the request.',
};

const result = await runAgentSessionV3PilotHarness({
  ports: {
    evaluate: () => ({
      evaluation: terminalEvaluation,
      kind: 'post-action-terminal',
    }),
    executeTransaction: () => ({
      kind: 'tool-transaction',
      transaction,
    }),
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: modelDecision,
    }),
    prepareCommand: () => ({
      kind: 'prepared-command',
      route: 'execute',
    }),
  },
});

assert.equal(result.status, 'terminal');
assert.equal(result.state.phase, 'done');
assert.equal(result.state.terminal?.status, 'completed');
assert.deepEqual(result.transitions.map((transition) => transition.from), [
  'init',
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
]);
assert.deepEqual(result.transitions.map((transition) => transition.accepted ? transition.to : null), [
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
  'done',
]);
assert.deepEqual(result.transitions.map((transition) => transition.event.type), [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'transaction-finished',
  'evaluation-completed',
]);

const transitionSummary = result.transitions.map((transition) => (
  transition.accepted
    ? `${transition.from}:${transition.event.type}->${transition.to}`
    : `${transition.from}:${transition.event.type}->rejected`
)).join(' | ');

assert.equal(
  transitionSummary,
  'init:start->model_decision | model_decision:model-decision-accepted->prepare_command | prepare_command:command-prepared->execute_transaction | execute_transaction:transaction-finished->evaluate | evaluate:evaluation-completed->done',
);

const approvalAssembly: AgentRuntimePendingApprovalAssembly = {
  finalAnswer: 'Approval is required before running this action.',
  historyLine: 'approval required',
  pendingApproval: {
    command,
    plan: {
      command,
      steps: [],
      summary: 'approval plan',
    },
    reason: 'Approval is required before running this action.',
    routeSummary: 'prompt',
  },
  status: 'needs-approval',
  traceEvent: {
    status: 'needs-approval',
    stepIndex: 2,
    summary: 'approval required',
    type: 'approval_required',
  } satisfies AgentRuntimeTraceEventDraft,
};

const approvalDeniedResult = await runAgentSessionV3PilotHarness({
  ports: {
    approval: () => ({
      kind: 'denied',
      reason: 'User declined the action.',
    }),
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: modelDecision,
    }),
    prepareCommand: () => ({
      assembly: approvalAssembly,
      kind: 'pending-approval',
    }),
  },
});

assert.equal(approvalDeniedResult.status, 'terminal');
assert.equal(approvalDeniedResult.state.phase, 'done');
assert.equal(approvalDeniedResult.state.terminal?.status, 'needs-user');
assert.deepEqual(approvalDeniedResult.transitions.map((transition) => transition.event.type), [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'approval-denied',
]);
assert.deepEqual(approvalDeniedResult.transitions.map((transition) => transition.accepted ? transition.to : null), [
  'model_decision',
  'prepare_command',
  'needs_approval',
  'done',
]);

const recoveryExhaustedResult = await runAgentSessionV3PilotHarness({
  ports: {
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: {
        modelResponse: 'invalid',
        timing,
        traceEvents: [],
        type: 'invalid-output',
      },
    }),
    recover: () => ({
      kind: 'exhausted',
      reason: 'Decision repair budget was exhausted.',
    }),
  },
});

assert.equal(recoveryExhaustedResult.status, 'terminal');
assert.equal(recoveryExhaustedResult.state.phase, 'failed');
assert.equal(recoveryExhaustedResult.state.terminal?.status, 'failed');
assert.equal(recoveryExhaustedResult.state.recoveryCount, 1);
assert.deepEqual(recoveryExhaustedResult.transitions.map((transition) => transition.event.type), [
  'start',
  'model-output-invalid',
  'recovery-exhausted',
]);

const parallelTransaction: AgentParallelToolTransactionResult = {
  allResults: [
    transaction,
    {
      ...transaction,
      command: {
        ...command,
        toolCall: {
          input: {
            capability: 'read-related-state',
          },
          name: 'get_cursor_position',
        },
      },
      result: {
        ok: true,
        responseText: 'Related runtime evidence observed.',
        verification: 'Related evidence is available.',
      },
      timing: {
        ...transaction.timing,
        id: 'timing-2',
        label: 'another_generic_runtime_tool',
      },
    },
  ],
  coveredResults: [],
  runResults: [],
};
const parallelResult = await runAgentSessionV3PilotHarness({
  ports: {
    evaluate: () => ({
      evaluation: terminalEvaluation,
      kind: 'post-action-terminal',
    }),
    executeTransaction: () => ({
      kind: 'parallel-tool-transaction',
      transaction: parallelTransaction,
    }),
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: {
        ...modelDecision,
        decision: {
          action: 'tool_calls',
          reason: 'Need multiple evidence reads.',
          tools: [
            {
              tool: 'generic_runtime_tool',
            },
            {
              tool: 'another_generic_runtime_tool',
            },
          ],
        },
      },
    }),
    prepareCommand: () => ({
      kind: 'prepared-command',
      route: 'execute',
    }),
  },
});

assert.equal(parallelResult.status, 'terminal');
assert.equal(parallelResult.state.phase, 'done');
assert.deepEqual(parallelResult.transitions.map((transition) => transition.event.type), [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'transaction-finished',
  'evaluation-completed',
]);
const parallelTransactionEvent = parallelResult.transitions.find((transition) => (
  transition.event.type === 'transaction-finished'
))?.event;
assert.equal(parallelTransactionEvent?.type, 'transaction-finished');
assert.equal(
  parallelTransactionEvent?.reason,
  'Parallel transaction finished with 2/2 successful results.',
);

console.log('agent session v3 pilot trace replay smoke ok');
