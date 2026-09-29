import assert from 'node:assert/strict';

import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { executeMoveWindowToDisplay } from '../src/agent/agentRuntimeWindowTools.ts';
import { bindAgentToolDisplayTargetToExplicitIntent } from '../src/agent/runtime/agentDisplayTargetIntent.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';

const sourceText = '\u5c06\u5f53\u524d\u6253\u5f00\u7684\u8ba1\u7b97\u5668\u7a97\u53e3\u79fb\u52a8\u5230\u526f\u5c4f\uff0c\u5e76\u9a8c\u8bc1\u79fb\u52a8\u7ed3\u679c\u3002';
const userGoal = 'Move the currently open Calculator window to the secondary display and verify the result.';

const modelCaller: AgentSessionV2ModelCaller = async () => JSON.stringify({
  action: 'tool_call',
  args: {
    action: 'move_window_to_display',
    displayId: '\\\\.\\DISPLAY1',
    fallbackToActiveWindow: false,
    hwnd: 1970386,
    target: 'Calculator',
    targetDisplay: 'Redmi 27 NQ',
  },
  reason: 'Move the resolved Calculator window to the selected display.',
  tool: 'execute_desktop_action',
  understanding: {
    remainingGoals: ['move Calculator to the secondary display'],
    successCriteria: 'Calculator is verified on the secondary display.',
    userNeed: userGoal,
    verificationStatus: 'partial',
  },
});

const result = await runAgentProductionSession({
  continuation: {
    historyLines: ['A live Calculator window inventory is available.'],
    sourceText,
    steps: [],
    timing: null,
    traceEvents: [],
    toolResults: [{
      command: {
        capabilityId: 'desktop-observation',
        instruction: userGoal,
        kind: 'tool-call',
        sourceText,
        toolCall: {
          goal: userGoal,
          input: { includeDisplays: true, includeRunningApps: true },
          name: 'observe_windows_and_apps',
        },
      },
      result: {
        ok: true,
        responseText: 'Calculator pid=314 hwnd=1970386 title="Calculator"',
        stateSummary: {
          structuredEvidence: {
            observationCapturedAt: Date.now(),
            status: 'success',
            targetCandidates: [{
              confidence: 'high',
              label: 'Calculator',
              source: 'observe_windows_and_apps',
              window: {
                hwnd: 1970386,
                pid: 314,
                processName: 'ApplicationFrameHost',
                title: 'Calculator',
              },
            }],
          },
        },
      },
    }],
    userGoal,
  },
  maxSteps: 2,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText,
  toolExecutor: async () => {
    throw new Error('the display move must pause for approval before execution');
  },
  userGoal,
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(result.pendingApproval?.command.toolCall?.input.action, 'move_window_to_display');
assert.equal(
  result.pendingApproval?.command.toolCall?.input.targetDisplay,
  'secondary',
  'the explicit user-authored display role must override a conflicting model-selected physical display label',
);
assert.equal(
  result.pendingApproval?.command.toolCall?.input.displayId,
  undefined,
  'a physical display id that conflicts with an explicit semantic role must not outrank that role downstream',
);
assert.equal(result.pendingApproval?.command.toolCall?.input.hwnd, 1970386);

const primaryBoundArgs = bindAgentToolDisplayTargetToExplicitIntent({
  args: {
    action: 'move_window_to_display',
    displayId: '\\\\.\\DISPLAY2',
    targetDisplay: 'LC34G55T',
  },
  sourceText: '\u5c06\u8be5\u7a97\u53e3\u79fb\u52a8\u5230\u4e3b\u5c4f\u3002',
  toolName: 'execute_desktop_action',
  userGoal: 'Move the window to the primary display.',
});
assert.equal(primaryBoundArgs.targetDisplay, 'primary');
assert.equal(primaryBoundArgs.displayId, undefined);

const physicalDisplayArgs = {
  action: 'move_window_to_display',
  displayId: '\\\\.\\DISPLAY2',
  targetDisplay: 'LC34G55T',
};
assert.equal(
  bindAgentToolDisplayTargetToExplicitIntent({
    args: physicalDisplayArgs,
    sourceText: '\u5c06\u8be5\u7a97\u53e3\u79fb\u52a8\u5230 LC34G55T\u3002',
    toolName: 'execute_desktop_action',
    userGoal: 'Move the window to LC34G55T.',
  }),
  physicalDisplayArgs,
  'an explicit physical display request must remain intact when no primary/secondary role was requested',
);

const sequenceBoundArgs = bindAgentToolDisplayTargetToExplicitIntent({
  args: {
    displayId: '\\\\.\\DISPLAY1',
    stepsJson: JSON.stringify([
      {
        args: {
          action: 'move_window_to_display',
          displayId: '\\\\.\\DISPLAY1',
          targetDisplay: 'Redmi 27 NQ',
        },
        tool: 'execute_desktop_action',
      },
    ]),
  },
  sourceText,
  toolName: 'execute_desktop_sequence',
  userGoal,
});
const sequenceSteps = JSON.parse(String(sequenceBoundArgs.stepsJson)) as Array<{
  args: Record<string, unknown>;
}>;
assert.equal(sequenceSteps[0]?.args.targetDisplay, 'secondary');
assert.equal(sequenceSteps[0]?.args.displayId, undefined);
assert.equal(sequenceBoundArgs.targetDisplay, 'secondary');
assert.equal(sequenceBoundArgs.displayId, undefined);

const originalMoveWindowToDisplay = desktopPetShellRuntime.moveWindowToDisplay;
try {
  desktopPetShellRuntime.moveWindowToDisplay = async () => ({
    hwnd: 1970386,
    moved: true,
    ok: true,
    processName: 'ApplicationFrameHost',
    targetDisplay: {
      primary: true,
    },
    targetDisplayId: '\\\\.\\DISPLAY1',
    targetDisplayLabel: '\\\\.\\DISPLAY1',
    title: 'Calculator',
    verified: true,
  });

  const mismatchedReceipt = await executeMoveWindowToDisplay({
    goal: userGoal,
    input: {
      action: 'move_window_to_display',
      hwnd: 1970386,
      targetDisplay: 'secondary',
    },
    name: 'execute_desktop_action',
  });

  assert.equal(mismatchedReceipt.ok, true);
  assert.equal(
    mismatchedReceipt.receipt?.status,
    'unverified',
    'a backend move to the primary display must not verify a secondary-display request',
  );
  assert.equal(mismatchedReceipt.stateSummary?.structuredEvidence?.postActionState, null);
  assert.equal(mismatchedReceipt.stateSummary?.structuredEvidence?.finalDisplay?.primary, true);
  assert.match(mismatchedReceipt.verification ?? '', /role mismatch/iu);
} finally {
  desktopPetShellRuntime.moveWindowToDisplay = originalMoveWindowToDisplay;
}

console.log('agent session v2 explicit display role binding smoke ok');
