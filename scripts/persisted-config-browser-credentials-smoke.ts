import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/constants';
import { loadPersistedPetConfig, persistPetConfig } from '../src/persistentPetConfig';
const previousWindow = globalThis.window;
const values = new Map<string, string>();
const key = 'desktop-pet:persisted-config:v1';
const localStorage = { getItem: (name: string) => values.get(name) ?? null,
  setItem: (name: string, value: string) => { values.set(name, value); } };
const config = { ...DEFAULT_CONFIG, settings: { ...DEFAULT_CONFIG.settings,
  customApiKey: 'browser-secret', geminiApiKey: 'gemini-secret', customVoiceApiKey: 'voice-secret' } };
try {
  globalThis.window = { localStorage } as unknown as Window & typeof globalThis;
  assert.equal(await persistPetConfig(config), true);
  assert.doesNotMatch(values.get(key)!, /browser-secret|gemini-secret|voice-secret/);
  values.set(key, JSON.stringify(config));
  globalThis.window.desktopPetShell = { desktopMode: true,
    loadPersistedConfigSync: () => ({ ok: true, config: { ...config, settings: { ...config.settings,
      customApiKey: 'desktop-pet-credential:customApiKey', geminiApiKey: 'desktop-pet-credential:geminiApiKey' } } }),
    savePersistedConfig: async () => ({ ok: true }),
  } as NonNullable<Window['desktopPetShell']>;
  assert.equal(loadPersistedPetConfig().settings.customApiKey, 'desktop-pet-credential:customApiKey');
  assert.doesNotMatch(values.get(key)!, /browser-secret|gemini-secret|voice-secret/);
  console.log('browser config credentials omitted and legacy copy scrubbed');
} finally { globalThis.window = previousWindow; }
