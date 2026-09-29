import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent start Example Game from the visible launcher';
const userGoal = 'start Example Game from the visible launcher';

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'locate_screen_elements' || name === 'execute_desktop_observation'
      ? 'desktop-observation'
      : 'app-launcher',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input,
      name,
    },
  };
}

function createLegacySelectionRecoveryCommand(): AgentChatCommand {
  return createToolCommand('locate_screen_elements', {
    action: 'locate_element',
    forceRefresh: true,
    question: [
      'AgentSessionV2 auto recovery observation',
      'Post-action state is visible_only.',
      'Read the current selected/detail item, the requested target item, whether the requested target is selected/current, and the best safe coordinate or UIA candidate for selecting the requested target item.',
      'Do not click anything, and do not look for the primary start/open/play button until selection is confirmed.',
    ].join(' '),
    targetDescription: 'Example Game',
    targetText: 'Example Game',
  });
}

function createLegacySelectionRecoveryResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual current selection: Another Game',
      'Visual selection verification: visible-only',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Example Game was visible as a selectable list item.',
        'Visual selection verification: visible-only',
      ],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements', 'Result: target visible but not selected'],
      title: 'Legacy selection recovery observation',
      toolName: 'locate_screen_elements',
      verification: 'Example Game is visible but not selected.',
    },
    responseText: 'Example Game is visible, but Another Game remains selected.',
    stateSummary: {
      missingEvidence: ['Requested target is visible but not current selected/detail item.'],
      observedState: [
        'Visual target matched: Example Game',
        'Visual current selection: Another Game',
        'Visual selection verification: visible-only',
      ],
      structuredEvidence: {
        currentSelection: 'Another Game',
        selectionVerificationStatus: 'visible-only',
        status: 'unverified',
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-target-selection',
      },
      verificationEvidence: ['Example Game is visible, but not selected.'],
    },
    verification: 'Example Game is visible but not selected.',
  };
}

function createApprovedSelectionResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Selected Example Game list item with UI Automation.'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Result: selection command sent'],
      title: 'Selection sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Selection action was sent; visual verification still needs to confirm the selected detail state.',
    },
    responseText: 'Selection action was sent for Example Game.',
    verification: 'Selection action was sent for Example Game.',
  };
}

function createSelectedNeedsPrimaryActionVerification(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual current selection: Example Game',
      'Visual selection verification: selected',
      'No associated primary action was identified yet.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Example Game is now the current selected/detail item.',
        'No associated Start/Open/Play action was located in this pass.',
      ],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', 'Result: selected target needs primary action'],
      title: 'Post-approval verification',
      toolName: 'execute_desktop_observation',
      verification: 'Target selection is confirmed, but the primary action is missing.',
    },
    responseText: 'Example Game is selected/current, but the Start/Open/Play action has not been located yet.',
    stateSummary: {
      missingEvidence: ['The requested target is selected/current, but no associated primary action has been identified.'],
      observedState: [
        'Visual target matched: Example Game',
        'Visual current selection: Example Game',
        'Visual selection verification: selected',
      ],
      recommendedRecovery: ['Find the selected target detail page primary open/start/play action before clicking.'],
      structuredEvidence: {
        confidence: 'high',
        currentSelection: 'Example Game',
        postActionRecovery: {
          nextArgs: {
            action: 'locate_element',
            forceRefresh: true,
            question: 'Find the primary open/start/play/launch action associated with selected Example Game.',
            targetDescription: 'Example Game; primary open/start/play action associated with the selected target',
            targetText: 'Example Game',
          },
          nextTool: 'locate_screen_elements',
          reason: 'The requested target is confirmed selected/current, but no associated primary open/start/play action has been identified yet.',
          strategy: 're-locate-target',
        },
        selectionEvidence: [
          'Visual current selection: Example Game',
          'Visual selection verification: selected',
        ],
        selectionVerificationStatus: 'selected',
        status: 'unverified',
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-primary-action',
      },
      verificationEvidence: ['Example Game is selected/current.'],
    },
    verification: 'Example Game is selected/current, but the primary action is missing.',
  };
}

function createPrimaryActionRecoveryResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual current selection: Example Game',
      'Visual selection verification: selected',
      'Visual primary action: Start',
      'Visual element center: x=1440 y=920',
      'Relation: Start belongs to selected Example Game detail page.',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Start button for selected Example Game is located at screen coordinate 1440,920.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: selected target primary action found'],
      title: 'Primary action recovery observation',
      toolName: 'locate_screen_elements',
      verification: 'Start belongs to selected Example Game detail page and is actionable.',
    },
    responseText: 'Start is the primary action for the selected Example Game detail page.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual current selection: Example Game',
        'Visual primary action: Start',
      ],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['invoke'],
            automationId: 'example-game-start',
            center: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1440,
              y: 920,
            },
            confidence: 'high',
            controlType: 'Button',
            description: 'Start button for selected Example Game detail page',
            enabled: true,
            label: 'Start',
            offscreen: false,
            relation: 'Start belongs to selected Example Game detail page.',
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
        currentSelection: 'Example Game',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1440,
          y: 920,
        },
        primaryAction: 'Start',
        relation: 'Start belongs to selected Example Game detail page.',
        selectionEvidence: [
          'Visual current selection: Example Game',
          'Visual selection verification: selected',
        ],
        selectionVerificationStatus: 'selected',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Start belongs to selected Example Game detail page and has screen coordinates.'],
    },
    verification: 'Start belongs to selected Example Game detail page and is actionable.',
  };
}

const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['Previous turn recovered target selection state.'],
  sourceText,
  steps: [],
  toolResults: [
    {
      command: createLegacySelectionRecoveryCommand(),
      result: createLegacySelectionRecoveryResult(),
    },
  ],
  userGoal,
};

let modelCallCount = 0;
const executedCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyVisualQuery: 'Verify whether "Example Game" is now the current selected/detail item.',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'interact_window_ui',
            automationId: 'example-game-list-item',
            targetText: 'Example Game',
            uiAction: 'select',
          },
          reason: 'Select Example Game first.',
          tool: 'execute_desktop_action',
        },
      ]),
    }),
    result: createApprovedSelectionResult(),
  },
  continuation,
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called when selected-target primary-action recovery can continue');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    executedCommands.push(command);
    if (command.toolCall?.name === 'execute_desktop_observation') {
      assert.equal(command.toolCall.input.action, 'summarize_visual_snapshot');
      assert.match(String(command.toolCall.input.question), /AgentRuntime post-action verification/iu);
      return createSelectedNeedsPrimaryActionVerification();
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.recoveryReadPurpose, 'selected-target-primary-action');
    assert.match(String(command.toolCall.input.question), /already confirmed selected\/current/u);
    assert.match(String(command.toolCall.input.question), /primary open\/start\/play\/launch action/u);
    assert.match(String(command.toolCall.input.question), /Do not click/u);
    return createPrimaryActionRecoveryResult();
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 2);
assert.equal(executedCommands[0]?.toolCall?.name, 'execute_desktop_observation');
assert.equal(executedCommands[1]?.toolCall?.name, 'locate_screen_elements');
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /Example Game|Start/u);
assert.match(stepsJson, /interact_window_ui|execute_desktop_input/u);
assert.match(result.pendingApproval?.reason ?? '', /Example Game/u);
assert.match(result.pendingApproval?.reason ?? '', /Start/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after auto recovery/u);

console.log('agent session v2 selected primary action recovery smoke ok');
