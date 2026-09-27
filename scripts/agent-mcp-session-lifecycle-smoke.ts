import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

const { createMcpProcess, sendRpc } = await import(pathToFileURL(
  projectPath('electron/mcpStdioSession.cjs'),
).href) as {
  createMcpProcess: (server: Record<string, unknown>) => Record<string, any>;
  sendRpc: (
    state: Record<string, any>,
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ) => Promise<Record<string, unknown>>;
};

const state = createMcpProcess({
  args: ['-e', 'process.exit(17)'],
  command: process.execPath,
  cwd: projectRoot,
  env: {},
  id: 'exit-fast',
});

await new Promise((resolve) => setTimeout(resolve, 250));
assert.equal(state.closed, true);
assert.match(String(state.closeReason ?? ''), /code=17/u);

await assert.rejects(
  () => sendRpc(state, 'tools/list', {}, 5000),
  /MCP session already closed/u,
);

console.log('agent MCP session lifecycle smoke passed');
