import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../src/character-graph/neural-persona';

function node(nodeId: string, x: number, y = 100): NeuralPersonaLayoutNode {
  return {
    incomingCount: 0, label: nodeId, nodeId, outgoingCount: 0,
    protected: false, scope: 'private', status: 'active', tagIds: [],
    type: 'preference', x, y,
  };
}

function distance(physics: ReturnType<typeof createNeuralPersonaGraphPhysics>, left: string, right: string) {
  const a = physics.getPosition(left)!;
  const b = physics.getPosition(right)!;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const movedIntoNewArea = createNeuralPersonaGraphPhysics([
  node('dragged', 0), node('obstacle', 500),
], []);
movedIntoNewArea.pin('dragged');
movedIntoNewArea.movePinned('dragged', { x: 500, y: 100 });
movedIntoNewArea.release('dragged');
for (let frame = 0; frame < 32; frame += 1) movedIntoNewArea.step();
assert.ok(
  distance(movedIntoNewArea, 'dragged', 'obstacle') > 8,
  'nodes newly approached during drag must join local repulsion',
);

const linkedNodes = [node('root', 0), node('follower', 100)];
const edges: NeuralPersonaGraphViewEdge[] = [{
  edgeId: 'root-follower', relationType: 'associated-with',
  sourceNodeId: 'root', targetNodeId: 'follower', weight: 0.8,
}];
const linked = createNeuralPersonaGraphPhysics(linkedNodes, edges);
linked.pin('root');
linked.movePinned('root', { x: 130, y: 100 });
linked.release('root');
for (let frame = 0; frame < 120 && linked.isActive(); frame += 1) linked.step();
const linkedDistance = distance(linked, 'root', 'follower');
assert.ok(
  linkedDistance >= 64,
  `released linked nodes must settle near their link target: ${linkedDistance}`,
);

const chainNodes = [node('left', 0), node('middle', 100), node('right', 200)];
const chainEdges: NeuralPersonaGraphViewEdge[] = [
  { edgeId: 'left-middle', relationType: 'associated-with', sourceNodeId: 'left', targetNodeId: 'middle', weight: 0.8 },
  { edgeId: 'middle-right', relationType: 'associated-with', sourceNodeId: 'middle', targetNodeId: 'right', weight: 0.8 },
];
const chain = createNeuralPersonaGraphPhysics(chainNodes, chainEdges, {
  linkDistance: 109, linkStrength: 0.006,
  repulsionStrength: 0.55,
});
chain.pin('right');
chain.movePinned('right', { x: 130, y: 100 });
chain.release('right');
for (let frame = 0; frame < 240 && chain.isActive(); frame += 1) chain.step();
const screenshotDistance = distance(chain, 'middle', 'right');
assert.ok(
  screenshotDistance >= 75,
  `three-node chain must finish separating after release: ${screenshotDistance}`,
);

const visibleRepulsion = createNeuralPersonaGraphPhysics([
  node('near-left', 0), node('near-right', 60),
], [], { linkDistance: 122, repulsionStrength: 0.55 });
visibleRepulsion.pin('near-left');
visibleRepulsion.release('near-left');
for (let frame = 0; frame < 120 && visibleRepulsion.isActive(); frame += 1) {
  visibleRepulsion.step();
}
const visibleRepulsionDistance = distance(visibleRepulsion, 'near-left', 'near-right');
assert.ok(
  visibleRepulsionDistance >= 72,
  `repulsion must remain visible beyond the legacy cutoff: ${visibleRepulsionDistance}`,
);

function settleWithEdges(inputEdges: NeuralPersonaGraphViewEdge[]) {
  const value = createNeuralPersonaGraphPhysics([
    node('pair-left', 0), node('pair-right', 100),
  ], inputEdges);
  value.pin('pair-left');
  value.movePinned('pair-left', { x: 130, y: 100 });
  value.release('pair-left');
  for (let frame = 0; frame < 120 && value.isActive(); frame += 1) value.step();
  return distance(value, 'pair-left', 'pair-right');
}
const pairEdge: NeuralPersonaGraphViewEdge = {
  edgeId: 'pair', relationType: 'associated-with',
  sourceNodeId: 'pair-left', targetNodeId: 'pair-right', weight: 0.5,
};
const singlePairDistance = settleWithEdges([pairEdge]);
const duplicatePairDistance = settleWithEdges([
  pairEdge, { ...pairEdge, edgeId: 'pair-duplicate' },
]);
assert.ok(
  Math.abs(singlePairDistance - duplicatePairDistance) < 0.001,
  `duplicate visual edges must not double spring force: ${singlePairDistance}/${duplicatePairDistance}`,
);

const bigDrag = createNeuralPersonaGraphPhysics([
  node('big-333', 1140, 528), node('big-2', 1337, 726), node('big-3', 943, 726),
], [
  { edgeId: 'big-23', relationType: 'associated-with', sourceNodeId: 'big-2', targetNodeId: 'big-3', weight: 0.5 },
  { edgeId: 'big-3333', relationType: 'associated-with', sourceNodeId: 'big-3', targetNodeId: 'big-333', weight: 0.5 },
  { edgeId: 'big-3332', relationType: 'associated-with', sourceNodeId: 'big-333', targetNodeId: 'big-2', weight: 0.5 },
], {
  dragFollowStrength: 0.38, linkDistance: 122,
  linkStrength: 0.0215, repulsionStrength: 0.55,
});
bigDrag.pin('big-2');
bigDrag.movePinned('big-2', { x: 600, y: 800 });
bigDrag.release('big-2');
for (let frame = 0; frame < 240 && bigDrag.isActive(); frame += 1) {
  bigDrag.step();
  assert.ok(distance(bigDrag, 'big-2', 'big-3') >= 34 - 0.01, `large drag tunneled at frame ${frame}`);
  assert.ok(distance(bigDrag, 'big-2', 'big-333') >= 34 - 0.01, `large drag tunneled at frame ${frame}`);
  assert.ok(distance(bigDrag, 'big-3', 'big-333') >= 34 - 0.01, `large drag tunneled at frame ${frame}`);
}
const bigDragDistances = [
  distance(bigDrag, 'big-2', 'big-3'),
  distance(bigDrag, 'big-2', 'big-333'),
  distance(bigDrag, 'big-3', 'big-333'),
];
assert.ok(
  bigDragDistances.every((value) => Math.abs(value - 122) < 20),
  `large drag links stopped before configured length: ${JSON.stringify(bigDragDistances)}`,
);

const configuredLengthEdge: NeuralPersonaGraphViewEdge = {
  edgeId: 'configured-length', relationType: 'associated-with',
  sourceNodeId: 'length-left', targetNodeId: 'length-right', weight: 0.5,
};
const configuredLength = createNeuralPersonaGraphPhysics([
  node('length-left', 0), node('length-right', 300),
], [configuredLengthEdge], {
  collisionStrength: 0, linkDistance: 122,
  linkStrength: 0.0215, repulsionStrength: 0,
});
configuredLength.pin('length-left');
configuredLength.movePinned('length-left', { x: 40, y: 100 });
configuredLength.release('length-left');
for (let frame = 0; frame < 240 && configuredLength.isActive(); frame += 1) configuredLength.step();
const configuredLengthDistance = distance(configuredLength, 'length-left', 'length-right');
assert.ok(
  Math.abs(configuredLengthDistance - 122) < 8,
  `settled edge must honor configured length: ${configuredLengthDistance}`,
);

const activeDrag = createNeuralPersonaGraphPhysics([
  node('active-root', 0), node('active-follower', 100),
], [{ ...configuredLengthEdge, edgeId: 'active-drag', sourceNodeId: 'active-root', targetNodeId: 'active-follower' }]);
activeDrag.pin('active-root');
activeDrag.movePinned('active-root', { x: 130, y: 100 });
activeDrag.step();
assert.ok(
  distance(activeDrag, 'active-root', 'active-follower') < 34,
  'hard collision must not constrain direct followers while pointer is held',
);
activeDrag.release('active-root'); activeDrag.step();
assert.ok(distance(activeDrag, 'active-root', 'active-follower') >= 34 - 0.01);

console.log('neural persona graph post-drag repulsion smoke ok', {
  bigDragDistances, configuredLengthDistance, duplicatePairDistance, linkedDistance, screenshotDistance,
  singlePairDistance, visibleRepulsionDistance,
});
