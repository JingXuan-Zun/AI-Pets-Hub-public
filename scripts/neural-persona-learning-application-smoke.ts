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
  createNeuralPersonaReinforcementLedgerRepository,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaFeedbackEvent,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaLearningProposalRepository,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';

const NOW = 172_800_000;
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaLearningApplicationCommandTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningApplicationCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningApplicationState.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaLearningProposalSerialization.ts',
  'src/character-graph/neural-persona/neuralPersonaSnapshot.ts',
  'src/character-graph/neural-persona/neuralPersonaValidation.ts',
  'src/components/settings/neuralPersonaLearningApplicationAction.ts',
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

function node(roleId: string, protectedNode: boolean): NeuralPersonaNode {
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

function feedback(roleId: string, eventId = 'event:positive'): NeuralPersonaFeedbackEvent {
  return {
    eventId,
    evidence: { sourceId: `user:${eventId}`, sourceType: 'user-explicit', summary: eventId },
    kind: 'positive', magnitude: 0.8, nodeId: 'node:target',
    observedGraphRevision: 0, occurredAt: NOW, roleId,
  };
}

async function setupAccepted(
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
  assert.equal((await ledgerRepository.append({ event: feedback(roleId), expectedRevision: 0,
    nodeId: 'node:target', roleId })).status, 'ok');
  const proposalService = createNeuralPersonaLearningProposalCommandService({
    graphRepository, ledgerRepository, now: () => NOW, proposalRepository,
  });
  const generated = await proposalService.generate({
    commandId: 'proposal:target', createdAt: NOW, expectedGraphRevision: 0,
    expectedLedgerRevision: 1, expectedProposalRevision: null,
    nodeId: 'node:target', projectedAt: NOW, roleId,
  });
  assert.equal(generated.status, 'ok');
  const reviewed = await proposalService.review({
    commandId: 'review:accept', confirmProtectedNode: protectedNode || undefined,
    decision: 'accept', expectedProposalRevision: 1, proposalId: 'proposal:target',
    reviewerId: 'local-user', roleId,
  });
  assert.equal(reviewed.status, 'ok');
  return { graphRepository, ledgerRepository, proposalRepository };
}

function applyCommand(roleId: string, confirmProtectedNode = false) {
  return {
    appliedBy: 'local-user', commandId: `apply:${roleId}`,
    confirmProtectedNode: confirmProtectedNode || undefined,
    expectedGraphRevision: 0, expectedLedgerRevision: 1,
    expectedProposalRevision: 2, proposalId: 'proposal:target', roleId,
  };
}

sourceFiles.forEach(inspectSource);
const panelSource = fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaLearningProposalPanel.tsx',
), 'utf8') + fs.readFileSync(path.resolve(
  'src/components/settings/NeuralPersonaLearningProposalCard.tsx',
), 'utf8');
const actionSource = fs.readFileSync(path.resolve(
  'src/components/settings/neuralPersonaLearningApplicationAction.ts',
), 'utf8');
const flagsSource = fs.readFileSync(path.resolve(
  'src/character-graph/neural-persona/neuralPersonaFeatureFlags.ts',
), 'utf8');
const envSource = fs.readFileSync(path.resolve('.env.example'), 'utf8');
assert.match(panelSource, /应用会修改图谱中的三个节点数值/u);
assert.match(panelSource, /再次确认应用到受保护节点/u);
assert.match(panelSource, /application\.apply/u);
assert.doesNotMatch(actionSource, /useEffect|\.initialize\(/u);
assert.match(flagsSource, /learningApplicationEnabled: false/u);
assert.match(envSource, /VITE_NEURAL_PERSONA_APPLICATION_PREVIEW="false"/u);
const memory = memoryStorage();
const normal = await setupAccepted(memory.storage, 'role-normal');
const normalService = createNeuralPersonaLearningApplicationCommandService({
  ...normal, now: () => NOW,
});
const applied = await normalService.apply(applyCommand('role-normal'));
assert.equal(applied.status, 'ok');
if (applied.status !== 'ok') throw new Error('normal application failed');
assert.deepEqual(applied.receipt.deltas, {
  baseWeight: 0.008, confidence: 0.016, stability: 0.008,
});
assert.equal(applied.graphRecord.revision, 1);
assert.equal(applied.proposalRecord.proposals[0].status, 'applied');
const appliedNode = applied.graphRecord.graph.nodes[0];
assert.deepEqual(
  [appliedNode.baseWeight, appliedNode.confidence, appliedNode.stability],
  [0.608, 0.716, 0.808],
);
assert.equal(appliedNode.learningApplication?.proposalId, 'proposal:target');
assert.equal(appliedNode.learningApplication?.commandId, 'apply:role-normal');
assert.equal(applied.receipt.applicationCommandId, 'apply:role-normal');
assert.equal((await normalService.apply(applyCommand('role-normal'))).status, 'idempotent');
const normalGraph = await normal.graphRepository.load('role-normal');
const normalLedger = await normal.ledgerRepository.load('role-normal');
if (normalGraph.status === 'ok') assert.equal(normalGraph.record.revision, 1);
if (normalLedger.status === 'ok') assert.equal(normalLedger.record.revision, 1);

const protectedRepos = await setupAccepted(memory.storage, 'role-protected', true);
const protectedService = createNeuralPersonaLearningApplicationCommandService({
  ...protectedRepos, now: () => NOW,
});
assert.deepEqual(await protectedService.apply(applyCommand('role-protected')), {
  reason: 'learning-application-protected-confirmation-required', status: 'invalid',
});
assert.equal((await protectedService.apply(applyCommand('role-protected', true))).status, 'ok');

const stale = await setupAccepted(memory.storage, 'role-stale');
assert.equal((await stale.ledgerRepository.append({
  event: feedback('role-stale', 'event:new'), expectedRevision: 1,
  nodeId: 'node:target', roleId: 'role-stale',
})).status, 'ok');
const staleService = createNeuralPersonaLearningApplicationCommandService({
  ...stale, now: () => NOW,
});
assert.deepEqual(await staleService.apply({
  ...applyCommand('role-stale'), expectedLedgerRevision: 2,
}), { reason: 'learning-application-source-stale', status: 'invalid' });

const recovery = await setupAccepted(memory.storage, 'role-recovery');
let applicationTransactions = 0;
const failingRepository: NeuralPersonaLearningProposalRepository = {
  initialize: (roleId) => recovery.proposalRepository.initialize(roleId),
  load: (roleId) => recovery.proposalRepository.load(roleId),
  rollback: (roleId, snapshotId) => recovery.proposalRepository.rollback(roleId, snapshotId),
  transact: async (input) => {
    applicationTransactions += 1;
    if (applicationTransactions === 2) {
      const loaded = await recovery.proposalRepository.load(input.roleId);
      return { actualRevision: loaded.status === 'ok' ? loaded.record.revision : null,
        status: 'conflict' };
    }
    return recovery.proposalRepository.transact(input);
  },
};
const failingService = createNeuralPersonaLearningApplicationCommandService({
  graphRepository: recovery.graphRepository, ledgerRepository: recovery.ledgerRepository,
  now: () => NOW, proposalRepository: failingRepository,
});
const interrupted = await failingService.apply(applyCommand('role-recovery'));
assert.equal(interrupted.status, 'conflict');
const interruptedGraph = await recovery.graphRepository.load('role-recovery');
const interruptedProposal = await recovery.proposalRepository.load('role-recovery');
if (interruptedGraph.status === 'ok') assert.equal(interruptedGraph.record.revision, 1);
if (interruptedProposal.status === 'ok') {
  assert.equal(interruptedProposal.record.proposals[0].status, 'applying');
}
const recoveryService = createNeuralPersonaLearningApplicationCommandService({
  ...recovery, now: () => NOW,
});
const recovered = await recoveryService.apply(applyCommand('role-recovery'));
assert.equal(recovered.status, 'ok');
const recoveredGraph = await recovery.graphRepository.load('role-recovery');
if (recoveredGraph.status === 'ok') assert.equal(recoveredGraph.record.revision, 1);

console.log('neural persona learning application smoke ok');
