import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire, register } from 'node:module';
import type { PetConfig } from '../src/types';

// The config normaliser needs Vite (bundled images, import.meta.glob); the backup flow is what is
// tested here, so Node gets a pass-through normaliser.
register(`data:text/javascript,${encodeURIComponent(
  'export async function load(url, context, next) { return url.includes("/src/petConfigNormalization.ts") ? { format: "module", shortCircuit: true, source: "export const normalizePetConfig = (config) => config;" } : next(url, context); }',
)}`);
const { extractPersonaText } = await import('../src/platform-capabilities/dataCapabilities');
const { getPlatformCapability, runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');

const require = createRequire(import.meta.url);
const { createDataBackupService } = require('../electron/dataBackupIpcHandlers.cjs') as {
  createDataBackupService: (options: { backupDirectory: string }) => {
    list: () => Promise<{ backups: Array<{ modifiedAt: string; name: string; sizeBytes: number }>; ok: boolean }>;
    read: (name: string) => Promise<{ ok: boolean; text: string }>;
    save: (text: string) => Promise<{ name: string; ok: boolean; sizeBytes: number }>;
  };
};

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// The real main-process service, on a temporary folder, stands in for the desktop bridge.
const backupDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'desktop-pet-backup-smoke-'));
const service = createDataBackupService({ backupDirectory });
const wrap = async <T>(work: () => Promise<T>) => { try { return await work(); } catch (error) { return { error: (error as Error).message, ok: false }; } };
(globalThis as unknown as { window: unknown }).window = {
  desktopPetShell: {
    dataBackup: {
      list: () => wrap(() => service.list()),
      read: (name: string) => wrap(() => service.read(name)),
      save: (text: string) => wrap(() => service.save(text)),
    },
  },
};

let config = {
  companionPets: [],
  personality: { name: '甜心小桃', systemInstruction: '' },
  settings: { chatFontSize: 20, customApiKey: 'sk-local-secret', geminiApiKey: '' },
} as unknown as PetConfig;
const configRef = { current: config };
const context = { configRef, onUpdateConfig: (next: PetConfig) => { config = next; configRef.current = next; }, petId: 'primary' };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

check(['data.backup', 'data.list_backups', 'data.restore', 'personas.browse', 'personas.apply'].map((id) => getPlatformCapability(id)?.risk), ['personal', 'read', 'change', 'read', 'change'], 'restoring and replacing a persona ask first');

check((await run('data.backup')).ok, true, 'backed up');
const [first] = (await service.list()).backups;
const saved = await fs.readFile(path.join(backupDirectory, first.name), 'utf8');
check([saved.includes('sk-local-secret'), saved.includes('甜心小桃')], [false, true], 'the file has the characters but never the key');
assert.match((await run('data.list_backups')).text, /desktop-pet-backup-\d{8}-\d{6}\.json/u);
cases++;

// Change things, then restore the newest backup.
context.onUpdateConfig({ ...config, personality: { ...config.personality, name: '改过的名字' }, settings: { ...config.settings, chatFontSize: 30, customApiKey: 'sk-new-key' } });
const restored = await run('data.restore');
check(restored.ok, true, 'restored');
check([config.personality.name, config.settings.chatFontSize, config.settings.customApiKey], ['甜心小桃', 20, 'sk-new-key'], 'data comes back, this device keeps its current key');
check((await service.list()).backups.length, 2, 'the state before restoring was backed up too');
check((await run('data.restore', { backup: '../../etc/passwd' })).ok, false, 'only backups in the folder can be read');
await assert.rejects(() => service.read('..\\..\\secret.json'));
cases++;

check(extractPersonaText('  你是一只猫娘。 ', 'md'), '你是一只猫娘。', 'text personas as is');
check(extractPersonaText(JSON.stringify({ name: '大小姐', systemInstruction: '你是傲娇大小姐。' }), 'json'), '你是傲娇大小姐。', 'JSON personas by their prompt field');
check(extractPersonaText('{broken', 'json'), '', 'broken JSON gives nothing to apply');

await fs.rm(backupDirectory, { force: true, recursive: true });
console.log(`data capabilities smoke ok: ${cases} checks`);
