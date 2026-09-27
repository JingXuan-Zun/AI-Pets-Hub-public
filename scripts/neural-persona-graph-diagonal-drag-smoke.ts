import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../src/character-graph/neural-persona';

const nodes: NeuralPersonaLayoutNode[] = [
  {
    incomingCount: 0, label: '根节点', nodeId: 'root', outgoingCount: 1,
    protected: false, scope: 'private', status: 'active', tagIds: [],
    type: 'preference', x: 100, y: 100,
  },
  {
    incomingCount: 1, label: '跟随节点', nodeId: 'follower', outgoingCount: 0,
    protected: false, scope: 'private', status: 'active', tagIds: [],
    type: 'preference', x: 100, y: 200,
  },
];
const edges: NeuralPersonaGraphViewEdge[] = [{
  edgeId: 'root-follower', relationType: 'associated-with',
  sourceNodeId: 'root', targetNodeId: 'follower', weight: 0.8,
}];

const physics = createNeuralPersonaGraphPhysics(nodes, edges);
physics.pin('root');
const before = { ...physics.getPosition('follower')! };
physics.movePinned('root', { x: 140, y: 140 });
const after = physics.getPosition('follower')!;
const delta = { x: after.x - before.x, y: after.y - before.y };

assert.ok(delta.x > 0, `diagonal follower must move horizontally immediately: ${JSON.stringify(delta)}`);
assert.ok(delta.y > 0, `diagonal follower must move vertically immediately: ${JSON.stringify(delta)}`);
assert.ok(
  Math.abs(delta.x - delta.y) < 0.001,
  `diagonal follower axes must respond atomically: ${JSON.stringify(delta)}`,
);

const rapid = createNeuralPersonaGraphPhysics(nodes, edges, {
  dragFollowStrength: 0.38,
});
rapid.pin('root');
rapid.movePinned('root', { x: 800, y: 100 });
const rapidRoot = rapid.getPosition('root')!;
const rapidFollower = rapid.getPosition('follower')!;
const rapidStretch = Math.hypot(
  rapidRoot.x - rapidFollower.x, rapidRoot.y - rapidFollower.y,
);
assert.ok(
  rapidStretch <= 260.01,
  `rapid long drag must not leave followers far behind: ${rapidStretch}`,
);

const relaxed = createNeuralPersonaGraphPhysics(nodes, edges, {
  dragFollowStrength: 0.38, dragMaxStretch: 700,
});
relaxed.pin('root');
relaxed.movePinned('root', { x: 800, y: 100 });
const relaxedRoot = relaxed.getPosition('root')!;
const relaxedFollower = relaxed.getPosition('follower')!;
const relaxedStretch = Math.hypot(
  relaxedRoot.x - relaxedFollower.x, relaxedRoot.y - relaxedFollower.y,
);
assert.ok(
  relaxedStretch > 500,
  `larger drag stretch setting must preserve a looser response: ${relaxedStretch}`,
);

const disabled = createNeuralPersonaGraphPhysics(nodes, edges, { dragFollowStrength: 0 });
disabled.pin('root');
const disabledBefore = { ...disabled.getPosition('follower')! };
disabled.movePinned('root', { x: 140, y: 140 });
assert.deepEqual(disabled.getPosition('follower'), disabledBefore);
console.log('neural persona graph diagonal drag smoke ok', {
  delta, rapidStretch, relaxedStretch,
});
