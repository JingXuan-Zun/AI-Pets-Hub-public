import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'desktop-observation' : 'app-launcher',
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

function createApprovedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The click primitive completed, but the final launch is not verified yet.',
    },
    responseText: 'execute_desktop_sequence completed all steps in order.',
    stateSummary: {
      changedState: ['cursor-position', 'active-window-input-state'],
      observedState: ['Step 1/1 tool=execute_desktop_input status=ok'],
      verificationEvidence: ['Sequence steps completed.'],
    },
    verification: 'The click primitive completed.',
  };
}

function createPostActionLoadingResult(label: string): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Post-action visual state: loading`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', 'State: loading'],
      title: `${label} loading observation`,
      toolName: 'execute_desktop_observation',
      verification: 'Example Game is still loading.',
    },
    responseText: `${label}: Example Game is still loading.`,
    stateSummary: {
      missingEvidence: ['Example Game is not fully launched yet.'],
      observedState: [`${label}: Post-action visual state: loading`],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: 'loading',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Example Game is still loading.'],
    },
    verification: 'Example Game is still loading.',
  };
}

function createContinueReadyAfterSecondWaitResult(): AgentChatCommandResult {
  return {
    observations: [
      'Recovered observation: Launcher now shows Continue for Example Game.',
      'Matched controls: Continue id=example-game-continue type=Button center=1460,930 actions=invoke enabled=true',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Launcher now shows Continue for Example Game.',
        'Matched controls: Continue id=example-game-continue type=Button center=1460,930 actions=invoke enabled=true',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_observation wait_and_observe',
        'Result: ready for next action',
      ],
      title: 'Agent post-action wait observation',
      toolName: 'execute_desktop_observation',
      verification: 'The launcher is still open but a Continue control is visible.',
    },
    responseText: 'Launcher finished the loading phase and now shows a Continue button for Example Game.',
    stateSummary: {
      missingEvidence: [
        'Example Game is not launched yet; the visible Continue button must be invoked next.',
      ],
      observedState: [
        'Launcher now shows Continue for Example Game.',
      ],
      recommendedRecovery: [
        'Invoke the visible Continue control with permission.',
      ],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['invoke'],
            automationId: 'example-game-continue',
            bounds: {
              coordinateSpace: 'native-screen',
              height: 44,
              source: 'ui-automation',
              width: 150,
              x: 1385,
              y: 908,
            },
            center: {
              coordinateSpace: 'native-screen',
              source: 'ui-automation',
              x: 1460,
              y: 930,
            },
            confidence: 'high',
            controlType: 'Button',
            description: 'Continue id=example-game-continue type=Button actions=invoke enabled=true',
            enabled: true,
            keyboardFocusable: true,
            label: 'Continue id=example-game-continue type=Button',
            name: 'Continue',
            offscreen: false,
            relation: 'After waiting, UI Automation reports the next required control for Example Game.',
            source: 'ui-automation',
            window: {
              hwnd: 1001,
              processName: 'Launcher.exe',
              title: 'Launcher',
            },
          },
        ],
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'ui-automation',
          x: 1460,
          y: 930,
        },
        postActionState: 'loading',
        primaryAction: 'Continue Example Game',
        relation: 'A new visible UIA action is available after the wait, but launch is not completed yet.',
        status: 'unverified',
        targetMatched: 'Example Game Continue',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: [
        'A visible Continue button is available for Example Game.',
      ],
    },
    verification: 'Launcher shows Continue for Example Game.',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyQuery: 'Example Game',
  postVerifyVisualQuery: 'Example Game',
  stepsJson: JSON.stringify([
    {
      args: {
        action: 'click',
        button: 'left',
        x: 1440,
        y: 920,
      },
      reason: 'Click the located Start button.',
      tool: 'execute_desktop_input',
    },
  ]),
});

const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createApprovedSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called while continuous loading recovery can prepare next approval');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);

    if (executedCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
      assert.equal(command.toolCall?.input.query, 'Example Game');
      return createPostActionLoadingResult('verification');
    }

    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'loading');
    assert.match(String(command.toolCall?.input.question), /AgentSessionV2 auto recovery observation/u);

    if (executedCommands.length === 2) {
      assert.equal(command.toolCall?.input.recoveryAttempt, 1);
      assert.equal(command.toolCall?.input.recoveryMaxAttempts, 3);
      assert.equal(command.toolCall?.input.waitMs, 2500);
      return createPostActionLoadingResult('wait 1');
    }

    assert.equal(executedCommands.length, 3);
    assert.equal(command.toolCall?.input.recoveryAttempt, 2);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 3);
    assert.equal(command.toolCall?.input.waitMs, 4000);
    return createContinueReadyAfterSecondWaitResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(modelCallCount, 0, JSON.stringify(result, null, 2));
assert.equal(executedCommands.length, 3);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /example-game-continue/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=loading/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery loop continued/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after auto recovery/u);

console.log('agent session v2 continuous loading next action smoke ok');
