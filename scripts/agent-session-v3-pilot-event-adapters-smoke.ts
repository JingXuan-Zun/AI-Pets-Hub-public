import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotCommandUnavailableEvent,
  createAgentSessionV3PilotEvaluationRecoveryEvent,
  createAgentSessionV3PilotEventFromModelDecisionTurn,
  createAgentSessionV3PilotEventFromParallelToolExecutionTransaction,
  createAgentSessionV3PilotEventFromPendingApprovalAssembly,
  createAgentSessionV3PilotEventFromPostActionTerminalEvaluation,
  createAgentSessionV3PilotEventFromPreparedCommand,
  createAgentSessionV3PilotEventFromToolExecutionTransaction,
  createAgentSessionV3PilotRecoveryExhaustedEvent,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentParallelToolTransactionResult,
  type AgentRuntimePendingApprovalAssembly,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { adaptersSource, indexSource } = readProjectSources({
  adaptersSource: 'src/agent/agentSessionV3PilotEventAdapters.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  adaptersSource,
  /export function createAgentSessionV3PilotEventFromModelDecisionTurn/u,
  'v3 pilot event adapters should live in their own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotEventAdapters'/u,
  'v3 pilot event adapters should be exported through the agent barrel.',
);
assert.doesNotMatch(
  adaptersSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence/u,
  'v3 pilot event adapters should not encode concrete tools or a fixed tool chain.',
);
assert.doesNotMatch(
  adaptersSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|createAgentSessionV2PendingApprovalAssembly\(/u,
  'v3 pilot event adapters should not call v2 modules directly.',
);

const baseTiming = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const acceptedToolDecision: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need runtime evidence.',
    tool: 'some_tool',
  },
  modelResponse: '{}',
  step: {
    action: 'tool_call',
    index: 1,
    summary: 'tool',
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'accepted',
};
assert.deepEqual(createAgentSessionV3PilotEventFromModelDecisionTurn(acceptedToolDecision), {
  reason: 'Need runtime evidence.',
  route: 'prepare-command',
  type: 'model-decision-accepted',
});

const acceptedFinalDecision: AgentModelDecisionTurnOutcome = {
  ...acceptedToolDecision,
  decision: {
    action: 'final_answer',
    message: 'Done.',
  },
};
assert.deepEqual(createAgentSessionV3PilotEventFromModelDecisionTurn(acceptedFinalDecision), {
  reason: 'Done.',
  route: 'terminal',
  terminalStatus: 'completed',
  type: 'model-decision-accepted',
});

const acceptedAskUserDecision: AgentModelDecisionTurnOutcome = {
  ...acceptedToolDecision,
  decision: {
    action: 'ask_user',
    reason: 'Need user input.',
  },
};
assert.deepEqual(createAgentSessionV3PilotEventFromModelDecisionTurn(acceptedAskUserDecision), {
  reason: 'Need user input.',
  route: 'terminal',
  terminalStatus: 'needs-user',
  type: 'model-decision-accepted',
});

const invalidDecision: AgentModelDecisionTurnOutcome = {
  modelResponse: 'not-json',
  timing: baseTiming,
  traceEvents: [],
  type: 'invalid-output',
};
assert.equal(createAgentSessionV3PilotEventFromModelDecisionTurn(invalidDecision).type, 'model-output-invalid');

const failedDecision: AgentModelDecisionTurnOutcome = {
  errorText: 'model unavailable',
  step: {
    action: 'final_answer',
    index: 2,
    summary: 'failed',
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'model-failed',
};
assert.deepEqual(createAgentSessionV3PilotEventFromModelDecisionTurn(failedDecision), {
  errorText: 'model unavailable',
  reason: 'model unavailable',
  type: 'model-failed',
});

const cancelledDecision: AgentModelDecisionTurnOutcome = {
  modelResponse: '{}',
  timing: {
    ...baseTiming,
    status: 'cancelled',
  },
  traceEvents: [],
  type: 'cancelled-after-output',
};
assert.equal(createAgentSessionV3PilotEventFromModelDecisionTurn(cancelledDecision).type, 'cancel');

assert.deepEqual(createAgentSessionV3PilotEventFromPreparedCommand({
  reason: 'command ready',
  route: 'execute',
}), {
  reason: 'command ready',
  route: 'execute',
  type: 'command-prepared',
});
assert.deepEqual(createAgentSessionV3PilotEventFromPreparedCommand({
  reason: 'recovery command ready',
  route: 'approval',
  source: 'recovery',
}), {
  reason: 'recovery command ready',
  route: 'approval',
  type: 'recovery-command-prepared',
});

const command: AgentChatCommand = {
  instruction: 'adapter smoke',
  kind: 'tool-call',
  sourceText: '/agent adapter smoke',
  toolCall: {
    input: {},
    name: 'get_cursor_position',
  },
};
const approvalAssembly: AgentRuntimePendingApprovalAssembly = {
  finalAnswer: 'Approval required.',
  historyLine: 'history',
  pendingApproval: {
    command,
    plan: {
      command,
      steps: [],
      summary: 'plan',
    },
    reason: 'Approval required.',
    routeSummary: 'prompt',
  },
  status: 'needs-approval',
  traceEvent: {
    status: 'needs-approval',
    stepIndex: 1,
    summary: 'approval',
    type: 'approval_required',
  } satisfies AgentRuntimeTraceEventDraft,
};
assert.deepEqual(createAgentSessionV3PilotEventFromPendingApprovalAssembly(approvalAssembly), {
  reason: 'Approval required.',
  route: 'approval',
  type: 'command-prepared',
});

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'response',
    verification: 'verified',
  },
  timing: {
    ...baseTiming,
    kind: 'tool',
    label: 'tool',
  },
};
assert.deepEqual(createAgentSessionV3PilotEventFromToolExecutionTransaction(transaction), {
  ok: true,
  reason: 'verified',
  type: 'transaction-finished',
});

const parallelTransaction: AgentParallelToolTransactionResult = {
  allResults: [
    transaction,
    {
      ...transaction,
      result: {
        ok: false,
        responseText: 'failed',
      },
    },
  ],
  coveredResults: [],
  runResults: [],
};
assert.deepEqual(createAgentSessionV3PilotEventFromParallelToolExecutionTransaction(parallelTransaction), {
  ok: false,
  reason: 'Parallel transaction finished with 1/2 successful results.',
  type: 'transaction-finished',
});

const completedEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'Done.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Evidence completed the task.',
};
assert.deepEqual(createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(completedEvaluation), {
  reason: 'Evidence completed the task.',
  type: 'evaluation-completed',
});
assert.equal(createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(null), null);

const needsUserEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'Need login.',
  kind: 'login-required',
  postActionState: 'login_required',
  status: 'needs-user',
  stepAction: 'ask_user',
  stepReason: 'Login required.',
};
assert.deepEqual(createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(needsUserEvaluation), {
  reason: 'Login required.',
  type: 'evaluation-needs-user',
});

assert.deepEqual(createAgentSessionV3PilotCommandUnavailableEvent('missing tool'), {
  reason: 'missing tool',
  type: 'command-unavailable',
});
assert.deepEqual(createAgentSessionV3PilotEvaluationRecoveryEvent('needs more evidence'), {
  reason: 'needs more evidence',
  type: 'evaluation-needs-recovery',
});
assert.deepEqual(createAgentSessionV3PilotRecoveryExhaustedEvent('cap reached'), {
  reason: 'cap reached',
  type: 'recovery-exhausted',
});

console.log('agent session v3 pilot event adapters smoke ok');
