import assert from 'node:assert/strict';
import {
  neuralPersonaGraphNodeHitRadius,
  neuralPersonaGraphNodeVisualRadius,
} from '../src/components/settings/neuralPersonaGraphNodeVisualStyle';

function node(incomingCount: number, outgoingCount: number, type = 'preference' as const) {
  return { incomingCount, outgoingCount, status: 'active' as const, type };
}

const isolated = node(0, 0);
const lightlyConnected = node(1, 0);
const connected = node(4, 5);
const dense = node(400, 400);

assert.equal(neuralPersonaGraphNodeVisualRadius(isolated), 6,
  'isolated regular nodes should use half the current radius');
assert.ok(neuralPersonaGraphNodeVisualRadius(lightlyConnected)
  > neuralPersonaGraphNodeVisualRadius(isolated));
assert.ok(neuralPersonaGraphNodeVisualRadius(connected)
  > neuralPersonaGraphNodeVisualRadius(lightlyConnected));
assert.equal(neuralPersonaGraphNodeVisualRadius(dense), 24,
  'dense nodes must stop at the visual size cap');
assert.ok(neuralPersonaGraphNodeHitRadius(connected)
  > neuralPersonaGraphNodeVisualRadius(connected));
assert.ok(neuralPersonaGraphNodeVisualRadius(node(7, 0, 'persona-anchor'))
  > neuralPersonaGraphNodeVisualRadius(node(0, 0, 'persona-anchor')));

console.log('neural persona graph node size smoke ok');
