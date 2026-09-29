import assert from 'node:assert/strict';
import { mergePetConfigUpdateFromBase } from '../src/petConfigUpdateMerge';
import type { PetConfig, PetPersonality } from '../src/types';

const personality: PetPersonality = {
  name: 'Primary',
  traits: [],
  greeting: '',
  systemInstruction: '',
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: '',
  chatHistoryMemory: '',
  knowledgeBase: '',
  webSearchEnabled: false,
  webLearningEnabled: false,
};

const companionPersonality: PetPersonality = {
  ...personality,
  name: 'Companion',
};

function createConfig(): PetConfig {
  return {
    modelType: '2d',
    modelUrl: 'primary.png',
    customModelPresets: [],
    personality: { ...personality },
    companionPets: [{
      id: 'companion-pet-1',
      enabled: false,
      modelType: '2d',
      modelUrl: 'companion.png',
      personality: { ...companionPersonality },
      scale: 1,
      position: { x: 0, y: 0 },
      stats: { affection: 50, fatigue: 0, hunger: 20 },
      currentAction: 'IDLE',
      autoMovementEnabled: true,
    }],
    scale: 1,
    position: { x: 0, y: 0 },
    stats: { affection: 85, fatigue: 5, hunger: 20 },
    folders: [],
    foodAppearances: [],
    currentAction: 'WALKING',
    autoMovementEnabled: true,
    settings: {
      physicsEnabled: true,
      memoryDepth: 4096,
      engineType: 'Three.js / GLTF',
      llmProvider: 'gemini',
      llmModel: 'gemini-1.5-flash',
      customApiUrl: '',
      customApiKey: '',
      customModelName: '',
      customModelCapabilities: { image: false, reasoning: false, text: true, tools: false },
      customModelRequestParams: [],
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
      ttsProvider: 'browser',
      sttProvider: 'browser',
      apiTtsProtocol: 'openai',
      apiSttProtocol: 'openai',
      speechRecognitionLang: 'zh-CN',
      voiceName: '',
      customVoiceApiUrl: '',
      customVoiceApiKey: '',
      customVoiceModel: '',
      customSpeechApiUrl: '',
      customSpeechApiKey: '',
      customSpeechModel: '',
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
      activityBorderVisible: true,
      chatBracketOuterTextColor: '#0f766e',
    },
  };
}

function setCompanionEnabled(config: PetConfig, enabled: boolean): PetConfig {
  return {
    ...config,
    companionPets: config.companionPets.map((pet) => (
      pet.id === 'companion-pet-1' ? { ...pet, enabled } : pet
    )),
  };
}

function setPetAvatar(config: PetConfig, chatAvatarUrl: string): PetConfig {
  return {
    ...config,
    personality: {
      ...config.personality,
      chatAvatarUrl,
    },
    settings: {
      ...config.settings,
      chatAvatarsEnabled: true,
    },
  };
}

function setUserIdentity(config: PetConfig, avatarUrl: string): PetConfig {
  return {
    ...config,
    settings: {
      ...config.settings,
      chatAvatarsEnabled: true,
      chatUserAvatarUrl: avatarUrl,
      chatUserDisplayId: 'user-1',
      chatUserDisplayName: 'User',
    },
  };
}

const baseConfig = createConfig();
const currentConfig = setCompanionEnabled(baseConfig, true);

const externalAvatarUpdate = setPetAvatar(baseConfig, 'data:image/png;base64,pet-avatar');
const mergedPetAvatarConfig = mergePetConfigUpdateFromBase(baseConfig, externalAvatarUpdate, currentConfig);

assert.equal(
  mergedPetAvatarConfig.companionPets.find((pet) => pet.id === 'companion-pet-1')?.enabled,
  true,
  'pet avatar updates from an older external chat window must not disable a companion pet enabled in the main window',
);
assert.equal(
  mergedPetAvatarConfig.personality.chatAvatarUrl,
  'data:image/png;base64,pet-avatar',
  'pet avatar update should still be applied',
);

const externalUserAvatarUpdate = setUserIdentity(baseConfig, 'data:image/png;base64,user-avatar');
const mergedUserAvatarConfig = mergePetConfigUpdateFromBase(baseConfig, externalUserAvatarUpdate, currentConfig);

assert.equal(
  mergedUserAvatarConfig.companionPets.find((pet) => pet.id === 'companion-pet-1')?.enabled,
  true,
  'user avatar updates from an older external chat window must not disable a companion pet enabled in the main window',
);
assert.equal(
  mergedUserAvatarConfig.settings.chatUserAvatarUrl,
  'data:image/png;base64,user-avatar',
  'user avatar update should still be applied',
);
assert.equal(
  mergedUserAvatarConfig.settings.chatUserDisplayName,
  'User',
  'user display name update should still be applied',
);

const staleDisableUpdate = setCompanionEnabled(baseConfig, false);
const mergedNoOpDisableConfig = mergePetConfigUpdateFromBase(baseConfig, staleDisableUpdate, currentConfig);

assert.equal(
  mergedNoOpDisableConfig.companionPets.find((pet) => pet.id === 'companion-pet-1')?.enabled,
  true,
  'unchanged stale companion enabled values should not overwrite the current main-window value',
);

const explicitDisableUpdate = setCompanionEnabled(currentConfig, false);
const mergedExplicitDisableConfig = mergePetConfigUpdateFromBase(currentConfig, explicitDisableUpdate, currentConfig);

assert.equal(
  mergedExplicitDisableConfig.companionPets.find((pet) => pet.id === 'companion-pet-1')?.enabled,
  false,
  'explicit companion disable changes should still be applied',
);

console.log('external window config merge smoke ok');
