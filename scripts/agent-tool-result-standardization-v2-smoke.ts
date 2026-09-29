import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  createAgentToolStateSummary,
  type AgentChatCommand,
} from '../src/agent/index.ts';

const launchCommand: AgentChatCommand = {
  instruction: 'open launcher',
  kind: 'tool-call',
  sourceText: '/agent open launcher',
  toolCall: {
    goal: 'open launcher',
    input: {
      query: 'launcher',
    },
    name: 'launch_local_app',
  },
};

const receiptStateResult = assessAgentCommandResult(launchCommand, {
  ok: true,
  receipt: {
    evidenceLines: [
      'Receipt evidence line',
    ],
    stateSummary: {
      missingEvidence: [
        'receipt missing:target-window',
      ],
      observedState: [
        'receipt observed:launcher focused',
      ],
      recommendedRecovery: [
        'tool:execute_desktop_observation',
      ],
      structuredEvidence: {
        confidence: 'medium',
        finalWindow: {
          processName: 'Launcher.exe',
          title: 'Game Launcher',
        },
        targetMatched: 'Game Launcher',
      },
      verificationEvidence: [
        'receipt verified:window title matched launcher',
      ],
    },
    status: 'unverified',
    summaryLines: [
      'Call: launch launcher',
    ],
    title: 'Launcher receipt',
    toolName: 'launch_local_app',
    verification: 'Receipt verification: launcher focused but target app not confirmed.',
  },
  responseText: 'Launcher focused.',
});

assert.equal(receiptStateResult.assessment?.status, 'unverified');
assert.ok(receiptStateResult.stateSummary?.observedState?.includes('receipt observed:launcher focused'));
assert.ok(receiptStateResult.stateSummary?.observedState?.includes('Receipt evidence line'));
assert.ok(receiptStateResult.stateSummary?.verificationEvidence?.includes('receipt verified:window title matched launcher'));
assert.ok(receiptStateResult.stateSummary?.verificationEvidence?.includes('Receipt verification: launcher focused but target app not confirmed.'));
assert.ok(receiptStateResult.stateSummary?.verificationEvidence?.includes('receipt-status:unverified'));
assert.ok(receiptStateResult.stateSummary?.missingEvidence?.includes('receipt missing:target-window'));
assert.ok(receiptStateResult.stateSummary?.recommendedRecovery?.includes('tool:execute_desktop_observation'));
assert.equal(receiptStateResult.stateSummary?.structuredEvidence?.targetMatched, 'Game Launcher');
assert.equal(receiptStateResult.stateSummary?.structuredEvidence?.finalWindow?.processName, 'Launcher.exe');

const responseOnlyCommand: AgentChatCommand = {
  instruction: 'plain context response',
  kind: 'help',
  sourceText: '/agent help',
};

const responseOnlyResult = assessAgentCommandResult(responseOnlyCommand, {
  ok: true,
  responseText: 'Plain response evidence from a simple tool.',
});

assert.equal(responseOnlyResult.assessment?.status, 'completed');
assert.ok(responseOnlyResult.stateSummary?.observedState?.includes('Plain response evidence from a simple tool.'));

const genericFailureCommand: AgentChatCommand = {
  instruction: 'unsupported generic tool',
  kind: 'unsupported',
  sourceText: '/agent unsupported generic tool',
};

const genericFailure = assessAgentCommandResult(genericFailureCommand, {
  errorText: 'Generic tool failed without lifecycle metadata.',
  followUp: 'Ask the user for a safer target.',
  ok: false,
  responseText: 'Generic tool failed.',
});

assert.equal(genericFailure.assessment?.status, 'needs-user');
assert.ok(genericFailure.stateSummary?.observedState?.includes('Generic tool failed.'));
assert.ok(genericFailure.stateSummary?.missingEvidence?.includes('missing:verification-evidence'));
assert.ok(genericFailure.stateSummary?.missingEvidence?.includes('missing:successful-tool-result'));
assert.ok(genericFailure.stateSummary?.recommendedRecovery?.includes('follow-up:Ask the user for a safer target.'));

const receiptFailed = assessAgentCommandResult(responseOnlyCommand, {
  ok: true,
  receipt: {
    evidenceLines: [
      'Receipt says blocked by policy.',
    ],
    status: 'blocked',
    summaryLines: [
      'Blocked by policy',
    ],
    title: 'Blocked receipt',
    verification: 'The action was blocked before execution.',
  },
  responseText: 'Blocked by policy.',
});

assert.equal(receiptFailed.assessment?.status, 'failed');
assert.ok(receiptFailed.stateSummary?.verificationEvidence?.includes('receipt-status:blocked'));

const directSummary = createAgentToolStateSummary(responseOnlyCommand, {
  ok: true,
  receipt: {
    evidenceLines: [],
    stateSummary: {
      observedState: [
        'direct receipt observed',
      ],
    },
    status: 'success',
    summaryLines: [],
    title: 'Direct summary receipt',
  },
  responseText: 'Direct summary response',
});

assert.ok(directSummary?.observedState?.includes('direct receipt observed'));
assert.ok(directSummary?.verificationEvidence?.includes('receipt-status:success'));

console.log('agent tool result standardization v2 smoke ok');
