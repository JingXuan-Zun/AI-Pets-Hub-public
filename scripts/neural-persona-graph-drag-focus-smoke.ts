import assert from 'node:assert/strict';
import type { NeuralPersonaGraphExplorerView } from '../src/character-graph/neural-persona';
import {
  NEURAL_PERSONA_DISTANT_NODE_ALPHA,
  resolveNeuralPersonaGraphFocusAlphas,
} from '../src/components/settings/neuralPersonaGraphFocusVisibility';

const view = {
  clusters: [],
  edges: [
    { edgeId: 'root-a', relationType: 'contains', sourceNodeId: 'root', targetNodeId: 'a' },
    { edgeId: 'a-b', relationType: 'contains', sourceNodeId: 'a', targetNodeId: 'b' },
    { edgeId: 'b-leaf', relationType: 'contains', sourceNodeId: 'b', targetNodeId: 'leaf' },
    { edgeId: 'a-side', relationType: 'contains', sourceNodeId: 'a', targetNodeId: 'side' },
  ],
  graphVersion: 'drag-focus-test',
  nodes: ['root', 'a', 'b', 'leaf', 'side'].map((nodeId) => ({ nodeId })),
  roleId: 'role-a',
  tagIds: [],
} as NeuralPersonaGraphExplorerView;

const alphas = resolveNeuralPersonaGraphFocusAlphas(view, 'leaf');
assert.equal(alphas.get('leaf'), 1, 'dragged node should become the visual focus');
assert.equal(alphas.get('b'), 1, 'one-hop parent should stay bright');
assert.equal(alphas.get('a'), 1, 'two-hop ancestor should stay bright');
assert.equal(alphas.get('side'), NEURAL_PERSONA_DISTANT_NODE_ALPHA,
  'three-hop sibling branch should dim');
assert.equal(alphas.get('root'), NEURAL_PERSONA_DISTANT_NODE_ALPHA,
  'three-hop ancestor should dim');

console.log('neural persona graph drag focus smoke ok');
