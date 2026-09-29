import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createOcrOnlyResult(): AgentChatCommandResult {
  return {
    observations: [
      'Screen element locate action: locate_element',
      'Source query: Launcher',
      'Target element: Example Game',
      'Visual target matched: Example Game',
      'Visual text candidates: Example Game (confidence=high, left library tile) | Start (confidence=high, lower right button)',
      'Visual action candidate 1: Start',
      'Visual action readiness: ready',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Visual target matched: Example Game',
        'Visual text candidates: Example Game (confidence=high, left library tile) | Start (confidence=high, lower right button)',
        'Visual action candidate 1: Start',
        'Visual action readiness: ready',
      ],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Action: locate_element'],
      title: 'Agent visual locate',
      toolName: 'locate_screen_elements',
      verification: 'OCR-like visual candidates identified the target and action text.',
    },
    responseText: 'OCR-like visual candidates identified Example Game and a Start text button.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual text candidates include Start at the lower right button.',
      ],
      structuredEvidence: {
        actionCandidates: [
          {
            bounds: {
              coordinateSpace: 'native-screen',
              height: 46,
              source: 'ocr',
              width: 128,
              x: 960,
              y: 542,
            },
            confidence: 'high',
            label: 'Start',
            region: 'lower right button',
          },
        ],
        confidence: 'high',
        coordinateConfidence: 'high',
        primaryAction: 'Start',
        relation: 'Start belongs to Example Game',
        status: 'success',
        targetMatched: 'Example Game',
        visibleTextCandidates: [
          'Example Game (confidence=high, left library tile)',
          'Start (confidence=high, lower right button)',
        ],
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['OCR-like candidates identified a high-confidence Start action.'],
    },
    verification: 'OCR-like visual candidates identified the target/action text and bounds.',
  };
}

let modelCallCount = 0;
const result = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        targetText: 'Example Game',
      },
      reason: 'Locate the target and action button visually.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['click the Start action for Example Game'],
        successCriteria: 'Example Game Start action is ready for approval',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need target/action location.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return createOcrOnlyResult();
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /execute_desktop_input/u);
assert.match(stepsJson, /"action":"click"/u);
assert.match(stepsJson, /"x":1024/u);
assert.match(stepsJson, /"y":565/u);
assert.match(result.continuation.historyLines.join('\n'), /visual-action approval/u);

console.log('agent session v2 OCR text action candidate normalization smoke ok');
