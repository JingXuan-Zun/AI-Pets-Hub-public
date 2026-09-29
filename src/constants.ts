import petCharacter26 from './assets/pet-character-26-optimized.png';
import walkFramePlaceholder from './assets/walk-01-placeholder.png';
import testSquare200 from './assets/test-square-200.svg';
import { DEFAULT_FOOD_APPEARANCES } from './foodAppearances';
import { DEFAULT_EXPRESSION_REPLY_SETTINGS } from './expression/expressionSettings';
import { DEFAULT_WALK_SEQUENCE_FRAMES, PET2_WALK_SEQUENCE_FRAMES } from './petAnimationSequences';
import { type CompanionPetConfig, type ModelType, type PetCollisionProfile, type PetConfig, type PetModelPreset } from './types';
import {
  DEFAULT_OPENAI_STT_MODEL,
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
} from './voice/apiProtocols';
import {
  DEFAULT_MODEL_CAPABILITIES,
  createDefaultModelRequestParams,
} from './modelProviderSettings';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from './life-companion/lifeCompanionSettings';
import { EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY } from './character-relationship';
import { DEFAULT_SPEECH_PLAYBACK_RATE } from './voice/speechPlaybackRate';
import {
  DEFAULT_COMPANION_PET_COUNT,
  MAX_COMPANION_PET_COUNT,
  MAX_DESKTOP_PET_COUNT,
} from './desktopPetSlotLimits';
import { EMPTY_GROUP_MEMORY_REPOSITORY } from './group-memory';
import { EMPTY_GROUP_TOPIC_REPOSITORY } from './group-topic';

const BUILTIN_MODEL_ALIASES = {
  walkingPet2d: 'builtin:pet-walk-2d',
  walkingPet2dPet2: 'builtin:pet-2-walk-2d',
  staticPet2d: 'builtin:pet-static-2d',
  testSquare2d: 'builtin:test-square-2d',
} as const;

const CUSTOM_MODEL_ALIAS_PREFIX = 'custom:pet-model:';
const BUILTIN_WALK_MODEL_URL_PATTERN = /(?:^|\/)walk-\d+(?:-[^/?#]+)?\.png(?:[?#].*)?$/i;
const BUILTIN_STATIC_PET_MODEL_URL_PATTERN = /(?:^|\/)pet-character-26-optimized(?:-[^/?#]+)?\.png(?:[?#].*)?$/i;
const BUILTIN_TEST_SQUARE_MODEL_URL_PATTERN = /(?:^|\/)test-square-200(?:-[^/?#]+)?\.svg(?:[?#].*)?$/i;

export const DEFAULT_BUILTIN_WALKING_PET_MODEL_URL = DEFAULT_WALK_SEQUENCE_FRAMES[0] ?? walkFramePlaceholder;
export const DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL = PET2_WALK_SEQUENCE_FRAMES[0] ?? DEFAULT_BUILTIN_WALKING_PET_MODEL_URL;
export const DEFAULT_BUILTIN_STATIC_PET_MODEL_URL = petCharacter26;
export const DEFAULT_BUILTIN_TEST_SQUARE_MODEL_URL = testSquare200;
export { DEFAULT_COMPANION_PET_COUNT, MAX_COMPANION_PET_COUNT, MAX_DESKTOP_PET_COUNT };
export const DEFAULT_BROWSER_TTS_API_URL = 'http://127.0.0.1:9880';
export const DEFAULT_BROWSER_TTS_VOICE = 'xiaoxiao';

const builtInPet2WalkFrameUrlSet = new Set(PET2_WALK_SEQUENCE_FRAMES);

const DEFAULT_2D_COLLISION_PROFILE: PetCollisionProfile = {
  leftRatio: 0.9,
  rightRatio: 0.9,
  topRatio: 0.84,
  bottomRatio: 0.92,
  leftInset: 2,
  rightInset: 2,
  topInset: 6,
  bottomInset: 2,
  minLeft: 18,
  minRight: 18,
  minTop: 20,
  minBottom: 16,
};

const DEFAULT_3D_COLLISION_PROFILE: PetCollisionProfile = {
  leftRatio: 0.88,
  rightRatio: 0.88,
  topRatio: 0.86,
  bottomRatio: 0.84,
  leftInset: 4,
  rightInset: 4,
  topInset: 8,
  bottomInset: 6,
  minLeft: 28,
  minRight: 28,
  minTop: 36,
  minBottom: 22,
};

const EXACT_COLLISION_PROFILE: PetCollisionProfile = {
  leftRatio: 1,
  rightRatio: 1,
  topRatio: 1,
  bottomRatio: 1,
  minLeft: 8,
  minRight: 8,
  minTop: 8,
  minBottom: 8,
};

const XIAOLING_2D_COLLISION_PROFILE: PetCollisionProfile = {
  leftRatio: 0.9,
  rightRatio: 0.9,
  topRatio: 0.68,
  bottomRatio: 0.94,
  leftInset: 2,
  rightInset: 2,
  topInset: 12,
  bottomInset: 1,
  minLeft: 18,
  minRight: 18,
  minTop: 16,
  minBottom: 16,
  topScaleSlope: 0.16,
  topScaleReferenceScale: 1,
  topScaleMinFactor: 0.78,
  topScaleMaxFactor: 1.12,
};

const DEFAULT_COMPANION_PET_POSITIONS = [
  { x: -240, y: -120 },
  { x: 240, y: -120 },
  { x: -320, y: 120 },
  { x: 320, y: 120 },
  { x: -120, y: 220 },
  { x: 120, y: 220 },
  { x: 0, y: -240 },
] as const;

export function buildCustomPetModelAlias(id: string) {
  return `${CUSTOM_MODEL_ALIAS_PREFIX}${id}`;
}

function parseCustomPetModelAlias(url: string) {
  return url.startsWith(CUSTOM_MODEL_ALIAS_PREFIX)
    ? url.slice(CUSTOM_MODEL_ALIAS_PREFIX.length)
    : null;
}

function findCustomPetModelPresetById(customModelPresets: PetModelPreset[], id: string) {
  return customModelPresets.find((preset) => preset.id === id) ?? null;
}

function findCustomPetModelPresetByUrl(customModelPresets: PetModelPreset[], url: string) {
  return customModelPresets.find((preset) => preset.url === url) ?? null;
}

function isBuiltInWalkingPetModelUrl(url: string) {
  return url === BUILTIN_MODEL_ALIASES.walkingPet2d
    || url === DEFAULT_BUILTIN_WALKING_PET_MODEL_URL
    || BUILTIN_WALK_MODEL_URL_PATTERN.test(url);
}

function isBuiltInPet2WalkingPetModelUrl(url: string) {
  return url === BUILTIN_MODEL_ALIASES.walkingPet2dPet2
    || url === DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL
    || builtInPet2WalkFrameUrlSet.has(url);
}

function isBuiltInStaticPetModelUrl(url: string) {
  return url === BUILTIN_MODEL_ALIASES.staticPet2d
    || url === DEFAULT_BUILTIN_STATIC_PET_MODEL_URL
    || BUILTIN_STATIC_PET_MODEL_URL_PATTERN.test(url);
}

function isBuiltInTestSquareModelUrl(url: string) {
  return url === BUILTIN_MODEL_ALIASES.testSquare2d
    || url === DEFAULT_BUILTIN_TEST_SQUARE_MODEL_URL
    || BUILTIN_TEST_SQUARE_MODEL_URL_PATTERN.test(url);
}

export function resolveModelUrlForRuntime(
  url: unknown,
  modelType: ModelType = '2d',
  customModelPresets: PetModelPreset[] = [],
) {
  const normalizedUrl = typeof url === 'string' ? url.trim() : '';

  if (normalizedUrl) {
    const customModelId = parseCustomPetModelAlias(normalizedUrl);
    if (customModelId) {
      const matchedCustomPreset = findCustomPetModelPresetById(customModelPresets, customModelId);
      if (matchedCustomPreset?.url) {
        return matchedCustomPreset.url;
      }
    }

    if (isBuiltInPet2WalkingPetModelUrl(normalizedUrl)) {
      return DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL;
    }

    if (isBuiltInWalkingPetModelUrl(normalizedUrl)) {
      return DEFAULT_BUILTIN_WALKING_PET_MODEL_URL;
    }

    if (isBuiltInStaticPetModelUrl(normalizedUrl)) {
      return DEFAULT_BUILTIN_STATIC_PET_MODEL_URL;
    }

    if (isBuiltInTestSquareModelUrl(normalizedUrl)) {
      return DEFAULT_BUILTIN_TEST_SQUARE_MODEL_URL;
    }

    return normalizedUrl;
  }

  return modelType === '2d'
    ? DEFAULT_BUILTIN_WALKING_PET_MODEL_URL
    : '';
}

export function resolveModelUrlForPersistence(
  url: unknown,
  customModelPresets: PetModelPreset[] = [],
) {
  const runtimeUrl = resolveModelUrlForRuntime(url, '2d', customModelPresets);

  if (isBuiltInPet2WalkingPetModelUrl(runtimeUrl)) {
    return BUILTIN_MODEL_ALIASES.walkingPet2dPet2;
  }

  if (isBuiltInWalkingPetModelUrl(runtimeUrl)) {
    return BUILTIN_MODEL_ALIASES.walkingPet2d;
  }

  if (isBuiltInStaticPetModelUrl(runtimeUrl)) {
    return BUILTIN_MODEL_ALIASES.staticPet2d;
  }

  if (isBuiltInTestSquareModelUrl(runtimeUrl)) {
    return BUILTIN_MODEL_ALIASES.testSquare2d;
  }

  const matchedCustomPreset = findCustomPetModelPresetByUrl(customModelPresets, runtimeUrl);
  if (matchedCustomPreset) {
    return buildCustomPetModelAlias(matchedCustomPreset.id);
  }

  return runtimeUrl;
}

function buildDefaultPetPersonality(name: string) {
  return {
    name,
    traits: ['安静', '灵动', '贪吃'],
    greeting: '',
    systemInstruction:
      `你现在扮演桌宠“${name}”。你性格安静、灵动、可爱，会用轻柔简洁的语气和用户交流。`
      + ' 你平时会在桌面上自由活动、散步、跑步或游动，也会观察周围的文件和环境。'
      + ' 你有一点贪吃，饿的时候会主动靠近桌面上的食物。'
      + ' 请始终保持桌宠角色感，回复简短自然，带一点陪伴感。',
    dialogueCompletionPreset: '',
    chatAvatarUrl: '',
    beginDialogs: [],
    customErrorMessage: '',
    userMemory: '',
    chatHistoryMemory: '',
    knowledgeBase: '',
    webSearchEnabled: false,
    webLearningEnabled: false,
  };
}

export const DEFAULT_PERSONALITY = buildDefaultPetPersonality('小玲');
export function createDefaultCompanionPet(slotNumber: number, positionIndex: number): CompanionPetConfig {
  const fallbackPosition = DEFAULT_COMPANION_PET_POSITIONS[positionIndex] ?? { x: 0, y: 0 };
  const modelUrl = slotNumber === 2
    ? DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL
    : DEFAULT_BUILTIN_WALKING_PET_MODEL_URL;

  return {
    id: `companion-pet-${slotNumber}`,
    enabled: false,
    modelVisible: true,
    modelType: '2d',
    modelUrl,
    personality: buildDefaultPetPersonality(`桌宠 ${slotNumber}`),
    scale: 1,
    position: {
      x: fallbackPosition.x,
      y: fallbackPosition.y,
    },
    stats: {
      affection: 80,
      hunger: 24,
      fatigue: 8,
    },
    currentAction: 'IDLE',
    autoMovementEnabled: true,
    pointerLookEnabled: true,
  };
}

export function createDefaultCompanionPets() {
  return Array.from({ length: DEFAULT_COMPANION_PET_COUNT }, (_, index) => (
    createDefaultCompanionPet(index + 2, index)
  ));
}

export const DEFAULT_CONFIG: PetConfig = {
  directedRelationshipRepository: EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  groupMemoryRepository: EMPTY_GROUP_MEMORY_REPOSITORY,
  groupTopicRepository: EMPTY_GROUP_TOPIC_REPOSITORY,
  modelType: '2d',
  modelUrl: DEFAULT_BUILTIN_WALKING_PET_MODEL_URL,
  customModelPresets: [],
  personality: DEFAULT_PERSONALITY,
  companionPets: createDefaultCompanionPets(),
  scale: 1,
  position: { x: 0, y: 0 },
  stats: {
    affection: 85,
    hunger: 20,
    fatigue: 5,
  },
  foodAppearances: DEFAULT_FOOD_APPEARANCES.map((appearance) => ({ ...appearance })),
  musicAssets: [],
  folders: [
    { id: 'f1', name: '工作文档', position: { x: -150, y: -100 }, appearanceId: DEFAULT_FOOD_APPEARANCES[0]?.id ?? null },
    { id: 'f2', name: '灵感收藏', position: { x: 150, y: 100 }, appearanceId: DEFAULT_FOOD_APPEARANCES[2]?.id ?? null },
    { id: 'f3', name: '零食库存', position: { x: 0, y: 150 }, appearanceId: DEFAULT_FOOD_APPEARANCES[4]?.id ?? null },
  ],
  currentAction: 'WALKING',
  autoMovementEnabled: true,
  pointerLookEnabled: true,
  settings: {
    physicsEnabled: true,
    avatar3dRuntimeBackend: 'three',
    memoryDepth: 8192,
    engineType: 'Three.js / GLTF',
    llmProvider: 'openai',
    agentRuntimeProvider: 'native',
    deepseekHarnessPythonPath: '',
    deepseekHarnessWorkspace: '',
    deepseekHarnessHome: '',
    deepseekHarnessModel: 'deepseek-v4-flash',
    deepseekHarnessBaseUrl: '',
    deepseekHarnessApiKey: '',
    llmModel: '',
    geminiApiKey: '',
    customApiUrl: '',
    customApiKey: '',
    customModelName: '',
    customModelCapabilities: { ...DEFAULT_MODEL_CAPABILITIES },
    customModelRequestParams: createDefaultModelRequestParams(),
    neuralPersonaModelTagSuggestionsEnabled: false,
    neuralPersonaPrivateProviderDataConsent: false,
    neuralPersonaProviderDataEgressConsent: false,
    neuralPersonaProviderTimeoutMs: 8_000,
    neuralPersonaSemanticRetrievalEnabled: false,
    visionMode: 'auto',
    visionModelProvider: 'inherit',
    visionLlmModel: '',
    visionCustomApiUrl: '',
    visionCustomApiKey: '',
    visionCustomModelName: '',
    visionCustomModelRequestParams: createDefaultModelRequestParams(),
    gameCompanionObservationIntervalMs: 8_000,
    gameCompanionGameName: '',
    gameCompanionGameDescription: '',
    globalKnowledgeBase: '',
    webSearchEnabled: false,
    webLearningEnabled: false,
    webSearchProvider: 'browser',
    browserSearchBrowserPath: '',
    browserSearchDebugPort: 9223,
    browserSearchEngine: 'auto',
    browserSearchUrlTemplate: '',
    tavilyApiKey: '',
    serperApiKey: '',
    braveSearchApiKey: '',
    customWebSearchUrl: '',
    customWebSearchApiKey: '',
    customWebSearchMethod: 'get',
    customWebSearchQueryParam: 'q',
    hiddenBuiltinModelPresetIds: [],
    timeAwarenessEnabled: true,
    voiceEnabled: true,
    voiceInputEnabled: true,
    autoSpeakResponses: true,
    speechSkipBracketContent: true,
    speechExpressivePunctuationEnabled: true,
    speechPlaybackRate: DEFAULT_SPEECH_PLAYBACK_RATE,
    ttsProvider: 'browser',
    sttProvider: 'browser',
    apiTtsProtocol: 'openai',
    apiSttProtocol: 'openai',
    browserTtsApiUrl: DEFAULT_BROWSER_TTS_API_URL,
    browserTtsApiKey: '',
    browserTtsLanguage: 'Auto',
    speechRecognitionLang: 'zh-CN',
    voiceName: DEFAULT_BROWSER_TTS_VOICE,
    customVoiceApiUrl: '',
    customVoiceApiKey: '',
    customVoiceModel: DEFAULT_OPENAI_TTS_MODEL,
    customSpeechApiUrl: '',
    customSpeechApiKey: '',
    customSpeechModel: DEFAULT_OPENAI_STT_MODEL,
    localTtsModelId: '',
    localTtsVoiceToneStability: 100,
    localTtsLockVoiceTone: true,
    localTtsRandomSeed: '',
    localSttModelId: '',
    localVoiceReferenceId: '',
    localVoiceRuntimePath: '',
    localVoiceReferenceText: '',
    activityAreaLimitEnabled: true,
    desktopIconInteractionEnabled: true,
    desktopMouseInteractionEnabled: true,
    chatAvatarsEnabled: true,
    chatAvatarSize: 36,
    chatBackgroundImageEnabled: true,
    chatBackgroundImageUrl: '',
    chatBackgroundImageSize: 100,
    chatBackgroundImageVisibility: 72,
    chatUserDisplayName: '',
    chatUserDisplayId: '',
    chatUserAvatarUrl: '',
    activityAreaScale: 100,
    activityAreaManual: true,
    activityAreaWidth: 2560,
    activityAreaHeight: 1440,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityDisplayId: 'primary',
    interactiveDialogueDisplayId: 'activity',
    lifeCompanion: { ...DEFAULT_LIFE_COMPANION_SETTINGS },
    activityBorderVisible: true,
    chatBracketOuterTextColor: '#0f766e',
    chatFontWeight: 400,
    chatFontSize: 14,
    chatBubbleTransparency: 0,
    chatBubbleEnabled: true,
    chatStreamingEnabled: true,
    groupChatTurnDelayMs: 6000,
    groupParallelRoleGenerationEnabled: false,
    groupAutomaticMemoryWriteEnabled: false,
    groupAutomaticRelationshipEvolutionEnabled: false,
    groupAutomaticSubgroupEvolutionEnabled: false,
    expressionReply: { ...DEFAULT_EXPRESSION_REPLY_SETTINGS },
  },
};

export const PRESET_MODELS: PetModelPreset[] = [
  {
    id: BUILTIN_MODEL_ALIASES.testSquare2d,
    name: 'Boundary Test (2D)',
    type: '2d',
    url: DEFAULT_BUILTIN_TEST_SQUARE_MODEL_URL,
    builtIn: true,
    collisionProfile: EXACT_COLLISION_PROFILE,
  },
  {
    id: BUILTIN_MODEL_ALIASES.walkingPet2d,
    name: '小玲 (2D 动画)',
    type: '2d',
    url: DEFAULT_BUILTIN_WALKING_PET_MODEL_URL,
    builtIn: true,
    collisionProfile: XIAOLING_2D_COLLISION_PROFILE,
  },
  {
    id: BUILTIN_MODEL_ALIASES.walkingPet2dPet2,
    name: '桌宠 2 (2D 序列帧)',
    type: '2d',
    url: DEFAULT_BUILTIN_PET2_WALKING_PET_MODEL_URL,
    builtIn: true,
    collisionProfile: XIAOLING_2D_COLLISION_PROFILE,
  },
  {
    id: BUILTIN_MODEL_ALIASES.staticPet2d,
    name: '小玲 (2D 静态)',
    type: '2d',
    url: DEFAULT_BUILTIN_STATIC_PET_MODEL_URL,
    builtIn: true,
    collisionProfile: XIAOLING_2D_COLLISION_PROFILE,
  },
  {
    id: 'builtin:duck-3d',
    name: '小黄鸭 (3D)',
    type: '3d',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    builtIn: true,
    collisionProfile: DEFAULT_3D_COLLISION_PROFILE,
  },
  {
    id: 'builtin:fox-3d',
    name: '狐狸 (3D)',
    type: '3d',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb',
    builtIn: true,
    collisionProfile: DEFAULT_3D_COLLISION_PROFILE,
  },
  {
    id: 'builtin:cat-2d',
    name: '猫咪 (2D)',
    type: '2d',
    url: 'https://picsum.photos/seed/cat/200/200',
    builtIn: true,
    collisionProfile: DEFAULT_2D_COLLISION_PROFILE,
  },
  {
    id: 'builtin:ghost-2d',
    name: '幽灵 (2D)',
    type: '2d',
    url: 'https://picsum.photos/seed/ghost/200/200',
    builtIn: true,
    collisionProfile: DEFAULT_2D_COLLISION_PROFILE,
  },
];

export function getDefaultPetCollisionProfile(modelType: ModelType): PetCollisionProfile {
  return modelType === '3d'
    ? DEFAULT_3D_COLLISION_PROFILE
    : DEFAULT_2D_COLLISION_PROFILE;
}

export function resolvePetCollisionProfile(
  modelType: ModelType,
  url: string,
  customModelPresets: PetModelPreset[] = [],
) {
  const runtimeUrl = resolveModelUrlForRuntime(url, modelType, customModelPresets);
  const matchedPreset = [
    ...customModelPresets,
    ...PRESET_MODELS,
  ].find((preset) => (
    preset.type === modelType
    && resolveModelUrlForRuntime(preset.url, preset.type, customModelPresets) === runtimeUrl
  ));

  return matchedPreset?.collisionProfile ?? getDefaultPetCollisionProfile(modelType);
}

export function getVisiblePetModelPresets(
  customModelPresets: PetModelPreset[] = [],
  hiddenBuiltinModelPresetIds: string[] = [],
) {
  const hiddenBuiltinIds = new Set(
    hiddenBuiltinModelPresetIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return [
    ...PRESET_MODELS.filter((preset) => !hiddenBuiltinIds.has(preset.id)),
    ...customModelPresets,
  ];
}
