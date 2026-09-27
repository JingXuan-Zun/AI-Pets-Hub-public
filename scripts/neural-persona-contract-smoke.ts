import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
  NEURAL_PERSONA_SCHEMA_VERSION,
  resolveNeuralPersonaMode,
  validateNeuralPersonaConfig,
  validateNeuralPersonaGraph,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaConfig.ts',
  'src/character-graph/neural-persona/neuralPersonaFeatureFlags.ts',
  'src/character-graph/neural-persona/neuralPersonaValidation.ts',
  'src/character-graph/neural-persona/index.ts',
];

function line(source: ts.SourceFile, position: number) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  assert.doesNotMatch(text, /agentRuntimeExecutor|GroupChatRuntime|StageDirector|Renderer/u);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(source, node.body.end) - line(source, node.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function createNode(overrides: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0,
    baseWeight: 0.7,
    confidence: 0.9,
    createdAt: 1,
    currentActivation: 0,
    decayRate: 0.1,
    influenceSummary: '用户曾经认真帮助过角色，因此角色更愿意耐心回应。',
    nodeId: 'experience:user-helped',
    ownerRoleId: 'role-a',
    plasticity: 0.2,
    protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private',
    sourceRef: 'memory:helped-1',
    stability: 0.8,
    status: 'active',
    tags: [{ canonicalId: 'event:helped', label: '帮助', source: 'user', status: 'active' }],
    type: 'experience',
    updatedAt: 1,
    ...overrides,
  };
}

function createGraph(nodes: NeuralPersonaNode[]): NeuralPersonaGraphSnapshot {
  return {
    createdAt: 1,
    edges: [],
    graphVersion: 'graph.v1',
    nodes,
    roleId: 'role-a',
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
}

sourceFiles.forEach(inspectSource);

assert.deepEqual(validateNeuralPersonaConfig(DEFAULT_NEURAL_PERSONA_CONFIG), {
  issues: [],
  valid: true,
});
assert.equal(DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS.semanticRetrievalEnabled, false);
assert.equal(DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS.modelTagSuggestionsEnabled, false);
assert.equal(DEFAULT_NEURAL_PERSONA_CONFIG.maxTagRecordsPerNode, 24);
assert.equal(resolveNeuralPersonaMode('neural', DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS), 'classic');
assert.equal(resolveNeuralPersonaMode('neural', {
  ...DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
  enabled: true,
}), 'neural');
assert.equal(resolveNeuralPersonaMode('hybrid', {
  ...DEFAULT_NEURAL_PERSONA_FEATURE_FLAGS,
  enabled: true,
}), 'classic');

assert.equal(validateNeuralPersonaGraph(createGraph([createNode()]), DEFAULT_NEURAL_PERSONA_CONFIG).valid, true);
const reservedRoleGraph = {
  ...createGraph([createNode({ ownerRoleId: 'feedback:role-a' })]),
  roleId: 'feedback:role-a',
};
assert.ok(validateNeuralPersonaGraph(
  reservedRoleGraph, DEFAULT_NEURAL_PERSONA_CONFIG,
).issues.some((issue) => issue.code === 'graph-role-reserved'));

const unsafeGraph = createGraph([
  createNode({
    influenceSummary: '',
    nodeId: 'identity:bad',
    protected: false,
    sourceRef: undefined,
    type: 'identity-reference',
  }),
]);
const unsafeIssues = validateNeuralPersonaGraph(unsafeGraph, DEFAULT_NEURAL_PERSONA_CONFIG).issues;
assert.ok(unsafeIssues.some((issue) => issue.code === 'summary-empty'));
assert.ok(unsafeIssues.some((issue) => issue.code === 'reference-source-missing'));
assert.ok(unsafeIssues.some((issue) => issue.code === 'identity-reference-not-protected'));

const rejectedTags = Array.from({ length: 13 }, (_, index) => ({
  canonicalId: `rejected:${index}`, label: `拒绝 ${index}`, reviewedAt: 2,
  reviewerId: 'user', source: 'system' as const, status: 'rejected' as const,
}));
assert.equal(validateNeuralPersonaGraph(createGraph([
  createNode({ tags: rejectedTags }),
]), DEFAULT_NEURAL_PERSONA_CONFIG).valid, true);
const recordLimitIssues = validateNeuralPersonaGraph(createGraph([
  createNode({ tags: [...rejectedTags, ...rejectedTags.map((tag, index) => ({
    ...tag, canonicalId: `rejected-extra:${index}`,
  }))] }),
]), DEFAULT_NEURAL_PERSONA_CONFIG).issues;
assert.ok(recordLimitIssues.some((issue) => issue.code === 'tag-record-limit-exceeded'));
const reviewMetadataIssues = validateNeuralPersonaGraph(createGraph([
  createNode({ tags: [{ canonicalId: 'bad-review', label: '坏记录', reviewedAt: 2,
    source: 'system', status: 'rejected' }] }),
]), DEFAULT_NEURAL_PERSONA_CONFIG).issues;
assert.ok(reviewMetadataIssues.some((issue) => issue.code === 'tag-review-metadata-invalid'));

console.log('neural persona contract smoke ok');
