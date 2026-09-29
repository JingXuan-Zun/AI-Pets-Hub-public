import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
  createNeuralPersonaReinforcementLedgerRepository,
  parseNeuralPersonaFeedbackRecord,
  replayNeuralPersonaReinforcementLedger,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaFeedbackEvent,
} from '../src/character-graph/neural-persona';

const DAY = 86_400_000;
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaFeedbackTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackValidation.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackSerialization.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackStorage.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackRepository.ts',
  'src/character-graph/neural-persona/neuralPersonaReinforcementProjection.ts',
  'src/character-graph/neural-persona/neuralPersonaStorageNamespaces.ts',
];

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  assert.doesNotMatch(text, /agentRuntimeExecutor|GroupChatRuntime|StageDirector/u);
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

function memoryStorage(seed: Record<string, string> = {}) {
  const records = new Map(Object.entries(seed));
  const storage: NeuralPersonaAtomicStorage = {
    compareAndSwap: async (key, expected, next) => {
      const current = records.get(key) ?? null;
      if (current !== expected) return false;
      records.set(key, next);
      return true;
    },
    read: async (key) => records.get(key) ?? null,
  };
  return { records, storage };
}

function feedback(
  eventId: string,
  overrides: Partial<NeuralPersonaFeedbackEvent> = {},
): NeuralPersonaFeedbackEvent {
  return {
    eventId,
    evidence: {
      sourceId: `review:${eventId}`,
      sourceType: 'user-explicit',
      summary: `Explicit evidence for ${eventId}`,
    },
    kind: 'positive',
    magnitude: 0.8,
    nodeId: 'node:a',
    occurredAt: DAY,
    roleId: 'role-a',
    ...overrides,
  };
}

sourceFiles.forEach(inspectSource);
const memory = memoryStorage();
let now = DAY * 3;
const repository = createNeuralPersonaReinforcementLedgerRepository({
  now: () => now,
  storage: memory.storage,
});

assert.equal((await repository.initialize('role-a')).status, 'ok');
assert.equal((await repository.initialize('role-b')).status, 'ok');
assert.deepEqual(await repository.initialize('feedback:role-c'), {
  reason: 'feedback-role-invalid', status: 'invalid',
});
assert.ok(memory.records.has('feedback:role-a'));
assert.equal(memory.records.has('role-a'), false);

const firstEvent = feedback('event:positive');
const first = await repository.append({
  event: firstEvent, expectedRevision: 0, nodeId: 'node:a', roleId: 'role-a',
});
assert.equal(first.status, 'ok');
if (first.status !== 'ok') throw new Error('first feedback append failed');
assert.equal(first.record.revision, 1);
assert.equal(first.record.recoverySnapshots[0]?.snapshotId, 'revision:0');

const duplicate = await repository.append({
  event: firstEvent, expectedRevision: 0, nodeId: 'node:a', roleId: 'role-a',
});
assert.equal(duplicate.status, 'idempotent');
if (duplicate.status === 'idempotent') assert.equal(duplicate.record.revision, 1);
assert.deepEqual(await repository.append({
  event: feedback('event:positive', { magnitude: 0.5 }),
  expectedRevision: 1,
  nodeId: 'node:a',
  roleId: 'role-a',
}), { reason: 'feedback-event-id-collision', status: 'invalid' });

assert.deepEqual(await repository.append({
  event: feedback('event:wrong-role', { roleId: 'role-b' }),
  expectedRevision: 1,
  nodeId: 'node:a',
  roleId: 'role-a',
}), { reason: 'feedback-event-role-mismatch', status: 'invalid' });
assert.deepEqual(await repository.append({
  event: feedback('event:implicit', {
    evidence: { sourceId: 'model:1', sourceType: 'model-implicit' as never, summary: 'Implicit' },
  }),
  expectedRevision: 1,
  nodeId: 'node:a',
  roleId: 'role-a',
}), { reason: 'feedback-evidence-source-invalid', status: 'invalid' });
assert.deepEqual(await repository.append({
  event: feedback('event:future', { occurredAt: now + 1 }),
  expectedRevision: 1,
  nodeId: 'node:a',
  roleId: 'role-a',
}), { reason: 'feedback-time-invalid', status: 'invalid' });
assert.deepEqual(await repository.append({
  event: feedback('event:wrong-node'), expectedRevision: 1,
  nodeId: 'node:b', roleId: 'role-a',
}), { reason: 'feedback-event-node-mismatch', status: 'invalid' });

const second = await repository.append({
  event: feedback('event:negative', {
    kind: 'negative', magnitude: 0.5, nodeId: 'node:b', occurredAt: DAY * 2,
  }),
  expectedRevision: 1,
  nodeId: 'node:b',
  roleId: 'role-a',
});
assert.equal(second.status, 'ok');
if (second.status !== 'ok') throw new Error('second feedback append failed');
const correction = await repository.append({
  event: feedback('event:correction', {
    kind: 'correction', magnitude: 0.2, occurredAt: DAY * 2,
  }),
  expectedRevision: 2,
  nodeId: 'node:a',
  roleId: 'role-a',
});
assert.equal(correction.status, 'ok');
if (correction.status !== 'ok') throw new Error('correction append failed');
assert.deepEqual(correction.record.events.map((item) => item.eventId), [
  'event:positive', 'event:correction', 'event:negative',
]);

const projections = replayNeuralPersonaReinforcementLedger(correction.record, {
  decayRatePerDay: 0.25,
  projectedAt: DAY * 3,
});
assert.deepEqual(projections.map((item) => item.nodeId), ['node:a', 'node:b']);
assert.deepEqual({
  correctionCount: projections[0].correctionCount,
  negativeScore: projections[0].negativeScore,
  netScore: projections[0].netScore,
  positiveScore: projections[0].positiveScore,
}, { correctionCount: 1, negativeScore: 0.15, netScore: 0.25, positiveScore: 0.4 });
assert.equal(projections[1].negativeScore, 0.375);
assert.deepEqual(
  replayNeuralPersonaReinforcementLedger(correction.record, {
    decayRatePerDay: 0.25, projectedAt: DAY * 3,
  }),
  projections,
);
assert.equal((await repository.load('role-b')).status, 'ok');
const roleB = await repository.load('role-b');
if (roleB.status === 'ok') assert.equal(roleB.record.events.length, 0);

assert.deepEqual(await repository.append({
  event: feedback('event:stale'), expectedRevision: 1,
  nodeId: 'node:a', roleId: 'role-a',
}), { actualRevision: 3, status: 'conflict' });

const concurrentMemory = memoryStorage();
const concurrentA = createNeuralPersonaReinforcementLedgerRepository({
  now: () => now, storage: concurrentMemory.storage,
});
const concurrentB = createNeuralPersonaReinforcementLedgerRepository({
  now: () => now, storage: concurrentMemory.storage,
});
assert.equal((await concurrentA.initialize('role-a')).status, 'ok');
const concurrentEvent = feedback('event:concurrent');
const concurrentResults = await Promise.all([
  concurrentA.append({
    event: concurrentEvent, expectedRevision: 0, nodeId: 'node:a', roleId: 'role-a',
  }),
  concurrentB.append({
    event: concurrentEvent, expectedRevision: 0, nodeId: 'node:a', roleId: 'role-a',
  }),
]);
assert.deepEqual(
  concurrentResults.map((result) => result.status).sort(),
  ['idempotent', 'ok'],
);
const concurrentLoaded = await concurrentA.load('role-a');
if (concurrentLoaded.status === 'ok') assert.equal(concurrentLoaded.record.events.length, 1);

const rolledBack = await repository.rollback('role-a', 'revision:0');
assert.equal(rolledBack.status, 'ok');
if (rolledBack.status === 'ok') {
  assert.equal(rolledBack.record.events.length, 0);
  assert.equal(rolledBack.record.revision, 4);
}

const poisoned = JSON.stringify({
  events: [], formatVersion: NEURAL_PERSONA_FEEDBACK_FORMAT_VERSION,
  recoverySnapshots: [], revision: 0, roleId: 'role-b', updatedAt: now,
});
const poisonedRepository = createNeuralPersonaReinforcementLedgerRepository({
  storage: memoryStorage({ 'feedback:role-a': poisoned }).storage,
});
assert.deepEqual(await poisonedRepository.load('role-a'), {
  reason: 'feedback-storage-role-mismatch', status: 'corrupt',
});
assert.equal(parseNeuralPersonaFeedbackRecord('{broken').status, 'corrupt');

now += 1;
console.log('neural persona feedback ledger smoke ok');
