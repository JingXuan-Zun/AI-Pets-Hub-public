import assert from 'node:assert/strict';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { executeDesktopAction } from '../src/agent/agentRuntimeDesktopTools.ts';
import { executeDesktopSequence } from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { type PetConfig } from '../src/types.ts';

const originalInvokeWindowUi = desktopPetShellRuntime.invokeWindowUi;
let callCount = 0;

const failedWindowUiResponse = {
  candidates: [
    {
      actions: [],
      automationId: 'start-button',
      bounds: {
        coordinateSpace: 'native-screen',
        height: 42,
        source: 'ui-automation',
        width: 128,
        x: 760,
        y: 520,
      },
      centerX: 824,
      centerY: 541,
      controlType: 'Button',
      depth: 4,
      matchScore: 124,
      name: 'Start',
    },
  ],
  control: {
    actions: [],
    automationId: 'start-button',
    bounds: {
      coordinateSpace: 'native-screen',
      height: 42,
      source: 'ui-automation',
      width: 128,
      x: 760,
      y: 520,
    },
    centerX: 824,
    centerY: 541,
    controlType: 'Button',
    depth: 4,
    matchScore: 124,
    name: 'Start',
  },
  error: "Matched UI Automation control does not support action 'invoke'.",
  invoked: false,
  method: '',
  ok: false,
  query: 'Launcher',
  resolvedAction: 'invoke',
  targetText: 'Start',
  uiAction: 'invoke',
  window: {
    hwnd: 12345,
    processName: 'Launcher.exe',
    title: 'Launcher',
  },
};

try {
  desktopPetShellRuntime.invokeWindowUi = async (request?: unknown) => {
    callCount += 1;
    const input = request as Record<string, unknown>;
    assert.equal(input.targetText, 'Start');
    assert.equal(input.uiAction, 'invoke');
    return failedWindowUiResponse;
  };

  const actionResult = await executeDesktopAction(
    {} as never,
    {
      goal: 'invoke Start in Launcher',
      input: {
        action: 'interact_window_ui',
        query: 'Launcher',
        targetText: 'Start',
        uiAction: 'invoke',
      },
      name: 'execute_desktop_action',
    },
  );

  assert.equal(actionResult.ok, false);
  assert.equal(actionResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(actionResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextTool, 'execute_desktop_input');
  assert.equal(actionResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.x, 824);
  assert.equal(actionResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextArgs?.y, 541);
  assert.match(actionResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /execute_desktop_input/u);

  const sequenceToolCall = {
    goal: 'invoke Start in Launcher',
    input: {
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'interact_window_ui',
            query: 'Launcher',
            targetText: 'Start',
            uiAction: 'invoke',
          },
          reason: 'Invoke the matched UI Automation control.',
          tool: 'execute_desktop_action',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  } as const;
  const sequenceResult = await executeDesktopSequence({} as never, sequenceToolCall);

  assert.equal(sequenceResult.ok, false);
  assert.equal(sequenceResult.stateSummary?.structuredEvidence?.visualActionReadiness, 'ready');
  assert.equal(sequenceResult.stateSummary?.structuredEvidence?.postActionRecovery?.nextTool, 'execute_desktop_input');
  assert.match(sequenceResult.stateSummary?.recommendedRecovery?.join('\n') ?? '', /do not retry the same failed primitive unchanged/u);

  const approvedCommand: AgentChatCommand = {
    instruction: '/agent click Start in Launcher',
    kind: 'tool-call',
    sourceText: '/agent click Start in Launcher',
    toolCall: sequenceToolCall,
  };
  const settings = {} as PetConfig['settings'];
  const sessionResult = await runAgentProductionSession({
    approvedToolResult: {
      command: approvedCommand,
      result: sequenceResult,
    },
    maxSteps: 1,
    modelCaller: async () => {
      throw new Error('model should not be called before fallback approval is prepared');
    },
    settings,
    sourceText: '/agent click Start in Launcher',
    userGoal: 'click Start in Launcher',
  });

  assert.equal(sessionResult.status, 'needs-approval');
  assert.equal(sessionResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  const stepsJson = String(sessionResult.pendingApproval?.command.toolCall?.input.stepsJson ?? '');
  assert.match(stepsJson, /execute_desktop_input/u);
  assert.match(stepsJson, /"action":"click"/u);
  assert.match(stepsJson, /"x":824/u);
  assert.match(stepsJson, /"y":541/u);
  assert.doesNotMatch(stepsJson, /interact_window_ui/u);
  assert.match(sessionResult.finalAnswer, /UI Automation could not apply/u);
} finally {
  desktopPetShellRuntime.invokeWindowUi = originalInvokeWindowUi;
}

assert.equal(callCount, 2);
console.log('agent session v2 window ui fallback approval smoke ok');
