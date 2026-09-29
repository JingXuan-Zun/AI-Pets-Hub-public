import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  countNeuralPersonaAbErrorBranches,
  applyNeuralPersonaAbHumanReviews,
  countNeuralPersonaAbChangedPromptBranches,
  evaluateNeuralPersonaAbResponse,
  NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION,
  retryNeuralPersonaResponseQualityAbErrors,
  rerunNeuralPersonaResponseQualityAbChangedPrompts,
  runNeuralPersonaResponseQualityAb,
} from '../src/character-graph/neural-persona';
import { createNeuralPersonaConfiguredModelAbExecutor } from '../src/services/neuralPersonaConfiguredModelAbExecutor';
import type { PetConfig } from '../src/types';
import { prepareNeuralPersonaResponseQualityAb } from './fixtures/neural-persona-response-quality-preparation';
import { NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS } from './fixtures/neural-persona-response-quality-scenarios';
import { loadNeuralPersonaAbConfig } from './neural-persona-response-quality-ab-runner';

const SOURCE_FILES = [
  'src/character-graph/neural-persona/neuralPersonaResponseQualityAbTypes.ts',
  'src/character-graph/neural-persona/neuralPersonaResponseQualityAbRunner.ts',
  'src/character-graph/neural-persona/neuralPersonaResponseQualityAbRetry.ts',
  'src/character-graph/neural-persona/neuralPersonaResponseQualityAbReview.ts',
  'src/character-graph/neural-persona/neuralPersonaResponseQualityAbChangedPrompt.ts',
  'src/services/neuralPersonaConfiguredModelAbExecutor.ts',
  'scripts/fixtures/neural-persona-response-quality-preparation.ts',
  'scripts/fixtures/neural-persona-response-quality-scenarios.ts',
  'scripts/neural-persona-response-quality-ab-runner.ts',
  'scripts/neural-persona-response-quality-review-runner.ts',
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

SOURCE_FILES.forEach(inspectSource);
const realRunnerSource = fs.readFileSync(path.resolve(
  'scripts/neural-persona-response-quality-ab-runner.ts',
), 'utf8');
assert.match(realRunnerSource, /--execute/u);
assert.match(realRunnerSource, /--confirm-requests/u);
assert.match(realRunnerSource, /EXPECTED_REQUESTS = 40/u);
assert.match(realRunnerSource, /--overwrite/u);
assert.match(realRunnerSource, /--retry-errors-from/u);
assert.match(realRunnerSource, /--rerun-changed-prompts-from/u);

assert.equal(NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS.length, 20);
assert.equal(new Set(NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS
  .map((scenario) => scenario.scenarioId)).size, 20);

const settings = {
  customApiKey: 'SECRET-MUST-NOT-ENTER-REPORT',
  customApiUrl: '',
  customModelCapabilities: { image: false, reasoning: false, text: true, tools: false },
  customModelName: '',
  customModelRequestParams: [
    { id: 'temperature', key: 'temperature', value: '0.2', valueType: 'number' as const },
    { id: 'unsafe', key: 'api_key', value: 'PARAM-SECRET', valueType: 'string' as const },
  ],
  globalKnowledgeBase: '',
  llmModel: 'fixed-smoke-model',
  llmProvider: 'gemini',
  memoryDepth: 4096,
  timeAwarenessEnabled: false,
  webLearningEnabled: false,
  webSearchEnabled: false,
  webSearchProvider: 'browser',
} as PetConfig['settings'];
const wrappedConfigPath = path.resolve('tmp-neural-persona-ab-config-smoke.json');
fs.writeFileSync(wrappedConfigPath, JSON.stringify({ config: { settings } }), 'utf8');
try {
  assert.equal(loadNeuralPersonaAbConfig(wrappedConfigPath).settings.llmModel,
    'fixed-smoke-model');
} finally {
  fs.unlinkSync(wrappedConfigPath);
}
const prepared = prepareNeuralPersonaResponseQualityAb(settings);
assert.equal(prepared.length, 20);
assert.ok(prepared.every((item) => item.classicSystemInstruction
  !== item.neuralSystemInstruction));

const configured = createNeuralPersonaConfiguredModelAbExecutor({ settings, timeoutMs: 10_000 });
assert.deepEqual(configured.identity, {
  modelId: 'fixed-smoke-model',
  parameterSummary: { requestTimeoutMs: 10_000, temperature: 0.2 },
  providerId: 'configured-model.gemini',
});
assert.doesNotMatch(JSON.stringify(configured.identity), /SECRET|PARAM-SECRET|api_key/u);

let calls = 0;
let now = 1_000;
const progress: number[] = [];
const report = await runNeuralPersonaResponseQualityAb({
  clock: () => { now += 5; return now; },
  executor: {
    execute: async (input) => {
      calls += 1;
      const scenario = NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS.find(
        (item) => item.scenarioId === input.scenarioId,
      );
      assert.ok(scenario);
      return input.mode === 'neural'
        ? scenario.neuralRequiredSignals.join('，') || '自然、克制地回答。'
        : '这是固定的经典人格回答。';
    },
    identity: configured.identity,
  },
  onProgress: (event) => progress.push(event.completedBranches),
  preparedScenarios: prepared,
  runId: 'response-quality-smoke',
});

assert.equal(calls, 40);
assert.deepEqual(progress, Array.from({ length: 40 }, (_, index) => index + 1));
assert.equal(report.schemaVersion, NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION);
assert.equal(report.scenarios.length, 20);
assert.deepEqual(report.scenarios[0].executionOrder, ['classic', 'neural']);
assert.deepEqual(report.scenarios[1].executionOrder, ['neural', 'classic']);
report.scenarios.forEach((result) => {
  assert.equal(result.humanReview.status, 'pending');
  assert.equal(result.classic.status, 'ok');
  assert.equal(result.neural.status, 'ok');
  assert.equal(result.neural.automaticCheck.passed, true);
  assert.match(result.classic.systemPromptSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.neural.systemPromptSha256, /^[a-f0-9]{64}$/u);
});
assert.doesNotMatch(JSON.stringify(report), /SECRET-MUST|PARAM-SECRET|api_key/u);

const synonymCheck = evaluateNeuralPersonaAbResponse(
  '先冷静一点，再听一听朋友的想法。', 'neural',
  NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS[0],
);
assert.equal(synonymCheck.passed, true);
const ordinaryNodeCheck = evaluateNeuralPersonaAbResponse(
  '在关键节点同步进度。', 'classic', NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS[0],
);
assert.deepEqual(ordinaryNodeCheck.internalTermHits, []);

const retryInput = structuredClone(report);
retryInput.scenarios[0].classic.status = 'error';
retryInput.scenarios[0].classic.output = '';
retryInput.scenarios[1].neural.status = 'error';
retryInput.scenarios[1].neural.output = '';
assert.equal(countNeuralPersonaAbErrorBranches(retryInput), 2);
let retryCalls = 0;
const retried = await retryNeuralPersonaResponseQualityAbErrors({
  executor: {
    ...configured,
    execute: async (input) => {
      retryCalls += 1;
      const scenario = NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS.find(
        (item) => item.scenarioId === input.scenarioId,
      )!;
      return input.mode === 'neural'
        ? scenario.neuralRequiredSignals.map((signal) => signal.split('|')[0]).join('，')
          || '自然回答。'
        : '经典重试回答。';
    },
  },
  preparedScenarios: prepared,
  report: retryInput,
  runId: 'response-quality-retry-smoke',
});
assert.equal(retryCalls, 2);
assert.equal(countNeuralPersonaAbErrorBranches(retried), 0);
assert.equal(retried.retryOfRunId, report.runId);
const reviewed = applyNeuralPersonaAbHumanReviews({
  decisions: retried.scenarios.map((scenario) => ({
    notes: 'fixed review', scenarioId: scenario.scenarioId, status: 'pass' as const,
  })),
  report: retried,
  reviewedAt: 2_000,
  reviewerId: 'smoke-reviewer',
});
assert.equal(reviewed.scenarios.every((scenario) => (
  scenario.humanReview.status === 'pass'
  && scenario.humanReview.reviewerId === 'smoke-reviewer'
)), true);
assert.throws(() => applyNeuralPersonaAbHumanReviews({
  decisions: retried.scenarios.map((scenario) => ({
    notes: 'invalid', scenarioId: scenario.scenarioId, status: 'pending' as never,
  })),
  report: retried,
  reviewedAt: 2_000,
  reviewerId: 'smoke-reviewer',
}), /invalid-human-review-status/u);
assert.throws(() => applyNeuralPersonaAbHumanReviews({
  decisions: [],
  report: { ...retried, schemaVersion: 'invalid' as never },
  reviewedAt: 2_000,
  reviewerId: 'smoke-reviewer',
}), /invalid-human-review-report-version/u);

const changedPrepared = prepared.map((item, index) => index === 0
  ? { ...item, neuralSystemInstruction: `${item.neuralSystemInstruction}\nchanged` }
  : item);
assert.equal(await countNeuralPersonaAbChangedPromptBranches({
  preparedScenarios: changedPrepared, report,
}), 1);
let changedCalls = 0;
const changedReport = await rerunNeuralPersonaResponseQualityAbChangedPrompts({
  executor: {
    ...configured,
    execute: async () => { changedCalls += 1; return '冷静地听一听。'; },
  },
  preparedScenarios: changedPrepared,
  report,
  runId: 'response-quality-changed-prompt-smoke',
});
assert.equal(changedCalls, 1);
assert.equal(changedReport.rerunReason, 'changed-request-input');
assert.equal(changedReport.scenarios[0].humanReview.status, 'pending');

const changedUserPrompt = prepared.map((item, index) => index === 0
  ? { ...item, scenario: { ...item.scenario, userPrompt: 'changed user prompt' } }
  : item);
assert.equal(await countNeuralPersonaAbChangedPromptBranches({
  model: configured.identity, preparedScenarios: changedUserPrompt, report,
}), 2);
assert.equal(await countNeuralPersonaAbChangedPromptBranches({
  model: { ...configured.identity, modelId: 'changed-model' },
  preparedScenarios: prepared,
  report,
}), 40);

const changedReviewCriteria = prepared.map((item, index) => index === 0
  ? {
    ...item,
    scenario: {
      ...item.scenario,
      humanReviewPrompt: `${item.scenario.humanReviewPrompt} changed`,
    },
  }
  : item);
const reviewCriteriaReport = await rerunNeuralPersonaResponseQualityAbChangedPrompts({
  executor: configured,
  preparedScenarios: changedReviewCriteria,
  report: reviewed,
  runId: 'response-quality-review-criteria-smoke',
});
assert.equal(reviewCriteriaReport.scenarios[0].humanReview.status, 'pending');
assert.equal(reviewCriteriaReport.scenarios[1].humanReview.status, 'pass');

console.log('neural persona real-response quality A/B harness smoke ok');
