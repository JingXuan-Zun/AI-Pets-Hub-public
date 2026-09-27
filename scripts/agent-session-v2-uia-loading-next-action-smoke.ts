import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createApprovedLaunchSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start Example Game inside Launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'start Example Game inside Launcher',
      input: {
        postVerifyVisualQuery: 'Example Game should be launched or ready to continue',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'interact_window_ui',
              automationId: 'example-game-start',
              hwnd: 1001,
              query: 'Launcher',
              targetText: 'Example Game Start',
              uiAction: 'invoke',
            },
            reason: 'Invoke the UI Automation launch control.',
            tool: 'execute_desktop_action',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createLoadingLaunchResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: loading',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_sequence',
        'Steps completed: 1',
      ],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The launch action completed and the launcher is loading.',
    },
    responseText: 'Desktop sequence completed 1/1 step(s). Example Game is loading.',
    stateSummary: {
      missingEvidence: [
        'Example Game is not fully launched yet.',
      ],
      observedState: [
        'Step 1/1 tool=execute_desktop_action status=ok',
        'Post-action visual state: loading',
      ],
      recommendedRecovery: [
        'postActionRecoveryStrategy=wait-and-observe | nextTool=execute_desktop_observation | nextArgs={"action":"wait_and_observe","forceRefresh":true,"includeVisual":true,"waitMs":2500,"query":"Launcher"}',
      ],
      structuredEvidence: {
        confidence: 'medium',
        postActionRecovery: {
          nextArgs: {
            action: 'wait_and_observe',
            forceRefresh: true,
            includeVisual: true,
            query: 'Launcher',
            waitMs: 2500,
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The launcher is loading after the UI Automation action.',
          strategy: 'wait-and-observe',
        },
        postActionState: 'loading',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
      verificationEvidence: [
        'The launcher is loading after the start action.',
      ],
    },
    verification: 'execute_desktop_sequence completed all steps in order. Post-sequence verification: loading.',
  };
}

function createContinueReadyAfterWaitResult(): AgentChatCommandResult {
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
    responseText: 'Launcher finished loading this step and now shows a Continue button for Example Game.',
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

let modelCallCount = 0;
const executedCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createApprovedLaunchSequenceCommand(),
    result: createLoadingLaunchResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called before automatic loading recovery prepares the next action approval');
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'wait_and_observe');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.includeVisual, true);
    assert.equal(command.toolCall.input.query, 'Launcher');
    assert.equal(command.toolCall.input.waitMs, 2500);
    assert.equal(command.toolCall.input.recoveryPostActionState, 'loading');
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
    return createContinueReadyAfterWaitResult();
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /example-game-continue/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.match(result.continuation.historyLines.join('\n'), /wait_and_observe/u);
assert.match(result.continuation.historyLines.join('\n'), /visual-action approval after auto recovery/u);

console.log('agent session v2 UIA loading next action smoke ok');
