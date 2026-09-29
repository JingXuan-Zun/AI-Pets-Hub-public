import assert from 'node:assert/strict';
import {
  createNeuralPersonaSourceBlocks,
  mapNeuralPersonaSourceBlockAnnotations,
  requestNeuralPersonaNodeGeneration,
  type NeuralPersonaNodeGenerationProvider,
} from '../src/character-graph/neural-persona';
import { classifyNeuralPersonaBlockBatchesWithRecovery } from '../src/services/neuralPersonaNodeGenerationBatchRecovery';

const sourceText = '她说话温和克制，遇到冲突时会先倾听。她喜欢安静的环境。';
const provider: NeuralPersonaNodeGenerationProvider = {
  providerId: 'recovery-smoke-provider',
  generate: async () => ({ candidates: [], status: 'ok' }),
};
const request = (batchId: string, text = sourceText) => ({
  batchId, now: 100, personaName: '测试主体',
  requestId: `request-${batchId}`, roleId: 'role-a', sourceText: text,
});

const invalidEvidence = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    candidates: [{
      baseWeight: 0.8, confidence: 0.9, evidence: '原文不存在的经历',
      tags: [], type: 'experience',
    }],
    status: 'ok',
  }) },
  request: request('invalid'),
});
assert.equal(invalidEvidence.status, 'ok');
if (invalidEvidence.status !== 'ok') throw new Error('source fallback failed');
assert.ok(invalidEvidence.batch.candidates.length > 0);
assert.ok(invalidEvidence.batch.candidates.every((candidate) => (
  sourceText.includes(candidate.evidence)
)));

const partiallyValid = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    candidates: [
      { baseWeight: 0.8, confidence: 0.9, evidence: '她说话温和克制',
        tags: ['温和'], type: 'style-tendency' },
      { baseWeight: 0.8, confidence: 0.9, evidence: '原文不存在的内容',
        tags: [], type: 'experience' },
    ],
    status: 'ok',
  }) },
  request: request('partial'),
});
assert.equal(partiallyValid.status, 'ok');
if (partiallyValid.status !== 'ok') throw new Error('partial salvage failed');
assert.equal(partiallyValid.batch.candidates.length, 1);
assert.equal(partiallyValid.batch.candidates[0]?.evidence, '她说话温和克制');
assert.equal(partiallyValid.recovery?.mode, 'partial');
assert.deepEqual(partiallyValid.recovery?.rejectionReasons, {
  'generated-node-evidence-not-found': 1,
});

const punctuationSource = '她说“你好”，并保持冷静。她不喜欢争吵。';
const punctuationRecovered = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    candidates: [{
      baseWeight: 0.7, confidence: 0.8,
      evidence: '她说"你好",并保持冷静。', tags: '冷静', type: 'style-tendency',
    }],
    status: 'ok',
  }) },
  request: request('punctuation', punctuationSource),
});
assert.equal(punctuationRecovered.status, 'ok');
if (punctuationRecovered.status !== 'ok') throw new Error('punctuation recovery failed');
assert.equal(punctuationRecovered.batch.candidates[0]?.evidence, '她说“你好”，并保持冷静。');
assert.deepEqual(punctuationRecovered.batch.candidates[0]?.tags, ['冷静']);

const invalidJsonFallback = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    reason: 'persona-node-generation-json-invalid', status: 'unavailable',
  }) },
  request: request('json-fallback'),
});
assert.equal(invalidJsonFallback.status, 'ok');
if (invalidJsonFallback.status !== 'ok') throw new Error('json fallback failed');
assert.equal(invalidJsonFallback.recovery?.mode, 'source-fallback');
assert.ok(invalidJsonFallback.batch.candidates.every((candidate) => (
  sourceText.includes(candidate.evidence)
)));

const detailedParagraphs = Array.from({ length: 35 }, (_, index) => (
  `设定${index + 1}：她面对第${index + 1}类情况时，会先确认对方的真实意图，再结合当前关系、场景风险和既有约定决定回应方式，不会只凭一句话做绝对判断。`
));
const detailedSource = detailedParagraphs.join('\n\n');
const sourceBlocks = createNeuralPersonaSourceBlocks(detailedSource);
assert.equal(sourceBlocks.length, detailedParagraphs.length);
assert.ok(sourceBlocks.every((block) => block.content.length >= 50));
assert.ok(sourceBlocks.every((block) => detailedSource.includes(block.content)));

const annotated = mapNeuralPersonaSourceBlockAnnotations(sourceBlocks.slice(0, 2), [{
  baseWeight: 0.8,
  confidence: 0.9,
  sourceId: sourceBlocks[0]!.sourceId,
  tags: ['谨慎判断'],
  type: 'belief-or-viewpoint',
}]);
assert.equal(annotated.length, 2);
assert.equal(annotated[0]?.influenceSummary, sourceBlocks[0]?.content);
assert.deepEqual(annotated[0]?.tags, ['谨慎判断']);
assert.equal(annotated[1]?.influenceSummary, sourceBlocks[1]?.content);
const allMapped = mapNeuralPersonaSourceBlockAnnotations(sourceBlocks, []);
assert.equal(new Set(allMapped.map((candidate) => candidate.candidateId)).size, sourceBlocks.length);

const recoveryBlocks = sourceBlocks.slice(0, 6);
const attemptedBatches: string[][] = [];
const recoveredBatches = await classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 4,
  blocks: recoveryBlocks,
  classifyBatch: async (blocks) => {
    attemptedBatches.push(blocks.map((block) => block.sourceId));
    if (blocks.length === 4 || blocks[0]?.sourceId === 'source-block-3') {
      throw new Error('Cognition request timed out after 60000ms.');
    }
    return {
      candidates: mapNeuralPersonaSourceBlockAnnotations(blocks, []),
      fallbackCandidateCount: 0,
    };
  },
  recoverableReason: (error) => error instanceof Error && error.message.includes('timed out')
    ? 'persona-node-generation-timeout' : null,
  retryBatchSize: 2,
});
assert.equal(recoveredBatches.candidates.length, recoveryBlocks.length);
assert.equal(recoveredBatches.fallbackCandidateCount, 2);
assert.deepEqual(recoveredBatches.fallbackReasons, {
  'persona-node-generation-timeout': 2,
});
assert.deepEqual(attemptedBatches.map((batch) => batch.length), [4, 2, 2, 2]);
const invalidJsonRecovered = await classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 2, blocks: recoveryBlocks.slice(0, 2), classifyBatch: async () => null,
  recoverableReason: () => null, retryBatchSize: 1,
});
assert.equal(invalidJsonRecovered.candidates.length, 2);
assert.deepEqual(invalidJsonRecovered.fallbackReasons, {
  'persona-node-generation-json-invalid': 2,
});

const timeoutReasonPreserved = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    candidates: allMapped, fallbackCandidateCount: 2,
    fallbackReasons: { 'persona-node-generation-timeout': 2 }, status: 'ok',
  }) },
  request: request('partial-timeout', detailedSource),
});
assert.equal(timeoutReasonPreserved.status, 'ok');
if (timeoutReasonPreserved.status !== 'ok') throw new Error('timeout reason lost');
assert.equal(timeoutReasonPreserved.recovery?.mode, 'partial');
assert.deepEqual(timeoutReasonPreserved.recovery?.rejectionReasons, {
  'persona-node-generation-timeout': 2,
});

const detailedFallback = await requestNeuralPersonaNodeGeneration({
  provider: { ...provider, generate: async () => ({
    reason: 'persona-node-generation-json-invalid', status: 'unavailable',
  }) },
  request: request('detailed-fallback', detailedSource),
});
assert.equal(detailedFallback.status, 'ok');
if (detailedFallback.status !== 'ok') throw new Error('detailed fallback failed');
assert.equal(detailedFallback.batch.candidates.length, detailedParagraphs.length);
assert.ok(detailedFallback.batch.candidates.every((candidate) => (
  candidate.influenceSummary.length >= 50
    && detailedSource.includes(candidate.influenceSummary)
)));

console.log('neural persona node generation recovery smoke ok');
