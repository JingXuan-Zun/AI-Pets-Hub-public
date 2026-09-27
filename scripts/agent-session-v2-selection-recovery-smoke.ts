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
const recoveryCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyVisualQuery: 'Example Game',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            x: 1180,
            y: 420,
          },
          reason: 'Click the approximate visible target item.',
          tool: 'execute_desktop_input',
        },
      ]),
    }),
    result: createVisibleOnlySequenceResult({
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
    }),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called when selection recovery can prepare approval');
  },
  settings,
  sourceText: '/agent start Example Game from the visible launcher',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
    assert.match(String(command.toolCall.input.question), /selected\/detail item|selected item|selection state/u);
    assert.match(String(command.toolCall.input.question), /Do not click/u);

    return {
      observations: [
        'Visual target matched: Example Game',
        'Visual current selection: Another Game',
        'Visual selection verification: visible-only',
        'Target candidate 0: label=Example Game selected=false actions=select center=1120,460',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Recovery observation found Example Game as a selectable list item.',
          'Visual selection verification: visible-only',
        ],
        status: 'unverified',
        summaryLines: ['Call: locate_screen_elements', 'Result: target item visible but not selected'],
        title: 'Post-action recovery observation',
        toolName: 'locate_screen_elements',
        verification: 'Example Game is visible but not selected.',
      },
      responseText: 'Example Game is visible as a list item, but Another Game is still selected.',
      stateSummary: {
        missingEvidence: ['Requested target is visible but not current selected/detail item.'],
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
          selectionEvidence: [
            'Visual current selection: Another Game',
            'Visual selection verification: visible-only',
          ],
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
  },
  userGoal: 'start Example Game from the visible launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const approvalSteps = JSON.parse(String(result.pendingApproval?.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
  reason: string;
  tool: string;
}>;
assert.equal(approvalSteps.length, 1);
assert.equal(approvalSteps[0]?.tool, 'execute_desktop_action');
assert.equal(approvalSteps[0]?.args.action, 'interact_window_ui');
assert.equal(approvalSteps[0]?.args.uiAction, 'select');
assert.equal(approvalSteps[0]?.args.targetText, 'Example Game');
assert.match(String(result.pendingApproval?.command.toolCall?.input.postVerifyVisualQuery), /selected\/detail item/u);
assert.doesNotMatch(JSON.stringify(approvalSteps), /Start|Play|Launch|Open/u);
assert.match(result.pendingApproval?.reason ?? '', /select the target item first/i);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after auto recovery/u);

console.log('agent session v2 selection recovery smoke ok');
