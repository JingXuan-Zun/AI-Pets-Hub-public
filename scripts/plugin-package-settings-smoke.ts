import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// A plugin declares its settings in plugin.json; she finds and changes them like any other
// setting; an MCP plugin's server gets the value as an environment variable (and restarts), a
// skill gets a “用户的设置” note at the end of its instructions. Secrets are dropped.

const require = createRequire(import.meta.url);
let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const { normalizePluginManifest } = require('../electron/pluginManifestRules.cjs') as { normalizePluginManifest: (raw: unknown) => { manifest: Record<string, unknown> } };
const weather = normalizePluginManifest({
  description: '查天气', id: 'weather-tool', kind: 'mcp', mcp: { command: 'node', env: { LANG: 'zh' } }, name: '天气工具',
  settings: [
    { default: '上海', env: 'WEATHER_CITY', forModel: '没说城市时查哪里（“默认查北京”）', key: 'city', kind: 'text', label: '默认城市' },
    { key: 'apiToken', kind: 'text', label: '接口令牌' },
    { choices: [{ label: '摄氏', value: 'c' }, { label: '华氏', value: 'f' }], env: 'WEATHER_UNIT', key: 'unit', kind: 'choice', label: '温度单位' },
  ],
}).manifest;
check((weather.settings as Array<{ key: string }>).map((setting) => setting.key), ['city', 'unit'], 'a token-like setting is dropped from plugin.json');
const teacher = normalizePluginManifest({
  description: '教画画', id: 'drawing-teacher', kind: 'skill', name: '绘画老师',
  settings: [{ choices: [{ label: '温柔', value: 'gentle' }, { label: '严格', value: 'strict' }], default: 'gentle', forModel: '批改的口气', key: 'tone', kind: 'choice', label: '批改风格', risk: 'change' }],
}).manifest;

const storage = new Map<string, string>();
storage.set('desktop-pet.agent-external-skills.v1', JSON.stringify({ kind: 'agent-external-skill-library.v1', skills: [{ capabilityIds: [], description: '教画画', id: 's1', importedAt: '', inputSchema: {}, instructions: '你是绘画老师。', risk: 'read', sourceName: 'plugin:drawing-teacher', tags: [], title: '绘画老师', version: '1' }] }));
let mcpConfig: Record<string, unknown> = { servers: [{ args: [], command: 'node', env: { LANG: 'zh' }, id: 'weather-tool' }] };
const resets: string[] = [];
Object.assign(globalThis, {
  window: {
    desktopPetShell: {
      loadMcpConfig: async () => ({ config: mcpConfig, ok: true }),
      plugins: { list: async () => ({ ok: true, plugins: [{ ...weather, folder: 'x' }, { ...teacher, folder: 'y' }] }) },
      resetMcpSession: async ({ serverId }: { serverId: string }) => { resets.push(serverId); return { ok: true }; },
      saveMcpConfig: async ({ config }: { config: Record<string, unknown> }) => { mcpConfig = config; return { ok: true }; },
    },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key), setItem: (key: string, value: string) => storage.set(key, value) },
  },
});

const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const approvals: string[] = [];
const context = {
  configRef: { current: { settings: { comfyUi: { defaultWorkflowId: '', timeoutSeconds: 900, workflows: [] } } } },
  onUpdateConfig: () => {},
  requestApproval: async ({ title }: { title: string }) => { approvals.push(title); return true; },
};
const run = (capability: string, args: Record<string, unknown>) => runPlatformCapability(context as never, { args, capability });

const found = await run('settings.find', { query: '默认查北京的天气' });
assert.match(found.text.split('\n')[0], /^plugin\.weather-tool\.city｜天气工具 · 默认城市：现在 上海/u);
cases += 1;
check((await run('settings.set', { id: 'plugin.weather-tool.city', value: '北京' })).text, '已把天气工具 · 默认城市改成“北京”。', 'changed at once');
await tick();
const server = (mcpConfig.servers as Array<{ env: Record<string, string>; id: string }>)[0];
check([server.env, resets], [{ LANG: 'zh', WEATHER_CITY: '北京', WEATHER_UNIT: 'c' }, ['weather-tool']], 'the MCP server gets its env and restarts');

check((await run('settings.set', { id: 'plugin.drawing-teacher.tone', value: '严格' })).ok, true, 'a skill setting');
check(approvals, ['把「绘画老师 · 批改风格」改成“严格”'], 'one marked change asks first');
await tick();
const library = JSON.parse(storage.get('desktop-pet.agent-external-skills.v1') ?? '{}') as { skills: Array<{ instructions: string }> };
assert.match(library.skills[0].instructions, /^你是绘画老师。\n\n<!-- 用户的设置（桌宠自动维护） -->\n用户的设置（按这些来）：\n- 批改风格：严格$/u);
cases += 1;
await run('settings.set', { id: 'plugin.drawing-teacher.tone', value: 'gentle' });
await tick();
const again = JSON.parse(storage.get('desktop-pet.agent-external-skills.v1') ?? '{}') as { skills: Array<{ instructions: string }> };
check(again.skills[0].instructions.match(/用户的设置（按这些来）/gu)?.length, 1, 'the note is replaced, not stacked');

console.log(`plugin package settings smoke ok: ${cases} checks`);
process.exit(0);
