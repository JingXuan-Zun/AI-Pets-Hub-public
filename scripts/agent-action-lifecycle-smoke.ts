import assert from 'node:assert/strict';
import {
  evaluateAgentActionLifecycle,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';

const waitingTargetResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [],
    status: 'unverified',
    summaryLines: [],
    title: 'sequence',
    toolName: 'execute_desktop_sequence',
  },
  responseText: 'The launch request was sent.',
  stateSummary: {
    structuredEvidence: {
      postActionRecovery: {
        nextTool: 'execute_desktop_observation',
        reason: 'Wait and poll target window/process evidence instead of retrying the same click.',
        strategy: 'wait-and-observe',
      },
      postActionState: 'waiting_target',
    },
  },
};

assert.deepEqual(
  evaluateAgentActionLifecycle(waitingTargetResult),
  {
    reason: 'Post-action state is waiting_target; the action may be accepted but the final target is not ready yet.',
    recommendedRecovery: 'Wait and poll target window/process evidence instead of retrying the same click.',
    status: 'unverified_wait',
  },
);

const permissionBlockedResult: AgentChatCommandResult = {
  errorText: 'Input may be blocked by Windows UIPI/integrity boundary.',
  ok: false,
  receipt: {
    evidenceLines: ['target elevated=true', 'agent elevated=false'],
    status: 'failed',
    summaryLines: [],
    title: 'input',
    toolName: 'execute_desktop_input',
  },
  responseText: 'Permission denied by integrity boundary.',
};

assert.equal(evaluateAgentActionLifecycle(permissionBlockedResult).status, 'blocked_permission');

const noEffectResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [],
    status: 'unverified',
    summaryLines: [],
    title: 'sequence',
    toolName: 'execute_desktop_sequence',
  },
  responseText: 'The action completed but the UI was unchanged.',
  stateSummary: {
    actionEvidence: {
      action: 'sequence',
      outcome: 'no-op',
      timestamp: Date.now(),
      tool: 'execute_desktop_sequence',
    },
    structuredEvidence: {
      postActionState: 'unchanged',
    },
  },
};

assert.equal(evaluateAgentActionLifecycle(noEffectResult).status, 'failed_no_effect');

const successfulReceiptWithNoOpEvidence: AgentChatCommandResult = {
  ...noEffectResult,
  receipt: {
    ...noEffectResult.receipt!,
    status: 'success',
  },
};
assert.equal(evaluateAgentActionLifecycle(successfulReceiptWithNoOpEvidence).status, 'failed_no_effect');

const completeResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [],
    status: 'success',
    summaryLines: [],
    title: 'sequence',
    toolName: 'execute_desktop_sequence',
  },
  responseText: 'done',
  stateSummary: {
    structuredEvidence: {
      postActionState: 'launched',
    },
  },
};

assert.equal(evaluateAgentActionLifecycle(completeResult).status, 'complete');

console.log('agent action lifecycle smoke ok');
