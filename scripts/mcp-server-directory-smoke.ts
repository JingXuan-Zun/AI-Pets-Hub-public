import assert from 'node:assert/strict';

// The `mcp` tool names the MCP plugins she may use and what each lets her do.

const store = new Map<string, string>();
const localStorage = { getItem: (key: string) => store.get(key) ?? null, removeItem: (key: string) => store.delete(key), setItem: (key: string, value: string) => store.set(key, value) };
Object.assign(globalThis, { localStorage, window: { localStorage } });
const { describeHerBrowserAccounts, describeMcpServersForPet, readMcpServerDirectory } = await import('../src/plugins/mcpServerDirectory');
const { setPluginEnabledForPet } = await import('../src/plugins/pluginRoleAccess');

const list = readMcpServerDirectory({
  servers: [
    { args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl=http://127.0.0.1:9223'], command: 'npx', description: '让她能帮你上网点击、填表、翻页和截图。', id: 'chrome-devtools', title: 'chrome-devtools' },
    { command: 'npx', id: 'weather', title: '天气' },
    { command: 'npx', disabled: true, id: 'off', title: 'Off' },
  ],
});
assert.deepEqual(list.map((entry) => entry.id), ['chrome-devtools', 'weather'], 'disabled servers are left out');
assert.equal(describeMcpServersForPet('pet-a', list), 'chrome-devtools（让她能帮你上网点击、填表、翻页和截图。）；weather（天气）', 'each with what it does (or its name)');
assert.deepEqual(readMcpServerDirectory({ mcpServers: { fetch: { command: 'uvx' } } }), [{ args: [], description: '', id: 'fetch', title: 'fetch' }], 'the README object form works too');
// Plugins in her browser: the accounts signed in there are hers (she once named the user from a message).
assert.match(describeHerBrowserAccounts('pet-a', 9223, list), /^chrome-devtools 在你自己的浏览器里操作.*不是用户的/u, 'her accounts, not the user’s');
assert.equal(describeHerBrowserAccounts('pet-a', 9555, list), '', 'another browser: nothing said');
setPluginEnabledForPet('mcp:chrome-devtools', 'pet-b', false);
assert.equal(describeMcpServersForPet('pet-b', list), 'weather（天气）', 'a plugin turned off for this character is not named');

console.log('mcp server directory smoke ok: 6 checks');
