import assert from 'node:assert/strict';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

function node(roleId: string, nodeId = 'identity'): NeuralPersonaNode {
  return {
    activationCount: 0,
    baseWeight: 0.8,
    confidence: 0.9,
    createdAt: 1,
    currentActivation: 0,
    decayRate: 0.1,
    influenceSummary: '角色珍视与用户共同建立的信任。',
    nodeId,
    ownerRoleId: roleId,
    plasticity: 0.1,
    protected: true,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private',
    sourceRef: 'persona:identity',
    stability: 1,
    status: 'active',
    tags: [],
    type: 'identity-reference',
    updatedAt: 1,
  };
}

function graph(roleId: string): NeuralPersonaGraphSnapshot {
  return {
    createdAt: 1,
    edges: [],
    graphVersion: 'graph.v1',
    nodes: [node(roleId)],
    roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

function memoryStorage(seed: Record<string, string> = {}) {
  const records = new Map(Object.entries(seed));
  const storage: NeuralPersonaAtomicStorage = {
    compareAndSwap: async (roleId, expected, next) => {
      const current = records.get(roleId) ?? null;
      if (current !== expected) return false;
      records.set(roleId, next);
      return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
  return { records, storage };
}

const clock = () => 100;
const memory = memoryStorage();
const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: clock,
  storage: memory.storage,
});

assert.equal((await repository.initialize(graph('role-a'))).status, 'ok');
assert.equal((await repository.initialize(graph('role-b'))).status, 'ok');
const updated = await repository.transact({
  expectedRevision: 0,
  roleId: 'role-a',
  update: (current) => ({ ...current, graphVersion: 'graph.v2' }),
});
assert.equal(updated.status, 'ok');
assert.equal((await repository.load('role-b')).status, 'ok');

const conflict = await repository.transact({
  expectedRevision: 0,
  roleId: 'role-a',
  update: (current) => current,
});
assert.deepEqual(conflict, { actualRevision: 1, status: 'conflict' });
const rolledBack = await repository.rollback('role-a', 'revision:0');
assert.equal(rolledBack.status, 'ok');
if (rolledBack.status === 'ok') assert.equal(rolledBack.record.graph.graphVersion, 'graph.v1');

const legacy = graph('legacy-role') as unknown as { schemaVersion: number; nodes: unknown[] };
legacy.schemaVersion = 0;
legacy.nodes = legacy.nodes.map((entry) => ({ ...(entry as object), schemaVersion: 0 }));
const legacyMemory = memoryStorage({ 'legacy-role': JSON.stringify(legacy) });
const legacyRepository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  now: clock,
  storage: legacyMemory.storage,
});
const migrated = await legacyRepository.load('legacy-role');
assert.equal(migrated.status, 'ok');
if (migrated.status === 'ok') {
  assert.equal(migrated.record.revision, 1);
  assert.equal(migrated.record.recoverySnapshots[0]?.reason, 'before-migration');
}

const corruptMemory = memoryStorage({ broken: '{not-json', malformed: '{"roleId":"malformed"}' });
const corruptRepository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  storage: corruptMemory.storage,
});
assert.equal((await corruptRepository.load('broken')).status, 'corrupt');
assert.equal((await corruptRepository.load('malformed')).status, 'corrupt');
assert.equal(corruptMemory.records.get('broken'), '{not-json');

console.log('neural persona persistence smoke ok');
