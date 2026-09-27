import assert from 'node:assert/strict';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaRelationshipBatchCommandService,
  createReadonlyNeuralPersonaGraphStore,
  generateNeuralPersonaRelationshipCandidates,
  inspectNeuralPersonaRelationshipCoverage,
  inspectNeuralPersonaActivation,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (roleId, expected, next) => {
      const current = records.get(roleId) ?? null;
      if (current !== expected) return false;
      records.set(roleId, next); return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
}

function node(nodeId: string, summary: string): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.8, confidence: 0.9, createdAt: 1,
    currentActivation: 0, decayRate: 0.02, influenceSummary: summary, nodeId,
    ownerRoleId: 'role-a', plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private', stability: 0.8,
    status: 'active', tags: [], type: 'preference', updatedAt: 1,
  };
}

const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1,
  edges: [{
    confidence: 1, createdAt: 1, edgeId: 'edge:calm-help', ownerRoleId: 'role-a',
    relationType: 'supports', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: 'calm', targetNodeId: 'help', updatedAt: 1, weight: 0.9,
  }],
  graphVersion: 'neural-graph.r0',
  nodes: [node('calm', 'calm and gentle expression'), node('help', 'comfort the user'), node('quiet', 'quiet environment')],
  roleId: 'role-a', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
};

const provider = {
  providerId: 'smoke-relationship-provider',
  generate: async () => ({
    candidates: [{
      candidateId: 'candidate-1', confidence: 0.8, reason: 'calm expression supports comfort',
      relationType: 'supports', sourceNodeId: 'calm', targetNodeId: 'help', weight: 0.7,
    }], status: 'ok' as const,
  }),
};

const initialCoverage = inspectNeuralPersonaRelationshipCoverage(graph);
assert.equal(initialCoverage.semanticEdgeCount, 1);
assert.equal(initialCoverage.connectedContentNodeCount, 2);
assert.deepEqual(initialCoverage.unconnectedContentNodeIds, ['quiet']);

const generated = await generateNeuralPersonaRelationshipCandidates({
  batchId: 'relationship-batch-1', edges: graph.edges, graphVersion: graph.graphVersion,
  nodes: graph.nodes, now: 10, provider, revision: 0, roleId: graph.roleId,
});
assert.equal(generated.status, 'invalid', 'an empty normalized candidate batch must fail closed');

const emptyProvider = {
  providerId: 'smoke-relationship-provider-2',
  generate: async () => ({
    candidates: [{
      candidateId: 'candidate-2', confidence: 0.8, reason: 'calm relates to quiet',
      relationType: 'associated-with', sourceNodeId: 'calm', targetNodeId: 'quiet', weight: 0.6,
    }], status: 'ok' as const,
  }),
};
const generatedNew = await generateNeuralPersonaRelationshipCandidates({
  batchId: 'relationship-batch-2', edges: graph.edges, graphVersion: graph.graphVersion,
  nodes: graph.nodes, now: 10, provider: emptyProvider, revision: 0, roleId: graph.roleId,
});
assert.equal(generatedNew.status, 'ok');
if (generatedNew.status !== 'ok') throw new Error('new relationship generation failed');

const storeResult = createReadonlyNeuralPersonaGraphStore(graph, DEFAULT_NEURAL_PERSONA_CONFIG);
assert.equal(storeResult.valid, true);
if (!storeResult.store) throw new Error('graph store unavailable');
const preview = inspectNeuralPersonaActivation({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  input: {
    groupIds: [], includePrivate: true, now: 10, query: 'calm', requestId: 'preview-1',
    roleId: 'role-a', sessionId: 'session-1', subgroupIds: [], turnId: 'turn-1',
  },
  store: storeResult.store,
});
assert.ok(preview.nodes.some((item) => item.nodeId === 'calm' && item.status === 'selected'));
assert.ok(preview.nodes.some((item) => item.nodeId === 'help' && item.status === 'selected'));

const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 20, storage: memoryStorage(),
});
assert.equal((await repository.initialize(graph)).status, 'ok');
const service = createNeuralPersonaRelationshipBatchCommandService({ repository, now: () => 30 });
const committed = await service.commitCandidates({
  batch: generatedNew.status === 'ok' ? generatedNew.batch : (() => { throw new Error('missing batch'); })(),
  commandId: 'commit-relationships', expectedRevision: 0, reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(committed.status, 'ok');
if (committed.status === 'ok') assert.equal(committed.record.graph.edges.length, 2);

if (committed.status === 'ok') {
  const committedStore = createReadonlyNeuralPersonaGraphStore(
    committed.record.graph, DEFAULT_NEURAL_PERSONA_CONFIG,
  );
  assert.equal(committedStore.valid, true);
  if (!committedStore.store) throw new Error('committed graph store unavailable');
  const reversePreview = inspectNeuralPersonaActivation({
    config: DEFAULT_NEURAL_PERSONA_CONFIG,
    input: {
      groupIds: [], includePrivate: true, now: 10, query: 'quiet', requestId: 'preview-2',
      roleId: 'role-a', sessionId: 'session-1', subgroupIds: [], turnId: 'turn-2',
    },
    store: committedStore.store,
  });
  assert.ok(reversePreview.nodes.some((item) => item.nodeId === 'calm'));
  const finalCoverage = inspectNeuralPersonaRelationshipCoverage(committed.record.graph);
  assert.equal(finalCoverage.connectedContentNodeCount, 3);
  assert.equal(finalCoverage.unconnectedContentNodeIds.length, 0);
}

console.log('neural persona relationship and activation smoke ok');
