import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  resolveAgentVerificationCommand,
  runAgentVerificationContinuation,
  runAgentVerificationExecution,
  transitionAgentVerificationOutcome,
  type AgentActionRuntimeDependencies,
  type AgentActionCoverageDependencies,
  type AgentChatCommand,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/index.ts';

const sourceText = '/agent click Continue inside Example App';
const userGoal = 'Click Continue inside Example App';

const actionCoverageDependencies: AgentActionCoverageDependencies = {
  getPostActionState: () => '',
  hasDesktopOrganizationRequest: () => false,
  hasWindowMoveToDisplayRequest: () => false,
  isAutoRecoveryReadCommand: () => false,
  isAutoRecoveryWaitCommand: () => false,
  isPostApprovalVerificationCommand: () => false,
  isVerifiedTargetWindowObservation: () => false,
};

function actionEntry(command: AgentChatCommand): AgentRuntimeToolResultEntry {
  return {
    command,
    result: {
      ok: true,
      responseText: 'Desktop input dispatched; visible outcome is not yet verified.',
      verification: 'Input backend returned successfully, verification pending.',
    },
  };
}

const clickEntry = actionEntry({
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    actionScope: {
      completion: 'terminal',
      subgoalId: 'subgoal:continue',
      targetRef: 'Continue',
      taskGoalId: 'goal:continue-example-app',
    },
    goal: userGoal,
    input: { action: 'click', x: 600, y: 420 },
    name: 'execute_desktop_input',
  },
});

const visualResolution = resolveAgentVerificationCommand({
  actionCoverageDependencies,
  latestEntry: clickEntry,
  sourceText,
  taskState: { nextSubgoalAction: 'verify' },
  toolResults: [clickEntry],
  userGoal,
});
assert.equal(visualResolution.kind, 'command');
assert.equal(visualResolution.command?.toolCall?.name, 'execute_desktop_observation');
assert.equal(visualResolution.command?.toolCall?.input.action, 'summarize_visual_snapshot');

const executeSelection = resolveAgentVerificationCommand({
  actionCoverageDependencies,
  latestEntry: clickEntry,
  sourceText,
  taskState: { nextSubgoalAction: 'execute' },
  toolResults: [clickEntry],
  userGoal,
});
assert.equal(executeSelection.kind, 'not-selected');

const launchEntry = actionEntry({
  capabilityId: 'app-launcher',
  instruction: 'Open Example App',
  kind: 'tool-call',
  sourceText: '/agent open Example App',
  toolCall: {
    goal: 'Open Example App',
    input: { action: 'launch_local_app', target: 'Example App' },
    name: 'execute_desktop_action',
  },
});
const windowResolution = resolveAgentVerificationCommand({
  actionCoverageDependencies,
  latestEntry: launchEntry,
  sourceText: launchEntry.command.sourceText,
  taskState: { nextSubgoalAction: 'verify' },
  toolResults: [launchEntry],
  userGoal: launchEntry.command.instruction,
});
assert.equal(windowResolution.kind, 'command');
assert.equal(windowResolution.command?.toolCall?.name, 'observe_windows_and_apps');

function createTimingTracker(stopReason: 'max-tool-calls' | null = null) {
  return {
    beginEntry: (
      kind: 'tool',
      label: string,
      stepIndex: number,
      detail?: string | null,
    ): AgentRuntimeTimingEntry => ({
      detail,
      id: `verification:${stepIndex}`,
      kind,
      label,
      startedAt: 1,
      status: 'running',
      stepIndex,
    }),
    finishEntry: (
      entry: AgentRuntimeTimingEntry,
      status: AgentRuntimeTimingEntryStatus,
      detail?: string | null,
    ): AgentRuntimeTimingEntry => ({
      ...entry,
      detail,
      durationMs: 1,
      endedAt: 2,
      status,
    }),
    getBudgetStopReason: () => stopReason,
    markStopReason: (reason: 'max-tool-calls') => assert.equal(reason, stopReason),
  };
}

const traceEvents: AgentRuntimeTraceEventDraft[] = [];
const lifecycleKinds: string[] = [];
const execution = await runAgentVerificationExecution({
  actionCoverageDependencies,
  appendTraceEvent: (event) => traceEvents.push(event),
  executeCommand: async (command) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    return {
      ok: true,
      responseText: 'Example App advanced to the expected state.',
      stateSummary: {
        structuredEvidence: {
          postActionState: 'launched',
          status: 'success',
          targetMatched: 'Example App',
        },
      },
    };
  },
  getTimingDetail: () => 'verification-test',
  isCancellationRequested: () => false,
  latestEntry: clickEntry,
  onCollected: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? 'missing'),
  onStarted: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? 'missing'),
  resolveTimingStatus: () => 'success',
  taskState: { nextSubgoalAction: 'verify' },
  sourceText,
  stepIndex: 6,
  timingTracker: createTimingTracker(),
  toolResults: [clickEntry],
  userGoal,
});
assert.equal(execution.kind, 'executed');
assert.deepEqual(lifecycleKinds, ['verification-started', 'verification-collected']);
assert.deepEqual(
  traceEvents.map((event) => event.type),
  ['permission_routed', 'tool_started', 'tool_finished'],
);
if (execution.kind === 'executed') {
  assert.equal(execution.collected.step.index, 7);
  assert.equal(execution.collected.entry.result.ok, true);
}

let budgetDispatchCount = 0;
const budgetResult = await runAgentVerificationExecution({
  actionCoverageDependencies,
  appendTraceEvent: () => undefined,
  executeCommand: async () => {
    budgetDispatchCount += 1;
    return { ok: true, responseText: 'unexpected dispatch' };
  },
  getTimingDetail: () => 'verification-budget-test',
  isCancellationRequested: () => false,
  latestEntry: clickEntry,
  resolveTimingStatus: () => 'success',
  taskState: { nextSubgoalAction: 'verify' },
  sourceText,
  stepIndex: 6,
  timingTracker: createTimingTracker('max-tool-calls'),
  toolResults: [clickEntry],
  userGoal,
});
assert.equal(budgetResult.kind, 'budget-exceeded');
assert.equal(budgetDispatchCount, 0);

const verificationEntry: AgentRuntimeToolResultEntry = {
  command: visualResolution.command!,
  result: {
    ok: true,
    responseText: 'Verification returned current application evidence.',
  },
};

function createOutcomeDependencies(options: {
  attemptedCoverage?: string[];
  requestedCoverage?: string[];
  postActionState?: string;
  terminal?: ReturnType<AgentActionRuntimeDependencies['evaluateTerminal']>;
} = {}): AgentActionRuntimeDependencies {
  return {
    createAttemptedActionCoverage: () => new Set(options.attemptedCoverage ?? ['desktop-input', 'in-app-action']),
    createRequestedActionCoverage: () => new Set(options.requestedCoverage ?? ['in-app-action']),
    evaluateTerminal: () => options.terminal ?? null,
    hasDirectActionIntent: () => true,
    isActionKindCovered: (kind, attemptedCoverage) => attemptedCoverage.has(kind),
    isReadOnlyToolResult: () => false,
    resolvePostActionState: () => options.postActionState ?? '',
  };
}

let terminalApprovalChecks = 0;
const terminalTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({
    postActionState: 'launched',
    terminal: {
      finalAnswer: 'Example App launched.',
      kind: 'launched',
      postActionState: 'launched',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'Evidence Engine authorized completion.',
    },
  }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => {
    terminalApprovalChecks += 1;
    return null;
  },
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(terminalTransition.kind, 'terminal');
assert.equal(terminalApprovalChecks, 0);

const approvalCommand: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: { action: 'click', x: 600, y: 420 },
    name: 'execute_desktop_input',
  },
};
const approvalRoute = buildAgentPermissionRoute(approvalCommand);
assert.ok(approvalRoute.plan);
const approvalTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({ attemptedCoverage: ['desktop-input'] }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => ({
    command: approvalCommand,
    plan: approvalRoute.plan!,
    reason: 'Verification found an actionable Continue control.',
    routeSummary: approvalRoute.summary,
  }),
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(approvalTransition.kind, 'approval');
assert.equal(approvalTransition.recoveryDecision, null);

// A different attempted action must not turn an entirely unattempted request into recovery.
const unattemptedRequestTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({ attemptedCoverage: ['desktop-input'] }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => null,
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(unattemptedRequestTransition.actionDecision.actionAttempted, false);
assert.equal(unattemptedRequestTransition.actionDecision.status, 'uncertain');
assert.equal(unattemptedRequestTransition.kind, 'refine');
assert.equal(unattemptedRequestTransition.recoveryDecision?.action, 'no-recovery');

const targetResolutionTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({
    attemptedCoverage: ['desktop-input'],
    requestedCoverage: ['desktop-input', 'in-app-action'],
  }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => null,
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(targetResolutionTransition.actionDecision.actionAttempted, true);
assert.equal(targetResolutionTransition.actionDecision.status, 'needs-recovery');
assert.equal(targetResolutionTransition.kind, 'target-resolution');
assert.equal(targetResolutionTransition.recoveryDecision?.action, 'automatic-observation');

const unavailableTargetResolutionTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({
    attemptedCoverage: ['desktop-input'],
    requestedCoverage: ['desktop-input', 'in-app-action'],
  }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => null,
  sourceText,
  targetResolutionAvailable: false,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(unavailableTargetResolutionTransition.kind, 'recovery');
assert.equal(unavailableTargetResolutionTransition.recoveryDecision?.action, 'automatic-observation');
assert.match(unavailableTargetResolutionTransition.reason, /Target resolution is not eligible/u);

const explicitRecoveryTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({
    attemptedCoverage: ['desktop-input'],
    requestedCoverage: ['desktop-input', 'in-app-action'],
  }),
  latestEntry: {
    ...verificationEntry,
    result: {
      ...verificationEntry.result,
      stateSummary: {
        structuredEvidence: {
          postActionRecovery: {
            nextArgs: { action: 'locate_element' },
            nextTool: 'locate_screen_elements',
            reason: 'Locate the primary action associated with the selected target.',
            strategy: 're-locate-target',
          },
        },
      },
    },
  },
  resolveVisualApproval: () => null,
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(explicitRecoveryTransition.kind, 'recovery');
assert.equal(explicitRecoveryTransition.recoveryDecision?.action, 'automatic-observation');

const loadingTransition = transitionAgentVerificationOutcome({
  actionRuntimeDependencies: createOutcomeDependencies({ postActionState: 'loading' }),
  latestEntry: verificationEntry,
  resolveVisualApproval: () => null,
  sourceText,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.equal(loadingTransition.kind, 'recovery');
assert.equal(loadingTransition.recoveryDecision?.action, 'wait');

const continuationAdapterCalls: string[] = [];
const createContinuationAdapter = (kind: string, finalResult: string | null = null) => async () => {
  continuationAdapterCalls.push(kind);
  return { executed: true, finalResult };
};
const verificationContinuation = await runAgentVerificationContinuation({
  actionRuntimeDependencies: createOutcomeDependencies({
    attemptedCoverage: ['desktop-input'],
    requestedCoverage: ['desktop-input', 'in-app-action'],
  }),
  adapters: {
    approval: createContinuationAdapter('approval'),
    planning: createContinuationAdapter('planning'),
    recovery: createContinuationAdapter('recovery'),
    refine: createContinuationAdapter('refine'),
    targetResolution: createContinuationAdapter('targetResolution', 'target-resolution-ran'),
    terminal: createContinuationAdapter('terminal'),
    verification: createContinuationAdapter('verification'),
  },
  latestEntry: verificationEntry,
  resolveVisualApproval: () => null,
  sourceText,
  stepIndex: 12,
  toolResults: [clickEntry, verificationEntry],
  userGoal,
});
assert.deepEqual(continuationAdapterCalls, ['targetResolution']);
assert.equal(verificationContinuation.adapterKind, 'targetResolution');
assert.equal(verificationContinuation.transition.actionDecision.actionAttempted, true);
assert.equal(verificationContinuation.transition.kind, 'target-resolution');
assert.equal(verificationContinuation.finalResult, 'target-resolution-ran');
assert.equal(verificationContinuation.loopDecision.action, 'return-final');

console.log('agent verification runtime smoke ok');
