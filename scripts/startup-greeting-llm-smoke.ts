import { strict as assert } from 'node:assert';
import {
  createStartupGreetingPrompt,
  getStartupGreetingLlmResponse,
} from '../src/life-companion/startupGreetingLlm.ts';
import type { ChatMessage, PetConfig, PetPersonality } from '../src/types.ts';
import { shouldUseExternalWebSearch } from '../src/services/geminiWebSearchService.ts';

const personality: PetPersonality = {
  name: '小玲',
  traits: ['温柔'],
  greeting: '这段旧的固定问候不应被直接使用',
  systemInstruction: '自然陪伴用户。',
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: '',
  chatHistoryMemory: '',
  knowledgeBase: '',
  webSearchEnabled: false,
  webLearningEnabled: false,
};
const settings = {} as PetConfig['settings'];
const history: ChatMessage[] = [{
  id: 'history-1',
  role: 'user',
  text: '昨天我们聊到要一起看星星。',
  chatMode: 'single',
  petId: 'primary',
  petName: personality.name,
}];

const prompt = createStartupGreetingPrompt(personality);
assert.match(prompt, /应用刚刚启动/u);
assert.match(prompt, /小玲/u);
assert.match(prompt, /自然地向用户进行一句日常问候/u);
assert.match(prompt, /不要机械复述人格中的固定 greeting/u);
assert.equal(
  shouldUseExternalWebSearch(prompt, 'allow'),
  true,
  'the generic search-intent heuristic recognizes this internal prompt, so startup requests must explicitly disable search',
);

let captured: {
  history: ChatMessage[];
  prompt: string;
  settings: PetConfig['settings'];
  browserSearchMode: string;
  signal: AbortSignal | null | undefined;
} | null = null;
const fakeRequest = async (
  requestHistory: ChatMessage[],
  requestPrompt: string,
  _requestPersonality: PetPersonality,
  requestSettings: PetConfig['settings'],
  browserSearchMode: 'allow' | 'block' | 'force',
  _attachments: never[],
  signal?: AbortSignal | null,
) => {
  captured = {
    history: requestHistory,
    prompt: requestPrompt,
    settings: requestSettings,
    browserSearchMode,
    signal,
  };
  return '  根据昨晚的星星，早上好呀！  ';
};

const response = await getStartupGreetingLlmResponse({
  history,
  personality,
  settings,
  request: fakeRequest,
});
assert.equal(response, '根据昨晚的星星，早上好呀！');
assert.deepEqual(captured?.history, history);
assert.equal(captured?.browserSearchMode, 'block');
assert.equal(captured?.prompt, prompt);
assert.notEqual(captured?.settings, settings);
assert.equal(captured?.settings.webSearchEnabled, false);
assert.equal(settings.webSearchEnabled, undefined, 'the caller settings must stay unchanged');

await assert.rejects(
  getStartupGreetingLlmResponse({
    history,
    personality,
    settings,
    request: async () => '   ',
  }),
  /空文本/u,
);
await assert.rejects(
  getStartupGreetingLlmResponse({
    history,
    personality,
    settings,
    request: async () => {
      throw new Error('provider unavailable');
    },
  }),
  /provider unavailable/u,
);
assert.equal(history.some((message) => message.role === 'user' && message.text === prompt), false);
assert.equal(history.length, 1);

console.log('startup greeting llm smoke passed');
