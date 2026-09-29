import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-config-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');

const { createMcpConfigService } = await import('../electron/mcpConfigService.cjs') as {
  createMcpConfigService: (options: Record<string, unknown>) => {
    getConfigPath: () => string;
    loadConfig: () => DesktopPetMcpConfigResultLike;
    saveConfig: (request?: { rawText?: string }) => DesktopPetMcpConfigResultLike;
  };
};
const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs') as {
  createMcpServerHealthService: (options?: Record<string, unknown>) => {
    getStatus: (serverId: string) => { status: string };
    recordFailure: (serverId: string, error: unknown) => unknown;
    resetAll: () => number;
  };
};
const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => {
    listTools: (request?: Record<string, unknown>) => Promise<{
      ok: boolean;
      tools: Array<{ name: string; serverId: string; title: string }>;
    }>;
  };
};

const health = createMcpServerHealthService();
const configService = createMcpConfigService({
  onSaved: () => health.resetAll(),
  projectRoot: tempRoot,
});
const initialResult = configService.loadConfig();
assert.equal(initialResult.ok, true);
assert.equal(initialResult.exists, false);
assert.deepEqual(initialResult.config.servers, []);

const invalidResult = configService.saveConfig({ rawText: '{ bad json' });
assert.equal(invalidResult.ok, false);
assert.equal(fs.existsSync(configService.getConfigPath()), false);
health.recordFailure('fake-config', new Error('old command failed'));
assert.equal(health.getStatus('fake-config').status, 'unhealthy');
configService.saveConfig({ rawText: '{ still bad json' });
assert.equal(health.getStatus('fake-config').status, 'unhealthy');

const validConfig = {
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      id: 'fake-config',
      title: 'Fake Config MCP',
    },
  ],
};
const savedResult = configService.saveConfig({ rawText: JSON.stringify(validConfig) });
assert.equal(savedResult.ok, true);
assert.equal(savedResult.exists, true);
assert.equal(fs.existsSync(configService.getConfigPath()), true);
assert.equal(health.getStatus('fake-config').status, 'unknown');

const mcpService = createMcpStdioClientService({ projectRoot: tempRoot });
const toolsResult = await mcpService.listTools({ serverId: 'fake-config' });
assert.equal(toolsResult.ok, true);
assert.equal(toolsResult.tools[0]?.serverId, 'fake-config');
assert.equal(toolsResult.tools[0]?.name, 'echo');

console.log('agent MCP config service smoke passed');
