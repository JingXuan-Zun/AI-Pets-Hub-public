import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../src/character-graph/neural-persona';
import { NEURAL_PERSONA_GRAPH_TARGET_FPS } from '../src/components/settings/neuralPersonaGraphFrameRate';

const nodes: NeuralPersonaLayoutNode[] = [
  {
    incomingCount: 0, label: 'A', nodeId: 'a', outgoingCount: 1, protected: false,
    scope: 'private', status: 'active', tagIds: [], type: 'preference', x: 180, y: 220,
  },
  {
    incomingCount: 1, label: 'B', nodeId: 'b', outgoingCount: 1, protected: false,
    scope: 'private', status: 'active', tagIds: [], type: 'preference', x: 280, y: 220,
  },
  {
    incomingCount: 1, label: 'C', nodeId: 'c', outgoingCount: 0, protected: false,
    scope: 'private', status: 'active', tagIds: [], type: 'preference', x: 380, y: 220,
  },
];

const edges: NeuralPersonaGraphViewEdge[] = [
  { edgeId: 'ab', relationType: 'associated-with', sourceNodeId: 'a', targetNodeId: 'b', weight: 0.8 },
  { edgeId: 'bc', relationType: 'associated-with', sourceNodeId: 'b', targetNodeId: 'c', weight: 0.8 },
];

function runAtFrameRate(frameRate: number) {
  const physics = createNeuralPersonaGraphPhysics(nodes, edges);
  const timeScale = 60 / frameRate;
  physics.pin('a');
  for (let frame = 0; frame < frameRate / 2; frame += 1) {
    const progress = (frame + 1) / (frameRate / 2);
    const pointer = { x: 180 + progress * 180, y: 220 + Math.sin(progress * Math.PI) * 40 };
    physics.movePinned('a', pointer);
    const dragged = physics.getPosition('a');
    assert.equal(dragged?.x, pointer.x);
    assert.equal(dragged?.y, pointer.y);
    physics.step(timeScale);
  }
  physics.release('a');
  for (let frame = 0; frame < frameRate / 2; frame += 1) physics.step(timeScale);
  return Object.fromEntries(nodes.map((node) => {
    const point = physics.getPosition(node.nodeId)!;
    return [node.nodeId, { x: point.x, y: point.y }];
  }));
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

const at60 = runAtFrameRate(60);
const at144 = runAtFrameRate(144);
assert.equal(NEURAL_PERSONA_GRAPH_TARGET_FPS, 60);
const deltas = Object.fromEntries(Object.keys(at60).map((nodeId) => [
  nodeId,
  distance(at60[nodeId], at144[nodeId]),
]));

assert.ok(Math.max(...Object.values(deltas)) < 3, `60/144 Hz physics diverged: ${JSON.stringify(deltas)}`);

const fractional = createNeuralPersonaGraphPhysics(nodes, edges);
fractional.pin('a');
fractional.movePinned('a', { x: 360, y: 220 });
const neighborBeforeFractionalStep = { ...fractional.getPosition('b')! };
fractional.step(60 / 240);
assert.notDeepEqual(
  fractional.getPosition('b'),
  neighborBeforeFractionalStep,
  '240 Hz fractional physics step must update neighboring nodes every frame',
);
console.log('neural persona graph frame invariance smoke ok', deltas);
