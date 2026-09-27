import assert from 'node:assert/strict';
import {
  createAgentTaskRuntimeV4SessionV2Shadow,
  type AgentTaskRuntimeV4SessionV2ShadowInput,
  type AgentTaskRuntimeV4SessionV2ShadowToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  shadowSource,
  runtimeSource,
  indexSource,
} = readProjectSources({
  indexSource: 'src/agent/legacy/index.ts',
  runtimeSource: 'src/agent/agentTaskRuntimeV4.ts',
  shadowSource: 'src/agent/agentTaskRuntimeV4SessionV2ShadowAdapter.ts',
});

assert.match(shadowSource, /export function createAgentTaskRuntimeV4SessionV2Shadow/u);
assert.match(shadowSource, /target_resolved_without_dispatch/u);
assert.match(shadowSource, /input_dispatched_unverified/u);
assert.match(shadowSource, /verified_success/u);
assert.match(shadowSource, /Verified-looking evidence was found, but no dispatch-capable/u);
assert.match(indexSource, /export \* from '\.\.\/agentTaskRuntimeV4SessionV2ShadowAdapter';/u);
assert.match(runtimeSource, /advanceAgentTaskRuntimeV4/u);

assert.doesNotMatch(
  shadowSource,
  /runAgentSessionV2|toolExecutor|SendInput|SetCursorPos|desktopInputService|executeDesktopInput/u,
  'V4 SessionV2 shadow adapter must not execute sessions, tools, or input backend.',
);

function toolEntry(
  toolName: string,
  options: {
    action?: string;
    assessmentStatus?: string;
    ok?: boolean;
    postActionState?: string;
    receiptStatus?: string;
    stepsJson?: string;
    targetMatched?: string;
    verification?: string;
    visualActionReadiness?: string;
  } = {},
): AgentTaskRuntimeV4SessionV2ShadowToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {
          ...(toolName === 'execute_desktop_input'
            ? { action: options.action ?? 'click' }
            : options.action ? { action: options.action } : {}),
          ...(options.stepsJson ? { stepsJson: options.stepsJson } : {}),
        },
        name: toolName,
      },
    },
    createdAt: 1000,
    result: {
      assessment: options.assessmentStatus ? {
        status: options.assessmentStatus,
        summary: options.assessmentStatus,
      } : null,
      ok: options.ok ?? true,
      receipt: options.receiptStatus ? {
        status: options.receiptStatus,
      } : null,
      stateSummary: {
        structuredEvidence: {
          postActionState: options.postActionState,
          status: options.receiptStatus,
          targetMatched: options.targetMatched,
          visualActionReadiness: options.visualActionReadiness,
        },
        verificationEvidence: options.verification ? [options.verification] : [],
      },
      verification: options.verification,
    },
  };
}

function shadow(input: Partial<AgentTaskRuntimeV4SessionV2ShadowInput>) {
  return createAgentTaskRuntimeV4SessionV2Shadow({
    sourceText: '打开 WeGame 里的英雄联盟',
    status: 'completed',
    taskId: 'shadow-smoke-task',
    toolResults: [],
    userGoal: 'Launch League of Legends from WeGame',
    ...input,
  });
}

const empty = shadow({});
assert.equal(empty.classification, 'no_tool_evidence');
assert.equal(empty.context.currentState, 'initialized');

const productionFactsWithoutInput = shadow({
  productionLifecycleFacts: [{ kind: 'outer-dispatch', tool: 'execute_desktop_action' }],
  toolResults: [toolEntry('execute_desktop_observation', { targetMatched: 'Game', visualActionReadiness: 'ready' })],
});
assert.equal(productionFactsWithoutInput.classification, 'outer_dispatch_only');

const productionFactsWithInput = shadow({
  productionLifecycleFacts: [{ kind: 'action-dispatched', tool: 'execute_desktop_input' }],
  toolResults: [toolEntry('execute_desktop_observation', { postActionState: 'unchanged' })],
});
assert.equal(productionFactsWithInput.classification, 'input_dispatched_unverified');

const productionFactsWithVerifiedInput = shadow({
  productionLifecycleFacts: [
    { kind: 'action-dispatched', tool: 'execute_desktop_input' },
    { kind: 'outcome-verified', tool: 'execute_desktop_observation' },
  ],
  status: 'completed',
  toolResults: [toolEntry('execute_desktop_observation', { postActionState: 'launched' })],
});
assert.equal(productionFactsWithVerifiedInput.classification, 'verified_success');

const productionFactsWithOlderVerification = shadow({
  productionLifecycleFacts: [
    { kind: 'action-dispatched', tool: 'execute_desktop_input' },
    { kind: 'outcome-verified', tool: 'execute_desktop_observation' },
    { kind: 'action-dispatched', tool: 'execute_desktop_input' },
  ],
  status: 'completed',
  toolResults: [toolEntry('execute_desktop_observation', { postActionState: 'unchanged' })],
});
assert.equal(
  productionFactsWithOlderVerification.classification,
  'input_dispatched_unverified',
  'An older verified action must not verify a later unverified dispatch.',
);

const productionFactsWithPendingApproval = shadow({
  pendingApproval: {
    command: {
      kind: 'tool-call',
      toolCall: { input: {}, name: 'execute_desktop_input' },
    },
  },
  productionLifecycleFacts: [{ kind: 'action-dispatched', tool: 'execute_desktop_input' }],
  status: 'needs-approval',
  toolResults: [toolEntry('execute_desktop_observation', { postActionState: 'login_required' })],
});
assert.equal(
  productionFactsWithPendingApproval.classification,
  'approval_pending',
  'pending approval must take precedence over an earlier dispatch fact',
);

const initialPendingApproval = shadow({
  pendingApproval: {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {},
        name: 'execute_desktop_action',
      },
    },
  },
  status: 'needs-approval',
  toolResults: [],
});
assert.equal(initialPendingApproval.classification, 'approval_pending');
assert.ok(
  initialPendingApproval.notes.includes('approvalStage=initial'),
  'pending approval without tool evidence should be marked as the initial approval gate',
);
assert.ok(
  initialPendingApproval.notes.includes('priorToolEvidence=false'),
  'initial pending approval should explicitly show no prior tool evidence',
);

const readOnlyOnly = shadow({
  toolResults: [
    toolEntry('observe_windows_and_apps'),
  ],
});
assert.equal(readOnlyOnly.classification, 'read_only_observation_only');
assert.equal(readOnlyOnly.context.currentState, 'local_recovering');
assert.equal(readOnlyOnly.context.localRecoveryCount, 1);

const completedReadOnly = shadow({
  sourceText: '查看当前运行中的窗口和应用',
  status: 'completed',
  userGoal: '查看当前运行中的窗口和应用',
  toolResults: [
    toolEntry('observe_windows_and_apps', {
      receiptStatus: 'success',
      verification: 'Window/app observation returned current running windows.',
    }),
  ],
});
assert.equal(completedReadOnly.classification, 'verified_success');
assert.equal(completedReadOnly.context.currentState, 'succeeded');
assert.deepEqual(
  completedReadOnly.events.map((event) => event.kind),
  ['start', 'observation-collected', 'evidence-collected', 'outcome-verified'],
);

const locatePendingApproval = shadow({
  pendingApproval: {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {},
        name: 'execute_desktop_input',
      },
    },
  },
  status: 'needs-approval',
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '登录',
      visualActionReadiness: 'ready',
    }),
  ],
});
assert.equal(locatePendingApproval.classification, 'approval_pending');
assert.equal(locatePendingApproval.context.currentState, 'waiting_approval');
assert.ok(
  locatePendingApproval.notes.includes('approvalStage=after-evidence'),
  'pending approval after locate evidence should be marked as after-evidence',
);
assert.deepEqual(
  locatePendingApproval.events.map((event) => event.kind),
  ['start', 'observation-collected', 'target-resolved', 'approval-required'],
);

const locatedButNoDispatch = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '登录',
      visualActionReadiness: 'ready',
    }),
  ],
});
assert.equal(locatedButNoDispatch.classification, 'target_resolved_without_dispatch');
assert.equal(locatedButNoDispatch.context.currentState, 'target_resolved');
assert.match(locatedButNoDispatch.notes.join(' '), /no .*dispatch-capable/u);

const verifiedLookingButNoDispatch = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      receiptStatus: 'success',
      targetMatched: '登录',
      verification: 'verified login button visible',
      visualActionReadiness: 'ready',
    }),
  ],
});
assert.equal(verifiedLookingButNoDispatch.classification, 'target_resolved_without_dispatch');
assert.match(verifiedLookingButNoDispatch.notes.join(' '), /no .*dispatch-capable/u);
assert.equal(verifiedLookingButNoDispatch.context.currentState, 'target_resolved');

const inAppLaunchAndLocateOnly = shadow({
  status: 'budget-exceeded',
  toolResults: [
    toolEntry('execute_desktop_action', {
      action: 'launch_local_app',
      assessmentStatus: 'unverified',
      verification: 'Focused or launched WeGame window, but target game was not verified.',
    }),
    toolEntry('execute_desktop_observation', {
      receiptStatus: 'success',
      verification: 'Observed WeGame login window.',
    }),
    toolEntry('locate_screen_elements', {
      receiptStatus: 'success',
      targetMatched: 'WeGame login control',
      verification: 'Visual action readiness: ready. Login button located.',
      visualActionReadiness: 'ready',
    }),
  ],
  userGoal: 'Open League of Legends inside WeGame',
});
assert.equal(inAppLaunchAndLocateOnly.classification, 'outer_dispatch_only');
assert.equal(inAppLaunchAndLocateOnly.context.currentState, 'target_resolved');
assert.match(inAppLaunchAndLocateOnly.notes.join(' '), /Only outer-app dispatch/u);
assert.equal(inAppLaunchAndLocateOnly.events.some((event) => event.kind === 'action-dispatched'), false);

const chineseInAppOuterDispatchOnly = shadow({
  status: 'budget-exceeded',
  toolResults: [
    toolEntry('execute_desktop_action', {
      action: 'focus_window',
      assessmentStatus: 'completed',
      verification: 'WeGame window focused.',
    }),
    toolEntry('locate_screen_elements', {
      targetMatched: '快速安全登录',
      visualActionReadiness: 'ready',
    }),
  ],
  sourceText: '启动 WeGame 里的英雄联盟',
  userGoal: '启动 WeGame 里的英雄联盟',
});
assert.equal(chineseInAppOuterDispatchOnly.classification, 'outer_dispatch_only');
assert.equal(
  chineseInAppOuterDispatchOnly.events.some((event) => event.kind === 'action-dispatched'),
  false,
  'focusing the outer app must not be reported as an in-app dispatch',
);

const inAppSequenceWithOuterFocusOnly = shadow({
  status: 'budget-exceeded',
  toolResults: [
    toolEntry('execute_desktop_sequence', {
      targetMatched: 'Game',
      visualActionReadiness: 'ready',
      verification: 'The launcher was focused and is ready for the next step.',
    }),
  ],
  sourceText: '打开 Game inside Launcher',
  userGoal: '打开 Game inside Launcher',
});
assert.equal(
  inAppSequenceWithOuterFocusOnly.classification,
  'target_resolved_without_dispatch',
  'an outer-only sequence must not be classified as an in-app dispatch',
);

const inAppSequenceWithInput = shadow({
  status: 'budget-exceeded',
  toolResults: [
    toolEntry('execute_desktop_sequence', {
      stepsJson: JSON.stringify([{
        args: { action: 'click', x: 100, y: 100 },
        tool: 'execute_desktop_input',
      }]),
      targetMatched: 'Game',
      visualActionReadiness: 'ready',
      verification: 'The target click was dispatched.',
    }),
  ],
  sourceText: '打开 Game inside Launcher',
  userGoal: '打开 Game inside Launcher',
});
assert.equal(inAppSequenceWithInput.classification, 'input_dispatched_unverified');

const outerActionWithInputSequence = shadow({
  status: 'budget-exceeded',
  toolResults: [
    toolEntry('execute_desktop_action', {
      action: 'launch_local_app',
      verification: 'The outer launcher window was opened.',
    }),
  ],
  sourceText: '打开 Game inside Launcher',
  userGoal: '打开 Game inside Launcher',
});
assert.equal(
  outerActionWithInputSequence.classification,
  'outer_dispatch_only',
  'an outer launch must remain visible as outer dispatch in the shadow',
);

const dispatchedUnverified = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '登录',
      visualActionReadiness: 'ready',
    }),
    toolEntry('execute_desktop_input', {
      action: 'click',
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Mouse click dispatched but UI unchanged',
    }),
  ],
});
assert.equal(dispatchedUnverified.classification, 'input_dispatched_unverified');
assert.equal(dispatchedUnverified.context.currentState, 'collecting_evidence');
assert.deepEqual(
  dispatchedUnverified.events.map((event) => event.kind),
  [
    'start',
    'observation-collected',
    'target-resolved',
    'approval-granted',
    'action-dispatched',
  ],
);

const verified = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '登录',
      visualActionReadiness: 'ready',
    }),
    toolEntry('execute_desktop_input', {
      action: 'click',
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Mouse click dispatched',
    }),
    toolEntry('execute_desktop_observation', {
      assessmentStatus: 'completed',
      postActionState: 'launched',
      receiptStatus: 'success',
      verification: 'Verified launcher reached game launchable state',
    }),
  ],
});
assert.equal(verified.classification, 'verified_success');
assert.equal(verified.context.currentState, 'succeeded');
assert.deepEqual(
  verified.events.map((event) => event.kind),
  [
    'start',
    'observation-collected',
    'target-resolved',
    'approval-granted',
    'action-dispatched',
    'evidence-collected',
    'outcome-verified',
  ],
);

const verifiedWindowControl = shadow({
  sourceText: 'Move the currently open window to the secondary display and verify it.',
  toolResults: [
    toolEntry('observe_windows_and_apps', {
      receiptStatus: 'success',
      verification: 'Observed the requested open window and available displays.',
    }),
    toolEntry('execute_desktop_action', {
      action: 'move_window_to_display',
      assessmentStatus: 'completed',
      postActionState: 'completed',
      receiptStatus: 'success',
      targetMatched: 'Requested window',
      verification: 'Window moved to the requested display and the final display was verified.',
    }),
  ],
  userGoal: 'Move the currently open window to the secondary display and verify it.',
});
assert.equal(verifiedWindowControl.classification, 'verified_success');
assert.equal(verifiedWindowControl.context.currentState, 'succeeded');
assert.deepEqual(
  verifiedWindowControl.events.map((event) => event.kind),
  [
    'start',
    'observation-collected',
    'target-resolved',
    'approval-granted',
    'action-dispatched',
    'evidence-collected',
    'outcome-verified',
  ],
);

const staleVerificationBeforeLaterDispatch = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '鐧诲綍',
      visualActionReadiness: 'ready',
    }),
    toolEntry('execute_desktop_input', {
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Mouse click dispatched to the login button.',
    }),
    toolEntry('execute_desktop_observation', {
      assessmentStatus: 'completed',
      postActionState: 'launched',
      receiptStatus: 'success',
      verification: 'Verified an earlier launcher state change.',
    }),
    toolEntry('execute_desktop_input', {
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Later mouse click was dispatched, but its outcome is still unverified.',
    }),
  ],
});
assert.equal(
  staleVerificationBeforeLaterDispatch.classification,
  'input_dispatched_unverified',
  'Verification before the latest dispatch must not complete the task.',
);
assert.equal(staleVerificationBeforeLaterDispatch.context.currentState, 'collecting_evidence');

const terminalFailureAfterLatestDispatch = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: '鐧诲綍',
      visualActionReadiness: 'ready',
    }),
    toolEntry('execute_desktop_input', {
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Mouse click dispatched to the login button.',
    }),
    toolEntry('execute_desktop_observation', {
      assessmentStatus: 'completed',
      postActionState: 'launched',
      receiptStatus: 'success',
      verification: 'Verified an earlier launcher state change.',
    }),
    toolEntry('execute_desktop_input', {
      assessmentStatus: 'failed',
      ok: false,
      postActionState: 'unknown',
      verification: 'Latest mouse click dispatch failed.',
    }),
  ],
});
assert.equal(terminalFailureAfterLatestDispatch.classification, 'failed');
assert.equal(terminalFailureAfterLatestDispatch.context.currentState, 'failed');
assert.equal(
  terminalFailureAfterLatestDispatch.events.at(-1)?.kind,
  'fatal-failure',
  'A terminal tool failure after the latest dispatch must override stale success evidence.',
);

console.log('agent runtime v4 session v2 shadow smoke ok');
