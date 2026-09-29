import assert from 'node:assert/strict';
import {
  evaluateAgentVisualSampleConsensus,
} from '../src/agent/agentVisualTargetVerification.ts';
import { type AgentChatCommand, type AgentStructuredToolEvidence } from '../src/agent/agentChatCommand.ts';

const command: AgentChatCommand = {
  kind: 'tool',
  sourceText: '/agent activate the visible primary action',
  toolCall: {
    input: { forceRefresh: true, sourceQuery: 'Example App', sourceType: 'window' },
    name: 'locate_screen_elements',
  },
};

function sample(x: number, y: number): AgentStructuredToolEvidence {
  return {
    confidence: 'high',
    coordinateConfidence: 'high',
    elementBounds: { coordinateSpace: 'native-screen', height: 40, width: 120, x: x - 60, y: y - 20 },
    elementCenter: { coordinateSpace: 'native-screen', x, y },
    primaryAction: 'Continue',
    targetMatched: 'Example item',
    visualActionReadiness: 'ready',
  };
}

const first = sample(300, 420);
const second = sample(620, 640);
const third = sample(304, 424);

assert.equal(
  evaluateAgentVisualSampleConsensus({ command, samples: [first, second] }).status,
  'needs-more-samples',
  'a disagreement should request one final fresh visual sample instead of failing or clicking',
);
assert.equal(
  evaluateAgentVisualSampleConsensus({ command, samples: [first, second, third] }).status,
  'passed',
  'two agreeing samples out of three should be sufficient for a permission-gated action',
);
assert.equal(
  evaluateAgentVisualSampleConsensus({ command, samples: [first, second, sample(900, 120)] }).status,
  'blocked',
  'three incompatible samples must not produce a click approval',
);

console.log('agent visual three sample consensus smoke ok');
