import assert from 'node:assert/strict';
import {
  buildExternalWebSearchInstruction,
  shouldUseExternalWebSearch,
} from '../src/services/geminiService';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime';
import type { PetConfig, PetPersonality } from '../src/types';

const originalBrowserSearch = desktopPetShellRuntime.browserSearch;
let browserSearchCallCount = 0;

const personality: PetPersonality = {
  name: '测试角色',
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

const settings: PetConfig['settings'] = {
  browserSearchBrowserPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  browserSearchDebugPort: 9223,
  browserSearchEngine: 'google',
  browserSearchUrlTemplate: '',
  globalKnowledgeBase: '',
  webSearchEnabled: true,
  webLearningEnabled: false,
  webSearchProvider: 'browser',
  llmProvider: 'gemini',
  llmModel: 'gemini-2.0-flash',
  engineType: '',
  physicsEnabled: false,
  avatar3dRuntimeBackend: 'three',
  memoryDepth: 8,
  customApiUrl: '',
  customApiKey: '',
  customModelName: '',
  customModelCapabilities: {
    streaming: true,
    systemInstruction: true,
    temperature: true,
    topP: true,
    topK: false,
    maxOutputTokens: true,
    stopSequences: true,
    presencePenalty: true,
    frequencyPenalty: true,
    responseMimeType: false,
  },
  customModelRequestParams: [],
  tavilyApiKey: '',
  serperApiKey: '',
  braveSearchApiKey: '',
  customWebSearchUrl: '',
  customWebSearchApiKey: '',
  customWebSearchMethod: 'get',
  customWebSearchQueryParam: 'q',
  hiddenBuiltinModelPresetIds: [],
  timeAwarenessEnabled: false,
  voiceEnabled: false,
  voiceInputEnabled: false,
  autoSpeakResponses: false,
  speechSkipBracketContent: false,
  speechPlaybackRate: 1,
  ttsProvider: 'browser',
  sttProvider: 'browser',
  apiTtsProtocol: 'openai',
  apiSttProtocol: 'openai',
  browserTtsApiUrl: 'http://127.0.0.1:9880',
  browserTtsApiKey: '',
  browserTtsLanguage: 'Auto',
  speechRecognitionLang: 'zh-CN',
  voiceName: '',
  customVoiceApiUrl: '',
  customVoiceApiKey: '',
  customVoiceModel: '',
  customSpeechApiUrl: '',
  customSpeechApiKey: '',
  customSpeechModel: '',
  localTtsModelId: '',
  localTtsVoiceToneStability: 0,
  localTtsLockVoiceTone: false,
  localTtsRandomSeed: '',
  localSttModelId: '',
  localVoiceReferenceId: '',
  localVoiceRuntimePath: '',
  localVoiceReferenceText: '',
  activityAreaLimitEnabled: false,
  desktopIconInteractionEnabled: false,
  desktopMouseInteractionEnabled: false,
  chatAvatarsEnabled: false,
  chatAvatarSize: 36,
  chatBackgroundImageEnabled: false,
  chatBackgroundImageUrl: '',
  chatBackgroundImageSize: 100,
  chatBackgroundImageVisibility: 40,
  chatUserDisplayName: '',
  activityAreaScale: 1,
  activityAreaManual: false,
  activityAreaWidth: 0,
  activityAreaHeight: 0,
  activityOffsetX: 0,
  activityOffsetY: 0,
  activityDisplayId: 'primary',
  interactiveDialogueDisplayId: 'activity',
  activityBorderVisible: false,
  chatBracketOuterTextColor: '#000000',
} as PetConfig['settings'];

try {
  desktopPetShellRuntime.browserSearch = async () => {
    browserSearchCallCount += 1;

    return {
      ok: true,
      browserLabel: 'Chrome',
      text: 'mock search result',
      url: 'https://example.com',
    };
  };

  assert.equal(shouldUseExternalWebSearch('随便聊两�?, 'allow'), false);
  assert.equal(shouldUseExternalWebSearch('今天天气不错', 'allow'), false);
  assert.equal(shouldUseExternalWebSearch('今天上海天气怎么样？', 'allow'), true);
  assert.equal(shouldUseExternalWebSearch('帮我搜一�?AI Desktop Pet', 'allow'), true);
  assert.equal(shouldUseExternalWebSearch('随便聊两�?, 'force'), true);

  const casualInstruction = await buildExternalWebSearchInstruction(
    '随便聊两�?,
    personality,
    settings,
  );
  assert.equal(casualInstruction, '');
  assert.equal(browserSearchCallCount, 0, 'casual chat should not open browser search');

  const forcedInstruction = await buildExternalWebSearchInstruction(
    '随便聊两�?,
    personality,
    settings,
    'force',
  );
  assert.match(forcedInstruction, /mock search result/);
  assert.equal(browserSearchCallCount, 1, 'force mode should open browser search');

  const blockedInstruction = await buildExternalWebSearchInstruction(
    '帮我查一下今天上海天�?,
    personality,
    settings,
    'block',
  );
  assert.match(blockedInstruction, /browser search disabled/);
  assert.equal(browserSearchCallCount, 1, 'block mode should not open browser search');

  const toolBlockedInstruction = await buildExternalWebSearchInstruction(
    '今天上海天气',
    personality,
    settings,
    'block',
    'tool',
  );
  assert.match(toolBlockedInstruction, /browser search disabled/);
  assert.equal(browserSearchCallCount, 1, 'block mode should also suppress tool-triggered browser search');
} finally {
  desktopPetShellRuntime.browserSearch = originalBrowserSearch;
}

console.log('browser search intent gating smoke ok');
