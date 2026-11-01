import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MCP_SERVER_TEMPLATE, buildSkillMarkdown, buildToolPluginManifest } from '../src/plugins/pluginTemplates';

// The starting MCP server a "make a tool plugin" draft gets must already speak the protocol:
// initialize, tools/list, tools/call (and a tool error), with no npm install.
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-template-'));
fs.writeFileSync(path.join(folder, 'server.mjs'), MCP_SERVER_TEMPLATE.replace('__PLUGIN_ID__', 'demo-tool'));
const child = spawn(process.execPath, ['server.mjs'], { cwd: folder, stdio: ['pipe', 'pipe', 'inherit'] });
const replies = new Map<number, Record<string, unknown>>();
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    replies.set(message.id, message);
  }
});
const request = async (id: number, method: string, params: Record<string, unknown> = {}) => {
  child.stdin.write(`${JSON.stringify({ id, jsonrpc: '2.0', method, params })}\n`);
  for (let wait = 0; wait < 100 && !replies.has(id); wait += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  return replies.get(id) as { result?: Record<string, unknown>; error?: { code: number } };
};

const init = await request(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
assert.deepEqual(init.result?.serverInfo, { name: 'demo-tool', version: '0.1.0' });
assert.equal(init.result?.protocolVersion, '2025-03-26', 'echoes the client protocol version');
child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
const listed = await request(2, 'tools/list');
assert.deepEqual((listed.result?.tools as Array<{ name: string }>).map((tool) => tool.name), ['echo']);
const called = await request(3, 'tools/call', { name: 'echo', arguments: { text: '你好' } });
assert.deepEqual(called.result?.content, [{ type: 'text', text: '你好' }]);
assert.equal((await request(4, 'tools/call', { name: 'missing' })).error?.code, -32602);
assert.equal((await request(5, 'nope')).error?.code, -32601);
child.kill();
await new Promise((resolve) => child.once("exit", resolve));
fs.rmSync(folder, { recursive: true, force: true });

assert.equal(JSON.parse(buildToolPluginManifest({ author: '我', description: '查天气', id: 'weather', name: '天气' })).mcp.command, 'node');
const skill = buildSkillMarkdown({ description: '陪你练日语\n口语', id: 'japanese-buddy', instructions: '## 怎么陪练\n每次…', name: '日语陪练' });
assert.match(skill, /^---\nname: japanese-buddy\ndescription: 陪你练日语 口语\n---\n\n# 日语陪练\n\n## 怎么陪练/u);
console.log('plugin mcp template smoke passed');
