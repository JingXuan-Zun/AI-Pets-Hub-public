import assert from 'node:assert/strict';
import { describeMcpNeeds, findMcpSetup, planPluginLink, type PluginLinkFiles } from '../src/plugins/pluginLinkInstall';

// "Install this for me" with a GitHub link: what the link is, from a few of its files.

const link = (repo: string, subPath = ''): PluginLinkFiles['link'] => ({ owner: 'someone', ref: 'HEAD', repo, subPath, url: `https://github.com/someone/${repo}` });
const fence = '```';

// An MCP server whose README gives the JSON setup; its plugin.json is another project's format.
const chrome = planPluginLink({
  link: link('chrome-devtools-mcp'),
  ok: true,
  pluginJson: JSON.stringify({ description: 'Reliable Chrome automation.', name: 'chrome-devtools' }),
  readme: `# Chrome DevTools MCP\n\n[![npm](x)](y)\n\nLets your agent control Chrome.\n\n${fence}json\n"args": ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"]\n${fence}\n\n${fence}json\n{\n  "mcpServers": {\n    "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"] }\n  }\n}\n${fence}\n`,
});
assert.equal(chrome.kind, 'mcp', 'another project\'s plugin.json is not ours: set up from the README');
assert.equal(chrome.name, 'chrome-devtools');
assert.equal(chrome.description, 'Reliable Chrome automation.');
if (chrome.kind === 'mcp') {
  assert.deepEqual(chrome.servers.map((server) => [server.id, server.command, server.args]), [['chrome-devtools', 'npx', ['-y', 'chrome-devtools-mcp@latest']]], 'the full JSON block, not the fragment');
  assert.equal(chrome.needs, 'Node.js');
  assert.deepEqual(chrome.missingKeys, []);
}

// Ours: plugin.json with id + kind installs as a package.
const ours = planPluginLink({ link: link('drawing-teacher'), ok: true, pluginJson: JSON.stringify({ description: '教画画', id: 'drawing-teacher', kind: 'skill', name: '绘画老师', permissions: ['read-instructions'] }) });
assert.deepEqual([ours.kind, ours.name, ours.kind === 'package' && ours.packageKind], ['package', '绘画老师', 'skill']);

// A bare SKILL.md in a folder of a bigger repository: named after the skill.
const skill = planPluginLink({ link: link('skills', 'skills/pdf'), ok: true, skillMd: '---\nname: pdf\ndescription: Work with PDF files.\n---\n# PDF' });
assert.deepEqual([skill.kind, skill.name, skill.description], ['package', 'pdf', 'Work with PDF files.']);

// A server that needs the user's key: she must not handle it.
const keyed = planPluginLink({ link: link('weather-mcp'), ok: true, readme: `Weather.\n\n${fence}json\n{ "mcpServers": { "weather": { "command": "npx", "args": ["-y", "weather-mcp"], "env": { "WEATHER_API_KEY": "<YOUR_KEY>" } } } }\n${fence}` });
assert.deepEqual(keyed.kind === 'mcp' && keyed.missingKeys, ['WEATHER_API_KEY'], 'keys left as placeholders are named');

// Only a launch line in a shell block, for this package.
assert.deepEqual(findMcpSetup(`${fence}sh\nnpm i -g other\nuvx mcp-server-fetch\n${fence}`, ['mcp-server-fetch'])?.map((server) => server.command), ['uvx'], 'a uvx line');
assert.equal(describeMcpNeeds('uvx'), 'Python（uv）');
assert.equal(describeMcpNeeds('npx.cmd'), 'Node.js');

// A README with setups for several apps, including a fragment that is not JSON ("context_servers": […],):
// the whole JSON block for this folder's own server, never the fragment read as a command.
const time = planPluginLink({
  link: link('servers', 'src/time'),
  ok: true,
  readme: `Time.\n\n${fence}json\n"context_servers": [\n  "mcp-server-time": {\n    "command": "uvx",\n    "args": ["mcp-server-time"]\n  }\n],\n${fence}\n\n${fence}json\n{ "mcpServers": { "time": { "command": "uvx", "args": ["mcp-server-time"] } } }\n${fence}\n`,
});
assert.deepEqual(time.kind === 'mcp' && time.servers.map((server) => [server.id, server.command, server.args]), [['time', 'uvx', ['mcp-server-time']]], 'the JSON block, not the fragment');
assert.equal(time.name, 'time', 'named after the folder');

// Not a plugin.
const kernel = planPluginLink({ link: link('linux'), ok: true, readme: '# Linux kernel\n\nThe kernel.' });
assert.equal(kernel.kind, 'unknown', 'nothing to install');

console.log('plugin link install smoke ok: 15 checks');
