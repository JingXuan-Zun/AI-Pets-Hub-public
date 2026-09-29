import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaTagIndex,
  createNeuralPersonaSemanticDocuments,
  createReadonlyNeuralPersonaGraphStore,
  materializeApprovedNeuralPersonaTags,
  requestNeuralPersonaTagSuggestions,
  retrieveNeuralPersonaCandidates,
  retrieveNeuralPersonaCandidatesWithSemantic,
  reviewNeuralPersonaTagSuggestion,
  type NeuralPersonaContextInput,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
  type NeuralPersonaSemanticDocument,
  type NeuralPersonaSemanticRetrievalProvider,
  type NeuralPersonaTagSuggestionProvider,
} from '../src/character-graph/neural-persona';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaCandidateFusion.ts',
  'src/character-graph/neural-persona/neuralPersonaProviderDataPolicy.ts',
  'src/character-graph/neural-persona/neuralPersonaSemanticRetrieval.ts',
  'src/character-graph/neural-persona/neuralPersonaSemanticRetrievalTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaTagSuggestionReview.ts',
  'src/character-graph/neural-persona/neuralPersonaTagSuggestionReviewTypes.ts',
];

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  assert.doesNotMatch(text, /agentRuntimeExecutor|GroupChatRuntime|StageDirector|Renderer/u);
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

function node(nodeId: string, scope: NeuralPersonaNode['scope']): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.8, createdAt: 1,
    currentActivation: 0, decayRate: 0.1, influenceSummary: `${nodeId} 与天气和陪伴有关。`,
    nodeId, ownerRoleId: 'role-a', plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope, stability: 0.7,
    status: 'active', tags: [{ canonicalId: `topic:${nodeId}`, label: nodeId, source: 'user', status: 'active' }],
    type: 'preference', updatedAt: 1,
  };
}

function input(overrides: Partial<NeuralPersonaContextInput> = {}): NeuralPersonaContextInput {
  return {
    groupIds: [], includePrivate: false, now: 10, query: '天气', requestId: 'semantic-1',
    roleId: 'role-a', sessionId: 'session-1', subgroupIds: [], turnId: 'turn-1', ...overrides,
  };
}

sourceFiles.forEach(inspectSource);
const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1, edges: [], graphVersion: 'graph.v1',
  nodes: [node('private-memory', 'private'), node('world-weather', 'world')],
  roleId: 'role-a', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
};
const storeResult = createReadonlyNeuralPersonaGraphStore(graph, DEFAULT_NEURAL_PERSONA_CONFIG);
assert.equal(storeResult.valid, true);
if (!storeResult.store) throw new Error('store unavailable');
const store = storeResult.store;
const tagIndex = createNeuralPersonaTagIndex(store);
let capturedDocuments: NeuralPersonaSemanticDocument[] = [];
const semanticProvider: NeuralPersonaSemanticRetrievalProvider = {
  providerId: 'semantic:test',
  retrieve: async (request) => {
    capturedDocuments = request.documents;
    return { matches: [{ nodeId: 'world-weather', score: 1 }], status: 'ok' };
  },
};
const semantic = await retrieveNeuralPersonaCandidatesWithSemantic({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input({ includePrivate: true }),
  semanticProvider, store, tagIndex,
});
assert.equal(semantic.semantic.status, 'semantic');
assert.deepEqual(capturedDocuments.map((document) => document.nodeId), ['world-weather']);
assert.deepEqual(createNeuralPersonaSemanticDocuments(store, input({ includePrivate: true }), {
  allowedScopes: ['private', 'world'],
}).map((document) => document.nodeId), ['private-memory', 'world-weather']);
assert.equal(capturedDocuments.some((document) => 'sourceRef' in document), false);
assert.equal(semantic.candidates[0]?.score.semanticRelevance, 1);
const unmatched = semantic.candidates.find((candidate) => candidate.node.nodeId === 'private-memory');
const privateBaseline = retrieveNeuralPersonaCandidates({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input({ includePrivate: true }), store, tagIndex,
}).find((candidate) => candidate.node.nodeId === 'private-memory');
assert.equal(unmatched?.score.total, privateBaseline?.score.total);

const deterministic = retrieveNeuralPersonaCandidates({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input(), store, tagIndex,
});
const failedProvider: NeuralPersonaSemanticRetrievalProvider = {
  providerId: 'semantic:failed',
  retrieve: async () => { throw new Error('offline'); },
};
const fallback = await retrieveNeuralPersonaCandidatesWithSemantic({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input(), semanticProvider: failedProvider,
  store, tagIndex,
});
assert.equal(fallback.semantic.status, 'keyword-fallback');
assert.deepEqual(fallback.candidates, deterministic);
const unreadableProvider: NeuralPersonaSemanticRetrievalProvider = {
  providerId: 'semantic:unsafe',
  retrieve: async () => ({ matches: [{ nodeId: 'private-memory', score: 1 }], status: 'ok' }),
};
const unreadable = await retrieveNeuralPersonaCandidatesWithSemantic({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input(), semanticProvider: unreadableProvider,
  store, tagIndex,
});
assert.equal(unreadable.semantic.status, 'keyword-fallback');
assert.equal(unreadable.semantic.status === 'keyword-fallback' && unreadable.semantic.reason,
  'semantic-result-node-not-readable');

const tagProvider: NeuralPersonaTagSuggestionProvider = {
  providerId: 'tag:test',
  suggest: async () => ({
    status: 'ok',
    suggestions: [
      { canonicalId: 'topic:existing', confidence: 0.9, label: '已有' },
      { canonicalId: 'relation:trust', confidence: 0.85, evidence: ['摘要包含信任'], label: '信任' },
      { canonicalId: 'tone:calm', confidence: 0.7, label: '平静' },
    ],
  }),
};
const requested = await requestNeuralPersonaTagSuggestions({
  now: 20,
  provider: tagProvider,
  request: {
    existingTagIds: ['topic:existing'], nodeId: 'world-weather', nodeType: 'preference',
    requestId: 'tag-1', roleId: 'role-a', scope: 'world',
    summary: '角色信任用户并保持平静。',
  },
});
assert.equal(requested.status, 'ok');
if (requested.status !== 'ok') throw new Error('tag request failed');
assert.deepEqual(requested.batch.suggestions.map((item) => item.canonicalId), [
  'relation:trust', 'tone:calm',
]);
assert.deepEqual(materializeApprovedNeuralPersonaTags(requested.batch), []);
const accepted = reviewNeuralPersonaTagSuggestion({
  batch: requested.batch, decision: 'accept', reviewedAt: 21, reviewerId: 'user',
  suggestionId: requested.batch.suggestions[0]!.suggestionId,
});
assert.equal(accepted.status, 'ok');
if (accepted.status !== 'ok') throw new Error('accept failed');
const rejected = reviewNeuralPersonaTagSuggestion({
  batch: accepted.batch, decision: 'reject', reviewedAt: 22, reviewerId: 'user',
  suggestionId: accepted.batch.suggestions[1]!.suggestionId,
});
assert.equal(rejected.status, 'ok');
if (rejected.status !== 'ok') throw new Error('reject failed');
assert.deepEqual(materializeApprovedNeuralPersonaTags(rejected.batch).map((tag) => ({
  canonicalId: tag.canonicalId, source: tag.source, status: tag.status,
})), [{ canonicalId: 'relation:trust', source: 'system', status: 'active' }]);
assert.deepEqual(materializeApprovedNeuralPersonaTags({
  ...requested.batch,
  suggestions: requested.batch.suggestions.map((item) => ({ ...item, status: 'accepted' })),
}), []);
let blockedProviderCalls = 0;
const blocked = await requestNeuralPersonaTagSuggestions({
  now: 30,
  provider: {
    providerId: 'tag:blocked',
    suggest: async () => { blockedProviderCalls += 1; return { status: 'ok', suggestions: [] }; },
  },
  request: {
    existingTagIds: [], nodeId: 'private-memory', nodeType: 'preference',
    requestId: 'tag-private', roleId: 'role-a', scope: 'private', summary: '私人内容',
  },
});
assert.deepEqual(blocked, { reason: 'tag-suggestion-scope-not-allowed', status: 'unavailable' });
assert.equal(blockedProviderCalls, 0);

console.log('neural persona semantic and tag review smoke ok');
