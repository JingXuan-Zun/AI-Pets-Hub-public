import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaTagIndex,
  createNeuralPersonaTagReviewCommandService,
  createReadonlyNeuralPersonaGraphStore,
  parseNeuralPersonaRecord,
  serializeNeuralPersonaRecord,
  suggestNeuralPersonaTags,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaTagReviewCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaTagReviewCommandTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaDefaultTagVocabulary.ts',
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

function node(nodeId: string, protectedNode = false): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.8, createdAt: 1,
    currentActivation: 0, decayRate: 0.1, influenceSummary: '角色信任用户并平静地陪伴。',
    nodeId, ownerRoleId: 'role-a', plasticity: 0.2, protected: protectedNode,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private',
    sourceRef: protectedNode ? 'persona:self' : undefined, stability: 0.7,
    status: 'active', tags: [{ canonicalId: 'custom:existing', label: '已有', source: 'user', status: 'active' }],
    type: protectedNode ? 'identity-reference' : 'preference', updatedAt: 1,
  };
}

sourceFiles.forEach(inspectSource);
const storage = memoryStorage();
const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 10, storage,
});
const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1, edges: [], graphVersion: 'neural-graph.r0',
  nodes: [node('preference:calm'), node('identity:self', true)],
  roleId: 'role-a', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
};
assert.equal((await repository.initialize(graph)).status, 'ok');
const service = createNeuralPersonaTagReviewCommandService({ now: () => 20, repository });
const suggestions = suggestNeuralPersonaTags(graph.nodes[0], [
  { canonicalId: 'relationship:trust', label: '信任' },
  { canonicalId: 'tone:calm', label: '平静' },
]);
const staged = await service.stageSuggestions({
  commandId: 'tags:stage', expectedRevision: 0, nodeId: 'preference:calm',
  roleId: 'role-a', suggestions,
});
assert.equal(staged.status, 'ok');
if (staged.status !== 'ok') throw new Error('stage failed');
assert.equal(staged.record.revision, 1);
const stagedNode = staged.record.graph.nodes.find((item) => item.nodeId === 'preference:calm')!;
assert.equal(stagedNode.tags.filter((tag) => tag.status === 'pending-review').length, 3);
const stagedStore = createReadonlyNeuralPersonaGraphStore(
  staged.record.graph, DEFAULT_NEURAL_PERSONA_CONFIG,
);
assert.equal(stagedStore.valid, true);
assert.deepEqual(createNeuralPersonaTagIndex(stagedStore.store!).findNodeIds(['tone:calm']), []);
assert.deepEqual(await service.reviewSuggestion({
  commandId: 'tags:stale', decision: 'accept', expectedRevision: 0,
  nodeId: 'preference:calm', reviewerId: 'user', roleId: 'role-a', tagId: 'tone:calm',
}), { actualRevision: 1, status: 'conflict' });
const accepted = await service.reviewSuggestion({
  commandId: 'tags:accept', decision: 'accept', expectedRevision: 1,
  nodeId: 'preference:calm', reviewerId: 'user', roleId: 'role-a', tagId: 'tone:calm',
});
assert.equal(accepted.status, 'ok');
if (accepted.status !== 'ok') throw new Error('accept failed');
const acceptedTag = accepted.record.graph.nodes[0].tags.find((tag) => tag.canonicalId === 'tone:calm');
assert.deepEqual({ reviewedAt: acceptedTag?.reviewedAt, reviewerId: acceptedTag?.reviewerId,
  status: acceptedTag?.status }, { reviewedAt: 20, reviewerId: 'user', status: 'active' });
const acceptedStore = createReadonlyNeuralPersonaGraphStore(
  accepted.record.graph, DEFAULT_NEURAL_PERSONA_CONFIG,
);
assert.deepEqual(createNeuralPersonaTagIndex(acceptedStore.store!).findNodeIds(['tone:calm']), ['preference:calm']);

const protectedSuggestions = suggestNeuralPersonaTags(graph.nodes[1], []);
assert.deepEqual(await service.stageSuggestions({
  commandId: 'tags:protected', expectedRevision: 2, nodeId: 'identity:self',
  roleId: 'role-a', suggestions: protectedSuggestions,
}), { reason: 'protected-node-confirmation-required', status: 'invalid' });
const protectedStaged = await service.stageSuggestions({
  commandId: 'tags:protected-confirmed', confirmProtectedNode: true,
  expectedRevision: 2, nodeId: 'identity:self', roleId: 'role-a',
  suggestions: protectedSuggestions,
});
assert.equal(protectedStaged.status, 'ok');
if (protectedStaged.status !== 'ok') throw new Error('protected stage failed');
const rejected = await service.reviewSuggestion({
  commandId: 'tags:reject', confirmProtectedNode: true, decision: 'reject',
  expectedRevision: 3, nodeId: 'identity:self', reviewerId: 'user',
  roleId: 'role-a', tagId: 'node-type:identity-reference',
});
assert.equal(rejected.status, 'ok');
if (rejected.status !== 'ok') throw new Error('reject failed');
const parsed = parseNeuralPersonaRecord(
  serializeNeuralPersonaRecord(rejected.record), DEFAULT_NEURAL_PERSONA_CONFIG, 30,
);
assert.equal(parsed.status, 'ok');
if (parsed.status === 'ok') {
  const tag = parsed.record.graph.nodes[1].tags.find((item) => item.canonicalId === 'node-type:identity-reference');
  assert.deepEqual({ reviewedAt: tag?.reviewedAt, reviewerId: tag?.reviewerId,
    status: tag?.status }, { reviewedAt: 20, reviewerId: 'user', status: 'rejected' });
}

console.log('neural persona tag review command smoke ok');
