import type {
  NeuralPersonaAbExecutor,
  NeuralPersonaAbScalar,
} from '../character-graph/neural-persona';
import { resolveModelRequestParams } from '../modelProviderSettings';
import type { PetConfig } from '../types';
import { getConfiguredCognitionResponse } from './geminiService';

const SAFE_PARAMETER_KEYS = new Set([
  'frequency_penalty', 'max_tokens', 'maxOutputTokens', 'presence_penalty',
  'seed', 'temperature', 'top_k', 'top_p', 'topK', 'topP',
]);

function parameterSummary(settings: PetConfig['settings']) {
  const resolved = resolveModelRequestParams(settings);
  return Object.fromEntries(Object.entries(resolved)
    .filter(([key, value]) => SAFE_PARAMETER_KEYS.has(key)
      && (value === null || ['boolean', 'number', 'string'].includes(typeof value)))) as (
    Record<string, NeuralPersonaAbScalar>
  );
}

function modelId(settings: PetConfig['settings']) {
  return settings.llmProvider === 'openai'
    ? settings.customModelName.trim() : settings.llmModel.trim();
}

export function createNeuralPersonaConfiguredModelAbExecutor(options: {
  settings: PetConfig['settings'];
  timeoutMs: number;
}): NeuralPersonaAbExecutor {
  return {
    execute: (input) => getConfiguredCognitionResponse(
      input.userPrompt,
      input.systemInstruction,
      options.settings,
      { signal: input.signal, task: 'conversation-reply', timeoutMs: options.timeoutMs },
    ),
    identity: {
      modelId: modelId(options.settings),
      parameterSummary: {
        ...parameterSummary(options.settings),
        requestTimeoutMs: options.timeoutMs,
      },
      providerId: `configured-model.${options.settings.llmProvider}`,
    },
  };
}
