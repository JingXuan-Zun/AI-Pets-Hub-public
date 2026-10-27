// The development assistant the characters hand coding work to (Claude Code, run headless).
// Only the project folders listed here can be worked on.

export type DevAgentWorkspace = {
  id: string;
  /** "动作游戏" — what the user and the characters call it. */
  name: string;
  path: string;
  /** Commands it may run here to check its work ("npm test"); anything else stays blocked. */
  allowedCommands: string[];
};

const MAX_ALLOWED_COMMANDS = 10;
// A command prefix only: no chaining, redirection, substitution or quotes (they would let one
// allowed command smuggle in another).
const ALLOWED_COMMAND_PATTERN = /^[\w .:/\\=@+,-]{1,120}$/u;

export function normalizeAllowedCommands(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n;；，、]+/u) : [];
  const seen = new Set<string>();
  return items
    .map((item) => (typeof item === 'string' ? item.trim().replace(/\s+/gu, ' ') : ''))
    .filter((item) => item && ALLOWED_COMMAND_PATTERN.test(item) && !seen.has(item) && seen.add(item))
    .slice(0, MAX_ALLOWED_COMMANDS);
}

export type DevAgentSettings = {
  enabled: boolean;
  /** The Claude account (signed in once) or another provider's Claude-compatible endpoint. */
  provider: 'claude-account' | 'compatible';
  /** Claude account only: '' = the account default. */
  claudeModel: '' | 'sonnet' | 'opus' | 'haiku';
  /** Compatible endpoint: a preset (DeepSeek…) or custom; empty fields fall back to the preset. The key is the top-level secret `devAgentApiKey`. */
  compatiblePreset: 'deepseek' | 'custom';
  compatibleBaseUrl: string;
  compatibleModel: string;
  compatibleFastModel: string;
  /** Optional: where claude.exe is; found automatically when empty. */
  executablePath: string;
  workspaces: DevAgentWorkspace[];
  timeoutMinutes: number;
};

export const DEFAULT_DEV_AGENT_SETTINGS: DevAgentSettings = {
  claudeModel: '',
  compatibleBaseUrl: '',
  compatibleFastModel: '',
  compatibleModel: '',
  compatiblePreset: 'deepseek',
  enabled: false,
  provider: 'claude-account',
  executablePath: '',
  timeoutMinutes: 15,
  workspaces: [],
};

const MAX_WORKSPACES = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeDevAgentSettings(value: unknown): DevAgentSettings {
  const raw = isRecord(value) ? value : {};
  const minutes = Number(raw.timeoutMinutes);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  return {
    claudeModel: raw.claudeModel === 'sonnet' || raw.claudeModel === 'opus' || raw.claudeModel === 'haiku' ? raw.claudeModel : '',
    compatibleBaseUrl: /^https?:\/\//iu.test(text(raw.compatibleBaseUrl)) ? text(raw.compatibleBaseUrl) : '',
    compatibleFastModel: text(raw.compatibleFastModel),
    compatibleModel: text(raw.compatibleModel),
    compatiblePreset: raw.compatiblePreset === 'custom' ? 'custom' : 'deepseek',
    enabled: raw.enabled === true,
    provider: raw.provider === 'compatible' ? 'compatible' : 'claude-account',
    executablePath: typeof raw.executablePath === 'string' ? raw.executablePath.trim() : '',
    timeoutMinutes: Number.isFinite(minutes) ? Math.min(60, Math.max(1, Math.round(minutes))) : DEFAULT_DEV_AGENT_SETTINGS.timeoutMinutes,
    workspaces: (Array.isArray(raw.workspaces) ? raw.workspaces : [])
      .filter(isRecord)
      .map((item, index) => ({
        allowedCommands: normalizeAllowedCommands(item.allowedCommands),
        id: typeof item.id === 'string' && item.id ? item.id : `workspace-${index + 1}`,
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 60) : '',
        path: typeof item.path === 'string' ? item.path.trim() : '',
      }))
      .filter((item) => item.name && item.path)
      .slice(0, MAX_WORKSPACES),
  };
}

/** The workspace a request names (by name, partly), or the only / first one. */
export function resolveDevAgentWorkspace(settings: DevAgentSettings, name: string) {
  const wanted = name.trim();
  if (!wanted) return settings.workspaces[0] ?? null;
  return settings.workspaces.find((item) => item.name === wanted)
    ?? settings.workspaces.find((item) => item.name.includes(wanted) || wanted.includes(item.name))
    ?? null;
}
