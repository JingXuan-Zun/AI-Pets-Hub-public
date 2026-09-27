import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaEdgeDraft,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNodeDraft,
} from '../src/character-graph/neural-persona';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaEdgeCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaEdgeCommandTypes.ts',
];

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(node.body.end) - line(node.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

sourceFiles.forEach(inspectSource);

const edgeEditorSource = fs.readFileSync(
  path.resolve('src/components/settings/NeuralPersonaEdgeEditor.tsx'), 'utf8',
);
const edgeSelectorSource = fs.readFileSync(
  path.resolve('src/components/settings/NeuralPersonaEdgeExistingSelector.tsx'), 'utf8',
);
assert.match(edgeEditorSource, /解除关系/u);
assert.match(edgeEditorSource, /再次导入节点时会自动恢复/u);
assert.match(edgeSelectorSource, /现有关系/u);
assert.match(edgeSelectorSource, /选择后可编辑或解除/u);

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (roleId, expected, next) => {
      const current = records.get(roleId) ?? null;
      if (current !== expected) return false;
      records.set(roleId, next);
      return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
}

function emptyGraph(roleId: string): NeuralPersonaGraphSnapshot {
  return {
    createdAt: 1,
    edges: [],
    graphVersion: 'neural-graph.r0',
    nodes: [],
    roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

function nodeDraft(input: {
  id: string;
  protected?: boolean;
  type?: NeuralPersonaNodeDraft['type'];
}): NeuralPersonaNodeDraft {
  const type = input.type ?? 'preference';
  return {
    baseWeight: 0.8,
    confidence: 1,
    decayRate: 0,
    influenceSummary: `节点 ${input.id}`,
    nodeId: input.id,
    plasticity: 0.2,
    protected: input.protected ?? false,
    scope: 'private',
    sourceRef: type === 'identity-reference' ? `persona:${input.id}` : undefined,
    stability: 0.9,
    status: 'active',
    tags: [],
    type,
  };
}

function edgeDraft(input: Partial<NeuralPersonaEdgeDraft> = {}): NeuralPersonaEdgeDraft {
  return {
    confidence: 0.9,
    edgeId: 'edge:identity-preference',
    relationType: 'supports',
    sourceNodeId: 'identity:self',
    targetNodeId: 'preference:quiet',
    weight: 0.8,
    ...input,
  };
}

const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: () => 100,
  storage: memoryStorage(),
});
assert.equal((await repository.initialize(emptyGraph('role-a'))).status, 'ok');
assert.equal((await repository.initialize(emptyGraph('role-b'))).status, 'ok');
const nodes = createNeuralPersonaNodeCommandService({ now: () => 200, repository });
const edges = createNeuralPersonaEdgeCommandService({ now: () => 300, repository });

assert.equal((await nodes.createNode({
  commandId: 'node:identity',
  expectedRevision: 0,
  node: nodeDraft({ id: 'identity:self', protected: true, type: 'identity-reference' }),
  roleId: 'role-a',
})).status, 'ok');
assert.equal((await nodes.createNode({
  commandId: 'node:preference',
  expectedRevision: 1,
  node: nodeDraft({ id: 'preference:quiet' }),
  roleId: 'role-a',
})).status, 'ok');

assert.deepEqual(await edges.createEdge({
  commandId: 'edge:missing-source',
  edge: edgeDraft({ sourceNodeId: 'missing' }),
  expectedRevision: 2,
  roleId: 'role-a',
}), { reason: 'edge-node-missing', status: 'invalid' });
assert.deepEqual(await edges.createEdge({
  commandId: 'edge:missing-target',
  edge: edgeDraft({ targetNodeId: 'missing' }),
  expectedRevision: 2,
  roleId: 'role-a',
}), { reason: 'edge-node-missing', status: 'invalid' });
assert.deepEqual(await edges.createEdge({
  commandId: 'edge:self-reference',
  edge: edgeDraft({ sourceNodeId: 'identity:self', targetNodeId: 'identity:self' }),
  expectedRevision: 2,
  roleId: 'role-a',
}), { reason: 'edge-self-reference', status: 'invalid' });

const created = await edges.createEdge({
  commandId: 'edge:create',
  edge: edgeDraft(),
  expectedRevision: 2,
  roleId: 'role-a',
});
assert.equal(created.status, 'ok');
if (created.status === 'ok') {
  assert.equal(created.record.revision, 3);
  assert.equal(created.record.graph.edges[0]?.ownerRoleId, 'role-a');
  assert.equal(created.receipt.commandType, 'create-edge');
  assert.equal(created.receipt.edgeId, 'edge:identity-preference');
}
assert.deepEqual(await edges.createEdge({
  commandId: 'edge:duplicate',
  edge: edgeDraft(),
  expectedRevision: 3,
  roleId: 'role-a',
}), { reason: 'edge-already-exists', status: 'invalid' });
assert.deepEqual(await edges.updateEdge({
  commandId: 'edge:empty-patch',
  edgeId: 'edge:identity-preference',
  expectedRevision: 3,
  patch: {},
  roleId: 'role-a',
}), { reason: 'empty-edge-patch', status: 'invalid' });
assert.deepEqual(await edges.updateEdge({
  commandId: 'edge:protected-update',
  edgeId: 'edge:identity-preference',
  expectedRevision: 3,
  patch: { weight: 0.4 },
  roleId: 'role-a',
}), { reason: 'protected-relationship-confirmation-required', status: 'invalid' });

const updated = await edges.updateEdge({
  commandId: 'edge:update',
  confirmProtectedRelationship: true,
  edgeId: 'edge:identity-preference',
  expectedRevision: 3,
  patch: { relationType: 'protects', weight: 0.7 },
  roleId: 'role-a',
});
assert.equal(updated.status, 'ok');
if (updated.status === 'ok') {
  assert.equal(updated.record.graph.edges[0]?.relationType, 'protects');
  assert.equal(updated.receipt.appliedRevision, 4);
  assert.equal(updated.receipt.commandType, 'update-edge');
}
assert.deepEqual(await edges.updateEdge({
  commandId: 'edge:stale',
  confirmProtectedRelationship: true,
  edgeId: 'edge:identity-preference',
  expectedRevision: 3,
  patch: { weight: 0.1 },
  roleId: 'role-a',
}), { actualRevision: 4, status: 'conflict' });

assert.equal((await nodes.createNode({
  commandId: 'node:style',
  expectedRevision: 4,
  node: nodeDraft({ id: 'style:calm', type: 'style-tendency' }),
  roleId: 'role-a',
})).status, 'ok');
assert.equal((await edges.createEdge({
  commandId: 'edge:create-ordinary',
  edge: edgeDraft({ edgeId: 'edge:quiet-calm', sourceNodeId: 'preference:quiet', targetNodeId: 'style:calm' }),
  expectedRevision: 5,
  roleId: 'role-a',
})).status, 'ok');
const deletedOrdinary = await edges.deleteEdge({
  commandId: 'edge:delete-ordinary',
  edgeId: 'edge:quiet-calm',
  expectedRevision: 6,
  roleId: 'role-a',
});
assert.equal(deletedOrdinary.status, 'ok');
if (deletedOrdinary.status === 'ok') {
  assert.equal(deletedOrdinary.record.graph.nodes.length, 3);
  assert.equal(deletedOrdinary.record.graph.edges.length, 1);
  assert.equal(deletedOrdinary.receipt.commandType, 'delete-edge');
}
assert.deepEqual(await edges.deleteEdge({
  commandId: 'edge:delete-protected',
  edgeId: 'edge:identity-preference',
  expectedRevision: 7,
  roleId: 'role-a',
}), { reason: 'protected-relationship-confirmation-required', status: 'invalid' });
const deletedProtected = await edges.deleteEdge({
  commandId: 'edge:delete-protected-confirmed',
  confirmProtectedRelationship: true,
  edgeId: 'edge:identity-preference',
  expectedRevision: 7,
  roleId: 'role-a',
});
assert.equal(deletedProtected.status, 'ok');
if (deletedProtected.status === 'ok') {
  assert.equal(deletedProtected.record.graph.nodes.length, 3);
  assert.equal(deletedProtected.record.graph.edges.length, 0);
  assert.equal(deletedProtected.receipt.appliedRevision, 8);
}
const roleB = await repository.load('role-b');
assert.equal(roleB.status, 'ok');
if (roleB.status === 'ok') {
  assert.equal(roleB.record.graph.nodes.length, 0);
  assert.equal(roleB.record.graph.edges.length, 0);
}

console.log('neural persona edge command smoke ok');
