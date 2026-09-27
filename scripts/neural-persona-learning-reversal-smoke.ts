import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaLearningApplicationCommandService,
  createNeuralPersonaLearningProposalCommandService,
  createNeuralPersonaLearningProposalRepository,
  createNeuralPersonaLearningReversalCommandService,
  createNeuralPersonaReinforcementLedgerRepository,
  inspectNeuralPersonaLearningReconciliation,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaFeedbackEvent,
  type NeuralPersonaGraphRepository,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaLearningProposalRepository,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const NOW = 259_200_000;
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaLearningReconciliation.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningReversalCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningReversalCommandTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningReversalState.ts',
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
      if ((records.get(key) ?? null) !== expected) return false;
      records.set(key, next);
      return true;
    },
    read: async (key) => records.get(key) ?? null,
  };
  return { records, storage };
}

function node(roleId: string, protectedNode = false): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.7, createdAt: 1,
    currentActivation: 0, decayRate: 0, influenceSummary: `Node ${roleId}`,
    nodeId: 'node:target', ownerRoleId: roleId, plasticity: 0.2,
    protected: protectedNode, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private', sourceRef: protectedNode ? 'persona:self' : undefined,
    stability: 0.8, status: 'active', tags: [],
    type: protectedNode ? 'identity-reference' : 'preference', updatedAt: 1,
  };
}

function event(roleId: string): NeuralPersonaFeedbackEvent {
  return {
    eventId: `event:${roleId}`,
    evidence: { sourceId: 'user:test', sourceType: 'user-explicit', summary: 'test' },
    kind: 'positive', magnitude: 0.8, nodeId: 'node:target',
    observedGraphRevision: 0, occurredAt: NOW, roleId,
  };
}

async function setupApplied(
  storage: NeuralPersonaAtomicStorage,
  roleId: string,
  protectedNode = false,
) {
  const graphRepository = createNeuralPersonaGraphRepository({
    config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => NOW, storage,
  });
  const ledgerRepository = createNeuralPersonaReinforcementLedgerRepository({
    now: () => NOW, storage,
  });
  const proposalRepository = createNeuralPersonaLearningProposalRepository({
    now: () => NOW, storage,
  });
  const graph: NeuralPersonaGraphSnapshot = {
    createdAt: 1, edges: [], graphVersion: 'neural-graph.r0',
    nodes: [node(roleId, protectedNode)], roleId,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
  assert.equal((await graphRepository.initialize(graph)).status, 'ok');
  assert.equal((await ledgerRepository.initialize(roleId)).status, 'ok');
  assert.equal((await ledgerRepository.append({ event: event(roleId), expectedRevision: 0,
    nodeId: 'node:target', roleId })).status, 'ok');
  const proposals = createNeuralPersonaLearningProposalCommandService({
    graphRepository, ledgerRepository, now: () => NOW, proposalRepository,
  });
  assert.equal((await proposals.generate({
    commandId: `proposal:${roleId}`, createdAt: NOW, expectedGraphRevision: 0,
    expectedLedgerRevision: 1, expectedProposalRevision: null,
    nodeId: 'node:target', projectedAt: NOW, roleId,
  })).status, 'ok');
  assert.equal((await proposals.review({
    commandId: `review:${roleId}`, confirmProtectedNode: protectedNode || undefined,
    decision: 'accept', expectedProposalRevision: 1, proposalId: `proposal:${roleId}`,
    reviewerId: 'local-user', roleId,
  })).status, 'ok');
  const application = createNeuralPersonaLearningApplicationCommandService({
    graphRepository, ledgerRepository, now: () => NOW, proposalRepository,
  });
  assert.equal((await application.apply({
    appliedBy: 'local-user', commandId: `apply:${roleId}`,
    confirmProtectedNode: protectedNode || undefined, expectedGraphRevision: 0,
    expectedLedgerRevision: 1, expectedProposalRevision: 2,
    proposalId: `proposal:${roleId}`, roleId,
  })).status, 'ok');
  return { graphRepository, proposalRepository };
}

async function current(
  graphRepository: NeuralPersonaGraphRepository,
  proposalRepository: NeuralPersonaLearningProposalRepository,
  roleId: string,
) {
  const graph = await graphRepository.load(roleId);
  const proposals = await proposalRepository.load(roleId);
  if (graph.status !== 'ok' || proposals.status !== 'ok') throw new Error('records missing');
  return { graph: graph.record, proposals: proposals.record };
}

function reversalCommand(roleId: string, graphRevision: number, proposalRevision: number) {
  return {
    commandId: `reverse:${roleId}`, expectedGraphRevision: graphRevision,
    expectedProposalRevision: proposalRevision, proposalId: `proposal:${roleId}`,
    reversedBy: 'local-user', roleId,
  };
}

sourceFiles.forEach(inspectSource);
const memory = memoryStorage();
const normal = await setupApplied(memory.storage, 'role-normal');
const before = await current(normal.graphRepository, normal.proposalRepository, 'role-normal');
assert.equal(inspectNeuralPersonaLearningReconciliation(
  before.graph, before.proposals,
).findings[0].status, 'consistent-applied');
const reversal = createNeuralPersonaLearningReversalCommandService({
  ...normal, now: () => NOW + 1,
});
const command = reversalCommand('role-normal', before.graph.revision, before.proposals.revision);
const reversed = await reversal.reverse(command);
assert.equal(reversed.status, 'ok');
if (reversed.status !== 'ok') throw new Error('reversal failed');
assert.deepEqual([
  reversed.graphRecord.graph.nodes[0].baseWeight,
  reversed.graphRecord.graph.nodes[0].confidence,
  reversed.graphRecord.graph.nodes[0].stability,
], [0.6, 0.7, 0.8]);
assert.equal(reversed.proposalRecord.proposals[0].status, 'reversed');
assert.equal(inspectNeuralPersonaLearningReconciliation(
  reversed.graphRecord, reversed.proposalRecord,
).findings[0].status, 'consistent-reversed');
assert.equal((await reversal.reverse(command)).status, 'idempotent');

const modified = await setupApplied(memory.storage, 'role-modified');
const modifiedBefore = await current(modified.graphRepository, modified.proposalRepository, 'role-modified');
assert.equal((await modified.graphRepository.transact({
  expectedRevision: modifiedBefore.graph.revision, roleId: 'role-modified',
  update: (graph) => ({ ...graph, graphVersion: 'neural-graph.r2',
    nodes: graph.nodes.map((item) => ({ ...item, baseWeight: item.baseWeight + 0.01 })) }),
})).status, 'ok');
const modifiedCurrent = await current(modified.graphRepository, modified.proposalRepository, 'role-modified');
assert.equal(inspectNeuralPersonaLearningReconciliation(
  modifiedCurrent.graph, modifiedCurrent.proposals,
).findings[0].status, 'values-modified');
const modifiedService = createNeuralPersonaLearningReversalCommandService(modified);
assert.deepEqual(await modifiedService.reverse(reversalCommand(
  'role-modified', modifiedCurrent.graph.revision, modifiedCurrent.proposals.revision,
)), { reason: 'learning-reversal-values-modified', status: 'invalid' });

const rolledBack = await setupApplied(memory.storage, 'role-rollback');
assert.equal((await rolledBack.graphRepository.rollback(
  'role-rollback', 'revision:0',
)).status, 'ok');
const rollbackCurrent = await current(
  rolledBack.graphRepository, rolledBack.proposalRepository, 'role-rollback',
);
assert.equal(inspectNeuralPersonaLearningReconciliation(
  rollbackCurrent.graph, rollbackCurrent.proposals,
).findings[0].status, 'marker-missing');
assert.deepEqual(await createNeuralPersonaLearningReversalCommandService(rolledBack).reverse(
  reversalCommand('role-rollback', rollbackCurrent.graph.revision,
    rollbackCurrent.proposals.revision),
), { reason: 'learning-reversal-application-marker-missing', status: 'invalid' });

const legacy = await setupApplied(memory.storage, 'role-legacy');
const legacyBefore = await current(legacy.graphRepository, legacy.proposalRepository, 'role-legacy');
assert.equal((await legacy.graphRepository.transact({
  expectedRevision: legacyBefore.graph.revision, roleId: 'role-legacy',
  update: (graph) => ({ ...graph, graphVersion: 'neural-graph.r2', nodes: graph.nodes.map((item) => {
    if (!item.learningApplication) return item;
    const { appliedValues: _applied, previousValues: _previous, ...marker } = item.learningApplication;
    return { ...item, learningApplication: marker };
  }) }),
})).status, 'ok');
const legacyCurrent = await current(legacy.graphRepository, legacy.proposalRepository, 'role-legacy');
assert.equal(inspectNeuralPersonaLearningReconciliation(
  legacyCurrent.graph, legacyCurrent.proposals,
).findings[0].status, 'legacy-marker-unverifiable');
assert.equal((await createNeuralPersonaLearningReversalCommandService(legacy).reverse(
  reversalCommand('role-legacy', legacyCurrent.graph.revision, legacyCurrent.proposals.revision),
)).status, 'invalid');

const mismatch = await setupApplied(memory.storage, 'role-mismatch');
const mismatchBefore = await current(
  mismatch.graphRepository, mismatch.proposalRepository, 'role-mismatch',
);
assert.equal((await mismatch.graphRepository.transact({
  expectedRevision: mismatchBefore.graph.revision, roleId: 'role-mismatch',
  update: (graph) => ({ ...graph, graphVersion: 'neural-graph.r2', nodes: graph.nodes.map((item) => ({
    ...item, learningApplication: item.learningApplication
      ? { ...item.learningApplication, proposalId: 'proposal:replacement' } : undefined,
  })) }),
})).status, 'ok');
const mismatchCurrent = await current(
  mismatch.graphRepository, mismatch.proposalRepository, 'role-mismatch',
);
assert.equal(inspectNeuralPersonaLearningReconciliation(
  mismatchCurrent.graph, mismatchCurrent.proposals,
).findings[0].status, 'marker-mismatch');

const protectedRepos = await setupApplied(memory.storage, 'role-protected', true);
const protectedCurrent = await current(
  protectedRepos.graphRepository, protectedRepos.proposalRepository, 'role-protected',
);
const protectedService = createNeuralPersonaLearningReversalCommandService(protectedRepos);
const protectedCommand = reversalCommand(
  'role-protected', protectedCurrent.graph.revision, protectedCurrent.proposals.revision,
);
assert.deepEqual(await protectedService.reverse(protectedCommand), {
  reason: 'learning-reversal-protected-confirmation-required', status: 'invalid',
});
assert.equal((await protectedService.reverse({
  ...protectedCommand, confirmProtectedNode: true,
})).status, 'ok');

const interrupted = await setupApplied(memory.storage, 'role-interrupted');
let transactions = 0;
const failingRepository: NeuralPersonaLearningProposalRepository = {
  initialize: (roleId) => interrupted.proposalRepository.initialize(roleId),
  load: (roleId) => interrupted.proposalRepository.load(roleId),
  rollback: (roleId, snapshotId) => interrupted.proposalRepository.rollback(roleId, snapshotId),
  transact: async (input) => {
    transactions += 1;
    if (transactions === 2) return { actualRevision: input.expectedRevision, status: 'conflict' };
    return interrupted.proposalRepository.transact(input);
  },
};
const interruptedBefore = await current(
  interrupted.graphRepository, interrupted.proposalRepository, 'role-interrupted',
);
const interruptedCommand = reversalCommand(
  'role-interrupted', interruptedBefore.graph.revision, interruptedBefore.proposals.revision,
);
assert.equal((await createNeuralPersonaLearningReversalCommandService({
  graphRepository: interrupted.graphRepository, proposalRepository: failingRepository,
}).reverse(interruptedCommand)).status, 'conflict');
const interruptedCurrent = await current(
  interrupted.graphRepository, interrupted.proposalRepository, 'role-interrupted',
);
assert.equal(interruptedCurrent.graph.revision, 2);
assert.equal(inspectNeuralPersonaLearningReconciliation(
  interruptedCurrent.graph, interruptedCurrent.proposals,
).findings[0].status, 'reversal-pending-finalization');
assert.equal((await createNeuralPersonaLearningReversalCommandService(interrupted)
  .reverse(interruptedCommand)).status, 'ok');
assert.equal((await interrupted.graphRepository.load('role-interrupted')).status, 'ok');

console.log('neural persona learning reversal smoke ok');
