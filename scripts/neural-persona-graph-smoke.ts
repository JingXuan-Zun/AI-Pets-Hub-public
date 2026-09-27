import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  buildNeuralContextContribution,
  createNeuralPersonaTagIndex,
  createNeuralPersonaGraphProjection,
  createReadonlyNeuralPersonaGraphStore,
  createUserNeuralPersonaTag,
  suggestNeuralPersonaTags,
  type NeuralPersonaContextInput,
  type NeuralPersonaEdge,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const moduleDirectory = path.resolve('src/character-graph/neural-persona');

function sourceLine(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectSource(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  assert.doesNotMatch(text, /agentRuntimeExecutor|GroupChatRuntime|StageDirector|Renderer/u);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = sourceLine(source, node.body.end) - sourceLine(source, node.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function node(nodeId: string, overrides: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0,
    baseWeight: 0.8,
    confidence: 0.9,
    createdAt: 1,
    currentActivation: 0,
    decayRate: 0.1,
    influenceSummary: `${nodeId} 对当前表达产生影响。`,
    nodeId,
    ownerRoleId: 'role-a',
    plasticity: 0.2,
    protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private',
    stability: 0.8,
    status: 'active',
    tags: [{ canonicalId: `topic:${nodeId}`, label: nodeId, source: 'user', status: 'active' }],
    type: 'experience',
    updatedAt: 1,
    ...overrides,
  };
}

function edge(
  edgeId: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationType: NeuralPersonaEdge['relationType'] = 'supports',
): NeuralPersonaEdge {
  return {
    confidence: 1,
    createdAt: 1,
    edgeId,
    ownerRoleId: 'role-a',
    relationType,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId,
    targetNodeId,
    updatedAt: 1,
    weight: 1,
  };
}

function graph(): NeuralPersonaGraphSnapshot {
  return {
    createdAt: 1,
    edges: [
      edge('edge:help-trust', 'help', 'trust'),
      edge('edge:trust-calm', 'trust', 'calm'),
      edge('edge:help-fear', 'help', 'fear', 'inhibits'),
    ],
    graphVersion: 'graph.v1',
    nodes: [
      node('help', { influenceSummary: '用户曾帮助过角色。', sourceRef: 'memory:help' }),
      node('trust', { influenceSummary: '角色更愿意信任用户。', sourceRef: 'relationship:user' }),
      node('calm', { influenceSummary: '角色会更耐心地表达。', sourceRef: 'preference:calm' }),
      node('fear', { influenceSummary: '角色会回避用户。', sourceRef: 'tendency:fear' }),
      node('expired', { expiresAt: 2, influenceSummary: '已经过期。' }),
      node('deleted', { status: 'deleted' }),
      node('other-role', { ownerRoleId: 'role-b' }),
    ].filter((entry) => entry.nodeId !== 'other-role'),
    roleId: 'role-a',
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

function input(overrides: Partial<NeuralPersonaContextInput> = {}): NeuralPersonaContextInput {
  return {
    groupIds: [],
    includePrivate: true,
    now: 10,
    query: 'help',
    requestId: 'request-1',
    roleId: 'role-a',
    sessionId: 'session-1',
    subgroupIds: [],
    turnId: 'turn-1',
    ...overrides,
  };
}

fs.readdirSync(moduleDirectory).filter((name) => name.endsWith('.ts'))
  .forEach((name) => inspectSource(path.join(moduleDirectory, name)));

const result = createReadonlyNeuralPersonaGraphStore(graph(), DEFAULT_NEURAL_PERSONA_CONFIG);
assert.equal(result.valid, true);
assert.ok(result.store);
const store = result.store!;
const largeGraph = { ...graph(), edges: [], nodes: Array.from({ length: 64 }, (_, index) => node(`node-${index}`)) };
assert.equal(createReadonlyNeuralPersonaGraphStore(largeGraph, DEFAULT_NEURAL_PERSONA_CONFIG).valid, true);
assert.equal('maxNodes' in DEFAULT_NEURAL_PERSONA_CONFIG, false);
assert.deepEqual(createNeuralPersonaTagIndex(store).findNodeIds(['help']), ['help']);
assert.equal(createUserNeuralPersonaTag({ label: ' 重要   回忆 ' })?.label, '重要 回忆');
assert.deepEqual(suggestNeuralPersonaTags(node('tag-source', {
  influenceSummary: '用户帮助过角色，因此角色感到信任。',
}), [
  { aliases: ['帮助过'], canonicalId: 'event:helped', label: '帮助' },
  { canonicalId: 'relation:trust', label: '信任' },
]).map((tag) => tag.canonicalId), [
  'node-type:experience',
  'event:helped',
  'relation:trust',
]);
assert.equal(Object.isFrozen(store.snapshot()), true);
assert.equal(Object.isFrozen(store.snapshot().nodes), true);
const projection = createNeuralPersonaGraphProjection(store);
assert.equal(projection.nodes.find((entry) => entry.nodeId === 'help')?.outgoingCount, 2);
assert.equal(projection.nodes.find((entry) => entry.nodeId === 'help')?.sourceRef, undefined);
assert.equal(createNeuralPersonaGraphProjection(store, { exposeSourceRefs: true })
  .nodes.find((entry) => entry.nodeId === 'help')?.sourceRef, 'memory:help');

const first = buildNeuralContextContribution({ config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input(), store });
const second = buildNeuralContextContribution({ config: DEFAULT_NEURAL_PERSONA_CONFIG, input: input(), store });
assert.deepEqual(first, second);
assert.deepEqual(first.trace.selectedNodeIds, ['help', 'trust', 'calm']);
assert.ok(first.trace.filteredNodeIds.includes('fear'));
assert.ok(first.contribution.tokenBudgetUsed <= DEFAULT_NEURAL_PERSONA_CONFIG.maxTokenBudget);
assert.ok(first.contribution.influences.every((influence) => influence.summary.length > 0));

const privateBlocked = buildNeuralContextContribution({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  input: input({ includePrivate: false }),
  store,
});
assert.deepEqual(privateBlocked.contribution.influences, []);

const structuralGraph: NeuralPersonaGraphSnapshot = {
  ...graph(),
  edges: [
    edge('seed:contains:domain', 'seed', 'domain', 'contains'),
    edge('domain:contains:hidden', 'domain', 'hidden', 'contains'),
  ],
  nodes: [
    node('seed', { influenceSummary: '开心消息会让角色表达喜悦。' }),
    node('domain', {
      baseWeight: 0, confidence: 1, influenceSummary: '情感系统',
      plasticity: 0, stability: 1, type: 'cognitive-domain',
    }),
    node('hidden', { baseWeight: 0, confidence: 0, influenceSummary: '无关表达策略。' }),
  ],
};
const structuralStore = createReadonlyNeuralPersonaGraphStore(
  structuralGraph, DEFAULT_NEURAL_PERSONA_CONFIG,
);
assert.ok(structuralStore.valid && structuralStore.store);
const structuralResult = buildNeuralContextContribution({
  config: DEFAULT_NEURAL_PERSONA_CONFIG,
  input: input({ query: '开心消息' }),
  store: structuralStore.store!,
});
assert.deepEqual(structuralResult.trace.selectedNodeIds, ['seed']);
assert.ok(!structuralResult.trace.selectedNodeIds.includes('domain'));
assert.ok(!structuralResult.trace.selectedNodeIds.includes('hidden'));

console.log('neural persona graph smoke ok');
