import assert from 'node:assert/strict';
import type { NeuralPersonaActivationPreview } from '../src/character-graph/neural-persona';
import {
  createNeuralPersonaGraphActivationOverlay,
  neuralPersonaGraphPathEdgeKey,
} from '../src/components/settings/neuralPersonaGraphActivationOverlay';
import { createNeuralPersonaGraphActivationVisibility } from '../src/components/settings/neuralPersonaGraphActivationVisibility';

const preview: NeuralPersonaActivationPreview = {
  candidateCount: 1,
  nodes: [{
    depth: 1, label: '安慰主人', nodeId: 'comfort', path: ['gentle', 'comfort'],
    reason: ['keyword-match'], score: 0.8, status: 'selected',
  }],
  selectedCount: 1,
  tokenBudgetUsed: 20,
  traceId: 'overlay-smoke',
};

const edges = [
  { relationType: 'contains' as const, sourceNodeId: 'anchor', targetNodeId: 'relationship' },
  { relationType: 'contains' as const, sourceNodeId: 'relationship', targetNodeId: 'comfort-topic' },
  { relationType: 'contains' as const, sourceNodeId: 'comfort-topic', targetNodeId: 'comfort' },
  { relationType: 'supports' as const, sourceNodeId: 'gentle', targetNodeId: 'comfort' },
  { relationType: 'supports' as const, sourceNodeId: 'unrelated', targetNodeId: 'comfort' },
];

const overlay = createNeuralPersonaGraphActivationOverlay(preview, edges);
assert.ok(overlay);
assert.deepEqual(new Set(overlay.activeNodeIds), new Set([
  'anchor', 'relationship', 'comfort-topic', 'gentle', 'comfort',
]));
assert.deepEqual(new Set(overlay.pathEdgeKeys), new Set([
  neuralPersonaGraphPathEdgeKey('anchor', 'relationship'),
  neuralPersonaGraphPathEdgeKey('relationship', 'comfort-topic'),
  neuralPersonaGraphPathEdgeKey('comfort-topic', 'comfort'),
  neuralPersonaGraphPathEdgeKey('gentle', 'comfort'),
]));
assert.ok(!overlay.pathEdgeKeys.includes(
  neuralPersonaGraphPathEdgeKey('unrelated', 'comfort'),
));

const visibility = createNeuralPersonaGraphActivationVisibility(overlay, preview.traceId);
assert.equal(visibility.hide(), undefined, 'reset must clear the current activation display');
assert.equal(visibility.resolve(overlay, preview.traceId), undefined,
  'same activation result must remain hidden after selection updates');
assert.equal(visibility.resolve(overlay, preview.traceId), undefined,
  'node drag must not restore an activation path cleared by reset');
assert.equal(visibility.resolve(overlay, 'overlay-smoke-next'), overlay,
  'a newly executed activation must become visible immediately');

console.log('neural persona activation overlay smoke passed');
