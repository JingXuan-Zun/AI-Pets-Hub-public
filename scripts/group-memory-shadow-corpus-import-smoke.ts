import assert from 'node:assert/strict';
import {
  evaluateGroupMemoryCandidateShadowCorpus,
  importGroupMemoryShadowCorpus,
  parseGroupMemoryShadowCorpusJson,
} from '../src/group-memory';

function rawCandidate(index: number, eligible: boolean) {
  const summary = eligible ? `实际任务结果 ${index} 已完成。` : `用户确认采用方案 ${index}。`;
  return {
    createdAt: index,
    evidence: {
      capturedAt: index, excerpt: summary, kind: eligible ? 'task-result' : 'chat-message',
      sourceMessageId: `message-${index}`, sourceRoleId: 'role-a', topicId: 'topic-a',
    },
    id: `candidate-${index}`,
    proposedRecord: {
      confidence: eligible ? 1 : 0.8, createdAt: index, groupId: 'current-group',
      id: `record-${index}`, kind: eligible ? 'verified-fact' : 'discussion-summary',
      sourceRoleId: 'role-a', summary, topicId: 'topic-a', updatedAt: index,
      visibility: 'group',
    },
    status: 'pending',
  };
}

function validCorpus() {
  return {
    corpusId: 'manual-redacted-corpus-1', createdAt: 100, redactionConfirmed: true,
    samples: Array.from({ length: 20 }, (_, index) => ({
      candidate: rawCandidate(index, index < 5),
      expectedDecision: index < 5 ? 'eligible' : 'manual-review',
      id: `sample-${index}`,
    })),
    schemaVersion: 1,
  };
}

function issueCodes(value: unknown) {
  return importGroupMemoryShadowCorpus(value, 1_000).issues.map((issue) => issue.code);
}

const source = validCorpus();
const before = JSON.stringify(source);
const imported = importGroupMemoryShadowCorpus(source, 1_000);
assert.deepEqual(imported.issues, []);
assert.equal(imported.corpus?.samples.length, 20);
assert.equal(imported.corpus?.schemaVersion, 1);
assert.equal(JSON.stringify(source), before);
assert.equal(
  evaluateGroupMemoryCandidateShadowCorpus(imported.corpus!.samples).readiness,
  'ready',
);
assert.equal(parseGroupMemoryShadowCorpusJson(before).corpus?.samples.length, 20);
assert.deepEqual(parseGroupMemoryShadowCorpusJson('{broken').issues, [
  { code: 'invalid-json', path: '$' },
]);
assert.deepEqual(parseGroupMemoryShadowCorpusJson(' '.repeat(1_000_001)).issues, [
  { code: 'corpus-too-large', path: '$' },
]);

assert.deepEqual(issueCodes(null), ['invalid-root']);
assert.ok(issueCodes({ ...validCorpus(), schemaVersion: 2 }).includes('unsupported-schema'));
assert.ok(issueCodes({ ...validCorpus(), redactionConfirmed: false }).includes('redaction-not-confirmed'));
assert.ok(issueCodes({ ...validCorpus(), corpusId: '' }).includes('invalid-corpus-id'));
assert.ok(issueCodes({ ...validCorpus(), samples: null }).includes('invalid-samples'));
assert.ok(issueCodes({ ...validCorpus(), rawMessage: '未经处理的原始消息' }).includes('forbidden-field'));

const duplicateSample = validCorpus();
duplicateSample.samples[1]!.id = duplicateSample.samples[0]!.id;
assert.ok(issueCodes(duplicateSample).includes('duplicate-sample-id'));
const duplicateCandidate = validCorpus();
duplicateCandidate.samples[1]!.candidate.id = duplicateCandidate.samples[0]!.candidate.id;
assert.ok(issueCodes(duplicateCandidate).includes('duplicate-candidate-id'));

for (const sensitiveText of [
  '邮箱 user@example.com',
  '手机号 13800138000',
  '路径 C:\\Users\\Example\\secret.txt',
  '路径 /Users/example/secret.txt',
  'Bearer abcdefghijklmnopqrstuvwxyz',
  'sk-abcdefghijklmnop',
  'password=super-secret-value',
  'AIza1234567890abcdefghijklmn',
  'ghp_abcdefghijklmnopqrstuvwxyz',
  'AKIA1234567890ABCDEF',
  '-----BEGIN PRIVATE KEY-----',
]) {
  const sensitiveCorpus = validCorpus();
  sensitiveCorpus.samples[0]!.candidate.evidence.excerpt = sensitiveText;
  assert.ok(issueCodes(sensitiveCorpus).includes('sensitive-content'), sensitiveText);
}

const invalidSample = validCorpus();
invalidSample.samples[0]!.candidate = null as never;
assert.ok(issueCodes(invalidSample).includes('invalid-sample'));
const oversized = validCorpus();
oversized.samples = Array.from({ length: 501 }, (_, index) => ({
  candidate: rawCandidate(index, index < 5),
  expectedDecision: index < 5 ? 'eligible' : 'manual-review',
  id: `sample-${index}`,
}));
assert.ok(issueCodes(oversized).includes('too-many-samples'));

console.log('group memory shadow corpus import smoke ok');
