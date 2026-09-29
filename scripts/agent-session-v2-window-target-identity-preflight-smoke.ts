import assert from 'node:assert/strict';

import { runAgentProductionSession } from '../src/agent/legacy/index.ts';
import { resolveAgentWindowTargetBeforeDispatch } from '../src/agent/runtime/agentWindowTargetResolutionRuntime.ts';
import { type AgentRuntimeToolResultEntry } from '../src/agent/runtime/agentRuntimeContract.ts';
import { type PetConfig } from '../src/types.ts';

const sourceText = '\u628a\u5f53\u524d\u6253\u5f00\u7684\u8bb0\u4e8b\u672c\u7a97\u53e3\u79fb\u52a8\u5230\u526f\u5c4f\uff0c\u5e76\u9a8c\u8bc1\u79fb\u52a8\u7ed3\u679c\u3002';
const userGoal = '\u79fb\u52a8\u5f53\u524d\u6253\u5f00\u7684\u8bb0\u4e8b\u672c\u7a97\u53e3\u5230\u526f\u5c4f\u5e76\u9a8c\u8bc1\u7ed3\u679c';

function createWindowInventoryEntry(): AgentRuntimeToolResultEntry {
  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: userGoal,
      kind: 'tool-call',
      sourceText,
      toolCall: {
        goal: userGoal,
        input: {
          includeDisplays: true,
          includeRunningApps: true,
        },
        name: 'observe_windows_and_apps',
      },
    },
    result: {
      ok: true,
      responseText: 'Running window: Notepad pid=32664 hwnd=1377170 title="New document - Notepad".',
      stateSummary: {
        structuredEvidence: {
          observationCapturedAt: Date.now(),
          status: 'success',
          targetCandidates: [
            {
              confidence: 'medium',
              label: 'AI Desktop Pet - AI Desktop Pet',
              source: 'observe_windows_and_apps',
              window: {
                hwnd: 7150488,
                pid: 46344,
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
    },
  };
}

function createListRunningAppsInventoryEntry(): AgentRuntimeToolResultEntry {
  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Observe WeGame',
      kind: 'tool-call',
      sourceText: '打开 WeGame 里的英雄联盟',
      toolCall: {
        goal: '打开 WeGame 里的英雄联盟',
        input: { action: 'list_running_apps', query: 'WeGame' },
        name: 'execute_desktop_observation',
      },
    },
    result: {
      ok: true,
      responseText: '当前找到 1 个运行窗口/应用：1. wegame pid=8632 hwnd=660298 title="WeGame"',
      stateSummary: {
        structuredEvidence: {
          observationCapturedAt: Date.now(),
          observationGeneration: 2,
          status: 'success',
          targetCandidates: [{
            confidence: 'high',
            label: 'wegame - WeGame',
            source: 'observe_windows_and_apps',
            window: { hwnd: 660298, pid: 8632, processName: 'wegame', title: 'WeGame' },
          }],
          targetMatched: 'wegame - WeGame',
        },
      },
      verification: '读取到 1 个运行窗口/应用。',
    },
  };
}

function createWindowVisualObservationEntry(): AgentRuntimeToolResultEntry {
  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Locate the visible login control in WeGame.',
      kind: 'tool-call',
      sourceText: '打开 WeGame 里的英雄联盟',
      toolCall: {
        goal: 'Locate the visible login control in WeGame.',
        input: {
          action: 'describe_elements',
          sourceQuery: 'WeGame',
          sourceType: 'window',
          targetText: '快速安全登录',
        },
        name: 'locate_screen_elements',
      },
    },
    result: {
      ok: true,
      responseText: 'WeGame login control is visible.',
      stateSummary: {
        structuredEvidence: {
          captureSourceType: 'window',
          finalWindow: {
            hwnd: 462024,
            pid: 43012,
            processName: 'wegame',
            title: 'wegame - WeGame',
          },
          observationCapturedAt: Date.now(),
          status: 'success',
          targetMatched: '快速安全登录',
        },
      },
      verification: 'Window-level visual observation returned the live WeGame window identity.',
    },
  };
}

const initialPreflight = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    target: '\u8bb0\u4e8b\u672c',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [],
  userGoal,
});
assert.equal(initialPreflight.kind, 'observe');
if (initialPreflight.kind === 'observe') {
  assert.equal(initialPreflight.command.toolCall?.name, 'observe_windows_and_apps');
  assert.equal(initialPreflight.command.toolCall?.input.includeRunningApps, true);
  assert.equal(initialPreflight.command.toolCall?.input.includeDisplays, true);
  assert.equal(initialPreflight.command.toolCall?.input.query, undefined);
}

const untranslatedTarget = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    target: '\u8bb0\u4e8b\u672c',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(untranslatedTarget.kind, 'repair');
assert.match(untranslatedTarget.reason, /hwnd=1377170/iu);
assert.match(untranslatedTarget.reason, /process=Notepad/iu);

const semanticTarget = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    target: 'Notepad',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(semanticTarget.kind, 'ready');
if (semanticTarget.kind === 'ready') {
  assert.equal(semanticTarget.args.hwnd, 1377170);
  assert.equal(semanticTarget.args.pid, 32664);
  assert.equal(semanticTarget.args.processName, 'Notepad');
}

const conflictingExplicitIdentity = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    hwnd: 7150488,
    pid: 46344,
    processName: 'Notepad',
    query: 'Notepad',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(
  conflictingExplicitIdentity.kind,
  'repair',
  'an explicit HWND/PID must not bypass live target-semantic validation',
);

const localizedMatchingExplicitIdentity = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    hwnd: 1377170,
    pid: 32664,
    target: '\u8bb0\u4e8b\u672c',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(
  localizedMatchingExplicitIdentity.kind,
  'ready',
  'a complete HWND/PID pair from the latest inventory must not depend on cross-language text matching',
);

const staleExplicitIdentityWithUniqueSemanticTarget = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    hwnd: 999999,
    pid: 99999,
    processName: 'Notepad',
    query: 'Notepad',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(
  staleExplicitIdentityWithUniqueSemanticTarget.kind,
  'ready',
  'a stale identity should rebind to one uniquely resolved live semantic target',
);
if (staleExplicitIdentityWithUniqueSemanticTarget.kind === 'ready') {
  assert.equal(staleExplicitIdentityWithUniqueSemanticTarget.args.hwnd, 1377170);
  assert.equal(staleExplicitIdentityWithUniqueSemanticTarget.args.pid, 32664);
}

const matchingExplicitIdentity = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'move_window_to_display',
    hwnd: 1377170,
    pid: 32664,
    processName: 'Notepad',
    query: 'Notepad',
    targetDisplay: 'secondary',
  },
  sourceText,
  toolName: 'execute_desktop_action',
  toolResults: [createWindowInventoryEntry()],
  userGoal,
});
assert.equal(matchingExplicitIdentity.kind, 'ready');
if (matchingExplicitIdentity.kind === 'ready') {
  assert.equal(matchingExplicitIdentity.args.hwnd, 1377170);
  assert.equal(matchingExplicitIdentity.args.pid, 32664);
}

const listRunningAppsIdentity = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'focus_window',
    query: 'WeGame',
  },
  sourceText: '打开 WeGame 里的英雄联盟',
  toolName: 'execute_desktop_action',
  toolResults: [createListRunningAppsInventoryEntry()],
  userGoal: '打开 WeGame 里的英雄联盟',
});
assert.equal(listRunningAppsIdentity.kind, 'ready');
if (listRunningAppsIdentity.kind === 'ready') {
  assert.equal(listRunningAppsIdentity.args.hwnd, 660298);
  assert.equal(listRunningAppsIdentity.args.pid, 8632);
}

const visualWindowIdentity = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'focus_window',
    query: 'WeGame',
  },
  sourceText: '打开 WeGame 里的英雄联盟',
  toolName: 'execute_desktop_action',
  toolResults: [createWindowVisualObservationEntry()],
  userGoal: '打开 WeGame 里的英雄联盟',
});
assert.equal(visualWindowIdentity.kind, 'ready');
if (visualWindowIdentity.kind === 'ready') {
  assert.equal(visualWindowIdentity.args.hwnd, 462024);
  assert.equal(visualWindowIdentity.args.pid, 43012);
}

const staleIdentityWithoutCurrentCandidate = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'focus_window',
    hwnd: 999999,
    pid: 99999,
    query: 'A window that is not in the current inventory',
  },
  sourceText: 'focus the requested window',
  toolName: 'execute_desktop_action',
  toolResults: [createListRunningAppsInventoryEntry()],
  userGoal: 'focus the requested window',
});
assert.equal(staleIdentityWithoutCurrentCandidate.kind, 'observe');
if (staleIdentityWithoutCurrentCandidate.kind === 'observe') {
  assert.equal(staleIdentityWithoutCurrentCandidate.command.toolCall?.name, 'observe_windows_and_apps');
}

const staleFallbackInventory = resolveAgentWindowTargetBeforeDispatch({
  args: {
    action: 'focus_window',
    hwnd: 660298,
    pid: 8632,
    query: 'WeGame',
  },
  sourceText: '打开 WeGame',
  toolName: 'execute_desktop_action',
  toolResults: [{
    ...createListRunningAppsInventoryEntry(),
    result: {
      ...createListRunningAppsInventoryEntry().result,
      stateSummary: {
        structuredEvidence: {
          ...createListRunningAppsInventoryEntry().result.stateSummary!.structuredEvidence!,
          observationFreshness: 'stale-fallback' as const,
          observationCapturedAt: Date.now(),
        },
      },
    },
  }],
  userGoal: '打开 WeGame',
});
assert.equal(staleFallbackInventory.kind, 'observe');
if (staleFallbackInventory.kind === 'observe') {
  assert.equal(staleFallbackInventory.command.toolCall?.name, 'observe_windows_and_apps');
}

const unverifiedReceiptInventory = resolveAgentWindowTargetBeforeDispatch({
  args: { action: 'focus_window', query: 'WeGame' },
  sourceText: '打开 WeGame',
  toolName: 'execute_desktop_action',
  toolResults: [{
    ...createListRunningAppsInventoryEntry(),
    result: {
      ...createListRunningAppsInventoryEntry().result,
      receipt: { status: 'unverified' },
    },
  }],
  userGoal: '打开 WeGame',
});
assert.equal(unverifiedReceiptInventory.kind, 'observe');

let modelCallCount = 0;
let toolCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'move_window_to_display',
          fallbackToActiveWindow: false,
          target: '\u8bb0\u4e8b\u672c',
          targetDisplay: 'secondary',
        },
        reason: 'Move the requested existing window.',
        tool: 'execute_desktop_action',
        understanding: {
          remainingGoals: ['move the requested window', 'verify its display'],
          successCriteria: 'The requested window is verified on the secondary display.',
          userNeed: userGoal,
          verificationStatus: 'unknown',
        },
      });
    }

    assert.equal(modelCallCount, 2, 'one live inventory should be enough to resolve the target');
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'move_window_to_display',
        hwnd: 1377170,
        pid: 32664,
        fallbackToActiveWindow: false,
        target: '\u8bb0\u4e8b\u672c',
        targetDisplay: 'secondary',
      },
      reason: 'Bind the localized request to the exact HWND/PID pair returned by live observation.',
      tool: 'execute_desktop_action',
      understanding: {
        remainingGoals: ['move hwnd 1377170', 'verify its display'],
        successCriteria: 'The requested window is verified on the secondary display.',
        userNeed: userGoal,
        verificationEvidence: ['Notepad pid=32664 hwnd=1377170 is a live window.'],
        verificationGaps: ['Need approval and move verification.'],
        verificationStatus: 'partial',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText,
  toolExecutor: async (command) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    assert.equal(command.toolCall?.input.includeRunningApps, true);
    assert.equal(command.toolCall?.input.query, undefined);
    return createWindowInventoryEntry().result;
  },
  userGoal,
});

assert.equal(modelCallCount, 2, sessionResult.continuation.historyLines.join('\n'));
assert.equal(toolCallCount, 1);
assert.equal(sessionResult.status, 'needs-approval');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.hwnd, 1377170);
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.pid, 32664);
assert.equal(sessionResult.pendingApproval?.command.toolCall?.input.processName, 'Notepad');
assert.match(sessionResult.continuation.historyLines.join('\n'), /silent identity preflight/iu);
assert.match(sessionResult.continuation.historyLines.join('\n'), /bound window action to observed identity/iu);

console.log('agent session v2 window target identity preflight smoke ok');
