import assert from 'node:assert/strict';
import { explainMcpProblem, parseMcpQuickAdd, splitCommandLine, suggestMcpServerId } from '../src/plugins/mcpQuickAdd';

// "Add an MCP tool" from whatever a README gives: a command line, a URL, or the JSON block.
const one = (input: string, name = '') => {
  const result = parseMcpQuickAdd(input, name);
  assert.equal(result.ok, true, input);
  return (result as { servers: Array<Record<string, unknown>> }).servers;
};

assert.deepEqual(splitCommandLine('npx -y @modelcontextprotocol/server-filesystem "D:\我的 文档"'), ['npx', '-y', '@modelcontextprotocol/server-filesystem', 'D:\我的 文档']);
assert.deepEqual(one('npx -y @modelcontextprotocol/server-filesystem D:\文档')[0], { args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:\文档'], command: 'npx', env: {}, id: 'filesystem', title: 'filesystem', url: '' });
assert.equal(one('uvx mcp-server-fetch')[0].id, 'fetch');
assert.equal(one('npx -y @playwright/mcp@latest')[0].id, 'playwright');
assert.equal(one('python weather_mcp.py')[0].id, 'weather');
assert.equal(one('npx -y some-tool', '我的工具')[0].id, 'some-tool', 'a name hint with no usable letters falls back to the package');
assert.deepEqual(one('https://mcp.example.com/sse')[0], { args: [], command: '', env: {}, id: 'example', title: 'example', url: 'https://mcp.example.com/sse' });

// README JSON, as published by most servers.
const readme = `{
  "mcpServers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<TOKEN>" } },
    "remote": { "url": "https://api.example.com/mcp" }
  }
}`;
const servers = one(readme);
assert.deepEqual(servers.map((server) => server.id), ['github', 'remote']);
assert.deepEqual(servers[0].env, { GITHUB_PERSONAL_ACCESS_TOKEN: '<TOKEN>' });
assert.equal(one('```json\n{"command":"node","args":["server.js"]}\n```', 'my-tool')[0].id, 'my-tool', 'a single server object with a fenced block');

assert.match((parseMcpQuickAdd('{"mcpServers": ') as { error: string }).error, /JSON 格式不对/u);
assert.match((parseMcpQuickAdd('{"name": "x"}') as { error: string }).error, /没找到服务器配置/u);
assert.match((parseMcpQuickAdd('   ') as { error: string }).error, /请贴上/u);
assert.equal(suggestMcpServerId('node', ['dist/index.js']), 'index');
assert.match(explainMcpProblem('runtime-missing', 'npx'), /Node\.js/u);
assert.match(explainMcpProblem('command-missing', 'uvx'), /找不到启动命令“uvx”/u);
console.log('mcp quick add smoke passed');
