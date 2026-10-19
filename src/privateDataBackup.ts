import { normalizePetConfig } from './petConfigNormalization';
import type { PetConfig } from './types';

// The private-data backup: everything about the user's characters, memory and preferences, without
// API keys or other credentials. Used by the settings export/import and by chat backups.

declare const __APP_VERSION__: string;

const PRIVATE_EXPORT_KIND = 'ai-desktop-pet-private-data';
const PRIVATE_EXPORT_VERSION = 1;

export type PrivateDataExport = {
  appVersion: string;
  config: PetConfig;
  exportedAt: string;
  kind: typeof PRIVATE_EXPORT_KIND;
  version: typeof PRIVATE_EXPORT_VERSION;
};

const SECRET_SETTING_KEYS = [
  'braveSearchApiKey',
  'browserTtsApiKey',
  'comfyUiApiKey',
  'customApiKey',
  'deepseekHarnessApiKey',
  'geminiApiKey',
  'customSpeechApiKey',
  'customVoiceApiKey',
  'customWebSearchApiKey',
  'serperApiKey',
  'tavilyApiKey',
  'visionCustomApiKey',
] as const;

function redactSecrets(config: PetConfig): PetConfig {
  const settings = { ...config.settings };
  for (const key of SECRET_SETTING_KEYS) {
    settings[key] = '';
  }
  return { ...config, settings };
}

/** Keeps this device's own keys when a backup (which never carries keys) is restored. */
export function preserveLocalSecrets(importedConfig: PetConfig, currentConfig: PetConfig): PetConfig {
  const settings = { ...importedConfig.settings };
  for (const key of SECRET_SETTING_KEYS) {
    settings[key] = currentConfig.settings[key];
  }
  return { ...importedConfig, settings };
}

export function buildPrivateDataExport(config: PetConfig): PrivateDataExport {
  return {
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    config: redactSecrets(normalizePetConfig(config)),
    exportedAt: new Date().toISOString(),
    kind: PRIVATE_EXPORT_KIND,
    version: PRIVATE_EXPORT_VERSION,
  };
}

export function parsePrivateDataExport(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('文件不是有效的私人数据备份。');
  const payload = value as Partial<PrivateDataExport>;
  if (payload.kind !== PRIVATE_EXPORT_KIND || payload.version !== PRIVATE_EXPORT_VERSION || !payload.config) {
    throw new Error('备份格式或版本不受支持。');
  }
  return normalizePetConfig(payload.config);
}
