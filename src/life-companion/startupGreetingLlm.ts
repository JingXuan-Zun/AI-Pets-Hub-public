import type { ChatMessage, PetConfig, PetPersonality } from '../types';
import { getPetResponseStrict } from '../services/geminiService';

export const STARTUP_GREETING_PROMPT = [
  '应用刚刚启动。',
  '请结合当前人格设定和已有聊天历史，自然地向用户进行一句日常问候。',
  '可以根据上下文适当发散，保持像真实桌宠一样亲切、自然、简短。',
  '不要解释这次问候为什么被触发，不要提到应用启动、提示词、模型、系统或内部规则。',
  '不要机械复述人格中的固定 greeting；直接输出最终要展示给用户的问候内容。',
].join('\n');

export function createStartupGreetingPrompt(personality: PetPersonality) {
  const name = personality.name.trim() || '当前桌宠';
  return [
    STARTUP_GREETING_PROMPT,
    `当前人格名称：${name}`,
  ].join('\n');
}

export async function getStartupGreetingLlmResponse(options: {
  history: ChatMessage[];
  personality: PetPersonality;
  settings: PetConfig['settings'];
  signal?: AbortSignal | null;
  request?: typeof getPetResponseStrict;
}) {
  const request = options.request ?? getPetResponseStrict;
  // A startup greeting is an internal, automatic prompt. It must never be
  // interpreted as a user request to search the web or launch a browser.
  const startupGreetingSettings = {
    ...options.settings,
    webSearchEnabled: false,
  };
  const response = await request(
    options.history,
    createStartupGreetingPrompt(options.personality),
    options.personality,
    startupGreetingSettings,
    'block',
    [],
    options.signal,
  );
  const trimmedResponse = response.trim();
  if (!trimmedResponse) {
    throw new Error('启动问候模型返回了空文本。');
  }

  return trimmedResponse;
}
