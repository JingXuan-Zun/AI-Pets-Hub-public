import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const toolCalls: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 2) {
      // The refinements verified the Start button; the model selects the
      // click, which pauses for approval.
      assert.match(userInput, /elementCenter=924,612/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: { action: 'click', x: 924, y: 612 },
              reason: 'Click the verified Example Game Start button.',
              tool: 'execute_desktop_input',
            },
          ]),
        },
        reason: 'The focused crop verified the Start button; request approval for the click.',
        tool: 'execute_desktop_sequence',
      });
    }
    assert.equal(
      modelCallCount,
      1,
      `parallel visual refinement should avoid a second model call; toolCalls=${toolCalls.map((command) => `${command.toolCall?.name}:${command.toolCall?.input.action ?? ''}`).join(', ')}`,
    );
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Observe memory and visual launcher state in parallel before acting.',
      tools: [
        {
          args: {
            action: 'recall',
            query: 'preferred launcher',
          },
          reason: 'Read remembered launcher preference.',
          tool: 'execute_memory_action',
        },
        {
          args: {
            action: 'inspect_window_ui',
            query: 'Launcher',
            targetText: 'Example Game',
          },
          reason: 'Inspect the launcher UI controls for the game target.',
          tool: 'execute_desktop_observation',
        },
      ],
      understanding: {
        completedGoals: [],
        remainingGoals: ['verify the exact launch button before clicking'],
        successCriteria: 'target/action/relation/coordinate are verified before approval',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need focused visual confirmation.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    toolCalls.push(command);

    if (command.toolCall?.name === 'execute_memory_action') {
      return {
        observations: ['Memory recall: preferred launcher is Launcher'],
        ok: true,
        responseText: 'Preferred launcher: Launcher',
        verification: 'memory observed',
      };
    }

    if (command.toolCall?.name === 'execute_desktop_observation') {
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      assert.equal(command.toolCall.input.query, 'Launcher');
      return {
        observations: [
          'Desktop observation: inspect_window_ui',
          'Matched controls: Example Game tile bounds=720,480,240x130',
          'Visual action readiness: needs-primary-action',
        ],
        ok: true,
        responseText: 'UI Automation found the Example Game tile, but not the associated Start button.',
        stateSummary: {
          missingEvidence: ['Primary launch button is not proven by UI Automation alone.'],
          observedState: ['Example Game tile has screen bounds.'],
          recommendedRecovery: ['Focus the Example Game tile crop before clicking.'],
          structuredEvidence: {
            coordinateConfidence: 'medium',
            targetCandidates: [
              {
                bounds: {
                  coordinateSpace: 'native-screen',
                  height: 130,
                  source: 'ui-automation',
                  width: 240,
                  x: 720,
                  y: 480,
                },
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'ui-automation',
                  x: 840,
                  y: 545,
                },
                confidence: 'medium',
                label: 'Example Game tile',
                region: 'ListItem',
              },
            ],
            confidence: 'medium',
            primaryAction: null,
            status: 'unverified',
            targetMatched: 'Example Game',
            visualActionReadiness: 'needs-primary-action',
          },
        },
        verification: 'Needs focused crop before approval.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.focusCoordinateSpace, 'native-screen');
    if (toolCalls.length === 3) {
      assert.equal(command.toolCall.input.focusX, 576);
      assert.equal(command.toolCall.input.focusY, 402);
      assert.equal(command.toolCall.input.focusWidth, 528);
      assert.equal(command.toolCall.input.focusHeight, 286);
    } else {
      // Bounded second refinement re-checks the ready Start button point.
      assert.equal(toolCalls.length, 4);
      assert.equal(Number(command.toolCall.input.focusX) + Number(command.toolCall.input.focusWidth) / 2, 924);
      assert.equal(Number(command.toolCall.input.focusY) + Number(command.toolCall.input.focusHeight) / 2, 612);
    }
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);
    return {
      observations: [
        'Visual focus crop: Start button area',
        'Visual target matched: Example Game',
        'Visual primary action: Start button',
        'Visual target/action relation: Start button belongs to Example Game',
        'Visual element center: x=924 y=612',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused crop verified the Example Game Start button.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start button',
          'Visual target/action relation: Start button belongs to Example Game',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 924,
            y: 612,
          },
          primaryAction: 'Start button',
          relation: 'Start button belongs to Example Game',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop verified action relation and coordinates.'],
      },
      verification: 'Focused crop verified the actionable button.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 2);
assert.equal(toolCalls.length, 4);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /924/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /612/u);
assert.match(result.continuation.historyLines.join('\n'), /parallel tool results/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);

console.log('agent session v2 parallel visual refinement smoke ok');
