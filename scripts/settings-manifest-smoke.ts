import assert from 'node:assert/strict';

// The settings manifest: she finds a plugin setting by what the user said, changes it (asking
// first when it changes what she does), opens a settings page, and secrets cannot be listed.

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };

const store = new Map<string, string>();
let openedWindow = 0;
Object.assign(globalThis, {
  window: {
    desktopPetShell: { openSettingsWindow: () => { openedWindow += 1; } },
    localStorage: { getItem: (key: string) => store.get(key) ?? null, removeItem: (key: string) => store.delete(key), setItem: (key: string, value: string) => store.set(key, value) },
  },
});

const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const { registerSettings } = await import('../src/settings-manifest/settingsManifest');

const config = {
  settings: {
    apiProfiles: [
      { customApiUrl: 'https://api.deepseek.com/v1', customModelName: 'deepseek-chat', id: 'p-ds', llmProvider: 'custom', name: 'DeepSeek' },
      { geminiApiUrl: '', id: 'p-gm', llmModel: 'gemini-2.5-pro', llmProvider: 'gemini', name: 'Gemini' },
    ],
    comfyUi: { defaultWorkflowId: 'a', serverUrl: '', timeoutSeconds: 900, workflows: [{ id: 'a', name: '二次元' }, { id: 'b', name: '写实' }] },
    qqBridge: { enabled: true, voiceReplyMode: 'mirror' },
    weixinBridge: { enabled: true, voiceReplyMode: 'always' },
  },
};
const approvals: string[] = [];
let answer = true;
const updates: unknown[] = [];
const context = {
  configRef: { current: config as never },
  onUpdateConfig: (next: unknown) => { updates.push(next); },
  requestApproval: async ({ title }: { title: string }) => { approvals.push(title); return answer; },
};
const run = (capability: string, args: Record<string, unknown>) => runPlatformCapability(context as never, { args, capability });
const settings = () => (context.configRef.current as typeof config).settings;

const found = await run('settings.find', { query: '微信上别发语音了' });
assert.match(found.text.split('\n')[0], /^weixin\.voiceReplyMode｜微信连接 · 语音回复：现在 总是语音/u);
cases += 1;
assert.match((await run('settings.find', { query: '' })).text, /qq\.enabled[\s\S]*comfyui\.timeoutSeconds/u);
cases += 1;

// Her own habits change at once; turning a connection off asks first.
check((await run('settings.set', { id: 'weixin.voiceReplyMode', value: 'off' })).text, '已把微信连接 · 语音回复改成“不发语音”。', 'voice replies off, no card');
check([settings().weixinBridge.voiceReplyMode, approvals.length, updates.length], ['off', 0, 1], 'saved without asking');
check((await run('settings.set', { id: 'comfyui.timeoutSeconds', value: 99999 })).text, '已把画图（ComfyUI） · 一张图最多等（秒）改成“30 分钟”。', 'numbers are kept in range');
check((await run('settings.set', { id: 'comfyui.defaultWorkflow', value: '写实' })).ok, true, 'a choice by its label');
check(settings().comfyUi.defaultWorkflowId, 'b', 'stored as the workflow id');
answer = false;
check((await run('settings.set', { id: 'qq.enabled', value: false })).text, '用户没有同意，没有改。', 'turning QQ off asks first; a no keeps it');
check([approvals, settings().qqBridge.enabled], [['把「QQ 连接 · 开关」改成“关”'], true], 'the card said what would change');
answer = true;
check((await run('settings.set', { id: 'qq.enabled', value: '关' })).ok, true, 'a yes turns it off');
check(settings().qqBridge.enabled, false, 'QQ off');
check((await run('settings.set', { id: 'weixin.voiceReplyMode', value: 'loud' })).text, '可选的只有：总是语音、跟着对方（发语音就回语音）、不发语音。', 'bad values are explained');
check((await runPlatformCapability({ configRef: context.configRef, onUpdateConfig: () => {} } as never, { args: { id: 'weixin.enabled', value: false }, capability: 'settings.set' })).ok, false, 'outside a chat nothing that needs a yes is changed');

// Opening a settings page.
check((await run('settings.open_page', { page: '微信设置' })).text, '已经打开设置里的「微信连接」。', 'open the WeChat page');
check([openedWindow, JSON.parse(store.get('desktop-pet.settings-page-request.v1') ?? '{}').pageId], [1, 'platform-weixin'], 'the settings window is asked to show it');
check(JSON.parse(store.get('desktop-pet.settings-page-request.v1') ?? '{}').pageId === 'platform-workflow' || (await run('settings.open_page', { page: '画图' })).ok, true, 'drawing → ComfyUI page');

// Secrets cannot be put in the manifest.
// Switching the chat model ends her reply: the next round would go to the other provider.
const switched = await run('settings.set', { id: 'ai.apiProfile', value: 'Gemini' });
check([switched.ok, switched.endsReply], [true, '（已切换到「Gemini」，从下一句开始用它回复）'], 'switching the model ends the reply with a fixed line');
check((await run('settings.set', { id: 'weixin.voiceReplyMode', value: 'always' })).endsReply, undefined, 'other settings let her keep talking');

assert.throws(() => registerSettings([{ forModel: '', group: 'x', id: 'qq.accessToken', kind: 'number', label: 'x', read: () => 0, risk: 'personal', write: (c) => c }]), /密钥/u);
cases += 1;

console.log(`settings manifest smoke ok: ${cases} checks`);
process.exit(0);
