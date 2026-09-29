import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  mapNeuralPersonaSourceBlockAnnotations,
  type NeuralPersonaSourceBlock,
} from '../src/character-graph/neural-persona';
import { classifyNeuralPersonaBlockBatchesWithRecovery } from '../src/services/neuralPersonaNodeGenerationBatchRecovery';

const sourceFiles = [
  'src/character-graph/neural-persona/neuralPersonaNodeGenerationTypes.ts',
  'src/services/neuralPersonaNodeGenerationBatchRecovery.ts',
  'src/services/neuralPersonaConfiguredNodeGenerationProvider.ts',
  'src/components/settings/useNeuralPersonaNodeGeneration.ts',
  'src/components/settings/NeuralPersonaNodeGenerationPanel.tsx',
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

sourceFiles.forEach(inspectSource);

function blocks(count: number): NeuralPersonaSourceBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    content: `原文块 ${index + 1}`,
    sourceId: `source-block-${index + 1}`,
  }));
}

function classification(batch: NeuralPersonaSourceBlock[]) {
  return {
    candidates: mapNeuralPersonaSourceBlockAnnotations(batch, []),
    fallbackCandidateCount: 0,
  };
}

let active = 0;
let maxActive = 0;
const progress: string[] = [];
const concurrent = await classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 2,
  blocks: blocks(7),
  classifyBatch: async (batch) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    return classification(batch);
  },
  concurrency: 3,
  onProgress: (state) => progress.push(`${state.completedBatches}/${state.totalBatches}`),
  recoverableReason: () => null,
  retryBatchSize: 1,
  retryRecoverable: false,
});
assert.equal(maxActive, 3);
assert.deepEqual(concurrent.candidates.map((item) => item.evidence),
  blocks(7).map((item) => item.content));
assert.deepEqual(progress, ['0/4', '1/4', '2/4', '3/4', '4/4']);

let failedCalls = 0;
const recovered = await classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 2,
  blocks: blocks(4),
  classifyBatch: async (batch) => {
    if (batch[0]?.sourceId === 'source-block-1') {
      failedCalls += 1;
      throw new Error('Cognition request timed out after 10ms.');
    }
    return classification(batch);
  },
  concurrency: 2,
  recoverableReason: () => 'persona-node-generation-timeout',
  retryBatchSize: 1,
  retryRecoverable: false,
});
assert.equal(failedCalls, 1);
assert.equal(recovered.fallbackCandidateCount, 2);
assert.equal(recovered.fallbackReasons['persona-node-generation-timeout'], 2);

const timedOut = await classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 2,
  blocks: blocks(4),
  classifyBatch: (_batch, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
  }),
  concurrency: 2,
  overallTimeoutMs: 20,
  recoverableReason: () => null,
  retryBatchSize: 1,
  retryRecoverable: false,
});
assert.equal(timedOut.fallbackCandidateCount, 4);
assert.equal(timedOut.fallbackReasons['persona-node-generation-overall-timeout'], 4);

const controller = new AbortController();
const cancelled = classifyNeuralPersonaBlockBatchesWithRecovery({
  batchSize: 2,
  blocks: blocks(4),
  classifyBatch: (_batch, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
  }),
  concurrency: 2,
  recoverableReason: () => null,
  retryBatchSize: 1,
  retryRecoverable: false,
  signal: controller.signal,
});
controller.abort();
await assert.rejects(cancelled, /cancelled|aborted/iu);

console.log('neural persona node generation concurrency smoke ok');
