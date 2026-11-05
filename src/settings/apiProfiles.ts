import type { LlmProvider, ModelCapabilities, ModelRequestParam, PetConfig } from '../types';

// Saved model API profiles (“接口配置”): the chat model's provider, endpoint, model name and
// options, plus its key, kept side by side so one click (or a word to her) switches when one
// stops working. Keys are encrypted by the main process (electron/configCredentials.cjs); here
// a profile's key is only a reference, and switching copies that reference into the active key
// field — the main process accepts it only for that profile's own endpoint.

export interface ApiProfile {
  /** A reference (desktop-pet-credential:…) or, right after typing, the key itself. */
  apiKey: string;
  customApiUrl: string;
  customModelCapabilities?: ModelCapabilities;
  customModelName: string;
  customModelRequestParams?: ModelRequestParam[];
  geminiApiUrl: string;
  id: string;
  llmModel: string;
  llmProvider: LlmProvider;
  name: string;
  savedAt: number;
}

type Settings = PetConfig['settings'];

const CREDENTIAL_PREFIX = 'desktop-pet-credential:';
const MAX_PROFILES = 12;

export function profileKeyReference(id: string) {
  return `${CREDENTIAL_PREFIX}apiProfile:${id}`;
}

function text(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeApiProfiles(value: unknown): ApiProfile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object').map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
      customApiUrl: text(raw.customApiUrl),
      customModelCapabilities: raw.customModelCapabilities as ModelCapabilities | undefined,
      customModelName: text(raw.customModelName, 120),
      customModelRequestParams: Array.isArray(raw.customModelRequestParams) ? raw.customModelRequestParams as ModelRequestParam[] : undefined,
      geminiApiUrl: text(raw.geminiApiUrl),
      id: text(raw.id, 60),
      llmModel: text(raw.llmModel, 120),
      llmProvider: raw.llmProvider === 'gemini' ? 'gemini' as const : 'openai' as const,
      name: text(raw.name, 40) || '未命名',
      savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    };
  }).filter((profile) => profile.id).slice(0, MAX_PROFILES);
}

export function readApiProfiles(settings: Settings) {
  return normalizeApiProfiles((settings as Settings & { apiProfiles?: unknown }).apiProfiles);
}

function modelOf(settings: Pick<ApiProfile, 'customModelName' | 'llmModel' | 'llmProvider'>) {
  return settings.llmProvider === 'gemini' ? settings.llmModel : settings.customModelName;
}

function urlOf(settings: Pick<ApiProfile, 'customApiUrl' | 'geminiApiUrl' | 'llmProvider'>) {
  return settings.llmProvider === 'gemini' ? settings.geminiApiUrl : settings.customApiUrl;
}

/** The profile the chat is using now: same provider, endpoint and model. */
export function activeApiProfile(settings: Settings) {
  return readApiProfiles(settings).find((profile) => profile.llmProvider === settings.llmProvider
    && urlOf(profile).trim() === urlOf(settings).trim()
    && modelOf(profile).trim() === modelOf(settings).trim()) ?? null;
}

export function describeApiProfile(profile: ApiProfile) {
  let host = '';
  try {
    host = urlOf(profile) ? new URL(urlOf(profile)).host : '';
  } catch {
    host = '';
  }
  return `${profile.llmProvider === 'gemini' ? 'Gemini' : 'OpenAI 兼容'} · ${modelOf(profile) || '未设置模型'}${host ? ` · ${host}` : ''}`;
}

/** The current chat model settings, saved as a new profile (or over one with the same name). */
export function saveCurrentAsProfile(settings: Settings, name: string, now = Date.now()): Partial<Settings> {
  const profiles = readApiProfiles(settings);
  const existing = profiles.find((profile) => profile.name === name.trim());
  const profile: ApiProfile = {
    apiKey: settings.llmProvider === 'gemini' ? settings.geminiApiKey : settings.customApiKey,
    customApiUrl: settings.customApiUrl,
    customModelCapabilities: settings.customModelCapabilities,
    customModelName: settings.customModelName,
    customModelRequestParams: settings.customModelRequestParams,
    geminiApiUrl: settings.geminiApiUrl,
    id: existing?.id ?? `api-${now.toString(36)}`,
    llmModel: settings.llmModel,
    llmProvider: settings.llmProvider,
    name: name.trim().slice(0, 40) || '未命名',
    savedAt: now,
  };
  const next = existing ? profiles.map((item) => (item.id === existing.id ? profile : item)) : [...profiles, profile];
  return { apiProfiles: next.slice(0, MAX_PROFILES) } as Partial<Settings>;
}

/** Settings that make the chat use this profile. */
export function applyApiProfile(settings: Settings, profile: ApiProfile): Partial<Settings> {
  // A key typed this session is still in the clear; otherwise point at the profile's saved key.
  const key = profile.apiKey && !profile.apiKey.startsWith(CREDENTIAL_PREFIX) ? profile.apiKey : profileKeyReference(profile.id);
  return {
    customModelCapabilities: profile.customModelCapabilities ?? settings.customModelCapabilities,
    customModelRequestParams: profile.customModelRequestParams ?? settings.customModelRequestParams,
    llmProvider: profile.llmProvider,
    ...(profile.llmProvider === 'gemini'
      ? { geminiApiKey: key, geminiApiUrl: profile.geminiApiUrl, llmModel: profile.llmModel }
      : { customApiKey: key, customApiUrl: profile.customApiUrl, customModelName: profile.customModelName }),
  };
}

export function removeApiProfile(settings: Settings, id: string): Partial<Settings> {
  return { apiProfiles: readApiProfiles(settings).filter((profile) => profile.id !== id) } as Partial<Settings>;
}
