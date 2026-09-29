import assert from 'node:assert/strict';
import { evaluateAgentVisualTargetVerification } from '../src/agent/agentVisualTargetVerification.ts';
import type { AgentChatCommand, AgentStructuredToolEvidence } from '../src/agent/agentChatCommand.ts';

function command(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'verify visual target',
    kind: 'tool-call',
    sourceText: 'click login',
    toolCall: {
      goal: 'click login',
      input,
      name: 'locate_screen_elements',
    },
  };
}

function evidence(overrides: Partial<AgentStructuredToolEvidence> = {}): AgentStructuredToolEvidence {
  return {
    confidence: 'high',
    coordinateConfidence: 'high',
    elementCenter: { coordinateSpace: 'native-screen', x: 500, y: 300 },
    elementBounds: { coordinateSpace: 'native-screen', height: 42, width: 140, x: 430, y: 279 },
    primaryAction: 'Login',
    relation: 'Login belongs to QQ',
    targetMatched: 'QQ login button',
    visualActionReadiness: 'ready',
    ...overrides,
  };
}

const noPrevious = evaluateAgentVisualTargetVerification({
  command: command({}),
  current: evidence(),
  previous: null,
});
assert.equal(noPrevious.status, 'blocked');
assert.equal(noPrevious.consistency, 'missing');
assert.equal(noPrevious.focusReview, 'missing');

const inconsistent = evaluateAgentVisualTargetVerification({
  command: command({
    focusCenterRatioX: 0.5,
    focusCenterRatioY: 0.5,
    focusHeightRatio: 0.2,
    focusScale: 3,
    focusWidthRatio: 0.3,
  }),
  current: evidence({ targetMatched: 'QQ settings button' }),
  previous: evidence(),
});
assert.equal(inconsistent.status, 'blocked');
assert.equal(inconsistent.focusReview, 'passed');
assert.equal(inconsistent.targetArea, 'present');
assert.equal(inconsistent.consistency, 'inconsistent');

const displaced = evaluateAgentVisualTargetVerification({
  command: command({
    focusCenterRatioX: 0.5,
    focusCenterRatioY: 0.5,
    focusHeightRatio: 0.2,
    focusScale: 3,
    focusWidthRatio: 0.3,
    forceRefresh: true,
    sourceQuery: 'QQ',
    sourceType: 'window',
  }),
  current: evidence({ elementCenter: { coordinateSpace: 'native-screen', x: 760, y: 560 } }),
  previous: evidence({ elementCenter: { coordinateSpace: 'native-screen', x: 500, y: 300 } }),
});
assert.equal(displaced.status, 'blocked');
assert.equal(displaced.consistency, 'inconsistent');

const passed = evaluateAgentVisualTargetVerification({
  command: command({
    focusCenterRatioX: 0.5,
    focusCenterRatioY: 0.5,
    focusHeightRatio: 0.2,
    focusScale: 3,
    focusWidthRatio: 0.3,
  }),
  current: evidence({
    elementCenter: { coordinateSpace: 'source-ratio', x: 0.5, y: 0.5 },
    elementBounds: { coordinateSpace: 'source-ratio', height: 0.04, width: 0.12, x: 0.44, y: 0.48 },
    sourceBounds: { coordinateSpace: 'native-screen', height: 600, width: 1000, x: 0, y: 0 },
  }),
  previous: evidence(),
});
assert.equal(passed.status, 'passed');
assert.equal(passed.targetArea, 'present');
assert.equal(passed.focusReview, 'passed');
assert.equal(passed.consistency, 'passed');
assert.equal(passed.sampleCount, 2);

console.log('agent visual target verification smoke ok');
