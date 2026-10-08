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
    instruction: 'start a visible app and recover from unchanged UI',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input,
      name,
    },
  };
}

function createUnchangedActionResult(recovery: AgentStructuredToolRecoveryEvidence): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: unchanged'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action visual state: unchanged'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence visual state is unchanged.',
    },
    responseText: 'Clicked the visible launcher area, but the page did not visibly change.',
    stateSummary: {
      missingEvidence: ['The requested target is not confirmed launched.'],
      observedState: ['Post-action visual state: unchanged'],
      recommendedRecovery: ['postActionRecoveryStrategy=re-locate-target | nextTool=locate_screen_elements'],
      structuredEvidence: {
        postActionRecovery: recovery,
        postActionState: 'unchanged',
        status: 'unverified',
      },
    },
    verification: 'Post-sequence visual state is unchanged.',
  };
}

let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyVisualQuery: 'Example Game launched',
      stepsJson: '[]',
    }),
    result: createUnchangedActionResult({
      nextArgs: {
        action: 'locate_element',
        forceRefresh: true,
        targetDescription: 'Example Game launch target',
      },
      nextTool: 'locate_screen_elements',
      reason: 'Refresh target coordinates after unchanged UI.',
      strategy: 're-locate-target',
    }),
  },
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('Automatic recovery plus visual refinement should not need a model call in this scenario.');
  },
  settings,
  sourceText: '/agent start the visible app from the launcher',
  toolExecutor: async (command) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');

    if (toolCallCount === 1) {
      assert.equal(command.toolCall.input.forceRefresh, true);
      return {
        observations: [
          'Visual target candidate 1: Example Game tile, centerRatio=0.720,0.640',
          'Visual target candidate 2: Example Game news card, centerRatio=0.430,0.410',
          'Visual missing evidence: matched target is ambiguous.',
        ],
        ok: true,
        receipt: {
          evidenceLines: ['Two candidate regions were found for Example Game.'],
          status: 'unverified',
          summaryLines: ['Call: locate_screen_elements', 'Result: target ambiguous'],
          title: 'Post-action recovery observation',
          toolName: 'locate_screen_elements',
          verification: 'Target is ambiguous.',
        },
        responseText: 'Two candidate target regions were found.',
        stateSummary: {
          missingEvidence: ['Multiple target candidates remain plausible.'],
          observedState: [
            'Visual target candidate 1: Example Game tile, centerRatio=0.720,0.640',
            'Visual target candidate 2: Example Game news card, centerRatio=0.430,0.410',
          ],
          recommendedRecovery: ['Use focus crop params around the most relevant candidate before clicking.'],
          structuredEvidence: {
            status: 'unverified',
            targetCandidates: [
              {
                centerRatio: { x: 0.72, y: 0.64 },
                confidence: 'high',
                label: 'Example Game tile',
                region: 'launcher library tile',
              },
              {
                centerRatio: { x: 0.43, y: 0.41 },
                confidence: 'medium',
                label: 'Example Game news card',
                region: 'news panel',
              },
            ],
            visualActionReadiness: 'needs-target-selection',
          },
        },
        verification: 'Target is ambiguous.',
      };
    }

    if (toolCallCount === 2) {
      assert.equal(command.toolCall.input.focusCenterRatioX, 0.72);
      assert.equal(command.toolCall.input.focusCenterRatioY, 0.64);
    } else {
      // Bounded second refinement re-checks the ready Start point.
      assert.equal(toolCallCount, 3);
      assert.equal(command.toolCall.input.focusCoordinateSpace, 'native-screen');
    }
    return {
      observations: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1460 y=930',
      ],
      ok: true,
      receipt: {
        evidenceLines: ['Focused crop identified Start at screen coordinate 1460,930.'],
        status: 'success',
        summaryLines: ['Call: locate_screen_elements', 'Result: focused target ready'],
        title: 'Focused visual recovery observation',
        toolName: 'locate_screen_elements',
        verification: 'Start control is visible and actionable.',
      },
      responseText: 'Focused crop identified a clear Start control.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual element center: x=1460 y=930',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          // Declared bounds let the actionable-area gate accept the point.
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 44,
            source: 'test',
            width: 150,
            x: 1385,
            y: 908,
          },
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1460,
            y: 930,
          },
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop identified Start at screen coordinate 1460,930.'],
      },
      verification: 'Start control is visible and actionable.',
    };
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(toolCallCount, 3);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1460/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);

console.log('agent session v2 recovery strategy score smoke ok');
