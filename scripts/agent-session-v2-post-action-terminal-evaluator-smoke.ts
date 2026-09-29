import assert from 'node:assert/strict';
import {
  evaluateAgentPostActionTerminal,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentPostActionTerminalEvaluatorDependencies,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  actionRuntime: actionRuntimeSource,
  evaluator: evaluatorSource,
  runtimeEvaluator: runtimeEvaluatorSource,
  session: sessionSource,
} = readProjectSources({
  actionRuntime: 'src/agent/agentActionRuntime.ts',
  evaluator: 'src/agent/runtime/agentPostActionTerminalEvaluator.ts',
  runtimeEvaluator: 'src/agent/runtime/agentPostActionTerminalEvaluator.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(runtimeEvaluatorSource, /export function evaluateAgentPostActionTerminal/u);
assertSourceDoesNotMatch(sessionSource, /function shouldCompleteAgentSessionV2LaunchedPostAction/u);
assertSourceDoesNotMatch(sessionSource, /function shouldStopAgentSessionV2BlockedManualGate/u);
assertSourceDoesNotMatch(sessionSource, /function createAgentSessionV2LaunchedCompletionAnswer/u);
assertSourceMatches(actionRuntimeSource, /dependencies\.evaluateTerminal\(/u);
assertSourceDoesNotMatch(actionRuntimeSource, /evaluateAgentSessionV2PostActionTerminal/u);
assertSourceMatches(sessionSource, /postActionTerminalEvaluatorDependencies/u);

function createCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'start Example Game from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from launcher',
    toolCall: {
      goal: 'start Example Game from launcher',
      input,
      name,
    },
  };
}

function createResult(
  structuredEvidence: NonNullable<AgentChatCommandResult['stateSummary']>['structuredEvidence'],
  overrides: Partial<AgentChatCommandResult> = {},
): AgentChatCommandResult {
  return {
    ok: true,
    responseText: 'Observed Example Game as the active running window.',
    stateSummary: {
      observedState: ['Active title: Example Game'],
      structuredEvidence,
      verificationEvidence: ['Observed Example Game as the active running window.'],
    },
    verification: 'Observed Example Game as the active running window.',
    ...overrides,
  };
}

function createEntry(command: AgentChatCommand, result: AgentChatCommandResult): AgentSessionV2ToolResultEntry {
  return { command, result };
}

const baseDependencies: AgentPostActionTerminalEvaluatorDependencies = {
  collectAutoRecoveryEvidenceText: (entry) => [
    entry.result.responseText,
    entry.result.verification,
    ...(entry.result.observations ?? []),
    ...(entry.result.stateSummary?.observedState ?? []),
  ].filter(Boolean).join('\n'),
  createAttemptedActionCoverage: () => new Set(['desktop-input', 'in-app-action']),
  createRequestedActionCoverage: () => new Set(['in-app-action']),
  getPostActionState: (entry) => {
    const state = entry?.result.stateSummary?.structuredEvidence?.postActionState;
    return typeof state === 'string' ? state : '';
  },
  hasDirectActionIntent: () => true,
  inferSelectionPostActionState: () => '',
  isActionResultTool: () => false,
  isAutoRecoveryReadCommand: (command) => command.toolCall?.name === 'locate_screen_elements',
  isAutoRecoveryWaitCommand: () => false,
  isInAppActionCovered: (attemptedCoverage) => attemptedCoverage.has('in-app-action'),
  isPostApprovalVerificationCommand: () => false,
  isVerifiedTargetWindowObservation: (entry) => Boolean(
    entry.result.stateSummary?.structuredEvidence?.finalWindow,
  ),
  resolveRecoveryPostActionState: ({ entry }) => {
    const state = entry?.result.stateSummary?.structuredEvidence?.postActionState;
    return typeof state === 'string' ? state : '';
  },
};

const verifiedRecoveryWindowEntry = createEntry(
  createCommand('observe_windows_and_apps', {
    query: 'Example Game',
    recoveryPostActionState: 'unknown',
  }),
  createResult({
    finalWindow: {
      processName: 'ExampleGame.exe',
      title: 'Example Game',
    },
    status: 'success',
    targetMatched: 'Example Game',
  }),
);
const verifiedRecoveryWindowEvaluation = evaluateAgentPostActionTerminal({
  dependencies: baseDependencies,
  latestEntry: verifiedRecoveryWindowEntry,
  sourceText: '/agent start Example Game from launcher',
  toolResults: [verifiedRecoveryWindowEntry],
  userGoal: 'start Example Game from launcher',
});

assert.equal(verifiedRecoveryWindowEvaluation?.kind, 'launched');
assert.equal(verifiedRecoveryWindowEvaluation.status, 'completed');
assert.equal(verifiedRecoveryWindowEvaluation.postActionState, 'launched');
assert.equal(verifiedRecoveryWindowEvaluation.historyReason, 'verified-target-window');
assert.match(verifiedRecoveryWindowEvaluation.finalAnswer, /打开\/启动成功/u);

const outerWindowOnlyDependencies: AgentPostActionTerminalEvaluatorDependencies = {
  ...baseDependencies,
  createAttemptedActionCoverage: () => new Set(['open-or-launch']),
  createRequestedActionCoverage: () => new Set(['in-app-action']),
};
const outerWindowOnlyEvaluation = evaluateAgentPostActionTerminal({
  dependencies: outerWindowOnlyDependencies,
  latestEntry: verifiedRecoveryWindowEntry,
  sourceText: '/agent open Example Launcher and start Example Game',
  toolResults: [verifiedRecoveryWindowEntry],
  userGoal: 'open Example Launcher and start Example Game',
});

assert.equal(
  outerWindowOnlyEvaluation,
  null,
  'A verified outer launcher window must not complete an in-app launch request before the internal target action is attempted.',
);

const plainObservationEntry = createEntry(
  createCommand('observe_windows_and_apps', {
    query: 'Example Game',
  }),
  verifiedRecoveryWindowEntry.result,
);
const plainObservationEvaluation = evaluateAgentPostActionTerminal({
  dependencies: baseDependencies,
  latestEntry: plainObservationEntry,
  sourceText: '/agent start Example Game from launcher',
  toolResults: [plainObservationEntry],
  userGoal: 'start Example Game from launcher',
});

assert.equal(
  plainObservationEvaluation?.kind,
  'launched',
  'A target-scoped window observation may complete launch coverage when its structured window evidence matches.',
);
assert.equal(plainObservationEvaluation?.historyReason, 'verified-target-window');

const verifiedActionDependencies: AgentPostActionTerminalEvaluatorDependencies = {
  ...baseDependencies,
  createAttemptedActionCoverage: () => new Set(['window-move-or-control']),
  createRequestedActionCoverage: () => new Set(['window-move-or-control']),
  isActionResultTool: (command) => command.toolCall?.name === 'execute_desktop_action',
  isVerifiedTargetWindowObservation: () => false,
};
const verifiedActionEntry = createEntry(
  createCommand('execute_desktop_action', {
    action: 'move_window_to_display',
    target: 'Example App',
    targetDisplay: 'secondary',
  }),
  createResult({
    finalDisplay: { id: 'display-2', label: 'Secondary display' },
    finalWindow: {
      displayId: 'display-2',
      displayLabel: 'Secondary display',
      hwnd: 101,
      processName: 'ExampleApp.exe',
      title: 'Example App',
    },
    postActionState: 'completed',
    status: 'success',
    targetMatched: 'Example App',
  }, {
    receipt: {
      status: 'success',
      summaryLines: ['Window moved and verified.'],
      title: 'Verified action receipt',
    },
    responseText: 'Moved Example App to the secondary display.',
  }),
);
const verifiedActionEvaluation = evaluateAgentPostActionTerminal({
  dependencies: verifiedActionDependencies,
  latestEntry: verifiedActionEntry,
  sourceText: '/agent move the currently open Example App window to the secondary display',
  toolResults: [verifiedActionEntry],
  userGoal: 'Move the currently open Example App window to the secondary display.',
});
assert.equal(verifiedActionEvaluation?.kind, 'completed');
assert.equal(verifiedActionEvaluation.status, 'completed');
assert.equal(verifiedActionEvaluation.historyReason, 'verified-action-state');

const unverifiedActionEntry = createEntry(
  verifiedActionEntry.command,
  createResult({
    finalDisplay: { id: 'display-2', label: 'Secondary display' },
    finalWindow: {
      displayId: 'display-2',
      displayLabel: 'Secondary display',
      hwnd: 101,
      processName: 'ExampleApp.exe',
      title: 'Example App',
    },
    status: 'unverified',
    targetMatched: 'Example App',
  }, {
    receipt: {
      status: 'unverified',
      summaryLines: ['Move requested; target state was not verified.'],
      title: 'Unverified action receipt',
    },
    verification: 'Move requested but target state was not verified.',
  }),
);
assert.equal(evaluateAgentPostActionTerminal({
  dependencies: verifiedActionDependencies,
  latestEntry: unverifiedActionEntry,
  sourceText: '/agent move the currently open Example App window to the secondary display',
  toolResults: [unverifiedActionEntry],
  userGoal: 'Move the currently open Example App window to the secondary display.',
}), null);

const loginEntry = createEntry(
  createCommand('execute_desktop_observation', {
    action: 'wait_and_observe',
  }),
  createResult({
    postActionState: 'login_required',
    status: 'unverified',
  }, {
    responseText: 'Visible text: Enter the SMS verification code to continue.',
    verification: 'Post-action visual state: login_required with 2FA verification code.',
  }),
);
const loginEvaluation = evaluateAgentPostActionTerminal({
  dependencies: baseDependencies,
  latestEntry: loginEntry,
  sourceText: '/agent start Example Game from launcher',
  toolResults: [loginEntry],
  userGoal: 'start Example Game from launcher',
});

assert.equal(loginEvaluation?.kind, 'login-required');
assert.equal(loginEvaluation.status, 'needs-user');
assert.equal(loginEvaluation.stepAction, 'ask_user');

const blockedEntry = createEntry(
  createCommand('locate_screen_elements', {
    question: 'AgentSessionV2 auto recovery observation. Read visible blocker.',
  }),
  createResult({
    postActionState: 'blocked',
    status: 'unverified',
  }, {
    responseText: 'Visible permission dialog. User must approve before continuing.',
    stateSummary: {
      missingEvidence: ['Manual permission approval is required.'],
      observedState: ['Visible permission dialog'],
      recommendedRecovery: ['ask_user_manual_gate'],
      structuredEvidence: {
        postActionState: 'blocked',
        status: 'unverified',
      },
    },
  }),
);
const blockedEvaluation = evaluateAgentPostActionTerminal({
  dependencies: baseDependencies,
  latestEntry: blockedEntry,
  sourceText: '/agent start Example Game from launcher',
  toolResults: [blockedEntry],
  userGoal: 'start Example Game from launcher',
});

assert.equal(blockedEvaluation?.kind, 'blocked-manual-gate');
assert.equal(blockedEvaluation.status, 'needs-user');
assert.equal(blockedEvaluation.historyReason, 'manual-gate-blocker-read');

console.log('agent session v2 post action terminal evaluator smoke ok');
