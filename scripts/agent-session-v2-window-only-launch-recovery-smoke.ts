import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  createAgentRequestedActionCoverage,
  diagnoseAgentCommandExplicitProhibition,
  diagnoseAgentTaskScopedApprovalContinuation,
  evaluateAgentPostActionTerminal,
  isAgentVerifiedTargetWindowObservation,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/index.ts';
import { createObserveWindowsAndAppsStructuredEvidence } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { runAgentProductionSession } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const target = 'Calculator';
const request = '\u6253\u5f00\u8ba1\u7b97\u5668\uff0c\u7b49\u5f85\u5b83\u7684\u7a97\u53e3\u51fa\u73b0\uff0c\u53ea\u9a8c\u8bc1\u8ba1\u7b97\u5668\u7a97\u53e3\u5df2\u7ecf\u51fa\u73b0\uff0c\u4e0d\u8981\u70b9\u51fb\u6216\u64cd\u4f5c\u5e94\u7528\u5185\u90e8\u63a7\u4ef6\u3002';
const rewrittenGoal = '\u6253\u5f00\u8ba1\u7b97\u5668\u5e94\u7528\uff0c\u7b49\u5f85\u7a97\u53e3\u51fa\u73b0\u5e76\u9a8c\u8bc1\u7a97\u53e3\u5df2\u51fa\u73b0\uff0c\u4e0d\u8fdb\u884c\u4efb\u4f55\u5185\u90e8\u64cd\u4f5c\u3002';
const actionCoverageDependencies = {
  hasDesktopOrganizationRequest: () => false,
  hasWindowMoveToDisplayRequest: () => false,
};

const requestedCoverage = createAgentRequestedActionCoverage({
  dependencies: actionCoverageDependencies,
  sourceText: request,
  userGoal: request,
});
assert.deepEqual(
  [...requestedCoverage],
  ['open-or-launch'],
  'negated internal-control actions must not create in-app or desktop-input coverage',
);

assert.deepEqual(
  [...createAgentRequestedActionCoverage({
    dependencies: actionCoverageDependencies,
    sourceText: request,
    userGoal: rewrittenGoal,
  })],
  ['open-or-launch'],
  'a planner rewrite that preserves the internal-control prohibition must not create in-app coverage',
);

const englishWindowOnlyRequest = `Open ${target}, wait for its window, and only verify that it appears; do not click or interact with internal controls.`;
assert.deepEqual(
  [...createAgentRequestedActionCoverage({
    dependencies: actionCoverageDependencies,
    sourceText: englishWindowOnlyRequest,
    userGoal: englishWindowOnlyRequest,
  })],
  ['open-or-launch'],
  'English negated internal-control actions must remain outside requested coverage',
);

const positiveInAppRequest = `\u6253\u5f00 ${target}\uff0c\u7136\u540e\u70b9\u51fb\u5e94\u7528\u5185\u90e8\u7684\u7ee7\u7eed\u6309\u94ae\u3002`;
assert.equal(
  createAgentRequestedActionCoverage({
    dependencies: actionCoverageDependencies,
    sourceText: positiveInAppRequest,
    userGoal: positiveInAppRequest,
  }).has('in-app-action'),
  true,
  'a positive application-internal action must remain actionable',
);

const negativeThenPositiveRequest = `\u4e0d\u8981\u70b9\u51fb\u5f53\u524d\u9875\u9762\uff1b\u7136\u540e\u6253\u5f00 ${target}\u3002`;
assert.deepEqual(
  [...createAgentRequestedActionCoverage({
    dependencies: actionCoverageDependencies,
    sourceText: negativeThenPositiveRequest,
    userGoal: negativeThenPositiveRequest,
  })],
  ['open-or-launch'],
  'a later positive action must survive removal of an earlier negated clause',
);

const launchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: request,
  kind: 'tool-call',
  sourceText: request,
  toolCall: {
    goal: request,
    input: {
      action: 'launch_local_app',
      target,
    },
    name: 'execute_desktop_action',
  },
};

const unverifiedLaunchResult: AgentChatCommandResult = {
  observations: [
    'Tool: execute_desktop_action',
    'Desktop action: launch_local_app',
    'Launch status: launched-unverified',
    `Launch query: ${target}`,
  ],
  ok: true,
  receipt: {
    evidenceLines: [
      'Launch status: launched-unverified',
      `Launch query: ${target}`,
    ],
    status: 'unverified',
    summaryLines: [
      'Call: execute_desktop_action',
      'Result: launch request accepted, final visible state unverified',
    ],
    title: 'Execution receipt',
    toolName: 'execute_desktop_action',
    verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
  },
  responseText: 'Launch status: launched-unverified',
  verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
};

function createWaitingResult(): AgentChatCommandResult {
  return {
    observations: ['Waited briefly for the requested app window.'],
    ok: true,
    receipt: {
      evidenceLines: ['The requested app window is not verified yet.'],
      status: 'unverified',
      summaryLines: ['Post-action state: waiting_window'],
      title: 'Post-action observation',
      toolName: 'execute_desktop_observation',
      verification: 'The requested app window is not verified yet.',
    },
    responseText: 'Waited briefly; the requested app window still needs verification.',
    stateSummary: {
      structuredEvidence: {
        postActionState: 'waiting_window',
        status: 'unverified',
        targetMatched: target,
      },
    },
    verification: 'The requested app window is not verified yet.',
  };
}

function createVerifiedWindowResult(): AgentChatCommandResult {
  const structuredEvidence = createObserveWindowsAndAppsStructuredEvidence({
    active: null,
    installedApps: [],
    query: target,
    runningApps: [{
      hwnd: 314,
      pid: 42,
      processName: 'CalculatorApp.exe',
      title: target,
    }],
    taskbarPinnedApps: [],
  });
  return {
    assessment: {
      evidence: [
        'tool:observe_windows_and_apps',
        `verification:Observed ${target} as a running window.`,
      ],
      nextStep: null,
      status: 'unverified',
      summary: 'Tool returned, but user-level verification evidence is insufficient',
    },
    observations: [
      `Running 1. CalculatorApp.exe pid=42 hwnd=314 title="${target}"`,
    ],
    ok: true,
    receipt: {
      evidenceLines: [`Observed ${target} as a running window.`],
      status: 'success',
      summaryLines: ['Call: observe_windows_and_apps', 'Running: 1'],
      title: 'Window/app observation',
      toolName: 'observe_windows_and_apps',
      verification: `Observed ${target} as a running window.`,
    },
    responseText: `Observed ${target} as a running window.`,
    stateSummary: {
      structuredEvidence,
      verificationEvidence: [`Observed ${target} as a running window.`],
    },
    verification: `Observed ${target} as a running window.`,
  };
}

const modelSelectedWindowObservationCommand: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: request,
  kind: 'tool-call',
  sourceText: request,
  toolCall: {
    goal: request,
    input: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeRunningApps: true,
      query: target,
    },
    name: 'observe_windows_and_apps',
  },
};
const modelSelectedWindowObservationEntry = {
  command: modelSelectedWindowObservationCommand,
  result: createVerifiedWindowResult(),
};
assert.equal(
  isAgentVerifiedTargetWindowObservation(modelSelectedWindowObservationEntry),
  true,
  'strong scoped target-window evidence must outrank a generic unverified assessment',
);
const modelSelectedTerminal = evaluateAgentPostActionTerminal({
  dependencies: {
    collectAutoRecoveryEvidenceText: () => '',
    createAttemptedActionCoverage: () => new Set(['open-or-launch']),
    createRequestedActionCoverage: () => new Set(['open-or-launch']),
    getPostActionState: () => '',
    hasDirectActionIntent: () => true,
    inferSelectionPostActionState: () => '',
    isActionResultTool: () => false,
    isAutoRecoveryReadCommand: () => false,
    isAutoRecoveryWaitCommand: () => false,
    isInAppActionCovered: () => false,
    isPostApprovalVerificationCommand: () => false,
    isVerifiedTargetWindowObservation: isAgentVerifiedTargetWindowObservation,
    resolveRecoveryPostActionState: () => '',
  },
  latestEntry: modelSelectedWindowObservationEntry,
  sourceText: request,
  toolResults: [
    { command: launchCommand, result: unverifiedLaunchResult },
    modelSelectedWindowObservationEntry,
  ],
  userGoal: rewrittenGoal,
});
assert.equal(
  modelSelectedTerminal?.kind,
  'launched',
  'a model-selected observation with an explicit target must consume matching window evidence after launch',
);

const unscopedWindowObservationEntry = {
  command: {
    ...modelSelectedWindowObservationCommand,
    toolCall: {
      ...modelSelectedWindowObservationCommand.toolCall!,
      input: {
        includeActiveWindow: true,
        includeRunningApps: true,
      },
    },
  },
  result: createVerifiedWindowResult(),
};
const unscopedTerminal = evaluateAgentPostActionTerminal({
  dependencies: {
    collectAutoRecoveryEvidenceText: () => '',
    createAttemptedActionCoverage: () => new Set(['open-or-launch']),
    createRequestedActionCoverage: () => new Set(['open-or-launch']),
    getPostActionState: () => '',
    hasDirectActionIntent: () => true,
    inferSelectionPostActionState: () => '',
    isActionResultTool: () => false,
    isAutoRecoveryReadCommand: () => false,
    isAutoRecoveryWaitCommand: () => false,
    isInAppActionCovered: () => false,
    isPostApprovalVerificationCommand: () => false,
    isVerifiedTargetWindowObservation: isAgentVerifiedTargetWindowObservation,
    resolveRecoveryPostActionState: () => '',
  },
  latestEntry: unscopedWindowObservationEntry,
  sourceText: request,
  toolResults: [
    { command: launchCommand, result: unverifiedLaunchResult },
    unscopedWindowObservationEntry,
  ],
  userGoal: request,
});
assert.equal(
  unscopedTerminal,
  null,
  'an unscoped running-window observation must not complete a launch task by coincidence',
);

const observedTools: string[] = [];
let modelCallCount = 0;
const result = await runAgentProductionSession({
  approvedToolResult: {
    command: launchCommand,
    result: unverifiedLaunchResult,
  },
  maxSteps: 6,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
      action: 'final_answer',
      message: 'Calculator window appeared.',
      understanding: {
        completedGoals: ['Calculator window appeared'],
        remainingGoals: [],
        successCriteria: 'Calculator window appeared',
        userNeed: request,
        verificationEvidence: ['Observed Calculator as a running window.'],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: request,
  toolExecutor: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    observedTools.push(toolName);
    assert.notEqual(
      toolName,
      'locate_screen_elements',
      'window-only verification must not enter application-internal visual targeting',
    );
    if (toolName === 'execute_desktop_observation') {
      return createWaitingResult();
    }
    assert.equal(toolName, 'observe_windows_and_apps');
    return createVerifiedWindowResult();
  },
  userGoal: request,
});

assert.equal(modelCallCount, 0, result.continuation.historyLines.join('\n'));
assert.deepEqual(observedTools, ['execute_desktop_observation', 'execute_desktop_observation', 'observe_windows_and_apps']);
assert.equal(result.status, 'completed', result.continuation.historyLines.join('\n'));
assert.match(result.continuation.historyLines.join('\n'), /verified-target-window/u);

const pendingClickCommand: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: 'Click an application-internal control.',
  kind: 'tool-call',
  sourceText: request,
  toolCall: {
    goal: request,
    input: {
      stepsJson: JSON.stringify([{
        args: {
          action: 'click',
          coordinateSpace: 'native-screen',
          x: 45,
          y: 135,
        },
        tool: 'execute_desktop_input',
      }]),
    },
    name: 'execute_desktop_sequence',
  },
};
const approvedPlan = buildAgentPermissionRoute(launchCommand).plan;
const pendingPlan = buildAgentPermissionRoute(pendingClickCommand).plan;
assert.ok(approvedPlan);
assert.ok(pendingPlan);
const prohibitedContinuation = diagnoseAgentTaskScopedApprovalContinuation({
  approvedCommand: launchCommand,
  approvedPlan,
  pendingCommand: pendingClickCommand,
  pendingPlan,
});
assert.equal(prohibitedContinuation.allowed, false);
assert.equal(prohibitedContinuation.reason, 'explicit-prohibition');

const prohibitedApproval = diagnoseAgentCommandExplicitProhibition({
  command: pendingClickCommand,
  sourceText: request,
  userGoal: rewrittenGoal,
});
assert.equal(prohibitedApproval.prohibitionConflict, true);
assert.deepEqual(prohibitedApproval.conflictingActionKinds, ['desktop-input']);

let prohibitedToolExecutionCount = 0;
const prohibitedApprovalResult = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      coordinateSpace: 'native-screen',
      x: 45,
      y: 135,
    },
    reason: 'Click an application-internal control.',
    tool: 'execute_desktop_input',
  }),
  settings: {} as PetConfig['settings'],
  sourceText: request,
  toolExecutor: async () => {
    prohibitedToolExecutionCount += 1;
    throw new Error('A prohibited approval command must not reach the tool executor.');
  },
  userGoal: rewrittenGoal,
});
assert.equal(prohibitedApprovalResult.status, 'failed');
assert.equal(prohibitedApprovalResult.pendingApproval, null);
assert.equal(prohibitedToolExecutionCount, 0);
assert.match(
  prohibitedApprovalResult.continuation.historyLines.join('\n'),
  /rejected prohibited approval before assembly/u,
);

console.log('agent session v2 window-only launch recovery smoke ok');
