import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { activeApiProfile, applyApiProfile, readApiProfiles, saveCurrentAsProfile } from '../src/settings/apiProfiles';

// Saved API profiles: save the current model setup, keep several, switch with one click. Keys
// are encrypted in the main process and the page only holds references; a profile's key is
// only ever used for its own endpoint.

const require = createRequire(import.meta.url);
const { createConfigCredentialCodec, modelCredentialReferences, resolveProfileCredential } = require('../electron/configCredentials.cjs');
let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };

const fakeSafeStorage = {
  decryptString: (buffer: Buffer) => buffer.toString().replace(/^enc:/u, ''),
  encryptString: (value: string) => Buffer.from(`enc:${value}`),
  getSelectedStorageBackend: () => 'dpapi',
  isEncryptionAvailable: () => true,
};
const codec = createConfigCredentialCodec(fakeSafeStorage);
// What the main process does on each save: encode against the last saved (decrypted) config.
let saved: { settings: Record<string, unknown> } = { settings: {} };
const save = (config: { settings: Record<string, unknown> }) => {
  const encoded = codec.encode(config, saved);
  saved = codec.decode(encoded);
  return encoded;
};
// What the page sees after loading.
const page = () => modelCredentialReferences(saved) as { settings: Record<string, unknown> };
const A = 'https://api.deepseek.com';
const B = 'https://relay.example.com/v1';

save({ settings: { customApiKey: 'key-deepseek', customApiUrl: A, customModelName: 'deepseek-flash', llmProvider: 'openai' } });
let settings = page().settings as never as Parameters<typeof saveCurrentAsProfile>[0];
check(settings.customApiKey, 'desktop-pet-credential:customApiKey', 'the page only holds a reference');
save({ settings: { ...settings, ...saveCurrentAsProfile(settings, 'DeepSeek', 1) } as never });
check((saved.settings.apiProfiles as Array<{ apiKey: string }>)[0].apiKey, 'key-deepseek', 'saving the current setup copies its real key into the profile (main process)');

// A second setup, typed in on the page, then saved as a profile too.
settings = page().settings as never;
save({ settings: { ...settings, customApiKey: 'key-relay', customApiUrl: B, customModelName: 'gpt-x' } as never });
settings = page().settings as never;
save({ settings: { ...settings, ...saveCurrentAsProfile(settings, '备用中转', 2) } as never });
settings = page().settings as never;
check(readApiProfiles(settings).map((profile) => [profile.name, profile.apiKey]), [['DeepSeek', 'desktop-pet-credential:apiProfile:api-1'], ['备用中转', 'desktop-pet-credential:apiProfile:api-2']], 'the page sees profile keys only as references');
check(activeApiProfile(settings)?.name, '备用中转', 'the one in use is recognised by provider, endpoint and model');

// Switching back to DeepSeek: a pure settings change; the main process resolves the key.
const deepseek = readApiProfiles(settings)[0];
settings = { ...settings, ...applyApiProfile(settings, deepseek) };
check([settings.customApiUrl, settings.customApiKey, activeApiProfile(settings)?.name], [A, 'desktop-pet-credential:apiProfile:api-1', 'DeepSeek'], 'switched on the page');
save({ settings: settings as never });
check([saved.settings.customApiKey, saved.settings.customApiUrl], ['key-deepseek', A], 'the saved config now uses DeepSeek with its own key');

// Model requests made right after switching (before a reload) resolve the profile key, for its endpoint only.
check(resolveProfileCredential('desktop-pet-credential:apiProfile:api-1', saved.settings), { apiKey: 'key-deepseek', llmProvider: 'openai', url: A }, 'model request resolves the profile key');

// Safety: a profile's key cannot be sent to another endpoint by editing the URL.
assert.throws(() => codec.encode({ settings: { ...settings, customApiUrl: 'https://evil.example.com' } }, saved), /credential-endpoint-changed-reenter-key/u);
cases += 1;
assert.throws(() => codec.encode({ settings: { ...settings, tavilyApiKey: 'desktop-pet-credential:apiProfile:api-1' } }, saved), /credential-reference-unavailable/u);
cases += 1;

// Backups (privateDataBackup.ts) are checked in the running app: Node cannot load it (constants.ts imports a .png).

console.log(`api profiles smoke ok: ${cases} checks`);
