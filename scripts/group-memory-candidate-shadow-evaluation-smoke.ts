import assert from 'node:assert/strict';
import {
  createGroupMemoryCandidateShadowObservation,
  evaluateGroupMemoryCandidateShadowCorpus,
  type GroupMemoryCandidate,
  type GroupMemoryCandidateScreeningDecision,
  type GroupMemoryCandidateShadowSample,
} from '../src/group-memory';

function candidate(index: number, kind: 'eligible' | 'manual' | 'question' | 'speculative') {
  const taskResult = kind === 'eligible';
  const excerpt = kind === 'question' ? '是否应该保存这条内容？'
    : kind === 'speculative' ? '我觉得可能会完成。'
      : taskResult ? `实际工具结果确认任务 ${index} 已完成。` : `用户确认采用方案 ${index}。`;
  return {
    createdAt: index,
    evidence: {
      capturedAt: index, excerpt, kind: taskResult ? 'task-result' : 'chat-message',
      sourceMessageId: `message-${index}`, sourceRoleId: 'primary', topicId: 'topic-1',
    },
    id: `candidate-${index}`,
    proposedRecord: {
      confidence: taskResult ? 1 : 0.8, createdAt: index, groupId: 'current-group',
      id: `record-${index}`, kind: taskResult ? 'verified-fact' : 'discussion-summary',
      sourceRoleId: 'primary', summary: excerpt, topicId: 'topic-1',
      updatedAt: index, visibility: 'group',
    },
    status: 'pending',
  } satisfies GroupMemoryCandidate;
}

function sample(
  index: number,
  kind: Parameters<typeof candidate>[1],
  expectedDecision: GroupMemoryCandidateScreeningDecision,
): GroupMemoryCandidateShadowSample {
  return { candidate: candidate(index, kind), expectedDecision, id: `sample-${index}` };
}

const readyCorpus = [
  ...Array.from({ length: 5 }, (_, index) => sample(index, 'eligible', 'eligible')),
  ...Array.from({ length: 5 }, (_, index) => sample(index + 5, 'manual', 'manual-review')),
  ...Array.from({ length: 5 }, (_, index) => sample(index + 10, 'question', 'blocked')),
  ...Array.from({ length: 5 }, (_, index) => sample(index + 15, 'speculative', 'blocked')),
];
const before = JSON.stringify(readyCorpus);
const ready = evaluateGroupMemoryCandidateShadowCorpus(readyCorpus, 1_000);
assert.equal(ready.readiness, 'ready');
assert.equal(ready.sampleCount, 20);
assert.equal(ready.accuracy, 1);
assert.equal(ready.eligiblePrecision, 1);
assert.equal(ready.falseEligibleCount, 0);
assert.deepEqual(ready.mismatches, []);
assert.equal(JSON.stringify(readyCorpus), before);

const observation = createGroupMemoryCandidateShadowObservation(readyCorpus[0]!.candidate, 2_000);
assert.deepEqual(observation, {
  candidateId: 'candidate-0', decision: 'eligible', mode: 'shadow', observedAt: 2_000,
  reasons: ['verified-task-result'],
});
assert.equal('repository' in observation, false);

assert.equal(
  evaluateGroupMemoryCandidateShadowCorpus(readyCorpus.slice(0, 19)).readiness,
  'insufficient-samples',
);
const noEligibleCorpus = Array.from(
  { length: 20 }, (_, index) => sample(index, 'manual', 'manual-review'),
);
assert.equal(
  evaluateGroupMemoryCandidateShadowCorpus(noEligibleCorpus).readiness,
  'insufficient-eligible-samples',
);
const unsafeCorpus = [...readyCorpus];
unsafeCorpus[5] = sample(5, 'eligible', 'manual-review');
const unsafe = evaluateGroupMemoryCandidateShadowCorpus(unsafeCorpus);
assert.equal(unsafe.readiness, 'unsafe-false-eligible');
assert.deepEqual(unsafe.mismatches[0], {
  actualDecision: 'eligible', candidateId: 'candidate-5', expectedDecision: 'manual-review',
  reasons: ['verified-task-result'], sampleId: 'sample-5',
});

const falseNegativeCorpus = [...readyCorpus];
for (let index = 0; index < 5; index += 1) {
  falseNegativeCorpus[index] = sample(index, 'manual', 'eligible');
}
assert.equal(
  evaluateGroupMemoryCandidateShadowCorpus(falseNegativeCorpus).readiness,
  'below-eligible-precision',
);
const lowAccuracyCorpus = [...readyCorpus];
for (let index = 10; index < 13; index += 1) {
  lowAccuracyCorpus[index] = sample(index, 'question', 'manual-review');
}
assert.equal(
  evaluateGroupMemoryCandidateShadowCorpus(lowAccuracyCorpus).readiness,
  'below-overall-accuracy',
);

console.log('group memory candidate shadow evaluation smoke ok');
