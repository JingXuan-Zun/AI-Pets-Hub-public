import assert from 'node:assert/strict';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaEdgeCommandService,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNodeDraft,
} from '../src/character-graph/neural-persona';

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

function identityDraft(): NeuralPersonaNodeDraft {
  return {
    baseWeight: 0.9,
    confidence: 1,
    decayRate: 0,
    influenceSummary: '角色珍视自己的身份以及和用户建立的信任。',
    nodeId: 'identity:self',
    plasticity: 0,
    protected: true,
    scope: 'private',
    sourceRef: 'persona:identity',
    stability: 1,
    status: 'active',
    tags: [{ canonicalId: 'identity:self', label: '身份', source: 'user', status: 'active' }],
    type: 'identity-reference',
  };
}

const bootstrapRepository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: () => 50,
  storage: memoryStorage(),
});
const bootstrapService = createNeuralPersonaNodeCommandService({
  now: () => 50,
  repository: bootstrapRepository,
});
const initialized = await bootstrapService.initializeGraph({
  commandId: 'command:initialize',
  roleId: 'role-new',
});
assert.equal(initialized.status, 'ok');
if (initialized.status === 'ok') {
  assert.equal(initialized.record.revision, 0);
  assert.equal(initialized.receipt.commandType, 'initialize-graph');
}
assert.equal((await bootstrapService.initializeGraph({
  commandId: 'command:initialize-again',
  roleId: 'role-new',
})).status, 'conflict');

const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: () => 100,
  storage: memoryStorage(),
});
assert.equal((await repository.initialize(emptyGraph('role-a'))).status, 'ok');
assert.equal((await repository.initialize(emptyGraph('role-b'))).status, 'ok');
const service = createNeuralPersonaNodeCommandService({ now: () => 200, repository });

assert.deepEqual(await service.updateNode({
  commandId: '',
  expectedRevision: 0,
  nodeId: 'identity:self',
  patch: { influenceSummary: '不能执行。' },
  roleId: 'role-a',
}), { reason: 'command-id-missing', status: 'invalid' });
assert.deepEqual(await service.updateNode({
  commandId: 'command:empty',
  expectedRevision: 0,
  nodeId: 'identity:self',
  patch: {},
  roleId: 'role-a',
}), { reason: 'empty-node-patch', status: 'invalid' });

const created = await service.createNode({
  commandId: 'command:create-1',
  expectedRevision: 0,
  node: identityDraft(),
  roleId: 'role-a',
});
assert.equal(created.status, 'ok');
if (created.status === 'ok') {
  assert.equal(created.record.revision, 1);
  assert.equal(created.record.graph.nodes[0]?.ownerRoleId, 'role-a');
  assert.equal(created.record.graph.nodes[0]?.activationCount, 0);
  assert.equal(created.receipt.commandType, 'create-node');
}

const duplicate = await service.createNode({
  commandId: 'command:create-duplicate',
  expectedRevision: 1,
  node: identityDraft(),
  roleId: 'role-a',
});
assert.deepEqual(duplicate, { reason: 'node-already-exists', status: 'invalid' });

const invalid = await service.updateNode({
  commandId: 'command:invalid-update',
  expectedRevision: 1,
  nodeId: 'identity:self',
  patch: { protected: false },
  roleId: 'role-a',
});
assert.deepEqual(invalid, { reason: 'identity-reference-not-protected', status: 'invalid' });

const updated = await service.updateNode({
  commandId: 'command:update-1',
  expectedRevision: 1,
  nodeId: 'identity:self',
  patch: { influenceSummary: '角色会稳定维护自己的身份边界。' },
  roleId: 'role-a',
});
assert.equal(updated.status, 'ok');
if (updated.status === 'ok') {
  assert.equal(updated.record.revision, 2);
  assert.equal(updated.receipt.appliedRevision, 2);
  assert.equal(updated.record.graph.nodes[0]?.createdAt, 200);
  assert.equal(updated.record.graph.nodes[0]?.updatedAt, 200);
}

const preference = await service.createNode({
  commandId: 'command:create-preference',
  expectedRevision: 2,
  node: {
    ...identityDraft(), nodeId: 'preference:quiet', protected: false,
    sourceRef: undefined, type: 'preference',
  },
  roleId: 'role-a',
});
assert.equal(preference.status, 'ok');
const edgeService = createNeuralPersonaEdgeCommandService({ now: () => 200, repository });
const linked = await edgeService.createEdge({
  commandId: 'command:create-link',
  edge: {
    confidence: 0.8, edgeId: 'edge:identity-quiet', relationType: 'supports',
    sourceNodeId: 'identity:self', targetNodeId: 'preference:quiet', weight: 0.7,
  },
  expectedRevision: 3,
  roleId: 'role-a',
});
assert.equal(linked.status, 'ok');
assert.deepEqual(await service.deleteNode({
  commandId: 'command:protected-delete', expectedRevision: 4,
  nodeId: 'identity:self', roleId: 'role-a',
}), { reason: 'protected-node-confirmation-required', status: 'invalid' });
const deleted = await service.deleteNode({
  commandId: 'command:delete-preference', expectedRevision: 4,
  nodeId: 'preference:quiet', roleId: 'role-a',
});
assert.equal(deleted.status, 'ok');
if (deleted.status === 'ok') {
  assert.equal(deleted.receipt.commandType, 'delete-node');
  assert.equal(deleted.record.graph.nodes.length, 1);
  assert.equal(deleted.record.graph.edges.length, 0);
}

assert.deepEqual(await service.updateNode({
  commandId: 'command:stale',
  expectedRevision: 1,
  nodeId: 'identity:self',
  patch: { influenceSummary: '过期更新不能生效。' },
  roleId: 'role-a',
}), { actualRevision: 5, status: 'conflict' });
assert.deepEqual(await service.updateNode({
  commandId: 'command:missing',
  expectedRevision: 5,
  nodeId: 'missing',
  patch: { influenceSummary: '不存在。' },
  roleId: 'role-a',
}), { reason: 'node-missing', status: 'missing' });

const hierarchyRoot = await service.createNode({
  commandId: 'command:hierarchy-root', expectedRevision: 0,
  node: { ...identityDraft(), influenceSummary: '情感', nodeId: 'domain:emotion',
    protected: false, sourceRef: undefined, type: 'cognitive-domain' }, roleId: 'role-b',
});
assert.equal(hierarchyRoot.status, 'ok');
const hierarchyChild = await service.createNode({
  commandId: 'command:hierarchy-child', expectedRevision: 1,
  node: { ...identityDraft(), influenceSummary: '开心', nodeId: 'topic:happy',
    parentNodeId: 'domain:emotion', protected: false, sourceRef: undefined,
    type: 'cognitive-topic' }, roleId: 'role-b',
});
assert.equal(hierarchyChild.status, 'ok');
if (hierarchyChild.status === 'ok') {
  assert.equal(hierarchyChild.record.graph.edges[0]?.edgeId, 'domain:emotion:contains:topic:happy');
}
const hierarchyLeaf = await service.createNode({
  commandId: 'command:hierarchy-leaf', expectedRevision: 2,
  node: { ...identityDraft(), influenceSummary: '开心表达', nodeId: 'topic:happy-style',
    parentNodeId: 'topic:happy', protected: false, sourceRef: undefined,
    type: 'cognitive-topic' }, roleId: 'role-b',
});
assert.equal(hierarchyLeaf.status, 'ok');
assert.deepEqual(await service.updateNode({
  commandId: 'command:hierarchy-cycle', expectedRevision: 3,
  nodeId: 'domain:emotion', patch: { parentNodeId: 'topic:happy-style' }, roleId: 'role-b',
}), { reason: 'hierarchy-cycle', status: 'invalid' });
const reparented = await service.updateNode({
  commandId: 'command:hierarchy-reparent', expectedRevision: 3,
  nodeId: 'topic:happy-style', patch: { parentNodeId: 'domain:emotion' }, roleId: 'role-b',
});
assert.equal(reparented.status, 'ok');
if (reparented.status === 'ok') {
  assert.equal(reparented.record.graph.edges.some((edge) => (
    edge.edgeId === 'topic:happy:contains:topic:happy-style'
  )), false);
  assert.equal(reparented.record.graph.edges.some((edge) => (
    edge.edgeId === 'domain:emotion:contains:topic:happy-style'
  )), true);
}

console.log('neural persona node command smoke ok');
