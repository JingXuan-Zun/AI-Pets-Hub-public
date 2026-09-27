import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../src/character-graph/neural-persona';

function node(index: number): NeuralPersonaLayoutNode {
  return {
    incomingCount: index ? 1 : 0, label: `node-${index}`, nodeId: `node-${index}`,
    outgoingCount: index < 7 ? 1 : 0, protected: false, scope: 'private',
    status: 'active', tagIds: [], type: 'cognitive-topic', x: index * 92, y: 300,
  };
}

function edge(index: number): NeuralPersonaGraphViewEdge {
  return {
    edgeId: `edge-${index}`, relationType: 'contains', sourceNodeId: `node-${index}`,
    targetNodeId: `node-${index + 1}`, weight: 1,
  };
}

const nodes = Array.from({ length: 8 }, (_, index) => node(index));
const edges = Array.from({ length: 7 }, (_, index) => edge(index));
const physics = createNeuralPersonaGraphPhysics(nodes, edges, {
  anchorStrength: 0, collisionStrength: 0, dragMaxStretch: 1200,
  repulsionStrength: 0,
});
const maximumLinkLength = () => Math.max(...edges.map((value) => {
  const source = physics.getPosition(value.sourceNodeId)!;
  const target = physics.getPosition(value.targetNodeId)!;
  return Math.hypot(target.x - source.x, target.y - source.y);
}));

physics.pin('node-0');
physics.movePinned('node-0', { x: 800, y: 300 });
const stretchedLength = maximumLinkLength();
for (let frame = 0; frame < 240; frame += 1) physics.step();
const bufferedLength = maximumLinkLength();
for (let frame = 240; frame < 720; frame += 1) physics.step();
const relaxedLength = maximumLinkLength();
const pinned = physics.getPosition('node-0')!;

assert.deepEqual({ x: pinned.x, y: pinned.y }, { x: 800, y: 300 },
  'held node must remain at the mouse position');
assert.ok(bufferedLength < stretchedLength * 0.7,
  `held graph must visibly buffer within four seconds: ${stretchedLength} -> ${bufferedLength}`);
assert.ok(relaxedLength < stretchedLength * 0.5,
  `held graph must continue relaxing without release: ${stretchedLength} -> ${relaxedLength}`);
assert.ok(relaxedLength < 150,
  `held graph must return near its normal link shape: ${relaxedLength}`);
assert.equal(physics.isActive(), true, 'held graph must remain active');

console.log('neural persona graph held drag relaxation smoke ok', {
  bufferedLength, relaxedLength, stretchedLength,
});
