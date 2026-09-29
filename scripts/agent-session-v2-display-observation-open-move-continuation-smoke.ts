import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommandResult,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const sourceText = '/agent 用浏览器打开哔哩哔哩，并将浏览器窗口移动到副屏';
const userGoal = '用浏览器打开哔哩哔哩，并将浏览器窗口移动到副屏';

let modelCallCount = 0;
const modelCaller: AgentSessionV2ModelCaller = async () => {
  modelCallCount += 1;
  assert.equal(modelCallCount, 1, 'display evidence should deterministically continue without a second model call');
  return JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_display_info',
      displayTarget: 'secondary',
    },
    reason: 'Observe the available displays before moving the browser window.',
    tool: 'execute_desktop_observation',
    understanding: {
      remainingGoals: ['open Bilibili', 'move the browser window to the secondary display'],
      successCriteria: 'Bilibili is open in a browser window on the secondary display.',
      userNeed: userGoal,
      verificationStatus: 'unknown',
    },
  });
};

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText,
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'get_display_info');
    return {
      ok: true,
      responseText: [
        '检测到 2 个屏幕：',
        '1. Redmi 27 NQ（主屏）',
        '2. LC34G55T（副屏）',
      ].join('\n'),
      verification: 'Display topology observed successfully.',
    };
  },
  userGoal,
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');

const steps = JSON.parse(String(result.pendingApproval?.command.toolCall?.input.stepsJson ?? '[]')) as Array<{
  args?: Record<string, unknown>;
  tool?: string;
}>;
assert.equal(steps.length, 2);
assert.equal(steps[0]?.args?.action, 'search_web');
assert.equal(steps[0]?.args?.query, '哔哩哔哩');
assert.equal(steps[1]?.args?.action, 'move_window_to_display');
assert.equal(steps[1]?.args?.targetDisplay, 'secondary');

const existingWindowSourceText = '\u628a\u5f53\u524d\u6253\u5f00\u7684\u8bb0\u4e8b\u672c\u7a97\u53e3\u79fb\u52a8\u5230\u526f\u5c4f\uff0c\u5e76\u9a8c\u8bc1\u79fb\u52a8\u7ed3\u679c\u3002';
const existingWindowUserGoal = 'Move the currently open Notepad window to the secondary monitor and verify that it moved correctly.';
let existingWindowModelCallCount = 0;
let existingWindowToolCallCount = 0;
const existingWindowResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async () => {
    existingWindowModelCallCount += 1;
    if (existingWindowModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'get_display_info',
          displayTarget: 'secondary',
        },
        reason: 'Observe displays before moving the existing window.',
        tool: 'execute_desktop_observation',
        understanding: {
          remainingGoals: ['move the existing Notepad window to the secondary display'],
          successCriteria: 'The existing Notepad window is verified on the secondary display.',
          userNeed: existingWindowUserGoal,
          verificationStatus: 'unknown',
        },
      });
    }

    if (existingWindowModelCallCount === 2) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'move_window_to_display',
          fallbackToActiveWindow: false,
          target: '\u8bb0\u4e8b\u672c',
          targetDisplay: 'secondary',
        },
        reason: 'Move the requested existing window after display observation.',
        tool: 'execute_desktop_action',
        understanding: {
          remainingGoals: ['move the existing Notepad window to the secondary display'],
          successCriteria: 'The existing Notepad window is verified on the secondary display.',
          userNeed: existingWindowUserGoal,
          verificationStatus: 'partial',
        },
      });
    }

    throw new Error('display and window evidence should be consumed before a third model call');
  },
  settings: {} as PetConfig['settings'],
  sourceText: existingWindowSourceText,
  toolExecutor: async (command) => {
    existingWindowToolCallCount += 1;
    if (command.toolCall?.name === 'execute_desktop_observation') {
      return {
        ok: true,
        responseText: '\u68c0\u6d4b\u5230 2 \u4e2a\u5c4f\u5e55\uff1a\u4e3b\u5c4f\u548c\u526f\u5c4f\u3002',
        verification: 'Display topology observed successfully.',
      };
    }

    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    assert.equal(command.toolCall?.input.query, undefined);
    return {
      ok: true,
      responseText: 'Running window: Notepad pid=32664 hwnd=1377170 title="New document - Notepad".',
      stateSummary: {
        structuredEvidence: {
          status: 'success',
          targetCandidates: [
            {
              confidence: 'medium',
              label: 'Notepad - New document - Notepad',
              source: 'observe_windows_and_apps',
              window: {
                displayLabel: 'Primary display',
                hwnd: 1377170,
                pid: 32664,
                processName: 'Notepad',
                title: 'New document - Notepad',
              },
            },
          ],
        },
      },
      verification: 'Running windows observed successfully.',
    };
  },
  userGoal: existingWindowUserGoal,
});

assert.equal(existingWindowModelCallCount, 2);
assert.equal(existingWindowToolCallCount, 2);
assert.equal(existingWindowResult.status, 'needs-approval');
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.target, 'Notepad');
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.targetDisplay, 'secondary');
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.fallbackToActiveWindow, false);
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.hwnd, 1377170);
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.pid, 32664);
assert.equal(existingWindowResult.pendingApproval?.command.toolCall?.input.processName, 'Notepad');
assert.ok(
  (existingWindowResult.pendingApproval?.command.toolCall?.input.queryCandidates as unknown[])
    .includes('Notepad'),
  'the approval should retain a stable process/title query alongside HWND/PID',
);

const observedWindowUserGoal = 'Move the current Notepad window to the secondary monitor and verify the result.';
let observedWindowModelCallCount = 0;
const observedWindowBindingResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    observedWindowModelCallCount += 1;
    assert.equal(
      observedWindowModelCallCount,
      1,
      'resolved window and display evidence should continue without another model call',
    );
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Observe the existing target window and display topology before moving it.',
      tools: [
        {
          args: {
            action: 'list_running_apps',
            query: '\u8bb0\u4e8b\u672c',
          },
          reason: 'Resolve the current target window.',
          tool: 'execute_desktop_observation',
        },
        {
          args: {
            action: 'get_display_info',
            displayTarget: 'secondary',
          },
          reason: 'Resolve the requested target display.',
          tool: 'execute_desktop_observation',
        },
      ],
      understanding: {
        remainingGoals: ['move the current Notepad window to the secondary display'],
        successCriteria: 'The current Notepad window is verified on the secondary display.',
        userNeed: observedWindowUserGoal,
        verificationStatus: 'unknown',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: existingWindowSourceText,
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    if (command.toolCall?.input.action === 'list_running_apps') {
      return {
        ok: true,
        responseText: 'Running window: Notepad pid=32664 hwnd=1377170 title="New document - Notepad".',
        stateSummary: {
          structuredEvidence: {
            status: 'success',
            targetCandidates: [
              {
                confidence: 'medium',
                label: 'AI Desktop Pet - AI Desktop Pet',
                source: 'observe_windows_and_apps',
                window: {
                  hwnd: 1643134,
                  pid: 5164,
                  processName: 'AI Desktop Pet',
                  title: 'AI Desktop Pet',
                },
              },
              {
                confidence: 'medium',
                label: 'Notepad - New document - Notepad',
                source: 'observe_windows_and_apps',
                window: {
                  displayLabel: 'Primary display',
                  hwnd: 1377170,
                  pid: 32664,
                  processName: 'Notepad',
                  title: 'New document - Notepad',
                },
              },
            ],
          },
        },
        verification: 'Running windows observed successfully.',
      };
    }

    assert.equal(command.toolCall?.input.action, 'get_display_info');
    return {
      ok: true,
      responseText: '\u68c0\u6d4b\u5230 2 \u4e2a\u5c4f\u5e55\uff1a\u4e3b\u5c4f\u548c\u526f\u5c4f\u3002',
      verification: 'Display topology observed successfully.',
    };
  },
  userGoal: observedWindowUserGoal,
});

assert.equal(observedWindowBindingResult.status, 'needs-approval');
assert.equal(observedWindowBindingResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(observedWindowBindingResult.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(observedWindowBindingResult.pendingApproval?.command.toolCall?.input.hwnd, 1377170);
assert.equal(observedWindowBindingResult.pendingApproval?.command.toolCall?.input.pid, 32664);
assert.ok(
  (observedWindowBindingResult.pendingApproval?.command.toolCall?.input.queryCandidates as unknown[])
    .includes('Notepad'),
  'resolved process name should supplement text query candidates',
);

let combinedObservationModelCalls = 0;
const combinedObservationResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    combinedObservationModelCalls += 1;
    assert.equal(
      combinedObservationModelCalls,
      1,
      'one combined window/display observation should continue without another model call',
    );
    return JSON.stringify({
      action: 'tool_call',
      args: {
        forceRefresh: true,
        includeActiveWindow: true,
        includeDisplays: true,
        includeInstalledApps: false,
        includeRunningApps: true,
        includeTaskbarPinned: false,
      },
      reason: 'Observe the current window and display topology in one batch.',
      tool: 'observe_windows_and_apps',
      understanding: {
        remainingGoals: ['move the current Notepad window to the secondary display'],
        successCriteria: 'The current Notepad window is verified on the secondary display.',
        userNeed: observedWindowUserGoal,
        verificationStatus: 'unknown',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: existingWindowSourceText,
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    return {
      observations: [
        'Running windows: 2',
        'Display observations: 2',
        'Running 1. process="Notepad" pid=32664 hwnd=1377170 title="New document - Notepad" display="Primary display"',
      ],
      ok: true,
      responseText: 'Observed the current windows and 2 displays.',
      stateSummary: {
        structuredEvidence: {
          status: 'success',
          targetCandidates: [
            {
              confidence: 'medium',
              label: 'Notepad - New document - Notepad',
              source: 'observe_windows_and_apps',
              window: {
                displayLabel: 'Primary display',
                hwnd: 1377170,
                pid: 32664,
                processName: 'Notepad',
                title: 'New document - Notepad',
              },
            },
          ],
        },
      },
      verification: 'Window/app observation returned current windows and displays.',
    };
  },
  userGoal: observedWindowUserGoal,
});

assert.equal(combinedObservationModelCalls, 1);
assert.equal(combinedObservationResult.status, 'needs-approval');
assert.equal(combinedObservationResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(combinedObservationResult.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(combinedObservationResult.pendingApproval?.command.toolCall?.input.hwnd, 1377170);
assert.equal(combinedObservationResult.pendingApproval?.command.toolCall?.input.pid, 32664);
assert.equal(combinedObservationResult.pendingApproval?.command.toolCall?.input.targetDisplay, 'secondary');

const approvedMoveCommand = existingWindowResult.pendingApproval?.command;
assert.ok(approvedMoveCommand);
const approvedMoveResult: AgentChatCommandResult = {
  observations: [
    'Move window query: \u8bb0\u4e8b\u672c',
    'Move window query candidates: \u8bb0\u4e8b\u672c | Notepad',
    'Requested display: secondary',
    'Matched process: Notepad',
    'Target display: Secondary display',
    'Verified after move: true',
  ],
  ok: true,
  receipt: {
    evidenceLines: [
      'Matched process: Notepad',
      'Target display: Secondary display',
      'Verified after move: true',
    ],
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        finalDisplay: {
          id: '\\\\.\\DISPLAY2',
          label: 'Secondary display',
        },
        finalWindow: {
          displayId: '\\\\.\\DISPLAY2',
          displayLabel: 'Secondary display',
          hwnd: 1377170,
          processName: 'Notepad',
          title: 'New document - Notepad',
        },
        postActionState: 'completed',
        status: 'success',
        targetMatched: 'Notepad',
      },
    },
    status: 'success',
    summaryLines: [
      'Call: move_window_to_display',
      'Target: Notepad',
      'Display: Secondary display',
      'Result: window moved',
    ],
    title: 'Execution receipt',
    toolName: 'move_window_to_display',
    verification: 'Window moved to Secondary display: Notepad',
  },
  responseText: 'Moved Notepad to Secondary display.',
  stateSummary: {
    structuredEvidence: {
      confidence: 'high',
      finalDisplay: {
        id: '\\\\.\\DISPLAY2',
        label: 'Secondary display',
      },
      finalWindow: {
        displayId: '\\\\.\\DISPLAY2',
        displayLabel: 'Secondary display',
        hwnd: 1377170,
        processName: 'Notepad',
        title: 'New document - Notepad',
      },
      postActionState: 'completed',
      status: 'success',
      targetMatched: 'Notepad',
    },
  },
  verification: 'Window moved: Notepad -> Secondary display',
};
let approvedMoveModelCalls = 0;
let approvedMoveVerificationCalls = 0;
const approvedMoveContinuation = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedMoveCommand,
    result: approvedMoveResult,
  },
  maxSteps: 3,
  modelCaller: async () => {
    approvedMoveModelCalls += 1;
    throw new Error('a verified window placement must not return to model planning');
  },
  settings: {} as PetConfig['settings'],
  sourceText: existingWindowSourceText,
  toolExecutor: async () => {
    approvedMoveVerificationCalls += 1;
    throw new Error('a verified window placement must not dispatch redundant observation');
  },
  userGoal: existingWindowUserGoal,
});

assert.equal(
  approvedMoveContinuation.status,
  'completed',
  JSON.stringify(approvedMoveContinuation, null, 2),
);
assert.equal(approvedMoveModelCalls, 0);
assert.equal(approvedMoveVerificationCalls, 0);
assert.match(
  approvedMoveContinuation.continuation.historyLines.join('\n'),
  /terminal-completed|Evidence Engine authorized completion/u,
);

console.log('agent session v2 display observation open move continuation smoke ok');
