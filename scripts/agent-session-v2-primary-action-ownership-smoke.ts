import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game and the Start button that belongs to it',
        targetText: 'Example Game',
      },
      reason: 'Locate the selected game and its associated primary action.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['verify Start belongs to Example Game before clicking'],
        successCriteria: 'Start button ownership and click coordinate are verified before approval',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need target/action ownership evidence.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');

    if (toolCallCount === 1) {
      assert.equal(command.toolCall.input.action, 'locate_element');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      return {
        observations: [
          'Visual target matched: Example Game',
          'Visual current selection: Example Game',
          'Visual selection verification: selected',
          'Visual primary action: Start',
          'Visual element center: x=1440 y=920',
          'No relation between Start and Example Game was verified in this pass.',
        ],
        ok: true,
        responseText: 'Example Game is selected and a Start button is visible, but the button ownership was not verified.',
        stateSummary: {
          observedState: [
            'Visual target matched: Example Game',
            'Visual current selection: Example Game',
            'Visual selection verification: selected',
            'Visual primary action: Start',
          ],
          structuredEvidence: {
            actionCandidates: [
              {
                actions: ['invoke'],
                automationId: 'generic-start-button',
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'test',
                  x: 1440,
                  y: 920,
                },
                confidence: 'high',
                controlType: 'Button',
                description: 'Generic Start button; ownership not verified',
                enabled: true,
                label: 'Start',
                offscreen: false,
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
            selectionEvidence: [
              'Visual current selection: Example Game',
              'Visual selection verification: selected',
            ],
            selectionVerificationStatus: 'selected',
            launcherVerification: {
              detailMatchesTarget: null,
              evidence: [
                'targetMatched=Example Game',
                'primaryAction=Start',
              ],
              primaryAction: 'Start',
              primaryActionMatchesTarget: null,
              reason: 'Primary action ownership is not confirmed for the requested target.',
              status: 'needs-relation',
              targetMatched: 'Example Game',
              targetSelected: true,
              targetVisible: true,
            },
            status: 'success',
            targetMatched: 'Example Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: [
            'Example Game is selected.',
            'A Start button is visible, but ownership is not verified.',
          ],
        },
        verification: 'Target is selected and Start is visible, but ownership is missing.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);
    assert.match(String(command.toolCall.input.question), /relation/u);
    assert.match(String(command.toolCall.input.question), /belongs to the requested target/u);

    return {
      observations: [
        'Focused crop confirms the Start button belongs to selected Example Game detail page.',
        'Visual target matched: Example Game',
        'Visual current selection: Example Game',
        'Visual primary action: Start',
        'Visual target/action relation: Start belongs to selected Example Game detail page.',
        'Visual element center: x=1440 y=920',
      ],
      ok: true,
      responseText: 'Focused observation verified that Start belongs to selected Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual current selection: Example Game',
          'Visual primary action: Start',
          'Visual target/action relation: Start belongs to selected Example Game detail page.',
        ],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['invoke'],
              automationId: 'example-game-start-button',
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
        verificationEvidence: [
          'Start belongs to selected Example Game detail page and has a safe coordinate.',
        ],
      },
      verification: 'Start belongs to selected Example Game detail page and is actionable.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /Start|1440|920/u);
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /prepared visual-action approval:\ntool=execute_desktop_sequence/u);
assert.doesNotMatch(
  result.continuation.historyLines.join('\n'),
  /prepared visual-action approval:[\s\S]*generic-start-button/u,
);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 primary action ownership smoke ok');
