import assert from 'node:assert/strict';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeBatchDeleteCommandService,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNodeDraft,
} from '../src/character-graph/neural-persona';
import { toggleNeuralPersonaNodeBatchSelection } from '../src/components/settings/neuralPersonaNodeBatchSelection';

assert.deepEqual(toggleNeuralPersonaNodeBatchSelection([], 'node:a'), ['node:a']);
assert.deepEqual(toggleNeuralPersonaNodeBatchSelection(['node:a'], 'node:b'), ['node:a', 'node:b']);
assert.deepEqual(toggleNeuralPersonaNodeBatchSelection(['node:a', 'node:b'], 'node:a'), ['node:b']);

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
    createdAt: 1, edges: [], graphVersion: 'neural-graph.r0', nodes: [],
    roleId, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

function nodeDraft(nodeId: string, protectedNode = false): NeuralPersonaNodeDraft {
  return {
    baseWeight: 0.8, confidence: 1, decayRate: 0,
    influenceSummary: `节点 ${nodeId}`, nodeId, plasticity: protectedNode ? 0 : 0.2,
    protected: protectedNode, scope: 'private',
    sourceRef: protectedNode ? `persona:${nodeId}` : undefined,
    stability: 0.9, status: 'active', tags: [],
    type: protectedNode ? 'identity-reference' : 'preference',
  };
}

const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 100, storage: memoryStorage(),
});
assert.equal((await repository.initialize(emptyGraph('role-a'))).status, 'ok');
const nodes = createNeuralPersonaNodeCommandService({ now: () => 200, repository });
const edges = createNeuralPersonaEdgeCommandService({ now: () => 300, repository });
const batchDelete = createNeuralPersonaNodeBatchDeleteCommandService({
  now: () => 400, repository,
});

assert.equal((await nodes.createNode({
  commandId: 'create-anchor', expectedRevision: 0,
  node: nodeDraft('identity:self', true), roleId: 'role-a',
})).status, 'ok');
assert.equal((await nodes.createNode({
  commandId: 'create-a', expectedRevision: 1,
  node: nodeDraft('node:a'), roleId: 'role-a',
})).status, 'ok');
assert.equal((await nodes.createNode({
  commandId: 'create-b', expectedRevision: 2,
  node: nodeDraft('node:b'), roleId: 'role-a',
})).status, 'ok');
assert.equal((await edges.createEdge({
  commandId: 'edge-anchor-a', expectedRevision: 3, roleId: 'role-a',
  edge: { confidence: 1, edgeId: 'edge:anchor-a', relationType: 'associated-with', sourceNodeId: 'identity:self', targetNodeId: 'node:a', weight: 1 },
})).status, 'ok');
assert.equal((await edges.createEdge({
  commandId: 'edge-a-b', expectedRevision: 4, roleId: 'role-a',
  edge: { confidence: 1, edgeId: 'edge:a-b', relationType: 'supports', sourceNodeId: 'node:a', targetNodeId: 'node:b', weight: 1 },
})).status, 'ok');

assert.deepEqual(await batchDelete.deleteNodes({
  commandId: 'delete-empty', expectedRevision: 5, nodeIds: [], roleId: 'role-a',
}), { reason: 'node-batch-selection-empty', status: 'invalid' });
assert.deepEqual(await batchDelete.deleteNodes({
  commandId: 'delete-missing', expectedRevision: 5,
  nodeIds: ['node:a', 'missing'], roleId: 'role-a',
}), { reason: 'node-missing', status: 'missing' });
assert.deepEqual(await batchDelete.deleteNodes({
  commandId: 'delete-protected', expectedRevision: 5,
  nodeIds: ['identity:self', 'node:a'], roleId: 'role-a',
}), { reason: 'protected-node-confirmation-required', status: 'invalid' });

const beforeDelete = await repository.load('role-a');
assert.equal(beforeDelete.status, 'ok');
const deleted = await batchDelete.deleteNodes({
  commandId: 'delete-two', expectedRevision: 5,
  nodeIds: ['node:a', 'node:b'], roleId: 'role-a',
});
assert.equal(deleted.status, 'ok');
if (deleted.status === 'ok') {
  assert.equal(deleted.record.revision, 6);
  assert.deepEqual(deleted.receipt.deletedNodeIds, ['node:a', 'node:b']);
  assert.deepEqual(deleted.receipt.deletedEdgeIds, ['edge:anchor-a', 'edge:a-b']);
  assert.equal(deleted.record.graph.nodes.length, 1);
  assert.equal(deleted.record.graph.edges.length, 0);
  assert.ok(deleted.record.recoverySnapshots.some(
    (snapshot) => snapshot.snapshotId === 'revision:5'
      && snapshot.serializedGraph.includes('node:a'),
  ));
}
assert.deepEqual(await batchDelete.deleteNodes({
  commandId: 'delete-stale', expectedRevision: 5,
  nodeIds: ['identity:self'], roleId: 'role-a', confirmProtectedNodes: true,
}), { actualRevision: 6, status: 'conflict' });

console.log('neural persona node batch delete smoke ok');
