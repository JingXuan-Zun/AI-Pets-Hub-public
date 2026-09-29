import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  NEURAL_PERSONA_SCHEMA_VERSION,
  createNeuralPersonaFeedbackCommandService,
  createNeuralPersonaFeedbackInspection,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaReinforcementLedgerRepository,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaFeedbackKind,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from '../src/character-graph/neural-persona';
import { NeuralPersonaFeedbackPanel } from '../src/components/settings/NeuralPersonaFeedbackPanel';

const DAY = 86_400_000;
const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaFeedbackCommandTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackCommandService.ts',
  'src/character-graph/neural-persona/neuralPersonaFeedbackInspection.ts',
  'src/components/settings/NeuralPersonaFeedbackPanel.tsx',
  'src/components/settings/useNeuralPersonaFeedbackPanelState.ts',
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx',
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

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (key, expected, next) => {
      const current = records.get(key) ?? null;
      if (current !== expected) return false;
      records.set(key, next);
      return true;
    },
    read: async (key) => records.get(key) ?? null,
  };
}

function node(nodeId: string, overrides: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.8, createdAt: 1,
    currentActivation: 0, decayRate: 0.25, influenceSummary: `Summary ${nodeId}`,
    nodeId, ownerRoleId: 'role-a', plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private', stability: 0.7,
    status: 'active', tags: [], type: 'preference', updatedAt: 1, ...overrides,
  };
}

function command(
  commandId: string,
  nodeId: string,
  expectedLedgerRevision: number | null,
  kind: NeuralPersonaFeedbackKind = 'positive',
) {
  return {
    commandId,
    evidence: { sourceId: `user:${commandId}`, sourceType: 'user-explicit' as const,
      summary: `Explicit ${commandId}` },
    expectedGraphRevision: 0,
    expectedLedgerRevision,
    kind,
    magnitude: kind === 'positive' ? 0.8 : 0.5,
    nodeId,
    occurredAt: kind === 'positive' ? DAY : DAY * 2,
    roleId: 'role-a',
  };
}

sourceFiles.forEach(inspectSource);
const storage = memoryStorage();
const graphRepository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => DAY * 3, storage,
});
const ledgerRepository = createNeuralPersonaReinforcementLedgerRepository({
  now: () => DAY * 3, storage,
});
const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1, edges: [], graphVersion: 'neural-graph.r0',
  nodes: [
    node('node:a'),
    node('node:b', { decayRate: 0 }),
    node('node:deleted', { status: 'deleted' }),
    node('node:expired', {
      expiresAt: DAY * 2, type: 'temporary-cognitive-state',
    }),
  ],
  roleId: 'role-a', schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
};
assert.equal((await graphRepository.initialize(graph)).status, 'ok');
const service = createNeuralPersonaFeedbackCommandService({
  graphRepository, ledgerRepository, now: () => DAY * 3,
});

assert.deepEqual(await service.recordFeedback({
  ...command('feedback:invalid', 'node:a', null),
  evidence: { sourceId: 'user:invalid', sourceType: 'user-explicit', summary: '' },
}), { reason: 'feedback-event-text-invalid', status: 'invalid' });
assert.equal((await ledgerRepository.load('role-a')).status, 'missing');

const firstCommand = command('feedback:first', 'node:a', null);
const first = await service.recordFeedback(firstCommand);
assert.equal(first.status, 'ok');
if (first.status !== 'ok') throw new Error('first feedback command failed');
assert.equal(first.record.revision, 1);
assert.equal(first.record.events[0].observedGraphRevision, 0);
assert.equal((await graphRepository.load('role-a')).status, 'ok');
const unchangedGraph = await graphRepository.load('role-a');
if (unchangedGraph.status === 'ok') assert.equal(unchangedGraph.record.revision, 0);

const retry = await service.recordFeedback(firstCommand);
assert.equal(retry.status, 'idempotent');
if (retry.status === 'idempotent') assert.equal(retry.record.revision, 1);
const second = await service.recordFeedback(command(
  'feedback:second', 'node:b', 1, 'negative',
));
assert.equal(second.status, 'ok');
if (second.status !== 'ok') throw new Error('second feedback command failed');

assert.deepEqual(await service.recordFeedback(command(
  'feedback:missing', 'node:missing', 2,
)), { reason: 'feedback-node-missing', status: 'missing' });
assert.deepEqual(await service.recordFeedback(command(
  'feedback:deleted', 'node:deleted', 2,
)), { reason: 'feedback-node-not-active', status: 'invalid' });
assert.deepEqual(await service.recordFeedback(command(
  'feedback:expired', 'node:expired', 2,
)), { reason: 'feedback-node-expired', status: 'invalid' });

const inspection = createNeuralPersonaFeedbackInspection(
  graph, second.record, DAY * 3,
);
assert.deepEqual(inspection.nodes.map((item) => item.nodeId), ['node:a', 'node:b']);
assert.equal(inspection.nodes[0].projection.positiveScore, 0.4);
assert.equal(inspection.nodes[1].projection.negativeScore, 0.5);
assert.throws(() => createNeuralPersonaFeedbackInspection(
  { ...graph, roleId: 'role-b' }, second.record, DAY * 3,
), /feedback-inspection-role-mismatch/u);

const bumped = await graphRepository.transact({
  expectedRevision: 0, roleId: 'role-a',
  update: (current) => ({ ...current, graphVersion: 'neural-graph.r1' }),
});
assert.equal(bumped.status, 'ok');
assert.deepEqual(await service.recordFeedback(command(
  'feedback:stale-graph', 'node:a', 2,
)), { actualRevision: 1, conflictScope: 'graph', status: 'conflict' });

const roleBCommand = { ...command('feedback:role-b', 'node:a', null), roleId: 'role-b' };
assert.deepEqual(await service.recordFeedback(roleBCommand), {
  reason: 'graph-record-missing', status: 'missing',
});
assert.equal((await ledgerRepository.load('role-b')).status, 'missing');

const markup = renderToStaticMarkup(createElement(NeuralPersonaFeedbackPanel, {
  enabled: true,
  graphRecord: { graph, recordVersion: 1, recoverySnapshots: [], revision: 0,
    roleId: 'role-a', updatedAt: DAY * 3 },
  selectedNodeId: 'node:a',
}));
assert.match(markup, /显式反馈与强化账本/u);
assert.doesNotMatch(markup, /sourceRef/u);

console.log('neural persona feedback command smoke ok');
