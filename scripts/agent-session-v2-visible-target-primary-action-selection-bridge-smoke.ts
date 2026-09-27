import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let modelCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its associated primary launch action',
        },
        reason: 'Need to inspect the visible launcher target and its action.',
        tool: 'locate_screen_elements',
      });
    }

    throw new Error('visible target with selectable candidate should prepare selection approval without another model call');
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visual target matched: Game',
        'Visual target candidate 1: Game | confidence=high | region=left launcher list | center=1120,460',
        'No associated primary launch action was identified yet.',
        'Visual action readiness: needs-primary-action',
      ],
      ok: true,
      responseText: 'Game is visible in the launcher list, but no primary launch action is visible yet.',
      stateSummary: {
        missingEvidence: [
          'The requested target is visible, but no associated primary open/start/play/launch action has been identified.',
        ],
        recommendedRecovery: [
          'Select the target item first, then re-observe the detail area for its primary open/start/play/launch action.',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          primaryAction: null,
          status: 'unverified',
          targetCandidates: [
            {
              actions: ['select'],
              automationId: 'game-list-item',
              center: {
                coordinateSpace: 'native-screen',
                source: 'test',
                x: 1120,
                y: 460,
              },
              confidence: 'high',
              controlType: 'ListItem',
              label: 'Game',
              selected: false,
              selectionItem: true,
              source: 'ui-automation',
            },
          ],
          targetMatched: 'Game',
          visualActionReadiness: 'needs-primary-action',
        },
        verificationEvidence: ['Game is visible as a selectable launcher item.'],
      },
      verification: 'Target item is visible; primary action is not visible until target selection is confirmed.',
    };
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.equal(result.pendingApproval?.command.toolCall?.actionScope?.completion, 'intermediate');
assert.equal(result.pendingApproval?.command.toolCall?.actionScope?.targetRef, 'Game');

const steps = JSON.parse(String(result.pendingApproval?.command.toolCall?.input.stepsJson)) as Array<{
  args: Record<string, unknown>;
  tool: string;
}>;
assert.equal(steps.length, 1);
assert.equal(steps[0]?.tool, 'execute_desktop_action');
assert.equal(steps[0]?.args.action, 'interact_window_ui');
assert.equal(steps[0]?.args.uiAction, 'select');
assert.equal(steps[0]?.args.targetText, 'Game');
assert.match(result.pendingApproval?.reason ?? '', /select the target item first/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

console.log('agent session v2 visible target primary action selection bridge smoke ok');
