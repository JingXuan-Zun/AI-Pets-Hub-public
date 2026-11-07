// Plugin safety boundary (2026-11-06): unreviewed plugins cannot skip confirmations, packages
// cannot hide what they run, secrets stay out of plugin processes, and a flooding server stops.
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { describeMcpServer, readMcpServers, withPackage } from '../src/plugins/pluginCatalog';
import { isUnreviewedMcpServer, readMcpServerDirectory } from '../src/plugins/mcpServerDirectory';
import type { PluginPackageManifest } from '../src/plugins/pluginPackages';

const require = createRequire(import.meta.url);
const { createMcpChildEnvironment } = require('../electron/mcpChildEnvironment.cjs');
const { handleStdoutChunk } = require('../electron/mcpStdioSession.cjs');

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };

const config = {
  servers: [
    { args: ['-y', 'chrome-devtools-mcp@latest'], command: 'npx', id: 'chrome-devtools', origin: 'user' },
    { args: ['tool.js'], command: 'node', env: { GITHUB_TOKEN: 'x', REGION: 'cn' }, id: 'from-link', origin: 'link' },
    { id: 'market-search', origin: 'market', url: 'https://example.com/mcp' },
    { args: [], command: 'python', id: 'old-entry' },
  ],
};

// 1. Where a server came from; only link-installed ones are unreviewed.
const directory = readMcpServerDirectory(config);
check(directory.map((entry) => [entry.id, entry.origin ?? null]), [['chrome-devtools', 'user'], ['from-link', 'link'], ['market-search', 'market'], ['old-entry', null]], 'origins are read');
check(['chrome-devtools', 'from-link', 'market-search', 'old-entry'].map((id) => isUnreviewedMcpServer(id, directory)), [false, true, false, false], 'only link-installed servers are unreviewed');

// 2. Honest permissions: what the server really is, plus secrets it is given.
const servers = readMcpServers(config);
const described = servers.map((server) => describeMcpServer(server, 9223));
check(described.map((plugin) => plugin.permissions), [['run-program'], ['run-program', 'credentials'], ['network'], ['run-program']], 'permissions follow what the server is');
check(described[1].source, '她从链接装的（未审核）', 'link-installed servers say so');
check(described[2].source, '插件市场', 'market servers say so');
const understated = { description: '', examples: [], id: 'from-link', kind: 'mcp', name: 'Harmless', permissions: ['read-instructions'], requires: [], setup: [], troubleshooting: [], useWhen: '', version: '1.0.0' } as unknown as PluginPackageManifest;
check(withPackage(described[1], understated).permissions, ['read-instructions', 'run-program', 'credentials'], 'a package cannot hide that it runs a program');

// 3. Secrets stay out of plugin processes.
const env = createMcpChildEnvironment({ REGION: 'cn' }, {
  APP_UPDATE_SIGNING_KEY: 'D:/key.pem', CLOUDFLARE_API_TOKEN: 't', DESKTOP_PET_X: '1', GITHUB_PAT: 'p', KEYBOARD_LAYOUT: 'us', MONKEY: 'ok', PATH: 'C:/bin', SESSION_COOKIE: 'c', USERPROFILE: 'C:/Users/u',
});
check(Object.keys(env).sort(), ['KEYBOARD_LAYOUT', 'MONKEY', 'PATH', 'REGION', 'USERPROFILE'], 'keys, tokens, PATs and cookies are not inherited');

// 4. A server that floods stdout without line breaks is stopped.
let closedWith = '';
const killed = { kill: () => { closedWith = closedWith || 'kill'; return true; }, killed: false, pid: undefined };
const state = { child: killed, pending: new Map(), stdoutBuffer: '' } as Record<string, unknown>;
handleStdoutChunk(state, 'x'.repeat(10));
check(state.stdoutBuffer, 'x'.repeat(10), 'normal output is buffered');
handleStdoutChunk(state, 'y'.repeat(49 * 1024 * 1024));
check([state.stdoutBuffer, closedWith], ['', 'kill'], 'a 49 MB line without a break stops the server');

console.log(`plugin safety smoke ok: ${checks} checks`);
