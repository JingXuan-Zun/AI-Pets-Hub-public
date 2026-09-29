import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  createNeuralPersonaGraphPhysics,
  layoutNeuralPersonaGraphHierarchy,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaGraphViewNode,
} from '../src/character-graph/neural-persona';

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1;
  const visit = (value: ts.Node) => {
    if (ts.isFunctionLike(value) && value.body) {
      const size = line(value.body.end) - line(value.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(value, visit);
  };
  visit(source);
}

[
  'src/character-graph/neural-persona/neuralPersonaGraphHierarchyLayout.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphPhysics.ts',
].forEach(inspectSource);

function node(nodeId: string, type: NeuralPersonaGraphViewNode['type']): NeuralPersonaGraphViewNode {
  return {
    incomingCount: 0, label: nodeId, nodeId, outgoingCount: 0,
    protected: type === 'persona-anchor', scope: 'private', status: 'active',
    tagIds: [], type,
  };
}

function edge(sourceNodeId: string, targetNodeId: string): NeuralPersonaGraphViewEdge {
  return {
    edgeId: `${sourceNodeId}:contains:${targetNodeId}`, relationType: 'contains',
    sourceNodeId, targetNodeId, weight: 1,
  };
}

const nodes = [
  node('anchor', 'persona-anchor'),
  node('emotion', 'cognitive-domain'), node('style', 'cognitive-domain'),
  node('happy', 'cognitive-topic'), node('angry', 'cognitive-topic'),
  node('happy-soft', 'emotional-tendency'), node('happy-bright', 'emotional-tendency'),
  node('angry-cold', 'emotional-tendency'), node('style-short', 'style-tendency'),
];
const edges = [
  edge('anchor', 'emotion'), edge('anchor', 'style'),
  edge('emotion', 'happy'), edge('emotion', 'angry'),
  edge('happy', 'happy-soft'), edge('happy', 'happy-bright'),
  edge('angry', 'angry-cold'), edge('style', 'style-short'),
];
const viewport = { height: 600, width: 900 };
const layout = layoutNeuralPersonaGraphHierarchy(nodes, edges, viewport);
const positions = new Map(layout.nodes.map((value) => [value.nodeId, value]));
const center = { x: viewport.width / 2, y: viewport.height / 2 };
const radius = (nodeId: string) => {
  const value = positions.get(nodeId)!;
  return Math.hypot(value.x - center.x, value.y - center.y);
};
const angle = (nodeId: string) => {
  const value = positions.get(nodeId)!;
  return Math.atan2(value.y - center.y, value.x - center.x);
};
const angularDistance = (left: number, right: number) => (
  Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)))
);

assert.deepEqual(
  { x: positions.get('anchor')?.x, y: positions.get('anchor')?.y }, center,
  'persona anchor must remain at the graph center',
);
assert.ok(Math.abs(radius('emotion') - radius('style')) < 1,
  'first-level nodes must share one ring');
assert.ok(Math.abs(radius('happy') - radius('angry')) <= 31,
  'second-level nodes must stay inside one compact radial band');
assert.ok(Math.min(radius('happy'), radius('angry')) > radius('emotion'),
  'second level must be outside first level');
assert.ok(Math.min(radius('happy-soft'), radius('happy-bright'), radius('angry-cold'))
  > Math.max(radius('happy'), radius('angry')),
  'content nodes must stay outside the complete topic band');
assert.ok(angularDistance(angle('happy'), angle('emotion')) < Math.PI / 2);
assert.ok(angularDistance(angle('angry'), angle('emotion')) < Math.PI / 2);
assert.ok(angularDistance(angle('style-short'), angle('style')) < Math.PI / 2);
assert.deepEqual(
  layout,
  layoutNeuralPersonaGraphHierarchy([...nodes].reverse(), [...edges].reverse(), viewport),
  'hierarchy layout must not change when input order changes',
);

const physics = createNeuralPersonaGraphPhysics(layout.nodes, edges, {
  linkStrength: 0.006, repulsionStrength: 0.2,
});
const initialPositions = new Map(layout.nodes.map((value) => [
  value.nodeId, { ...physics.getPosition(value.nodeId)! },
]));
const initial = { ...physics.getPosition('happy')! };
physics.pin('happy');
physics.movePinned('happy', { x: initial.x + 340, y: initial.y - 180 });
physics.release('happy');
const releasedDistance = Math.hypot(
  physics.getPosition('happy')!.x - initial.x,
  physics.getPosition('happy')!.y - initial.y,
);
const released = { ...physics.getPosition('happy')! };
for (let frame = 0; frame < 360 && physics.isActive(); frame += 1) physics.step();
const settled = physics.getPosition('happy')!;
const settledDistance = Math.hypot(
  settled.x - initial.x,
  settled.y - initial.y,
);
const releasedDrift = Math.hypot(settled.x - released.x, settled.y - released.y);
assert.ok(settledDistance > releasedDistance * 0.45,
  `released node must remain freely displaced from its initial ring: ${settledDistance}`);
assert.ok(releasedDrift < releasedDistance * 0.8,
  `free settling must not behave like a forced hierarchy reset: ${releasedDrift}`);
const maximumUnrelatedDrift = Math.max(...['style', 'style-short'].map((nodeId) => {
  const before = initialPositions.get(nodeId)!;
  const after = physics.getPosition(nodeId)!;
  return Math.hypot(after.x - before.x, after.y - before.y);
}));
assert.ok(maximumUnrelatedDrift < 60,
  `free drag must not collapse unrelated branches: ${maximumUnrelatedDrift}`);
assert.ok(radius('happy') > radius('emotion'));

console.log('neural persona graph hierarchy layout smoke ok', {
  maximumUnrelatedDrift, releasedDistance, releasedDrift, settledDistance,
});
