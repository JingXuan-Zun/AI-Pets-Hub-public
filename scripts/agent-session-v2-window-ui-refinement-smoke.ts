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
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 2) {
      // The focused crop around the UIA candidate found the Start button; the
      // model selects the click, which pauses for approval.
      assert.match(userInput, /visual refinement result:/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: { action: 'click', x: 810, y: 590 },
              reason: 'Click the Start button found in the focused crop.',
              tool: 'execute_desktop_input',
            },
          ]),
        },
        reason: 'The focused crop found the Start button; request approval for the click.',
        tool: 'execute_desktop_sequence',
      });
    }
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'inspect_window_ui',
        maxDepth: 6,
        query: 'Launcher',
        targetText: 'Example Game',
      },
      reason: 'Read UI controls first, then use vision if the button relation is unclear.',
      tool: 'execute_desktop_observation',
      understanding: {
        completedGoals: ['outer Launcher window identified'],
        remainingGoals: ['find the exact start button for Example Game'],
        successCriteria: 'target/action relation and coordinate are verified before clicking',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need exact actionable launch control evidence.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;

    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      return {
        observations: [
          'Desktop observation: inspect_window_ui',
          'Matched controls: Example Game tile bounds=700,500,220x120',
        ],
        ok: true,
        responseText: 'UI Automation found the Example Game tile, but not a separate launch action.',
        stateSummary: {
          missingEvidence: ['Primary launch action relation is not fully proven by UI Automation alone.'],
          observedState: ['Example Game tile candidate has screen bounds.'],
          recommendedRecovery: ['Use a focused visual crop around the UI Automation candidate.'],
          structuredEvidence: {
            confidence: 'medium',
            coordinateConfidence: 'medium',
            status: 'success',
            targetCandidates: [
              {
                bounds: {
                  coordinateSpace: 'native-screen',
                  height: 120,
                  source: 'ui-automation',
                  width: 220,
                  x: 700,
                  y: 500,
                },
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'ui-automation',
                  x: 810,
                  y: 560,
                },
                confidence: 'medium',
                description: 'Example Game tile type=ListItem',
                label: 'Example Game tile',
                region: 'ListItem',
              },
            ],
            targetMatched: 'Example Game tile',
            visualActionReadiness: 'needs-primary-action',
          },
          verificationEvidence: ['UI Automation found a bounded target candidate.'],
        },
        verification: 'UI Automation target candidate is bounded but action relation is unclear.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
    assert.equal(command.toolCall.input.focusCoordinateSpace, 'native-screen');
    assert.equal(command.toolCall.input.focusX, 568);
    assert.equal(command.toolCall.input.focusY, 428);
    assert.equal(command.toolCall.input.focusWidth, 484);
    assert.equal(command.toolCall.input.focusHeight, 264);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);

    return {
      observations: [
        'Visual focus crop: Example Game tile',
        'Visual target matched: Example Game',
        'Visual primary action: Start button',
        'Visual element center: x=810 y=590',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused crop found the Start button for Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start button',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 810,
            y: 590,
          },
          primaryAction: 'Start button',
          relation: 'Start button belongs to Example Game.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused visual crop verified the Start button coordinate.'],
      },
      verification: 'Focused visual crop verified the actionable button.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 2);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /810/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /590/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);

console.log('agent session v2 window ui refinement smoke ok');
