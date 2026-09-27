import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaLearningProposalCommandService,
  createNeuralPersonaLearningProposalRepository,
  createNeuralPersonaReinforcementLedgerRepository,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaFeedbackEvent,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const NOW = 86_400_000;
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaLearningProposalTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalStorage.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalSerialization.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalRepository.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalGenerator.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalCommandTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalCommandService.ts',
  'src/components/settings/useNeuralPersonaLearningProposalPanelState.ts',
  'src/components/settings/NeuralPersonaLearningProposalPanel.tsx',
  'src/components/settings/NeuralPersonaLearningProposalCard.tsx',
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

function memoryStorage() {
  const records = new Map<string, string>();
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

function node(nodeId: string, protectedNode = false): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.7, createdAt: 1,
    currentActivation: 0, decayRate: 0, influenceSummary: `Summary ${nodeId}`,
    nodeId, ownerRoleId: 'role-a', plasticity: 0.2, protected: protectedNode,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private',
    sourceRef: protectedNode ? 'persona:self' : undefined, stability: 0.8,
    status: 'active', tags: [], type: protectedNode ? 'identity-reference' : 'preference',
    updatedAt: 1,
  };
}

function feedback(eventId: string, nodeId: string): NeuralPersonaFeedbackEvent {
  return {
    eventId,
    evidence: { sourceId: `user:${eventId}`, sourceType: 'user-explicit', summary: eventId },
    kind: 'positive', magnitude: 0.8, nodeId, observedGraphRevision: 0,
    occurredAt: NOW, roleId: 'role-a',
  };
}

function generateCommand(
  commandId: string,
  nodeId: string,
  expectedLedgerRevision: number,
  expectedProposalRevision: number | null,
) {
  return {
    commandId, createdAt: NOW, expectedGraphRevision: 0,
    expectedLedgerRevision, expectedProposalRevision, nodeId,
    projectedAt: NOW, roleId: 'role-a',
  };
}

sourceFiles.forEach(inspectSource);
const panelSource = fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaLearningProposalPanel.tsx',
), 'utf8') + fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaLearningProposalCard.tsx',
), 'utf8');
const hookSource = fs.readFileSync(path.resolve(
  'src/components/settings/useNeuralPersonaLearningProposalPanelState.ts',
), 'utf8');
const sectionSource = fs.readFileSync(path.resolve(
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx',
), 'utf8');
assert.match(panelSource, /接受只改变审核状态；“应用到图谱”是另一条显式命令/u);
assert.match(panelSource, /protectedNode && !confirmed/u);
assert.doesNotMatch(hookSource, /proposalRepository\.initialize/u);
assert.match(sectionSource, /enabled=\{controller\.feedbackEnabled\}/u);
const memory = memoryStorage();
const graphRepository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => NOW, storage: memory.storage,
});
const ledgerRepository = createNeuralPersonaReinforcementLedgerRepository({
  now: () => NOW, storage: memory.storage,
});
const proposalRepository = createNeuralPersonaLearningProposalRepository({
  now: () => NOW, storage: memory.storage,
});
const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1, edges: [], graphVersion: 'neural-graph.r0',
  nodes: [node('node:normal'), node('node:protected', true)],
  roleId: 'role-a', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
};
assert.equal((await graphRepository.initialize(graph)).status, 'ok');
assert.equal((await ledgerRepository.initialize('role-a')).status, 'ok');
assert.equal((await ledgerRepository.append({
  event: feedback('event:normal', 'node:normal'), expectedRevision: 0,
  nodeId: 'node:normal', roleId: 'role-a',
})).status, 'ok');
assert.equal((await ledgerRepository.append({
  event: feedback('event:protected', 'node:protected'), expectedRevision: 1,
  nodeId: 'node:protected', roleId: 'role-a',
})).status, 'ok');

const service = createNeuralPersonaLearningProposalCommandService({
  graphRepository, ledgerRepository, now: () => NOW, proposalRepository,
});
const normalCommand = generateCommand('proposal:normal', 'node:normal', 2, null);
const generated = await service.generate(normalCommand);
assert.equal(generated.status, 'ok');
if (generated.status !== 'ok') throw new Error('proposal generation failed');
const normal = generated.record.proposals[0];
assert.deepEqual(normal.deltas, { baseWeight: 0.008, confidence: 0.016, stability: 0.008 });
assert.deepEqual(normal.sourceEventIds, ['event:normal']);
assert.equal(normal.observedGraphRevision, 0);
assert.equal(normal.observedLedgerRevision, 2);
assert.equal(generated.record.revision, 1);
assert.ok(memory.records.has('learning-proposals:role-a'));

assert.equal((await service.generate(normalCommand)).status, 'idempotent');
assert.deepEqual(await service.generate({ ...normalCommand, projectedAt: NOW + 1 }), {
  reason: 'learning-proposal-id-collision', status: 'invalid',
});
assert.deepEqual(await service.generate(generateCommand(
  'proposal:normal-duplicate', 'node:normal', 2, 1,
)), { reason: 'learning-proposal-evidence-already-proposed', status: 'invalid' });
const protectedGenerated = await service.generate(generateCommand(
  'proposal:protected', 'node:protected', 2, 1,
));
assert.equal(protectedGenerated.status, 'ok');
if (protectedGenerated.status !== 'ok') throw new Error('protected proposal failed');
assert.equal(protectedGenerated.record.proposals[1].protectedNode, true);

assert.deepEqual(await service.review({
  commandId: 'review:protected', decision: 'accept', expectedProposalRevision: 2,
  proposalId: 'proposal:protected', reviewerId: 'local-user', roleId: 'role-a',
}), { reason: 'protected-node-confirmation-required', status: 'invalid' });
const accepted = await service.review({
  commandId: 'review:protected-confirmed', confirmProtectedNode: true,
  decision: 'accept', expectedProposalRevision: 2,
  proposalId: 'proposal:protected', reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(accepted.status, 'ok');
if (accepted.status !== 'ok') throw new Error('protected review failed');
assert.equal(accepted.record.proposals[1].status, 'accepted');
assert.equal(accepted.record.proposals[1].protectedReviewConfirmed, true);
assert.equal((await service.review({
  commandId: 'review:protected-confirmed', confirmProtectedNode: true,
  decision: 'accept', expectedProposalRevision: 3,
  proposalId: 'proposal:protected', reviewerId: 'local-user', roleId: 'role-a',
})).status, 'idempotent');

const rejected = await service.review({
  commandId: 'review:normal', decision: 'reject', expectedProposalRevision: 3,
  proposalId: 'proposal:normal', reviewerId: 'local-user', roleId: 'role-a',
});
assert.equal(rejected.status, 'ok');
if (rejected.status !== 'ok') throw new Error('normal review failed');
assert.equal(rejected.record.proposals[0].status, 'rejected');
const loadedGraph = await graphRepository.load('role-a');
const loadedLedger = await ledgerRepository.load('role-a');
if (loadedGraph.status === 'ok') assert.equal(loadedGraph.record.revision, 0);
if (loadedLedger.status === 'ok') assert.equal(loadedLedger.record.revision, 2);

assert.deepEqual(await service.generate({
  ...generateCommand('proposal:stale', 'node:normal', 1, 4),
}), { actualRevision: 2, conflictScope: 'ledger', status: 'conflict' });
const rolledBack = await proposalRepository.rollback('role-a', 'revision:3');
assert.equal(rolledBack.status, 'ok');
if (rolledBack.status === 'ok') {
  assert.equal(rolledBack.record.proposals[0].status, 'pending-review');
  assert.equal(rolledBack.record.revision, 5);
}

console.log('neural persona learning proposal smoke ok');
