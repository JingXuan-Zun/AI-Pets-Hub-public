import assert from 'node:assert/strict';
import { type AgentChatCommand } from '../src/agent/agentChatCommand.ts';
import { createAgentVisualRefinementCommand } from '../src/agent/capabilities/agentVisualRefinementCapabilityAdapter.ts';
import { type AgentRuntimeToolResultEntry } from '../src/agent/runtime/agentRuntimeContract.ts';

// After a focused crop, elementCenterRatio is relative to the crop's
// sourceBounds. The next bounded refinement must be centered on the mapped
// native point, not on the raw crop ratio applied to the whole window.
const sourceText = '/agent open Game inside Launcher';
const userGoal = 'open Game inside Launcher';

function locateCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: { goal: userGoal, input, name: 'locate_screen_elements' },
  };
}

const initialLocate: AgentRuntimeToolResultEntry = {
  command: locateCommand({
    action: 'locate_element',
    sourceQuery: 'Launcher',
    sourceType: 'window',
    targetDescription: 'Game and its primary launch button',
  }),
  result: {
    ok: true,
    responseText: 'A likely launch candidate is visible.',
    stateSummary: {
      structuredEvidence: {
        actionCandidates: [{
          centerRatio: { coordinateSpace: 'source-ratio', x: 0.82, y: 0.76 },
          confidence: 'medium',
          label: 'Launch',
          region: 'lower right',
        }],
        confidence: 'medium',
        primaryAction: null,
        status: 'unverified',
        targetMatched: 'Game',
        visualActionReadiness: 'needs-primary-action',
      },
    },
  },
};

const focusedCrop: AgentRuntimeToolResultEntry = {
  command: locateCommand({
    action: 'locate_element',
    focusCenterRatioX: 0.82,
    focusCenterRatioY: 0.76,
    focusHeightRatio: 0.24,
    focusScale: 2,
    focusWidthRatio: 0.28,
    forceRefresh: true,
    question: 'AgentSessionV2 visual refinement Previous visual readiness was needs-primary-action.',
    sourceQuery: 'Launcher',
    sourceType: 'window',
    targetDescription: 'Game and its primary launch button; focused candidate: Launch',
  }),
  result: {
    ok: true,
    responseText: 'Focused crop verified the Game launch button.',
    stateSummary: {
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenterRatio: { coordinateSpace: 'source-ratio', x: 0.5, y: 0.52 },
        primaryAction: 'Launch button',
        relation: 'Launch button belongs to the selected Game page',
        sourceBounds: { coordinateSpace: 'native-screen', height: 220, width: 360, x: 700, y: 460 },
        status: 'success',
        targetMatched: 'Game',
        visualActionReadiness: 'ready',
      },
    },
  },
};

const command = createAgentVisualRefinementCommand({
  latestEntry: focusedCrop,
  sourceText,
  toolResults: [initialLocate, focusedCrop],
  userGoal,
});

assert.ok(command, 'the ready crop should get one bounded follow-up refinement');
const input = command.toolCall?.input ?? {};
assert.equal(input.focusCoordinateSpace, 'native-screen');
assert.equal(input.focusCenterRatioX, undefined, 'crop-relative ratio must not be reused as a window ratio');
assert.equal(Number(input.focusX) + Number(input.focusWidth) / 2, 880);
assert.equal(Number(input.focusY) + Number(input.focusHeight) / 2, 574);

// A window-level result keeps its ratio-based focus.
const windowLevel = createAgentVisualRefinementCommand({
  latestEntry: initialLocate,
  sourceText,
  toolResults: [initialLocate],
  userGoal,
});
assert.equal(windowLevel?.toolCall?.input.focusCenterRatioX, 0.82);
assert.equal(windowLevel?.toolCall?.input.focusCenterRatioY, 0.76);

console.log('agent visual refinement crop-relative focus smoke ok');
