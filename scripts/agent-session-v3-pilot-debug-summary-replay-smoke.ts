import assert from 'node:assert/strict';
import {
  runAgentSessionV3PilotHarnessWithDebugSummary,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentRuntimePendingApprovalAssembly,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { harnessSource, summarySource, replaySource } = readProjectSources({
  harnessSource: 'src/agent/agentSessionV3PilotHarness.ts',
  summarySource: 'src/agent/agentSessionV3PilotTraceSummary.ts',
  replaySource: 'scripts/agent-session-v3-pilot-debug-summary-replay-smoke.ts',
});

assert.doesNotMatch(
  harnessSource,
  /AgentSessionV2\(|executeAgentSessionV2ToolCommandWithCache|buildAgentPermissionRoute/u,
  'Debug summary harness should not wire itself into the production AgentSessionV2 loop or permission/execution internals.',
);
assert.doesNotMatch(
  summarySource,
  /runAgentSessionV3PilotRunner|advanceAgentSessionV3PilotState|runAgentSessionV2/u,
  'Trace summary formatter should stay pure and should not drive the state machine or production runtime.',
);
assert.doesNotMatch(
  replaySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Debug summary replay should not encode a fixed tool chain.',
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
  instruction: 'debug summary replay command',
  kind: 'tool-call',
  sourceText: '/agent debug summary replay',
  toolCall: {
    input: {
      capability: 'controlled-action',
    },
    name: 'get_active_window_info',
  },
};

const modelDecision: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need permissioned evidence path.',
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

const approvalDenied = await runAgentSessionV3PilotHarnessWithDebugSummary({
  debugSummary: {
    enabled: true,
    includeReasons: true,
    maxReasonLength: 90,
  },
  ports: {
    approval: () => ({
      kind: 'denied',
      reason: 'User declined the action.',
    }),
    init: () => ({
      kind: 'start',
      reason: 'begin approval debug replay',
    }),
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

assert.equal(approvalDenied.result.status, 'terminal');
assert.equal(approvalDenied.result.state.terminal?.status, 'needs-user');
assert.match(
  approvalDenied.debugSummaryText ?? '',
  /^AgentSessionV3Pilot status=terminal phase=done terminal=needs-user recoveries=0 transitions=4/mu,
);
assert.match(
  approvalDenied.debugSummaryText ?? '',
  /1\. init --start--> model_decision reason=begin approval debug replay/u,
);
assert.match(
  approvalDenied.debugSummaryText ?? '',
  /3\. prepare_command --command-prepared--> needs_approval reason=Approval is required before running this action\./u,
);
assert.match(
  approvalDenied.debugSummaryText ?? '',
  /4\. needs_approval --approval-denied--> done reason=User declined the action\./u,
);

const recoveryExhausted = await runAgentSessionV3PilotHarnessWithDebugSummary({
  debugSummary: {
    enabled: true,
    includeReasons: true,
    maxReasonLength: 90,
  },
  ports: {
    init: () => ({
      kind: 'start',
      reason: 'begin recovery debug replay',
    }),
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

assert.equal(recoveryExhausted.result.status, 'terminal');
assert.equal(recoveryExhausted.result.state.phase, 'failed');
assert.equal(recoveryExhausted.result.state.terminal?.status, 'failed');
assert.match(
  recoveryExhausted.debugSummaryText ?? '',
  /^AgentSessionV3Pilot status=terminal phase=failed terminal=failed recoveries=1 transitions=3/mu,
);
assert.match(
  recoveryExhausted.debugSummaryText ?? '',
  /2\. model_decision --model-output-invalid--> recover reason=Model output did not satisfy the decision contract\./u,
);
assert.match(
  recoveryExhausted.debugSummaryText ?? '',
  /3\. recover --recovery-exhausted--> failed reason=Decision repair budget was exhausted\./u,
);

const disabledSummary = await runAgentSessionV3PilotHarnessWithDebugSummary({
  debugSummary: {
    enabled: false,
    includeReasons: true,
  },
  ports: {
    init: () => ({ kind: 'start' }),
    modelDecision: () => ({
      kind: 'model-decision-turn',
      outcome: {
        decision: {
          action: 'final_answer',
          message: 'Done.',
        },
        modelResponse: '{}',
        step: {
          action: 'final_answer',
          index: 1,
          summary: 'Done.',
        },
        timing,
        traceEvents: [],
        type: 'accepted',
      },
    }),
  },
});

assert.equal(disabledSummary.result.status, 'terminal');
assert.equal(disabledSummary.debugSummaryText, null);

console.log('agent session v3 pilot debug summary replay smoke ok');
