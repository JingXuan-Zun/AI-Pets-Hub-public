import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
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
  'src/character-graph/neural-persona/neuralPersonaGraphPhysics.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphDragConstraint.ts',
].forEach(inspectSource);

function node(nodeId: string, x: number, y: number): NeuralPersonaLayoutNode {
  return {
    incomingCount: 0, label: nodeId, nodeId, outgoingCount: 0,
    protected: false, scope: 'private', status: 'active', tagIds: [],
    type: nodeId === 'anchor' ? 'persona-anchor' : 'cognitive-domain', x, y,
  };
}

function edge(sourceNodeId: string, targetNodeId: string): NeuralPersonaGraphViewEdge {
  return {
    edgeId: `${sourceNodeId}:${targetNodeId}`, relationType: 'contains',
    sourceNodeId, targetNodeId, weight: 0.8,
  };
}

const nodes = [
  node('anchor', 500, 500), node('dragged', 100, 500),
  node('right', 900, 500), node('top', 500, 100), node('bottom', 500, 900),
  node('dragged-topic', 40, 500), node('right-topic', 960, 500),
];
const edges = [
  edge('anchor', 'dragged'), edge('anchor', 'right'), edge('anchor', 'top'),
  edge('anchor', 'bottom'), edge('dragged', 'dragged-topic'), edge('right', 'right-topic'),
];
const physics = createNeuralPersonaGraphPhysics(nodes, edges);
const watched = ['right', 'top', 'bottom', 'right-topic'];
const initial = new Map(watched.map((id) => [id, { ...physics.getPosition(id)! }]));

physics.pin('dragged');
physics.movePinned('dragged', { x: 106, y: 503 });
const immediateUnrelatedShift = Math.max(...watched.map((id) => {
  const left = initial.get(id)!; const right = physics.getPosition(id)!;
  return Math.hypot(right.x - left.x, right.y - left.y);
}));
physics.release('dragged');

let maximumFrameJump = 0;
for (let frame = 0; frame < 30 && physics.isActive(); frame += 1) {
  const before = new Map(watched.map((id) => [id, { ...physics.getPosition(id)! }]));
  physics.step();
  watched.forEach((id) => {
    const left = before.get(id)!; const right = physics.getPosition(id)!;
    maximumFrameJump = Math.max(maximumFrameJump, Math.hypot(right.x - left.x, right.y - left.y));
  });
}

const maximumUnrelatedShift = Math.max(...watched.map((id) => {
  const left = initial.get(id)!; const right = physics.getPosition(id)!;
  return Math.hypot(right.x - left.x, right.y - left.y);
}));
assert.ok(immediateUnrelatedShift <= 4,
  `tiny drag must not immediately collapse unrelated branches: ${immediateUnrelatedShift}`);
assert.ok(maximumFrameJump <= 1.5,
  `tiny drag must not cause unrelated node frame jumps: ${maximumFrameJump}`);
assert.ok(maximumUnrelatedShift <= 5,
  `tiny drag must not collapse unrelated branches: ${maximumUnrelatedShift}`);

console.log('neural persona graph small drag stability smoke ok', {
  immediateUnrelatedShift, maximumFrameJump, maximumUnrelatedShift,
});
