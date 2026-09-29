import {
  applyGeminiModelRequestParamsFromList,
  resolveModelRequestParamsFromList,
} from './modelProviderSettings';
import {
  type LlmProvider,
  type PetConfig,
  type VisionMode,
  type VisionModelProvider,
} from './types';

export type ResolvedVisionMode = 'dedicated-vision-model' | 'disabled' | 'inherit-brain';

export interface ResolvedVisionModelSettings {
  disabled: boolean;
  inherited: boolean;
  mode: ResolvedVisionMode;
  provider: LlmProvider | null;
  requestedMode: VisionMode;
}

export function normalizeVisionMode(value: unknown): VisionMode {
  return value === 'auto'
    || value === 'inherit-brain'
    || value === 'dedicated-vision-model'
    || value === 'disabled'
    ? value
    : 'auto';
}

export function normalizeVisionModelProvider(value: unknown): VisionModelProvider {
  return value === 'gemini' || value === 'openai' || value === 'inherit'
    ? value
    : 'inherit';
}

export function isDedicatedVisionModelProvider(value: VisionModelProvider | undefined) {
  return value === 'gemini' || value === 'openai';
}

export function resolveVisionModelSettings(settings: PetConfig['settings']): ResolvedVisionModelSettings {
  const requestedMode = normalizeVisionMode(settings.visionMode);

  if (requestedMode === 'disabled') {
    return {
      disabled: true,
      inherited: false,
      mode: 'disabled',
      provider: null,
      requestedMode,
    };
  }

  const configuredProvider = normalizeVisionModelProvider(settings.visionModelProvider);
  const hasDedicatedProvider = isDedicatedVisionModelProvider(configuredProvider);
  const shouldUseDedicated = requestedMode === 'dedicated-vision-model'
    || (requestedMode === 'auto' && hasDedicatedProvider);

  if (shouldUseDedicated) {
    return {
      disabled: false,
      inherited: false,
      mode: 'dedicated-vision-model',
      provider: hasDedicatedProvider ? configuredProvider : 'gemini',
      requestedMode,
    };
  }

  return {
    disabled: false,
    inherited: true,
    mode: 'inherit-brain',
    provider: settings.llmProvider === 'openai' ? 'openai' : 'gemini',
    requestedMode,
  };
}

export function resolveVisionModelRequestParams(settings: PetConfig['settings']) {
  return resolveModelRequestParamsFromList(
    resolveVisionModelSettings(settings).inherited
      ? settings.customModelRequestParams
      : settings.visionCustomModelRequestParams,
  );
}

export function applyGeminiVisionModelRequestParams(
  config: Record<string, unknown>,
  settings: PetConfig['settings'],
) {
  return applyGeminiModelRequestParamsFromList(
    config,
    resolveVisionModelSettings(settings).inherited
      ? settings.customModelRequestParams
      : settings.visionCustomModelRequestParams,
  );
}

export function resolveGeminiVisionModelName(settings: PetConfig['settings']) {
  const resolved = resolveVisionModelSettings(settings);
  if (!resolved.inherited && resolved.provider === 'gemini') {
    return settings.visionLlmModel?.trim() || settings.llmModel || 'gemini-1.5-flash';
  }

  return settings.llmModel || 'gemini-1.5-flash';
}

export function resolveOpenAICompatibleVisionModelSettings(settings: PetConfig['settings']) {
  const resolved = resolveVisionModelSettings(settings);

  return {
    apiKey: resolved.inherited ? settings.customApiKey : settings.visionCustomApiKey,
    apiUrl: resolved.inherited ? settings.customApiUrl : settings.visionCustomApiUrl,
    inherited: resolved.inherited,
    modelName: resolved.inherited ? settings.customModelName : settings.visionCustomModelName,
  };
}
