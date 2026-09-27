import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  callNeuralPersonaSemanticProvider,
  createNeuralPersonaTextModelProviders,
  requestNeuralPersonaTagSuggestions,
  type NeuralPersonaSemanticRetrievalRequest,
  type NeuralPersonaTextModelExecutorInput,
} from '../src/character-graph/neural-persona';
import {
  createNeuralPersonaConfiguredModelDataPolicy,
  createNeuralPersonaConfiguredModelProviders,
  resolveNeuralPersonaConfiguredModelIssue,
} from '../src/services/neuralPersonaConfiguredModelProvider';
import {
  parseNeuralPersonaRelationshipModelOutput,
  safeNeuralPersonaRelationshipModelFailureReason,
} from '../src/services/neuralPersonaConfiguredRelationshipCandidateProvider';
import {
  executeNeuralPersonaRelationshipRequestWithRetry,
  resolveNeuralPersonaRelationshipTimeoutMs,
} from '../src/services/neuralPersonaRelationshipRequestPolicy';
import type { PetConfig } from '../src/types';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaTextModelProvider.ts',
  'src/services/neuralPersonaConfiguredModelProvider.ts',
  'src/components/settings/NeuralPersonaProviderPanel.tsx',
  'src/components/settings/neuralPersonaTagReviewActions.ts',
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

function semanticRequest(
  overrides: Partial<NeuralPersonaSemanticRetrievalRequest> = {},
): NeuralPersonaSemanticRetrievalRequest {
  return {
    documents: [{
      nodeId: 'node:calm', scope: 'world', summary: '遇到冲突时先冷静倾听',
      tagLabels: ['冷静', '倾听'], type: 'style-tendency',
    }],
    maxResults: 1, query: '有人和我争执时怎么办', requestId: 'semantic:1',
    roleId: 'role-secret-not-for-provider',
    ...overrides,
  };
}

sourceFiles.forEach(inspectSource);
const calls: NeuralPersonaTextModelExecutorInput[] = [];
const providers = createNeuralPersonaTextModelProviders({
  dataEgressConsent: true,
  execute: async (input) => {
    calls.push(input);
    return input.systemInstruction.startsWith('Rank')
      ? '```json\n{"matches":[{"documentId":"document-1","score":0.91}]}\n```'
      : '{"suggestions":[{"canonicalId":"tone:calm","label":"冷静","confidence":0.88,"aliases":["平静"],"evidence":["先冷静倾听"]}]}';
  },
  providerId: 'configured-model.smoke', timeoutMs: 4_000,
});
const semantic = await callNeuralPersonaSemanticProvider(
  providers.semanticProvider, semanticRequest(),
);
assert.deepEqual(semantic, {
  matches: [{ nodeId: 'node:calm', score: 0.91 }], status: 'ok',
});
assert.doesNotMatch(calls[0].text, /role-secret-not-for-provider/u);
assert.doesNotMatch(calls[0].text, /node:calm/u);
assert.doesNotMatch(calls[0].text, /sourceRef|traceId/u);
assert.match(calls[0].text, /document-1/u);
assert.equal(calls[0].timeoutMs, 4_000);

const privateDenied = await requestNeuralPersonaTagSuggestions({
  now: 1, provider: providers.tagSuggestionProvider,
  request: {
    existingTagIds: [], nodeId: 'node-private', nodeType: 'style-tendency',
    requestId: 'tag:private', roleId: 'role-secret-not-for-provider', scope: 'private',
    summary: '遇到争执时更愿意先冷静倾听',
  },
});
assert.deepEqual(privateDenied, {
  reason: 'tag-suggestion-scope-not-allowed', status: 'unavailable',
});
assert.equal(calls.length, 1);

const privateAllowed = await requestNeuralPersonaTagSuggestions({
  dataPolicy: createNeuralPersonaConfiguredModelDataPolicy(true), now: 2,
  provider: providers.tagSuggestionProvider,
  request: {
    existingTagIds: [], nodeId: 'node-private', nodeType: 'style-tendency',
    requestId: 'tag:allowed', roleId: 'role-secret-not-for-provider', scope: 'private',
    summary: '遇到争执时更愿意先冷静倾听',
  },
});
assert.equal(privateAllowed.status, 'ok');
if (privateAllowed.status === 'ok') {
  assert.equal(privateAllowed.batch.suggestions[0].canonicalId, 'tone:calm');
  assert.equal(privateAllowed.batch.suggestions[0].status, 'pending-review');
}
assert.doesNotMatch(calls[1].text, /role-secret-not-for-provider|node-private/u);

let unauthorizedCalls = 0;
const unauthorized = createNeuralPersonaTextModelProviders({
  dataEgressConsent: false,
  execute: async () => { unauthorizedCalls += 1; return '{}'; },
  providerId: 'configured-model.unauthorized', timeoutMs: 4_000,
});
assert.deepEqual(await unauthorized.semanticProvider.retrieve(semanticRequest()), {
  reason: 'neural-provider-data-egress-not-consented', status: 'unavailable',
});
assert.equal(unauthorizedCalls, 0);

const cancelledController = new AbortController();
cancelledController.abort();
assert.deepEqual(await providers.semanticProvider.retrieve(semanticRequest({
  signal: cancelledController.signal,
})), { reason: 'neural-provider-request-cancelled', status: 'unavailable' });

const malformed = createNeuralPersonaTextModelProviders({
  dataEgressConsent: true, execute: async () => 'not-json',
  providerId: 'configured-model.malformed', timeoutMs: 4_000,
});
assert.deepEqual(await malformed.semanticProvider.retrieve(semanticRequest()), {
  reason: 'semantic-model-output-invalid', status: 'unavailable',
});
const oversized = semanticRequest({
  documents: Array.from({ length: 61 }, (_, index) => ({
    nodeId: `node:${index}`, scope: 'world' as const, summary: 'bounded',
    tagLabels: [], type: 'preference' as const,
  })),
});
assert.deepEqual(await providers.semanticProvider.retrieve(oversized), {
  reason: 'semantic-model-request-out-of-bounds', status: 'unavailable',
});

const timeout = createNeuralPersonaTextModelProviders({
  dataEgressConsent: true,
  execute: async () => { throw new Error('Cognition request timed out after 10ms.'); },
  providerId: 'configured-model.timeout', timeoutMs: 10,
});
assert.deepEqual(await timeout.semanticProvider.retrieve(semanticRequest()), {
  reason: 'neural-provider-request-timeout', status: 'unavailable',
});

const modelSettings = {
  customApiUrl: '', customModelCapabilities: { image: false, reasoning: false, text: true, tools: false },
  customModelName: '', llmModel: 'gemini-test', llmProvider: 'gemini',
} as PetConfig['settings'];
const openAiMissing = { ...modelSettings, llmProvider: 'openai' as const };
assert.equal(resolveNeuralPersonaConfiguredModelIssue(openAiMissing),
  'neural-provider-api-url-missing');
const configured = createNeuralPersonaConfiguredModelProviders({
  dataEgressConsent: false, settings: modelSettings, timeoutMs: 8_000,
});
assert.equal(configured.semanticProvider.providerId, 'configured-model.gemini.semantic');
assert.equal(safeNeuralPersonaRelationshipModelFailureReason(
  new Error('OpenAI 兼容接口请求失败 (401)：invalid api_key=secret'),
), 'relationship-candidate-model-auth-failed');
assert.equal(safeNeuralPersonaRelationshipModelFailureReason(
  new Error('Cognition request timed out after 10ms.'),
), 'relationship-candidate-local-timeout');
assert.equal(safeNeuralPersonaRelationshipModelFailureReason(
  new Error('OpenAI 兼容接口请求失败 (504)：Gateway timeout'),
), 'relationship-candidate-provider-timeout');
assert.equal(resolveNeuralPersonaRelationshipTimeoutMs(2, 8_000), 90_000);
assert.equal(resolveNeuralPersonaRelationshipTimeoutMs(30, 8_000), 105_000);
assert.equal(resolveNeuralPersonaRelationshipTimeoutMs(60, 8_000), 120_000);
let timeoutAttempts = 0;
const retryResult = await executeNeuralPersonaRelationshipRequestWithRetry({
  execute: async () => {
    timeoutAttempts += 1;
    if (timeoutAttempts === 1) throw new Error('Cognition request timed out after 90000ms.');
    return 'ok';
  },
});
assert.equal(retryResult, 'ok');
assert.equal(timeoutAttempts, 2);
let authAttempts = 0;
await assert.rejects(() => executeNeuralPersonaRelationshipRequestWithRetry({
  execute: async () => {
    authAttempts += 1;
    throw new Error('OpenAI 兼容接口请求失败 (401)：unauthorized');
  },
}));
assert.equal(authAttempts, 1);

const panelSource = fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaProviderPanel.tsx',
), 'utf8');
assert.match(panelSource, /群组和子群组节点始终禁止出站/u);
assert.match(panelSource, /neuralPersonaProviderDataEgressConsent/u);
assert.match(panelSource, /neuralPersonaPrivateProviderDataConsent/u);
const serviceSource = fs.readFileSync(path.resolve(
  'src/services/neuralPersonaConfiguredModelProvider.ts',
), 'utf8');
assert.match(serviceSource, /task: 'understanding'/u);
const defaultsSource = fs.readFileSync(path.resolve('src/constants.ts'), 'utf8');
assert.match(defaultsSource, /neuralPersonaProviderDataEgressConsent: false/u);
assert.match(defaultsSource, /neuralPersonaPrivateProviderDataConsent: false/u);
assert.match(defaultsSource, /neuralPersonaSemanticRetrievalEnabled: false/u);
assert.match(defaultsSource, /neuralPersonaModelTagSuggestionsEnabled: false/u);
const normalizationSource = fs.readFileSync(path.resolve('src/petConfigNormalization.ts'), 'utf8');
assert.match(normalizationSource, /Math\.min\(30_000, Math\.max\(1_000/u);
const cognitionSource = fs.readFileSync(path.resolve('src/services/geminiService.ts'), 'utf8');
assert.match(cognitionSource, /config\.abortSignal = signal/u);
assert.match(cognitionSource, /maxTokensOverride/u);
const relationshipSource = fs.readFileSync(path.resolve(
  'src/services/neuralPersonaConfiguredRelationshipCandidateProvider.ts',
), 'utf8');
assert.match(relationshipSource, /allowReasoningContentFallback: true/u);
assert.match(relationshipSource, /RELATIONSHIP_MAX_OUTPUT_TOKENS = 6_144/u);
assert.match(relationshipSource, /MAX_SUMMARY_CHARACTERS = 240/u);
assert.match(relationshipSource, /Analyze every supplied content node/u);
const aliases = new Map([['node-1', 'node:a'], ['node-2', 'node:b']]);
const relationshipVariants = [
  '{"relationships":[{"from":"node-1","to":"node-2","relation_type":"supports","weight":"0.8","confidence":"0.9","evidence":"shared rule"}]}',
  '说明如下：\n```json\n{"edges":[{"source":"node-1","target":"node-2","relation":"支持","score":0.8,"reason":"shared rule"}]}\n```',
];
relationshipVariants.forEach((variant) => {
  const parsed = parseNeuralPersonaRelationshipModelOutput(variant, aliases);
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.sourceNodeId, 'node:a');
  assert.equal(parsed?.[0]?.targetNodeId, 'node:b');
  assert.equal(parsed?.[0]?.relationType, 'supports');
});

console.log('neural persona configured provider smoke ok');
