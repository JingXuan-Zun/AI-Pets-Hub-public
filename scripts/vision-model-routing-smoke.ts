import assert from 'node:assert/strict';
import { summarizeAgentVisualSnapshot } from '../src/services/geminiService.ts';
import {
  normalizeVisionMode,
  resolveOpenAICompatibleVisionModelSettings,
  resolveVisionModelSettings,
} from '../src/visionModelSettings.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function createSettings(updates: Partial<PetConfig['settings']> = {}) {
  return {
    customApiKey: '',
    customApiUrl: '',
    customModelCapabilities: {
      image: false,
      reasoning: false,
      text: true,
      tools: false,
    },
    customModelName: 'chat-model',
    customModelRequestParams: [],
    llmModel: 'gemini-1.5-flash',
    llmProvider: 'gemini',
    visionCustomApiKey: '',
    visionCustomApiUrl: '',
    visionCustomModelName: 'vision-model',
    visionCustomModelRequestParams: [],
    visionLlmModel: 'gemini-1.5-flash',
    visionMode: 'auto',
    visionModelProvider: 'inherit',
    ...updates,
  } as PetConfig['settings'];
}

assert.equal(normalizeVisionMode('auto'), 'auto');
assert.equal(normalizeVisionMode('inherit-brain'), 'inherit-brain');
assert.equal(normalizeVisionMode('dedicated-vision-model'), 'dedicated-vision-model');
assert.equal(normalizeVisionMode('disabled'), 'disabled');
assert.equal(normalizeVisionMode('unknown'), 'auto');

const defaultRoute = resolveVisionModelSettings(createSettings());
assert.equal(defaultRoute.requestedMode, 'auto');
assert.equal(defaultRoute.mode, 'inherit-brain');
assert.equal(defaultRoute.inherited, true);
assert.equal(defaultRoute.provider, 'gemini');
assert.equal(defaultRoute.disabled, false);

const autoDedicatedRoute = resolveVisionModelSettings(createSettings({
  visionModelProvider: 'openai',
}));
assert.equal(autoDedicatedRoute.requestedMode, 'auto');
assert.equal(autoDedicatedRoute.mode, 'dedicated-vision-model');
assert.equal(autoDedicatedRoute.inherited, false);
assert.equal(autoDedicatedRoute.provider, 'openai');

const forcedInheritedRoute = resolveVisionModelSettings(createSettings({
  llmProvider: 'openai',
  visionMode: 'inherit-brain',
  visionModelProvider: 'gemini',
}));
assert.equal(forcedInheritedRoute.mode, 'inherit-brain');
assert.equal(forcedInheritedRoute.inherited, true);
assert.equal(forcedInheritedRoute.provider, 'openai');

const forcedDedicatedFallbackRoute = resolveVisionModelSettings(createSettings({
  visionMode: 'dedicated-vision-model',
  visionModelProvider: 'inherit',
}));
assert.equal(forcedDedicatedFallbackRoute.mode, 'dedicated-vision-model');
assert.equal(forcedDedicatedFallbackRoute.inherited, false);
assert.equal(forcedDedicatedFallbackRoute.provider, 'gemini');

const disabledRoute = resolveVisionModelSettings(createSettings({
  visionMode: 'disabled',
  visionModelProvider: 'openai',
}));
assert.equal(disabledRoute.mode, 'disabled');
assert.equal(disabledRoute.disabled, true);
assert.equal(disabledRoute.provider, null);

const openAiVisionSettings = resolveOpenAICompatibleVisionModelSettings(createSettings({
  customApiKey: 'chat-key',
  customApiUrl: 'https://chat.example.com/v1',
  customModelName: 'chat-model',
  visionCustomApiKey: 'vision-key',
  visionCustomApiUrl: 'https://vision.example.com/v1',
  visionCustomModelName: 'vision-model',
  visionMode: 'dedicated-vision-model',
  visionModelProvider: 'openai',
}));
assert.equal(openAiVisionSettings.inherited, false);
assert.equal(openAiVisionSettings.apiKey, 'vision-key');
assert.equal(openAiVisionSettings.apiUrl, 'https://vision.example.com/v1');
assert.equal(openAiVisionSettings.modelName, 'vision-model');

await assert.rejects(
  () => summarizeAgentVisualSnapshot({
    imageDataUrl: 'data:image/png;base64,aGVsbG8=',
    settings: createSettings({ visionMode: 'disabled' }),
    sourceLabel: '[screen] disabled vision smoke',
  }),
  /Vision model is disabled/u,
);

const {
  typesSource,
  constantsSource,
  normalizationSource,
  serviceSource,
  visualSnapshotServiceSource,
  visionTabSource,
} = readProjectSources({
  typesSource: 'src/types.ts',
  constantsSource: 'src/constants.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
  serviceSource: 'src/services/geminiService.ts',
  visualSnapshotServiceSource: 'src/services/agentVisualSnapshotService.ts',
  visionTabSource: 'src/components/settings/SettingsVisionTab.tsx',
});

assert.match(typesSource, /VisionMode/u);
assert.match(constantsSource, /visionMode: 'auto'/u);
assert.match(normalizationSource, /normalizeVisionMode/u);
assert.match(serviceSource, /summarizeAgentVisualSnapshot/u);
assert.match(visualSnapshotServiceSource, /resolveVisionModelSettings/u);
assert.match(visualSnapshotServiceSource, /Vision model is disabled/u);
assert.match(visionTabSource, /visionMode/u);
assert.match(visionTabSource, /dedicated-vision-model/u);

console.log('vision model routing smoke ok');
