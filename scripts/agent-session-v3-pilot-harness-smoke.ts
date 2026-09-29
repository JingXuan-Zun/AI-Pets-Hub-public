import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotHarnessDriver,
  runAgentSessionV3PilotHarness,
  runAgentSessionV3PilotHarnessWithDebugSummary,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentRuntimePendingApprovalAssembly,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { harnessSource, indexSource } = readProjectSources({
  harnessSource: 'src/agent/agentSessionV3PilotHarness.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  harnessSource,
  /export function runAgentSessionV3PilotHarness/u,
  'v3 pilot harness should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotHarness'/u,
  'v3 pilot harness should be exported through the agent barrel.',
);
assert.doesNotMatch(
  harnessSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence/u,
  'v3 pilot harness should not encode concrete tools or a fixed tool chain.',
);
assert.doesNotMatch(
  harnessSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|createAgentSessionV2PendingApprovalAssembly\(|evaluateAgentSessionV2PostActionTerminal\(/u,
  'v3 pilot harness should not call v2 modules directly.',
);

const baseTiming = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const toolDecisionOutcome: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need evidence.',
    tool: 'some_tool',
  },
  modelResponse: '{}',
  step: {
    action: 'tool_call',
    index: 1,
    summary: 'tool call',
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'accepted',
};

const finalDecisionOutcome: AgentModelDecisionTurnOutcome = {
  ...toolDecisionOutcome,
  decision: {
    action: 'final_answer',
    message: 'Done.',
  },
};

const command: AgentChatCommand = {
  instruction: 'harness smoke',
  kind: 'tool-call',
  sourceText: '/agent harness smoke',
  toolCall: {
    input: {},
    name: 'get_cursor_position',
  },
};

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'Observed result.',
    verification: 'Verified result.',
  },
  timing: {
    ...baseTiming,
    kind: 'tool',
    label: 'tool',
  },
};

const completedEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'Done.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Evidence completed the task.',
};

const visitedPhases: string[] = [];
const completedResult = await runAgentSessionV3PilotHarness({
  ports: {
    evaluate: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        evaluation: completedEvaluation,
        kind: 'post-action-terminal',
      };
    },
    executeTransaction: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        kind: 'tool-transaction',
        transaction,
      };
    },
    init: (context) => {
      visitedPhases.push(context.state.phase);
      return { kind: 'start' };
    },
    modelDecision: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        kind: 'model-decision-turn',
        outcome: toolDecisionOutcome,
      };
    },
    prepareCommand: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        kind: 'prepared-command',
        route: 'execute',
      };
    },
  },
});
assert.equal(completedResult.status, 'terminal');
assert.equal(completedResult.state.phase, 'done');
assert.equal(completedResult.state.terminal?.status, 'completed');
assert.deepEqual(visitedPhases, [
  'init',
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
]);

const waitingResult = await runAgentSessionV3PilotHarness({
  ports: {
    init: () => ({ kind: 'start' }),
  },
});
assert.equal(waitingResult.status, 'waiting-for-event');
assert.equal(waitingResult.state.phase, 'model_decision');

const approvalAssembly: AgentRuntimePendingApprovalAssembly = {
  finalAnswer: 'Approval required.',
  historyLine: 'history',
  pendingApproval: {
    command,
    plan: {
      command,
      steps: [],
      summary: 'approval plan',
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
const approvalResult = await runAgentSessionV3PilotHarness({
  ports: {
    approval: () => ({
      kind: 'approved',
      reason: 'approved in smoke',
    }),
    evaluate: () => ({
      evaluation: completedEvaluation,
      kind: 'post-action-terminal',
    }),
    executeTransaction: () => ({
      kind: 'tool-transaction',
      transaction,
    }),
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: toolDecisionOutcome,
    }),
    prepareCommand: () => ({
      assembly: approvalAssembly,
      kind: 'pending-approval',
    }),
  },
});
assert.equal(approvalResult.status, 'terminal');
assert.equal(approvalResult.transitions.some((transition) => transition.from === 'needs_approval'), true);

let modelDecisionRuns = 0;
const recoveryResult = await runAgentSessionV3PilotHarness({
  ports: {
    init: () => ({ kind: 'start' }),
    modelDecision: () => {
      modelDecisionRuns += 1;
      if (modelDecisionRuns === 1) {
        return {
          kind: 'model-decision-turn',
          outcome: {
            modelResponse: 'not-json',
            timing: baseTiming,
            traceEvents: [],
            type: 'invalid-output',
          },
        };
      }

      return {
        kind: 'model-decision-turn',
        outcome: finalDecisionOutcome,
      };
    },
    recover: () => ({
      kind: 'model-requested',
      reason: 'retry after invalid output',
    }),
  },
});
assert.equal(recoveryResult.status, 'terminal');
assert.equal(recoveryResult.state.phase, 'done');
assert.equal(recoveryResult.state.recoveryCount, 1);

const exhaustedResult = await runAgentSessionV3PilotHarness({
  ports: {
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: {
        modelResponse: 'not-json',
        timing: baseTiming,
        traceEvents: [],
        type: 'invalid-output',
      },
    }),
    recover: () => ({
      kind: 'exhausted',
      reason: 'repair cap reached',
    }),
  },
});
assert.equal(exhaustedResult.status, 'terminal');
assert.equal(exhaustedResult.state.phase, 'failed');
assert.equal(exhaustedResult.state.terminal?.status, 'failed');

const driver = createAgentSessionV3PilotHarnessDriver({
  ports: {
    init: () => ({
      event: {
        reason: 'custom event',
        type: 'start',
      },
      kind: 'pilot-event',
    }),
  },
});
const customEvent = await driver({
  state: {
    lastEvent: null,
    phase: 'init',
    recoveryCount: 0,
    revision: 0,
    terminal: null,
  },
  transitionCount: 0,
  transitions: [],
});
assert.deepEqual(customEvent, {
  reason: 'custom event',
  type: 'start',
});

const debugDisabled = await runAgentSessionV3PilotHarnessWithDebugSummary({
  ports: {
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: finalDecisionOutcome,
    }),
  },
});
assert.equal(debugDisabled.result.status, 'terminal');
assert.equal(debugDisabled.debugSummaryText, null);

const debugEnabled = await runAgentSessionV3PilotHarnessWithDebugSummary({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  ports: {
    init: () => ({ kind: 'start', reason: 'begin debug run' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: finalDecisionOutcome,
    }),
  },
});
assert.equal(debugEnabled.result.status, 'terminal');
assert.match(
  debugEnabled.debugSummaryText ?? '',
  /AgentSessionV3Pilot status=terminal phase=done terminal=completed/u,
);
assert.match(debugEnabled.debugSummaryText ?? '', /1\. init --start--> model_decision reason=begin debug run/u);
assert.match(debugEnabled.debugSummaryText ?? '', /2\. model_decision --model-decision-accepted--> done/u);

console.log('agent session v3 pilot harness smoke ok');
