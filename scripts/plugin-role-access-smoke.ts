import assert from 'node:assert/strict';

// Plugins are turned on per character: skills keep their old per-character list, MCP servers
// and built-in plugins stay on for everyone until turned off, and capabilities follow them.

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  },
};

const { forgetPluginRoleAccess, isPluginEnabledForPet, setPluginEnabledForPet } = await import('../src/plugins/pluginRoleAccess');
const { isCapabilityEnabledForPet, isMcpServerEnabledForPet } = await import('../src/plugins/pluginCapabilityAccess');

// Skills: the existing bindings are the source of truth.
store.set('desktop-pet.agent-skill-bindings.v1', JSON.stringify({ a: ['drawing-teacher'] }));
assert.equal(isPluginEnabledForPet('skill:drawing-teacher', 'a', false), true);
assert.equal(isPluginEnabledForPet('skill:drawing-teacher', 'b', false), false);
setPluginEnabledForPet('skill:drawing-teacher', 'b', true);
assert.deepEqual(JSON.parse(store.get('desktop-pet.agent-skill-bindings.v1')!).b, ['drawing-teacher']);
setPluginEnabledForPet('skill:drawing-teacher', 'a', false);
assert.equal(isPluginEnabledForPet('skill:drawing-teacher', 'a', false), false);
forgetPluginRoleAccess('skill:drawing-teacher');
assert.equal(isPluginEnabledForPet('skill:drawing-teacher', 'b', false), false);

// MCP and built-ins: on for every character until turned off for one.
assert.equal(isMcpServerEnabledForPet('filesystem', 'a'), true);
setPluginEnabledForPet('mcp:filesystem', 'a', false);
assert.equal(isMcpServerEnabledForPet('filesystem', 'a'), false);
assert.equal(isMcpServerEnabledForPet('filesystem', 'b'), true);

assert.equal(isCapabilityEnabledForPet('images.generate', 'a'), true);
setPluginEnabledForPet('native:comfyui', 'a', false);
assert.equal(isCapabilityEnabledForPet('images.generate', 'a'), false);
assert.equal(isCapabilityEnabledForPet('images.list_workflows', 'a'), false);
assert.equal(isCapabilityEnabledForPet('images.generate', 'b'), true);
assert.equal(isCapabilityEnabledForPet('weather.current', 'a'), true, 'capabilities without a plugin are untouched');
forgetPluginRoleAccess('native:comfyui');
assert.equal(isCapabilityEnabledForPet('images.generate', 'a'), true);

// Without a character (e.g. a background check) the default applies.
assert.equal(isPluginEnabledForPet('mcp:filesystem', null), true);

// The character as plugin concierge: list, describe, and turn one on for itself.
const { PLUGIN_CAPABILITIES } = await import('../src/plugins/pluginCapabilities');
const { DEFAULT_COMFY_UI_SETTINGS } = await import('../src/comfyui/comfyUiSettings');
const { DEFAULT_QQ_BRIDGE_SETTINGS } = await import('../src/qq-bridge/qqBridgeSettings');
const capability = (id: string) => PLUGIN_CAPABILITIES.find((item) => item.id === id)!;
const settings = { comfyUi: DEFAULT_COMFY_UI_SETTINGS, devAgent: { enabled: false, workspaces: [] }, qqBridge: DEFAULT_QQ_BRIDGE_SETTINGS };
const context = { configRef: { current: { settings } }, onUpdateConfig: () => {}, petId: 'a' } as never;
store.set('desktop-pet.agent-external-skills.v1', JSON.stringify({ skills: [{
  capabilityIds: [], description: '当绘画老师', id: 'drawing-teacher', importedAt: '2026-10-31T00:00:00.000Z',
  inputSchema: {}, instructions: '---\nname: drawing-teacher\ndescription: 当绘画老师：批改作品、布置作业\n---\n# 绘画老师\n', risk: 'read',
  sourceName: 'drawing-teacher.zip', tags: [], title: 'drawing-teacher', version: '1',
}], version: 1 }));

const listed = await capability('plugins.list').run(context, {});
assert.match(listed.text, /ComfyUI 画图（内置，你可以用，待设置）/u);
assert.match(listed.text, /QQ 连接（内置，所有角色共用/u);
assert.match(listed.text, /开发助手（内置，你可以用，待设置）/u);
assert.match(listed.text, /绘画老师（技能，没给你开启，可用）/u);
assert.match((await capability('plugins.list').run(context, { query: '画图' })).text, /ComfyUI/u);

const described = await capability('plugins.describe').run(context, { name: 'QQ 连接' });
assert.match(described.text, /9\.9\.21/u, 'troubleshooting reaches the character');
assert.match(described.text, /在哪设置：设置 → QQ 连接/u);

assert.equal(capability('plugins.set_enabled').risk, 'change', 'turning a plugin on asks first');
assert.equal((await capability('plugins.set_enabled').run(context, { enabled: true, name: '绘画老师' })).ok, true);
assert.equal(isPluginEnabledForPet('skill:external.drawing-teacher', 'a', false), true);
assert.equal(isPluginEnabledForPet('skill:external.drawing-teacher', 'b', false), false, 'only the asking character');
assert.equal((await capability('plugins.set_enabled').run(context, { enabled: false, name: 'QQ 连接' })).ok, false, 'shared plugins are not per character');

console.log('plugin role access smoke passed');
