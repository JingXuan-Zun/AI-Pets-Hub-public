import {
  DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL,
  DEFAULT_BUILTIN_WALKING_PET_MODEL_URL,
  DEFAULT_BROWSER_TTS_API_URL,
  DEFAULT_CONFIG,
  createDefaultCompanionPet,
  resolveModelUrlForRuntime,
} from './constants';
import { MAX_COMPANION_PET_COUNT } from './desktopPetSlotLimits';
import { normalizeFoodAppearances } from './foodAppearances';
import {
  normalizeModelCapabilities,
  normalizeModelRequestParams,
} from './modelProviderSettings';
import { normalizePetAudioAssets } from './petAudioAssets';
import { normalizeGroupTopicRepository } from './group-topic';
import { normalizeDirectedRelationshipRepository } from './character-relationship';
import {
  clampChatAvatarDisplaySize,
  clampChatBackgroundImageSize,
  clampChatBackgroundImageVisibility,
  clampChatFontSize,
  clampChatBubbleTransparency,
  clampChatFontWeight,
} from './chatAppearanceSettings';
import {
  type ActivityDisplayId,
  type CompanionPetConfig,
  type FolderItem,
  type ModelType,
  type PetConfig,
  type PetModelMotionAssetFormat,
  type PetModelMotionBinding,
  type PetModelMotionKey,
  type PetModelPreset,
} from './types';
import {
  normalizeVisionMode,
  normalizeVisionModelProvider,
} from './visionModelSettings';
import { normalizeLifeCompanionSettings } from './life-companion/lifeCompanionSettings';
import { normalizeGameCompanionObservationInterval } from './gameCompanionSettings';
import { normalizeGroupChatSpeedDelay } from './components/chat/group/groupChatSpeed';
import { migrateLegacyAgentRuntimeSettings } from './legacyPetConfigMigration';
import { clampSpeechPlaybackRate } from './voice/speechPlaybackRate';
import { normalizeLive2DRuntimeProfileConfig } from './pet-runtime/live2d/live2dRuntimeProfile';
import { normalizeExpressionReplySettings } from './expression/expressionSettings';
import {
  normalizeGroupMemoryRepository,
  stripLegacyGroupMemory,
} from './group-memory';

const VALID_PET_ACTIONS = new Set([
  'IDLE',
  'EATING',
  'HAPPY',
  'SAD',
  'SLEEPING',
  'WALKING',
  'RUNNING',
  'SWIMMING',
]);

const VALID_MODEL_TYPES = new Set<ModelType>(['2d', '3d', 'live2d']);

const MIN_NORMALIZED_PET_SCALE = 0.5;
const MAX_NORMALIZED_2D_PET_SCALE = 3;
const MAX_NORMALIZED_LIVE2D_PET_SCALE = 4;
const MAX_NORMALIZED_3D_PET_SCALE = 6;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const VIDEO_MODEL_URL_PATTERN = /\.(?:webm|mp4|m4v|mov)(?:[?#].*)?$/iu;
const GIF_MODEL_URL_PATTERN = /\.gif(?:[?#].*)?$/iu;

function normalizeModelType(value: unknown): ModelType {
  return typeof value === 'string' && VALID_MODEL_TYPES.has(value as ModelType)
    ? value as ModelType
    : '2d';
}

function resolveMaxNormalizedPetScale(modelType: PetConfig['modelType']) {
  if (modelType === '3d') {
    return MAX_NORMALIZED_3D_PET_SCALE;
  }
  return modelType === 'live2d'
    ? MAX_NORMALIZED_LIVE2D_PET_SCALE
    : MAX_NORMALIZED_2D_PET_SCALE;
}

function normalizePetScale(
  value: unknown,
  modelType: PetConfig['modelType'],
  fallback: number,
) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const fallbackValue = Number.isFinite(fallback) ? fallback : DEFAULT_CONFIG.scale;
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallbackValue;
  const clampedValue = Math.min(
    resolveMaxNormalizedPetScale(modelType),
    Math.max(MIN_NORMALIZED_PET_SCALE, safeValue),
  );

  return Number(clampedValue.toFixed(2));
}

function normalizeLocalTtsVoiceToneStability(
  value: unknown,
  fallbackEnabled: boolean,
) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallbackEnabled ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function normalizeNeuralPersonaProviderTimeout(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric)
    ? Math.min(30_000, Math.max(1_000, Math.round(numeric)))
    : DEFAULT_CONFIG.settings.neuralPersonaProviderTimeoutMs;
}

function normalizeLocalTtsRandomSeed(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return DEFAULT_CONFIG.settings.localTtsRandomSeed;
  }

  return String(value).replace(/\D+/g, '').slice(0, 10);
}

function normalizeHiddenBuiltinModelPresetIds(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_CONFIG.settings.hiddenBuiltinModelPresetIds;
  }

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}

function normalizeChatBracketOuterTextColor(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.settings.chatBracketOuterTextColor;
  }

  const normalizedValue = value.trim();
  return HEX_COLOR_PATTERN.test(normalizedValue)
    ? normalizedValue
    : DEFAULT_CONFIG.settings.chatBracketOuterTextColor;
}

function normalizeChatFontWeight(value: unknown) {
  return clampChatFontWeight(value, DEFAULT_CONFIG.settings.chatFontWeight);
}

function normalizeChatFontSize(value: unknown) {
  return clampChatFontSize(value, DEFAULT_CONFIG.settings.chatFontSize);
}

function normalizeGroupChatTurnDelayMs(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return normalizeGroupChatSpeedDelay(numeric);
}

function normalizeCustomWebSearchQueryParam(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.settings.customWebSearchQueryParam;
  }

  const normalizedValue = value.trim();
  return normalizedValue || DEFAULT_CONFIG.settings.customWebSearchQueryParam;
}

function normalizeChatAvatarUrl(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChatUserDisplayName(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.settings.chatUserDisplayName;
  }

  return value.trim();
}

function normalizeChatUserDisplayId(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return DEFAULT_CONFIG.settings.chatUserDisplayId;
  }

  return String(value).trim();
}

function normalizeBrowserSearchDebugPort(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CONFIG.settings.browserSearchDebugPort;
  }

  return Math.min(65535, Math.max(1024, Math.round(numericValue)));
}

function normalizeBrowserSearchUrlTemplate(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.settings.browserSearchUrlTemplate;
  }

  const normalizedValue = value.trim();
  if (normalizedValue === 'https://www.bing.com/search?q={query}') {
    return DEFAULT_CONFIG.settings.browserSearchUrlTemplate;
  }

  return normalizedValue || DEFAULT_CONFIG.settings.browserSearchUrlTemplate;
}

function normalizeBrowserSearchEngine(value: unknown) {
  return value === 'auto'
    || value === 'baidu'
    || value === 'google'
    || value === 'bing'
    || value === 'sogou'
    || value === 'custom'
    ? value
    : DEFAULT_CONFIG.settings.browserSearchEngine;
}

function normalizeTrimmedSettingString(
  value: unknown,
  fallback: string,
) {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeFolders(input: FolderItem[] | undefined | null) {
  if (!Array.isArray(input)) {
    return DEFAULT_CONFIG.folders.map((folder) => ({
      ...folder,
      position: { ...folder.position },
      appearanceId: folder.appearanceId ?? null,
    }));
  }

  return input
    .filter((folder) => folder && typeof folder.id === 'string')
    .map((folder, index) => {
      const fallbackFolder = DEFAULT_CONFIG.folders[index] ?? DEFAULT_CONFIG.folders[0];

      return {
        id: folder.id,
        name: typeof folder.name === 'string' && folder.name.trim().length > 0
          ? folder.name
          : (fallbackFolder?.name ?? `食物 ${index + 1}`),
        position: {
          x: Number.isFinite(folder.position?.x) ? folder.position.x : (fallbackFolder?.position.x ?? 0),
          y: Number.isFinite(folder.position?.y) ? folder.position.y : (fallbackFolder?.position.y ?? 0),
        },
        appearanceId: typeof folder.appearanceId === 'string' ? folder.appearanceId : null,
        interactionType: folder.interactionType === 'toy' ? ('toy' as const) : undefined,
      };
    });
}

function normalizePersonality(
  input: Partial<PetConfig['personality']> | undefined | null,
  fallback: PetConfig['personality'],
) {
  const beginDialogs = Array.isArray(input?.beginDialogs)
    ? input.beginDialogs
      .map((dialog) => ({
        user: typeof dialog?.user === 'string' ? dialog.user : '',
        assistant: typeof dialog?.assistant === 'string' ? dialog.assistant : '',
      }))
    : fallback.beginDialogs;

  return {
    ...fallback,
    ...(input ?? {}),
    traits: Array.isArray(input?.traits)
      ? input.traits.filter((trait): trait is string => typeof trait === 'string')
      : fallback.traits,
    greeting: typeof input?.greeting === 'string' && input.greeting.trim()
      ? input.greeting
      : (fallback.greeting ?? ''),
    dialogueCompletionPreset: typeof input?.dialogueCompletionPreset === 'string'
      ? input.dialogueCompletionPreset
      : (fallback.dialogueCompletionPreset ?? ''),
    beginDialogs,
    customErrorMessage: typeof input?.customErrorMessage === 'string'
      ? input.customErrorMessage
      : fallback.customErrorMessage,
    chatAvatarUrl: normalizeChatAvatarUrl(input?.chatAvatarUrl ?? fallback.chatAvatarUrl),
    userMemory: typeof input?.userMemory === 'string' ? input.userMemory : fallback.userMemory,
    chatHistoryMemory: typeof input?.chatHistoryMemory === 'string'
      ? input.chatHistoryMemory
      : fallback.chatHistoryMemory,
    knowledgeBase: typeof input?.knowledgeBase === 'string' ? input.knowledgeBase : fallback.knowledgeBase,
    webSearchEnabled: typeof input?.webSearchEnabled === 'boolean'
      ? input.webSearchEnabled
      : fallback.webSearchEnabled,
    webLearningEnabled: typeof input?.webLearningEnabled === 'boolean'
      ? input.webLearningEnabled
      : fallback.webLearningEnabled,
  };
}

const VALID_PET_MODEL_MOTION_KEYS = new Set<PetModelMotionKey>([
  'idle',
  'moving',
  'walking',
  'running',
  'swimming',
  'eating',
  'happy',
  'sad',
  'sleeping',
  'hover-head',
  'hover-body',
  'hover-hand-left',
  'hover-hand-right',
]);

const VALID_PET_MODEL_MOTION_FORMATS = new Set<PetModelMotionAssetFormat>([
  'exp3',
  'fbx',
  'glb',
  'gltf',
  'motion3',
  'vrma',
]);
const MAX_NORMALIZED_MOTION_DURATION_MS = 120000;

function normalizeMotionDurationMs(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return Math.min(MAX_NORMALIZED_MOTION_DURATION_MS, Math.max(1, Math.round(numericValue)));
}

function normalizeCustomModelMotionBindings(
  input: PetModelMotionBinding[] | undefined | null,
) {
  if (!Array.isArray(input)) {
    return [] as PetModelMotionBinding[];
  }

  return input
    .filter((binding) => (
      binding
      && typeof binding.id === 'string'
      && typeof binding.name === 'string'
      && typeof binding.sourceUrl === 'string'
      && typeof binding.motionKey === 'string'
      && typeof binding.format === 'string'
    ))
    .map((binding, index) => {
      const motionKey = VALID_PET_MODEL_MOTION_KEYS.has(binding.motionKey)
        ? binding.motionKey
        : 'idle';
      const format = VALID_PET_MODEL_MOTION_FORMATS.has(binding.format)
        ? binding.format
        : 'vrma';
      const rawKind = binding.kind === 'expression' || binding.kind === 'motion'
        ? binding.kind
        : 'motion';
      const kind = format === 'exp3'
        ? 'expression'
        : rawKind;
      const durationMs = normalizeMotionDurationMs(binding.durationMs);

      return {
        clipNames: Array.isArray(binding.clipNames)
          ? Array.from(new Set(
            binding.clipNames
              .filter((clipName): clipName is string => typeof clipName === 'string')
              .map((clipName) => clipName.trim())
              .filter(Boolean),
          ))
          : [],
        durationMs,
        format,
        id: binding.id.trim(),
        kind,
        motionKey,
        name: binding.name.trim() || `动作 ${index + 1}`,
        semanticAliases: Array.isArray(binding.semanticAliases)
          ? Array.from(new Set(
            binding.semanticAliases
              .filter((alias): alias is string => typeof alias === 'string')
              .map((alias) => alias.trim())
              .filter(Boolean),
          ))
          : [],
        semanticDescription: typeof binding.semanticDescription === 'string'
          ? binding.semanticDescription.trim()
          : '',
        semanticTags: Array.isArray(binding.semanticTags)
          ? Array.from(new Set(
            binding.semanticTags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim())
              .filter(Boolean),
          ))
          : [],
        sourceUrl: binding.sourceUrl.trim(),
      } satisfies PetModelMotionBinding;
    })
    .filter((binding) => binding.id.length > 0 && binding.sourceUrl.length > 0);
}

function normalizeCustomModelPresets(input: PetModelPreset[] | undefined | null) {
  if (!Array.isArray(input)) {
    return [] as PetModelPreset[];
  }

  return input
    .filter((preset) => preset && typeof preset.id === 'string' && typeof preset.url === 'string')
    .map((preset, index) => {
      const normalizedUrl = preset.url.trim();

      return {
        id: preset.id.trim(),
        name: typeof preset.name === 'string' && preset.name.trim()
          ? preset.name.trim()
          : `自定义模型 ${index + 1}`,
        type: VIDEO_MODEL_URL_PATTERN.test(normalizedUrl) || GIF_MODEL_URL_PATTERN.test(normalizedUrl) ? '2d' : normalizeModelType(preset.type),
        url: normalizedUrl,
        sequenceFrames: Array.isArray(preset.sequenceFrames)
          ? Array.from(new Set(
              preset.sequenceFrames
                .filter((frameUrl): frameUrl is string => typeof frameUrl === 'string')
                .map((frameUrl) => frameUrl.trim())
                .filter(Boolean),
            ))
          : undefined,
        sequenceAssetFolder: typeof preset.sequenceAssetFolder === 'string'
          && preset.sequenceAssetFolder.trim()
          ? preset.sequenceAssetFolder
              .trim()
              .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
              .replace(/[. ]+$/u, '')
              .slice(0, 80)
          : undefined,
        renderKind: GIF_MODEL_URL_PATTERN.test(normalizedUrl) || preset.renderKind === 'gif'
          ? 'gif'
          : VIDEO_MODEL_URL_PATTERN.test(normalizedUrl) || preset.renderKind === 'video' ? 'video' : undefined,
        randomVideoPlaybackEnabled: preset.randomVideoPlaybackEnabled === true,
        builtIn: false,
        videoItemBindings: Array.isArray(preset.videoItemBindings)
          ? preset.videoItemBindings.filter((binding) => (
              typeof binding?.appearanceId === 'string' && binding.appearanceId.trim().length > 0
              && typeof binding?.folderPath === 'string' && binding.folderPath.trim().length > 0
            )).map((binding) => ({
              appearanceId: binding.appearanceId.trim(),
              folderPath: binding.folderPath.trim(),
            }))
          : undefined,
        live2dRuntimeProfile: normalizeLive2DRuntimeProfileConfig(preset.live2dRuntimeProfile) ?? undefined,
        motionBindings: normalizeCustomModelMotionBindings(preset.motionBindings),
      } satisfies PetModelPreset;
    })
    .filter((preset) => preset.id.length > 0 && preset.url.length > 0);
}

function normalizeCompanionPets(
  input: CompanionPetConfig[] | undefined | null,
  customModelPresets: PetModelPreset[],
) {
  const rawCompanionPets = Array.isArray(input) ? input : DEFAULT_CONFIG.companionPets;
  const companionPetCount = Math.min(
    MAX_COMPANION_PET_COUNT,
    rawCompanionPets.length,
  );

  return Array.from({ length: companionPetCount }, (_, index) => {
    const fallbackPet = DEFAULT_CONFIG.companionPets[index]
      ?? createDefaultCompanionPet(index + 2, index);
    const nextPet = rawCompanionPets.find((pet) => pet?.id === fallbackPet.id)
      ?? rawCompanionPets[index]
      ?? fallbackPet;
    const nextModelType = VIDEO_MODEL_URL_PATTERN.test(typeof nextPet.modelUrl === 'string' ? nextPet.modelUrl.trim() : '')
      ? '2d'
      : normalizeModelType(nextPet.modelType);
    const normalizedModelUrl = resolveModelUrlForRuntime(nextPet.modelUrl, nextModelType, customModelPresets);
    const shouldUpgradeCompanionPet2Model = (
      fallbackPet.id === 'companion-pet-2'
      && normalizedModelUrl === DEFAULT_BUILTIN_WALKING_PET_MODEL_URL
    );

    return {
      ...fallbackPet,
      ...nextPet,
      id: typeof nextPet.id === 'string' && nextPet.id.trim()
        ? nextPet.id.trim()
        : fallbackPet.id,
      enabled: typeof nextPet.enabled === 'boolean' ? nextPet.enabled : fallbackPet.enabled,
      modelVisible: typeof nextPet.modelVisible === 'boolean' ? nextPet.modelVisible : fallbackPet.modelVisible,
      modelType: nextModelType,
      modelUrl: shouldUpgradeCompanionPet2Model
        ? DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL
        : normalizedModelUrl,
      personality: normalizePersonality(nextPet.personality, fallbackPet.personality),
      scale: normalizePetScale(nextPet.scale, nextModelType, fallbackPet.scale),
      position: {
        x: Number.isFinite(nextPet.position?.x) ? nextPet.position.x : fallbackPet.position.x,
        y: Number.isFinite(nextPet.position?.y) ? nextPet.position.y : fallbackPet.position.y,
      },
      stats: {
        ...fallbackPet.stats,
        ...(nextPet.stats ?? {}),
      },
      currentAction: VALID_PET_ACTIONS.has(nextPet.currentAction)
        ? nextPet.currentAction
        : fallbackPet.currentAction,
      autoMovementEnabled: typeof nextPet.autoMovementEnabled === 'boolean'
        ? nextPet.autoMovementEnabled
        : fallbackPet.autoMovementEnabled,
      pointerLookEnabled: typeof nextPet.pointerLookEnabled === 'boolean'
        ? nextPet.pointerLookEnabled
        : fallbackPet.pointerLookEnabled,
    } satisfies CompanionPetConfig;
  });
}

export function normalizePetConfig(input: Partial<PetConfig> | PetConfig | null | undefined): PetConfig {
  const nextConfig = input && typeof input === 'object' ? input : {};
  const rawModelUrl = typeof nextConfig.modelUrl === 'string' ? nextConfig.modelUrl.trim() : '';
  const normalizedModelType = VIDEO_MODEL_URL_PATTERN.test(rawModelUrl)
    ? '2d'
    : normalizeModelType(nextConfig.modelType);
  const normalizedCustomModelPresets = normalizeCustomModelPresets(nextConfig.customModelPresets);
  const rawSettings = (nextConfig.settings ?? {}) as Partial<PetConfig['settings']> & Record<string, unknown>;
  const {
    activeSettings: activeRawSettings,
    legacyAgentRuntimeMode,
  } = migrateLegacyAgentRuntimeSettings(rawSettings);
  void legacyAgentRuntimeMode;
  const legacyLocalTtsLockVoiceTone = typeof rawSettings.localTtsLockVoiceTone === 'boolean'
    ? rawSettings.localTtsLockVoiceTone
    : DEFAULT_CONFIG.settings.localTtsLockVoiceTone;
  const localTtsVoiceToneStability = normalizeLocalTtsVoiceToneStability(
    rawSettings.localTtsVoiceToneStability,
    legacyLocalTtsLockVoiceTone,
  );
  const localTtsRandomSeed = normalizeLocalTtsRandomSeed(rawSettings.localTtsRandomSeed);
  const legacyVoiceProvider = (() => {
    const nextValue = (rawSettings as Record<string, unknown>).voiceProvider;
    if (nextValue === 'custom') {
      return 'api';
    }

    return nextValue === 'local' || nextValue === 'api' || nextValue === 'browser'
      ? nextValue
      : undefined;
  })();
  const normalizedPersonality = normalizePersonality(nextConfig.personality, DEFAULT_CONFIG.personality);
  const normalizedCompanionPets = normalizeCompanionPets(
    nextConfig.companionPets,
    normalizedCustomModelPresets,
  );
  const legacyGroupMemories = [
    normalizedPersonality.chatHistoryMemory,
    ...normalizedCompanionPets.map((pet) => pet.personality.chatHistoryMemory),
  ];
  const groupMemoryRepository = normalizeGroupMemoryRepository(
    nextConfig.groupMemoryRepository,
    legacyGroupMemories,
  );
  const groupTopicRepository = normalizeGroupTopicRepository(nextConfig.groupTopicRepository);
  const directedRelationshipRepository = normalizeDirectedRelationshipRepository(
    nextConfig.directedRelationshipRepository,
  );

  return {
    ...DEFAULT_CONFIG,
    ...nextConfig,
    modelType: normalizedModelType,
    modelUrl: resolveModelUrlForRuntime(nextConfig.modelUrl, normalizedModelType, normalizedCustomModelPresets),
    customModelPresets: normalizedCustomModelPresets,
    directedRelationshipRepository,
    groupMemoryRepository,
    groupTopicRepository,
    personality: {
      ...normalizedPersonality,
      chatHistoryMemory: stripLegacyGroupMemory(normalizedPersonality.chatHistoryMemory),
    },
    companionPets: normalizedCompanionPets.map((pet) => ({
      ...pet,
      personality: {
        ...pet.personality,
        chatHistoryMemory: stripLegacyGroupMemory(pet.personality.chatHistoryMemory),
      },
    })),
    scale: normalizePetScale(nextConfig.scale, normalizedModelType, DEFAULT_CONFIG.scale),
    position: {
      x: Number.isFinite(nextConfig.position?.x) ? nextConfig.position.x : DEFAULT_CONFIG.position.x,
      y: Number.isFinite(nextConfig.position?.y) ? nextConfig.position.y : DEFAULT_CONFIG.position.y,
    },
    stats: {
      ...DEFAULT_CONFIG.stats,
      ...(nextConfig.stats ?? {}),
    },
    folders: normalizeFolders(nextConfig.folders),
    foodAppearances: normalizeFoodAppearances(nextConfig.foodAppearances),
    musicAssets: normalizePetAudioAssets(nextConfig.musicAssets),
    autoMovementEnabled: typeof nextConfig.autoMovementEnabled === 'boolean'
      ? nextConfig.autoMovementEnabled
      : DEFAULT_CONFIG.autoMovementEnabled,
    pointerLookEnabled: typeof nextConfig.pointerLookEnabled === 'boolean'
      ? nextConfig.pointerLookEnabled
      : DEFAULT_CONFIG.pointerLookEnabled,
    settings: {
      ...DEFAULT_CONFIG.settings,
      ...activeRawSettings,
      llmProvider: rawSettings.llmProvider === 'gemini' ? 'gemini' : 'openai',
      agentRuntimeProvider: rawSettings.agentRuntimeProvider === 'deepseek-harness'
        ? 'deepseek-harness'
        : 'native',
      deepseekHarnessPythonPath: normalizeTrimmedSettingString(rawSettings.deepseekHarnessPythonPath, ''),
      deepseekHarnessWorkspace: normalizeTrimmedSettingString(rawSettings.deepseekHarnessWorkspace, ''),
      deepseekHarnessHome: normalizeTrimmedSettingString(rawSettings.deepseekHarnessHome, ''),
      deepseekHarnessModel: normalizeTrimmedSettingString(rawSettings.deepseekHarnessModel, 'deepseek-v4-flash') || 'deepseek-v4-flash',
      deepseekHarnessBaseUrl: normalizeTrimmedSettingString(rawSettings.deepseekHarnessBaseUrl, ''),
      deepseekHarnessApiKey: normalizeTrimmedSettingString(rawSettings.deepseekHarnessApiKey, ''),
      avatar3dRuntimeBackend: rawSettings.avatar3dRuntimeBackend === 'unity'
        ? 'unity'
        : DEFAULT_CONFIG.settings.avatar3dRuntimeBackend,
      activityAreaLimitEnabled: typeof rawSettings.activityAreaLimitEnabled === 'boolean'
        ? rawSettings.activityAreaLimitEnabled
        : DEFAULT_CONFIG.settings.activityAreaLimitEnabled,
      activityBorderVisible: typeof rawSettings.activityBorderVisible === 'boolean'
        ? rawSettings.activityBorderVisible
        : DEFAULT_CONFIG.settings.activityBorderVisible,
      desktopIconInteractionEnabled: typeof rawSettings.desktopIconInteractionEnabled === 'boolean'
        ? rawSettings.desktopIconInteractionEnabled
        : DEFAULT_CONFIG.settings.desktopIconInteractionEnabled,
      desktopMouseInteractionEnabled: typeof rawSettings.desktopMouseInteractionEnabled === 'boolean'
        ? rawSettings.desktopMouseInteractionEnabled
        : DEFAULT_CONFIG.settings.desktopMouseInteractionEnabled,
      globalKnowledgeBase: typeof rawSettings.globalKnowledgeBase === 'string'
        ? rawSettings.globalKnowledgeBase
        : DEFAULT_CONFIG.settings.globalKnowledgeBase,
      geminiApiKey: normalizeTrimmedSettingString(
        rawSettings.geminiApiKey,
        DEFAULT_CONFIG.settings.geminiApiKey,
      ),
      customModelCapabilities: normalizeModelCapabilities(rawSettings.customModelCapabilities),
      customModelRequestParams: normalizeModelRequestParams(rawSettings.customModelRequestParams),
      neuralPersonaModelTagSuggestionsEnabled:
        rawSettings.neuralPersonaModelTagSuggestionsEnabled === true,
      neuralPersonaPrivateProviderDataConsent:
        rawSettings.neuralPersonaPrivateProviderDataConsent === true,
      neuralPersonaProviderDataEgressConsent:
        rawSettings.neuralPersonaProviderDataEgressConsent === true,
      neuralPersonaProviderTimeoutMs: normalizeNeuralPersonaProviderTimeout(
        rawSettings.neuralPersonaProviderTimeoutMs,
      ),
      neuralPersonaSemanticRetrievalEnabled:
        rawSettings.neuralPersonaSemanticRetrievalEnabled === true,
      visionMode: normalizeVisionMode(rawSettings.visionMode),
      visionModelProvider: normalizeVisionModelProvider(rawSettings.visionModelProvider),
      visionLlmModel: normalizeTrimmedSettingString(
        rawSettings.visionLlmModel,
        DEFAULT_CONFIG.settings.visionLlmModel,
      ) || DEFAULT_CONFIG.settings.visionLlmModel,
      visionCustomApiUrl: normalizeTrimmedSettingString(
        rawSettings.visionCustomApiUrl,
        DEFAULT_CONFIG.settings.visionCustomApiUrl,
      ),
      visionCustomApiKey: normalizeTrimmedSettingString(
        rawSettings.visionCustomApiKey,
        DEFAULT_CONFIG.settings.visionCustomApiKey,
      ),
      gameCompanionObservationIntervalMs: normalizeGameCompanionObservationInterval(
        rawSettings.gameCompanionObservationIntervalMs,
      ),
      gameCompanionGameName: normalizeTrimmedSettingString(rawSettings.gameCompanionGameName, ''),
      gameCompanionGameDescription: normalizeTrimmedSettingString(rawSettings.gameCompanionGameDescription, ''),
      visionCustomModelName: normalizeTrimmedSettingString(
        rawSettings.visionCustomModelName,
        DEFAULT_CONFIG.settings.visionCustomModelName,
      ) || DEFAULT_CONFIG.settings.visionCustomModelName,
      visionCustomModelRequestParams: normalizeModelRequestParams(rawSettings.visionCustomModelRequestParams),
      hiddenBuiltinModelPresetIds: normalizeHiddenBuiltinModelPresetIds(rawSettings.hiddenBuiltinModelPresetIds),
      chatAvatarsEnabled: typeof rawSettings.chatAvatarsEnabled === 'boolean'
        ? rawSettings.chatAvatarsEnabled
        : DEFAULT_CONFIG.settings.chatAvatarsEnabled,
      chatAvatarSize: clampChatAvatarDisplaySize(
        rawSettings.chatAvatarSize,
        DEFAULT_CONFIG.settings.chatAvatarSize,
      ),
      chatBackgroundImageEnabled: typeof rawSettings.chatBackgroundImageEnabled === 'boolean'
        ? rawSettings.chatBackgroundImageEnabled
        : DEFAULT_CONFIG.settings.chatBackgroundImageEnabled,
      chatBackgroundImageUrl: normalizeChatAvatarUrl(rawSettings.chatBackgroundImageUrl),
      chatBackgroundImageSize: clampChatBackgroundImageSize(
        rawSettings.chatBackgroundImageSize,
        DEFAULT_CONFIG.settings.chatBackgroundImageSize,
      ),
      chatBackgroundImageVisibility: clampChatBackgroundImageVisibility(
        rawSettings.chatBackgroundImageVisibility,
        DEFAULT_CONFIG.settings.chatBackgroundImageVisibility,
      ),
      chatUserDisplayName: normalizeChatUserDisplayName(rawSettings.chatUserDisplayName),
      chatUserDisplayId: normalizeChatUserDisplayId(rawSettings.chatUserDisplayId),
      chatUserAvatarUrl: normalizeChatAvatarUrl(rawSettings.chatUserAvatarUrl),
      webSearchEnabled: typeof rawSettings.webSearchEnabled === 'boolean'
        ? rawSettings.webSearchEnabled
        : (typeof nextConfig.personality?.webSearchEnabled === 'boolean'
          ? nextConfig.personality.webSearchEnabled
          : DEFAULT_CONFIG.settings.webSearchEnabled),
      webLearningEnabled: typeof rawSettings.webLearningEnabled === 'boolean'
        ? rawSettings.webLearningEnabled
        : (typeof nextConfig.personality?.webLearningEnabled === 'boolean'
          ? nextConfig.personality.webLearningEnabled
          : DEFAULT_CONFIG.settings.webLearningEnabled),
      webSearchProvider: rawSettings.webSearchProvider === 'browser'
        || rawSettings.webSearchProvider === 'custom'
        || rawSettings.webSearchProvider === 'tavily'
        || rawSettings.webSearchProvider === 'serper'
        || rawSettings.webSearchProvider === 'brave'
        || rawSettings.webSearchProvider === 'gemini'
        ? rawSettings.webSearchProvider
        : DEFAULT_CONFIG.settings.webSearchProvider,
      browserSearchBrowserPath: typeof rawSettings.browserSearchBrowserPath === 'string'
        ? rawSettings.browserSearchBrowserPath
        : DEFAULT_CONFIG.settings.browserSearchBrowserPath,
      browserSearchDebugPort: normalizeBrowserSearchDebugPort(rawSettings.browserSearchDebugPort),
      browserSearchEngine: normalizeBrowserSearchEngine(rawSettings.browserSearchEngine),
      browserSearchUrlTemplate: normalizeBrowserSearchUrlTemplate(rawSettings.browserSearchUrlTemplate),
      tavilyApiKey: typeof rawSettings.tavilyApiKey === 'string'
        ? rawSettings.tavilyApiKey
        : DEFAULT_CONFIG.settings.tavilyApiKey,
      serperApiKey: typeof rawSettings.serperApiKey === 'string'
        ? rawSettings.serperApiKey
        : DEFAULT_CONFIG.settings.serperApiKey,
      braveSearchApiKey: typeof rawSettings.braveSearchApiKey === 'string'
        ? rawSettings.braveSearchApiKey
        : DEFAULT_CONFIG.settings.braveSearchApiKey,
      customWebSearchUrl: typeof rawSettings.customWebSearchUrl === 'string'
        ? rawSettings.customWebSearchUrl
        : DEFAULT_CONFIG.settings.customWebSearchUrl,
      customWebSearchApiKey: typeof rawSettings.customWebSearchApiKey === 'string'
        ? rawSettings.customWebSearchApiKey
        : DEFAULT_CONFIG.settings.customWebSearchApiKey,
      customWebSearchMethod: rawSettings.customWebSearchMethod === 'post'
        ? 'post'
        : DEFAULT_CONFIG.settings.customWebSearchMethod,
      customWebSearchQueryParam: normalizeCustomWebSearchQueryParam(rawSettings.customWebSearchQueryParam),
      interactiveDialogueDisplayId: rawSettings.interactiveDialogueDisplayId === 'activity'
        ? 'activity'
        : rawSettings.interactiveDialogueDisplayId === 'primary'
          ? ('primary' satisfies ActivityDisplayId)
          : typeof rawSettings.interactiveDialogueDisplayId === 'string'
            && /^\d+$/.test(rawSettings.interactiveDialogueDisplayId.trim())
            ? (rawSettings.interactiveDialogueDisplayId.trim() as ActivityDisplayId)
            : DEFAULT_CONFIG.settings.interactiveDialogueDisplayId,
      lifeCompanion: normalizeLifeCompanionSettings(rawSettings.lifeCompanion),
      speechExpressivePunctuationEnabled: typeof rawSettings.speechExpressivePunctuationEnabled === 'boolean'
        ? rawSettings.speechExpressivePunctuationEnabled
        : DEFAULT_CONFIG.settings.speechExpressivePunctuationEnabled,
      localTtsVoiceToneStability,
      localTtsLockVoiceTone: localTtsVoiceToneStability > 0,
      localTtsRandomSeed,
      speechPlaybackRate: clampSpeechPlaybackRate(rawSettings.speechPlaybackRate),
      ttsProvider: rawSettings.ttsProvider ?? legacyVoiceProvider ?? DEFAULT_CONFIG.settings.ttsProvider,
      sttProvider: rawSettings.sttProvider ?? DEFAULT_CONFIG.settings.sttProvider,
      apiTtsProtocol: rawSettings.apiTtsProtocol === 'gemini' ? 'gemini' : DEFAULT_CONFIG.settings.apiTtsProtocol,
      apiSttProtocol: rawSettings.apiSttProtocol === 'gemini' ? 'gemini' : DEFAULT_CONFIG.settings.apiSttProtocol,
      browserTtsApiUrl: typeof rawSettings.browserTtsApiUrl === 'string'
        ? rawSettings.browserTtsApiUrl.trim() || DEFAULT_BROWSER_TTS_API_URL
        : DEFAULT_CONFIG.settings.browserTtsApiUrl,
      browserTtsApiKey: typeof rawSettings.browserTtsApiKey === 'string'
        ? rawSettings.browserTtsApiKey.trim()
        : DEFAULT_CONFIG.settings.browserTtsApiKey,
      browserTtsLanguage: typeof rawSettings.browserTtsLanguage === 'string'
        ? rawSettings.browserTtsLanguage.trim() || DEFAULT_CONFIG.settings.browserTtsLanguage
        : DEFAULT_CONFIG.settings.browserTtsLanguage,
      chatBracketOuterTextColor: normalizeChatBracketOuterTextColor(rawSettings.chatBracketOuterTextColor),
      chatFontWeight: normalizeChatFontWeight(rawSettings.chatFontWeight),
      chatFontSize: normalizeChatFontSize(rawSettings.chatFontSize),
      chatBubbleTransparency: clampChatBubbleTransparency(rawSettings.chatBubbleTransparency),
      chatBubbleEnabled: rawSettings.chatBubbleEnabled !== false,
      chatStreamingEnabled: rawSettings.chatStreamingEnabled !== false,
      expressionReply: normalizeExpressionReplySettings(rawSettings.expressionReply),
      groupChatTurnDelayMs: normalizeGroupChatTurnDelayMs(rawSettings.groupChatTurnDelayMs),
      groupParallelRoleGenerationEnabled: rawSettings.groupParallelRoleGenerationEnabled === true,
      groupAutomaticMemoryWriteEnabled: rawSettings.groupAutomaticMemoryWriteEnabled === true,
      groupAutomaticRelationshipEvolutionEnabled: rawSettings.groupAutomaticRelationshipEvolutionEnabled === true,
      groupAutomaticSubgroupEvolutionEnabled: rawSettings.groupAutomaticSubgroupEvolutionEnabled === true,
    },
  };
}
