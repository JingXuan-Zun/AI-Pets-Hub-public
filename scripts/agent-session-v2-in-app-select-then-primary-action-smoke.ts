import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open Example Game inside Example Launcher';
const userGoal = 'open Example Game inside Example Launcher';

function createVisibleOnlyLocateResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Selection verification: visible-only',
      'Target item center: x=640 y=360',
    ],
    ok: true,
    responseText: 'Example Game is visible in the launcher list, but it is not selected yet.',
    stateSummary: {
      missingEvidence: ['The target is visible but not selected/current yet.'],
      observedState: ['Example Game visible in launcher list.'],
      recommendedRecovery: ['Select the visible target item, then re-observe its primary action.'],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        selectionVerificationStatus: 'visible-only',
        status: 'success',
        targetCandidates: [
          {
            center: {
              coordinateSpace: 'native-screen',
              source: 'visual',
              x: 640,
              y: 360,
            },
            confidence: 'high',
            label: 'Example Game',
            selected: false,
            source: 'visual',
          },
        ],
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-target-selection',
      },
      verificationEvidence: ['Example Game is visible but not selected.'],
    },
    verification: 'Example Game is visible but not selected/current.',
  };
}

function createReadyPrimaryActionLocateResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Play',
      'Visual target/action relation: Play belongs to Example Game detail page',
      'Visual element center: x=1440 y=920',
    ],
    ok: true,
    responseText: 'Located Example Game and its Play action.',
    stateSummary: {
      observedState: [
        'Target matched: Example Game',
        'Primary action: Play',
        'Relation: Play belongs to Example Game detail page',
      ],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        currentSelection: 'Example Game',
        // Declared bounds let the actionable-area gate accept the point.
        elementBounds: {
          coordinateSpace: 'native-screen',
          height: 44,
          source: 'visual',
          width: 150,
          x: 1365,
          y: 898,
        },
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'visual',
          x: 1440,
          y: 920,
        },
        launcherVerification: {
          detailMatchesTarget: true,
          primaryActionMatchesTarget: true,
          status: 'ready',
          targetSelected: true,
          targetVisible: true,
        },
        primaryAction: 'Play',
        relation: 'Play belongs to Example Game detail page',
        selectionVerificationStatus: 'selected',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Play is associated with selected Example Game.'],
    },
    verification: 'Example Game Play action is ready at x=1440 y=920.',
  };
}

const firstRun = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'locate_element',
      sourceQuery: 'Example Launcher',
      sourceType: 'window',
      targetDescription: 'Example Game inside Example Launcher',
      targetText: 'Example Game',
    },
    reason: 'Locate Example Game inside the launcher.',
    tool: 'locate_screen_elements',
  }),
  settings,
  sourceText,
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return createVisibleOnlyLocateResult();
  },
  userGoal,
});

assert.equal(firstRun.status, 'needs-approval');
assert.equal(firstRun.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(firstRun.pendingApproval?.command.toolCall?.input.stepsJson), /640/u);

const secondRunCommands: AgentChatCommand[] = [];
let secondModelCallCount = 0;
const secondRun = await runAgentProductionSession({
  approvedToolResult: {
    command: firstRun.pendingApproval.command,
    result: {
      ok: true,
      receipt: {
        evidenceLines: ['Selected Example Game list item.'],
        status: 'success',
        summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
        title: 'Target selection',
        toolName: 'execute_desktop_sequence',
        verification: 'The visible target item was selected.',
      },
      responseText: 'Selected Example Game.',
      stateSummary: {
        changedState: ['active-window-input-state'],
        observedState: ['Selected Example Game list item.'],
        verificationEvidence: ['Selection click completed.'],
      },
      verification: 'Selection click completed; primary action still needs verification.',
    },
  },
  continuation: firstRun.continuation,
  maxSteps: 5,
  modelCaller: async () => {
    secondModelCallCount += 1;
    throw new Error('model should not be called between selecting the target and locating its primary action');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    secondRunCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.match(String(command.toolCall.input.targetText), /Example Game/u);
    return createReadyPrimaryActionLocateResult();
  },
  userGoal,
});

assert.equal(secondModelCallCount, 0);
assert.equal(secondRun.status, 'needs-approval');
assert.equal(secondRun.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(secondRun.pendingApproval?.command.toolCall?.input.stepsJson), /1440/u);
assert.equal(secondRunCommands.length, 1);

console.log('agent session v2 in-app select then primary action smoke ok');
