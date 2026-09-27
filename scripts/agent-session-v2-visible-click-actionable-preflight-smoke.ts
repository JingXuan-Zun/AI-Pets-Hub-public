import assert from 'node:assert/strict';
import { runAgentProductionSession, type AgentChatCommand } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          app: 'WeGame',
          mode: 'visible_click',
          requireActionable: true,
          requireSameHwnd: true,
          target: 'League of Legends',
        },
        reason: 'Focus WeGame, locate League of Legends, and click it.',
        tool: 'execute_desktop_sequence',
      });
    }

    return JSON.stringify({
      action: 'ask_user',
      message: 'The target is not actionable yet.',
      reason: 'Do not request click approval without an actionable target.',
    });
  },
  settings,
  sourceText: '/agent retry opening League of Legends inside WeGame',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
    assert.equal(command.toolCall.input.sourceType, 'window');
    assert.equal(command.toolCall.input.allowScreenFallback, false);
    assert.equal(command.toolCall.input.targetText, 'League of Legends');
    return {
      ok: true,
      responseText: 'WeGame is visible, but no actionable League of Legends control was resolved.',
      stateSummary: {
        missingEvidence: ['No primary action or usable coordinate was resolved.'],
        structuredEvidence: {
          captureSourceType: 'window',
          captureTrusted: true,
          confidence: 'medium',
          launcherVerification: {
            primaryActionMatchesTarget: null,
            status: 'needs-primary-action',
            targetVisible: true,
          },
          primaryAction: 'None (no clear clickable control)',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'needs-primary-action',
        },
      },
      verification: 'Target needs primary-action refinement before click approval.',
    };
  },
  userGoal: 'retry opening League of Legends inside WeGame',
});

assert.equal(toolCallCount, 1);
assert.equal(result.pendingApproval, null);
assert.equal(result.status, 'needs-user');
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /selected approval-required tool/u);

let contradictoryModelCallCount = 0;
const contradictoryResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    contradictoryModelCallCount += 1;
    if (contradictoryModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          allowScreenFallback: false,
          sourceQuery: 'WeGame',
          sourceType: 'window',
          targetText: 'Login',
        },
        reason: 'Locate the login control before requesting click approval.',
        tool: 'locate_screen_elements',
      });
    }

    return JSON.stringify({
      action: 'ask_user',
      message: 'The login control still needs visual refinement.',
      reason: 'The launcher relation is not verified.',
    });
  },
  settings,
  sourceText: '/agent open League of Legends inside WeGame',
  toolExecutor: async () => ({
    ok: true,
    responseText: [
      'Visual target matched: Login',
      'Visual primary action: None (no clear clickable control)',
      'Visual element center: x=200 y=200',
      'Launcher verification: status=needs-relation targetVisible=true actionMatches=unknown',
      'Visual action readiness: ready',
    ].join('\n'),
    stateSummary: {
      structuredEvidence: {
        captureSourceType: 'window',
        captureTrusted: true,
        confidence: 'medium',
        coordinateAuditStatus: 'coordinate_ok',
        coordinateConfidence: 'high',
        elementCenter: { coordinateSpace: 'native-screen', x: 200, y: 200 },
        finalWindow: { hwnd: 1249096, processName: 'wegame', title: 'WeGame' },
        launcherVerification: {
          primaryActionMatchesTarget: null,
          status: 'needs-relation',
          targetVisible: true,
        },
        primaryAction: 'None (no clear clickable control)',
        relation: 'Login control relation is unclear.',
        sourceBounds: {
          coordinateSpace: 'native-screen',
          height: 670,
          width: 1191,
          x: 684,
          y: 355,
        },
        targetMatched: 'Login',
        visualActionReadiness: 'ready',
      },
    },
    verification: 'A point was estimated, but no actionable login control was verified.',
  }),
  userGoal: 'open League of Legends inside WeGame',
});

assert.equal(contradictoryResult.pendingApproval, null);
assert.equal(contradictoryResult.status, 'needs-user');
assert.doesNotMatch(contradictoryResult.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

console.log('agent session v2 visible click actionable preflight smoke ok');
