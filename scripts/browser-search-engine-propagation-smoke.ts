import assert from 'node:assert/strict';
import { buildExternalWebSearchInstruction } from '../src/services/geminiService';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime';
import type { PetConfig, PetPersonality } from '../src/types';

const originalBrowserSearch = desktopPetShellRuntime.browserSearch;
let capturedSettings: Record<string, unknown> | null = null;

try {
  desktopPetShellRuntime.browserSearch = async (payload?: unknown) => {
    capturedSettings = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).settings as Record<string, unknown> | null
      : null;

    return {
      ok: true,
      browserLabel: 'Chrome',
      text: 'mock search result',
      url: 'https://example.com',
    };
  };

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
    memoryDepth: 8,
    customApiUrl: '',
    customApiKey: '',
    customModelName: '',
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

  await buildExternalWebSearchInstruction(
    '请帮我查一下今天的天气',
    personality,
    settings,
  );

  assert.ok(capturedSettings, 'browser search should receive settings payload');
  assert.equal(capturedSettings?.browserSearchEngine, 'google', 'browser search engine should be forwarded');
  assert.equal(capturedSettings?.browserSearchBrowserPath, settings.browserSearchBrowserPath);
  assert.equal(capturedSettings?.browserSearchDebugPort, settings.browserSearchDebugPort);
  assert.equal(capturedSettings?.browserSearchUrlTemplate, settings.browserSearchUrlTemplate);
} finally {
  desktopPetShellRuntime.browserSearch = originalBrowserSearch;
}

console.log('browser search engine propagation smoke ok');
