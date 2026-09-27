import assert from 'node:assert/strict';

import {
  resolveAgentTargetResolution,
  resolveAgentTargetResolutionCommand,
  runAgentTargetResolutionExecution,
  type AgentActionCoverageDependencies,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/index.ts';
import { resolveAgentWindowTargetBeforeDispatch } from '../src/agent/runtime/agentWindowTargetResolutionRuntime.ts';

const baseContext = {
  alreadyResolvedSinceLastDispatch: false,
  directActionRequested: true,
  missingInAppActionCoverage: true,
  sourceHwnd: 2048,
  sourceQuery: 'Example Launcher',
  targetText: 'Example Target',
  windowEvidenceAvailable: true,
};

const commandOutcome = resolveAgentTargetResolutionCommand({
  context: baseContext,
  sourceText: '/agent open Example Target inside Example Launcher',
  taskState: { nextSubgoalAction: 'execute' },
  userGoal: 'Open Example Target inside Example Launcher',
});
assert.equal(commandOutcome.kind, 'command');
assert.equal(commandOutcome.command?.toolCall?.name, 'locate_screen_elements');
assert.equal(commandOutcome.command?.toolCall?.input.hwnd, 2048);
assert.equal(commandOutcome.command?.toolCall?.input.allowScreenFallback, false);
assert.equal(commandOutcome.command?.toolCall?.input.sourceQuery, 'Example Launcher');
assert.equal(commandOutcome.command?.toolCall?.input.targetText, 'Example Target');

const verifyOutcome = resolveAgentTargetResolutionCommand({
  context: baseContext,
  sourceText: '/agent open Example Target inside Example Launcher',
  taskState: { nextSubgoalAction: 'verify' },
  userGoal: 'Open Example Target inside Example Launcher',
});
assert.equal(verifyOutcome.kind, 'not-selected');
assert.equal(verifyOutcome.command, null);

const resumedTaskOutcome = resolveAgentTargetResolutionCommand({
  context: baseContext,
  sourceText: '/agent open Example Target inside Example Launcher',
  taskState: { nextSubgoalAction: 'resume' },
  userGoal: 'Open Example Target inside Example Launcher',
});
assert.equal(
  resumedTaskOutcome.kind,
  'command',
  'an active task resumed after outer-app observation must continue to in-app target resolution',
);
assert.equal(resumedTaskOutcome.command?.toolCall?.input.targetText, 'Example Target');

const missingWindowOutcome = resolveAgentTargetResolutionCommand({
  context: {
    ...baseContext,
    sourceHwnd: null,
    sourceQuery: null,
    windowEvidenceAvailable: false,
  },
  sourceText: '/agent open Example Target inside Example Launcher',
  taskState: { nextSubgoalAction: 'execute' },
  userGoal: 'Open Example Target inside Example Launcher',
});
assert.equal(missingWindowOutcome.kind, 'blocked');

const duplicateOutcome = resolveAgentTargetResolutionCommand({
  context: {
    ...baseContext,
    alreadyResolvedSinceLastDispatch: true,
  },
  sourceText: '/agent open Example Target inside Example Launcher',
  taskState: { nextSubgoalAction: 'execute' },
  userGoal: 'Open Example Target inside Example Launcher',
});
assert.equal(duplicateOutcome.kind, 'not-selected');

const actionCoverageDependencies: AgentActionCoverageDependencies = {
  getPostActionState: () => '',
  hasDesktopOrganizationRequest: () => false,
  hasWindowMoveToDisplayRequest: () => false,
  isAutoRecoveryReadCommand: () => false,
  isAutoRecoveryWaitCommand: () => false,
  isPostApprovalVerificationCommand: () => false,
  isVerifiedTargetWindowObservation: (entry) => Boolean(
    entry.result.stateSummary?.structuredEvidence?.finalWindow,
  ),
};

const sourceWindowEntry: AgentRuntimeToolResultEntry = {
  command: {
    capabilityId: 'desktop-action',
    instruction: 'Open Example Target inside Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Target inside Example Launcher',
    toolCall: {
      goal: 'Open Example Target inside Example Launcher',
      input: { action: 'launch_local_app', target: 'Example Launcher' },
      name: 'execute_desktop_action',
    },
  },
  result: {
    ok: true,
    responseText: 'Example Launcher window opened.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: {
          hwnd: 4096,
          processName: 'example-launcher.exe',
          title: 'Example Launcher',
        },
        observationCapturedAt: Date.now(),
        status: 'success',
        targetMatched: 'Example Launcher',
      },
    },
  },
};

const missingTimestampWindowEntry: AgentRuntimeToolResultEntry = {
  ...sourceWindowEntry,
  result: {
    ...sourceWindowEntry.result,
    stateSummary: {
      structuredEvidence: {
        finalWindow: sourceWindowEntry.result.stateSummary?.structuredEvidence?.finalWindow,
        status: 'success',
        targetMatched: 'Example Launcher',
      },
    },
  },
};
const missingTimestampResolution = resolveAgentWindowTargetBeforeDispatch({
  args: { action: 'focus_window', query: 'Example Launcher' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [missingTimestampWindowEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(
  missingTimestampResolution.kind,
  'observe',
  'Window identity without freshness evidence must trigger a new observation.',
);

const loginGateEntry: AgentRuntimeToolResultEntry = {
  ...sourceWindowEntry,
  result: {
    ok: true,
    responseText: 'The launcher shows a login page with a saved account and a continue control.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 4096, processName: 'example-launcher.exe', title: 'Example Launcher' },
        postActionState: 'login_required',
        status: 'success',
      },
    },
  },
};
const loginGateOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: loginGateEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry, loginGateEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(loginGateOutcome.kind, 'command');
assert.match(String(loginGateOutcome.command?.toolCall?.input.targetText), /登录|继续|login|continue/iu);

const runtimeOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: sourceWindowEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(runtimeOutcome.kind, 'command');
assert.equal(runtimeOutcome.command?.toolCall?.input.hwnd, 4096);
assert.equal(runtimeOutcome.command?.toolCall?.input.sourceQuery, 'Example Launcher');
assert.equal(runtimeOutcome.command?.toolCall?.input.targetText, 'Example Target');

const noWindowRuntimeOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: null,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(noWindowRuntimeOutcome.kind, 'blocked');

const locateEntry: AgentRuntimeToolResultEntry = {
  command: runtimeOutcome.command!,
  result: { ok: true, responseText: 'Example Target located.' },
};
const duplicateRuntimeOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: locateEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry, locateEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(duplicateRuntimeOutcome.kind, 'not-selected');

const unverifiedLocateEntry: AgentRuntimeToolResultEntry = {
  ...locateEntry,
  result: {
    ...locateEntry.result,
    receipt: { status: 'unverified' },
  },
};
const unverifiedLocateOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: unverifiedLocateEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry, unverifiedLocateEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(
  unverifiedLocateOutcome.kind,
  'command',
  'an unverified locate result must not suppress the next target-resolution observation',
);

const scopedDispatchEntry: AgentRuntimeToolResultEntry = {
  command: {
    capabilityId: 'desktop-sequence',
    instruction: sourceWindowEntry.command.instruction,
    kind: 'tool-call',
    sourceText: sourceWindowEntry.command.sourceText,
    toolCall: {
      actionScope: {
        completion: 'intermediate',
        subgoalId: 'subgoal:example-intermediate-action',
        targetRef: 'Example intermediate action',
        taskGoalId: 'goal:example-target',
      },
      goal: sourceWindowEntry.command.instruction,
      input: {
        stepsJson: JSON.stringify([{
          args: { action: 'click', x: 700, y: 500 },
          tool: 'execute_desktop_input',
        }]),
      },
      name: 'execute_desktop_sequence',
    },
  },
  result: { ok: true, responseText: 'Input dispatched; verification pending.' },
};
const freshRuntimeOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: scopedDispatchEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry, locateEntry, scopedDispatchEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(freshRuntimeOutcome.kind, 'command');
assert.equal(freshRuntimeOutcome.command?.toolCall?.input.hwnd, 4096);

const windowScopedVisualEntry: AgentRuntimeToolResultEntry = {
  command: {
    capabilityId: 'desktop-observation',
    instruction: sourceWindowEntry.command.instruction,
    kind: 'tool-call',
    sourceText: sourceWindowEntry.command.sourceText,
    toolCall: {
      goal: sourceWindowEntry.command.instruction,
      input: {
        action: 'locate_element',
        sourceQuery: 'Example Launcher',
        sourceType: 'window',
        targetText: 'Example Target',
      },
      name: 'locate_screen_elements',
    },
  },
  result: {
    ok: true,
    responseText: 'Example Target is visible inside Example Launcher.',
    stateSummary: {
      structuredEvidence: {
        targetMatched: 'Example Target',
        visualActionReadiness: 'needs-target-selection',
      },
    },
  },
};

const genericActionableLocateEntry: AgentRuntimeToolResultEntry = {
  ...windowScopedVisualEntry,
  result: {
    ...windowScopedVisualEntry.result,
    stateSummary: {
      structuredEvidence: {
        captureSourceType: 'window',
        elementCenter: { coordinateSpace: 'native-screen', x: 1200, y: 700 },
        primaryAction: 'Launch',
        targetMatched: 'Example Target',
        visualActionReadiness: 'ready',
      },
    },
  },
};
const genericLocateAfterOuterObservation = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: genericActionableLocateEntry,
  taskState: { nextSubgoalAction: 'resume' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [sourceWindowEntry, genericActionableLocateEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(
  genericLocateAfterOuterObservation.kind,
  'not-selected',
  'an already actionable generic window locate must prevent a second target-resolution pass',
);
const windowScopedContinuationOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: scopedDispatchEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [windowScopedVisualEntry, scopedDispatchEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(windowScopedContinuationOutcome.kind, 'command');
assert.equal(windowScopedContinuationOutcome.command?.toolCall?.input.hwnd, undefined);
assert.equal(windowScopedContinuationOutcome.command?.toolCall?.input.sourceQuery, 'Example Launcher');

const screenFallbackVisualEntry: AgentRuntimeToolResultEntry = {
  ...windowScopedVisualEntry,
  result: {
    ...windowScopedVisualEntry.result,
    stateSummary: {
      structuredEvidence: {
        captureSourceType: 'screen',
        captureTrusted: true,
        targetMatched: 'Example Target',
      },
    },
  },
};
const screenFallbackContinuationOutcome = resolveAgentTargetResolution({
  actionCoverageDependencies,
  latestEntry: scopedDispatchEntry,
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  toolResults: [screenFallbackVisualEntry, scopedDispatchEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(screenFallbackContinuationOutcome.kind, 'blocked');

function createTimingTracker(stopReason: 'max-tool-calls' | null = null) {
  return {
    beginEntry: (
      kind: 'tool',
      label: string,
      stepIndex: number,
      detail?: string | null,
    ): AgentRuntimeTimingEntry => ({
      detail,
      id: `timing:${stepIndex}`,
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
    markStopReason: (reason: 'max-tool-calls') => {
      assert.equal(reason, stopReason);
    },
  };
}

const executionTrace: AgentRuntimeTraceEventDraft[] = [];
const lifecycleKinds: string[] = [];
const executionOutcome = await runAgentTargetResolutionExecution({
  actionCoverageDependencies,
  appendTraceEvent: (event) => executionTrace.push(event),
  executeCommand: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      ok: true,
      responseText: 'Example Target actionable control located.',
      stateSummary: {
        structuredEvidence: {
          primaryAction: 'Open',
          targetMatched: 'Example Target',
          visualActionReadiness: 'ready',
        },
      },
    };
  },
  getTimingDetail: () => 'target-resolution-test',
  isCancellationRequested: () => false,
  latestEntry: sourceWindowEntry,
  onCollected: ({ progressEvent }) => {
    lifecycleKinds.push(progressEvent.taskTransition?.kind ?? 'missing');
  },
  onStarted: ({ progressEvent }) => {
    lifecycleKinds.push(progressEvent.taskTransition?.kind ?? 'missing');
  },
  resolveTimingStatus: () => 'success',
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  stepIndex: 4,
  timingTracker: createTimingTracker(),
  toolResults: [sourceWindowEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(executionOutcome.kind, 'executed');
assert.deepEqual(lifecycleKinds, ['target-resolution-started', 'target-resolution-collected']);
assert.deepEqual(executionTrace.map((event) => event.type), ['tool_started', 'tool_finished']);
if (executionOutcome.kind === 'executed') {
  assert.equal(executionOutcome.started.step.index, 4);
  assert.equal(executionOutcome.collected.step.index, 5);
  assert.equal(executionOutcome.collected.entry.result.ok, true);
}

let budgetDispatchCount = 0;
const budgetOutcome = await runAgentTargetResolutionExecution({
  actionCoverageDependencies,
  appendTraceEvent: () => undefined,
  executeCommand: async () => {
    budgetDispatchCount += 1;
    return { ok: true, responseText: 'unexpected dispatch' };
  },
  getTimingDetail: () => 'target-resolution-budget-test',
  isCancellationRequested: () => false,
  latestEntry: sourceWindowEntry,
  resolveTimingStatus: () => 'success',
  taskState: { nextSubgoalAction: 'execute' },
  sourceText: sourceWindowEntry.command.sourceText,
  stepIndex: 4,
  timingTracker: createTimingTracker('max-tool-calls'),
  toolResults: [sourceWindowEntry],
  userGoal: sourceWindowEntry.command.instruction,
});
assert.equal(budgetOutcome.kind, 'budget-exceeded');
assert.equal(budgetDispatchCount, 0);

console.log('agent target resolution runtime smoke ok');
