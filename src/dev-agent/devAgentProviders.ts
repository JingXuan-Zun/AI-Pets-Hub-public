import type { DevAgentSettings } from './devAgentSettings';

// Where the development assistant gets its model: the user's Claude account (sign in once),
// or a Claude-compatible endpoint of another provider (its own API key, its own bill).
// Values from each provider's own Claude Code guide.

export type DevAgentCompatiblePreset = {
  id: 'deepseek' | 'custom';
  label: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  /** For quick side jobs (Claude Code's "haiku" slot and subagents). */
  fastModel: string;
  /** Where the provider hands out API keys; the settings page can open it. */
  keyPageUrl: string;
};

export const DEV_AGENT_COMPATIBLE_PRESETS: DevAgentCompatiblePreset[] = [
  {
    // https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code
    baseUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-flash[1m]',
    fastModel: 'deepseek-flash',
    id: 'deepseek',
    keyPageUrl: 'https://platform.deepseek.com/api_keys',
    label: 'DeepSeek',
    models: ['deepseek-flash[1m]', 'deepseek-v4-pro[1m]'],
  },
  { baseUrl: '', defaultModel: '', fastModel: '', id: 'custom', keyPageUrl: '', label: '其他（自己填）', models: [] },
];

export const CLAUDE_MODEL_CHOICES: Array<{ value: DevAgentSettings['claudeModel']; label: string }> = [
  { label: '账号默认', value: '' },
  { label: 'Sonnet（均衡）', value: 'sonnet' },
  { label: 'Opus（最强，额度用得快）', value: 'opus' },
  { label: 'Haiku（最快最省）', value: 'haiku' },
];

export function findCompatiblePreset(id: string) {
  return DEV_AGENT_COMPATIBLE_PRESETS.find((preset) => preset.id === id) ?? DEV_AGENT_COMPATIBLE_PRESETS[0]!;
}

/** What Claude Code is started with: a model flag and/or environment for another provider. */
export function resolveDevAgentLaunch(settings: DevAgentSettings, apiKey: string) {
  if (settings.provider !== 'compatible') {
    return { env: undefined, model: settings.claudeModel || undefined };
  }
  const preset = findCompatiblePreset(settings.compatiblePreset);
  const baseUrl = settings.compatibleBaseUrl || preset.baseUrl;
  const model = settings.compatibleModel || preset.defaultModel;
  const fastModel = settings.compatibleFastModel || preset.fastModel || model;
  return {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey.trim(),
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: fastModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_MODEL: model,
      CLAUDE_CODE_SUBAGENT_MODEL: fastModel,
    },
    model: undefined,
  };
}

/** Why the compatible endpoint cannot be used yet, or null. */
export function resolveCompatibleBlocker(settings: DevAgentSettings, apiKey: string) {
  if (settings.provider !== 'compatible') return null;
  const preset = findCompatiblePreset(settings.compatiblePreset);
  if (!(settings.compatibleBaseUrl || preset.baseUrl)) return '还没填接口地址。';
  if (!(settings.compatibleModel || preset.defaultModel)) return '还没填模型名。';
  if (!apiKey.trim()) return '还没填 API Key。';
  return null;
}
