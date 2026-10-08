import {
  buildNeuralContextContribution,
  createReadonlyNeuralPersonaGraphStore,
  type NeuralPersonaPreparedAbScenario,
} from '../../src/character-graph/neural-persona';
import {
  createNeuralPersonaChatPersonality,
  NEURAL_PERSONA_CHAT_INSTRUCTION_VERSION,
} from '../../src/services/neuralPersonaChatContextAssembly';
import { buildCharacterReplySystemInstruction } from '../../src/services/geminiPromptService';
import type { PetConfig, PetPersonality } from '../../src/types';
import { NEURAL_PERSONA_PERSONALITY_SCENARIOS } from './neural-persona-personality-scenario-fixture';
import { NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS } from './neural-persona-response-quality-scenarios';

export const NEURAL_PERSONA_AB_PERSONA_VERSION = 'neural-persona-ab-persona.v1';

export const NEURAL_PERSONA_AB_CLASSIC_PERSONA: PetPersonality = {
  beginDialogs: [],
  chatAvatarUrl: '',
  chatHistoryMemory: '',
  customErrorMessage: '',
  greeting: '',
  knowledgeBase: '',
  name: '固定评测角色',
  systemInstruction: '你是一个温和、务实、尊重用户边界的桌面伙伴。直接回答问题，不编造经历。',
  traits: ['温和', '务实', '尊重边界'],
  userMemory: '',
  webLearningEnabled: false,
  webSearchEnabled: false,
};

function promptSettings(settings: PetConfig['settings']): PetConfig['settings'] {
  return {
    ...settings,
    globalKnowledgeBase: '',
    timeAwarenessEnabled: false,
    webLearningEnabled: false,
    webSearchEnabled: false,
  };
}

function prepareOne(
  scenarioId: string,
  settings: PetConfig['settings'],
): NeuralPersonaPreparedAbScenario {
  const structural = NEURAL_PERSONA_PERSONALITY_SCENARIOS.find(
    (item) => item.scenarioId === scenarioId,
  );
  const quality = NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS.find(
    (item) => item.scenarioId === scenarioId,
  );
  if (!structural || !quality) throw new Error(`missing A/B fixture: ${scenarioId}`);
  const graphStore = createReadonlyNeuralPersonaGraphStore(structural.graph, structural.config);
  if (!graphStore.valid || !graphStore.store) throw new Error(`invalid A/B graph: ${scenarioId}`);
  const built = buildNeuralContextContribution({
    config: structural.config,
    input: { ...structural.input, query: quality.retrievalQuery },
    store: graphStore.store,
  });
  const resolvedSettings = promptSettings(settings);
  return {
    classicSystemInstruction: buildCharacterReplySystemInstruction(
      NEURAL_PERSONA_AB_CLASSIC_PERSONA, resolvedSettings, [], quality.userPrompt,
    ),
    configVersion: structural.config.configVersion,
    graphVersion: structural.graph.graphVersion,
    instructionVersion: NEURAL_PERSONA_CHAT_INSTRUCTION_VERSION,
    neuralSystemInstruction: buildCharacterReplySystemInstruction(
      createNeuralPersonaChatPersonality(
        NEURAL_PERSONA_AB_CLASSIC_PERSONA, built.contribution, { isolateClassicMemory: true },
      ), resolvedSettings, [], quality.userPrompt,
    ),
    personaVersion: NEURAL_PERSONA_AB_PERSONA_VERSION,
    scenario: quality,
  };
}

export function prepareNeuralPersonaResponseQualityAb(
  settings: PetConfig['settings'],
) {
  return NEURAL_PERSONA_RESPONSE_QUALITY_SCENARIOS.map(
    (scenario) => prepareOne(scenario.scenarioId, settings),
  );
}
