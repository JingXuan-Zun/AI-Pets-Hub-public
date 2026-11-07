import type { PetConfig } from '../types';
import { requestModelFetch } from '../services/modelTransport';

// Setting up the chat model from the first-run guide: DeepSeek through the OpenAI-compatible
// provider, the same way an existing setup does it (https://api.deepseek.com/v1, deepseek-flash).

export const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';
export const DEEPSEEK_MODEL = 'deepseek-flash';

type Settings = PetConfig['settings'];

/** True when the chat model has what it needs to answer (any provider, not only DeepSeek). */
export function isChatModelConfigured(settings: Settings) {
  if (settings.llmProvider === 'gemini') return Boolean(settings.geminiApiKey?.trim());
  return Boolean(settings.customApiKey?.trim() && settings.customApiUrl?.trim() && settings.customModelName?.trim());
}

const KEY_PATTERN = /\bsk-[A-Za-z0-9]{16,}\b/u;

/** A DeepSeek-style key pasted into the chat ("sk-…"), or null. */
export function findApiKeyInText(text: string) {
  return text.match(KEY_PATTERN)?.[0] ?? null;
}

/** The message as it is kept in the chat history: the key itself never is. */
export function maskApiKeyInText(text: string) {
  return text.replace(new RegExp(KEY_PATTERN.source, 'gu'), (key) => `sk-…${key.slice(-4)}`);
}

export function withDeepSeekSettings(settings: Settings, apiKey: string): Settings {
  return {
    ...settings,
    llmProvider: 'openai',
    customApiKey: apiKey.trim(),
    customApiUrl: DEEPSEEK_API_URL,
    customModelName: DEEPSEEK_MODEL,
  };
}

export type ApiKeyCheck = 'ok' | 'invalid' | 'no-balance' | 'network' | 'other';

/** DeepSeek answers 401 for a wrong key and 402 for no balance. */
export function classifyApiKeyResponse(status: number): ApiKeyCheck {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403) return 'invalid';
  if (status === 402) return 'no-balance';
  return 'other';
}

/** One tiny request with the key: is it usable right now? */
export async function checkDeepSeekKey(apiKey: string, fetchImpl = requestModelFetch): Promise<ApiKeyCheck> {
  try {
    const response = await fetchImpl(`${DEEPSEEK_API_URL}/chat/completions`, {
      body: JSON.stringify({ max_tokens: 1, messages: [{ content: 'ping', role: 'user' }], model: DEEPSEEK_MODEL, stream: false }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
    }, apiKey.trim());
    return classifyApiKeyResponse(response.status);
  } catch {
    return 'network';
  }
}
