import assert from 'node:assert/strict';
import {
  resolveAgentRecoveryPostActionState,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentPostActionStateResolverDependencies,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';

const launchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open Example Game inside Example Launcher',
  kind: 'tool-call',
  sourceText: '/agent open Example Game inside Example Launcher',
  toolCall: {
    goal: 'open Example Game inside Example Launcher',
    input: {
      action: 'launch_local_app',
      target: 'Example Launcher',
    },
    name: 'execute_desktop_action',
  },
};

const unverifiedLaunchResult: AgentChatCommandResult = {
  observations: [
    'Tool: execute_desktop_action',
    'Desktop action: launch_local_app',
    'Launch status: launched-unverified',
    'Launch query: Example Launcher',
  ],
  ok: true,
  receipt: {
    evidenceLines: [
      'Launch status: launched-unverified',
      'Launch query: Example Launcher',
    ],
    status: 'unverified',
    summaryLines: [
      'Call: execute_desktop_action',
      'Result: launch request accepted, final visible state unverified',
    ],
    title: 'Execution receipt',
    toolName: 'execute_desktop_action',
    verification: 'Launch request sent, but no focusable window was verified: window-not-detected-after-action.',
  },
  responseText: 'Launch status: launched-unverified',
  verification: 'Launch request sent, but no focusable window was verified: window-not-detected-after-action.',
};

const entry: AgentSessionV2ToolResultEntry = {
  command: launchCommand,
  result: unverifiedLaunchResult,
};

const dependencies: AgentPostActionStateResolverDependencies = {
  collectAutoRecoveryEvidenceText: (toolEntry) => [
    toolEntry.result.responseText,
    toolEntry.result.verification,
    toolEntry.result.receipt?.verification,
    ...(toolEntry.result.observations ?? []),
    ...(toolEntry.result.receipt?.evidenceLines ?? []),
  ].filter(Boolean).join('\n'),
  hasDirectActionIntent: () => true,
  isActionResultTool: (command) => command.toolCall?.name === 'execute_desktop_action',
  isAutoRecoveryCommand: () => false,
  isPostApprovalVerificationCommand: () => false,
  isRecoverableUnverifiedToolResult: (toolEntry) => toolEntry.result.receipt?.status === 'unverified',
};

const state = resolveAgentRecoveryPostActionState({
  dependencies,
  entry,
  sourceText: '/agent open Example Game inside Example Launcher',
  userGoal: 'open Example Game inside Example Launcher',
});

assert.equal(
  state,
  'waiting_window',
  'unverified launch/window-not-detected evidence should enter waiting_window instead of unknown/completed',
);

console.log('agent session v2 unverified launch waiting window smoke ok');
