import assert from 'node:assert/strict';
import { getPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import { SELF_CHECK_ITEMS } from '../src/self-check/selfCheckItems';
import { formatSelfCheckReport, runSelfCheck } from '../src/self-check/selfCheckRunner';
import type { SelfCheckDeps } from '../src/self-check/selfCheckTypes';
import type { LocalVoiceHealth, PetConfig } from '../src/types';

const health = (status: LocalVoiceHealth['status']): LocalVoiceHealth => ({
  available: status === 'ready', detectedPackages: [], device: 'cuda', executable: null, messages: [], missingPackages: [],
  pythonVersion: null, referenceReady: true, runtimeLabel: null, status, sttReady: true, ttsReady: true,
});

let voiceStatus: LocalVoiceHealth['status'] = 'idle';
let warmups = 0;
let modelCalls = 0;
const settings = {
  customApiKey: 'k', customApiUrl: 'https://example.invalid/v1', customModelName: 'm', geminiApiKey: '', llmModel: '', llmProvider: 'openai',
  qqBridge: { enabled: true, ownerQq: '10001', wsUrl: 'ws://127.0.0.1:3001' }, qqBridgeAccessToken: '',
  sttProvider: 'local', ttsProvider: 'local', voiceEnabled: true, voiceInputEnabled: false,
};
const deps = (patch: Partial<SelfCheckDeps> = {}, settingsPatch: Record<string, unknown> = {}): SelfCheckDeps => ({
  config: { settings: { ...settings, ...settingsPatch } } as unknown as PetConfig,
  getLocalVoiceHealth: async () => health(voiceStatus),
  testModel: async () => { modelCalls += 1; return { ok: true }; },
  testDevAgent: async () => ({ installed: true, loggedIn: false, error: 'Not logged in' }),
  testOneBot: async () => ({ error: '连接超时', ok: false }),
  warmupLocalVoice: async () => { warmups += 1; voiceStatus = 'ready'; },
  ...patch,
});

assert.deepEqual(SELF_CHECK_ITEMS.map((item) => item.id), ['network.model-provider', 'voice.local-runtime', 'network.qq-bridge', 'config.dev-agent']);
assert.ok(getPlatformCapability('system.health_check'), 'the character can run the checkup');

// A stopped voice service is started (safe fix) and checked again; the QQ problem only gets advice.
const entries = await runSelfCheck(deps());
assert.equal(warmups, 1);
const voice = entries.find((entry) => entry.id === 'voice.local-runtime');
assert.equal(voice?.result.status, 'ok', 'the result after the fix is what counts');
assert.equal(voice?.repair?.ok, true);
const qq = entries.find((entry) => entry.id === 'network.qq-bridge');
assert.equal(qq?.result.status, 'problem');
assert.equal(qq?.repair, null, 'manual-only problems are not touched');
const report = formatSelfCheckReport(entries);
assert.match(report, /✅ 聊天模型/u);
assert.match(report, /✅ 本地语音[\s\S]*已尝试修复/u);
assert.match(report, /❌ QQ 连接：QQ 连不上：连接超时 建议：/u);

// Checks that don't apply are skipped; a missing model setting is reported without calling it.
modelCalls = 0;
const quiet = await runSelfCheck(deps({}, { customApiUrl: '', qqBridge: { enabled: false }, voiceEnabled: false }));
assert.deepEqual(quiet.map((entry) => entry.id), ['network.model-provider'], 'voice off and QQ off: only the model is checked');
assert.equal(quiet[0]?.result.status, 'problem');
assert.equal(modelCalls, 0, 'an incomplete model setting is not tested');

// Missing runtime: no automatic install, just advice; a throwing check becomes "unknown".
voiceStatus = 'missing-runtime';
warmups = 0;
const missing = await runSelfCheck(deps({ warmupLocalVoice: async () => { warmups += 1; } }), { qqBridge: { enabled: false } });
const missingVoice = missing.find((entry) => entry.id === 'voice.local-runtime');
assert.equal(missingVoice?.result.status, 'problem');
assert.match(formatSelfCheckReport(missing), /本地语音环境不完整[\s\S]*建议：到 设置 → AI → 语音模型/u);
const broken = await runSelfCheck(deps({ testModel: async () => { throw new Error('boom'); } }), { qqBridge: { enabled: false }, voiceEnabled: false });
assert.equal(broken[0]?.result.status, 'unknown');

console.log('self check smoke ok');
