import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  buildNeuralContextContribution,
  createReadonlyNeuralPersonaGraphStore,
  type NeuralPersonaGraphRepository,
} from '../src/character-graph/neural-persona';
import { loadSingleChatNeuralContext } from '../src/components/chat/neuralPersonaSingleChatContext';
import {
  createNeuralPersonaChatPersonality,
  resolveChatInputPersonality,
} from '../src/services/neuralPersonaChatContextAssembly';
import { buildCharacterReplySystemInstruction } from '../src/services/geminiPromptService';
import type { PetConfig, PetPersonality } from '../src/types';
import { NEURAL_PERSONA_PERSONALITY_SCENARIOS } from './fixtures/neural-persona-personality-scenario-fixture';
import { NEURAL_PERSONA_RELATIONSHIP_SCENARIOS } from './fixtures/neural-persona-relationship-scenario-fixture';

const CLASSIC_MARKER = 'CLASSIC-PERSONA-MARKER-ONLY';
const CLASSIC_MEMORY = 'CLASSIC-MEMORY-MARKER-ONLY';
const CLASSIC_KNOWLEDGE = 'CLASSIC-KNOWLEDGE-MARKER-ONLY';
const personality: PetPersonality = {
  beginDialogs: [{ assistant: 'classic assistant example', user: 'classic user example' }],
  chatAvatarUrl: '',
  chatHistoryMemory: CLASSIC_MEMORY,
  customErrorMessage: '',
  greeting: 'classic greeting',
  knowledgeBase: CLASSIC_KNOWLEDGE,
  name: '固定测试角色',
  systemInstruction: CLASSIC_MARKER,
  traits: ['classic-trait'],
  userMemory: CLASSIC_MEMORY,
  webLearningEnabled: false,
  webSearchEnabled: false,
};
const settings = {
  globalKnowledgeBase: '', llmProvider: 'gemini', memoryDepth: 4096,
  timeAwarenessEnabled: false, webLearningEnabled: false,
  webSearchEnabled: false, webSearchProvider: 'browser',
} as PetConfig['settings'];

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

function buildScenarioContribution(index: number) {
  const scenario = NEURAL_PERSONA_PERSONALITY_SCENARIOS[index];
  const result = createReadonlyNeuralPersonaGraphStore(scenario.graph, scenario.config);
  assert.ok(result.valid && result.store);
  return {
    scenario,
    result: buildNeuralContextContribution({
      config: scenario.config, input: scenario.input, store: result.store,
    }),
  };
}

function verifyClassicBranch(query: string) {
  const direct = buildCharacterReplySystemInstruction(personality, settings, [], query);
  const resolved = resolveChatInputPersonality(personality, null);
  const throughSeam = buildCharacterReplySystemInstruction(resolved, settings, [], query);
  assert.equal(resolved, personality);
  assert.equal(throughSeam, direct, 'disabled Classic branch must remain byte-identical');
  assert.ok(direct.includes(CLASSIC_MARKER));
  assert.ok(!direct.includes('神经人格输入'));
  return direct;
}

function verifyNeuralBranch(index: number) {
  const { result, scenario } = buildScenarioContribution(index);
  const neuralPersonality = createNeuralPersonaChatPersonality(personality, result.contribution);
  const first = buildCharacterReplySystemInstruction(
    neuralPersonality, settings, [], scenario.input.query,
  );
  const second = buildCharacterReplySystemInstruction(
    neuralPersonality, settings, [], scenario.input.query,
  );
  assert.equal(second, first, `${scenario.scenarioId} neural prompt must be deterministic`);
  assert.ok(first.includes('神经人格局部影响（低于 Persona Anchor）'));
  assert.ok(first.includes(CLASSIC_MARKER));
  assert.ok(!first.includes(CLASSIC_MEMORY));
  assert.ok(!first.includes(CLASSIC_KNOWLEDGE));
  assert.deepEqual(neuralPersonality.traits, personality.traits);
  assert.equal(neuralPersonality.greeting, personality.greeting);
  assert.deepEqual(neuralPersonality.beginDialogs, personality.beginDialogs);
  assert.ok(!first.includes('private://never-expose-this-reference'));
  result.contribution.influences.forEach((influence) => assert.ok(first.includes(influence.summary)));
  scenario.forbiddenNodeIds.forEach((nodeId) => {
    const forbiddenSummary = scenario.graph.nodes.find((node) => node.nodeId === nodeId)?.influenceSummary;
    if (forbiddenSummary) assert.ok(!first.includes(forbiddenSummary));
  });
  assert.ok(first.includes('当前活跃人格锁定'));
  assert.ok(first.includes('自然兼顾每一条'));
  assert.ok(first.includes('强度限定是上限'));
  assert.ok(first.includes('不要根据人格影响补造过去经历'));
  if (result.contribution.influences.length) {
    assert.ok(first.includes('回答前最终检查'));
  } else {
    assert.ok(first.includes('没有额外局部影响，继续完整遵守主体人格'));
  }
}

async function verifyRuntimeGate() {
  const first = NEURAL_PERSONA_PERSONALITY_SCENARIOS[0];
  let loadCount = 0;
  let semanticCallCount = 0;
  const repository = {
    load: async () => {
      loadCount += 1;
      return { record: { graph: first.graph }, status: 'ok' } as never;
    },
  } as Pick<NeuralPersonaGraphRepository, 'load'>;
  const base = {
    includePrivate: true, now: first.input.now, promptText: first.input.query,
    repository, requestId: 'ab:runtime', roleId: first.input.roleId,
  };
  const semantic = {
    dataPolicy: { allowedScopes: ['runtime', 'world', 'private'] as const },
    provider: {
      providerId: 'single-chat.semantic-smoke',
      retrieve: async (request: Parameters<NonNullable<
        Parameters<typeof loadSingleChatNeuralContext>[0]['semantic']
      >['provider']['retrieve']>[0]) => {
        semanticCallCount += 1;
        return {
          matches: request.documents.slice(0, 1).map((document) => ({
            nodeId: document.nodeId, score: 0.95,
          })),
          status: 'ok' as const,
        };
      },
    },
  };
  assert.equal((await loadSingleChatNeuralContext({
    ...base, chatMode: 'single', featureEnabled: false, semantic,
  })).status, 'classic');
  assert.equal((await loadSingleChatNeuralContext({
    ...base, chatMode: 'group', featureEnabled: true, semantic,
  })).status, 'classic');
  assert.equal(loadCount, 0, 'disabled and group paths must not read the neural graph');
  assert.equal(semanticCallCount, 0, 'disabled and group paths must not call semantic provider');
  const neural = await loadSingleChatNeuralContext({
    ...base, chatMode: 'single', featureEnabled: true, semantic,
  });
  assert.equal(neural.status, 'neural');
  if (neural.status === 'neural') assert.equal(neural.semantic?.status, 'semantic');
  assert.equal(loadCount, 1);
  assert.equal(semanticCallCount, 1);

  const fallback = await loadSingleChatNeuralContext({
    ...base,
    chatMode: 'single',
    featureEnabled: true,
    semantic: {
      ...semantic,
      provider: {
        providerId: 'single-chat.semantic-failure-smoke',
        retrieve: async () => ({ reason: 'fixed-provider-failure', status: 'unavailable' }),
      },
    },
  });
  assert.equal(fallback.status, 'neural');
  if (fallback.status === 'neural') {
    assert.equal(fallback.semantic?.status, 'keyword-fallback');
    assert.equal(fallback.semantic?.reason, 'fixed-provider-failure');
    assert.ok(fallback.contribution.influences.length > 0);
  }
}

async function verifyFormalRelationshipAssembly() {
  const scenario = NEURAL_PERSONA_RELATIONSHIP_SCENARIOS.find((item) => item.scenarioId === 'associated-reverse');
  assert.ok(scenario);
  const repository = {
    load: async () => ({ record: { graph: scenario.graph }, status: 'ok' }) as never,
  } as Pick<NeuralPersonaGraphRepository, 'load'>;
  const result = await loadSingleChatNeuralContext({
    chatMode: 'single', featureEnabled: true, includePrivate: true,
    promptText: scenario.input.query, repository, requestId: 'relationship:formal',
    roleId: scenario.input.roleId,
  });
  assert.equal(result.status, 'neural');
  if (result.status === 'neural') {
    assert.ok(result.contribution.influences.some((item) => item.nodeId === 'reverse-a'));
    assert.ok(result.trace.selectedNodeIds.includes('reverse-a'));
  }
}

assert.equal(NEURAL_PERSONA_PERSONALITY_SCENARIOS.length, 20);
[
  'src/components/chat/neuralPersonaSingleChatContext.ts',
  'src/services/neuralPersonaChatContextAssembly.ts',
].forEach(inspectSource);
verifyClassicBranch('固定 A/B 输入');
NEURAL_PERSONA_PERSONALITY_SCENARIOS.forEach((_, index) => verifyNeuralBranch(index));
await verifyRuntimeGate();
await verifyFormalRelationshipAssembly();

console.log('neural persona single-chat Classic/Neural A/B smoke ok');
