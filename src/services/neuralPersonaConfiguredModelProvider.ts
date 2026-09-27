import {
  createNeuralPersonaTextModelProviders,
  type NeuralPersonaProviderDataPolicy,
} from '../character-graph/neural-persona';
import type { PetConfig } from '../types';
import { getConfiguredCognitionResponse } from './geminiService';

export function resolveNeuralPersonaConfiguredModelIssue(
  settings: PetConfig['settings'],
) {
  if (!settings.customModelCapabilities.text) return 'neural-provider-text-capability-disabled';
  if (settings.llmProvider === 'openai') {
    if (!settings.customApiUrl.trim()) return 'neural-provider-api-url-missing';
    if (!settings.customModelName.trim()) return 'neural-provider-model-name-missing';
    return null;
  }
  return settings.llmModel.trim() ? null : 'neural-provider-model-name-missing';
}

export function createNeuralPersonaConfiguredModelProviders(options: {
  dataEgressConsent: boolean;
  settings: PetConfig['settings'];
  timeoutMs: number;
}) {
  const availabilityIssue = resolveNeuralPersonaConfiguredModelIssue(options.settings);
  return createNeuralPersonaTextModelProviders({
    availabilityIssue: availabilityIssue ?? undefined,
    dataEgressConsent: options.dataEgressConsent,
    execute: ({ signal, systemInstruction, text, timeoutMs }) => (
      getConfiguredCognitionResponse(text, systemInstruction, options.settings, {
        signal, task: 'understanding', timeoutMs,
      })
    ),
    providerId: `configured-model.${options.settings.llmProvider}`,
    timeoutMs: options.timeoutMs,
  });
}

export function createNeuralPersonaConfiguredModelDataPolicy(
  privateDataConsent: boolean,
): NeuralPersonaProviderDataPolicy {
  return {
    allowedScopes: privateDataConsent
      ? ['runtime', 'world', 'private']
      : ['runtime', 'world'],
  };
}
