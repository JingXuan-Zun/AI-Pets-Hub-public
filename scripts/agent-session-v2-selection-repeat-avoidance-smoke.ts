import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolRecoveryEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'locate_screen_elements' ? 'desktop-observation' : 'app-launcher',
    instruction: 'start Example Game from the visible launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from the visible launcher',
    toolCall: {
      goal: 'start Example Game from the visible launcher',
      input,
      name,
    },
  };
}

function createVisibleOnlySequenceResult(recovery: AgentStructuredToolRecoveryEvidence): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Post-action visual state: visible_only',
        'Visual selection verification: visible-only',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_sequence',
        'Post-action visual state: visible_only',
      ],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Target item is visible, but selection is not confirmed.',
    },
    responseText: 'The target game is visible in the launcher list, but not confirmed as selected.',
    stateSummary: {
      missingEvidence: [
        'The requested target is visible, but not confirmed as the current selected/detail item.',
      ],
      observedState: [
        'Post-action visual state: visible_only',
        'Visual current selection: Another Game',
        'Visual selection verification: visible-only',
      ],
      recommendedRecovery: ['postActionRecoveryStrategy=re-locate-target | nextTool=locate_screen_elements'],
      structuredEvidence: {
        currentSelection: 'Another Game',
        postActionRecovery: recovery,
        postActionState: 'visible_only',
        selectionEvidence: [
          'Visual current selection: Another Game',
          'Visual selection verification: visible-only',
        ],
        selectionVerificationStatus: 'visible-only',
        status: 'unverified',
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-target-selection',
      },
    },
    verification: 'Target item is visible, but selection is not confirmed.',
  };
}

let modelCallCount = 0;

const previousSelectionInput = {
  postVerifyVisualQuery: 'Verify whether "Example Game" is now the current selected/detail item.',
  stepsJson: JSON.stringify([
    {
      args: {
        action: 'interact_window_ui',
        automationId: 'example-game-list-item',
        controlType: 'ListItem',
        fallbackX: 1120,
        fallbackY: 460,
        targetText: 'Example Game',
        uiAction: 'select',
        x: 1120,
        y: 460,
      },
      reason: 'Select the UI Automation item "Example Game" before locating its primary action.',
      tool: 'execute_desktop_action',
    },
  ]),
  stopOnError: true,
};

const previousResult = createVisibleOnlySequenceResult({
  nextArgs: {
    action: 'locate_element',
    forceRefresh: true,
    question: 'Read the current selected item and the requested target item.',
    targetDescription: 'Example Game',
    targetText: 'Example Game',
  },
  nextTool: 'locate_screen_elements',
  reason: 'Target is visible, but selection is not confirmed.',
  strategy: 're-locate-target',
});

const result = await runAgentProductionSession({
  continuation: {
    historyLines: [
      'Previous approved selection action did not verify target selection.',
    ],
    sourceText: '/agent start Example Game from the visible launcher',
    steps: [],
    toolResults: [
      {
        command: createToolCommand('execute_desktop_sequence', previousSelectionInput),
        result: previousResult,
      },
    ],
    userGoal: 'start Example Game from launcher',
  },
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      assert.doesNotMatch(userInput, /rejected repeated unverified action retry/u);
      return JSON.stringify({
        action: 'tool_call',
        args: previousSelectionInput,
        reason: 'Try selecting the same item again.',
        tool: 'execute_desktop_sequence',
        understanding: {
          blockedGoals: [],
          completedGoals: ['read selection state'],
          remainingGoals: ['select Example Game', 'launch Example Game'],
          successCriteria: 'Example Game is selected/current before primary launch action',
          userNeed: 'start Example Game from launcher',
          verificationEvidence: ['current selection remains Another Game'],
          verificationGaps: ['needs approval to select target'],
          verificationStatus: 'partial',
        },
      });
    }

    assert.match(userInput, /rejected repeated unverified action retry/u);
    assert.match(userInput, /previousPostActionState=visible_only/u);
    assert.match(userInput, /same action primitive already ran/u);

    return JSON.stringify({
      action: 'ask_user',
      message: '我看到同一个选择动作已经失败过一次了。现在需要换用键盘导航、滚动后再观察，或者你告诉我当前列表里目标大概在第几个位置。',
      reason: 'The same selection primitive was rejected, so do not ask approval for it again.',
      understanding: {
        blockedGoals: ['same selector still does not verify target selection'],
        completedGoals: ['read selection state', 'detected repeated failed selector'],
        remainingGoals: ['select Example Game', 'launch Example Game'],
        successCriteria: 'Example Game is selected/current before primary launch action',
        userNeed: 'start Example Game from launcher',
        verificationEvidence: ['current selection remains Another Game'],
        verificationGaps: ['need alternate selection strategy'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game from the visible launcher',
  toolExecutor: async () => {
    throw new Error('repeated selection action should be rejected before execution or approval');
  },
  userGoal: 'start Example Game from the visible launcher',
});

assert.equal(modelCallCount, 2);
assert.equal(result.status, 'needs-user');
assert.equal(result.pendingApproval, null);
assert.match(result.finalAnswer ?? '', /换用键盘导航|滚动后再观察|第几�?u);
assert.match(result.continuation.historyLines.join('\n'), /rejected repeated unverified action retry/u);
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /prepared visual-action approval after auto recovery/u);

console.log('agent session v2 selection repeat avoidance smoke ok');
