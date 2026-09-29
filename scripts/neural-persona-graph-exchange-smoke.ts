import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphExchangeService,
  createNeuralPersonaGraphImportPreview,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  diffNeuralPersonaGraphs,
  parseNeuralPersonaGraphExport,
  serializeNeuralPersonaGraphExport,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNodeDraft,
} from '../src/character-graph/neural-persona';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaGraphExchange.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphExchangeService.ts',
  'src/character-graph/neural-persona/neuralPersonaGraphExchangeTypes.ts',
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

function nodeDraft(nodeId: string, protectedNode = false): NeuralPersonaNodeDraft {
  return {
    baseWeight: 0.7,
    confidence: 1,
    decayRate: 0,
    influenceSummary: `节点 ${nodeId}`,
    nodeId,
    plasticity: 0.3,
    protected: protectedNode,
    scope: 'private',
    sourceRef: protectedNode ? `persona:${nodeId}` : undefined,
    stability: 0.8,
    status: 'active',
    tags: [],
    type: protectedNode ? 'identity-reference' : 'preference',
  };
}

sourceFiles.forEach(inspectSource);
const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: () => 100,
  storage: memoryStorage(),
});
assert.equal((await repository.initialize(emptyGraph('role-a'))).status, 'ok');
assert.equal((await repository.initialize(emptyGraph('role-b'))).status, 'ok');
const nodeService = createNeuralPersonaNodeCommandService({ now: () => 200, repository });
assert.equal((await nodeService.createNode({
  commandId: 'node:create-a', expectedRevision: 0, node: nodeDraft('identity:self', true), roleId: 'role-a',
})).status, 'ok');
assert.equal((await nodeService.createNode({
  commandId: 'node:create-b', expectedRevision: 1, node: nodeDraft('preference:b'), roleId: 'role-a',
})).status, 'ok');

const loaded = await repository.load('role-a');
assert.equal(loaded.status, 'ok');
if (loaded.status !== 'ok') throw new Error('role-a load failed');
const exportText = serializeNeuralPersonaGraphExport(loaded.record, 300);
const parsed = parseNeuralPersonaGraphExport(
  exportText, DEFAULT_NEURAL_PERSONA_CONFIG, 400, 'role-a',
);
assert.equal(parsed.status, 'ok');
if (parsed.status === 'ok') {
  assert.equal(parsed.sourceRevision, 2);
  assert.equal(parsed.graph.nodes.length, 2);
}
assert.deepEqual(parseNeuralPersonaGraphExport(
  '{', DEFAULT_NEURAL_PERSONA_CONFIG, 400,
), { reason: 'invalid-json', status: 'invalid' });
assert.deepEqual(parseNeuralPersonaGraphExport(
  'x'.repeat(NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES + 1),
  DEFAULT_NEURAL_PERSONA_CONFIG,
  400,
), { reason: 'import-file-too-large', status: 'invalid' });

const wrongFormat = JSON.parse(exportText);
wrongFormat.format = 'unsupported';
assert.equal(parseNeuralPersonaGraphExport(
  JSON.stringify(wrongFormat), DEFAULT_NEURAL_PERSONA_CONFIG, 400,
).status, 'invalid');
const wrongRole = JSON.parse(exportText);
wrongRole.source.roleId = 'role-b';
assert.deepEqual(parseNeuralPersonaGraphExport(
  JSON.stringify(wrongRole), DEFAULT_NEURAL_PERSONA_CONFIG, 400,
), { reason: 'export-role-mismatch', status: 'invalid' });
const wrongGraphVersion = JSON.parse(exportText);
wrongGraphVersion.source.graphVersion = 'neural-graph.r999';
assert.deepEqual(parseNeuralPersonaGraphExport(
  JSON.stringify(wrongGraphVersion), DEFAULT_NEURAL_PERSONA_CONFIG, 400,
), { reason: 'export-source-version-mismatch', status: 'invalid' });
assert.deepEqual(parseNeuralPersonaGraphExport(
  exportText, DEFAULT_NEURAL_PERSONA_CONFIG, 400, 'role-b',
), { reason: 'import-role-mismatch', status: 'invalid' });

const legacy = JSON.parse(exportText);
legacy.graph.schemaVersion = 0;
legacy.graph.nodes.forEach((node: { schemaVersion: number }) => { node.schemaVersion = 0; });
const migrated = parseNeuralPersonaGraphExport(
  JSON.stringify(legacy), DEFAULT_NEURAL_PERSONA_CONFIG, 400, 'role-a',
);
assert.equal(migrated.status, 'ok');
if (migrated.status === 'ok') assert.equal(migrated.migrated, true);

const incomingGraph = {
  ...loaded.record.graph,
  nodes: loaded.record.graph.nodes.map((node) => node.nodeId === 'identity:self'
    ? { ...node, influenceSummary: '导入后的节点 A' }
    : node).slice(0, 1),
};
const diff = diffNeuralPersonaGraphs(loaded.record.graph, incomingGraph);
assert.deepEqual(diff.changedNodeIds, ['identity:self']);
assert.deepEqual(diff.removedNodeIds, ['preference:b']);
assert.equal(diff.hasChanges, true);
assert.deepEqual(diff.protectedNodeChangeIds, ['identity:self']);
assert.equal(diff.requiresProtectedConfirmation, true);
const protectedRelationship = {
  ...loaded.record.graph,
  edges: [{
    confidence: 1,
    createdAt: 300,
    edgeId: 'edge:self-preference',
    ownerRoleId: 'role-a',
    relationType: 'supports' as const,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: 'identity:self',
    targetNodeId: 'preference:b',
    updatedAt: 300,
    weight: 0.5,
  }],
};
const protectedRelationshipDiff = diffNeuralPersonaGraphs(protectedRelationship, {
  ...protectedRelationship,
  edges: protectedRelationship.edges.map((edge) => ({ ...edge, weight: 0.8 })),
});
assert.deepEqual(
  protectedRelationshipDiff.protectedRelationshipEdgeChangeIds,
  ['edge:self-preference'],
);
assert.equal(protectedRelationshipDiff.requiresProtectedConfirmation, true);
const incomingText = JSON.stringify({ ...JSON.parse(exportText), graph: incomingGraph });
const preview = createNeuralPersonaGraphImportPreview({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  currentRecord: loaded.record,
  expectedRevision: 2,
  now: 400,
  serialized: incomingText,
});
assert.equal(preview.status, 'ready');
if (preview.status !== 'ready') throw new Error('preview failed');
assert.equal(preview.diff.removedNodeIds.length, 1);

const exchange = createNeuralPersonaGraphExchangeService({ now: () => 500, repository });
assert.deepEqual(await exchange.importGraph({
  commandId: 'graph:import-unconfirmed',
  expectedRevision: preview.expectedRevision,
  graph: preview.graph,
  roleId: 'role-a',
  sourceRevision: preview.sourceRevision,
}), { reason: 'protected-import-confirmation-required', status: 'invalid' });
const imported = await exchange.importGraph({
  commandId: 'graph:import',
  confirmProtectedChanges: true,
  expectedRevision: preview.expectedRevision,
  graph: preview.graph,
  roleId: 'role-a',
  sourceRevision: preview.sourceRevision,
});
assert.equal(imported.status, 'ok');
if (imported.status !== 'ok') throw new Error('import failed');
assert.equal(imported.record.revision, 3);
assert.equal(imported.record.graph.graphVersion, 'neural-graph.r3');
assert.equal(imported.record.graph.nodes.length, 1);
assert.equal(imported.record.recoverySnapshots.length > 0, true);
assert.equal(imported.receipt.commandType, 'import-graph');
assert.equal(imported.receipt.sourceRevision, 2);

assert.deepEqual(await exchange.importGraph({
  commandId: 'graph:stale', expectedRevision: 2, graph: preview.graph,
  roleId: 'role-a', sourceRevision: 2,
}), { actualRevision: 3, status: 'conflict' });
assert.deepEqual(await exchange.importGraph({
  commandId: 'graph:no-change', expectedRevision: 3, graph: imported.record.graph,
  roleId: 'role-a', sourceRevision: 3,
}), { reason: 'import-has-no-changes', status: 'invalid' });
assert.deepEqual(await exchange.importGraph({
  commandId: 'graph:wrong-role', expectedRevision: 3,
  graph: { ...imported.record.graph, roleId: 'role-b' }, roleId: 'role-a', sourceRevision: 3,
}), { reason: 'import-role-mismatch', status: 'invalid' });

const roleB = await repository.load('role-b');
assert.equal(roleB.status, 'ok');
if (roleB.status === 'ok') assert.equal(roleB.record.graph.nodes.length, 0);

console.log('neural persona graph exchange smoke ok');
