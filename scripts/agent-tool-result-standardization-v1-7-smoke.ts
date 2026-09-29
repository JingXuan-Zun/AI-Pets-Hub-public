import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  createAgentContextFromResult,
  createAgentToolStateSummary,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  commandSource,
  coreSource,
  contextSource,
  typesSource,
  controllerSource,
} = readProjectSources({
  commandSource: 'src/agent/agentChatCommand.ts',
  coreSource: 'src/agent/agentCore.ts',
  contextSource: 'src/agent/agentChatContext.ts',
  typesSource: 'src/types.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
});

assert.match(
  commandSource,
  /export interface AgentToolStateSummary/u,
  'agent command result should expose a structured tool state summary',
);

for (const fieldName of [
  'observedState',
  'changedState',
  'verificationEvidence',
  'missingEvidence',
  'recommendedRecovery',
]) {
  assert.match(
    commandSource,
    new RegExp(`${fieldName}\\?: string\\[\\]`, 'u'),
    `state summary should expose ${fieldName}`,
  );
}

assert.match(
  commandSource,
  /export interface AgentStructuredToolEvidence/u,
  'agent command result should expose structured evidence for stable tool facts',
);

assert.match(
  commandSource,
  /structuredEvidence\?: AgentStructuredToolEvidence \| null;/u,
  'state summary should preserve structured evidence',
);

assert.match(
  commandSource,
  /stateSummary\?: AgentToolStateSummary \| null;/u,
  'agent command results should carry optional standardized state summaries',
);

assert.match(
  coreSource,
  /export function createAgentToolStateSummary\(/u,
  'agent core should normalize tool results into state summaries',
);

assert.match(
  coreSource,
  /getAgentToolLifecycleMetadata\(toolName\)/u,
  'state summary normalization should use lifecycle metadata',
);

assert.match(
  coreSource,
  /createAgentToolStateSummaryLines\(result\.stateSummary\)/u,
  'core summaries should include standardized state summary lines',
);

assert.match(
  contextSource,
  /stateSummary: result\.stateSummary \?\? null/u,
  'agent context should persist standardized state summaries',
);

assert.match(
  typesSource,
  /stateSummary\?: AgentToolStateSummary \| null;/u,
  'chat types should persist standardized state summaries',
);

assert.match(
  controllerSource,
  /stateSummary: result\.stateSummary \?\? result\.receipt\.stateSummary \?\? null/u,
  'execution receipts should include standardized state summaries',
);

const displayCommand: AgentChatCommand = {
  instruction: 'read displays',
  kind: 'tool-call',
  sourceText: '/agent read displays',
  toolCall: {
    goal: 'read displays',
    input: {},
    name: 'get_display_info',
  },
};

const assessedDisplay = assessAgentCommandResult(displayCommand, {
  observations: ['Display count: 2', 'Primary display: 2650x1440'],
  ok: true,
  responseText: 'Detected 2 displays.',
  verification: 'display-list returned by desktop runtime',
});

assert.equal(assessedDisplay.assessment?.status, 'completed');
assert.ok(assessedDisplay.stateSummary?.observedState?.some((item) => item.includes('Display count: 2')));
assert.ok(assessedDisplay.stateSummary?.verificationEvidence?.some((item) => item.includes('display-list returned')));
assert.equal(assessedDisplay.stateSummary?.changedState, undefined);
assert.equal(assessedDisplay.stateSummary?.missingEvidence, undefined);

const launchCommand: AgentChatCommand = {
  instruction: 'open chrome',
  kind: 'tool-call',
  sourceText: '/agent open chrome',
  toolCall: {
    goal: 'open chrome',
    input: {
      query: 'chrome',
    },
    name: 'launch_local_app',
  },
};

const failedLaunch = assessAgentCommandResult(launchCommand, {
  errorText: 'No matching app window or shortcut found.',
  ok: false,
  responseText: 'No matching app window or shortcut found.',
});

assert.ok(failedLaunch.assessment?.status === 'failed' || failedLaunch.assessment?.status === 'needs-user');
assert.ok(failedLaunch.stateSummary?.missingEvidence?.includes('missing:focused-window'));
assert.ok(failedLaunch.stateSummary?.missingEvidence?.includes('missing:launch-request-accepted'));
assert.ok(failedLaunch.stateSummary?.recommendedRecovery?.includes('tool:launch_local_app'));
assert.equal(failedLaunch.stateSummary?.changedState, undefined);

const successfulLaunch = assessAgentCommandResult(launchCommand, {
  ok: true,
  observations: ['Focused existing Chrome window'],
  responseText: 'Chrome focused.',
  stateSummary: {
    structuredEvidence: {
      confidence: 'high',
      finalWindow: {
        processName: 'chrome.exe',
        title: 'New Tab',
      },
      status: 'success',
      targetMatched: 'Google Chrome',
    },
  },
  verification: 'focused-window matched chrome.exe',
});

assert.ok(successfulLaunch.stateSummary?.changedState?.includes('focused-window'));
assert.ok(successfulLaunch.stateSummary?.changedState?.includes('process-list'));
assert.ok(successfulLaunch.stateSummary?.verificationEvidence?.some((item) => item.includes('focused-window matched')));
assert.equal(successfulLaunch.stateSummary?.structuredEvidence?.targetMatched, 'Google Chrome');
assert.equal(successfulLaunch.stateSummary?.structuredEvidence?.finalWindow?.processName, 'chrome.exe');

const context = createAgentContextFromResult(launchCommand, successfulLaunch);
assert.deepEqual(context.stateSummary, successfulLaunch.stateSummary);

const stateSummary = createAgentToolStateSummary(launchCommand, failedLaunch);
assert.ok(stateSummary?.recommendedRecovery?.includes('tool:launch_local_app'));

const windowMoveCommand: AgentChatCommand = {
  instruction: 'move browser to secondary display',
  kind: 'tool-call',
  sourceText: '/agent move browser to secondary display',
  toolCall: {
    goal: 'move browser to secondary display',
    input: {
      action: 'move_window_to_display',
      target: 'browser',
      targetDisplay: 'secondary',
    },
    name: 'execute_desktop_action',
  },
};

const unverifiedWindowMove = assessAgentCommandResult(windowMoveCommand, {
  observations: [
    'Move window query: browser',
    'Requested display: secondary',
    'Verified after move: false',
  ],
  ok: true,
  receipt: {
    evidenceLines: [
      'Move window query: browser',
      'Requested display: secondary',
      'Verified after move: false',
    ],
    status: 'unverified',
    summaryLines: [
      'Call: move_window_to_display',
      'Result: move requested, verification uncertain',
    ],
    title: 'Execution receipt',
    toolName: 'move_window_to_display',
    verification: 'Move request was sent, but post-move verification was uncertain.',
  },
  responseText: 'Move request sent for browser, but verification was uncertain.',
  verification: 'Move requested but not fully verified: browser',
});

assert.equal(unverifiedWindowMove.assessment?.status, 'unverified');
assert.ok(unverifiedWindowMove.stateSummary?.verificationEvidence?.includes('receipt-status:unverified'));
assert.ok(unverifiedWindowMove.stateSummary?.missingEvidence?.includes('missing:desktop-action-result'));
assert.ok(unverifiedWindowMove.stateSummary?.missingEvidence?.includes('missing:window-bounds'));
assert.ok(unverifiedWindowMove.stateSummary?.recommendedRecovery?.includes('tool:execute_desktop_action'));
assert.ok(unverifiedWindowMove.stateSummary?.recommendedRecovery?.includes('tool:control_browser'));
assert.ok(unverifiedWindowMove.followUpActions?.some((action) => action.kind === 'run-command'));

console.log('agent tool result standardization v1.7 smoke ok');
