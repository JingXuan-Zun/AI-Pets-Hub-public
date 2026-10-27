import { normalizeOpenAICompatibleUrl, resolveModelRequestParams } from '../modelProviderSettings';
import { testOneBotConnection } from '../qq-bridge/oneBotClient';
import type { PetConfig } from '../types';
import { getLocalVoiceHealth, warmupLocalVoice } from '../voice/runtime';
import type { SelfCheckDeps } from './selfCheckTypes';

/** One tiny request with the saved model settings, like 设置 → 模型 → 测试连接. */
async function testModel(settings: PetConfig['settings']): Promise<{ ok: boolean; error?: string }> {
  try {
    if (settings.llmProvider === 'gemini') {
      const { getGeminiClient } = await import('../services/geminiClient');
      const client = await getGeminiClient(settings.geminiApiKey, settings.geminiApiUrl);
      const result = await client.models.generateContent({ contents: 'Reply PONG only.', model: settings.llmModel.trim() });
      return result.text ? { ok: true } : { error: '没有返回内容，请检查模型名称。', ok: false };
    }
    const { requestModelFetch } = await import('../services/modelTransport');
    const response = await requestModelFetch(normalizeOpenAICompatibleUrl(settings.customApiUrl.trim()), {
      body: JSON.stringify({
        ...resolveModelRequestParams(settings),
        max_tokens: 8,
        messages: [{ content: 'Reply PONG only.', role: 'user' }],
        model: settings.customModelName.trim(),
        stream: false,
      }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
    }, settings.customApiKey.trim());
    return response.ok ? { ok: true } : { error: `${response.status} ${response.statusText}`, ok: false };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false };
  }
}

async function testDevAgent(executablePath: string, env?: Record<string, string>) {
  const bridge = typeof window !== 'undefined' ? window.desktopPetShell?.devAgent : undefined;
  if (!bridge) return { error: '只能在桌面版里检查。', installed: false, loggedIn: false };
  const status = await bridge.status({ env, executablePath, probeLogin: true });
  return { error: status.error, installed: Boolean(status.installed), loggedIn: Boolean(status.loggedIn), version: status.version };
}

export function createSelfCheckDeps(config: PetConfig): SelfCheckDeps {
  return { config, getLocalVoiceHealth, testDevAgent, testModel, testOneBot: testOneBotConnection, warmupLocalVoice };
}
