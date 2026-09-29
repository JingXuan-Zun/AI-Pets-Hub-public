import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
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

function createMisleadingSelectionActionResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Selection command was sent.'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Result: selection command sent'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Selection command completed.',
    },
    responseText: 'Selection command completed.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual current selection: Another Game',
        'Visual selection verification: mismatch',
      ],
      structuredEvidence: {
        confidence: 'high',
        currentSelection: 'Another Game',
        selectionEvidence: [
          'Visual current selection: Another Game',
          'Visual selection verification: mismatch',
        ],
        selectionVerificationStatus: 'mismatch',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-target-selection',
      },
      verificationEvidence: [
        'Selection command was sent, but current selected/detail item is still Another Game.',
      ],
    },
    verification: 'Selection command completed.',
  };
}

function createSelectionRecoveryResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual current selection: Another Game',
      'Visual selection verification: visible-only',
      'Target candidate: Example Game selected=false actions=select center=1120,460',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Recovery observation found Example Game as a selectable list item.'],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements', 'Result: target selectable but not selected'],
      title: 'Selection recovery observation',
      toolName: 'locate_screen_elements',
      verification: 'Example Game is visible but not selected.',
    },
    responseText: 'Example Game is visible as a selectable item; Another Game remains selected.',
    stateSummary: {
      missingEvidence: ['Requested target is visible but not selected/current.'],
      observedState: [
        'Visual target matched: Example Game',
        'Visual current selection: Another Game',
        'Visual selection verification: visible-only',
      ],
      recommendedRecovery: ['Select the target item first, then verify selection.'],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        currentSelection: 'Another Game',
        selectionVerificationStatus: 'visible-only',
        status: 'unverified',
        targetCandidates: [
          {
            actions: ['select'],
            automationId: 'example-game-list-item',
            center: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1120,
              y: 460,
            },
            confidence: 'high',
            controlType: 'ListItem',
            label: 'Example Game',
            selected: false,
            selectionItem: true,
            source: 'ui-automation',
          },
        ],
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-target-selection',
      },
      verificationEvidence: [
        'Example Game is visible as a selectable list item.',
        'Current selected item is Another Game.',
      ],
    },
    verification: 'Example Game is visible but not selected.',
  };
}

let modelCallCount = 0;
const recoveryCommands: AgentChatCommand[] = [];

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
    result: createMisleadingSelectionActionResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called when implicit selection mismatch can recover');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.recoveryReadPurpose, 'target-selection-state');
    assert.match(String(command.toolCall.input.question), /selected\/detail item|selection state/u);
    assert.match(String(command.toolCall.input.question), /Do not click/u);
    return createSelectionRecoveryResult();
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /example-game-list-item/u);
assert.match(stepsJson, /select/u);
assert.doesNotMatch(stepsJson, /Start|Play|Launch|Open/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after auto recovery/u);

console.log('agent session v2 implicit selection state smoke ok');
